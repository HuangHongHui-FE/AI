# event-thread 事件脉络梳理

把一件事从**起因到最新进展**按时间顺序理清，细节密、时间准，产出可直接发公众号的成稿。

## 核心约束：先有事实，后有文章

每个时间节点**必须在事实卡里自带来源**，无来源的内容进不了发布流程。正文由事实卡**确定性渲染**，不是 LLM 二次生成——**发布内容 = 已核查内容**，中间没有改写环节可以引入错误。

来源**只写进事实卡供核查，不展示在正文里**（用户 2026-09-30 定）——校验照旧严格，只是不给读者看。

## 用法

```bash
# 核查（会拦模糊日期、无来源、未来日期、时间线乱序）
node src/preflight.js facts/<slug>.json
node src/preflight.js facts/<slug>.json --render   # 核查 + 出 HTML 预览
node src/preflight.js --list                       # 所有事实卡状态

# 发布（分篇优先读事实卡里的 parts，按叙事边界切）
node src/index.js --facts facts/<slug>.json --image <封面图>              # 单篇
node src/index.js --facts facts/<slug>.json --image <封面图> --parts 3    # 不写 parts 时按节点数均分
node src/index.js --facts facts/<slug>.json --image <封面图> --dry-run    # 只看不推
```

## 两种触发（见 skills/00-总览.md）

- **指定事件** —— 「帮我梳理XX事件」→ `skills/01-选题.md` 分支 A
- **找选题** —— 问「有什么值得梳理的事件」，扫社会民生/科技产业/财经政策/文娱四方向，列候选，**停下等你选**

流程：`01 选题` → `02 查证` → `03 事实卡` → `04 配图` → `05 发布`

**改代码后记得同步更新对应 skill 文件**，否则下次照旧文档执行会走不回新规矩。

## 目录

```
skills/    Skill 流程（00 总览 → 05 发布，按步骤独立维护）
facts/     事实卡（核心数据，一个事件一张）
src/       脚本
result/    生成的文章存档（按日期归档，长期保留）
input/     配图（一个事件一个文件夹，图平铺）
logs/      发文日志
```

## 复用

`src/wechat.js`、`cover.js`、`html.js`、`find_img.cjs` 从 wechat-img 零改动拷来。
`html.js` 的 `:::time` 时间线语法 / `:::stat` 数据卡 / `:::quote` 引语 / callout 正是细节密度所需。

**两个必知的坑**：
1. 扩展语法正则非贪婪，各块**不能嵌套**（`:::time` 内不许再有 `:::`）
2. 扩展语法在 `marked.parse()` **之前**处理，所以 `:::time` 块**内不能放图片**（不会被解析成 `<img>`）——图片放 `node.images` 字段，渲染在块外
3. `find_img.cjs --history` 才抓得到往年旧图（默认有 3 个月新鲜度过滤，追热点用）
