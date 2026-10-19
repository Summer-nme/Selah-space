(function () {
  var $ = function (s) { return document.querySelector(s); };
  var C = window.SELAH || {};
  var cloud = !!(C.url && C.key && window.supabase);
  var sb = cloud ? window.supabase.createClient(C.url, C.key) : null;
  var LS = function (k, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; }
  };
  var MOODS = [["Radiant", "☀️"], ["Peaceful", "🌿"], ["Okay", "🌤️"], ["Low", "🌧️"], ["Overwhelmed", "🌊"]];
  var SOFT = ["Good days deserve to be noticed. Hold on to this one.", "Calm is worth keeping. Well done for making room for it.", "Okay is enough. You showed up.", "It's alright to feel low. Feelings pass, and you don't have to fix it tonight.", "One breath at a time. You don't have to solve it all today."];
  var VERSE = [["This is the day which the LORD hath made; we will rejoice and be glad in it.", "Psalm 118:24"], ["Peace I leave with you, my peace I give unto you.", "John 14:27"], ["Be still, and know that I am God.", "Psalm 46:10"], ["The LORD is nigh unto them that are of a broken heart.", "Psalm 34:18"], ["Come unto me, all ye that labour and are heavy laden, and I will give you rest.", "Matthew 11:28"]];
  var STAGES = [[0, "🌰", "Seed"], [1, "🌱", "Sprout"], [5, "🌿", "Growing"], [12, "🪴", "Flourishing"], [25, "🌳", "Rooted"]];
  var S = { view: "home", mood: null, kind: "reflection", done: null, entries: [], user: null, msg: "", pausing: false, draft: "" };
  var cfg = LS("selah_cfg") || { faith: false, rem: false, time: "20:00", name: "" };
  var saveCfg = function () { LS("selah_cfg", cfg); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var dayKey = function (d) { var x = new Date(d); return Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 864e5); };
  var fmt = function (d) { return new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };

  // ---------- data: Supabase when configured, otherwise this device ----------
  function local(fn) { var l = LS("selah_entries") || []; var r = fn(l); LS("selah_entries", l); return r; }
  var data = {
    load: async function () {
      if (!cloud) return LS("selah_entries") || [];
      var r = await sb.from("entries").select("*").order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
    add: async function (e) {
      if (cloud) { var r = await sb.from("entries").insert(e).select().single(); if (r.error) throw r.error; return r.data; }
      return local(function (l) { e.id = String(Date.now()); e.created_at = new Date().toISOString(); l.unshift(e); return e; });
    },
    patch: async function (id, p) {
      if (cloud) { var r = await sb.from("entries").update(p).eq("id", id); if (r.error) throw r.error; return; }
      local(function (l) { l.forEach(function (x) { if (x.id === id) Object.assign(x, p); }); });
    },
    del: async function (id) {
      if (cloud) { var r = await sb.from("entries").delete().eq("id", id); if (r.error) throw r.error; return; }
      local(function (l) { var i = l.findIndex(function (x) { return x.id === id; }); if (i > -1) l.splice(i, 1); });
    }
  };

  // ---------- helpers ----------
  function name() { return cloud ? (S.user && S.user.email ? S.user.email.split("@")[0] : "") : cfg.name; }
  function streak() {
    var days = Array.from(new Set(S.entries.map(function (e) { return dayKey(e.created_at); }))).sort(function (a, b) { return b - a; });
    if (!days.length || dayKey(Date.now()) - days[0] > 2) return 0; // one grace day
    var n = 1;
    for (var i = 1; i < days.length; i++) { if (days[i - 1] - days[i] <= 2) n++; else break; }
    return n;
  }

  // ---------- views ----------
  function auth() {
    var h = '<h1>Selah Space</h1><p class="sub">A pause for what you carry.</p><div class="card">';
    if (cloud) h += '<input type="email" id="em" placeholder="Email" autocomplete="email"><input type="password" id="pw" placeholder="Password (6+ characters)" autocomplete="current-password"><div class="row"><button class="btn ghost" data-a="signup">Create account</button><button class="btn" data-a="signin">Sign in</button></div>';
    else h += '<input type="text" id="nm" placeholder="What should we call you?"><button class="btn" style="width:100%" data-a="start">Begin</button><p class="sub"><small>Saved on this device only until cloud sign-in is set up.</small></p>';
    return h + '</div>' + (S.msg ? '<p class="err">' + esc(S.msg) + '</p>' : '');
  }

  function home() {
    if (S.done !== null) {
      var m = S.done, kept = S.entries.filter(function (e) { return e.keep; });
      var h = '<div class="card center"><div class="big">' + MOODS[m][1] + '</div><h2>' + esc(SOFT[m]) + '</h2>';
      if (cfg.faith) h += '<p class="verse">“' + VERSE[m][0] + '”<br><small>' + VERSE[m][1] + ' · KJV</small></p>';
      if (m >= 3 && kept.length) h += '<p class="note">From you, on a better day:<br>“' + esc(kept[Math.floor(Math.random() * kept.length)].body) + '”</p>';
      return h + '<button class="btn" style="width:100%" data-a="done">Done</button></div>';
    }
    var hr = new Date().getHours(), n = name();
    var h = '<p class="date">' + new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + '</p><h1>' + (hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening") + (n ? ", " + esc(n) : "") + '</h1><p class="sub">How\'s your heart today?</p><div class="moods">' +
      MOODS.map(function (m, i) { return '<button class="mood' + (S.mood === i ? " on" : "") + '" data-a="mood" data-i="' + i + '"><span>' + m[1] + '</span>' + m[0] + '</button>'; }).join("") + '</div>';
    if (S.mood !== null) {
      var w = S.kind === "worry";
      h += '<div class="seg"><button class="' + (!w ? "on" : "") + '" data-a="kind" data-k="reflection">Reflect</button><button class="' + (w ? "on" : "") + '" data-a="kind" data-k="worry">Worry</button></div>' +
        '<textarea id="txt" placeholder="' + (w ? (cfg.faith ? "Hand it over. What's weighing on you?" : "What's weighing on you?") : "Say it however it comes out…") + '">' + esc(S.draft) + '</textarea>';
      if (S.mood <= 1) h += '<label class="chk"><input type="checkbox" id="keep"> Keep this for hard days</label>';
      h += '<div class="row"><button class="btn ghost" data-a="pause">Pause first</button><button class="btn" data-a="save">Save</button></div>';
    }
    return h + (S.msg ? '<p class="err">' + esc(S.msg) + '</p>' : "");
  }

  function journal() {
    var h = "<h1>Journal</h1>";
    if (!S.entries.length) return h + '<p class="sub">Nothing here yet. Your first entry starts the story.</p>';
    return h + S.entries.map(function (e) {
      return '<article class="card"><div class="meta">' + MOODS[e.mood][1] + " " + MOODS[e.mood][0] + " · " + fmt(e.created_at) + (e.kind === "worry" ? " · worry" : "") + (e.keep ? " · kept" : "") + '</div><p class="' + (e.resolved ? "done" : "") + '">' + esc(e.body) + '</p><div class="row sm">' +
        (e.kind === "worry" ? '<button class="link" data-a="res" data-id="' + esc(e.id) + '">' + (e.resolved ? "Reopen" : "Mark resolved") + "</button>" : "") +
        '<button class="link" data-a="del" data-id="' + esc(e.id) + '">Delete</button></div></article>';
    }).join("");
  }

  function progress() {
    var total = S.entries.length, st = STAGES[0], next = null, i;
    for (i = 0; i < STAGES.length; i++) if (total >= STAGES[i][0]) { st = STAGES[i]; next = STAGES[i + 1] || null; }
    var t = dayKey(Date.now()), wk = "", s = streak();
    for (i = 6; i >= 0; i--) {
      var e = S.entries.find(function (x) { return dayKey(x.created_at) === t - i; });
      wk += "<div><b>" + (e ? MOODS[e.mood][1] : "·") + "</b>" + new Date(Date.now() - i * 864e5).toLocaleDateString(undefined, { weekday: "short" }) + "</div>";
    }
    var res = S.entries.filter(function (x) { return x.resolved; }).length;
    return '<h1>Growth</h1><div class="card center"><div class="big">' + st[1] + "</div><h2>" + st[2] + "</h2><p class=\"sub\">" + total + " " + (total === 1 ? "entry" : "entries") + (next ? " · " + (next[0] - total) + " more to reach " + next[2] : "") + "</p></div>" +
      '<div class="card"><div class="stat">' + s + '</div><p>' + (s === 1 ? "day" : "days") + " in your rhythm</p><p class=\"sub\"><small>Miss a day and your streak stays. Grace, not perfection.</small></p></div>" +
      '<div class="card"><b>This week</b><div class="week">' + wk + "</div></div>" + (res ? '<div class="card"><b>' + res + "</b> " + (res === 1 ? "worry" : "worries") + " resolved. Look how far you've come.</div>" : "");
  }

  function settings() {
    return '<h1>Settings</h1><div class="card"><label class="set">Faith layer (verses &amp; prayer prompts)<input type="checkbox" id="faith"' + (cfg.faith ? " checked" : "") + '></label>' +
      '<label class="set">Daily reminder<input type="checkbox" id="rem"' + (cfg.rem ? " checked" : "") + '></label><label class="set">Reminder time<input type="time" id="rt" value="' + cfg.time + '"></label>' +
      '<p class="sub"><small>Reminders appear while Selah Space is open.</small></p>' +
      (cloud ? "" : '<label class="set">Your name<input type="text" id="nm2" value="' + esc(cfg.name) + '"></label>') + "</div>" +
      '<button class="btn ghost" style="width:100%" data-a="out">' + (cloud ? "Sign out" : "Reset name") + "</button>";
  }

  function render() {
    var v = !S.user ? auth() : S.view === "journal" ? journal() : S.view === "progress" ? progress() : S.view === "settings" ? settings() : home();
    $("#app").innerHTML = v + (S.pausing ? '<div id="pause"><div class="orb"></div><h2 id="bt">Breathe in…</h2><button class="btn ghost" data-a="skip" style="flex:none;padding:12px 28px">Skip</button></div>' : "");
    $("#nav").hidden = !S.user;
    document.querySelectorAll("#nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === S.view); });
    tick();
  }

  // ---------- reminders ----------
  function tick() {
    var b = $("#banner");
    if (!cfg.rem || !S.user) { b.hidden = true; return; }
    var n = new Date(), hm = ("0" + n.getHours()).slice(-2) + ":" + ("0" + n.getMinutes()).slice(-2), td = dayKey(Date.now());
    var did = S.entries.some(function (e) { return dayKey(e.created_at) === td; });
    b.hidden = did || hm < cfg.time;
    if (!b.hidden && LS("selah_notified") !== td) {
      LS("selah_notified", td);
      try { if (window.Notification && Notification.permission === "granted") new Notification("Selah Space", { body: "Your daily pause is waiting." }); } catch (e) {}
    }
  }
  setInterval(tick, 60000);

  // ---------- actions ----------
  async function refresh() { try { S.entries = await data.load(); } catch (e) { S.msg = "Couldn't load your entries. Check your connection."; } }
  function pause() {
    S.pausing = true; render();
    var n = 0, id = setInterval(function () {
      n++;
      if (n >= 6 || !S.pausing) { clearInterval(id); S.pausing = false; render(); return; }
      var t = $("#bt"); if (t) t.textContent = n % 2 ? "Breathe out…" : "Breathe in…";
    }, 4000);
  }

  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("button[data-a]");
    if (!b) return;
    var a = b.dataset.a, t = $("#txt");
    if (t) S.draft = t.value;
    S.msg = "";
    try {
      if (a === "nav") { S.view = b.dataset.v; S.done = null; }
      else if (a === "mood") S.mood = +b.dataset.i;
      else if (a === "kind") S.kind = b.dataset.k;
      else if (a === "pause") { pause(); return; }
      else if (a === "skip") S.pausing = false;
      else if (a === "done") { S.done = null; S.mood = null; S.kind = "reflection"; }
      else if (a === "save") {
        var body = S.draft.trim();
        if (!body) S.msg = "Write a few words first.";
        else {
          var k = $("#keep");
          var saved = await data.add({ mood: S.mood, kind: S.kind, body: body, keep: !!(k && k.checked) });
          S.entries.unshift(saved); S.done = S.mood; S.draft = "";
        }
      }
      else if (a === "res") { var r = S.entries.find(function (x) { return String(x.id) === b.dataset.id; }); await data.patch(r.id, { resolved: !r.resolved }); r.resolved = !r.resolved; }
      else if (a === "del") { if (confirm("Delete this entry?")) { await data.del(b.dataset.id); S.entries = S.entries.filter(function (x) { return String(x.id) !== b.dataset.id; }); } }
      else if (a === "start") { var nm = $("#nm").value.trim(); if (!nm) S.msg = "Add a name to begin."; else { cfg.name = nm; saveCfg(); S.user = { name: nm }; await refresh(); } }
      else if (a === "signin" || a === "signup") {
        var em = $("#em").value.trim(), pw = $("#pw").value;
        var res = a === "signin" ? await sb.auth.signInWithPassword({ email: em, password: pw }) : await sb.auth.signUp({ email: em, password: pw });
        if (res.error) S.msg = res.error.message;
        else if (res.data.session) { S.user = res.data.session.user; await refresh(); }
        else S.msg = "Check your email to confirm your account, then sign in.";
      }
      else if (a === "out") { if (cloud) await sb.auth.signOut(); else { cfg.name = ""; saveCfg(); } S.user = null; S.entries = cloud ? [] : S.entries; S.view = "home"; }
    } catch (e) { S.msg = e && e.message ? e.message : "Something went wrong. Try again."; }
    render();
  });

  document.addEventListener("change", function (ev) {
    var i = ev.target.id;
    if (i === "faith") cfg.faith = ev.target.checked;
    else if (i === "rem") { cfg.rem = ev.target.checked; if (cfg.rem && window.Notification && Notification.permission === "default") Notification.requestPermission(); }
    else if (i === "rt") cfg.time = ev.target.value || "20:00";
    else if (i === "nm2") cfg.name = ev.target.value.trim();
    else return;
    saveCfg(); tick();
  });

  // ---------- start ----------
  (async function () {
    if (cloud) { var r = await sb.auth.getSession(); S.user = r.data.session ? r.data.session.user : null; }
    else if (cfg.name) S.user = { name: cfg.name };
    if (S.user) await refresh();
    render();
  })();
})();
        
