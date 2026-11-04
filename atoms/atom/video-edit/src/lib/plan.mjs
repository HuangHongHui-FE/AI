// 剪辑计划校验与归一化。所有 schema 错误集中在这里，渲染层不再猜。
import { existsSync } from "node:fs";
import { findFont } from "./font.mjs";

export class PlanError extends Error {
  constructor(errors) {
    super(errors.join("；"));
    this.errors = errors;
  }
}

export const TRANSITIONS = new Set([
  "cut", "fade", "dissolve", "fadeblack", "fadewhite",
  "wipeleft", "wiperight", "wipeup", "wipedown",
  "slideleft", "slideright", "slideup", "slidedown",
  "circleopen", "circleclose", "pixelize", "smoothleft", "smoothright",
  "radial", "zoomin", "hblur",
]);

export const FITS = new Set(["pad", "crop", "stretch", "blurpad"]);

export function parseTime(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    const parts = s.split(":").map(Number);
    if (parts.length >= 2 && parts.every((x) => Number.isFinite(x))) {
      return parts.reduce((a, b) => a * 60 + b, 0);
    }
  }
  return NaN;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const even = (n) => Math.max(16, Math.round(n / 2) * 2);

function normTransition(raw, errors, where) {
  if (raw == null) return { type: "cut", duration: 0.02 };
  if (typeof raw === "string") raw = { type: raw };
  const type = String(raw.type || "cut");
  if (!TRANSITIONS.has(type)) {
    errors.push(`${where}.transition.type 不支持：${type}`);
    return { type: "cut", duration: 0.02 };
  }
  let duration = raw.duration == null ? (type === "cut" ? 0.02 : 0.1) : Number(raw.duration);
  if (!isNum(duration) || duration < 0.02 || duration > 1.5) {
    errors.push(`${where}.transition.duration 需在 0.02–1.5 秒`);
    duration = 0.1;
  }
  return { type, duration: type === "cut" ? 0.02 : duration };
}

function normText(raw, errors, where) {
  if (typeof raw === "string") raw = { content: raw };
  if (!raw || typeof raw !== "object") {
    errors.push(`${where} 需要字符串或对象`);
    return null;
  }
  const content = String(raw.content ?? "").trim();
  if (!content) {
    errors.push(`${where}.content 不能为空`);
    return null;
  }
  if (content.length > 200) errors.push(`${where}.content 过长（>200 字）`);
  const t = {
    content,
    size: raw.size == null ? null : Number(raw.size),
    position: String(raw.position || "center"),
    x: raw.x == null ? null : String(raw.x),
    y: raw.y == null ? null : String(raw.y),
    color: String(raw.color || "white"),
    border: raw.border == null ? 3 : Number(raw.border),
    borderColor: String(raw.borderColor || "black"),
    box: raw.box == null ? false : Boolean(raw.box),
    boxColor: String(raw.boxColor || "black@0.55"),
    boxBorderW: raw.boxBorderW == null ? 12 : Number(raw.boxBorderW),
    fadeIn: raw.fadeIn == null ? 0 : Number(raw.fadeIn),
    fadeOut: raw.fadeOut == null ? 0 : Number(raw.fadeOut),
    alpha: raw.alpha == null ? null : String(raw.alpha),
    enable: raw.enable == null ? null : raw.enable,
    lineSpacing: raw.lineSpacing == null ? 0 : Number(raw.lineSpacing),
    typewriter: raw.typewriter ? { step: Number(raw.typewriter.step ?? 0.1) } : null,
  };
  if (t.size != null && (!isNum(t.size) || t.size < 8 || t.size > 500)) {
    errors.push(`${where}.size 需在 8–500`);
    t.size = null;
  }
  if (!isNum(t.border) || t.border < 0 || t.border > 20) t.border = 3;
  if (!isNum(t.fadeIn) || t.fadeIn < 0 || t.fadeIn > 5) t.fadeIn = 0;
  if (!isNum(t.fadeOut) || t.fadeOut < 0 || t.fadeOut > 5) t.fadeOut = 0;
  if (t.typewriter && (!isNum(t.typewriter.step) || t.typewriter.step < 0.02 || t.typewriter.step > 1)) {
    errors.push(`${where}.typewriter.step 需在 0.02–1`);
    t.typewriter = null;
  }
  return t;
}

function normEffects(raw, errors, where) {
  if (raw == null) return {};
  if (typeof raw !== "object") {
    errors.push(`${where}.effects 需要对象`);
    return {};
  }
  const e = {};
  if (raw.glitch) e.glitch = true;
  if (raw.noise != null) {
    const n = Number(raw.noise);
    if (!isNum(n) || n < 0 || n > 60) errors.push(`${where}.effects.noise 需在 0–60`);
    else if (n > 0) e.noise = n;
  }
  if (raw.blur != null) {
    const n = Number(raw.blur);
    if (!isNum(n) || n < 0 || n > 80) errors.push(`${where}.effects.blur 需在 0–80`);
    else if (n > 0) e.blur = n;
  }
  if (raw.pixelize) {
    const p = raw.pixelize === true ? {} : raw.pixelize;
    const size = p.size == null ? 24 : Number(p.size);
    const from = p.from == null ? 0 : Number(p.from);
    const to = p.to == null ? 0.4 : Number(p.to);
    if (!isNum(size) || size < 2 || size > 256) errors.push(`${where}.effects.pixelize.size 需在 2–256`);
    else if (!isNum(from) || !isNum(to) || from < 0 || to <= from) errors.push(`${where}.effects.pixelize 时间窗不合法`);
    else e.pixelize = { size, from, to };
  }
  return e;
}

function normCell(raw, errors, where) {
  if (!raw || typeof raw !== "object") {
    errors.push(`${where} 需要 {start,end}`);
    return null;
  }
  const start = parseTime(raw.start);
  const end = parseTime(raw.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    errors.push(`${where} 的 start/end 不合法`);
    return null;
  }
  const speed = raw.speed == null ? 1 : Number(raw.speed);
  if (!isNum(speed) || speed < 0.25 || speed > 4) {
    errors.push(`${where}.speed 需在 0.25–4`);
    return null;
  }
  return { start, end, speed, reverse: Boolean(raw.reverse) };
}

export function normalizePlan(raw, probeInfo) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== "object") throw new PlanError(["plan 必须是 JSON 对象"]);
  if (!raw.source) errors.push("缺少 source");

  const out = raw.output || {};
  const width = out.width == null ? probeInfo.width : even(Number(out.width));
  const height = out.height == null ? probeInfo.height : even(Number(out.height));
  if (width < 16 || width > 4096) errors.push("output.width 需在 16–4096");
  if (height < 16 || height > 4096) errors.push("output.height 需在 16–4096");
  const fps = out.fps == null ? Math.round(probeInfo.fps) || 30 : Number(out.fps);
  if (!isNum(fps) || fps < 1 || fps > 120) errors.push("output.fps 需在 1–120");
  const fit = String(out.fit || "pad");
  if (!FITS.has(fit)) errors.push(`output.fit 只能是 ${[...FITS].join(" / ")}`);
  const codec = String(out.codec || "h264");
  if (!["h264", "h265"].includes(codec)) errors.push("output.codec 只能是 h264 / h265");
  const crf = out.crf == null ? 18 : Number(out.crf);
  if (!isNum(crf) || crf < 0 || crf > 51) errors.push("output.crf 需在 0–51");
  const preset = String(out.preset || "medium");
  if (!["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"].includes(preset)) {
    errors.push("output.preset 不合法");
  }
  if (width > probeInfo.width * 2.5 || height > probeInfo.height * 2.5) {
    warnings.push(`输出 ${width}x${height} 明显大于源 ${probeInfo.width}x${probeInfo.height}，画面会偏软`);
  }
  if (Math.abs(fps - probeInfo.fps) > 1.5) warnings.push(`输出 ${fps}fps 与源 ${probeInfo.fps}fps 不同，会补帧/抽帧`);

  const gradeRaw = raw.grade || {};
  const grade = {
    contrast: gradeRaw.contrast == null ? 1.0 : Number(gradeRaw.contrast),
    saturation: gradeRaw.saturation == null ? 1.0 : Number(gradeRaw.saturation),
    brightness: gradeRaw.brightness == null ? 0 : Number(gradeRaw.brightness),
    gamma: gradeRaw.gamma == null ? 1.0 : Number(gradeRaw.gamma),
    vignette: Boolean(gradeRaw.vignette),
    grain: gradeRaw.grain == null ? 0 : Number(gradeRaw.grain),
    sharpen: gradeRaw.sharpen == null ? 0 : Number(gradeRaw.sharpen),
    lut: gradeRaw.lut ? String(gradeRaw.lut) : null,
  };
  if (grade.contrast < 0.5 || grade.contrast > 2) errors.push("grade.contrast 需在 0.5–2");
  if (grade.saturation < 0 || grade.saturation > 3) errors.push("grade.saturation 需在 0–3");
  if (grade.brightness < -0.5 || grade.brightness > 0.5) errors.push("grade.brightness 需在 -0.5–0.5");
  if (grade.gamma < 0.3 || grade.gamma > 2.5) errors.push("grade.gamma 需在 0.3–2.5");
  if (!isNum(grade.grain) || grade.grain < 0 || grade.grain > 60) errors.push("grade.grain 需在 0–60");
  if (!isNum(grade.sharpen) || grade.sharpen < 0 || grade.sharpen > 2) errors.push("grade.sharpen 需在 0–2");

  const ov = raw.overlays || {};
  const overlays = {
    watermark: ov.watermark ? String(ov.watermark) : null,
    watermarkPosition: String(ov.watermarkPosition || "topRight"),
    progressBar: Boolean(ov.progressBar),
    banner: ov.banner ? String(ov.banner) : null,
    bannerSize: ov.bannerSize == null ? null : Number(ov.bannerSize),
  };

  const a = raw.audio || {};
  const loudnorm = a.loudnorm === false || a.loudnorm === null ? null : Number(a.loudnorm ?? -14);
  if (loudnorm != null && (loudnorm < -40 || loudnorm > -5)) errors.push("audio.loudnorm 需在 -40–-5，或 false");
  const truePeak = Number(a.truePeak ?? -1.2);
  if (!isNum(truePeak) || truePeak < -12 || truePeak > 0) errors.push("audio.truePeak 需在 -12–0");
  const audio = {
    loudnorm,
    truePeak,
    sfx: Boolean(a.sfx),
    sfxGain: a.sfxGain == null ? 1 : Number(a.sfxGain),
    fadeOut: a.fadeOut == null ? 0 : Number(a.fadeOut),
  };
  if (!isNum(audio.sfxGain) || audio.sfxGain < 0 || audio.sfxGain > 3) errors.push("audio.sfxGain 需在 0–3");
  if (!isNum(audio.fadeOut) || audio.fadeOut < 0 || audio.fadeOut > 10) errors.push("audio.fadeOut 需在 0–10");

  if (!Array.isArray(raw.segments) || raw.segments.length === 0) {
    errors.push("segments 至少 1 段");
    throw new PlanError(errors);
  }
  if (raw.segments.length > 120) errors.push("segments 超过 120 段");

  const segments = [];
  raw.segments.forEach((r, idx) => {
    const where = `segments[${idx}]`;
    if (!r || typeof r !== "object") {
      errors.push(`${where} 需要对象`);
      return;
    }
    const speed = r.speed == null ? 1 : Number(r.speed);
    if (!isNum(speed) || speed < 0.25 || speed > 4) {
      errors.push(`${where}.speed 需在 0.25–4`);
      return;
    }
    const audioSpeed = r.audioSpeed == null ? null : Number(r.audioSpeed);
    if (audioSpeed != null && (!isNum(audioSpeed) || audioSpeed < 0.25 || audioSpeed > 4)) {
      errors.push(`${where}.audioSpeed 需在 0.25–4`);
      return;
    }
    const s = {
      name: String(r.name || `seg${idx + 1}`),
      speed,
      audioSpeed,
      reverse: Boolean(r.reverse),
      freeze: r.freeze == null ? 0 : Number(r.freeze),
      loop: r.loop == null ? 0 : Number(r.loop),
      zoom: r.zoom == null ? 1 : Number(r.zoom),
      kenBurns: null,
      mirror: Boolean(r.mirror),
      rotate: r.rotate == null ? 0 : Number(r.rotate),
      fit: r.fit ? String(r.fit) : null,
      cropBottom: r.cropBottom == null ? 0 : Number(r.cropBottom),
      text: [],
      transition: normTransition(r.transition, errors, where),
      effects: normEffects(r.effects, errors, where),
      audioLead: r.audioLead == null ? 0 : Number(r.audioLead),
      audioLag: r.audioLag == null ? 0 : Number(r.audioLag),
      mute: Boolean(r.mute),
      volume: r.volume == null ? 1 : Number(r.volume),
      fadeIn: r.fadeIn == null ? 0 : Number(r.fadeIn),
      fadeOut: r.fadeOut == null ? 0 : Number(r.fadeOut),
    };
    if (s.fit && !FITS.has(s.fit)) errors.push(`${where}.fit 不合法`);
    if (!isNum(s.freeze) || s.freeze < 0 || s.freeze > 5) errors.push(`${where}.freeze 需在 0–5`);
    if (!Number.isInteger(s.loop) || s.loop < 0 || s.loop > 10) errors.push(`${where}.loop 需是 0–10 的整数`);
    if (!isNum(s.zoom) || s.zoom < 1 || s.zoom > 3) errors.push(`${where}.zoom 需在 1–3`);
    if (!isNum(s.rotate) || s.rotate < -15 || s.rotate > 15) errors.push(`${where}.rotate 需在 -15–15`);
    if (!isNum(s.cropBottom) || s.cropBottom < 0 || s.cropBottom > 0.3) errors.push(`${where}.cropBottom 需在 0–0.3`);
    if (!isNum(s.audioLead) || s.audioLead < 0 || s.audioLead > 2) errors.push(`${where}.audioLead 需在 0–2`);
    if (!isNum(s.audioLag) || s.audioLag < 0 || s.audioLag > 2) errors.push(`${where}.audioLag 需在 0–2`);
    if (!isNum(s.volume) || s.volume < 0 || s.volume > 3) errors.push(`${where}.volume 需在 0–3`);
    if (!isNum(s.fadeIn) || s.fadeIn < 0 || s.fadeIn > 5) errors.push(`${where}.fadeIn 需在 0–5`);
    if (!isNum(s.fadeOut) || s.fadeOut < 0 || s.fadeOut > 5) errors.push(`${where}.fadeOut 需在 0–5`);
    if (r.kenBurns != null) {
      if (!Array.isArray(r.kenBurns) || r.kenBurns.length !== 2) errors.push(`${where}.kenBurns 需要 [起,止]`);
      else {
        const [z0, z1] = r.kenBurns.map(Number);
        if (!isNum(z0) || !isNum(z1) || z0 < 1 || z1 < 1 || z0 > 3 || z1 > 3) errors.push(`${where}.kenBurns 需在 1–3`);
        else s.kenBurns = [z0, z1];
      }
    }
    if (Array.isArray(r.text)) s.text = r.text.map((t, j) => normText(t, errors, `${where}.text[${j}]`)).filter(Boolean);
    else if (r.text != null) {
      const t = normText(r.text, errors, `${where}.text`);
      if (t) s.text = [t];
    }

    // 静帧段
    if (r.stillAt != null || r.still != null) {
      const at = parseTime(r.stillAt ?? r.still);
      const duration = r.duration == null ? 0.6 : Number(r.duration);
      if (!Number.isFinite(at) || at < 0 || at >= probeInfo.duration + 0.05) errors.push(`${where}.stillAt 超出源片`);
      if (!isNum(duration) || duration < 0.05 || duration > 30) errors.push(`${where}.duration 需在 0.05–30`);
      s.kind = "still";
      s.stillAt = at;
      s.duration = duration;
      s.videoDuration = duration;
      segments.push(s);
      return;
    }

    // 多宫格
    if (r.grid) {
      const g = r.grid;
      const cells = Array.isArray(g.cells) ? g.cells.map((c, j) => normCell(c, errors, `${where}.grid.cells[${j}]`)).filter(Boolean) : [];
      if (cells.length < 2 || cells.length > 9) errors.push(`${where}.grid.cells 需 2–9 个`);
      if (cells.some((c) => c.speed !== 1)) errors.push(`${where}.grid.cells 暂不支持 speed≠1（v1）`);
      const cols = Number(g.cols ?? 2);
      const rows = Number(g.rows ?? Math.ceil(cells.length / cols));
      if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols * rows !== cells.length) {
        errors.push(`${where}.grid 的 cols×rows 必须等于 cells 数量`);
      }
      const durs = cells.map((c) => (c.end - c.start) / c.speed);
      const duration = g.duration != null ? Number(g.duration) : Math.min(...durs);
      if (!isNum(duration) || duration < 0.1 || duration > 30) errors.push(`${where}.grid.duration 不合法`);
      s.kind = "grid";
      s.grid = { cells, cols, rows, duration, border: g.border == null ? 2 : Number(g.border) };
      s.videoDuration = duration;
      segments.push(s);
      return;
    }

    // 画中画
    if (r.pip) {
      const start = parseTime(r.start);
      const end = parseTime(r.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        errors.push(`${where} 的 start/end 不合法`);
        return;
      }
      const p = r.pip;
      const ps = parseTime(p.start);
      const pe = parseTime(p.end);
      if (!Number.isFinite(ps) || !Number.isFinite(pe) || pe <= ps) errors.push(`${where}.pip 的 start/end 不合法`);
      const widthRatio = Number(p.width ?? 0.28);
      if (!isNum(widthRatio) || widthRatio < 0.1 || widthRatio > 0.6) errors.push(`${where}.pip.width 需在 0.1–0.6`);
      s.kind = "pip";
      s.start = start;
      s.end = end;
      s.pip = {
        start: ps,
        end: pe,
        width: widthRatio,
        position: String(p.position || "bottomRight"),
        margin: p.margin == null ? 24 : Number(p.margin),
        border: p.border == null ? 2 : Number(p.border),
      };
      s.videoDuration = (end - start) / speed + s.freeze;
      segments.push(s);
      return;
    }

    // 普通片段
    const start = parseTime(r.start);
    const end = parseTime(r.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errors.push(`${where} 的 start/end 不合法`);
      return;
    }
    if (end > probeInfo.duration + 0.05) errors.push(`${where}.end 超出源片 ${probeInfo.duration.toFixed(2)}s`);
    if (end - start < 0.05) errors.push(`${where} 至少 0.05s`);
    if (s.reverse && end - start > 20) warnings.push(`${where} 倒放段 ${(end - start).toFixed(1)}s，会占内存`);
    s.kind = "clip";
    s.start = start;
    s.end = end;
    s.videoDuration = (end - start) / speed + s.freeze;
    segments.push(s);
  });

  const expanded = [];
  for (const s of segments) {
    const n = (s.loop || 0) + 1;
    for (let i = 0; i < n; i++) {
      const copy = { ...s, name: i ? `${s.name}#${i + 1}` : s.name };
      if (i) copy.transition = { type: "cut", duration: 0.02 };
      copy.loop = 0;
      expanded.push(copy);
    }
  }
  if (expanded.length > 200) errors.push("loop 展开后超过 200 段");

  const font = findFont(raw.font);
  const needsText = expanded.some((x) => x.text?.length) || Boolean(overlays.watermark) || Boolean(overlays.banner);
  if (needsText && !font) {
    errors.push("找不到中文字体：请设置 plan.font，或设 VIDEO_EDIT_FONT，或安装 Noto Sans CJK / 微软雅黑");
  }
  if (font && !existsSync(String(font))) errors.push(`font 文件不存在：${font}`);
  if (errors.length) throw new PlanError(errors);
  return {
    plan: {
      source: String(raw.source),
      font,
      output: { width, height, fps, fit, codec, crf, preset },
      grade,
      overlays,
      audio,
      segments: expanded,
    },
    warnings,
  };
}

export function timeline(segments, margin = 0.12) {
  // 与 033 验证过的 xfade 时间轴一致：offset 额外留 margin，防止丢段。
  const starts = [];
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (i === 0) {
      starts.push(0);
      acc = s.videoDuration;
    } else {
      const off = Math.max(0, acc - s.transition.duration - margin);
      starts.push(off);
      acc = off + s.videoDuration;
    }
  }
  return { starts, total: acc };
}