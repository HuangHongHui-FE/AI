# 已停用（2026-10-10）

> 这里的东西**原样保留**，只是不再由 Claude 执行 —— 不删代码，怕以后想恢复时重新踩一遍坑。

## 为什么停用

原来流程的终点是 Claude 直接发布：`06-推草稿`（微信 API）、`B3-浏览器发草稿`（公众号网页）、`B4-发视频号`（视频号网页）。**2026-10-10 用户决定改成自己手动发**（公众号 / 视频号 / 抖音 / 快手），Claude 只负责把东西准备到「打开就能复制粘贴」。

## 停用了什么

| 原步骤 | 换成 | 停用的代码 |
|---|---|---|
| `06-推草稿`（微信 API 推草稿）| [`../06-出物料/`](../06-出物料/README.md) —— 同样的 `wechat-img` 脚本，改跑 `--dry-run`，出物料不推送 | 无独立脚本（推送逻辑在 wechat-img 项目里）|
| `B3-浏览器发草稿`（Playwright 操作公众号网页）| `06-出物料` 生成的 `copy.html`，人手动粘贴 | `mp_draft.py`、`fix_draft.py` |
| `B4-发视频号`（Playwright 发视频号草稿）| [`../B4-出视频物料/`](../B4-出视频物料/README.md) —— 只产出文案 | `publish.py` |

## 要恢复自动化时

三个目录里各自的 README **原封不动**，坑都还在（IP 白名单、token 缓存不区分 appid、Wujie 微前端 frame 选择器……），照着跑就行。

共同前提：

- **B3 / B4 共用同一个浏览器 profile**：`~/Library/Caches/mingchangmian-mp-profile`，过期就删掉重新扫码
- **06 用微信 API，需要 IP 白名单**，且必须在 `../wechat-img` 目录下跑（preflight 按 cwd 解析）
- 抖音 / 快手**从来没做过自动化**（平台没有面向个人的开放接口），后台地址见 `名场面/账号运营.md`

> 留个提醒：`wechat-img/src/wechat.js` 的 token 缓存是**固定文件名**，换 appid 跑会复用上一个号的 token、把稿子推进错的草稿箱。换号前先删 `../wechat-img/cache/token.json`。这条一直没修（改动在 wechat-img 项目）。
