// 补搜第3篇：换关键词 "办公室 会议 讨论"，只挑可下图床
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const CAND_DIR = '/Users/zcy1/code_self/AI/project/wechat/cache/cand/03-开会时我第一次说我不知道';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const kws = ['办公室 会议 讨论', '商务 会议室 桌子', '公司 开会 同事'];

function httpGet(url, headers) {
  const lib = url.startsWith('https') ? https : http;
  return new Promise(resolve => {
    lib.get(url, { headers, timeout: 30000 }, res => {
      const next = r => { const c=[]; r.on('data',x=>c.push(x)); r.on('end',()=>resolve(Buffer.concat(c))); r.on('error',()=>resolve(Buffer.alloc(0))); };
      if (res.statusCode>=300 && res.statusCode<400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')?res.headers.location:new URL(res.headers.location,url).href;
        const l2 = loc.startsWith('https')?https:http;
        l2.get(loc,{headers,timeout:30000},next).on('error',()=>resolve(Buffer.alloc(0)));
      } else next(res);
    }).on('error',()=>resolve(Buffer.alloc(0)));
  });
}
async function search(kw){ const buf=await httpGet('https://pic.sogou.com/pics?query='+encodeURIComponent(kw),{'User-Agent':UA,'Accept-Language':'zh-CN','Referer':'https://pic.sogou.com/'}); const html=buf.toString(); const raw=html.match(/picUrl":"[^"]+"/g)||[]; return [...new Set(raw.map(s=>s.replace(/picUrl":"/,'').replace(/\\u002F/g,'/').replace(/\\u0026/g,'&')).filter(u=>/^https?:\/\//.test(u)))]; }
async function dl(url,fp){ const referer=/baidu/.test(url)?'https://image.baidu.com/':/sina/.test(url)?'https://www.sina.com.cn/':'https://pic.sogou.com/'; const buf=await httpGet(url,{'User-Agent':UA,Referer:referer}); if(buf.length>30000){fs.writeFileSync(fp,buf);return buf.length;} return 0; }
(async()=>{
  let saved=2; // 已有 cand_0,1
  for(const kw of kws){
    if(saved>=8) break;
    const urls=await search(kw);
    for(const u of urls){
      if(saved>=8) break;
      // 只挑历史可下的图床源
      if(!/(sohucs|ws\.126|zhimg|qpic|to8to)/.test(u)) continue;
      const fp=path.join(CAND_DIR,`cand_${saved}.jpg`);
      const size=await dl(u,fp);
      if(size){ console.log(`✅ cand_${saved} ${(size/1024).toFixed(0)}KB ${u.substring(0,55)}`); saved++; }
    }
  }
  console.log(`第3篇候选总数: ${saved}`);
})();
