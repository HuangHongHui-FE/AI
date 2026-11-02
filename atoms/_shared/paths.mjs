// 路径解析：保证任何机器、任何 cwd 下都能定位 atoms 根与 atom/recipe 目录，不写死绝对路径.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../atoms/_shared

// atoms 仓库根：$ATOM_HOME 优先，否则由 _shared 向上推导（_shared 的上一级）
export function atomsRoot() {
  if (process.env.ATOM_HOME) return resolve(process.env.ATOM_HOME);
  return resolve(HERE, "..");
}

// 向上查找某目录下是否存在标记目录，用于从任意子目录定位仓库根
export function findUp(startDir, marker = "atom") {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// 解析某个 atom 的目录，找不到直接抛错（让上层以 exit 2 处理）
export function atomDir(name) {
  const p = join(atomsRoot(), "atom", name);
  if (!existsSync(p)) throw new Error(`atom 不存在：${name}（期望路径 ${p}）`);
  return p;
}

// 解析某个 recipe 的目录
export function recipeDir(name) {
  const p = join(atomsRoot(), "recipe", name);
  if (!existsSync(p)) throw new Error(`recipe 不存在：${name}（期望路径 ${p}）`);
  return p;
}

// 留痕根目录：$RUNS_DIR 优先，默认 atoms/runs
export function runsRoot() {
  const env = process.env.RUNS_DIR;
  return env ? resolve(env) : join(atomsRoot(), "runs");
}

// 所有业务路径先过这里，避免 atom 内出现相对 cwd 的裸路径
export function abs(p, base = process.cwd()) {
  return resolve(base, p);
}
