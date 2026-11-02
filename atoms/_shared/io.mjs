// 统一 JSON 输出与退出码：atom 的 stdout 只放结构化结果，人读信息走 stderr
// 退出码约定：0 成功 / 1 业务失败（如 selfcheck FAIL）/ 2 参数或环境错误

export const EXIT = { OK: 0, BIZ: 1, ENV: 2 };

// 输出结构化结果到 stdout 并结束进程
export function emit(obj, code = EXIT.OK) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(code);
}

// 输出人读信息到 stderr（不污染 stdout 的 JSON）
export function log(msg) {
  process.stderr.write(String(msg) + "\n");
}

// 参数或环境错误：打印原因并以 exit 2 结束
export function fail(msg) {
  log(`[ERROR] ${msg}`);
  process.exit(EXIT.ENV);
}

// 业务失败：still 输出结果对象，但以 exit 1 结束，便于 recipe 判定
export function bizFail(obj, msg) {
  if (msg) log(`[FAIL] ${msg}`);
  emit(obj, EXIT.BIZ);
}

// 解析 --key value 与 --flag 形式的参数；位置参数收进 _
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}
