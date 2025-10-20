// Topic Generator (vocab level slider + safer vocab pooling)
const btnGenerate   = document.querySelector('#btn-generate');
const btnReshuffle  = document.querySelector('#btn-reshuffle');
const btnVocabShuffle = document.querySelector('#btn-vocab-shuffle');
const img     = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl  = document.querySelector('#questions');
const vocabEl = document.querySelector('#vocab');

const searchWrap = document.querySelector('.search');
const searchInput = document.querySelector('#search');
const suggBox = document.querySelector('#topic-suggestions');

// sliders
const depthRange = document.querySelector('#depthRange');
const depthLegend = document.querySelector('.depth__legend');
const vocabRange = document.querySelector('#vocabRange');
const vocabLegend = document.querySelector('.vdepth .depth__legend');

// text size
const fsBtns = Array.from(document.querySelectorAll('.fs-btn'));
const root = document.documentElement;

// State
let QUESTIONS = null;
let VOCAB     = null;
let TOPICS    = [];
let busy      = false;
let lastTopic = null;
let DIFF      = 'medium';
let VOCAB_LEVEL = 0; // 0=B2,1=C1,2=C2
let TEXT_SIZE = localStorage.getItem('tg_textsize') || 'm';

// Cache params
const Q_VER = 'q30';
const V_VER = 'v31';

Promise.all([
  fetch('questions.json?' + Q_VER).then(r => r.json()),
  fetch('vocab.json?'     + V_VER).then(r => r.json())
]).then(([q, v]) => {
  QUESTIONS = q.questions;
  VOCAB     = v;
  TOPICS    = Object.keys(QUESTIONS).sort((a,b)=>a.localeCompare(b));
  if (searchInput.value.trim()) drawSuggestions(filterTopics(searchInput.value));

  // global freq maps
  window.__LV_FREQ__ = {B2:new Map(), C1:new Map(), C2:new Map()};
  if (VOCAB.topic_levels){
    for (const [t, levels] of Object.entries(VOCAB.topic_levels)){
      for (const k of ['B2','C1','C2']){
        (levels[k]||[]).forEach(w=>{
          const key = String(w).toLowerCase();
          const m = window.__LV_FREQ__[k];
          m.set(key, (m.get(key)||0)+1);
        });
      }
    }
  }
  window.__RECENT_LEVEL__ = {B2:[], C1:[], C2:[]};
  applyTextSize(TEXT_SIZE);
  highlightFsButton(TEXT_SIZE);
}).catch(err => {
  console.error('Load error:', err);
  topicEl.textContent = 'Error loading questions.';
});

const pick  = arr => arr[Math.floor(Math.random()*arr.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function pickNewTopic(){
  if (!TOPICS.length) return null;
  if (TOPICS.length === 1) return TOPICS[0];
  let t=null, tries=0;
  do { t = pick(TOPICS); tries++; } while (t === lastTopic && tries < 20);
  return t;
}

// Questions
function sampleN(arr, n){
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0, n);
}
function getPrompts(topic){
  const entry = QUESTIONS[topic];
  if (!entry) return [];
  if (!Array.isArray(entry) && (entry.easy || entry.medium || entry.hard)){
    const want = DIFF;
    if (entry[want] && entry[want].length) return sampleN(entry[want], 10);
    if (entry.medium && entry.medium.length) return sampleN(entry.medium, 10);
    const first = Object.values(entry).find(a => Array.isArray(a) && a.length);
    return first ? sampleN(first, 10) : [];
  }
  return sampleN((entry || []), 10);
}

// Vocab helpers (safer, no cross-topic mixing to avoid off-topic chips)
function pickUniqueForLevel(topic, level){
  const L = (VOCAB.topic_levels && VOCAB.topic_levels[topic] && VOCAB.topic_levels[topic][level]) || [];
  const freq = (window.__LV_FREQ__ && window.__LV_FREQ__[level]) || new Map();
  for (const w of L){ if ((freq.get(String(w).toLowerCase())||0) === 1) return w; }
  return L[0] || null;
}

function take7(topic, level){
  const levelKey = ['B2','C1','C2'][level];
  const base = (VOCAB.topic_levels && VOCAB.topic_levels[topic] && VOCAB.topic_levels[topic][levelKey]) || [];
  const uniqWord = pickUniqueForLevel(topic, levelKey);
  let pool = Array.from(new Set([...(uniqWord ? [uniqWord]:[]), ...base]));
  pool = shuffle(pool);
  let items = pool.slice(0,7);
  if (uniqWord && !items.includes(uniqWord) && pool.length){
    items[items.length-1] = uniqWord;
  }
  return {items, unique: uniqWord || null, level: levelKey};
}

// Render
function currentTopic(){
  const upper = topicEl.textContent.trim();
  return TOPICS.find(t => t.toUpperCase() === upper) || null;
}
function render(topic){
  if (!topic || !QUESTIONS || !VOCAB) return;
  lastTopic = topic;
  img && (img.src = 'img/trans.png');
  topicEl.textContent = topic.toUpperCase();
  btnReshuffle.disabled = false;

  const qs = getPrompts(topic);
  listEl.innerHTML = '';
  qs.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    listEl.appendChild(li);
  });

  renderVocab(topic);
}

function renderVocab(topic){
  vocabEl.innerHTML = '';
  const pack = take7(topic, VOCAB_LEVEL);
  (pack.items || []).forEach(w => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (pack.unique && w === pack.unique ? ' unique' : '');
    chip.textContent = w;
    vocabEl.appendChild(chip);
  });
  // Update slider legend active state
  Array.from(vocabLegend.children).forEach((el,i)=>{ el.classList.toggle('active', i===VOCAB_LEVEL); });
  vocabRange.setAttribute('aria-valuenow', String(VOCAB_LEVEL));
  vocabRange.setAttribute('aria-label', `Vocabulary Level: ${['B2','C1','C2'][VOCAB_LEVEL]}`);
}

// Autocomplete
let activeIndex = -1;
function filterTopics(q){
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const starts = TOPICS.filter(t => t.toLowerCase().startsWith(s));
  const contains = TOPICS.filter(t => !starts.includes(t) && t.toLowerCase().includes(s));
  return [...starts, ...contains].slice(0, 8);
}
function drawSuggestions(items){
  if(!suggBox) return;
  suggBox.innerHTML = '';
  activeIndex = -1;
  if (!items.length){ searchWrap.setAttribute('aria-expanded','false'); suggBox.style.display='none'; return; }
  items.forEach((t,i)=>{
    const li = document.createElement('li');
    li.id = `sugg-${i}`;
    li.role = 'option';
    li.textContent = t;
    li.tabIndex = -1;
    li.addEventListener('mousedown', e => { e.preventDefault(); choose(t); });
    suggBox.appendChild(li);
  });
  searchWrap.setAttribute('aria-expanded','true'); suggBox.style.display='block';
}
function choose(topic){
  lastTopic = topic;
  if (suggBox){ suggBox.style.display='none'; suggBox.innerHTML=''; }
  if (searchWrap){ searchWrap.setAttribute('aria-expanded','false'); }
  activeIndex = -1; searchInput.setAttribute('aria-activedescendant','');
  searchInput.value = topic;
  render(topic);
  searchInput.setSelectionRange(topic.length, topic.length);
}
searchInput.addEventListener('input', (e)=>{
  if (!TOPICS.length){ drawSuggestions(['Loading…']); return; }
  drawSuggestions(filterTopics(e.target.value));
});
searchInput.addEventListener('keydown', (e)=>{
  const items = Array.from(suggBox.children);
  if (e.key === 'ArrowDown' && items.length){
    e.preventDefault(); activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === 'ArrowUp' && items.length){
    e.preventDefault(); activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === 'Enter'){
    e.preventDefault();
    if (items.length && activeIndex >= 0){
      choose(items[activeIndex].textContent);
    } else {
      const exact = TOPICS.find(t => t.toLowerCase() === searchInput.value.trim().toLowerCase());
      if (exact) choose(exact); else generateRandom();
    }
    if (suggBox){ suggBox.style.display='none'; }
    searchWrap.setAttribute('aria-expanded','false');
    activeIndex = -1; searchInput.setAttribute('aria-activedescendant','');
    return;
  } else if (e.key === 'Escape'){
    searchWrap.setAttribute('aria-expanded','false'); if (suggBox){ suggBox.style.display='none'; } return;
  } else { return; }
  items.forEach((el,i)=>{ el.setAttribute('aria-selected', i===activeIndex ? 'true':'false'); });
  const activeEl = items[activeIndex]; if (activeEl){ searchInput.setAttribute('aria-activedescendant', activeEl.id); activeEl.scrollIntoView({block:'nearest'}); }
});
document.addEventListener('click', (e)=>{
  if (!searchWrap.contains(e.target)){
    searchWrap.setAttribute('aria-expanded','false'); if (suggBox){ suggBox.style.display='none'; }
  }
});

// Controls
function generateRandom(){
  if (busy || !TOPICS.length) return;
  busy = true;
  topicEl.textContent=''; listEl.innerHTML=''; vocabEl.innerHTML='';
  if (img) img.src = 'img/loader.gif';
  setTimeout(()=>{ render(pickNewTopic()); busy=false; }, 200);
}

btnGenerate.addEventListener('click', generateRandom);
btnReshuffle.addEventListener('click', ()=>{
  const t = currentTopic();
  if (t) render(t);
});
btnVocabShuffle.addEventListener('click', ()=>{
  const t = currentTopic();
  if (t) renderVocab(t);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement !== searchInput) generateRandom();
  if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey){ const t = currentTopic(); if (t) render(t); }
});

depthRange.addEventListener('input', (e)=>{
  const val = Number(e.target.value);
  const map = ['easy','medium','hard'];
  DIFF = map[val];
  Array.from(depthLegend.children).forEach((el,i)=>{ el.classList.toggle('active', i===val); });
  const t = currentTopic(); if (t) render(t);
});

vocabRange.addEventListener('input', (e)=>{
  VOCAB_LEVEL = Number(e.target.value);
  const t = currentTopic(); if (t) renderVocab(t);
});

// Text size
function applyTextSize(size){
  if (size === 's') root.style.setProperty('--qsize', '20px');
  else if (size === 'l') root.style.setProperty('--qsize', '24px');
  else root.style.setProperty('--qsize', '22px');
}
function highlightFsButton(size){
  fsBtns.forEach(b => b.classList.toggle('active', b.dataset.size === size));
}
fsBtns.forEach(btn => btn.addEventListener('click', ()=>{
  const size = btn.dataset.size;
  TEXT_SIZE = size; localStorage.setItem('tg_textsize', size);
  applyTextSize(size); highlightFsButton(size);
}));
