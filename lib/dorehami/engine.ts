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
  const fmtDate = d => { try { return new Intl.DateTimeFormat("fa-IR-u-ca-gregory",{weekday:"long",day:"numeric",month:"long"}).format(new Date(d+"T12:00:00")); } catch(e){ return d; } };
  const fmtOpt = o => `${fmtDate(o.d)}${o.t ? " · ساعت " + fa(o.t) : ""}`;
  const COLORS = ["#5b2a86","#c2185b","#00796b","#ef6c00","#3949ab","#6d4c41","#2e7d32","#ad1457","#0277bd","#7b1fa2"];
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
  const LABEL = {
    origin:"از کجا میاد", modes:"وسیله", seats:"جای خالی در ماشین", max_min:"حداکثر زمان راه", avail:"وقت‌ها", until:"تا کی می‌ماند",
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
    return `<div class="topbar"><a href="${USER ? "/out" : "/login"}" data-ext="1">🌿 همراه</a>${USER
      ? `<a href="/out" data-ext="1">بریم بیرون ←</a>`
      : `<a href="/login" data-ext="1" data-login="1">ورود / ساخت حساب</a>`}</div>`;
  }
  // remember where to come back after login (middleware reads hamrah_next)
  function bindLoginLinks(){
    root.querySelectorAll("[data-login]").forEach(a => a.addEventListener("click", () => {
      document.cookie = `hamrah_next=${location.pathname}; path=/; max-age=3600; samesite=lax`;
    }));
  }
  function memberCard(){
    if (USER) {
      if (M.plan_id) return `<div class="card"><h2>💬 گفتگوی گروه در همراه</h2><p class="muted">این دورهمی در «بریم بیرون» هم هست: گفتگو، رأی، یادآوری.</p><a class="btn block" href="/out/p/${esc(M.plan_id)}" data-ext="1">رفتن به گفتگو ←</a></div>`;
      if (M.has_plan) return `<div class="card"><h2>💬 گفتگوی گروه در همراه</h2><p class="muted">برگزارکننده برای این دورهمی گفتگوی گروهی ساخته.</p>${M.my_edit?`<button class="btn block" id="dh_join">پیوستن به گفتگو</button>`:`<p class="tiny">اول فرم را پر کن، بعد می‌توانی بپیوندی.</p>`}</div>`;
      if (ADMIN) return `<div class="card"><h2>💬 ادامه در همراه</h2><p class="muted">یک برنامهٔ «بریم بیرون» با گفتگوی گروهی می‌سازم. هر کس با حساب همراه فرم را پر کرده خودکار اضافه می‌شود؛ بقیه با همین لینک بعداً می‌پیوندند.</p><button class="btn block" id="dh_plan">ساخت گفتگوی گروه ✨</button></div>`;
      return "";
    }
    return `<div class="card"><h2>🌿 با حساب «همراه» بهتر است</h2><p class="muted">جواب‌هایت برای دورهمی‌های بعدی می‌ماند، در گفتگوی گروه شرکت می‌کنی و یادآوری می‌گیری. اجباری نیست.</p><a class="btn ghost block" href="/login" data-ext="1" data-login="1">ورود یا ساخت حساب</a></div>`;
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
    bindLoginLinks();
  }

  /* ============ home / create ============ */
  async function homePage(){
    let mine = localItems();
    if (USER) {
      try {
        const server = await rpc("dh_my_meetups", {}) || [];
        const seen = new Set(server.map(x => x.code));
        mine = [...server.map(x => ({code:x.code, title:x.title, admin:x.is_admin ? "account" : null, final:x.final, count:x.count})),
                ...mine.filter(x => !seen.has(x.code))];
      } catch(e){}
    }
    if (dead) return;
    app.innerHTML = topbar() + `
      <header class="top"><span class="logo">🌿</span><div><b>دورهمی</b><small>از خانوادهٔ «همراه»</small></div></header>
      <div class="card">
        <div class="hero-e">👯‍♀️🗺️</div>
        <h1>یک دورهمی بساز، لینکش را در گروه بفرست</h1>
        <p class="muted">هر کس حدود ۳ دقیقه فرم پر می‌کند: از کجا میاد، با چه وسیله‌ای، کی وقت دارد، چی می‌خورد و با چی راحت است. «همراه» شهری را پیدا می‌کند که راهش برای همه منصفانه باشد، بهترین روز را نشان می‌دهد و جای مناسب پیشنهاد می‌کند. هیچ‌کس لازم نیست ثبت‌نام کند.</p>
      </div>
      <div class="card">
        <h2>۱. اسم دورهمی</h2>
        <input type="text" id="c_title" maxlength="80" placeholder="مثلاً: دورهمی دخترای جنوب هلند ✨">
        <label class="f">اسم تو (برگزارکننده)</label>
        <input type="text" id="c_org" maxlength="40" placeholder="مثلاً مریم">
        <label class="f">یک خط توضیح (اختیاری)</label>
        <textarea id="c_note" maxlength="500" placeholder="مثلاً: بیایید قبل از کریسمس همدیگر را ببینیم 🎄"></textarea>
      </div>
      <div class="card">
        <h2>۲. چند روز و ساعت پیشنهادی</h2>
        <p class="muted">بچه‌ها برای هر کدام می‌گویند «می‌تونم»، «شاید» یا «نه».</p>
        <div id="c_opts"></div>
        <button class="btn ghost sm" id="c_add" style="margin-top:8px">+ یک روز دیگر</button>
      </div>
      <div class="card">
        <div class="opt" id="c_wo"><span class="e">👩</span><div><b>این دورهمی فقط برای خانم‌هاست</b><span>روی صفحهٔ دعوت نوشته می‌شود</span></div></div>
      </div>
      <div id="c_err"></div>
      <button class="btn block" id="c_go">بساز و لینک بگیر ✨</button>
      ${mine.length ? `<div class="card" style="margin-top:16px"><h2>دورهمی‌هایی که اینجا ساختی یا پر کردی</h2>${mine.map(m=>`<div class="row" style="padding:6px 0"><a class="grow" href="/d/${esc(m.code)}${m.admin && m.admin !== "account"?`?admin=${esc(m.admin)}`:""}">${esc(m.title)}</a>${m.final?'<span class="pill g">قطعی</span>':""}${m.admin?'<span class="pill">برگزارکننده</span>':""}</div>`).join("")}</div>` : ""}
    `;
    bindLoginLinks();
    if (USER) $("#c_org").value = USER.name || "";
    const opts = [];
    const addOpt = (d="", t="15:00") => { opts.push({d,t}); drawOpts(); };
    function drawOpts(){
      $("#c_opts").innerHTML = opts.map((o,i)=>`
        <div class="row" style="margin-bottom:8px">
          <input type="date" data-i="${i}" data-k="d" value="${esc(o.d)}" style="flex:1.3">
          <input type="time" data-i="${i}" data-k="t" value="${esc(o.t)}" style="flex:1">
          ${opts.length>1?`<button class="btn line sm" data-del="${i}" aria-label="حذف">✕</button>`:""}
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
    let wo = false;
    $("#c_wo").onclick = e => { wo = !wo; e.currentTarget.classList.toggle("on", wo); };
    $("#c_go").onclick = async () => {
      const title = $("#c_title").value.trim() || "دورهمی ✨";
      const good = opts.filter(o => o.d).slice(0,10);
      if (!good.length) { $("#c_err").innerHTML = `<div class="err">حداقل یک روز انتخاب کن.</div>`; return; }
      const b = $("#c_go"); b.disabled = true; b.innerHTML = `<span class="spin"></span>`;
      try {
        const r = await rpc("dh_create", {p_title:title, p_note:$("#c_note").value, p_organizer:$("#c_org").value, p_options:good, p_women_only:wo});
        store.set("dh_"+r.code, {title, admin:r.admin_token});
        go(`/d/${r.code}?admin=${r.admin_token}&new=1`);
      } catch(e){ $("#c_err").innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; b.disabled=false; b.textContent="بساز و لینک بگیر ✨"; }
    };
  }

  /* ============ meetup page ============ */
  let M = null, CODE = null, ADMIN = null, TAB = "result", MAP = null;
  async function meetupPage(code, q){
    CODE = code; ADMIN = q.get("admin") || (store.get("dh_"+code)||{}).admin || null;
    app.innerHTML = `<div class="center" style="padding:60px 0"><span class="spin"></span></div>`;
    try { M = await rpc("dh_get", {p_code:code, p_admin:ADMIN}); }
    catch(e){ app.innerHTML = `<div class="card"><div class="err">${esc(errMsg(e))}</div><a class="btn" href="/d">صفحهٔ اول</a></div>`; return; }
    if (!M) { app.innerHTML = `<div class="card"><h2>این لینک پیدا نشد 😕</h2><p class="muted">شاید برگزارکننده پاکش کرده باشد.</p><a class="btn" href="/d">یک دورهمی تازه بساز</a></div>`; return; }
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
    return `سلام 🌿 برای «${M.title}» این فرم کوتاه را پر کنید (۳ دقیقه، بدون ثبت‌نام). هرچی خواستید خصوصی می‌ماند. بعد بهترین روز و جا برای همه پیدا می‌شود:\n${linkFor(M.code)}`;
  }
  function shareButtons(){
    return `
      <div class="copybox"><code>${esc(linkFor(M.code))}</code><button class="btn sm" id="cp">کپی</button></div>
      <div class="row" style="margin-top:10px">
        <a class="btn wa grow" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">واتس‌اپ</a>
        <a class="btn line grow" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(linkFor(M.code))}&text=${encodeURIComponent(shareText().split("\n")[0])}">تلگرام</a>
        ${navigator.share?`<button class="btn line grow" id="nshare">بیشتر…</button>`:""}
      </div>`;
  }
  function bindShare(){
    const cp = $("#cp"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(shareText()); toast("متن و لینک کپی شد ✓"); } catch(e){ toast("کپی نشد؛ لینک را دستی انتخاب کن"); } };
    const ns = $("#nshare"); if (ns) ns.onclick = () => navigator.share({title:M.title, text:shareText()}).catch(()=>{});
  }
  function createdPage(){
    const adminLink = `${linkFor(M.code)}?admin=${ADMIN}`;
    app.innerHTML = topbar() + `
      <header class="top"><span class="logo">🌿</span><div><b>${esc(M.title)}</b><small>ساخته شد</small></div></header>
      <div class="card"><div class="hero-e">🎉</div><h1>آماده است!</h1>
        <p>این لینک را در گروه بفرست:</p>${shareButtons()}</div>
      <div class="card"><h2>🔑 لینک مخصوص خودت (برگزارکننده)</h2>
        <p class="muted">با این لینک می‌توانی آخر کار روز و جا را «قطعی» کنی. این را در گروه نفرست؛ برای خودت نگه دار (مثلاً در «Saved messages»).${USER?" چون وارد همراه شده‌ای، از «بریم بیرون» هم همیشه به آن دسترسی داری.":""}</p>
        <div class="copybox"><code>${esc(adminLink)}</code><button class="btn sm ghost" id="cpa">کپی</button></div></div>
      <a class="btn block" href="/d/${M.code}?admin=${ADMIN}&form=1">حالا فرم خودم را پر کنم ←</a>`;
    bindShare();
    $("#cpa").onclick = async () => { try { await navigator.clipboard.writeText(adminLink); toast("لینک برگزارکننده کپی شد ✓"); } catch(e){} };
  }

  /* ============ the form (wizard) ============ */
  async function formPage(edit){
    let D = {}, PUB = new Set(["about","hobbies","activities","langs","question","origin","modes"]), NAME = "";
    if (edit){
      try { const mine = await rpc("dh_mine", {p_code:CODE, p_edit:edit}); if (mine){ D = mine.data||{}; PUB = new Set(mine.public_fields||[]); NAME = mine.name; } } catch(e){}
    }
    let prefilled = false;
    if (!edit && PREFILL) { D = JSON.parse(JSON.stringify(PREFILL.data || {})); NAME = PREFILL.name || ""; prefilled = true; }
    D.avail = D.avail || {};
    const steps = [
      {k:"hi", t:"سلام 👋", draw: () => `
        <h1>${esc(M.title)}</h1>
        ${M.note?`<p>${esc(M.note)}</p>`:""}
        <p class="muted">${M.organizer_name?esc(M.organizer_name)+" دعوتت کرده. ":""}چند سؤال کوتاه می‌پرسم تا جا و ساعتی پیدا کنیم که برای همه خوب باشد. ${M.women_only?"<b>این دورهمی فقط برای خانم‌هاست.</b>":""}</p>
        <div class="okbox">🔒 زیر هر سؤال یک کلید هست: <b>«به بقیه نشان بده»</b>. اگر خاموش باشد، جوابت فقط به‌صورت بی‌نام در حساب‌ها می‌آید (مثلاً «۲ نفر گیاه‌خوارند») و اسمت کنارش نمی‌آید.</div>
        ${prefilled?`<div class="note">✨ چند جواب را از پروفایل «همراه»ت پر کردم. هر کدام را خواستی عوض کن.</div>`:""}
        <label class="f">اسمت (یا اسمی که بچه‌ها می‌شناسند)</label>
        <input type="text" id="f_name" maxlength="40" value="${esc(NAME)}" placeholder="مثلاً سارا">`,
        read: () => { NAME = $("#f_name").value.trim(); if (!NAME) return "اسمت را بنویس 🙂"; }},
      {k:"origin", t:"از کجا میای؟", draw: () => `
        <h2>📍 از کجا راه میفتی؟</h2>
        <p class="muted">نزدیک‌ترین شهر یا ایستگاه را انتخاب کن. آدرس دقیقت را نمی‌خواهیم.</p>
        <input type="text" id="f_cs" placeholder="جستجو: روتردام، Delft، لایدن…">
        <div class="list-sel" id="f_cl"></div>
        <button class="btn line sm" id="f_geo" style="margin-top:8px">📡 از موقعیت گوشی‌ام (تقریبی، حدود ۵ کیلومتر)</button>
        <div id="f_osel" style="margin-top:8px"></div>
        ${visT("origin","شهرم را به بقیه نشان بده")}`,
        after: () => {
          const draw = () => {
            const s = $("#f_cs").value.trim().toLowerCase();
            $("#f_cl").innerHTML = CITIES.filter(c => !s || c.fa.includes(s) || c.nl.toLowerCase().includes(s) || c.key.includes(s))
              .map(c => `<div data-k="${c.key}" class="${D.origin&&D.origin.key===c.key?"on":""}">${esc(c.fa)} <span class="tiny ltr">${esc(c.nl)}</span></div>`).join("") || `<div class="tiny">پیدا نشد؛ نزدیک‌ترین شهر را بزن یا از موقعیت گوشی استفاده کن.</div>`;
            $("#f_cl").querySelectorAll("[data-k]").forEach(el => el.onclick = () => { const c = cityByKey(el.dataset.k); D.origin = {key:c.key, fa:c.fa, lat:c.lat, lng:c.lng}; showSel(); draw(); });
          };
          const showSel = () => $("#f_osel").innerHTML = D.origin ? `<span class="pill g">✓ ${esc(D.origin.fa)}</span>` : "";
          $("#f_cs").oninput = draw; draw(); showSel();
          $("#f_geo").onclick = () => {
            if (!navigator.geolocation) return toast("گوشی موقعیت نمی‌دهد");
            $("#f_geo").innerHTML = `<span class="spin"></span>`;
            navigator.geolocation.getCurrentPosition(p => {
              const lat = Math.round(p.coords.latitude*20)/20, lng = Math.round(p.coords.longitude*20)/20;
              const near = CITIES.slice().sort((a,b)=>km({lat,lng},a)-km({lat,lng},b))[0];
              D.origin = {key:"geo", fa:"نزدیک " + near.fa, lat, lng, station:false};
              showSel(); $("#f_geo").textContent = "📡 موقعیت گرفته شد ✓";
            }, () => { toast("اجازهٔ موقعیت داده نشد"); $("#f_geo").textContent = "📡 از موقعیت گوشی‌ام"; }, {timeout:10000, maximumAge:600000});
          };
        },
        read: () => { if (!D.origin) return "یک شهر انتخاب کن تا بتوانیم جای منصفانه پیدا کنیم."; }},
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
      {k:"avail", t:"کی می‌تونی؟", draw: () => `
        <h2>📅 کدام روزها می‌تونی؟</h2>
        ${M.options.map((o,i)=>`<div class="slot"><span class="lbl">${esc(fmtOpt(o))}</span>
          <span class="vote3">
            <span class="chip y ${D.avail[i]==="yes"?"on":""}" data-av="${i}:yes">می‌تونم</span>
            <span class="chip m ${D.avail[i]==="maybe"?"on":""}" data-av="${i}:maybe">شاید</span>
            <span class="chip n ${D.avail[i]==="no"?"on":""}" data-av="${i}:no">نه</span></span></div>`).join("")}
        <label class="f">🕘 معمولاً تا چه ساعتی می‌تونی بمونی؟</label>
        <div class="chips">${Object.entries(UNTIL_L).map(([k,l])=>`<span class="chip ${D.until===k?"on":""}" data-until="${k}">${l}</span>`).join("")}</div>
        <label class="f">🌙 تنها برگشتن در تاریکی؟</label>
        <div class="opts">${Object.entries({ok:["😌","راحتم"],early:["🌇","ترجیح می‌دهم قبل از تاریکی برگردم"],ride:["🤝","اگر کسی هم‌مسیر باشد یا برساند راحت‌ترم"]}).map(([k,[e,l]])=>`<div class="opt ${D.night_alone===k?"on":""}" data-night="${k}"><span class="e">${e}</span><div><b>${l}</b></div></div>`).join("")}</div>
        ${visT("avail","روزهایی که می‌تونم را با اسمم نشان بده")}`,
        after: () => {
          root.querySelectorAll("[data-av]").forEach(el => el.onclick = () => {
            const [i,v] = el.dataset.av.split(":"); D.avail[i] = v;
            el.parentNode.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === el));
          });
          oneOf("[data-until]", v => D.until = v);
          oneOf("[data-night]", v => D.night_alone = v, ".opt");
        },
        read: () => { if (M.options.some((o,i)=>!D.avail[i])) return "برای همهٔ روزها یکی را بزن (اگر نمی‌دانی «شاید»)."; }},
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
        return `<h2>✅ آماده است، ${esc(NAME)}</h2>
          <h3>👀 بقیه این‌ها را با اسمت می‌بینند</h3>${pub.join("") || '<p class="tiny">هیچ چیز (فقط اسمت)</p>'}
          <h3>🔒 خصوصی (فقط بی‌نام در حساب‌ها)</h3>${priv.join("") || '<p class="tiny">هیچ چیز</p>'}
          <p class="tiny" style="margin-top:10px">برای عوض کردن، «قبلی» را بزن. بعداً هم می‌توانی فرمت را ویرایش یا پاک کنی.</p>`; }},
    ];
    const GROUPS = {origin:["origin"], modes:["modes","seats","max_min"], avail:["avail","until","night_alone"], activities:["activities","budget"],
      diet:["diet","allergy","dislikes"], life:["alcohol","smoke","weed"], more:["langs","bring","photo","quiet","access"],
      age:["age"], job:["job"], contact:["contact"]};
    function groupOf(k){ for (const [g,ks] of Object.entries(GROUPS)) if (ks.includes(k)) return g; return k; }
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
        <header class="top"><span class="logo">🌿</span><div><b>${esc(M.title)}</b><small>${M.count?fa(M.count)+" نفر تا الان پر کرده‌اند":"اولین نفری 🎈"}</small></div></header>
        <div class="step-h"><span>${esc(s.t)}</span><span>${fa(i+1)} از ${fa(steps.length)}</span></div>
        <div class="prog"><i style="width:${(i+1)/steps.length*100}%"></i></div>
        <div class="card">${s.draw()}</div><div id="f_err"></div>
        ${i===0 ? `<div class="row"><a href="/d/${CODE}?tab=result" class="btn line sm">${edit?"دیدن نتیجه بدون تغییر":"اول فقط نتیجه را ببینم"}</a></div>`:""}
        <div class="bar"><div class="in">
          ${i>0?`<button class="btn line" id="f_back">قبلی</button>`:""}
          <button class="btn grow" id="f_next">${i===steps.length-1?(edit?"ذخیرهٔ تغییرات ✓":"ثبت و دیدن نتیجه ✓"):"بعدی"}</button>
        </div></div>`;
      root.querySelectorAll("[data-vis]").forEach(el => el.onclick = () => { const g = el.dataset.vis; PUB.has(g) ? PUB.delete(g) : PUB.add(g); el.classList.toggle("on", PUB.has(g)); });
      s.after && s.after();
      $("#f_next").onclick = next;
      if ($("#f_back")) $("#f_back").onclick = () => { s.read && s.read(); i--; draw(); scrollTo(0,0); };
      const inp = app.querySelector("input[type=text]"); if (inp && i===0 && !NAME) inp.focus();
    }
    async function next(){
      const s = steps[i];
      const err = s.read && s.read();
      if (err) { $("#f_err").innerHTML = `<div class="err">${esc(err)}</div>`; return; }
      if (i < steps.length-1) { i++; draw(); scrollTo(0,0); return; }
      const b = $("#f_next"); b.disabled = true; b.innerHTML = `<span class="spin"></span>`;
      const pubFields = []; for (const [g,ks] of Object.entries(GROUPS)) if (PUB.has(g)) pubFields.push(...ks);
      ["about","hobbies","question"].forEach(k => pubFields.push(k));  // these are only asked to be shared
      const clean = {}; for (const [k,v] of Object.entries(D)) if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) clean[k] = v;
      try {
        const r = await rpc("dh_respond", {p_code:CODE, p_edit:edit||null, p_name:NAME, p_data:clean, p_public:pubFields});
        store.set("dh_"+CODE, {...(store.get("dh_"+CODE)||{}), title:M.title, edit:r.edit_token, name:NAME});
        toast("ثبت شد ✓"); go(`/d/${CODE}?tab=result`);
      } catch(e){ $("#f_err").innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; b.disabled=false; b.textContent="دوباره امتحان کن"; }
    }
    draw();
  }

  /* ============ analysis ============ */
  function analyse(){
    const rows = M.anon || [];
    const n = rows.length;
    // time
    const slots = M.options.map((o,i) => {
      let y=0,m=0,no=0; rows.forEach(r => { const a = (r.avail||{})[i]; if (a==="yes") y++; else if (a==="maybe") m++; else if (a==="no") no++; });
      return {i, o, y, m, no, score: y + m*0.5};
    }).sort((a,b) => b.score - a.score || a.no - b.no);
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
      const score = (per.length ? Math.max(...per.map(p=>p.w)) : 0) + 0.35*avg + 30*over;
      return {h, per, maxT, avg, over, score};
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
      n, slots, hubs, withO: withO.length,
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
    app.innerHTML = topbar() + `
      <header class="top"><span class="logo">🌿</span><div><b>${esc(M.title)}</b><small>${fa(A.n)} نفر فرم را پر کرده‌اند${M.organizer_name?" · برگزارکننده: "+esc(M.organizer_name):""}</small></div></header>
      ${M.final ? finalCard(M.final) : ""}
      <div class="tabs">
        ${[["result","🧭 نتیجه"],["people","👯‍♀️ آدم‌ها"],["ice","🧊 یخ‌شکن"],["share","📤 دعوت"]].map(([k,l])=>`<span class="tab ${TAB===k?"on":""}" data-tab="${k}">${l}</span>`).join("")}
      </div>
      <div id="tabc"></div>
      ${memberCard()}
      <div class="row" style="margin-top:14px">
        <a class="btn line sm" href="/d/${CODE}?form=1">✏️ ویرایش فرم من</a>
        ${my.edit?`<button class="btn line sm" id="del_me">🗑️ پاک کردن جواب من</button>`:`<a class="btn sm" href="/d/${CODE}?form=1">📝 پر کردن فرم</a>`}
        <a class="btn line sm" href="/d">+ دورهمی تازه</a>
      </div>
      <p class="tiny" style="margin-top:10px">زمان‌های راه تخمینی‌اند (بر اساس فاصله). برای مسیر دقیق از <a href="https://9292.nl/" target="_blank" rel="noopener">9292</a> یا گوگل‌مپ استفاده کن. ${my.name?`تو با اسم «${esc(my.name)}» پر کرده‌ای.`:""}</p>`;
    root.querySelectorAll("[data-tab]").forEach(t => t.onclick = () => { TAB = t.dataset.tab; resultPage(); });
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
        <h2>📅 بهترین روز</h2>
        ${A.slots.map((s,k)=>`<div class="slot"><span class="lbl">${k===0?"⭐ ":""}${esc(fmtOpt(s.o))}</span>
          <span class="meter"><i style="width:${A.n?s.y/A.n*100:0}%"></i></span>
          <span class="tiny" style="min-width:92px">${fa(s.y)} می‌تونن${s.m?` · ${fa(s.m)} شاید`:""}</span></div>`).join("")}
        ${best && best.y === A.n ? `<div class="okbox">همه می‌توانند روز ${esc(fmtOpt(best.o))} 🎉</div>` : ""}
      </div>
      <div class="card">
        <h2>📍 منصفانه‌ترین شهر برای همه</h2>
        <p class="muted">بر اساس شهر و وسیلهٔ ${fa(A.withO)} نفر؛ هدف این است که راه <b>هیچ‌کس</b> خیلی طولانی نشود.</p>
        ${top.map((t,k)=>`<div class="hub ${k===0?"best":""}">
          <div class="t"><b>${k===0?"🥇":k===1?"🥈":"🥉"} ${esc(t.h.fa)} <span class="tiny ltr">${esc(t.h.nl)}</span></b>
            <button class="btn sm ${k===0?"":"ghost"}" data-venues="${t.h.key}">پیدا کردن جا</button></div>
          <div class="tiny">طولانی‌ترین راه حدود <b>${fa(Math.round(t.maxT))}</b> دقیقه · میانگین ${fa(Math.round(t.avg))} دقیقه
          ${t.over?` · <span style="color:var(--warn)">برای ${fa(t.over)} نفر بیشتر از سقفشان</span>`:` · <span style="color:var(--ok)">همه زیر سقف خودشان ✓</span>`}</div>
        </div>`).join("")}
        <div id="map"></div>
        <p class="tiny">دایره‌های بنفش: از کجا می‌آیند (بی‌نام) · ستاره: شهر پیشنهادی.</p>
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
      (M.anon||[]).forEach(r => { if (r.origin && r.origin.lat) { const k = r.origin.lat+","+r.origin.lng; groups[k] = groups[k] || {lat:r.origin.lat,lng:r.origin.lng,n:0,fa:r.origin.fa}; groups[k].n++; } });
      Object.values(groups).forEach(g => { L.circleMarker([g.lat,g.lng], {radius:7+g.n*3, color:"#6C5CE7", fillColor:"#6C5CE7", fillOpacity:.45, weight:2}).addTo(MAP).bindPopup(`${esc(g.fa)}: ${fa(g.n)} نفر`); pts.push([g.lat,g.lng]); });
      A.hubs.slice(0,3).forEach((t,k) => { L.marker([t.h.lat,t.h.lng], {icon: L.divIcon({html:`<div style="font-size:${k?20:28}px;line-height:1">${k?"📍":"⭐"}</div>`, className:"", iconSize:[28,28], iconAnchor:[14,24]})}).addTo(MAP).bindPopup(esc(t.h.fa)); pts.push([t.h.lat,t.h.lng]); });
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
    const ORDER = ["about","age","job","origin","modes","seats","max_min","hobbies","activities","langs","bring","diet","dislikes","allergy","alcohol","smoke","weed","photo","quiet","access","until","night_alone","contact","question"];
    return M.people.map(p => {
      const rows = ORDER.map(k => { const v = showVal(k, p[k]); return v ? `<div class="kv"><b>${LABEL[k]}:</b> ${esc(v)}</div>` : ""; }).join("");
      const days = p.avail ? M.options.map((o,i)=>p.avail[i]==="yes"?fmtOpt(o):null).filter(Boolean) : [];
      return `<div class="card person"><div class="av" style="background:${colorOf(p.name)}">${esc([...p.name][0]||"?")}</div>
        <div class="grow"><b style="font-size:16px">${esc(p.name)}</b>${rows || '<div class="tiny">بقیهٔ جواب‌ها را خصوصی نگه داشته 🔒</div>'}
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
    return `<div class="card"><h2>🔑 قطعی کردن (فقط تو می‌بینی)</h2>
      <label class="f">روز</label>
      <select id="a_slot">${M.options.map((o,i)=>`<option value="${i}" ${i===sel?"selected":""}>${esc(fmtOpt(o))}${A.slots.find(s=>s.i===i)?` — ${fa(A.slots.find(s=>s.i===i).y)} نفر می‌تونن`:""}</option>`).join("")}</select>
      <label class="f">ساعت</label><input type="time" id="a_time" value="${esc(f.t || (M.options[Math.max(sel,0)]||{}).t || "15:00")}">
      <label class="f">شهر</label>
      <select id="a_city">${CITIES.filter(c=>c.meet).map(c=>`<option value="${c.key}" ${(pick.city||f.city||(bestHub&&bestHub.h.key))===c.key?"selected":""}>${esc(c.fa)}</option>`).join("")}</select>
      <label class="f">اسم جا</label><input type="text" id="a_venue" maxlength="100" value="${esc(pick.venue||f.venue||"")}" placeholder="از «پیدا کردن جا» انتخاب کن یا بنویس">
      <label class="f">آدرس (اختیاری)</label><input type="text" id="a_addr" maxlength="150" value="${esc(pick.address||f.address||"")}">
      <label class="f">یادداشت برای همه (اختیاری)</label><input type="text" id="a_note" maxlength="200" value="${esc(f.note||"")}" placeholder="مثلاً: جلوی در ایستگاه همدیگر را ببینیم">
      <button class="btn block" id="a_go" style="margin-top:12px">✅ قطعی کن</button>
      ${M.final?`<button class="btn line sm" id="a_clear" style="margin-top:8px">برداشتن قطعی</button>`:""}
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
      <button class="btn line sm" id="a_delete" style="color:var(--bad)">🗑️ پاک کردن کل دورهمی و همهٔ جواب‌ها</button></div>`;
  }
  function bindAdmin(A){
    if (!ADMIN || !$("#a_go")) return;
    $("#a_slot").onchange = () => { const o = M.options[+$("#a_slot").value]; if (o && o.t) $("#a_time").value = o.t; };
    $("#a_go").onclick = async () => {
      const o = M.options[+$("#a_slot").value];
      const fin = {d:o.d, t:$("#a_time").value, city:$("#a_city").value, venue:$("#a_venue").value.trim(), address:$("#a_addr").value.trim(), note:$("#a_note").value.trim()};
      try { await rpc("dh_finalize", {p_code:CODE, p_admin:ADMIN, p_final:fin}); toast("قطعی شد ✓");
        const city = (cityByKey(fin.city)||{}).fa || "";
        const txt = `✅ «${M.title}» قطعی شد:\n📅 ${fmtDate(fin.d)} ساعت ${fin.t}\n📍 ${fin.venue}${city?" — "+city:""}\nجزئیات و تقویم: ${linkFor(CODE)}`;
        M.final = fin; TAB = "result"; resultPage();
        setTimeout(() => { if (confirm("پیامش را برای گروه در واتس‌اپ بفرستم؟")) window.open("https://wa.me/?text="+encodeURIComponent(txt), "_blank"); }, 300);
      } catch(e){ toast(errMsg(e)); }
    };
    if ($("#a_clear")) $("#a_clear").onclick = async () => { try { await rpc("dh_finalize", {p_code:CODE, p_admin:ADMIN, p_final:null}); M.final = null; resultPage(); } catch(e){ toast(errMsg(e)); } };
    $("#a_delete").onclick = async () => {
      if (!confirm("کل دورهمی و همهٔ جواب‌ها برای همیشه پاک شود؟")) return;
      try { await rpc("dh_delete_meetup", {p_code:CODE, p_admin:ADMIN}); try { localStorage.removeItem("dh_"+CODE); } catch(e){} go("/d"); } catch(e){ toast(errMsg(e)); }
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
  return () => { dead = true; root.removeEventListener("click", onClick); window.removeEventListener("popstate", route); if (MAP) { try { MAP.remove(); } catch(e){} } };
}
