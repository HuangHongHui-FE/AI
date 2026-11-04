// 纯 Node 合成转场音效（whoosh/boom/riser/glitch），不依赖 numpy。
import { writeFileSync } from "node:fs";

const SR = 44100;

function env(n, attack = 0.01, release = 0.08) {
  const e = new Float32Array(n).fill(1);
  const a = Math.max(1, Math.floor(attack * SR));
  const r = Math.max(1, Math.floor(release * SR));
  for (let i = 0; i < a && i < n; i++) e[i] = i / a;
  for (let i = 0; i < r && i < n; i++) e[n - 1 - i] *= i / r;
  return e;
}

function whoosh(d = 0.3) {
  const n = Math.floor(SR * d);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  // 简单低通
  const k = 12;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += x[i];
    if (i >= k) sum -= x[i - k];
    x[i] = sum / k;
  }
  const e = env(n, 0.02, d * 0.5);
  for (let i = 0; i < n; i++) x[i] *= e[i] * (0.5 + 0.5 * Math.sin(Math.PI * i / n));
  return x;
}

function boom(d = 0.55) {
  const n = Math.floor(SR * d);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = (0.8 * Math.sin(2 * Math.PI * 52 * t) + 0.3 * Math.sin(2 * Math.PI * 104 * t)) * Math.exp(-6.5 * t);
  }
  return x;
}

function riser(d = 0.9) {
  const n = Math.floor(SR * d);
  const x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 180 + 900 * Math.pow(t / d, 1.6);
    phase += (2 * Math.PI * f) / SR;
    x[i] = (0.55 * Math.sin(phase) + 0.35 * (Math.random() * 2 - 1)) * Math.pow(t / d, 1.5);
  }
  return x;
}

function glitch(d = 0.12) {
  const n = Math.floor(SR * d);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const gate = Math.sin((2 * Math.PI * 55 * i) / SR) > 0 ? 1 : 0;
    x[i] = (Math.random() * 2 - 1) * gate * Math.sin((Math.PI * i) / n);
  }
  return x;
}

const GEN = { whoosh, boom, riser, glitch };

export function buildSfx(totalSec, events, gain = 1) {
  const n = Math.ceil((totalSec + 0.5) * SR);
  const mix = new Float32Array(n);
  for (const e of events) {
    const gen = GEN[e.type];
    if (!gen) continue;
    const sig = gen(e.duration);
    const start = Math.max(0, Math.floor(e.at * SR));
    const g = (e.gain ?? 0.3) * gain;
    for (let i = 0; i < sig.length && start + i < n; i++) mix[start + i] += sig[i] * g;
  }
  // 软限幅
  for (let i = 0; i < n; i++) mix[i] = Math.tanh(mix[i] * 1.2) * 0.9;
  return mix;
}

export function writeSfxFile(file, totalSec, events, gain = 1) {
  const mix = buildSfx(totalSec, events, gain);
  const dataBytes = mix.length * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  let off = 44;
  for (let i = 0; i < mix.length; i++) {
    const v = Math.max(-1, Math.min(1, mix[i]));
    const s = Math.round(v * 32767);
    buf.writeInt16LE(s, off);
    buf.writeInt16LE(s, off + 2);
    off += 4;
  }
  writeFileSync(file, buf);
  return file;
}

export function sfxEvents(starts, segments) {
  const events = [];
  for (let i = 1; i < starts.length; i++) {
    events.push({ type: "whoosh", at: Math.max(0, starts[i] - 0.03), gain: 0.16, duration: 0.22 });
  }
  segments.forEach((s, i) => {
    const at = starts[i];
    if (/title|card|end/i.test(s.name) || i === 0) events.push({ type: "boom", at, gain: 0.4, duration: 0.55 });
    if (s.effects?.glitch) events.push({ type: "glitch", at, gain: 0.22, duration: 0.14 });
  });
  events.push({ type: "boom", at: Math.max(0, starts[starts.length - 1]), gain: 0.4, duration: 0.6 });
  return events;
}