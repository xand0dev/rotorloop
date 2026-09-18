import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "public/assets/audio");
mkdirSync(output, { recursive: true });

function wav(name, seconds, sample) {
  const sampleRate = 22050;
  const count = Math.floor(sampleRate * seconds);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + count * 2, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(count * 2, 40);
  let seed = 0x5eed1234;
  for (let index = 0; index < count; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const time = index / sampleRate;
    const value = Math.max(-1, Math.min(1, sample(time, seconds, noise)));
    bytes.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  writeFileSync(resolve(output, `${name}.wav`), bytes);
}

wav("shoot", 0.12, (t, duration, noise) => {
  const envelope = (1 - t / duration) ** 2;
  const sweep = Math.sin(2 * Math.PI * (900 * t - 2600 * t * t));
  return envelope * (sweep * 0.48 + noise * 0.08);
});

wav("hit", 0.18, (t, duration, noise) => {
  const envelope = Math.exp((-9 * t) / duration);
  return envelope * (Math.sin(2 * Math.PI * 145 * t) * 0.52 + noise * 0.32);
});

wav("explosion", 0.52, (t, duration, noise) => {
  const envelope = (1 - t / duration) ** 2.4;
  const rumble = Math.sin(2 * Math.PI * (72 - 30 * (t / duration)) * t);
  return envelope * (noise * 0.56 + rumble * 0.32);
});
