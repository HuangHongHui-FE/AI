---
name: tts-audio
description: 文稿转 mp3 音频（edge-tts 微软免费接口，无需 API key）。自动清理 markdown 排版、按句尾标点分块、字节拼接合并，不依赖 ffmpeg。用于播客音频、文章有声版。
---

# tts-audio —— 文稿转音频

**给什么**：文稿（markdown / 纯文本 / article.json）
**还什么**：mp3 文件 + 清理后的朗读稿

源实现 `audio/src/audio.js` 依赖 ffmpeg 合并分块，**本机实测 ffmpeg 未安装**。此原子改为直接拼接 MP3 字节流，去掉这个硬依赖。

## 触发

「生成音频」「做播客」「读一遍」「转语音」

## 用法

```bash
# 从文件生成
node atom/tts-audio/src/index.mjs --text-file script.md --out audio/s01.mp3

# 直接给文稿
node atom/tts-audio/src/index.mjs --text "要读的内容" --out out.mp3

# 从 article.json 读（取 script 或 body_markdown 字段）
node atom/tts-audio/src/index.mjs --json article.json --out out.mp3

# 只估算分块与时长，不生成（快速检查长度是否够 10 分钟）
node atom/tts-audio/src/index.mjs --text-file script.md --plan
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--text` / `--text-file` / `--json` | 必填其一 | 文稿来源 |
| `--out` | 必填 | mp3 输出路径 |
| `--voice` | `zh-CN-XiaoxiaoNeural` | 音色 |
| `--rate` | `default` | 语速（如 `+10%`） |
| `--max-chunk` | 400 | 每段最大字数 |
| `--plan` | 关 | 只估算不生成 |

常用中文音色：`zh-CN-XiaoxiaoNeural`（女声，默认）、`zh-CN-YunxiNeural`（男声）、`zh-CN-YunyangNeural`（男声，新闻感）。

## 三个关键处理

**① 文稿清理**（`cleanScript`）
去掉所有排版符号：markdown 链接保留文字、图片整条删、`:::callout:::` 块删（朗读不出结构）、表格行删、加粗斜体标记删、ASCII 引号转中文「」。

**② 按句切块**（`splitScript`）
edge-tts 单次请求太长会被截断或超时。按句尾标点（。！？；）切，单句超长再按逗号切。

**③ 字节拼接**（`concatMp3`）
所有分块用同一套编码参数生成，MP3 是帧序列，同参数帧直接首尾相接就能连播。同时剥掉后续分块的 ID3 头（否则会在音频中间插入元数据）。

**不需要 ffmpeg。**

## 输出

```json
{
  "ok": true,
  "out": "/path/audio.mp3",
  "script": "/path/audio.script.txt",
  "chunks": 6, "bytes": 2956320,
  "est_duration_sec": 246,
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

`audio.script.txt` 是清理后的朗读稿——**务必人工核对一遍**：有时候会被清理掉不该删的内容，或者读出奇怪的断句。

## 已验证

- 224 字短稿 → 1 段 605KB MP3（96kbps / 24kHz / 单声道，`afinfo` 可识别）
- 1105 字长稿 → 分 6 段拼接 → 2.82MB
- **拼接后实际时长 246.36 秒 vs 估算 246 秒，误差 0.36 秒** —— 字节拼接方案成立
- `afplay` 可正常解码播放

## 首次配置

```bash
npm install    # 装 node-edge-tts（微软免费接口，无需 key）
```

**不需要 ffmpeg**（源实现需要，本原子已去掉）。

## 已知坑

1. **时长是估算值**：按 96kbps 算，与实际误差实测 <1%。但改了 `--format`/码率后估算会偏，此时以 `afinfo` 为准
2. **标题/列表符号会被读出来**：如「第一段」「头部效应加剧」会作为独立句子朗读。想避免就在文稿里别写小标题，或写更口语的过渡句
3. **网络依赖**：edge-tts 走微软接口，国内需要能访问。可用 `HTTPS_PROXY` 环境变量配代理
4. **任何一段失败整体失败**：不会产出半截音频（临时分块在 finally 里清理）
5. **表格块会被整段删掉**：朗读表格没有意义，内容请改写进正文
