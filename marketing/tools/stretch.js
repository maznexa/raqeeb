const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONT=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for (const w of [1440,390]) {
  const p=await (await b.newContext({viewport:{width:w,height:1000}})).newPage();
  await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
  await p.addStyleTag({content:FONT});
  await p.addStyleTag({content:'.rev{opacity:1!important;transform:none!important}'});
  await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
  await p.waitForTimeout(700);
  const bad=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('*').forEach(el=>{
      const s=getComputedStyle(el);
      if(s.display!=='grid' && s.display!=='inline-grid') return;
      const kids=[...el.children];
      if(kids.length<2) return;
      // implicit auto rows + align-content stretch is the trap
      if(s.gridTemplateRows!=='none') return;
      if(s.alignContent!=='normal' && s.alignContent!=='stretch') return;
      const r=el.getBoundingClientRect();
      if(r.height<8) return;
      const content=kids.reduce((n,k)=>n+k.getBoundingClientRect().height,0);
      // children spread far wider than their own content means rows stretched
      if(r.height > content*1.5 && r.height-content > 24)
        out.push({cls:(el.className&&el.className.baseVal===undefined?String(el.className):'').slice(0,48)||el.tagName,
                  boxH:Math.round(r.height), contentH:Math.round(content), kids:kids.length});
    });
    return out;
  });
  console.log(w+'px stretched-grid suspects:', bad.length ? JSON.stringify(bad) : 'none');
 }
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
