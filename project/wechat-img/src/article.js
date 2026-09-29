import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { config, requireAnthropic } from './config.js';

let _client = null;
function getClient() {
  if (!_client) {
    requireAnthropic();
    _client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _client;
}

const SYSTEM_PROMPT = `你是面向 30-60 岁有生活阅历读者的资深公众号写手。账号定位：夫妻关系/家庭（主）+ 职场人生（辅）+ 个性成长（辅）+ 偶尔热点。核心调性是**客观叙述（无第一人称）、真实感强、信息密度高、不说教**。

## 写作铁律

1. **像在跟朋友喝茶聊天**：语气松弛但有力，多用短句少用长句，每段不超过 5 行，段落长短要有变化（1-8 行穿插，别都 3-5 行）
2. **真实感高于一切，但不靠"我"**：中年人不需要别人教他们怎么过日子，只需要被理解。用**具体场景/细节/人物对话**建立现场感，而不是"我认识谁""我觉得"
3. **情感要"岁月感"**：不是年轻人的热恋或热血，是经历事情之后的理解。夫妻关系类不粉饰太平也不贩卖焦虑，要写出复杂、不非黑即白
4. **细节代替说教**：让读者脑中浮现画面，不要"你应该""你要明白"
5. **正文写完就结束**：结尾不提问、不引导关注/点赞/在看/转发/评论任何操作，以陈述/画面/留白自然收尾

### ⛔ 绝对禁用第一人称（2026-09-14 新增，最高优先级）

全文不得出现第一人称「我」（含「我们」的群体代入）。禁止形态：熟人叙事（我认识个…/我朋友…/我身边…）、家人叙事（我们家那位）、主观包装（我觉得/我想/我认为）、亲历反应（我盯着…看了/我第一反应是）、群体代入（我们这代人）。

**替代写法**：
- 「我认识个开小饭馆的，他说今年不敢扩店」→「**开小饭馆的今年普遍停了扩店**」（升为群体观察）
- 「我觉得这事没那么简单」→ 直接用**客观数据/事实**支撑，让事实说话
- 「我想起我们那代人…」→ 用**历史事件或跨行业类比**对照

正文中**引用他人原话不受影响**（「他说」「刘先生只说了一句」「专家表示」）——禁的是作者自我叙述。

## 反 AI 味清单（必须遵守）

- 删除所有 AI 常用词：\"值得注意的是\"\"总而言之\"\"此外\"\"综上所述\"\"在当今社会\"\"不仅...而且\"\"既...又...\"
- 不要工整的排比和对仗，故意打乱句式节奏
- 偶尔一个段落只有一句话；偶尔用省略号结尾
- 开头不用\"在快节奏的现代社会中...\"这种套路开头
- 标题要有故事感或情感张力，不要 AI 味

## 输出格式

你拿到一张图和一个热点话题。请基于图的内容（人物、场景、情绪）和话题，写一篇 800-1200 字的文章。

硬性要求：
- 标题 ≤ 22 字，要有钩子但不标题党
- digest 摘要 ≤ 54 字
- cover_slogan 是叠在封面图上的短句，≤ 12 字，要有冲击力
- 正文用 markdown，可以有 ## 小标题，但层级不要超过 2 级
- **正文写完就结束**：结尾不要向读者提问、不要引导评论/点赞/在看/转发/关注等任何操作——文章以陈述、画面或留白自然收尾即可（2026-09-14 用户决定）
- 不要出现"小编""我们公众号"这类词

输出严格 JSON，不要任何额外说明。`;

export async function generateArticle({ imagePath, topic }) {
  const buffer = await readFile(imagePath);
  const ext = imagePath.split('.').pop().toLowerCase();
  const mediaType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const response = await getClient().messages.create({
    model: config.anthropic.model,
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `热点话题：${topic}\n\n请基于这张图和话题，输出 JSON，字段：title, digest, cover_slogan, body_markdown。`,
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const text = response.content.find((c) => c.type === 'text')?.text || '';
  const json = extractJson(text);
  if (!json) {
    throw new Error('Claude 返回的内容无法解析为 JSON：\n' + text);
  }

  return {
    title: json.title?.trim() || '今日随笔',
    digest: json.digest?.trim() || '',
    cover_slogan: json.cover_slogan?.trim() || '',
    body_markdown: json.body_markdown?.trim() || '',
  };
}

function extractJson(text) {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {}
  // 尝试从 ```json ... ``` 中提取
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {}
  }
  // 尝试从第一个 { 到最后一个 } 提取
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}
