/* Topic Generator – consolidated JS (search clear integrated) */

// ===== Utilities =====
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const rand = (n) => Math.floor(Math.random()*n);
const choice = (arr) => arr[rand(arr.length)];
const shuffle = (arr) => arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(p=>p[1]);
const sample = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));

// ===== State =====
const state = {
  questions: null,
  vocab: null,
  topics: [],
  lastTopic: null,
  currentTopic: null,
  difficulty: localStorage.getItem('tg:difficulty') || 'medium', // easy/medium/hard
  fontSize: localStorage.getItem('tg:qsize') || 'M',             // S/M/L
  vocabLevel: localStorage.getItem('tg:vlevel') || 'C2',         // B2/C1/C2
  theme: localStorage.getItem('tg:theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
};

// ===== Elements =====
const el = {
  generate: $('#generateBtn'),
  reshuffle: $('#reshuffleBtn'),
  searchWrap: $('.search'),
  search: $('#searchInput'),
  suggestions: $('.search__suggestions'),
  depth: $('#depthRange'),
  legends: {
    easy: $('#legendEasy'), med: $('#legendMed'), hard: $('#legendHard')
  },
  sizeBtns: $$('.fs-btn'),
  themeToggle: $('#themeToggle'),
  title: $('#topicTitle'),
  qlist: $('#questionsList'),
  vBtns: $$('.vbtn'),
  vChips: $('#vocabChips'),
  shuffleVocab: $('#shuffleVocab'),
};

// ===== Init =====
async function boot(){
  // theme
  document.documentElement.setAttribute('data-theme', state.theme);
  // text size
  applyTextSize(state.fontSize);

  // difficulty slider
  const dmap = {easy:0, medium:1, hard:2};
  el.depth.value = dmap[state.difficulty] ?? 1;
  setLegend();

  // fetch data
  try {
    const [qRes, vRes] = await Promise.all([fetch('questions.json'), fetch('vocab.json')]);
    state.questions = await qRes.json();
    state.vocab = await vRes.json();
  } catch(e){
    el.title.textContent = 'Error loading questions.';
    console.error(e);
    return;
  }

  // topics list
  state.topics = Object.keys(state.questions.questions);

  wireEvents();
  // keyboard
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && document.activeElement !== el.search) {
      handleGenerate();
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);

// ===== Events =====
function wireEvents(){
  el.generate.addEventListener('click', handleGenerate);
  el.reshuffle.addEventListener('click', ()=>{
    if (state.currentTopic) renderTopic(state.currentTopic);
  });

  // search input + suggestions
  el.search.addEventListener('input', onSearchInput);
  el.search.addEventListener('focus', ()=> el.searchWrap.setAttribute('aria-expanded','true'));
  el.search.addEventListener('blur', ()=> setTimeout(()=>el.searchWrap.setAttribute('aria-expanded','false'), 120));

  // add clear [×] inside search
  mountSearchClear();

  el.depth.addEventListener('input', onDepthChange);

  el.sizeBtns.forEach(btn=>btn.addEventListener('click', ()=>{
    el.sizeBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    state.fontSize = btn.dataset.size;
    localStorage.setItem('tg:qsize', state.fontSize);
    applyTextSize(state.fontSize);
  }));

  el.themeToggle.addEventListener('click', ()=>{
    state.theme = (state.theme==='dark'?'light':'dark');
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('tg:theme', state.theme);
  });

  el.vBtns.forEach(b => b.addEventListener('click', ()=>{
    el.vBtns.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.vocabLevel = b.dataset.level;
    localStorage.setItem('tg:vlevel', state.vocabLevel);
    renderVocab(state.currentTopic);
  }));

  el.shuffleVocab.addEventListener('click', ()=> renderVocab(state.currentTopic));

  // click suggestion
  el.suggestions.addEventListener('click', (e)=>{
    const li = e.target.closest('li');
    if (!li) return;
    const topic = li.dataset.topic;
    el.search.value = topic;
    el.searchWrap.setAttribute('aria-expanded','false');
    renderTopic(topic);
  });
}

function handleGenerate(){
  // pick a new random topic not equal to lastTopic
  let topic = choice(state.topics);
  if (state.lastTopic && state.topics.length > 1){
    let safety = 0;
    while (topic === state.lastTopic && safety < 10){
      topic = choice(state.topics); safety++;
    }
  }
  renderTopic(topic);
}

// ===== Rendering =====
function renderTopic(topic){
  state.currentTopic = topic;
  state.lastTopic = topic;
  el.title.textContent = topic.toUpperCase();

  // questions by difficulty
  const band = getBand();
  const allQs = state.questions.questions[topic]?.[band] || [];
  const qs = sample(allQs, 10);

  el.qlist.innerHTML = '';
  qs.forEach((q, i)=>{
    const li = document.createElement('li');
    li.textContent = q;
    li.classList.add('q-enter');
    li.style.animationDelay = `${i*40}ms`;
    el.qlist.appendChild(li);
  });

  renderVocab(topic);
}

function renderVocab(topic){
  el.vChips.innerHTML = '';
  const lvl = state.vocabLevel;
  const t = state.vocab.topic_levels?.[topic]?.[lvl];
  const fallback = state.vocab.levels?.[lvl] || [];
  const pool = (t && t.length? t: fallback);
  const items = sample(pool, 12);
  items.forEach((w, i)=>{
    const span = document.createElement('span');
    span.className = 'chip chip-enter';
    span.style.animationDelay = `${i*35}ms`;
    span.textContent = w;
    el.vChips.appendChild(span);
  });
}

function getBand(){
  const val = Number(el.depth.value);
  const band = (val===0)?'easy':(val===2)?'hard':'medium';
  state.difficulty = band;
  localStorage.setItem('tg:difficulty', band);
  setLegend();
  return band;
}
function setLegend(){
  const val = Number(el.depth.value);
  el.legends.easy.classList.toggle('active', val===0);
  el.legends.med.classList.toggle('active', val===1);
  el.legends.hard.classList.toggle('active', val===2);
}
function onDepthChange(){ getBand(); if (state.currentTopic) renderTopic(state.currentTopic); }

function applyTextSize(size){
  const map = {S:'20px', M:'22px', L:'26px'};
  document.documentElement.style.setProperty('--qsize', map[size] || '22px');
  el.sizeBtns.forEach(b=> b.classList.toggle('active', b.dataset.size===size));
}

// ===== Search =====
function onSearchInput(){
  const q = el.search.value.trim().toLowerCase();
  const ul = el.suggestions;
  ul.innerHTML='';
  if (!q){ el.searchWrap.setAttribute('aria-expanded','false'); return; }

  const hits = state.topics.filter(t => t.toLowerCase().includes(q)).slice(0,12);
  hits.forEach((t,i)=>{
    const li = document.createElement('li');
    li.textContent = t;
    li.dataset.topic = t;
    if (i===0) li.setAttribute('aria-selected','true');
    ul.appendChild(li);
  });
  el.searchWrap.setAttribute('aria-expanded','true');
}

// Add a clear “×” inside the search box; second click (when empty) clears the rendered topic.
function mountSearchClear(){
  const wrap = el.searchWrap;
  let btn = wrap.querySelector('.search__clear');
  if (!btn){
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search__clear';
    btn.setAttribute('aria-label','Clear search');
    btn.innerHTML = '&times;';
    wrap.appendChild(btn);
  }
  const toggle = () => { btn.style.visibility = el.search.value ? 'visible':'hidden'; };
  toggle();
  el.search.addEventListener('input', toggle);

  const clearTopicUI = () => {
    el.title.textContent = '';
    el.qlist.innerHTML = '';
    el.vChips.innerHTML = '';
  };
  btn.addEventListener('click', ()=>{
    if (el.search.value){
      el.search.value='';
      el.suggestions.innerHTML='';
      wrap.setAttribute('aria-expanded','false');
      toggle();
      el.search.focus();
    }else{
      clearTopicUI();
    }
  });
  el.search.addEventListener('keydown', (e)=>{
    if (e.key==='Escape'){
      if (el.search.value){
        el.search.value=''; el.suggestions.innerHTML=''; wrap.setAttribute('aria-expanded','false'); toggle();
      } else {
        clearTopicUI();
      }
    }
  });
}
