import Vision
import Foundation

// 用法: swift ocr.swift img1.jpg img2.jpg ...
// macOS 原生 Vision OCR，逐张提取图片中的文字。供「贴图发布」skill 第4步使用。
let args = CommandLine.arguments.dropFirst()
for path in args {
  let url = URL(fileURLWithPath: String(path))
  print("### \(url.lastPathComponent)")
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["zh-Hans", "zh-Hant", "en"]
  let h = VNImageRequestHandler(url: url)
  try? h.perform([req])
  let lines = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }
  print(lines.isEmpty ? "(无文字)" : lines.joined(separator: "\n"))
  print()
}
