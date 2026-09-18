import {
  createAbortError,
  HttpError,
  isRetryableError,
  JsonParseError,
} from "./errors.js";

function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError(signal.reason);
}

function defaultFetch(input, init) {
  return globalThis.fetch(input, init);
}

function responseError(response, url) {
  if (!response.ok) throw new HttpError(response, url);
  return response;
}

export async function fetchJson(
  url,
  { signal, fetchImpl = defaultFetch } = {},
) {
  throwIfAborted(signal);
  const response = responseError(await fetchImpl(url, { signal }), url);
  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw createAbortError(signal.reason);
    throw new JsonParseError(url, error);
  }
}

export function abortableDelay(
  ms,
  signal,
  setTimer = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimer(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(createAbortError(signal.reason));
      },
      { once: true },
    );
  });
}

export async function withRetry(
  operation,
  {
    attempts = 3,
    baseMs = 180,
    jitter = 0.25,
    signal,
    rng = Math.random,
    delay = abortableDelay,
    shouldRetry = isRetryableError,
    onRetry = () => {},
  } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError("attempts must be a positive integer");
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await operation(attempt);
    } catch (error) {
      if (signal?.aborted) throw createAbortError(signal.reason);
      if (attempt === attempts || !shouldRetry(error)) throw error;
      const exponential = baseMs * 2 ** (attempt - 1);
      const waitMs = Math.max(
        0,
        Math.round(exponential * (1 - jitter + rng() * jitter * 2)),
      );
      onRetry({ attempt, nextAttempt: attempt + 1, waitMs, error });
      await delay(waitMs, signal);
    }
  }
  throw new Error("unreachable retry state");
}

function waitForAbort(signal) {
  return new Promise((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(createAbortError(signal.reason)),
      { once: true },
    );
  });
}

async function abortableWork(work, signal) {
  throwIfAborted(signal);
  if (!signal) return await work;
  return await Promise.race([work, waitForAbort(signal)]);
}

async function decodeImageBlob(blob, { signal } = {}) {
  throwIfAborted(signal);
  if (typeof Image === "function") {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        image.src = "";
        cleanup();
        reject(createAbortError(signal.reason));
      };
      image.onload = () => {
        cleanup();
        resolve(image);
      };
      image.onerror = () => {
        cleanup();
        reject(new TypeError("Image decoding failed"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      image.src = objectUrl;
    });
  }
  if (globalThis.createImageBitmap) {
    return await abortableWork(globalThis.createImageBitmap(blob), signal);
  }
  throw new TypeError("No image decoder is available");
}

export async function loadImage(
  url,
  { signal, fetchImpl = defaultFetch, decodeImage = decodeImageBlob } = {},
) {
  throwIfAborted(signal);
  const response = responseError(await fetchImpl(url, { signal }), url);
  const blob = await response.blob();
  return await abortableWork(decodeImage(blob, { signal, url }), signal);
}

export async function loadAudio(
  audioContext,
  url,
  { signal, fetchImpl = defaultFetch } = {},
) {
  throwIfAborted(signal);
  const response = responseError(await fetchImpl(url, { signal }), url);
  const bytes = await response.arrayBuffer();
  const decoded = audioContext.decodeAudioData(bytes.slice(0));
  return await abortableWork(decoded, signal);
}

export async function loadJson(url, options = {}) {
  return await fetchJson(url, options);
}

function manifestItems(manifest) {
  return [
    ...(manifest.sprites ?? []).map((item) => ({ ...item, type: "sprites" })),
    ...(manifest.audio ?? []).map((item) => ({ ...item, type: "audio" })),
    ...(manifest.json ?? []).map((item) => ({ ...item, type: "json" })),
  ];
}

export async function loadAll(
  manifest,
  {
    signal,
    audioContext,
    onProgress = () => {},
    retry = {},
    loaders = {
      sprites: (item) => loadImage(item.url, { signal }),
      audio: (item) => loadAudio(audioContext, item.url, { signal }),
      json: (item) => loadJson(item.url, { signal }),
    },
  } = {},
) {
  const items = manifestItems(manifest);
  let completed = 0;
  const loaded = await Promise.all(
    items.map(async (item) => {
      const value = await withRetry(() => loaders[item.type](item), {
        ...retry,
        signal,
      });
      completed += 1;
      onProgress({
        item,
        completed,
        total: items.length,
        ratio: items.length === 0 ? 1 : completed / items.length,
      });
      return { item, value };
    }),
  );
  const result = {
    sprites: new Map(),
    audio: new Map(),
    json: new Map(),
    manifest,
  };
  for (const { item, value } of loaded) result[item.type].set(item.id, value);
  return result;
}
