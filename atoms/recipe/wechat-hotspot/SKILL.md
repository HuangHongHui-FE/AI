# wechat-hotspot —— 公众号热点图文

用户说「写热点文章」「今天发」「来一波热点」时走这条流程。

## 步骤链

```
01-hotlist     抓五平台热榜          ← 用户从榜里选热点（停手点）
02-find-image  批量找图 ≥20 张       ← 用户删图筛到 2-3 张（停手点）
03-fetch-facts 抓新闻正文取可查证事实
04-write-article 写正文（多维轮换，不撞近 5 篇）
05-selfcheck   硬门自查（FAIL 则回炉）
06-format-html 转微信 HTML + theme
07-cover-image 生成 2.35:1 封面
08-wechat-draft 推草稿（--account 指定发哪个号）
```

## 两个停手点（不可跳过）

| 步骤 | 为什么必须停 |
|---|---|
| 01-hotlist 之后 | **选热点是用户的决定**，不由 Claude 代选 |
| 02-find-image 之后 | **筛图是用户的决定**，Claude 只负责下足候选 |

两次决定都会记进 `user-decision.json`。

## 运行

```bash
# 只跑到热榜
node recipe/wechat-hotspot/run.mjs --prompt "写一篇热点文章" --only hotlist

# 指定发哪个公众号
node recipe/wechat-hotspot/run.mjs --prompt "写一篇热点文章" --account mingchangmian

# 骨架自测，不真调 atom
node recipe/wechat-hotspot/run.mjs --dry
```

## 当前进度

| 原子 | 状态 |
|---|---|
| `hotlist` | ✅ 已实现、已回归 |
| `find-image` | ⬜ 待迁 |
| `fetch-facts` | ⬜ 待迁 |
| `write-article` | ⬜ 待迁 |
| `selfcheck` | ⬜ 待迁 |
| `format-html` | ⬜ 待迁 |
| `cover-image` | ⬜ 待迁 |
| `wechat-draft` | ⬜ 待迁 |

未实现的原子会被**明确跳过并记 `NOT_IMPLEMENTED`**，不会假装成功。

## 留痕

```text
runs/wechat-hotspot/20261029-205602/
├── manifest.json
├── 00-input/request.json
├── 01-hotlist/{input.json, hotlist.json}
└── ...后续步骤
```
