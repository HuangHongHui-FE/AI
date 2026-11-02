# 留痕格式说明

每次执行在 `runs/<recipe>/<YYYYMMDD-HHMMSS>/` 下留一份完整记录。
`runs/` 不入库（图片体积大），但本文件定义的格式必须稳定，保证换机器后可复盘。

## 目录结构

```text
runs/<recipe>/20261029-201500/
├── manifest.json              # 全链路状态
├── 00-input/
│   ├── request.json           # 用户原始指令
│   └── chosen-topic.json      # 用户选定的热点（如有）
├── 01-hotlist/
│   ├── input.json             # 这一步的入参
│   ├── hotlist.json           # 产出
│   └── stderr.log
├── 02-find-image/
│   ├── input.json
│   ├── manifest.json          # 每张图的来源与尺寸
│   ├── images/001.jpg …
│   ├── user-decision.json     # 用户筛图结果
│   └── user-screened/
└── 08-wechat-draft/
    ├── input.json
    └── result.json            # media_id 等
```

## 规则

| 规则 | 说明 |
|---|---|
| 目录名 `NN-<atom>` | 前缀即执行顺序，一眼看出走到哪步 |
| 输入输出同框 | 每步目录内同时有 `input.json` 和产出，便于复盘 |
| 失败即停 | 失败那步落 `error.json`，后续步骤不创建 |
| 停手点记录 | `stopForUser` 的步骤额外落 `user-decision.json` |
| 永不覆盖 | 同一秒重复启动追加 `-b`/`-c` 后缀 |

## manifest.json 字段

| 字段 | 说明 |
|---|---|
| `run_id` | `<recipe>/<stamp>` |
| `recipe` / `version` | 配方名与版本 |
| `started_at` / `finished_at` | 本地时区 ISO（带 +08:00） |
| `status` | `running` / `success` / `failed` |
| `trigger` | 触发方式、用户原始指令、cwd |
| `env` | node 版本、平台、git 版本 |
| `steps[]` | 每步：`seq` / `atom` / `version` / 起止时间 / `exit_code` / `args` / `outputs` / `stopped_for_user` / `user_decision` |

## 示例

```json
{
  "run_id": "wechat-hotspot/20261029-201500",
  "recipe": "wechat-hotspot",
  "status": "success",
  "started_at": "2026-10-29T20:15:00+08:00",
  "finished_at": "2026-10-29T20:41:12+08:00",
  "steps": [
    {
      "seq": 2,
      "atom": "find-image",
      "exit_code": 0,
      "args": { "subject": "徽剑", "event": "反诈博主遇害", "target": 20 },
      "outputs": ["images/001.jpg"],
      "stopped_for_user": true,
      "user_decision": { "at": "2026-10-29T20:22:10+08:00", "kept": 8, "removed": 12 }
    }
  ]
}
```
