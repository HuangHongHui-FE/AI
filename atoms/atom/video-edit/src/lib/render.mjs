// 计划 → 逐段 mp4 → xfade 拼接 → 调色/字幕/音效 → 成片。
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { run, ffmpegPath, atempoChain, hasEncoder, hasFilter } from "./ffmpeg.mjs";
import { timeline, PlanError } from "./plan.mjs";
import { textFilters } from "./text.mjs";
import { writeSfxFile, sfxEvents } from "./sfx.mjs";
import { collectTechniques } from "./techniques.mjs";

const MARGIN = 0.12; // xfade 链的安全边距，033 验证过

function even(n) {
  return Math.max(2, Math.round(n / 2) * 2);
}

function fitFilter(fit, W, H) {
  switch (fit) {
    case "stretch": return `scale=${W}:${H}`;
    case "crop": return `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
    default: return `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
  }
}

function geomFilter(seg, W, H, fps) {
  const parts = ["setsar=1"];
  if (seg.mirror) parts.push("hflip");
  if (seg.rotate) parts.push(`rotate=${seg.rotate}*PI/180:ow=iw:oh=ih:fillcolor=black`);
  if (seg.kenBurns) {
    const [z0, z1] = seg.kenBurns;
    const d = Math.max(0.1, seg.videoDuration);
    parts.push(`scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase`);
    parts.push(`zoompan=z='min(${z0}+(${z1}-${z0})*on/(${fps}*${d}),${z1})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`);
  } else if (seg.zoom && seg.zoom !== 1) {
    const z = seg.zoom;
    parts.push(`crop=iw/${z}:ih/${z}:(iw-iw/${z})/2:(ih-ih/${z})/2`);
  }
  if (seg.cropBottom) parts.push(`crop=iw:ih*(1-${seg.cropBottom}):0:0`);
  return parts.join(",");
}

function effectsFilter(seg) {
  const parts = [];
  if (seg.effects?.glitch) parts.push("rgbashift=rh=6:bh=-6", "noise=alls=10:allf=t");
  if (seg.effects?.blur) parts.push(`gblur=sigma=${seg.effects.blur}`);
  if (seg.effects?.noise) parts.push(`noise=alls=${seg.effects.noise}:allf=t+u`);
  if (seg.effects?.pixelize) {
    const p = seg.effects.pixelize;
    parts.push(`pixelize=w=${p.size}:h=${p.size}:enable='between(t,${p.from},${p.to})'`);
  }
  return parts;
}

function audioFilter(seg, dur, hasAudio) {
  if (!hasAudio || seg.kind === "still" || seg.mute) {
    return `anullsrc=r=44100:cl=stereo,atrim=0:${dur.toFixed(3)}[aout]`;
  }
  const parts = ["asetpts=PTS-STARTPTS"];
  if (seg.reverse) parts.push("areverse");
  const sp = seg.audioSpeed ?? seg.speed;
  if (sp !== 1) parts.push(atempoChain(sp));
  if (seg.volume != null && seg.volume !== 1) parts.push(`volume=${seg.volume}`);
  if (seg.fadeIn) parts.push(`afade=t=in:st=0:d=${seg.fadeIn}`);
  if (seg.fadeOut) parts.push(`afade=t=out:st=${Math.max(0, dur - seg.fadeOut).toFixed(3)}:d=${seg.fadeOut}`);
  if (seg.freeze) parts.push(`apad=pad_dur=${seg.freeze}`);
  parts.push(`atrim=0:${dur.toFixed(3)}`, "aresample=44100", "aformat=channel_layouts=stereo");
  return `[0:a]${parts.join(",")}[aout]`;
}

function segmentBase(seg, plan, W, H, FPS) {
  const parts = [];
  if (seg.reverse) parts.push("reverse");
  if (seg.speed !== 1) parts.push(`setpts=PTS/${seg.speed}`);
  parts.push(`fps=${FPS}`);
  if (seg.freeze) parts.push(`tpad=stop_mode=clone:stop_duration=${seg.freeze}`);
  return parts.join(",");
}

function segmentGraph(seg, plan, opts) {
  const { W, H, FPS, textDir, hasAudio, index, srcW, srcH } = opts;
  const dur = seg.videoDuration;
  const text = textFilters(seg.text, { W, H, font: plan.font, dir: textDir, duration: dur });
  const effects = effectsFilter(seg);
  const fit = seg.fit || plan.output.fit;
  const audio = audioFilter(seg, dur, hasAudio);
  let video;

  if (seg.kind === "grid") {
    const g = seg.grid;
    const aspect = srcW && srcH ? srcW / srcH : W / H;
    let blockW = W, blockH = H;
    if (fit === "blurpad" || fit === "pad") {
      if (aspect >= W / H) { blockW = W; blockH = even(W / aspect); }
      else { blockH = H; blockW = even(H * aspect); }
    }
    const tw = Math.floor(blockW / g.cols);
    const th = Math.floor(blockH / g.rows);
    const cellGraphs = g.cells.map((c, i) => {
      const p = [];
      if (c.reverse) p.push("reverse");
      if (c.speed !== 1) p.push(`setpts=PTS/${c.speed}`);
      p.push(`fps=${FPS}`, "setsar=1");
      p.push(`scale=${tw}:${th}:force_original_aspect_ratio=increase`, `crop=${tw}:${th}`);
      if (g.border) p.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=${g.border}`);
      p.push("trim=duration=" + dur.toFixed(3), "setpts=PTS-STARTPTS");
      return `[${i}:v]${p.join(",")}[g${i}]`;
    });
    const layout = g.cells.map((_, i) => `${(i % g.cols) * tw}_${Math.floor(i / g.cols) * th}`).join("|");
    const after = [...effects, ...text, "setsar=1", "format=yuv420p"].join(",");
    const base = `${cellGraphs.join(";")};${g.cells.map((_, i) => `[g${i}]`).join("")}xstack=inputs=${g.cells.length}:layout=${layout}:fill=black[base0];[base0]scale=${blockW}:${blockH}[base]`;
    let fitv;
    if (fit === "blurpad") {
      fitv = `[base]split=2[gbg][gfg];` +
        `[gbg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=30,eq=brightness=-0.08[gbg2];` +
        `[gfg]scale=${W}:${H}:force_original_aspect_ratio=decrease[gfg2];` +
        `[gbg2][gfg2]overlay=(W-w)/2:(H-h)/2[fitv]`;
    } else {
      fitv = `[base]${fitFilter(fit, W, H)}[fitv]`;
    }
    video = `${base};${fitv};[fitv]${after}[vout]`;
    const cell0 = g.cells[0];
    const aspd = cell0.speed;
    const a = !hasAudio || seg.mute
      ? `anullsrc=r=44100:cl=stereo,atrim=0:${dur.toFixed(3)}[aout]`
      : `[0:a]${cell0.reverse ? "areverse," : ""}${aspd !== 1 ? atempoChain(aspd) + "," : ""}atrim=0:${dur.toFixed(3)},aresample=44100,aformat=channel_layouts=stereo[aout]`;
    return { graph: video + ";" + a };
  }

  if (seg.kind === "pip") {
    const p = seg.pip;
    const insetW = even(W * p.width);
    const base = `${segmentBase(seg, plan, W, H, FPS)},${geomFilter(seg, W, H, FPS)}`;
    let main;
    if (fit === "blurpad") {
      main = `[0:v]${base},split=2[mbg][mfg];` +
        `[mbg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=30,eq=brightness=-0.08[mbg2];` +
        `[mfg]scale=${W}:${H}:force_original_aspect_ratio=decrease[mfg2];` +
        `[mbg2][mfg2]overlay=(W-w)/2:(H-h)/2[main]`;
    } else {
      main = `[0:v]${base},${fitFilter(fit, W, H)}[main]`;
    }
    const inset = `[1:v]fps=${FPS},setsar=1,scale=${insetW}:-2${p.border ? `,drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=${p.border}` : ""}[inset]`;
    const m = p.margin;
    const pos = {
      topLeft: `${m}:${m}`,
      topRight: `W-w-${m}:${m}`,
      bottomLeft: `${m}:H-h-${m}`,
      bottomRight: `W-w-${m}:H-h-${m}`,
      center: "(W-w)/2:(H-h)/2",
    }[p.position] || `W-w-${m}:H-h-${m}`;
    const after = [...effects, ...text, "setsar=1", "format=yuv420p"].join(",");
    const video = `${main};${inset};[main][inset]overlay=${pos}:eof_action=pass[base];[base]${after}[vout]`;
    return { graph: video + ";" + audio };
  }

  // 普通片段 / 静帧
  const base = `${segmentBase(seg, plan, W, H, FPS)},${geomFilter(seg, W, H, FPS)}`;
  const after = [...effects, ...text, "setsar=1", "format=yuv420p"].join(",");
  if (fit === "blurpad") {
    const fg = `scale=${W}:${H}:force_original_aspect_ratio=decrease`;
    video = `[0:v]${base},split=2[bg][fg];` +
      `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=30,eq=brightness=-0.08[bg2];` +
      `[fg]${fg}[fg2];[bg2][fg2]overlay=(W-w)/2:(H-h)/2[base2];[base2]${after}[vout]`;
  } else {
    video = `[0:v]${base},${fitFilter(fit, W, H)},${after}[vout]`;
  }
  return { graph: video + ";" + audio };
}

function buildSegment(seg, index, plan, opts) {
  const { W, H, FPS, workDir, textDir, hasAudio, source, srcW, srcH } = opts;
  const out = join(workDir, `seg_${String(index).padStart(3, "0")}.mp4`);
  const dur = seg.videoDuration;
  const args = [];
  let inputs;

  if (seg.kind === "still") {
    const png = join(workDir, `still_${String(index).padStart(3, "0")}.png`);
    const extract = ["-ss", String(seg.stillAt), "-i", source, "-frames:v", "1", "-y", png];
    inputs = ["-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", png];
    const { graph } = segmentGraph(seg, plan, { W, H, FPS, textDir, hasAudio: false, index, srcW, srcH });
    return { cmd: [...inputs, "-filter_complex", graph, "-map", "[vout]", "-map", "[aout]", "-t", String(dur), "-frames:v", String(Math.round(dur * FPS)), "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out], extract, out };
  }

  if (seg.kind === "grid") {
    inputs = [];
    for (const c of seg.grid.cells) inputs.push("-ss", String(c.start), "-t", String(c.end - c.start), "-i", source);
  } else if (seg.kind === "pip") {
    inputs = [
      "-ss", String(seg.start), "-t", String(seg.end - seg.start), "-i", source,
      "-ss", String(seg.pip.start), "-t", String(seg.pip.end - seg.pip.start), "-i", source,
    ];
  } else {
    inputs = ["-ss", String(seg.start), "-t", String(seg.end - seg.start), "-i", source];
  }

  const { graph } = segmentGraph(seg, plan, { W, H, FPS, textDir, hasAudio, index, srcW, srcH });
  return {
    cmd: [...inputs, "-filter_complex", graph, "-map", "[vout]", "-map", "[aout]", "-t", String(dur), "-frames:v", String(Math.round(dur * FPS)), "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out],
    out,
  };
}

function clampTransition(seg, prev) {
  if (!prev) return;
  const t = seg.transition;
  const max = Math.max(0.02, Math.min(0.5, prev.videoDuration * 0.4, seg.videoDuration * 0.4));
  if (t.duration > max) t.duration = Number(max.toFixed(3));
}

function buildAssembly(segments, files, plan, opts) {
  const { W, H, FPS, workDir, hasAudio } = opts;
  for (let i = 1; i < segments.length; i++) clampTransition(segments[i], segments[i - 1]);
  const { starts, total } = timeline(segments, MARGIN);
  const graph = [];
  let prevV = "[0:v]";

  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    const tr = s.transition.type === "cut" ? "fade" : s.transition.type;
    const off = starts[i];
    graph.push(`${prevV}[${i}:v]xfade=transition=${tr}:duration=${s.transition.duration}:offset=${off.toFixed(4)}[v${i}]`);
    prevV = `[v${i}]`;
  }

  // 音频时间轴：atrim/afade/adelay/amix（不用 acrossfade 链，47 段会挂）
  const ar = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const d = s.videoDuration;
    const lead = s.audioLead || 0;
    const lag = s.audioLag || 0;
    let astart = starts[i] - lead + lag;
    let trimStart = 0;
    if (astart < 0) {
      trimStart = -astart;
      astart = 0;
    }
    const avail = Math.max(0.02, d - trimStart);
    const fadeIn = s.transition && i ? Math.min(s.transition.duration, avail / 2) : 0;
    const fadeOut = i < segments.length - 1 ? Math.min(segments[i + 1].transition.duration, avail / 2) : 0;
    let a = `[${i}:a]atrim=${trimStart.toFixed(3)}:${(trimStart + avail).toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo`;
    if (fadeIn > 0) a += `,afade=t=in:st=0:d=${fadeIn.toFixed(3)}`;
    if (fadeOut > 0) a += `,afade=t=out:st=${Math.max(0, avail - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`;
    a += `,adelay=${Math.round(astart * 1000)}|${Math.round(astart * 1000)}[a${i}]`;
    ar.push(a);
  }
  ar.push(`${segments.map((_, i) => `[a${i}]`).join("")}amix=inputs=${segments.length}:normalize=0:duration=longest[amain]`);

  let sfxIdx = -1;
  if (plan.audio.sfx) {
    const events = sfxEvents(starts, segments);
    const wav = join(workDir, "sfx.wav");
    writeSfxFile(wav, total, events, plan.audio.sfxGain);
    sfxIdx = segments.length;
  }

  const grade = [];
  grade.push(`eq=contrast=${plan.grade.contrast}:saturation=${plan.grade.saturation}:brightness=${plan.grade.brightness}:gamma=${plan.grade.gamma}`);
  if (plan.grade.sharpen > 0) grade.push(`unsharp=5:5:${plan.grade.sharpen}:5:5:0`);
  if (plan.grade.vignette) grade.push("vignette=PI/5");
  if (plan.grade.grain > 0) grade.push(`noise=alls=${plan.grade.grain}:allf=t+u`);
  if (plan.grade.lut) grade.push(`lut3d=file=${plan.grade.lut}`);

  const overlays = [];
  if (plan.overlays.watermark) {
    overlays.push(...textFilters([{
      content: plan.overlays.watermark,
      size: Math.max(16, Math.round(H * 0.035)),
      position: plan.overlays.watermarkPosition,
      color: "white@0.35",
      border: 1,
      borderColor: "black@0.4",
      fadeIn: 0,
      fadeOut: 0,
      typewriter: null,
    }], { W, H, font: plan.font, dir: opts.textDir, duration: total }));
  }
  if (plan.overlays.banner) {
    overlays.push(...textFilters([{
      content: plan.overlays.banner,
      size: plan.overlays.bannerSize || Math.max(24, Math.round(W * 0.045)),
      x: "(w-text_w)/2",
      y: "24",
      color: "white@0.88",
      border: 0,
      box: true,
      boxColor: "black@0.45",
      fadeIn: 0,
      fadeOut: 0,
      typewriter: null,
    }], { W, H, font: plan.font, dir: opts.textDir, duration: total }));
  }
  if (plan.overlays.progressBar) {
    overlays.push(`drawbox=x=0:y=ih-5:w='iw*min(t/${total.toFixed(3)},1)':h=5:color=0xff2d55@0.9:t=fill`);
  }

  const post = [...grade, ...overlays].filter(Boolean).join(",");
  graph.push(`${prevV}${post},setsar=1,format=yuv420p[vout]`);
  graph.push(`${ar.join(";")}`);
  let aTail = "[amain]";
  if (sfxIdx >= 0) {
    graph.push(`[${sfxIdx}:a]aresample=44100,aformat=channel_layouts=stereo[asfx]`);
    graph.push(`[amain][asfx]amix=inputs=2:duration=first:normalize=0[amixed]`);
    aTail = "[amixed]";
  }
  if (plan.audio.loudnorm != null) {
    graph.push(`${aTail}loudnorm=I=${plan.audio.loudnorm}:TP=${plan.audio.truePeak}:LRA=11[aln]`);
    aTail = "[aln]";
  }
  if (plan.audio.fadeOut > 0) {
    graph.push(`${aTail}afade=t=out:st=${Math.max(0, total - plan.audio.fadeOut).toFixed(3)}:d=${plan.audio.fadeOut}[afo]`);
    aTail = "[afo]";
  }
  const limit = Math.pow(10, plan.audio.truePeak / 20);
  graph.push(`${aTail}alimiter=limit=${limit.toFixed(4)}:level=false[aout]`);

  const codec = plan.output.codec === "h265" ? "libx265" : "libx264";
  const args = [];
  for (const f of files) args.push("-i", f);
  if (sfxIdx >= 0) args.push("-i", join(workDir, "sfx.wav"));
  args.push(
    "-filter_complex", graph.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-t", total.toFixed(3), "-r", String(FPS),
    "-c:v", codec, "-preset", plan.output.preset, "-crf", String(plan.output.crf),
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart",
  );
  if (plan.output.codec === "h265") args.push("-tag:v", "hvc1");
  return { args, total, starts, graph: graph.join(";") };
}

export function render(plan, { out, dryRun = false, keepWork = false, workDir = null, source, hasAudio, srcW, srcH, log = () => {} }) {
  if (!plan.output || !plan.segments?.length) throw new PlanError(["plan 缺少 output 或 segments"]);
  const W = plan.output.width, H = plan.output.height, FPS = plan.output.fps;
  if (plan.output.codec === "h265" && !hasEncoder("libx265")) {
    throw new PlanError(["output.codec=h265 但当前 ffmpeg 没有 libx265 编码器"]);
  }
  const needs = new Set();
  if (plan.segments.length > 1) needs.add("xfade");
  if (plan.segments.some((s) => s.text?.length) || plan.overlays.watermark || plan.overlays.banner) needs.add("drawtext");
  if (plan.segments.some((s) => s.kenBurns)) needs.add("zoompan");
  if (plan.segments.some((s) => s.effects?.pixelize || s.transition?.type === "pixelize")) needs.add("pixelize");
  if (plan.segments.some((s) => s.grid)) needs.add("xstack");
  if (plan.segments.some((s) => s.pip)) needs.add("overlay");
  if (plan.segments.some((s) => s.effects?.glitch)) needs.add("rgbashift");
  if (plan.grade.lut) needs.add("lut3d");
  if (plan.grade.vignette) needs.add("vignette");
  const missing = [...needs].filter((f) => !hasFilter(f));
  if (missing.length) {
    throw new PlanError([`当前 ffmpeg 缺少滤镜：${missing.join("、")}（建议用 imageio-ffmpeg，或安装带 libfreetype/xfade 的 ffmpeg）`]);
  }
  const work = workDir || mkdtempSync(join(tmpdir(), "video-edit-"));
  const textDir = join(work, "text");
  mkdirSync(textDir, { recursive: true });
  const opts = { W, H, FPS, workDir: work, textDir, hasAudio, source, srcW, srcH };

  const files = [];
  const segmentCmds = [];
  for (let i = 0; i < plan.segments.length; i++) {
    const seg = plan.segments[i];
    const built = buildSegment(seg, i, plan, opts);
    if (!dryRun) {
      if (built.extract) run(built.extract, { label: `extract still #${i}` });
      run(built.cmd, { label: `segment #${i} ${seg.name}` });
      log(`✓ 段 ${i} ${seg.name}（${seg.videoDuration.toFixed(2)}s）`);
    }
    files.push(built.out);
    if (built.extract) segmentCmds.push(built.extract);
    segmentCmds.push(built.cmd);
  }

  const asm = buildAssembly(plan.segments, files, plan, { ...opts, textDir });
  asm.args.push(out);
  if (dryRun) {
    const result = {
      ok: true,
      dryRun: true,
      source,
      output: out,
      duration: Number(asm.total.toFixed(3)),
      segments: plan.segments.length,
      techniques: collectTechniques(plan),
      commands: [...segmentCmds, asm.args],
      assembly: asm.graph,
    };
    if (!keepWork && !workDir) rmSync(work, { recursive: true, force: true });
    return result;
  }

  run(asm.args, { label: "final encode" });
  if (!existsSync(out)) throw new Error(`未产出成片：${out}`);
  if (!keepWork && !workDir) rmSync(work, { recursive: true, force: true });
  return {
    ok: true,
    out,
    duration: Number(asm.total.toFixed(3)),
    segments: plan.segments.length,
    techniques: collectTechniques(plan),
    workDir: keepWork || workDir ? work : null,
  };
}

export { MARGIN };