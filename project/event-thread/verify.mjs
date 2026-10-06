import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const D='input/20260930-cailei-als';
const files=readdirSync(D).filter(f=>f.endsWith('.jpg')).sort();
const CELL=340,COLS=5,LBL=26;
const rows=Math.ceil(files.length/COLS);
const comps=[];
for(let i=0;i<files.length;i++){
  const x=(i%COLS)*CELL,y=Math.floor(i/COLS)*(CELL+LBL);
  const buf=await sharp(join(D,files[i])).resize(CELL-6,CELL-6,{fit:'inside'}).toBuffer();
  comps.push({input:buf,left:x+3,top:y+LBL+3});
  const label=files[i].replace('.jpg','').replace(/-/g,'·');
  const svg=`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="#000"/><text x="5" y="18" font-family="Helvetica" font-size="14" fill="#0f0">${label}</text></svg>`;
  comps.push({input:Buffer.from(svg),left:x,top:y});
}
await sharp({create:{width:COLS*CELL,height:rows*(CELL+LBL),channels:3,background:'#444'}})
 .composite(comps).jpeg({quality:86}).toFile('/tmp/keep.jpg');
// 同时报告尺寸（挑封面用）
for(const f of files){
  const {width,height}=await sharp(join(D,f)).metadata();
  console.log(`${f}  ${width}x${height}  ${(width/height).toFixed(2)}`);
}
