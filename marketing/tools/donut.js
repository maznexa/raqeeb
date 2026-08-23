const { chromium } = require('playwright-core');
const fs=require('fs'); const CWD=process.cwd();
const FONT=fs.readFileSync(CWD+'/fonts/local.css','utf8').replace(/url\('f\//g,"url('file://"+CWD+"/fonts/f/");
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 for (const w of [1440,1024,820,700,560,390]) {
  const ctx=await b.newContext({viewport:{width:w,height:1000}});
  const p=await ctx.newPage();
  await p.goto('file://'+CWD+'/raqeeb-home.html',{waitUntil:'load'});
  await p.addStyleTag({content:FONT});
  await p.addStyleTag({content:'.rev{opacity:1!important;transform:none!important}'});
  await p.evaluate(async()=>{try{await document.fonts.ready}catch(e){}});
  await p.waitForTimeout(700);
  const r=await p.evaluate(()=>{
    const d=document.querySelector('.donut'); if(!d) return null;
    const svg=d.querySelector('svg'), dn=d.querySelector('.dn');
    const bb=d.getBoundingClientRect();
    // ring geometry: viewBox 42, r=15.9, stroke-width from the ring circle
    const ring=svg.querySelectorAll('circle')[1];
    const sw=parseFloat(ring.getAttribute('stroke-width'));
    const rr=parseFloat(ring.getAttribute('r'));
    const scale=bb.width/42;
    const innerD=(rr*2 - sw)*scale;            // usable hole diameter in px
    const num=dn.querySelector('b'), lab=dn.querySelector('span');
    const nb=num.getBoundingClientRect();
    const lb=lab?lab.getBoundingClientRect():null;
    const textH=lb? (lb.bottom-nb.top) : (nb.bottom-nb.top);
    const textW=Math.max(nb.width, lb?lb.width:0);
    // does the label cross the ring band?
    const cx=bb.left+bb.width/2, cy=bb.top+bb.height/2;
    let labelRadius=null, ringInner=null;
    if(lb){
      const dx=Math.max(Math.abs(lb.left-cx),Math.abs(lb.right-cx));
      const dy=Math.max(Math.abs(lb.top-cy),Math.abs(lb.bottom-cy));
      labelRadius=Math.sqrt(dx*dx+dy*dy);
      ringInner=(rr - sw/2)*scale;
    }
    return {size:Math.round(bb.width), innerD:Math.round(innerD),
            textH:Math.round(textH), textW:Math.round(textW),
            fits: textH<=innerD-2 && textW<=innerD-2,
            labelRadius:labelRadius?Math.round(labelRadius):null,
            ringInner:ringInner?Math.round(ringInner):null,
            labelCrossesRing: labelRadius && ringInner ? labelRadius>ringInner : null,
            labelText:lab?lab.textContent:null};
  });
  console.log(w+'px ->', JSON.stringify(r));
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
