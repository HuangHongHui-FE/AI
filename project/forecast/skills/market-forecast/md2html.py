#!/usr/bin/env python3
# 把 results/YYYYMMDD.md 转成同名 .html(带样式,红涨绿跌,表格斑马纹)
import sys, os, re, html

if len(sys.argv) < 2:
    print("usage: md2html.py <input.md>"); sys.exit(1)
src = sys.argv[1]
dst = src[:-3] + ".html" if src.endswith(".md") else src + ".html"
lines = open(src, encoding="utf-8").read().splitlines()

CSS = """
body{font-family:-apple-system,"PingFang SC",sans-serif;max-width:1200px;margin:20px auto;padding:0 16px;color:#222;line-height:1.6}
h1{font-size:1.4em;border-bottom:2px solid #c00;padding-bottom:6px}
h2{font-size:1.15em;margin-top:28px;border-left:4px solid #c00;padding-left:8px}
h3{font-size:1.05em;margin-top:18px;color:#333}
blockquote{color:#666;border-left:3px solid #ddd;padding-left:12px;margin:8px 0;font-size:.9em}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:.85em}
th,td{border:1px solid #e0e0e0;padding:5px 8px;text-align:left;white-space:nowrap}
th{background:#f5f5f5}
tr:nth-child(even){background:#fafafa}
.up{color:#c00;font-weight:bold}  /* 涨红 */
.down{color:#0a0;font-weight:bold} /* 跌绿 */
code{background:#f4f4f4;padding:1px 4px;border-radius:3px;font-size:.9em}
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
            out.append("<table>")
            out.append("<tr>" + "".join(f"<th>{inline(h)}</th>" for h in rows[0]) + "</tr>")
            for r in rows[1:]:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            out.append("</table>")
        continue
    elif ln.strip() == "":
        out.append("")
    else:
        out.append(f"<p>{inline(ln)}</p>")
    i += 1

out.append("</body></html>")
open(dst, "w", encoding="utf-8").write("\n".join(out))
print(f"[html] {src} -> {dst}")
