const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = {};

{
  const output = [];
  async function arm() {
    output.push("arm");
    await 0;
    output.push("armed");
  }
  output.push("boot");
  void arm();
  output.push("continue");
  await delay(0);
  results.await = output;
}

{
  const output = [];
  output.push("dock");
  Promise.resolve()
    .then(() => {
      output.push("micro-1");
      setTimeout(() => output.push("timer-in-then"), 0);
    })
    .then(() => output.push("micro-2"));
  queueMicrotask(() => output.push("manual-micro"));
  output.push("clear");
  await delay(20);
  results.chain = output;
}

{
  const output = [];
  const frame = new Promise((resolve) => {
    requestAnimationFrame(() => {
      output.push("animation-frame");
      Promise.resolve().then(() => {
        output.push("frame-microtask");
        resolve();
      });
    });
  });
  setTimeout(() => output.push("timer"), 0);
  Promise.resolve().then(() => output.push("microtask"));
  output.push("scheduled");
  await Promise.all([frame, delay(30)]);
  results.frame = output;
}

{
  const output = [];
  Promise.resolve()
    .then(() => {
      throw new Error("yaw sensor");
    })
    .then(() => output.push("skipped"))
    .catch(() => output.push("caught"))
    .finally(() => output.push("finally"))
    .then(() => output.push("recovered"));
  output.push("sync");
  await delay(0);
  results.rejection = output;
}

{
  const output = [];
  const slow = new Promise((resolve) =>
    setTimeout(() => {
      output.push("slow-settled");
      resolve("slow");
    }, 0),
  );
  Promise.all([slow, Promise.reject(new Error("manifest"))]).catch(() =>
    output.push("all-rejected"),
  );
  queueMicrotask(() => output.push("queued-microtask"));
  output.push("sync");
  await delay(20);
  results.all = output;
}

document.querySelector("#results").textContent = JSON.stringify(results, null, 2);
