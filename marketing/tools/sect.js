const { chromium } = require('playwright-core');
const fs = require('fs');
const CWD = process.cwd();
const FONTCSS = fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
const target = process.argv[2] || 'raqeeb-home.html';
const tag = process.argv[3] || '';
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport:{width:1440,height:1000}, deviceScaleFactor:1.5 });
  const p = await ctx.newPage();
  await p.goto('file://'+CWD+'/'+target,{waitUntil:'load',timeout:60000});
  await p.addStyleTag({content:FONTCSS});
  await p.addStyleTag({content:'.rev{opacity:1 !important;transform:none !important}'});
  await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
  await p.waitForTimeout(1200);
  const ids = await p.evaluate(()=>[...document.querySelectorAll('main section, footer')].map((s,i)=>({i, id:s.id||('sec'+i), h:Math.round(s.getBoundingClientRect().height)})));
  console.log(JSON.stringify(ids));
  const secs = await p.$$('main section, footer');
  for (let i=0;i<secs.length;i++){
    const id = ids[i].id;
    try { await secs[i].screenshot({ path:`shots/${tag}s${String(i).padStart(2,'0')}-${id}.png` }); } catch(e){ console.log('skip',id,e.message.slice(0,40)); }
  }
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
