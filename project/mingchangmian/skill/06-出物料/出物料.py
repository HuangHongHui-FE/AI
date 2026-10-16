#!/usr/bin/env python3
"""06 出物料 —— 把一篇稿子准备成「打开就能复制粘贴」的发货物料。

不做任何推送（不碰微信 API）。对每篇：
  1. 复用 ../wechat-img 的 `--dry-run`（内部强制跑 preflight 硬门）生成 cover.jpg + article.html
  2. 生成 copy.html —— 手工复制的入口，正文 HTML + 内嵌 base64 首图 GIF
  3. 生成 发布物料.md —— 公众号标题/摘要/正文 + 视频成品路径与文案，逐块可复制
  4. 汇总 output/YYYY-MM-DD/发布清单.md

用法：
    python3 skill/06-出物料/出物料.py --date 2026-10-09
    python3 skill/06-出物料/出物料.py output/2026-10-09/01-我靠袁华
    python3 skill/06-出物料/出物料.py --all
    python3 skill/06-出物料/出物料.py --date 2026-10-09 --force
"""

import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # 仓库根（mingchangmian/）
WECHAT_IMG = ROOT.parent / "wechat-img"             # 同级项目，排版/封面/preflight 都在那边
OUTPUT = ROOT / "output"

# copy.html 内嵌的 base64 首图：单个 ~5MB，可再生，已在 .gitignore 里排除
IMG_TAG = (
    '<p style="text-align:center;margin:0 0 16px;">'
    '<img src="data:image/gif;base64,{b64}" '
    'style="max-width:100%;border-radius:4px;" /></p>'
)

COPY_PAGE = """<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:24px 0;background:#fff;">
<div style="max-width:677px;margin:0 auto;padding:0 16px;">{body}</div>
</body></html>"""

# 视频号短标题的平台白名单（同 _已停用/B4-发视频号/publish.py）。违反不报错、静默失败，
# 所以在这里扫一遍提前告警。
SHORT_ALLOWED_PUNCT = set("《》「」“”‘’：:+？%℃")
SHORT_BANNED = set("，。、；！,.;!·—～~()（）【】[]{}<>/\\|@#$^&*=")


def bad_short_punct(short):
    return sorted({c for c in short if c in SHORT_BANNED and c not in SHORT_ALLOWED_PUNCT})


def fail(msg):
    print(f"✗ {msg}", file=sys.stderr)
    return False


def resolve_repo_path(value):
    """article.json 里的 gif / video 都按仓库根写相对路径，这里统一解析。"""
    p = Path(value)
    return p if p.is_absolute() else ROOT / p


def pick_article_dirs(args):
    if args.path:
        p = Path(args.path)
        if p.is_file():
            p = p.parent
        if not p.is_absolute():
            p = ROOT / p
        return [p.resolve()]
    if args.date:
        return sorted(d for d in (OUTPUT / args.date).glob("*") if d.is_dir())
    if args.all:
        return sorted(
            d for d in OUTPUT.glob("*/*") if d.is_dir() and (d / "article.json").exists()
        )
    return []


def need_rebuild(out_dir, json_path, force):
    """默认：物料已出齐且不比 article.json 旧，就跳过。"""
    if force:
        return True
    material = out_dir / "发布物料.md"
    for name in ("cover.jpg", "article.html", "copy.html"):
        if not (out_dir / name).exists():
            return True
    if not material.exists():
        return True
    return json_path.stat().st_mtime > material.stat().st_mtime


def run_dry_run(out_dir, gif_abs, json_path):
    """跑 wechat-img 的 --dry-run：过 preflight 硬门 + 出 cover.jpg / article.html。
    cwd 必须是 wechat-img —— index.js 里 resolve("src/preflight.js") 按 cwd 解析。"""
    proc = subprocess.run(
        [
            "node", "src/index.js",
            "--image", str(gif_abs),
            "--from-json", str(json_path),
            "--out-dir", str(out_dir) + "/",
            "--dry-run",
        ],
        cwd=WECHAT_IMG,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(proc.stdout.rstrip(), file=sys.stderr)
        print(proc.stderr.rstrip(), file=sys.stderr)
        return None, f"preflight 硬门未过或生成失败（exit {proc.returncode}）"
    return proc.stdout, None


def extract_body(article_html_path):
    """从 fullPageHtml 的外壳里剥出 bodyHtml —— 与推送时发给微信的内容完全一致
    （index.js 推的是 `bodyHtml + ctaHtml`，不含外层灰底容器）。"""
    html = article_html_path.read_text(encoding="utf-8")
    m = re.search(r"<body[^>]*><div[^>]*>", html)
    end = html.rindex("</div></body></html>")
    if not m or end <= m.end():
        return None
    return html[m.end():end]


def build_copy_html(out_dir, title, body_html, gif_abs):
    b64 = base64.b64encode(gif_abs.read_bytes()).decode("ascii")
    page = COPY_PAGE.format(title=title, body=IMG_TAG.format(b64=b64) + body_html)
    (out_dir / "copy.html").write_text(page, encoding="utf-8")


def block(text):
    """可整块复制的文本块。用围栏包住，避免 `#话题` 被当标题渲染。"""
    return f"```text\n{text}\n```"


def build_material_md(out_dir, article, gif_rel, video_rel, date):
    t = article.get("title", "")
    lines = [
        f"# 发布物料 · {out_dir.name}",
        "",
        f"> 日期 {date} ｜ 目录 `output/{date}/{out_dir.name}`",
        "> 本篇已过 `wechat-img/src/preflight.js` 硬门（出物料时自动跑，未过不会生成此文件）",
        "",
        "---",
        "",
        "## ① 公众号",
        "",
        "**标题**",
        "",
        block(t),
        "",
        "**摘要**",
        "",
        block(article.get("digest", "")),
        "",
        "**正文**",
        "",
        "浏览器打开本目录下的 `copy.html` → `Cmd+A` 全选 → `Cmd+C` 复制 → 粘进公众号编辑器。",
        "排版（标题层级 / 加粗 / 引用块）会一起过去，**首图 GIF 已内嵌在正文顶部，不用另外插**。",
        "",
        f"首图兜底（万一粘贴掉了图）：`{gif_rel}`",
        "",
        "**封面**",
        "",
        "`cover.jpg`（就在本目录，上传为封面图）",
        "",
        "> 这张是**首图 GIF 的第 1 帧**合成的（900×383），不一定是最抓人的那一帧。",
        "> 不满意就自己截一张 900×383 盖到 `cover.jpg` 上 —— 再跑出物料**不会覆盖它**（要重出封面加 `--force`）。",
        "",
        "<details><summary>纯文本兜底（HTML 粘贴失败时用）</summary>",
        "",
        article.get("body_markdown", ""),
        "",
        "</details>",
        "",
    ]

    if video_rel:
        lines += [
            "---",
            "",
            "## ② 视频（视频号 / 抖音 / 快手）",
            "",
            f"**成品视频**：`{video_rel}`",
            "",
        ]
        if article.get("video_short"):
            bad = bad_short_punct(article["video_short"])
            lines += [
                "**视频号 · 短标题**（不加逗号）",
                "",
                block(article["video_short"]),
                "",
            ]
            if bad:
                lines += [
                    f"> ⚠️ 短标题里有平台不接受的标点：`{' '.join(bad)}` —— "
                    "视频号会**静默不保存**，换成空格。规则见 `skill/B4-出视频物料/README.md`。",
                    "",
                ]
        if article.get("video_desc"):
            lines += [
                "**视频号 · 描述**",
                "",
                block(article["video_desc"]),
                "",
            ]
        # douyin / kuaishou 只在和 video_desc 不一样时才单独列 —— 大多数情况复制同一段就行
        extra = [
            (label, article[key])
            for key, label in (("douyin", "抖音"), ("kuaishou", "快手"))
            if article.get(key) and article[key] != article.get("video_desc")
        ]
        if extra:
            for label, text in extra:
                lines += [f"**{label} · 文案**", "", block(text), ""]
        else:
            lines += ["**抖音 / 快手**：复制上面那段描述即可。", ""]
        lines += [
            "> 短标题不能带逗号（平台不报错、静默失败）—— 清洗规则见 `skill/B4-出视频物料/README.md`。",
            "> 封面不用管：视频号会自动从视频里抽两张。",
            "",
        ]
    else:
        lines += [
            "---",
            "",
            "> 本篇 `article.json` 没有 `video` 字段 —— 没有配套成品视频，只出公众号物料。",
            "",
        ]

    (out_dir / "发布物料.md").write_text("\n".join(lines), encoding="utf-8")


def write_checklist(date, records):
    if not records:
        return
    lines = [
        f"# {date} 发布清单",
        "",
        "> Claude 只准备物料，**推送由人手动完成**（公众号 / 视频号 / 抖音 / 快手）。",
        "> 每篇的完整物料见同目录下的 `NN-xxx/发布物料.md`。",
        "",
        "| 编号 | 标题 | 公众号 | 成品视频 | 视频号短标题 |",
        "|---|---|---|---|---|",
    ]
    for r in records:
        pub = f"[{r['dir'].name}]({r['dir'].name}/发布物料.md)"
        video = f"`{Path(r['video']).name}`" if r["video"] else "—"
        short = r["short"] or "—"
        lines.append(f"| {r['no']} | {r['title']} | {pub} | {video} | {short} |")
    lines += [
        "",
        "## 发布前自查",
        "",
        "- [ ] 公众号：标题 + 摘要填进编辑器，正文从 `copy.html` 复制，封面传 `cover.jpg`",
        "- [ ] 视频号：成片 + 短标题 + 描述，**短标题里不能有逗号**",
        "- [ ] 抖音 / 快手：同一段文案可直接用",
        "",
    ]
    (OUTPUT / date / "发布清单.md").write_text("\n".join(lines), encoding="utf-8")


def process(out_dir, force):
    json_path = out_dir / "article.json"
    if not json_path.exists():
        return fail(f"{out_dir} 下没有 article.json，跳过")

    article = json.loads(json_path.read_text(encoding="utf-8"))
    if not need_rebuild(out_dir, json_path, force):
        print(f"· {out_dir.parent.name}/{out_dir.name} —— 物料已在，跳过（--force 重出）")
        return None

    gif_rel = article.get("gif")
    if not gif_rel:
        return fail(
            f"{out_dir.name} 的 article.json 缺 `gif` 字段。"
            f'请补上首图路径，例如："gif": "input/clips/024-我靠袁华-头图.gif"'
        )
    gif_abs = resolve_repo_path(gif_rel)
    if not gif_abs.exists():
        return fail(f"{out_dir.name} 的 gif 不存在：{gif_rel}")

    # 已有的封面不覆盖：它是 GIF 首帧合成的，但可能是人从更抓人的那一帧挑出来的
    # （2026-10-08/01-吕子乔肾宝 就是这种情况）。重出封面要显式 --force。
    kept_cover = None
    cover_path = out_dir / "cover.jpg"
    if cover_path.exists() and not force:
        kept_cover = cover_path.read_bytes()

    _, err = run_dry_run(out_dir, gif_abs, json_path)
    if err:
        return fail(f"{out_dir.name} —— {err}")

    if kept_cover is not None:
        cover_path.write_bytes(kept_cover)
        print("  · 保留了原有的 cover.jpg（要重出封面加 --force）")

    # index.js 会把随机抽到的 theme / cover_style 写回 article.json，这里重新读
    article = json.loads(json_path.read_text(encoding="utf-8"))
    body_html = extract_body(out_dir / "article.html")
    if body_html is None:
        return fail(f"{out_dir.name} —— 从 article.html 里剥正文失败，wechat-img 模板可能变了")

    build_copy_html(out_dir, article.get("title", ""), body_html, gif_abs)

    video_rel = article.get("video") or ""
    if video_rel and not resolve_repo_path(video_rel).exists():
        print(f"  ⚠ video 字段指向的文件不存在，视频段仍照写：{video_rel}")
    build_material_md(out_dir, article, gif_rel, video_rel, out_dir.parent.name)

    print(f"✓ {out_dir.parent.name}/{out_dir.name} —— {article.get('title', '')}")
    short = article.get("video_short", "")
    if short and bad_short_punct(short):
        print(f"  ⚠ 短标题含平台不接受的标点：{''.join(bad_short_punct(short))}（视频号会静默不保存）")
    return {
        "dir": out_dir,
        "no": out_dir.name[:2],
        "title": article.get("title", ""),
        "video": video_rel,
        "short": short,
    }


def main():
    ap = argparse.ArgumentParser(description="产出可复制粘贴的发货物料（不推送）")
    ap.add_argument("path", nargs="?", help="单篇目录或 article.json 路径")
    ap.add_argument("--date", help="只出这一天，如 2026-10-09")
    ap.add_argument("--all", action="store_true", help="出所有未出过的稿子")
    ap.add_argument("--force", action="store_true", help="已有物料也重出")
    args = ap.parse_args()

    if not args.path and not args.date and not args.all:
        ap.error("至少要给 path / --date / --all 之一")
    if not WECHAT_IMG.exists():
        sys.exit(f"✗ 找不到同级项目：{WECHAT_IMG}")

    dirs = pick_article_dirs(args)
    if not dirs:
        sys.exit("✗ 没找到任何文章目录")

    records, failures = [], []
    for d in dirs:
        r = process(d, args.force)
        if r is False:
            failures.append(d)
        elif r:
            records.append(r)

    by_date = {}
    for r in records:
        by_date.setdefault(r["dir"].parent.name, []).append(r)
    for date, recs in by_date.items():
        recs.sort(key=lambda r: r["dir"].name)
        write_checklist(date, recs)

    print(f"\n出了 {len(records)} 篇，失败 {len(failures)} 篇")
    for d in failures:
        print(f"  ✗ {d}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
