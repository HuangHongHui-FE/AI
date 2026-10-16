# 06 出物料

> **输入**：`05-自查` 通过的 `output/YYYY-MM-DD/NN-名场面/article.json`
> **产出**：同目录下 `发布物料.md` + `copy.html` + `cover.jpg` + `article.html`，以及当天的 `output/YYYY-MM-DD/发布清单.md`
> **终点**：**到这里为止，Claude 不推送任何东西**。公众号 / 视频号 / 抖音 / 快手由人手动发

---

## 这一步做什么

把自查过的稿子准备成「打开就能复制粘贴」的样子：

| 产物 | 给谁用 | 怎么用 |
|---|---|---|
| `copy.html` | **公众号正文** | 浏览器打开 → `Cmd+A` → `Cmd+C` → 粘进公众号编辑器 |
| `cover.jpg` | 公众号封面 | 上传为封面图 |
| `article.html` | 预览 | 整页效果，看一眼就行 |
| `发布物料.md` | **人** | 逐块复制的清单：标题 / 摘要 / 正文 / 视频成品路径 / 短视频文案 |
| `发布清单.md`（当天汇总）| 人 | 那天所有稿子的索引 + 发布前自查清单 |

**不重复造排版**：命令、主题、封面合成、preflight 硬门全部复用同级的 wechat-img 项目（`--dry-run` 模式，不调微信 API）。

## 命令

```bash
python3 skill/06-出物料/出物料.py --date 2026-10-09     # 出某一天
python3 skill/06-出物料/出物料.py --all                 # 出所有还没出物料的稿子
python3 skill/06-出物料/出物料.py output/2026-10-09/01-我靠袁华
python3 skill/06-出物料/出物料.py --date 2026-10-09 --force   # 已有物料也重出
```

默认**增量**：`cover.jpg` / `article.html` / `copy.html` / `发布物料.md` 都齐、且都不比 `article.json` 旧，就跳过。

> `--all` 会把**没有 `gif` 字段的老稿**（2026-07-11、2026-10-07 那两篇）报成失败并在末尾列出 —— 这是对的，
> 不是 bug。它们早就发布过了，真要给它们出物料，补上 `gif` 字段即可。

## 底下实际跑的是这条（脚本替你跑）

必须在 **wechat-img 目录**下执行，路径传绝对路径：

```bash
cd ../wechat-img
node src/index.js \
  --image "/绝对路径/mingchangmian/input/clips/<名>-头图.gif" \
  --from-json "/绝对路径/mingchangmian/output/YYYY-MM-DD/NN-名场面/article.json" \
  --out-dir "/绝对路径/mingchangmian/output/YYYY-MM-DD/NN-名场面/" \
  --dry-run
```

### 两个必须知道的点

1. **cwd 必须是 wechat-img**：`index.js` 里 `const pfPath = resolve("src/preflight.js")` 是**按 cwd 解析**的，从本仓库根目录跑会报 `✗ 找不到 preflight 脚本`。脚本里用 `subprocess.run(..., cwd=WECHAT_IMG)` 处理掉了。
2. **`--dry-run` 不需要 `.env`**：`wechat-img/src/config.js` 只在真正调 API 时才 `requireWechat()`，`--dry-run` 全程不碰 appid/secret。所以现在**不需要配置微信凭据**也能出物料。

## 出物料 = 过一次硬门

`--dry-run` 内部**强制跑** `wechat-img/src/preflight.js`，FAIL 就 `exit 1`、什么都生成不了（`article.html` 都不会写）。所以：

- **能出物料 = 这份稿子过过硬门**，复制出去的不是没扫过的稿
- 没过就**回炉改稿**（见 `05-自查`），不是改门
- 脚本遇到 FAIL 会停在那篇、打印原因、继续跑后面的，最后汇总失败清单并以非 0 退出

## `copy.html` 为什么长这样

- 内容 = **剥离了页面外壳的正文**，和推送时发给微信的完全一致（`index.js` 推的是 `bodyHtml`，不含预览页那个灰底容器）
- 样式**全是内联 style**（`wechat-img/src/html.js` 的 `markdownToHtml` 就是这么生成的），所以粘过去排版不丢
- 首图 GIF 以**内联 `data:` URI** 插在正文最前 —— 微信的粘贴处理器认得 `data:` URI，会自己把它转成正文图片，**不用手动插图**（这条 2026-10-09 由 `_已停用/B3-浏览器发草稿` 实测确认）
- 因此 `copy.html` 单个文件 ~5MB（base64 后的 GIF），**已加进 `.gitignore`**：它是本地可再生的，`--force` 随时重出

## 依赖

- **Node**（跑 wechat-img）+ 它自己的 `node_modules`（`sharp` 装不上时的绕法见 `_已停用/06-推草稿/README.md` 第 5 条）
- **同级项目 `../wechat-img` 必须存在**，脚本启动就检查

## 本步的坑 / 不要做

1. **别把 `copy.html` 提交进 git** —— 已在 `.gitignore` 里排除，别手动 `git add -f`
2. **`article.json` 必须有 `gif` 字段**（首图路径，相对仓库根）。缺了脚本直接报错跳过，**不做文件名模糊匹配**（`output/…/NN-xxx` 的 `NN` 是按天序号，和素材编号是两套编号，猜不准）
3. **正文里不能出现封面/首图的引用**：`index.js` 有硬拦截（首图由 `--image` 自动嵌，正文再引 = 开局撞脸）
4. **别改成 `--dry-run` 以外的模式** —— 真跑的 push 分支已经停用（见 `_已停用/`）
5. **已有 `cover.jpg` 不会被覆盖**（要重出加 `--force`）。封面是**首图 GIF 的第 1 帧**合成的，而第 1 帧常常不是最抓人的那一帧（`2026-10-08/01-吕子乔肾宝` 的封面就是人另外挑的一帧，比 GIF 第 1 帧好得多）。所以：**出完物料扫一眼封面**，不满意就自己截一张盖上去，脚本会认。
6. **主题（theme）只随机一次**：首次出物料时 `index.js` 抽一个主题并写回 `article.json`，之后重出都沿用。想换排版就手动改/删 `article.json` 里的 `theme`
