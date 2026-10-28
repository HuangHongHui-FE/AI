#!/usr/bin/env python3
"""Table-first, tabbed, expandable dashboard.

- Top tabs switch regions: 总览 / 美股 / A股 / 港股 / 日韩 / 黄金 / 预测与操作.
- Main tables keep only key columns; every sector row has a 展开 button that
  reveals 涨跌原因 / 变化趋势 / 资金结构 / 五维打分 / 风险 / 数据来源.
- Click a table header to sort (涨跌幅, 综合分, 方向, 置信, etc.).
- The macro table is collapsed inside 总览.

Usage:
  python3 scripts/build_forecast_tables.py \
    --report results/20261016-1728.html \
    --snapshot /Users/hongenhuang/code/self/AI/try/rea/result/meiji-star/snapshot/summary.json \
    --out results/dashboard.html
"""
import argparse
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_forecast_dashboard as base  # noqa: E402


def esc(value):
    return base.esc(value)


def num_cell(value, text=None, extra=""):
    cls = base.dir_class(value)
    data = "0" if value is None else f"{value}"
    shown = text if text is not None else base.fmt_pct(value)
    return f'<td class="num {cls} {extra}" data-v="{data}">{esc(shown)}</td>'


def price_badge(value):
    if value is None or value == 0:
        cls, label = "flat", "平盘"
    elif value > 0:
        cls, label = "up", "上涨"
    else:
        cls, label = "down", "下跌"
    return f'<span class="badge {cls}">{label}</span>'


def forecast_badge(card):
    label = card.get("dir_text") or "—"
    return f'<span class="badge {card.get("dir","flat")}">{esc(label)}</span>'


def conf_cell(confidence):
    mapping = {"H": 3, "M": 2, "L": 1}
    value = mapping.get(confidence, 0)
    return f'<td class="num" data-v="{value}">{esc(base.confidence_text(confidence))}</td>'


def dir_value(card):
    return {"up": 3, "flat": 2, "down": 1}.get(card.get("dir"), 0)


def dir_cell(card):
    label = forecast_badge(card) if card.get("kind") == "forecast" else price_badge(card.get("chg_value"))
    return f'<td data-v="{dir_value(card)}">{label}</td>'


def detail_block(title, text, cls=""):
    if not text:
        return ""
    return f'<div class="detail-block {cls}"><h4>{esc(title)}</h4><p>{esc(text)}</p></div>'


def dims_block(card):
    dims = card.get("dims") or []
    if not dims:
        return ""
    items = []
    for dim in dims:
        score = dim.get("score")
        cls = dim.get("cls", "flat")
        score_text = f"{score:+.0f}" if score is not None else "—"
        items.append(
            f'<div class="dim"><b>{esc(dim.get("label",""))}</b>'
            f'<em class="{cls}">{score_text}</em>'
            f'<small>{esc(dim.get("text",""))}</small></div>'
        )
    return f'<div class="detail-block wide"><h4>五维打分</h4><div class="dims">{"".join(items)}</div></div>'


def detail_html(card, kind):
    blocks = [
        detail_block("涨跌原因", card.get("reason", "")),
        detail_block("变化趋势", card.get("trend_text", "")),
    ]
    if card.get("sub"):
        label = "参考" if kind == "gold" else "结构/资金"
        blocks.append(detail_block(label, card.get("sub", "")))
    if card.get("risk"):
        blocks.append(detail_block("风险", card.get("risk", ""), "risk-block"))
    if card.get("dims"):
        blocks.append(dims_block(card))
    blocks.append(detail_block("数据", f"{card.get('layer','')} · {card.get('source','')}"))
    return '<div class="detail-grid">' + "".join(blocks) + "</div>"


def expand_cell():
    return '<td class="expand-cell"><button class="expand" aria-expanded="false">展开</button></td>'


def row_pair(cells, detail, colspan):
    return (
        '<tr class="main-row">' + "".join(cells) + "</tr>"
        f'<tr class="detail-row" hidden><td colspan="{colspan}">{detail}</td></tr>'
    )


def table(headers, rows, cls="sortable sector-table", title=""):
    head = "".join(headers)
    caption = f'<div class="table-title">{esc(title)}</div>' if title else ""
    return f"""{caption}<div class="table-wrap"><table class="{cls}">
<thead><tr>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table></div>"""


def th(label, sort=None, cls=""):
    attr = f' data-sort="{sort}"' if sort else ""
    return f'<th{attr} class="{cls}">{esc(label)}</th>'


def overview_rows(model):
    regions = model["regions"]
    us = regions["us"]["summary"]
    cn_f = regions["cn_forecast"]["summary"]
    cn_s = regions["cn_snapshot"]["summary"]
    hk = regions["hk"]["summary"]
    gold = regions["gold"]["summary"]
    jpkr_blocks = regions["jpkr"]
    jpkr_avg = statistics.mean([b["summary"]["avg"] for b in jpkr_blocks]) if jpkr_blocks else 0
    jpkr = {
        "count": sum(b["summary"]["count"] for b in jpkr_blocks),
        "up": sum(b["summary"]["up"] for b in jpkr_blocks),
        "down": sum(b["summary"]["down"] for b in jpkr_blocks),
        "flat": sum(b["summary"]["flat"] for b in jpkr_blocks),
        "avg": jpkr_avg,
        "avg_label": "均值",
        "avg_text": base.fmt_pct(jpkr_avg),
        "top": [item for b in jpkr_blocks for item in b["summary"]["top"]][:2],
        "bottom": [item for b in jpkr_blocks for item in b["summary"]["bottom"]][:2],
    }
    rows = [
        ("美股", us, "10/27 快照"),
        ("A股预测", cn_f, "10/16 预测"),
        ("A股快照", cn_s, "10/27 快照"),
        ("港股", hk, "10/16 预测"),
        ("日韩", jpkr, "10/27 快照"),
        ("黄金", gold, "10/27 快照"),
    ]
    out = []
    for name, summary, layer in rows:
        suffix = summary.get("movers_suffix", "")
        top = "、".join(f"{i['name']} {i.get('chg_text','')}{suffix}" for i in summary.get("top", [])[:2])
        bottom = "、".join(f"{i['name']} {i.get('chg_text','')}{suffix}" for i in summary.get("bottom", [])[:2])
        out.append(
            "<tr>"
            f"<td class='name'>{esc(name)}</td>"
            f"<td class='num' data-v='{summary.get('count',0)}'>{summary.get('count',0)}</td>"
            f"<td class='num up' data-v='{summary.get('up',0)}'>{summary.get('up',0)}</td>"
            f"<td class='num down' data-v='{summary.get('down',0)}'>{summary.get('down',0)}</td>"
            f"<td class='num flat' data-v='{summary.get('flat',0)}'>{summary.get('flat',0)}</td>"
            f"<td class='num' data-v='{summary.get('avg',0)}'>{esc(summary.get('avg_label','均值'))} {esc(summary.get('avg_text',''))}</td>"
            f"<td class='top-cell'>{esc(top)}</td>"
            f"<td class='weak-cell'>{esc(bottom)}</td>"
            f"<td class='muted'>{esc(layer)}</td>"
            "</tr>"
        )
    return out


def macro_rows(model):
    out = []
    for item in model["macro_forecast"]:
        delta_cls = base.dir_class(base.num(str(item.get("delta", "")).replace("%", "").replace("bp", "")))
        out.append(
            "<tr>"
            f"<td>10/16 预测</td><td class='name'>{esc(item['name'])}</td>"
            f"<td class='num'>{esc(item['value'])}</td>"
            f"<td class='{delta_cls}'>{esc(item.get('delta',''))}</td>"
            f"<td class='muted'>{esc(item.get('time',''))}</td>"
            "</tr>"
        )
    for item in model["macro_snapshot"]:
        delta_cls = base.dir_class(base.num(str(item.get("delta", "")).replace("%", "")))
        out.append(
            "<tr>"
            f"<td>10/27 快照</td><td class='name'>{esc(item['name'])}</td>"
            f"<td class='num'>{esc(item['value'])}</td>"
            f"<td class='{delta_cls}'>{esc(item.get('delta',''))}</td>"
            f"<td class='muted'>{esc(item.get('source',''))} · {esc(item.get('symbol',''))}</td>"
            "</tr>"
        )
    return out


def sector_rows(cards):
    rows = []
    for card in sorted(cards, key=lambda c: c.get("chg_value") if c.get("chg_value") is not None else -999, reverse=True):
        cells = [
            f"<td class='name'>{esc(card['name'])}</td>",
            f"<td class='mono'>{esc(card['code'])}</td>",
            num_cell(card.get("chg_value"), card.get("chg_text")),
            dir_cell(card),
            expand_cell(),
        ]
        rows.append(row_pair(cells, detail_html(card, "snapshot"), 5))
    return rows


def forecast_rows(cards):
    order = {"▲": 0, "△": 1, "▼": 2}
    cards = sorted(cards, key=lambda c: (order.get((c.get("dir_text") or "")[:1], 3), -(c.get("score") or 0)))
    rows = []
    for card in cards:
        cells = [
            f"<td class='name'>{esc(card['name'])}</td>",
            f"<td class='mono'>{esc(card['code'])}</td>",
            num_cell(card.get("chg_value"), card.get("chg_text")),
            dir_cell(card),
            conf_cell(card.get("confidence")),
            num_cell(card.get("score"), f"{card['score']:+.2f}" if card.get("score") is not None else "—"),
            expand_cell(),
        ]
        rows.append(row_pair(cells, detail_html(card, "forecast"), 7))
    return rows


def jpkr_rows(model):
    rows = []
    for block in model["regions"]["jpkr"]:
        for card in block["indices"] + block["sectors"]:
            kind = "指数" if card in block["indices"] else "板块"
            cells = [
                f"<td>{esc(block['country'])}</td>",
                f"<td>{kind}</td>",
                f"<td class='name'>{esc(card['name'])}</td>",
                f"<td class='mono'>{esc(card['code'])}</td>",
                num_cell(card.get("chg_value"), card.get("chg_text")),
                dir_cell(card),
                expand_cell(),
            ]
            rows.append(row_pair(cells, detail_html(card, "snapshot"), 7))
    return rows


def gold_rows(model):
    rows = []
    for card in model["regions"]["gold"]["cards"]:
        cells = [
            f"<td class='name'>{esc(card['name'])}</td>",
            f"<td class='mono'>{esc(card['code'])}</td>",
            num_cell(card.get("chg_value"), card.get("chg_text")),
            dir_cell(card),
            expand_cell(),
        ]
        rows.append(row_pair(cells, detail_html(card, "gold"), 5))
    return rows


def advice_rows(rows):
    out = []
    for row in rows:
        if len(row) < 4:
            continue
        target, recommendation, action, reason = row[:4]
        cls = "act-yes" if "✅" in action else "act-warn" if "⚠️" in action else "act-no" if "❌" in action else ""
        out.append(
            "<tr>"
            f"<td class='name'>{esc(target)}</td>"
            f"<td>{esc(recommendation)}</td>"
            f"<td><span class='action {cls}'>{esc(action)}</span></td>"
            f"<td class='reason'>{esc(reason)}</td>"
            "</tr>"
        )
    return out


def checks_rows(rows):
    return ["<tr>" + "".join(f"<td>{esc(c)}</td>" for c in row[:4]) + "</tr>" for row in rows if len(row) >= 4]


def render(model):
    meta = model["meta"]
    us = model["regions"]["us"]
    cn_f = model["regions"]["cn_forecast"]
    cn_s = model["regions"]["cn_snapshot"]
    hk = model["regions"]["hk"]
    gold = model["regions"]["gold"]

    overview = table(
        [th("区域", "text"), th("数量", "num"), th("涨", "num"), th("跌", "num"),
         th("平", "num"), th("均值/均分", "num"), th("强", "text"), th("弱", "text"), th("数据层", "text")],
        overview_rows(model), "sortable overview-table", "区域总览",
    )
    macro = table(
        [th("层", "text"), th("指标", "text"), th("数值", "text"), th("变动", "text"), th("来源/时点", "text")],
        macro_rows(model), "sortable macro-table", "",
    )
    us_table = table(
        [th("板块", "text"), th("代码", "text"), th("涨跌幅", "num"), th("方向", "num"), th("详情")],
        sector_rows(us["cards"]), "sortable sector-table", "美股 · 26 个主题板块（10/27 快照）",
    )
    cn_snap_table = table(
        [th("板块", "text"), th("代码", "text"), th("涨跌幅", "num"), th("方向", "num"), th("详情")],
        sector_rows(cn_s["cards"]), "sortable sector-table", "A股 · 26 个主题板块（10/27 快照）",
    )
    cn_forecast_table = table(
        [th("板块", "text"), th("代码", "text"), th("收盘涨跌", "num"), th("方向", "num"),
         th("置信", "num"), th("综合分", "num"), th("详情")],
        forecast_rows(cn_f["cards"]), "sortable sector-table", "A股 · 预测归因（10/16，预测 10/19）",
    )
    hk_table = table(
        [th("板块", "text"), th("代码", "text"), th("收盘涨跌", "num"), th("方向", "num"),
         th("置信", "num"), th("综合分", "num"), th("详情")],
        forecast_rows(hk["cards"]), "sortable sector-table", "港股 · 预测归因（10/16，预测 10/19）",
    )
    jpkr_table = table(
        [th("国家", "text"), th("类型", "text"), th("名称", "text"), th("代码", "text"),
         th("涨跌幅", "num"), th("方向", "num"), th("详情")],
        jpkr_rows(model), "sortable sector-table", "日韩 · 指数与板块（10/27 快照）",
    )
    gold_table = table(
        [th("品种", "text"), th("代码", "text"), th("涨跌幅", "num"), th("方向", "num"), th("详情")],
        gold_rows(model), "sortable sector-table", "黄金（10/27 快照）",
    )
    advice = table(
        [th("方向/标的", "text"), th("推荐", "text"), th("周一是否操作", "text"), th("理由", "text")],
        advice_rows(model["forecast"]["advice"]), "sortable advice-table", "操作建议（10/19 周一）",
    )
    checks = table(
        [th("预测时点", "text"), th("预测方向", "text"), th("命中率", "text"), th("说明", "text")],
        checks_rows(model["forecast"]["checks"]), "sortable checks-table", "上次预测回检",
    )
    summary = esc(meta.get("summary", "")) or "—"

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>多区域板块看板 · {esc(meta['report_stem'])}</title>
<style>
:root {{
  --bg:#f6f7f9; --panel:#fff; --ink:#111827; --muted:#6b7280; --line:#e5e7eb;
  --up:#d93025; --down:#0f9d58; --flat:#6b7280; --accent:#2563eb;
}}
*{{box-sizing:border-box}}
html,body{{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.5}}
[hidden]{{display:none!important}}
a{{color:var(--accent);text-decoration:none}}
.wrap{{max-width:1500px;margin:0 auto;padding:0 20px}}
.page-head{{background:var(--panel);border-bottom:1px solid var(--line);padding:20px 0 16px}}
.kicker{{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}}
h1{{font-size:23px;margin:3px 0 7px;letter-spacing:-.01em}}
.dates{{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 8px}}
.pill{{font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid var(--line);background:#f9fafb;color:#374151}}
.pill.fc{{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}}
.pill.snap{{border-color:#99f6e4;background:#f0fdfa;color:#0f766e}}
.note{{font-size:12px;color:var(--muted);margin:0;max-width:1250px}}
.note b{{color:#374151}}
.topnav{{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line);backdrop-filter:blur(6px)}}
.nav-inner{{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 0}}
.tab{{border:0;background:transparent;color:#4b5563;font-size:12px;font-weight:650;padding:6px 10px;border-radius:4px;cursor:pointer}}
.tab:hover{{background:#f3f4f6}}
.tab.active{{background:#111827;color:#fff}}
.search{{margin-left:auto;border:1px solid var(--line);border-radius:4px;padding:6px 10px;font-size:12px;min-width:220px;outline:none;background:#fff}}
.search:focus{{border-color:#93c5fd;box-shadow:0 0 0 2px rgba(37,99,235,.12)}}
.hint{{font-size:11px;color:var(--muted)}}
main{{padding:8px 0 60px}}
.tab-panel{{display:none}} .tab-panel.active{{display:block}}
section{{margin:22px 0}}
h2{{font-size:17px;margin:0 0 3px;padding-left:9px;border-left:4px solid var(--accent)}}
.section-note{{font-size:12px;color:var(--muted);margin:2px 0 9px;padding-left:13px}}
.table-title{{font-size:13px;font-weight:700;color:#374151;margin:12px 0 6px}}
.table-wrap{{overflow:auto;border:1px solid var(--line);border-radius:5px;background:var(--panel);max-height:74vh}}
table{{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}}
th,td{{padding:7px 9px;border-bottom:1px solid #f0f1f3;text-align:left;vertical-align:top}}
thead th{{position:sticky;top:0;z-index:2;background:#f9fafb;color:#374151;font-size:11px;font-weight:700;white-space:nowrap;border-bottom:1px solid var(--line);cursor:pointer;user-select:none}}
thead th[data-sort]:after{{content:" ⇅";color:#c0c4cc;font-size:10px}}
thead th.sort-asc:after{{content:" ▲";color:#111827}}
thead th.sort-desc:after{{content:" ▼";color:#111827}}
tbody tr.main-row:nth-child(4n+1){{background:#fff}}
tbody tr.main-row:nth-child(4n+3){{background:#fbfcfd}}
tbody tr.main-row:hover{{background:#f3f6fa}}
td.name{{font-weight:650;white-space:nowrap;width:16%}}
td.mono{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#6b7280;white-space:nowrap;width:18%}}
td.num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;width:12%}}
td.expand-cell{{width:8%}}
td.muted{{color:#6b7280;font-size:11px}}
td.top-cell{{color:#166534;font-size:11px;min-width:190px}}
td.weak-cell{{color:#991b1b;font-size:11px;min-width:190px}}
.up{{color:var(--up)}} .down{{color:var(--down)}} .flat{{color:var(--flat)}}
.badge{{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;white-space:nowrap}}
.badge.up{{background:#fde8e8;color:#b91c1c}} .badge.down{{background:#e7f7ee;color:#166534}} .badge.flat{{background:#f1f5f9;color:#475569}}
.expand-cell{{text-align:right;white-space:nowrap}}
.expand{{border:1px solid var(--line);background:#fff;border-radius:3px;padding:2px 8px;font-size:11px;color:#374151;cursor:pointer}}
.expand:hover{{background:#f3f4f6}}
.detail-row td{{background:#fafbfc;padding:0;border-bottom:1px solid var(--line)}}
.detail-grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px 14px}}
.detail-block{{min-width:0}}
.detail-block.wide{{grid-column:1/-1}}
.detail-block h4{{margin:0 0 3px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}}
.detail-block p{{margin:0;font-size:12px;color:#374151;line-height:1.55;white-space:pre-wrap}}
.detail-block.risk-block p{{color:#7f1d1d}}
.dims{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}}
.dim{{border:1px solid var(--line);border-radius:4px;padding:5px 6px;background:#fff;font-size:10px;line-height:1.35}}
.dim b{{display:block;color:#6b7280;font-size:9px}}
.dim em{{font-style:normal;font-size:14px;font-weight:800}}
.dim small{{display:block;color:#64748b;font-size:9px;margin-top:1px}}
.dim em.up{{color:var(--up)}} .dim em.down{{color:var(--down)}} .dim em.flat{{color:var(--flat)}}
.action{{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;white-space:nowrap}}
.act-yes{{background:#dcfce7;color:#166534}} .act-warn{{background:#fef3c7;color:#92400e}} .act-no{{background:#fee2e2;color:#991b1b}}
td.reason{{min-width:260px;font-size:11px;color:#4b5563}}
.tabs{{display:flex;gap:6px;margin:6px 0 10px;padding-left:13px}}
.tab-btn{{border:1px solid var(--line);background:#fff;border-radius:4px;padding:5px 10px;font-size:12px;font-weight:600;color:#4b5563;cursor:pointer}}
.tab-btn.active{{background:#111827;color:#fff;border-color:#111827}}
.panel{{display:none}} .panel.active{{display:block}}
.summary{{background:#fff;border:1px solid var(--line);border-radius:5px;padding:11px 13px;font-size:13px;color:#374151;margin:9px 0 8px}}
.summary b{{color:#111827}}
.macro-details{{border:1px solid var(--line);border-radius:5px;background:#fff;margin-top:12px}}
.macro-details summary{{cursor:pointer;padding:9px 12px;font-size:12px;font-weight:650;color:#374151}}
.macro-details .table-wrap{{border:0;border-top:1px solid var(--line);border-radius:0;max-height:none}}
footer{{border-top:1px solid var(--line);background:#fff;padding:16px 0 28px;font-size:11px;color:var(--muted)}}
footer b{{color:#374151}}
footer ul{{margin:6px 0 0;padding-left:18px}} footer li{{margin:3px 0}}
@media (max-width:800px){{
  .wrap{{padding:0 12px}} h1{{font-size:20px}}
  .search{{width:100%;min-width:0;margin-left:0}}
  .nav-inner{{padding:7px 0}} .tab{{padding:5px 8px;font-size:11px}}
  table{{font-size:11px}} th,td{{padding:6px 7px}}
  .table-wrap{{max-height:none}}
  .detail-grid{{grid-template-columns:1fr;gap:8px;padding:10px 12px}}
  .dims{{grid-template-columns:repeat(2,minmax(0,1fr))}}
  td.reason{{min-width:200px}}
}}
@media print{{
  .topnav,.search,.hint,.expand-cell{{display:none!important}}
  .table-wrap{{max-height:none;overflow:visible;border:0}}
  .detail-row{{display:table-row!important}}
  .tab-panel{{display:block!important}}
  .tab-panel h2{{margin-top:18px}}
  body{{background:#fff}}
}}
</style>
</head>
<body>
<header class="page-head">
  <div class="wrap">
    <div class="kicker">Market Forecast · Multi-region</div>
    <h1>多区域板块看板</h1>
    <div class="dates">
      <span class="pill fc">预测层 {esc(meta['report_time'])} → 预测 {esc(meta['target'])}</span>
      <span class="pill snap">行情层 {esc(meta['snapshot_time'])} 美基星图快照</span>
      <span class="pill">生成 {esc(meta['generated_at'])}</span>
    </div>
    <p class="note"><b>口径：</b>A股/港股的涨跌原因、方向、综合分、风险来自 {esc(meta['report_stem'])}（10/16 收盘后，预测 10/19）；美股/日韩/黄金以及 A股“主题快照”来自美基星图 2026-10-27 23:29 快照。两个日期不同，不要直接横向比较。美股/日韩报告未逐板块归因，展开后的“原因”为宏观背景。</p>
  </div>
</header>

<nav class="topnav">
  <div class="wrap nav-inner">
    <button class="tab active" data-tab="overview">总览</button>
    <button class="tab" data-tab="us">美股</button>
    <button class="tab" data-tab="cn">A股</button>
    <button class="tab" data-tab="hk">港股</button>
    <button class="tab" data-tab="jpkr">日韩</button>
    <button class="tab" data-tab="gold">黄金</button>
    <button class="tab" data-tab="forecast">预测与操作</button>
    <input class="search" id="search" placeholder="搜索板块 / 代码 / 原因">
    <span class="hint">点击表头排序 · 点击展开看原因</span>
  </div>
</nav>

<main class="wrap">
  <section id="overview" class="tab-panel active">
    <h2>总览</h2>
    <p class="section-note">6 个区域；10/16 预测层 + 10/27 行情层。点击表头可按数量、涨跌家数、均值排序。</p>
    {overview}
    <details class="macro-details">
      <summary>宏观指标（17）· 10/16 预测 + 10/27 快照</summary>
      {macro}
    </details>
  </section>

  <section id="us" class="tab-panel">
    <h2>美股</h2>
    <p class="section-note">26 个主题板块 · 10/27 23:29 快照（美股盘中）。报告未覆盖美股细分板块，展开后的“原因”为宏观背景。</p>
    {us_table}
  </section>

  <section id="cn" class="tab-panel">
    <h2>A股</h2>
    <p class="section-note">预测归因（10/16）与主题快照（10/27）分开；两者日期不同，不要直接对比。</p>
    <div class="tabs">
      <button class="tab-btn active" data-panel="cn-forecast">预测归因（10/16 → 10/19）</button>
      <button class="tab-btn" data-panel="cn-snapshot">主题快照（10/27）</button>
    </div>
    <div id="cn-forecast" class="panel active">{cn_forecast_table}</div>
    <div id="cn-snapshot" class="panel">{cn_snap_table}</div>
  </section>

  <section id="hk" class="tab-panel">
    <h2>港股</h2>
    <p class="section-note">5 个板块 · 10/16 收盘后预测 10/19。</p>
    {hk_table}
  </section>

  <section id="jpkr" class="tab-panel">
    <h2>日韩</h2>
    <p class="section-note">韩国/日本指数 + 16 个板块 · 10/27 快照。报告未覆盖日韩板块，展开后的“原因”为宏观背景。</p>
    {jpkr_table}
  </section>

  <section id="gold" class="tab-panel">
    <h2>黄金</h2>
    <p class="section-note">AU9999 + COMEX · 10/27 快照；品牌金价为每日参考价，不是官方实时挂牌价。</p>
    {gold_table}
  </section>

  <section id="forecast" class="tab-panel">
    <h2>预测与操作</h2>
    <div class="summary"><b>一句话总结：</b>{summary}</div>
    {advice}
    {checks}
  </section>
</main>

<footer>
  <div class="wrap">
    <b>数据来源与限制</b>
    <ul>
      <li><b>预测层（10/16）：</b>{esc(meta['report_path'])}；A股/港股收盘涨跌、资金流、原因、五维打分、操作建议、回检。</li>
      <li><b>行情层（10/27）：</b>{esc(meta['snapshot_path'])}；美股 26 个主题、A股 26 个主题、韩国/日本指数与板块、黄金。</li>
      <li>美股/日韩/黄金的“原因”是宏观背景，报告未逐板块归因；A股/港股预测层的原因来自 10/16 报告。</li>
      <li>10/16 与 10/27 不是同一交易日，不要直接比较涨跌幅；本页仅用于研究与复盘，不构成投资建议。</li>
    </ul>
  </div>
</footer>

<script>
(function() {{
  function showTab(id) {{
    document.querySelectorAll('.tab-panel').forEach(function(panel) {{
      panel.classList.toggle('active', panel.id === id);
    }});
    document.querySelectorAll('.tab').forEach(function(tab) {{
      tab.classList.toggle('active', tab.dataset.tab === id);
    }});
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    window.scrollTo(0, 0);
  }}

  document.querySelectorAll('.tab').forEach(function(tab) {{
    tab.addEventListener('click', function() {{ showTab(tab.dataset.tab); }});
  }});
  if (location.hash) {{
    var initial = location.hash.slice(1);
    if (document.getElementById(initial)) {{
      showTab(initial);
      window.setTimeout(function() {{ window.scrollTo(0, 0); }}, 50);
    }}
  }}

  document.querySelectorAll('.tab-btn').forEach(function(btn) {{
    btn.addEventListener('click', function() {{
      document.querySelectorAll('.tab-btn').forEach(function(b) {{ b.classList.remove('active'); }});
      document.querySelectorAll('.panel').forEach(function(p) {{ p.classList.remove('active'); }});
      btn.classList.add('active');
      document.getElementById(btn.dataset.panel).classList.add('active');
    }});
  }});

  document.querySelectorAll('button.expand').forEach(function(btn) {{
    btn.addEventListener('click', function() {{
      var row = btn.closest('tr');
      var detail = row.nextElementSibling;
      if (!detail || !detail.classList.contains('detail-row')) return;
      var open = detail.hidden;
      detail.hidden = !open;
      detail.dataset.open = open ? '1' : '0';
      btn.textContent = open ? '收起' : '展开';
      btn.setAttribute('aria-expanded', String(open));
    }});
  }});

  function cellValue(cell, type) {{
    if (cell && cell.dataset && cell.dataset.v !== undefined && cell.dataset.v !== '') {{
      var n = parseFloat(cell.dataset.v);
      return isNaN(n) ? cell.dataset.v : n;
    }}
    return (cell ? cell.textContent : '').trim();
  }}

  document.querySelectorAll('table.sortable').forEach(function(table) {{
    table.querySelectorAll('thead th[data-sort]').forEach(function(th) {{
      th.addEventListener('click', function() {{
        var type = th.dataset.sort;
        var index = Array.prototype.indexOf.call(th.parentNode.children, th);
        var body = table.tBodies[0];
        var pairs = [];
        for (var i = 0; i < body.rows.length; i += 1) {{
          var row = body.rows[i];
          if (row.classList.contains('detail-row')) continue;
          var next = body.rows[i + 1];
          pairs.push([row, next && next.classList.contains('detail-row') ? next : null]);
        }}
        var dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        table.querySelectorAll('thead th').forEach(function(h) {{
          h.dataset.dir = '';
          h.classList.remove('sort-asc', 'sort-desc');
        }});
        th.dataset.dir = dir;
        th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
        pairs.sort(function(a, b) {{
          var av = cellValue(a[0].cells[index], type);
          var bv = cellValue(b[0].cells[index], type);
          var cmp;
          if (type === 'num') cmp = (parseFloat(av) || 0) - (parseFloat(bv) || 0);
          else cmp = String(av).localeCompare(String(bv), 'zh');
          return dir === 'asc' ? cmp : -cmp;
        }});
        pairs.forEach(function(pair) {{
          body.appendChild(pair[0]);
          if (pair[1]) body.appendChild(pair[1]);
        }});
      }});
    }});
  }});

  var search = document.getElementById('search');
  search.addEventListener('input', function() {{
    var q = search.value.trim().toLowerCase();
    document.querySelectorAll('table.sector-table tbody tr.main-row').forEach(function(row) {{
      var show = q === '' || row.textContent.toLowerCase().indexOf(q) >= 0;
      row.hidden = !show;
      var detail = row.nextElementSibling;
      if (detail && detail.classList.contains('detail-row')) {{
        detail.hidden = !show || detail.dataset.open !== '1';
      }}
    }});
  }});
}})();
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default=os.path.join(base.ROOT, "results/20261016-1728.html"))
    parser.add_argument("--snapshot", default=base.DEFAULT_SNAPSHOT)
    parser.add_argument("--out", default=os.path.join(base.ROOT, "results/dashboard.html"))
    args = parser.parse_args()

    model = base.build_model(args.report, args.snapshot)
    page = render(model)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(page)
    json_path = os.path.splitext(args.out)[0] + ".json"
    with open(json_path, "w", encoding="utf-8") as handle:
        json.dump(model, handle, ensure_ascii=False, indent=2)
    print(f"[table-dashboard] {args.report} + {args.snapshot} -> {args.out} ({len(page)} bytes)")


if __name__ == "__main__":
    main()
