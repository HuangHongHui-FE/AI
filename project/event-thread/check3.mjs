import sharp from 'sharp';
import { join } from 'node:path';
// 抽查配对存疑的几张
const D='input/20260930-cailei-als';
const files=process.argv.slice(2);
const CELL=380,COLS=3,LBL=28;
const rows=Math.ceil(files.length/COLS);
const comps=[];
for(let i=0;i<files.length;i++){
  const x=(i%COLS)*CELL,y=Math.floor(i/COLS)*(CELL+LBL);
  const buf=await sharp(join(D,files[i])).resize(CELL-6,CELL-6,{fit:'inside'}).toBuffer();
  comps.push({input:buf,left:x+3,top:y+LBL+3});
  const svg=`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="#000"/><text x="6" y="20" font-family="Helvetica" font-size="16" fill="#0f0">${files[i].replace('.jpg','')}</text></svg>`;
  comps.push({input:Buffer.from(svg),left:x,top:y});
}
await sharp({create:{width:COLS*CELL,height:rows*(CELL+LBL),channels:3,background:'#444'}})
 .composite(comps).jpeg({quality:86}).toFile('/tmp/verify.jpg');
console.log('ok');
