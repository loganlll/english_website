// Static Topic Generator + Autocomplete — 10 conversation prompts + curated vocab
const btn     = document.querySelector('.btn');
const img     = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl  = document.querySelector('#questions');
const vocabEl = document.querySelector('#vocab');

const searchWrap = document.querySelector('.search');
const searchInput = document.querySelector('#search');
const suggBox = document.querySelector('#topic-suggestions');

let QUESTIONS = null;
let VOCAB     = null;
let TOPICS    = [];
let busy      = false;
let lastTopic = null;

// Bump these when you change JSON
const Q_VER = 'q20';
const V_VER = 'v31';

Promise.all([
  fetch('questions.json?' + Q_VER).then(r => r.json()),
  fetch('vocab.json?'     + V_VER).then(r => r.json())

]).then(([q, v]) => {
  QUESTIONS = q.questions;
  VOCAB     = v;
  TOPICS    = Object.keys(QUESTIONS).sort((a,b)=>a.localeCompare(b));
  // Re-run suggestions in case user already typed while loading
  if (searchInput.value.trim()) {
    drawSuggestions(filterTopics(searchInput.value));
  }
}).catch(err => {

  console.error('Load error:', err);
  topicEl.textContent = 'Error loading questions.';
});

const pick  = arr => arr[Math.floor(Math.random()*arr.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function uniq(arr){return [...new Set(arr)];}

function pickNewTopic(){
  if (!TOPICS.length) return null;
  if (TOPICS.length === 1) return TOPICS[0];
  let t = null, tries = 0;
  do { t = pick(TOPICS); tries++; } while (t === lastTopic && tries < 20);
  return t;
}


function topicCategory(topic){
  const map = VOCAB.topic_to_cat || {};
  if (map[topic]) return map[topic];
  const t = topic.toLowerCase();
  for(const [cat, list] of Object.entries(VOCAB.cats || {})){
    if (Array.isArray(list) && list.some(k => t.includes(String(k).toLowerCase()))) return cat;
  }
  return 'general';
}


function buildVocabLevels(topic){
  const L = (VOCAB.topic_levels && VOCAB.topic_levels[topic]) || null;
  if (!L) return null;
  // ensure exactly 7 per level (randomize if more)
  const take7 = arr => {
    const a = [...arr];
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a.slice(0,7);
  };
  return {
    B2: take7(L.B2 || []),
    C1: take7(L.C1 || []),
    C2: take7(L.C2 || []),
  };
}

function buildVocab(topic){
  const want = 12;
  let words = [];
  if (VOCAB.topic && VOCAB.topic[topic]) {
    words = [...VOCAB.topic[topic]];
  }
  const cat = topicCategory(topic);
  const catPool = (VOCAB.cat && VOCAB.cat[cat]) || [];
  const genPool = (VOCAB.cat && VOCAB.cat.general) || [];
  const pool = uniq([...catPool, ...genPool]);
  while (words.length < want && pool.length){
    words.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  return shuffle(words).slice(0, want);
}

function render(topic){
  if (topic) { lastTopic = topic; }
  if (!topic || !QUESTIONS || !VOCAB) return;
  const qs = (QUESTIONS[topic] || []).slice(0, 10);

  img && (img.src = 'img/trans.png');
  topicEl.textContent = topic.toUpperCase();

  // questions
  listEl.innerHTML = '';
  qs.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    listEl.appendChild(li);
  });

  // vocab by levels
  vocabEl.innerHTML = '';
  const levels = buildVocabLevels(topic);
  if (levels){
    const wrapper = document.createElement('div');
    wrapper.className = 'vocab-groups';
    for (const key of ['B2','C1','C2']){
      const g = document.createElement('div');
      g.className = 'vgroup';
      const h = document.createElement('h4');
      h.textContent = key;
      g.appendChild(h);
      const row = document.createElement('div');
      row.className = 'chips';
      (levels[key] || []).forEach(w => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = w;
        row.appendChild(chip);
      });
      g.appendChild(row);
      wrapper.appendChild(g);
    }
    vocabEl.appendChild(wrapper);
  } else {
    buildVocab(topic).forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = w;
      vocabEl.appendChild(chip);
    });
  }
}

function generateRandom(){
  if (busy || !TOPICS.length) return;
  busy = true;
  topicEl.textContent = '';
  listEl.innerHTML = '';
  vocabEl.innerHTML = '';
  img && (img.src = 'img/loader.gif');
  setTimeout(() => {
    render(pickNewTopic());
    busy = false;
  }, 200);
}

// ===== Autocomplete =====
let activeIndex = -1;
function filterTopics(q){
  const s = q.trim().toLowerCase();
  if (!s) return [];
  // startsWith first, then includes
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
  searchInput.value = topic;
  searchWrap.setAttribute('aria-expanded','false');
  render(topic);
  searchInput.setSelectionRange(topic.length, topic.length);
}


searchInput.addEventListener('input', (e)=>{
  if (!TOPICS.length){ // data still loading
    drawSuggestions(['Loading…']);
    return;
  }
  const items = filterTopics(e.target.value);
  drawSuggestions(items);
});


searchInput.addEventListener('keydown', (e)=>{
  const items = Array.from(suggBox.children);
  if (e.key === 'ArrowDown' && items.length){
    e.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
  } else if (e.key === 'ArrowUp' && items.length){
    e.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
  } else if (e.key === 'Enter'){
    e.preventDefault();
    if (items.length && activeIndex >= 0){
      choose(items[activeIndex].textContent);
    } else {
      // If user typed an exact topic, use it; otherwise random
      const exact = TOPICS.find(t => t.toLowerCase() === searchInput.value.trim().toLowerCase());
      if (exact) choose(exact); else generateRandom();
    }
    return;
  } else if (e.key === 'Escape'){
    searchWrap.setAttribute('aria-expanded','false');
    return;
  } else {
    return; // let other keys flow
  }
  // update active styles
  items.forEach((el,i)=>{
    el.setAttribute('aria-selected', i===activeIndex ? 'true':'false');
  });
  const activeEl = items[activeIndex];
  if (activeEl){
    searchInput.setAttribute('aria-activedescendant', activeEl.id);
    activeEl.scrollIntoView({block:'nearest'});
  }
});

document.addEventListener('click', (e)=>{
  if (!searchWrap.contains(e.target)){
    searchWrap.setAttribute('aria-expanded','false');
  }
});

// Buttons & Enter (global)
btn.addEventListener('click', generateRandom);
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement !== searchInput) generateRandom();
});
