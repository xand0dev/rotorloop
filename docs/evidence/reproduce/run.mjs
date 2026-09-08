import fs from 'node:fs/promises';
import {connect,delay} from './cdp.mjs';
const category=process.argv[2];
const base=new URL('../', import.meta.url).pathname;
const c=await connect();
const results=[];
function summary(r){const a=[...r.deltas].sort((x,y)=>x-y);const mean=a.reduce((s,x)=>s+x,0)/a.length;const sd=Math.sqrt(a.reduce((s,x)=>s+(x-mean)**2,0)/a.length);return {fps:1000/mean,meanMs:mean,sdMs:sd,p95Ms:a[Math.ceil(a.length*.95)-1],p99Ms:a[Math.ceil(a.length*.99)-1],maxMs:a.at(-1),steps:r.steps,simulationTime:r.simulationTime,wallMs:r.wallMs,x:r.state.x,y:r.state.y};}
async function run(port,label,settings,throttle=1){
 const p=await c.page(`http://127.0.0.1:${port}/lab.html`);await delay(300);await p.activate();
 await p.call('Emulation.setCPUThrottlingRate',{rate:throttle});
 const r=await p.evaluate(`lab.run(${JSON.stringify(settings)})`);
 r.label=label;r.throttle={method:'CDP Emulation.setCPUThrottlingRate',rate:throttle,accepted:true};r.summary=summary(r);results.push(r);
 console.log(JSON.stringify({label,...r.summary}));
 await p.call('Emulation.setCPUThrottlingRate',{rate:1});await p.close();return r;
}
if(category==='blocking'){
 await run(5174,'rAF baseline',{duration:10000});
 await run(5174,'rAF busy-wait 100ms every 60th render',{duration:10000,block:true});
}
if(category==='interval'){
 await run(5175,'setInterval 16ms foreground',{duration:10000});
 for(const [port,label] of [[5174,'rAF visibility'],[5175,'setInterval visibility']]){
  const p=await c.page(`http://127.0.0.1:${port}/lab.html`);await delay(300);await p.activate();await p.evaluate('lab.run({manual:true})');await delay(1000);
  const other=await c.page('about:blank');await other.activate();await delay(5000);await p.activate();await delay(1000);
  const r=await p.evaluate('lab.finish()');r.label=label;r.summary=summary(r);results.push(r);console.log(JSON.stringify({label,visibility:r.visibility,...r.summary}));await other.close();await p.close();
 }
}
if(category==='trajectory'){
 for(const [port,mode] of [[5176,'variable'],[5174,'fixed']]){
  for(const throttle of [1,6])await run(port,`${mode} wall-time CPU ${throttle}x`,{duration:5000,thrust:true},throttle);
 }
}
if(category==='exact'){
 for(const [port,mode] of [[5176,'variable'],[5174,'fixed']]){
  for(const throttle of [1,6])await run(port,`${mode} exact simulation time CPU ${throttle}x`,{exact:true,thrust:true},throttle);
 }
}
if(category==='slowdown'){
 for(const [port,mode] of [[5176,'variable'],[5174,'fixed']])await run(port,`${mode} supplemental 35ms render work`,{exact:true,thrust:true,slowdown:35});
}
delete c.info.webSocketDebuggerUrl;
await fs.writeFile(`${base}/${category}.json`,JSON.stringify({baselineCommit:'18d6167',date:new Date().toISOString(),browser:c.info,category,results,errors:c.events.filter(e=>e.method==='Runtime.exceptionThrown')},null,2));
c.close();
