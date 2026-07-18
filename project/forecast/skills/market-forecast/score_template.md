# {{DATE}} {{MODE_TITLE}}

> 免责：方向性研判，非投资建议。隔夜黑天鹅不可预测。
> 生成时间：{{TS}}  预测目标：{{TARGET}}

## 大盘先行
- 纳指：{{NDX}}%  费半：{{SOX}}%  标普：{{SPX}}%
- 富时A50期指：{{A50}}%  恒指期货：{{HSI}}%
- 数据源：overseas.json

## 今日实盘解读（今日各板块涨跌归因）

| 板块 | 代码 | 今日涨跌 | 成交额 | 机构(主力) | 游资(中单) | 散户(小单) | 结构 | 原因 | 数据源 |
|------|------|----------|--------|------------|-----------|-----------|------|------|--------|
{{#each today}}
| {{name}} | {{code}} | {{pct}} | {{amount}} | {{inst}} | {{hotmoney}} | {{retail}} | {{structure}} | {{reason}} | {{src}} |
{{/each}}

## 市场情绪（sentiment.json）

- 全市场：涨{{SENT_UP}}/跌{{SENT_DOWN}}/平{{SENT_FLAT}}  赚钱效应{{SENT_RATIO}}%  情绪温度{{SENT_TEMP}}(涨停{{SENT_ZT}}/跌停{{SENT_DT}})

## 次日预测：各板块方向（五维打分 -2~+2，综合=加权求和）

图例：▲看涨 ▼看跌 △震荡 ｜ 置信 H高/M中/L低。每维格 = 分数 + 简短理由(≤15字) + 出处。

### A股科技成长

| 板块 | 代码 | 方向 | 置信 | 综合分 | 外盘(0.25) | 资金(0.25) | 技术(0.25) | 情绪(0.15) | 消息(0.10) | 风险 |
|------|------|------|------|--------|-----------|-----------|-----------|-----------|-----------|------|
{{#each a_growth}}
| {{name}} | {{code}} | {{ARROW}} | {{CONF}} | {{SCORE}} | {{SCORE_OVS}} {{REASON_OVS}} | {{SCORE_FLOW}} {{REASON_FLOW}} | {{SCORE_TECH}} {{REASON_TECH}} | {{SCORE_SENTI}} {{REASON_SENTI}} | {{SCORE_NEWS}} {{REASON_NEWS}} | {{RISK}} |
{{/each}}

### A股宽基 / 防御 / 周期

| 板块 | 代码 | 方向 | 置信 | 综合分 | 外盘(0.25) | 资金(0.25) | 技术(0.25) | 情绪(0.15) | 消息(0.10) | 风险 |
|------|------|------|------|--------|-----------|-----------|-----------|-----------|-----------|------|
{{#each a_other}}
| {{name}} | {{code}} | {{ARROW}} | {{CONF}} | {{SCORE}} | {{SCORE_OVS}} {{REASON_OVS}} | {{SCORE_FLOW}} {{REASON_FLOW}} | {{SCORE_TECH}} {{REASON_TECH}} | {{SCORE_SENTI}} {{REASON_SENTI}} | {{SCORE_NEWS}} {{REASON_NEWS}} | {{RISK}} |
{{/each}}

### 港股

| 板块 | 代码 | 方向 | 置信 | 综合分 | 外盘(0.25) | 资金(0.25) | 技术(0.25) | 情绪(0.15) | 消息(0.10) | 风险 |
|------|------|------|------|--------|-----------|-----------|-----------|-----------|-----------|------|
{{#each hk}}
| {{name}} | {{code}} | {{ARROW}} | {{CONF}} | {{SCORE}} | {{SCORE_OVS}} {{REASON_OVS}} | {{SCORE_FLOW}} {{REASON_FLOW}} | {{SCORE_TECH}} {{REASON_TECH}} | {{SCORE_SENTI}} {{REASON_SENTI}} | {{SCORE_NEWS}} {{REASON_NEWS}} | {{RISK}} |
{{/each}}

> 分组依据 sectors.json 的 market/分类：A股科技成长=半导体/CPO/AI算力/AI应用/消费电子/机器人/新能源车/光伏/创新药A股；A股其余=宽基(科创50/创业板50/中证500/1000)/防御(医药医疗/食品饮料/红利低波/农业/稀土)/周期(银行/券商/军工/有色/煤炭/钢铁/地产)；港股=港股创新药/恒生科技/港股互联网/恒生红利/港股金融。可按需调整。

## 原始依据摘要（可追溯）
> 原始数据快照见 cache/{{DATE}}/。关键值摘录：
- 当日盘面：{{SUMMARY_PCT}}（涨跌幅中位数 {{MEDIAN}}%，{{UP}}涨{{DOWN}}跌）
- 外盘：纳指{{NDX}}%/费半{{SOX}}%/A50期指{{A50}}%/恒指期货{{HSI}}% — overseas.json
- 市场情绪：赚钱效应{{SENT_RATIO}}%/情绪温度{{SENT_TEMP}}(涨停{{SENT_ZT}}/跌停{{SENT_DT}}) — sentiment.json
- 财报事件：{{EARNINGS_STATUS}} — earnings.json
- 板块龙头业绩预告：{{LEADERS_FORECAST}} — earnings.json/a_leaders
- 资金面：{{FLOW_STATUS}} — flow.json
- 盘中分时资金：{{FLOW_INTRADAY_STATUS}} — flow_intraday.json
- 是否放量：{{VOLUME_STATUS}} — quotes.json(成交额+涨跌幅)
- 新闻：{{NEWS_STATUS}} — news.txt

## 一句话总结
{{SUMMARY}}
