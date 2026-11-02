# recipe —— 可运行的「项目」

recipe 是**编排层**，不含业务实现。它只做四件事：

1. 按顺序调用 atom
2. 把上一步的产出传给下一步（参数模板）
3. 在指定步骤停下来等用户决定
4. 把每一步的输入输出留痕到 `runs/`

## 新增一个项目 = 新写一个目录

```text
recipe/<name>/
├── SKILL.md      # 人读：触发词、流程、停手点
├── recipe.json   # 机器可读：步骤链、参数模板、覆盖项
├── run.mjs       # 从 wechat-hotspot 复制，通常无需改
└── fixtures/     # 可选：编排回归
```

## recipe.json 结构

```json
{
  "name": "wechat-hotspot",
  "atoms": [
    { "id": "hotlist", "stopForUser": true },
    {
      "id": "find-image",
      "stopForUser": true,
      "args": { "subject": "{{user.subject}}", "event": "{{user.event}}", "target": 20 }
    },
    {
      "id": "selfcheck",
      "args": { "article": "{{step.write-article}}/article.json" }
    }
  ],
  "overrides": {
    "selfcheck": { "ruleset": "wechat-img" },
    "wechat-draft": { "account": "wechatimg" }
  }
}
```

| 字段 | 说明 |
|---|---|
| `atoms[].id` | 对应 `atom/<id>/` |
| `atoms[].args` | 传给该 atom 的参数，**支持模板变量** |
| `atoms[].stopForUser` | 该步做完后停下来等用户拍板 |
| `overrides` | 固定覆盖项（优先级高于 args） |

## 参数模板

| 变量 | 含义 |
|---|---|
| `{{runDir}}` | 本次 run 的根目录 |
| `{{step.<atom>}}` | 某步骤的目录（如 `{{step.fetch-facts}}`） |
| `{{user.<key>}}` | 命令行传入的任意 `--key value` |
| `{{env.NAME}}` | 环境变量 |

模板解析为空串时**不会传给 atom**（避免 `--article ""` 这类空参数），并在日志里提示「参数未提供」。

## 停手点机制

停手点在**该步执行完之后**触发（先产出热榜/候选图，用户才有东西可选）。

流程：

1. 跑到停手点 → 写出产出 → 写 `error.json`（`code: AWAITING_USER`）→ 退出 1
2. 用户/Claude 把决定写进该步目录的 `user-decision.json`
3. `--resume <时间戳>` 续跑 → 跳过已完成的步骤，从停手点继续

⚠️ **停手点之后必须用 `--resume`**，直接重跑会新建目录、丢掉用户决定。

## 运行

```bash
# 首次
node recipe/<name>/run.mjs --prompt "用户原始指令" --subject "主体" --event "事件"

# 停手点之后
node recipe/<name>/run.mjs --resume 20261030-094952 --query "关键词" --title "标题"

# 干跑（只验证留痕结构，不真调 atom）
node recipe/<name>/run.mjs --dry

# 只跑指定步骤
node recipe/<name>/run.mjs --only hotlist,find-image
```

## manifest 记录

- 续跑时同一步会**替换**旧记录（不追加），并累加 `attempt` 次数
- 失败步骤必定写 `error.json`（错误码 + 从 stderr 提取的错误信息）

## 现有配方

| 配方 | 用途 | 状态 |
|---|---|---|
| `demo-trace` | 骨架自测，不调真实 atom | ✅ 可跑 |
| `wechat-hotspot` | 公众号热点图文（8 步全链路） | ✅ 已跑通 |
| `wechat-tietu` | 公众号贴图（3 步） | ✅ 已建 |
| `toutiao-hotspot` | 今日头条热点（8 步） | ✅ 已建 |
| `event-thread` | 事件脉络梳理（7 步） | ✅ 已建 |
| `company-intro` | 公司拆解（6 步） | ✅ 已建 |
| `podcast` | 商业财经播客（5 步） | ✅ 已建 |
| `manga` | 漫画 | 待建 |
| `novel` | 番茄小说（2 步） | ✅ 已建 |

新建配方的原子都已就位，缺的只是 `recipe.json` + `SKILL.md`——这正是「新增一个项目 = 新写一份配置，不写代码」的验证。
