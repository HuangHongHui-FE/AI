# company-intro —— 公司拆解（求职向）

用户说「写公司介绍」「介绍某某公司」「写下一个公司」时走这条流程。

## 步骤链

```
01-kline        抓月 K 线出走势图（东财主源，腾讯兜底）
02-write-article 生成写作 prompt → 【Claude 写九段拆解】
03-selfcheck    硬门自查（company 规则集：字数不设限、不用结尾骨架）
04-format-html  转 HTML
05-cover-image  用 K 线图做封面
06-wechat-draft 推草稿
```

## 定位

**仿「宽哥聊跳槽」的九段求职拆解**——薪资水平、加班情况、跳槽认可度、评分等，面向求职者。**不是商业分析**（不是营收/护城河/估值那套）。

## 运行

```bash
node recipe/company-intro/run.mjs --prompt "介绍某公司" \
  --company "公司名" --code 300750 --title "标题"
```
