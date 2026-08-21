import { config as dotenvConfig } from "dotenv";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 加载项目根目录 .env
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wechatImgRoot = process.env.WECHAT_IMG_ROOT || resolve(root, "../wechat-img");

// 统一配置出口
export const config = {
  // 路径
  root,
  wechatImgRoot: resolve(wechatImgRoot),
  episodesDir: resolve(process.env.EPISODES_DIR || join(root, "episodes")),
  logsDir: resolve(process.env.LOGS_DIR || join(root, "logs")),
  assetsDir: resolve(join(root, "assets")),
  defaultCoverImage: resolve(
    process.env.DEFAULT_COVER_IMAGE || join(root, "assets", "default-cover.jpg")
  ),

  // TTS
  tts: {
    voice: process.env.TTS_VOICE || "zh-CN-XiaoxiaoNeural",
    lang: process.env.TTS_LANG || "zh-CN",
    rate: process.env.TTS_RATE || "default",
    pitch: process.env.TTS_PITCH || "default",
    volume: process.env.TTS_VOLUME || "default",
    format: process.env.TTS_FORMAT || "audio-24khz-96kbitrate-mono-mp3",
    maxChunkChars: Number(process.env.TTS_MAX_CHUNK_CHARS || 1000),
    timeout: Number(process.env.TTS_TIMEOUT || 30000),
    proxy: process.env.TTS_PROXY || undefined,
  },

  // 音频外链
  audioBaseUrl: process.env.AUDIO_BASE_URL || undefined,
  audioUploadCmd: process.env.AUDIO_UPLOAD_CMD || undefined,

  // ffmpeg 路径（默认留空，audio.js 内部回退 ffmpeg-static）
  ffmpegPath: process.env.FFMPEG_PATH || undefined,
};

// 确保目录存在
export async function ensureDirs() {
  const { mkdir } = await import("node:fs/promises");
  for (const d of [config.episodesDir, config.logsDir, config.assetsDir]) {
    await mkdir(d, { recursive: true });
  }
}
