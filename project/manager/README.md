# Skill 管理后台

纯前端 React 管理页面，管理 `~/code_self/AI/project` 下各项目的 skill。

## 启动

```bash
cd manager
npm install
npm run dev
```

**必须用 Chrome 或 Edge 打开**（File System Access API 仅 Chromium 支持，Safari/Firefox 不行）。

## 首次使用

1. 页面顶部点「选择根目录」，授权选中 `~/code_self/AI/project`（即本仓库根）。
2. 首次执行 skill 时弹窗填 Claude API key（存 localStorage，仅本机）。

## 功能

- **Skills**：按项目分组浏览所有 skill 文档（`.md` / `SKILL.md`），支持在线查看。
- **执行**：选 skill + 填参数 → 浏览器直连 Anthropic API 流式产出内容草稿。
- **历史**：扫各项目 `results/ output/ logs/ cache/`，按日期倒序预览产物（html/md/json/图片）。
- **配置**：编辑各项目 `package.json` 的 scripts 与 config 文件。

## 重要约束

> 「执行 = AI 生成内容草稿，落盘/推草稿仍走 CLI」。

浏览器里 Claude 只能输出文本（标题/正文/CTA/分析结论），无法真正执行 skill 涉及的本地文件操作（下载图、生成 JSON 落盘、跑 node 脚本推草稿）。需要落地的步骤仍由你现有 CLI 完成，本页面只做内容生成与预览。

刷新页面后已授权的目录 handle 会失效，需重新点「选择根目录」重新授权（File System Access API 限制）。

## 安全

- API key 存 localStorage，仅本机，不经任何服务端（本就无后端）。
- 直连 Anthropic API 带 `anthropic-dangerous-direct-browser-access` 头。
