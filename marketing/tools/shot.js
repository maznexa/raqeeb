const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CWD = process.cwd();
const FONTCSS = fs.readFileSync(CWD + '/fonts/local.css','utf8').replace(/url\('f\//g, "url('file://"+CWD+"/fonts/f/");
const target = process.argv[2] || 'raqeeb-home.html';
const tag = process.argv[3] || '';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const shots = [
    { name:'desk-full', w:1440, h:1000, full:true },
    { name:'desk-hero', w:1440, h:1000, full:false },
    { name:'mob-full',  w:390,  h:844,  full:true },
    { name:'mob-hero',  w:390,  h:844,  full:false },
  ];
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport:{width:s.w,height:s.h}, deviceScaleFactor:2 });
    const page = await ctx.newPage();
    await page.goto('file://'+CWD+'/'+target, { waitUntil:'load', timeout:60000 });
    await page.addStyleTag({ content: FONTCSS });
    await page.addStyleTag({ content: '.rev{opacity:1 !important;transform:none !important}' });
    await page.evaluate(async()=>{ try{ await document.fonts.ready; }catch(e){} });
    await page.waitForTimeout(1500);
    await page.screenshot({ path:`shots/${tag}${s.name}.png`, fullPage:s.full });
    const ov = await page.evaluate(() => {
      const de=document.documentElement; const bad=[];
      if (de.scrollWidth > window.innerWidth+1) {
        document.querySelectorAll('*').forEach(el=>{ const r=el.getBoundingClientRect();
          if (r.right > window.innerWidth+1 && r.width>0) bad.push((el.tagName+'.'+(el.className&&el.className.baseVal===undefined?String(el.className):'')).slice(0,60)+' w='+Math.round(r.width)+' right='+Math.round(r.right)); });
      }
      return { scrollW:de.scrollWidth, inner:window.innerWidth, offenders:[...new Set(bad)].slice(0,12) };
    });
    console.log(s.name, JSON.stringify(ov));
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
