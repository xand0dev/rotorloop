import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { loadImage, loadJson } from "../src/assets/loader.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const waits = new Map([
  ["/sprite.svg", 120],
  ["/sound.wav", 180],
  ["/arena.json", 90],
]);

const server = createServer((request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  if (path === "/missing-sprite.svg") {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
    return;
  }
  if (path === "/malformed.json") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"broken":true,,}');
    return;
  }
  if (path === "/slow.json") {
    const timer = setTimeout(() => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"late":true}');
    }, 500);
    request.on("close", () => clearTimeout(timer));
    return;
  }
  const wait = waits.get(path);
  if (wait !== undefined) {
    setTimeout(() => {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": path.endsWith("json")
          ? "application/json"
          : "application/octet-stream",
      });
      response.end(path.endsWith("json") ? '{"arena":"ready"}' : "asset");
    }, wait);
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise((resolveListen) =>
  server.listen(0, "127.0.0.1", resolveListen),
);
const address = server.address();
const base = `http://127.0.0.1:${address.port}`;

async function sample(mode) {
  const urls = [...waits.keys()].map((path) => `${base}${path}`);
  const started = performance.now();
  if (mode === "sequential") {
    for (const url of urls) await fetch(url, { cache: "no-store" });
  } else {
    await Promise.all(urls.map((url) => fetch(url, { cache: "no-store" })));
  }
  return Number((performance.now() - started).toFixed(2));
}

const benchmark = { sequentialMs: [], concurrentMs: [] };
for (let trial = 0; trial < 5; trial += 1) {
  benchmark.sequentialMs.push(await sample("sequential"));
  benchmark.concurrentMs.push(await sample("concurrent"));
}

async function capture(name, operation, recovery) {
  const started = performance.now();
  try {
    await operation();
    return { name, unexpected: "fulfilled" };
  } catch (error) {
    return {
      name,
      errorName: error.name,
      message: error.message,
      status: error.status ?? null,
      elapsedMs: Number((performance.now() - started).toFixed(2)),
      recovery,
    };
  }
}

const failures = [];
failures.push(
  await capture(
    "missing sprite / 404",
    () => loadImage(`${base}/missing-sprite.svg`),
    "automatic retry blocked for 4xx; corrected URL can be retried manually",
  ),
);
failures.push(
  await capture(
    "network timeout",
    () => loadJson(`${base}/slow.json`, { signal: AbortSignal.timeout(60) }),
    "TimeoutError is transient and eligible for bounded retry",
  ),
);
const abortController = new AbortController();
setTimeout(
  () => abortController.abort(new DOMException("pilot left", "AbortError")),
  45,
);
failures.push(
  await capture(
    "abort during loading",
    () => loadJson(`${base}/slow.json`, { signal: abortController.signal }),
    "AbortError stops immediately and is never retried",
  ),
);
failures.push(
  await capture(
    "malformed JSON",
    () => loadJson(`${base}/malformed.json`),
    "JsonParseError is not retried; corrected data can be retried manually",
  ),
);

const evidence = {
  recordedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    transport: "loopback HTTP on 127.0.0.1 with no-store responses",
  },
  method: {
    trials: 5,
    endpointDelayMs: Object.fromEntries(waits),
    sequence:
      "Each trial fetched the same three endpoints; sequential and Promise.all runs alternated.",
    limitation:
      "Delays are controlled server response delays on loopback. This demonstrates waiting/coordination cost, not public-network throughput.",
  },
  benchmark,
  failures,
};

await writeFile(
  resolve(root, "docs/evidence/lab-03-async-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
server.close();
console.log(JSON.stringify(evidence, null, 2));
