import { webkit, chromium, devices } from 'playwright';
import fs from 'fs';
const out='/workspace/research/brilliant/'; const log=[];
async function run(name, bt, opts){
  const b=await bt.launch(); const ctx=await b.newContext(opts); const p=await ctx.newPage();
  const t0=Date.now();
  await p.goto('https://brilliant.org/welcome/',{waitUntil:'domcontentloaded',timeout:45000}); await p.waitForTimeout(3000);
  for(const re of [/accept/i,/^ok$/i,/got it/i,/allow/i,/reject/i]){const c=p.getByRole('button',{name:re}).first(); if(await c.isVisible().catch(()=>false)){await c.click({force:true}).catch(()=>{});log.push(name+' cookie: '+re);break;}}
  let prev='';
  for(let i=0;i<45;i++){
    await p.waitForTimeout(2200);
    const body=(await p.innerText('body').catch(()=>'')).replace(/\s+/g,' ').slice(0,700);
    await p.screenshot({path:`${out}${name}-flow2-${String(i).padStart(2,'0')}.png`});
    log.push(`${name} [${i}] t=${((Date.now()-t0)/1000).toFixed(0)}s ${p.url()} :: ${body}`);
    if(/sign up|create (an|your) account|continue with google|enter your email|log in with/i.test(body) && i>0){log.push(name+' >>> SIGNUP/WALL at screen '+i); break;}
    if(/start (your )?(free )?trial|subscribe|per month|\/mo|annual/i.test(body)){log.push(name+' >>> PAYWALL at screen '+i);}
    const inp=p.locator('input[type=number]:visible, input[placeholder*="age" i]:visible').first();
    if(await inp.isVisible().catch(()=>false)){await inp.fill('30'); log.push(name+' filled age 30');}
    if(body===prev){ // stuck: try option then continue
      const opts=p.locator('main button:visible, [role=radio]:visible, [role=option]:visible, [role=checkbox]:visible');
      const n=await opts.count(); let done=false;
      for(let k=0;k<n&&!done;k++){const o=opts.nth(k); const tx=(await o.innerText().catch(()=>'')).trim(); if(tx && !/continue|skip|back|sign/i.test(tx)){await o.click({force:true}).catch(()=>{}); log.push(name+' pick: '+tx.slice(0,40)); done=true;}}
      if(!done){log.push(name+' stuck'); }
      await p.waitForTimeout(800);
    }
    prev=body;
    // prefer picking python/coding/beginner options
    for(const re of [/computer science|coding/i,/python/i,/new to|beginner|just starting|i'm new|basics/i,/^skip$/i]){
      const o=p.getByText(re).first(); if(await o.isVisible().catch(()=>false) && !log.includes(name+i+re)){await o.click({force:true}).catch(()=>{}); log.push(name+i+re); break;}
    }
    const c=p.getByRole('button',{name:/^(continue|next|got it|let's go|start|check|ok|done|try)/i}).first();
    if(await c.isVisible().catch(()=>false)) await c.click({force:true,timeout:5000}).catch(e=>log.push(name+' cont err'));
  }
  await b.close();
}
await run('cr-iphone', chromium, {...devices['iPhone 13']});
await run('wk-iphone', webkit, {...devices['iPhone 13']});
fs.writeFileSync('/workspace/research/b3.log', log.join('\n'));
