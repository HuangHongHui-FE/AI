# wechat-hotspot —— 公众号热点图文

用户说「写热点文章」「今天发」「来一波热点」时走这条流程。

## 步骤链

```
01-hotlist     抓五平台热榜          ← 用户从榜里选热点（停手点）
02-find-image  批量找图 40 张        ← 用户自己删到 3-6 张（停手点）
03-fetch-facts 抓新闻正文取可查证事实
04-write-article 写正文（多维轮换，不撞近 5 篇）
05-selfcheck   硬门自查（FAIL 则回炉）
06-ai-flavor   AI 味预检 + 改写指令（high/medium 回 04 改，不改流程不阻断）
07-format-html 转微信 HTML + theme
08-cover-image 生成 2.35:1 封面
09-wechat-draft 推草稿（--account 指定发哪个号）
```

## 两个停手点（不可跳过）

| 步骤 | 为什么必须停 |
|---|---|
| 01-hotlist 之后 | **选热点是用户的决定**，不由 Claude 代选 |
| 02-find-image 之后 | **筛图是用户的决定**，Claude 只负责下足候选 |

两次决定都会记进 `user-decision.json`。

### 筛图怎么做

`find-image` 默认下 40 张，**全部留在 `02-find-image/` 里，Claude 不预筛、不删图**。用户自己看完删到 3-6 张，再说一声。

用户删完后 Claude 才接手：

1. `ls 02-find-image/*.jpg` 看剩下哪些（含 `manifest.md` 里的标题，判断相关性）
2. 从剩下的图里定：1 张主图（封面）+ 1-2 张内文图
3. **把选中的封面复制成 `001-主图.jpg`**——recipe 的 `cover-image` 固定读这个文件名，用户如果把它删了，不补回来会断
4. 写 `02-find-image/user-decision.json`，记下剩下的图、选中的角色和理由
5. 继续 `03-fetch-facts`

图不够用（剩下的全是带水印/大字幕的营销图）**不要自己补下**——把情况告诉用户，等他决定要不要补。补图会覆盖同名文件，用户刚留下的图可能被冲掉。

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
| `hotlist` | ✅ |
| `find-image` | ✅ |
| `fetch-facts` | ✅ |
| `write-article` | ✅ |
| `selfcheck` | ✅ |
| `ai-flavor` | ✅ 13 条规则，改稿前先读 `atom/ai-flavor/references/zhuque-rules.md` |
| `format-html` | ✅ |
| `cover-image` | ✅ |
| `wechat-draft` | ✅ |

未实现的原子会被**明确跳过并记 `NOT_IMPLEMENTED`**，不会假装成功。

## 留痕

```text
runs/wechat-hotspot/20261029-205602/
├── manifest.json
├── 00-input/request.json
├── 01-hotlist/{input.json, hotlist.json}
└── ...后续步骤
```
