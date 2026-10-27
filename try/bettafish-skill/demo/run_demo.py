#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BettaFish-skill 本地试玩脚本
用 2026-10-27 真实 WebSearch 结果跑一遍：数据聚合 → 情感分析 → 知识图谱 → HTML 报告

数据来源：对 "iPhone 17 国内 用户评价 口碑 续航 相机 2026" 的 WebSearch 结果
（标题/链接为真实搜索结果；摘要来自检索页内容聚合）
"""

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / "scripts"))

from data_collector import collect_from_search_results          # noqa: E402
from sentiment_analyzer import (                                # noqa: E402
    SentimentAnalyzer,
    analyze_sentiment_distribution,
    extract_keywords,
)
from graph_generator import KnowledgeGraphBuilder               # noqa: E402
from template_manager import select_report_template             # noqa: E402

RUN_ID = time.strftime("%Y-%m-%d_%H%M") + "_iphone17"
OUT = BASE / "result" / RUN_ID
if OUT.exists():                      # 同一分钟重复运行，补秒级后缀
    RUN_ID = time.strftime("%Y-%m-%d_%H%M%S") + "_iphone17"
    OUT = BASE / "result" / RUN_ID
OUT.mkdir(parents=True, exist_ok=True)
(HERE / "latest_run.txt").write_text(str(OUT.relative_to(BASE)), encoding="utf-8")

# ---------------------------------------------------------------- 真实检索结果
SEARCH_RESULTS = [
    {"title": "都说iPhone17很香，我实打实使用一年：去掉滤镜，也就那样", "url": "https://m.toutiao.com/article/7681493628841148951/"},
    {"title": "普通用户用iPhone 17五个月：不吹不黑，真实优缺点全讲透", "url": "https://m.toutiao.com/article/7635678000557736457/"},
    {"title": "iPhone 17 标准版用满 30 天：最让我想退货的三个缺点", "url": "https://www.163.com/dy/article/L8H6ENKV05561BWY_pdya11y.html"},
    {"title": "iPhone17深度使用一个月！优点直接封神，老毛病依旧让人闹心", "url": "https://m.toutiao.com/article/7633960232690958848/"},
    {"title": "真心话：iPhone 17 还值得买吗？5999 元起，普通人别再盲目跟风！", "url": "https://www.sohu.com/a/1010194955_120176307"},
    {"title": "iPhone17用了一周 后悔没早点拿下", "url": "https://www.xiaohongshu.com/discovery/item/6a17d5b2000000003501f5ea"},
    {"title": "再见，iPhone17", "url": "https://www.163.com/dy/article/L67LU6H805561BWY_pdya11y.html"},
    {"title": "嘴上说不买销量破纪录这就是网上骂声一片的iPhone17！！", "url": "http://mp.weixin.qq.com/s?__biz=MzY5MDA1MjExNw==&mid=2247484206&idx=3&sn=f755929012660d5831a33a80c996f0c2"},
    {"title": "一些iPhone 17使用体验", "url": "https://www.xiaohongshu.com/discovery/item/6a1e820c00000000350325e8"},
    {"title": "手机金榜（京东）", "url": "https://pro.m.jd.com/mall/active/3ZbAE5pGUJmYNgfwdtDfspEfdLqR/index.html"},
]

# 检索页正文聚合出的高频观点（真实内容转述）
SNIPPETS = [
    "标准版首次标配120Hz ProMotion自适应高刷，刷信息流和切换App很丝滑，用过难回60Hz。",
    "3000尼特户外峰值亮度，阳光下导航扫码不用遮挡；177g、7.95mm，单手握持舒服。",
    "256GB起步缓解存储焦虑，A19加iOS 26日常流畅，游戏高画质满帧，重载长时间仍会发热。",
    "电池3692mAh，中度使用下班只剩20%到30%，重度刷视频玩游戏基本一天两充。",
    "夜间待机一晚掉电约10%，40W有线20分钟充到50%，充满约70分钟，比安卓百瓦快充慢。",
    "4800万主摄加4800万超广角，主摄支持2倍光变，前置2400万；标准版没有长焦。",
    "白天色彩自然细节清晰，微距能看清绒毛，人像抠图准；4K60杜比视界被称口袋电影机。",
    "没有长焦，拍远景和演唱会只能数码裁切，画质断崖式下跌；夜景噪点多、暗光易发虚。",
    "夜景蓝宝石镜片反光鬼影的老问题依旧存在，室内LED灯下白平衡偶尔偏冷偏绿。",
    "信号是跨代未解决的老毛病：地铁隧道、地下车库、商场角落常掉格，消息延迟。",
    "铝合金中框容易留划痕，裸机需谨慎；输入法自动切英文、截图闪、动画掉帧等小bug较多。",
    "适合iPhone 13及更早机型换机、看重iOS生态和长期流畅的人；重度游戏和摄影爱好者不建议。",
]

# ---------------------------------------------------------------- 1. 数据聚合
structured = collect_from_search_results(SEARCH_RESULTS)
collector_stats = {}
from data_collector import DataCollector  # noqa: E402
collector = DataCollector()
for row in structured:
    collector_stats.setdefault(row["platform"], 0)
    collector_stats[row["platform"]] += 1

# ---------------------------------------------------------------- 2. 情感分析
analyzer = SentimentAnalyzer()
sentiment_results = [analyzer.analyze(t).__dict__ for t in SNIPPETS]
distribution = analyze_sentiment_distribution(sentiment_results)
keywords = extract_keywords(SNIPPETS, top_k=12)

# ---------------------------------------------------------------- 3. 模板选择
template_name, template_path = select_report_template("分析 iPhone 17 国内品牌声誉与用户口碑")

# ---------------------------------------------------------------- 4. 知识图谱
builder = KnowledgeGraphBuilder("iPhone 17 国内口碑")
topic_id = builder.add_topic_node({"date": "2026-10-27", "platforms": len(collector_stats)})

engines = {
    "QueryAgent": builder.add_engine_node("QueryAgent", "新闻/论坛/电商评价搜索"),
    "MediaAgent": builder.add_engine_node("MediaAgent", "短视频/图文测评分析"),
    "InsightAgent": builder.add_engine_node("InsightAgent", "情感与议题聚类"),
}
sections = {
    "声量与平台": builder.add_section_node(engines["QueryAgent"], "声量与平台分布",
                                        "10条搜索结果覆盖头条/网易/搜狐/小红书/微信/京东", order=1),
    "产品力": builder.add_section_node(engines["QueryAgent"], "产品力评价",
                                     "高刷、亮度、轻薄、性能获得集中好评", order=2),
    "续航": builder.add_section_node(engines["InsightAgent"], "续航与充电",
                                   "最集中的差评点，重度用户一天两充", order=3),
    "影像": builder.add_section_node(engines["MediaAgent"], "影像能力",
                                   "日常与视频强，缺长焦、夜景弱、鬼影仍在", order=4),
    "信号": builder.add_section_node(engines["InsightAgent"], "信号与系统稳定性",
                                   "地铁/地库掉格、系统小bug为跨代老问题", order=5),
}
for name, sec in sections.items():
    q = builder.add_query_node(sec, f"iPhone 17 {name} 用户评价", "web_search")
    builder.add_source_node(q, SEARCH_RESULTS[0]["url"], "今日头条长测", "toutiao")
    builder.add_source_node(q, SEARCH_RESULTS[2]["url"], "网易30天体验", "netease")

for entity, kind in [
    ("iPhone 17 标准版", "product"), ("A19 芯片", "tech"), ("120Hz ProMotion", "tech"),
    ("3692mAh 电池", "tech"), ("4800万主摄", "tech"), ("iOS 26", "tech"),
    ("续航焦虑", "issue"), ("无长焦", "issue"), ("信号差", "issue"), ("系统小bug", "issue"),
]:
    builder.add_entity_node(entity, kind)

graph = builder.to_dict()
(OUT / "graph.json").write_text(builder.to_json(), encoding="utf-8")

# ---------------------------------------------------------------- 5. 汇总
summary = {
    "topic": "iPhone 17 国内口碑",
    "generated_at": "2026-10-27",
    "search_results": len(SEARCH_RESULTS),
    "platform_stats": collector_stats,
    "template": {"name": template_name, "path": str(Path(template_path).relative_to(BASE))},
    "sentiment": distribution,
    "keywords": keywords,
    "graph": graph["stats"],
    "note": "情感分数字段来自 scripts/sentiment_analyzer.py 的规则引擎；其 2-4 字贪婪分词会切碎词典词，负面句常被判中性，报告中的定性结论以人工/LLM 阅读原文为准。",
}
(OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps(summary, ensure_ascii=False, indent=2))
print(f"\n输出目录: {OUT}")
