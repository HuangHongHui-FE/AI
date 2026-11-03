# mingchangmian —— 名场面图文

用户说「写名场面」「今天发名场面」「来一篇」（没给视频素材）时走这条流程。

## 步骤链

```
01-gif-clip      从 B 站/本地视频切 3-8 秒 GIF 首图
   ↓ Claude 起标题 + 写正文，落 article.json
02-selfcheck     公众号硬门（wechat-img 规则集）
03-ai-flavor     AI 味预检
04-format-html   正文 → 微信 HTML
05-cover-image   GIF 首帧 → 2.35:1 封面
06-publish-kit   copy.html + 发布物料.md
```

**终点是物料，不是发布**。公众号/视频号/抖音/快手由人手动发。

## 两段式运行

```bash
# 第一段：只切 GIF
node recipe/mingchangmian/run.mjs --prompt "写名场面" --only gif-clip \
  --source "https://www.bilibili.com/video/BV..." \
  --start 95 --end 101 \
  --name "024-我靠袁华" \
  --cookies_from_browser chrome
# 记下打印的 run 时间戳，例如 20261103-233000

# Claude 读 runs/mingchangmian/<id>/01-gif-clip/ 的 GIF，写 article.json + body.md
# 第二段：续跑后半段（不要加 --only：跳过步骤的目录不会进模板上下文）
node recipe/mingchangmian/run.mjs --resume <id> \
  --article output/2026-11-03/01-我靠袁华/article.json \
  --title "我靠袁华" --name "024-我靠袁华" --date 2026-11-03
```

产物：

```
runs/mingchangmian/<id>/
├── 01-gif-clip/024-我靠袁华.gif
├── 04-format-html/content.html
├── 05-cover-image/cover.jpg
└── 06-publish-kit/{copy.html, 发布物料.md}
```

## 可选手动步骤：推公众号草稿箱

```bash
node atom/wechat-browser-draft/src/index.mjs --mode create \
  --article output/2026-11-03/01-我靠袁华/article.json \
  --head-image runs/mingchangmian/<id>/01-gif-clip/024-我靠袁华.gif
```

只在用户明确要求时跑；**只存草稿，绝不点发表**。

## 写作与合规

- 正文 800-1200 字，一篇只配一张 GIF 首图，不配多图
- 不跨天重复同一场：开跑前查 `logs/` 去重（可用 `dedup-log`）
- preflight 硬门由 `selfcheck --ruleset wechat-img` 承担，FAIL 就回炉改稿，不改门
- 完整写作规范：`references/04-写正文.md`、`references/05-自查.md`、`references/03-起标题.md`
- 切图参数与坑：`references/02-切图.md`
- 原始总索引：`references/original-router.md`

## 相关原子

| 原子 | 作用 |
|---|---|
| `gif-clip` | 视频 → GIF |
| `selfcheck` / `ai-flavor` | 硬门 + AI 味 |
| `format-html` / `cover-image` | 排版 + 封面 |
| `publish-kit` | 出可复制物料 |
| `wechat-browser-draft` | 可选：推公众号草稿箱 |
| `dedup-log` | 可选：跨天去重 |