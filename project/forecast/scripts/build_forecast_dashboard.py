#!/usr/bin/env python3
"""Build a multi-region forecast dashboard from a forecast report + 美基星图 snapshot.

Usage:
  python3 scripts/build_forecast_dashboard.py \
    --report results/20261016-1728.html \
    --snapshot /Users/hongenhuang/code/self/AI/try/rea/result/meiji-star/snapshot/summary.json \
    --out results/dashboard.html

The forecast report supplies the 10/16 A-share/HK reasons, five-dim scores and
next-day direction. The 美基星图 snapshot supplies the 10/27 US/A-share/Japan/
Korea/gold sector quotes. Both layers are labelled in the page; they are not
compared as if they were the same date.
"""
import argparse
import html
import json
import os
import re
import statistics
import time
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SNAPSHOT = (
    "/Users/hongenhuang/code/self/AI/try/rea/result/meiji-star/snapshot/summary.json"
)

HK_NAMES = {"港股金融", "港股创新药", "恒生科技", "港股互联网", "恒生红利"}

US_TECH = {
    "ai-compute", "cpo", "semiconductor", "storage", "data-center",
    "cloud-computing", "telecom-equipment", "quantum-computing", "ai-application",
}
US_GROWTH = {"robotics", "autonomous-driving"}
US_COMMODITY = {
    "nuclear-power", "power-grid", "solar", "lithium-battery", "copper-metals",
    "rare-earth", "oil", "gold-miners",
}
US_DEFENSE = {"commercial-space", "satellite", "defense"}


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------
class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(html.unescape("".join(self.cell)).strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def parse_tables(path):
    parser = TableParser()
    parser.feed(open(path, encoding="utf-8").read())
    return parser.tables


def find_table(tables, required):
    for table in tables:
        if not table:
            continue
        header = [cell.strip() for cell in table[0]]
        if all(item in header for item in required):
            return table, header
    return None, None


def strip_tags(value):
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


def section_text(page, title):
    match = re.search(
        r"<h2>" + re.escape(title) + r"</h2>(.*?)(?=<h2>|</body>)", page, re.S
    )
    if not match:
        return ""
    text = strip_tags(match.group(1))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def num(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("%", "").replace(",", "").replace("+", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def fmt_pct(value, digits=2):
    if value is None:
        return "—"
    return f"{value:+.{digits}f}%"


def fmt_num(value, digits=2):
    if value is None:
        return "—"
    return f"{value:,.{digits}f}"


def dir_class(value):
    if value is None or value == 0:
        return "flat"
    return "up" if value > 0 else "down"


def strength(value):
    magnitude = abs(value or 0)
    return "强" if magnitude >= 5 else "中" if magnitude >= 2 else "弱"


def direction_text(direction):
    return {"▲": "▲ 看涨", "▼": "▼ 看跌", "△": "△ 震荡"}.get(direction, direction or "—")


def confidence_text(confidence):
    return {"H": "高", "M": "中", "L": "低"}.get(confidence, confidence or "—")


# ---------------------------------------------------------------------------
# Load forecast report
# ---------------------------------------------------------------------------
def load_forecast(report_path):
    page = open(report_path, encoding="utf-8").read()
    tables = parse_tables(report_path)

    close_table, _ = find_table(tables, ["板块", "收盘涨跌", "原因"])
    advice_table, _ = find_table(tables, ["方向", "推荐", "周一是否操作"])
    check_table, _ = find_table(tables, ["预测时点", "命中率"])

    predictions = []
    for table in tables:
        if not table:
            continue
        header = [cell.strip() for cell in table[0]]
        if "板块" in header and "方向" in header and "综合分" in header:
            predictions.extend(table[1:])

    pred_by_name = {}
    for row in predictions:
        if len(row) < 11:
            continue
        name = row[0].strip()
        dims = []
        for label, cell in zip(
            ["外盘", "资金", "技术", "情绪", "消息"], row[5:10]
        ):
            parts = cell.split(" ", 1)
            score = num(parts[0])
            dims.append(
                {
                    "label": label,
                    "score": score,
                    "text": parts[1].strip() if len(parts) > 1 else "",
                    "cls": dir_class(score),
                }
            )
        pred_by_name[name] = {
            "name": name,
            "code": row[1].strip() if len(row) > 1 else "",
            "direction": row[2].strip()[:1] if len(row) > 2 else "",
            "confidence": row[3].strip() if len(row) > 3 else "",
            "score": num(row[4]) if len(row) > 4 else None,
            "dims": dims,
            "risk": row[10].strip() if len(row) > 10 else "",
        }

    close_rows = close_table[1:] if close_table else []
    cn_rows, hk_rows = [], []
    for row in close_rows:
        if len(row) < 7:
            continue
        item = {
            "name": row[0].strip(),
            "close_chg_text": row[1].strip(),
            "close_chg": num(row[1]),
            "main": row[2].strip(),
            "medium": row[3].strip(),
            "retail": row[4].strip(),
            "structure": row[5].strip(),
            "reason": row[6].strip(),
        }
        if item["name"] in HK_NAMES:
            hk_rows.append(item)
        else:
            cn_rows.append(item)

    for item in cn_rows + hk_rows:
        item["forecast"] = pred_by_name.get(item["name"], {})

    title_match = re.search(r"<h1>(.*?)</h1>", page, re.S)
    title = strip_tags(title_match.group(1)) if title_match else os.path.basename(report_path)
    target_match = re.search(r"预测下一交易日\s*([^）)]+)", title)
    target = target_match.group(1).strip() if target_match else ""

    date_match = re.search(r"(\d{8})-\d{4}", os.path.basename(report_path))
    date = date_match.group(1) if date_match else ""
    macro = {}
    overseas_path = os.path.join(ROOT, "cache", date, "overseas.json")
    if os.path.exists(overseas_path):
        macro = json.load(open(overseas_path, encoding="utf-8")).get("indicators", {})

    return {
        "path": report_path,
        "date": date,
        "title": title,
        "target": target,
        "cn": cn_rows,
        "hk": hk_rows,
        "advice": advice_table[1:] if advice_table else [],
        "checks": check_table[1:] if check_table else [],
        "macro": macro,
        "summary": section_text(page, "一句话总结"),
    }


# ---------------------------------------------------------------------------
# Load 美基星图 snapshot
# ---------------------------------------------------------------------------
def load_snapshot(path):
    snap = json.load(open(path, encoding="utf-8"))
    home = snap.get("home", {}).get("rows", [])
    asia = snap.get("asia", {}).get("sections", [])

    def section(section_id):
        for item in asia:
            if item.get("id") == section_id:
                return item
        return {"items": [], "marketState": None}

    cn = section("cn-sectors")
    kr_indices = section("kr-indices")
    kr_sectors = section("kr-sectors")
    jp_indices = section("jp-indices")
    jp_sectors = section("jp-sectors")

    return {
        "path": path,
        "fetched_at": snap.get("fetchedAt", ""),
        "market_clock": snap.get("marketClock", {}),
        "economy": snap.get("economy", {}),
        "us": home,
        "cn": {
            "items": cn.get("items", []),
            "state": cn.get("marketState"),
        },
        "kr": {
            "indices": kr_indices.get("items", []),
            "sectors": kr_sectors.get("items", []),
            "index_state": kr_indices.get("marketState"),
            "sector_state": kr_sectors.get("marketState"),
        },
        "jp": {
            "indices": jp_indices.get("items", []),
            "sectors": jp_sectors.get("items", []),
            "index_state": jp_indices.get("marketState"),
            "sector_state": jp_sectors.get("marketState"),
        },
        "gold": snap.get("gold", {}),
    }


# ---------------------------------------------------------------------------
# Model helpers
# ---------------------------------------------------------------------------
def us_reason(code):
    if code in US_TECH:
        return "美债 10Y 5.09% 上行压制成长估值；费半 -0.88% 拖累半导体链（10/16 宏观背景）"
    if code in US_GROWTH:
        return "纳指/费半走弱压制成长主题；报告未逐板块归因（10/16 宏观背景）"
    if code in US_COMMODITY:
        return "美元指数 101.71 走弱 vs 美债上行；周期资源/能源宏观背景（报告未逐板块归因）"
    if code in US_DEFENSE:
        return "地缘/航天主题；报告未逐板块归因（10/16 宏观背景）"
    return "利率敏感/防御板块；报告未逐板块归因（10/16 宏观背景）"


def jpkr_reason(code):
    if "semi" in code or "electronic" in code:
        return "半导体周期；美债/美元宏观背景（报告未覆盖日韩板块）"
    if "battery" in code or "auto" in code:
        return "电池/汽车产业链；报告未覆盖日韩板块"
    return "报告未覆盖日韩板块；仅行情快照"


def snapshot_card(region, region_class, item, reason, source, kind="sector"):
    value = item.get("value")
    if value is None:
        value = item.get("changePercent")
    return {
        "region": region,
        "region_class": region_class,
        "kind": kind,
        "name": item.get("name") or item.get("symbol") or "",
        "code": item.get("code") or item.get("symbol") or "",
        "icon": item.get("icon", ""),
        "chg_value": value,
        "chg_text": fmt_pct(value),
        "dir": dir_class(value),
        "chg_dir": dir_class(value),
        "dir_text": "",
        "reason": reason,
        "trend_text": f"当日{'上涨' if (value or 0) > 0 else '下跌' if (value or 0) < 0 else '持平'} "
                      f"{fmt_pct(value)}（{strength(value)}）",
        "sub": item.get("sub", ""),
        "layer": "10/27 快照",
        "layer_class": "layer-snapshot",
        "source": source,
        "score": None,
        "confidence": None,
        "risk": "",
        "dims": [],
    }


def forecast_card(item, region, region_class, source):
    forecast = item.get("forecast", {})
    direction = forecast.get("direction", "")
    score = forecast.get("score")
    confidence = forecast.get("confidence", "")
    close_chg = item.get("close_chg")
    trend_bits = []
    if direction:
        trend_bits.append(direction_text(direction))
    if score is not None:
        trend_bits.append(f"综合分 {score:+.2f}")
    if confidence:
        trend_bits.append(f"置信 {confidence_text(confidence)}")
    sub = f"{item.get('structure','')}｜机构 {item.get('main','—')} · 游资 {item.get('medium','—')} · 散户 {item.get('retail','—')}"
    if item.get("name") in HK_NAMES and item.get("main") == "未取到":
        sub = "港股资金流未取到"
    return {
        "region": region,
        "region_class": region_class,
        "kind": "forecast",
        "name": item.get("name", ""),
        "code": forecast.get("code", ""),
        "icon": "",
        "chg_value": close_chg,
        "chg_text": item.get("close_chg_text", "—"),
        "dir": {"▲": "up", "▼": "down", "△": "flat"}.get(direction, dir_class(close_chg)),
        "chg_dir": dir_class(close_chg),
        "dir_text": direction_text(direction),
        "reason": item.get("reason", "") or "—",
        "trend_text": " · ".join(trend_bits) if trend_bits else "报告未给出方向",
        "sub": sub,
        "layer": "10/16 预测",
        "layer_class": "layer-forecast",
        "source": source,
        "score": score,
        "confidence": confidence,
        "risk": forecast.get("risk", ""),
        "dims": forecast.get("dims", []),
    }


def snap_summary(items, key="chg_value"):
    values = [item.get(key) for item in items if item.get(key) is not None]
    up = sum(1 for value in values if value > 0)
    down = sum(1 for value in values if value < 0)
    flat = len(values) - up - down
    avg = statistics.mean(values) if values else 0.0
    ranked = [item for item in items if item.get(key) is not None]
    top = sorted(ranked, key=lambda item: item[key], reverse=True)[:3]
    bottom = sorted(ranked, key=lambda item: item[key])[:3]
    return {
        "count": len(items),
        "up": up,
        "down": down,
        "flat": flat,
        "avg": avg,
        "avg_text": fmt_pct(avg),
        "avg_label": "均值",
        "top": top,
        "bottom": bottom,
    }


def forecast_summary(items):
    up = sum(1 for item in items if item["forecast"].get("direction") == "▲")
    down = sum(1 for item in items if item["forecast"].get("direction") == "▼")
    flat = sum(1 for item in items if item["forecast"].get("direction") == "△")
    scores = [item["forecast"].get("score") for item in items if item["forecast"].get("score") is not None]
    high = sum(1 for item in items if item["forecast"].get("confidence") == "H")
    ranked = [item for item in items if item["forecast"].get("score") is not None]
    top = sorted(ranked, key=lambda item: item["forecast"]["score"], reverse=True)[:3]
    bottom = sorted(ranked, key=lambda item: item["forecast"]["score"])[:3]
    avg = statistics.mean(scores) if scores else 0.0
    return {
        "count": len(items),
        "up": up,
        "down": down,
        "flat": flat,
        "avg": avg,
        "avg_text": f"{avg:+.2f}",
        "avg_label": "均分",
        "movers_suffix": " 分",
        "high": high,
        "top": [{"name": item["name"], "chg_value": item["forecast"]["score"], "chg_text": f"{item['forecast']['score']:+.2f}"} for item in top],
        "bottom": [{"name": item["name"], "chg_value": item["forecast"]["score"], "chg_text": f"{item['forecast']['score']:+.2f}"} for item in bottom],
    }


# ---------------------------------------------------------------------------
# Build model
# ---------------------------------------------------------------------------
def build_model(report_path, snapshot_path):
    forecast = load_forecast(report_path)
    snapshot = load_snapshot(snapshot_path)

    report_stem = os.path.splitext(os.path.basename(report_path))[0]
    report_time = ""
    if forecast["date"]:
        time_match = re.search(r"-(\d{2})(\d{2})$", report_stem)
        if time_match:
            report_time = f"{forecast['date'][:4]}-{forecast['date'][4:6]}-{forecast['date'][6:]} {time_match.group(1)}:{time_match.group(2)}"
        else:
            report_time = f"{forecast['date'][:4]}-{forecast['date'][4:6]}-{forecast['date'][6:]}"

    macro_forecast = []
    for name, item in forecast["macro"].items():
        price = item.get("price")
        pct = item.get("pct")
        chg = item.get("chg")
        if name.startswith("美债") or "利差" in name or "国债" in name:
            value = f"{price:.4f}%" if price is not None else "—"
            if chg is not None and "利差" not in name:
                delta = f"{chg * 100:+.2f}bp"
            else:
                delta = ""
        elif name == "美元指数":
            value = fmt_num(price)
            delta = f"{chg:+.2f}" if chg is not None else ""
        else:
            value = fmt_num(price)
            delta = fmt_pct(pct) if pct is not None else ""
        macro_forecast.append({"name": name, "value": value, "delta": delta, "time": item.get("time", "")})

    macro_snapshot = []
    for item in snapshot.get("economy", {}).get("indices", []):
        macro_snapshot.append({
            "name": item.get("name", ""),
            "value": item.get("value", "—"),
            "delta": item.get("chg", ""),
            "source": item.get("source", ""),
            "symbol": item.get("symbol", ""),
        })

    us_cards = [
        snapshot_card(
            "美股", "r-us", item, us_reason(item.get("code", "")),
            "美基星图 · 2026-10-27 23:29 快照", "sector",
        )
        for item in snapshot.get("us", [])
    ]

    cn_forecast_cards = [
        forecast_card(item, "A股", "r-cn", "forecast 20261016-1728 · 10/16 收盘后")
        for item in forecast["cn"]
    ]
    hk_forecast_cards = [
        forecast_card(item, "港股", "r-hk", "forecast 20261016-1728 · 10/16 收盘后")
        for item in forecast["hk"]
    ]

    cn_snapshot_cards = [
        snapshot_card(
            "A股", "r-cn", item,
            "10/27 快照 · 报告未逐板块归因",
            "美基星图 · 2026-10-27 23:29 快照",
        )
        for item in snapshot.get("cn", {}).get("items", [])
    ]

    jpkr = []
    for country, data, state, region_class in [
        ("韩国", snapshot.get("kr", {}), "kr", "r-jpkr"),
        ("日本", snapshot.get("jp", {}), "jp", "r-jpkr"),
    ]:
        indices = [
            snapshot_card(
                country, region_class, item,
                "指数行情；报告未覆盖日韩板块",
                "美基星图 · 2026-10-27 23:29 快照", "index",
            )
            for item in data.get("indices", [])
        ]
        sectors = [
            snapshot_card(
                country, region_class, item, jpkr_reason(item.get("code", "")),
                "美基星图 · 2026-10-27 23:29 快照", "sector",
            )
            for item in data.get("sectors", [])
        ]
        jpkr.append({
            "country": country,
            "state": data.get("index_state"),
            "indices": indices,
            "sectors": sectors,
            "summary": snap_summary(indices + sectors),
        })

    gold_cards = []
    gold = snapshot.get("gold", {})
    benchmark = gold.get("benchmark")
    if benchmark:
        value = benchmark.get("changePercent")
        gold_cards.append({
            "region": "黄金", "region_class": "r-gold", "kind": "commodity",
            "name": benchmark.get("name", ""), "code": benchmark.get("symbol", ""),
            "icon": "🥇", "chg_value": value, "chg_text": fmt_pct(value),
            "dir": dir_class(value), "chg_dir": dir_class(value), "dir_text": "",
            "reason": "美元指数走弱、美债上行；避险/实际利率背景（报告未逐板块归因）",
            "trend_text": f"当日{'上涨' if (value or 0) > 0 else '下跌'} {fmt_pct(value)}（{strength(value)}）",
            "sub": f"{fmt_num(benchmark.get('price'))} 元/克 · {benchmark.get('source','')}",
            "layer": "10/27 快照", "layer_class": "layer-snapshot",
            "source": "美基星图 · 2026-10-27 23:29 快照",
            "score": None, "confidence": None, "risk": "", "dims": [],
        })
    for section in gold.get("sections", []):
        for item in section.get("items", []):
            value = item.get("changePercent")
            gold_cards.append({
                "region": "黄金", "region_class": "r-gold", "kind": "commodity",
                "name": item.get("name", ""), "code": item.get("symbol", ""),
                "icon": "🪙", "chg_value": value, "chg_text": fmt_pct(value),
                "dir": dir_class(value), "chg_dir": dir_class(value), "dir_text": "", "dir_text": "",
                "reason": "美元/美债与实际利率背景；报告未逐板块归因",
                "trend_text": f"当日{'上涨' if (value or 0) > 0 else '下跌'} {fmt_pct(value)}（{strength(value)}）",
                "sub": f"{fmt_num(item.get('price'))} {item.get('unit','')} · {item.get('source','')}",
                "layer": "10/27 快照", "layer_class": "layer-snapshot",
                "source": "美基星图 · 2026-10-27 23:29 快照",
                "score": None, "confidence": None, "risk": "", "dims": [],
            })

    return {
        "meta": {
            "report_path": report_path,
            "report_stem": report_stem,
            "report_time": report_time,
            "target": forecast["target"],
            "title": forecast["title"],
            "snapshot_path": snapshot_path,
            "snapshot_time": snapshot.get("fetched_at", ""),
            "generated_at": time.strftime("%Y-%m-%d %H:%M"),
            "summary": forecast["summary"],
            "market_clock": snapshot.get("market_clock", {}),
        },
        "macro_forecast": macro_forecast,
        "macro_snapshot": macro_snapshot,
        "regions": {
            "us": {"cards": us_cards, "summary": snap_summary(us_cards)},
            "cn_forecast": {"cards": cn_forecast_cards, "summary": forecast_summary(forecast["cn"])},
            "cn_snapshot": {"cards": cn_snapshot_cards, "summary": snap_summary(cn_snapshot_cards)},
            "hk": {"cards": hk_forecast_cards, "summary": forecast_summary(forecast["hk"])},
            "jpkr": jpkr,
            "gold": {"cards": gold_cards, "summary": snap_summary(gold_cards)},
        },
        "forecast": {
            "cn": forecast["cn"],
            "hk": forecast["hk"],
            "advice": forecast["advice"],
            "checks": forecast["checks"],
        },
    }


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------
def esc(value):
    return html.escape(str(value if value is not None else ""))


def macro_tile(item, kind="forecast"):
    delta_class = dir_class(num(str(item.get("delta", "")).replace("%", "").replace("bp", "")))
    source = f'<span class="macro-src">{esc(item.get("source", ""))}</span>' if item.get("source") else ""
    return f"""
    <div class="macro-tile">
      <div class="macro-name">{esc(item['name'])} {source}</div>
      <div class="macro-value">{esc(item['value'])}</div>
      <div class="macro-delta {delta_class}">{esc(item.get('delta',''))}</div>
    </div>"""


def summary_card(title, subtitle, summary, accent):
    suffix = summary.get("movers_suffix", "")
    top = "、".join(f"{esc(item['name'])} {esc(item.get('chg_text',''))}{suffix}" for item in summary.get("top", [])[:2])
    bottom = "、".join(f"{esc(item['name'])} {esc(item.get('chg_text',''))}{suffix}" for item in summary.get("bottom", [])[:2])
    return f"""
    <a class="overview-card {accent}" href="#{accent.replace('r-','')}">
      <div class="ov-top"><span class="ov-title">{esc(title)}</span><span class="ov-count">{summary.get('count',0)}</span></div>
      <div class="ov-sub">{esc(subtitle)}</div>
      <div class="ov-stats">
        <span class="up">涨 {summary.get('up',0)}</span>
        <span class="down">跌 {summary.get('down',0)}</span>
        <span class="flat">平 {summary.get('flat',0)}</span>
        <span class="ov-avg">{esc(summary.get('avg_label','均值'))} {esc(summary.get('avg_text', fmt_pct(summary.get('avg'))))}</span>
      </div>
      <div class="ov-movers"><span>强：{top or '—'}</span><span>弱：{bottom or '—'}</span></div>
    </a>"""


def card_html(card):
    dir_ = card.get("dir", "flat")
    chg_cls = card.get("chg_dir", dir_)
    magnitude = min(abs(card.get("chg_value") or 0), 12) / 12 * 100
    risk = ""
    if card.get("risk"):
        risk = f'<div class="risk"><span>风险</span>{esc(card["risk"])}</div>'
    dims = ""
    if card.get("dims"):
        dim_html = "".join(
            f'<div class="dim {dim["cls"]}"><b>{esc(dim["label"])}</b>'
            f'<span>{dim["score"]:+.0f}</span><small>{esc(dim["text"])}</small></div>'
            if dim.get("score") is not None else
            f'<div class="dim flat"><b>{esc(dim["label"])}</b><span>—</span><small>{esc(dim["text"])}</small></div>'
            for dim in card["dims"]
        )
        dims = f'<details class="dims-wrap"><summary>五维打分</summary><div class="dims">{dim_html}</div></details>'
    icon = f'<div class="sector-icon">{esc(card["icon"])}</div>' if card.get("icon") else ""
    dir_badge = f'<span class="dir-badge {dir_}">{esc(card["dir_text"])}</span>' if card.get("dir_text") else ""
    sub = f'<div class="sector-sub">{esc(card["sub"])}</div>' if card.get("sub") else ""
    return f"""
    <article class="sector-card {esc(card['region_class'])} {dir_}"
      data-name="{esc(card['name'])}" data-code="{esc(card['code'])}"
      data-chg="{card.get('chg_value') if card.get('chg_value') is not None else 0}"
      data-score="{card.get('score') if card.get('score') is not None else ''}"
      data-dir="{chg_cls}">
      <div class="card-top">
        <span class="region-pill">{esc(card['region'])}</span>
        <span class="layer-pill {esc(card['layer_class'])}">{esc(card['layer'])}</span>
        {dir_badge}
        <span class="code">{esc(card['code'])}</span>
      </div>
      <div class="card-head">
        {icon}
        <div class="sector-title"><h3>{esc(card['name'])}</h3>{sub}</div>
        <div class="chg {chg_cls}">{esc(card['chg_text'])}</div>
      </div>
      <div class="bar"><span class="{chg_cls}" style="width:{magnitude:.1f}%"></span></div>
      <div class="kv"><div class="k">涨跌原因</div><div class="v">{esc(card['reason'])}</div></div>
      <div class="kv"><div class="k">变化趋势</div><div class="v">{esc(card['trend_text'])}</div></div>
      {risk}
      {dims}
      <div class="card-foot">{esc(card['source'])}</div>
    </article>"""


def grid(cards):
    return '<div class="sector-grid">' + "".join(card_html(card) for card in cards) + "</div>"


def forecast_group(cards, title, cls):
    if not cards:
        return ""
    return f'<div class="card-group" data-group="{cls}"><h3 class="group-title {cls}">{title} <span>{len(cards)}</span></h3>{grid(cards)}</div>'


def region_header(title, subtitle, summary, accent, extra=""):
    return f"""
    <div class="region-head {accent}">
      <div>
        <div class="region-kicker">{esc(subtitle)}</div>
        <h2>{esc(title)}</h2>
      </div>
      <div class="region-stats">
        <span class="up">涨 {summary.get('up',0)}</span>
        <span class="down">跌 {summary.get('down',0)}</span>
        <span class="flat">平 {summary.get('flat',0)}</span>
        <span class="region-avg">{esc(summary.get('avg_label','均值'))} {esc(summary.get('avg_text', fmt_pct(summary.get('avg'))))}</span>
        {extra}
      </div>
    </div>"""


def forecast_table(rows, title):
    header = ["板块", "代码", "方向", "置信", "综合分", "外盘", "资金", "技术", "情绪", "消息", "风险"]
    body = []
    for item in sorted(rows, key=lambda x: ({"▲": 0, "△": 1, "▼": 2}.get(x["forecast"].get("direction", ""), 3), -(x["forecast"].get("score") or 0))):
        fc = item.get("forecast", {})
        dims = {dim["label"]: dim for dim in fc.get("dims", [])}
        badge_cls = {"▲": "b-up", "▼": "b-down", "△": "b-flat"}.get(fc.get("direction"), "b-flat")
        cells = [
            f'<td class="name">{esc(item["name"])}</td>',
            f'<td class="mono">{esc(fc.get("code",""))}</td>',
            f'<td><span class="badge {badge_cls}">{esc(direction_text(fc.get("direction")))}</span></td>',
            f'<td><span class="conf">{esc(confidence_text(fc.get("confidence")))}</span></td>',
            f'<td class="score {dir_class(fc.get("score"))}">{fc.get("score"):+.2f}</td>' if fc.get("score") is not None else '<td class="score">—</td>',
        ]
        for label in ["外盘", "资金", "技术", "情绪", "消息"]:
            dim = dims.get(label, {})
            score = dim.get("score")
            cls = dim.get("cls", "flat")
            score_text = f"{score:+.0f}" if score is not None else "—"
            cells.append(f'<td class="dim-cell"><span class="dim-score {cls}">{score_text}</span><small>{esc(dim.get("text",""))}</small></td>')
        cells.append(f'<td class="risk-cell">{esc(fc.get("risk",""))}</td>')
        body.append("<tr>" + "".join(cells) + "</tr>")
    return f"""
    <div class="table-block">
      <h3>{esc(title)}</h3>
      <div class="table-wrap"><table class="forecast-table">
        <thead><tr>{''.join(f'<th>{esc(h)}</th>' for h in header)}</tr></thead>
        <tbody>{''.join(body)}</tbody>
      </table></div>
    </div>"""


def advice_table(rows):
    out = []
    for row in rows:
        if len(row) < 4:
            continue
        target, recommendation, action, reason = row[:4]
        action_cls = "act-yes" if "✅" in action else "act-warn" if "⚠️" in action else "act-no" if "❌" in action else "act-neutral"
        out.append(f"""
        <tr>
          <td class="name">{esc(target)}</td>
          <td><span class="recommend">{esc(recommendation)}</span></td>
          <td><span class="action {action_cls}">{esc(action)}</span></td>
          <td class="reason-cell">{esc(reason)}</td>
        </tr>""")
    return f"""
    <div class="table-block">
      <h3>操作建议（10/19 周一）</h3>
      <div class="table-wrap"><table class="advice-table">
        <thead><tr><th>方向 / 标的</th><th>推荐</th><th>周一是否操作</th><th>理由</th></tr></thead>
        <tbody>{''.join(out)}</tbody>
      </table></div>
    </div>"""


def checks_table(rows):
    out = []
    for row in rows:
        if len(row) < 4:
            continue
        out.append("<tr>" + "".join(f'<td>{esc(cell)}</td>' for cell in row[:4]) + "</tr>")
    return f"""
    <div class="table-block">
      <h3>上次预测回检</h3>
      <div class="table-wrap"><table class="checks-table">
        <thead><tr><th>预测时点</th><th>预测方向</th><th>命中率</th><th>说明</th></tr></thead>
        <tbody>{''.join(out)}</tbody>
      </table></div>
    </div>"""


def render_html(model):
    meta = model["meta"]
    regions = model["regions"]
    us = regions["us"]
    cn_f = regions["cn_forecast"]
    cn_s = regions["cn_snapshot"]
    hk = regions["hk"]
    jpkr = regions["jpkr"]
    gold = regions["gold"]

    us_cards_sorted = sorted(us["cards"], key=lambda c: c["chg_value"] if c["chg_value"] is not None else -999, reverse=True)
    cn_sorted = sorted(cn_s["cards"], key=lambda c: c["chg_value"] if c["chg_value"] is not None else -999, reverse=True)
    def by_score(card):
        return card["score"] if card["score"] is not None else -999

    cn_up = sorted([c for c in cn_f["cards"] if c["dir"] == "up"], key=by_score, reverse=True)
    cn_flat = sorted([c for c in cn_f["cards"] if c["dir"] == "flat"], key=by_score, reverse=True)
    cn_down = sorted([c for c in cn_f["cards"] if c["dir"] == "down"], key=by_score, reverse=True)
    hk_up = sorted([c for c in hk["cards"] if c["dir"] == "up"], key=by_score, reverse=True)
    hk_flat = sorted([c for c in hk["cards"] if c["dir"] == "flat"], key=by_score, reverse=True)
    hk_down = sorted([c for c in hk["cards"] if c["dir"] == "down"], key=by_score, reverse=True)

    macro_forecast_html = "".join(macro_tile(item) for item in model["macro_forecast"])
    macro_snapshot_html = "".join(macro_tile(item, "snapshot") for item in model["macro_snapshot"])

    jpkr_html = ""
    for block in jpkr:
        jpkr_html += f"""
        <div class="jpkr-block">
          <div class="jpkr-head"><h3>{esc(block['country'])}</h3>
            <span class="market-state">{esc((block.get('state') or {}).get('t',''))} {esc((block.get('state') or {}).get('u',''))}</span>
            <span class="region-stats"><span class="up">涨 {block['summary']['up']}</span><span class="down">跌 {block['summary']['down']}</span><span class="flat">平 {block['summary']['flat']}</span></span>
          </div>
          <div class="mini-label">指数</div>{grid(block['indices'])}
          <div class="mini-label">板块</div>{grid(sorted(block['sectors'], key=lambda c: c['chg_value'] if c['chg_value'] is not None else -999, reverse=True))}
        </div>"""

    overview = "".join([
        summary_card("美股", "26 个主题板块 · 10/27 快照", us["summary"], "r-us"),
        summary_card("A股预测", "27 个板块 · 10/16 预测", cn_f["summary"], "r-cn"),
        summary_card("A股快照", "26 个主题板块 · 10/27 快照", cn_s["summary"], "r-cn"),
        summary_card("港股", "5 个板块 · 10/16 预测", hk["summary"], "r-hk"),
        summary_card("日韩", "指数 + 16 个板块 · 10/27 快照", {
            "count": sum(b["summary"]["count"] for b in jpkr),
            "up": sum(b["summary"]["up"] for b in jpkr),
            "down": sum(b["summary"]["down"] for b in jpkr),
            "flat": sum(b["summary"]["flat"] for b in jpkr),
            "avg": statistics.mean([b["summary"]["avg"] for b in jpkr]) if jpkr else 0,
            "top": [item for b in jpkr for item in b["summary"]["top"]][:2],
            "bottom": [item for b in jpkr for item in b["summary"]["bottom"]][:2],
        }, "r-jpkr"),
        summary_card("黄金", "2 个品种 · 10/27 快照", gold["summary"], "r-gold"),
    ])

    forecast_detail = forecast_table(model["forecast"]["cn"], "A股 · 五维打分与方向（10/16 预测 10/19）")
    forecast_detail += forecast_table(model["forecast"]["hk"], "港股 · 五维打分与方向（10/16 预测 10/19）")
    advice_html = advice_table(model["forecast"]["advice"])
    checks_html = checks_table(model["forecast"]["checks"])
    summary_html = esc(meta.get("summary", "")) or "—"

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>多区域板块看板 · {esc(meta['report_stem'])}</title>
<style>
:root {{
  --bg:#eef2f7; --panel:#ffffff; --ink:#0f172a; --muted:#64748b;
  --line:#e2e8f0; --up:#dc2626; --down:#16a34a; --flat:#64748b;
  --us:#2563eb; --cn:#dc2626; --hk:#7c3aed; --jpkr:#0d9488; --gold:#d97706;
  --shadow:0 10px 30px rgba(15,23,42,.08); --radius:18px;
}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
html,body{{width:100%;max-width:100%;overflow-x:hidden}}
body{{margin:0;background:
  radial-gradient(1200px 500px at 10% -10%,rgba(37,99,235,.10),transparent 60%),
  radial-gradient(900px 400px at 90% 0%,rgba(220,38,38,.08),transparent 55%),
  var(--bg);
  color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased}}
a{{color:inherit;text-decoration:none}}
.hero{{background:
  radial-gradient(900px 420px at 20% 0%,rgba(37,99,235,.35),transparent 60%),
  radial-gradient(700px 360px at 85% 10%,rgba(220,38,38,.22),transparent 55%),
  linear-gradient(135deg,#0b1220 0%,#111c33 55%,#0b1220 100%);
  color:#e5edff;padding:38px 28px 30px;position:relative;overflow:hidden}}
.hero:before{{content:"";position:absolute;inset:0;background-image:
  linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
  linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
  background-size:42px 42px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.7),transparent 85%)}}
.hero-inner{{max-width:1480px;margin:0 auto;position:relative}}
.eyebrow{{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#93c5fd;font-weight:700}}
h1{{font-size:clamp(30px,4vw,52px);line-height:1.08;margin:10px 0 8px;letter-spacing:-.02em}}
.hero-sub{{font-size:15px;color:#b9c7e6;margin-bottom:18px}}
.chips{{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 22px}}
.chip{{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);
  padding:7px 12px;border-radius:999px;font-size:12px;color:#dbeafe;backdrop-filter:blur(8px)}}
.chip b{{color:#fff;font-weight:700}}
.chip.fc{{border-color:rgba(96,165,250,.45);background:rgba(37,99,235,.22)}}
.chip.snap{{border-color:rgba(45,212,191,.45);background:rgba(13,148,136,.22)}}
.macro-grid{{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:14px}}
.macro-tile{{background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 13px;backdrop-filter:blur(8px)}}
.macro-name{{font-size:12px;color:#b9c7e6;display:flex;justify-content:space-between;gap:6px}}
.macro-src{{font-size:10px;color:#5eead4;text-transform:uppercase;letter-spacing:.06em}}
.macro-value{{font-size:20px;font-weight:750;color:#fff;margin-top:3px;font-variant-numeric:tabular-nums}}
.macro-delta{{font-size:12px;font-weight:700}}
.macro-delta.up{{color:#f87171}} .macro-delta.down{{color:#4ade80}} .macro-delta.flat{{color:#94a3b8}}
.callout .macro-tile{{background:#f8fafc;border-color:#e2e8f0}}
.callout .macro-name{{color:#64748b}}
.callout .macro-value{{color:#0f172a}}
.callout .macro-src{{color:#0f766e}}
.topnav{{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line);padding:10px 20px}}
.topnav-inner{{max-width:1480px;margin:0 auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap}}
.nav-links{{display:flex;gap:4px;flex-wrap:wrap}}
.nav-links a{{padding:7px 12px;border-radius:999px;font-size:13px;font-weight:650;color:#334155}}
.nav-links a:hover{{background:#e2e8f0}}
.nav-dot{{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}}
.controls{{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}}
.search{{border:1px solid var(--line);border-radius:999px;padding:8px 13px;font-size:13px;min-width:180px;background:#fff;outline:none}}
.search:focus{{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(37,99,235,.12)}}
.filter{{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:650;color:#475569;cursor:pointer}}
.filter.active{{background:#0f172a;color:#fff;border-color:#0f172a}}
.sort{{border:1px solid var(--line);border-radius:999px;padding:8px 10px;font-size:12px;background:#fff;color:#475569}}
.print{{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-size:12px;cursor:pointer}}
main{{max-width:1480px;margin:0 auto;padding:24px 22px 70px}}
.section{{margin:26px 0 36px;scroll-margin-top:76px}}
.region-head{{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;
  border-left:6px solid var(--accent);padding:6px 0 6px 16px;margin-bottom:16px}}
.region-kicker{{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}}
.region-head h2{{margin:2px 0 0;font-size:clamp(24px,2.6vw,34px);letter-spacing:-.02em}}
.region-stats{{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;font-weight:650}}
.region-stats span{{padding:5px 10px;border-radius:999px;background:#fff;border:1px solid var(--line)}}
.region-stats .up{{color:var(--up)}} .region-stats .down{{color:var(--down)}} .region-stats .flat{{color:var(--flat)}}
.region-avg{{color:#334155!important}}
.r-us{{--accent:var(--us)}} .r-cn{{--accent:var(--cn)}} .r-hk{{--accent:var(--hk)}} .r-jpkr{{--accent:var(--jpkr)}} .r-gold{{--accent:var(--gold)}}
.overview-grid{{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}}
.overview-card{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow);
  border-top:4px solid var(--accent);transition:.2s transform,.2s box-shadow}}
.overview-card:hover{{transform:translateY(-2px);box-shadow:0 16px 38px rgba(15,23,42,.12)}}
.ov-top{{display:flex;justify-content:space-between;align-items:center}}
.ov-title{{font-weight:800;font-size:15px}}
.ov-count{{font-size:12px;color:var(--muted)}}
.ov-sub{{font-size:11px;color:var(--muted);margin:2px 0 8px}}
.ov-stats{{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;font-weight:700}}
.ov-stats span{{padding:3px 7px;border-radius:999px;background:#f8fafc;border:1px solid #eef2f7}}
.ov-stats .up{{color:var(--up)}} .ov-stats .down{{color:var(--down)}} .ov-stats .flat{{color:var(--flat)}}
.ov-avg{{color:#334155!important}}
.ov-movers{{display:flex;flex-direction:column;gap:2px;font-size:11px;color:#475569;margin-top:8px}}
.callout{{background:#fff;border:1px solid var(--line);border-left:5px solid #f59e0b;border-radius:14px;padding:14px 16px;margin:14px 0;box-shadow:var(--shadow);font-size:13px;color:#334155}}
.callout b{{color:#0f172a}}
.callout .split{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}}
.callout .pill{{display:inline-block;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px;margin-right:6px}}
.pill.fc{{background:#dbeafe;color:#1d4ed8}} .pill.snap{{background:#ccfbf1;color:#0f766e}}
.tabs{{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}}
.tab-btn{{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 14px;font-size:13px;font-weight:750;color:#475569;cursor:pointer}}
.tab-btn.active{{background:#0f172a;color:#fff;border-color:#0f172a}}
.cn-panel{{display:none}} .cn-panel.active{{display:block}}
.sector-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}}
.sector-card{{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:15px 16px 12px;
  box-shadow:var(--shadow);border-top:4px solid var(--accent);display:flex;flex-direction:column;gap:9px;
  transition:.18s transform,.18s box-shadow;break-inside:avoid}}
.sector-card:hover{{transform:translateY(-3px);box-shadow:0 18px 42px rgba(15,23,42,.13)}}
.card-top{{display:flex;align-items:center;gap:7px;flex-wrap:wrap}}
.region-pill{{font-size:10px;font-weight:800;letter-spacing:.04em;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,white);padding:3px 8px;border-radius:999px}}
.layer-pill{{font-size:10px;font-weight:750;padding:3px 8px;border-radius:999px}}
.layer-forecast{{background:#dbeafe;color:#1d4ed8}} .layer-snapshot{{background:#ccfbf1;color:#0f766e}}
.dir-badge{{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px}}
.dir-badge.up{{background:#fee2e2;color:#b91c1c}} .dir-badge.down{{background:#dcfce7;color:#166534}} .dir-badge.flat{{background:#f1f5f9;color:#475569}}
.alt-stat{{background:#f0fdfa!important;color:#0f766e!important;border-color:#99f6e4!important}}
.code{{margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#94a3b8;max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.card-head{{display:flex;align-items:center;gap:10px}}
.sector-icon{{font-size:24px;line-height:1}}
.sector-title{{min-width:0;flex:1}}
.sector-title h3{{margin:0;font-size:17px;line-height:1.2;letter-spacing:-.01em}}
.sector-sub{{font-size:10px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.chg{{font-size:22px;font-weight:850;font-variant-numeric:tabular-nums;letter-spacing:-.02em}}
.up{{color:var(--up)}} .down{{color:var(--down)}} .flat{{color:var(--flat)}}
.bar{{height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden}}
.bar span{{display:block;height:100%;border-radius:999px;background:currentColor}}
.bar span.up{{background:var(--up)}} .bar span.down{{background:var(--down)}} .bar span.flat{{background:var(--flat)}}
.kv{{display:grid;grid-template-columns:64px 1fr;gap:8px;font-size:12px;line-height:1.55}}
.kv .k{{color:var(--muted);font-weight:750;font-size:11px;padding-top:1px}}
.kv .v{{color:#334155}}
.risk{{background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;padding:7px 9px;font-size:11px;color:#991b1b;line-height:1.5}}
.risk span{{font-weight:800;margin-right:5px}}
.dims-wrap{{border-top:1px dashed var(--line);padding-top:7px}}
.dims-wrap summary{{font-size:11px;font-weight:750;color:#475569;cursor:pointer}}
.dims{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:7px}}
.dim{{border:1px solid var(--line);border-radius:8px;padding:5px;font-size:9px;line-height:1.35;background:#fbfdff}}
.dim b{{display:block;color:var(--muted);font-size:9px}} .dim span{{font-size:13px;font-weight:850}}
.dim small{{display:block;color:#64748b;font-size:9px;margin-top:1px}}
.dim.up span{{color:var(--up)}} .dim.down span{{color:var(--down)}} .dim.flat span{{color:var(--flat)}}
.card-foot{{margin-top:auto;padding-top:7px;border-top:1px solid #f1f5f9;font-size:10px;color:#94a3b8}}
.card-group{{margin:18px 0 24px}}
.group-title{{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 10px;padding-left:4px}}
.group-title span{{font-size:11px;color:var(--muted);font-weight:600}}
.group-title.up{{color:var(--up)}} .group-title.down{{color:var(--down)}} .group-title.flat{{color:#475569}}
.jpkr-block{{background:rgba(255,255,255,.55);border:1px solid var(--line);border-radius:18px;padding:16px;margin:16px 0}}
.jpkr-head{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}}
.jpkr-head h3{{margin:0;font-size:20px}}
.market-state{{font-size:11px;color:var(--muted);background:#f1f5f9;padding:4px 8px;border-radius:999px}}
.mini-label{{font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--muted);margin:12px 0 8px}}
.table-block{{margin:24px 0}}
.table-block h3{{font-size:16px;margin:0 0 9px}}
.table-wrap{{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow);max-height:76vh}}
table{{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}}
th,td{{padding:9px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #eef2f7}}
thead th{{position:sticky;top:0;z-index:2;background:#f8fafc;color:#334155;font-size:11px;letter-spacing:.03em;white-space:nowrap;border-bottom:1px solid var(--line)}}
tbody tr:nth-child(even){{background:#fbfdff}}
tbody tr:hover{{background:#fff7ed}}
td.name{{font-weight:750;white-space:nowrap}}
td.mono{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#64748b;white-space:nowrap}}
.score{{font-weight:850;font-variant-numeric:tabular-nums;white-space:nowrap}}
.badge{{display:inline-block;padding:3px 8px;border-radius:999px;color:#fff;font-size:10px;font-weight:800;white-space:nowrap}}
.b-up{{background:var(--up)}} .b-down{{background:var(--down)}} .b-flat{{background:var(--flat)}}
.conf{{display:inline-block;padding:2px 7px;border-radius:999px;background:#f1f5f9;font-size:10px;font-weight:750;color:#475569}}
.dim-cell{{min-width:120px}}
.dim-score{{display:inline-block;min-width:26px;text-align:center;font-weight:850;border-radius:6px;padding:1px 5px;margin-right:4px;background:#f8fafc}}
.dim-score.up{{color:var(--up)}} .dim-score.down{{color:var(--down)}} .dim-score.flat{{color:var(--flat)}}
.dim-cell small{{display:block;color:#64748b;font-size:10px;line-height:1.45;margin-top:2px}}
.risk-cell{{min-width:190px;color:#7f1d1d;font-size:11px}}
.recommend{{font-weight:750;white-space:nowrap}}
.action{{display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}}
.act-yes{{background:#dcfce7;color:#166534}} .act-warn{{background:#fef3c7;color:#92400e}} .act-no{{background:#fee2e2;color:#991b1b}} .act-neutral{{background:#f1f5f9;color:#475569}}
.reason-cell{{min-width:300px;font-size:11px;color:#334155}}
.summary-callout{{background:linear-gradient(135deg,#0f172a,#1e293b);color:#e2e8f0;border-radius:16px;padding:18px 20px;margin:18px 0;box-shadow:var(--shadow)}}
.summary-callout .label{{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd;font-weight:800}}
.summary-callout p{{margin:6px 0 0;font-size:14px;line-height:1.7}}
footer{{max-width:1480px;margin:0 auto;padding:0 22px 50px;color:#64748b;font-size:12px}}
footer .foot-card{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow)}}
footer b{{color:#334155}}
footer ul{{margin:8px 0 0;padding-left:18px}} footer li{{margin:4px 0}}
.hidden{{display:none!important}}
@media (max-width:1200px){{.overview-grid{{grid-template-columns:repeat(3,minmax(0,1fr))}} .macro-grid{{grid-template-columns:repeat(4,minmax(0,1fr))}}}}
@media (max-width:800px){{
  html,body,main,.hero,.topnav{{width:100vw!important;max-width:100vw!important;overflow-x:hidden}}
  .hero{{padding:28px 16px 22px}} .hero-sub{{overflow-wrap:anywhere}} main{{padding:16px 14px 50px}}
  .topnav{{padding:10px 12px}}
  .topnav-inner{{display:block;width:100%;max-width:100%;overflow:hidden}}
  .nav-links{{display:flex;width:100%;max-width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:none}}
  .nav-links::-webkit-scrollbar{{display:none}}
  .nav-links a{{white-space:nowrap;flex:0 0 auto}}
  .controls{{margin:8px 0 0;width:100%;max-width:100%;display:flex;flex-wrap:wrap;gap:6px}}
  .search{{flex:1 1 100%;width:100%;min-width:0}}
  .filter,.sort,.print{{flex:0 0 auto}}
  .macro-grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .overview-grid{{grid-template-columns:1fr}}
  .sector-grid{{grid-template-columns:1fr}}
  .callout .split{{grid-template-columns:1fr}}
  .dims{{grid-template-columns:repeat(2,minmax(0,1fr))}}
}}
@media print{{
  .topnav,.hero .chips,.controls,.tabs{{display:none!important}}
  body{{background:#fff}} .hero{{background:#fff;color:#000;padding:10px 0}}
  .hero:before{{display:none}} .macro-tile{{border:1px solid #ddd;background:#fff;color:#000}}
  .macro-value,.macro-name,.hero-sub,.eyebrow{{color:#000}}
  .sector-card,.overview-card{{box-shadow:none;break-inside:avoid}}
  .table-wrap{{max-height:none;box-shadow:none}}
}}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <div class="eyebrow">Market Forecast Dashboard</div>
    <h1>多区域板块看板</h1>
    <div class="hero-sub">美股 · A股 · 港股 · 日韩 · 黄金 ｜ 分区域、分板块看涨跌、原因与趋势</div>
    <div class="chips">
      <span class="chip fc"><b>预测层</b> {esc(meta['report_time'])} → 预测 {esc(meta['target'])}</span>
      <span class="chip snap"><b>行情层</b> {esc(meta['snapshot_time'])} 美基星图快照</span>
      <span class="chip"><b>生成</b> {esc(meta['generated_at'])}</span>
    </div>
    <div class="macro-grid">{macro_forecast_html}</div>
  </div>
</header>

<nav class="topnav">
  <div class="topnav-inner">
    <div class="nav-links">
      <a href="#overview"><span class="nav-dot" style="background:#0f172a"></span>总览</a>
      <a href="#us"><span class="nav-dot" style="background:var(--us)"></span>美股</a>
      <a href="#cn"><span class="nav-dot" style="background:var(--cn)"></span>A股</a>
      <a href="#hk"><span class="nav-dot" style="background:var(--hk)"></span>港股</a>
      <a href="#jpkr"><span class="nav-dot" style="background:var(--jpkr)"></span>日韩</a>
      <a href="#gold"><span class="nav-dot" style="background:var(--gold)"></span>黄金</a>
      <a href="#forecast"><span class="nav-dot" style="background:#64748b"></span>预测与操作</a>
    </div>
    <div class="controls">
      <input class="search" id="search" placeholder="搜索板块 / 代码 / 原因">
      <button class="filter active" data-dir="all">全部</button>
      <button class="filter" data-dir="up">上涨</button>
      <button class="filter" data-dir="down">下跌</button>
      <button class="filter" data-dir="flat">平盘</button>
      <select class="sort" id="sort">
        <option value="default">默认排序</option>
        <option value="chg-desc">涨跌幅 ↓</option>
        <option value="chg-asc">涨跌幅 ↑</option>
        <option value="score-desc">预测分 ↓</option>
        <option value="name">名称</option>
      </select>
      <button class="print" onclick="window.print()">打印</button>
    </div>
  </div>
</nav>

<main>
  <section id="overview" class="section">
    <div class="region-head" style="--accent:#0f172a">
      <div><div class="region-kicker">Overview</div><h2>总览</h2></div>
      <div class="region-stats"><span>6 个区域</span><span>10/27 行情 + 10/16 预测</span></div>
    </div>
    <div class="overview-grid">{overview}</div>
    <div class="callout">
      <b>口径说明：</b>这是一张“预测 + 行情”双层看板。
      <div class="split">
        <div><span class="pill fc">10/16 预测层</span>A股/港股的涨跌原因、方向、综合分、风险来自 <b>{esc(meta['report_stem'])}</b>（10/16 收盘后，预测 10/19 周一）。</div>
        <div><span class="pill snap">10/27 行情层</span>美股/日韩/黄金，以及 A股“主题快照”，来自 <b>美基星图 2026-10-27 23:29</b> 快照。美股处于盘中，A股/日韩已收盘。</div>
      </div>
      <div style="margin-top:8px">两个日期不同，<b>不要直接横向比较</b>。美股/日韩报告未逐板块归因，卡片中的“原因”标注为宏观背景；A股/港股的预测归因来自 10/16 报告。</div>
    </div>
    <div class="callout" style="border-left-color:#0ea5e9">
      <b>最新宏观快照（10/27）：</b>
      <div class="macro-grid" style="margin-top:8px">{macro_snapshot_html}</div>
    </div>
  </section>

  <section id="us" class="section r-us">
    {region_header("美股", "26 个主题板块 · 10/27 23:29 快照 · 盘中", us['summary'], 'r-us')}
    <div class="callout"><b>美股板块归因：</b>10/16 报告只覆盖美股宏观（纳指/费半/标普/美债/美元），没有逐板块原因。下面每张卡的“原因”是宏观背景，不是逐板块因果；涨跌幅来自 10/27 美基星图快照。</div>
    {grid(us_cards_sorted)}
  </section>

  <section id="cn" class="section r-cn">
    {region_header("A股", "10/16 预测归因 + 10/27 主题快照", cn_f['summary'], 'r-cn', extra=f'<span class="alt-stat">10/27 快照 涨{cn_s["summary"]["up"]} 跌{cn_s["summary"]["down"]} 平{cn_s["summary"]["flat"]} 均值{cn_s["summary"]["avg_text"]}</span>')}
    <div class="callout">
      <b>A股怎么看：</b>“预测归因”用 10/16 收盘数据、资金流和五维打分，回答“为什么涨跌、明天可能怎么走”；“主题快照”用 10/27 美基星图数据，回答“今天哪些主题强”。两者日期不同，分开看。
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-panel="cn-forecast">预测归因（10/16 → 10/19）</button>
      <button class="tab-btn" data-panel="cn-snapshot">主题快照（10/27）</button>
    </div>
    <div id="cn-forecast" class="cn-panel active">
      <div class="callout" style="border-left-color:#2563eb">
        <b>方向分布：</b>▲看涨 {cn_f['summary']['up']} · △震荡 {cn_f['summary']['flat']} · ▼看跌 {cn_f['summary']['down']} ·
        平均综合分 {cn_f['summary']['avg']:+.2f} · 高置信 {cn_f['summary']['high']} 个。
      </div>
      {forecast_group(cn_up, "▲ 看涨", "up")}
      {forecast_group(cn_flat, "△ 震荡", "flat")}
      {forecast_group(cn_down, "▼ 看跌", "down")}
    </div>
    <div id="cn-snapshot" class="cn-panel">
      <div class="callout" style="border-left-color:#0d9488"><b>10/27 主题快照：</b>以下 26 个板块来自美基星图，只有行情和宏观背景；逐板块归因见上面的 10/16 预测层。</div>
      {grid(cn_sorted)}
    </div>
  </section>

  <section id="hk" class="section r-hk">
    {region_header("港股", "5 个板块 · 10/16 收盘后 → 10/19 预测", hk['summary'], 'r-hk')}
    <div class="callout"><b>港股归因：</b>来自 10/16 预测报告；恒指期货尾盘已从 +1.37% 回落至 +0.02%，报告提示“独立行情可持续性待验”。</div>
    {forecast_group(hk_up, "▲ 看涨", "up")}
    {forecast_group(hk_flat, "△ 震荡", "flat")}
    {forecast_group(hk_down, "▼ 看跌", "down")}
  </section>

  <section id="jpkr" class="section r-jpkr">
    {region_header("日韩", "KOSPI/KOSDAQ/N225/TOPIX + 16 个板块 · 10/27 快照", {'up':sum(b['summary']['up'] for b in jpkr),'down':sum(b['summary']['down'] for b in jpkr),'flat':sum(b['summary']['flat'] for b in jpkr),'avg':statistics.mean([b['summary']['avg'] for b in jpkr]) if jpkr else 0}, 'r-jpkr')}
    <div class="callout"><b>日韩归因：</b>10/16 报告没有覆盖日韩板块；以下为 10/27 美基星图快照。原因列是宏观背景（美债/美元/半导体周期），不是逐板块归因。</div>
    {jpkr_html}
  </section>

  <section id="gold" class="section r-gold">
    {region_header("黄金", "AU9999 + COMEX · 10/27 快照", gold['summary'], 'r-gold')}
    <div class="callout"><b>黄金归因：</b>美元指数走弱、美债上行，避险与实际利率是主要宏观背景；品牌金价为每日参考价，不是官方实时挂牌价。</div>
    {grid(sorted(gold['cards'], key=lambda c: c['chg_value'] if c['chg_value'] is not None else -999, reverse=True))}
  </section>

  <section id="forecast" class="section">
    <div class="region-head" style="--accent:#64748b">
      <div><div class="region-kicker">Forecast Detail</div><h2>预测与操作</h2></div>
      <div class="region-stats"><span>五维打分</span><span>操作建议</span><span>回检</span></div>
    </div>
    <div class="summary-callout"><div class="label">一句话总结</div><p>{summary_html}</p></div>
    {forecast_detail}
    {advice_html}
    {checks_html}
  </section>
</main>

<footer>
  <div class="foot-card">
    <b>数据来源与限制</b>
    <ul>
      <li><b>预测层（10/16）：</b>{esc(meta['report_path'])}；A股/港股收盘涨跌、资金流、原因、五维打分、操作建议、回检。</li>
      <li><b>行情层（10/27）：</b>{esc(meta['snapshot_path'])}；美股 26 个主题、A股 26 个主题、韩国/日本指数与板块、黄金。</li>
      <li>美股/日韩/黄金的“原因”是宏观背景，报告未逐板块归因；A股/港股预测层的原因来自 10/16 报告。</li>
      <li>10/16 与 10/27 不是同一交易日，不要直接比较涨跌幅；本页仅用于研究与复盘，不构成投资建议。</li>
    </ul>
    <p style="margin-top:10px">原始报告：<a href="{esc(os.path.basename(meta['report_path']))}">{esc(os.path.basename(meta['report_path']))}</a> · 生成：{esc(meta['generated_at'])}</p>
  </div>
</footer>

<script>
(function() {{
  const state = {{dir: 'all', q: ''}};
  const cards = Array.from(document.querySelectorAll('.sector-card'));

  function match(card) {{
    if (state.dir !== 'all' && card.dataset.dir !== state.dir) return false;
    if (state.q) {{
      const hay = (card.dataset.name + ' ' + card.dataset.code + ' ' + card.textContent).toLowerCase();
      if (!hay.includes(state.q)) return false;
    }}
    return true;
  }}

  function apply() {{
    cards.forEach(card => card.classList.toggle('hidden', !match(card)));
    document.querySelectorAll('.card-group').forEach(group => {{
      const visible = group.querySelectorAll('.sector-card:not(.hidden)').length;
      group.classList.toggle('hidden', visible === 0);
    }});
    document.querySelectorAll('.sector-grid').forEach(grid => {{
      const visible = grid.querySelectorAll('.sector-card:not(.hidden)').length;
      const parent = grid.closest('.jpkr-block');
      if (parent) {{
        const blocks = parent.querySelectorAll('.sector-grid');
        const any = Array.from(blocks).some(g => g.querySelectorAll('.sector-card:not(.hidden)').length);
        parent.classList.toggle('hidden', !any);
      }}
    }});
  }}

  document.querySelectorAll('.filter').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dir = btn.dataset.dir;
      apply();
    }});
  }});

  const search = document.getElementById('search');
  search.addEventListener('input', () => {{ state.q = search.value.trim().toLowerCase(); apply(); }});

  document.querySelectorAll('.tab-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.cn-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel).classList.add('active');
    }});
  }});

  const sort = document.getElementById('sort');
  sort.addEventListener('change', () => {{
    const mode = sort.value;
    document.querySelectorAll('.sector-grid').forEach(grid => {{
      const items = Array.from(grid.querySelectorAll('.sector-card'));
      if (mode === 'name') items.sort((a,b) => a.dataset.name.localeCompare(b.dataset.name, 'zh'));
      else if (mode === 'chg-desc') items.sort((a,b) => (parseFloat(b.dataset.chg)||0) - (parseFloat(a.dataset.chg)||0));
      else if (mode === 'chg-asc') items.sort((a,b) => (parseFloat(a.dataset.chg)||0) - (parseFloat(b.dataset.chg)||0));
      else if (mode === 'score-desc') items.sort((a,b) => {{
        const sa = a.dataset.score === '' ? -999 : parseFloat(a.dataset.score);
        const sb = b.dataset.score === '' ? -999 : parseFloat(b.dataset.score);
        return sb - sa;
      }});
      else return;
      items.forEach(item => grid.appendChild(item));
    }});
  }});

  document.querySelectorAll('.nav-links a').forEach(link => {{
    link.addEventListener('click', () => {{
      // Let the browser handle smooth scrolling; keep filters unchanged.
    }});
  }});
}})();
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default=os.path.join(ROOT, "results/20261016-1728.html"))
    parser.add_argument("--snapshot", default=DEFAULT_SNAPSHOT)
    parser.add_argument("--out", default=os.path.join(ROOT, "results/dashboard.html"))
    parser.add_argument("--dump-json", action="store_true")
    args = parser.parse_args()

    model = build_model(args.report, args.snapshot)
    if args.dump_json:
        print(json.dumps(model, ensure_ascii=False, indent=2)[:12000])
        return

    html_text = render_html(model)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(html_text)
    json_path = os.path.splitext(args.out)[0] + ".json"
    with open(json_path, "w", encoding="utf-8") as handle:
        json.dump(model, handle, ensure_ascii=False, indent=2)
    print(f"[dashboard] {args.report} + {args.snapshot} -> {args.out} ({len(html_text)} bytes)")


if __name__ == "__main__":
    main()
