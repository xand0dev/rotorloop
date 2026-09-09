import fs from 'node:fs/promises';
const tabs = await (await fetch('http://127.0.0.1:9231/json')).json();
const ws = new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}));
let id=0;
const pending=new Map(), errors=[];
ws.addEventListener('message', ({data}) => { const m=JSON.parse(data); if(m.method==='Runtime.exceptionThrown') errors.push(m.params); if(m.id){ const p=pending.get(m.id); pending.delete(m.id); m.error?p.reject(m.error):p.resolve(m.result); } });
function send(method,params={}) {return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function read(expression){ const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw r.exceptionDetails;return r.result.value; }
await send('Runtime.enable');
await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__hud=[]; const original=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__hud.push(String(text));if(window.__hud.length>200)window.__hud.shift();return original.call(this,text,...args);};`});
await send('Emulation.setDeviceMetricsOverride',{width:1100,height:750,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
await pause(1300);
const out={date:new Date().toISOString(),browser:await send('Browser.getVersion'),kind:'Headless Chrome functional smoke; not a monitor or performance benchmark',checks:[]};
async function capture(name){
 const state=await read(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),t=c.getContext('2d').getTransform();return {viewport:[innerWidth,innerHeight],css:[r.width,r.height],backing:[c.width,c.height],dpr:devicePixelRatio,transform:[t.a,t.d],hud:window.__hud.slice(-30)};})()`);
 const shot=await send('Page.captureScreenshot',{format:'png'});
 await fs.writeFile('docs/evidence/telemetry-'+name+'.png',Buffer.from(shot.data,'base64'));
 out.checks.push({name,...state});
}
async function key(code,key,ms=60){await send('Input.dispatchKeyEvent',{type:'keyDown',code,key});await pause(ms);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});await pause(60);}
await capture('desktop');
await key('KeyH','h');
await capture('hidden');
await key('KeyH','h');
await key('KeyW','w',450);
await key('KeyD','d',250);
await key('KeyR','r');
await capture('reset');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:2,mobile:false});
await pause(300);
await capture('narrow');
await send('Emulation.setDeviceMetricsOverride',{width:300,height:540,deviceScaleFactor:1,mobile:false});
await pause(300);
await capture('minimum');
await send('Emulation.setDeviceMetricsOverride',{width:700,height:350,deviceScaleFactor:1,mobile:false});
await pause(300);
await capture('short');
out.errors=errors;
await fs.writeFile('docs/evidence/telemetry-smoke.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
ws.close();
