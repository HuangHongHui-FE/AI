# Reverse-Engineering Results

每次逆向一个软件，在本目录下新建一个独立目标目录：

```text
result/
└── <software-slug>/
    ├── README.md          # 目标说明 / 用法
    ├── NOTES.md           # 逆向过程、包哈希、方法、未知项
    ├── DATA_SOURCES.md    # 页面 → 接口 → 上游来源（按目标需要）
    ├── .gitignore         # 排除 token/私钥/第三方代码/二进制
    ├── artifacts/         # 原始包、解密包
    ├── src/               # 解包后的代码
    ├── evidence/          # 截图、日志、抓包证据
    ├── scripts/           # 可复用的分析/调用脚本（也可放根目录）
    └── snapshot/          # 接口返回值、CSV、Markdown 快照
```

规则：

- 一个软件一个目录，目录名用稳定的小写 slug（例如 `meiji-star`）。
- 所有与该软件相关的逆向产物都放在对应目录里，不散落在 `~/` 或 `/tmp`。
- `token.txt`、`*.key`、`capture.jsonl`、第三方二进制/解包代码必须被局部 `.gitignore` 排除。
- 目标目录的 `README.md` 记录软件名、AppID/版本、入口和用法；`NOTES.md` 记录方法、哈希和未知项。
- 后续新增目标时，在本文件底部更新索引。

## Targets

| 目录 | 软件 | AppID | 说明 |
|---|---|---|---|
| `meiji-star/` | 美基星图 | `wx740b0c9e327a98b1` | 微信小程序；后端 `www.enlee.cloud`；15 个数据接口已调通 |
