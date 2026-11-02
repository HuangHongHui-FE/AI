#!/usr/bin/env node
// 回归：dedup-log 的解析与追加。
// 解析侧用 fixture 日志（不依赖外部项目）；追加侧验证幂等、补缺失、不覆盖、尾巴段前插入。
// 用法：node atom/dedup-log/fixtures/regression.mjs

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, renderPrompt } from "../src/lib/analyze.mjs";
import { appendArticle } from "../src/lib/append.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), "dl-reg-"));
const logsDir = join(work, "logs");
mkdirSync(logsDir, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// fixture 日志：两篇文章 + 尾巴段（顺延候选），覆盖格式B + 尾巴段场景
const FIXTURE = `# 2026-10-28 发文日志

## 01 | 第一篇测试文章

- 收口方式：1-数字收束式
- 收口骨架：4-数字定格
- 开头骨架：10-数字+对象
- 开头钩子：2-数据冲击
- 结构配方：7-时间线
- 叙事口吻：5-无主语客观
- 切入角度：13-代价账
- 段间衔接：2-时间顺推
- 格式组合：3-加粗/6-引用块
- 排版 theme：ocean
- 封面布局：plain
- title_style：贴原词-第一篇测试文章

## 02 | 第二篇测试文章

- 收口方式：1-数字收束式
- 收口骨架：4-数字定格
- 开头骨架：10-数字+对象
- 开头钩子：2-数据冲击
- 结构配方：7-时间线
- 叙事口吻：5-无主语客观
- 切入角度：13-代价账
- 段间衔接：2-时间顺推
- 格式组合：3-加粗/6-引用块
- 排版 theme：ocean
- 封面布局：plain
- title_style：贴原词-第二篇测试文章

## 顺延次日候选

- 某个候选话题
`;
writeFileSync(join(logsDir, "2026-10-28.md"), FIXTURE);

// 1. 解析：两篇 + 各维已用值
const res = analyze(logsDir, 2);
check("解析出 2 篇", res.total_articles === 2, `实际 ${res.total_articles}`);
check("窗口倒序（新→旧）", res.window[0].id === "2026-10-28#02", res.window[0].id);
check("theme 已解析", res.dims.theme.used[0].value === "ocean", res.dims.theme.used[0]?.value || "空");
check("尾巴段未被当成文章", !res.window.some((w) => /顺延/.test(w.title)));

// 2. 扎堆检测：两篇同一维度同值 → crowded
check("同值扎堆被识别", res.dims["收口方式"].crowded.length === 1, JSON.stringify(res.dims["收口方式"].crowded));
// 封面布局固定 plain 属预期，不告警
check("封面布局重复不告警", res.dims.cover_style.crowded.length === 0);

// 3. 标题原词重复
check("标题原词重复被识别", res.title_words.duplicated.length === 0, "两篇原词不同，应为 0");

// 4. 情绪尾超限
check("情绪尾未超限", res.emotion_tail.over_limit === false);

// 5. prompt 渲染含关键段
const prompt = renderPrompt(res, 2);
check("prompt 含维度段", prompt.includes("已用维度——本篇须避开"));
check("prompt 含扎堆警示", prompt.includes("已扎堆，强制换"));

// 6. 追加：新分节插在尾巴段之前
const r1 = appendArticle({
  logsDir,
  date: "2026-10-28",
  no: 3,
  title: "第三篇新文章",
  dims: { theme: "wine", 收口方式: "7-留白式" },
  note: "测试备注",
});
const after = readFileSync(join(logsDir, "2026-10-28.md"), "utf8");
const idxNew = after.indexOf("## 03 | 第三篇新文章");
const idxTail = after.indexOf("## 顺延次日候选");
check("新分节已插入", idxNew > 0, r1.action);
check("新分节在尾巴段之前", idxNew < idxTail, `new@${idxNew} tail@${idxTail}`);

// 7. 幂等：重复追加应 no-change
const r2 = appendArticle({ logsDir, date: "2026-10-28", no: 3, title: "第三篇新文章", dims: { theme: "wine" } });
check("重复追加幂等", r2.action === "no-change", r2.action);

// 8. 补缺失维度且不覆盖已有值
const r3 = appendArticle({
  logsDir,
  date: "2026-10-28",
  no: 1,
  title: "第一篇测试文章",
  dims: { theme: "SHOULD-NOT-OVERWRITE", 口头禅: "8-口头禅X" },
});
const after2 = readFileSync(join(logsDir, "2026-10-28.md"), "utf8");
const sec1 = after2.slice(after2.indexOf("## 01 |"), after2.indexOf("## 02 |"));
check("缺失维度已补写", sec1.includes("口头禅：8-口头禅X"), r3.action);
check("已有维度未被覆盖", sec1.includes("排版 theme：ocean") && !sec1.includes("SHOULD-NOT-OVERWRITE"));

// 9. 读回：新追加的文章能被解析到
const res2 = analyze(logsDir, 5);
check("追加后可被解析", res2.total_articles === 3, `实际 ${res2.total_articles}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
