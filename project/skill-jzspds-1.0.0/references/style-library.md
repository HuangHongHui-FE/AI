# 鬼畜视频风格库（Video Style Library）

> 每个风格给出：核心技法、FFmpeg 命令片段、剪映操作、适用场景。FFmpeg 片段为参考，实际需按素材路径/时长/分辨率调整。

## 1. 经典鬼畜（classic）
- 技法：重复 + 变速 + 变调 + 倒放混合。
- 适用：人物动作、表情。
- FFmpeg：
  ```bash
  # 加速 1.5x（视频+音频同步）
  ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=PTS/1.5[v];[0:a]atempo=1.5[a]" -map "[v]" -map "[a]" out.mp4
  # 全片倒放
  ffmpeg -i in.mp4 -vf reverse -af areverse out.mp4
  # 循环 3 遍（stream_loop 2 = 再播 2 次）
  ffmpeg -stream_loop 2 -i in.mp4 -c copy out.mp4
  ```
- 剪映：片段复制多段 + 「变速」曲线 + 「变声」+ 部分「倒放」。

## 2. 音 MAD（mad）
- 技法：把音频切片按 BGM 节奏重排，音画同步卡点。
- FFmpeg（切片重排核心）：
  ```bash
  ffmpeg -i in.mp4 -filter_complex \
  "[0:v]trim=0:0.5,setpts=PTS-STARTPTS[v1];[0:v]trim=2:2.5,setpts=PTS-STARTPTS[v2];[v1][v2]concat=n=2:v=1:a=0[outv]" -map "[outv]" out.mp4
  ```
- 剪映：精细切到音轨波形对齐；配合「卡点」模板。

## 3. 人力 VOCALOID（vocaloid）
- 技法：用素材人声（单字/音节）拼出歌曲旋律，逐字调音高。
- 思路：先把人声切成单字片段，再用 `asetrate` 逐段调音高拼旋律。
- FFmpeg（变调保持时长）：
  ```bash
  ffmpeg -i voice.wav -filter_complex "asetrate=44100*1.25,aresample=44100,atempo=1/1.25" out.wav
  ```
- 剪映：分段变声 + 逐字对齐歌词；或推荐用 UTAU / ACE Studio 更专业。

## 4. 鬼畜调教（voice-tuning）
- 技法：角色语音替换为唱歌或搞笑台词，音画对嘴。
- FFmpeg：`asetrate`/`atempo`/`rubberband` 调音高；`adelay` 对齐口型。
  ```bash
  ffmpeg -i bgm.mp3 -i voice.wav -filter_complex "[1:a]adelay=500|500[va];[0:a][va]amix=inputs=2:duration=first" out.mp3
  ```

## 5. 重复洗脑（loop）
- 技法：截 1-2s 魔性片段循环 + 鼓点。
- FFmpeg：
  ```bash
  # 截 0.5s 并循环
  ffmpeg -i in.mp4 -filter_complex "[0:v]trim=1:1.5,setpts=PTS-STARTPTS,loop=loop=11:size=1:start=0[v]" -map "[v]" -shortest out.mp4
  ```
- 剪映：复制片段循环 + 节拍对齐鼓点。

## 6. 倒放艺术（reverse）
- 技法：全片/部分倒放，制造诡异感。
- FFmpeg：`-vf reverse -af areverse`（全片）；部分倒放用 `trim`+`reverse`+`concat`。

## 7. 故障艺术（glitch）
- 技法：RGB 分离、抖动、像素化、色块闪烁。
- FFmpeg：
  ```bash
  # RGB 通道错位
  ffmpeg -i in.mp4 -vf "rgbashift=rh=5:bh=-5" out.mp4
  # 像素化（缩小再放大，最近邻）
  ffmpeg -i in.mp4 -vf "scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor" out.mp4
  # 颜色循环闪烁
  ffmpeg -i in.mp4 -vf "hue=h=45*sin(2*PI*n/30)" out.mp4
  ```

## 8. 抽象派（abstract）
- 技法：色彩崩坏、画面扭曲、随机贴图、意义不明但搞笑。
- FFmpeg：
  ```bash
  ffmpeg -i in.mp4 -vf "eq=saturation=2:contrast=1.3,hue=h=90*sin(2*PI*n/15)" out.mp4
  ```

## 9. AI 换脸（face-swap）
- 技法：人物脸替换为表情包/名人脸（需授权）。
- 注意：本环境无专业换脸模型，需用第三方（如 FaceFusion、insightface）或提示用户用剪映/专业工具；生成式视频仅做示意。
- 输出：给出换脸工具选型 + 合规提醒，不直接伪造。

## 强度映射

| intensity | 变速 | 重复 | 变调 | 特效 |
|---|---|---|---|---|
| 1-3 | 0.8-1.2x | 少量 | 无 | 正常色彩 |
| 4-6 | 0.5-2x | 增多 | 开始变调 | 基础抖动/闪光 |
| 7-10 | 极端变速 | 高速切换 | 极端变调 | 液化、色彩崩坏、随机轰炸 |
