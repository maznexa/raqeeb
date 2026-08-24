const { chromium } = require('playwright-core');
const CWD=process.cwd();
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for (const [f,expectHost] of [['raqeeb-home.html','3d8cb115'],['raqeeb-ar.html','cc4453b2']]) {
   const p=await (await b.newContext()).newPage();
   const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
   // serve from a fake claude-like hostname via routing so location.hostname matches the guard
   await p.route('**/*', async route => {
     const url=route.request().url();
     if (url.startsWith('https://preview.claudeusercontent.test/')) {
       const fs=require('fs');
       route.fulfill({ contentType:'text/html', body: fs.readFileSync(CWD+'/'+f,'utf8') });
     } else route.abort();
   });
   await p.goto('https://preview.claudeusercontent.test/'+f, {waitUntil:'domcontentloaded'}).catch(()=>{});
   await p.waitForTimeout(1200);
   const r=await p.evaluate(()=>[...document.querySelectorAll('.langsw,#langsw2')].map(a=>a.getAttribute('href')));
   console.log(f, 'switch hrefs:', r, 'contains-artifact:', r.every(x=>x&&x.includes('claude.ai/code/artifact')), 'expected:', r.every(x=>x&&x.includes(process.argv[2]||'')) );
   console.log('   points to other page id:', r[0] && r[0].includes(expectHost));
   console.log('   js errors:', errs.length?errs:'none');
   await p.context().close();
 }
 // and confirm file:// keeps relative links
 const p2=await (await b.newContext()).newPage();
 await p2.goto('file://'+CWD+'/raqeeb-ar.html',{waitUntil:'domcontentloaded'});
 await p2.waitForTimeout(800);
 const rel=await p2.evaluate(()=>[...document.querySelectorAll('.langsw,#langsw2')].map(a=>a.getAttribute('href')));
 console.log('file:// hrefs stay relative:', rel);
 await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
