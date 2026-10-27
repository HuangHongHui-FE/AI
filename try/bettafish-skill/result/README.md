# result 目录说明

所有由 BettaFish-skill 生成的报告统一放在这里。

## 目录结构

```
result/
└── <YYYY-MM-DD_HHMM>_<事件标识>/
    ├── report.html    # 主报告（编辑杂志风，可离线打开）
    ├── report.pdf     # PDF 版（如已导出）
    ├── report.md      # Markdown 文本版
    ├── graph.json     # 知识图谱数据
    └── summary.json   # 模板选择、平台统计、运行摘要
```

- 文件夹按**生成日期 + 时间**命名，天然按时间排序。
- 同一分钟重复运行会自动追加秒级后缀，避免覆盖。
- 每个事件一个独立目录，互不影响。

## 当前记录

| 目录 | 事件 | 报告 |
|---|---|---|
| `2026-10-27_2258_iphone17` | iPhone 17 国内口碑 | `report.html` |
| `2026-10-27_2304_mbappe` | 姆巴佩涉华言论事件 | `report.html` / `report.pdf` / `report.md` |

## 重新生成

```bash
# iPhone 17 demo
python3 demo/run_demo.py
python3 demo/build_report.py

# 姆巴佩事件
python3 demo/mbappe/run_mbappe.py
python3 demo/mbappe/build_report.py

# 也可以指定某次运行的目录
python3 demo/mbappe/build_report.py result/2026-10-27_2304_mbappe
```

脚本会自动创建新的时间戳目录，并更新对应 demo 下的 `latest_run.txt`。
