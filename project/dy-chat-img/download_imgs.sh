#!/bin/bash
# 360 图片接口搜图下载：用法 download_imgs.sh <关键词> <输出目录> [数量]
# 筛选竖图（高>=宽，宽>=300），带 Referer 防盗链，存 jpg
KW="$1"; OUT="${2:-/tmp/imgs_$$}"; N="${3:-25}"
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1"
mkdir -p "$OUT"
Q="/tmp/_q_$$.json"
curl -s -A "$UA" -H "Referer: https://image.so.com/" "https://image.so.com/j?q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$KW")&sn=0&pn=$((N*2))" -o "$Q"
python3 - "$OUT" "$N" "$Q" <<'PY'
import json,sys,subprocess,os
out,need,q=sys.argv[1],int(sys.argv[2]),sys.argv[3]
d=json.load(open(q))
got=0
for it in d.get('list',[]):
    if got>=need: break
    u=it.get('img') or it.get('thumb') or it.get('url')
    w,h=int(it.get('width') or 0),int(it.get('height') or 0)
    if not u or w<300 or h<w:  # 只要竖图，宽>=300
        continue
    fn=f"{out}/{got+1:02d}.jpg"
    try:
        subprocess.run(["curl","-s","-A","Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)","-H","Referer: https://image.so.com/","-o",fn,u],check=True,timeout=30)
        if os.path.getsize(fn)>5000: got+=1
    except: pass
print(f"downloaded {got} vertical imgs to {out}")
PY
