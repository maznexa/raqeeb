const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONT=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
function lum(c){const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b}
function ratio(a,b){const L1=lum(a),L2=lum(b);return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05)}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});
 const p=await ctx.newPage();
 const errs=[];
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
 p.on('pageerror',e=>errs.push('PAGEERROR '+e.message.slice(0,120)));
 await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
 await p.addStyleTag({content:FONT});
 await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
 await p.waitForTimeout(1000);
 // sample text/background pairs
 const pairs=await p.evaluate(()=>{
   function bgOf(el){let n=el;while(n){const c=getComputedStyle(n).backgroundColor;if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c;n=n.parentElement}return 'rgb(255,255,255)'}
   const sels=['.lead','.tag','.kpi .ks','.morerow','.scene-cap','.flab p','.plan .pd','.foot ul a','.foot-about','.cell.c2','.cell.c3','.chip.warn','.chip.ok','.chip.risk','.hero-sub','.faq p','.secnote','.pricenote','.win-crumb','.rail a'];
   const out=[];
   sels.forEach(sel=>{const el=document.querySelector(sel);if(!el)return;
     const cs=getComputedStyle(el);
     out.push({sel,color:cs.color,bg:bgOf(el),size:parseFloat(cs.fontSize),weight:cs.fontWeight});});
   return out;
 });
 const parse=c=>c.match(/\d+/g).slice(0,3).map(Number);
 let fails=0;
 pairs.forEach(x=>{
   const r=ratio(parse(x.color),parse(x.bg));
   const large = x.size>=24 || (x.size>=18.66 && +x.weight>=700);
   const need = large?3:4.5;
   if(r<need){fails++;console.log('LOW '+r.toFixed(2)+' need '+need+'  '+x.sel+'  '+x.size+'px '+x.weight);}
 });
 console.log('contrast checked:',pairs.length,'fails:',fails);
 // headings order
 const hs=await p.evaluate(()=>[...document.querySelectorAll('h1,h2,h3,h4,h5')].map(h=>+h.tagName[1]));
 let skips=0; for(let i=1;i<hs.length;i++) if(hs[i]-hs[i-1]>1) skips++;
 console.log('headings:',hs.length,'h1 count:',hs.filter(x=>x===1).length,'skips:',skips);
 // weights actually differ now?
 const w=await p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).fontWeight:'-'};
   return {h1:g('.hero h1'),h2:g('.h2'),chap:g('.chap-copy h2')}});
 console.log('weights',JSON.stringify(w));
 console.log('console errors:',errs.length?errs:'none');
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
