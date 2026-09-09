# Telemetry extension functional smoke

Run Vite at `http://127.0.0.1:5173/`. Start an isolated Chrome (not your personal profile), using `--headless=new --remote-debugging-port=9231 --user-data-dir=/tmp/rotorloop-telemetry-chrome --no-first-run --no-default-browser-check about:blank`. From the repository root run `node docs/evidence/reproduce/telemetry-smoke.mjs`.

The script uses Chrome DevTools Protocol, records browser version and Canvas sizes/transforms, and takes screenshots at the declared emulated viewport/DPR values. A test-only `fillText` observer records a bounded tail of HUD labels; it is injected into the test page and never included in production. JSON and screenshots are sampled consecutively, so their tick counts can differ. `hidden` means the H-collapsed panel, not a background document. The W/D/R input sequence is a short interaction smoke, not a latency measurement. The script records observations; unit tests assert the underlying statistics and loop behavior.

There is no CPU throttling or deliberate load. This is a headless functional check and does not claim monitor frequency, a new performance benchmark, or a repeat of the three lab experiments. Initial implementation parent: `0f134a2f1f4c90fe727ed35ab7e6d15d39f80d57`; the extension source is stored in the same commit as these observations.

Expected layout: expanded top right at 1100×750; compact after H; expanded again after H with counters retained after R; stacked at 390×700 and 300×540; suppressed at 700×350. Expected DPR 2 backing is 780×1400 for a 390×700 CSS arena, with transform scale 2. The captured exception list should be empty. The original `lab-01` release evidence remains separate.
