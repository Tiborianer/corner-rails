import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.RAILJET_CDP_ENDPOINT ?? "http://127.0.0.1:9223";
const outputDirectory = path.resolve("qa/railjet-lab");
const baseUrl = process.env.RAILJET_LAB_URL ?? "http://localhost:3000/";

const candidates = [
  ["classic", "generated-2d", "classic-generated-mobile.png"],
  ["classic", "vector-2d", "classic-vector-mobile.png"],
  ["classic", "hybrid-3d", "classic-hybrid-mobile.png"],
  ["nextgen", "generated-2d", "nextgen-generated-mobile.png"],
  ["nextgen", "vector-2d", "nextgen-vector-mobile.png"],
  ["nextgen", "hybrid-3d", "nextgen-hybrid-mobile.png"],
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function openTarget(url) {
  const response = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
  return response.json();
}

async function closeTarget(id) {
  await fetch(`${endpoint}/json/close/${id}`);
}

async function captureTarget(target, outputPath) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let requestId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    requestId += 1;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  });
  await send("Emulation.setEmulatedMedia", { media: "screen" });
  await wait(6500);
  const state = await send("Runtime.evaluate", {
    expression: `JSON.stringify({canvas: Boolean(document.querySelector('canvas')), error: Boolean(document.querySelector('[data-nextjs-dialog]')), width: innerWidth, height: innerHeight})`,
    returnByValue: true,
  });
  const pageState = JSON.parse(state.result.value);
  if (!pageState.canvas || pageState.error) throw new Error(`Unhealthy lab page: ${JSON.stringify(pageState)}`);
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
  socket.close();
  return pageState;
}

await mkdir(outputDirectory, { recursive: true });
for (const [generation, method, filename] of candidates) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    railjetLab: "1",
    generation,
    method,
    motion: "stationary",
    atmosphere: "day",
    scale: "normal",
    load: "1",
  }).toString();
  const target = await openTarget(url.toString());
  try {
    const state = await captureTarget(target, path.join(outputDirectory, filename));
    console.log(`${filename}: ${state.width}x${state.height}`);
  } finally {
    await closeTarget(target.id);
  }
}
