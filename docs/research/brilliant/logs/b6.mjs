import { webkit, chromium, devices } from 'playwright'; import fs from 'fs';
const out='/workspace/brilliant-wt/docs/research/brilliant/'; const log=[];
const b=await webkit.launch(); const ctx=await b.newContext({...devices['iPhone 13']}); const p=await ctx.newPage();
const gd=async()=>{const g=p.getByRole('button',{name:/got it/i}).first(); if(await g.isVisible().catch(()=>false)) await g.click({force:true}).catch(()=>{});};
const tokens=()=>p.evaluate(()=>{const pick=s=>{const e=[...document.querySelectorAll(s)].find(e=>e.offsetParent);if(!e)return null;const c=getComputedStyle(e);return {sel:s,font:c.fontFamily.slice(0,60),size:c.fontSize,weight:c.fontWeight,color:c.color,bg:c.backgroundColor,radius:c.borderRadius,pad:c.padding}};
 const anims=document.getAnimations?document.getAnimations().length:-1; const trans=[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return c.transitionDuration&&c.transitionDuration!=='0s'}).length;
 const vids=[...document.querySelectorAll('video')].map(v=>({src:(v.currentSrc||v.src||'').slice(0,120),auto:v.autoplay,muted:v.muted}));
 return {h1:pick('h1'),h2:pick('h2'),p:pick('p'),btn:pick('button'),bodyBg:getComputedStyle(document.body).backgroundColor,anims,trans,vids};});
for(const [n,u] of [['about','https://brilliant.org/about/'],['cs-tutor','https://brilliant.org/cs/tutor/'],['py-teens','https://brilliant.org/resources/coding/interactive-python-for-teens/'],['course','https://brilliant.org/courses/thinking-in-python/']]){
  await p.goto(u,{waitUntil:'domcontentloaded',timeout:45000}); await p.waitForTimeout(3500); await gd();
  await p.screenshot({path:`${out}pub-${n}.png`}); const t=await tokens(); log.push(n+' '+JSON.stringify(t));
  for(let y=1;y<=3;y++){await p.evaluate(y=>scrollTo(0,innerHeight*y*1.5),y); await p.waitForTimeout(1200); await p.screenshot({path:`${out}pub-${n}-s${y}.png`});}
}
// course: tap level 1 and a lesson
await p.goto('https://brilliant.org/courses/thinking-in-python/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000); await gd();
await p.getByText('LEVEL 1').first().click({force:true}).catch(e=>log.push('lvl err'));
await p.waitForTimeout(2500); await p.screenshot({path:out+'pub-course-level1.png'}); log.push('LEVEL1 '+p.url()+' :: '+(await p.innerText('body')).replace(/\s+/g,' ').slice(0,700));
const lesson=p.getByText(/^Updating Variables$/).first(); if(await lesson.isVisible().catch(()=>false)){await lesson.click({force:true}); await p.waitForTimeout(3000); await p.screenshot({path:out+'pub-course-lesson-tap.png'}); log.push('LESSONTAP '+p.url()+' :: '+(await p.innerText('body')).replace(/\s+/g,' ').slice(0,500));}
// reduced motion compare
await ctx.close();
for(const rm of ['no-preference','reduce']){const c=await b.newContext({...devices['iPhone 13'],reducedMotion:rm});const q=await c.newPage();await q.goto('https://brilliant.org/',{waitUntil:'domcontentloaded'});await q.waitForTimeout(4000);
 const r=await q.evaluate(()=>({anims:document.getAnimations().length,running:document.getAnimations().filter(a=>a.playState==='running').length,vids:[...document.querySelectorAll('video')].filter(v=>!v.paused).length}));log.push('home reducedMotion='+rm+' '+JSON.stringify(r));await c.close();}
await b.close(); fs.writeFileSync(out+'logs/b6-public.log',log.join('\n'));
