---
name: ai-flavor
description: 文章 AI 味检测与改写指令，专门用于过朱雀等 AIGC 检测。先本地打分（过渡词、抽象名词、万能句式、句长、信息密度、模糊限定、分号、分点叙事、结尾套话等 13 条规则），给出 0-100 分、逐条证据和可直接执行的改法；改完再跑一遍直到降到 low。支持回填朱雀实测结果校准规则权重。
---

# ai-flavor —— AI 味检测 + 改写指令

**给什么**：文章正文（`article.json` 或纯文本）
**还什么**：AI 味得分（0-100）+ 分级 + 每条命中的证据和 `advice`（具体改法）

> 这是**本地预检**，不调朱雀。最终判定以朱雀实测为准；实测结果可回填，用来校准规则权重。

## 为什么要它

生成完的文章贴到朱雀前，先跑一遍：知道哪几句最像 AI、具体怎么改，改完再验一次。比「贴上去被判定 AI 生成，再凭感觉重写」省一轮。

与 `selfcheck` 的分工：

| | 管什么 |
|---|---|
| `selfcheck` | 平台**红线**（第一人称、禁飞句式、情绪尾、字数）——硬拦，不过不能发 |
| `ai-flavor` | **像不像人写**（软指标）——给分数、证据和改法，阈值可调 |

## 用法

```bash
# 预检（默认输出分数、证据、前 3 条改法）
node atom/ai-flavor/src/index.mjs --article article.json
node atom/ai-flavor/src/index.mjs --text "正文内容"

# 落盘
node atom/ai-flavor/src/index.mjs --article a.json --out-dir 04-ai-flavor
```

输出：

```json
{
  "ok": true, "score": 36, "level": "high",
  "hits": [
    {
      "id": "template-sentence", "label": "万能句式", "strength": 1, "weight": 1.5,
      "advice": "「不是X而是Y」「真正的X是Y」「说到底」这类对仗句只留一处，其余改平常话",
      "hits": ["不是简单的竞争，而是深层的博弈"]
    }
  ],
  "stats": { "chars": 106, "sentences": 5 }
}
```

退出码恒为 `0`——这是体检不是硬门，拦不拦由调用方按 `level` 决定。

## 改写闭环

1. 跑预检，拿 `hits[]`（已按「强度×权重」排序，最该改的在前）
2. **先读 `references/zhuque-rules.md`**（17 份朱雀实测提炼），再按每条 `advice` 改对应句子，直接输出**完整改写正文**（不是建议列表、不是 diff）；**不改事实、数字、引号原话**
3. 再跑一遍：`high` / `medium` 继续改，降到 `low` 再贴朱雀 → 返回改后正文
4. 贴完朱雀，用 `--feedback` 记结果，攒够样本跑 `--calibrate`

实测例子：一段 170 字、满是「底层逻辑/赋能/闭环/第一第二第三」的 AI 稿，预检 53 分 high；按 advice 改写成 310 字的具体场景后，复检 0 分 low。改写由执行 skill 的 Claude 完成，原子只负责「看出问题 + 验证改没改好」。

## 朱雀实测样本库

改稿前必读：

- `references/zhuque-rules.md` —— 能过的写法、会判 AI 的写法、改写动作优先级
- `references/zhuque-samples.md` —— 17 份朱雀报告原文、AIGC 值与关键对照

来源是同一批赛事稿的多种改写，AIGC 值 0.0007–0.9937。核心结论：**朱雀抓的是叙述结构，不是词汇**——口语化、第一人称、场景描写单独用都过不了；把稿子写平成「时间 + 事件 + 数据 + 引语」才有效。

## 13 条规则

| id | 查什么 | 改法 |
|---|---|---|
| `connector` | 首先/其次/因此/从而/进而… 过渡词过密，或连续两句都带连接词 | 删掉大半，靠语序和事实衔接 |
| `abstract` | 底层逻辑/赋能/闭环/抓手/维度… 抽象名词堆叠 | 换成具体动作和对象 |
| `empty-emotion` | 令人震惊/引人深思/发人深省… 空泛情绪 | 换成具体画面或当事人原话 |
| `template-sentence` | 不是X而是Y / 真正的X是Y / 说到底… 万能句式 | 只留一处，其余改平常话 |
| `uniform-length` | 句长变异系数 <0.5（人写通常起伏明显） | 每 150 字至少一个 6 字内短句 |
| `short-lead` | >40% 的段落以 ≤8 字短句开场 | 直接进事实、场景或人物动作 |
| `low-info` | 每千字数字/引号原话/英文专名 <6 处 | 每段补一个能核实的细节 |
| `parallel` | 连续三句同开头（排比三连） | 拆掉两句，换主语或长度 |
| `no-scene` | 全文无数字、无引号原话、无英文专名 | 开篇落到具体时间、地点、人物动作 |
| `hedge` | 较为/一定程度上/某种程度上/往往… 模糊限定词过多 | 直接下判断；不确定就写出条件 |
| `punct` | 分号 ≥3（中文稿的「——」不算，避免误伤） | 分号改句号 |
| `enumeration` | 第一/第二/三个方面/编号列表… 分点叙事 | 改成连贯叙述，或换具体事实 |
| `safe-ending` | 结尾「综上所述/总而言之/未来可期/拭目以待」 | 落在具体画面或具体判断上 |

分级（按 683 篇历史稿实测分布定：真实稿最高 28 分，AI 原文约 35+）：`<25 low` / `25-34 medium` / `≥35 high`。

## 不断优化：反馈 + 校准

每贴一次朱雀，把结果记下来：

```bash
# 朱雀判定为 AI（概率 0.87）
node atom/ai-flavor/src/index.mjs --feedback --article a.json --label ai --zhuque 0.87

# 朱雀判定为人工
node atom/ai-flavor/src/index.mjs --feedback --article b.json --label human --zhuque 0.12
```

反馈累积到 `atom/ai-flavor/data/feedback.jsonl`（本地，不入库）。两类各攒 ≥5 条后：

```bash
node atom/ai-flavor/src/index.mjs --calibrate
```

输出每条规则在「AI 样本 vs 人写样本」上的均值差（区分度）和建议权重：

```
规则            AI均值  人写均值  区分度  现权重 → 建议
具体信息密度低   0.72    0.15    0.57    1.5 → 2.5
抽象名词堆叠     0.31    0.28    0.03    1.2 → 1.3
...
当前阈值（≥25 判 AI）与本批实测的一致率：86.7%
```

区分度为负的规则说明它在反向指认（AI 文章里反而少），应下调。按建议值改 `src/lib/rules.mjs` 里的 `weight` 和 `LEVEL_MEDIUM` / `LEVEL_HIGH` 即可。

## 参考

本规则集参考了这些公开方案（朱雀没有开放 API，只能走「检测→改写→再检测」闭环）：

- [hylarucoder/ai-flavor-remover](https://github.com/hylarucoder/ai-flavor-remover) —— 中文 prompt，实测 70%→17%
- [harshaneel/humanize](https://github.com/harshaneel/humanize) —— perplexity / burstiness 两条主线 + 标点规则
- [qingshanliuci/cnki-aigc---skill](https://github.com/qingshanliuci/cnki-aigc---skill) —— 中文检测器的 5 个语言特征
- [free-revalution/AIGC-Detector-Pro](https://github.com/free-revalution/AIGC-Detector-Pro) —— 五维打分框架

## 已知边界

1. **不是检测器**，是启发式规则——真实判定以朱雀为准
2. 初始权重是拍的，**没有经过朱雀标签校准**，前几篇的区分度可能一般
3. 阈值基于 683 篇历史稿 + 合成 AI 样本，样本偏「已通过平台的稿子」，不代表全体
4. 短文本（<300 字）密度类规则会被放大，读分数时结合 `stats.chars` 看
5. 规则只能指出「像 AI 的地方」，改完好不好还要人读一遍