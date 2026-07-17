// add_images.js — 在 payload_template.json 中插入图片占位符
const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/31672/AI/project/wechat/文章包/20260610';

// 每篇文章的图片插入位置（在哪个文本后插入）
const imagePositions = {
  '02-婆婆搬来第三个月变成讨厌的儿媳': [
    '现在，我成了那个站在厨房里数落别人的人。',
    '这种感觉一旦露头，就很难收回去。',
    '她给我留了饭菜，用盘子扣着保温。',
    '其实她不是不讲理。只是需要有人好好地跟她说。',
  ],
  '04-45岁想一个人住一段时间': [
    '就是什么呢？我当时也说不太清楚。',
    '就做我自己。',
    '安静得我有点慌。',
    '二十年了，他第一次用商量的语气跟我说话。',
  ],
  '07-体制内22年辞职开滴滴': [
    '那封信在我抽屉里已经放了半年了。',
    '我试过对着镜子练那种笑，练不出来。',
    '答案让我后背发凉。',
    '我坐车里笑了好几分钟。',
  ],
  '09-46岁学会拒绝第一个拒绝我妈': [
    '46岁了，在一家公司管着二十几号人，跟我妈说个"不"字，心跳得像做了亏心事。',
    '那天晚上我做了个梦，梦见自己又变成了七八岁的样子，站在家门口不敢进去。',
    '比我听过的任何一句"我爱你"都重。',
    '我们之间出现了一个以前没有的东西：余地。',
  ],
};

Object.entries(imagePositions).forEach(([dir, positions]) => {
  const payloadPath = path.join(baseDir, dir, 'payload_template.json');
  if (!fs.existsSync(payloadPath)) {
    console.log(`SKIP ${dir}: no payload_template.json`);
    return;
  }

  let content = fs.readFileSync(payloadPath, 'utf8');

  positions.forEach((marker, idx) => {
    // Find the marker text and insert image after its closing </p>
    const searchStr = marker + '</p>';
    const imgTag = `<p><img src="{{IMG${idx}}}" style="width:100%;display:block;margin:1em 0;" /></p>\n`;

    if (content.includes(searchStr)) {
      content = content.replace(searchStr, searchStr + '\n' + imgTag);
      console.log(`  ${dir}: IMG${idx} inserted after "${marker.substring(0, 30)}..."`);
    } else {
      console.log(`  ${dir}: WARNING - marker not found: "${marker.substring(0, 30)}..."`);
    }
  });

  fs.writeFileSync(payloadPath, content, 'utf8');
  console.log(`✅ ${dir} updated\n`);
});

console.log('全部图片占位符已插入');