# 从抖音视频均匀截帧
import imageio.v3 as iio
import os, numpy as np
os.makedirs('douyin_frames', exist_ok=True)
# 读视频元数据
meta = iio.immeta('douyin_video.mp4')
print("meta:", {k:meta[k] for k in ('fps','duration','n_images','shape') if k in meta})
frames = iio.imread('douyin_video.mp4', index=None)  # 读全部帧
print("总帧数:", len(frames))
n = len(frames)
# 均匀取8帧(避开首尾各5%)
pick = [n*i//9 for i in range(1,9)]
print("选取索引:", pick)
for i, idx in enumerate(pick, 1):
    fr = frames[idx]
    h, w = fr.shape[:2]
    out = f'douyin_frames/frame_{i:02d}.jpg'
    # 垂直长图聊天截图:整帧保存
    iio.imwrite(out, fr, quality=92)
    print(f"{out} {w}x{h} {os.path.getsize(out)}B")
