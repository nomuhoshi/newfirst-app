const { chromium } = await import(process.env.PW || "playwright");
const base = "file://" + process.cwd() + "/";
const out = process.argv[2] || "png";
const jobs = (process.argv[3] || "map,question,code,complete,feedback,feedback@wrong,login,login@code,intro,intro@short").split(",");
const phone = { width: 390, height: 844 }, short = { width: 390, height: 450 }, ipad = { width: 1180, height: 820 };
const b = await chromium.launch();
for (const j of jobs) for (const t of ["light", "dark"]) {
  const [p, v] = j.split("@"); // 例：feedback@wrong、intro@short
  const vp = v === "short" ? short : phone;
  const hashExtra = v && v !== "short" ? "-" + v : ""; // short 只改视口，不改页面状态
  const pg = await b.newPage({ viewport: vp, deviceScaleFactor: 2 });
  await pg.goto(base + p + ".html#" + t + hashExtra); await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${out}/${p}${v ? "-" + v : ""}_iphone-${t}.png` }); await pg.close();
}
if (jobs.includes("map")) for (const t of ["light", "dark"]) {
  const pg = await b.newPage({ viewport: ipad, deviceScaleFactor: 2 });
  await pg.goto(base + "map.html#" + t); await pg.waitForTimeout(250);
  await pg.screenshot({ path: `${out}/map_ipad-landscape-${t}.png` }); await pg.close();
}
await b.close();
