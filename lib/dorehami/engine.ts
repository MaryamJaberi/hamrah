// @ts-nocheck — «دورهمی» engine: a small vanilla-JS app mounted by app/d/DorehamiClient.tsx.
// Kept framework-free on purpose: it was first shipped as a standalone page and is ported here 1:1,
// then wired into Hamrah (Supabase client, accounts, outing plans). Every user string is escaped with esc().
// Routes (History API): /d  ·  /d/<code>  ·  /d/<code>?admin=<token>&new=1  ·  ?form=1  ·  ?tab=result|people|ice|share

export type DhPrefill = Record<string, any> | null;
export type DhOptions = {
  sb: any;                         // Supabase browser client (anon or signed-in)
  user: { id: string; name: string } | null;
  prefill: DhPrefill;              // answers derived from the Hamrah profile, for the form
};

export function mount(root: HTMLElement, opts: DhOptions) {
  const sb = opts.sb, USER = opts.user, PREFILL = opts.prefill;
  let dead = false;
  root.classList.add("dh");
  root.innerHTML = `<div class="wrap" id="dh-app"></div><div class="toast" id="toast"></div>`;
  const $ = (s) => root.querySelector(s);
  const app = $("#dh-app");
  let leafletP = null;
  const getL = () => (leafletP ||= import("leaflet").then(m => m.default || m).catch(() => null));


  /* ============ helpers ============ */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fa = n => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
  const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); };
  const store = {
    get(k){ try { return JSON.parse(localStorage.getItem(k) || "null"); } catch(e){ return null; } },
    set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  async function rpc(fn, args){
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message || error.hint || String(error.code));
    return data;
  }
  function errMsg(e){
    const m = String(e && e.message || e);
    if (/rate_limited/.test(m)) return "الان خیلی شلوغ است؛ چند دقیقه دیگر دوباره امتحان کن.";
    if (/full/.test(m)) return "ظرفیت این دورهمی پر شده (۴۰ نفر).";
    if (/not_found/.test(m)) return "این لینک پیدا نشد. شاید پاک شده باشد.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "اینترنت وصل نیست یا سرور جواب نداد. دوباره امتحان کن.";
    return "یک مشکلی پیش آمد: " + m;
  }
  const linkFor = code => `${location.origin}/d/${code}`;
  const fmtDate = d => {
    try {
      if (!d) return "";
      const day = String(d).slice(0, 10);
      return new Intl.DateTimeFormat("fa-IR-u-ca-gregory",{weekday:"long",day:"numeric",month:"long"}).format(new Date(day+"T12:00:00"));
    } catch(e){ return String(d || ""); }
  };
  const isFinalized = f => Boolean(f && (f.d || f.venue || f.city));
  const isDateExpired = exp => {
    if (!exp) return false;
    const s = String(exp).trim();
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T23:59:59.000Z").getTime() : new Date(s).getTime();
    return !Number.isNaN(ms) && ms < Date.now();
  };
  const fmtLocation = (loc, compact = false) => {
    if (!loc || loc.mode === "flexible") return "";
    const cityFa = loc.city_label || (loc.city ? (cityByKey(loc.city)?.fa || loc.city) : "");
    if (loc.mode === "exact") {
      const parts = [loc.place, cityFa].filter(Boolean);
      if (!parts.length) return "";
      return compact ? `🏠 ${parts.join(" · ")}` : `🏠 مکان پیشنهادی: ${parts.join(" — ")}`;
    }
    const parts = [];
    if (cityFa) parts.push(cityFa);
    if (loc.place) parts.push(loc.place);
    if (loc.radius_km) parts.push(`تا ${fa(loc.radius_km)} کیلومتر`);
    if (!parts.length) return "";
    return compact ? `📍 ${parts.join(" · ")}` : `📍 محدودهٔ پیشنهادی: ${parts.join(" · ")}`;
  };
  const fmtOpt = o => `${fmtDate(o.d)}${o.t ? " · ساعت " + fa(o.t) : ""}`;
  const COLORS = ["#5b2a86","#c2185b","#00796b","#ef6c00","#3949ab","#6d4c41","#2e7d32","#ad1457","#0277bd","#7b1fa2"];
  const fmtAudience = (aud, womenOnly = false) => {
    const badges: string[] = [];
    if (aud?.visibility === "private") badges.push("🔒 فقط با لینک خصوصی");
    else if (aud?.visibility === "nearby") badges.push("📍 فقط اطراف من");
    if (aud?.smoke === "no_smoke") badges.push("🚭 بدون سیگار");
    else if (aud?.smoke === "ok") badges.push("🚬 با سیگار اوکیم");
    if (aud?.alcohol === "no_alcohol") badges.push("🥤 بدون الکل");
    else if (aud?.alcohol === "ok") badges.push("🍷 با الکل اوکیم");
    if (womenOnly) badges.push("👩 فقط خانم‌ها");
    return badges;
  };
  const colorOf = s => COLORS[[...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0) % COLORS.length];

  /* ============ places (station cities) ============ */
  // meet: good candidate to meet in (big station + lots of cafés/restaurants)
  const CITIES = [
    ["rotterdam","روتردام","Rotterdam Centraal",51.9244,4.4690,1,1],
    ["denhaag","دن‌هاخ (لاهه)","Den Haag Centraal",52.0809,4.3249,1,1],
    ["delft","دلفت","Delft",52.0067,4.3566,1,0],
    ["leiden","لایدن","Leiden Centraal",52.1660,4.4818,1,0],
    ["gouda","خاودا (گودا)","Gouda",52.0175,4.7046,1,0],
    ["dordrecht","دوردرخت","Dordrecht",51.8075,4.6683,1,0],
    ["zoetermeer","زوترمیر","Zoetermeer Centrum-West",52.0573,4.4930,1,0],
    ["schiedam","سخیدام","Schiedam Centrum",51.9213,4.4089,1,0],
    ["utrecht","اوترخت","Utrecht Centraal",52.0894,5.1101,1,1],
    ["amsterdam","آمستردام","Amsterdam Centraal",52.3789,4.9003,1,1],
    ["haarlem","هارلم","Haarlem",52.3877,4.6383,1,0],
    ["breda","بردا","Breda",51.5955,4.7799,1,0],
    ["denbosch","دن‌بوس","'s-Hertogenbosch",51.6905,5.2937,1,0],
    ["tilburg","تیلبورخ","Tilburg",51.5606,5.0835,1,0],
    ["eindhoven","آیندهوون","Eindhoven Centraal",51.4433,5.4813,1,1],
    ["vlaardingen","فلاردینگن","Vlaardingen Centrum",51.9122,4.3419,0,0],
    ["maassluis","ماسلویس","Maassluis",51.9170,4.2500,0,0],
    ["spijkenisse","اسپایکنیسه","Spijkenisse",51.8556,4.3297,0,0],
    ["capelle","کاپله آن دن آیسل","Capelle a/d IJssel",51.9300,4.5780,0,0],
    ["barendrecht","بارندرخت","Barendrecht",51.8567,4.5414,0,0],
    ["ridderkerk","ریدرکرک","Ridderkerk",51.8720,4.6030,0,0],
    ["zwijndrecht","زواین‌درخت","Zwijndrecht",51.8150,4.6400,0,0],
    ["papendrecht","پاپندرخت","Papendrecht",51.8300,4.6900,0,0],
    ["gorinchem","خورینخم","Gorinchem",51.8360,4.9740,0,0],
    ["hellevoetsluis","هلفوتسلویس","Hellevoetsluis",51.8300,4.1300,0,0],
    ["rijswijk","رایسوایک","Rijswijk",52.0390,4.3200,0,0],
    ["voorburg","فوربورخ / لایدسندام","Voorburg",52.0688,4.3846,0,0],
    ["westland","وستلند (ناالدوایک)","Naaldwijk",51.9940,4.2100,0,0],
    ["wassenaar","واسنار","Wassenaar",52.1430,4.4000,0,0],
    ["katwijk","کاتوایک","Katwijk",52.2000,4.4100,0,0],
    ["noordwijk","نوردوایک","Noordwijk",52.2400,4.4400,0,0],
    ["alphen","آلفن آن دن راین","Alphen a/d Rijn",52.1244,4.6577,0,0],
    ["leiderdorp","لایدردورپ / اوخستخیست","Leiderdorp",52.1580,4.5300,0,0],
    ["hoofddorp","هوفدورپ","Hoofddorp",52.2913,4.7015,0,0],
    ["amstelveen","آمستلفین","Amstelveen",52.3030,4.8600,0,0],
    ["almere","آلمیره","Almere Centrum",52.3750,5.2170,0,0],
    ["amersfoort","آمرسفورت","Amersfoort Centraal",52.1530,5.3740,0,0],
    ["nieuwegein","نیووخاین","Nieuwegein",52.0300,5.0800,0,0],
    ["roosendaal","روزندال","Roosendaal",51.5404,4.4586,0,0],
    ["bergenopzoom","برخن اوپ زوم","Bergen op Zoom",51.4950,4.2900,0,0],
    ["oosterhout","اوسترهوت","Oosterhout",51.6450,4.8600,0,0],
    ["waalwijk","والوایک","Waalwijk",51.6820,5.0700,0,0],
    ["oss","اُس","Oss",51.7650,5.5200,0,0],
    ["helmond","هلموند","Helmond",51.4800,5.6600,0,0],
    ["nijmegen","نایمخن","Nijmegen",51.8430,5.8520,0,0],
    ["arnhem","آرنهم","Arnhem Centraal",51.9850,5.8990,0,0],
    ["venlo","ونلو","Venlo",51.3700,6.1700,0,0],
    ["maastricht","ماستریخت","Maastricht",50.8496,5.7058,0,0],
    ["middelburg","میدلبورخ","Middelburg",51.4950,3.6170,0,0],
    ["vlissingen","فلیسینگن","Vlissingen",51.4440,3.5970,0,0],
    ["goes","خوس","Goes",51.5040,3.8900,0,0],
  ].map(([key,fa_,nl,lat,lng,meet,big]) => ({key,fa:fa_,nl,lat,lng,meet:!!meet,big:!!big}));
  const cityByKey = k => CITIES.find(c => c.key === k);
  function km(a,b){
    const R=6371, r=x=>x*Math.PI/180, dLa=r(b.lat-a.lat), dLo=r(b.lng-a.lng);
    const h=Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  // rough travel-time model (minutes). Only an estimate; real routes via 9292 / Google Maps links.
  function travel(origin, hub, mode){
    const d = km(origin, hub);
    const onStation = origin.station !== false;
    if (d < 1.5) return mode==="bike"||mode==="ov" ? 8 : 10;
    if (mode === "ov") return Math.round((onStation?10:18) + d*1.2/70*60 + (d>30?8:0) + (d>80?8:0));
    if (mode === "car") return Math.round(8 + d*1.25/65*60 + (hub.big?14:7)); // + parking
    if (mode === "bike") return d > 16 ? Infinity : Math.round(d*1.2/15*60);
    return Infinity;
  }

  /* ============ question catalogue ============ */
  const ACTIVITIES = [["cafe","☕ کافه و گپ"],["persian","🍢 رستوران ایرانی"],["food","🍽️ رستوران (هر نوع)"],["walk","🌳 پیاده‌روی / طبیعت"],["beach","🏖️ ساحل"],["museum","🖼️ موزه / گالری"],["boardgame","🎲 بازی (بردگیم، مافیا)"],["picnic","🧺 پیک‌نیک"],["karaoke","🎤 کارائوکه / آواز"],["dance","💃 رقص / مهمانی"],["cinema","🎬 سینما"],["market","🛍️ بازار / خرید"],["sport","🏸 ورزش با هم"],["workshop","🎨 کارگاه هنری"]];
  const DIET = [["halal","گوشت حلال"],["no_pork","فقط بدون گوشت خوک"],["vegetarian","گیاه‌خوار"],["vegan","وگان"],["gluten","بدون گلوتن"],["lactose","بدون لاکتوز"],["none","محدودیتی ندارم"]];
  const HOBBIES = ["کتاب","موسیقی","سفر","طبیعت","ورزش","یوگا","آشپزی","عکاسی","نقاشی","فیلم و سریال","بازی","رقص","زبان یاد گرفتن","روانشناسی","تکنولوژی","مد و لباس","گیاه و باغبانی","حیوانات","شعر","تئاتر"];
  const WEEK_DAYS = [["sat","شنبه"],["sun","یکشنبه"],["mon","دوشنبه"],["tue","سه‌شنبه"],["wed","چهارشنبه"],["thu","پنجشنبه"],["fri","جمعه"]];
  const DAY_PARTS = [["morning","صبح (۹–۱۲)"],["afternoon","ظهر (۱۲–۱۶)"],["evening","عصر (۱۶–۲۰)"],["night","شب (۲۰–۲۳)"]];
  const PART_HEAD = {morning:"🌅 صبح", afternoon:"☀️ ظهر", evening:"🌆 عصر", night:"🌙 شب"};
  const fmtWin = w => {
    const [d,p] = String(w||"").split(":");
    const dl = (WEEK_DAYS.find(x=>x[0]===d)||[,d])[1];
    const pl = (DAY_PARTS.find(x=>x[0]===p)||[,p])[1];
    return `${dl} ${pl}`;
  };
  function renderWeekGrid(selectedArr, attrName) {
    const set = new Set(Array.isArray(selectedArr) ? selectedArr : []);
    return `
      <div class="row" style="gap:6px;margin:6px 0;flex-wrap:wrap">
        <button type="button" class="btn ghost sm" data-qfill-${attrName}="wknd">✨ آخر هفته‌ها (شنبه و یکشنبه)</button>
        <button type="button" class="btn ghost sm" data-qfill-${attrName}="eve">🌆 عصرهای هفته</button>
        <button type="button" class="btn line sm" data-qfill-${attrName}="clear">🧹 پاک کردن</button>
      </div>
      <table class="wk-grid">
        <thead>
          <tr>
            <th></th>
            ${DAY_PARTS.map(([pk]) => `<th>${PART_HEAD[pk]}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${WEEK_DAYS.map(([dk, dl]) => `
            <tr>
              <th class="day-lbl">${dl}</th>
              ${DAY_PARTS.map(([pk]) => {
                const k = `${dk}:${pk}`;
                const on = set.has(k);
                return `<td class="wk-cell ${on?"on":""}" data-${attrName}="${k}">${on?"✓":"·"}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }
  let KNOWN_PROFILES = [];
  let RECENT_MEETUPS = [];
  let profilesLoaded = false;
  let AUX_MAPS = [];
  function clearAuxMaps(){
    AUX_MAPS.forEach(m => { try { m.remove(); } catch(e){} });
    AUX_MAPS = [];
  }
  const TIME_BUCKETS = [
    ["wknd", "🎉 آخر هفته‌ها (شنبه و یکشنبه)"],
    ["wkday_eve", "🌆 عصرهای وسط هفته (دوشنبه تا جمعه)"],
    ["fri_eve", "🌙 جمعه عصر و شب"],
    ["sat", "☀️ کل روز شنبه"],
    ["sun", "☀️ کل روز یکشنبه"],
    ["any", "✨ هر وقت که بشود"]
  ];
  const fmtTimeBucket = (k) => (TIME_BUCKETS.find(x => x[0] === k) || [, fmtWin(k)])[1];

  const EVENT_IDEAS = [
    { k: "cafe", icon: "☕", label: "کافه", title: "کافه و گپ دوستانه ☕", note: "بریم یه کافه بشینیم و گپ بزنیم ☕", target: "group" },
    { k: "run", icon: "🏃‍♀️", label: "دویدن", title: "همراه برای دویدن صبحگاهی 🏃‍♀️", note: "دنبال یک همراه می‌گردم صبح‌ها با هم بریم بدویم 🏃‍♀️", target: "pair" },
    { k: "walk", icon: "🌳", label: "پیاده‌روی", title: "پیاده‌روی در طبیعت و پارک 🌳", note: "پیاده‌روی در پارک و هواخوری 🌿", target: "group" },
    { k: "boardgame", icon: "🎲", label: "بردگیم", title: "شب بازی و بردگیم 🎲", note: "دورهمی برای بازی‌های فکری و مافیا 🎲", target: "group" },
    { k: "food", icon: "🍽️", label: "شام/غذا", title: "دورهمی شام یا ناهار 🍽️", note: "بریم یک رستوران خوب با هم 🍽️", target: "group" },
  ];

  function detectActivityIcon(t) {
    const s = String(t || "").toLowerCase();
    if (s.includes("کافه") || s.includes("قهوه") || s.includes("cafe")) return "☕";
    if (s.includes("دویدن") || s.includes("ورزش") || s.includes("بدمینتون") || s.includes("run") || s.includes("sport")) return "🏃‍♀️";
    if (s.includes("پیاده") || s.includes("پارک") || s.includes("طبیعت") || s.includes("walk")) return "🌳";
    if (s.includes("رستوران") || s.includes("غذا") || s.includes("شام") || s.includes("ناهار") || s.includes("food")) return "🍽️";
    if (s.includes("بردگیم") || s.includes("بازی") || s.includes("مافیا") || s.includes("game")) return "🎲";
    if (s.includes("سینما") || s.includes("فیلم") || s.includes("cinema")) return "🎬";
    if (s.includes("پیک‌نیک") || s.includes("picnic")) return "🧺";
    if (s.includes("کتاب") || s.includes("مطالعه") || s.includes("study")) return "📚";
    if (s.includes("دوچرخه") || s.includes("bike")) return "🚴";
    if (s.includes("موزه") || s.includes("گالری") || s.includes("museum")) return "🖼️";
    if (s.includes("بازار") || s.includes("خرید") || s.includes("shop")) return "🛍️";
    return "✨";
  }

  function detectTargetType(t, note) {
    const s = `${t || ""} ${note || ""}`.toLowerCase();
    if (s.includes("همراه") || s.includes("دونفره") || s.includes("دو نفره") || s.includes("هم‌پا") || s.includes("یک نفر") || s.includes("۱ به ۱")) return "pair";
    return "group";
  }

  function renderLocationControl(dataObj, prefix) {
    const useRad = dataObj.use_radius !== false;
    const curMin = Number(dataObj?.max_min) || 45;
    const curKm = Math.round(curMin * 0.75);
    return `
      <div class="city-add-bar">
        <select id="${prefix}_add_sel" style="flex:1;min-width:155px">
          <option value="">+ افزودن شهر دیگر روی نقشه…</option>
          ${CITIES.map(c => `<option value="${c.key}">${esc(c.fa)} (${esc(c.nl)})</option>`).join("")}
        </select>
        <button type="button" class="btn ghost sm" id="${prefix}_add_btn">+ افزودن شهر</button>
        <label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;background:#f4f2fc;padding:7px 10px;border-radius:11px;cursor:pointer;user-select:none">
          <input type="checkbox" id="${prefix}_rad_chk" ${useRad?"checked":""} style="width:auto;margin:0;accent-color:var(--p)">
          <span>⭕ نمایش دایرهٔ شعاع</span>
        </label>
      </div>
      <div id="${prefix}_sel_tags" class="chips" style="margin:6px 0"></div>
      <div class="rad-ctrl" id="${prefix}_rad_box" style="display:${useRad?"flex":"none"}">
        <span class="tiny" style="white-space:nowrap">⭕ شعاع دایرهٔ حرکت:</span>
        <input type="range" id="${prefix}_rad" min="10" max="120" step="5" value="${curMin}">
        <span class="rad-val" id="${prefix}_rad_lbl">${fa(curMin)} دقیقه (~${fa(curKm)} کم)</span>
      </div>`;
  }

  function renderTimeLocLinker(dataObj, prefix) {
    const hasRules = Array.isArray(dataObj.time_locations) && dataObj.time_locations.length > 0;
    return `
      <div style="margin-top:8px;display:flex;justify-content:flex-end">
        <button type="button" class="btn line sm" id="${prefix}_tl_toggle" style="font-size:12px;padding:4px 10px">
          🔗 وصل کردن شهر به زمان خاص (اختیاری) ${hasRules ? `· ${fa(dataObj.time_locations.length)}` : ""}
        </button>
      </div>
      <div id="${prefix}_tl_box" style="display:${hasRules?"block":"none"};background:#faf9ff;border:1.5px dashed #dcd4f5;border-radius:14px;padding:10px 12px;margin-top:6px">
        <span class="tiny" style="display:block;margin-bottom:6px">مثلاً آخر هفته‌ها می‌توانم شهر دورتر بیایم، وسط هفته فقط یک شهر خاص:</span>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <select id="${prefix}_tl_when" style="flex:1.2;min-width:140px">
            ${TIME_BUCKETS.map(([k,l]) => `<option value="${k}">${esc(l)}</option>`).join("")}
            ${(Array.isArray(dataObj.free_windows) ? dataObj.free_windows : []).map(w => `<option value="${esc(w)}">🗓️ ${esc(fmtWin(w))}</option>`).join("")}
          </select>
          <select id="${prefix}_tl_city" style="flex:1;min-width:120px">
            ${CITIES.filter(c => c.meet || (dataObj.origin && dataObj.origin.key === c.key) || (dataObj.can_cities||[]).includes(c.key)).map(c => `<option value="${c.key}">📍 ${esc(c.fa)}</option>`).join("")}
          </select>
          <button type="button" class="btn ghost sm" id="${prefix}_tl_add">+ ثبت</button>
        </div>
        <div id="${prefix}_tl_list"></div>
      </div>`;
  }

  function wireLocationAndTimeControls(container, dataObj, prefix, mapId) {
    const refreshTags = () => {
      const box = container.querySelector(`#${prefix}_sel_tags`);
      if (!box) return;
      const orig = dataObj.origin && dataObj.origin.key ? dataObj.origin : null;
      const can = Array.isArray(dataObj.can_cities) ? dataObj.can_cities : [];
      const items = [];
      if (orig && orig.fa) {
        items.push(`<span class="city-tag orig">📍 مبدأ: ${esc(orig.fa)} <i data-rmorig="1" title="حذف مبدأ">✕</i></span>`);
      }
      can.forEach(k => {
        if (orig && orig.key === k) return;
        const c = cityByKey(k);
        if (c) items.push(`<span class="city-tag">✓ ${esc(c.fa)} <i data-rmcity="${esc(k)}" title="حذف">✕</i></span>`);
      });
      box.innerHTML = items.join("") || `<span class="tiny">بدون نیاز به مبدأ، می‌توانی فقط شهرهایی که اوکی هستی بیایی را انتخاب کنی.</span>`;
      box.querySelectorAll("[data-rmorig]").forEach(x => x.onclick = () => {
        delete dataObj.origin;
        refreshTags();
        const mEl = document.getElementById(mapId);
        if (mEl && mEl._redrawMap) mEl._redrawMap();
      });
      box.querySelectorAll("[data-rmcity]").forEach(x => x.onclick = () => {
        const rk = x.dataset.rmcity;
        dataObj.can_cities = (dataObj.can_cities || []).filter(c => c !== rk);
        refreshTags();
        const mEl = document.getElementById(mapId);
        if (mEl && mEl._redrawMap) mEl._redrawMap();
      });
    };

    const addCityKey = (k) => {
      if (!k) return;
      const c = cityByKey(k);
      if (!c) return;
      const arr = Array.isArray(dataObj.can_cities) ? dataObj.can_cities : [];
      if (!arr.includes(k)) dataObj.can_cities = [...arr, k];
      refreshTags();
      const mEl = document.getElementById(mapId);
      if (mEl && mEl._redrawMap) mEl._redrawMap();
    };

    const sel = container.querySelector(`#${prefix}_add_sel`);
    const addBtn = container.querySelector(`#${prefix}_add_btn`);
    if (addBtn && sel) {
      addBtn.onclick = () => { if (sel.value) { addCityKey(sel.value); sel.value = ""; } };
      sel.onchange = () => { if (sel.value) { addCityKey(sel.value); sel.value = ""; } };
    }

    const chk = container.querySelector(`#${prefix}_rad_chk`);
    const radBox = container.querySelector(`#${prefix}_rad_box`);
    if (chk) {
      chk.onchange = () => {
        dataObj.use_radius = chk.checked;
        if (radBox) radBox.style.display = chk.checked ? "flex" : "none";
        const mEl = document.getElementById(mapId);
        if (mEl && mEl._redrawMap) mEl._redrawMap();
      };
    }

    const sl = container.querySelector(`#${prefix}_rad`);
    const lbl = container.querySelector(`#${prefix}_rad_lbl`);
    if (sl) {
      sl.oninput = () => {
        const v = Number(sl.value) || 45;
        dataObj.max_min = v;
        dataObj.use_radius = true;
        if (chk) chk.checked = true;
        if (radBox) radBox.style.display = "flex";
        const rKm = Math.round(v * 0.75);
        if (lbl) lbl.textContent = `${fa(v)} دقیقه (~${fa(rKm)} کم)`;
        const mEl = document.getElementById(mapId);
        if (mEl && mEl._redrawMap) mEl._redrawMap();
      };
    }

    // Time-Location linker
    const tlToggle = container.querySelector(`#${prefix}_tl_toggle`);
    const tlBox = container.querySelector(`#${prefix}_tl_box`);
    if (tlToggle && tlBox) {
      tlToggle.onclick = () => {
        tlBox.style.display = tlBox.style.display === "none" ? "block" : "none";
      };
    }
    const tlList = container.querySelector(`#${prefix}_tl_list`);
    const drawTl = () => {
      if (!tlList) return;
      const rules = Array.isArray(dataObj.time_locations) ? dataObj.time_locations : [];
      tlList.innerHTML = rules.map((r, idx) => {
        const c = cityByKey(r.city);
        return `<div class="tl-row">
          <span>🗓️ <b>${esc(fmtTimeBucket(r.when))}</b> ← 📍 <b>${esc(c ? c.fa : r.city)}</b></span>
          <button type="button" class="btn line sm" data-rmtl="${idx}" style="padding:2px 8px">✕</button>
        </div>`;
      }).join("");
      tlList.querySelectorAll("[data-rmtl]").forEach(b => b.onclick = () => {
        const i = Number(b.dataset.rmtl);
        dataObj.time_locations = (dataObj.time_locations || []).filter((_, idx) => idx !== i);
        drawTl();
      });
    };
    const tlAdd = container.querySelector(`#${prefix}_tl_add`);
    if (tlAdd) {
      tlAdd.onclick = () => {
        const w = container.querySelector(`#${prefix}_tl_when`)?.value;
        const c = container.querySelector(`#${prefix}_tl_city`)?.value;
        if (!w || !c) return;
        const arr = Array.isArray(dataObj.time_locations) ? dataObj.time_locations : [];
        if (!arr.some(x => x.when === w && x.city === c)) {
          dataObj.time_locations = [...arr, { when: w, city: c }];
        }
        addCityKey(c);
        drawTl();
      };
    }

    refreshTags();
    drawTl();
    return { refreshTags, drawTl };
  }

  function mountZoneMap(elId, dataObj, opts = {}){
    getL().then(L => {
      const el = document.getElementById(elId);
      if (!L || !el || dead) return;
      try {
        const m = L.map(el, {zoomControl:true, attributionControl:false});
        AUX_MAPS.push(m);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18}).addTo(m);
        let layer = L.layerGroup().addTo(m);
        const redraw = () => {
          layer.clearLayers();
          const pts = [];
          const orig = dataObj.origin && dataObj.origin.lat ? dataObj.origin : null;
          const useRad = dataObj.use_radius !== false;
          const maxMin = Number(dataObj.max_min) || 45;
          // ~0.75 km per minute of travel radius around origin
          const radMeters = Math.max(6000, Math.min(90000, maxMin * 750));
          if (orig) {
            if (useRad) {
              L.circle([orig.lat, orig.lng], {
                radius: radMeters,
                color: "#6C5CE7",
                fillColor: "#6C5CE7",
                fillOpacity: 0.14,
                weight: 2,
                dashArray: "6 4"
              }).addTo(layer).bindPopup(`محدودهٔ راحت حرکت از ${esc(orig.fa)} (حدود ${fa(maxMin)} دقیقه)`);
              const dLat = radMeters / 111000;
              pts.push([orig.lat + dLat, orig.lng]);
              pts.push([orig.lat - dLat, orig.lng]);
            }
            pts.push([orig.lat, orig.lng]);
          }
          const canSet = new Set(Array.isArray(dataObj.can_cities) ? dataObj.can_cities : []);
          CITIES.filter(c => c.meet || canSet.has(c.key) || (orig && orig.key === c.key)).forEach(c => {
            const isOrig = orig && orig.key === c.key;
            const isCan = canSet.has(c.key);
            const inRad = (orig && useRad) ? (km(orig, c) * 1000 <= radMeters) : false;
            if (isCan && !isOrig) {
              L.circle([c.lat, c.lng], {
                radius: 7500,
                color: "#00B894",
                fillColor: "#00B894",
                fillOpacity: 0.20,
                weight: 2
              }).addTo(layer);
              pts.push([c.lat, c.lng]);
            }
            const color = isOrig ? "#6C5CE7" : isCan ? "#00B894" : inRad ? "#55efc4" : "#9b95a8";
            const mk = L.circleMarker([c.lat, c.lng], {
              radius: isOrig ? 9 : isCan ? 8.5 : inRad ? 7.5 : 6,
              color: "#fff",
              fillColor: color,
              fillOpacity: 0.95,
              weight: 2
            }).addTo(layer);
            mk.bindTooltip(c.fa, {permanent: isOrig || isCan, direction: "top", offset: [0, -6]});
            if (opts.onToggleCity) {
              mk.on("click", () => { opts.onToggleCity(c); redraw(); });
            }
          });
          if (pts.length > 1) m.fitBounds(pts, {padding:[20,20], maxZoom:10});
          else if (pts.length === 1) m.setView(pts[0], 9);
          else m.setView([52.08, 4.55], 8);
        };
        redraw();
        el._redrawMap = redraw;
        setTimeout(() => { try { m.invalidateSize(); } catch(e){} }, 120);
      } catch(e){}
    });
  }
  async function loadKnownProfiles(){
    if (profilesLoaded) return KNOWN_PROFILES;
    try {
      const r = await fetch("/api/d/profiles");
      if (r.ok) {
        const j = await r.json();
        KNOWN_PROFILES = j.profiles || [];
        RECENT_MEETUPS = j.recentMeetups || [];
        profilesLoaded = true;
      }
    } catch(e){}
    return KNOWN_PROFILES;
  }
  const LABEL = {
    origin:"از کجا میاد", can_cities:"لوکیشن‌هایی که می‌تونه بیاد", time_locations:"مکان‌های متصل به زمان", modes:"وسیله", seats:"جای خالی در ماشین", max_min:"حداکثر زمان راه",
    avail:"وقت‌ها", free_windows:"ساعت‌ها و روزهای آزاد", free_note:"ساعت پیشنهادی", until:"تا کی می‌ماند",
    night_alone:"برگشت شب", activities:"دوست دارد", budget:"بودجه", diet:"غذا", allergy:"آلرژی", dislikes:"غذایی که دوست ندارد",
    alcohol:"الکل", smoke:"سیگار", weed:"ماری‌جوانا", langs:"زبان", bring:"با کی میاد", photo:"عکس و استوری", quiet:"جای آرام",
    access:"دسترسی", age:"سن", job:"کار / درس", hobbies:"علاقه‌ها", about:"درباره‌اش", question:"سؤالش از جمع", contact:"راه ارتباط"
  };
  const MODE_L = {ov:"🚆 قطار/اتوبوس", car:"🚗 ماشین", bike:"🚲 دوچرخه"};
  const ALC_L = {none_place:"ترجیح می‌دهد جای بدون الکل", fine:"برایش فرقی نمی‌کند", drink:"خودش هم می‌نوشد"};
  const SMOKE_L = {bothers:"دود اذیتش می‌کند", fine:"مشکلی ندارد", smoke:"خودش سیگار می‌کشد"};
  const WEED_L = {not_near:"ترجیح می‌دهد کنارش نباشد", fine:"برایش فرقی نمی‌کند", use:"خودش هم مصرف می‌کند"};
  const NIGHT_L = {ok:"راحت است", early:"ترجیح می‌دهد قبل از تاریکی برگردد", ride:"اگر کسی برساند راحت‌تر است"};
  const UNTIL_L = {"17":"تا ۱۷","19":"تا ۱۹","21":"تا ۲۱","23":"تا ۲۳","late":"دیرتر هم اوکی"};
  const PHOTO_L = {ok:"اوکی است", nofaces:"عکس بله، ولی صورتش پست نشود", no:"لطفاً عکسش جایی پست نشود"};
  const BRING_L = {alone:"تنها", friend:"شاید با یک دوست", partner:"شاید با همسر/پارتنر", kids:"شاید با بچه"};
  const LANG_L = {fa:"فارسی", en:"انگلیسی", nl:"هلندی", tr:"ترکی", ar:"عربی", ku:"کردی"};
  const BUDGET_L = {1:"€ ارزان", 2:"€€ متوسط", 3:"€€€ مهم نیست"};
  function showVal(k, v){
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
    const map = (arr, L) => arr.map(x => L[x] || x).join("، ");
    switch(k){
      case "origin": return v.fa || v.label || "";
      case "can_cities": return (Array.isArray(v) ? v : []).map(k => (cityByKey(k)||{}).fa || k).join("، ");
      case "time_locations": return (Array.isArray(v) ? v : []).map(r => `${fmtTimeBucket(r.when)} ← ${(cityByKey(r.city)||{}).fa || r.city}`).join(" · ");
      case "free_windows": return (Array.isArray(v) ? v : []).map(fmtWin).join(" · ");
      case "free_note": return String(v);
      case "modes": return map(v, MODE_L);
      case "max_min": return fa(v) + " دقیقه";
      case "activities": return map(v, Object.fromEntries(ACTIVITIES));
      case "diet": return map(v, Object.fromEntries(DIET));
      case "budget": return BUDGET_L[v] || v;
      case "alcohol": return ALC_L[v] || v;
      case "smoke": return SMOKE_L[v] || v;
      case "weed": return WEED_L[v] || v;
      case "night_alone": return NIGHT_L[v] || v;
      case "until": return UNTIL_L[v] || v;
      case "photo": return PHOTO_L[v] || v;
      case "bring": return BRING_L[v] || v;
      case "langs": return map(v, LANG_L);
      case "quiet": return v ? "جای آرام و کم‌سروصدا را ترجیح می‌دهد" : "";
      case "hobbies": return v.join("، ");
      case "seats": return fa(v) + " نفر";
      case "avail": return "";
      default: return Array.isArray(v) ? v.join("، ") : String(v);
    }
  }

  /* ============ router ============ */
  function route(){
    if (dead) return;
    const parts = location.pathname.split("/").filter(Boolean);   // ["d", code?]
    const q = new URLSearchParams(location.search);
    if (MAP) { try { MAP.remove(); } catch(e){} MAP = null; }
    clearAuxMaps();
    if (parts[0] === "d" && parts[1]) return meetupPage(parts[1].toLowerCase(), q);
    return homePage();
  }
  function go(url){ history.pushState(null, "", url); scrollTo(0,0); route(); }

  /* ============ Hamrah account glue ============ */
  function localItems(){
    let keys = []; try { keys = Object.keys(localStorage); } catch(e){}
    return keys.filter(k => k.startsWith("dh_") && !k.startsWith("dh_pick_")).map(k => ({code:k.slice(3), ...store.get(k)})).filter(x => x && x.title);
  }
  // after signing in, adopt what this browser did as a guest (organizer links + own answers)
  async function claimGuestWork(){
    if (!USER) return;
    const items = localItems().filter(x => x.admin || x.edit).map(x => ({code:x.code, admin:x.admin||null, edit:x.edit||null}));
    if (!items.length) return;
    try { await rpc("dh_claim", {p_items: items}); } catch(e){}
  }
  function topbar(){
    const cached = store.get("dh_last");
    const myName = USER?.name || cached?.name || "";
    const retUrl = encodeURIComponent(location.pathname + location.search);
    return `<div class="topbar">
      <a href="/d" style="display:flex;align-items:center;gap:6px">🌿 <b>دورهمی همراه</b></a>
      <div class="row" style="gap:6px">
        ${myName ? `<button type="button" class="btn line sm" id="tb_prof_btn" style="padding:5px 10px;font-size:12.5px">👤 ${esc(myName)}</button>` : ""}
        ${USER
          ? `<a href="/out" data-ext="1" style="font-size:12.5px">بریم بیرون ←</a>`
          : `<a href="/login?next=${retUrl}" data-ext="1" data-login="1" class="btn ghost sm" style="padding:5px 11px;font-size:12.5px">🔐 ورود / ثبت‌نام</a>`}
      </div>
    </div>`;
  }
  function wireWeekGrid(container, getArr, setArr, attrName) {
    const refreshCells = () => {
      const cur = new Set(getArr());
      container.querySelectorAll(`[data-${attrName}]`).forEach(td => {
        const on = cur.has(td.dataset[attrName]);
        td.classList.toggle("on", on);
        td.textContent = on ? "✓" : "·";
      });
    };
    container.querySelectorAll(`[data-${attrName}]`).forEach(el => el.onclick = () => {
      const k = el.dataset[attrName];
      const arr = getArr();
      setArr(arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k]);
      refreshCells();
    });
    container.querySelectorAll(`[data-qfill-${attrName}]`).forEach(btn => btn.onclick = () => {
      const mode = btn.getAttribute(`data-qfill-${attrName}`);
      if (mode === "clear") setArr([]);
      else if (mode === "wknd") {
        const s = new Set(getArr());
        ["sat:afternoon","sat:evening","sun:afternoon","sun:evening"].forEach(k => s.add(k));
        setArr([...s]);
      } else if (mode === "eve") {
        const s = new Set(getArr());
        WEEK_DAYS.forEach(([dk]) => s.add(`${dk}:evening`));
        setArr([...s]);
      }
      refreshCells();
    });
  }

  function openProfileModal(initialProf = null) {
    let existing = document.getElementById("dh_prof_modal");
    if (existing) existing.remove();
    const cached = store.get("dh_last");
    let p = initialProf;
    if (!p && cached && cached.name) {
      const found = KNOWN_PROFILES.find(x => x.name.toLowerCase() === cached.name.toLowerCase());
      p = found ? { ...found, data: { ...found.data, ...(cached.data || {}) }, email: cached.email || found.email || found.data?.email } : { name: cached.name, email: cached.email || cached.data?.email, data: cached.data || {}, public_fields: cached.pub || [] };
    }
    if (!p && USER && USER.name) {
      const found = KNOWN_PROFILES.find(x => x.name.toLowerCase() === USER.name.toLowerCase());
      p = found || { name: USER.name, data: PREFILL?.data || {}, public_fields: [] };
    }
    const wrap = document.createElement("div");
    wrap.id = "dh_prof_modal";
    wrap.className = "drawer-backdrop";

    const drawModal = () => {
      const d = (p && p.data) ? p.data : {};
      const emailVal = p?.email || d.email || "";
      const ORDER = ["origin","can_cities","free_windows","free_note","modes","max_min","activities","budget","diet","hobbies","age","job","about","question"];
      const tags = p ? ORDER.map(k => { const v = showVal(k, d[k]); return v ? `<span class="summary-tag"><b>${LABEL[k]}:</b>${esc(v)}</span>` : ""; }).filter(Boolean).join("") : "";
      const shareUrl = p ? `${location.origin}/d?u=${encodeURIComponent(p.name)}` : "";
      const shareTxt = p ? `پروفایل و ساعت‌های آزاد ${p.name} در دورهمی همراه 🌿:\n${shareUrl}` : "";

      wrap.innerHTML = `
        <div class="drawer">
          <div class="row" style="justify-content:space-between;margin-bottom:10px">
            <b style="font-size:17px">👤 پروفایل شخصی من</b>
            <button type="button" class="btn line sm" id="pm_close">✕ بستن</button>
          </div>

          <div style="background:#f7f5ff;border:1.5px solid #e2dcf7;border-radius:14px;padding:12px;margin-bottom:12px">
            ${USER ? `
              <div class="row" style="justify-content:space-between;align-items:center">
                <span style="font-size:13.5px;font-weight:700;color:var(--ok)">✓ وارد شده با حساب همراه (${esc(USER.name || "")})</span>
                <a href="/out" data-ext="1" class="tiny" style="font-weight:700">رفتن به همراه ←</a>
              </div>
            ` : `
              <b style="font-size:13.5px;display:block;margin-bottom:4px">🔐 ورود به حساب همراه</b>
              <p class="tiny muted" style="margin:0 0 10px">با ورود (گوگل، ایمیل یا شماره موبایل) پروفایل و ایونت‌هایت در همهٔ دستگاه‌ها ذخیره می‌شود:</p>
              <a href="/login?next=${encodeURIComponent(location.pathname + location.search)}" data-ext="1" data-login="1" class="btn sm block">ورود با گوگل، ایمیل یا موبایل ←</a>
            `}
          </div>

          ${p ? `
            <div class="row" style="justify-content:space-between;margin-bottom:8px">
              <div class="row" style="gap:8px">
                <div class="av-sm" style="background:${colorOf(p.name)};width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">${esc(p.name.slice(0,1))}</div>
                <div>
                  <b style="font-size:16px;display:block">${esc(p.name)}</b>
                  <small class="muted">${emailVal ? `📧 متصل به ${esc(emailVal)}` : "ذخیره در کش مرورگر"}</small>
                </div>
              </div>
              <button type="button" class="btn line sm" id="pm_logout">خروج از پروفایل</button>
            </div>

            ${tags ? `<div class="summary-tags">${tags}</div>` : ""}

            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #d8caec">
              <b style="font-size:13.5px;display:block;margin-bottom:4px">📍 شهرهایی که اوکی هستم بیایم (مبدأ و دایره اختیاری است):</b>
              ${renderLocationControl(d, "pm_loc")}
              <div id="hp_map" class="map-box"></div>
              <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <div class="map-legend">
                  <span><i class="map-dot" style="background:#00B894"></i>شهرهای انتخاب‌شده</span>
                  <span><i class="map-dot" style="background:#6C5CE7"></i>مبدأ و دایره (اختیاری)</span>
                </div>
                <select id="pm_origin_sel" style="width:auto;padding:4px 8px;font-size:12px">
                  <option value="">🏠 مبدأ (اختیاری / بدون مبدأ)</option>
                  ${CITIES.map(c => `<option value="${c.key}" ${(d.origin && d.origin.key===c.key)?"selected":""}>🏠 مبدأ: ${esc(c.fa)}</option>`).join("")}
                </select>
              </div>
              ${renderTimeLocLinker(d, "pm_loc")}

              <b style="font-size:13.5px;display:block;margin:12px 0 4px">🗓️ جدول ساعت‌ها و روزهای آزاد هفتگی من:</b>
              <div id="hp_wins">
                ${renderWeekGrid(d.free_windows || [], "hpwin")}
              </div>

              <div class="row" style="margin-top:12px;flex-wrap:wrap;gap:6px">
                <button class="btn grow" id="hp_save">💾 ذخیرهٔ دائمی پروفایل من</button>
                <button class="btn ghost sm" id="hp_share">🔗 اشتراک‌گذاری</button>
                <a class="btn line sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareTxt)}">واتس‌اپ</a>
              </div>
            </div>
          ` : `<p class="muted center" style="padding:12px 0">نام یا جیمیلت را بالا وارد کن تا پروفایل شخصی‌ات ساخته یا بازیابی شود.</p>`}
        </div>`;

      wrap.querySelector("#pm_close").onclick = () => { clearAuxMaps(); wrap.remove(); };
      wrap.onclick = (ev) => { if (ev.target === wrap) { clearAuxMaps(); wrap.remove(); } };

      wrap.querySelectorAll("[data-pmpick]").forEach(el => el.onclick = () => {
        const kp = KNOWN_PROFILES.find(x => x.name === el.dataset.pmpick);
        if (kp) {
          p = JSON.parse(JSON.stringify(kp));
          store.set("dh_last", { name: p.name, email: p.email || p.data?.email || "", data: p.data || {}, pub: p.public_fields || [], saved: true });
          if ($("#c_org") && !$("#c_org").value) $("#c_org").value = p.name;
          drawModal();
          const tb = $("#tb_prof_btn"); if (tb) tb.textContent = `👤 پروفایل ${p.name}`;
        }
      });

      wrap.querySelector("#pm_load_btn").onclick = async () => {
        const em = wrap.querySelector("#pm_email").value.trim().toLowerCase();
        const nm = wrap.querySelector("#pm_name").value.trim();
        if (!em && !nm) return toast("نام یا جیمیلت را وارد کن");
        let found = null;
        if (em) {
          found = KNOWN_PROFILES.find(x => (x.email || x.data?.email || "").toLowerCase() === em);
          if (!found) {
            try {
              const r = await fetch(`/api/d/profiles?email=${encodeURIComponent(em)}`);
              if (r.ok) { const j = await r.json(); if (j.profile) found = j.profile; }
            } catch(e){}
          }
        }
        if (!found && nm) {
          found = KNOWN_PROFILES.find(x => x.name.toLowerCase() === nm.toLowerCase());
        }
        if (found) {
          p = JSON.parse(JSON.stringify(found));
          p.data = p.data || {};
          if (em) { p.email = em; p.data.email = em; }
          if (nm) p.name = nm;
        } else {
          p = { name: nm || em.split("@")[0], email: em, data: { email: em, free_windows: [], can_cities: [], max_min: 45 }, public_fields: ["origin","can_cities","free_windows","activities","hobbies","email"] };
          KNOWN_PROFILES.push(p);
        }
        store.set("dh_last", { name: p.name, email: p.email || "", data: p.data || {}, pub: p.public_fields || [], saved: true });
        if ($("#c_org")) $("#c_org").value = p.name;
        const tb = $("#tb_prof_btn"); if (tb) tb.textContent = `👤 پروفایل ${p.name}${p.email?" ✓":""}`;
        drawModal();
        toast(`پروفایل ${p.name} فعال شد ✓`);
      };

      if (p) {
        p.data = p.data || {};
        wireWeekGrid(wrap, () => p.data.free_windows || [], (v) => { p.data.free_windows = v; }, "hpwin");
        clearAuxMaps();
        const helpers = wireLocationAndTimeControls(wrap, p.data, "pm_loc", "hp_map");
        const origSel = wrap.querySelector("#pm_origin_sel");
        if (origSel) origSel.onchange = () => {
          const c = cityByKey(origSel.value);
          if (c) {
            p.data.origin = { key: c.key, fa: c.fa, lat: c.lat, lng: c.lng };
          } else {
            delete p.data.origin;
          }
          helpers.refreshTags();
          const mEl = document.getElementById("hp_map");
          if (mEl && mEl._redrawMap) mEl._redrawMap();
        };
        const toggleHpCity = (k) => {
          const arr = p.data.can_cities || [];
          p.data.can_cities = arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];
          helpers.refreshTags();
          const mapEl = document.getElementById("hp_map");
          if (mapEl && mapEl._redrawMap) mapEl._redrawMap();
        };
        mountZoneMap("hp_map", p.data, { onToggleCity: (c) => toggleHpCity(c.key) });

        const lo = wrap.querySelector("#pm_logout");
        if (lo) lo.onclick = () => {
          try { localStorage.removeItem("dh_last"); } catch(e){}
          p = null;
          const tb = $("#tb_prof_btn"); if (tb) tb.textContent = `👤 پروفایل من / اتصال جیمیل`;
          drawModal();
        };

        const saveBtn = wrap.querySelector("#hp_save");
        if (saveBtn) saveBtn.onclick = async () => {
          const em = wrap.querySelector("#pm_email").value.trim().toLowerCase();
          const nm = wrap.querySelector("#pm_name").value.trim() || p.name;
          p.name = nm;
          if (em) { p.email = em; p.data.email = em; }
          saveBtn.disabled = true;
          try {
            await fetch("/api/d/profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: p.name, email: p.email || null, data: p.data, public_fields: p.public_fields || ["origin","can_cities","free_windows","activities","hobbies","email"] })
            });
            store.set("dh_last", { name: p.name, email: p.email || "", data: p.data || {}, pub: p.public_fields || [], saved: true });
            const tb = $("#tb_prof_btn"); if (tb) tb.textContent = `👤 پروفایل ${p.name}${p.email?" ✓":""}`;
            if ($("#c_org") && !$("#c_org").value) $("#c_org").value = p.name;
            toast("پروفایل و محدودهٔ حرکتت ذخیره شد ✓");
          } catch(e) { toast("ذخیره نشد"); }
          saveBtn.disabled = false;
        };
        const shareBtn = wrap.querySelector("#hp_share");
        if (shareBtn) shareBtn.onclick = async () => {
          try { await navigator.clipboard.writeText(shareTxt); toast("لینک پروفایل کپی شد ✓"); }
          catch(e) { toast(shareUrl); }
        };
      }
    };

    root.appendChild(wrap);
    drawModal();
  }

  // remember where to come back after login (middleware reads hamrah_next)
  function bindLoginLinks(){
    root.querySelectorAll("[data-login]").forEach(a => a.addEventListener("click", () => {
      const returnUrl = location.pathname + location.search;
      document.cookie = `hamrah_next=${returnUrl}; path=/; max-age=3600; samesite=lax`;
    }));
    const tbBtn = $("#tb_prof_btn");
    if (tbBtn) tbBtn.onclick = () => openProfileModal();
  }
  function memberCard(){
    if (USER) {
      if (M.plan_id) return `<div class="card"><h2>💬 گفتگوی گروه در همراه</h2><p class="muted">این دورهمی در «بریم بیرون» هم هست: گفتگو، رأی، یادآوری.</p><a class="btn block" href="/out/p/${esc(M.plan_id)}" data-ext="1">رفتن به گفتگو ←</a></div>`;
      if (M.has_plan) return `<div class="card"><h2>💬 گفتگوی گروه در همراه</h2><p class="muted">برگزارکننده برای این دورهمی گفتگوی گروهی ساخته.</p>${M.my_edit?`<button class="btn block" id="dh_join">پیوستن به گفتگو</button>`:`<p class="tiny">اول فرم را پر کن، بعد می‌توانی بپیوندی.</p>`}</div>`;
      if (ADMIN) return `<div class="card"><h2>💬 ادامه در همراه</h2><p class="muted">یک برنامهٔ «بریم بیرون» با گفتگوی گروهی می‌سازم. هر کس با حساب همراه فرم را پر کرده خودکار اضافه می‌شود؛ بقیه با همین لینک بعداً می‌پیوندند.</p><button class="btn block" id="dh_plan">ساخت گفتگوی گروه ✨</button></div>`;
      return "";
    }
    const hasDismissed = Boolean(store.get("dh_dismiss_auth_" + CODE));
    if (hasDismissed) {
      return `
        <div style="text-align:center;padding:10px 4px;margin-top:6px">
          <span class="tiny" style="color:var(--muted)">👤 تنظیماتت روی همین گوشی ذخیره است · </span>
          <a href="/login?next=${encodeURIComponent(location.pathname + location.search)}" class="tiny" style="color:var(--p);font-weight:700" data-ext="1" data-login="1">اتصال به حساب همراه</a>
        </div>
      `;
    }
    const my = store.get("dh_"+CODE) || {};
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return `
      <div class="card" id="post_rsvp_auth_box" style="background:linear-gradient(135deg, #fbfaff 0%, #f4f0fd 100%);border:1.5px solid #ded5f7;border-radius:14px;padding:14px 16px;margin:12px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:20px">📬</span>
          <b style="font-size:15px">دوست داری حسابت را ذخیره کنی؟</b>
          <span class="pill sm" style="background:#fff;color:var(--p)">اختیاری</span>
        </div>
        <p class="muted tiny" style="margin:0 0 12px;line-height:1.6">
          ${my.edit ? "پاسخ‌هایت ثبت شد! " : ""}اگر می‌خواهی حسابت ذخیره شود تا وقتی برنامه قطعی شد باخبر شوی و در گفتگوی گروه شرکت کنی، می‌توانی وارد شوی (اجباری نیست):
        </p>
        <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-start">
          <a href="/login?next=${returnUrl}" class="btn ghost sm" data-ext="1" data-login="1">🔐 ذخیره و ورود با ایمیل یا موبایل</a>
          <button type="button" class="btn line sm" id="post_rsvp_dismiss_btn">نه، فقط روی همین گوشی بماند</button>
        </div>
      </div>
    `;
  }
  function bindMember(){
    const pl = $("#dh_plan"); if (pl) pl.onclick = async () => {
      pl.disabled = true; pl.innerHTML = `<span class="spin"></span>`;
      try { const id = await rpc("dh_to_plan", {p_code:CODE, p_admin:ADMIN}); location.href = `/out/p/${id}`; }
      catch(e){ toast(errMsg(e)); pl.disabled = false; pl.textContent = "دوباره امتحان کن"; }
    };
    const jn = $("#dh_join"); if (jn) jn.onclick = async () => {
      jn.disabled = true;
      try { const id = await rpc("dh_join_plan", {p_code:CODE}); location.href = `/out/p/${id}`; }
      catch(e){ toast(errMsg(e)); jn.disabled = false; }
    };
    const rsvpDis = $("#post_rsvp_dismiss_btn");
    if (rsvpDis) {
      rsvpDis.onclick = () => {
        store.set("dh_dismiss_auth_" + CODE, 1);
        resultPage();
        toast("پاسخ‌هایت روی همین دستگاه ذخیره ماند ✓");
      };
    }
    bindLoginLinks();
  }

  /* ============ home / create ============ */
  async function homePage(){
    document.title = "دورهمی · همراه";
    const q = new URLSearchParams(location.search);
    const sharedUser = q.get("u");
    let mine = localItems();
    await loadKnownProfiles();
    if (USER) {
      try {
        const server = await rpc("dh_my_meetups", {}) || [];
        const seen = new Set(server.map(x => x.code));
        mine = [...server.map(x => ({code:x.code, title:x.title, organizer_name:x.organizer_name, admin:x.is_admin ? "account" : null, final:x.final, count:x.count})),
                ...mine.filter(x => !seen.has(x.code))];
      } catch(e){}
    }
    for (const rm of RECENT_MEETUPS) {
      const ex = mine.find(x => x.code === rm.code);
      if (!ex) mine.push({code: rm.code, title: rm.title, organizer_name: rm.organizer_name, count: rm.count, final: rm.final, expires_at: rm.expires_at, is_archived: rm.is_archived});
      else {
        if (rm.title) ex.title = rm.title;
        if (rm.organizer_name) ex.organizer_name = rm.organizer_name;
        if (rm.count != null) ex.count = rm.count;
        if (rm.final !== undefined) ex.final = rm.final;
        if (rm.expires_at !== undefined) ex.expires_at = rm.expires_at;
        if (rm.is_archived !== undefined) ex.is_archived = rm.is_archived;
      }
    }
    if (dead) return;

    const cached = store.get("dh_last");
    const myName = USER?.name || cached?.name || "";
    const myEmail = cached?.email || cached?.data?.email || "";
    const sharedProf = sharedUser ? KNOWN_PROFILES.find(p => p.name.toLowerCase() === sharedUser.trim().toLowerCase()) : null;

    app.innerHTML = topbar() + `
      <div class="card">
        <h1 id="home_hero_h1">✨ یک دورهمی بساز</h1>
        <p class="muted" id="home_hero_sub" style="margin-bottom:14px;font-size:13px">قراری که دوست داری را ثبت کن تا دوستانت زمان و مکانشان را هماهنگ کنند:</p>

        <div class="seg" style="margin-bottom:14px">
          <button type="button" id="mode_create_tab" class="on">✨ ساخت ایونت</button>
          <button type="button" id="mode_find_tab">🔍 پیدا کردن ایونت ${mine.length ? `<span class="badge" style="background:#e8e2fa;color:var(--p);padding:1px 7px;border-radius:10px;font-size:11.5px;margin-right:4px">${fa(mine.length)}</span>` : ""}</button>
        </div>

        <div id="create_pane">
          <div style="margin-bottom:14px">
            <label class="f" style="margin-top:2px;font-weight:700">موضوع یا ایدهٔ قرار چیه؟</label>
            <input type="text" id="c_title" list="c_idea_datalist" maxlength="80" placeholder="انتخاب کن یا خودت بنویس: کافه، دویدن، بردگیم…" style="font-size:15px;padding:10px 12px">
            <datalist id="c_idea_datalist">
              ${EVENT_IDEAS.map(idea => `<option value="${esc(idea.title)}">${esc(idea.label)}</option>`).join("")}
            </datalist>
            <div class="quick-ideas" id="c_idea_chips">
              ${EVENT_IDEAS.map(idea => `
                <span class="qidea" data-idea="${idea.k}">${idea.icon} ${esc(idea.label)}</span>
              `).join("")}
            </div>
          </div>

          <div style="margin-bottom:14px">
            <label class="f" style="margin-top:0">تعداد هم‌پایان</label>
            <div class="seg sm" style="margin:0;height:40px;display:flex;align-items:center">
              <button type="button" id="c_tgt_group" class="on" style="height:32px;display:flex;align-items:center;justify-content:center;white-space:nowrap">👥 گروهی</button>
              <button type="button" id="c_tgt_pair" style="height:32px;display:flex;align-items:center;justify-content:center;white-space:nowrap">👯‍♀️ دونفره (۱ به ۱)</button>
            </div>
          </div>

          <div style="margin-bottom:14px">
            <label class="f" style="margin-top:0">زمان‌بندی دورهمی</label>
            <div class="seg sm" style="margin:0">
              <button type="button" id="seg_open" class="on" style="white-space:nowrap">🙋‍♀️ زمان شناور</button>
              <button type="button" id="seg_fixed" style="white-space:nowrap">📅 تاریخ مشخص</button>
            </div>
            <div class="tiny" style="color:var(--muted);margin-top:4px" id="c_timing_hint">
              دوستان ساعت‌های آزادشان را می‌گویند تا سیستم بهترین زمان مشترک را پیدا کند.
            </div>
          </div>

          <div id="c_fixed_box" style="display:none;margin-bottom:14px;padding:12px;background:#f8f7fc;border:1px solid #e7e2f5;border-radius:14px">
            <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px">
              <b style="font-size:13px">📅 تاریخ و ساعت‌های انتخابی:</b>
              <span class="tiny">می‌توانی چند گزینه بدهی</span>
            </div>
            <div id="c_opts"></div>
            <button class="btn ghost sm" id="c_add" style="margin-top:4px">+ یک تاریخ دیگر</button>
          </div>

          <div style="margin-bottom:14px">
            <label class="f" style="margin-top:0">📍 مکان یا محدودهٔ پیشنهادی</label>
            <div class="seg sm" style="margin:0">
              <button type="button" id="loc_flex" class="on" style="white-space:nowrap">🗺️ پیشنهاد جمع</button>
              <button type="button" id="loc_area" style="white-space:nowrap">📍 محدوده / شهر</button>
              <button type="button" id="loc_exact" style="white-space:nowrap">🏠 مکان مشخص</button>
            </div>
            <div class="tiny" style="color:var(--muted);margin-top:4px" id="c_loc_hint">
              هر کس شهرش را می‌گوید تا منصفانه‌ترین مکان وسط برای همه پیدا شود.
            </div>
          </div>

          <div id="c_loc_box" style="display:none;margin-bottom:14px;padding:12px;background:#f8f7fc;border:1px solid #e7e2f5;border-radius:14px">
            <div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:130px">
                <label class="f" style="margin-top:0;font-size:13px">شهر</label>
                <select id="c_loc_city">
                  <option value="">انتخاب شهر (اختیاری)…</option>
                  ${CITIES.map(c => `<option value="${c.key}">${esc(c.fa)}</option>`).join("")}
                </select>
              </div>
              <div id="c_loc_rad_wrap" style="flex:1;min-width:130px">
                <label class="f" style="margin-top:0;font-size:13px">شعاع محدوده</label>
                <select id="c_loc_rad">
                  <option value="5">تا ۵ کیلومتر (محله)</option>
                  <option value="10" selected>تا ۱۰ کیلومتر (داخل شهر)</option>
                  <option value="20">تا ۲۰ کیلومتر (اطراف شهر)</option>
                  <option value="40">تا ۴۰ کیلومتر (منطقه‌ای)</option>
                </select>
              </div>
            </div>
            <label class="f" style="margin-top:0;font-size:13px" id="c_loc_place_lbl">محله یا محدودهٔ دلخواه (اختیاری)</label>
            <input type="text" id="c_loc_place" maxlength="140" placeholder="مثلاً: اطراف ایستگاه مرکزی، نزدیک پارک، مرکز شهر…">
          </div>

          <div style="margin-bottom:14px">
            <label class="f" style="margin-top:0">👁️ چه کسانی این ایونت را ببینند؟</label>
            <div class="seg sm" style="margin:0">
              <button type="button" id="vis_public" class="on" style="white-space:nowrap">🌍 عمومی</button>
              <button type="button" id="vis_nearby" style="white-space:nowrap">📍 اطراف من</button>
              <button type="button" id="vis_private" style="white-space:nowrap">🔒 لینک خصوصی</button>
            </div>
            <div class="tiny" style="color:var(--muted);margin-top:4px;margin-bottom:8px" id="c_vis_hint">
              همه در لیست ایونت‌ها می‌بینند و می‌توانند اعلام حضور کنند.
            </div>
            <div class="chips" id="c_aud_chips" style="gap:6px">
              <span class="chip sm" data-smoke="no_smoke">🚭 بدون سیگار</span>
              <span class="chip sm" data-smoke="ok">🚬 سیگار اوکیم</span>
              <span class="chip sm" data-alc="no_alcohol">🥤 بدون الکل</span>
              <span class="chip sm" data-alc="ok">🍷 الکل اوکیم</span>
              <span class="chip sm" id="c_wo_chip">👩 فقط خانم‌ها</span>
            </div>
          </div>

          <details style="margin-bottom:14px;background:#faf9fe;border-radius:12px;border:1.5px dashed #ded7f2;padding:9px 12px">
            <summary style="cursor:pointer;color:var(--p);font-size:13px;font-weight:700;user-select:none;list-style:none;display:flex;align-items:center;justify-content:space-between">
              <span>⚙️ تنظیمات بیشتر (توضیح، تاریخ انقضا، نام برگزارکننده)</span>
              <span style="font-size:11px;opacity:0.7">▼</span>
            </summary>
            <div style="margin-top:10px;padding-top:8px;border-top:1px solid #eeeaf8">
              <label class="f" style="margin-top:0">توضیح کوتاه (اختیاری)</label>
              <input type="text" id="c_note" maxlength="300" placeholder="مثلاً: صبح‌ها قبل از کار در پارک…" style="margin-bottom:8px">
              <label class="f">⏰ تاریخ انقضا یا مهلت ایونت (اختیاری)</label>
              <input type="date" id="c_expires" style="margin-bottom:4px">
              <span class="tiny" id="c_expires_lbl" style="color:var(--p);font-weight:600;display:block;margin-bottom:4px"></span>
              <span class="tiny" style="color:var(--muted);display:block;margin-bottom:10px">بعد از این تاریخ، ایونت خودکار از دید عموم برداشته می‌شود.</span>
              <label class="f">نام نمایشی برگزارکننده (اختیاری)</label>
              <input type="text" id="c_org" maxlength="40" placeholder="مثلاً مریم" value="${esc(myName)}">
            </div>
          </details>

          <div id="c_err"></div>
          <div style="margin-top:14px">
            <button class="btn block" id="c_go_open" style="font-size:15px;padding:12px 16px;font-weight:800">🚀 ساخت قرار و دریافت لینک اشتراک ✨</button>
          </div>
        </div>

        <div id="find_pane" style="display:none">
          <div style="background:#f8f6ff;border:1.5px solid #e1daf7;border-radius:14px;padding:12px 14px;margin-bottom:14px">
            <label class="f" style="margin-top:0">🔑 ورود مستقیم با کد یا لینک دورهمی:</label>
            <div class="row" style="gap:8px;margin-top:6px;flex-wrap:nowrap">
              <input type="text" id="join_code_inp" class="code-inp" placeholder="کد یا لینک مثلاً 096be90f" style="flex:1;min-width:0">
              <button type="button" class="btn sm" id="join_code_go" style="white-space:nowrap;flex:none;min-height:44px">ورود ←</button>
            </div>
            <p class="tiny" style="margin-top:6px;margin-bottom:0">کد یا لینکی که از دوستت گرفتی را وارد کن تا ساعت‌ها و شهرهایت را بفرستی.</p>
          </div>

          <div>
            <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:4px">
              <h2 style="margin:0;font-size:16px">🌿 ایونت‌ها و قرارهای دوستان</h2>
              <span class="tiny">${fa(mine.length)} قرار فعال</span>
            </div>
            ${mine.length ? `<p class="muted tiny" style="margin-top:2px;margin-bottom:8px">روی هر ایونت بزن تا ساعت‌های آزاد و شهرهایت را بفرستی؛ سیستم بهترین زمان و شهر مشترک را پیدا می‌کند:</p>` : ""}

            ${mine.length ? `
              <div class="chips" id="meetups_filter_bar" style="gap:5px;margin:6px 0 10px">
                <span class="chip sm on" data-mfilter="all">همه (${fa(mine.length)})</span>
                <span class="chip sm" data-mfilter="cafe">☕ کافه و غذا</span>
                <span class="chip sm" data-mfilter="sport">🏃‍♀️ ورزش و دویدن</span>
                <span class="chip sm" data-mfilter="game">🎲 بازی و مافیا</span>
                <span class="chip sm" data-mfilter="walk">🌳 پیاده‌روی و پارک</span>
              </div>
              <div id="meetups_list_container">
                ${mine.map(m => {
              const cnt = m.count != null ? `${fa(m.count)} نفر اعلام آمادگی کرده‌اند` : "مشاهده و ثبت ترجیحات";
              const icon = detectActivityIcon(m.title);
              const isPair = detectTargetType(m.title, m.note) === "pair";
              const isArchived = Boolean(m.is_archived || m.final?.archived);
              const expDate = m.expires_at || m.final?.expires_at;
              const isExpired = Boolean(m.is_expired || isDateExpired(expDate));
              const locSummary = fmtLocation(m.location || m.final?.location, true);
              let cat = "other";
              if (["☕","🍽️"].includes(icon)) cat = "cafe";
              else if (["🏃‍♀️","🏸","🚴"].includes(icon)) cat = "sport";
              else if (["🎲"].includes(icon)) cat = "game";
              else if (["🌳","🧺"].includes(icon)) cat = "walk";
              return `
              <a class="meetup-item" data-mcat="${cat}" href="/d/${esc(m.code)}${m.admin && m.admin !== "account"?`?admin=${esc(m.admin)}`:""}">
                <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:200px">
                  <div class="av-sm" style="background:${colorOf(m.organizer_name||'د')};width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;flex:none">${icon}</div>
                  <div>
                    <div class="row" style="gap:6px;margin-bottom:3px;flex-wrap:wrap;align-items:center">
                      <b style="font-size:15px">${esc(m.title || (m.organizer_name ? "دورهمی " + m.organizer_name : "قرار دورهمی"))}</b>
                      <code class="tiny ltr" style="background:#eeeaf8;padding:1px 6px;border-radius:6px;color:var(--p)">#${esc(m.code)}</code>
                      <span class="pill sm" style="background:${isPair?"#fff0f6":"#f0f5ff"};color:${isPair?"#d63384":"#0d6efd"}">${isPair ? "👯‍♀️ دونفره" : "👥 گروهی"}</span>
                      ${locSummary ? `<span class="pill sm" style="background:#eefbf6;color:#0e5f4d">${esc(locSummary)}</span>` : ''}
                      ${isArchived ? '<span class="pill sm" style="background:#fff3d4;color:#8a5a00">📦 آرشیو</span>' : ''}
                      ${isExpired ? '<span class="pill sm" style="background:#ffe3e3;color:#c92a2a">⏰ منقضی</span>' : ''}
                    </div>
                    <div class="tiny">👤 برگزارکننده: <b>${esc(m.organizer_name || "دوستان")}</b> · 👥 ${cnt}${expDate && !isExpired && !isArchived ? ` · ⏰ تا ${fmtDate(expDate)}` : ''}</div>
                  </div>
                </div>
                <div class="row" style="gap:4px">
                  ${isFinalized(m.final)?'<span class="pill g">قطعی</span>':""}
                  ${m.admin?'<span class="pill">مدیریت ⚙️</span>':'<span class="pill" style="font-weight:700">منم می‌تونم بیام 🙋‍♀️</span>'}
                </div>
              </a>`;
            }).join("")}
              </div>
            ` : `
              <div style="text-align:center;padding:24px 16px;background:#f9f9fc;border-radius:14px;color:var(--muted);margin-top:8px">
                <div style="font-size:28px;margin-bottom:6px">🌿</div>
                <p class="tiny" style="margin:0 0 12px;font-size:13.5px">هنوز ایونتی ثبت نشده است. اولین قرار را خودت بساز!</p>
                <button type="button" class="btn ghost sm" id="empty_go_create">✨ ساخت اولین قرار ←</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
    bindLoginLinks();
    if (sharedProf) openProfileModal(sharedProf);

    const tabCreate = $("#mode_create_tab");
    const tabFind = $("#mode_find_tab") || $("#mode_join_tab");
    function switchHomeTab(toFind: boolean) {
      if (toFind) {
        tabFind?.classList.add("on");
        tabCreate?.classList.remove("on");
        if ($("#create_pane")) $("#create_pane").style.display = "none";
        if ($("#find_pane")) $("#find_pane").style.display = "block";
        if ($("#home_hero_h1")) $("#home_hero_h1").textContent = "🔍 پیدا کردن ایونت";
        if ($("#home_hero_sub")) $("#home_hero_sub").textContent = "کد دورهمی را وارد کن یا از بین قرارهای فعال دوستان انتخاب کن:";
      } else {
        tabCreate?.classList.add("on");
        tabFind?.classList.remove("on");
        if ($("#create_pane")) $("#create_pane").style.display = "block";
        if ($("#find_pane")) $("#find_pane").style.display = "none";
        if ($("#home_hero_h1")) $("#home_hero_h1").textContent = "✨ یک دورهمی بساز";
        if ($("#home_hero_sub")) $("#home_hero_sub").textContent = "قراری که دوست داری را ثبت کن تا دوستانت زمان و مکانشان را هماهنگ کنند:";
      }
    }
    if (tabCreate && tabFind) {
      tabCreate.onclick = () => switchHomeTab(false);
      tabFind.onclick = () => {
        switchHomeTab(true);
        $("#join_code_inp")?.focus();
      };
    }
    if ($("#empty_go_create")) $("#empty_go_create").onclick = () => switchHomeTab(false);
    if ($("#c_expires")) {
      $("#c_expires").oninput = (e) => {
        const v = e.target.value;
        if ($("#c_expires_lbl")) $("#c_expires_lbl").textContent = v ? `📅 ${fmtDate(v)}` : "";
      };
    }
    if (location.hash === "#find" || location.hash === "#join" || q.get("tab") === "find" || q.get("tab") === "join") {
      switchHomeTab(true);
    }
    const goJoinCode = () => {
      let raw = ($("#join_code_inp")?.value || "").trim();
      if (!raw) return toast("کد دورهمی را بنویس");
      // If user pasted a full URL like https://.../d/096be90f6c, extract the code
      const m = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const code = (m ? m[1] : raw.replace(/^#/, "")).trim().toLowerCase();
      if (!code) return toast("کد معتبر نیست");
      go(`/d/${code}`);
    };
    if ($("#join_code_go")) $("#join_code_go").onclick = goJoinCode;
    if ($("#join_code_inp")) $("#join_code_inp").onkeydown = (ev) => { if (ev.key === "Enter") goJoinCode(); };

    // remembered answers can be forgotten any time
    const hasLast = USER ? !!(PREFILL && PREFILL.saved) : !!store.get("dh_last");
    if (hasLast) {
      const box = document.createElement("div");
      box.style.cssText = "text-align:center;padding:10px 4px;margin-top:12px;";
      box.innerHTML = `
        <div style="font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;background:#f5f3fc;padding:6px 14px;border-radius:20px;border:1px solid #e7e2f5">
          <span>🧠 تنظیماتت روی گوشی ذخیره است</span> · 
          <button type="button" id="dh_forget" style="background:none;border:none;color:var(--p);cursor:pointer;font-weight:700;font-size:12px;padding:0;text-decoration:underline">پاک کردن حافظه</button>
        </div>
      `;
      app.appendChild(box);
      $("#dh_forget").onclick = async () => {
        if (!confirm("جواب‌های ذخیره‌شده پاک شود؟ جواب‌هایی که در دورهمی‌ها داده‌ای سر جایشان می‌مانند.")) return;
        try {
          if (USER) { const { error } = await sb.from("dh_member_prefs").delete().eq("user_id", USER.id); if (error) throw error; if (PREFILL) { PREFILL.saved = false; PREFILL.data = {}; } }
          try { localStorage.removeItem("dh_last"); } catch(e){}
          box.remove(); toast("پاک شد");
        } catch(e){ toast(errMsg(e)); }
      };
    }
    let openSchedule = true;
    const opts = [];
    const addOpt = (d="", t="15:00") => { opts.push({d,t}); drawOpts(); };
    function drawOpts(){
      $("#c_opts").innerHTML = opts.map((o,i)=>`
        <div class="row" style="margin-bottom:8px;flex-wrap:nowrap;gap:6px">
          <input type="date" data-i="${i}" data-k="d" value="${esc(o.d)}" style="flex:1.3;min-width:0;padding:9px 8px">
          <input type="time" data-i="${i}" data-k="t" value="${esc(o.t)}" style="flex:1;min-width:0;padding:9px 8px">
          ${opts.length>1?`<button class="btn line sm" data-del="${i}" aria-label="حذف" style="flex:none;padding:6px 10px">✕</button>`:""}
        </div>`).join("");
      $("#c_opts").querySelectorAll("input").forEach(inp => inp.oninput = () => opts[inp.dataset.i][inp.dataset.k] = inp.value);
      $("#c_opts").querySelectorAll("[data-del]").forEach(b => b.onclick = () => { opts.splice(+b.dataset.del,1); drawOpts(); });
    }
    // default: next two weekend days
    const now = new Date(); const sat = new Date(now); sat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    const iso = d => d.toISOString().slice(0,10);
    const sun = new Date(sat); sun.setDate(sat.getDate()+1);
    addOpt(iso(sat), "15:00"); addOpt(iso(sun), "14:00");
    $("#c_add").onclick = () => addOpt("", "15:00");
    const setSegMode = (isOpen) => {
      openSchedule = isOpen;
      $("#seg_open")?.classList.toggle("on", isOpen);
      $("#seg_fixed")?.classList.toggle("on", !isOpen);
      if ($("#c_timing_hint")) {
        $("#c_timing_hint").textContent = isOpen
          ? "دوستان ساعت‌های آزادشان را می‌گویند تا سیستم بهترین زمان مشترک را پیدا کند."
          : "تاریخ و ساعت‌های مشخصی که پیشنهاد داری را تعیین کن تا دوستان رأی دهند.";
      }
      if ($("#c_open_note")) $("#c_open_note").style.display = isOpen ? "block" : "none";
      if ($("#c_fixed_box")) $("#c_fixed_box").style.display = isOpen ? "none" : "block";
      updateTargetUI(currentTarget);
    };
    if ($("#seg_open")) $("#seg_open").onclick = () => setSegMode(true);
    if ($("#seg_fixed")) $("#seg_fixed").onclick = () => setSegMode(false);

    let locMode = "flexible";
    const setLocMode = (mode) => {
      locMode = mode;
      $("#loc_flex")?.classList.toggle("on", mode === "flexible");
      $("#loc_area")?.classList.toggle("on", mode === "area");
      $("#loc_exact")?.classList.toggle("on", mode === "exact");
      if ($("#c_loc_hint")) {
        $("#c_loc_hint").textContent = mode === "flexible"
          ? "هر کس شهرش را می‌گوید تا منصفانه‌ترین مکان وسط برای همه پیدا شود."
          : mode === "area"
            ? "یک شهر یا محدوده پیشنهاد بده تا در همان اطراف جای مناسب پیدا کنید."
            : "اگر کافه، پارک یا آدرس خاصی مدنظرت هست همین‌جا بنویس.";
      }
      if ($("#c_loc_box")) $("#c_loc_box").style.display = mode === "flexible" ? "none" : "block";
      if ($("#c_loc_rad_wrap")) $("#c_loc_rad_wrap").style.display = mode === "area" ? "block" : "none";
      if ($("#c_loc_place_lbl")) {
        $("#c_loc_place_lbl").textContent = mode === "exact" ? "اسم مکان یا آدرس پیشنهادی" : "محله یا محدودهٔ دلخواه (اختیاری)";
      }
      if ($("#c_loc_place")) {
        $("#c_loc_place").placeholder = mode === "exact"
          ? "مثلاً: کافه بهار، پارک کرالینگسه بوس، یا آدرس دقیق…"
          : "مثلاً: اطراف ایستگاه مرکزی، نزدیک پارک، مرکز شهر…";
      }
    };
    if ($("#loc_flex")) $("#loc_flex").onclick = () => setLocMode("flexible");
    if ($("#loc_area")) $("#loc_area").onclick = () => setLocMode("area");
    if ($("#loc_exact")) $("#loc_exact").onclick = () => setLocMode("exact");

    let visMode = "public";
    let smokePref = "any";
    let alcPref = "any";
    const setVisMode = (mode) => {
      visMode = mode;
      $("#vis_public")?.classList.toggle("on", mode === "public");
      $("#vis_nearby")?.classList.toggle("on", mode === "nearby");
      $("#vis_private")?.classList.toggle("on", mode === "private");
      if ($("#c_vis_hint")) {
        $("#c_vis_hint").textContent = mode === "public"
          ? "همه در لیست ایونت‌ها می‌بینند و می‌توانند اعلام حضور کنند."
          : mode === "nearby"
            ? "به کاربرانی که دور و بر همین شهر/محدوده هستند نمایش داده می‌شود."
            : "در لیست عمومی نشان داده نمی‌شود؛ فقط کسانی که لینک یا کد را برایشان بفرستی می‌بینند.";
      }
    };
    if ($("#vis_public")) $("#vis_public").onclick = () => setVisMode("public");
    if ($("#vis_nearby")) $("#vis_nearby").onclick = () => setVisMode("nearby");
    if ($("#vis_private")) $("#vis_private").onclick = () => setVisMode("private");

    $("#c_aud_chips")?.querySelectorAll("[data-smoke]").forEach(el => {
      el.onclick = () => {
        const v = el.dataset.smoke;
        smokePref = smokePref === v ? "any" : v;
        $("#c_aud_chips").querySelectorAll("[data-smoke]").forEach(x => x.classList.toggle("on", x.dataset.smoke === smokePref));
      };
    });
    $("#c_aud_chips")?.querySelectorAll("[data-alc]").forEach(el => {
      el.onclick = () => {
        const v = el.dataset.alc;
        alcPref = alcPref === v ? "any" : v;
        $("#c_aud_chips").querySelectorAll("[data-alc]").forEach(x => x.classList.toggle("on", x.dataset.alc === alcPref));
      };
    });

    let wo = false;
    if ($("#c_wo_chip")) $("#c_wo_chip").onclick = e => { wo = !wo; e.currentTarget.classList.toggle("on", wo); };

    let currentTarget = "group";
    const updateTargetUI = (tgt) => {
      currentTarget = tgt;
      $("#c_tgt_group")?.classList.toggle("on", tgt === "group");
      $("#c_tgt_pair")?.classList.toggle("on", tgt === "pair");
      const btnOpen = $("#c_go_open");
      if (btnOpen) {
        if (!openSchedule) {
          btnOpen.textContent = tgt === "pair" ? "👯‍♀️ ثبت قرار دو‌نفره با این تاریخ‌ها ✨" : "📅 ساخت دورهمی با این تاریخ‌ها ✨";
        } else {
          btnOpen.textContent = tgt === "pair" ? "👯‍♀️ ساخت قرار همراهی و دریافت لینک ✨" : "🚀 ساخت قرار و دریافت لینک اشتراک ✨";
        }
      }
    };
    if ($("#c_tgt_group")) $("#c_tgt_group").onclick = () => updateTargetUI("group");
    if ($("#c_tgt_pair")) $("#c_tgt_pair").onclick = () => updateTargetUI("pair");

    $("#c_idea_chips")?.querySelectorAll("[data-idea]").forEach(el => {
      el.onclick = () => {
        $("#c_idea_chips").querySelectorAll("[data-idea]").forEach(x => x.classList.remove("on"));
        el.classList.add("on");
        const key = el.dataset.idea;
        const idea = EVENT_IDEAS.find(x => x.k === key);
        if (idea) {
          if ($("#c_title")) $("#c_title").value = idea.title;
          if ($("#c_note") && (!$("#c_note").value || EVENT_IDEAS.some(x => x.note === $("#c_note").value))) {
            $("#c_note").value = idea.note;
          }
          if (idea.target) updateTargetUI(idea.target);
        }
      };
    });

    $("#c_time_chips")?.querySelectorAll("[data-ctime]").forEach(tc => {
      tc.onclick = () => {
        $("#c_time_chips").querySelectorAll("[data-ctime]").forEach(x => x.classList.remove("on"));
        tc.classList.add("on");
        const val = tc.dataset.ctime;
        const noteEl = $("#c_note");
        if (noteEl) {
          const cur = (noteEl.value || "").replace(/\s*\(زمان پیشنهادی:.*?\)/g, "").trim();
          noteEl.value = `${cur ? cur + " · " : ""}(زمان پیشنهادی: ${val})`.trim();
        }
      };
    });

    $("#meetups_filter_bar")?.querySelectorAll("[data-mfilter]").forEach(b => {
      b.onclick = () => {
        $("#meetups_filter_bar").querySelectorAll("[data-mfilter]").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        const f = b.dataset.mfilter;
        $("#meetups_list_container")?.querySelectorAll(".meetup-item").forEach(item => {
          const match = f === "all" || item.dataset.mcat === f;
          item.style.display = match ? "flex" : "none";
        });
      };
    });

    async function createMeetup(forceOpen?: boolean) {
      const isOpen = forceOpen !== undefined ? forceOpen : openSchedule;
      const orgName = $("#c_org").value.trim();
      const rawTitle = $("#c_title").value.trim();
      const defaultTitle = currentTarget === "pair"
        ? (orgName ? `قرار همراهی ${orgName} 👯‍♀️` : (isOpen ? "همراه برای بیرون رفتن 👯‍♀️" : "قرار همراهی 👯‍♀️"))
        : (orgName ? `دورهمی ${orgName} ✨` : (isOpen ? "بریم بیرون؟ ✨" : "دورهمی ✨"));
      const title = rawTitle || defaultTitle;
      const good = isOpen ? [] : opts.filter(o => o.d).slice(0,10);
      if (!isOpen && !good.length) { $("#c_err").innerHTML = `<div class="err">حداقل یک روز انتخاب کن (یا گزینهٔ «زمان شناور» را بزن).</div>`; return; }
      const b = $("#c_go_open"); b.disabled = true; b.innerHTML = `<span class="spin"></span>`;
      let note = ($("#c_note")?.value || "").trim();
      if (currentTarget === "pair" && !note.includes("همراه دو‌نفره")) {
        note = `[همراه دو‌نفره] ${note}`.trim();
      }
      try {
        const expDate = $("#c_expires")?.value || null;
        let locPayload = null;
        if (locMode !== "flexible") {
          const cityKey = $("#c_loc_city")?.value || "";
          const cityObj = cityKey ? cityByKey(cityKey) : null;
          const placeVal = ($("#c_loc_place")?.value || "").trim();
          const radVal = locMode === "area" ? Number($("#c_loc_rad")?.value || 10) : undefined;
          if (cityKey || placeVal) {
            locPayload = {
              mode: locMode,
              city: cityKey,
              city_label: cityObj ? cityObj.fa : "",
              radius_km: radVal,
              place: placeVal,
            };
          }
        }
        const audPayload = (visMode !== "public" || smokePref !== "any" || alcPref !== "any")
          ? { visibility: visMode, smoke: smokePref, alcohol: alcPref }
          : null;
        const r = await rpc("dh_create", {p_title:title, p_note:note, p_organizer:orgName, p_options:good, p_women_only:wo});
        if (expDate || locPayload || audPayload) {
          try {
            const editBody: any = { code: r.code, admin_token: r.admin_token, action: "edit" };
            if (expDate) editBody.expires_at = expDate;
            if (locPayload) editBody.location = locPayload;
            if (audPayload) editBody.audience = audPayload;
            await fetch("/api/d/manage", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(editBody)
            });
          } catch(e){}
        }
        store.set("dh_"+r.code, {title, organizer_name: orgName, admin:r.admin_token, location: locPayload, audience: audPayload});
        profilesLoaded = false;
        go(`/d/${r.code}?admin=${r.admin_token}&new=1`);
      } catch(e){
        $("#c_err").innerHTML = `<div class="err">${esc(errMsg(e))}</div>`;
        b.disabled=false;
        updateTargetUI(currentTarget);
      }
    }
    $("#c_go_open").onclick = () => createMeetup(openSchedule);
  }

  /* ============ meetup page ============ */
  let M = null, CODE = null, ADMIN = null, TAB = "result", MAP = null;
  async function meetupPage(code, q){
    CODE = code; ADMIN = q.get("admin") || (store.get("dh_"+code)||{}).admin || null;
    app.innerHTML = `<div class="center" style="padding:60px 0"><span class="spin"></span></div>`;
    try { M = await rpc("dh_get", {p_code:code, p_admin:ADMIN}); }
    catch(e){ app.innerHTML = `<div class="card"><div class="err">${esc(errMsg(e))}</div><a class="btn" href="/d">صفحهٔ اول</a></div>`; return; }
    if (!M) {
      try { localStorage.removeItem("dh_"+code); } catch(e){}
      profilesLoaded = false;
      app.innerHTML = `<div class="card"><h2>این لینک پیدا نشد 😕</h2><p class="muted">شاید برگزارکننده پاکش کرده باشد.</p><a class="btn" href="/d">یک دورهمی تازه بساز</a></div>`;
      return;
    }
    const s = store.get("dh_"+code) || {};
    if (M.is_admin && M.admin_token) ADMIN = M.admin_token;
    if (M.my_edit) s.edit = M.my_edit;                // signed in: my answer follows me across devices
    store.set("dh_"+code, {...s, title:M.title, admin: M.is_admin ? ADMIN : s.admin});
    if (!M.is_admin) ADMIN = null;
    if (q.get("new")) return createdPage();
    const edit = s.edit;
    if ((!edit && !q.get("tab")) || q.get("form")) return formPage(edit);
    TAB = q.get("tab") || TAB;
    resultPage();
  }

  function shareText(){
    const locTxt = fmtLocation(M.final?.location);
    return `سلام 🌿 برای «${M.title}» (کد دورهمی: ${M.code})${locTxt ? `\n${locTxt}` : ""}\nاین لینک را باز کنید و بگویید چه ساعت‌هایی و تا چه محدوده‌ای روی نقشه می‌توانید بیایید:\n${linkFor(M.code)}`;
  }
  function shareButtons(){
    return `
      <div style="background:#f7f5ff;border:1.5px dashed #d5cbf5;border-radius:12px;padding:8px 12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <span class="tiny">🔑 کد ورود به این دورهمی:</span>
        <div class="row" style="gap:6px">
          <code style="font-size:16px;font-weight:800;color:var(--p);letter-spacing:1px">${esc(M.code)}</code>
          <button type="button" class="btn ghost sm" id="cp_code">کپی کد</button>
        </div>
      </div>
      <div class="copybox"><code>${esc(linkFor(M.code))}</code><button class="btn sm" id="cp">کپی لینک</button></div>
      <div class="row" style="margin-top:10px">
        <a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">واتس‌اپ</a>
        <a class="btn ghost grow" style="background:#e8f4fd;color:#0088cc" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkFor(M.code))}&text=${encodeURIComponent(shareText().split("\n")[0])}">تلگرام</a>
        ${navigator.share?`<button class="btn line grow" id="nshare">بیشتر…</button>`:""}
      </div>`;
  }
  function bindShare(){
    const cpc = $("#cp_code"); if (cpc) cpc.onclick = async () => { try { await navigator.clipboard.writeText(M.code); toast("کد دورهمی کپی شد ✓"); } catch(e){} };
    const cp = $("#cp"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(shareText()); toast("متن و لینک کپی شد ✓"); } catch(e){ toast("کپی نشد؛ لینک را دستی انتخاب کن"); } };
    const ns = $("#nshare"); if (ns) ns.onclick = () => navigator.share({title:M.title, text:shareText()}).catch(()=>{});
  }
  function createdPage(){
    const adminLink = `${linkFor(M.code)}?admin=${ADMIN}`;
    const isArchived = Boolean(M.is_archived || M.final?.archived);
    const expDate = M.expires_at || M.final?.expires_at;
    const isExpired = Boolean(M.is_expired || isDateExpired(expDate));
    const locLine = fmtLocation(M.final?.location);
    const audBadges = fmtAudience(M.final?.audience, Boolean(M.women_only));
    app.innerHTML = topbar() + `
      <header class="top"><span class="logo">${detectActivityIcon(M.title)}</span><div><b>${esc(M.title)}</b><small>ساخته شد · کد: <span class="ltr">#${esc(M.code)}</span></small></div></header>
      ${isArchived ? `<div class="okbox" style="margin:8px 0;background:#fff8e6;border-color:#f6d899;color:#8a5a00">📦 <b>این دورهمی آرشیو شده است</b> (فقط برای افراد دارای لینک قابل مشاهده است).</div>` : ""}
      ${isExpired ? `<div class="okbox" style="margin:8px 0;background:#fff0f0;border-color:#ffd0d0;color:#c92a2a">⏰ <b>مهلت یا تاریخ انقضای این دورهمی به پایان رسیده است.</b></div>` : (expDate ? `<div class="tiny" style="color:var(--muted);margin-bottom:6px">⏰ مهلت اعلام حضور تا: <b>${fmtDate(expDate)}</b></div>` : "")}
      ${locLine ? `<div class="okbox" style="margin:8px 0;background:#eefbf6;border-color:#b7ebd6;color:#0e5f4d">${esc(locLine)}</div>` : ""}
      ${audBadges.length ? `<div class="row" style="gap:6px;margin:6px 0 8px">${audBadges.map(b => `<span class="pill sm" style="background:#f3f0ff;color:var(--p)">${esc(b)}</span>`).join("")}</div>` : ""}
      <div class="card"><div class="row" style="gap:10px;margin-bottom:6px"><span class="hero-e" style="font-size:34px">🎉</span><h1 style="margin:0">آماده است!</h1></div>
        <p>کد یا لینک زیر را برای دوستانت بفرست تا ساعت‌ها و محدودهٔ مکانشان را روی نقشه بزنند:</p>${shareButtons()}</div>
      <div class="card"><h2>🔑 لینک مخصوص خودت (برگزارکننده)</h2>
        <p class="muted">با این لینک می‌توانی آخر کار روز و جا را «قطعی» کنی یا ایونت را ویرایش و پاک کنی. این را در گروه نفرست؛ برای خودت نگه دار (مثلاً در <bdi dir="ltr">Saved messages</bdi>).${USER?" چون وارد همراه شده‌ای، از «بریم بیرون» هم همیشه به آن دسترسی داری.":""}</p>
        <div class="copybox"><code>${esc(adminLink)}</code><button class="btn sm ghost" id="cpa">کپی</button></div></div>
      
      ${!USER ? `
      <div class="card" id="post_create_auth_box" style="background:linear-gradient(135deg, #fbfaff 0%, #f4f0fd 100%);border:1.5px solid #ded5f7;border-radius:14px;padding:14px 16px;margin:12px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:20px">🔐</span>
          <b style="font-size:15px">دوست داری این ایونت روی حسابت ذخیره بشه؟</b>
          <span class="pill sm" style="background:#fff;color:var(--p)">اختیاری</span>
        </div>
        <p class="muted tiny" style="margin:0 0 12px;line-height:1.6">
          ایونتت ساخته شد! اگر می‌خواهی در هر گوشی یا سیستمی به آن دسترسی داشته باشی و وقتی دوستانت اعلام حضور کردند باخبر شوی، می‌توانی حسابت را ثبت کنی (اجباری نیست):
        </p>
        <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-start">
          <a href="/login?next=${encodeURIComponent(`/d/${M.code}?admin=${ADMIN}`)}" class="btn ghost sm" data-ext="1" data-login="1">✨ ذخیره با ایمیل یا شماره موبایل</a>
          <button type="button" class="btn line sm" id="post_create_dismiss_btn">فعلاً مهمان می‌مانم</button>
        </div>
      </div>` : ""}

      <a class="btn block" href="/d/${M.code}?admin=${ADMIN}&form=1">حالا فرم خودم را پر کنم ←</a>`;
    bindLoginLinks();
    bindShare();
    $("#cpa").onclick = async () => { try { await navigator.clipboard.writeText(adminLink); toast("لینک برگزارکننده کپی شد ✓"); } catch(e){} };
    const disBtn = $("#post_create_dismiss_btn");
    if (disBtn) {
      disBtn.onclick = () => {
        $("#post_create_auth_box")?.remove();
        toast("به عنوان مهمان ادامه می‌دهی ✓");
      };
    }
  }

  /* ============ the form (wizard) ============ */
  async function formPage(edit){
    await loadKnownProfiles();
    let D = {}, PUB = new Set(["about","hobbies","activities","langs","question","origin","modes","avail"]), NAME = "";
    if (edit){
      try { const mine = await rpc("dh_mine", {p_code:CODE, p_edit:edit}); if (mine){ D = mine.data||{}; PUB = new Set(mine.public_fields||[]); NAME = mine.name; } } catch(e){}
    }
    // Remembered answers: a member's saved answers (server) or, for guests, this browser's last answers.
    // With them the form opens in quick mode: name → days → review; every section stays one tap away.
    let prefilled = false, quick = false;
    const last = !USER ? store.get("dh_last") : null;
    const seed = PREFILL || (last && last.data ? last : null);
    if (!edit && seed) {
      D = JSON.parse(JSON.stringify(seed.data || {})); NAME = seed.name || ""; prefilled = true;
      quick = !!seed.saved;
    }
    D.avail = {...(edit ? D.avail : {})};
    const steps = [
      {k:"hi", t:"سلام 👋", draw: () => `
        <div style="background:#f8f6ff;border:1.5px solid #e1daf7;border-radius:14px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
          <div>
            <span class="tiny">👤 سازنده: <b>${esc(M.organizer_name || "دوستان")}</b></span>
            <span class="tiny" style="margin-right:8px">· 👥 <b>${fa(M.count || 0)}</b> نفر شرکت کرده‌اند</span>
          </div>
          <code class="tiny" style="background:#fff;padding:2px 8px;border-radius:6px;color:var(--p)">کد: #${esc(M.code)}</code>
        </div>
        <div class="row" style="gap:8px;align-items:center;margin-bottom:6px">
          <span style="font-size:26px">${detectActivityIcon(M.title)}</span>
          <h1 style="margin:0">${esc(M.title)}</h1>
        </div>
        ${detectTargetType(M.title, M.note) === "pair" ? `<div class="pill sm" style="background:#fff0f6;color:#d63384;display:inline-block;margin-bottom:8px">👯‍♀️ همراه دو‌نفره (هم‌پا)</div>` : ""}
        ${M.note?`<div class="okbox" style="margin:8px 0;background:#f6f4fe;border-color:#d7cbfa">💬 <b>پیام ${esc(M.organizer_name || "برگزارکننده")}:</b> ${esc(M.note.replace(/^\[همراه دو‌نفره\]\s*/, ""))}</div>`:""}
        <p class="muted">بگو چه روزها، چه ساعت‌هایی و تا چه محدوده‌ای روی نقشه می‌توانی بیایی تا بهترین زمان و مکان مشترک برای همه پیدا شود. ${M.women_only?"<b>این دورهمی فقط برای خانم‌هاست.</b>":""}</p>
        ${quick?`<div class="okbox">✨ جواب‌های دفعهٔ قبلت را گذاشتم: مبدأ (${esc(D.origin?.fa || "ثبت‌شده")})، وسیله، غذا، ترجیح‌ها و حریم خصوصی. فقط ساعت‌ها و محدوده‌ای که این بار می‌تونی رو بزن؛ در صفحهٔ آخر هر بخش را خواستی با یک ضربه عوض کن.</div>`
          : prefilled?`<div class="note">✨ چند جواب را از پروفایل «همراه»ت پر کردم. هر کدام را خواستی عوض کن.</div>`:""}
        <label class="f">اسمت</label>
        <input type="text" id="f_name" maxlength="40" value="${esc(NAME)}" placeholder="مثلاً مریم یا سارا">
        <label class="f">📧 جیمیل / ایمیل (اختیاری — برای اینکه پروفایلت دائمی شود و دفعهٔ بعد خودکار پر شود)</label>
        <input type="email" id="f_email" class="ltr" maxlength="120" value="${esc(D.email || "")}" placeholder="you@gmail.com">
        <div class="okbox" style="margin-top:10px">🔒 زیر هر سؤال یک کلید هست: <b>«به بقیه نشان بده»</b>. اگر خاموش باشد، جوابت فقط به‌صورت بی‌نام در حساب‌ها می‌آید.</div>`,
        after: () => {},
        read: () => {
          NAME = $("#f_name").value.trim();
          const em = ($("#f_email")?.value || "").trim().toLowerCase();
          if (em) D.email = em;
          if (!NAME && em) NAME = em.split("@")[0];
          if (!NAME) return "اسمت را بنویس 🙂";
          if (!prefilled && !edit) {
            const match = (em && KNOWN_PROFILES.find(x => (x.email || x.data?.email || "").toLowerCase() === em))
              || KNOWN_PROFILES.find(x => x.name.toLowerCase() === NAME.toLowerCase());
            if (match && match.data) {
              D = {...JSON.parse(JSON.stringify(match.data)), ...(em ? {email: em} : {}), avail: D.avail || {}};
              if (match.public_fields && match.public_fields.length) PUB = new Set(match.public_fields.map(groupOf));
              quick = true; prefilled = true;
            }
          }
        }},
      {k:"origin", t:"کجاها می‌تونی؟", draw: () => `
        <h2>📍 کدام شهرها برایت خوب است؟ (مبدأ اختیاری است)</h2>
        <p class="muted">لازم نیست حتماً مبدأ را وارد کنی یا به بقیه نشان بدهی؛ می‌توانی فقط شهرهایی که اوکی هستی بیایی را روی نقشه یا از منو انتخاب کنی:</p>
        ${renderLocationControl(D, "f_orig")}
        <div id="f_orig_map" class="map-box"></div>
        <div class="map-legend">
          <span><i class="map-dot" style="background:#00B894"></i>شهرهایی که اوکی هستم بیایم</span>
          <span><i class="map-dot" style="background:#6C5CE7"></i>مبدأ و دایرهٔ حرکت (اختیاری)</span>
        </div>
        <details style="margin-top:8px" open>
          <summary class="tiny" style="cursor:pointer;color:var(--p);font-weight:700">🏠 تعیین شهر مبدأ (اختیاری — لازم نیست مبدأ داشته باشی یا نشان بدهی)</summary>
          <div style="margin-top:8px">
            <input type="text" id="f_cs" placeholder="جستجوی شهر مبدأ: روتردام، Delft، لایدن…">
            <div class="list-sel" id="f_cl"></div>
            <div class="row" style="margin-top:8px;justify-content:space-between;flex-wrap:wrap">
              <button class="btn line sm" id="f_geo">📡 از موقعیت گوشی‌ام (حدود ۵ کیلومتر)</button>
              <div id="f_osel"></div>
            </div>
          </div>
        </details>
        ${visT("origin","شهرهای انتخابی‌ام را با اسمم به بقیه نشان بده")}`,
        after: () => {
          clearAuxMaps();
          const helpers = wireLocationAndTimeControls(root, D, "f_orig", "f_orig_map");
          const refreshOrigMap = () => {
            helpers.refreshTags();
            const mEl = document.getElementById("f_orig_map");
            if (mEl && mEl._redrawMap) mEl._redrawMap();
          };
          const drawCities = () => {
            const s = $("#f_cs").value.trim().toLowerCase();
            $("#f_cl").innerHTML = CITIES.filter(c => !s || c.fa.includes(s) || c.nl.toLowerCase().includes(s) || c.key.includes(s))
              .map(c => `<div data-k="${c.key}" class="${D.origin&&D.origin.key===c.key?"on":""}">${esc(c.fa)} <span class="tiny ltr">${esc(c.nl)}</span></div>`).join("") || `<div class="tiny">پیدا نشد؛ نزدیک‌ترین شهر را بزن یا از موقعیت گوشی استفاده کن.</div>`;
            $("#f_cl").querySelectorAll("[data-k]").forEach(el => el.onclick = () => {
              const c = cityByKey(el.dataset.k);
              D.origin = {key:c.key, fa:c.fa, lat:c.lat, lng:c.lng};
              showSel(); drawCities(); refreshOrigMap();
            });
          };
          const showSel = () => $("#f_osel").innerHTML = D.origin ? `<span class="pill g">✓ مبدأ: ${esc(D.origin.fa)}</span>` : "";
          $("#f_cs").oninput = drawCities; drawCities(); showSel();
          const toggleCanCity = (k) => {
            const arr = D.can_cities || [];
            D.can_cities = arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];
            refreshOrigMap();
          };
          mountZoneMap("f_orig_map", D, { onToggleCity: (c) => toggleCanCity(c.key) });
          $("#f_geo").onclick = () => {
            if (!navigator.geolocation) return toast("گوشی موقعیت نمی‌دهد");
            $("#f_geo").innerHTML = `<span class="spin"></span>`;
            navigator.geolocation.getCurrentPosition(p => {
              const lat = Math.round(p.coords.latitude*20)/20, lng = Math.round(p.coords.longitude*20)/20;
              const near = CITIES.slice().sort((a,b)=>km({lat,lng},a)-km({lat,lng},b))[0];
              D.origin = {key:"geo", fa:"نزدیک " + near.fa, lat, lng, station:false};
              showSel(); refreshOrigMap(); $("#f_geo").textContent = "📡 موقعیت گرفته شد ✓";
            }, () => { toast("اجازهٔ موقعیت داده نشد"); $("#f_geo").textContent = "📡 از موقعیت گوشی‌ام"; }, {timeout:10000, maximumAge:600000});
          };
        },
        read: () => { if (!D.origin && !(D.can_cities && D.can_cities.length)) return "حداقل یک شهر که اوکی هستی بیایی (یا شهر مبدأ) را انتخاب کن."; }},
      {k:"modes", t:"چطور میای؟", draw: () => `
        <h2>🚆 چطور میای؟</h2>
        <p class="muted">هر چندتا که می‌شود انتخاب کن.</p>
        <div class="opts">
          ${optM("ov","🚆","قطار / اتوبوس / مترو","با کارت OV یا بلیت")}
          ${optM("car","🚗","ماشین دارم","می‌توانم رانندگی کنم")}
          ${optM("bike","🚲","دوچرخه","اگر نزدیک باشد")}
        </div>
        <div id="f_seats" style="display:${(D.modes||[]).includes("car")?"block":"none"}">
          <label class="f">چند نفر را می‌توانی سر راه سوار کنی؟</label>
          <div class="chips">${[0,1,2,3,4].map(n=>`<span class="chip ${D.seats===n?"on":""}" data-seat="${n}">${n?fa(n)+" نفر":"نه، جا ندارم"}</span>`).join("")}</div>
        </div>
        <label class="f">⏱️ حداکثر چقدر حاضری توی راه باشی (یک طرف)؟</label>
        <div class="chips">${[20,30,45,60,90,120].map(n=>`<span class="chip ${D.max_min===n?"on":""}" data-max="${n}">${n===120?"۲ ساعت":fa(n)+" دقیقه"}</span>`).join("")}</div>
        ${visT("modes","وسیله‌ام را به بقیه نشان بده (برای هماهنگی سوار شدن)")}`,
        after: () => {
          root.querySelectorAll("[data-mode]").forEach(el => el.onclick = () => {
            const m = el.dataset.mode; D.modes = D.modes||[]; D.modes = D.modes.includes(m) ? D.modes.filter(x=>x!==m) : [...D.modes, m];
            el.classList.toggle("on"); $("#f_seats").style.display = D.modes.includes("car") ? "block" : "none";
          });
          oneOf("[data-seat]", v => D.seats = +v);
          oneOf("[data-max]", v => D.max_min = +v);
        },
        read: () => { if (!(D.modes||[]).length) return "حداقل یک راه رسیدن انتخاب کن."; if (!D.max_min) D.max_min = 60; }},
      {k:"avail", t:"کی و کجا می‌تونی؟", draw: () => `
        <h2>📅 چه روزها و چه ساعت‌هایی می‌تونی؟</h2>
        ${M.options.length ? `
          <p class="muted">اول به این تاریخ‌های پیشنهادی جواب بده:</p>
          ${M.options.map((o,i)=>`<div class="slot"><span class="lbl">${esc(fmtOpt(o))}</span>
            <span class="vote3">
              <span class="chip y ${D.avail[i]==="yes"?"on":""}" data-av="${i}:yes">می‌تونم</span>
              <span class="chip m ${D.avail[i]==="maybe"?"on":""}" data-av="${i}:maybe">شاید</span>
              <span class="chip n ${D.avail[i]==="no"?"on":""}" data-av="${i}:no">نه</span></span></div>`).join("")}
        ` : `<p class="muted">در این دورهمی وقت از قبل تعیین نشده! در جدول زیر روی خانه‌هایی که آزاد هستی بزن تا اپ بهترین زمان مشترک را پیدا کند:</p>`}
        <label class="f" style="margin-top:10px">🗓️ جدول ساعت‌ها و روزهای آزاد هفته (در پروفایلت هم ذخیره می‌شود):</label>
        <div id="f_freewins">
          ${renderWeekGrid(D.free_windows || [], "fwin")}
        </div>
        <label class="f" style="margin-top:8px">⏰ توضیح ساعت دلخواه (اختیاری — مثلاً: شنبه ۱۴ تا ۱۹ یا جمعه بعد از کار)</label>
        <input type="text" id="f_fnote" maxlength="100" value="${esc(D.free_note||"")}" placeholder="مثلاً: یکشنبه‌ها از ساعت ۱۵ به بعد">
        <label class="f" style="margin-top:10px">🗺️ شهرها و محدودهٔ حرکت روی نقشه (می‌توانی چند شهر اضافه کنی؛ دایره اختیاری است):</label>
        ${renderLocationControl(D, "f_av")}
        <div id="f_av_map" class="map-box"></div>
        <div class="map-legend">
          <span><i class="map-dot" style="background:#6C5CE7"></i>مبدأ و دایرهٔ شعاع حرکت (اختیاری)</span>
          <span><i class="map-dot" style="background:#00B894"></i>شهرهای انتخاب‌شده</span>
        </div>
        ${renderTimeLocLinker(D, "f_av")}
        <label class="f">🕘 معمولاً تا چه ساعتی می‌تونی بمونی؟</label>
        <div class="chips">${Object.entries(UNTIL_L).map(([k,l])=>`<span class="chip ${D.until===k?"on":""}" data-until="${k}">${l}</span>`).join("")}</div>
        <label class="f">🌙 تنها برگشتن در تاریکی؟</label>
        <div class="opts">${Object.entries({ok:["😌","راحتم"],early:["🌇","ترجیح می‌دهم قبل از تاریکی برگردم"],ride:["🤝","اگر کسی هم‌مسیر باشد یا برساند راحت‌ترم"]}).map(([k,[e,l]])=>`<div class="opt ${D.night_alone===k?"on":""}" data-night="${k}"><span class="e">${e}</span><div><b>${l}</b></div></div>`).join("")}</div>
        ${visT("avail","روزها و ساعت‌هایی که می‌تونم را با اسمم نشان بده")}
        <div style="margin-top:14px;background:#f3effe;border:1.5px dashed #cdbbf5;border-radius:14px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:13px;color:var(--p);display:block">⚡ می‌خواهی سریع‌تر تمام شود؟</b>
            <span class="tiny">ساعت‌ها و شهرهایت را زدی؟ می‌توانی بدون پاسخ به سؤالات غذا یا الکل همین حالا ثبت کنی:</span>
          </div>
          <button type="button" class="btn sm" id="f_fast_done" style="background:var(--ok);color:#fff">ثبت سریع و بررسی نهایی ←</button>
        </div>`,
        after: () => {
          const fastDone = $("#f_fast_done");
          if (fastDone) {
            fastDone.onclick = () => {
              const err = steps[i].read && steps[i].read();
              if (err) { $("#f_err").innerHTML = `<div class="err">${esc(err)}</div>`; return; }
              i = steps.length - 1; // jump to review
              draw();
              scrollTo(0, 0);
            };
          }
          root.querySelectorAll("[data-av]").forEach(el => el.onclick = () => {
            const [i,v] = el.dataset.av.split(":"); D.avail[i] = v;
            el.parentNode.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === el));
          });
          const fbox = $("#f_freewins");
          if (fbox) {
            const refreshF = () => {
              const cur = new Set(D.free_windows || []);
              fbox.querySelectorAll("[data-fwin]").forEach(td => {
                const on = cur.has(td.dataset.fwin);
                td.classList.toggle("on", on);
                td.textContent = on ? "✓" : "·";
              });
            };
            fbox.querySelectorAll("[data-fwin]").forEach(el => el.onclick = () => {
              const k = el.dataset.fwin;
              const arr = D.free_windows || [];
              D.free_windows = arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];
              refreshF();
            });
            fbox.querySelectorAll("[data-qfill-fwin]").forEach(btn => btn.onclick = () => {
              const mode = btn.getAttribute("data-qfill-fwin");
              if (mode === "clear") D.free_windows = [];
              else if (mode === "wknd") {
                const s = new Set(D.free_windows || []);
                ["sat:afternoon","sat:evening","sun:afternoon","sun:evening"].forEach(k => s.add(k));
                D.free_windows = [...s];
              } else if (mode === "eve") {
                const s = new Set(D.free_windows || []);
                WEEK_DAYS.forEach(([dk]) => s.add(`${dk}:evening`));
                D.free_windows = [...s];
              }
              refreshF();
            });
          }
          clearAuxMaps();
          const helpers = wireLocationAndTimeControls(root, D, "f_av", "f_av_map");
          const toggleAvCity = (k) => {
            const arr = D.can_cities || [];
            D.can_cities = arr.includes(k) ? arr.filter(x => x !== k) : [...arr, k];
            helpers.refreshTags();
            const mEl = document.getElementById("f_av_map");
            if (mEl && mEl._redrawMap) mEl._redrawMap();
          };
          mountZoneMap("f_av_map", D, { onToggleCity: (c) => toggleAvCity(c.key) });
          oneOf("[data-until]", v => D.until = v);
          oneOf("[data-night]", v => D.night_alone = v, ".opt");
        },
        read: () => {
          if ($("#f_fnote")) D.free_note = $("#f_fnote").value.trim();
          if (M.options.length && M.options.some((o,i)=>!D.avail[i])) return "برای همهٔ روزها یکی را بزن (اگر نمی‌دانی «شاید»).";
          if (!M.options.length && !(D.free_windows||[]).length && !D.free_note) return "حداقل یک روز و ساعت که می‌توانی بیایی را انتخاب کن.";
        }},
      {k:"activities", t:"چی کار کنیم؟", draw: () => `
        <h2>✨ دوست داری چی کار کنیم؟</h2>
        <p class="muted">هر چندتا که دوست داری.</p>
        <div class="chips">${ACTIVITIES.map(([k,l])=>`<span class="chip big ${(D.activities||[]).includes(k)?"on":""}" data-act="${k}">${l}</span>`).join("")}</div>
        <label class="f">💶 بودجه‌ات برای این بیرون رفتن؟</label>
        <div class="chips">${Object.entries(BUDGET_L).map(([k,l])=>`<span class="chip ${String(D.budget)===k?"on":""}" data-bud="${k}">${l}</span>`).join("")}</div>
        ${visT("activities","سلیقه‌ام را به بقیه نشان بده")}`,
        after: () => { multi("[data-act]", "activities"); oneOf("[data-bud]", v => D.budget = +v); }},
      {k:"diet", t:"غذا", draw: () => `
        <h2>🍽️ غذا</h2>
        <div class="chips">${DIET.map(([k,l])=>`<span class="chip ${(D.diet||[]).includes(k)?"on":""}" data-diet="${k}">${l}</span>`).join("")}</div>
        <label class="f">⚠️ آلرژی یا حساسیت غذایی داری؟</label>
        <input type="text" id="f_alg" maxlength="120" value="${esc(D.allergy||"")}" placeholder="مثلاً بادام‌زمینی، میگو… (اگر نه، خالی بگذار)">
        <label class="f">😖 غذایی که اصلاً دوست نداری؟</label>
        <input type="text" id="f_dis" maxlength="120" value="${esc(D.dislikes||"")}" placeholder="مثلاً غذای خیلی تند">
        ${visT("diet","این‌ها را با اسمم نشان بده")}
        <p class="tiny">اگر خاموش باشد، رستوران‌ها باز هم بر اساسش فیلتر می‌شوند، ولی اسمت کنارش نمی‌آید.</p>`,
        after: () => multi("[data-diet]", "diet", "none"),
        read: () => { D.allergy = $("#f_alg").value.trim(); D.dislikes = $("#f_dis").value.trim(); }},
      {k:"life", t:"الکل، سیگار و…", draw: () => `
        <h2>🍷🚬 با این‌ها راحتی؟</h2>
        <p class="muted">برای اینکه جایی برویم که همه راحت باشند. <b>پیش‌فرض خصوصی است</b>؛ فقط به‌شکل «چند نفر» در حساب‌ها می‌آید. می‌توانی جواب ندهی.</p>
        <label class="f">الکل سر میز</label>
        ${tri("alcohol", ALC_L, ["🚫🍷","🤷‍♀️","🥂"])}
        <label class="f">سیگار کنارت</label>
        ${tri("smoke", SMOKE_L, ["😷","🤷‍♀️","🚬"])}
        <label class="f">ماری‌جوانا / کافی‌شاپ</label>
        ${tri("weed", WEED_L, ["🙅‍♀️","🤷‍♀️","🌿"])}
        ${visT("life","این سه جواب را با اسمم به بقیه نشان بده")}`,
        after: () => { ["alcohol","smoke","weed"].forEach(k => oneOf(`[data-${k}]`, v => D[k] = v, ".opt")); }},
      {k:"more", t:"چیزهای دیگر", draw: () => `
        <h2>🧡 چند چیز دیگر</h2>
        <label class="f">به چه زبان‌هایی راحتی؟</label>
        <div class="chips">${Object.entries(LANG_L).map(([k,l])=>`<span class="chip ${(D.langs||[]).includes(k)?"on":""}" data-lang="${k}">${l}</span>`).join("")}</div>
        <label class="f">با کی میای؟</label>
        <div class="chips">${Object.entries(BRING_L).map(([k,l])=>`<span class="chip ${D.bring===k?"on":""}" data-bring="${k}">${l}</span>`).join("")}</div>
        <label class="f">📸 عکس و استوری</label>
        <div class="opts">${Object.entries({ok:["📸","عکس و استوری اوکی است"],nofaces:["🙈","عکس بله، ولی صورتم جایی پست نشود"],no:["🚫","لطفاً هیچ عکسی از من پست نشود"]}).map(([k,[e,l]])=>`<div class="opt ${D.photo===k?"on":""}" data-photo="${k}"><span class="e">${e}</span><div><b>${l}</b></div></div>`).join("")}</div>
        <div class="opt ${D.quiet?"on":""}" id="f_quiet" style="margin-top:10px"><span class="e">🤫</span><div><b>جای آرام و کم‌سروصدا را ترجیح می‌دهم</b><span>که بشود حرف زد</span></div></div>
        <label class="f">♿ نیاز خاصی برای جا داری؟ (اختیاری)</label>
        <input type="text" id="f_acc" maxlength="120" value="${esc(D.access||"")}" placeholder="مثلاً پله نداشته باشد، کالسکه، جای نشستن…">
        ${visT("more","این‌ها را با اسمم نشان بده")}`,
        after: () => {
          multi("[data-lang]", "langs"); oneOf("[data-bring]", v => D.bring = v); oneOf("[data-photo]", v => D.photo = v, ".opt");
          $("#f_quiet").onclick = e => { D.quiet = !D.quiet; e.currentTarget.classList.toggle("on", D.quiet); };
        },
        read: () => { D.access = $("#f_acc").value.trim(); }},
      {k:"me", t:"کمی از خودت", draw: () => `
        <h2>🪪 کمی از خودت <span class="tiny">(همه اختیاری)</span></h2>
        <p class="muted">برای اینکه یخ زودتر بشکند. هر کدام را خواستی خصوصی کن.</p>
        <label class="f">سن</label>
        <div class="chips">${["زیر ۲۵","۲۵–۳۰","۳۰–۳۵","۳۵–۴۰","۴۰–۵۰","۵۰+"].map(a=>`<span class="chip ${D.age===a?"on":""}" data-age="${a}">${a}</span>`).join("")}</div>
        ${visT("age","سنم را نشان بده")}
        <label class="f">کار یا درس</label>
        <input type="text" id="f_job" maxlength="80" value="${esc(D.job||"")}" placeholder="مثلاً دانشجوی ارشد، طراح، پرستار…">
        ${visT("job","کارم را نشان بده")}
        <label class="f">علاقه‌ها</label>
        <div class="chips">${HOBBIES.map(h=>`<span class="chip ${(D.hobbies||[]).includes(h)?"on":""}" data-hob="${h}">${h}</span>`).join("")}</div>
        <label class="f">یک جمله دربارهٔ خودت</label>
        <input type="text" id="f_about" maxlength="160" value="${esc(D.about||"")}" placeholder="مثلاً: عاشق قهوه و پیاده‌روی کنار آبم">
        <label class="f">یک سؤال که دوست داری از جمع بپرسی</label>
        <input type="text" id="f_q" maxlength="160" value="${esc(D.question||"")}" placeholder="مثلاً: بهترین جایی که در هلند پیدا کردی کجاست؟">
        <label class="f">راه ارتباط (اختیاری)</label>
        <input type="text" id="f_contact" maxlength="80" value="${esc(D.contact||"")}" placeholder="اینستاگرام یا شماره، اگر خواستی">
        ${visT("contact","راه ارتباطم را نشان بده")}`,
        after: () => { oneOf("[data-age]", v => D.age = v); multi("[data-hob]", "hobbies"); },
        read: () => { D.job = $("#f_job").value.trim(); D.about = $("#f_about").value.trim(); D.question = $("#f_q").value.trim(); D.contact = $("#f_contact").value.trim(); }},
      {k:"review", t:"مرور", draw: () => {
        const pub = [], priv = [];
        for (const k of Object.keys(LABEL)) {
          const v = k === "avail" ? M.options.map((o,i)=>D.avail[i]==="yes"?fmtOpt(o):null).filter(Boolean).join(" · ") : showVal(k, D[k]);
          if (!v) continue;
          (PUB.has(groupOf(k)) ? pub : priv).push(`<div class="kv"><b>${LABEL[k]}:</b> ${esc(v)}</div>`);
        }
        const SECT = [["origin","📍 مبدأ"],["modes","🚆 وسیله"],["avail","📅 روزها"],["activities","✨ کار و بودجه"],["diet","🍽️ غذا"],["life","🍷 الکل و سیگار"],["more","🧡 چیزهای دیگر"],["me","🪪 از خودت"]];
        return `<h2>✅ آماده است، ${esc(NAME)}</h2>
          <div class="chips" style="margin:6px 0 4px">${SECT.map(([k,l])=>`<span class="chip" data-jump="${k}">✏️ ${l}</span>`).join("")}</div>
          <h3>👀 بقیه این‌ها را با اسمت می‌بینند</h3>${pub.join("") || '<p class="tiny">هیچ چیز (فقط اسمت)</p>'}
          <h3>🔒 خصوصی (فقط بی‌نام در حساب‌ها)</h3>${priv.join("") || '<p class="tiny">هیچ چیز</p>'}
          <p class="tiny" style="margin-top:10px">برای عوض کردن هر بخش، دکمه‌اش را بالا بزن. بعداً هم می‌توانی فرمت را ویرایش یا پاک کنی.${USER?" این جواب‌ها برای دورهمی بعدی‌ات هم یادم می‌ماند (به‌جز روزها).":""}</p>`; }},
    ];
    const GROUPS = {origin:["origin","can_cities","time_locations"], modes:["modes","seats","max_min"], avail:["avail","free_windows","free_note","until","night_alone"], activities:["activities","budget"],
      diet:["diet","allergy","dislikes"], life:["alcohol","smoke","weed"], more:["langs","bring","photo","quiet","access"],
      age:["age"], job:["job"], contact:["contact"]};
    function groupOf(k){ for (const [g,ks] of Object.entries(GROUPS)) if (ks.includes(k)) return g; return k; }
    if (!edit && seed && seed.pub) PUB = new Set(seed.pub.map(groupOf));   // saved field list → toggle groups
    const idx = k => steps.findIndex(x => x.k === k);
    // quick mode path: hi → avail → review
    const nextIdx = (cur) => quick ? (steps[cur].k === "hi" ? idx("avail") : steps[cur].k === "avail" ? idx("review") : cur + 1) : cur + 1;
    const prevIdx = (cur) => quick ? (steps[cur].k === "review" ? idx("avail") : steps[cur].k === "avail" ? idx("hi") : cur - 1) : cur - 1;
    function visT(g, label){ return `<div class="vis ${PUB.has(g)?"on":""}" data-vis="${g}"><span class="sw"></span><span>${label}</span></div>`; }
    function optM(k,e,b,s){ return `<div class="opt ${(D.modes||[]).includes(k)?"on":""}" data-mode="${k}"><span class="e">${e}</span><div><b>${b}</b><span>${s}</span></div></div>`; }
    function tri(k, L, emo){ return `<div class="opts">${Object.entries(L).map(([v,l],i)=>`<div class="opt ${D[k]===v?"on":""}" data-${k}="${v}"><span class="e">${emo[i]}</span><div><b>${l.replace("می‌دهد","می‌دهم").replace("می‌کند","می‌کند").replace("خودش","خودم").replace("برایش","برایم").replace("اذیتش","اذیتم").replace("کنارش","کنارم").replace("ندارد","ندارم").replace("می‌نوشد","می‌نوشم").replace("می‌کشد","می‌کشم").replace("مصرف می‌کند","مصرف می‌کنم")}</b></div></div>`).join("")}</div>`; }
    function oneOf(sel, set, cls){ root.querySelectorAll(sel).forEach(el => el.onclick = () => {
      const key = Object.keys(el.dataset)[0]; const v = el.dataset[key];
      const same = el.classList.contains("on");
      root.querySelectorAll(sel).forEach(x => x.classList.remove("on"));
      if (same && cls) { set(null); return; }   // tap again to clear (optional questions)
      el.classList.add("on"); set(v);
    }); }
    function multi(sel, field, exclusive){ root.querySelectorAll(sel).forEach(el => el.onclick = () => {
      const v = Object.values(el.dataset)[0]; let a = D[field] || [];
      if (a.includes(v)) a = a.filter(x => x !== v); else { a = [...a, v]; if (exclusive) a = v === exclusive ? [v] : a.filter(x => x !== exclusive); }
      D[field] = a; root.querySelectorAll(sel).forEach(x => x.classList.toggle("on", a.includes(Object.values(x.dataset)[0])));
    }); }
    let i = 0;
    function draw(){
      const s = steps[i];
      app.innerHTML = topbar() + `
        <header class="top"><span class="logo">${detectActivityIcon(M.title)}</span><div><b>${esc(M.title)}</b><small>${M.count?fa(M.count)+" نفر تا الان پر کرده‌اند":"اولین نفری 🎈"}</small></div></header>
        <div class="step-h"><span>${esc(s.t)}</span><span>${quick ? `${fa([idx("hi"),idx("avail"),idx("review")].indexOf(i)+1 || 2)} از ۳ · سریع` : `${fa(i+1)} از ${fa(steps.length)}`}</span></div>
        <div class="prog"><i style="width:${quick ? (([idx("hi"),idx("avail"),idx("review")].indexOf(i)+1 || 2)/3*100) : (i+1)/steps.length*100}%"></i></div>
        <div class="card">${s.draw()}</div><div id="f_err"></div>
        ${i===0 ? `<div class="row"><a href="/d/${CODE}?${ADMIN?`admin=${esc(ADMIN)}&`:""}tab=result" class="btn line sm">${edit?"دیدن نتیجه بدون تغییر":"اول فقط نتیجه را ببینم"}</a></div>`:""}
        <div class="bar"><div class="in">
          ${i>0?`<button class="btn line" id="f_back">قبلی</button>`:""}
          <button class="btn grow" id="f_next">${i===steps.length-1?(edit?"ذخیرهٔ تغییرات ✓":"ثبت و دیدن نتیجه ✓"):"بعدی"}</button>
        </div></div>`;
      bindLoginLinks();
      root.querySelectorAll("[data-vis]").forEach(el => el.onclick = () => { const g = el.dataset.vis; PUB.has(g) ? PUB.delete(g) : PUB.add(g); el.classList.toggle("on", PUB.has(g)); });
      s.after && s.after();
      $("#f_next").onclick = next;
      if ($("#f_back")) $("#f_back").onclick = () => { s.read && s.read(); i = prevIdx(i); draw(); scrollTo(0,0); };
      // review: jump to a section, then walk the normal path back to review
      root.querySelectorAll("[data-jump]").forEach(el => el.onclick = () => { quick = false; i = idx(el.dataset.jump); draw(); scrollTo(0,0); });
      const inp = app.querySelector("input[type=text]"); if (inp && i===0 && !NAME) inp.focus();
    }
    async function next(){
      const s = steps[i];
      const err = s.read && s.read();
      if (err) { $("#f_err").innerHTML = `<div class="err">${esc(err)}</div>`; return; }
      if (i < steps.length-1) { i = nextIdx(i); draw(); scrollTo(0,0); return; }
      const b = $("#f_next"); b.disabled = true; b.innerHTML = `<span class="spin"></span>`;
      const pubFields = []; for (const [g,ks] of Object.entries(GROUPS)) if (PUB.has(g)) pubFields.push(...ks);
      ["about","hobbies","question"].forEach(k => pubFields.push(k));  // these are only asked to be shared
      const clean = {}; for (const [k,v] of Object.entries(D)) if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) clean[k] = v;
      try {
        const r = await rpc("dh_respond", {p_code:CODE, p_edit:edit||null, p_name:NAME, p_data:clean, p_public:pubFields});
        store.set("dh_"+CODE, {...(store.get("dh_"+CODE)||{}), title:M.title, edit:r.edit_token, name:NAME});
        const keep = {...clean}; delete keep.avail;
        if (!USER) { store.set("dh_last", {name:NAME, email:keep.email||"", data:keep, pub:pubFields, saved:true}); }
        fetch("/api/d/profiles", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:NAME, email:keep.email||null, data:keep, public_fields:pubFields})}).catch(()=>{});
        profilesLoaded = false;
        toast("ثبت شد ✓"); go(`/d/${CODE}?tab=result`);
      } catch(e){ $("#f_err").innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; b.disabled=false; b.textContent="دوباره امتحان کن"; }
    }
    draw();
  }

  /* ============ analysis ============ */
  function analyse(){
    const rows = M.anon || [];
    const people = M.people || [];
    const n = rows.length;
    // time (predetermined options)
    const slots = M.options.map((o,i) => {
      let y=0,m=0,no=0; rows.forEach(r => { const a = (r.avail||{})[i]; if (a==="yes") y++; else if (a==="maybe") m++; else if (a==="no") no++; });
      return {i, o, y, m, no, score: y + m*0.5};
    }).sort((a,b) => b.score - a.score || a.no - b.no);

    // open time windows & preferred cities (from people + KNOWN_PROFILES fallback)
    const winCounts = {};
    const cityVotes = {};
    const freeNotes = [];
    const timeLocNotes = [];
    people.forEach(p => {
      const kp = KNOWN_PROFILES.find(x => x.name.toLowerCase() === (p.name||"").toLowerCase());
      const fw = (p.free_windows && p.free_windows.length) ? p.free_windows : (kp?.data?.free_windows || []);
      const cc = (p.can_cities && p.can_cities.length) ? p.can_cities : (kp?.data?.can_cities || (p.origin?.key ? [p.origin.key] : []));
      const fn = p.free_note || kp?.data?.free_note;
      const tl = (p.time_locations && p.time_locations.length) ? p.time_locations : (kp?.data?.time_locations || []);
      fw.forEach(w => { winCounts[w] = winCounts[w] || {w, count:0, names:[]}; winCounts[w].count++; winCounts[w].names.push(p.name); });
      cc.forEach(c => { cityVotes[c] = (cityVotes[c] || 0) + 1; });
      tl.forEach(r => {
        if (r && r.city) {
          cityVotes[r.city] = (cityVotes[r.city] || 0) + 1;
          timeLocNotes.push({ name: p.name, text: `${fmtTimeBucket(r.when)} ← ${(cityByKey(r.city)||{}).fa || r.city}` });
        }
      });
      if (fn) freeNotes.push({name: p.name, note: fn});
    });
    const winSorted = Object.values(winCounts).sort((a,b) => b.count - a.count);

    // place
    const withO = rows.filter(r => r.origin && r.origin.lat);
    const hubs = CITIES.filter(c => c.meet).map(h => {
      const per = withO.map(r => {
        const modes = (r.modes && r.modes.length) ? r.modes : ["ov"];
        const times = modes.map(md => ({md, t: travel({...r.origin, station: r.origin.station !== false}, h, md)}));
        times.sort((a,b)=>a.t-b.t); const best = times[0];
        let t = best.t; if (r.night_alone === "early" || r.night_alone === "ride") t *= 1.1;
        return {t: best.t, w: t, md: best.md, max: r.max_min || 60, over: best.t > (r.max_min || 60)};
      });
      const maxT = per.length ? Math.max(...per.map(p=>p.t)) : 0;
      const avg = per.length ? per.reduce((a,p)=>a+p.t,0)/per.length : 0;
      const over = per.filter(p=>p.over).length;
      const votes = cityVotes[h.key] || 0;
      const score = (per.length ? Math.max(...per.map(p=>p.w)) : 0) + 0.35*avg + 30*over - votes*6;
      return {h, per, maxT, avg, over, votes, score};
    }).sort((a,b) => a.score - b.score);
    // needs
    const cnt = f => rows.filter(f).length;
    const dietC = {}; rows.forEach(r => (r.diet||[]).forEach(d => dietC[d] = (dietC[d]||0)+1));
    const allergies = [...new Set(rows.map(r => (r.allergy||"").trim()).filter(Boolean))];
    const acts = {}; rows.forEach(r => (r.activities||[]).forEach(a => acts[a] = (acts[a]||0)+1));
    const actsSorted = Object.entries(acts).sort((a,b)=>b[1]-a[1]);
    const budgets = rows.map(r => r.budget).filter(Boolean);
    const untils = rows.map(r => r.until).filter(Boolean);
    const hob = {}; rows.forEach(r => (r.hobbies||[]).forEach(h => hob[h] = (hob[h]||0)+1));
    return {
      n, slots, winSorted, freeNotes, timeLocNotes, cityVotes, hubs, withO: withO.length,
      dietC, allergies, actsSorted, hob: Object.entries(hob).sort((a,b)=>b[1]-a[1]),
      budget: budgets.length ? Math.min(...budgets) : null,
      earliestUntil: untils.length ? untils.filter(u=>u!=="late").map(Number).sort((a,b)=>a-b)[0] : null,
      noAlcPlace: cnt(r => r.alcohol === "none_place"), drinkers: cnt(r => r.alcohol === "drink"),
      smokeBothers: cnt(r => r.smoke === "bothers"), smokers: cnt(r => r.smoke === "smoke"),
      weedNot: cnt(r => r.weed === "not_near"),
      noPhoto: cnt(r => r.photo === "no"), noFace: cnt(r => r.photo === "nofaces"),
      quiet: cnt(r => r.quiet), access: cnt(r => r.access), nightCare: cnt(r => r.night_alone === "early" || r.night_alone === "ride"),
      noFa: cnt(r => r.langs && r.langs.length && !r.langs.includes("fa")),
      seats: rows.reduce((a,r) => a + ((r.modes||[]).includes("car") ? (r.seats||0) : 0), 0),
      cars: cnt(r => (r.modes||[]).includes("car")), noCar: cnt(r => !(r.modes||[]).includes("car")),
    };
  }

  /* ============ results ============ */
  function resultPage(){
    const A = analyse();
    const my = store.get("dh_"+CODE) || {};
    const isArchived = Boolean(M.is_archived || M.final?.archived);
    const expDate = M.expires_at || M.final?.expires_at;
    const isExpired = Boolean(M.is_expired || isDateExpired(expDate));
    const locLine = fmtLocation(M.final?.location);
    const audBadges = fmtAudience(M.final?.audience, Boolean(M.women_only));
    app.innerHTML = topbar() + `
      <header class="top"><span class="logo">${detectActivityIcon(M.title)}</span><div><b>${esc(M.title)}</b><small>${fa(A.n)} نفر فرم را پر کرده‌اند${M.organizer_name?" · برگزارکننده: "+esc(M.organizer_name):""}</small></div></header>
      ${isArchived ? `<div class="okbox" style="margin:8px 0;background:#fff8e6;border-color:#f6d899;color:#8a5a00">📦 <b>این دورهمی آرشیو شده است</b> (از لیست عمومی پنهان است اما با لینک در دسترس است).</div>` : ""}
      ${isExpired ? `<div class="okbox" style="margin:8px 0;background:#fff0f0;border-color:#ffd0d0;color:#c92a2a">⏰ <b>مهلت اعلام حضور یا تاریخ انقضای این دورهمی به پایان رسیده است.</b></div>` : (expDate ? `<div class="tiny" style="color:var(--muted);margin-bottom:6px">⏰ مهلت اعلام حضور تا: <b>${fmtDate(expDate)}</b></div>` : "")}
      ${locLine ? `<div class="okbox" style="margin:8px 0;background:#eefbf6;border-color:#b7ebd6;color:#0e5f4d">${esc(locLine)}</div>` : ""}
      ${audBadges.length ? `<div class="row" style="gap:6px;margin:6px 0 8px">${audBadges.map(b => `<span class="pill sm" style="background:#f3f0ff;color:var(--p)">${esc(b)}</span>`).join("")}</div>` : ""}
      ${detectTargetType(M.title, M.note) === "pair" ? `<div class="pill sm" style="background:#fff0f6;color:#d63384;display:inline-block;margin-bottom:8px">👯‍♀️ قرار همراهی دو‌نفره (هم‌پا)</div>` : ""}
      ${M.note ? `<div class="okbox" style="margin:8px 0;background:#f6f4fe;border-color:#d7cbfa">💬 <b>پیام ${esc(M.organizer_name || "برگزارکننده")}:</b> ${esc(M.note.replace(/^\[همراه دو‌نفره\]\s*/, ""))}</div>` : ""}
      ${isFinalized(M.final) ? finalCard(M.final) : ""}
      <div class="tabs">
        ${[["result","🧭 نتیجه"],["people","👯‍♀️ آدم‌ها"],["ice","🧊 یخ‌شکن"],["share", ADMIN ? "⚙️ مدیریت" : "📤 دعوت"]].map(([k,l])=>`<span class="tab ${TAB===k?"on":""}" data-tab="${k}">${l}</span>`).join("")}
      </div>
      <div id="tabc"></div>
      ${memberCard()}
      <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:6px;justify-content:flex-start">
        ${my.edit
          ? `<a class="btn line sm" href="/d/${CODE}?form=1">✏️ ویرایش فرم من</a><button class="btn line sm" id="del_me">🗑️ پاک کردن جواب من</button>`
          : `<a class="btn sm" href="/d/${CODE}?form=1">📝 پر کردن فرم</a>`}
        ${ADMIN ? `<button class="btn line sm" id="quick_admin_btn" style="color:var(--p);font-weight:700">⚙️ مدیریت و حذف ایونت</button>` : ""}
        <a class="btn line sm" href="/d">+ دورهمی تازه</a>
      </div>
      <p class="tiny" style="margin-top:10px">زمان‌های راه تخمینی‌اند (بر اساس فاصله). برای مسیر دقیق از <a href="https://9292.nl/" target="_blank" rel="noopener">9292</a> یا گوگل‌مپ استفاده کن. ${my.name?`تو با اسم «${esc(my.name)}» پر کرده‌ای.`:""}</p>`;
    root.querySelectorAll("[data-tab]").forEach(t => t.onclick = () => { TAB = t.dataset.tab; resultPage(); });
    const qAdminBtn = $("#quick_admin_btn");
    if (qAdminBtn) {
      qAdminBtn.onclick = () => {
        TAB = "share";
        resultPage();
        setTimeout(() => {
          $("#a_manage_card")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      };
    }
    if ($("#del_me")) $("#del_me").onclick = async () => {
      if (!confirm("جوابت کامل پاک شود؟")) return;
      try { await rpc("dh_delete_mine", {p_code:CODE, p_edit:my.edit}); store.set("dh_"+CODE, {title:M.title, admin:my.admin}); toast("پاک شد"); go(`/d/${CODE}`); } catch(e){ toast(errMsg(e)); }
    };
    bindMember();
    const c = $("#tabc");
    if (TAB === "people") c.innerHTML = peopleTab();
    else if (TAB === "ice") c.innerHTML = iceTab(A);
    else if (TAB === "share") { c.innerHTML = `<div class="card"><h2>این لینک را در گروه بفرست</h2>${shareButtons()}</div>${ADMIN?adminBox(A):""}`; bindShare(); bindAdmin(A); }
    else { c.innerHTML = resultTab(A); bindResult(A); }
  }
  function finalCard(f){
    const when = f.d ? `${fmtDate(f.d)}${f.t?" · ساعت "+fa(f.t):""}` : "";
    const cal = icsHref(f);
    return `<div class="card final">
      <div class="tiny">✅ قطعی شد</div>
      <h1 style="margin:2px 0 4px">${esc(when)}</h1>
      <div style="font-size:17px">📍 ${esc(f.venue || "")}${f.city?" — "+esc((cityByKey(f.city)||{}).fa||f.city):""}</div>
      ${f.address?`<div class="tiny">${esc(f.address)}</div>`:""}
      ${f.note?`<p style="margin-top:6px">${esc(f.note)}</p>`:""}
      <div class="row" style="margin-top:10px">
        <a class="btn sm" style="background:#fff;color:var(--p)" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((f.venue||"")+" "+(f.address||"")+" "+((cityByKey(f.city)||{}).nl||""))}">🗺️ نقشه</a>
        <a class="btn sm" style="background:#fff;color:var(--p)" download="dorehami.ics" href="${cal}">📅 به تقویم</a>
      </div></div>`;
  }
  function icsHref(f){
    if (!f.d) return "#";
    const [hh,mm] = (f.t||"15:00").split(":").map(Number);
    const pad = n => String(n).padStart(2,"0");
    const start = `${f.d.replace(/-/g,"")}T${pad(hh)}${pad(mm)}00`;
    const end = `${f.d.replace(/-/g,"")}T${pad(Math.min(hh+3,23))}${pad(mm)}00`;
    const loc = [f.venue, f.address, (cityByKey(f.city)||{}).nl].filter(Boolean).join(", ");
    const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Hamrah//Dorehami//FA","BEGIN:VEVENT",`UID:${CODE}@hamrah`,
      `DTSTART;TZID=Europe/Amsterdam:${start}`,`DTEND;TZID=Europe/Amsterdam:${end}`,`SUMMARY:${M.title}`,`LOCATION:${loc}`,
      `DESCRIPTION:${linkFor(CODE)}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }
  function resultTab(A){
    if (!A.n) return `<div class="card center"><div class="hero-e">⏳</div><h2>هنوز کسی پر نکرده</h2><p class="muted">لینک را در گروه بفرست؛ با هر جواب، این صفحه دقیق‌تر می‌شود.</p></div>`;
    const best = A.slots[0];
    const top = A.hubs.slice(0,3);
    const needs = [];
    const dn = A.dietC;
    if (dn.halal) needs.push(`🥩 <b>${fa(dn.halal)}</b> نفر غذای حلال می‌خواهند`);
    if (dn.no_pork) needs.push(`🐖 <b>${fa(dn.no_pork)}</b> نفر بدون گوشت خوک`);
    if (dn.vegetarian || dn.vegan) needs.push(`🥗 <b>${fa((dn.vegetarian||0)+(dn.vegan||0))}</b> نفر گیاه‌خوار${dn.vegan?` (${fa(dn.vegan)} وگان)`:""} — جا باید غذای گیاهی خوب داشته باشد`);
    if (dn.gluten) needs.push(`🌾 ${fa(dn.gluten)} نفر بدون گلوتن`);
    if (dn.lactose) needs.push(`🥛 ${fa(dn.lactose)} نفر بدون لاکتوز`);
    if (A.allergies.length) needs.push(`⚠️ آلرژی در جمع: <b>${A.allergies.map(esc).join("، ")}</b> — موقع سفارش بپرسید`);
    if (A.noAlcPlace) needs.push(`🍵 ${fa(A.noAlcPlace)} نفر جای بدون الکل را ترجیح می‌دهند → کافه یا رستوران، نه بار`);
    if (A.smokeBothers) needs.push(`😷 دود سیگار ${fa(A.smokeBothers)} نفر را اذیت می‌کند → داخل بنشینید، نه تراس سیگاری${A.smokers?` (${fa(A.smokers)} نفر سیگاری‌اند؛ برای سیگار بیرون بروند)`:""}`);
    if (A.weedNot) needs.push(`🙅‍♀️ ${fa(A.weedNot)} نفر نمی‌خواهند کنار ماری‌جوانا باشند → کافی‌شاپ (coffeeshop) نه`);
    if (A.quiet) needs.push(`🤫 ${fa(A.quiet)} نفر جای آرام می‌خواهند`);
    if (A.access) needs.push(`♿ ${fa(A.access)} نفر نیاز خاص برای جا دارند (بدون پله / جای نشستن) — قبلش چک کنید`);
    if (A.budget) needs.push(`💶 بودجه: <b>${BUDGET_L[A.budget]}</b> (پایین‌ترین بودجهٔ جمع)`);
    if (A.noPhoto || A.noFace) needs.push(`📸 ${fa(A.noPhoto+A.noFace)} نفر نمی‌خواهند عکس صورتشان جایی پست شود → قبل از استوری بپرسید`);
    if (A.noFa) needs.push(`🗣️ ${fa(A.noFa)} نفر فارسی بلد نیستند → گاهی انگلیسی/هلندی`);
    if (A.earliestUntil) needs.push(`🕘 بعضی‌ها فقط تا ساعت ${fa(A.earliestUntil)} می‌توانند بمانند`);
    if (A.nightCare) needs.push(`🌙 ${fa(A.nightCare)} نفر ترجیح می‌دهند در تاریکی تنها برنگردند → برنامهٔ روز یا هم‌مسیر شدن برای برگشت`);
    if (A.cars && A.noCar) needs.push(`🚗 ${fa(A.cars)} نفر ماشین دارند${A.seats?` و روی‌هم ${fa(A.seats)} جای خالی`:""} — ببینید در «آدم‌ها» چه کسی سر راه است`);
    const actTop = A.actsSorted.slice(0,4);
    return `
      <div class="card">
        <h2>📅 بهترین روز و ساعت پیشنهادی</h2>
        ${A.slots.length ? A.slots.map((s,k)=>`<div class="slot"><span class="lbl">${k===0?"⭐ ":""}${esc(fmtOpt(s.o))}</span>
          <span class="meter"><i style="width:${A.n?s.y/A.n*100:0}%"></i></span>
          <span class="tiny" style="min-width:92px">${fa(s.y)} می‌تونن${s.m?` · ${fa(s.m)} شاید`:""}</span></div>`).join("") : ""}
        ${best && best.y === A.n ? `<div class="okbox">همه می‌توانند روز ${esc(fmtOpt(best.o))} 🎉</div>` : ""}
        ${A.winSorted.length ? `
          <div style="margin-top:${A.slots.length?10:0}px">
            <b class="tiny">🗓️ بهترین بازه‌های زمانی مشترک از روی ساعت‌های آزاد بچه‌ها:</b>
            ${A.winSorted.slice(0,5).map((w,k)=>`<div class="slot"><span class="lbl">${k===0?"⭐ ":""}${esc(fmtWin(w.w))}</span>
              <span class="meter"><i style="width:${A.n?w.count/A.n*100:0}%"></i></span>
              <span class="tiny" style="min-width:110px">${fa(w.count)} نفر (${esc(w.names.join("، "))})</span></div>`).join("")}
          </div>` : (!A.slots.length ? `<p class="muted">وقتی بچه‌ها ساعت‌ها و روزهای آزادشان را در فرم علامت بزنند، بهترین زمان مشترک اینجا پیشنهاد می‌شود.</p>` : "")}
        ${A.freeNotes.length ? `<div style="margin-top:8px">${A.freeNotes.map(fn=>`<div class="tiny">⏰ <b>${esc(fn.name)}:</b> ${esc(fn.note)}</div>`).join("")}</div>` : ""}
        ${(A.timeLocNotes && A.timeLocNotes.length) ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)"><b class="tiny">🔗 مکان‌های متصل به زمانِ بچه‌ها:</b>${A.timeLocNotes.map(tl=>`<div class="tiny">📍 <b>${esc(tl.name)}:</b> ${esc(tl.text)}</div>`).join("")}</div>` : ""}
      </div>
      <div class="card">
        <h2>📍 منصفانه‌ترین شهر برای همه</h2>
        <p class="muted">بر اساس شهر، لوکیشن‌های انتخابی و وسیلهٔ ${fa(A.withO)} نفر؛ هدف این است که راه <b>هیچ‌کس</b> خیلی طولانی نشود.</p>
        ${top.map((t,k)=>`<div class="hub ${k===0?"best":""}">
          <div class="t"><b>${k===0?"🥇":k===1?"🥈":"🥉"} ${esc(t.h.fa)} <span class="tiny ltr">${esc(t.h.nl)}</span></b>
            <button class="btn sm ${k===0?"":"ghost"}" data-venues="${t.h.key}">پیدا کردن جا</button></div>
          <div class="tiny">طولانی‌ترین راه حدود <b>${fa(Math.round(t.maxT))}</b> دقیقه · میانگین ${fa(Math.round(t.avg))} دقیقه
          ${t.votes?` · <b>${fa(t.votes)} نفر</b> این لوکیشن را انتخاب کرده‌اند`:""}
          ${t.over?` · <span style="color:var(--warn)">برای ${fa(t.over)} نفر بیشتر از سقفشان</span>`:` · <span style="color:var(--ok)">همه زیر سقف خودشان ✓</span>`}</div>
        </div>`).join("")}
        <div id="map"></div>
        <div class="map-legend">
          <span><i class="map-dot" style="background:#6C5CE7"></i>محدوده و مبدأ بچه‌ها</span>
          <span><i class="map-dot" style="background:#00B894"></i>محدودهٔ شهرهای پیشنهادی (⭐ بهترین نقطهٔ مشترک)</span>
        </div>
      </div>
      <div id="venues"></div>
      ${actTop.length?`<div class="card"><h2>✨ چه کاری بیشتر رأی آورده</h2><div class="chips">${actTop.map(([k,c])=>`<span class="pill">${esc((ACTIVITIES.find(a=>a[0]===k)||[,k])[1])} · ${fa(c)}</span>`).join("")}</div></div>`:""}
      ${needs.length?`<div class="card"><h2>📝 جا باید این‌طوری باشد</h2>${needs.map(x=>`<div class="kv" style="margin:6px 0">${x}</div>`).join("")}<p class="tiny">این‌ها بی‌نام‌اند؛ اسم کسی کنارشان نیست.</p></div>`:""}
      ${ADMIN?`<div class="card"><h2>🔑 تو برگزارکننده‌ای</h2><p class="muted">وقتی تصمیم گرفتید، از تب «دعوت» روز و جا را قطعی کن تا برای همه بالای صفحه بیاید.</p><button class="btn ghost sm" data-tab2="share">رفتن به قطعی کردن</button></div>`:""}`;
  }
  function bindResult(A){
    root.querySelectorAll("[data-venues]").forEach(b => b.onclick = () => findVenues(cityByKey(b.dataset.venues), A));
    root.querySelectorAll("[data-tab2]").forEach(b => b.onclick = () => { TAB = b.dataset.tab2; resultPage(); });
    if (!$("#map")) return;
    getL().then(L => { if (!L || !$("#map") || dead) return; try {
      if (MAP) { MAP.remove(); MAP = null; }
      MAP = L.map("map", {zoomControl:true, attributionControl:true});
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, attribution:"© OpenStreetMap"}).addTo(MAP);
      const pts = [];
      const groups = {};
      (M.anon||[]).forEach(r => {
        if (r.origin && r.origin.lat) {
          const k = r.origin.lat+","+r.origin.lng;
          const maxMin = Number(r.max_min) || 45;
          groups[k] = groups[k] || {lat:r.origin.lat,lng:r.origin.lng,n:0,fa:r.origin.fa,maxMin};
          groups[k].n++;
          groups[k].maxMin = Math.max(groups[k].maxMin, maxMin);
        }
      });
      const bestHub = A.hubs[0]?.h;
      Object.values(groups).forEach(g => {
        // Shaded reach zone circle around each origin group
        const rad = Math.max(10000, Math.min(60000, g.maxMin * 650));
        L.circle([g.lat, g.lng], {radius:rad, color:"#6C5CE7", fillColor:"#6C5CE7", fillOpacity:.10, weight:1.5, dashArray:"5 5"}).addTo(MAP);
        if (bestHub) {
          L.polyline([[g.lat, g.lng], [bestHub.lat, bestHub.lng]], {color:"#6C5CE7", weight:2, opacity:.45, dashArray:"4 6"}).addTo(MAP);
        }
        L.circleMarker([g.lat,g.lng], {radius:8+g.n*3, color:"#fff", fillColor:"#6C5CE7", fillOpacity:.9, weight:2})
          .addTo(MAP)
          .bindTooltip(`${esc(g.fa)} (${fa(g.n)})`, {permanent:true, direction:"top", offset:[0,-6]});
        pts.push([g.lat,g.lng]);
      });
      A.hubs.slice(0,3).forEach((t,k) => {
        L.circle([t.h.lat, t.h.lng], {
          radius: k === 0 ? 9000 : 6500,
          color: k === 0 ? "#00B894" : "#6C5CE7",
          fillColor: k === 0 ? "#00B894" : "#6C5CE7",
          fillOpacity: k === 0 ? 0.22 : 0.12,
          weight: 2
        }).addTo(MAP);
        L.marker([t.h.lat,t.h.lng], {icon: L.divIcon({html:`<div style="font-size:${k?20:28}px;line-height:1">${k?"📍":"⭐"}</div>`, className:"", iconSize:[28,28], iconAnchor:[14,24]})}).addTo(MAP).bindPopup(esc(t.h.fa));
        pts.push([t.h.lat,t.h.lng]);
      });
      if (pts.length) MAP.fitBounds(pts, {padding:[30,30], maxZoom:11}); else MAP.setView([52.0,4.5], 9);
    } catch(e){} });
  }

  /* ============ venue finder (OpenStreetMap, free) ============ */
  async function findVenues(hub, A){
    const box = $("#venues");
    box.innerHTML = `<div class="card"><h2>🍽️ جاهای نزدیک ایستگاه ${esc(hub.fa)}</h2><p class="muted"><span class="spin"></span> دارم در نقشهٔ آزاد (OpenStreetMap) می‌گردم… بار اول ممکن است تا نیم دقیقه طول بکشد.</p></div>`;
    box.scrollIntoView({behavior:"smooth", block:"start"});
    const needHalal = !!A.dietC.halal, needVeg = !!(A.dietC.vegetarian || A.dietC.vegan), needVegan = !!A.dietC.vegan;
    const q = `[out:json][timeout:25];(nwr(around:1100,${hub.lat},${hub.lng})["amenity"~"^(cafe|restaurant)$"]["name"];);out center 150;`;
    const quick = `
      <div class="row" style="margin-top:6px">
        <a class="btn line sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent("Persian restaurant near "+hub.nl)}">🍢 رستوران ایرانی</a>
        ${needHalal?`<a class="btn line sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent("halal restaurant near "+hub.nl)}">حلال</a>`:""}
        ${needVeg?`<a class="btn line sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent("vegetarian restaurant near "+hub.nl)}">گیاهی</a>`:""}
        <a class="btn line sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent("cozy cafe near "+hub.nl)}">☕ کافه</a>
        <a class="btn line sm" target="_blank" rel="noopener" href="https://9292.nl/">🚆 مسیر با 9292</a>
      </div>`;
    let els = [];
    // 1) our server (cached, three mirrors, Photon fallback)  2) straight from the browser as a last try
    try {
      const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 40000);
      const r = await fetch(`/api/d/places?lat=${hub.lat}&lng=${hub.lng}`, {signal:ac.signal});
      clearTimeout(tm);
      if (r.ok) els = ((await r.json()).venues || []).map(v => ({lat:v.lat, lon:v.lng, tags:{name:v.name, amenity:v.amenity, cuisine:v.cuisine,
        "diet:halal":v.halal, "diet:vegetarian":v.vegetarian, "diet:vegan":v.vegan, wheelchair:v.wheelchair, outdoor_seating:v.outdoor,
        website:v.website, "addr:street":v.street}}));
    } catch(e){}
    if (!els.length && !dead) {
      try {
        const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 25000);
        const r = await fetch("https://overpass-api.de/api/interpreter?data="+encodeURIComponent(q), {signal:ac.signal});
        clearTimeout(tm);
        if (r.ok) els = (await r.json()).elements || [];
      } catch(e){}
    }
    if (dead) return;
    const MIDEAST = /persian|iranian|turkish|lebanese|middle_eastern|moroccan|kebab|arab|afghan|syrian|kurdish|falafel|halal/i;
    const scored = els.map(e => {
      const t = e.tags || {}; const lat = e.lat || (e.center||{}).lat, lng = e.lon || (e.center||{}).lon;
      let s = 0; const tags = [];
      const cuisine = t.cuisine || "";
      if (/persian|iranian/i.test(cuisine)) { s += 4; tags.push("🇮🇷 ایرانی"); }
      if (t["diet:halal"] === "yes" || t["diet:halal"] === "only") { s += needHalal?4:1; tags.push("حلال"); }
      else if (needHalal && MIDEAST.test(cuisine)) { s += 2; tags.push("احتمالاً حلال (بپرسید)"); }
      if (/^(yes|only)$/.test(t["diet:vegan"]||"")) { s += needVegan?4:needVeg?3:1; tags.push("وگان"); }
      else if (/^(yes|only)$/.test(t["diet:vegetarian"]||"")) { s += needVeg?3:1; tags.push("گیاهی"); }
      if (t.amenity === "cafe") { s += A.noAlcPlace ? 2 : 1; tags.push("کافه"); }
      if (t.wheelchair === "yes") { s += A.access?3:0; tags.push("♿ بدون پله"); }
      if (t.outdoor_seating === "yes") tags.push("تراس");
      if (A.budget === 1 && /fast_food|kebab|falafel/.test(cuisine)) s += 1;
      const d = lat ? km(hub, {lat, lng}) : 1;
      s += Math.max(0, 1.2 - d);
      return {name:t.name, cuisine, tags, s, lat, lng, d, amenity:t.amenity, site:t.website||t["contact:website"], street:[t["addr:street"],t["addr:housenumber"]].filter(Boolean).join(" ")};
    }).filter(x => x.name).sort((a,b) => b.s - a.s).slice(0, 12);
    const header = `<h2>🍽️ پیشنهاد جا نزدیک ایستگاه ${esc(hub.fa)}</h2>
      <p class="tiny">${needHalal?"حلال · ":""}${needVeg?"گیاهی · ":""}${A.noAlcPlace?"کافه/رستوران به‌جای بار · ":""}${A.access?"بدون پله · ":""}مرتب‌شده با نیازهای جمع</p>`;
    if (!scored.length) { box.innerHTML = `<div class="card">${header}<div class="note">الان جایی پیدا نشد (سرویس نقشهٔ آزاد شلوغ بود). چند دقیقهٔ دیگر دوباره «پیدا کردن جا» را بزن، یا با این دکمه‌ها در گوگل‌مپ بگرد:</div>${quick}</div>`; return; }
    box.innerHTML = `<div class="card">${header}
      ${scored.map(v => `<div class="venue"><div class="row"><b class="grow">${esc(v.name)}</b><span class="tiny">${fa(Math.round(v.d*12+1))} دقیقه پیاده</span></div>
        <div>${v.tags.map(t=>`<span class="pill ${/حلال|گیاهی|وگان|بدون پله/.test(t)?"g":""}">${esc(t)}</span>`).join("")}${v.cuisine?`<span class="tiny ltr"> ${esc(v.cuisine.replace(/_/g," "))}</span>`:""}</div>
        <div class="row" style="margin-top:4px">
          <a class="btn line sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name+" "+(v.street||"")+" "+hub.nl)}">نقشه و نظرها</a>
          ${v.site && /^https?:\/\//.test(v.site)?`<a class="btn line sm" target="_blank" rel="noopener" href="${esc(v.site)}">سایت/منو</a>`:""}
          ${ADMIN?`<button class="btn ghost sm" data-pick='${esc(JSON.stringify({venue:v.name,address:v.street,city:hub.key}))}'>انتخاب برای قطعی</button>`:""}
        </div></div>`).join("")}
      <p class="tiny">اطلاعات حلال/گیاهی از OpenStreetMap است و ممکن است کامل نباشد؛ قبل از رزرو بپرسید.</p>${quick}</div>`;
    box.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { store.set("dh_pick_"+CODE, JSON.parse(b.dataset.pick)); TAB = "share"; resultPage(); toast("در فرم قطعی کردن گذاشته شد"); });
  }

  /* ============ people ============ */
  function peopleTab(){
    if (!M.people.length) return `<div class="card center"><p class="muted">هنوز کسی نیست.</p></div>`;
    const ORDER = ["about","age","job","origin","can_cities","free_windows","free_note","modes","seats","max_min","hobbies","activities","langs","bring","diet","dislikes","allergy","alcohol","smoke","weed","photo","quiet","access","until","night_alone","contact","question"];
    return M.people.map(p => {
      const kp = KNOWN_PROFILES.find(x => x.name.toLowerCase() === (p.name||"").toLowerCase());
      const merged = {...(kp?.data || {}), ...p};
      const rows = ORDER.map(k => { const v = showVal(k, merged[k]); return v ? `<div class="kv"><b>${LABEL[k]}:</b> ${esc(v)}</div>` : ""; }).join("");
      const days = p.avail ? M.options.map((o,i)=>p.avail[i]==="yes"?fmtOpt(o):null).filter(Boolean) : [];
      return `<div class="card person"><div class="av" style="background:${colorOf(p.name)}">${esc([...p.name][0]||"?")}</div>
        <div class="grow"><div class="row" style="justify-content:space-between"><b style="font-size:16px">${esc(p.name)}</b><a class="tiny" href="/d?u=${encodeURIComponent(p.name)}">🔗 پروفایل</a></div>${rows || '<div class="tiny">بقیهٔ جواب‌ها را خصوصی نگه داشته 🔒</div>'}
        ${days.length?`<div class="kv"><b>می‌تواند:</b> ${esc(days.join(" · "))}</div>`:""}</div></div>`;
    }).join("") + `<p class="tiny center">هر کس فقط چیزهایی را نشان می‌دهد که خودش خواسته.</p>`;
  }

  /* ============ icebreakers ============ */
  function iceTab(A){
    const general = [
      "اولین چیزی که وقتی به هلند رسیدی تعجب‌زده‌ات کرد چه بود؟",
      "یک غذای ایرانی که اینجا دلت برایش تنگ می‌شود و جایی که بهترینش را پیدا کردی؟",
      "بهترین جای مخفی (کافه، پارک، ساحل) که در جنوب هلند پیدا کرده‌ای؟",
      "یک کلمهٔ هلندی که خیلی دوستش داری یا خنده‌دار است؟",
      "اگر یک روز کامل آزاد و بی‌پول‌نگرانی داشتی، اینجا چه کار می‌کردی؟",
      "یک مهارت که دوست داری امسال یاد بگیری؟",
      "یک چیز کوچک که این هفته حالت را خوب کرد؟",
      "سخت‌ترین و بامزه‌ترین تجربه‌ات با اداره‌جات هلند؟",
    ];
    const byHob = {"کتاب":"آخرین کتابی که نتوانستی زمینش بگذاری؟","موسیقی":"یک آهنگ که همه باید امشب گوش بدهیم؟","سفر":"بهترین سفر یک‌روزه از هلند با قطار؟","آشپزی":"یک غذا که با مواد سوپرمارکت هلندی ایرانی‌اش کرده‌ای؟","فیلم و سریال":"یک سریال که جدی جدی پیشنهاد می‌کنی؟","طبیعت":"سرسبزترین جایی که اینجا رفتی؟","رقص":"آهنگی که نمی‌توانی با آن نرقصی؟","زبان یاد گرفتن":"ترفندت برای هلندی یاد گرفتن چیست؟","روانشناسی":"یک ایده یا کتاب روانشناسی که زندگی‌ات را عوض کرد؟","عکاسی":"قشنگ‌ترین عکسی که این ماه گرفتی را نشان بده!"};
    const topH = A.hob.slice(0,4).map(([h]) => byHob[h]).filter(Boolean);
    const theirs = M.people.map(p => p.question ? {q:p.question, by:p.name} : null).filter(Boolean);
    const games = [
      ["🤥 دو حقیقت، یک دروغ","هر کس سه جمله دربارهٔ خودش می‌گوید؛ بقیه حدس می‌زنند کدام دروغ است."],
      ["🔤 اسم‌فامیل هلندی","اسم‌فامیل کلاسیک، ولی یک ستون «کلمهٔ هلندی» هم دارد."],
      ["🎵 مشاعره با آهنگ","به‌جای شعر، با آخرین حرف یک آهنگ فارسی، آهنگ بعدی را شروع کنید."],
      ["🕵️ مافیا (اگر ۶ نفر یا بیشتر هستید)","یک نفر گرداننده، بقیه با کارت نقش. همیشه جواب می‌دهد!"],
      ["📍 نقشهٔ مشترک","هر کس یک جای محبوبش در هلند را می‌گوید؛ آخرش یک لیست برای دورهمی‌های بعدی دارید."],
    ];
    return `
      ${theirs.length?`<div class="card"><h2>💬 سؤال‌هایی که خود بچه‌ها پرسیده‌اند</h2>${theirs.map(t=>`<div class="ib">${esc(t.q)} <span class="tiny">— ${esc(t.by)}</span></div>`).join("")}</div>`:""}
      ${topH.length?`<div class="card"><h2>🎯 بر اساس علاقه‌های مشترک جمع</h2>${topH.map(q=>`<div class="ib">${esc(q)}</div>`).join("")}</div>`:""}
      <div class="card"><h2>🧊 سؤال برای شروع صحبت</h2>${general.map(q=>`<div class="ib">${esc(q)}</div>`).join("")}</div>
      <div class="card"><h2>🎲 بازی‌های کوتاه</h2>${games.map(([t,d])=>`<div class="ib"><b>${t}</b><br><span class="tiny">${d}</span></div>`).join("")}</div>`;
  }

  /* ============ organizer ============ */
  function adminBox(A){
    const f = M.final || {};
    const pick = store.get("dh_pick_"+CODE) || {};
    const bestSlot = A.slots[0], bestHub = A.hubs[0];
    const sel = (bestSlot && !f.d) ? bestSlot.i : M.options.findIndex(o => o.d === f.d && o.t === f.t);
    const defaultDate = f.d || new Date(Date.now() + 2*86400000).toISOString().slice(0,10);
    const isArchived = Boolean(M.is_archived || M.final?.archived);
    const expDate = M.expires_at || M.final?.expires_at;
    const expVal = expDate ? String(expDate).slice(0, 10) : "";
    const loc = f.location || { mode: "flexible", city: "", radius_km: 10, place: "" };
    const locModeInit = loc.mode || "flexible";

    return `
      <div class="card" id="a_manage_card">
        <h2 style="margin:0 0 6px">⚙️ مدیریت ایونت (ویرایش، آرشیو و حذف)</h2>
        <p class="tiny muted" style="margin-bottom:10px">فقط تو به عنوان برگزارکننده این بخش را می‌بینی:</p>
        <div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap;justify-content:flex-start">
          <button type="button" class="btn ghost sm" id="a_btn_edit">✏️ ویرایش مشخصات و مکان</button>
          <button type="button" class="btn line sm" id="a_btn_archive">
            ${isArchived ? "📤 بازگردانی از آرشیو" : "📦 آرشیو کردن دورهمی"}
          </button>
          <button type="button" class="btn line sm" id="a_delete" style="color:var(--bad);border-color:#f5c2c2">🗑️ پاک کردن کل دورهمی</button>
        </div>

        <div id="a_edit_box" style="display:none;background:#f9f8fe;border:1.5px solid #ded7f2;border-radius:14px;padding:12px;margin-top:8px">
          <label class="f" style="margin-top:0">عنوان یا موضوع دورهمی</label>
          <input type="text" id="ae_title" maxlength="80" value="${esc(M.title || "")}">
          <label class="f">توضیح کوتاه</label>
          <input type="text" id="ae_note" maxlength="300" value="${esc(M.note || "")}">

          <label class="f">📍 مکان یا محدودهٔ پیشنهادی</label>
          <select id="ae_loc_mode" style="margin-bottom:8px">
            <option value="flexible" ${locModeInit==="flexible"?"selected":""}>🗺️ پیشنهاد جمع (پیدا کردن منصفانه‌ترین مکان وسط)</option>
            <option value="area" ${locModeInit==="area"?"selected":""}>📍 محدوده / شهر پیشنهادی</option>
            <option value="exact" ${locModeInit==="exact"?"selected":""}>🏠 مکان مشخص</option>
          </select>
          <div id="ae_loc_fields" style="display:${locModeInit==="flexible"?"none":"block"};margin-bottom:8px;padding:10px;background:#fff;border:1px solid #e7e2f5;border-radius:12px">
            <div class="row" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:120px">
                <label class="f" style="margin-top:0;font-size:12.5px">شهر</label>
                <select id="ae_loc_city">
                  <option value="">انتخاب شهر…</option>
                  ${CITIES.map(c => `<option value="${c.key}" ${loc.city===c.key?"selected":""}>${esc(c.fa)}</option>`).join("")}
                </select>
              </div>
              <div id="ae_loc_rad_wrap" style="flex:1;min-width:120px;display:${locModeInit==="area"?"block":"none"}">
                <label class="f" style="margin-top:0;font-size:12.5px">شعاع محدوده</label>
                <select id="ae_loc_rad">
                  ${[5,10,20,40].map(r => `<option value="${r}" ${(loc.radius_km||10)===r?"selected":""}>تا ${fa(r)} کیلومتر</option>`).join("")}
                </select>
              </div>
            </div>
            <label class="f" style="margin-top:0;font-size:12.5px">اسم مکان یا محله (اختیاری)</label>
            <input type="text" id="ae_loc_place" maxlength="140" value="${esc(loc.place || "")}" placeholder="مثلاً: اطراف ایستگاه مرکزی یا اسم کافه…">
          </div>

          <label class="f">⏰ تاریخ انقضا / مهلت (اختیاری)</label>
          <input type="date" id="ae_expires" value="${esc(expVal)}">
          <span class="tiny" id="ae_expires_lbl" style="color:var(--p);font-weight:600;display:block;margin-top:4px">${expVal ? `📅 ${fmtDate(expVal)}` : ""}</span>
          <span class="tiny" style="color:var(--muted);display:block;margin-bottom:10px">بعد از این تاریخ، ایونت خودکار از دید عموم برداشته می‌شود.</span>
          <div class="opt ${M.women_only ? "on" : ""}" id="ae_wo" style="margin-bottom:10px"><span class="e">👩</span><div><b>فقط برای خانم‌ها</b></div></div>
          <div class="row" style="gap:8px;margin-top:8px;justify-content:flex-start">
            <button type="button" class="btn sm" id="ae_save">💾 ذخیرهٔ تغییرات</button>
            <button type="button" class="btn line sm" id="ae_cancel">انصراف</button>
          </div>
        </div>
      </div>

      <div class="card"><h2>🔑 قطعی کردن زمان و مکان</h2>
        <label class="f">روز</label>
        ${M.options.length
          ? `<select id="a_slot">${M.options.map((o,i)=>`<option value="${i}" ${i===sel?"selected":""}>${esc(fmtOpt(o))}${A.slots.find(s=>s.i===i)?` — ${fa(A.slots.find(s=>s.i===i).y)} نفر می‌تونن`:""}</option>`).join("")}</select>`
          : `<input type="date" id="a_date" value="${esc(defaultDate)}">`}
        <label class="f">ساعت</label><input type="time" id="a_time" value="${esc(f.t || (M.options[Math.max(sel,0)]||{}).t || "16:00")}">
        <label class="f">شهر</label>
        <select id="a_city">${CITIES.filter(c=>c.meet).map(c=>`<option value="${c.key}" ${(pick.city||f.city||loc.city||(bestHub&&bestHub.h.key))===c.key?"selected":""}>${esc(c.fa)}</option>`).join("")}</select>
        <label class="f">اسم جا</label><input type="text" id="a_venue" maxlength="100" value="${esc(pick.venue||f.venue||(loc.mode==="exact"?loc.place:"")||"")}" placeholder="مثلاً: کافه مرکزی یا پارک">
        <label class="f">آدرس (اختیاری)</label><input type="text" id="a_addr" maxlength="150" value="${esc(pick.address||f.address||"")}">
        <label class="f">یادداشت برای همه (اختیاری)</label><input type="text" id="a_note" maxlength="200" value="${esc(f.note||"")}" placeholder="مثلاً: جلوی در ایستگاه همدیگر را ببینیم">
        <button class="btn block" id="a_go" style="margin-top:12px">✅ قطعی کن</button>
        ${isFinalized(M.final)?`<button class="btn line sm" id="a_clear" style="margin-top:8px">برداشتن قطعی</button>`:""}
      </div>`;
  }
  function bindAdmin(A){
    if (!ADMIN || !$("#a_go")) return;
    if ($("#a_slot")) $("#a_slot").onchange = () => { const o = M.options[+$("#a_slot").value]; if (o && o.t) $("#a_time").value = o.t; };
    $("#a_go").onclick = async () => {
      const o = $("#a_slot") ? M.options[+$("#a_slot").value] : {d: ($("#a_date")||{}).value || new Date().toISOString().slice(0,10)};
      const fin: any = {
        d: o.d,
        t: $("#a_time").value,
        city: $("#a_city").value,
        venue: $("#a_venue").value.trim(),
        address: $("#a_addr").value.trim(),
        note: $("#a_note").value.trim(),
      };
      if (M.final?.archived || M.is_archived) fin.archived = true;
      if (M.final?.expires_at || M.expires_at) fin.expires_at = M.final?.expires_at || M.expires_at;
      if (M.final?.location) fin.location = M.final.location;
      if (M.final?.audience) fin.audience = M.final.audience;
      try { await rpc("dh_finalize", {p_code:CODE, p_admin:ADMIN, p_final:fin}); toast("قطعی شد ✓");
        const city = (cityByKey(fin.city)||{}).fa || "";
        const txt = `✅ «${M.title}» قطعی شد:\n📅 ${fmtDate(fin.d)} ساعت ${fin.t}\n📍 ${fin.venue}${city?" — "+city:""}\nجزئیات و تقویم: ${linkFor(CODE)}`;
        M.final = fin; profilesLoaded = false; TAB = "result"; resultPage();
        setTimeout(() => { if (confirm("پیامش را برای گروه در واتس‌اپ بفرستم؟")) window.open("https://wa.me/?text="+encodeURIComponent(txt), "_blank"); }, 300);
      } catch(e){ toast(errMsg(e)); }
    };
    if ($("#a_clear")) $("#a_clear").onclick = async () => {
      const keepMeta: any = {};
      if (M.final?.archived || M.is_archived) keepMeta.archived = true;
      if (M.final?.expires_at || M.expires_at) keepMeta.expires_at = M.final?.expires_at || M.expires_at;
      if (M.final?.location) keepMeta.location = M.final.location;
      if (M.final?.audience) keepMeta.audience = M.final.audience;
      const nextFinal = Object.keys(keepMeta).length ? keepMeta : null;
      try { await rpc("dh_finalize", {p_code:CODE, p_admin:ADMIN, p_final:nextFinal}); M.final = nextFinal; profilesLoaded = false; resultPage(); } catch(e){ toast(errMsg(e)); }
    };
    
    // Edit meetup
    const editBtn = $("#a_btn_edit");
    const editBox = $("#a_edit_box");
    if (editBtn && editBox) {
      editBtn.onclick = () => {
        editBox.style.display = editBox.style.display === "none" ? "block" : "none";
      };
      if ($("#ae_loc_mode")) {
        $("#ae_loc_mode").onchange = (e) => {
          const v = e.target.value;
          if ($("#ae_loc_fields")) $("#ae_loc_fields").style.display = v === "flexible" ? "none" : "block";
          if ($("#ae_loc_rad_wrap")) $("#ae_loc_rad_wrap").style.display = v === "area" ? "block" : "none";
        };
      }
      if ($("#ae_expires")) {
        $("#ae_expires").oninput = (e) => {
          const v = e.target.value;
          if ($("#ae_expires_lbl")) $("#ae_expires_lbl").textContent = v ? `📅 ${fmtDate(v)}` : "";
        };
      }
      let woVal = Boolean(M.women_only);
      if ($("#ae_wo")) $("#ae_wo").onclick = () => {
        woVal = !woVal;
        $("#ae_wo").classList.toggle("on", woVal);
      };
      if ($("#ae_cancel")) $("#ae_cancel").onclick = () => {
        editBox.style.display = "none";
      };
      if ($("#ae_save")) $("#ae_save").onclick = async () => {
        const title = ($("#ae_title")?.value || "").trim();
        if (!title) return toast("عنوان نمی‌تواند خالی باشد");
        const note = ($("#ae_note")?.value || "").trim();
        const expires_at = $("#ae_expires")?.value || null;
        const aeMode = $("#ae_loc_mode")?.value || "flexible";
        let locPayload = null;
        if (aeMode !== "flexible") {
          const cityKey = $("#ae_loc_city")?.value || "";
          const cityObj = cityKey ? cityByKey(cityKey) : null;
          const placeVal = ($("#ae_loc_place")?.value || "").trim();
          const radVal = aeMode === "area" ? Number($("#ae_loc_rad")?.value || 10) : undefined;
          if (cityKey || placeVal) {
            locPayload = {
              mode: aeMode,
              city: cityKey,
              city_label: cityObj ? cityObj.fa : "",
              radius_km: radVal,
              place: placeVal,
            };
          }
        }
        const b = $("#ae_save"); b.disabled = true; b.innerHTML = `<span class="spin"></span>`;
        try {
          const res = await fetch("/api/d/manage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: CODE, admin_token: ADMIN, action: "edit", title, note, expires_at, women_only: woVal, location: locPayload })
          });
          const j = await res.json();
          if (!res.ok || j.error) throw new Error(j.error || "ذخیره نشد");
          M.title = title; M.note = note; M.women_only = woVal; M.expires_at = j.expires_at || expires_at;
          if (!M.final) M.final = {};
          M.final.expires_at = j.expires_at || expires_at;
          M.final.location = j.location ?? locPayload;
          const s = store.get("dh_"+CODE) || {};
          store.set("dh_"+CODE, {...s, title, location: j.location ?? locPayload});
          profilesLoaded = false;
          toast("تغییرات ذخیره شد ✓");
          resultPage();
        } catch(e){
          toast(errMsg(e));
          b.disabled = false;
          b.textContent = "💾 ذخیرهٔ تغییرات";
        }
      };
    }

    // Archive / Unarchive meetup
    const arcBtn = $("#a_btn_archive");
    if (arcBtn) {
      arcBtn.onclick = async () => {
        const isArchived = Boolean(M.is_archived || M.final?.archived);
        const msg = isArchived
          ? "این دورهمی از آرشیو خارج شده و دوباره فعال شود؟"
          : "این دورهمی آرشیو شود؟ (از لیست عمومی پنهان می‌شود اما با لینک قابل دسترسی است)";
        if (!confirm(msg)) return;
        arcBtn.disabled = true;
        try {
          const res = await fetch("/api/d/manage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: CODE, admin_token: ADMIN, action: "archive", is_archived: !isArchived })
          });
          const j = await res.json();
          if (!res.ok || j.error) throw new Error(j.error || "عملیات انجام نشد");
          M.is_archived = !isArchived;
          if (!M.final) M.final = {};
          M.final.archived = !isArchived;
          profilesLoaded = false;
          toast(!isArchived ? "دورهمی آرشیو شد 📦" : "دورهمی فعال شد 📤");
          resultPage();
        } catch(e){
          toast(errMsg(e));
          arcBtn.disabled = false;
        }
      };
    }

    // Delete meetup
    $("#a_delete").onclick = async () => {
      if (!confirm("کل دورهمی و همهٔ جواب‌ها برای همیشه پاک شود؟")) return;
      try {
        let deleted = false;
        try {
          const res = await fetch("/api/d/manage", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: CODE, admin_token: ADMIN, action: "delete" })
          });
          if (res.ok) deleted = true;
        } catch(e){}
        if (!deleted) {
          await rpc("dh_delete_meetup", {p_code:CODE, p_admin:ADMIN});
          deleted = true;
        }
        try { localStorage.removeItem("dh_"+CODE); } catch(e){}
        profilesLoaded = false;
        toast("دورهمی پاک شد ✓");
        go("/d");
      } catch(e){ toast(errMsg(e)); }
    };
  }


  // in-app links: <a href="/d…"> navigate without a full reload
  const onClick = (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    const h = a && a.getAttribute("href");
    if (!a || a.target || a.dataset.ext || e.metaKey || e.ctrlKey || !(h === "/d" || h.startsWith("/d/") || h.startsWith("/d?"))) return;
    e.preventDefault(); go(a.getAttribute("href"));
  };
  root.addEventListener("click", onClick);
  window.addEventListener("popstate", route);
  claimGuestWork().finally(route);
  return () => { dead = true; root.removeEventListener("click", onClick); window.removeEventListener("popstate", route); if (MAP) { try { MAP.remove(); } catch(e){} } clearAuxMaps(); };
}
