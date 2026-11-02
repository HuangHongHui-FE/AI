// 检查引擎：吃 article.json + 规则集，吐出 FAIL/WARN 清单
// 规则表在 references/，本文件不写死任何阈值——换平台只换规则集

// 中文计字：去 markdown 符号与空白（标题/摘要/正文共用同一口径）
export function charCount(s) {
  return (s || "").replace(/[#>*_\-`>!\[\]()|]/g, "").replace(/\s/g, "").length;
}

// 段落切分：去掉纯图片段，保留正文段落
function paragraphs(body) {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !/^!\[/.test(p));
}

// 去图片语法的正文：alt 常是引用官方/他人原话，不该算作者第一人称
function stripImages(body) {
  return body.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
}

// 取开头首段与原样文本（用于「≤8字短句。」开头检测）
function openingText(body) {
  const ps = paragraphs(body);
  return (ps[0] || "").replace(/\*\*/g, "").trim();
}

// 取结尾末句：末段按句末标点切，取最后 1~2 句、上限 60 字
// 只作用于末句而非整段——整段匹配会误杀中段正常用法
function endingSentence(body) {
  const ps = paragraphs(body);
  const last = (ps[ps.length - 1] || "").replace(/\*\*/g, "").trim();
  const sents = last.split(/(?<=[。！？])/).filter((s) => s.trim());
  return (sents.slice(-2).join("") || last).slice(-60);
}

// 正文段落（排除标题行、列表、引用、表格），用于事实/情绪比与升华段位置
function proseParagraphs(body) {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim().replace(/\*\*/g, ""))
    .filter((p) => p && !/^!\[/.test(p) && !/^[#>|]/.test(p) && !/^[-*\d]/.test(p));
}

// 逐条跑规则，收集命中；每条规则独立，互不影响
function runChecks(article, rules) {
  const fails = [];
  const warns = [];
  const title = article.title || "";
  const digest = article.digest || "";
  const body = article.body_markdown || "";
  const bodyNoImg = stripImages(body);

  const fail = (id, msg, hit) => fails.push({ id, message: msg, hit: hit || "" });
  const warn = (id, msg, hit) => warns.push({ id, message: msg, hit: hit || "" });

  // ── 标题 ──
  if (rules.title) {
    const r = rules.title;
    const emo = new RegExp(r.emo_tail);
    if (emo.test(title)) fail("title.emo_tail", `标题"我X了"情绪尾收尾（被判低创的批次全此格式）：${title}`);
    const tc = charCount(title);
    if (tc > r.max_chars) fail("title.max_chars", `标题 ${tc} 字 >${r.max_chars}：${title}`);
    const cb = new RegExp(r.clickbait);
    if (cb.test(title)) fail("title.clickbait", `标题党词：${title}`);
  }

  // ── 摘要 ──
  if (rules.digest) {
    const r = rules.digest;
    const dc = charCount(digest);
    if (dc > r.max_chars) fail("digest.max_chars", `digest ${dc} 字 >${r.max_chars}`);
    if (r.forbid_newline && /[\n\r]/.test(digest)) fail("digest.newline", "digest 含换行");
    if (r.forbid_url && /https?:\/\//.test(digest)) fail("digest.url", "digest 含外链");
  }

  // ── 正文基础 ──
  if (rules.body) {
    for (const r of Object.values(rules.body)) {
      if (!r || !r.pattern && r.value === undefined) continue;
      if (r.value !== undefined && body.includes(r.value)) {
        fail(r.id, r.message, r.value);
      } else if (r.pattern && new RegExp(r.pattern).test(body)) {
        fail(r.id, r.message, body.match(new RegExp(r.pattern))[0]);
      }
    }
  }

  // ── 第一人称完全禁用 ──
  if (rules.first_person && rules.first_person.enabled !== false) {
    for (const p of rules.first_person.patterns) {
      const m = bodyNoImg.match(new RegExp(p.pattern));
      if (m) fail("first_person.pattern", `第一人称禁用：${p.message}「…${m[0]}…」——改用群体观察/客观数据/历史类比`);
    }
    const wo = (bodyNoImg.match(/我/g) || []).length;
    if (wo > rules.first_person.max_count)
      fail("first_person.count", `正文出现「我」${wo} 处（第一人称已全面禁用，最多容忍 ${rules.first_person.max_count} 处）`);
  }

  // ── 整句模板 ──
  if (rules.templates) {
    for (const t of rules.templates.hard || []) {
      const m = body.match(new RegExp(t.pattern));
      if (m) fail("templates.hard", `${t.message}：…${m[0]}…`);
    }
    for (const t of rules.templates.soft || []) {
      const m = body.match(new RegExp(t.pattern));
      if (m) warn("templates.soft", `${t.message}：…${m[0]}…`);
    }
  }

  // ── 段首引导词滥用：单次是正常口语，只拦同类反复起段与全篇超限 ──
  if (rules.lead_in && rules.lead_in.enabled !== false) {
    const r = rules.lead_in;
    const leadRe = new RegExp(r.paragraph_start);
    const ps = body
      .split(/\n\n+/)
      .map((p) => p.trim().replace(/\*\*/g, ""))
      .filter((p) => p && !/^[!>#|:\-*\d]/.test(p));
    const hit = ps.filter((p) => leadRe.test(p));
    if (hit.length > r.max_paragraphs)
      fail("lead_in.repeat", `段首口语引导词滥用：${hit.length} 段以同类引导词起段（反复用同一套路=模板化）`);
    const lim = r.phrase_limit;
    if (lim) {
      const n = (body.match(new RegExp(lim.pattern, "g")) || []).length;
      if (n > lim.max) fail("lead_in.phrase", `「说到底/说白了/归根结底」全篇 ${n} 次（限 ${lim.max} 次）`);
    }
  }

  // ── 万能句式：开头首段 + 结尾末句 ──
  if (rules.skeleton) {
    const first = openingText(body);
    for (const r of rules.skeleton.opening || []) {
      if (!new RegExp(r.pattern).test(first)) continue;
      if (r.negate && new RegExp(r.negate).test(first)) continue;
      fail("skeleton.opening", `${r.message}：${first.slice(0, 30)}…`);
    }
    const last = endingSentence(body);
    for (const r of rules.skeleton.ending || []) {
      if (new RegExp(r.pattern).test(last))
        fail("skeleton.ending", `${r.message}：…${last.slice(-38)}`);
    }
  }

  // ── 事实/情绪段占比 ──
  if (rules.fact_ratio && rules.fact_ratio.enabled !== false) {
    const r = rules.fact_ratio;
    const ps = proseParagraphs(body);
    if (ps.length >= r.min_paragraphs) {
      const factN = ps.filter((p) => (p.match(/\d/g) || []).length >= r.fact_min_digits).length;
      const feelRe = new RegExp(r.feel_pattern);
      const feelN = ps.filter((p) => feelRe.test(p)).length;
      if (feelN > factN)
        fail("fact_ratio", `情绪段 ${feelN} > 事实段 ${factN}（04 要求事实占比 ≥ 情绪）`);
    }
  }

  // ── 句长节奏 ──
  if (rules.rhythm && rules.rhythm.enabled !== false) {
    const r = rules.rhythm;
    const sents = body
      .replace(/\n/g, "")
      .split(/(?<=[。！？])/)
      .filter((s) => s.trim() && !/^\s*[#|>!]/.test(s) && !/^\s*\d+\./.test(s));
    if (sents.length >= r.min_sentences) {
      const lens = sents.map((s) => s.length);
      const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
      const sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length);
      const shortRatio = lens.filter((l) => l <= r.short_len).length / lens.length;
      if (sd < r.min_stddev) fail("rhythm.stddev", `句长标准差仅 ${sd.toFixed(1)}，须长短句穿插`);
      if (shortRatio < r.short_ratio_warn)
        warn("rhythm.short_ratio", `短句(≤${r.short_len}字)占比 ${(shortRatio * 100).toFixed(0)}%，建议加短句破节奏`);
    }
  }

  // ── 其他 WARN ──
  if (rules.misc) {
    const m = rules.misc;
    const boldN = (body.match(/\*\*[^*]+\*\*/g) || []).length;
    if (boldN > m.max_bold) warn("misc.max_bold", `加粗 ${boldN} 处过多，全篇加粗等于没加粗`);
    const aiHits = m.ai_cliche_patterns.reduce((n, p) => n + [...body.matchAll(new RegExp(p, "g"))].length, 0);
    if (aiHits >= m.ai_cliche_hits_warn) warn("misc.ai_cliche", `AI 金句句式 ${aiHits} 处，注意别堆砌`);
    if (m.preach_pattern && new RegExp(m.preach_pattern).test(body)) warn("misc.preach", "说教式结尾");
    const ps = paragraphs(body);
    const lens = ps.map((p) => p.length);
    if (ps.length >= 4 && lens.every((l) => Math.abs(l - lens[0]) < m.equal_paragraph_tolerance))
      warn("misc.equal_paragraphs", "段落全等长，须长短不齐");
  }

  return { fails, warns };
}

// 主入口：返回 { ok, ruleset, fails, warns, stats }
export function selfcheck(article, ruleset) {
  const { fails, warns } = runChecks(article, ruleset.rules);
  const body = article.body_markdown || "";
  return {
    ok: fails.length === 0,
    ruleset: ruleset.name,
    fails,
    warns,
    stats: {
      title_chars: charCount(article.title || ""),
      digest_chars: charCount(article.digest || ""),
      body_chars: charCount(body),
      paragraphs: paragraphs(body).length,
      quotes: (body.match(/^> /gm) || []).length,
      bolds: (body.match(/\*\*[^*]+\*\*/g) || []).length,
    },
  };
}
