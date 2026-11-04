// 文字/花字 → drawtext。中文走 textfile，避免 filtergraph 转义地狱。
import { writeFileSync } from "node:fs";
import { join } from "node:path";

let seq = 0;

function color(c) {
  const s = String(c);
  return s.startsWith("#") ? `0x${s.slice(1)}` : s;
}

function pos(t, W, H) {
  const m = Math.round(Math.min(W, H) * 0.06);
  switch (t.position) {
    case "top": return { x: "(w-text_w)/2", y: `${m + 48}` };
    case "bottom": return { x: "(w-text_w)/2", y: `h-text_h-${m}` };
    case "topLeft": return { x: `${m}`, y: `${m}` };
    case "topRight": return { x: `w-text_w-${m}`, y: `${m}` };
    case "bottomLeft": return { x: `${m}`, y: `h-text_h-${m}` };
    case "bottomRight": return { x: `w-text_w-${m}`, y: `h-text_h-${m}` };
    default: return { x: "(w-text_w)/2", y: "(h-text_h)/2" };
  }
}

function alphaExpr(t, duration) {
  if (t.alpha) return t.alpha;
  const fi = t.fadeIn, fo = t.fadeOut;
  if (fi > 0 && fo > 0) {
    return `if(lt(t,${fi}),t/${fi},if(gt(t,${duration - fo}),max(0,(${duration}-t)/${fo}),1))`;
  }
  if (fi > 0) return `min(1,max(0,t/${fi}))`;
  if (fo > 0) return `min(1,max(0,(${duration}-t)/${fo}))`;
  return null;
}

function one(t, { W, H, font, dir, duration, enable }) {
  const p = pos(t, W, H);
  const size = t.size == null ? Math.max(18, Math.round(H * 0.09)) : t.size;
  const x = t.x ?? p.x;
  const y = t.y ?? p.y;
  const file = join(dir, `t${++seq}.txt`);
  writeFileSync(file, t.content, "utf8");
  const alpha = alphaExpr(t, duration);
  const en = enable ?? t.enable;
  const enExpr = Array.isArray(en) ? `between(t,${en[0]},${en[1]})` : en;
  const parts = [
    `drawtext=fontfile='${font}'`,
    `textfile='${file}'`,
    `fontsize=${size}`,
    `fontcolor=${color(t.color)}`,
    `borderw=${t.border}`,
    `bordercolor=${color(t.borderColor || "black")}`,
    `x='${x}'`,
    `y='${y}'`,
  ];
  if (t.box) parts.push("box=1", `boxcolor=${color(t.boxColor)}`, `boxborderw=${t.boxBorderW ?? 12}`);
  if (t.lineSpacing) parts.push(`line_spacing=${t.lineSpacing}`);
  if (alpha) parts.push(`alpha='${alpha}'`);
  if (enExpr) parts.push(`enable='${enExpr}'`);
  return parts.join(":");
}

export function textFilters(texts, ctx) {
  const out = [];
  for (const t of texts || []) {
    if (t.typewriter) {
      const chars = Array.from(t.content);
      const step = t.typewriter.step;
      for (let i = 1; i <= chars.length; i++) {
        const prefix = { ...t, content: chars.slice(0, i).join(""), typewriter: null };
        const start = ((i - 1) * step).toFixed(2);
        const en = i < chars.length
          ? `between(t,${start},${(i * step).toFixed(2)})`
          : `gte(t,${start})`;
        out.push(one(prefix, { ...ctx, enable: en }));
      }
    } else {
      out.push(one(t, ctx));
    }
  }
  return out;
}