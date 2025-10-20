// Utilities
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const rand = (n)=>Math.floor(Math.random()*n);
const shuffle = (a)=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
const sample = (a,k)=> (k>=a.length?shuffle(a):shuffle(a).slice(0,k));

// State
let DATA = { levels: {A1:[],A2:[],B1:[],B2:[],C1:[],C2:[]}, topics:{} };
let CURRENT_LEVEL = "A1";
let CURRENT_SOURCE = "ox5000"; // 'ox5000' | 'topics'
let CURRENT_CATEGORY = null;
let CURRENT_TOPIC = null;
let CURRENT_WORDS = [];

// ---------- Load Oxford data (static JSON) ----------
async function loadOxford(){
  try{
    const raw = await fetch('./oxford_wordlists.json',{cache:'no-store'}).then(r=>r.json());
    DATA = normalizeOxford(raw);
  }catch(err){
    console.warn('oxford_wordlists.json not found or invalid; using demo data.', err);
    DATA = demoData();
  }
}

// Accept both shapes:
// 1) { oxford_5000_full:[{lemma, pos_levels:{noun:["B1",...]}}], topics:{Category:{Topic:{A1:[...]...}} } }
// 2) { oxford_5000:{A1:[...],...}, topics:{...} }
function normalizeOxford(raw){
  const out = { levels: {A1:[],A2:[],B1:[],B2:[],C1:[],C2:[]}, topics: raw.topics || {} };
  if (raw.oxford_5000_full){
    const levelMap = {A1:[],A2:[],B1:[],B2:[],C1:[],C2:[]};
    for (const e of raw.oxford_5000_full){
      const levels = new Set();
      const pl = e.pos_levels || {};
      for (const k in pl){ (pl[k]||[]).forEach(l=>levels.add(l)); }
      let head = (e.lemma || e.head || "").toString().replace(/\d+$/,"").replace(/\s*\([^)]*\)\s*$/,"").trim();
      if (!head) continue;
      for (const lv of levels){ if (levelMap[lv]) levelMap[lv].push(head); }
    }
    for (const k in levelMap){ out.levels[k] = Array.from(new Set(levelMap[k])).sort((a,b)=>a.localeCompare(b)); }
  } else if (raw.oxford_5000){
    for (const k of ["A1","A2","B1","B2","C1","C2"]){
      out.levels[k] = Array.from(new Set(raw.oxford_5000[k]||[])).sort((a,b)=>a.localeCompare(b));
    }
  }
  // Clean topics: ensure every level exists
  for (const cat in out.topics){
    for (const t in out.topics[cat]){
      const lvls = out.topics[cat][t];
      for (const k of ["A1","A2","B1","B2","C1","C2"]){
        lvls[k] = Array.from(new Set(lvls[k]||[])).sort((a,b)=>a.localeCompare(b));
      }
    }
  }
  return out;
}

// A tiny fallback dataset so UI works without Oxford files
function demoData(){
  return {
    levels: {
      A1:["apple","book","chair","dog","family","go","happy","in","job","kind"],
      A2:["argue","castle","dangerous","else","friendly","garage","happen","idea","jeans","knowledge"],
      B1:["analysis","budget","commit","debate","efficient","forecast","generate","highlight","implement","justify"],
      B2:["accompany","beneficial","circumstance","devote","emerge","framework","guarantee","hypothesis","investigate","justify"],
      C1:["advocate","coherent","discrepancy","elicit","feasible","inhibit","meticulous","paradigm","scrutiny","viable"],
      C2:["apocryphal","demagogue","effulgent","grandiloquent","inchoate","insouciant","pellucid","recalcitrant","sycophant","vicissitude"]
    },
    topics: {
      "Animals": {
        "Pets": { A1:["cat","dog","fish","rabbit"], A2:["hamster","tortoise"] },
        "Birds": { A1:["duck","hen"], B1:["sparrow","eagle"] }
      },
      "Food & Drink": {
        "Fruit": { A1:["apple","banana","orange"], A2:["grape","pear"] },
        "Cooking": { B1:["boil","grill","stir"], B2:["marinate","simmer"] }
      }
    }
  };
}

// ---------- UI helpers ----------
function setActiveLevel(level){
  CURRENT_LEVEL = level;
  $$('.btn-level').forEach(b=> b.classList.toggle('is-active', b.dataset.level===level));
  $('#levelLabel').textContent = level;
}
function setSource(src){
  CURRENT_SOURCE = src;
  $$('.pill').forEach(b=> b.classList.toggle('is-active', b.dataset.source===src));
  $('#src5000').setAttribute('aria-selected', src==='ox5000'?'true':'false');
  $('#srcTopics').setAttribute('aria-selected', src==='topics'?'true':'false');
  $('#topicsBar').hidden = (src!=='topics');
  updateTitle();
}
function updateTitle(){
  if (CURRENT_SOURCE==='ox5000'){
    $('#title').innerHTML = `Oxford 5000 — <span id="levelLabel">${CURRENT_LEVEL}</span>`;
  } else {
    const cat = CURRENT_CATEGORY || '—';
    const t = CURRENT_TOPIC || '—';
    $('#title').innerHTML = `Topic: ${cat} — ${t} — <span id="levelLabel">${CURRENT_LEVEL}</span>`;
  }
}
function oaldLink(word){
  const q = encodeURIComponent(word);
  return `https://www.oxfordlearnersdictionaries.com/search/english/direct/?q=${q}`;
}
function renderWords(words){
  CURRENT_WORDS = words;
  const chips = $('#vocabChips'); chips.innerHTML="";
  if (!words?.length){
    chips.innerHTML = '<span class="chip">No words for this selection.</span>';
    $('#countLabel').textContent = '';
    return;
  }
  $('#countLabel').textContent = `${words.length} shown`;
  for (const w of words){
    const el = document.createElement('span');
    el.className='chip';
    el.innerHTML = `${w} · <a href="${oaldLink(w)}" target="_blank" rel="noopener">define</a>`;
    chips.appendChild(el);
  }
}

// ---------- Word picking ----------
function pickWords(k=10){
  let pool = [];
  if (CURRENT_SOURCE==='ox5000'){
    pool = DATA.levels[CURRENT_LEVEL] || [];
  } else {
    const cat = CURRENT_CATEGORY;
    const t = CURRENT_TOPIC;
    pool = (DATA.topics?.[cat]?.[t]?.[CURRENT_LEVEL]) || [];
  }
  return sample(pool, Math.min(k, pool.length||0));
}

// ---------- Topics dropdowns ----------
function populateTopics(){
  const catSel = $('#topicCategory');
  const topicSel = $('#topicName');
  const cats = Object.keys(DATA.topics||{}).sort((a,b)=>a.localeCompare(b));
  catSel.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  CURRENT_CATEGORY = cats[0] || null;
  const topics = Object.keys((DATA.topics[CURRENT_CATEGORY]||{})).sort((a,b)=>a.localeCompare(b));
  topicSel.innerHTML = topics.map(t=>`<option value="${t}">${t}</option>`).join('');
  CURRENT_TOPIC = topics[0] || null;

  catSel.addEventListener('change', ()=>{
    CURRENT_CATEGORY = catSel.value;
    const ts = Object.keys((DATA.topics[CURRENT_CATEGORY]||{})).sort((a,b)=>a.localeCompare(b));
    topicSel.innerHTML = ts.map(t=>`<option value="${t}">${t}</option>`).join('');
    CURRENT_TOPIC = ts[0] || null;
    updateTitle();
  });
  topicSel.addEventListener('change', ()=>{
    CURRENT_TOPIC = topicSel.value;
    updateTitle();
  });
}

// ---------- Clipboard / CSV ----------
function copyList(){
  const text = CURRENT_WORDS.join(', ');
  navigator.clipboard.writeText(text).then(()=>{
    alert('Copied to clipboard!');
  }, ()=> alert('Copy failed'));
}
function exportCSV(){
  if (!CURRENT_WORDS.length){ alert('Nothing to export'); return; }
  const rows = [['word','level','source','category','topic']];
  for (const w of CURRENT_WORDS){
    rows.push([w, CURRENT_LEVEL, CURRENT_SOURCE, CURRENT_CATEGORY||'', CURRENT_TOPIC||'']);
  }
  const csv = rows.map(r=> r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vocab_${CURRENT_LEVEL}.csv`; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}

// ---------- Theme toggle ----------
(function(){
  const ICONS = {
    sun: `<svg class="icon-24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" fill="currentColor"/>
            <g stroke="currentColor" stroke-linecap="round" stroke-width="1.8" fill="none">
              <path d="M12 2.5v3.2M12 18.3v3.2M21.5 12h-3.2M5.7 12H2.5M18.4 5.6l-2.3 2.3M7.9 16.1l-2.3 2.3M18.4 18.4l-2.3-2.3M7.9 7.9L5.6 5.6"/>
            </g>
          </svg>`,
    moon: `<svg class="icon-24" viewBox="0 0 24 24" aria-hidden="true">
             <path d="M20.2 14.6a8.4 8.4 0 1 1-10.8-11A8.6 8.6 0 0 0 12 22a8.6 8.6 0 0 0 8.2-7.4z" fill="currentColor"/>
           </svg>`
  };
  const btn = $('#themeToggle');
  function setIcon(theme){ btn.innerHTML = theme==='dark' ? ICONS.sun : ICONS.moon; }
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme; setIcon(theme);
  btn.addEventListener('click', ()=>{
    const next = (document.documentElement.dataset.theme==='dark') ? 'light':'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('theme', next); setIcon(next);
  });
})();

// ---------- Main ----------
async function main(){
  await loadOxford();
  populateTopics();
  setSource('ox5000');
  setActiveLevel('A1');
  updateTitle();

  $('#generateBtn').addEventListener('click', ()=> renderWords(pickWords(10)));
  $('#reshuffleBtn').addEventListener('click', ()=> renderWords(pickWords(10)));
  $$('.btn-level').forEach(b=> b.addEventListener('click', ()=>{ setActiveLevel(b.dataset.level); updateTitle(); }));
  $$('.pill').forEach(b=> b.addEventListener('click', ()=> setSource(b.dataset.source)));
  $('#copyBtn').addEventListener('click', copyList);
  $('#csvBtn').addEventListener('click', exportCSV);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); renderWords(pickWords(10)); } });

  // Initial list
  renderWords(pickWords(10));
}
main();
