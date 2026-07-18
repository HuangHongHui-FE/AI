#!/usr/bin/env python3
# 把 results/YYYYMMDD.md 转成同名 .html(带样式,红涨绿跌,表格斑马纹)
import sys, os, re, html

if len(sys.argv) < 2:
    print("usage: md2html.py <input.md>"); sys.exit(1)
src = sys.argv[1]
dst = src[:-3] + ".html" if src.endswith(".md") else src + ".html"
lines = open(src, encoding="utf-8").read().splitlines()

CSS = """
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:1380px;margin:24px auto;padding:0 28px;color:#1f2329;line-height:1.75;background:#fff}
h1{font-size:1.45em;border-bottom:3px solid #c0392b;padding-bottom:10px;margin-bottom:6px}
h2{font-size:1.18em;margin:34px 0 14px;border-left:5px solid #c0392b;padding:6px 0 6px 12px;background:linear-gradient(90deg,#faf0f0,#fff);border-radius:0 4px 4px 0}
h3{font-size:1.06em;margin:24px 0 10px;color:#2c3e50;padding-bottom:4px;border-bottom:1px dashed #e0e0e0}
blockquote{color:#7a7a7a;border-left:3px solid #ddd;padding:8px 14px;margin:12px 0;font-size:.92em;background:#fafafa;border-radius:0 6px 6px 0}
p{margin:8px 0}
.table-wrap{overflow-x:auto;margin:16px 0;border:1px solid #e8e8e8;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
table{border-collapse:collapse;width:100%;font-size:.9em}
th,td{border-bottom:1px solid #eee;padding:9px 12px;text-align:left;vertical-align:top}
td{white-space:normal;min-width:54px;word-break:break-word}
th{background:#f0f3f7;color:#34495e;font-weight:600;white-space:nowrap}
tr:nth-child(even){background:#fafbfc}
tr:hover{background:#fff7e6}
.up{color:#c0392b;font-weight:600}
.down{color:#27ae60;font-weight:600}
strong{color:#c0392b}
code{background:#f4f4f4;padding:1px 5px;border-radius:4px;font-size:.88em;color:#c7254e}
"""

def colorize(s):
    # 涨红跌绿:▲/正/红 涨; ▼/负 跌
    s = re.sub(r'(▲[^<]*|[\+][\d.]+%?)', r'<span class="up">\1</span>', s)
    s = re.sub(r'(▼[^<]*|-[\d.]+%?)', r'<span class="down">\1</span>', s)
    return s


def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return colorize(t)


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
        # 表格行:收集连续表格行
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            if "---" not in lines[i]:
                rows.append([c.strip() for c in lines[i].strip("|").split("|")])
            i += 1
        if rows:
            out.append('<div class="table-wrap"><table>')
            out.append("<tr>" + "".join(f"<th>{inline(h)}</th>" for h in rows[0]) + "</tr>")
            for r in rows[1:]:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
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
