// 番茄作家后台客户端：读 .auth/fanqie.json 鉴权，调真实 HTTP 接口列书/发草稿/定时发布
// 用法：
//   npm run publish -- --list                 # 列出账号下所有书
//   npm run publish -- --book <id> --file <chapter.md> [--draft] [--timer <unix秒>] [--title <标题>]
//     --draft   只进草稿箱（默认）；不带则立即发布；--timer 给未来时间即定时预约发布
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUTH_FILE = join(ROOT, ".auth", "fanqie.json");
const BASE = "https://fanqienovel.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const COMMON = { aid: "2503", app_name: "muye_novel" };

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) {
      const key = k.slice(2);
      a[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else a._.push(k);
  }
  return a;
}

async function loadAuth() {
  try {
    const j = JSON.parse(await readFile(AUTH_FILE, "utf8"));
    if (!j.cookie || !j.csrfToken) throw new Error("鉴权字段缺失");
    return j;
  } catch {
    throw new Error(`未找到有效登录态 ${AUTH_FILE}，请先跑：npm run login`);
  }
}

function headers(auth) {
  return {
    Cookie: auth.cookie,
    "User-Agent": UA,
    Accept: "application/json, text/plain, */*",
    Origin: BASE,
    Referer: `${BASE}/main/writer/`,
    "X-Secsdk-Csrf-Token": auth.csrfToken,
  };
}

async function req(auth, method, path, params) {
  const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
  const url = method === "POST" ? `${BASE}${path}` : `${BASE}${path}?${qs}`;
  const res = await fetch(url, {
    method,
    headers:
      method === "POST"
        ? { ...headers(auth), "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }
        : headers(auth),
    body: method === "POST" ? qs : undefined,
  });
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`${path} 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 120)}`);
  }
  if (j.code !== 0) {
    const msg = j.message || j.msg || "未知错误";
    const hint = /登录|登陆|csrf|权限|未授权|token/i.test(msg) ? "（鉴权失效，请重跑 npm run login）" : "";
    throw new Error(`${path} 失败 code=${j.code}: ${msg}${hint}`);
  }
  return j.data;
}

async function listBooks(auth) {
  const data = await req(auth, "GET", "/api/author/stats/book_list/v0/", {
    page_index: 0,
    page_count: -1,
    image_fmt_list: "160x214",
  });
  const list = Array.isArray(data) ? data : data?.stats_book_list ?? data?.book_list ?? data?.list ?? [];
  console.log("\n📚 账号下小说：");
  for (const b of list) {
    console.log(`  ${b.book_id} | ${b.book_name} | 字数 ${b.word_number ?? b.word_count ?? "-"} | 状态 ${b.creation_status ?? "-"}`);
  }
  return list;
}

async function newDraft(auth, bookId) {
  const data = await req(auth, "POST", "/api/author/article/new_article/v0/", {
    book_id: bookId,
    need_reuse: 1, // 复用上个草稿的卷结构
  });
  let volumeId = String(data?.volume_id ?? "");
  let volumeName = "正文";
  try {
    let vd = data?.volume_data;
    if (typeof vd === "string") vd = JSON.parse(vd);
    if (Array.isArray(vd)) {
      const hit = vd.find((v) => String(v.volume_id) === volumeId) ?? vd[0];
      if (hit?.volume_name) volumeName = hit.volume_name;
    }
  } catch { /* 用默认分卷名 */ }
  return { itemId: String(data.item_id), volumeId, volumeName };
}

// 存草稿三步：new_article 建草稿 → cover_article 填标题+正文 → save_doc_history 标记保存
// （publish_article 是发布，禁用；定时发布用 timer 字段也是发布，禁用）
async function saveDraft(auth, opts) {
  const draft = await newDraft(auth, opts.bookId);
  const volumeId = opts.volumeId || draft.volumeId;
  const volumeName = opts.volumeName || draft.volumeName;
  // 第2步：填标题+正文（content 为 HTML）
  await req(auth, "POST", "/api/author/article/cover_article/v0/", {
    item_id: draft.itemId,
    book_id: opts.bookId,
    title: opts.title,
    content: opts.content,
    volume_id: volumeId,
    volume_name: volumeName,
  });
  // 第3步：标记存草稿
  await req(auth, "POST", "/api/author/article/save_doc_history/v0/", {
    book_id: opts.bookId,
    item_id: draft.itemId,
  });
  console.log(`\n✅ 章节「${opts.title}」已存入草稿箱（item_id: ${draft.itemId}）\n   用户到番茄作家助手草稿箱检查后手动发布。`);
  return draft;
}

// 发布（仅用户明确传 --publish 才走）：publish_article 提交发布/上架
async function publishChapter(auth, opts) {
  const draft = await newDraft(auth, opts.bookId);
  const volumeId = opts.volumeId || draft.volumeId;
  const volumeName = opts.volumeName || draft.volumeName;
  await req(auth, "POST", "/api/author/article/publish_article/v0/", {
    item_id: draft.itemId,
    book_id: opts.bookId,
    content: opts.content,
    title: opts.title,
    volume_id: volumeId,
    volume_name: volumeName,
    timer_status: 0,
    timer_time: 0,
    publish_status: 1,
    need_pay: 0,
    use_ai: 2, // 2=如实标注 AI 辅助创作
    device_platform: "pc",
    speak_type: 0,
    timer_chapter_preview: "[]",
    has_chapter_ad: "false",
    chapter_ad_types: "",
  });
  console.log(`\n🚀 章节「${opts.title}」已提交发布（item_id: ${draft.itemId}），番茄审核中。`);
  return draft;
}

// 文本 → <p> 段落 HTML
function toHtml(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${l}</p>`)
    .join("");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const auth = await loadAuth();
  if (a.list) {
    await listBooks(auth);
    return;
  }
  if (a.file) {
    const content = await readFile(resolve(ROOT, a.file), "utf8");
    // 首行 `# 第N章 标题` 作为章节标题
    const firstLine = content.split("\n").find((l) => l.trim().startsWith("# "))?.trim() ?? "";
    const title = a.title || firstLine.replace(/^#\s*/, "").trim();
    const body = content
      .split("\n")
      .filter((l) => !l.trim().startsWith("# "))
      .join("\n")
      .trim();
    if (!a.book) throw new Error("请指定 --book <book_id>（用 --list 查看）");
    // 默认存草稿箱；仅用户明确传 --publish 才发布
    const fn = a.publish ? publishChapter : saveDraft;
    await fn(auth, {
      bookId: a.book,
      title,
      content: toHtml(body),
    });
    return;
  }
  console.log(
    "用法：\n  npm run publish -- --list\n  npm run publish -- --book <id> --file <chapter.md> [--publish]（默认存草稿箱；--publish 才发布）"
  );
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
