# 美基星图 · 逆向记录

- 目标：微信小程序「美基星图」
- AppID：`wx740b0c9e327a98b1`
- 小包版本：`11`
- 分析日期：2026-10-27
- 后端：`https://www.enlee.cloud`（内部名 Finlens）
- 客户端标识：`clientSource=starM`、`clientVersion=1.1.0`

## 文件

| 路径 | 内容 |
|---|---|
| `src/wxapp/` | 解密、解包后的完整小程序代码（28 个文件；第三方代码，已 gitignore） |
| `artifacts/__APP__.wxapkg` | 微信缓存里的原始加密包（已 gitignore） |
| `artifacts/__APP__.dec.wxapkg` | 解密后的标准 wxapkg（已 gitignore） |
| `evidence/original-screenshot.png` | 用户提供的原始界面截图 |
| `evidence/miniprogram-log1.txt` | 小程序运行时日志（`wx.request` 调用记录） |
| `meiji_api.py` | 本地 API 客户端：headers、gzip、`X-Finlens-Enc` 解密、全部数据接口 |
| `refresh_token.py` | 抓取/续期 token 的脚本 |
| `proxy.py` | 只拦截 `www.enlee.cloud` 的本地 CONNECT 代理 |
| `token.txt` | 当前 token（0600，gitignored，约 50 分钟过期） |
| `snapshot/` | 所有接口的 JSON/CSV/Markdown 快照 |
| `DATA_SOURCES.md` | 页面 → 接口 → 上游来源 |
| `README.md` | 使用说明、续 token、故障排查 |

## 包哈希

```text
07ad6277a043f04f0a30bb9d9c8ef0a4f4ae9f094f1a486870f85e05c53ea555  __APP__.wxapkg
f88d41a42ca99c0b04d36ff316e0173516bd14b101e1932a2853b526b8d569c4  __APP__.dec.wxapkg
```

## 获取过程

1. 官网产品页 `https://www.enwali.com/products/meiji-star/` 里有 deep link：
   `weixin://dl/business/?appid=wx740b0c9e327a98b1&path=pages/index/index&env_version=release`
2. 在 Mac 微信打开该 deep link，包落到：
   `~/Library/Containers/com.tencent.xinWeChat/Data/Documents/app_data/radium/users/<hash>/applet/packages/wx740b0c9e327a98b1/11/__APP__.wxapkg`
3. 包是 `V1MMWX` 加密格式：
   - key = `PBKDF2-HMAC-SHA1(appid, "saltiest", 1000, 32)`
   - 前 1024 字节：AES-256-CBC，IV = `the iv: 16 bytes`
   - 1024 字节之后：XOR，key = `ord(appid[-2])`
   - 解密结果以 `0xBE` 开头
4. 按 wxapkg 索引表解包：`0xBE` + info1 + indexLen + bodyLen + `0xED` + 文件表。
5. 代码中 `API_BASE = 'https://www.enlee.cloud'`；GET 自动带 `clientSource` / `clientVersion`。
6. 登录：`POST /api/v3/star/auth/login`，body 是 `wx.login` 的 code；后端用 appid+AppSecret
   换 openid，签发 `{token, userId}`。token 载荷是 base64 JSON：`{"uid":"sw_...","exp":...}`。
7. token 抓取：`refresh_token.py` 临时起本地 MITM（只拦截 `www.enlee.cloud`）、临时信任 CA、
   把 macOS HTTPS 代理指向 8080，抓到小程序自己发出的 `Authorization: Bearer ...` 后恢复现场。
8. 响应加密：`X-Finlens-Enc: 1` 时 body 为 `{"d":"<base64>"}`；用
   `HMAC-SHA256(secret, nonce + u32be(block))` 生成 keystream 与密文 XOR。
   客户端里的 secret：`finlens-change-me-and-rotate-often160`（占位值，可能被换）。

## 数据来源结论

见 [DATA_SOURCES.md](DATA_SOURCES.md)。摘要：

- 明确 `source`：
  - `tencent`：布伦特原油 `hf_OIL`、伦敦金 `hf_XAU`、伦敦银 `hf_XAG`
  - `eastmoney`：美元指数 `UDI`、上金所 `AU9999/AUTD/MAUTD/AU100`、`XAUUSD/GC00Y`
  - `us_quote`：VIX `.VIX`、TLT；内部美股适配器，具体供应商未暴露
- 无 `source`：26 个美股板块、26 个 A股板块、韩国/日本板块、热力图、纳指/标普。
  客户端只收到 `code/value`，没有成分股、权重、加权方式。
- 品牌金价：AU9999 基准 + 品牌溢价，每日 `12:00Z` 批量，非品牌官方实时价。

## 已知未知

1. `us_quote` 具体对接哪家（东财美股 / Yahoo / Polygon / 其他）。
2. 各板块成分股、权重、加权方式；后端未下发。
3. 纳指/标普（`/star/indices`）的上游；响应无 `source`。
4. 品牌参考价的采集方式；只能确定是“基准价 + 溢价”的每日参考价。

## 安全

- `token.txt`、`ca.key`、`srv.key`、`capture.jsonl` 已被 `.gitignore` 排除。
- token 绑定用户微信身份（`uid`），约 50 分钟过期；不要外传或提交。
- `src/wxapp/` 和 `artifacts/*.wxapkg` 是第三方代码/二进制，已被 `.gitignore` 排除。
- 抓 token 的脚本只在用户主动运行时短暂修改 HTTPS 代理和信任临时 CA，并在 `finally` 恢复。
