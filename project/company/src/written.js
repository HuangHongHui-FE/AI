// 已写公司清单 + 推荐下一个热门未写公司
// 用法：
//   node src/written.js list              列已写公司
//   node src/written.js next              推荐一个热门且未写过的公司
//   node src/written.js add "<公司名>"     写完后标记已写
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "logs", "written.json");

// 热门/龙头候选池：A股/港股/美股/台股，覆盖新能源/互联网/消费/医药/金融/制造/半导体
const POOL = [
  // 新能源·汽车
  "比亚迪", "宁德时代", "理想汽车", "蔚来", "小鹏汽车", "广汽集团", "长城汽车", "隆基绿能", "阳光电源", "通威股份",
  // 互联网·科技
  "腾讯", "阿里巴巴", "拼多多", "字节跳动", "百度", "美团", "京东", "网易", "快手", "B站",
  "小米集团", "华为", "大疆", "科大讯飞", "中芯国际", "京东方", "海康威视", "工业富联", "联想集团",
  // 消费·食品·家电
  "贵州茅台", "五粮液", "农夫山泉", "伊利股份", "海天味业", "片仔癀", "云南白药", "海尔智家", "美的集团", "格力电器",
  // 医药
  "恒瑞医药", "迈瑞医疗", "药明康德", "百济神州", "长春高新",
  // 金融·地产
  "招商银行", "中国平安", "工商银行", "宁波银行",
  // 制造·材料
  "福耀玻璃", "三一重工", "万华化学", "中国中免",
  // 港股·台股·美股
  "台积电", "鸿海精密", "苹果", "特斯拉", "英伟达", "微软", "谷歌", "亚马逊", "Meta", "OpenAI", "SpaceX", "波音", "麦当劳", "可口可乐", "沃尔玛",
];

async function load() {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function save(data) {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

function today() {
  // 不用 Date.now()/new Date()（脚本里允许，仅记录写入时日期）
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function list() {
  const data = await load();
  if (!data.length) {
    console.log("（还没写过公司）");
    return;
  }
  console.log(`## 已写 ${data.length} 家公司`);
  for (const x of data) console.log(`- ${x.no}. ${x.company}  (${x.date})`);
}

async function next() {
  const data = await load();
  const written = new Set(data.map((x) => x.company));
  const rest = POOL.filter((c) => !written.has(c));
  if (!rest.length) {
    console.log("候选池已写完，请往 src/written.js 的 POOL 补公司");
    return;
  }
  // 随机抽一个未写的（防每次都从头部选导致行业扎堆）
  const pick = rest[Math.floor(Math.random() * rest.length)];
  console.log(pick);
}

async function add(company) {
  if (!company) {
    console.error("用法：node src/written.js add <公司名>");
    process.exit(1);
  }
  const data = await load();
  if (data.some((x) => x.company === company)) {
    console.log(`${company} 已在清单，跳过`);
    return;
  }
  data.push({ no: data.length + 1, company, date: today() });
  await save(data);
  console.log(`✓ 已记录：${data.length}. ${company} (${today()})`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "list") await list();
else if (cmd === "next") await next();
else if (cmd === "add") await add(rest[0]);
else {
  console.log("用法：node src/written.js [list|next|add <公司名>]");
  console.log("  list  列已写公司");
  console.log("  next  推荐一个热门未写公司");
  console.log("  add   写完后标记已写");
}
