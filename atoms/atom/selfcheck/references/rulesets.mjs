// 平台规则：wechat-img 主号——最严的一套（darwinian_evolver 在 656 篇历史稿上进化过）
// 其余平台从这套继承后放宽，差异集中在这里，引擎不出现平台分支
import { buildRuleset } from "../src/lib/ruleset.mjs";

export const RULESETS = {
  "wechat-img": buildRuleset("wechat-img"),

  // 今日头条：标题可到 30 字，摘要可到 100 字；不卡第一人称与AI金句（平台风格不同）
  "toutiao": buildRuleset("toutiao", {
    title: { max_chars: 30 },
    digest: { max_chars: 100 },
    first_person: false,
    lead_in: false,
    skeleton: false,
    rhythm: false,
  }),

  // 名场面档案：故事/档案型，保留第一人称禁用但放宽句长与模板
  "mingchangmian": buildRuleset("mingchangmian", {
    title: { max_chars: 24 },
    digest: { max_chars: 60 },
    rhythm: { min_stddev: 8 },
    skeleton: { opening: [], ending: [] },
  }),

  // 公司拆解：求职向长文，字数不设上下限，不用结尾禁飞骨架
  "company": buildRuleset("company", {
    title: { max_chars: 26 },
    digest: { max_chars: 80 },
    skeleton: false,
    rhythm: { min_stddev: 8 },
  }),

  // 播客：口播稿，第一人称本就允许，不卡模板句
  "podcast": buildRuleset("podcast", {
    first_person: false,
    lead_in: false,
    skeleton: false,
    templates: false,
    rhythm: false,
    body: { no_ascii_quote: false },
  }),
};

export const RULESET_NAMES = Object.keys(RULESETS);
