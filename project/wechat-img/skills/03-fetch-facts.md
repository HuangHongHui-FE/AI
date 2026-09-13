# 抓正文取事实 Skill

> 项目根目录：`/Users/zcy1/code_self/AI/project/wechat-img`
> 调用方式：主流程 `[[00-hotspot-publish]]` / `[[00-wechat-daily]]` 选点/定题后，本 skill 负责 curl 抓新闻源正文、摘出可查证事实作写作素材
> **根治「低信息量」的必做步骤**——选点后不能只靠榜单标题脑补「我」的感受。

---

## 执行原则

选点后不能只靠榜单标题脑补「我」的感受，须 curl 抓 2-3 条新闻源正文，摘出**人名 / 数字 / 时间 / 地点 / 当事人原话**作为写作素材。多源兜底链按顺序试。

---

## 多源兜底链（2026-08-29 更新：头条搜索命中率最高，加为首位）

> 实测（2026-08-29 房贷635元案例）：搜狗/必应只抓到零散句，**头条搜索一次抓到完整政策细节**（央行两部门发文/40年上限/月供635元）。优先头条，搜狗次之，必应兜底。

```bash
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit/605.1.4 Mobile/15E148 Safari/604.1"
enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "关键词")
# ① 头条搜索（优先，2026-08-29 实测对国内热点命中率最高）——返回 HTML，python 提取含关键词的句子作事实
curl -sL -m 15 -A "$UA" "https://so.toutiao.com/search?dvpf=pc&keyword=$enc" -o /tmp/tt.html
# ② 搜狗新闻（对国内新闻收录好）
curl -sL -m 15 -A "$UA" "https://news.sogou.com/news?query=$enc&mode=sort" -o /tmp/sg.html
# ③ 必应搜索（搜狗没命中再试，对有具体新闻源URL的大事件命中尚可）
curl -sL -m 15 -A "$UA" "https://cn.bing.com/search?q=$enc" -o /tmp/bing.html
# ④ 百度 m 站（最后兜底，常返验证码 302，能通则用）
curl -sL -m 15 -A "$UA" -H "Referer: https://m.baidu.com/" "https://m.baidu.com/s?word=$enc" -o /tmp/bd.html
# 提取：python 正则按句切分，筛含关键词的句子，看有没有人名/数字/时间/原话
```

> 头条搜索对「当日新政/突发新闻/民生话题」命中率最高（SSR 页面直接含新闻标题+摘要）；必应对「人物逝世/重大赛事/具体事件」收录尚可，对「物业开掉业主/月租酒店/Zara隐患」这类中国民生小新闻几乎不收录。四源都不命中的，按 C 段③事实不足弃写换题，不硬凑。

---

## 硬性标准

每篇 ≥ 3 条可查证事实（具体人名/数字/时间/地点/引语），少于 3 条不合格、补足再发。例：写「纯国产卡训出万亿模型」须答出哪家公司、卡型号、模型名、参数量、耗时、对标国外哪档——答不出说明事实没抓够，别发。

---

## 不要做

- 不靠榜单标题脑补事实
- 事实不足 3 条不硬凑，弃写换题
- 不写「没法证实」「据传」「疑似」「据说」带出的存疑细节（自标存疑的细节一律删或改成可查证公开事实，详见 [[05-generate-publish]] C 段③）
