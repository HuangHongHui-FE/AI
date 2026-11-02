# atom —— 原子技能库设计方案 v2

> 状态：设计稿（2026-10-29）
> 约束：**不改动 `/Users/zcy1/code_self/AI/project/` 下任何代码**，现有项目保持原样可运行，atom 另起炉灶。
> 目标：原子可任意组合成完整项目 → 项目只调原子目录 → git 拉下来即可用 → 每步产出可留痕可追溯。

---

## 一、为什么值得做（现状证据）

不是拍脑袋。现有代码已经用行动证明了该复用，而且**已经在分叉**。

### 1.1 完全重复的（4 份 md5 一模一样）

| 文件 | 出现位置 | 行数 |
|---|---|---|
| `wechat.js` | wechat-img / event-thread / company / manga | 116 |
| `config.js` | wechat-img / event-thread / company / manga | 65 |
| `cover.js` | wechat-img / event-thread | 229 |

700 多行纯复制粘贴，改一处就得改 4 处，现实里必然只改了一处。

### 1.2 已经分叉的

| 文件 | 版本 | 说明 |
|---|---|---|
| `find_img.cjs` | 489 / 504 / 105 行 | 三套实现，已互不同步 |
| `preflight.js` | 273 / 159 / 114 / 107 / 109 行 | 5 个平台 5 套阈值 |
| `html.js` | 490 / 493 / 610 / 607 行 | theme 池与排版各写各的 |
| `recent.js` | 90 / 147 / 146 行 | 日志解析三套 |

**结论**：能力早就在了，只是没被抽出来；最大风险不是拆不开，而是拆完变成 17 份新拷贝。

---

## 二、整体架构：四层

```
atom/          原子能力。一个输入 → 一个输出。只做一件事。
_shared/       原子共用的基础设施（不是 atom）：env 加载、路径解析、图片 sniff、日志。
recipe/        配方。可运行的「项目」，只做编排：按顺序调 atom，记录留痕。
runs/          运行留痕。每次执行一个时间戳目录，每步产出单独子目录。
```

关键约束，必须先立住：

| 约束 | 含义 |
|---|---|
| **atom 之间不互相调用** | 组合只发生在 recipe 层。atom 之间只有数据依赖，没有代码依赖 |
| **atom 无状态** | 不读 `.env`、不写日志到自身目录、不假设 cwd |
| **recipe 不含业务代码** | 只做「调谁、传什么、何时停」，不写实现 |
| **产物不进 git** | `runs/` 整个忽略，只保留 manifest 模板 |

---

## 三、拆分判定标准

一个能力**同时满足**三条才配做 atom：

1. **有明确输入输出**——一句话写清「给什么、还什么」；
2. **至少被 2 条流程复用**（或明确预见会复用）——只服务一条流程的是「步骤」不是「原子」；
3. **能独立验收**——能单独跑、单独比对、单独判好坏。

**不要拆**：

| 不拆的东西 | 原因 |
|---|---|
| access_token 获取 | 推草稿的内部细节，拆出来只多一次调用和一次失败点 |
| 日志/事实卡 schema | 是数据契约，放 `_shared/schema/`，不是能力 |
| 一次性脚本（`convert_articles_20260703.js` 这类 100+ 个带日期文件） | 历史现场，不是能力 |
| `config.js` 凭据装配 | 基础设施，放 `_shared/` |
| 逻辑不足 50 行且无独立价值的辅助 | 调度成本大于收益 |

---

## 四、原子清单

### 4.1 内容分发线（17 个）

#### A 情报层 —— 把外部世界变成结构化输入

| # | atom | 输入 | 输出 | 来源 |
|---|---|---|---|---|
| 1 | `hotlist` | 平台列表 | 热榜条目 JSON | wechat-img/01-hotlist、tt-redian-text/fetch-hot.js |
| 2 | `find-image` | 主体词+事件词+目标张数 | 图片文件 + manifest | find_img.cjs（合三套分叉）、fetch_cand.cjs、search_hot_imgs.py |
| 3 | `fetch-facts` | 热点标题/URL | 带来源的事实条目 | wechat-img/03、event-thread/02 |
| 4 | `fact-card` | 事实条目 | 校验通过的 `facts.json` | event-thread/src/facts.js |
| 5 | `kline` | 股票/公司代码 | 日K序列（东财主源、腾讯兜底） | company/src/kline.cjs、kline_tx.cjs |

#### B 创作层

| # | atom | 输入 | 输出 | 来源 |
|---|---|---|---|---|
| 6 | `write-article` | 事实 + 维度选择 | 正文 markdown | wechat-img/04、wechat/02、toutiao-daily |
| 7 | `title-hook` | 正文 + 角度 | 标题 + 开头钩子 + 收口 | wechat-img 标题池、wechat/01、wechat/03 |
| 8 | `format-html` | markdown + theme | 微信 HTML | html.js（4 套合一） |
| 9 | `cover-image` | 图片 + 布局 | 2.35:1 封面图 | cover.js |
| 10 | `img-normalize` | 任意图片 | 标准 JPEG / 指定比例 | fix_tietu_ratio.py + sharp 逻辑 |
| 11 | `tts-audio` | 播客文稿 | mp3 + 时长 | audio/src/audio.js（edge-tts） |

#### C 质量层

| # | atom | 输入 | 输出 | 来源 |
|---|---|---|---|---|
| 12 | `selfcheck` | 稿件 + 平台规则 | FAIL/WARN 清单 | 5 套 preflight 合并为引擎 + 规则表，连同 `evolve/` 一起迁 |
| 13 | `dedup-log` | 本篇维度 + 近 N 篇 | 避撞结果 + 日志追加 | logdims.js + recent.js（三套合一） |

#### D 分发层

| # | atom | 输入 | 输出 | 来源 |
|---|---|---|---|---|
| 14 | `wechat-draft` | HTML + 封面 + 元信息 | media_id | wechat.js + index.js 推送段（token 内部处理） |
| 15 | `wechat-newspic` | 图片列表 + 文案 | media_id | dy-chat-img/post_draft.js |
| 16 | `toutiao-publish` | 标题+正文+图 | 编辑器已填（人工点发布） | tt-redian-text/publish.js |
| 17 | `fanqie-publish` | 章节 md | 草稿/章节 | novel/src/publish.js |

### 4.2 投资线（4 个，第二批）

`market-data`、`market-analyze`、`forecast-archive`、`gold-quote`

### 4.3 工具线（2 个，外部引入，暂不动）

`book-to-skill`、`meme-video`

---

## 五、atom 目录规范

```text
atom/<name>/
├── SKILL.md            # 触发词、输入输出契约、何时不该调用、已知坑
├── package.json        # 依赖自己声明，不自带 node_modules
├── src/
│   ├── index.mjs       # CLI 入口：只做参数解析 + 调用 lib
│   └── lib/            # 实现
├── references/         # 规则表、轮换池、阈值、正则（可被 recipe 覆盖）
└── fixtures/           # 回归样例：一组输入 + 期望输出
```

### 5.1 统一调用契约（能被组合的前提）

```bash
node <atom>/src/index.mjs --out <输出目录或文件> [业务参数]
```

- 退出码：`0` 成功 / `1` 业务失败（如 preflight FAIL）/ `2` 参数或环境错误
- stdout 只输出 JSON 结果；人读信息一律走 stderr（上层永远能拿到结构化结果）
- 所有业务产物路径由 `--out` / `--out-dir` 决定，**atom 不自行决定去哪**

### 5.2 共享数据契约（跨 atom 的中间产物）

| 契约 | 产生者 | 消费者 |
|---|---|---|
| `hotlist.json` | hotlist | 用户选点 |
| `images/manifest.json` | find-image | cover-image / wechat-draft |
| `facts.json` | fetch-facts / fact-card | write-article |
| `article.json` | write-article | selfcheck / wechat-draft |
| `dims.json` | dedup-log | write-article / format-html |

这 5 个契约定义了「组合」，比代码本身更重要——契约稳定，atom 就能自由替换实现。

---

## 六、零硬编码路径（你的硬要求）

### 6.1 规则

| 类别 | 规则 |
|---|---|
| **自身资源** | 用 `import.meta.url` 推导自身根目录，读自己的 `references/`、`fixtures/`。这是相对自身，跨机器安全 |
| **业务数据** | 一律 CLI 参数传入，atom 内禁止出现 `output/`、`input/`、`cache/` 等字面量 |
| **跨 atom** | **禁止**。atom 不 import 其他 atom，组合只在 recipe 层 |
| **cwd** | 禁止依赖。所有相对路径先 `resolve()` 再使用 |
| **凭据** | 只读 `process.env`，不读自身目录下的 `.env` |
| **用户目录** | 禁止 `/Users/xxx`、`C:/Users/xxx` |

### 6.2 现有代码里已经踩的坑（迁移时必须修）

| 位置 | 问题 |
|---|---|
| `wechat-img/src/evolve/preflight_evolver.py:11` | 写死 `/Users/zcy1/code_self/AI/project/...` |
| `dy-chat-img/post_draft.js:6` | access_token 硬编码在源码里 |
| `wechat-img/src/config.js:33-36` | `paths.input/output/cache` 绑死项目根，未参数化 |
| `wechat-img/src/index.js` | 默认产物落 `output/`，无 `--run-dir` 概念 |

### 6.3 防回潮

加一个 `atom/scripts/lint-paths.mjs`，扫描所有 atom 源码，命中下面模式直接报错：

- 字面量 `'/Users/'`、`'C:/'`、`'output/'`、`'input/'`
- `import` 其他 atom 的相对路径
- 源码里出现 `sk-`、`ACCESS_TOKEN = '` 之类的密钥特征

CI 或提交前跑一次即可。

---

## 七、可移植性：git 拉下来就能用

### 7.1 必须做对的四件事

| # | 事项 | 做法 |
|---|---|---|
| 1 | **依赖统一** | 根 `package.json` 用 npm workspaces 统管；sharp 统一到一个版本（现在有 0.32/0.33/0.35 三个并存，必须收敛） |
| 2 | **锁文件入库** | `package-lock.json` 必须提交，保证多机装出同一棵树 |
| 3 | **Node 版本固定** | 根 `.nvmrc` + `engines.node`，当前本机 v24.20.0 |
| 4 | **二进制依赖显式声明** | playwright 的 chromium、ffmpeg、edge-tts 这些不是 `npm i` 就全好，写进 `SKILL.md` 的「首次配置」并给一条 `npm run setup` |

### 7.2 凭据：现在有一个必须先修的问题

实测发现 **3 个 `.env` 已经被 git 跟踪**：

```
project/company/.env
project/manga/.env
project/tt-redian-text/.env
```

加上 `dy-chat-img/post_draft.js` 里硬编码的 access_token，这些一旦推到远端就是永久泄露（即使后来删除，历史里还在）。

**atom 的做法**：

```
atoms/
├── .env.example     # 入库，只写键名
├── .env             # 忽略，本机私藏
└── atom/            # 只读 process.env
```

- atom 启动时校验必需变量，缺了直接 exit 2 并说明缺哪个

### 7.3 多公众号：你说发哪个就发哪个

**不做多份 .env**，而是一个 `.env` 里按别名并存，靠 `--account` 选择：

```bash
# .env
WECHAT_WECHATIMG_APPID=wx0000000000000001
WECHAT_WECHATIMG_SECRET=...
WECHAT_MINGCHANGMIAN_APPID=wx0000000000000002
WECHAT_MINGCHANGMIAN_SECRET=...
WECHAT_DYCHATIMG_APPID=wx0000000000000003
WECHAT_DYCHATIMG_SECRET=...
```

调用方式：

```bash
# 发到 wechat-img 号
node atom/wechat-draft/src/index.mjs --account wechatimg --article article.json

# 发到名场面档案
node atom/wechat-draft/src/index.mjs --account mingchangmian --article article.json
```

或者在某条 recipe 里固定死用的号：

```json
{ "overrides": { "wechat-draft": { "account": "wechatimg" } } }
```

三个配套设计（`_shared/accounts.mjs` 已实现）：

| 设计 | 原因 |
|---|---|
| **token 按别名分文件缓存**（`token-wechatimg.json`） | 不同号的 token 互不覆盖，避免「发 A 号踩掉 B 号」 |
| **未传 `--account` 时回落通用 `WECHAT_APPID`** | 兼容现状，不强制改名 |
| **报错时列出所有已配置别名** | 写错别名能立刻看到可选值，不用翻文档 |

同 appid 的多篇推送仍需**串行**，禁止并发（token 互踩风险不变）。

### 7.4 跨机器会水土不服的地方

| 风险 | 说明 | 对策 |
|---|---|---|
| `ocr.swift`（dy-chat-img） | 只能在 macOS 跑 | 用 tesseract.js（forecast 已在用）替代 |
| `fix_tietu_ratio.py` / `search_hot_imgs.py` | Python 依赖 Python 环境 | 迁移时用 Node 重写，或显式声明 Python 版本 + requirements |
| `uv run python` 调用 | 需装 uv | evolver 改写成直接 `python3 xxx.py` |
| shot 相关 | 中文路径、emoji 文件名在 Windows 上易炸 | 产物目录只用 ASCII |
| 网络代理 | 国内源/Bing/Sogou 在不同网络下成功率差异大 | atom 里做多源 fallback，manifest 记录每个源的成功数 |

---

## 八、运行留痕（你的第二个硬要求）

### 8.1 目录结构

每次执行建一个时间戳目录，**每个 atom 一个子目录**，走一步看一眼产出：

```text
runs/
└── wechat-hotspot/                    # 按 recipe 分
    └── 20261029-201500/               # 年月日-时分秒
        ├── manifest.json              # 全链路状态（核心）
        ├── 00-input/
        │   ├── request.json           # 用户原始指令、触发方式
        │   └── chosen-topic.json      # 用户选定的热点
        ├── 01-hotlist/
        │   ├── input.json
        │   ├── hotlist.json           # 输出
        │   └── stderr.log
        ├── 02-find-image/
        │   ├── input.json
        │   ├── manifest.json          # 每张图的来源渠道、相关性
        │   ├── images/001.jpg~020.jpg
        │   └── user-screened/         # 用户筛图后剩下的
        ├── 03-fetch-facts/
        ├── 04-write-article/
        ├── 05-selfcheck/
        ├── 06-format-html/
        ├── 07-cover-image/
        └── 08-wechat-draft/
            └── result.json            # media_id 等
```

规则：

- 目录名前缀 `NN-` 就是执行顺序，一眼看出走到哪一步
- 每步目录里同时放 `input.json` 和产出，**输入输出同框**，方便复盘「为什么产出是这样」
- 中途失败时，失败那步目录里必有 `error.json`（错误码、消息、堆栈），后面的步骤不创建
- 用户停手点（选热点、筛图）额外落 `user-decision.json`（选了什么、什么时候、删了哪几张）

### 8.2 manifest.json

```json
{
  "run_id": "wechat-hotspot/20261029-201500",
  "recipe": "wechat-hotspot",
  "version": "0.1.0",
  "started_at": "2026-10-29T20:15:00+08:00",
  "finished_at": "2026-10-29T20:41:12+08:00",
  "status": "success",
  "trigger": {
    "by": "claude",
    "user_prompt": "写一篇热点文章",
    "cwd": "/Users/zcy1/code_self/AI"
  },
  "env": { "node": "v24.20.0", "platform": "darwin-arm64", "git_rev": "1caeadb" },
  "steps": [
    {
      "seq": 1,
      "atom": "hotlist",
      "version": "0.1.0",
      "started_at": "2026-10-29T20:15:02+08:00",
      "finished_at": "2026-10-29T20:15:09+08:00",
      "exit_code": 0,
      "args": { "platforms": ["baidu", "weibo", "zhihu"] },
      "outputs": ["hotlist.json"],
      "stopped_for_user": false
    },
    {
      "seq": 2,
      "atom": "find-image",
      "exit_code": 0,
      "args": { "subject": "徽剑", "event": "反诈博主遇害", "target": 20 },
      "outputs": ["images/001.jpg", "..."],
      "stopped_for_user": true,
      "user_decision": { "at": "2026-10-29T20:22:10+08:00", "kept": 8, "removed": 12 }
    }
  ]
}
```

### 8.3 「留痕」对 Claude 的要求

你说的「每次让你生成东西都能留痕」，落到执行上是：

1. **开工前**建 `runs/<recipe>/<时间戳>/`，先写 `00-input/request.json` 存原始指令；
2. **每调一个 atom 前**写这一步的 `input.json`，调用后写 `manifest` 条目；
3. **不覆盖**——同一分钟内重启任务就加 `-b` 后缀，历史永远保留；
4. **收尾**更新 manifest 的 `status` 与 `finished_at`；
5. 用户在会话里问「上次那篇怎么做的」，直接看 runs 目录就能复盘。

### 8.4 git 策略

- `runs/` 整体进 `.gitignore`（图片多、体积大）
- 但 `runs/.gitkeep` 与 `docs/runs-format.md`（manifest schema 说明）入库
- 需要长期保存的某次运行，手动 `cp` 到 `archive/` 再提交，由用户决定

---

## 九、recipe：能直接跑的项目

```text
recipe/wechat-hotspot/
├── SKILL.md           # 触发词、停手点、人读流程说明
├── recipe.json        # 机器可读：步骤链、参数、端口
├── run.mjs            # 编排器：建 run 目录、逐步调 atom、写 manifest
└── config.json        # 本配方的覆盖项（theme 池子、selfcheck 规则集、用哪个公众号）
```

`recipe.json` 示例：

```json
{
  "name": "wechat-hotspot",
  "atoms": [
    { "id": "hotlist", "stopForUser": true },
    { "id": "find-image", "stopForUser": true },
    { "id": "fetch-facts" },
    { "id": "write-article" },
    { "id": "selfcheck" },
    { "id": "format-html" },
    { "id": "cover-image" },
    { "id": "wechat-draft" }
  ],
  "overrides": {
    "selfcheck": { "ruleset": "wechat-img" },
    "wechat-draft": { "appIdEnv": "WECHAT_APP_ID_WECHATIMG" }
  }
}
```

**atom 路径怎么找**（这是「不写死文件夹」的核心）：

1. 优先 `$ATOM_HOME` 环境变量；
2. 否则从 `run.mjs` 自身位置向上找 `atom/` 目录；
3. 都找不到就报错，提示设置 `ATOM_HOME`。

**新增一个组合项目 = 新写一份 `recipe.json`**，不写代码。这是这套设计的全部价值。

---

## 十、迁移策略（全程不改 project/）

### 阶段 0：影子建立（只读 project）

- 从 project 复制代码到 atom，去重 + 接口改造
- 每个 atom 建 fixtures，用 project 里的历史真实输入跑，**对比输出是否等价**
- 不等价的逐条记录（很多不等价其实是 bug，比如三套 find_img 分叉）

### 阶段 1：并行运行

- 新任务走 `recipe/`，旧流程原样保留可回退
- 每个 atom 连续跑通若干次后标记「已验证」

### 阶段 2：收口

- 旧项目转只读历史，不再二次开发
- 需要新能力只改 atom，所有 recipe 自动受益

**不在第一阶段做 `export * from atom/...` 引用改造**——那会立刻改动 project 代码，违背你的约束。

---

## 十一、实施顺序（按风险从低到高）

| 顺序 | atom | 理由 | 验收标准 |
|---|---|---|---|
| 0 | **骨架** | 先把 `_shared` + run 目录 + manifest + lint 搭好 | 一个空 recipe 能建出合规的 run 目录 |
| 1 | `wechat-draft` | 4 份代码完全相同，零风险、收益最大 | 同 article.json 推草稿，media_id 正常 |
| 2 | `selfcheck` | 纯逻辑、无网络、最好测 | 656 篇历史稿回归，判定与旧 preflight 逐条一致 |
| 3 | `format-html` + `cover-image` | 一份代码服务 5 个项目 | 同输入产出 HTML 像素级一致 |
| 4 | `find-image` | 要合三套分叉，需实测对比 | 同关键词下满 20 张，相关性抽查 |
| 5 | `write-article` + `title-hook` | 最需迭代，最能体现分层价值 | 产出能过 selfcheck，维度不撞近 5 篇 |
| 6 | recipe 串起来 | 前 5 步稳了才有意义 | 完整跑通一次热点发文 |

投资线（4 个）单独一批，内容线跑顺了再启动。

---

## 十二、风险与反模式

| 风险 | 表现 | 对策 |
|---|---|---|
| **二次分叉** | recipe 觉得 atom 不顺手，就地复制一份改 | 禁止 fork。不合适就提参数改造 atom |
| **接口漂移** | atom 改输出字段，recipe 静默跑错 | fixtures 回归必须过；字段变更走契约版本号 |
| **凭据内嵌** | 现在 post_draft.js 硬编码 token、3 个 .env 已入库 | atom 只读 env；先做一次历史清理 |
| **路径耦合** | atom 偷偷写死 `./output` | lint 脚本硬拦 |
| **过度拆分** | 拆出「拼标题字符串」这种 20 行原子 | 用第三节三条标准卡 |
| **只拆代码不拆规则** | 阈值、轮换池留在各项目 | 规则表跟 atom 走，放 `references/` |
| **runs 爆炸** | 每次跑几十张图，磁盘很快满 | 提供的 `atom/scripts/gc.mjs`，按天/按大小清理，默认保留 N 天 |

---

## 十三、需要你拍板

1. **仓库形态**：atom 是放 `AI/atom/`（与 project 并列，同一个 git 仓库），还是独立仓库 + submodule？
   - 同一个仓库：简单，但 project 和 atom 的提交历史混在一起
   - 独立仓库：干净，多机拉取更明确，但要多一次 clone
2. **runs 保留策略**：全留 / 保留 30 天 / 只留 manifest 不留图片？
3. **公众号多号**：现在有 wechat-img、mingchangmian、dy-chat-img 等多个号，凭据用「一个 .env 多个 appid」还是「每个号一个 env 文件」？
4. **先做哪个**：我建议先搭**骨架（第 0 步）**——`_shared` + run 目录 + manifest + lint。这一步没有任何业务逻辑，风险为零，但它是后面所有 atom 的地基，必须最先定下来。
