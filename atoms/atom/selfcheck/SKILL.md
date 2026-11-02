---
name: selfcheck
description: 推草稿前硬门检查。一个引擎 + 多套平台规则，输出 FAIL/WARN 清单，任一 FAIL 则 exit 1 拒绝推送。覆盖第一人称禁用、整句模板、结尾禁飞骨架、句长节奏、事实情绪占比等 20+ 条规则。
---

# selfcheck —— 稿件硬门

**给什么**：`article.json`（title/digest/body_markdown）+ 规则集名
**还什么**：FAIL 清单（阻断）+ WARN 清单（提示）

原实现 5 套分叉（`preflight.js` 273/159/114/107/109 行，每个平台一套阈值）。此原子 = **一个引擎 + 多套规则表**，引擎里不出现任何平台分支。

## 触发

「检查稿件」「过一遍硬门」「自查」

## 用法

```bash
node atom/selfcheck/src/index.mjs --article article.json --ruleset wechat-img --out-dir 05-selfcheck
node atom/selfcheck/src/index.mjs --article a.json --ruleset podcast --quiet
node atom/selfcheck/src/index.mjs --list
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--article` | 必填 | 稿件 JSON |
| `--ruleset` | `wechat-img` | 规则集名 |
| `--out-dir` | 不写 | 落 `result.json` |
| `--quiet` | 关 | 不打印人读报告 |

输出：
```json
{
  "ok": false,
  "ruleset": "wechat-img",
  "fails": [{ "id": "first_person.count", "message": "..." }],
  "warns": [],
  "stats": { "title_chars": 18, "body_chars": 923, "paragraphs": 7 }
}
```

退出码：`0` 通过 / `1` 有 FAIL（业务失败）/ `2` 参数错误。

## 规则集（5 套）

| 规则集 | 标题上限 | 摘要上限 | 特点 |
|---|---|---|---|
| `wechat-img` | 22 | 54 | 最严，656 篇历史稿进化得出 |
| `toutiao` | 30 | 100 | 不卡第一人称/AI金句/节奏 |
| `mingchangmian` | 24 | 60 | 故事型，放宽句长与骨架 |
| `company` | 26 | 80 | 求职向长文 |
| `podcast` | — | — | 口播稿，第一人称正当 |

## 主要规则

**标题**：情绪尾「我X了」（正则由 darwinian_evolver 在 656 篇上进化）、字数上限、标题党词（`曝光` 放行——「央视曝光」是正当蹭度动词）

**摘要**：字数、禁换行、禁外链

**正文硬拦**：
- ASCII 双引号 → 必须用「」
- 正文超链接（微信屏蔽）
- 存疑词：据传/疑似/据说/有消息称…
- **第一人称完全禁用**（2026-09-14 用户决定）：「我」字 >1 处即 FAIL。替代 = 群体观察 / 客观数据 / 历史类比。图片 alt 里的「我」不算（那是引用他人原话）
- 整句模板：`我有个朋友讲过`、`这不就是X吗`、`搁谁身上都`…
- 段首引导词滥用：同类≥3 段起段（单次是正常口语，不禁）
- 万能句式：开头「≤8字短句。+展开」、结尾「不是X是Y」「说到底」「真正X的是Y」
- 事实段 < 情绪段（04 要求事实占比 ≥ 情绪）

**节奏**：句长标准差 < 10 = 节奏单调

**WARN**：加粗过多、AI 金句堆砌、说教式结尾、段落全等长、短句占比低

## 回归（关键）

```bash
node atom/selfcheck/fixtures/regression.mjs \
  --src-root <历史稿根目录> --old-preflight <旧 preflight.js 路径> [--limit 60] [--verbose]
```

逐篇跑新引擎与旧 preflight，对比 FAIL 判定。

**实测结果：668 篇历史稿，一致率 100.0%**（新更严 0 / 新更松 0）。

## 设计要点

- **规则表跟原子走**，放 `references/common.mjs` + `references/rulesets.mjs`，引擎不写死阈值
- **整句模板 vs 词级强调要分开**：硬拦整句复用（低创作度铁证），词级强调（「实打实的」）只 WARN——否则等于否定正常中文
- **只作用于首段/末句**：骨架检测若作用于整篇会误杀中段正常用法（首版实踩，特异度掉到 66.8%）

## 已知坑

1. **阈值改动必须重跑 668 篇回归**——这套规则是从历史稿进化来的，手改一行可能让召回率从 95% 掉回去
2. 历史好稿有 ~47% 会被最严档拦下，这是用户明确接受的代价（差异化 > 返工率）
3. 规则集 JSON 里把某项设 `false` 即关闭该检查（如 `first_person: false`）
