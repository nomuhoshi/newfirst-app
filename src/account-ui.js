// 登录 / 账号界面：邮箱验证码登录、同步状态、退出、切换账号、删除账号。
// 不直接碰数据：全部通过 sync（src/sync.js）；元素创建函数和弹窗从 app.js 传进来，所以样式和无障碍行为和其他弹窗一致。
export function statusText(s) {
  const st = s?.status;
  if (st === "synced") return "已同步 ✓";
  if (st === "syncing") return "同步中…";
  if (st === "pending") return s.message ? "有进度等待上传：" + s.message : "有进度等待上传（联网后自动同步）";
  if (st === "offline") return "现在离线：进度已存在这台设备，联网后自动同步";
  if (st === "need-login") return "登录已过期，需要重新登录才能同步（进度还在这台设备上）";
  if (st === "conflict") return "这个账号在别处被覆盖过，需要选择保留哪一份";
  if (st === "rate-limit") return `请求太频繁，请等 ${s.cooldownSeconds || 60} 秒再试（进度已保存在这台设备）`;
  if (st === "error") return "同步失败：" + (s.message || "请稍后再试");
  return "已登录，正在准备同步…";
}
const ERR = {
  network: "网络连不上，请检查网络后重试。",
  "rate-limit": "发送太频繁了，请等一会儿再试。",
  config: "云端暂未开通。",
};
export const errorText = (r) => (r.kind === "rate-limit" ? r.message || ERR["rate-limit"] : ERR[r.kind] || r.message || "出错了，请稍后再试。");

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
      let email = "", busy = false, cooldownTimer = null;
      let cooldownUntil = Date.now() + (sync.sendCooldownSeconds?.() || 0) * 1000;
      let verifyBlockedUntil = Date.now() + (sync.verifyCooldownSeconds?.() || 0) * 1000;
      const msg = h("p", { class: "login-msg", role: "alert", "data-login-msg": "" });
      const say = (t, bad = true) => { msg.textContent = t; msg.classList.toggle("bad", bad); };
      const done = () => { clearInterval(cooldownTimer); close(); };

      function stepEmail() {
        const input = h("input", { class: "login-input", type: "email", inputmode: "email", autocomplete: "email", autocapitalize: "off", spellcheck: "false", placeholder: "you@example.com", "aria-label": "邮箱", "data-email": "" });
        input.value = email;
        const go = button("发送验证码", async () => {
          const v = input.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { say("请输入有效的邮箱地址。"); return; }
          if (busy || Date.now() < cooldownUntil) return;
          busy = true; go.disabled = true; say("正在发送…", false);
          const r = await sync.sendCode(v);
          busy = false; go.disabled = Date.now() < cooldownUntil;
          if (!r.ok) {
            say(errorText(r));
            if (r.kind === "rate-limit") { cooldownUntil = Date.now() + (r.retryAfter || 60) * 1000; tickEmail(); }
            return;
          }
          email = v; cooldownUntil = Date.now() + 60000; say("");
          stepCode();
        }, "btn3d primary wide", { "data-send-code": "" });
        const tickEmail = () => {
          const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
          go.disabled = left > 0 || busy;
          go.textContent = left > 0 ? `发送验证码（${left} 秒）` : "发送验证码";
        };
        clearInterval(cooldownTimer); cooldownTimer = setInterval(() => { if (!box.isConnected) { clearInterval(cooldownTimer); return; } tickEmail(); }, 1000); tickEmail();
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        box.replaceChildren(
          h("h2", { text: "登录 / 注册" }),
          h("p", { text: reason || "用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。" }),
          input, go, msg,
          button("先不登录", done, "btn3d ghost wide"),
        );
        setTimeout(() => input.focus(), 50);
      }

      function stepCode() {
        const input = h("input", { class: "login-input code", type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "one-time-code", maxlength: "10", placeholder: "验证码", "aria-label": "邮箱验证码", "data-code": "" });
        const resend = button("重新发送", async () => {
          if (Date.now() < cooldownUntil || busy) return;
          busy = true; const r = await sync.sendCode(email); busy = false;
          if (!r.ok) {
            say(errorText(r));
            if (r.kind === "rate-limit") { cooldownUntil = Date.now() + (r.retryAfter || 60) * 1000; tick(); }
            return;
          }
          cooldownUntil = Date.now() + 60000; say("已重新发送。", false); tick();
        }, "btn3d ghost", { "data-resend": "" });
        let go;
        const tick = () => {
          const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
          resend.disabled = left > 0;
          resend.textContent = left > 0 ? `重新发送（${left} 秒）` : "重新发送";
          const vleft = Math.ceil((verifyBlockedUntil - Date.now()) / 1000);
          if (vleft > 0) { go.disabled = true; go.textContent = `登录（${vleft} 秒）`; }
          else if (!busy) { go.disabled = false; go.textContent = "登录"; }
        };
        clearInterval(cooldownTimer); cooldownTimer = setInterval(() => { if (!box.isConnected) { clearInterval(cooldownTimer); return; } tick(); }, 1000);
        go = button("登录", async () => {
          const c = input.value.replace(/\s+/g, "");
          if (c.length < 4) { say("请输入邮件里的验证码。"); return; }
          if (busy || Date.now() < verifyBlockedUntil) return;
          busy = true; go.disabled = true; say("正在登录…", false);
          const r = await sync.verify(email, c, getState());
          busy = false; tick();
          if (!r.ok) {
            say(r.kind === "auth" ? "验证码错误或已过期，请检查后重试，或点“重新发送”。" : errorText(r));
            if (r.kind === "rate-limit") { verifyBlockedUntil = Date.now() + (r.retryAfter || 60) * 1000; tick(); }
            return;
          }
          if (r.needChoice) { stepChoice(r); return; }
          success(r);
        }, "btn3d primary wide", { "data-verify": "" });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        tick();
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
    async function doLogout(then) {
      const r = await sync.logout();
      if (r.ok) {
        onSwitchedOut();
        showToast(r.cloudSessionMaybeValid ? "已在这台设备退出；云端会话可能仍然有效。" : "已退出登录。");
        if (then) then();
        return;
      }
      const afterForce = (f) => {
        if (!f.ok) { showToast(errorText(f)); return; }
        onSwitchedOut();
        showToast(f.cloudSessionMaybeValid ? "已在这台设备退出；云端会话可能仍然有效。" : "已退出登录。");
        if (then) then();
      };
      if (r.pending) {
        sheetConfirm("有进度还没上传", "现在连不上云端。仍要在这台设备退出吗？没上传的进度会留在这台设备上，用同一个账号重新登录后会继续上传；云端会话可能仍然有效。", "强制本机退出", async () => afterForce(await sync.forceLocalLogout()), true);
      } else if (r.keptLogin) {
        sheetConfirm("退出登录失败", "云端没有确认退出，所以现在还保持登录。网络恢复后再试；如果你确实要在这台设备退出，可以强制退出，但云端会话可能仍然有效。", "强制本机退出", async () => afterForce(await sync.forceLocalLogout()), true);
      } else showToast(errorText(r));
    }
    card.append(h("h3", { text: "账号" }), h("p", { class: "acct-email", text: acc.email || "已登录" }), st,
      button("立即同步", async () => { const r = await sync.syncNow(); if (!r.ok) showToast(errorText(r)); else rerender(); }, "btn3d wide", { "data-sync-now": "" }),
      h("div", { class: "acct-row" },
        button("退出登录", () => doLogout(), "btn3d", { "data-logout": "" }),
        button("切换账号", () => doLogout(() => openLogin()), "btn3d", { "data-switch": "" })),
      button("删除账号和云端记录", () => sheetConfirm("删除账号？", "会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。", "永久删除", async () => {
        const r = await sync.deleteAccount();
        if (r.ok) { onSwitchedOut(); showToast("账号已删除。"); return; }
        if (r.accountDeleted && r.pendingLocalCleanup) {
          onSwitchedOut();
          sheet((close) => [h("div", { class: "lsheet" },
            h("h2", { text: "账号已删除，本机还没清理完" }),
            h("p", { text: r.message }),
            h("p", { class: "muted small", text: r.tokenRevokedLocally ? "旧登录凭证已在本机禁用，云端账号不会再恢复。可以现在重试清理；如果一直失败，请在浏览器设置里清除本站数据。" : "本机存储异常，旧登录凭证可能还没禁用。请立即清除本站数据，避免旧会话继续被使用。" }),
            button("重试清理", async () => {
              const c = await sync.retryLocalCleanup();
              if (c.ok) { close(); showToast("本机旧记录已清理。"); }
              else showToast(c.message || "本机清理还没完成，请稍后再试或清除本站数据。");
            }, "btn3d primary wide", { "data-retry-cleanup": "" }),
            button("稍后", close, "btn3d ghost wide"),
          )]);
          return;
        }
        showToast(errorText(r));
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
