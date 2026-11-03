---
name: wechat-browser-draft
description: 操作浏览器把 article.json 推进公众号草稿箱（不走 API，不受 IP 白名单限制）。支持新建、修补已有草稿、只读列草稿、清理重复草稿。登录态在持久化浏览器 profile 里。
---

# wechat-browser-draft —— 浏览器推公众号草稿

**给什么**：`article.json`（+ 可选头图 GIF）
**还什么**：草稿箱里的一篇草稿（**只存草稿，绝不点发表**）

原实现是 `project/mingchangmian/skill/08-推草稿箱/` 下的 `mp_draft.py` / `fix_draft.py` / `list_drafts.py` / `cleanup_dupes.py`。

## 用法

```bash
# 新建草稿
node atom/wechat-browser-draft/src/index.mjs --mode create \
  --article output/2026-10-09/01-我靠袁华/article.json \
  --head-image input/clips/024-我靠袁华.gif

# 修补已有草稿（原地替换，不会多出一篇）
node atom/wechat-browser-draft/src/index.mjs --mode fix \
  --keyword "我靠袁华" --article output/.../article.json --head-image ...

# 只读核对草稿箱
node atom/wechat-browser-draft/src/index.mjs --mode list

# 清理同名重复草稿（保留有封面的那篇）
node atom/wechat-browser-draft/src/index.mjs --mode cleanup --keep "我靠袁华"

# 检查 Playwright 是否可用
node atom/wechat-browser-draft/src/index.mjs --mode check
```

| 参数 | 说明 |
|---|---|
| `--mode` | `create` / `fix` / `list` / `cleanup` / `check` |
| `--article` | article.json 路径（create/fix 必填） |
| `--author` | 署名（默认 `AUTHOR_NAME` 或「名场面档案」） |
| `--head-image` | 正文开头插入的 GIF（建议 640 宽） |
| `--keyword` | fix 模式：草稿标题关键词 |
| `--keep` | cleanup 模式：要保留的标题关键词 |
| `--shot-dir` | 截图目录（默认 `~/.hermes/cache/scratch/mp`） |
| `--profile` | 浏览器 profile 目录（默认 `~/Library/Caches/mingchangmian-mp-profile`） |

## 输出

```json
{ "ok": true, "mode": "create", "stdout": "[1] ... [✓] 已保存..." }
```

## 依赖

- Python `playwright`（`pip install playwright`）
- 本机安装 Chrome（脚本用 `channel="chrome"`）
- 首次运行需扫码登录公众号；登录态存在 profile 目录

## 注意

1. **只存草稿，绝不点发表**。发布由人手动做。
2. `mp_draft.py` 保存后会留浏览器 60 秒供核对；脚本退出前别关窗口。
3. 「保存为草稿」可能被「内容结构检测」弹窗挡住，脚本会自动点「继续插入」。
4. 保存后必须看到「已保存」状态条才算成功；看不到就 `--mode list` 核对。
5. 同 AppID 多篇串行，不要并发。