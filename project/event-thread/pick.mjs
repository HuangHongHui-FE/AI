import sharp from 'sharp';
import { join } from 'node:path';
const BASE='input/20260930-neta-auto';
const files=process.argv.slice(2);
const CELL=430,COLS=3,LBL=30;
const rows=Math.ceil(files.length/COLS);
const comps=[];
for(let i=0;i<files.length;i++){
  const x=(i%COLS)*CELL,y=Math.floor(i/COLS)*(CELL+LBL);
  const buf=await sharp(join(BASE,files[i])).resize(CELL-8,CELL-8,{fit:'inside'}).toBuffer();
  comps.push({input:buf,left:x+4,top:y+LBL+4});
  const svg=`<svg width="${CELL}" height="${LBL}"><rect width="${CELL}" height="${LBL}" fill="#000"/><text x="6" y="21" font-family="Helvetica" font-size="18" fill="#0f0">${files[i].replace('.jpg','')}</text></svg>`;
  comps.push({input:Buffer.from(svg),left:x,top:y});
}
await sharp({create:{width:COLS*CELL,height:rows*(CELL+LBL),channels:3,background:'#444'}})
 .composite(comps).jpeg({quality:88}).toFile('/tmp/pick.jpg');
console.log('ok');
