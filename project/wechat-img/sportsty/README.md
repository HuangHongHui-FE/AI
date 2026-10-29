# sportsty · 赛事分析稿生产线

仿「雨神战术板」那种球赛前瞻稿：5 段正文 + 1 张实拍配图 + 固定结尾块（三行竞彩 + 公众号名片），推到公众号草稿箱。

## 目录

```
sportsty/
├─ CLAUDE.md              写作与发布的完整规则（Claude 进这个目录会自动读）
├─ publish.mjs            裁封面 → 上传内图 → 推/更新草稿
├─ template/
│  ├─ cta.html            结尾固定块（逐字照抄，含名片）
│  └─ article.example.json  article.json 骨架
└─ output/                自己生成的稿子（已 gitignore）
```

## 第一次在新电脑上跑

```bash
git clone <repo> && cd <repo>
npm install                      # 依赖装在仓库根，sportsty 复用 src/ 里的微信模块
cp .env.example .env             # 填 WECHAT_APPID / WECHAT_APPSECRET（.env 不入库）
```

`.env` 里的公众号必须是草稿要落到的那个号，并且该号的 IP 白名单已放行本机公网 IP（微信后台 → 设置与开发 → 基本配置）。

## 写稿

```bash
cd sportsty
# 在这里对 Claude 说：「照上次的格式写两篇，推草稿」
```

Claude 会按 `CLAUDE.md` 的流程抓赛程、抓事实、选图、写 `output/YYYY-MM-DD/NN-队名/`，最后调 `publish.mjs`。

## 只发布（稿子已经写好）

```bash
cd sportsty
node publish.mjs output/2026-10-31/01-切尔西VS曼联 --dry-run   # 先看本地预览 article.html
node publish.mjs output/2026-10-31/01-切尔西VS曼联             # 推草稿
node publish.mjs output/2026-10-31/01-xxx output/2026-10-31/02-yyy
```

重复跑不会多出草稿：`meta.json` 里有 media_id 就原地更新。

## 依赖

- Node ≥ 18（仓库根 `npm install` 一次即可）
- `sharp`：裁封面、处理图片
- `../src/find_img.cjs`：找图（必应/新闻源）
- `../src/wechat.js`：取 token、传图、建/改草稿

## 注意

- 封面比例固定 900×383，用内文那张图裁，不额外加字。
- 名片是真的 `<mp-common-profile>` 标签，本机浏览器预览里看不到是正常的，进公众号编辑器才渲染。
- 稿子里的事实只取当天能查到的来源，日期标清楚；查不到的宁可不写。
