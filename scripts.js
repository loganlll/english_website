// Topic Generator (dark-mode toggle + animated entry + colored buttons + 10 prompts)
const btnGenerate   = document.querySelector('#btn-generate');
const btnReshuffle  = document.querySelector('#btn-reshuffle');
const btnVocabShuffle = document.querySelector('#btn-vocab-shuffle');
const vLevelBtns = Array.from(document.querySelectorAll('.vbtn'));
const btnTheme = document.querySelector('#btn-theme');

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
const Q_VER = 'q31';
const V_VER = 'v32';

// Theme
function applyTheme(mode){
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('tg_theme', mode);
  btnTheme.textContent = (mode === 'dark') ? '☀️' : '🌙';
}
(function initTheme(){
  const saved = localStorage.getItem('tg_theme');
  if (saved) applyTheme(saved);
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();
btnTheme.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

Promise.all([
  fetch('questions.json?' + Q_VER).then(r => r.json()),
  fetch('vocab.json?'     + V_VER).then(r => r.json())
]).then(([q, v]) => {
  QUESTIONS = q.questions;
  VOCAB     = v;
  TOPICS    = Object.keys(QUESTIONS).sort((a,b)=>a.localeCompare(b));
  if (searchInput.value.trim()) drawSuggestions(filterTopics(searchInput.value));
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
const PROMPTS_TO_SHOW = 10;
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
    let pool = entry[want] && entry[want].length ? entry[want] : (entry.medium || entry.easy || entry.hard || []);
    return sampleN(pool, PROMPTS_TO_SHOW);
  }
  return sampleN((entry || []), PROMPTS_TO_SHOW);
}

// Vocab helpers (topic-only list; bigger pools are in JSON)
function takeN(topic, level, n=9){
  const levelKey = ['B2','C1','C2'][level];
  const base = (VOCAB.topic_levels && VOCAB.topic_levels[topic] && VOCAB.topic_levels[topic][levelKey]) || [];
  const uniqWord = base[0] || null;
  let pool = Array.from(new Set([...(uniqWord ? [uniqWord]:[]), ...base]));
  pool = shuffle(pool);
  let items = pool.slice(0,n);
  if (uniqWord && !items.includes(uniqWord) && pool.length){
    items[items.length-1] = uniqWord;
  }
  return {items, unique: uniqWord || null, level: levelKey};
}

// Render helpers (with staggered animations)
function animateList(container){
  Array.from(container.children).forEach((el, i) => {
    el.classList.remove('q-enter');
    // force reflow to restart animation
    void el.offsetWidth;
    el.style.animationDelay = (i * 40) + 'ms';
    el.classList.add('q-enter');
  });
}
function animateChips(container){
  Array.from(container.children).forEach((el, i) => {
    el.classList.remove('chip-enter');
    void el.offsetWidth;
    el.style.animationDelay = (i * 30) + 'ms';
    el.classList.add('chip-enter');
  });
}

function currentTopic(){
  const upper = topicEl.textContent.trim();
  return TOPICS.find(t => t.toUpperCase() === upper) || null;
}
function render(topic){
  if (!topic || !QUESTIONS || !VOCAB) return;
  lastTopic = topic;
  if (img){ img.src = 'img/trans.png'; img.style.display='block'; }
  topicEl.textContent = topic.toUpperCase();
  btnReshuffle.disabled = false;

  const qs = getPrompts(topic);
  listEl.innerHTML = '';
  qs.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    listEl.appendChild(li);
  });
  animateList(listEl);
  renderVocab(topic);
}

function renderVocab(topic){
  vocabEl.innerHTML = '';
  const pack = takeN(topic, VOCAB_LEVEL, 9);
  (pack.items || []).forEach(w => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (pack.unique && w === pack.unique ? ' unique' : '');
    chip.textContent = w;
    vocabEl.appendChild(chip);
  });
  animateChips(vocabEl);
  vLevelBtns.forEach((b,i)=>b.classList.toggle('active', i===VOCAB_LEVEL));
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
  if (img){ img.src = 'img/loader.gif'; img.style.display='block'; }
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
vLevelBtns.forEach(btn => btn.addEventListener('click', ()=>{
  VOCAB_LEVEL = Number(btn.dataset.lvl);
  const t = currentTopic(); if (t) renderVocab(t);
  vLevelBtns.forEach(b => b.classList.toggle('active', b===btn));
}));

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
