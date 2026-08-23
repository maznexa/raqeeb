const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONTCSS=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for (const w of [1440,1280,1024]) {
  const ctx=await b.newContext({viewport:{width:w,height:900}});
  const p=await ctx.newPage();
  await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
  await p.addStyleTag({content:FONTCSS});
  await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
  await p.waitForTimeout(600);
  const r=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.win').forEach((el,i)=>{
      const par=el.closest('.scene')||el.parentElement;
      out.push({i, winW:Math.round(el.getBoundingClientRect().width),
                scrollW:el.scrollWidth,
                parentW:Math.round(par.getBoundingClientRect().width),
                clipped: el.scrollWidth > Math.ceil(el.clientWidth)+1,
                label:(el.getAttribute('aria-label')||'').slice(0,34)});
    });
    return out;
  });
  console.log('== '+w+'px'); r.forEach(x=>console.log(JSON.stringify(x)));
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
