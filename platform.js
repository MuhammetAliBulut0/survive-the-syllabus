// Survive the Syllabus — platform köprüsü
// Oyun kodu claude.use("db" | "user") ister. Bu dosya o istekleri
// Supabase (giriş + kayıt + sıralama) ile karşılar.
(function () {
  const C = window.STS_CONFIG || {};
  const configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/PROJE-KODUN|BURAYA/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY));
  const sb = configured && window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  const GUEST = "sts-guest";
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

  const sessionP = sb ? sb.auth.getSession().then(r => r.data.session).catch(() => null) : Promise.resolve(null);
  let session = null;
  sessionP.then(s => { session = s; });

  const nameOf = u => (u && u.user_metadata && (u.user_metadata.display_name || u.user_metadata.full_name)) || (u && u.email ? u.email.split("@")[0] : "Hayatta kalan");
  const err = (code, message) => ({ code, message: message || code });

  /* ---------- veritabanı ---------- */
  const db = {
    doc: path => ({
      async get() {
        const { data, error } = await sb.from("kv").select("data").eq("path", path).maybeSingle();
        if (error) throw err("unavailable", error.message);
        return { exists: !!data, id: path.split("/").pop(), data: () => (data ? data.data : undefined) };
      },
      async set(d) {
        const body = JSON.parse(JSON.stringify(d));
        if (path.startsWith("board/")) body.name = nameOf(session.user);
        const { error } = await sb.from("kv").upsert({ path, owner: session.user.id, data: body, updated_at: new Date().toISOString() });
        if (error) throw err(/quota/i.test(error.message) ? "quota_exceeded" : "unavailable", error.message);
      },
    }),
    collection: prefix => ({
      async get() {
        const depth = prefix.split("/").length + 1;
        const { data, error } = await sb.from("kv").select("path,data").like("path", prefix + "/%").limit(1000);
        if (error) throw err("unavailable", error.message);
        const docs = (data || []).filter(r => r.path.split("/").length === depth)
          .map(r => ({ id: r.path.split("/").pop(), exists: true, data: () => r.data }));
        return { docs, size: docs.length, empty: !docs.length };
      },
    }),
  };

  /* ---------- kullanıcı ---------- */
  const user = {
    id: async () => session && session.user.id,
    isOwner: () => !!(session && (C.ADMIN_EMAILS || []).map(e => e.toLowerCase()).includes((session.user.email || "").toLowerCase())),
    canEdit: () => false,
    me: async () => ({ id: session.user.id, name: nameOf(session.user) }),
    async profiles(ids) {
      const out = {};
      const { data } = await sb.from("kv").select("path,data").in("path", ids.map(i => "board/" + i));
      (data || []).forEach(r => { out[r.path.slice(6)] = { name: (r.data && r.data.name) || "" }; });
      ids.forEach(i => { if (!out[i]) out[i] = { name: "" }; });
      if (session && out[session.user.id]) out[session.user.id].name = nameOf(session.user);
      return out;
    },
  };

  window.STS_SITE = true;
  const caps = { db, user };
  window.claude = { use: async name => { const s = await sessionP; return s && caps[name] ? caps[name] : null; } };

  /* ---------- giriş ekranı ---------- */
  const css = `
  .gate{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:24px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px));
    background:radial-gradient(80% 60% at 50% 20%,#3a1a52 0%,#150d1f 70%)}
  .gate .box{width:100%;max-width:400px;display:flex;flex-direction:column;gap:14px;background:#1e1430;border:1px solid #3d2a57;padding:22px;
    clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
  .gate h1{margin:0;font-family:"Rubik Wet Paint",Impact,sans-serif;font-weight:400;font-size:34px;line-height:1;color:#c3f53c}
  .gate p{margin:0;color:#a898bd;font-size:14px;line-height:1.5}
  .gate input{background:#150d1f;border:1px solid #3d2a57;color:#f1eaf7;padding:12px;font:inherit;width:100%}
  .gate .msg{font-size:13px;color:#57e0c8} .gate .msg.bad{color:#ff4d6d}
  .acct{display:block;margin:6px auto 0;text-align:center;font-size:12px;color:#a898bd}
  .acct button{background:none;border:0;color:#c3f53c;text-decoration:underline;font:inherit;cursor:pointer;padding:4px}`;
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function gate(kind) {
    const g = el(`<div class="gate" role="dialog" aria-modal="true"><div class="box"></div></div>`);
    const box = g.querySelector(".box");
    if (kind === "login") {
      box.innerHTML = `<h1>Survive the Syllabus</h1>
        <p>Ders çalışmanı zombi baskınına çeviren oyun. Giriş yapınca ilerlemen her cihazda aynı kalır ve sıralamaya girersin.</p>
        <label for="gEmail" style="font-size:13px;color:#a898bd">E-posta</label>
        <input id="gEmail" type="email" autocomplete="email" placeholder="ornek@stu.universite.edu.tr">
        <label for="gPass" style="font-size:13px;color:#a898bd">Şifre (en az 6 karakter)</label>
        <input id="gPass" type="password" autocomplete="current-password" placeholder="••••••">
        <button class="btn" id="gIn">Giriş yap</button>
        <button class="btn plum" id="gUp">Yeni hesap oluştur</button>
        <div class="msg" id="gMsg" hidden></div>
        <button class="link" id="gGuest">Misafir olarak dene (sıralama kapalı, ilerleme bu tarayıcıda kalır)</button>`;
      const m = box.querySelector("#gMsg");
      const say = (t, bad) => { m.hidden = false; m.textContent = t; m.className = bad ? "msg bad" : "msg"; };
      const read = () => {
        const email = box.querySelector("#gEmail").value.trim(), password = box.querySelector("#gPass").value;
        if (!/^\S+@\S+\.\S+$/.test(email)) { say("Geçerli bir e-posta yaz.", true); return null; }
        if (password.length < 6) { say("Şifre en az 6 karakter olmalı.", true); return null; }
        return { email, password };
      };
      box.querySelector("#gIn").onclick = async () => {
        const c = read(); if (!c) return; say("Giriş yapılıyor…");
        const { error } = await sb.auth.signInWithPassword(c);
        if (error) say(/invalid/i.test(error.message) ? "E-posta ya da şifre yanlış. Hesabın yoksa 'Yeni hesap oluştur'a bas." : /confirm/i.test(error.message) ? "Hesabın onay bekliyor. Supabase'de 'Confirm email' ayarı kapatılmalı." : "Giriş yapılamadı: " + error.message, true);
        else location.reload();
      };
      box.querySelector("#gUp").onclick = async () => {
        const c = read(); if (!c) return; say("Hesap oluşturuluyor…");
        const { data, error } = await sb.auth.signUp(c);
        if (error) say(/registered|exists/i.test(error.message) ? "Bu e-postayla zaten hesap var. 'Giriş yap'a bas." : /weak|password/i.test(error.message) ? "Şifre çok zayıf, daha uzun bir şifre seç." : "Hesap oluşturulamadı: " + error.message, true);
        else if (data && data.session) location.reload();
        else say("Hesap oluştu ama e-posta onayı bekliyor. Supabase'de 'Confirm email' ayarını kapatırsan onay gerekmez.", true);
      };
      box.querySelector("#gPass").addEventListener("keydown", e => { if (e.key === "Enter") box.querySelector("#gIn").click(); });
      box.querySelector("#gGuest").onclick = () => { lsSet(GUEST, "1"); g.remove(); };
    } else if (kind === "pass") {
      box.innerHTML = `<h1>Şifre belirle</h1><p>Diğer cihazlarında bu e-posta ve şifreyle giriş yapacaksın.</p>
        <input id="gNew" type="password" autocomplete="new-password" placeholder="Yeni şifre (en az 6 karakter)">
        <button class="btn" id="gSetPass">Kaydet</button><button class="link" id="gCancel">Vazgeç</button><div class="msg" id="gMsg" hidden></div>`;
      const m = box.querySelector("#gMsg");
      box.querySelector("#gCancel").onclick = () => g.remove();
      box.querySelector("#gSetPass").onclick = async () => {
        const pw = box.querySelector("#gNew").value; m.hidden = false;
        if (pw.length < 6) { m.className = "msg bad"; m.textContent = "Şifre en az 6 karakter olmalı."; return; }
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) { m.className = "msg bad"; m.textContent = "Kaydedilemedi: " + error.message; }
        else { m.className = "msg"; m.textContent = "Şifren kaydedildi."; setTimeout(() => g.remove(), 1200); }
      };
    } else {
      box.innerHTML = `<h1>Hoş geldin</h1><p>Sıralamada görünecek bir takma ad seç. Gerçek adını yazmak zorunda değilsin.</p>
        <input id="gName" maxlength="24" value="${nameOf(session.user).replace(/"/g, "")}">
        <button class="btn" id="gSave">Kaydet</button><div class="msg" id="gMsg" hidden></div>`;
      box.querySelector("#gSave").onclick = async () => {
        const n = box.querySelector("#gName").value.trim().slice(0, 24);
        if (n.length < 2) { const m = box.querySelector("#gMsg"); m.hidden = false; m.className = "msg bad"; m.textContent = "En az 2 karakter yaz."; return; }
        const { data } = await sb.auth.updateUser({ data: { display_name: n } });
        if (data && data.user) session.user = data.user;
        const ab = document.querySelector("#acct b"); if (ab) ab.textContent = nameOf(session.user);
        g.remove();
      };
    }
    document.body.appendChild(g);
  }
  function account() {
    const foot = document.getElementById("saveLbl"); if (!foot || document.getElementById("acct")) return;
    const a = el(`<p class="acct" id="acct"></p>`);
    if (session) { a.innerHTML = `Giriş: <b></b> · <button id="acctPass">Şifre belirle</button> · <button id="acctOut">Çıkış yap</button>`; a.querySelector("b").textContent = nameOf(session.user);
      a.querySelector("#acctPass").onclick = () => gate("pass");
      a.querySelector("#acctOut").onclick = async () => { await sb.auth.signOut(); lsSet(GUEST, null); location.reload(); }; }
    else if (sb) { a.innerHTML = `Misafir modundasın. <button id="acctIn">Giriş yap</button>`; a.querySelector("#acctIn").onclick = () => gate("login"); }
    else { a.textContent = "Kurulum tamamlanmadı: config.js içindeki Supabase bilgilerini doldur."; }
    foot.after(a);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const s = await sessionP;
    if (sb && !s && lsGet(GUEST) !== "1") gate("login");
    if (s && !(s.user.user_metadata && s.user.user_metadata.display_name)) gate("name");
    account();
    if (sb) sb.auth.onAuthStateChange((ev, ns) => {
      if (ev === "SIGNED_IN" && !session && ns) location.reload();
    });
  });
})();
