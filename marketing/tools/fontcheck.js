const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
  const p = await b.newPage();
  const failed = [];
  p.on('requestfailed', r => { if (/font|gstatic|googleapis/.test(r.url())) failed.push(r.url().slice(0,90)+' :: '+r.failure().errorText); });
  p.on('response', r => { if (/gstatic|googleapis/.test(r.url())) console.log('RESP', r.status(), r.url().slice(0,80)); });
  await p.goto('file://'+process.cwd()+'/raqeeb-home.html', { waitUntil:'networkidle', timeout:60000 });
  await p.waitForTimeout(2500);
  const info = await p.evaluate(async () => {
    await document.fonts.ready;
    return {
      poppins600: document.fonts.check('600 40px Poppins'),
      montserrat: document.fonts.check('400 16px Montserrat'),
      loaded: [...document.fonts].map(f=>f.family+' '+f.weight+' '+f.status).slice(0,10),
      h1Font: getComputedStyle(document.querySelector('h1')).fontFamily,
    };
  });
  console.log(JSON.stringify(info,null,2));
  console.log('FAILED:', failed.length ? failed : 'none');
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
