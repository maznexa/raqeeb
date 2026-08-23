const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONT=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for (const w of [1440,1024,390]) {
  const ctx=await b.newContext({viewport:{width:w,height:1000}});
  const p=await ctx.newPage();
  await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
  await p.addStyleTag({content:FONT});
  await p.addStyleTag({content:'.rev{opacity:1!important;transform:none!important}'});
  await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
  await p.waitForTimeout(900);
  const bad=await p.evaluate(()=>{
    const out=[];
    // oversized text inside product chrome
    document.querySelectorAll('.win *').forEach(el=>{
      if(!el.textContent.trim()||el.children.length) return;
      const fs=parseFloat(getComputedStyle(el).fontSize);
      if(fs>26) out.push({t:'BIG',sel:el.className||el.tagName,fs:Math.round(fs),txt:el.textContent.trim().slice(0,24)});
    });
    // any child painting outside its parent box
    document.querySelectorAll('.win .hcell,.win .cell,.win .kpi,.win .tk,.win .chip,.win .hh,.win .avm,.win .gt-bar').forEach(el=>{
      const r=el.getBoundingClientRect(), pr=el.parentElement.getBoundingClientRect();
      if(r.width>pr.width+2||r.bottom>pr.bottom+3||r.right>pr.right+3)
        out.push({t:'OVERFLOW',sel:el.className,w:Math.round(r.width),pw:Math.round(pr.width)});
      if(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)
        out.push({t:'CLIPPED',sel:el.className,sw:el.scrollWidth,cw:el.clientWidth,sh:el.scrollHeight,ch:el.clientHeight,txt:el.textContent.trim().slice(0,20)});
    });
    return out;
  });
  console.log('== '+w+'px  issues:'+bad.length);
  bad.slice(0,10).forEach(x=>console.log('   ',JSON.stringify(x)));
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
