// 持仓分析：把基金持仓逐只映射到预测板块，估算今日/次日盈亏并给调仓建议
import { matchSector } from "./mapping.mjs";

const FALLBACK = { dir: "△", conf: "L", score: -0.3, estPct: -0.5, risk: "无明确映射" };

export function adviceFor(score) {
  if (score <= -1.0) return "⚠️ 强烈建议减仓";
  if (score <= -0.5) return "🔻 建议减仓";
  if (score >= 0.5) return "🔺 可加仓";
  if (score >= 0.2) return "✅ 持有观望";
  if (score >= -0.3) return "➖ 持有/微调";
  return "🔸 谨慎持有";
}

// 持仓条目 → 逐只分析
export function analyze(holdings, forecast, { decay = 0.6, nextLabel = "次日" } = {}) {
  const funds = holdings.map((h) => {
    const sector = matchSector(h.name);
    const fc = forecast[sector] || FALLBACK;
    const todayEstPnl = (h.amount * fc.estPct) / 100;
    const nextEstPct = fc.estPct * decay;
    return {
      ...h,
      sector,
      forecastDir: fc.dir,
      forecastConf: fc.conf,
      forecastScore: fc.score,
      estPct: fc.estPct,
      todayEstPnl,
      nextEstPct,
      nextEstPnl: (h.amount * nextEstPct) / 100,
      risk: fc.risk,
    };
  });

  const totalAmount = funds.reduce((s, h) => s + h.amount, 0);
  const totalPnl = funds.reduce((s, h) => s + h.pnl, 0);
  const totalToday = funds.reduce((s, h) => s + h.todayEstPnl, 0);
  const totalNext = funds.reduce((s, h) => s + h.nextEstPnl, 0);

  const sectorMap = {};
  for (const h of funds) {
    const s = (sectorMap[h.sector] ||= { sector: h.sector, amount: 0, pnl: 0, count: 0, todayEstPnl: 0, nextEstPnl: 0 });
    s.amount += h.amount;
    s.pnl += h.pnl;
    s.count++;
    s.todayEstPnl += h.todayEstPnl;
    s.nextEstPnl += h.nextEstPnl;
  }
  const sectors = Object.values(sectorMap)
    .map((s) => {
      const fc = forecast[s.sector] || FALLBACK;
      return {
        ...s,
        pct: totalAmount ? (s.amount / totalAmount) * 100 : 0,
        dir: fc.dir,
        conf: fc.conf,
        score: fc.score,
        advice: adviceFor(fc.score),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const reduce = sectors.filter((s) => s.score <= -0.8 && s.amount > 100);
  const add = sectors.filter((s) => s.score >= 0.3 && s.sector !== "债券");
  const top3 = sectors.slice(0, 3);
  const top3Pct = totalAmount ? (top3.reduce((s, x) => s + x.amount, 0) / totalAmount) * 100 : 0;

  return {
    ok: true,
    totals: {
      amount: totalAmount,
      pnl: totalPnl,
      pct: totalAmount - totalPnl ? (totalPnl / (totalAmount - totalPnl)) * 100 : 0,
      today_est_pnl: totalToday,
      next_est_pnl: totalNext,
      next_label: nextLabel,
    },
    funds: [...funds].sort((a, b) => b.amount - a.amount),
    sectors,
    advice: { reduce, add },
    concentration: { top3: top3.map((s) => s.sector), top3_pct: top3Pct },
  };
}

export function renderMarkdown(res) {
  const money = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
  const lines = [];
  lines.push("# 基金持仓分析与调仓建议");
  lines.push("");
  lines.push(`- 总持仓金额：¥${res.totals.amount.toFixed(2)}`);
  lines.push(`- 累计盈亏：¥${money(res.totals.pnl)}（${res.totals.pct.toFixed(2)}%）`);
  lines.push(`- 今日预估盈亏：¥${money(res.totals.today_est_pnl)}`);
  lines.push(`- ${res.totals.next_label}预估盈亏：¥${money(res.totals.next_est_pnl)}`);
  lines.push("");
  lines.push("## 逐基金");
  lines.push("");
  lines.push("| 基金 | 持有金额 | 盈亏 | 收益率 | 板块 | 预测 | 今日预估 |");
  lines.push("|---|---:|---:|---:|---|---|---:|");
  for (const f of res.funds) {
    lines.push(
      `| ${f.name} | ${f.amount.toFixed(0)} | ${money(f.pnl)} | ${f.pct.toFixed(2)}% | ${f.sector} | ${f.forecastDir}${f.forecastConf} | ${money(f.todayEstPnl)} |`,
    );
  }
  lines.push("");
  lines.push("## 板块汇总");
  lines.push("");
  lines.push("| 板块 | 持仓金额 | 占比 | 累计盈亏 | 方向 | 置信 | 调仓建议 |");
  lines.push("|---|---:|---:|---:|---|---|---|");
  for (const s of res.sectors) {
    lines.push(
      `| ${s.sector} | ${s.amount.toFixed(0)} | ${s.pct.toFixed(1)}% | ${money(s.pnl)} | ${s.dir} | ${s.conf} | ${s.advice} |`,
    );
  }
  lines.push("");
  lines.push("## 建议");
  lines.push("");
  lines.push(`- 减仓方向：${res.advice.reduce.map((s) => s.sector).join("、") || "无"}`);
  lines.push(`- 加仓/持有方向：${res.advice.add.map((s) => s.sector).join("、") || "无"}`);
  lines.push(`- 前 3 大板块占比：${res.concentration.top3_pct.toFixed(1)}%（${res.concentration.top3.join(" / ")}）`);
  lines.push("");
  lines.push("> 方向性预估，非投资建议。实际收益受盘中波动、隔夜外盘、地缘事件影响。");
  return lines.join("\n") + "\n";
}