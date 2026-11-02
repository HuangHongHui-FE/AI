---
name: atom 原子技能总索引
description: 17 个原子技能的清单与调用契约。每个原子只做一件事，输入 → 输出，可被任意 recipe 组合。原子之间禁止互相 import，组合只发生在 recipe 层。
---

# atom 原子技能总索引

> 每个原子只做一件事，输入 → 输出，可被任意 recipe 组合。
> 原子之间**禁止互相 import**，组合只发生在 `recipe/` 层。

## 调用约定（所有原子统一）

```bash
node atom/<name>/src/index.mjs --out <路径> [业务参数]
```

| 约定 | 说明 |
|---|---|
| stdout | 只输出 JSON 结果 |
| stderr | 人读信息 |
| 退出码 | `0` 成功 / `1` 业务失败 / `2` 参数或环境错误 |
| 凭据 | 只读 `process.env`，不读自身目录下的 `.env` |
| 路径 | 业务产物路径由 `--out` 决定，原子内不出现业务目录字面量 |

每个原子的详细说明见各自的 `SKILL.md`。

## 原子清单（17 个，全部已实现）

### A 情报层

| 原子 | 输入 | 输出 | 状态 |
|---|---|---|---|
| `hotlist` | 平台列表 | `hotlist.json` | ✅ 五平台热榜 + 跨榜重叠 · 🧪 |
| `find-image` | 主体词+事件词+张数 | `images/manifest.json` + 图片 | ✅ 四渠道 · 内容级去重 |
| `fetch-facts` | 热点关键词 | 带来源的事实条目 + 事件簇 | ✅ 头条搜索 |
| `fact-card` | 事实条目 | 校验通过的 `facts.json` | ✅ 硬拦无来源/模糊日期 |
| `kline` | 股票代码 | 日/周/月 K 线 + 走势图 | ✅ 东财主源腾讯兜底 |

### B 创作层

| 原子 | 输入 | 输出 | 状态 |
|---|---|---|---|
| `write-article` | 事实 + 避撞清单 | 写作 prompt + 成稿校验 | ✅ 8 维池 157 项 · 抽骨架不抽标签 |
| `title-hook` | 热点原词 | 合规标题 | ✅ 贴原词 + 压缩/补全 |
| `format-html` | markdown + theme | 微信 HTML | ✅ 20 主题 · 与源逐字节一致 · 🧪 |
| `cover-image` | 图片 + 布局 | 2.35:1 封面 | ✅ 22 布局 · 竖图补救 · 🧪 |
| `img-normalize` | 任意图片 | 标准 JPEG / 指定比例 | ✅ 防假 jpg + 模糊填充 |
| `tts-audio` | 文稿 | mp3 | ✅ 无 ffmpeg 依赖 |

### C 质量层

| 原子 | 输入 | 输出 | 状态 |
|---|---|---|---|
| `selfcheck` | 稿件 + 规则集 | FAIL/WARN | ✅ 5 规则集 · 668 篇回归 100% 一致 · 🧪 |
| `dedup-log` | 维度 + 近 N 篇 | 避撞结果 + 日志追加 | ✅ 两代格式兼容 · 🧪 |

### D 分发层

| 原子 | 输入 | 输出 | 状态 |
|---|---|---|---|
| `wechat-draft` | HTML + 封面 + `--account` | media_id | ✅ 多号隔离 · 🧪 |
| `wechat-newspic` | 图片列表 + 文案 | media_id | ✅ 贴图 newspic · 🧪 |
| `toutiao-publish` | 标题+正文+图 | 编辑器已填 | ✅ 半自动（人工点发布） |
| `fanqie-publish` | 章节 md | 草稿 | ✅ 只存草稿不发布 · 🧪 |

🧪 = 有离线回归测试（`fixtures/regression.mjs`）

## 回归测试

```bash
npm run test          # 跑所有原子回归（不联网）
npm run test:all      # 额外跑与 project 源实现的一致性对比
```

| 原子 | 断言数 | 覆盖重点 |
|---|---|---|
| `selfcheck` | 668 篇 | 与旧 preflight 判定 100% 一致 |
| `format-html` | 27 | 20 主题渲染 + 15 类扩展语法 + 6 主题与源逐字节一致 |
| `cover-image` | 13 | 22 布局 + 竖图分支 + 6 布局与源逐字节一致 |
| `wechat-draft` | 11 | token 缓存 / 42001 重试 / 缺图拦截 / 撞脸拦截 |
| `wechat-newspic` | 12 | payload 结构 / 张数跟随目录 / 封面复用 |
| `fanqie-publish` | 14 | 三步顺序 / **绝不调发布接口** / HTML 转义 |
| `dedup-log` | 16 | 解析 / 扎堆 / 追加幂等 / 尾巴段保护 |
| `hotlist` | 5 | 五平台解析 + 重叠检测 |

## 多公众号

凭据按别名配置在 `.env`：

```bash
WECHAT_WECHATIMG_APPID=...
WECHAT_WECHATIMG_SECRET=...
WECHAT_MINGCHANGMIAN_APPID=...
WECHAT_MINGCHANGMIAN_SECRET=...
WECHAT_DYCHATIMG_APPID=...
WECHAT_DYCHATIMG_SECRET=...
```

调用时指定：`--account wechatimg`。查看已配置账号：`npm run accounts`。

token 按别名分文件缓存，互不覆盖。**同 appid 的多篇推送必须串行**，并发会让 token 互踩。

## 脚本

| 脚本 | 用途 |
|---|---|
| `npm run lint:paths` | 拦截硬编码路径 / 内嵌密钥 / 跨原子 import |
| `npm run test` | 跑全部离线回归 |
| `npm run test:all` | 额外跑与源项目的一致性对比 |
| `npm run gc` | 清理过期 runs |
| `npm run accounts` | 列出 / 校验公众号账号 |
| `npm run setup` | 首次配置检查 |

## 设计原则（踩过坑的部分）

1. **抽骨架不抽标签** — `write-article` 抽的是结构（「以某人的一个动作收尾」）而不是抽象概念（「情感白描式」）。标签不同模型仍会用最顺手的句式实现
2. **规则跟原子走** — `selfcheck` 的 5 套平台阈值在 `references/rulesets.mjs`，引擎里零平台分支
3. **契约优先于实现** — 5 个 JSON 契约（hotlist/images/facts/article/dims）定义了组合，实现可换
4. **原子不互相 import** — 需要相同能力就各写一份最小实现（`wechat-draft` 与 `wechat-newspic` 的 API 层就是这样）
