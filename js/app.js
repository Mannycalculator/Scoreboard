// Live Scoreboard (MLB + NFL + NBA) with fade swap, auto-hide bars
const endpoints = {
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
};

const leagueEl = document.getElementById("league");
const dateEl = document.getElementById("date");
const prevEl = document.getElementById("prev");
const nextEl = document.getElementById("next");
const autoEl = document.getElementById("autorotate");
const contentEl = document.getElementById("content");
const tickerEl = document.getElementById("ticker");

let idx = 0, games = [], autorotateTimer = null, refreshTimer = null;

// helpers
function todayISO(){const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function espnDateParam(iso){return (iso||todayISO()).replaceAll("-","");}
function safeLogo(arr){ return (arr && arr.length) ? arr[0] : ""; }
function escapeHtml(s){ const map={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}; return (s||"").replace(/[&<>\"']/g, ch => map[ch]); }
function clearTimers(){ if (autorotateTimer) clearInterval(autorotateTimer); if (refreshTimer) clearInterval(refreshTimer); autorotateTimer = refreshTimer = null; }
function startAutoRotate(){ if(!autoEl.checked || games.length<=1) return; autorotateTimer=setInterval(()=>{ idx=(idx+1)%games.length; render(); },7000); }
function isAnyLive(){ return games.some(g=>g.statusName==='STATUS_IN_PROGRESS'); }
function startAutoRefreshIfLive(){ if(!isAnyLive()) return; refreshTimer=setInterval(load,30000); }

// MLB summary cache
const summaryCache = new Map();
async function loadSummary(gameId){
  const key=String(gameId);
  if (summaryCache.has(key) && (Date.now()-summaryCache.get(key)._ts<12000)) return summaryCache.get(key);
  const url=`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${encodeURIComponent(key)}`;
  const res=await fetch(url,{cache:'no-store'});
  const data=await res.json();
  const sit=data?.situation;
  const result={situation: sit ? {
    inning: sit.inning, inningState: sit.inningState, isTopInning: !!sit.isTopInning,
    balls: sit.balls, strikes: sit.strikes, outs: sit.outs,
    onFirst: !!sit.onFirst, onSecond: !!sit.onSecond, onThird: !!sit.onThird
  } : null};
  result._ts=Date.now();
  summaryCache.set(key,result);
  return result;
}

// NFL summary cache
const nflSummaryCache = new Map();
async function loadSummaryNFL(gameId){
  const key=String(gameId);
  if (nflSummaryCache.has(key) && (Date.now()-nflSummaryCache.get(key)._ts<12000)) return nflSummaryCache.get(key);
  const url=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(key)}`;
  const res=await fetch(url,{cache:'no-store'});
  const data=await res.json();
  const header = data?.header || {};
  const comp = (header?.competitions && header.competitions[0]) || (data?.competitions && data.competitions[0]) || {};
  const st = comp?.status || {};
  const sit = data?.situation || {};
  const out = {
    period: st.period ?? null,
    clock: st.displayClock ?? null,
    possession: sit?.possession ?? null,
    down: sit?.down ?? null,
    distance: sit?.distance ?? null,
    yardLine: sit?.yardLine ?? null,
    isRedZone: !!sit?.isRedZone
  };
  const result = { situation: out };
  result._ts = Date.now();
  nflSummaryCache.set(key, result);
  return result;
}

// NBA summary cache
const nbaSummaryCache = new Map();
async function loadSummaryNBA(gameId){
  const key=String(gameId);
  if (nbaSummaryCache.has(key) && (Date.now()-nbaSummaryCache.get(key)._ts<12000)) return nbaSummaryCache.get(key);
  const url=`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(key)}`;
  const res=await fetch(url,{cache:'no-store'});
  const data=await res.json();
  const header = data?.header || {};
  const comp = (header?.competitions && header.competitions[0]) || (data?.competitions && data.competitions[0]) || {};
  const st = comp?.status || {};
  const out = {
    period: st.period ?? null,
    clock: st.displayClock ?? null
  };
  const result = { situation: out };
  result._ts = Date.now();
  nbaSummaryCache.set(key, result);
  return result;
}

function ordinal(n){ if(!n) return ""; const s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }

// init
function setDateDefault(){ dateEl.value = todayISO(); }
setDateDefault();

// map
function mapEvent(e){
  const c=(e.competitions&&e.competitions[0])||{};
  const status=(c.status&&c.status.type)||{};
  const competitors=(c.competitors||[]).sort((a,b)=>a.homeAway.localeCompare(b.homeAway)); // away,home
  const [away,home]=competitors;
  const awayTeam=away?.team||{}, homeTeam=home?.team||{};

  const logosAwayArr=(awayTeam.logos||[]).map(l=>l.href).filter(Boolean);
  const logosHomeArr=(homeTeam.logos||[]).map(l=>l.href).filter(Boolean);
  const logosAway=logosAwayArr.length?logosAwayArr:(awayTeam.logo?[awayTeam.logo]:[]);
  const logosHome=logosHomeArr.length?logosHomeArr:(homeTeam.logo?[homeTeam.logo]:[]);

  const linescoresAway=(away?.linescores||[]).map(x=>x.value??x.displayValue??"");
  const linescoresHome=(home?.linescores||[]).map(x=>x.value??x.displayValue??"");

  return {
    id:e.id, league:leagueEl.value, date:(new Date(e.date)).toISOString(), name:e.name,
    venue:c.venue?.fullName||"", start:e.date, statusName:status.name, statusDetail:status.detail,
    neutralSite: !!c.neutralSite,
    away:{ name:awayTeam.displayName||awayTeam.name||"Away", abbr:awayTeam.abbreviation||"", record:away?.records?.[0]?.summary||"", score:Number(away?.score??0), logos:logosAway, id: awayTeam.id },
    home:{ name:homeTeam.displayName||homeTeam.name||"Home", abbr:homeTeam.abbreviation||"", record:home?.records?.[0]?.summary||"", score:Number(home?.score??0), logos:logosHome, id: homeTeam.id },
    linescores:{away:linescoresAway,home:linescoresHome}
  };
}

// load
async function load(){
  clearTimers();
  contentEl.innerHTML="Loading…";
  const league=leagueEl.value;
  const iso=dateEl.value||todayISO();
  const url=`${endpoints[league]}?dates=${espnDateParam(iso)}`;
  try{
    const res=await fetch(url,{cache:'no-store'});
    const data=await res.json();
    games=(data.events||[]).map(mapEvent);
    if(!games.length){ tickerEl.textContent=""; contentEl.innerHTML=`<div class="empty">No ${league.toUpperCase()} games on ${iso}.</div>`; return; }
    idx=Math.min(idx,games.length-1);
    render();
    startAutoRotate();
    startAutoRefreshIfLive();
  }catch(err){
    contentEl.innerHTML=`<div class="empty">Error loading scores. ${err?.message||""}</div>`;
  }
}

// render helpers
function labelStatus(g){
  const n=g.statusName||"";
  if(n==='STATUS_SCHEDULED') return `Scheduled • ${new Date(g.start).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
  if(n==='STATUS_IN_PROGRESS'){ return `LIVE • ${g.statusDetail||""}`; }
  if(n==='STATUS_FINAL') return 'Final';
  return g.statusDetail||'—';
}

function buildLinescoreTable(g){
  const a=g.linescores.away,h=g.linescores.home;
  if((!a||!a.length)&&(!h||!h.length)) return "";
  const len=Math.max(a.length,h.length);
  const header=Array.from({length:len},(_,i)=>`<th>${i+1}</th>`).join("");
  const awayRow=Array.from({length:len},(_,i)=>`<td>${(a[i]??"")}</td>`).join("");
  const homeRow=Array.from({length:len},(_,i)=>`<td>${(h[i]??"")}</td>`).join("");
  return `
    <div class="linescore">
      <table class="table" role="table" aria-label="Line score">
        <thead><tr><th class="teamcell">Team</th>${header}<th>Total</th></tr></thead>
        <tbody>
          <tr><td class="teamcell">${escapeHtml(g.away.abbr||g.away.name)}</td>${awayRow}<td><strong>${g.away.score}</strong></td></tr>
          <tr><td class="teamcell">${escapeHtml(g.home.abbr||g.home.name)}</td>${homeRow}<td><strong>${g.home.score}</strong></td></tr>
        </tbody>
      </table>
    </div>`;
}

function render(){
  if(!games.length) return;
  const g=games[idx];
  const isoDate=(g.date||"").slice(0,10);
  tickerEl.textContent=`${g.league.toUpperCase()} • ${isoDate} • ${games.length} game${games.length>1?"s":""} • Showing ${idx+1}/${games.length}`;
  const statusLabel=labelStatus(g);
  const awayLogo=safeLogo(g.away.logos);
  const homeLogo=safeLogo(g.home.logos);
  const linescoreTable=buildLinescoreTable(g);

  contentEl.innerHTML = `
    <div class="row">
      <div class="meta">
        <span class="status">${statusLabel}</span>
        ${g.venue?`<span>${escapeHtml(g.venue)}</span>`:""}
        ${g.start?`<span>${new Date(g.start).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span>`:""}
      </div>
      <div class="meta"><strong>${idx+1}</strong> / ${games.length}</div>
    </div>

    <div class="teams">
      <div class="teamrow">
        <div class="info">
          <div class="logo">${awayLogo?`<img alt="${escapeHtml(g.away.abbr||g.away.name)}" src="${awayLogo}" />`:""}</div>
          <div>
            <div class="name">${escapeHtml(g.away.name)}</div>
            <div class="record">${escapeHtml(g.away.record||"")}</div>
          </div>
        </div>
        <div class="score">${g.away.score}</div>
      </div>

      <div class="teamrow">
        <div class="info">
          <div class="logo">${homeLogo?`<img alt="${escapeHtml(g.home.abbr||g.home.name)}" src="${homeLogo}" />`:""}</div>
          <div>
            <div class="name">${escapeHtml(g.home.name)}</div>
            <div class="record">${escapeHtml(g.home.record||"")}</div>
          </div>
        </div>
        <div class="score">${g.home.score}</div>
      </div>
    </div>

    <div id="situation"></div>
    <div id="extra-situation"></div>

    ${linescoreTable}
  `;

  // trigger swap anim
  contentEl.classList.remove('swap-anim'); void contentEl.offsetWidth; contentEl.classList.add('swap-anim');

  // MLB live situation
  if (g.league==='mlb' && g.statusName==='STATUS_IN_PROGRESS') {
    loadSummary(g.id).then(data => {
      const el = document.getElementById('situation');
      if (el) el.innerHTML = renderSituationBlock(data.situation);
    }).catch(()=>{});
  } else { const el = document.getElementById('situation'); if (el) el.innerHTML = ""; }

  // NFL live situation
  if (g.league==='nfl' && g.statusName==='STATUS_IN_PROGRESS') {
    loadSummaryNFL(g.id).then(data => {
      const el2 = document.getElementById('extra-situation');
      if (el2) el2.innerHTML = renderNFLSituationBlock(g, data.situation);
    }).catch(()=>{});
  } else if (g.league==='nba' && g.statusName==='STATUS_IN_PROGRESS') {
    loadSummaryNBA(g.id).then(data => {
      const el3 = document.getElementById('extra-situation');
      if (el3) el3.innerHTML = renderNBASituationBlock(data.situation);
    }).catch(()=>{});
  } else {
    const elx = document.getElementById('extra-situation'); if (elx) elx.innerHTML = "";
  }
}

function renderSituationBlock(s){
  if(!s) return "";
  return `
    <div class="situation">
      <span class="badge">Count ${s.balls}–${s.strikes}</span>
      <span class="badge">${s.outs} out${s.outs===1?"":"s"}</span>
      <div class="base-diamond" aria-label="Runners on base">
        <div class="base third ${s.onThird?'on':''}"></div>
        <div class="base second ${s.onSecond?'on':''}"></div>
        <div class="base first ${s.onFirst?'on':''}"></div>
      </div>
    </div>`;
}

function renderNFLSituationBlock(g, s){
  if(!s) return "";
  const q = s.period ? `Q${s.period}` : "";
  const clk = s.clock || "";
  const dd = (s.down && s.distance) ? `${ordinal(s.down)} & ${s.distance}` : "";
  const spot = s.yardLine ? `${s.yardLine} yd line` : "";
  const rz = s.isRedZone ? `RED ZONE` : "";
  const poss = (s.possession && (g.home.abbr||g.home.name) && (g.away.abbr||g.away.name)) ?
      `Poss: ${(String(s.possession)===String(g.home.id) ? (g.home.abbr||g.home.name) : (String(s.possession)===String(g.away.id) ? (g.away.abbr||g.away.name) : ""))}`
      : "";
  const parts = [q, clk, dd, spot, rz, poss].filter(Boolean);
  return `<div class="situation nfl">${parts.map(p=>`<span class="badge">${p}</span>`).join(" ")}</div>`;
}

function renderNBASituationBlock(s){
  if(!s) return "";
  const q = s.period ? `Q${s.period}` : "";
  const clk = s.clock || "";
  const parts = [q, clk].filter(Boolean);
  return parts.length ? `<div class="situation">${parts.map(p=>`<span class="badge">${p}</span>`).join(" ")}</div>` : "";
}

// listeners
prevEl.addEventListener("click", ()=>{ if(!games.length) return; idx=(idx-1+games.length)%games.length; render(); });
nextEl.addEventListener("click", ()=>{ if(!games.length) return; idx=(idx+1)%games.length; render(); });
leagueEl.addEventListener("change", load);
dateEl.addEventListener("change", load);
autoEl.addEventListener("change", ()=>{ clearTimers(); render(); startAutoRotate(); startAutoRefreshIfLive(); });
window.addEventListener("keydown", (e)=>{ if(e.key==='ArrowLeft') prevEl.click(); if(e.key==='ArrowRight') nextEl.click(); });

// start
load();

// --- Auto-hide header/footer on inactivity ---
let _uiHideTimer = null;
const _HIDE_AFTER_MS = 5000; // 5s of no interaction
function showBars(){ const top=document.querySelector('.topbar'), bot=document.querySelector('.bottombar'); if(top) top.classList.remove('hidden'); if(bot) bot.classList.remove('hidden'); }
function hideBars(){ const top=document.querySelector('.topbar'), bot=document.querySelector('.bottombar'); if(top) top.classList.add('hidden'); if(bot) bot.classList.add('hidden'); }
function resetHideTimer(){ showBars(); if(_uiHideTimer) clearTimeout(_uiHideTimer); _uiHideTimer=setTimeout(hideBars,_HIDE_AFTER_MS); }
['mousemove','keydown','click','touchstart'].forEach(evt=>{ window.addEventListener(evt, resetHideTimer, {passive:true}); });
document.addEventListener('DOMContentLoaded', resetHideTimer);
