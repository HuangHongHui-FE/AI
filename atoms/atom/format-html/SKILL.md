---
name: format-html
description: markdown 正文 → 微信正文 HTML，20 套主题配色随机轮换（去同质化），支持高亮/提示框/时间线/数据卡/引语署名等扩展语法。用于公众号图文排版。
---

# format-html —— markdown → 微信 HTML

**给什么**：markdown 正文（+ 可选主题名）
**还什么**：可直接作为草稿 `content` 的微信 HTML + 本地预览页

原实现 4 套分叉（`html.js` 490/493/610/607 行），此原子以 `wechat-img` 版为基准合一，输出与之**逐字节一致**。

## 触发

「排版」「转 HTML」「生成公众号正文」

## 用法

```bash
# 指定主题
node atom/format-html/src/index.mjs --md article.md --out-dir 05-format-html --theme ocean

# 随机主题，避开近几篇用过的
node atom/format-html/src/index.mjs --md article.md --out-dir x --random --exclude ocean,warm

# 列出所有主题
node atom/format-html/src/index.mjs --list
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--md` | 必填 | markdown 路径 |
| `--out-dir` | 必填 | 输出目录 |
| `--theme` | 随机 | 主题名 |
| `--random` | 关 | 随机抽（即使没传 --theme 也默认随机） |
| `--exclude` | 无 | 逗号分隔，随机时排除 |
| `--title` | 空 | 预览页标题 |

产物：`content.html`（推微信）+ `preview.html`（本地预览，带灰底白卡）。
输出：`{ ok, theme, content, preview, chars, bytes, images }`

## 主题（20 套）

`minimal` `warm` `cool` `ink` `moss` `slate` `plum` `sand` `pine` `rust` `ocean` `olive` `cocoa` `lavender` `sage` `cobalt` `amber` `forest` `graphite` `wine`

每套含：主色、浅色、正文色、边框色、背景色 + 三个开关（`h2Bar` 标题色条 / `strongBg` 加粗浅底 / `quoteBg` 引用底色）。配色在 `references/themes.mjs`，改配色不动引擎。

## 扩展语法（都不是 markdown 标准，预处理成 HTML）

| 语法 | 效果 |
|---|---|
| `==文字==` | 主题色浅底高亮 |
| `:::info / tip / warning / danger 内容 :::` | 左竖条提示框 |
| `:::time 2023 事件描述 :::` | 时间线节点 |
| `:::stat 31% 说明 :::` | 数据卡片 |
| `:::quote 原话 \| 署名 :::` | 带署名的引用块 |
| `^上标^` | `<sup>` |
| `:fire: :check:` 等 | emoji shortcode |

## 微信排版的关键约束

微信正文**不吃外链 CSS**，所有样式必须内联到每个标签：

- `<table>/<th>/<td>` 逐标签写边框（否则挤成一团）
- `<ul>/<ol>` 写 padding（默认 bullet/缩进会被吃掉）
- 列表标签间换行必须压缩（微信渲染器不折叠空白文本节点，`<ol>\n<li>` 会渲染成空行）
- `<code>/<del>` 都要内联样式

## 已完成项

- CTA 卡片已彻底移除（2026-09-14 用户决定：正文写完即结束，不引导任何操作）
- 与源项目 `wechat-img/src/html.js` 在 ocean/minimal/warm 三主题下**逐字节一致**（已对比验证）

## 已知坑

1. **callout 里的 `**加粗**` 不会被解析**——预处理阶段整段塞进 HTML 了。要加粗就写在 callout 外面
2. 主题名写错会回落 `minimal` 并提示
3. 同一篇内必须固定同一主题——`--theme` 抽一次再传，别在循环里重抽
