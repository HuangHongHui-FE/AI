---
name: toutiao-publish
description: 把文章填进今日头条编辑器（半自动——标题+正文自动填入，封面和「发布」按钮由人工操作）。头条无草稿 API 且有 a_bogus 反爬验签，只能驱动真实浏览器。
---

# toutiao-publish —— 今日头条半自动发布

**给什么**：稿件 + 正文 HTML
**还什么**：编辑器已填好，浏览器保持打开等你点发布

**为什么是半自动**（三个硬约束凑一起）：

1. 头条**没有草稿 API**
2. 网页接口有 **a_bogus 反爬验签**，直接调接口不可行
3. 头条编辑器的自动保存**不由脚本触发**，只有真实交互（剪贴板粘贴）才会存

所以能做到的上限是：标题和正文自动填入，封面和「预览并发布」按钮留给人。

## 触发

「发头条」「推到头条」「头条发文」

## 用法

```bash
# 首次扫码登录（有头浏览器，检测到登录态自动保存）
node atom/toutiao-publish/src/index.mjs --login

# 填编辑器（浏览器保持打开 5 分钟供操作）
node atom/toutiao-publish/src/index.mjs \
  --article article.json \
  --html 05-format-html/content.html \
  --cover 06-cover-image/cover.jpg \
  --out-dir runs/<...>/08-toutiao

# 只做本地准备，不开浏览器
node atom/toutiao-publish/src/index.mjs --article a.json --html b.html --dry-run --out-dir x/

# 选择器失效时探 DOM
node atom/toutiao-publish/src/index.mjs --inspect --auth-dir .cache/toutiao
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--article` | 必填 | 稿件 json（含 title） |
| `--html` | 由 markdown 最小转换 | 正文 HTML（建议用 format-html 生成） |
| `--cover` | 无 | 封面路径（只提示，不上传） |
| `--auth-dir` | `.cache/toutiao` | 登录态目录（也可用 `TOUTIAO_AUTH_DIR`） |
| `--hold-sec` | 300 | 浏览器保持打开的秒数 |
| `--dry-run` | 关 | 只生成 paste.html，不开浏览器 |

## 登录检测逻辑

不是看单个信号——头条登录跨域跳转多（passport/sso），页面标题和 cookie 会瞬时变化。必须**三项同时满足**：

1. URL 离开登录页（不含 login/sso/passport/sign）
2. 页面标题不是 404
3. 有登录态 cookie（sessionid / sso_uid / passport_auth 等）且 cookie 数 ≥5

## 正文为什么走剪贴板

头条正文是 ProseMirror 富文本编辑器。直接设 `innerText` 不会触发框架的 paste handler，内容虽显示但**自动保存不会发生**。所以：

1. 授权剪贴板权限
2. 把 HTML 写成 `text/html` 塞进剪贴板
3. 按 `Meta+V` → ProseMirror 真实处理 → 触发自动保存

粘贴后还会回读 `.ProseMirror` 的文本长度**确认真贴进去了**（0 字就报错，不让它静默失败）。

## 人工要做的两件事

浏览器打开后：

1. 封面区点「单图」→ 上传生成的 cover.jpg（头条 file input 是隐藏的，脚本无法可靠上传）
2. 点底部「预览并发布」

## 首次配置

```bash
npm install
npx playwright install chromium    # 浏览器二进制不在 npm i 里
node atom/toutiao-publish/src/index.mjs --login
```

## 已知坑

1. **AI 助手抽屉遮挡**：头条编辑页会弹出带遮罩（`.byte-drawer-mask`）的 AI 助手，挡住编辑区点击。脚本会自动关它
2. **选择器会变**：头条改版后 `textarea[placeholder*="文章标题"]` / `.ProseMirror` 可能失效。先跑 `--inspect` 看真实 DOM 再改 `src/lib/editor.mjs` 的 `SELECTORS`
3. **`Meta+V` 只在 macOS 有效**——换平台要改成 `Control+V`
4. **登录态会过期**：报「未找到登录态」或填充失败时重跑 `--login`
5. **浏览器不会自己关**：`--hold-sec` 到了才关，中途手动关窗口脚本会正常退出

## 已验证

- dry-run 模式：正确生成 paste.html、正确报出标题与 HTML 字节数
- 无登录态：正确报错并提示先 `--login`
- 缺参数：正确 exit 2
- `hasAuth`：空 cookies 文件判为未登录，有 cookie 判为已登录
