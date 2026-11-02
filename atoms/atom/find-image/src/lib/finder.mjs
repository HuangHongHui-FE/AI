// 批量找图主流程：多查询多渠道路候选 → 过滤去重 → 分档下载 → 主图命名 → 写 manifest
// 分档下载顺序：强相关（多实体全含）→ 部分相关 → 新闻正文图，凑够目标张数即停

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { bingCandidates, sogouCandidates, qihooCandidates, newsCandidates } from "./sources.mjs";
import { rejectReason, urlAgeMonths, splitEntities, isRelevant, downgradeSubjects, imageFingerprint } from "./filters.mjs";
import { downloadAsJpeg, nextIndex, saveJpeg } from "./imaging.mjs";
import { sleep } from "./http.mjs";
import { log } from "../../../../_shared/io.mjs";

// 生成多组查询词：主体+事件是主轴，再补现场/战报/最新等变体提高召回
function buildQueries(subject, event) {
  const base = event ? `${subject} ${event}` : subject;
  const list = [base, subject, `${base} 现场`, `${base} 战报`, `${subject} 最新`, `${base} 比赛`];
  return [...new Set(list.filter(Boolean))];
}

// 采集候选：图库渠道 + 新闻渠道，统一过滤
async function collectCandidates({ subject, event, history, maxAgeMonths }) {
  const queries = buildQueries(subject, event);
  const keywords = splitEntities(subject);
  const seen = new Set();
  const cands = [];

  // 是否超龄：--history 模式关掉新鲜度门（历史事件要抓往年旧图）
  const tooOld = (u) => {
    if (history) return false;
    const age = urlAgeMonths(u);
    return age !== null && age > maxAgeMonths;
  };

  // 添加候选的统一入口：过滤→去重→打相关标签
  const fps = new Set(); // 内容指纹，挡同图多尺寸变体
  const add = (c, { strong = null } = {}) => {
    if (seen.has(c.url)) return;
    const why = rejectReason(c.url, c.title);
    if (why) return;
    if (tooOld(c.url)) return;
    const fp = imageFingerprint(c.url);
    if (fps.has(fp)) return; // 同一张图的其他尺寸变体，丢弃
    fps.add(fp);
    seen.add(c.url);
    cands.push({
      ...c,
      strong: strong === null ? isRelevant(c.title, c.url, keywords) : strong,
      age: urlAgeMonths(c.url),
    });
  };

  // ① 图库渠道：必应带时间过滤（保新）优先，搜狗/360 补量
  const timeFilters = history ? [""] : ["age-lt604800", "age-lt86400"]; // 近7天 / 近24小时
  for (const q of queries) {
    for (const tf of timeFilters) {
      const bing = await bingCandidates(q, { timeFilter: tf });
      // 强相关候选放宽翻页数，其余只取第一页，避免请求量爆炸
      bing.forEach((c) => add(c));
    }
    (await sogouCandidates(q)).forEach((c) => add(c));
    (await qihooCandidates(q)).forEach((c) => add(c));
    await sleep(450); // 渠道间控速
  }

  log(`图库候选 ${cands.length} 个`);

  // ② 新闻正文图：头条搜索按「文章标题+配图」配对，标题可用于相关性校验
  //    （原实现把新闻图一律标 strong，实测抓出寿司图/导航图当配图；
  //      现在按标题判相关，相关才算新闻档，不相关直接丢）
  for (const q of queries) {
    const news = await newsCandidates(q);
    for (const c of news) {
      // 搜狗兜底的候选 title 就是查询词，判不出真假；头条配对的有真实标题
      const hasRealTitle = c.title && c.title !== q;
      if (hasRealTitle && !isRelevant(c.title, c.url, keywords)) continue; // 标题与主体无关，丢弃
      add(c, { strong: hasRealTitle });
    }
  }

  log(`累计候选 ${cands.length} 个（含新闻正文图）`);
  return { cands, keywords };
}

// 分档：强相关 / 部分相关 / 新闻；返回三个桶
function bucketize(cands, keywords) {
  const strong = [];
  const partial = [];
  const news = [];
  for (const c of cands) {
    if (c.source.startsWith("新闻")) {
      news.push(c);
      continue;
    }
    // 多实体必须全含才算强相关；单实体含任一即可
    const fullMatch =
      keywords.length >= 2
        ? keywords.every((k) => (c.title || "").includes(k))
        : isRelevant(c.title, c.url, keywords);
    if (c.strong || fullMatch) strong.push(c);
    else if (isRelevant(c.title, c.url, keywords)) partial.push(c);
  }
  return { strong, partial, news };
}

// 按档位下载：强相关 → 部分相关 → 新闻，凑够目标即停
async function downloadBuckets({ strong, partial, news }, { outDir, target }) {
  const items = [];
  let idx = nextIndex(outDir);
  let skippedNoDate = 0;
  // 内容指纹去重：不同 URL 可能指向同一张图（实测必应 009/019 字节全同），
  // URL 级 fingerprints 挡不住，必须按下载后的字节哈希再挡一次
  const seenHash = new Set();
  let dupSkipped = 0;

  for (const bucket of [strong, partial, news]) {
    for (const c of bucket) {
      if (items.length >= target) break;
      // 无日期戳的图库图（非新闻、非强相关）丢弃——保新底线
      if (!c.source.startsWith("新闻") && c.age === null && !c.strong) {
        skippedNoDate++;
        continue;
      }
      const got = await downloadAsJpeg(c.url, c.referer);
      if (!got) continue;
      const hash = createHash("sha1").update(got.buf).digest("hex");
      if (seenHash.has(hash)) {
        dupSkipped++;
        continue;
      }
      seenHash.add(hash);
      const file = `${String(idx).padStart(3, "0")}.jpg`;
      saveJpeg(got.buf, outDir, file);
      items.push({
        file,
        w: got.w,
        h: got.h,
        ratio: Number((got.w / got.h).toFixed(2)),
        title: (c.title || c.source).slice(0, 60),
        source: c.source,
        url: c.url,
        age_months: c.age,
      });
      idx++;
      log(`✓ ${file} ${got.w}x${got.h} ${c.source}`);
    }
  }
  return { items, skippedNoDate, dupSkipped };
}

// 批量找图主入口
export async function findImages({
  subject,
  event = "",
  outDir,
  target = 20,
  history = false,
  maxAgeMonths = 3,
}) {
  mkdirSync(outDir, { recursive: true });

  // 主体词逐级降级：整串搜不到就放宽到核心词（洛阳卤蛋店 → 卤蛋店 → 卤蛋）
  // 判定「可用」必须是真下到图，不能只看候选数——新闻候选常因图床 403 全军覆没（实测头条图床）
  const levels = downgradeSubjects(subject);
  let usedSubject = subject;
  let items = [];
  let keywords = [];
  let skippedNoDate = 0;
  let dupSkipped = 0;

  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const r = await collectCandidates({ subject: lv, event, history, maxAgeMonths });
    keywords = r.keywords;
    const buckets = bucketize(r.cands, keywords);
    log(`「${lv}」强相关 ${buckets.strong.length} · 部分相关 ${buckets.partial.length} · 新闻 ${buckets.news.length}`);

    const res = await downloadBuckets(buckets, { outDir, target });
    skippedNoDate += res.skippedNoDate;
    dupSkipped += res.dupSkipped;
    items = res.items;

    if (items.length > 0) {
      usedSubject = lv;
      break;
    }
    if (i < levels.length - 1) log(`「${lv}」下不到图，降级重试`);
  }

  if (usedSubject !== subject) log(`⚠ 主体词已降级：「${subject}」→「${usedSubject}」`);

  if (!items.length) {
    // 无图时也要回传关键词，便于排查「是没找到还是全被过滤了」
    return { subject: usedSubject, event, count: 0, images: [], skipped_no_date: skippedNoDate, dup_skipped: dupSkipped, keywords };
  }

  // 主图命名：优先「够宽 + 像素最多」的一张作封面候选
  // 不能只按比例挑——实测同一新闻会出 450x294 横幅缩略图和 956x1594 大图，
  // 纯按比例会选中缩略图当封面，清晰度不够
  const widthOk = items.filter((it) => it.ratio >= 1.3); // 封面要横图，竖图裁 2.35:1 会切掉主体
  const pool = widthOk.length ? widthOk : items;
  const best = pool.reduce((a, b) => {
    const pa = a.w * a.h;
    const pb = b.w * b.h;
    // 像素总数优先；同量级时取更宽的（更适合裁封面）
    if (Math.abs(pa - pb) > pa * 0.2) return pa > pb ? a : b;
    return a.ratio > b.ratio ? a : b;
  });
  const ordered = [best, ...items.filter((it) => it !== best)];
  // 先全部改成临时名再落地，避免 001→002 覆盖已有 002
  ordered.forEach((it, i) => renameSync(join(outDir, it.file), join(outDir, `.tmp-${i}.jpg`)));
  ordered.forEach((it, i) => {
    const name = i === 0 ? "001-主图.jpg" : `${String(i + 1).padStart(3, "0")}.jpg`;
    renameSync(join(outDir, `.tmp-${i}.jpg`), join(outDir, name));
    it.file = name;
  });

  return {
    subject: usedSubject,
    event,
    count: items.length,
    images: ordered,
    skipped_no_date: skippedNoDate,
    dup_skipped: dupSkipped,
    keywords,
  };
}

// 写人读清单（manifest.md），Claude 和用户都能快速过一眼
export function writeManifestMd(result, outDir) {
  const { subject, event, count, images, skipped_no_date, dup_skipped } = result;
  const lines = [
    "# 候选图清单",
    "",
    `> 主体「${subject}」· 事件「${event || "无"}」· 共 ${count} 张`,
    "",
  ];
  for (const it of images) {
    const use = it.file === "001-主图.jpg" ? "【封面主图】" : it.ratio >= 1.6 ? "可做封面/内图" : "内图";
    lines.push(`- ${it.file} — ${it.w}x${it.h} 比例${it.ratio} ${it.source} ${use} ${it.title}`);
  }
  if (skipped_no_date > 0) lines.push("", `> 已跳过无日期戳的旧图 ${skipped_no_date} 张`);
  if (dup_skipped > 0) lines.push("", `> 已跳过重复内容图 ${dup_skipped} 张（不同 URL 指向同一张图）`);
  writeFileSync(join(outDir, "manifest.md"), lines.join("\n") + "\n");
  return join(outDir, "manifest.md");
}
