# 美基星图 · 数据来源清单

> 基于 2026-10-27 的 release 包（appid `wx740b0c9e327a98b1`，包版本 `11`）和一次真实登录会话。
> 所有结论按“观察到 / 推导 / 未知”区分。

## 0. 网络拓扑

```
微信小程序 (wx740b0c9e327a98b1)
        │  只有一条业务域名
        ▼
https://www.enlee.cloud   （后端内部名 Finlens）
        │
        ├── tencent    → 腾讯行情
        ├── eastmoney  → 东方财富
        └── us_quote   → 内部美股行情适配器（供应商未暴露）
```

- 运行时抓包只看到 `www.enlee.cloud:443` 和微信自身域名（`servicewechat.com`、`wxs.qq.com` 等）。
- 小程序**没有**直连新浪、腾讯、东财、富途、雪球、Yahoo 等行情域名。
- 客户端代码里 `API_BASE = 'https://www.enlee.cloud'`；登录后所有请求带 `Authorization: Bearer <token>`。

## 1. 响应里明确写了 `source` 的数据

`/api/v3/star/economy` 的每个指标都带 `source` 和 `symbol`：

| 指标 | 后端 symbol | `source` | 公开接口核对 |
|---|---|---|---|
| 布伦特原油 | `hf_OIL` | `tencent` | `https://qt.gtimg.cn/q=hf_OIL`，价格/涨跌幅与接口一致 |
| 伦敦现货金 | `hf_XAU` | `tencent` | `https://qt.gtimg.cn/q=hf_XAU` |
| 伦敦现货银 | `hf_XAG` | `tencent` | `https://qt.gtimg.cn/q=hf_XAG` |
| 美元指数 | `UDI` | `eastmoney` | `push2.eastmoney.com` 的 `secid=100.UDI` |
| 美债长债 ETF | `TLT` | `us_quote` | 内部适配器；东财/新浪的 TLT 报价同量级，但 source 未写具体供应商 |
| 恐慌指数 | `.VIX` | `us_quote` | 同上；腾讯的 VIX 报价停在 2026-09，可排除腾讯 |

`/api/v3/gold/home` 的每个金价 item 都带 `source`：

| 数据 | symbol | `source` | 备注 |
|---|---|---|---|
| 上金所 Au99.99 | `AU9999` | `eastmoney` | 黄金页基准大卡 |
| 上金所 Au(T+D) | `AUTD` | `eastmoney` | `sge` section |
| 上金所 mAu(T+D) | `MAUTD` | `eastmoney` | `sge` section |
| 上金所 Au100g | `AU100` | `eastmoney` | `usingPrevClose=true`，可能 `stale` |
| 伦敦金现 | `XAUUSD` | `eastmoney` | `fallbackFromSymbol=GC00Y`，现货源不可用时用纽约期金替代 |
| COMEX 黄金 | `GC00Y` | `eastmoney` | 星图黄金页只显示这一只（`config.gold.symbols`） |

汇率：`gold_home.fx` 是 `USDCNH`，用于把美元/盎司折算成元/克。

品牌参考价（`/api/v3/gold/brands`）：

- 基准：`AU9999`（`source=eastmoney`）。
- 品牌价 = 基准价 + 品牌加工费/溢价；响应里有 `premium` 字段。
- 所有品牌 `quotedAt` 都是同一天的 `12:00Z`，是**每天批量更新一次的参考价**，不是品牌官方实时挂牌价。
- 配置文案也明确写了“基于上海金 Au99.99 基准价 + 各品牌加工费估算 / 非品牌官方报价”。

## 2. 没有 `source` 字段的数据（客户端拿不到上游）

这些接口只下发 `code` / `name` / `value` / `chg` / `trend`，没有 source、成分股或权重：

| 数据 | 接口 | 数量 |
|---|---|---|
| 美股“全球产业数据” | `/api/v3/star/meta?page=home` + `/api/v3/star/quotes?page=home` | 26 个板块 |
| A股板块数据 | `/api/v3/star/meta?page=asia` + `/api/v3/star/quotes?page=asia` | 26 个 `cn-*` 板块 |
| 韩国综合 | 同上 | KOSPI、KOSDAQ |
| 韩国板块 | 同上 | 8 个 `kr-*` |
| 日本综合 | 同上 | N225、TOPIX |
| 日本板块 | 同上 | 8 个 `jp-*` |
| 热力图 | `/api/v3/star/heatmap` | 26 个板块方块 |
| 纳斯达克/标普500 | `/api/v3/star/indices` | 2 个（老版本接口） |

可以确定的是：

- 板块 `code` 是后端自定义的主题代码（`rare-earth`、`cpo`、`ai-compute`…），不是交易所指数代码。
- 列表接口**不下发**成分股、权重、加权方式；点进热力图也只是 26 个板块的方块，不是成分股。
- 热力图方块面积是前端算的：`weight = 0.6 + |涨跌幅|`（`chunk_2.appservice.js`），不是市值权重。
- 因此这些板块的“上游供应商 / 成分 / 加权方法”属于**未知**；只能确定它们由 `enlee.cloud` 后端计算/聚合后下发。

## 3. 页面 → 接口 → 数据

| 页面 / 元素 | 接口 | 字段/说明 |
|---|---|---|
| 顶栏 Logo、tab 文案、免责声明、刷新周期 | `/api/v3/star/config` | 站点配置；不含行情 |
| “行情口径 / 收盘 / 盘中 / 更新于” | `/api/v3/star/config` + `/api/v3/star/market-clock` | `previousClose`、`previousCloseDaylight`、`session`、`serverNow`；实时口径时间用 `serverNow` 校正 |
| 顶部“全球经济数据” 6 个指标 | `/api/v3/star/economy` | `name/value/chg/trend/source/symbol/lastUpdated` |
| 纳斯达克/标普500（老版） | `/api/v3/star/indices` | `label` 可能是“昨夜收盘” |
| “全球产业数据” 26 张卡片 | `/api/v3/star/meta?page=home` + `/api/v3/star/quotes?page=home` | meta 给名字/顺序/图标；quotes 给 `{c,v}` |
| 排序、N涨/N平/N跌 | 同一份 quotes | 前端本地计算 |
| 点卡片进热力图 | `/api/v3/star/heatmap` | 26 个方块；面积权重前端算 |
| 分享图 | meta + quotes | 前端 canvas 绘制，无新数据源 |
| 亚盘：A股/韩国/日本 | `/api/v3/star/meta?page=asia` + `/api/v3/star/quotes?page=asia` | `s` 为 46 条 `{c,v}`；`m` 为各市场休市/收盘状态 |
| 黄金：基准大卡 | `/api/v3/gold/home` | `benchmark`（AU9999，source=eastmoney） |
| 黄金：国际市场 | `/api/v3/gold/home` | 星图只显示 `international` section 里的 `GC00Y` |
| 黄金：品牌参考价 | `/api/v3/gold/brands` | 基准 AU9999 + 各品牌 premium；每日 12:00Z 批量 |
| 黄金：页面文案/刷新周期 | `/api/v3/gold/config` | `refreshTime=30`，历史金价范围等 |
| 我的 | `/api/v3/star/config` 的 `me` 字段 | 主题、版本、userId、公众号/群二维码、其他小程序入口；无行情 API |
| WebView 页 | 无 API | 只加载 `options.url`，用于公告/文章 |
| 登录 | `POST /api/v3/star/auth/login` | `wx.login` 的 code 换 token；服务端用 appid+AppSecret 调微信 |
| 埋点 | `POST /api/v3/metrics/report` | 非行情数据 |

## 4. 刷新口径

来自 `/api/v3/star/config`：

| 页面 | `refreshTime` |
|---|---|
| 美股首页 | 1 秒 |
| 亚盘 | 3 秒 |
| 黄金 | 30 秒 |
| 热力图 | 1 秒 |

- `quoteMode=realtime`：实时口径，页面每秒刷新“更新于”；
- `quoteMode=previousTradingDay`：收盘口径，用 `market-clock.previousClose`（最近一次已完成收盘）；
- 颜色：红涨绿跌（国内习惯）。

## 5. 响应加密

- 后端可能返回 `X-Finlens-Enc: 1`，body 为 `{"d": "<base64>"}`。
- 解密算法在 `utils/cipher.js`：`HMAC-SHA256(secret, nonce + u32be(block))` 生成 keystream，与密文 XOR。
- 客户端里的 secret 是 `finlens-change-me-and-rotate-often160`（占位值，后端随时可能换）。
- 本目录的 `meiji_api.py` 已实现同样的解密。

## 6. 明确未知

1. `us_quote` 具体对接哪家（东财美股 / Yahoo / Polygon / 其他）——响应只给内部代号。
2. 26 个美股板块、26 个 A股板块、韩国/日本板块的成分股、权重、加权方式——客户端完全拿不到。
3. 品牌参考价的上游采集方式——只能确定是“基准价 + 品牌溢价”的每日批量参考价，不是官方实时报价。
4. `indices`（纳指/标普）的上游——响应没有 source 字段。
