"""用 darwinian_evolver 进化 preflight 的低创作度判定规则。

Organism  = 一份判定规则 spec（正则 + 阈值 + 权重）
Evaluator = 在 656 篇历史稿上算 balanced accuracy（纯 Python，不走 LLM，所以评估极快）
Mutator   = Claude 看误判样本，提出改进的 spec

标签来自外部信号（微信 07-16 判罚 → 07-19 改造），非本项目自造正则，避免循环论证。

跑法：
    cd ~/.hermes/cache/darwinian-evolver/darwinian_evolver
    uv run python /Users/zcy1/code_self/AI/project/wechat-img/src/evolve/preflight_evolver.py \
        --num_iterations 3 --num_parents_per_iteration 2 --output_dir /tmp/pf_evolve
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from darwinian_evolver.cli_common import parse_learning_log_view_type
from darwinian_evolver.evolve_problem_loop import EvolveProblemLoop
from darwinian_evolver.learning_log import LearningLogEntry
from darwinian_evolver.problem import (
    EvaluationFailureCase,
    EvaluationResult,
    Evaluator,
    Mutator,
    Organism,
    Problem,
)

PROJECT = Path(__file__).resolve().parent.parent.parent
DATASET = json.loads((PROJECT / "src/evolve/dataset.json").read_text(encoding="utf-8"))
EVOLVER_MODEL = (
    os.environ.get("EVOLVER_MODEL")
    or os.environ.get("ANTHROPIC_DEFAULT_SONNET_MODEL")  # 内网网关要它认的模型名
    or "claude-sonnet-4-6"
)


# 从项目 .env 或环境变量拿凭据，兼容内网网关（ANTHROPIC_AUTH_TOKEN + BASE_URL）
def _client() -> "anthropic.Anthropic":
    """构造 anthropic 客户端：优先用网关 auth_token，退回官方 API key。"""
    import anthropic

    base = os.environ.get("ANTHROPIC_BASE_URL")
    tok = os.environ.get("ANTHROPIC_AUTH_TOKEN")
    if tok:  # 内网网关：走 auth_token + base_url
        return anthropic.Anthropic(auth_token=tok, base_url=base) if base else anthropic.Anthropic(auth_token=tok)
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:  # 退回项目 .env（可能是真 key，也可能是占位符）
        env = PROJECT / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                m = re.match(r"\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$", line)
                if m:
                    key = m.group(1).strip().strip('"').strip("'")
    if not key:
        sys.exit("没有可用凭据：ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY 均未找到")
    return anthropic.Anthropic(api_key=key, base_url=base) if base else anthropic.Anthropic(api_key=key)


def _llm(prompt: str, max_tokens: int = 2000) -> str:
    """发一次 LLM 请求，只取 text block。

    网关的 DeepSeek 默认开思考模式且会吃光全部 token 预算（实测 8000 token
    全烧在 thinking 上、正文返回空），故显式关掉 thinking。
    """
    r = _client().messages.create(
        model=EVOLVER_MODEL, max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        thinking={"type": "disabled"},
    )
    return "".join(b.text for b in r.content if getattr(b, "type", "") == "text")


# 当前 preflight.js 的规则，翻译成 spec 作为进化种子 —— 基线可比
SEED_SPEC = {
    "tail_regex": r"(看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了)$",
    "tail_extra": [],
    "six_min_quote": 3,
    "six_min_bold": 6,
    "min_doc_len": 800,
    "max_doc_len": 1200,
    "w_tail": 1.0,
    "w_six": 1.0,
    "w_short": 1.0,
    "w_banned": 1.0,
    "w_ascii": 1.0,
    "w_ai_jinju": 1.0,
    "threshold": 0.5,
}


def rule_hit(feat: dict, spec: dict) -> tuple[float, list[str]]:
    """按 spec 给一篇文章算风险分，返回（风险分, 命中的信号名列表）。"""
    risk = 0.0
    hits = []
    title = feat.get("title", "")

    def add(weight_key: str, name: str, cond: bool):
        """命中则累加该信号权重，并记录信号名。"""
        nonlocal risk
        if cond:
            w = float(spec.get(weight_key, 0.0) or 0.0)
            if w:
                risk += w
                hits.append(name)

    # 标题情绪尾：主正则 + 若干附加正则（任一命中即算）
    tail = bool(spec.get("tail_regex")) and re.search(spec["tail_regex"], title) is not None
    if not tail:
        for r in spec.get("tail_extra", []) or []:
            try:
                if r and re.search(r, title):
                    tail = True
                    break
            except re.error:
                continue
    add("w_tail", "tail", tail)

    # 六段全套：结构同质化的直接证据（阈值可进化，现规则 3/6 是死的）
    six = (
        feat["six_sections"]
        and feat["n_quote"] >= int(spec.get("six_min_quote", 3))
        and feat["n_bold"] >= int(spec.get("six_min_bold", 6))
    )
    add("w_six", "six", six)

    add("w_short", "short", feat["doc_len"] < int(spec.get("min_doc_len", 800)))
    add("w_long", "long", feat["doc_len"] > int(spec.get("max_doc_len", 1200)))
    add("w_banned", "banned", feat["n_banned"] > 0)
    add("w_ascii", "ascii", feat["has_ascii_quote"])
    add("w_ai_jinju", "ai_jinju", feat["pf_ai_jinju"] >= 3)
    return risk, hits


def score_spec(rows: list[dict], spec: dict) -> tuple[float, list[dict], list[dict]]:
    """算 balanced accuracy（召回+特异度）/2，返回（分数, 漏判, 误判）。"""
    thr = float(spec.get("threshold", 0.5))
    tp = fn = tn = fp = 0
    missed, false_pos = [], []
    for r in rows:
        risk, hits = rule_hit(r, spec)
        flagged = risk >= thr
        if r["label"] == 1:
            if flagged:
                tp += 1
            else:
                fn += 1
                missed.append({**r, "risk": risk, "hits": hits})
        else:
            if flagged:
                fp += 1
                false_pos.append({**r, "risk": risk, "hits": hits})
            else:
                tn += 1
    recall = tp / (tp + fn) if tp + fn else 0.0
    spec_score = tn / (tn + fp) if tn + fp else 0.0
    return (recall + spec_score) / 2, missed, false_pos


class RuleOrganism(Organism):
    """被进化的对象：一份判定规则 spec（JSON 字符串）。"""

    spec_json: str

    def spec(self) -> dict:
        """解析并返回 spec 字典，解析失败返回空 dict。"""
        try:
            return json.loads(self.spec_json)
        except Exception:
            return {}


class PfFailureCase(EvaluationFailureCase):
    """一个误判样本，带足够上下文让 Claude 诊断。"""

    kind: str  # missed（漏判坏稿）/ false_pos（误杀好稿）
    title: str
    detail: str


class PfEvaluator(Evaluator[RuleOrganism, EvaluationResult, PfFailureCase]):
    """在历史语料上给 spec 打分，误判样本喂给变异器。"""

    def evaluate(self, organism: RuleOrganism) -> EvaluationResult:
        """对 trainable 打分并把误判转成 failure case。"""
        spec = organism.spec()
        if not spec:
            return EvaluationResult(score=0.0, trainable_failure_cases=[], holdout_failure_cases=[], is_viable=True)
        train_score, missed, fps = score_spec(DATASET["trainable"], spec)
        hold_score, _, _ = score_spec(DATASET["holdout"], spec)

        cases: list[PfFailureCase] = []
        for r in missed[:6]:
            cases.append(PfFailureCase(
                kind="missed", title=r["title"],
                detail=f"正文{r['doc_len']}字 六段={r['six_sections']} 引言{r['n_quote']} 加粗{r['n_bold']} "
                       f"命中信号={r['hits']} 风险分{r['risk']:.2f}（低于阈值才漏判）",
                data_point_id=r["path"]))
        for r in fps[:6]:
            cases.append(PfFailureCase(
                kind="false_pos", title=r["title"],
                detail=f"正文{r['doc_len']}字 六段={r['six_sections']} 引言{r['n_quote']} 加粗{r['n_bold']} "
                       f"命中信号={r['hits']} 风险分{r['risk']:.2f}（好稿被误杀）",
                data_point_id=r["path"]))

        # 用两者均值做适应度，但 holdout 的失败样本不进变异器视野（防过拟合）
        return EvaluationResult(
            score=(train_score + hold_score) / 2,
            trainable_failure_cases=cases,
            holdout_failure_cases=[],
            is_viable=True,
        )


MUTATOR_PROMPT = """你在优化一个中文公众号文章的「低创作度」自动判定规则。

背景：2026-07-16 一批文章被微信判为低创作度（同质化/低价值AIGC）。判定规则要能**拦住那批坏稿**，同时**不误杀改造后的好稿**。当前规则只抓到 70% 坏稿，漏掉的都是标题「第一人称情绪反应收尾」但用词不在白名单里的。

当前规则 spec（JSON）：
```json
{spec}
```

当前得分（balanced accuracy，0-1，越高越好）：{score:.3f}

误判样本：
{cases}

诊断问题并给出改进后的 spec。要求：
1. `tail_regex` 要能**泛化**：现规则只认少数几个词（看懵了/愣了下/笑了），漏掉了「愣住了/想了想/眼眶热了/扎心了/热血了/磨半天/暖到了/服了/半天」这类同构表达。请写一条能覆盖这类「逗号后第一人称心理或表情反应 + 了/着/半天」的正则。
2. `tail_extra` 可放补充正则（数组）。
3. `six_min_quote`/`six_min_bold` 是「六段全套」的触发阈值，现值 3/6 太高导致该检测从不触发（实测 402 篇坏稿全是六段全套，但引言数普遍只有 1）——请重新标定。
4. 各项 `w_*` 权重和 `threshold` 一起调，使规则能区分好坏稿。
5. 只输出 spec 的 JSON，放在你回复的最后一个 ``` 代码块里，不要解释。

字段必须是这些：tail_regex, tail_extra, six_min_quote, six_min_bold, min_doc_len, max_doc_len,
w_tail, w_six, w_short, w_long, w_banned, w_ascii, w_ai_jinju, threshold"""


class PfMutator(Mutator[RuleOrganism, PfFailureCase]):
    """让 Claude 看着误判样本改 spec。"""

    def mutate(self, organism: RuleOrganism, failure_cases: list[PfFailureCase],
               learning_log_entries: list[LearningLogEntry]) -> list[RuleOrganism]:
        """调用 Claude 生成一版新 spec；解析失败返回空列表（循环会跳过）。"""
        if not failure_cases:
            return []
        spec = organism.spec()
        train_score, _, _ = score_spec(DATASET["trainable"], spec)
        lines = []
        for c in failure_cases:
            tag = "【漏判·坏稿没拦住】" if c.kind == "missed" else "【误杀·好稿被拦】"
            lines.append(f"{tag} {c.title}\n    {c.detail}")

        try:
            text = _llm(MUTATOR_PROMPT.format(
                spec=json.dumps(spec, ensure_ascii=False, indent=1),
                score=train_score, cases="\n".join(lines)))
        except Exception as e:
            print(f"  [mutator LLM 失败] {type(e).__name__}: {str(e)[:120]}")
            return []

        blocks = text.split("```")
        if len(blocks) < 3:
            return []
        raw = blocks[-2].strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
        # 校验能解析且字段合法，否则丢弃这次变异
        try:
            new_spec = json.loads(raw)
            if not isinstance(new_spec, dict) or "tail_regex" not in new_spec:
                return []
        except Exception:
            return []
        return [RuleOrganism(spec_json=json.dumps(new_spec, ensure_ascii=False))]


def make_problem() -> Problem:
    """组装 Problem：种子 = 当前 preflight 规则。"""
    return Problem[RuleOrganism, EvaluationResult, PfFailureCase](
        evaluator=PfEvaluator(),
        mutators=[PfMutator()],
        initial_organism=RuleOrganism(spec_json=json.dumps(SEED_SPEC, ensure_ascii=False)),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--num_iterations", type=int, default=3)
    ap.add_argument("--num_parents_per_iteration", type=int, default=2)
    ap.add_argument("--mutator_concurrency", type=int, default=2)
    ap.add_argument("--evaluator_concurrency", type=int, default=2)
    ap.add_argument("--output_dir", type=str, required=True)
    args = ap.parse_args()

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "snapshots").mkdir(exist_ok=True)

    # 先报基线：当前 preflight 规则在 trainable/holdout 上的分
    tr_base, missed0, fps0 = score_spec(DATASET["trainable"], SEED_SPEC)
    ho_base, _, _ = score_spec(DATASET["holdout"], SEED_SPEC)
    print(f"基线（现 preflight 规则）：trainable {tr_base:.3f} / holdout {ho_base:.3f}"
          f"（漏判坏稿 {len(missed0)}、误杀好稿 {len(fps0)}）")
    print(f"模型 {EVOLVER_MODEL} · 迭代 {args.num_iterations} · 每轮父代 {args.num_parents_per_iteration}")

    loop = EvolveProblemLoop(
        problem=make_problem(),
        learning_log_view_type=parse_learning_log_view_type("ancestors"),
        num_parents_per_iteration=args.num_parents_per_iteration,
        mutator_concurrency=args.mutator_concurrency,
        evaluator_concurrency=args.evaluator_concurrency,
    )

    best = None
    for snap in loop.run(num_iterations=args.num_iterations):
        (out / "snapshots" / f"iteration_{snap.iteration}.pkl").write_bytes(snap.snapshot)
        org, result = snap.best_organism_result  # 顺序是 (Organism, EvaluationResult)
        best = org
        print(f"iter={snap.iteration} pop={snap.population_size} best_score={result.score:.3f}")

    if best is not None:
        spec = json.loads(best.spec_json)
        (out / "best_spec.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
        tr, missed, fps = score_spec(DATASET["trainable"], spec)
        ho, _, _ = score_spec(DATASET["holdout"], spec)
        print(f"\n最优 spec：trainable {tr:.3f} / holdout {ho:.3f}（基线 trainable {tr_base:.3f} / holdout {ho_base:.3f}）")
        print(json.dumps(spec, ensure_ascii=False, indent=1))
        print(f"\n结果目录：{out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
