---
name: comic-draw
description: 程序化条漫生成。读 panels JSON（每格的背景/场景/角色/道具/对话气泡），用 SVG 渲染成 720 宽的单格图与长条漫。老周家系列内置 5 个角色。
---

# comic-draw —— 条漫绘制

**给什么**：panels JSON（`{ slug, panels: [...] }`）
**还什么**：`NN.jpg` 单格图 + `strip.jpg` 长条漫

原实现是 `project/manga/src/draw.js`。此原子把输出目录参数化，其余绘制逻辑不动。

## 用法

```bash
node atom/comic-draw/src/index.mjs --from-json panels.json --out-dir runs/xxx/01-comic-draw

# 只要长条漫，不切单格
node atom/comic-draw/src/index.mjs --from-json p.json --out-dir out --no-panels

# 只要单格，不出长条
node atom/comic-draw/src/index.mjs --from-json p.json --out-dir out --no-strip
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--from-json` | `article.json` | panels JSON 路径 |
| `--out-dir` | `comics/<slug>` | 输出目录（旧行为兜底） |
| `--slug` | JSON 里的 slug | 文件名前缀 |
| `--no-strip` / `--no-panels` | 关 | 只要其中一种 |

## panels JSON 结构

```json
{
  "slug": "laozhoujia-e1",
  "panels": [{
    "bg1": "#FFF7E8", "bg2": "#FFE9C7",
    "scene": [{ "type": "sofa" }, { "type": "window" }],
    "actors": [{ "type": "zhoujianguo", "x": 360, "hipY": 900, "emo": "smile", "pose": "stand" }],
    "props": [{ "type": "heart" }],
    "bubbles": [{ "x": 200, "y": 300, "w": 240, "h": 100, "text": "今天吃啥" }],
    "label": "01·全家"
  }]
}
```

## 内置素材

| 类型 | 可用值 |
|---|---|
| **角色** `actors[].type` | `zhoujianguo` `linxiao` `zhouxiaoman` `zhouyeye` `wangayi` |
| **场景** `scene[].type` | `floor` `sofa` `window` `lamp` `plant` `bookshelf` `tv` `clock` `rug` `door` `table` `frame` |
| **道具** `props[].type` | `moon` `pie` `desk` `question` `heart` `bulb` `rain` `star` |

## 输出

```json
{ "ok": true, "slug": "laozhoujia-e1", "out_dir": "/abs/out", "panels": 5, "files": ["01.jpg", ..., "strip.jpg"] }
```

单格：`01.jpg`…`NN.jpg`（900px 宽，720×1280 画布等比放大）
长条漫：`strip.jpg`（所有格纵向拼接，间隔 30px）

## 注意

1. **角色是「老周家」固定 5 人**，写死在 `src/index.mjs` 的 `ACTORS` 里；要换系列得改源码
2. 画风是程序化 SVG（火柴人升级版），不是 AI 生图
3. 每格建议 1-2 人站 C 位，人多会显得小
