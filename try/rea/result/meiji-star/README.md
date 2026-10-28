# 美基星图 本地 API 客户端

把微信小程序「美基星图」（appid `wx740b0c9e327a98b1`）的后端接口在本地调通，
返回解密后的 JSON。数据源清单见 [DATA_SOURCES.md](DATA_SOURCES.md)。

> 这是对已发布客户端的本地分析结果，不是官方 API。接口、加密密钥、字段都可能随时变。
> 仅限个人研究使用，不要公开转发 token，也不要比小程序本身更频繁地轮询。

## 快速开始

```bash
# 在 rea 目录下；或直接 cd 到本目录
cd result/meiji-star

# 当前 token 是谁、什么时候过期
python3 meiji_api.py token

# 各页面数据
python3 meiji_api.py home                 # 美股「全球产业数据」26 个板块
python3 meiji_api.py asia                 # A股/韩国/日本
python3 meiji_api.py gold                 # 基准金价 + COMEX + 品牌参考价（按星图白名单过滤）
python3 meiji_api.py economy              # 顶部 6 个全球经济指标（带 source/symbol）
python3 meiji_api.py heatmap              # 热力图 26 个方块
python3 meiji_api.py heatmap previousTradingDay

# 全量快照：所有接口 + summary.json
python3 meiji_api.py snapshot
```

Python 里用：

```python
from meiji_api import MeijiClient

c = MeijiClient()                 # 读 token.txt，或环境变量 MEIJI_TOKEN
rows = c.home_rows()["rows"]      # [{code,name,icon,value,chg,trend}, ...]
print(rows[0])
print(c.economy()["indices"])     # 每个指标带 source / symbol
```

## token 过期了怎么办

token 大约 50 分钟过期，过期后 `meiji_api.py` 会报 `TOKEN_EXPIRED`。重新抓一次：

```bash
python3 refresh_token.py
```

它会：

1. 在本机 `127.0.0.1:8080` 起一个只拦截 `www.enlee.cloud` 的 HTTPS 代理；
2. 把临时 CA（`ca.crt`）加进 login keychain 并设为信任；
3. 把 macOS 的 **HTTPS 代理** 指到 8080（只改 secure web proxy，不改 HTTP 代理）；
4. 用 deep link 打开小程序，等它发出带 `Authorization` 的请求；
5. 把 token 写入 `token.txt`（0600）；
6. 在 `finally` 里恢复原来的代理、删除临时 CA、停掉代理。

要求：

- Mac 微信已登录，且「美基星图」能打开；抓取时让它在前台。
- 当前网络服务是 `Wi-Fi`；如果是 `Ethernet`，改 `refresh_token.py` 里的 `SERVICE`。
- 当前用户是 admin，login keychain 已解锁；正常情况下**不需要 sudo**。
- 如果中途失败，脚本仍会恢复代理和证书；可以再跑一次。

脚本只读取小程序自己发出的 token，不修改小程序、不修改微信数据、不上传任何东西。

## 接口与页面

| 页面 | 方法 | 接口 |
|---|---|---|
| 配置/文案/刷新周期 | `config()` | `GET /api/v3/star/config` |
| 美股板块静态定义 | `meta("home")` | `GET /api/v3/star/meta?page=home` |
| 美股板块行情 | `quotes("home", mode)` | `GET /api/v3/star/quotes?page=home&quoteMode=...` |
| 亚盘静态定义 | `meta("asia")` | `GET /api/v3/star/meta?page=asia` |
| 亚盘行情 | `quotes("asia", mode)` | `GET /api/v3/star/quotes?page=asia&quoteMode=...` |
| 顶部全球经济指标 | `economy()` | `GET /api/v3/star/economy` |
| 纳指/标普（老接口） | `indices()` | `GET /api/v3/star/indices` |
| 开盘/收盘/盘中状态 | `market_clock()` | `GET /api/v3/star/market-clock` |
| 热力图 | `heatmap(mode)` | `GET /api/v3/star/heatmap?quoteMode=...` |
| 黄金实时 | `gold_home()` | `GET /api/v3/gold/home` |
| 黄金品牌参考价 | `gold_brands()` | `GET /api/v3/gold/brands` |
| 黄金页面文案 | `gold_config()` | `GET /api/v3/gold/config` |
| 星图黄金 tab 过滤视图 | `gold_tab()` | 上面三个 + `config.gold` 白名单 |

`mode` 只有两个值：

- `realtime`：盘中实时；
- `previousTradingDay`：最近一次已完成收盘。

所有 GET 都会自动带 `clientSource=starM&clientVersion=1.1.0`、`xweb_xhr: 1`、微信 UA、Referer、
`X-Finlens-Client-Source/Version`、`X-Finlens-User-Id` 和 `Authorization`。

## 文件

| 文件 | 用途 |
|---|---|
| `NOTES.md` | 逆向过程、包哈希、方法、未知项、安全说明 |
| `meiji_api.py` | 客户端 + CLI；自动 gzip 解压、`X-Finlens-Enc` 解密、401 识别 |
| `refresh_token.py` | 重新抓 token；自动恢复代理/证书 |
| `proxy.py` | 只拦截 `www.enlee.cloud` 的本地 CONNECT 代理；其余流量转发给 Clash `127.0.0.1:7897` |
| `ca.crt` / `ca.key` | 本地临时 CA（仅用于抓自己的微信流量；`ca.key` 权限 600） |
| `srv.crt` / `srv.key` | `www.enlee.cloud` 的本地证书（同上） |
| `token.txt` | 当前登录 token（0600，gitignored） |
| `artifacts/` | 原始加密包 + 解密包（`.wxapkg`，已 gitignore） |
| `src/wxapp/` | 解包后的完整小程序代码（第三方代码，已 gitignore） |
| `evidence/` | 原始界面截图 + 小程序运行时日志 |
| `snapshot/` | 全量接口快照 + `summary.json` + `SUMMARY.md` + `home.csv` / `asia.csv` / `gold.csv` / `brands.csv` / `economy.csv` / `heatmap.csv` |
| `DATA_SOURCES.md` | 所有页面的数据来源、字段、口径和未知项 |
| `.gitignore` | 排除 token/私钥/第三方代码/二进制 |

## 故障排查

- **没抓到 token**：确认 Mac 微信已登录、「美基星图」在前台；再跑一次。脚本会用 deep link 打开首页，
  首页每 1 秒轮询一次，通常几秒内就能抓到。如果微信窗口被最小化/后台挂起，可能不轮询。
- **代理没恢复**：`networksetup -setsecurewebproxy Wi-Fi 127.0.0.1 7897`；
  如果原本没有代理：`networksetup -setsecurewebproxystate Wi-Fi off`。
- **临时证书残留**：`security delete-certificate -c "REA Local CA" ~/Library/Keychains/login.keychain-db`。
- **`security add-trusted-cert` 失败**：先在「钥匙串访问」里解锁 login keychain，再重跑。
- **Clash 端口不是 7897**：改 `proxy.py` 顶部的 `CLASH`。
- **接口返回 401 / TOKEN_EXPIRED**：token 过期，跑 `python3 refresh_token.py`。
- **换网络（Ethernet）**：改 `refresh_token.py` 里的 `SERVICE = "Wi-Fi"`。

## 已知限制

- token 绑定你的微信身份（`uid`），约 50 分钟过期；过期必须重新抓。换机器/换网络调用可能触发风控，
  建议就在抓 token 的这台机器上用。
- 后端可能随时换加密密钥、改字段或加风控；`CIPHER_SECRET` 在 `meiji_api.py` 顶部，可改。
- `us_quote` 的具体供应商、板块成分/权重、纳指/标普的上游都没有在客户端暴露。
- 品牌金价是“基准价 + 品牌溢价”的每日参考价，不是品牌官方实时价。
- 小程序本身在交易时段每秒轮询一次；脚本不要比它更频繁，避免给对方造成压力。
- 这个目录里有你的登录凭证和本地 CA 私钥；用完可以整个删除，或至少 `chmod 600` 并不要提交到 git。
