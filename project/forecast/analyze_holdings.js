const fs = require('fs');

// ========== 1. 基金持仓数据 ==========
const holdingsRaw = `易方达环保主题灵活配置混合 C｜97105.51｜-3263.49｜-3.61%
华夏上证科创板半导体材料设备｜52162.05｜-8019.31｜-13.33%
东方人工智能主题混合 C｜24898.45｜-2101.55｜-7.78%
华泰柏瑞科创半导体材料设备｜22688.07｜-2311.93｜-9.25%
天弘北证 50 成份指数 C｜19593.59｜-2406.41｜-12.03%
嘉实中证机器人 ETF 联接 C｜14264.20｜-632.16｜-4.91%
易方达产业优选混合 C｜13742.71｜-517.42｜-7.06%
大成科技创新混合 C｜11617.25｜-3449.68｜-22.90%
东方阿尔法科技智选混合 C｜11150.26｜-3849.74｜-25.66%
东方阿尔法精选灵活配置混合 C｜9673.77｜-1030.09｜-9.62%
华夏全球科技先锋混合 (QDII) C｜6763.69｜-834.99｜-10.99%
易方达恒生科技 ETF 联接 (QDII) C｜5203.81｜+3.81｜+1.91%
嘉实国证绿色电力 ETF 联接 C｜997.75｜0.00｜0.00%
招商体育文化休闲股票 C｜500.00｜0.00｜0.00%
天弘全球高端制造混合 (QDII) C｜202.02｜+11.11｜+5.82%
兴业中证港股通互联网 ETF 联接 C｜188.27｜-11.94｜-5.97%
国泰黄金 ETF 联接 C｜175.77｜-24.80｜-12.36%
华夏中证动漫游戏 ETF 联接 D｜150.15｜-26.64｜-15.07%
富国中证煤炭指数 C｜135.04｜+6.59｜+5.13%
鹏华中证传媒指数 (LOF) C｜133.20｜-11.84｜-8.17%
国泰中证畜牧养殖 ETF 联接 C｜115.28｜+12.73｜+12.42%
广发全球精选股票 (QDII) C｜114.29｜+28.68｜+33.51%
大成纳斯达克 100ETF 联接｜111.71｜+11.74｜+11.75%
长盛城镇化主题混合 C｜100.00｜0.00｜0.00%
浦银安盛全球智能科技股票｜95.79｜+27.41｜+40.09%
银华海外数字经济量化选股混合｜92.20｜+20.00｜+27.71%
华夏中证机床 ETF 联接 C｜88.97｜-21.03｜-19.12%
富国中证电池主题 ETF 联接 C｜86.16｜-30.35｜-26.05%
长城全球新能源汽车股票 (QDII)｜76.30｜+15.03｜+24.53%
易方达证券 ETF 联接 C｜75.83｜+0.77｜+1.03%
招商中证半导体产业 ETF 联接 C｜57.08｜+10.47｜+22.46%
大成创业板人工智能 ETF 联接 C｜28.03｜-2.05｜-6.80%
嘉实中证稀土产业 ETF 联接 C｜22.07｜-0.69｜-3.03%
创金合信全球医药生物股票｜11.17｜+1.17｜+11.70%
国泰半导体设备 ETF 联接 C｜11.16｜+1.16｜+11.64%
大摩数字经济混合 C｜11.11｜+1.11｜+11.13%
国融融盛龙头严选混合 C｜10.94｜+0.94｜+9.35%
博时中证全指通信设备指数 C｜10.28｜-1.51｜-12.71%
华夏人工智能 ETF 联接 D｜10.14｜+0.14｜+1.41%
鹏华香港银行指数 C｜10.08｜+0.08｜+0.76%
博时标普石油天然气勘探及生产｜9.73｜-0.27｜-2.68%
国泰中证油气产业 ETF 联接 C｜9.29｜-1.07｜-10.37%
天弘中证光伏产业指数 C｜7.57｜-2.43｜-24.30%
南方原油 (QDII-FOF) C｜0.76｜+0.24｜+46.62%
南方万债 7 年国开行债券指数｜19.76｜+1.84｜+10.64%`;

// 解析持仓
const holdings = holdingsRaw.split('\n').map(line => {
  const [name, amount, pnl, pct] = line.split('｜');
  return {
    name: name.trim(),
    amount: parseFloat(amount),
    pnl: parseFloat(pnl),
    pct: parseFloat(pct.replace('%', ''))
  };
});

// ========== 2. 板块映射（基金名称关键词 → forecast板块） ==========
// 基于 20260717-0005 预测结果
const forecastData = {
  '半导体':        { code: '159995', dir: '▼', conf: 'H', score: -1.75, estPct: -3.0, risk: '费半-3.89%+机构265亿派发,破位下行' },
  'CPO/通信':      { code: '515880', dir: '▼', conf: 'H', score: -1.75, estPct: -2.5, risk: '费半拖累+机构115亿派发' },
  'AI算力/AI':     { code: '159819', dir: '▼', conf: 'M', score: -1.00, estPct: -1.5, risk: '费半拖累,但机构分歧跌幅或收敛' },
  'AI应用/软件':   { code: '515990', dir: '△', conf: 'L', score: -0.35, estPct: -0.5, risk: '机构吸筹+科大讯飞略增,或抗跌' },
  '消费电子':      { code: '159732', dir: '▼', conf: 'M', score: -1.05, estPct: -1.5, risk: '费半拖累,Apple预期部分对冲' },
  '机器人':        { code: '159770', dir: '▼', conf: 'L', score: -0.55, estPct: -1.0, risk: '纳指拖累,Tesla前资金或活跃' },
  '新能源车':      { code: '515030', dir: '▼', conf: 'M', score: -0.88, estPct: -1.5, risk: '长安-67%+机构25亿派发' },
  '光伏':          { code: '515790', dir: '▼', conf: 'M', score: -0.88, estPct: -1.5, risk: '通威略减+无利好延续弱势' },
  '创新药A股':     { code: '515120', dir: '▼', conf: 'L', score: -0.53, estPct: -0.5, risk: '放量十字星,方向待选' },
  '科创50':        { code: '588000', dir: '▼', conf: 'H', score: -1.75, estPct: -3.0, risk: '半导体集中杀跌,破位' },
  '创业板50':      { code: '159949', dir: '▼', conf: 'M', score: -1.00, estPct: -1.5, risk: '跟随科创' },
  '中证500':       { code: '510500', dir: '▼', conf: 'M', score: -0.83, estPct: -1.0, risk: '放量流出,跟随大盘' },
  '中证1000':      { code: '560010', dir: '▼', conf: 'M', score: -0.83, estPct: -1.0, risk: '小盘波动' },
  '医药医疗':      { code: '512170', dir: '△', conf: 'L', score: +0.03, estPct: +0.3, risk: '逆势涨但机构派发,避险表象出货' },
  '食品饮料':      { code: '515170', dir: '△', conf: 'L', score: +0.38, estPct: +0.5, risk: '五粮液+89%+避险防御,偏多但缩量' },
  '银行':          { code: '512800', dir: '▼', conf: 'L', score: -0.73, estPct: -0.5, risk: '机构14亿派发,避险或限跌幅' },
  '券商':          { code: '512000', dir: '▼', conf: 'M', score: -0.88, estPct: -1.5, risk: '情绪弱+机构34亿派发' },
  '军工':          { code: '512660', dir: '▼', conf: 'L', score: -0.68, estPct: -0.5, risk: '地缘利好但沈飞-58%+机构派发拖累' },
  '有色金属':      { code: '512400', dir: '△', conf: 'L', score: -0.43, estPct: 0.0, risk: '黄金地缘利好,稀土派发,分化' },
  '煤炭':          { code: '515220', dir: '▼', conf: 'L', score: -0.60, estPct: -0.5, risk: '地缘避险或抗跌' },
  '钢铁':          { code: '515210', dir: '△', conf: 'L', score: -0.40, estPct: 0.0, risk: '跟随周期' },
  '房地产':        { code: '512200', dir: '△', conf: 'L', score: +0.43, estPct: +0.5, risk: '机构吸筹vs龙头预减背离' },
  '农业/畜牧':     { code: '159825', dir: '△', conf: 'L', score: +0.18, estPct: +0.3, risk: '防御vs龙头预减,净震荡' },
  '稀土永磁':      { code: '159711', dir: '△', conf: 'L', score: +0.13, estPct: +0.3, risk: '预增+地缘利好,但机构派发=背离' },
  '红利低波':      { code: '515080', dir: '▼', conf: 'L', score: -0.68, estPct: -0.5, risk: '避险属性或逆势抗跌' },
  '港股创新药':    { code: '513120', dir: '▼', conf: 'M', score: -1.15, estPct: -2.0, risk: '巨量分歧,短期承压' },
  '恒生科技':      { code: '513130', dir: '△', conf: 'L', score: +0.15, estPct: +0.3, risk: '美股跌+地缘,今日承压回吐' },
  '港股互联网':    { code: '513330', dir: '▲', conf: 'M', score: +0.75, estPct: +1.0, risk: '财报催化看涨,但美股+地缘中概承压涨幅收敛' },
  '恒生红利':      { code: '513080', dir: '△', conf: 'L', score: +0.05, estPct: 0.0, risk: '流动性小' },
  '港股金融':      { code: '513190', dir: '△', conf: 'L', score: -0.25, estPct: -0.3, risk: '中性' },
  '北证50':        { code: '899050', dir: '▼', conf: 'M', score: -0.83, estPct: -1.5, risk: '跟随小盘,流动性弱' },
  '动漫游戏/传媒': { code: '159869', dir: '▼', conf: 'L', score: -0.55, estPct: -1.0, risk: 'AI应用分支,跟随AI但偏弱' },
  '绿色电力':      { code: '159611', dir: '△', conf: 'L', score: -0.40, estPct: 0.0, risk: '防御属性,波动小' },
  'QDII全球科技':  { code: 'QDII', dir: '▼', conf: 'M', score: -1.00, estPct: -1.5, risk: '美股暴跌(纳指-1.19%),今夜美股或续跌' },
  'QDII纳斯达克':  { code: 'QDII', dir: '▼', conf: 'M', score: -1.00, estPct: -1.5, risk: '纳指-1.19%,今夜美股不确定性' },
  'QDII全球':      { code: 'QDII', dir: '▼', conf: 'L', score: -0.50, estPct: -0.8, risk: '美股拖累+地缘风险' },
  'QDII高端制造':  { code: 'QDII', dir: '▼', conf: 'L', score: -0.50, estPct: -0.8, risk: '费半拖累全球制造' },
  'QDII新能源车':  { code: 'QDII', dir: '▼', conf: 'L', score: -0.50, estPct: -0.8, risk: '全球新能源车情绪偏弱' },
  'QDII医药':      { code: 'QDII', dir: '▼', conf: 'L', score: -0.53, estPct: -0.5, risk: '纳指生物科技拖累' },
  '黄金':          { code: '518880', dir: '▲', conf: 'M', score: +0.75, estPct: +1.0, risk: '地缘冲突+避险,黄金看涨' },
  '石油/油气':     { code: '159697', dir: '▲', conf: 'M', score: +0.50, estPct: +0.8, risk: '地缘冲突油价上涨' },
  '债券':          { code: '债券', dir: '△', conf: 'H', score: +0.10, estPct: +0.01, risk: '避险资金流入,极低波动' },
  '机床':          { code: '159663', dir: '▼', conf: 'L', score: -0.55, estPct: -1.0, risk: '跟随机器人/制造板块' },
  '电池':          { code: '561910', dir: '▼', conf: 'M', score: -0.88, estPct: -1.5, risk: '新能源产业链,长安-67%拖累' },
  '数字经济':      { code: '159658', dir: '▼', conf: 'L', score: -0.55, estPct: -0.8, risk: 'AI分支,跟随大盘偏弱' },
};

// 基金关键词映射
const fundMapping = [
  // 大仓位基金
  { keywords: ['环保主题'], sector: '新能源车' }, // 环保主题通常偏新能源
  { keywords: ['科创板半导体', '科创半导体'], sector: '半导体' },
  { keywords: ['人工智能主题', '人工智能ETF'], sector: 'AI算力/AI' },
  { keywords: ['北证50'], sector: '北证50' },
  { keywords: ['机器人'], sector: '机器人' },
  { keywords: ['产业优选'], sector: '中证500' }, // 混合型偏宽基
  { keywords: ['科技创新'], sector: '科创50' },
  { keywords: ['科技智选'], sector: 'AI算力/AI' },
  { keywords: ['精选灵活配置'], sector: '中证1000' },
  { keywords: ['全球科技先锋'], sector: 'QDII全球科技' },
  { keywords: ['恒生科技'], sector: '恒生科技' },
  { keywords: ['绿色电力'], sector: '绿色电力' },
  { keywords: ['体育文化'], sector: '动漫游戏/传媒' },
  { keywords: ['全球高端制造'], sector: 'QDII高端制造' },
  { keywords: ['港股通互联网', '港股互联网'], sector: '港股互联网' },
  { keywords: ['黄金'], sector: '黄金' },
  { keywords: ['动漫游戏'], sector: '动漫游戏/传媒' },
  { keywords: ['煤炭'], sector: '煤炭' },
  { keywords: ['传媒'], sector: '动漫游戏/传媒' },
  { keywords: ['畜牧养殖'], sector: '农业/畜牧' },
  { keywords: ['全球精选股票'], sector: 'QDII全球' },
  { keywords: ['纳斯达克100'], sector: 'QDII纳斯达克' },
  { keywords: ['城镇化'], sector: '房地产' },
  { keywords: ['全球智能科技'], sector: 'QDII全球科技' },
  { keywords: ['海外数字经济'], sector: 'QDII全球科技' },
  { keywords: ['机床'], sector: '机床' },
  { keywords: ['电池'], sector: '电池' },
  { keywords: ['全球新能源汽车'], sector: 'QDII新能源车' },
  { keywords: ['证券ETF'], sector: '券商' },
  { keywords: ['半导体产业ETF', '半导体设备ETF'], sector: '半导体' },
  { keywords: ['创业板人工智能'], sector: 'AI算力/AI' },
  { keywords: ['稀土'], sector: '稀土永磁' },
  { keywords: ['全球医药生物'], sector: 'QDII医药' },
  { keywords: ['数字经济'], sector: '数字经济' },
  { keywords: ['龙头严选'], sector: '中证500' },
  { keywords: ['通信设备'], sector: 'CPO/通信' },
  { keywords: ['香港银行'], sector: '港股金融' },
  { keywords: ['石油天然气', '标普石油'], sector: '石油/油气' },
  { keywords: ['油气产业'], sector: '石油/油气' },
  { keywords: ['光伏产业'], sector: '光伏' },
  { keywords: ['原油'], sector: '石油/油气' },
  { keywords: ['国开行债券', '万债'], sector: '债券' },
];

// 匹配基金到板块
function matchSector(fundName) {
  for (const m of fundMapping) {
    for (const kw of m.keywords) {
      if (fundName.includes(kw)) return m.sector;
    }
  }
  // 默认
  if (fundName.includes('QDII') || fundName.includes('全球')) return 'QDII全球';
  if (fundName.includes('混合') || fundName.includes('灵活')) return '中证500';
  return '中证500';
}

// 为每只基金匹配板块和预测
const analyzed = holdings.map(h => {
  const sector = matchSector(h.name);
  const fc = forecastData[sector] || { dir: '△', conf: 'L', score: -0.3, estPct: -0.5, risk: '无明确映射' };
  // 今日预估收益 = 持仓金额 * 预估涨跌幅
  const todayEstPnl = h.amount * fc.estPct / 100;
  // 后天预估(基于趋势延续,假设同样方向但幅度减半,周末不确定)
  const afterTomorrowEstPct = fc.estPct * 0.6; // 趋势延续但衰减
  const afterTomorrowEstPnl = h.amount * afterTomorrowEstPct / 100;
  return {
    ...h,
    sector,
    forecastDir: fc.dir,
    forecastConf: fc.conf,
    forecastScore: fc.score,
    estPct: fc.estPct,
    todayEstPnl,
    afterTomorrowEstPct,
    afterTomorrowEstPnl,
    risk: fc.risk
  };
});

// ========== 3. 汇总统计 ==========
const totalAmount = analyzed.reduce((s, h) => s + h.amount, 0);
const totalPnl = analyzed.reduce((s, h) => s + h.pnl, 0);
const totalTodayEstPnl = analyzed.reduce((s, h) => s + h.todayEstPnl, 0);
const totalAfterTomorrowEstPnl = analyzed.reduce((s, h) => s + h.afterTomorrowEstPnl, 0);

// 按板块汇总
const sectorSummary = {};
analyzed.forEach(h => {
  if (!sectorSummary[h.sector]) {
    sectorSummary[h.sector] = { amount: 0, pnl: 0, count: 0, todayEstPnl: 0, afterTomorrowEstPnl: 0 };
  }
  sectorSummary[h.sector].amount += h.amount;
  sectorSummary[h.sector].pnl += h.pnl;
  sectorSummary[h.sector].count += 1;
  sectorSummary[h.sector].todayEstPnl += h.todayEstPnl;
  sectorSummary[h.sector].afterTomorrowEstPnl += h.afterTomorrowEstPnl;
});

// ========== 4. 输出报告 ==========
console.log('='.repeat(80));
console.log('  基 金 持 仓 分 析 与 调 仓 建 议');
console.log('='.repeat(80));
console.log(`  分析日期：2026-07-17（周五）`);
console.log(`  预测来源：forecast 20260717-0005（今日盘前预测）`);
console.log(`  总持仓金额：¥${totalAmount.toFixed(2)}`);
console.log(`  累计盈亏：¥${totalPnl.toFixed(2)}`);
console.log(`  累计收益率：${(totalPnl / (totalAmount - totalPnl) * 100).toFixed(2)}%`);
console.log(`  今日预估盈亏：¥${totalTodayEstPnl.toFixed(2)}`);
console.log(`  下周一(7/20)预估盈亏：¥${totalAfterTomorrowEstPnl.toFixed(2)}`);
console.log('');

// 按仓位大小排序输出
console.log('─'.repeat(80));
console.log('【逐基金分析】');
console.log('─'.repeat(80));

// 按持有金额降序排列
const sorted = [...analyzed].sort((a, b) => b.amount - a.amount);

// 分三类：大仓位(>1万)、中仓位(1k-1万)、观察仓(<1k)
const largePos = sorted.filter(h => h.amount >= 10000);
const midPos = sorted.filter(h => h.amount >= 1000 && h.amount < 10000);
const smallPos = sorted.filter(h => h.amount < 1000);

function printGroup(title, funds) {
  console.log(`\n${title}（${funds.length}只）`);
  console.log('─'.repeat(80));
  console.log(
    '基金名称'.padEnd(28) +
    '持有金额'.padStart(10) +
    '盈亏'.padStart(10) +
    '收益率'.padStart(8) +
    '映射板块'.padStart(12) +
    '预测'.padStart(4) +
    '置信'.padStart(4) +
    '今日预估'.padStart(10) +
    '7/20预估'.padStart(10)
  );
  console.log('─'.repeat(80));

  funds.forEach(h => {
    const dirIcon = h.forecastDir;
    console.log(
      h.name.slice(0, 26).padEnd(28) +
      h.amount.toFixed(0).padStart(10) +
      h.pnl.toFixed(0).padStart(10) +
      (h.pct >= 0 ? '+' : '') + h.pct.toFixed(2) + '%'.padStart(6) +
      h.sector.padStart(12) +
      dirIcon.padStart(4) +
      h.forecastConf.padStart(4) +
      h.todayEstPnl.toFixed(0).padStart(10) +
      h.afterTomorrowEstPnl.toFixed(0).padStart(10)
    );
  });

  const subTotal = funds.reduce((s, h) => s + h.amount, 0);
  const subPnl = funds.reduce((s, h) => s + h.pnl, 0);
  const subToday = funds.reduce((s, h) => s + h.todayEstPnl, 0);
  const subAfter = funds.reduce((s, h) => s + h.afterTomorrowEstPnl, 0);
  console.log('─'.repeat(80));
  console.log(
    '小计'.padEnd(28) +
    subTotal.toFixed(0).padStart(10) +
    subPnl.toFixed(0).padStart(10) +
    (subPnl / (subTotal - subPnl) * 100).toFixed(2) + '%'.padStart(6) +
    ''.padStart(12) +
    ''.padStart(4) +
    ''.padStart(4) +
    subToday.toFixed(0).padStart(10) +
    subAfter.toFixed(0).padStart(10)
  );
}

printGroup('📊 大仓位基金（≥1万元）', largePos);
printGroup('📊 中仓位基金（1千~1万元）', midPos);
printGroup('📊 观察仓（<1千元）', smallPos);

// 板块汇总
console.log('\n\n' + '='.repeat(80));
console.log('【板块汇总 & 调仓建议】');
console.log('='.repeat(80));

const sectorSorted = Object.entries(sectorSummary)
  .sort((a, b) => b[1].amount - a[1].amount);

console.log(
  '板块'.padEnd(16) +
  '持仓金额'.padStart(10) +
  '占比'.padStart(8) +
  '累计盈亏'.padStart(10) +
  '方向'.padStart(4) +
  '置信'.padStart(4) +
  '今日预估'.padStart(10) +
  '调仓建议'.padStart(20)
);
console.log('─'.repeat(80));

sectorSorted.forEach(([sector, data]) => {
  const fc = forecastData[sector] || { dir: '△', conf: 'L', score: -0.3 };
  const pct = (data.amount / totalAmount * 100).toFixed(1);
  const dirIcon = fc.dir;

  // 调仓建议
  let advice = '';
  if (fc.score <= -1.0) advice = '⚠️ 强烈建议减仓';
  else if (fc.score <= -0.5) advice = '🔻 建议减仓';
  else if (fc.score >= 0.5) advice = '🔺 可加仓';
  else if (fc.score >= 0.2) advice = '✅ 持有观望';
  else if (fc.score >= -0.3) advice = '➖ 持有/微调';
  else advice = '🔸 谨慎持有';

  console.log(
    sector.padEnd(16) +
    data.amount.toFixed(0).padStart(10) +
    (pct + '%').padStart(8) +
    data.pnl.toFixed(0).padStart(10) +
    dirIcon.padStart(4) +
    fc.conf.padStart(4) +
    data.todayEstPnl.toFixed(0).padStart(10) +
    advice.padStart(20)
  );
});

// 总汇总
console.log('─'.repeat(80));
console.log(
  '合计'.padEnd(16) +
  totalAmount.toFixed(0).padStart(10) +
  '100.0%'.padStart(8) +
  totalPnl.toFixed(0).padStart(10) +
  ''.padStart(4) +
  ''.padStart(4) +
  totalTodayEstPnl.toFixed(0).padStart(10) +
  ''.padStart(20)
);

// 核心建议
console.log('\n\n' + '='.repeat(80));
console.log('【核心调仓建议】');
console.log('='.repeat(80));

// 找出最应该减仓和加仓的板块
const reduceList = sectorSorted
  .filter(([s, d]) => (forecastData[s] && forecastData[s].score <= -0.8) && d.amount > 100)
  .map(([s, d]) => ({ sector: s, amount: d.amount, score: forecastData[s].score, risk: forecastData[s].risk }));

const addList = sectorSorted
  .filter(([s, d]) => (forecastData[s] && forecastData[s].score >= 0.3) && s !== '债券')
  .map(([s, d]) => ({ sector: s, amount: d.amount, score: forecastData[s].score, risk: forecastData[s].risk }));

console.log('\n🔴 建议减仓方向（今日/短期承压）：');
reduceList.forEach(r => {
  console.log(`  ▸ ${r.sector}（持仓¥${r.amount.toFixed(0)}, 综合分${r.score}）— ${r.risk}`);
});

console.log('\n🟢 建议加仓/持有方向（相对抗跌或偏多）：');
addList.forEach(r => {
  console.log(`  ▸ ${r.sector}（当前持仓¥${r.amount.toFixed(0)}, 综合分${r.score > 0 ? '+' + r.score : r.score}）— ${r.risk}`);
});

// 集中度分析
console.log('\n\n【持仓集中度分析】');
const top3 = sectorSorted.slice(0, 3);
const top3Pct = top3.reduce((s, [, d]) => s + d.amount, 0) / totalAmount * 100;
console.log(`  ⚠️ 前3大板块占比：${top3Pct.toFixed(1)}%（${top3.map(([s]) => s).join(' / ')}）`);
console.log(`  ⚠️ 半导体相关板块总占比过高，今日费半-3.89%+机构派发，集中风险很大`);

// 地缘避险建议
console.log('\n【地缘风险对冲建议】');
console.log('  昨夜美伊冲突(导弹袭阿巴斯港)→避险升温');
console.log('  当前黄金持仓：¥' + (sectorSummary['黄金']?.amount || 0).toFixed(0) + '（占比极低）');
console.log('  当前石油持仓：¥' + ((sectorSummary['石油/油气']?.amount || 0)).toFixed(0) + '（占比极低）');
console.log('  💡 建议：适当增加黄金/石油/红利低波等避险资产，对冲地缘风险');

// 预估收入计算
console.log('\n\n' + '='.repeat(80));
console.log('【收入预估计算】');
console.log('='.repeat(80));
console.log(`  今日(7/17)预估收入：¥${totalTodayEstPnl.toFixed(2)}`);
console.log(`  今日预估收益率：${(totalTodayEstPnl / totalAmount * 100).toFixed(2)}%`);
console.log('');
console.log(`  注：后天(7/19)为周日休市，下周一(7/20)预估收入：¥${totalAfterTomorrowEstPnl.toFixed(2)}`);
console.log(`  下周一预估收益率：${(totalAfterTomorrowEstPnl / totalAmount * 100).toFixed(2)}%`);
console.log('');
console.log(`  ⚠️ 免责：以上为基于五维打分模型的方向性预估，非实际交易结果。`);
console.log(`  实际收益受盘中波动、隔夜外盘、地缘事件等影响，偏差可能较大。`);
console.log(`  尤其今日地缘冲突(美伊)为新增重大变量，模型预测不确定性高。`);