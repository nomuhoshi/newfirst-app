import { webkit, chromium, devices } from 'playwright';
const out='/workspace/research/brilliant/';
const log=[];
async function run(name, browserType, ctxOpts){
  const b=await browserType.launch(); const ctx=await b.newContext(ctxOpts); const p=await ctx.newPage();
  const shot=async(n)=>{await p.waitForTimeout(2500); await p.screenshot({path:out+name+'-'+n+'.png'}); log.push(`${name}-${n}: ${p.url()} | ${(await p.innerText('body').catch(()=>'')).replace(/\s+/g,' ').slice(0,600)}`);};
  try{
    await p.goto('https://brilliant.org/',{waitUntil:'domcontentloaded',timeout:45000}); await shot('01-home');
    for (const pth of ['/pricing/','/courses/','/help/']){ try{await p.goto('https://brilliant.org'+pth,{waitUntil:'domcontentloaded',timeout:45000}); await shot('02'+pth.replace(/\//g,''));}catch(e){log.push(name+pth+' ERR '+e.message.slice(0,100))} }
    await p.goto('https://brilliant.org/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2000);
    const cta=p.getByRole('link',{name:/get started/i}).or(p.getByRole('button',{name:/get started/i})).first();
    await cta.click({timeout:10000}); await shot('03-cta');
    for(let i=0;i<8;i++){
      const btns=p.locator('button:visible, a[role=button]:visible, [role=radio]:visible, label:visible');
      const n=await btns.count(); const texts=[];for(let k=0;k<Math.min(n,15);k++)texts.push((await btns.nth(k).innerText().catch(()=>'')).trim().slice(0,30));
      log.push(`${name} step${i} buttons: ${JSON.stringify(texts)}`);
      const body=await p.innerText('body'); if(/password|sign up with|continue with google|email/i.test(body) && /sign up|create/i.test(body)){ await shot('04-wall-'+i); log.push(name+' SIGNUP WALL at step '+i); break;}
      let clicked=false;
      for(const re of [/^continue$/i,/next/i,/skip/i]){const c=p.getByRole('button',{name:re}).first(); if(await c.isVisible().catch(()=>false)&&await c.isEnabled().catch(()=>false)){await c.click();clicked=true;break;}}
      if(!clicked){const opt=p.locator('[role=radio]:visible, [role=checkbox]:visible, li button:visible, label:visible').first(); if(await opt.isVisible().catch(()=>false)){await opt.click(); await p.waitForTimeout(600); const c=p.getByRole('button',{name:/continue|next/i}).first(); if(await c.isVisible().catch(()=>false)) await c.click().catch(()=>{});} else break;}
      await shot('03-step'+i);
    }
  }catch(e){log.push(name+' ERR '+e.message.slice(0,200)); await p.screenshot({path:out+name+'-err.png'}).catch(()=>{});}
  await b.close();
}
await run('wk-iphone', webkit, {...devices['iPhone 13']});
await run('wk-iphone-dark', webkit, {...devices['iPhone 13'], colorScheme:'dark'});
await run('cr-desktop', chromium, {viewport:{width:1280,height:800}});
await run('wk-iphone-land', webkit, {...devices['iPhone 13 landscape']});
import fs from 'fs'; fs.writeFileSync('/workspace/research/b1.log', log.join('\n'));
