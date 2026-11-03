# manga —— 条漫发布

**流程**：panels JSON → 画图 → 自查 → 排版 → 封面 → 推草稿

## 用法

```bash
node recipe/manga/run.mjs \
  --panels panels.json \
  --article article.json \
  --body body.md \
  --title "第 43 集 老周的早饭"
```

| 参数 | 说明 |
|---|---|
| `--panels` | comic-draw 的输入（`{slug, panels: []}`） |
| `--article` | selfcheck 用（`{title, body_markdown}`） |
| `--body` | format-html 用的 markdown（图片引用指向 comic-draw 的输出） |
| `--title` | 草稿标题 |

## 前置：正文谁写

`comic-draw` 只出图，**正文和 article.json 由 Claude 写**。顺序：

1. 确定这一集讲什么
2. 写 panels JSON（每格谁、在哪、说什么）
3. 跑 `comic-draw` 出图，看效果
4. 按图写 `body.md`（图片引用用 `{{step.comic-draw}}/01.jpg` 这类路径）和 `article.json`
5. 跑本 recipe

## 产物

```
runs/manga/<时间戳>/
├── 01-comic-draw/     01.jpg … NN.jpg + strip.jpg
├── 02-selfcheck/      result.json
├── 03-format-html/    content.html + preview.html
├── 04-cover-image/    cover.jpg（取第一格裁 2.35:1）
└── 05-wechat-draft/   result.json
```

## 注意

- 封面默认取**第一格** `01.jpg`，不是长条漫（strip.jpg 比例太窄，裁 2.35:1 会切碎）
- 角色是内置的「老周家」5 人，见 `atom/comic-draw/SKILL.md`
- 发布时在草稿箱勾「原创声明 → 漫画」类目
