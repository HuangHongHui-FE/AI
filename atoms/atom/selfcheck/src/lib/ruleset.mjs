// 规则集合并：平台规则 extends 通用规则，按需覆盖；未覆盖的沿用通用值
// 平台规则里把某项设为 false 即关闭该检查（如头条不卡第一人称）

import { COMMON } from "../../references/common.mjs";

// 深合并：对象逐键合并，数组/标量整体覆盖（规则表要能整项替换，不做元素级拼接）
function merge(base, override) {
  if (override === false) return false;
  if (override === undefined || override === null) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return override;
  if (typeof override !== "object" || Array.isArray(override)) return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = merge(base[k], v);
  }
  return out;
}

// 把规则对象转成规则集：保留 extends 元信息，供报告里标注来源
export function buildRuleset(name, override = {}) {
  return { name, rules: merge(COMMON, override) };
}
