# company

公司介绍公众号自动发文管线。给一个公司名，抓事实、找图、生成介绍文、推到公众号草稿箱。

## 方向

只写公司介绍（兴衰史 / 商业模式拆解 / 创始人故事 / 行业地位），不写任何明星/网红/名人。调性：档案/百科 + 商业分析。复用 wechat-img 老号「方盖」。

## 准备

`.env` 已软链到 `../wechat-img/.env`（复用老号配置）。如需独立配置，删软链后复制 `.env.example` → `.env` 填值。

```bash
npm install
```

## 使用

```bash
# 会话里先让 Claude 按 skills/intro-publish.md 生成 output/<公司名>/article.json
node src/index.js --subject "比亚迪" --image ./output/比亚迪/cover-src.jpg --out-dir ./output/比亚迪 --dry-run
node src/index.js --subject "比亚迪" --image ./output/比亚迪/cover-src.jpg --out-dir ./output/比亚迪
```

参数：

- `--subject "<公司名>"`：公司名（信息性，正文来自 article.json）
- `--image <path>`：封面底图路径（可选，无图时封面走纯文字布局 `pure-color-no-image`）
- `--from-json <path>`：文章 JSON 路径（默认 `<out-dir>/article.json`）
- `--out-dir <path>`：输出目录（默认 `output/`）
- `--dry-run`：只生成封面 + HTML 预览，不调微信 API
- `--author "<name>"`：覆盖 .env 里的署名
- `--no-embed-image`：不在正文头嵌图

执行完后：

- `output/<公司名>/cover.jpg`：封面
- `output/<公司名>/article.html`：浏览器预览
- `output/<公司名>/article.json`：结构化内容
- 终端打印 `draft media_id`，登录 `mp.weixin.qq.com` → 草稿箱 发布

## 流程

详见 `skills/intro-publish.md`：选对象 → curl 抓事实 → find_img 找图 → 生成 article.json → preflight 硬门 → 合成封面 → 推草稿 → 写日志（十三维避撞）。
