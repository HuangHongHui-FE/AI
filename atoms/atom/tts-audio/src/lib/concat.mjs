// MP3 分块拼接：直接字节拼接，不依赖 ffmpeg
// 为什么能这么干：所有分块用**同一套编码参数**生成（voice/rate/format 相同），
// MP3 是帧序列格式，同参数帧直接首尾相接就能连续播放。
// 源实现用 ffmpeg concat，但本机实测 ffmpeg 未安装——去掉这个硬依赖才能「git 拉下来就能用」

import { readFileSync, writeFileSync } from "node:fs";

// 跳过 ID3v2 头：重复拼接时每块的 ID3 头会插在音频中间，多数播放器会卡顿或显示错乱
function stripId3(buf) {
  if (buf.length < 10) return buf;
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return buf; // 非 "ID3"
  // 同步安全整数：4 字节，每字节只用低 7 位
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const hasFooter = (buf[5] & 0x10) !== 0;
  return buf.slice(10 + size + (hasFooter ? 10 : 0));
}

// 拼接多个 MP3 文件到 outputPath，返回 { bytes, parts }
export function concatMp3(partPaths, outputPath) {
  if (!partPaths.length) throw new Error("没有可拼接的音频分块");
  if (partPaths.length === 1) {
    writeFileSync(outputPath, readFileSync(partPaths[0]));
    return { bytes: readFileSync(outputPath).length, parts: 1 };
  }
  // 第一块保留 ID3（元信息只用一份），其余块剥掉
  const bufs = partPaths.map((p, i) => {
    const b = readFileSync(p);
    return i === 0 ? b : stripId3(b);
  });
  const merged = Buffer.concat(bufs);
  writeFileSync(outputPath, merged);
  return { bytes: merged.length, parts: partPaths.length };
}

// 粗估时长：按 96kbps 单声道 MP3 计算（edge-tts 默认 audio-24khz-96kbitrate-mono-mp3）
// 这是估算值，用于「10 分钟播客」这类长度自检；精确时长需解码音频
export function estimateDurationSec(bytes, kbps = 96) {
  return Math.round((bytes * 8) / (kbps * 1000));
}
