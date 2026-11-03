# atoms —— 原子技能库

把原本散落在 `project/` 各项目里的能力拆成独立小技能，可任意组合成完整流程。
**本仓库不依赖任何外部项目**：对比基准固化在 `atom/*/fixtures/reference/`，测试素材在 `testdata/`，删掉 `project/` 也能独立运行。

## 目录

| 目录 | 作用 |
|---|---|
| `_shared/` | 原子共用基础设施（env、路径、run 留痕、schema、账号、参数模板）—— 不是原子 |
| `atom/` | 原子技能，一个输入 → 一个输出，**互不 import** |
| `recipe/` | 可运行的「项目」，只做编排：调谁、传什么、何时停 |
| `runs/` | 每次执行的留痕（不入库） |

## 快速开始

```bash
cp .env.example .env      # 填入凭据（.env 不入库）
npm install               # 装依赖（sharp / marked / node-edge-tts / playwright）
npm run setup             # 环境检查
npm run accounts          # 看已配置哪些公众号
npm run lint:paths        # 检查是否写了硬编码路径/密钥
npm test                  # 跑全部离线回归（不联网）
npm run test:all          # 额外跑与 project 源实现的一致性对比
```

首次跑需要浏览器的原子还要装 chromium：

```bash
npx playwright install chromium    # toutiao-publish 用
```

## 三条硬规则

1. **原子之间禁止互相 import** —— 组合只在 `recipe/` 层发生
2. **不写死路径** —— 自身资源用 `import.meta.url` 推导，业务路径由参数传入
3. **凭据只从环境变量读** —— 源码里零密钥，`.env` 永不入库

## 现状：31 个原子全部实现

| 层 | 原子 |
|---|---|
| A 情报 | `hotlist` `find-image` `fetch-facts` `fact-card` `kline` `market-fetch` `forecast-dashboard` `holdings-analysis` `fund-ocr` |
| B 创作 | `write-article` `real-story-pack` `title-hook` `format-html` `cover-image` `img-normalize` `tts-audio` `comic-draw` `result-page` `gif-clip` `video-cut` `publish-kit` |
| C 质量 | `selfcheck` `ai-flavor` `dedup-log` `copyright-check` |
| D 分发 | `wechat-draft` `wechat-newspic` `toutiao-publish` `fanqie-publish` `wechat-browser-draft` `video-channel-draft` |

详细清单与调用契约见 `atom/SKILL.md`，每个原子的说明见各自的 `SKILL.md`。

## 留痕

每次执行自动建 `runs/<recipe>/<YYYYMMDD-HHMMSS>/`，每个原子一个 `NN-<atom>/` 子目录，
内含 `input.json` + 产出。`manifest.json` 记录全链路状态。详见 `docs/runs-format.md`。

停手点（选热点、筛图）会写 `user-decision.json`；写入后必须用 `--resume` 续跑，
否则会新建目录、丢掉用户决定。

## 端到端验证

`recipe/wechat-hotspot` 已跑通完整 8 步链路：

```
01-hotlist ⏸选点 → 02-find-image ⏸筛图 → 03-fetch-facts → 04-write-article
→ 【Claude 写正文】→ 05-selfcheck → 06-format-html → 07-cover-image → 08-wechat-draft
```

### 与源项目的一致性

| 原子 | 验证方式 | 结果 |
|---|---|---|
| `selfcheck` | 670 篇历史稿逐篇对比旧 preflight | **100% 一致** |
| `format-html` | 6 个主题逐字节对比 `html.js` | **完全一致** |
| `cover-image` | 6 种布局逐字节对比 `cover.js` | **完全一致** |
| `dedup-log` | n=3/5/10/20 对比 `recent.js` | **逐字符一致** |

### 回归测试（26 项，全程不联网）

| 项 | 断言 | 覆盖重点 |
|---|---|---|
| `recipe/wechat-hotspot` | 18 | 参数模板 / 停手点顺序 / 续跑 / manifest 去重 |
| `selfcheck` | 15 + 670 | 每条规则「应拦/应放行」+ 历史稿对比 |
| `format-html` | 27 | 20 主题 + 15 类扩展语法 + 源对照 |
| `cover-image` | 13 | 22 布局 + 竖图补救 + 源对照 |
| `dedup-log` | 16 | 解析 / 扎堆 / 追加幂等 / 尾巴段保护 |
| `fanqie-publish` | 14 | 三步顺序 / **绝不调发布接口** |
| `wechat-newspic` | 12 | payload / 张数跟随目录 / 封面复用 |
| `wechat-draft` | 11 | token 缓存 / 42001 重试 / 缺图与撞脸双拦截 |
| `hotlist` | 5 | 五平台解析 + 跨榜重叠 |
| `recipe/forecast` | 12 | 抓数/渲染两步链 + 续跑 |
| `forecast-dashboard` | 13 | 两种版式 + JSON 侧车 |
| `holdings-analysis` | 25 | 文本/JSON 输入 + 板块映射 + 建议 |
| `fund-ocr` | 11 | 切片 / `--plan` / 可选真实 OCR |
| `real-story-pack` | 20 | 12 类锚点 / 红线 / 抽象表达 |
| `gif-clip` | 10 | 本地视频真实切片 |
| `video-cut` | 13 | 批量文件名解析 + 真实四段剪辑 |
| `copyright-check` | 14 | 三项硬指标 + 缺项 WARN |
| `publish-kit` | 18 | 内嵌首图 / 物料 / 短标题检查 |
| `wechat-browser-draft` | 14 | 参数校验 / Python 可编译 / Playwright |
| `video-channel-draft` | 10 | 短标题清洗与长度拦截 |
| `recipe/mingchangmian` | 11 | 6 步链 + 续跑 |
| `recipe/mingchangmian-video` | 9 | 8 步链 + 顺序 |

## 命令速查

```bash
# 跑一次热点发文（停在选点）
node recipe/wechat-hotspot/run.mjs --prompt "写一篇热点" --subject "主体" --event "事件"

# 续跑（停手点之后必须用 --resume）
node recipe/wechat-hotspot/run.mjs --resume <时间戳> --query "热点关键词" --title "标题"
```

## 文档

- 设计方案：`atom/README.md`
- 原子索引：`atom/SKILL.md`
- 配方说明：`recipe/README.md`
- 留痕格式：`docs/runs-format.md`
