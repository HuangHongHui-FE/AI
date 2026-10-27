#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BettaFish-skill · 姆巴佩涉华言论事件舆情分析
数据截止：2026-10-27（北京时间）
数据来源：WebSearch 真实检索结果，详见 demo/mbappe/output/report.html 附录
"""

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent.parent
sys.path.insert(0, str(BASE / "scripts"))

from data_collector import DataCollector, collect_from_search_results   # noqa: E402
from sentiment_analyzer import (                                       # noqa: E402
    SentimentAnalyzer, analyze_sentiment_distribution, extract_keywords,
)
from graph_generator import KnowledgeGraphBuilder                      # noqa: E402
from template_manager import select_report_template                    # noqa: E402

RUN_ID = time.strftime("%Y-%m-%d_%H%M") + "_mbappe"
OUT = BASE / "result" / RUN_ID
if OUT.exists():                      # 同一分钟重复运行，补秒级后缀
    RUN_ID = time.strftime("%Y-%m-%d_%H%M%S") + "_mbappe"
    OUT = BASE / "result" / RUN_ID
OUT.mkdir(parents=True, exist_ok=True)
(HERE / "latest_run.txt").write_text(str(OUT.relative_to(BASE)), encoding="utf-8")

# ---------------------------------------------------------------- 真实检索结果
SEARCH_RESULTS = [
    {"title": "姆巴佩发表涉华错误言论，中国足协：第一时间与皇家马德里俱乐部进行严正交涉", "url": "https://finance.sina.com.cn/wm/2026-10-27/doc-iniwsseu0222086.shtml"},
    {"title": "姆巴佩致歉！声明用法、中、英三文发布", "url": "https://www.toutiao.com/article/7701335416577753600/"},
    {"title": "姆巴佩致歉：言论欠妥，绝非本意，我向所有被我的言论所伤害的人道歉", "url": "https://www.sohu.com/a/1093507975_255783"},
    {"title": "姆巴佩遭数家中国公司解约品牌代言 外交部回应", "url": "http://news.yunnan.cn/system/2026/10/27/034182705.shtml"},
    {"title": "央视总台要求皇马和姆巴佩公开道歉，并向总台递交书面道歉信", "url": "https://www.tsrb.com.cn/xwzx/2026-10/27/content_300026126.html"},
    {"title": "吃中国饭砸中国锅？球迷抵制姆巴佩，他的沉默比失言更说明问题", "url": "https://news.ycwb.com/ikimvjktil/content_54331570.htm"},
    {"title": "央视回应姆巴佩道歉：听其言观其行", "url": "https://finance.sina.com.cn/wm/2026-10-27/doc-iniwsseu0236203.shtml"},
    {"title": "在民族情感面前，姆巴佩的“大牌”没有价值", "url": "https://www.gxnews.com.cn/staticpages/20261027/newgx6ae08f4a-22008816.shtml"},
    {"title": "快快评｜姆巴佩“翻车”绝非偶然", "url": "https://m.163.com/dy/article/LA987CA8053469KC.html"},
    {"title": "极目锐评｜姆巴佩道歉不等于翻篇，皇马更不能继续“装死”", "url": "https://www.ctdsb.net/c1715_202610/2889727.html"},
    {"title": "姆巴佩不只是“翻车”！两年多4起涉华争议，皇马为什么一错再错？", "url": "https://www.shobserver.com/staticsg/wap/newsDetail?id=1201973"},
    {"title": "反歧视火力全开，辱华就沉默！皇马的“双标”大家该看清了", "url": "https://view.inews.qq.com/a/20261027A08E0E00"},
    {"title": "热搜爆了！姆巴佩涉华言论惹众怒，蒙牛等多品牌解约", "url": "https://m.163.com/dy/article/LA90F7IL0534A4SC.html"},
    {"title": "东鹏饮料、蒙牛：终止与姆巴佩合作！多品牌删除、下架", "url": "https://www.sohu.com/a/1093299339_115092"},
    {"title": "妙可蓝多终止与姆巴佩全部合作，坚决抵制零容忍", "url": "https://www.sohu.com/a/1093294291_121019331"},
    {"title": "姆巴佩多社媒账号被禁言、禁止关注，央视叫停涉姆巴佩赛事", "url": "https://gzstv.cn/a/330cb9333921428b973c0229ab12adb7"},
    {"title": "蒙牛、东鹏等多家品牌火速终止合作，是否主张违约金引关注", "url": "http://stock.10jqka.com.cn/20261027/c681126657.shtml"},
    {"title": "姆巴佩道歉！西甲官方、中国足协发声", "url": "https://m.thepaper.cn/newsDetail_forward_34344710"},
    {"title": "姆巴佩道歉，西甲联盟官方声明", "url": "https://www.qzwb.com/gb/content/2026-10/27/content_9258975.htm"},
    {"title": "BBC：姆巴佩陷入“中国独裁者”迷因风波：品牌解约、央视停播", "url": "https://www.bbc.com/zhongwen/articles/c6x2v4p284ylo/simp"},
    {"title": "BBC: Major Chinese brands drop Mbappé as backlash grows over Mao joke", "url": "https://www.bbc.com/news/articles/cv62yg0erp8zo"},
    {"title": "Mbappé sorry for 'ill-judged' Mao remark after backlash in China", "url": "https://www.the-star.co.ke/news/world/2026-10-27-mbappe-sorry-for-ill-judged-mao-remark-after-backlash-in-china"},
    {"title": "Mbappe, LaLiga apologise to China over Mao Zedong remarks", "url": "https://www.thedailystar.net/sports/football/news/mbappe-la-liga-apologise-china-over-mao-zedong-remarks-4308761"},
    {"title": "EFE: Mbappé pide disculpas y afirma que siente un gran respeto por el pueblo chino", "url": "https://efe.com/deportes/2026-10-27/china-suspension-emisiones-laliga-mbappe/"},
]

# 检索页正文聚合出的关键事实/观点（真实内容转述）
FACTS = [
    "一段据称来自法国节目《The Bridge》的片段在海外社交平台流传，姆巴佩被问及最喜欢的迷因，提到一张把自己的脸与中国领导人形象合成的图。",
    "BBC 表示无法独立核实该访谈的录制和发布时间，原始视频已不在节目官方账号，节目网站也没有重播。",
    "姆巴佩在视频中没有点名毛泽东，海外报道多使用“中国独裁者”的转述表述。",
    "懂球帝在10月26日晚率先关注并定性为不当言论，相关截图在微博快速扩散。",
    "微博30多个相关话题登上热搜，全站阅读量约6.21亿，热搜前十中5项与姆巴佩相关。",
    "东鹏饮料于10月27日9时43分率先宣布终止与姆巴佩全部合作，旗下“补水啦”同步声明。",
    "蒙牛乳业、妙可蓝多相继宣布终止全部合作，声明均使用“零容忍”“坚决抵制”表述。",
    "小红书称与姆巴佩内容合作已于2024年12月31日期满，平台下架相关物料，其账号被禁言并禁止关注。",
    "央视自10月26日晚起全面叫停涉及西甲和姆巴佩的赛事播出，相关广告下架。",
    "中国足协第一时间与皇家马德里俱乐部严正交涉，要求涉事球员和俱乐部公开正式道歉。",
    "外交部发言人表示，伤害中国人民感情的言行自然会遭到中国社会各界共同抵制。",
    "中央广播电视总台致函西甲联盟主席特巴斯，要求皇马和姆巴佩公开诚恳道歉并递交书面道歉信。",
    "西甲联盟10月27日声明称相关言论属球员个人表达、不代表西甲立场，代表联盟及旗下俱乐部向中国球迷致歉。",
    "西甲主席特巴斯致函总台并公开道歉。",
    "姆巴佩10月27日晚以法、中、英三语发布道歉声明，称言论欠妥、绝非本意，对中国人民及其历史怀有深深敬意。",
    "央视回应称“听其言更观其行”，希望西甲、皇马和姆巴佩本人切实吸取教训、真诚道歉、痛改前非。",
    "截至报道时，皇家马德里俱乐部尚未就姆巴佩致歉作出进一步官方回应。",
    "据《金融时报》报道，姆巴佩此前中国市场年度代言收入接近2200万欧元，约占其全球商业总收入38%。",
    "律师指出代言合同通常含道德条款，品牌方可单方解约并可能反向主张违约金，但跨境执行复杂。",
    "皇马近两年多次涉华争议被重新翻出：2024年欧冠决赛球迷辱华歌曲、2026年2月赫伊森转发嘲讽东亚人外貌内容、2026年8月官方社媒涉西藏表述。",
]

# ---------------------------------------------------------------- 1. 模板选择
template_name, template_path = select_report_template("姆巴佩涉华言论突发事件危机公关分析")

# ---------------------------------------------------------------- 2. 数据聚合
structured = collect_from_search_results(SEARCH_RESULTS)
collector = DataCollector()
platform_stats = {}
for row in structured:
    platform_stats[row["platform"]] = platform_stats.get(row["platform"], 0) + 1

# ---------------------------------------------------------------- 3. 情感分析（规则引擎）
analyzer = SentimentAnalyzer()
sentiment_results = [analyzer.analyze(t).__dict__ for t in FACTS]
distribution = analyze_sentiment_distribution(sentiment_results)
keywords = extract_keywords(FACTS, top_k=15)

# ---------------------------------------------------------------- 4. 知识图谱
builder = KnowledgeGraphBuilder("姆巴佩涉华言论事件")
builder.add_topic_node({"date": "2026-10-27", "type": "crisis", "sources": len(SEARCH_RESULTS)})

engines = {
    "QueryAgent": builder.add_engine_node("QueryAgent", "新闻、官方表态与时间线核验"),
    "MediaAgent": builder.add_engine_node("MediaAgent", "微博热搜、短视频与平台处置"),
    "InsightAgent": builder.add_engine_node("InsightAgent", "情绪结构、议题聚类与风险研判"),
}
sections = {
    "事件溯源": builder.add_section_node(engines["QueryAgent"], "事件溯源与发展脉络",
                                     "播客片段流出到本人三语道歉的48小时", order=1),
    "传播分析": builder.add_section_node(engines["MediaAgent"], "舆情传播分析",
                                     "垂直社区点火、微博引爆、官媒定调、商业撤离", order=2),
    "舆论焦点": builder.add_section_node(engines["InsightAgent"], "舆论焦点与公众态度",
                                     "民族情感、吃饭砸锅、道歉诚意、皇马沉默", order=3),
    "风险研判": builder.add_section_node(engines["InsightAgent"], "风险研判",
                                     "商业、转播、俱乐部治理与历史旧账", order=4),
    "应对策略": builder.add_section_node(engines["InsightAgent"], "应对策略与处置建议",
                                     "皇马补位、全球同步、整改与修复", order=5),
}
for name, sec in sections.items():
    q = builder.add_query_node(sec, f"姆巴佩事件 {name} 舆情检索", "web_search")
    for item in SEARCH_RESULTS[:6]:
        builder.add_source_node(q, item["url"], item["title"][:40], collector.identify_platform(item["url"]))

for entity, kind in [
    ("姆巴佩", "person"), ("皇家马德里", "organization"), ("西甲联盟", "organization"),
    ("中国足协", "organization"), ("中央广播电视总台", "organization"), ("外交部", "organization"),
    ("东鹏饮料", "brand"), ("蒙牛乳业", "brand"), ("妙可蓝多", "brand"), ("小红书", "platform"),
    ("The Bridge 播客", "media"), ("三语道歉声明", "statement"), ("道德条款", "legal"),
    ("未核实视频", "risk"), ("历史涉华争议", "risk"),
]:
    builder.add_entity_node(entity, kind)

graph = builder.to_dict()
(OUT / "graph.json").write_text(builder.to_json(), encoding="utf-8")

summary = {
    "topic": "姆巴佩涉华言论事件",
    "generated_at": "2026-10-27",
    "template": {"name": template_name, "path": str(Path(template_path).relative_to(BASE))},
    "sources": len(SEARCH_RESULTS),
    "platform_stats": platform_stats,
    "sentiment_rule_engine": distribution,
    "keywords_rule_engine": keywords,
    "graph": graph["stats"],
    "verification_note": "涉事播客片段截至检索时仍属“未独立核实”；姆巴佩在片段中未点名。报告中“事实 / 报道 / 评论”分层标注。",
}
(OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps(summary, ensure_ascii=False, indent=2))
