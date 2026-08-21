# 公众号商业财经播客

单人主播，每期约 10 分钟，输出公众号草稿 + MP3 音频。

## 快速开始

```bash
cd /Users/zcy1/code_self/AI/project/audio
npm install
npm run init-assets

# 生成文章 JSON 后（由 Claude skill 写入 episodes/E001/article.json）
node src/publish.js --episode E001 --dry-run
node src/publish.js --episode E001
```

## 依赖说明

- **ffmpeg**：脚本长度超过 `TTS_MAX_CHUNK_CHARS` 时会拆成多段，合并多段需要本地 ffmpeg。
  - macOS：`brew install ffmpeg`
  - Linux：`sudo apt install ffmpeg`
  - 若未安装且脚本未超阈值，会生成单段音频，不影响使用。
- **WeChat 凭证**：复用 `wechat-img/.env`，无需在本项目重复配置。

- `skills/podcast-publish.md`：Claude 主流程 skill
- `src/publish.js`：编排发布流程
- `src/audio.js`：edge-tts 生成音频
- `src/preflight-podcast.js`：硬门检查
- `episodes/E001/`：每期产物
- `logs/`：发文日志

## 配置

复制 `.env.example` 为 `.env` 并填写。公众号凭证复用 `wechat-img/.env`。
