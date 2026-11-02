---
name: fanqie-publish
description: 番茄小说章节存草稿（默认只存草稿，绝不自动发布）。读章节 md 提取标题、转 HTML、调三步接口存入草稿箱，发布由人工在作家后台点。
---

# fanqie-publish —— 番茄小说存草稿

**给什么**：章节 markdown
**还什么**：草稿已进番茄作家后台（人工检查后发布）

## 触发

「发番茄」「存草稿」「更新小说」

## 用法

```bash
# 列出账号下的书（拿 book_id）
node atom/fanqie-publish/src/index.mjs --list --auth .cache/fanqie/fanqie.json

# 存草稿
node atom/fanqie-publish/src/index.mjs --book 123456 --file chapter.md --auth .cache/fanqie/fanqie.json

# 只做本地解析与转换，不调接口
node atom/fanqie-publish/src/index.mjs --book 123456 --file ch.md --dry-run --auth x.json

# 覆盖章节标题
node atom/fanqie-publish/src/index.mjs --book 123456 --file ch.md --title "第 43 章 新标题"
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--book` | 必填 | book_id（先 `--list` 查） |
| `--file` | 必填 | 章节 md |
| `--title` | 首行 `# 标题` | 章节标题 |
| `--auth` | `.cache/fanqie/fanqie.json` | 登录态文件（也可用 `FANQIE_AUTH_DIR`） |
| `--list` | 关 | 列书 |
| `--dry-run` | 关 | 只解析不调接口 |

## 存草稿三步

1. `new_article` — 建空草稿（`need_reuse=1` 复用上个草稿的卷结构）
2. `cover_article` — 填标题 + 正文 HTML
3. `save_doc_history` — 标记保存

**`publish_article` 是发布接口，本原子不提供。** 发布是用户的明确决定，不能让脚本替人按这个键。

## 章节文件格式

```markdown
# 第 42 章 意外的来客

摊子刚收一半，天就阴了下来。

老陈抬头看了一眼。
```

- 首行 `# ` 开头的作为**章节标题**
- 其余行作为正文，逐行转 `<p>` 段落
- 正文里的 `<` `>` `&` 会转义（防止破 HTML）

## 登录态

`fanqie.json` 需要两个字段：

```json
{ "cookie": "sid=...; ...", "csrfToken": "..." }
```

请求头带 `X-Secsdk-Csrf-Token`。**鉴权会过期**，报 `登录信息有误` 就要重新抓取。

## 输出

```json
{
  "ok": true, "mode": "draft", "book_id": "123456",
  "title": "第 42 章 意外的来客", "chars": 68,
  "item_id": "item-1", "volume_id": "vol-1", "volume_name": "正文"
}
```

## 回归

```bash
node atom/fanqie-publish/fixtures/regression.mjs
```

14 条断言，起本地 mock 服务器，**关键断言是「未调用 publish_article」**。还覆盖三步调用顺序、HTML 转义、标题行不进正文、无标题拦截。

## 已知坑

1. **`aid=2503` / `app_name=muye_novel` 是签名白名单的一部分**，改动会被拒。别当无用参数删
2. **登录态过期**很常见，报「登录信息有误」就要重新抓 cookie + csrfToken
3. **`need_reuse=1` 依赖上一章存在**——新书第一次发章节时可能拿不到 volume_data，此时回落「正文」分卷
4. **中文引号**：源实现会把正文原样转 HTML，`"` 会保持 ASCII 引号。番茄渲染没问题，但要注意别写成 HTML 实体
5. 章节里的 `# ` 行全都会被当标题行剥掉——正文里不要用 `# ` 开头
