// 10 类视频手法的能力表。--techniques 输出它；校验与产物里的 techniques 也用它。
// supported=false 的项不是不能做，而是这个原子 v1 不做（需要 ML/别的原子）。

export const TECHNIQUES = [
  {
    category: "结构与时间线",
    items: [
      { id: "trim", name: "粗剪/精剪/分段", supported: true, how: "segments[].start/end" },
      { id: "segment", name: "分段", supported: true, how: "segments[]" },
      { id: "reorder", name: "重排/插入/删除", supported: true, how: "调整 segments 顺序" },
      { id: "jumpCut", name: "跳切", supported: true, how: "同一源连续短段 + cut 转场" },
      { id: "matchCut", name: "匹配剪辑/动作衔接", supported: true, how: "按动作点选 start/end" },
      { id: "montage", name: "平行/交叉/蒙太奇", supported: true, how: "多段交错 + grid" },
      { id: "flashForward", name: "闪回/闪前", supported: true, how: "把后段提前到冷开场" },
      { id: "loop", name: "循环", supported: true, how: "segments[].loop" },
      { id: "reverse", name: "倒放", supported: true, how: "segments[].reverse" },
      { id: "freeze", name: "定格帧", supported: true, how: "segments[].freeze 或 stillAt" },
      { id: "frameDrop", name: "抽帧（降帧率）", supported: true, how: "output.fps 设低" },
      { id: "speed", name: "时长压缩/拉伸", supported: true, how: "segments[].speed" },
      { id: "audioLead", name: "J-cut / L-cut 声画错位", supported: true, how: "segments[].audioLead / audioLag" },
    ],
  },
  {
    category: "变速",
    items: [
      { id: "speed", name: "匀速快放/慢放", supported: true, how: "segments[].speed（视频 setpts + 音频 atempo）" },
      { id: "speedRamp", name: "变速曲线/坡度变速", supported: true, how: "拆成相邻短段，speed 0.5→1→2" },
      { id: "pitchPreservingSpeed", name: "变速不变调", supported: true, how: "音频统一走 atempo" },
      { id: "audioIndependentSpeed", name: "音频独立变速", supported: true, how: "segments[].audioSpeed（可选，默认跟视频）" },
      { id: "keyframeSpeed", name: "关键帧变速", supported: true, how: "多个短段拼出曲线" },
    ],
  },
  {
    category: "转场",
    items: [
      { id: "cut", name: "硬切", supported: true, how: "transition.type=cut" },
      { id: "dissolve", name: "叠化/溶解", supported: true, how: "transition.type=dissolve" },
      { id: "fade", name: "淡入淡出", supported: true, how: "transition.type=fade" },
      { id: "fadeblack", name: "淡黑", supported: true, how: "transition.type=fadeblack" },
      { id: "fadewhite", name: "闪白", supported: true, how: "transition.type=fadewhite" },
      { id: "wipe", name: "划像", supported: true, how: "transition.type=wipeleft/wiperight/wipeup/wipedown" },
      { id: "slide", name: "滑动/翻页感", supported: true, how: "transition.type=slideleft/slideright/..." },
      { id: "circleopen", name: "圆形展开", supported: true, how: "transition.type=circleopen/circleclose" },
      { id: "pixelize", name: "像素化/故障转场", supported: true, how: "transition.type=pixelize" },
      { id: "smooth", name: "方向模糊转场", supported: true, how: "transition.type=smoothleft/smoothright" },
      { id: "zoomin", name: "缩放转场", supported: true, how: "transition.type=zoomin" },
      { id: "rotate", name: "旋转转场", supported: false, reason: "v1 用 zoomin/dissolve 替代" },
      { id: "whipPan", name: "甩镜无缝转场", supported: true, how: "transition.type=smoothleft + 短时长" },
      { id: "lightLeak", name: "光效转场", supported: false, reason: "v1 没有光效素材" },
    ],
  },
  {
    category: "画面构图与几何",
    items: [
      { id: "crop", name: "裁剪", supported: true, how: "output.fit=crop 或 segments[].fit" },
      { id: "zoom", name: "缩放/推近", supported: true, how: "segments[].zoom" },
      { id: "kenBurns", name: "平移/推拉（Ken Burns）", supported: true, how: "segments[].kenBurns=[起,止]" },
      { id: "rotate", name: "旋转", supported: true, how: "segments[].rotate（±15°）" },
      { id: "mirror", name: "翻转/镜像", supported: true, how: "segments[].mirror=true" },
      { id: "aspect", name: "画幅改造 9:16/16:9/1:1", supported: true, how: "output.width/height + fit" },
      { id: "pad", name: "加黑边", supported: true, how: "output.fit=pad" },
      { id: "blurpad", name: "模糊填充/背景延展", supported: true, how: "output.fit=blurpad + cropBottom" },
      { id: "stabilize", name: "稳定/防抖", supported: false, reason: "v1 不引入 vidstab 依赖" },
      { id: "perspective", name: "变形/透视/镜头校正", supported: false, reason: "v1 不做" },
      { id: "keyframeAnim", name: "关键帧动画（位置/缩放/旋转/不透明度）", supported: true, how: "kenBurns / rotate / text.fadeIn" },
    ],
  },
  {
    category: "调色",
    items: [
      { id: "contrast", name: "对比/曝光/高光阴影", supported: true, how: "grade.contrast / brightness / gamma" },
      { id: "saturation", name: "饱和度", supported: true, how: "grade.saturation" },
      { id: "vignette", name: "暗角", supported: true, how: "grade.vignette" },
      { id: "grain", name: "胶片颗粒/噪点", supported: true, how: "grade.grain" },
      { id: "sharpen", name: "锐化", supported: true, how: "grade.sharpen" },
      { id: "lut", name: "LUT/风格化/胶片模拟", supported: true, how: "grade.lut=<.cube 路径>" },
      { id: "curves", name: "曲线/色轮/HSL/局部调色", supported: false, reason: "v1 用 eq + LUT 近似" },
      { id: "skin", name: "肤色保护", supported: false, reason: "v1 不做" },
      { id: "match", name: "多素材统一色调", supported: true, how: "全局 grade 对整条成片生效" },
    ],
  },
  {
    category: "特效",
    items: [
      { id: "blur", name: "高斯模糊", supported: true, how: "effects.blur" },
      { id: "glitch", name: "故障 glitch/色差", supported: true, how: "effects.glitch" },
      { id: "pixelizeEffect", name: "马赛克/像素化", supported: true, how: "effects.pixelize" },
      { id: "noise", name: "噪点/闪烁", supported: true, how: "effects.noise / grade.grain" },
      { id: "motionBlur", name: "动感/径向模糊", supported: false, reason: "v1 不做方向模糊" },
      { id: "light", name: "漏光/耀斑/光晕", supported: false, reason: "v1 没有光效素材" },
      { id: "scanline", name: "扫描线", supported: false, reason: "v1 不做" },
      { id: "particle", name: "粒子/速度线", supported: false, reason: "v1 不做" },
      { id: "cartoon", name: "漫画化/卡通化", supported: false, reason: "v1 不做" },
    ],
  },
  {
    category: "合成",
    items: [
      { id: "pip", name: "画中画", supported: true, how: "segments[].pip" },
      { id: "grid", name: "分屏/多宫格", supported: true, how: "segments[].grid" },
      { id: "overlay", name: "图层叠加/透明度", supported: true, how: "文字/水印叠加；整段画中画" },
      { id: "mask", name: "蒙版/遮罩转场", supported: false, reason: "v1 用 xfade 转场替代" },
      { id: "tracking", name: "跟踪（点/面/平面）", supported: false, reason: "需要 ML/跟踪器，v1 不做" },
      { id: "keying", name: "绿幕/智能抠像/rotoscope", supported: false, reason: "需要 ML，v1 不做" },
      { id: "objectRemove", name: "物体擦除/内容识别填充", supported: false, reason: "需要 ML，v1 不做" },
      { id: "blend", name: "混合模式", supported: false, reason: "v1 只用 overlay 常规混合" },
    ],
  },
  {
    category: "字幕与图形",
    items: [
      { id: "hardSubs", name: "硬字幕保留", supported: true, how: "源片自带；fit=cropBottom 可裁掉" },
      { id: "text", name: "花字/描边/阴影/底框", supported: true, how: "segments[].text[]" },
      { id: "typewriter", name: "逐字动画", supported: true, how: "拆成多个 text + enable（脚本生成）" },
      { id: "titleCard", name: "标题卡/片头片尾", supported: true, how: "stillAt / 纯色段 + text" },
      { id: "progressBar", name: "进度条", supported: true, how: "overlays.progressBar" },
      { id: "watermark", name: "水印/Logo", supported: true, how: "overlays.watermark" },
      { id: "banner", name: "顶部/底部常驻条", supported: true, how: "overlays.banner" },
      { id: "arrow", name: "箭头/圈注/高亮", supported: false, reason: "v1 没有图形贴图，文字可替代" },
      { id: "sticker", name: "贴纸/表情包/弹幕", supported: false, reason: "v1 不做" },
      { id: "dataViz", name: "数据可视化/信息图", supported: false, reason: "v1 不做" },
      { id: "qr", name: "二维码", supported: false, reason: "v1 不做" },
    ],
  },
  {
    category: "音频",
    items: [
      { id: "volume", name: "音量包络/淡入淡出", supported: true, how: "segments[].volume / fadeIn / fadeOut" },
      { id: "audioSpeed", name: "变速/独立变速", supported: true, how: "audioSpeed" },
      { id: "sfx", name: "音效（whoosh/boom/riser/glitch）", supported: true, how: "audio.sfx=true" },
      { id: "loudnorm", name: "响度标准化", supported: true, how: "audio.loudnorm=-14" },
      { id: "limiter", name: "限幅", supported: true, how: "audio.truePeak" },
      { id: "mute", name: "静音", supported: true, how: "segments[].mute" },
      { id: "eq", name: "降噪/EQ/压缩/混响", supported: false, reason: "v1 不做，保留原始音轨" },
      { id: "ducking", name: "闪避 ducking", supported: false, reason: "v1 没有独立配乐轨" },
      { id: "musicReplace", name: "配乐替换", supported: false, reason: "v1 只用源音轨 + 音效" },
      { id: "tts", name: "配音/TTS/旁白", supported: false, reason: "用独立原子 tts-audio" },
    ],
  },
  {
    category: "导出",
    items: [
      { id: "h264", name: "H.264", supported: true, how: "output.codec=h264" },
      { id: "h265", name: "H.265", supported: true, how: "output.codec=h265（需 ffmpeg 带 libx265）" },
      { id: "av1", name: "AV1", supported: false, reason: "v1 不保证编码器存在" },
      { id: "bitrate", name: "码率/CRF", supported: true, how: "output.crf" },
      { id: "resolution", name: "分辨率/帧率", supported: true, how: "output.width/height/fps" },
      { id: "mp4", name: "mp4 封装/faststart", supported: true, how: "默认" },
      { id: "mov", name: "mov 封装", supported: false, reason: "v1 固定 mp4" },
      { id: "colorspace", name: "色彩空间/平台适配", supported: true, how: "yuv420p/bt709 由 ffmpeg 统一" },
    ],
  },
];

export function techniqueIds() {
  return TECHNIQUES.flatMap((c) => c.items.filter((i) => i.supported).map((i) => i.id));
}

export function collectTechniques(plan) {
  const used = new Set(["trim", "segment"]);
  const segs = plan.segments || [];
  if (segs.length > 1) used.add("reorder");
  if (plan.output?.fit === "blurpad") used.add("blurpad");
  if (plan.output?.fit === "pad") used.add("pad");
  if (plan.output?.fit === "crop") used.add("crop");
  if (plan.output?.fps && plan.output.fps < 24) used.add("frameDrop");
  if (plan.output?.codec === "h265") used.add("h265");
  else used.add("h264");
  if (plan.output?.crf != null) used.add("bitrate");
  used.add("resolution");
  used.add("mp4");
  if (plan.grade?.contrast != null || plan.grade?.brightness != null || plan.grade?.gamma != null) used.add("contrast");
  if (plan.grade?.saturation != null) used.add("saturation");
  if (plan.grade?.vignette) used.add("vignette");
  if (plan.grade?.grain) used.add("grain");
  if (plan.grade?.sharpen) used.add("sharpen");
  if (plan.grade?.lut) used.add("lut");
  if (plan.overlays?.watermark) used.add("watermark");
  if (plan.overlays?.progressBar) used.add("progressBar");
  if (plan.overlays?.banner) used.add("banner");
  if (plan.audio?.loudnorm != null) used.add("loudnorm");
  if (plan.audio?.truePeak != null) used.add("limiter");
  if (plan.audio?.sfx) used.add("sfx");
  for (const s of segs) {
    if (s.speed !== 1) {
      used.add("speed");
      used.add("pitchPreservingSpeed");
    }
    if (s.audioSpeed != null && s.audioSpeed !== s.speed) used.add("audioIndependentSpeed");
    if (s.reverse) used.add("reverse");
    if (s.freeze) used.add("freeze");
    if (s.loop) used.add("loop");
    if (s.mirror) used.add("mirror");
    if (s.rotate) used.add("rotate");
    if (s.zoom !== 1) used.add("zoom");
    if (s.kenBurns) used.add("kenBurns");
    if (s.stillAt != null) used.add("titleCard");
    if (s.fit === "blurpad") used.add("blurpad");
    if (s.fit === "crop") used.add("crop");
    if (s.fit === "pad") used.add("pad");
    if (s.grid) used.add("grid");
    if (s.pip) used.add("pip");
    if (s.audioLead || s.audioLag) used.add("audioLead");
    if (s.mute) used.add("mute");
    if (s.text?.length) used.add("text");
    if (s.transition && s.transition.type !== "cut") used.add(s.transition.type);
    if (s.transition?.type === "cut") used.add("cut");
    if (s.audio?.volume != null || s.audio?.fadeIn || s.audio?.fadeOut) used.add("volume");
    if (s.effects?.glitch) used.add("glitch");
    if (s.effects?.pixelize) used.add("pixelizeEffect");
    if (s.effects?.blur) used.add("blur");
    if (s.effects?.noise) used.add("noise");
  }
  return [...used];
}