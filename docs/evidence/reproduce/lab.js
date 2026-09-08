import { createLoop } from './loop.js';
import { createShip, integrate } from './sim/ship.js';
import { wrapShip } from './sim/arena.js';
import { createCanvas } from './render/canvas.js';
import { drawArena, drawShip, drawHud, interpolateShip } from './render/draw.js';
import './style.css';

const canvas = document.querySelector('canvas');
canvas.style.width='100vw'; canvas.style.height='100vh';
const surface = createCanvas(canvas);
let state, previous, loop, recording, resolveRun;
const visibility = [];
document.addEventListener('visibilitychange',()=>visibility.push({time:performance.now(), state:document.visibilityState}));
let options, last, start, frames, simulationTime, steps, deltas;
let result = null;
function simulate(dt) {
  const remaining = 5 - simulationTime;
  if (options.exact && remaining <= 1e-10) return;
  const actual = options.exact ? Math.min(dt, remaining) : dt;
  previous = state;
  state = integrate(state, {turn:0, thrust:options.thrust}, actual);
  simulationTime += actual; steps++;
}
function render() {
  const now=performance.now();
  if (last !== null) deltas.push(now-last);
  else start=now;
  last=now; frames++;
  drawArena(surface.ctx,surface.getSize());
  drawShip(surface.ctx,wrapShip(state,surface.getSize().width,surface.getSize().height));
  drawHud(surface.ctx,loop.getStats(),surface.getSize());
  if(options.block && frames%60===0) {
    const end=performance.now()+100;
    while(performance.now()<end) {}
  }
  if(options.slowdown) {
    const end=performance.now()+options.slowdown;
    while(performance.now()<end) {}
  }
  if(options.exact && simulationTime >= 5-1e-10) finish();
  else if(!options.manual && !options.exact && now-start >= options.duration) finish();
}
function finish() {
  if(!recording) return result;
  loop.stop(); recording=false;
  result={options, state, visibleState:wrapShip(state,surface.getSize().width,surface.getSize().height), simulationTime,steps,frames,deltas,wallMs:performance.now()-start, visibility:[...visibility], stats:loop.getStats(),environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,dpr:devicePixelRatio,viewport:surface.getSize(),visibility:document.visibilityState},finishedAt:new Date().toISOString()};
  resolveRun?.(result); return result;
}
window.lab={
 run(settings={}) {
  loop?.stop();
  options={duration:10000,thrust:false,exact:false,manual:false,block:false,...settings};
  state=createShip(100,300); state.angle=0; previous=state;
  last=null;start=0;frames=0;simulationTime=0;steps=0;deltas=[];visibility.length=0;recording=true;result=null;
  loop=createLoop({simulate,render});
  const promise=new Promise(resolve=>resolveRun=resolve);
  loop.start();
  return options.manual ? true : promise;
 }, finish, getResult:()=>result, getState:()=>state
};
