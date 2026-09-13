"""构建进化器数据集：从 output/**/article.json 提取特征 + 打标签。

标签来自外部信号（微信 2026-07-16 判罚 → 07-19 改造），不是本项目自己的正则，
避免「用自己的规则训练自己的规则」的循环论证。

用法：python3 src/evolve/build_dataset.py
输出：src/evolve/dataset.json
"""
import json
import glob
import re
import random
import os

BOUND = "2026-07-19"  # 外部信号分界：07-19 起为「对照官方低创作度四类全过」的改造后批次
SEED = 20260914

BAN_WORDS = ["值得注意的是", "总而言之", "此外", "综上所述", "综上", "在当今社会",
             "在快节奏的", "不仅如此", "毋庸置疑", "众所周知", "由此可见", "应该说", "某种程度上"]
# 媒体/机构名——事实有出处的代理指标
SOURCE_HINT = re.compile(r"央视|新华社|人民日报|中新网|中新社|澎湃|第一财经|新京报|红星新闻|上游新闻|极目新闻|九派|封面新闻|北京日报|环球时报|财联社|证券时报|经济日报|工人日报|中国青年报")


def extract(path, art):
    """把一篇文章压成一组可计算的特征，供评估器纯 Python 快速打分。"""
    body = art.get("body_markdown", "") or ""
    title = art.get("title", "") or ""
    plain = re.sub(r"[#>*_\-`>!\[\]()|\s]", "", body)
    paras = [p for p in re.split(r"\n\n+", body) if p.strip()]
    plens = [len(p) for p in paras]
    return {
        "path": path,
        "title": title,
        "body_head": body[:600],
        # —— 标题特征 ——
        "title_len": len(title),
        "title_tail": title[-6:],
        "title_has_ascii_quote": '"' in title,
        # —— 结构特征（同质化的直接证据）——
        "six_sections": all(re.search(f"## {c}", body) for c in "一二三四五六"),
        "n_h2": len(re.findall(r"^## ", body, re.M)),
        "n_h3": len(re.findall(r"^### ", body, re.M)),
        "n_quote": len(re.findall(r"^> ", body, re.M)),
        "n_bold": len(re.findall(r"\*\*[^*]+\*\*", body)),
        # —— 内容特征 ——
        "doc_len": len(plain),
        "n_para": len(paras),
        "para_len_spread": (max(plens) - min(plens)) if len(plens) > 1 else 0,
        "n_number": len(re.findall(r"\d+", body)),
        "has_source": bool(SOURCE_HINT.search(body)),
        "n_banned": sum(1 for w in BAN_WORDS if w in body),
        "has_ascii_quote": '"' in body,
        # —— preflight 现规则会用的原始信号（供基线复现）——
        "pf_emo_tail": bool(re.search(r"(看(懵|久)了|愣了下|又笑了|笑了|慌了|乐了|有点小激动|看愣了)$", title)),
        "pf_ai_jinju": len(re.findall(r"的尽头[是是]", body))
        + len(re.findall(r"不是[^，。\n]{1,10}是[^，。\n]{1,10}", body))
        + len(re.findall(r"更(真|重|深)", body)),
    }


def main():
    rows = []
    for f in sorted(glob.glob("output/**/article.json", recursive=True)):
        parts = f.split(os.sep)
        if len(parts) < 3 or not re.match(r"\d{4}-\d{2}-\d{2}$", parts[1]):
            continue
        try:
            art = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        feat = extract(f, art)
        feat["date"] = parts[1]
        # label 1 = 判罚期（坏），0 = 改造后（好）
        feat["label"] = 1 if parts[1] < BOUND else 0
        rows.append(feat)

    # 按日期分层切 trainable / holdout，防止同一批次的稿子同时进两边造成泄漏
    random.seed(SEED)
    by_date = {}
    for r in rows:
        by_date.setdefault((r["date"], r["label"]), []).append(r)
    train, hold = [], []
    for key, group in sorted(by_date.items()):
        random.shuffle(group)
        cut = max(1, int(len(group) * 0.7))
        train += group[:cut]
        hold += group[cut:]

    json.dump({"trainable": train, "holdout": hold}, open("src/evolve/dataset.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    n1t = sum(r["label"] for r in train)
    n1h = sum(r["label"] for r in hold)
    print(f"总数 {len(rows)} 篇（坏 {sum(r['label'] for r in rows)} / 好 {sum(1 - r['label'] for r in rows)}）")
    print(f"trainable {len(train)}（坏 {n1t}）  holdout {len(hold)}（坏 {n1h}）")
    print(f"六段全套 {sum(r['six_sections'] for r in rows)} 篇")
    print("→ src/evolve/dataset.json")


if __name__ == "__main__":
    main()
