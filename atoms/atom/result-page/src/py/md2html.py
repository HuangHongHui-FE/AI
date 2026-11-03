#!/usr/bin/env python3
# results/YYYYMMDD.md -> 同名 .html(美化样式+方向速览卡片+方向徽章,红涨绿跌)
import sys, re, html

if len(sys.argv) < 2:
    print("usage: md2html.py <input.md> [output.html]"); sys.exit(1)
src = sys.argv[1]
# 支持第二参数指定输出路径(用于不生成md文件、直接产出html到results/)
dst = sys.argv[2] if len(sys.argv) >= 3 else (src[:-3] + ".html" if src.endswith(".md") else src + ".html")
lines = open(src, encoding="utf-8").read().splitlines()

CSS = """
*{box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:1400px;margin:20px auto;padding:0 28px 60px;color:#1f2329;line-height:1.7;background:#f7f8fa}
h1{font-size:1.5em;border-bottom:3px solid #c0392b;padding-bottom:10px;margin:8px 0 4px}
h2{font-size:1.18em;margin:30px 0 12px;padding:8px 0 8px 14px;border-left:5px solid #c0392b;background:#fff;border-radius:0 6px 6px 0;box-shadow:0 1px 3px rgba(0,0,0,.05)}
h3{font-size:1.04em;margin:22px 0 8px;color:#2c3e50;padding-bottom:4px;border-bottom:1px dashed #d8d8d8}
blockquote{color:#666;border-left:3px solid #d0d0d0;padding:6px 14px;margin:10px 0;font-size:.92em;background:#fff;border-radius:0 6px 6px 0}
p{margin:7px 0}
strong{color:#c0392b}
code{background:#eef1f4;padding:1px 5px;border-radius:4px;font-size:.86em;color:#c7254e}
.table-wrap{overflow-x:auto;margin:14px 0;border:1px solid #e6e8eb;border-radius:8px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.04)}
table{border-collapse:collapse;width:100%;font-size:.9em}
th,td{border-bottom:1px solid #eef0f2;padding:8px 11px;text-align:left;vertical-align:top}
td{min-width:50px;word-break:break-word}
th{background:#f0f3f7;color:#34495e;font-weight:600;white-space:nowrap;position:sticky;top:0}
tr:nth-child(even){background:#fafbfc}
tr:hover{background:#fff7e6}
.up{color:#c0392b;font-weight:600}
.down{color:#27ae60;font-weight:600}
/* 方向徽章 */
.badge{display:inline-block;padding:2px 9px;border-radius:11px;color:#fff;font-size:.86em;font-weight:600;min-width:30px;text-align:center}
.b-up{background:#e74c3c}.b-down{background:#27ae60}.b-flat{background:#95a5a6}
/* 方向速览卡片 */
.dir-summary{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}
.dir-group{flex:1;min-width:300px;background:#fff;border:1px solid #e6e8eb;border-radius:8px;padding:10px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.dir-group.up{border-top:4px solid #e74c3c}
.dir-group.down{border-top:4px solid #27ae60}
.dir-group.flat{border-top:4px solid #95a5a6}
.dir-group h4{margin:0 0 8px;font-size:.98em}
.dir-group ul{list-style:none;padding:0;margin:0}
.dir-group li{padding:5px 0;border-bottom:1px dashed #f0f0f0;font-size:.92em;display:flex;justify-content:space-between;gap:8px}
.dir-group li:last-child{border-bottom:none}
.dir-group .nm{font-weight:600}
.dir-group .meta{color:#888;font-size:.88em}
"""

def colorize(s):
    s = re.sub(r'(▲[^<\s]*)', r'<span class="up">\1</span>', s)
    s = re.sub(r'(▼[^<\s]*)', r'<span class="down">\1</span>', s)
    return s

def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return colorize(t)

def badge(cell):
    cell = cell.strip()
    a = cell[0] if cell else ""
    cls = "b-up" if a == "▲" else ("b-down" if a == "▼" else "b-flat")
    return f'<span class="badge {cls}">{html.escape(cell)}</span>'

def build_dir_summary(rows):
    # rows[0]=表头 rows[1:]=数据行; 仅对含"方向"列的预测表生成速览
    h = [x.strip() for x in rows[0]]
    try:
        idx_dir = h.index("方向")
    except ValueError:
        return None
    idx_conf = h.index("置信") if "置信" in h else None
    idx_score = h.index("综合分") if "综合分" in h else None
    groups = {"▲": [], "▼": [], "△": []}
    for r in rows[1:]:
        name = r[0].strip() if r else ""
        d = r[idx_dir].strip() if idx_dir < len(r) else ""
        a = d[0] if d else ""
        if a not in groups:
            for k in "▲▼△":
                if d.startswith(k):
                    a = k
                    break
            else:
                continue
        conf = r[idx_conf].strip() if idx_conf is not None and idx_conf < len(r) else ""
        score = r[idx_score].strip() if idx_score is not None and idx_score < len(r) else ""
        groups[a].append((name, conf, score, d))
    if not any(groups.values()):
        return None
    titles = {"▲": "▲ 看涨", "▼": "▼ 看跌", "△": "△ 震荡"}
    cls = {"▲": "up", "▼": "down", "△": "flat"}
    parts = ['<div class="dir-summary">']
    for a in ("▲", "▼", "△"):
        items = groups[a]
        if not items:
            continue
        parts.append(f'<div class="dir-group {cls[a]}"><h4>{titles[a]} <span class="meta">({len(items)})</span></h4><ul>')
        for name, conf, score, d in items:
            parts.append(f'<li><span class="nm">{html.escape(name)}</span><span class="meta">{html.escape(conf)} {html.escape(score)}</span></li>')
        parts.append('</ul></div>')
    parts.append('</div>')
    return "".join(parts)

out = [f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body>"]
i = 0
while i < len(lines):
    ln = lines[i]
    if ln.startswith("# "):
        out.append(f"<h1>{inline(ln[2:])}</h1>")
    elif ln.startswith("## "):
        out.append(f"<h2>{inline(ln[3:])}</h2>")
    elif ln.startswith("### "):
        out.append(f"<h3>{inline(ln[4:])}</h3>")
    elif ln.startswith("> "):
        out.append(f"<blockquote>{inline(ln[2:])}</blockquote>")
    elif ln.startswith("- "):
        out.append(f"<p>{inline(ln)}</p>")
    elif ln.startswith("|") and "---" not in ln:
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            if "---" not in lines[i]:
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
            i += 1
        if rows:
            h = [x.strip() for x in rows[0]]
            # 方向速览(预测表)
            summary = build_dir_summary(rows) if "方向" in h else None
            if summary:
                out.append(summary)
            out.append('<div class="table-wrap"><table>')
            try:
                idx_dir = h.index("方向")
            except ValueError:
                idx_dir = -1
            out.append("<tr>" + "".join(f"<th>{inline(x)}</th>" for x in rows[0]) + "</tr>")
            for r in rows[1:]:
                cells = []
                for ci, c in enumerate(r):
                    if ci == idx_dir:
                        cells.append(f"<td>{badge(c)}</td>")
                    else:
                        cells.append(f"<td>{inline(c)}</td>")
                out.append("<tr>" + "".join(cells) + "</tr>")
            out.append("</table></div>")
        continue
    elif ln.strip() == "":
        out.append("")
    else:
        out.append(f"<p>{inline(ln)}</p>")
    i += 1

out.append("</body></html>")
open(dst, "w", encoding="utf-8").write("\n".join(out))
print(f"[html] {src} -> {dst}")
