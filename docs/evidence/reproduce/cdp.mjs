import fs from 'node:fs/promises';

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connect() {
  const info = await (await fetch('http://127.0.0.1:9223/json/version')).json();
  const socket = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener('close', () => {
    for (const handler of pending.values()) handler.reject(new Error('Chrome connection closed'));
    pending.clear();
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
      else handler.resolve(message.result);
    } else events.push(message);
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},30000);
      pending.set(id, { resolve: value=>{clearTimeout(timeout);resolve(value);}, reject:error=>{clearTimeout(timeout);reject(error);} });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? {sessionId} : {}) }));
    });
  }
  async function page(url) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    await call('Runtime.enable');
    await call('Page.enable');
    await call('Page.navigate', { url });
    return { targetId, sessionId, call,
      async evaluate(expression) {
        const result = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
      },
      async screenshot(path) {
        const {data} = await call('Page.captureScreenshot', {format:'png'});
        await fs.writeFile(path, Buffer.from(data,'base64'));
      },
      activate: () => send('Target.activateTarget', {targetId}),
      close: () => send('Target.closeTarget', {targetId}),
    };
  }
  return {info, events, send, page, close:() => socket.close()};
}
