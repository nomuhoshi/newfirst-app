import { webkit, chromium, devices } from 'playwright'; import fs from 'fs';
const out='/workspace/brilliant-wt/docs/research/brilliant/'; const log=[];
const pages=[['home','https://brilliant.org/'],['course','https://brilliant.org/courses/thinking-in-python/'],['welcome','https://brilliant.org/welcome/'],['help','https://brilliant.org/help/features/what-is-a-streak/']];
for(const [bn,bt] of [['wk',webkit],['cr',chromium]]){
 const b=await bt.launch(); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage();
 for(const [pn,u] of pages){ try{
  await p.goto(u,{waitUntil:'domcontentloaded',timeout:45000}); await p.waitForTimeout(3000);
  const g=p.getByRole('button',{name:/got it/i}).first(); if(await g.isVisible().catch(()=>false)) await g.click({force:true}).catch(()=>{});
  const m=async()=>p.evaluate(()=>{const fs=getComputedStyle(document.documentElement).fontSize;const h=[...document.querySelectorAll('h1,h2,p,button')].filter(e=>e.offsetParent).slice(0,3).map(e=>e.tagName+':'+getComputedStyle(e).fontSize);
   const ov=document.documentElement.scrollWidth>innerWidth+1; const clipped=[...document.querySelectorAll('button,a,h1,h2,p')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow!=='visible').length; return {root:fs,sample:h,hOverflow:ov,scrollW:document.documentElement.scrollWidth,clipped};});
  const base=await m();
  await p.addStyleTag({content:'html{font-size:200% !important}'}); await p.waitForTimeout(800); const rem=await m();
  await p.screenshot({path:`${out}zoom-${bn}-${pn}-root200.png`});
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
  await p.addStyleTag({content:'html{-webkit-text-size-adjust:200% !important;text-size-adjust:200% !important}'}); await p.waitForTimeout(800); const tsa=await m();
  await p.screenshot({path:`${out}zoom-${bn}-${pn}-tsa200.png`});
  await p.evaluate(()=>{document.body.style.zoom='2'}); await p.waitForTimeout(800); const z=await m();
  await p.screenshot({path:`${out}zoom-${bn}-${pn}-zoom200.png`});
  log.push(JSON.stringify({browser:bn,page:pn,base,rootFont200:rem,textSizeAdjust200:tsa,cssZoom2:z}));
 }catch(e){log.push(bn+pn+' ERR '+e.message.slice(0,120))} }
 await b.close();
}
fs.writeFileSync(out+'logs/b5-zoom.log',log.join('\n'));
