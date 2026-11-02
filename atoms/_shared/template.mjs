// 步骤参数模板解析：让 recipe.json 能引用上一步产出、run 目录、用户输入
// 没有这层，recipe 只能硬编码参数，无法串联真实的原子链

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJson } from "./run-dir.mjs";

// 解析变量：{{runDir}} / {{step.NN-xxx}} / {{user.subject}} / {{env.NAME}} / {{outputs.<name>}}
// context = { runDir, steps: Map<atomId, stepDirPath>, user: {}, env: process.env }
export function resolveVars(value, ctx) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, expr) => {
    const [head, ...rest] = expr.split(".");
    if (head === "runDir") return ctx.runDir;
    if (head === "env") return ctx.env[rest.join(".")] ?? "";
    if (head === "user") return ctx.user[rest.join(".")] ?? "";
    if (head === "step") {
      // {{step.hotlist}} → 该步骤目录
      const p = ctx.steps.get(rest[0]);
      return p || "";
    }
    if (head === "outputs") {
      // {{outputs.hotlist}} → 该步骤目录里第一个同名产物路径
      const [atomId, file] = rest;
      const dir = ctx.steps.get(atomId);
      if (!dir) return "";
      return file ? join(dir, file) : dir;
    }
    return m; // 未知变量原样保留，便于发现拼错
  });
}

// 深解析：对象/数组递归，只处理字符串叶子
export function resolveDeep(obj, ctx) {
  if (typeof obj === "string") return resolveVars(obj, ctx);
  if (Array.isArray(obj)) return obj.map((x) => resolveDeep(x, ctx));
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveDeep(v, ctx)]));
  }
  return obj;
}

// 停手点：向用户要一个决定
// waitFor 支持 "prompt"（命令行提问）与 "file"（读预先写好的 decision.json，供 Claude 驱动时用）
export function waitForUser({ stepDir, stepId, mode, fields = [], ask }) {
  const decisionPath = join(stepDir, "user-decision.json");

  // file 模式：已有决定文件就直接用（Claude 在会话里替用户落盘）
  if (mode === "file") {
    if (existsSync(decisionPath)) {
      const d = JSON.parse(readFileSync(decisionPath, "utf8"));
      return { ok: true, decision: d };
    }
    return { ok: false, error: { code: "AWAITING_USER", message: `等待 ${stepId} 的用户决定，请写入 ${decisionPath}` } };
  }

  // prompt 模式：从 stdin 读（交互式）
  return { ok: false, error: { code: "AWAITING_USER", message: `${stepId} 需要用户决定，交互式输入未接入` } };
}

// 落用户决定
export function saveDecision(stepDir, decision) {
  writeJson(join(stepDir, "user-decision.json"), decision);
}
