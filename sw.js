// 离线支持（Service Worker）。构建时由 scripts/vite-sw-plugin.mjs 填入版本号和预缓存清单，生成 dist/sw.js。
//
// 规则：
// 1. 安装时一次性缓存应用外壳（HTML、JS、CSS、工作线程、图标、manifest）。课程内容（course/unit1/unit2/words 的 JSON）已经打包在 JS 里，所以随 JS 一起缓存。
//    任何一个文件下载失败，整个安装失败，旧版继续用（不会留下缺文件的半个缓存）。
// 2. 不缓存 Pyodide（几十 MB 的 Python 运行环境）：它走普通网络请求，离线时由页面显示“Python运行功能需要联网后加载”。
//    也不缓存 sfx/ 下的测试音频。绝不用预先写好的输出冒充 Python 真实执行。
// 3. 联网时优先取新版：先请求网络，成功就更新缓存；失败（离线、服务器错误）或网络超过 4 秒没响应，才读缓存。
// 4. 缓存名带版本号。新版激活时删除所有旧的 suipian- 缓存，并立刻接管页面。
const VERSION = "2026-11-10T20:02:47.270Z";
const PREFIX = "u7c-suipian-";
const CACHE = PREFIX + VERSION;
const PRECACHE = [
  "./",
  "./index.html",
  "./assets/main-ExmqfcpQ.js",
  "./assets/code-task-9s4F8eZj.js",
  "./assets/errors-BKwIAuf4.js",
  "./assets/keyboard-d9Xcoz37.js",
  "./assets/code-task-BkF6sDyn.css",
  "./assets/errors-DE9dolOj.css",
  "./assets/main-BqDFEiFS.css",
  "./assets/py-worker-BvH1HjKL.js",
  "./manifest.webmanifest",
  "./privacy.html",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png"
];
const SLOW_MS = 4000;          // 网络超过这个时间没响应，就先用缓存
const SLOW_AFTER_MS = 800;     // 刚发现网络很慢之后的一小段时间里，后面的请求只等这么久（页面的 JS、CSS 是一个接一个请求的，不然会累加）
let slowUntil = 0;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(PRECACHE.map(async (url) => {
        const res = await fetch(new Request(url, { cache: "reload" })); // 绕过浏览器 HTTP 缓存，拿服务器上的最新文件
        if (!res.ok) throw new Error(`预缓存失败：${url} ${res.status}`);
        await cache.put(url, res);
      }));
    } catch (err) {
      await caches.delete(CACHE); // 不留下缺文件的半个缓存；安装失败，旧版继续使用
      throw err;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

const scopePath = new URL(self.registration.scope).pathname;
function skip(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (request.headers.has("range")) return true;                 // 音频等分段请求交给浏览器
  const rel = url.pathname.startsWith(scopePath) ? url.pathname.slice(scopePath.length) : url.pathname;
  return rel.startsWith("pyodide/") || rel.startsWith("sfx/");   // 大文件和测试音频不缓存
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const fromCache = async () => {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  };
  const network = fetch(request).then(async (res) => {
    if (res && res.ok && res.type === "basic") cache.put(request, res.clone()).catch(() => {});
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(() => { slowUntil = Date.now() + 30000; resolve(null); }, Date.now() < slowUntil ? SLOW_AFTER_MS : SLOW_MS));
  try {
    const first = await Promise.race([network, slow]);
    if (first) return first.ok ? first : ((await fromCache()) ?? first);
    // 网络太慢：有缓存就先用缓存（网络请求继续，成功后更新缓存）
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    return await network;
  } catch {
    return fromCache();
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (skip(event.request, url)) return;
  event.respondWith(networkFirst(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "version") event.source?.postMessage({ type: "version", version: VERSION, cache: CACHE });
});
