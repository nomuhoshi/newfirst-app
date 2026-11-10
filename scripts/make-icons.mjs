// 生成主屏幕图标（原创：墨蓝底 + 折角记录卡“小码”）。运行：node scripts/make-icons.mjs
// 会重写 public/ 下全部 5 个图标；图案和颜色不变（只有 maskable 两个的留白更大）。
import { chromium } from "playwright";
// k：图案缩放。普通图标 .62；可遮罩（maskable）图标 .56，让图案完整落在 80% 安全区内（系统会裁成圆形 / 圆角方形）。
const svg = (s, k = 0.62) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${s}" height="${s}">
<rect width="100" height="100" fill="#234E70"/>
<g transform="translate(50 50) scale(${k}) translate(-51 -52)" stroke-linejoin="round" stroke-linecap="round">
<rect x="26" y="86" width="14" height="9" rx="3" fill="#172B3A" stroke="#172B3A" stroke-width="4"/>
<rect x="60" y="86" width="14" height="9" rx="3" fill="#172B3A" stroke="#172B3A" stroke-width="4"/>
<path d="M22 12H66L90 36V80Q90 90 80 90H22Q12 90 12 80V22Q12 12 22 12Z" fill="#FFF8EC" stroke="#172B3A" stroke-width="4"/>
<path d="M66 12L90 36H76Q66 36 66 26Z" fill="#B75532" stroke="#172B3A" stroke-width="3"/>
<path d="M36 44Q31 51 36 58M64 44Q69 51 64 58M42 68Q50 75 58 68" fill="none" stroke="#172B3A" stroke-width="4"/>
</g></svg>`;
const b = await chromium.launch();
for (const [name, s, k] of [["icon-180.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-192.png", 192, 0.56], ["icon-maskable-512.png", 512, 0.56]]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<body style="margin:0">${svg(s, k)}</body>`);
  await p.screenshot({ path: `public/${name}` });
  await p.close();
}
await b.close();
console.log("icons written");
