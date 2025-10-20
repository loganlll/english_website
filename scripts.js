// Utilities
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const rand = (n)=>Math.floor(Math.random()*n);
const choice = (a)=>a[rand(a.length)];
const shuffle = (a)=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);
const sample = (a,k)=> (k>=a.length?shuffle(a):shuffle(a).slice(0,k));

// State
let QUESTIONS=null, VOCAB=null, TOPICS=[], CURRENT_TOPIC=null, LAST_TOPIC=null, CURRENT_LEVEL="B2";

// Oxford mode
let OXFORD_MODE=false, OXFORD=null;

// Build VOCAB.levels from our oxford JSON
function buildVocabFromOxford(ox){
  const levelMap = {A1:[], A2:[], B1:[], B2:[], C1:[], C2:[]};
  const entries = ox.oxford_5000_full || [];
  for(const e of entries){
    // collect all CEFR levels for this entry (union across POS tags)
    const levels = new Set();
    const pl = e.pos_levels || {};
    for(const k in pl){ (pl[k]||[]).forEach(l=>levels.add(l)); }
    if(levels.size===0) continue;
    // choose a display headword: strip trailing digits like 'wind1'
    let head = (e.lemma || e.head || "").toString();
    head = head.replace(/\d+$/,"").trim();
    // optional: strip parentheses explanations at end (keep main word)
    head = head.replace(/\s*\([^)]*\)\s*$/,"").trim();
    if(!head) continue;
    for(const lv of levels){
      if(levelMap[lv]) levelMap[lv].push(head);
    }
  }
  // de-duplicate words within levels
  for(const k in levelMap){
    levelMap[k] = Array.from(new Set(levelMap[k])).sort((a,b)=>a.localeCompare(b));
  }
  VOCAB = {levels: levelMap, topic_levels: {}};
}

// Load data
async function loadData(){
  // Try Oxford JSON first
  try{
    OXFORD = await fetch('./oxford_wordlists.json',{cache:'no-store'}).then(r=>r.json());
    buildVocabFromOxford(OXFORD);
    OXFORD_MODE = true;
    // Minimal stub for questions/topics to keep UI happy
    QUESTIONS = {questions: {"Oxford 5000": {easy:[], medium:[], hard:[]}}};
    TOPICS = ["Oxford 5000"];
    return;
  }catch(_){ /* fall through to legacy mode */ }
  // Legacy mode: original JSONs
  QUESTIONS = await fetch('./questions.json',{cache:'no-store'}).then(r=>r.json());
  TOPICS = Object.keys(QUESTIONS.questions);
  try{
    VOCAB = await fetch('./vocab.json',{cache:'no-store'}).then(r=>r.json());
  }catch(_){
    VOCAB = {levels:{B2:[],C1:[],C2:[]}, topic_levels:{}};
  }
}).then(r=>r.json());
  TOPICS = Object.keys(QUESTIONS.questions);
  try{
    VOCAB = await fetch('./vocab.json',{cache:'no-store'}).then(r=>r.json());
  }catch(_){
    VOCAB = {levels:{B2:[],C1:[],C2:[]}, topic_levels:{}};
  }
}

// Depth
const bandFromDepth = v => v<34 ? 'easy' : (v<67 ? 'medium' : 'hard');

// Render
function setTitle(topic){ $('#topicTitle').textContent = topic.toUpperCase(); }

function renderQuestions(topic){
  const list = $('#questionList'); list.innerHTML="";
  const band = bandFromDepth( +$('#depthRange').value );
  const set = QUESTIONS.questions[topic] || {easy:[],medium:[],hard:[]};
  let qs = (set[band]||[]);
  if (qs.length >= 10) qs = sample(qs,10);
  else {
    const rest = [...(set.easy||[]),...(set.medium||[]),...(set.hard||[])].filter(x=>!qs.includes(x));
    qs = qs.concat(sample(rest, Math.max(0,10-qs.length)));
  }
  qs.forEach((q,i)=>{
    const li = document.createElement('li');
    li.textContent = q;
    li.className = 'q-enter';
    list.appendChild(li);
  });
}

function getVocab(topic, level){
  const tl = VOCAB?.topic_levels?.[topic]?.[level];
  if (tl?.length) return tl;
  const lvl = VOCAB?.levels?.[level] || [];
  return lvl;
}
function renderVocab(topic, level=CURRENT_LEVEL){
  CURRENT_LEVEL = level;
  $$('.btn-level').forEach(b=>b.classList.toggle('is-active', b.dataset.level===level));
  const chips = $('#vocabChips'); chips.innerHTML="";
  const words = getVocab(topic, level);
  const show = sample(words, Math.min(10, words.length||0));
  if(!show.length){ chips.innerHTML = '<span class="chip">No vocabulary available</span>'; return; }
  show.forEach(w=>{
    const el = document.createElement('span');
    el.className='chip'; el.textContent=w; chips.appendChild(el);
  });
}

// Topic picking
function pickFromSearch(){
  const val = $('#searchInput').value.trim().toLowerCase();
  if(!val) return null;
  const exact = TOPICS.find(t=>t.toLowerCase()===val);
  if (exact) return exact;
  const starts = TOPICS.find(t=>t.toLowerCase().startsWith(val));
  if (starts) return starts;
  const inc = TOPICS.find(t=>t.toLowerCase().includes(val));
  return inc || null;
}
function pickRandom(){
  if (!TOPICS.length) return null;
  let t = choice(TOPICS);
  if (LAST_TOPIC && TOPICS.length>1){
    let guard=0;
    while(t===LAST_TOPIC && guard<20){ t=choice(TOPICS); guard++; }
  }
  return t;
}

// Actions
function generate(){
  if (OXFORD_MODE){
    const topic = "Oxford 5000";
    CURRENT_TOPIC = LAST_TOPIC = topic;
    setTitle(topic);
    // no questions in Oxford mode
    $('#questionList').innerHTML = "";
    renderVocab(topic, CURRENT_LEVEL);
    return;
  }
  let topic = pickFromSearch() || pickRandom();
  if(!topic){ alert('No topics available.'); return; }
  CURRENT_TOPIC = LAST_TOPIC = topic;
  setTitle(topic);
  renderQuestions(topic);
  renderVocab(topic, CURRENT_LEVEL);
}
function reshuffle(){
  if(!CURRENT_TOPIC){ generate(); return; }
  renderQuestions(CURRENT_TOPIC);
  renderVocab(CURRENT_TOPIC, CURRENT_LEVEL);
}

// Search suggestions
function updateSuggestions(){
  const box = $('#searchBox'), sug = $('#suggestions');
  const val = $('#searchInput').value.trim().toLowerCase();
  if(!val){ box.setAttribute('aria-expanded','false'); sug.innerHTML=""; return; }
  const items = TOPICS.filter(t=>t.toLowerCase().includes(val)).slice(0,8);
  sug.innerHTML = items.map(t=>`<button type="button" data-sel="${t}">${t}</button>`).join('');
  box.setAttribute('aria-expanded', items.length ? 'true' : 'false');
}
function bindSuggestionClicks(){
  $('#suggestions').addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-sel]'); if(!b) return;
    $('#searchInput').value = b.dataset.sel;
    $('#searchBox').setAttribute('aria-expanded','false');
    generate();
  });
}

// Theme toggle with crisp SVG icons
(function(){
  const btn = $('#themeToggle'); if(!btn) return;
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

// Bind
async function main(){
  await loadData();
  $('#generateBtn').addEventListener('click', generate);
  $('#reshuffleBtn').addEventListener('click', reshuffle);
  $('#depthRange').addEventListener('input', ()=> CURRENT_TOPIC && renderQuestions(CURRENT_TOPIC));
  $$('.btn-level').forEach(b=> b.addEventListener('click', ()=> renderVocab(CURRENT_TOPIC || pickRandom(), b.dataset.level)));
  $('#shuffleVocab').addEventListener('click', ()=> CURRENT_TOPIC && renderVocab(CURRENT_TOPIC, CURRENT_LEVEL));
  $('#searchInput').addEventListener('input', updateSuggestions);
  $('#searchClear').addEventListener('click', ()=>{ $('#searchInput').value=''; $('#searchBox').setAttribute('aria-expanded','false'); $('#suggestions').innerHTML=''; $('#searchInput').focus(); });
  bindSuggestionClicks();

  document.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); generate(); }
  });

  generate();
}

main();
