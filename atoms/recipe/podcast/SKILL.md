# podcast —— 商业财经播客

用户说「写播客」「来一期播客」时走这条流程。

## 步骤链

```
01-tts-audio     文稿 → mp3（edge-tts，无需 key）
02-selfcheck     口播稿自查（podcast 规则集：第一人称正当、不卡模板句）
03-format-html   转公众号正文 HTML
04-cover-image   生成封面
05-wechat-draft  推草稿
```

## 正文组织

公众号正文是**音频的精华摘要**，顶部放音频链接，完整内容听音频。

口播稿和公众号正文是两个文件：
- `--script_file`：完整口播稿（喂给 TTS）
- `--article`：公众号正文的 article.json（含 title/body_markdown）

## 运行

```bash
node recipe/podcast/run.mjs --prompt "来一期播客" \
  --script_file script.md --article article.json \
  --title "本期标题" --cover_source cover.jpg
```
