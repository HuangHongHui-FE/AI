# 实时热榜抓取 Skill

> 项目根目录：`/Users/zcy1/code_self/AI/project/wechat-img`
> 调用方式：用户说「看下今天热榜」「有啥热点」「抓个热搜」之类，Claude 直接抓四平台实时榜单，按公众号调性筛 3 条选题给用户
> **不需要微信凭据、不需要 .env**，纯公开接口

---

## 触发条件

用户说「抓热搜」「今天有啥热点」「看下热榜」「实时热点有哪些」之类，想拿当下各平台热搜做发文选题。

---

## 能抓 / 不能抓

| 平台 | 状态 | 接口 | 凭据 |
|------|------|------|------|
| 今日头条 | ✅ 可抓 | `toutiao.com/hot-event/hot-board/` | 免登录 JSON |
| 百度热搜 | ✅ 可抓 | `top.baidu.com/api/board?platform=wise&tab=realtime` | 免登录 JSON |
| 抖音热榜 | ✅ 可抓 | `iesdouyin.com/web/api/v2/hotsearch/billboard/word/` | 免登录 JSON，带 active_time |
| B站热搜 | ✅ 可抓 | `api.bilibili.com/x/web-interface/search/square?limit=20` | 免登录 JSON |
| 微博热搜 | ✅ 可抓（2026-08-28 打通） | **PC 端 `weibo.com/ajax/side/hotSearch`**（免登录，返 realtime 51 条 + hotgovs 政务榜，带 沸/热/新 标签）；~~m 端返「Sina Visitor System」访客系统，需 JS 生成 cookie~~ 已弃 | 免登录 JSON |
| 知乎热榜 | ❌ 抓不到 | 官方 API 返 401（code:101 身份未经过验证），需登录 token；rsshub 等镜像 000 连不上 | 需 token |

**微博已打通**：PC 端 `weibo.com/ajax/side/hotSearch` 免登录可抓，返 `data.realtime`（51 条热搜，字段 `word`=词条、`label_name`/`small_icon_desc`=沸/热/新标签）+ `data.hotgovs`（政务榜）。实测与其他四榜重叠度高（尼泊尔山洪/青铜峡泄洪不实/房贷/教师合影同现），数据可信。**m 端 302 访客系统已弃**，别再试。

**知乎覆盖**：头条 + 百度 + 抖音 + 微博四榜重叠度极高（同一热点会同时上榜），知乎仍缺但影响小——知乎热榜偏深度/学术/生活长文，与发文调性（社会民生/热点）重叠有限。够用。

---

## 执行流程

### 1. 并行抓五平台（一条消息发 5 个 Bash 调用）

```bash
# 头条热榜
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0" \
  "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc" \
  -o /tmp/tt.json -w "头条 http:%{http_code} size:%{size_download}\n"

# 百度热搜（注意 platform=wise，PC 端 HTML 是 JS 渲染拿不到）
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)" \
  "https://top.baidu.com/api/board?platform=wise&tab=realtime" \
  -o /tmp/bd.json -w "百度 http:%{http_code} size:%{size_download}\n"

# 抖音热榜
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)" \
  "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/" \
  -o /tmp/dy.json -w "抖音 http:%{http_code} size:%{size_download}\n"

# B站热搜
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0" \
  "https://api.bilibili.com/x/web-interface/search/square?limit=20" \
  -o /tmp/bili.json -w "B站 http:%{http_code} size:%{size_download}\n"

# 微博热搜（PC 端免登录接口，2026-08-28 打通；带 Referer 更稳）
curl -s --max-time 12 -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -H "Referer: https://weibo.com/" \
  "https://weibo.com/ajax/side/hotSearch" \
  -o /tmp/wb.json -w "微博 http:%{http_code} size:%{size_download}\n"
```

**验收**：每个 `http:200 size:>3000`。size 过小（<500）多半是接口变了或被拦，看下文件内容再决定换源。

### 2. 解析各平台 JSON 字段路径

| 平台 | 条目数组 | 标题字段 | 热度字段 | 备注 |
|------|---------|---------|---------|------|
| 头条 | `data[]` | `Title` | `HotValue`（绝对值） | 共 50 条 |
| 百度 | `data.cards[].content[].content[]` | `word` | 无稳定数字 | 嵌套两层 content，有 `isTop` 置顶 |
| 抖音 | `data.word_list[]` | `word` | `hot_value` | 顶层 `active_time` 是榜单刷新时间，用来证实时 |
| B站 | `data.trending.list[]` | `keyword` | `heat_score` | 共 20 条 |
| 微博 | `data.realtime[]`（51 条）+ `data.hotgovs[]` | `word` | `label_name`/`small_icon_desc`（沸/热/新） | 带 `hotgovs` 政务榜；`topic_flag` 标记话题 |

### 3. 一键汇总（python heredoc，直接粘）

```bash
python3 - <<'PY'
import json

def hot(n):
    try: n=int(n)
    except: return ''
    return f"{n//10000}万" if n>=10000 else str(n)

print("="*50, "\n【今日头条热榜】")
for i,it in enumerate(json.load(open('/tmp/tt.json')).get('data',[])[:12],1):
    print(f"{i:2}. {it.get('Title','')}  🔥{hot(it.get('HotValue',0))}")

print("\n"+"="*50, "\n【百度热搜】")
bd=json.load(open('/tmp/bd.json'))['data']['cards']
words=[]
for c in bd:
    for blk in c.get('content',[]):
        for it in blk.get('content',[]):
            if it.get('word'): words.append(it['word'])
for i,w in enumerate(words[:12],1): print(f"{i:2}. {w}")

print("\n"+"="*50, "\n【抖音热榜】", json.load(open('/tmp/dy.json')).get('active_time'))
for i,it in enumerate(json.load(open('/tmp/dy.json')).get('word_list',[])[:12],1):
    print(f"{i:2}. {it.get('word','')}  🔥{hot(it.get('hot_value',0))}")

print("\n"+"="*50, "\n【B站热搜】")
items=json.load(open('/tmp/bili.json'))['data']['trending']['list']
for i,it in enumerate(items[:12],1):
    print(f"{i:2}. {it.get('keyword','')}  🔥{hot(it.get('heat_score',0))}")

print("\n"+"="*50, "\n【微博热搜】")
try:
    wb=json.load(open('/tmp/wb.json'))['data']
    for i,it in enumerate(wb.get('realtime',[])[:12],1):
        tag=it.get('label_name','') or it.get('small_icon_desc','')
        print(f"{i:2}. {it.get('word','')}  {tag}")
except Exception as e:
    print("微博解析失败(可能接口变动):", e)
PY
```

### 4. 输出全榜（不筛选、不给用户挑）

抓完**原样输出五榜**，只标注跨榜重叠（同一话题在多个榜出现，说明真热）。**不按调性筛 3 条给用户挑**——热点由用户自己从五榜里选，Claude 只做历史去重/适性过滤/红线提醒（见 [[00-hotspot-publish]] 步骤②）。

本 skill 只负责「把榜抓出来给人看」，不负责选点。用户说「写热点文章」走 [[00-hotspot-publish]] 入口，会先调本 skill 抓榜，再等用户选热点。

---

## 实跑样本

### 2026-06-29 23:41（四榜，微博未打通前）
四榜全部 200，抖音 `active_time=2026-06-29 23:41:16` 证实实时。跨榜重叠热点（重叠 = 真热，用户选热点时优先考虑）：
- 杨某诋毁袁隆平科研成果被刑拘（头条9/B站10/抖音10）
- 网警提醒4类"高考查分陷阱"（头条6/百度8/抖音6）
- 世界杯巴西vs日本（头条8/百度7/B站/抖音）
- 宜宾地震（头条10/抖音15）

### 2026-08-28 23:47（五榜，微博打通）
五榜全 200（微博 PC 端 `weibo.com/ajax/side/hotSearch` 首次跑通），抖音 `active_time=2026-08-28 23:47:15`。微博返 51 条带沸/热/新标签，跨榜重叠（重叠 = 真热）：
- 尼泊尔山洪579死1924失联（头条1/百度2/微博1）
- 西藏吉隆泥石流（四榜+微博 央媒部署）
- "青铜峡拦河大坝泄洪"不实（头条/百度/抖音/微博）
- 个人住房贷款期限延长至40年（百度13/微博「房贷」）
- 教师与耻辱合影（头条/百度/微博）

---

## 已知坑

1. **vvhan / oioweb / qqsuu / tenapi 等第三方聚合 API 2026-06 全挂**（http 000 或「接口不存在」或 502）。别再试，直接用五个官方接口。
2. **百度 PC 端 `top.baidu.com/board?tab=realtime` 是 JS 渲染**，curl 下来的 HTML 没热词。必须用 `platform=wise` 的 JSON API。
3. **微博 m 端 `m.weibo.cn/api/container/getIndex` 返 Sina Visitor System**（302→访客系统），要 JS 跑 mini_original.js 生成 visitor cookie。**别用 m 端**——改用 PC 端 `weibo.com/ajax/side/hotSearch`（免登录 200），2026-08-28 实测打通。
4. **tophub.today 聚合站 WebFetch 被域名安全策略拒**（"Unable to verify if domain is safe"），curl 能下 HTML 但内容是 JS 异步加载、初始 HTML 无热词。两个渠道都拿不到，别用。
5. **沙箱网络**：本环境 Bash 默认能出网（curl 官方接口 OK），无需 `dangerouslyDisableSandbox`。
6. **接口字段会变**：解析前先 `python3 -c "import json;d=json.load(open('/tmp/xx.json'));print(list(d.keys()));print(json.dumps(d,ensure_ascii=False)[:800])"` 看一眼结构，别盲跑正则。
7. **微博需带 PC 端 UA + Referer `https://weibo.com/`**，裸 curl 无 Referer 偶发 302；知乎官方 API 始终 401（要登录 token），无匿名突破口，不用死磕。

---

## 不要做

- 不做定时轮询（用户要时抓一次即可，热榜刷新很快）
- 不存库（/tmp 临时文件用完即弃）
- 不抓知乎死磕（官方 API 401 要登录 token，无匿名突破口；四平台+微博够覆盖）
- 不写 .js 脚本固化（python heredoc 复制粘贴够用，避免过度工程；真要复用再说）
