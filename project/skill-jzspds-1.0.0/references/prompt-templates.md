# 输出模板与制作脚本参考

## 一、结构化 JSON 脚本（情况 B）

字段说明：

| 字段 | 含义 |
|---|---|
| timeline | 时间轴数组：time（时间段）、action（动作）、effect（特效）、audio（音频处理） |
| subtitles | 字幕数组：time、text、style、position |
| bgm | 背景音乐说明 |
| output | 成片规格（时长、分辨率、帧率） |
| ffmpeg_command | 完整 FFmpeg 命令（可选） |

完整示例（打喷嚏视频 + 重复洗脑 + 强度 8 + 抖音）：

```json
{
  "timeline": [
    { "time": "0-3s",  "action": "打喷嚏瞬间截 0.5s 重复 6 次，每次加速 1.1x", "effect": "放大脸部+震动", "audio": "喷嚏声变调叠加，逐渐尖锐" },
    { "time": "3-6s",  "action": "倒放喷嚏动作再正放，循环 2 次", "effect": "画面旋转 180°", "audio": "倒放喷嚏声+电子合成音" },
    { "time": "6-9s",  "action": "切《卡农》高潮，画面配合鼓点闪烁", "effect": "RGB 分离+闪光", "audio": "BGM 淡入，原声淡出" },
    { "time": "9-15s", "action": "重复前 3s 内容，加速至 2x，加彩色边框", "effect": "边框+表情包贴纸", "audio": "BGM+变调喷嚏声循环" }
  ],
  "subtitles": [
    { "time": "0.5s", "text": "阿嚏！", "style": "抖音大字标题，黄色描边", "position": "居中" }
  ],
  "bgm": "《卡农》高潮部分",
  "output": "15秒 MP4，1080x1920 竖屏，30fps",
  "ffmpeg_command": "ffmpeg -i input.mp4 -filter_complex '[0:v]trim=...' ..."
}
```

## 二、各平台字幕样式

| 平台 | 字幕风格 | 位置 | 建议 |
|---|---|---|---|
| B 站 | 弹幕风格、可滚动 | 顶部/全屏飘过 | 多段弹幕 + 彩色描边 |
| 抖音 | 大字标题、快速出现 | 居中偏上 | 单句强冲击、黄/白描边 |
| 快手 | 大字 + 表情 | 居中 | 接地气、方言梗 |
| 视频号 | 简洁居中 | 居中 | 克制、正能量向 |

## 三、FFmpeg 常用命令速查

```bash
# 变速（视频加速 1.5x + 音频同步）
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=PTS/1.5[v];[0:a]atempo=1.5[a]" -map "[v]" -map "[a]" out.mp4

# 变调（升一个半音 ≈ 1.0595）
ffmpeg -i in.mp4 -filter_complex "[0:a]asetrate=44100*1.0595,aresample=44100,atempo=1/1.0595[a]" -map 0:v -map "[a]" out.mp4

# 倒放
ffmpeg -i in.mp4 -vf reverse -af areverse out.mp4

# 循环（再播 2 次）
ffmpeg -stream_loop 2 -i in.mp4 -c copy out.mp4

# RGB 分离
ffmpeg -i in.mp4 -vf "rgbashift=rh=5:bh=-5" out.mp4

# 像素化
ffmpeg -i in.mp4 -vf "scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor" out.mp4

# 加字幕（居中大字黄色+黑描边）
ffmpeg -i in.mp4 -vf "drawtext=text='阿嚏！':fontcolor=yellow:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=black" out.mp4

# 竖屏 1080x1920
ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" out.mp4
```

## 四、剪映操作要点（无 FFmpeg 时）

1. 导入素材 → 切割出「鬼畜点」片段。
2. 「变速」做 0.5-2x 曲线变速；「变声」做萝莉/大叔/电音。
3. 「倒放」放单段；复制片段做「重复洗脑」。
4. 「特效」加抖动/故障/闪光；「贴纸」加表情包。
5. 「文字」选气泡/弹幕模板，配「动画-循环」。
6. BGM 对齐卡点，导出竖屏 MP4。

## 五、热点梗追踪（可选）

- 用 WebSearch 搜「近期网络热梗 / 抖音热门 BGM / B 站鬼畜素材」，把梗融入字幕与音效。
- 输出时标注「梗来源 + 时效」，避免用过气梗。
