---
name: video-channel-draft
description: 把成片推进微信视频号草稿箱（浏览器自动化）。只存草稿、绝不发表；短标题硬上限 16 字，逗号等非法标点会静默失败，脚本提前拦截。
---

# video-channel-draft —— 发视频号草稿

**给什么**：成片 mp4 + 描述 + 短标题
**还什么**：视频号草稿箱里的一条草稿（**绝不点发表**）

原实现是 `project/mingchangmian/skill/B5-发视频号/vh_draft.py`。

## 用法

```bash
node atom/video-channel-draft/src/index.mjs \
  --video "名场面/成品/018-高三八班.mp4" \
  --desc "高三最后一课，全班起立喊老师好" \
  --short "高三八班 全体起立"
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--video` | 必填 | 成片路径 |
| `--desc` | 必填 | 视频描述 |
| `--short` | 空 | 短标题（≤16 字，只用平台白名单标点） |
| `--profile` | 持久化 profile | 浏览器登录态目录 |
| `--shot-dir` | `~/.hermes/cache/scratch/mp` | 截图目录 |

## 短标题规则（平台不报错，静默失败）

- **硬上限 16 字**
- 允许：`《》「」“”‘’：:+？%℃`
- 禁止：`，。、；！,.;!·—～~()（）【】[]{}<>/\|@#$^&*=`（逗号用空格代替）

脚本会在提交前检查，超限或非法标点直接中止。

## 输出

```json
{ "ok": true, "video": "/abs/成品.mp4", "short": "高三八班 全体起立", "stdout": "..." }
```

## 依赖

- Python `playwright`（`pip install playwright`）
- 本机 Chrome（脚本用 `channel="chrome"`）
- 首次运行需扫码登录视频号；登录态存在 profile 目录

## 注意

1. **只存草稿，绝不发表**。
2. 等视频 `readyState≥2` 才填表；保存后回读草稿箱核对，不静默成功。
3. 公众号和视频号共用同一个 profile，串行执行，不要并发。