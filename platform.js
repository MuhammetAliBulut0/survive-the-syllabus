// Survive the Syllabus — platform köprüsü
// Oyun kodu claude.use("db" | "user") ister. Bu dosya o istekleri
// Supabase (giriş + kayıt + sıralama) ile karşılar.
(function () {
  const C = window.STS_CONFIG || {};
  const configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/PROJE-KODUN|BURAYA/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY));
  const IS_RECOVERY = /type=recovery/.test(location.hash + location.search);
  const sb = configured && window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  let recoveryEvent = false;
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") recoveryEvent = true; });
  const KVKK_VER = "2026-11";
  const GUEST = "sts-guest";
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

  const sessionP = sb ? sb.auth.getSession().then(async r => {
    const s = r.data.session; if (!s) return null;
    try { const { data } = await sb.auth.getUser(); if (data && data.user) s.user = data.user; } catch (e) {}   // tarayıcıdaki eski kopya yerine sunucudaki güncel bilgi
    return s;
  }).catch(() => null) : Promise.resolve(null);
  async function setMeta(obj) {   // kullanıcı bilgisini güncelle ve oturumu tazele, yenilemede eski bilgi geri gelmesin
    const { data, error } = await sb.auth.updateUser({ data: obj });
    if (data && data.user && session) session.user = data.user;
    try { await sb.auth.refreshSession(); } catch (e) {}
    return { data, error };
  }
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
  .gate{position:fixed;inset:0;z-index:40;display:flex;align-items:safe center;justify-content:center;overflow-y:auto;padding:24px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px));
    background:radial-gradient(80% 60% at 50% 20%,#3a1a52 0%,#150d1f 70%)}
  .gate.over{background:color-mix(in oklab,#0c0614 82%,transparent)}
  .gate .box{width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;background:#1e1430;border:1px solid #3d2a57;padding:22px;
    clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}
  .gate h1{margin:0;font-family:"Rubik Wet Paint",Impact,sans-serif;font-weight:400;font-size:34px;line-height:1;color:#c3f53c}
  .gate h2{margin:0;font-family:"Bungee","Arial Black",sans-serif;font-weight:400;font-size:18px;color:#f1eaf7}
  .gate p{margin:0;color:#a898bd;font-size:14px;line-height:1.5}
  .gate label.f{font-size:13px;color:#a898bd}
  .gate input[type=email],.gate input[type=password],.gate input[type=text]{background:#150d1f;border:1px solid #3d2a57;color:#f1eaf7;padding:12px;font:inherit;width:100%}
  .gate .pw{position:relative} .gate .pw input{padding-right:70px}
  .gate .pw button{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:#a898bd;font-size:12px;cursor:pointer;padding:6px}
  .gate .gt{display:grid;grid-template-columns:1fr 1fr;gap:4px}
  .gate .gt button{font-family:"Bungee","Arial Black",sans-serif;font-size:13px;padding:10px;border:1px solid #3d2a57;background:transparent;color:#a898bd;cursor:pointer}
  .gate .gt button.on{background:#c3f53c;color:#1a0d26;border-color:#c3f53c}
  .gate .ck{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#d9cfe6;line-height:1.45}
  .gate .ck input{width:18px;height:18px;margin-top:2px;flex:none;accent-color:#c3f53c}
  .gate .ck a,.gate a.lk{color:#c3f53c}
  .gate .msg{font-size:13px;color:#57e0c8} .gate .msg.bad{color:#ff4d6d}
  .gate .legal{max-height:52vh;overflow-y:auto;font-size:13px;line-height:1.55;color:#d9cfe6;background:#150d1f;border:1px solid #3d2a57;padding:12px}
  .gate .legal h3{font-size:13px;margin:12px 0 4px;color:#f1eaf7} .gate .legal p,.gate .legal li{color:#d9cfe6;font-size:13px}
  .acct{display:block;margin:6px auto 0;text-align:center;font-size:12px;color:#a898bd}
  .acct button{background:none;border:0;color:#c3f53c;text-decoration:underline;font:inherit;cursor:pointer;padding:4px}`;
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  const pwField = (id, ph, ac) => `<div class="pw"><input id="${id}" type="password" autocomplete="${ac}" placeholder="${ph}"><button type="button" data-eye="${id}">Göster</button></div>`;
  const bindEyes = box => box.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => { const i = box.querySelector("#" + b.dataset.eye); const show = i.type === "password"; i.type = show ? "text" : "password"; b.textContent = show ? "Gizle" : "Göster"; });
  const LEGAL = `<div class="legal">
    <p><b>Survive the Syllabus Kişisel Verilerin Korunması Aydınlatma Metni</b></p>
    <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, Survive the Syllabus uygulamasını kullanırken işlenen kişisel verilerin hakkında seni bilgilendirmek isteriz.</p>
    <h3>Veri sorumlusu</h3><p>Uygulamanın geliştiricisi Muhammet Ali Bulut. İletişim: muhammetalib571@gmail.com</p>
    <h3>Hangi verileri işliyoruz?</h3><ul><li>E-posta adresin ve şifren (şifre şifrelenmiş olarak saklanır, kimse göremez)</li><li>Seçtiğin takma ad</li><li>Oyun ilerlemen: görevler, odak oturumları, hafıza kartları, puanlar, sınav takvimi</li></ul>
    <p>Gerçek adın, telefonun, konumun gibi başka bir veri istenmez.</p>
    <h3>Neden işliyoruz?</h3><p>Hesabını oluşturmak, giriş yapmanı sağlamak, ilerlemeni cihazların arasında eşitlemek ve takma adınla sıralamayı göstermek için. Hukuki sebep: hizmetin sunulması için gerekli olması (KVKK m.5/2-c) ve açık rızan.</p>
    <h3>Kimler görebilir?</h3><p>Diğer kullanıcılar sadece takma adını ve sıralama puanlarını görür. E-posta adresini sadece veri sorumlusu, hesap yönetimi amacıyla görebilir; reklam ya da başka bir amaçla kullanılmaz, kimseyle paylaşılmaz.</p>
    <h3>Veriler nerede saklanıyor?</h3><p>Veriler Supabase (veri tabanı, Avrupa Birliği/Almanya) ve Vercel (site barındırma, ABD) sunucularında tutulur. Bu, verilerinin yurt dışına aktarılması anlamına gelir. Bu ülkelerin veri koruma kuralları Türkiye'dekinden farklı olabilir; bu riski bilerek onay verirsin.</p>
    <h3>Ne kadar süre?</h3><p>Hesabın açık olduğu sürece. Hesabını sildiğinde tüm verilerin kalıcı olarak silinir.</p>
    <h3>Hakların (KVKK m.11)</h3><p>Verilerinin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, itiraz etme haklarına sahipsin. Hesabını uygulama içinden (Profil, Ayarlar, Hesabımı sil) dilediğin an silebilir ya da yukarıdaki e-postaya yazabilirsin.</p>
  </div>`;
  function gate(kind, opt = {}) {
    document.querySelectorAll(".gate").forEach(x => x.remove());
    const g = el(`<div class="gate${opt.over ? " over" : ""}" role="dialog" aria-modal="true"><div class="box"></div></div>`);
    const box = g.querySelector(".box");
    const $b = id => box.querySelector("#" + id);
    let m; const say = (t, bad) => { m = m || $b("gMsg"); m.hidden = false; m.textContent = t; m.className = bad ? "msg bad" : "msg"; };
    if (kind === "login" || kind === "signup") {
      const up = kind === "signup", guest = !!opt.fromGuest;
      box.innerHTML = `<h1>Survive the Syllabus</h1>
        <p>${guest ? "Hesap oluştur, misafirken yaptığın bütün ilerleme hesabına taşınsın ve her cihazda seninle olsun." : "Ders çalışmanı zombi baskınına çeviren oyun. Hesabınla ilerlemen her cihazda aynı kalır ve sıralamaya girersin."}</p>
        <div class="gt"><button id="tIn" class="${up ? "" : "on"}">Giriş yap</button><button id="tUp" class="${up ? "on" : ""}">Hesap oluştur</button></div>
        <label class="f" for="gEmail">E-posta</label><input id="gEmail" type="email" autocomplete="email" placeholder="ornek@stu.universite.edu.tr" value="${opt.email || ""}">
        <label class="f" for="gPass">Şifre${up ? " (en az 6 karakter)" : ""}</label>${pwField("gPass", "••••••", up ? "new-password" : "current-password")}
        ${up ? `<label class="f" for="gNick">Takma ad (sıralamada görünür)</label><input id="gNick" type="text" maxlength="24" placeholder="Örn. ZombiAvcısı">
          <label class="ck"><input type="checkbox" id="gKvkk"><span><a href="#" id="gLegal">Aydınlatma Metni</a>'ni okudum. Verilerimin (e-posta, takma ad, oyun ilerlemesi) yurt dışındaki sunucularda (AB ve ABD) saklanmasına, risklerini bilerek açık rıza veriyorum.</span></label>` : ""}
        <button class="btn" id="gGo">${up ? "Hesabı oluştur" : "Giriş yap"}</button>
        ${up ? "" : `<button class="link" id="gForgot" style="align-self:flex-start">Şifremi unuttum</button>`}
        <div class="msg" id="gMsg" hidden></div>
        ${guest ? `<button class="link" id="gClose">Şimdilik misafir kal</button>` : `<button class="link" id="gGuest">Misafir olarak dene (ilerleme bu tarayıcıda kalır, sonra hesaba taşıyabilirsin)</button>`}`;
      bindEyes(box);
      const email = () => $b("gEmail").value.trim();
      $b("tIn").onclick = () => gate("login", { ...opt, email: email() });
      $b("tUp").onclick = () => gate("signup", { ...opt, email: email() });
      if ($b("gLegal")) $b("gLegal").onclick = e => { e.preventDefault(); legalPopup(); };
      if ($b("gGuest")) $b("gGuest").onclick = () => { lsSet(GUEST, "1"); g.remove(); };
      if ($b("gClose")) $b("gClose").onclick = () => g.remove();
      if ($b("gForgot")) $b("gForgot").onclick = async () => {
        const e = email(); if (!/^\S+@\S+\.\S+$/.test(e)) return say("Önce e-posta adresini yaz, sonra 'Şifremi unuttum'a bas.", true);
        say("Gönderiliyor…");
        const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname });
        if (error) say(/rate|limit|seconds/i.test(error.message) ? "Çok sık deneme oldu. Birkaç dakika bekleyip tekrar dene." : "Gönderilemedi: " + error.message, true);
        else say("Şifre sıfırlama linki " + e + " adresine gönderildi. Linke tıklayınca yeni şifreni belirleyebileceksin. Gelmezse spam klasörüne bak.");
      };
      $b("gGo").onclick = async () => {
        const e = email(), password = $b("gPass").value;
        if (!/^\S+@\S+\.\S+$/.test(e)) return say("Geçerli bir e-posta yaz.", true);
        if (password.length < 6) return say("Şifre en az 6 karakter olmalı.", true);
        if (!up) {
          say("Giriş yapılıyor…");
          const { error } = await sb.auth.signInWithPassword({ email: e, password });
          if (error) say(/invalid/i.test(error.message) ? "E-posta ya da şifre yanlış. Şifreni hatırlamıyorsan 'Şifremi unuttum'a bas, hesabın yoksa 'Hesap oluştur' sekmesine geç." : "Giriş yapılamadı: " + error.message, true);
          else location.reload();
          return;
        }
        const nick = $b("gNick").value.trim().slice(0, 24);
        if (nick.length < 2) return say("Takma ad en az 2 karakter olmalı.", true);
        if (!$b("gKvkk").checked) return say("Devam etmek için Aydınlatma Metni onayını işaretlemelisin.", true);
        say("Hesap oluşturuluyor…");
        const { data, error } = await sb.auth.signUp({ email: e, password, options: { data: { display_name: nick, kvkk: KVKK_VER, kvkk_at: new Date().toISOString() } } });
        if (error) say(/not allowed|disabled/i.test(error.message) ? "Yeni hesap açma şu an kapalı. Site yöneticisinin Supabase'de yeni kayıtları açması gerekiyor." : /registered|exists/i.test(error.message) ? "Bu e-postayla zaten hesap var. 'Giriş yap' sekmesine geç." : /weak|password/i.test(error.message) ? "Şifre çok zayıf, daha uzun bir şifre seç." : "Hesap oluşturulamadı: " + error.message, true);
        else if (data && data.session) location.reload();
        else if (data && data.user && Array.isArray(data.user.identities) && !data.user.identities.length) say("Bu e-postayla zaten hesap var. 'Giriş yap' sekmesine geç.", true);
        else say("Hesap oluştu ama e-posta onayı bekliyor. Site yöneticisinin Supabase'de 'Confirm email' ayarını kapatması gerekiyor.", true);
      };
      $b("gPass").addEventListener("keydown", ev => { if (ev.key === "Enter" && !up) $b("gGo").click(); });
    } else if (kind === "pass" || kind === "recover") {
      box.innerHTML = `<h2>${kind === "recover" ? "Yeni şifreni belirle" : "Şifre değiştir"}</h2><p>Bu e-posta ve yeni şifrenle bütün cihazlarında giriş yapacaksın.</p>
        ${pwField("gNew", "Yeni şifre (en az 6 karakter)", "new-password")}
        <button class="btn" id="gSetPass">Kaydet</button>${kind === "recover" ? "" : `<button class="link" id="gCancel">Vazgeç</button>`}<div class="msg" id="gMsg" hidden></div>`;
      bindEyes(box);
      if ($b("gCancel")) $b("gCancel").onclick = () => g.remove();
      $b("gSetPass").onclick = async () => {
        const pw = $b("gNew").value; if (pw.length < 6) return say("Şifre en az 6 karakter olmalı.", true);
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) say(/different|same/i.test(error.message) ? "Yeni şifre eskisiyle aynı olamaz." : "Kaydedilemedi: " + error.message, true);
        else { say("Şifren kaydedildi."); history.replaceState(null, "", location.pathname); setTimeout(() => g.remove(), 1200); }
      };
    } else if (kind === "consent") {
      box.innerHTML = `<h2>Küçük bir onay</h2><p>Devam etmeden önce verilerinin nasıl kullanıldığını okuyup onaylaman gerekiyor.</p>${LEGAL}
        <label class="ck"><input type="checkbox" id="gKvkk"><span>Aydınlatma Metni'ni okudum. Verilerimin yurt dışındaki sunucularda (AB ve ABD) saklanmasına, risklerini bilerek açık rıza veriyorum.</span></label>
        <button class="btn" id="gOk">Onayla ve devam et</button><button class="link" id="gNo">Onaylamıyorum, çıkış yap</button><div class="msg" id="gMsg" hidden></div>`;
      $b("gOk").onclick = async () => {
        if (!$b("gKvkk").checked) return say("Devam etmek için onay kutusunu işaretlemelisin.", true);
        const { data, error } = await setMeta({ kvkk: KVKK_VER, kvkk_at: new Date().toISOString() });
        if (error) return say("Kaydedilemedi, internet bağlantını kontrol edip tekrar dene.", true);
        if (data && data.user) session.user = data.user;
        g.remove(); if (!(session.user.user_metadata || {}).display_name) gate("name");
      };
      $b("gNo").onclick = async () => { await sb.auth.signOut(); location.reload(); };
    } else if (kind === "delete") {
      box.innerHTML = `<h2>Hesabımı sil</h2><p>Hesabın, e-posta adresin ve bütün oyun ilerlemen kalıcı olarak silinir. Bu işlem geri alınamaz.</p>
        <label class="f" for="gConf">Onaylamak için <b>SİL</b> yaz</label><input id="gConf" type="text" autocomplete="off">
        <button class="btn red" id="gDel">Hesabımı kalıcı olarak sil</button><button class="link" id="gCancel">Vazgeç</button><div class="msg" id="gMsg" hidden></div>`;
      $b("gCancel").onclick = () => g.remove();
      $b("gDel").onclick = async () => {
        if ($b("gConf").value.trim().toLocaleUpperCase("tr") !== "SİL") return say("Onay için SİL yaz.", true);
        say("Siliniyor…");
        const { error } = await sb.rpc("delete_my_account");
        if (error) return say("Silinemedi. Site yöneticisinin kurulumu tamamlaması gerekiyor (delete_my_account). İstersen muhammetalib571@gmail.com adresine yaz.", true);
        try { Object.keys(localStorage).filter(k => k.startsWith("sts-")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
        await sb.auth.signOut(); location.reload();
      };
    } else {
      box.innerHTML = `<h2>Hoş geldin</h2><p>Sıralamada görünecek bir takma ad seç. Gerçek adını yazmak zorunda değilsin.</p>
        <input id="gName" type="text" maxlength="24" placeholder="Örn. ZombiAvcısı" value="${((session.user.user_metadata || {}).display_name || "").replace(/"/g, "")}">
        <button class="btn" id="gSave">Kaydet</button><div class="msg" id="gMsg" hidden></div>`;
      $b("gSave").onclick = async () => {
        const n = $b("gName").value.trim().slice(0, 24); if (n.length < 2) return say("En az 2 karakter yaz.", true);
        const { data, error } = await setMeta({ display_name: n });
        if (error) return say("Kaydedilemedi, tekrar dene.", true);
        if (data && data.user) session.user = data.user;
        const ab = document.querySelector("#acct b"); if (ab) ab.textContent = nameOf(session.user);
        g.remove();
      };
    }
    document.body.appendChild(g);
    const f = box.querySelector("input[type=email],input[type=password],input[type=text]"); if (f && !f.value) setTimeout(() => f.focus(), 50);
  }
  function legalPopup() {
    const p = el(`<div class="gate over" style="z-index:45"><div class="box"><h2>Aydınlatma Metni</h2>${LEGAL}<button class="btn" id="lClose">Kapat</button></div></div>`);
    p.querySelector("#lClose").onclick = () => p.remove(); document.body.appendChild(p);
  }
  /* oyun kodunun kullandığı yardımcılar */
  window.STS_isGuest = () => !!sb && !session;
  window.STS_openSignup = () => gate("signup", { fromGuest: true, over: true });
  window.STS_account = { changePass: () => gate("pass", { over: true }), del: () => gate("delete", { over: true }), legal: legalPopup, signedIn: () => !!session };

  function account() {
    const foot = document.getElementById("saveLbl"); if (!foot || document.getElementById("acct")) return;
    const a = el(`<p class="acct" id="acct"></p>`);
    if (session) { a.innerHTML = `Giriş: <b></b> · <button id="acctPass">Şifre değiştir</button> · <button id="acctOut">Çıkış yap</button>`; a.querySelector("b").textContent = nameOf(session.user);
      a.querySelector("#acctPass").onclick = () => gate("pass", { over: true });
      a.querySelector("#acctOut").onclick = async () => { await sb.auth.signOut(); lsSet(GUEST, null); lsSet("sts-last-uid", null); location.reload(); }; }
    else if (sb) { a.innerHTML = `Misafir modundasın. <button id="acctUp">Hesap oluştur</button> · <button id="acctIn">Giriş yap</button>`;
      a.querySelector("#acctUp").onclick = () => gate("signup", { fromGuest: true, over: true }); a.querySelector("#acctIn").onclick = () => gate("login", { fromGuest: true, over: true }); }
    else { a.textContent = "Kurulum tamamlanmadı: config.js içindeki Supabase bilgilerini doldur."; }
    foot.after(a);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const s = await sessionP;
    if (s && (IS_RECOVERY || recoveryEvent)) gate("recover");
    else if (sb && !s && lsGet(GUEST) !== "1") gate("login");
    else if (s && (s.user.user_metadata || {}).kvkk !== KVKK_VER) gate("consent");
    else if (s && !(s.user.user_metadata || {}).display_name) gate("name");
    account();
    if (sb) sb.auth.onAuthStateChange((ev, ns) => {
      if (ev === "PASSWORD_RECOVERY") gate("recover");
      else if (ev === "SIGNED_IN" && !session && ns) location.reload();
    });
  });
})();
