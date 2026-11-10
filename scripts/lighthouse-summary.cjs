// 汇总 Lighthouse JSON 报告的分数和关键指标。用法：node scripts/lighthouse-summary.cjs <报告目录>
const fs=require("fs");const d=process.argv[2];
for(const f of fs.readdirSync(d).filter(f=>f.endsWith(".json")).sort()){const j=JSON.parse(fs.readFileSync(d+"/"+f));
const a=k=>j.audits[k]?.displayValue||"";
console.log(f, Object.values(j.categories).map(c=>c.id+"="+Math.round(c.score*100)).join(" "), "FCP="+a("first-contentful-paint"), "LCP="+a("largest-contentful-paint"), "TBT="+a("total-blocking-time"), "CLS="+a("cumulative-layout-shift"), "SI="+a("speed-index"));}
