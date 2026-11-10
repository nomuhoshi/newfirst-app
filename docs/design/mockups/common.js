// 效果稿共用：#dark 切深色；注入图标 sprite（真空管轮廓取自 PR #29 docs/design/energy-tube.svg）
if (location.hash.includes("dark")) document.documentElement.classList.add("dark");
const SPRITE = `<svg width="0" height="0" style="position:absolute"><defs>
<symbol id="tube-on" viewBox="8 0 44 64"><ellipse cx="30" cy="26" rx="17" ry="20" fill="var(--glow)" opacity=".28"/>
<path d="M30 4C18 4 12 14 12 26c0 8 4 14 8 17v4h20v-4c4-3 8-9 8-17C48 14 42 4 30 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
<path d="M24 42V30l6-8 6 8v12" fill="none" stroke="var(--glow)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="19" y="47" width="22" height="9" rx="2" fill="currentColor"/><path d="M24 56v5M30 56v5M36 56v5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></symbol>
<symbol id="tube-off" viewBox="8 0 44 64"><path d="M30 4C18 4 12 14 12 26c0 8 4 14 8 17v4h20v-4c4-3 8-9 8-17C48 14 42 4 30 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" opacity=".45"/>
<path d="M24 42V30l6-8 6 8v12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 6" opacity=".45"/>
<rect x="19" y="47" width="22" height="9" rx="2" fill="currentColor" opacity=".45"/><path d="M24 56v5M30 56v5M36 56v5" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".45"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 01-11 0c0-2.5 1.2-4 2.5-5 .2 1.8 1 2.8 2 3.2-.6-3.4.2-6.6 1-9.2z" fill="currentColor"/></symbol>
<symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13.5 2L5 13.5h6L10 22l9-12h-6.2z" fill="currentColor"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7v9a1 1 0 01-1 1H15v-6h-6v6H4.5a1 1 0 01-1-1z" fill="currentColor"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-right" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0012 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-reset" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 102.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-term" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 10l3 2.5L7 15M12.5 15H17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</defs></svg>`;
document.body.insertAdjacentHTML("afterbegin", SPRITE);
// 用法：<span data-tubes="4"></span> → 5 支真空管 + 数字
document.querySelectorAll("[data-tubes]").forEach(el => {
  const n = +el.dataset.tubes; let h = '<span class="tubes">';
  for (let i = 0; i < 5; i++) h += `<svg class="tube"><use href="#tube-${i < n ? "on" : "off"}"/></svg>`;
  el.innerHTML = h + `</span><span>${n}/5</span>`;
});
