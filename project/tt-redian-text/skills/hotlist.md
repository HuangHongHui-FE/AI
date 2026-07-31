# 实时热榜抓取 Skill

> 项目根目录：`/Users/zcy1/code_self/AI/project/tt-redian-text`
> 调用方式：用户说「看下今天热榜」「有啥热点」「抓个热搜」之类，Claude 直接抓多平台实时榜单，原样输出供选点
> **不需要头条登录态、不需要 .env**，纯公开接口
> 主脚本 `src/fetch-hot.js`（移植自 `video/reToView/fetch-hot.js`），解析 tophub.today 聚合主页

---

## 触发条件

用户说「抓热搜」「今天有啥热点」「看下热榜」「实时热点有哪些」之类，想拿当下各平台热搜做发文选题。

---

## 能抓 / 不能抓

| 平台 | 主路径 | 状态 | 凭据 |
|------|--------|------|------|
| 今日头条热榜 | `toutiao.com/hot-event/hot-board/` | ✅ 官方接口免登录 JSON | 免登录 |
| 百度热搜 | `top.baidu.com/api/board?platform=wise&tab=realtime` | ✅ 免登录 JSON | 免登录 |
| 抖音热榜 | `iesdouyin.com/web/api/v2/hotsearch/billboard/word/` | ✅ 免登录 JSON，带 active_time | 免登录 |
| B站热搜 | `api.bilibili.com/x/web-interface/search/square?limit=20` | ✅ 免登录 JSON | 免登录 |
| tophub 聚合 | `tophub.today/` | ✅ `src/fetch-hot.js` 一把抓多平台 | 免登录 |
| 微博热搜 | m 端返 Sina Visitor System | ❌ 需登录态 | 需登录 |
| 知乎热榜 | 官方 API 返 401 | ❌ 需 token | 需 token |

> **微博/知乎覆盖**：头条 + 百度 + 抖音三榜重叠度极高，能覆盖微博热搜 70%+ 的头条新闻类话题，够用。

---

## 执行流程

### 0. 主路径：一键聚合抓多平台

```bash
# 项目根目录跑，需 Node 20（见 .nvmrc）
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1
node src/fetch-hot.js
```

输出 `hot.json`，结构 `{ fetchedAt, sources: { 平台名: { label, count, items:[{rank,title,extra}] } } }`。tophub 聚合了今日头条/百度/抖音/B站/贴吧/少数派/掘金/V2EX/GitHub 等 20+ 榜。

**已知**：tophub 偶尔不聚合今日头条官方榜（2026-07-26 实测缺失），此时用下面 curl 补头条官方热榜。

### 1. 补抓头条官方热榜（tophub 缺失时必跑）

```bash
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0" \
  "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc" \
  -o /tmp/tt.json -w "头条 http:%{http_code} size:%{size_download}\n"
```

验收 `http:200 size:>3000`。

### 2. 补抓百度/抖音/B站官方接口（要稳定热度数字时跑）

```bash
# 百度（必须 platform=wise，PC 端 HTML 是 JS 渲染拿不到）
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)" \
  "https://top.baidu.com/api/board?platform=wise&tab=realtime" -o /tmp/bd.json

# 抖音
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)" \
  "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/" -o /tmp/dy.json

# B站
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0" \
  "https://api.bilibili.com/x/web-interface/search/square?limit=20" -o /tmp/bili.json
```

### 3. 解析各平台 JSON 字段路径

| 平台 | 条目数组 | 标题字段 | 热度字段 | 备注 |
|------|---------|---------|---------|------|
| 头条 | `data[]` | `Title` | `HotValue`（绝对值） | 共 50 条 |
| 百度 | `data.cards[].content[].content[]` | `word` | 无稳定数字 | 嵌套两层 content，有 `isTop` 置顶 |
| 抖音 | `data.word_list[]` | `word` | `hot_value` | 顶层 `active_time` 是榜单刷新时间，证实时 |
| B站 | `data.trending.list[]` | `keyword` | `heat_score` | 共 20 条 |

### 4. 汇总输出（python heredoc）

```bash
python3 - <<'PY'
import json
def hot(n):
    try: n=int(n)
    except: return ''
    return f"{n//10000}万" if n>=10000 else str(n)
print("="*50,"\n【今日头条热榜】")
for i,it in enumerate(json.load(open('/tmp/tt.json')).get('data',[])[:12],1):
    print(f"{i:2}. {it.get('Title','')}  🔥{hot(it.get('HotValue',0))}")
print("\n【百度热搜】")
bd=json.load(open('/tmp/bd.json'))['data']['cards']; words=[]
for c in bd:
    for blk in c.get('content',[]):
        for it in blk.get('content',[]):
            if it.get('word'): words.append(it['word'])
for i,w in enumerate(words[:12],1): print(f"{i:2}. {w}")
print("\n【抖音热榜】",json.load(open('/tmp/dy.json')).get('active_time'))
for i,it in enumerate(json.load(open('/tmp/dy.json')).get('word_list',[])[:12],1):
    print(f"{i:2}. {it.get('word','')}  🔥{hot(it.get('hot_value',0))}")
print("\n【B站热搜】")
items=json.load(open('/tmp/bili.json'))['data']['trending']['list']
for i,it in enumerate(items[:12],1):
    print(f"{i:2}. {it.get('keyword','')}  🔥{hot(it.get('heat_score',0))}")
PY
```

### 5. 输出全榜（不筛选、不给用户挑）

抓完**原样输出各榜**，只标注跨榜重叠（同一话题多榜出现 = 真热）。**不按调性筛 3 条给用户挑**——选点规则在 [[toutiao-hotspot]]：每平台热度 top2 + 全库去重 + 适性过滤，自动定。

本 skill 只负责「把榜抓出来给人看」，不负责选点。用户说「写热点文章」走 [[toutiao-hotspot]]，先调本 skill 抓榜，再按其规则自动选点。

---

## 已知坑

1. **vvhan/oioweb/qqsuu/tenapi 第三方聚合 API 全挂**，别试，直接用官方接口。
2. **百度 PC 端 `top.baidu.com/board` 是 JS 渲染**，必须用 `platform=wise` 的 JSON API。
3. **微博 m 端返 Sina Visitor System**，Bash curl 拿不到，跳过。
4. **tophub.today 偶尔不聚合今日头条榜**（2026-07-26 实测缺失），此时补 curl 头条官方 `hot-event/hot-board`。
5. **接口字段会变**：解析前先 `python3 -c "import json;d=json.load(open('/tmp/xx.json'));print(list(d.keys()));print(json.dumps(d,ensure_ascii=False)[:800])"` 看结构，别盲跑正则。
6. **沙箱网络**：本环境 Bash 默认能出网，无需 `dangerouslyDisableSandbox`。

---

## 不要做

- 不做定时轮询（用户要时抓一次，热榜刷新很快）
- 不存库（`/tmp` 临时文件用完即弃，`hot.json` 也可即弃）
- 不死磕微博/知乎——四平台够覆盖
- 不把热点喂给用户挑——选点自动定（[[toutiao-hotspot]]）
