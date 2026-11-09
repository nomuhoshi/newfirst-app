// 登录 / 账号界面：邮箱验证码登录、同步状态、退出、切换账号、删除账号。
// 不直接碰数据：全部通过 sync（src/sync.js）；元素创建函数和弹窗从 app.js 传进来，所以样式和无障碍行为和其他弹窗一致。
export function statusText(s) {
  const st = s?.status;
  if (st === "import-recovery-required") return "游客导入记录损坏：云端同步已暂停。学习进度仍保存在本机，请保留数据等待恢复处理。";
  if (st === "import-read-failed") return "无法读取游客导入记录：云端同步已暂停。请检查本机存储后重试。";
  if (st === "synced") return "已同步 ✓";
  if (st === "syncing") return "同步中…";
  if (st === "pending") return s?.message && (s.message.includes("本机副本写回") || s.message.includes("本机同步重试计数")) ? s.message : "有进度等待上传（联网后自动同步）";
  if (st === "offline") return "现在离线：进度已存在这台设备，联网后自动同步";
  if (st === "need-login") return "登录已过期，需要重新登录才能同步（进度还在这台设备上）";
  if (st === "conflict") return "这个账号在别处被覆盖过，需要选择保留哪一份";
  if (st === "pending-local-cleanup") return "账号已在云端删除，但这台设备还没清理完。请不要继续用这个登录。";
  if (st === "error") return "同步失败：" + (s.message || "请稍后再试");
  return "已登录，正在准备同步…";
}
const ERR = {
  network: "网络连不上，请检查网络后重试。",
  "rate-limit": "发送太频繁了，请等一分钟再试。",
  config: "云端暂未开通。",
};
export const errorText = (r) => ERR[r.kind] || r.message || "出错了，请稍后再试。";

// 发验证码失败时的提示：先用中文说清“大概是哪一类问题”，再附上服务器给的状态码、错误码和原文，
// 方便截图给开发者对照 Supabase 日志。只按服务器给的错误码分类，不猜原因；认不出的码只显示原文。
const SEND_HINT = {
  email_address_not_authorized: "这个邮箱不在当前发信服务允许的名单里（默认发信服务只发给项目团队成员）。",
  over_email_send_rate_limit: "发验证码的次数已达上限，请稍后再试。",
  over_request_rate_limit: "请求太频繁了，请稍后再试。",
  email_address_invalid: "服务器不接受这个邮箱地址。",
  otp_disabled: "这个邮箱没有登录资格（此环境已关闭公开注册）。",
  signup_disabled: "这个邮箱没有登录资格（此环境已关闭公开注册）。",
  email_provider_disabled: "此环境没有开启邮箱登录。",
  unexpected_failure: "服务器这边发信失败了，不是你的操作问题。",
};
export function sendCodeErrorText(r) {
  if (!r || r.ok) return "";
  if (r.kind === "network") return ERR.network;
  if (r.kind === "config") return ERR.config;
  let lead = r.errorCode && SEND_HINT[r.errorCode];
  if (!lead) {
    if (r.kind === "rate-limit") lead = ERR["rate-limit"];
    else if (r.status >= 500) lead = "服务器这边出错了，不是你的操作问题。";
    else lead = "验证码没发出去。";
  }
  const bits = [];
  if (r.status) bits.push(`服务器返回 ${r.status}`);
  if (r.errorCode) bits.push(r.errorCode);
  const raw = r.message && !/^服务器返回 \d+$/.test(r.message) ? r.message : "";
  const detail = bits.join(" · ") + (raw ? (bits.length ? "：" : "") + raw : "");
  return detail ? `${lead}（${detail}）` : lead;
}

export function createAccountUi({ h, button, sheet, icon, showToast, sync, api, getState, onSwitchedIn, onSwitchedOut, rerender }) {
  const statusEls = new Set();
  function refreshStatus() {
    const s = sync.status();
    for (const el of [...statusEls]) { if (el.__shown && !el.isConnected) { statusEls.delete(el); continue; } paint(el, s); }
  }
  function paint(el, s) { el.textContent = statusText(s); el.dataset.status = s.status || ""; if (el.isConnected) el.__shown = true; }

  // ---------- 登录弹窗 ----------
  function openLogin({ reason = "" } = {}) {
    if (!api.configured) { showToast("云端暂未开通，现在只能在这台设备上学习。"); return; }
    return sheet((close) => {
      const box = h("div", { class: "lsheet login", "data-login": "" });
      let email = "", busy = false, cooldownTimer = null, cooldownUntil = 0;
      const msg = h("p", { class: "login-msg", role: "alert", "data-login-msg": "" });
      const say = (t, bad = true) => { msg.textContent = t; msg.classList.toggle("bad", bad); };
      const done = () => { clearInterval(cooldownTimer); close(); };

      function stepEmail() {
        const input = h("input", { class: "login-input", type: "email", inputmode: "email", autocomplete: "email", autocapitalize: "off", spellcheck: "false", placeholder: "you@example.com", "aria-label": "邮箱", "data-email": "" });
        input.value = email;
        const go = button("发送验证码", async () => {
          const v = input.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { say("请输入有效的邮箱地址。"); return; }
          if (busy) return; busy = true; go.disabled = true; say("正在发送…", false);
          const r = await sync.sendCode(v);
          busy = false; go.disabled = false;
          if (!r.ok) { if (r.kind === "rate-limit") cooldownUntil = Date.now() + 60000; say(sendCodeErrorText(r)); return; }
          email = v; cooldownUntil = Date.now() + 60000; say("");
          stepCode();
        }, "btn3d primary wide", { "data-send-code": "" });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        box.replaceChildren(
          h("h2", { text: "登录 / 注册" }),
          h("p", { text: reason || "用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。" }),
          input, go, msg,
          ...(sync.hasLeftoverAuth && sync.hasLeftoverAuth() ? [leftoverButton()] : []),
          button("先不登录", done, "btn3d ghost wide"),
        );
        setTimeout(() => input.focus(), 50);
      }
      // 上次退出时云端已撤销、但这台设备的登录凭证没清掉：给一个再次清理的入口（不联网，读回确认才算成功）
      function leftoverButton() {
        const b = button("清理本机残留的登录凭证", async () => {
          b.disabled = true;
          const r = await sync.retryAuthCleanup();
          if (r.ok) { b.remove(); say(r.nothingToClean ? "没有发现需要清理的登录凭证。" : "已清理本机残留的登录凭证。", false); } else { b.disabled = false; say(r.message || "还是没清掉，请检查浏览器的存储权限后再试。"); }
        }, "btn3d ghost wide", { "data-clean-auth": "" });
        return b;
      }

      function stepCode() {
        const input = h("input", { class: "login-input code", type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "one-time-code", maxlength: "10", placeholder: "验证码", "aria-label": "邮箱验证码", "data-code": "" });
        const resend = button("重新发送", async () => {
          if (Date.now() < cooldownUntil || busy) return;
          busy = true; const r = await sync.sendCode(email); busy = false;
          if (!r.ok) { if (r.kind === "rate-limit") cooldownUntil = Date.now() + 60000; say(sendCodeErrorText(r)); tick(); return; }
          cooldownUntil = Date.now() + 60000; say("已重新发送。", false); tick();
        }, "btn3d ghost", { "data-resend": "" });
        const tick = () => { const left = Math.ceil((cooldownUntil - Date.now()) / 1000); resend.disabled = left > 0; resend.textContent = left > 0 ? `重新发送（${left} 秒）` : "重新发送"; };
        clearInterval(cooldownTimer); cooldownTimer = setInterval(() => { if (!box.isConnected) { clearInterval(cooldownTimer); return; } tick(); }, 1000); tick();
        const go = button("登录", async () => {
          const c = input.value.replace(/\s+/g, "");
          if (c.length < 4) { say("请输入邮件里的验证码。"); return; }
          if (busy) return; busy = true; go.disabled = true; say("正在登录…", false);
          const r = await sync.verify(email, c, getState());
          busy = false; go.disabled = false;
          if (!r.ok) { say(r.kind === "auth" ? "验证码错误或已过期，请检查后重试，或点“重新发送”。" : errorText(r)); return; }
          if (r.needChoice) { stepChoice(r); return; }
          success(r);
        }, "btn3d primary wide", { "data-verify": "" });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        box.replaceChildren(
          h("h2", { text: "输入验证码" }),
          h("p", { text: `验证码已发到 ${email}。没收到？看看垃圾邮件，或稍等再重新发送。` }),
          input, go, resend, msg,
          button("换个邮箱", () => { say(""); stepEmail(); }, "btn3d ghost wide"),
        );
        setTimeout(() => input.focus(), 50);
      }

      function stepChoice(info) {
        const g = `${info.guest.xp} XP、${info.guest.lessons} 关`;
        const pick = async (choice, label) => {
          if (busy) return; busy = true; say("正在处理…", false);
          const r = await sync.finishChoice(choice);
          busy = false;
          if (!r.ok) { say(errorText(r)); return; }
          success(r);
        };
        if (!info.cloudHasData) {
          box.replaceChildren(
            h("h2", { text: "转存这台设备上的进度？" }),
            h("p", { text: `这台设备上有没登录时学的进度（${g}）。要放进这个账号吗？` }),
            button("安全合并到账号", () => pick("transfer"), "btn3d primary wide", { "data-choice": "transfer" }),
            button("不转存，用全新账号", () => pick("cloud"), "btn3d wide", { "data-choice": "cloud" }),
            h("p", { class: "muted small", text: "安全合并：XP / 次数按设备取较大值，关卡和日期取并集；上传成功并确认云端一致后，游客记录才会清除。不转存则原样保留。" }),
            msg,
          );
        } else {
          box.replaceChildren(
            h("h2", { text: "这个账号已有学习进度" }),
            h("p", { text: `云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${g}）。` }),
            button("保留云端进度（推荐）", () => pick("cloud"), "btn3d primary wide", { "data-choice": "cloud" }),
            button("安全合并游客进度", () => pick("transfer"), "btn3d wide", { "data-choice": "transfer" }),
            h("p", { class: "muted small", text: "安全合并不会整份覆盖：其他设备的 XP、关卡、红心和设置都会保留，XP / 次数按设备取较大值，关卡和日期取并集。选“保留云端进度”时游客记录原样保留，只记下它的指纹，之后游客再变才会再次提示。" }),
            msg,
          );
        }
      }

      function success(r) {
        done();
        onSwitchedIn(r);
        showToast(r.synced ? "登录成功，进度已同步。" : "登录成功。" + (r.syncError ? "云端暂时没同步上（" + r.syncError + "），联网后会自动补上。" : ""));
      }
      stepEmail();
      return [box];
    }, { cls: "login-sheet" });
  }

  // ---------- “我的”页里的账号卡片 ----------
  function accountCard() {
    const acc = sync.account();
    const card = h("section", { class: "acct-card", "data-account": "" });
    if (!api.configured) {
      card.append(h("h3", { text: "账号" }), h("p", { class: "muted", text: "云端暂未开通：学习进度只保存在这台设备上。" }));
      return card;
    }
    if (!acc) {
      card.append(h("h3", { text: "账号" }), h("p", { class: "muted", text: "登录后，进度会保存到云端，换手机或 iPad 也能接着学。" }),
        button("邮箱登录 / 注册", () => openLogin(), "btn3d primary wide", { "data-open-login": "" }));
      return card;
    }
    const st = h("p", { class: "acct-status", role: "status", "data-sync-status": "" }); statusEls.add(st);
    const sheetConfirm = (title, body, okLabel, okFn, danger = false) => sheet((close) => [h("div", { class: "lsheet" }, h("h2", { text: title }), h("p", { text: body }),
      button(okLabel, async () => { close(); await okFn(); }, "btn3d wide " + (danger ? "danger" : "primary")), button("取消", close, "btn3d ghost wide"))]);
    // ---------- 损坏的游客导入待办：恢复入口 ----------
    // 确认损坏（corrupt）才给“备份并重新导入”；读取失败（read-failed）只给“重试读取”，绝不隔离。
    // 恢复成功只在隔离确实完成（原文已备份并读回、原待办已删除并读回）之后才说；任何一步失败都如实告诉用户原待办还在。
    function openImportChoice(info) {
      const g = `${info.guest.xp} XP、${info.guest.lessons} 关`;
      sheet((close) => {
        const msg = h("p", { class: "login-msg", role: "alert", "data-choice-msg": "" });
        const pick = async (choice) => {
          msg.textContent = "正在处理…"; msg.classList.remove("bad");
          const r = await sync.finishChoice(choice);
          if (!r.ok) { msg.textContent = errorText(r); msg.classList.add("bad"); return; }
          close(); onSwitchedIn(r);
          showToast(r.synced ? "游客进度已处理，已同步。" : "游客进度已处理。" + (r.syncError ? "云端暂时没同步上（" + r.syncError + "），联网后会自动补上。" : ""));
        };
        return [h("div", { class: "lsheet", "data-import-choice": "" },
          info.cloudHasData
            ? [h("h2", { text: "这个账号已有学习进度" }), h("p", { text: `云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${g}）。` }),
              button("保留云端进度（推荐）", () => pick("cloud"), "btn3d primary wide", { "data-choice": "cloud" }),
              button("安全合并游客进度", () => pick("transfer"), "btn3d wide", { "data-choice": "transfer" })]
            : [h("h2", { text: "转存这台设备上的进度？" }), h("p", { text: `这台设备上有没登录时学的进度（${g}）。要放进这个账号吗？` }),
              button("安全合并到账号", () => pick("transfer"), "btn3d primary wide", { "data-choice": "transfer" }),
              button("不转存，用全新账号", () => pick("cloud"), "btn3d wide", { "data-choice": "cloud" })],
          msg, button("稍后再说", close, "btn3d ghost wide"))];
      });
    }
    async function runRecovery(digest) {
      const q = await sync.quarantinePendingImport({ expectedDigest: digest });
      if (!q.ok) { showToast(q.message || "没有处理成功，原来的待办还在。"); rerender(); return; }
      showToast("损坏的待办已备份并移除。");
      const r = await sync.resumeGuestImportChoice(getState());
      if (!r.ok) { showToast("待办已处理，但还没能确认云端：" + errorText(r) + " 点“立即同步”可重试。"); rerender(); return; }
      if (r.needChoice) { rerender(); openImportChoice(r); return; }
      showToast(r.alreadyImported ? "云端已经有这份游客进度，不会重复加分。" : "已同步。"); rerender();
    }
    function recoveryBox() {
      const info = sync.pendingRecoveryInfo();
      if (info.state === "corrupt") {
        return h("div", { class: "acct-recover", "data-recovery": "corrupt" },
          h("p", { class: "muted small", text: "游客导入待办损坏，云端同步已锁定。可以先把损坏的内容备份在本机，再重新确认游客进度怎么处理；游客记录、账号副本和登录都不会被删。" }),
          button("备份并重新导入", () => sheetConfirm("备份损坏的待办？", "会把损坏的待办原文备份在这台设备上（读回确认后才移除原待办），不联网。之后会重新问你游客进度怎么处理，不会重复加分。", "备份并继续", () => runRecovery(info.digest)), "btn3d wide", { "data-quarantine": "" }));
      }
      if (info.state === "read-failed") {
        return h("div", { class: "acct-recover", "data-recovery": "read-failed" },
          h("p", { class: "muted small", text: "现在读不出游客导入待办。这只是读取失败，不能当作损坏，所以不会备份或删除任何东西。请检查浏览器存储权限后重试。" }),
          button("重试读取", async () => { const r = await sync.syncNow({ manual: true }); if (!r.ok) showToast(errorText(r)); rerender(); }, "btn3d wide", { "data-pending-retry": "" }));
      }
      return null;
    }
    async function doLogout(then) {
      const r = await sync.logout();
      if (r.ok) { onSwitchedOut(); showToast(r.warning ? r.message : "已退出登录。"); if (then) then(); return; }
      if (r.stayed) sheetConfirm("云端退出失败", "这台设备仍保持登录，还没上传的进度也留在这里。可以稍后再试，或只在这台设备退出（云端会话可能仍有效）。", "只在这台设备退出", async () => {
        const f = await sync.forceLocalLogout();
        if (!f.ok) { showToast(f.message || "还没退出。"); return; }
        onSwitchedOut(); showToast(f.warning ? f.message : "已退出登录。"); if (then) then();
      }, true);
      else if (r.kind === "import-corrupt" || r.kind === "import-read-failed") sheetConfirm("游客导入待办需要恢复", "云端同步已锁定，继续学习可保存在本机。仅在本机退出会保留游客记录、损坏待办和未上传账号副本；重新登录后仍需专门恢复，云端会话可能仍有效。", "仅在本机退出", async () => {
        const f = await sync.forceLocalLogout();
        if (!f.ok) { showToast(f.message || "还没退出。"); return; }
        onSwitchedOut(); showToast(f.message || "已在本机退出，数据已保留。"); if (then) then();
      }, true);
      else if (r.pending) sheetConfirm("有进度还没上传", "现在连不上云端。退出后这些进度会先留在这台设备上，用同一个账号重新登录时会接着上传；建议联网后再退出。", "仍然退出", async () => {
        const f = await sync.logout({ force: true });
        if (!f.ok) { showToast(f.message || "还没退出。"); return; }
        onSwitchedOut(); showToast(f.warning ? f.message : "已退出登录。"); if (then) then();
      }, true);
      else showToast(errorText(r));
    }
    card.append(h("h3", { text: "账号" }), h("p", { class: "acct-email", text: acc.email || "已登录" }), st, ...[recoveryBox()].filter(Boolean),
      button("立即同步", async () => { const r = await sync.syncNow({ manual: true }); if (!r.ok) showToast(errorText(r)); else rerender(); }, "btn3d wide", { "data-sync-now": "" }),
      h("div", { class: "acct-row" },
        button("退出登录", () => doLogout(), "btn3d", { "data-logout": "" }),
        button("切换账号", () => doLogout(() => openLogin()), "btn3d", { "data-switch": "" })),
      button("删除账号和云端记录", () => sheetConfirm("删除账号？", "会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。", "永久删除", async () => {
        const r = await sync.deleteAccount();
        if (r.ok) { onSwitchedOut(); showToast("账号已删除。"); }
        else if (r.pendingLocalCleanup) { onSwitchedOut(); showToast(r.message); }
        else showToast(errorText(r));
      }, true), "btn3d danger-ghost wide", { "data-delete-account": "" }));
    paint(st, sync.status());
    return card;
  }

  // ---------- 地图页上的一行入口 ----------
  function accountRow() {
    if (!api.configured) return null;
    const acc = sync.account();
    if (!acc) return button("登录 / 注册：换设备也能接着学", () => openLogin(), "acct-link", { "data-login-link": "" });
    const st = h("span", { class: "acct-mini", "data-sync-mini": "" }); statusEls.add(st);
    const row = h("div", { class: "acct-row-mini" }, h("span", { text: acc.email || "已登录" }), st);
    paint(st, sync.status());
    return row;
  }

  return { openLogin, accountCard, accountRow, refreshStatus };
}
