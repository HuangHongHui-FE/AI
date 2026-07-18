# wechat-img

公众号贴图自动发文管线。给一张图 + 一个热点话题，生成共鸣向文章并写入公众号草稿箱。

## 准备

1. 复制 `.env.example` → `.env`，填入：
   - `WECHAT_APP_ID` / `WECHAT_APP_SECRET`：公众号后台「设置与开发 → 基本配置」获取（必须是认证的订阅号/服务号）
   - `ANTHROPIC_API_KEY`：从 https://console.anthropic.com 获取
   - `AUTHOR_NAME`：文章署名
2. `npm install`

## 使用

```bash
node src/index.js --image ./input/photo.jpg --topic "今天的热点话题"
```

参数：

- `--image <path>`：原图路径（必填）
- `--topic "<text>"`：热点话题（必填，也可改用 `--topic-file input/topic.txt` 从文件读）
- `--dry-run`：只生成文章和封面，不调微信 API，预览 `output/article.html` 和 `output/cover.jpg`
- `--author "<name>"`：覆盖 .env 里的署名

执行完后：

- `output/cover.jpg`：合成好的封面
- `output/article.html`：可在浏览器打开预览
- `output/article.json`：Claude 生成的结构化内容
- 终端会打印 `draft media_id`，登录公众号后台 → 草稿箱 即可看到草稿，点发布即可

## 每日运行

Windows 任务计划程序或手动跑都行。建议先 `--dry-run` 预览，确认无误再去掉 `--dry-run` 推到草稿箱。
