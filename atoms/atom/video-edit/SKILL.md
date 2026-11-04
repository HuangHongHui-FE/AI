---
name: video-edit
description: 计划驱动的视频剪辑。给源视频 + edit.json（分段/变速/倒放/定格/转场/分屏/画中画/字幕/调色/音效），输出成片 mp4。10 类剪辑手法参数化，适合按素材临时组剪辑方案。
---

# video-edit —— 计划驱动剪辑

**给什么**：源视频 + `edit.json` 剪辑计划
**还什么**：成片 mp4 + 实际用到的手法清单

与 `video-cut` 的区别：`video-cut` 是名场面固定四段模板；`video-edit` 不预设结构，按计划自由拼。

## 用法

```bash
# 校验计划（不渲染）
node atom/video-edit/src/index.mjs --plan edit.json --check

# 只看会执行的 ffmpeg 命令（不落盘）
node atom/video-edit/src/index.mjs --plan edit.json --out out.mp4 --dry-run

# 渲染（独立名场面场景；recipe 里换成 --out "{{step.video-edit}}/xxx.mp4"）
node atom/video-edit/src/index.mjs --plan edit.json --out "名场面/成品/033-剪辑版.mp4"

# 列出支持的手法（10 类，含不支持项与原因）
node atom/video-edit/src/index.mjs --techniques
```

| 参数 | 说明 |
|---|---|
| `--plan` | 必填，edit.json 路径 |
| `--out` | 成片路径；也可在计划里写 `out` |
| `--source` | 覆盖计划里的 source |
| `--check` | 只校验，输出归一化后的计划 |
| `--dry-run` | 输出每段/合成命令，不渲染 |
| `--techniques` | 输出手法能力表 |
| `--keep-work` | 保留临时分段，排错用 |
| `--work-dir` | 指定工作目录（会保留） |

相对路径按 **计划文件所在目录** 解析。

## 输出目录约定

本原子不自行决定输出目录，`--out` 必填（或计划里写 `out`）。按调用方约定：

| 场景 | 输出位置 |
|---|---|
| recipe 里 | `--out "{{step.video-edit}}/<名字>.mp4"`；步骤目录由 `_shared/run-dir.mjs` 生成为 `runs/<recipe>/<timestamp>/NN-video-edit/` |
| 独立跑名场面素材库 | `--out "<media-root>/成品/<源文件名>.mp4"`；多版本在同目录加后缀 |
| 其他独立场景 | 用调用方指定的目录，不默认当前目录、不默认仓库 |

中间分段、静帧、音效只写 `--work-dir` / 系统临时目录，不落成品目录。

## 计划格式

```json
{
  "source": "素材/033.mp4",
  "out": "成品/033-剪辑版.mp4",
  "font": "/System/Library/Fonts/PingFang.ttc",
  "output": {
    "width": 1280, "height": 720, "fps": 30,
    "fit": "pad", "codec": "h264", "crf": 18, "preset": "medium"
  },
  "grade": {
    "contrast": 1.06, "saturation": 1.12, "brightness": 0,
    "gamma": 1.0, "vignette": true, "grain": 3, "sharpen": 0.35,
    "lut": null
  },
  "overlays": {
    "watermark": "名场面", "watermarkPosition": "topRight",
    "progressBar": true,
    "banner": null, "bannerSize": null
  },
  "audio": {
    "loudnorm": -14, "truePeak": -1.2,
    "sfx": true, "sfxGain": 1, "fadeOut": 0
  },
  "segments": [
    {
      "name": "hook",
      "start": 12.85, "end": 13.35,
      "speed": 1, "reverse": false, "freeze": 0, "loop": 0,
      "zoom": 1.12, "kenBurns": null, "mirror": false, "rotate": 0,
      "fit": null, "cropBottom": 0,
      "text": [
        { "content": "全程高能", "size": 82, "position": "bottomRight",
          "color": "yellow", "border": 5, "box": true, "boxColor": "red@0.75" }
      ],
      "effects": { "glitch": false, "noise": 0, "blur": 0, "pixelize": null },
      "transition": { "type": "cut", "duration": 0.02 }
    }
  ]
}
```

### 段类型

| 类型 | 写法 | 用途 |
|---|---|---|
| 普通片段 | `start` + `end` | 裁剪、变速、倒放、定格尾 |
| 静帧 | `stillAt` + `duration` | 标题卡、定格卡 |
| 多宫格 | `grid: { cols, rows, cells: [{start,end}] }` | 分屏/四宫格；v1 cell 不支持变速 |
| 画中画 | `start/end` + `pip: { start, end, width, position }` | 主画面 + 小窗 |

### 关键字段

| 字段 | 作用 |
|---|---|
| `speed` | 0.25–4；视频 `setpts` + 音频 `atempo`，变速不变调 |
| `audioSpeed` | 只改音频速度，默认跟 `speed` |
| `reverse` | 倒放（视频+音频） |
| `freeze` | 段尾定格 N 秒，音频补静音 |
| `loop` | 整段重复 N 次（0–10） |
| `zoom` | 静态推近 1–3 |
| `kenBurns` | `[起,止]` 缓慢推拉 |
| `mirror` / `rotate` | 镜像 / 旋转 ±15° |
| `fit` | 覆盖全局 `output.fit`：`pad` / `crop` / `stretch` / `blurpad` |
| `cropBottom` | 裁掉底部比例（0–0.3），竖屏去烧录字幕用 |
| `text` | 字幕/花字；支持 `position` 预设、`fadeIn`、`typewriter` |
| `transition` | 进入本段的转场；`cut/fade/dissolve/fadeblack/fadewhite/wipe*/slide*/circleopen/pixelize/smooth*/zoomin/...` |
| `effects` | `glitch` / `noise` / `blur` / `pixelize:{from,to,size}` |
| `audioLead` / `audioLag` | 音频提前/延后 0–2 秒，做 J-cut / L-cut |
| `volume` / `fadeIn` / `fadeOut` | 段音量与音频淡入淡出 |

### 常用手法怎么拼

- **跳切**：同一源切多个 0.3–0.8s 短段，`transition.type=cut`，相邻段换 `zoom`。
- **坡度变速**：连续 3 段 `speed: 0.5 → 1 → 2`，用 `cut` 接。
- **倒放回环**：一段正放 + 一段同范围 `reverse`。
- **定格**：段尾 `freeze: 0.2`，或单独 `stillAt` 段。
- **四宫格**：`grid`，`cols/rows` 与 `cells` 数量必须相等；输出比例最好与源一致。
- **竖屏**：`output 1080x1920 + fit:"blurpad"`，必要时 `cropBottom:0.08` 去原字幕。
- **J-cut**：下一段 `audioLead: 0.3`，声音先入。
- **标题卡**：`stillAt` + `text.typewriter`。

## 输出

```json
{
  "ok": true,
  "out": "/abs/out.mp4",
  "duration": 41.2,
  "segments": 47,
  "techniques": ["trim", "segment", "speed", "reverse", "..."],
  "bytes": 12345678
}
```

`--dry-run` 额外返回 `commands`（每段 ffmpeg 参数 + 合成命令）和 `assembly`（合成 filtergraph）。

## 容量与限制（v1）

- 不做：跟踪、绿幕/智能抠像、rotoscope、内容识别擦除、防抖、透视校正、方向模糊、光效素材、粒子、漫画化、HSL/色轮/曲线、TTS（TTS 走 `tts-audio`）。
- 多宫格 cell 暂不支持变速；画中画小窗不支持独立变速/音量。
- 倒放段太长会吃内存，>20s 会给 warning。
- 输出分辨率明显大于源会 warning；不会“假 4K”。
- 音效是 Node 合成的 whoosh/boom/riser/glitch，不是素材库。

## 依赖

- `imageio-ffmpeg`（提供 ffmpeg；没有则回退 PATH / `FFMPEG_PATH`）
- 字体：自动找 PingFang / Noto Sans CJK / 微软雅黑等常见中文字体；找不到时用计划里的 `font` 或环境变量 `VIDEO_EDIT_FONT` 指定
- 滤镜：启动时检查 `xfade` / `drawtext` / `zoompan` / `pixelize` / `xstack` / `overlay` / `rgbashift` / `lut3d` / `vignette`，缺哪个会直接报出来
- H.265 需要 ffmpeg 带 `libx265`，没有会 exit 2

## 换机器

```bash
node atom/scripts/setup-check.mjs   # 看 Node / ffmpeg / imageio-ffmpeg
npm install                         # 新 workspace 已写进 package-lock
pip3 install imageio-ffmpeg         # 或确保 PATH 里有 ffmpeg
node atom/video-edit/fixtures/regression.mjs   # 21 项自检
```

中文文字渲染需要中文字体；没有 CJK 字体时 regression 会跳过文字/渲染部分并提示，不会误报。

## 回归

```bash
node atom/video-edit/fixtures/regression.mjs
```

覆盖：手法清单、非法计划 exit 2、`--check`、`--dry-run` 不落盘、真实渲染、分辨率/时长/音轨、grid/pip/reverse/freeze/sfx。