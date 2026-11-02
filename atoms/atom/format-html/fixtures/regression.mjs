#!/usr/bin/env node
// 回归：format-html 与源 html.js 的输出一致性 + 扩展语法覆盖
// 用法：node atom/format-html/fixtures/regression.mjs --src-html <项目 html.js 路径>
// 退出码：0 通过 / 1 失败

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markdownToHtml, fullPageHtml, pickRandomThemeName, themeByName } from "../src/lib/render.mjs";
import { THEME_NAMES } from "../references/themes.mjs";

const args = process.argv.slice(2);
const srcHtml = args.includes("--src-html") ? args[args.indexOf("--src-html") + 1] : "";
const work = mkdtempSync(join(tmpdir(), "fmt-reg-"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// 覆盖全部扩展语法的测试文稿
const MD = `第一段正文，用来验证基础渲染。

## 二级标题

这里有**加粗**、*斜体*、==高亮==、~~删除线~~、\`行内代码\`、^上标^。

### 三级标题

> 这是一段引用。

:::info 提示框内容
:::

:::tip 技巧内容
:::

:::warning 警告内容
:::

:::danger 危险内容
:::

:::stat 31% 非计划支出占比
:::

:::time 2023 开始记账
:::

:::quote 原话内容 | 署名
:::

- 无序项一
- 无序项二

1. 有序项一
2. 有序项二

| 列A | 列B |
|---|---|
| 值1 | 值2 |

---

:fire: :check: :star:

![图片说明](pic.jpg)
`;

writeFileSync(join(work, "test.md"), MD);

// 1. 全部主题都能渲染且输出非空
let okThemes = 0;
const badThemes = [];
for (const t of THEME_NAMES) {
  try {
    const html = markdownToHtml(MD, t);
    if (html.length > 500) okThemes++;
    else badThemes.push(`${t}:短(${html.length})`);
  } catch (e) {
    badThemes.push(`${t}:${e.message}`);
  }
}
check(`全部 ${THEME_NAMES.length} 套主题可渲染`, okThemes === THEME_NAMES.length, badThemes.join(",") || "全部通过");

// 2. 扩展语法逐项出现
const html = markdownToHtml(MD, "ocean");
const syntax = [
  ["加粗", /<strong style="color:#2A6B8C/],
  ["斜体", /<em style="font-style:italic/],
  ["高亮", /background:#D2E2EC;color:#2A6B8C/],
  ["删除线", /<del style="text-decoration:line-through/],
  ["行内代码", /<code style="background:#f3f3f3/],
  ["上标", /<sup style="font-size:0.75em/],
  ["提示框", /border-left:4px solid #2C4A6B/],
  ["数据卡", /font-size:26px;font-weight:700/],
  ["时间线", /font-weight:700;color:#2A6B8C;margin-right:12px/],
  ["引语署名", /text-align:right;font-size:13px/],
  ["表格", /<table style="border-collapse:collapse/],
  ["列表样式", /<ul style="margin:12px 0;padding-left:22px/],
  ["图片 figure", /<figure style="margin:18px 0;text-align:center/],
  ["分隔线", /· · ·/],
  ["emoji", /🔥|✅|⭐/],
];
for (const [name, re] of syntax) check(`扩展语法：${name}`, re.test(html));

// 3. 列表紧凑化：<ol> 与 <li> 之间不应有空白换行
check("列表标签间无换行", !/<(?:ol|ul)\b[^>]*>\s+</.test(html));

// 4. 主题名无效时回落 minimal
const fallback = themeByName("不存在的主题");
check("未知主题回落 minimal", fallback === themeByName("minimal"));

// 5. 随机主题避开 exclude
let avoided = true;
for (let i = 0; i < 30; i++) {
  const t = pickRandomThemeName(["ocean", "warm"]);
  if (t === "ocean" || t === "warm") avoided = false;
}
check("随机主题避开 exclude", avoided);

// 6. 预览页含外壳
const page = fullPageHtml("标题", html, "ocean");
check("预览页有 html 外壳", page.startsWith("<!doctype html>") && page.includes("</html>"));
check("预览页不含 CTA", !/关注|点赞|在看|转发/.test(page));

// 7. 与源 html.js 逐字节对比
if (srcHtml) {
  const mod = await import(srcHtml);
  for (const t of ["ocean", "minimal", "warm", "ink", "wine", "graphite", "coral"]) {
    if (!THEME_NAMES.includes(t)) continue;
    const a = markdownToHtml(MD, t);
    const b = mod.markdownToHtml(MD, t);
    check(`与源 html.js 一致：${t}`, a === b, a === b ? `${a.length} 字节` : `atom ${a.length} vs src ${b.length}`);
  }
} else {
  console.log("（未给 --src-html，跳过与源项目的一致性对比）");
}

const failN = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failN}/${results.length} 通过`);
process.exit(failN ? 1 : 0);
