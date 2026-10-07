# 06 推草稿

> **输入**：`05-自查` 通过的 `output/YYYY-MM-DD/NN-名场面/` + `input/clips/<名>.gif`
> **产出**：微信草稿箱里的一篇草稿，返回 media_id（记进 `07-写日志`）
> **可扩展点**：换推送脚本、改封面 slogan、加发布前二次校验，都改本文件

---

## 这一步做什么

把自查过的成品推到微信公众号草稿箱。**不重复造推草稿脚本**，复用同级的 wechat-img 项目。

## 正确调用方式（⚠️ 和直觉相反）

**必须在 wechat-img 目录下执行**，图片和输出目录传**绝对路径**：

```bash
cd ../wechat-img
set -a && . /绝对路径/mingchangmian/.env && set +a
node src/index.js \
  --image "/绝对路径/mingchangmian/input/clips/<名>.gif" \
  --out-dir "/绝对路径/mingchangmian/output/YYYY-MM-DD/NN-名场面/"
```

### 为什么不能从本仓库根目录跑

`wechat-img/src/index.js` 里 preflight 是按 **cwd** 解析的：

```js
const pfPath = resolve("src/preflight.js");   // ← 相对 cwd，不是相对脚本
```

从 mingchangmian 根目录跑会报 `✗ 找不到 preflight 脚本：.../mingchangmian/src/preflight.js`。

### 那 `.env` 怎么办

`config.js` 用 `import 'dotenv/config'`，也是按 **cwd** 读 `.env`。所以 cwd 换到 wechat-img 后，dotenv 读的是 wechat-img 的 `.env`——**好在 wechat-img 根本没有 `.env`**，所以靠 `set -a && . mingchangmian/.env` 把凭据导出成真实环境变量即可（dotenv 不覆盖已存在的环境变量，名场面号凭据不会被串）。

> 如果你哪天给 wechat-img 也建了 `.env`，这条就会串味——届时改用 `--author` 显式传，或给 index.js 打补丁把 preflight 改成按脚本自身路径解析（`new URL('./preflight.js', import.meta.url)`），那才是根治。

## 先看效果再推

拿不准就先 `--dry-run`：只生成封面 + HTML 预览，**不调微信 API**，本地看满意再真推。

```bash
node src/index.js --image "..." --out-dir "..." --dry-run
```

`preflight` 硬门在两种模式下都会跑，不过就拒推。

## 多篇时

**串行**：for 循环逐篇跑、每篇间隔 2 秒。**绝不并行**——微信同 appid 并发 gettoken 会互踩 token，全报 40001。

---

## 账号对照表（推错号=稿子进别人草稿箱）

仓库里原本没有这份记录，靠 `.env` 里的 `AUTHOR_NAME` 猜是不可靠的——**署名只是署名，不是账号名**。实测各项目配置如下：

| appId | 署名 | 谁在用 | 草稿箱里是什么 |
|---|---|---|---|
| `wx23ba7fe304c76711` | 方盖 | event-thread、manga、**2026-10-07 起 mingchangmian** | 缅北电诈系列、公司拆解系列（华为/美团/小米/阿里/B站）|
| `wx33b77d76d688f256` | 名场面档案 | mingchangmian 原配置 | 历史名场面稿（2026-07-11 Cheems「我滴圣剑」）|

**怎么自己确认某个 appid 对应哪个号**（比看 `.env` 可靠）：

```bash
set -a && . ./.env && set +a
TOKEN=$(curl -s "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=$WECHAT_APPID&secret=$WECHAT_APPSECRET" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
curl -s -X POST "https://api.weixin.qq.com/cgi-bin/draft/batchget?access_token=$TOKEN" \
  -H "Content-Type: application/json" -d '{"offset":0,"count":10,"no_content":1}'
```

看草稿箱里躺着哪些稿子，就知道是哪个号。**推之前如果不确定，先跑这个。**

> ⚠️ **换 appid 必须连 secret 一起换**（两者成对）。同名项目 `../event-thread/.env`、`../manga/.env` 里有 `wx23ba7fe304c76711` 配对的 secret。

---

## 本步的坑 / 不要做

1. **`40164 invalid ip ... not in whitelist`**：不是代码问题，是账号的 IP 白名单没放行当前出口 IP。去 微信公众平台 → 设置与开发 → 基本配置 → IP白名单 加上报错里的那个 IP。**家庭宽带 IP 会变，换网/重启光猫后可能要重新加**。
2. **并发推草稿必崩**：≥2 篇并行必 `40001 invalid credential`。一律串行（for + sleep 2）。
3. **token 缓存不区分 appid → 会推错号** ⚠️：`wechat-img/src/wechat.js` 里 `readCache('token.json')` 用的是**固定文件名**，取到未过期的 token 就直接返回，**不校验这个 token 属于哪个 appid**。后果：先跑了别的号的推送，2 小时内（token 有效期 7200s）再跑名场面的推送，会复用**上一个号的 token**，把稿子推进上一个号的草稿箱。
   - 触发条件：换 appId 跑（如本仓库和 event-thread/manga 混着跑）
   - 规避：换号前删掉 `../wechat-img/cache/token.json`
   - 根治：把缓存键改成按 appid 分文件（`token-${config.wechat.appId}.json`）——**改动在 wechat-img 项目，尚未修**
4. **cwd 陷阱**：见上。从本仓库根目录跑一定失败。
5. **`sharp` 装不上（GitHub 不通时）**：wechat-img 依赖 `sharp@0.32`，它的原生库从 **GitHub releases** 下载；若环境访问不了 github.com，`npm install` 会在这一步超时。绕法：`npm install sharp@0.33.5 --no-save`（0.33+ 改从 npm registry 取预编译包，`--no-save` 不动 package.json）。
6. **`.env` 必须在仓库根目录**：里面是名场面号独立的 appid/secret，别和 wechat-img 混用。
7. 不改推草稿脚本代码（它是 wechat-img 项目的，共用）。
