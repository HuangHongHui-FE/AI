# novel —— 番茄小说

用户说「写一章发番茄」「更新小说」时走这条流程。

## 步骤链

```
01-selfcheck     章节自查
02-fanqie-publish 存草稿（绝不自动发布）
```

## 章节文件格式

```markdown
# 第 42 章 意外的来客

正文第一段。
```

首行 `# ` 会被提取为**章节标题**，其余行转 `<p>`。

## 运行

```bash
# 先查 book_id
node atom/fanqie-publish/src/index.mjs --list --auth .cache/fanqie/fanqie.json

node recipe/novel/run.mjs --prompt "写一章" \
  --book 123456 --chapter_file chapter.md --article article.json
```

## 安全边界

`fanqie-publish` **不提供发布接口**——只存草稿。发布由用户在作家后台手动点。
