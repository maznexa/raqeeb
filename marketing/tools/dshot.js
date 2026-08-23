const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONT=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1000,height:1100},deviceScaleFactor:3})).newPage();
 await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
 await p.addStyleTag({content:FONT});
 await p.addStyleTag({content:'.rev{opacity:1!important;transform:none!important}'});
 await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
 await p.waitForTimeout(900);
 // the panel that holds the delivery signal donut
 const panel = await p.evaluateHandle(()=>document.querySelector('.donut').closest('.panel'));
 await panel.asElement().scrollIntoViewIfNeeded();
 await p.waitForTimeout(300);
 await panel.asElement().screenshot({path:'shots/donut-fixed.png'});
 console.log('ok');
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
