// Topic Generator with search, depth, leveled vocab, and no duplicate randoms
const btn     = document.querySelector('.btn');
const img     = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl  = document.querySelector('#questions');
const vocabEl = document.querySelector('#vocab');

const searchWrap = document.querySelector('.search');
const searchInput = document.querySelector('#search');
const suggBox = document.querySelector('#topic-suggestions');
const diffInputs = Array.from(document.querySelectorAll('input[name="difficulty"]'));

let QUESTIONS = null;
let VOCAB     = null;
let TOPICS    = [];
let busy      = false;
let lastTopic = null;
let DIFF      = 'medium';

// Cache params for JSON
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
  // Build global frequency maps per level to help pick unique chips
  window.__LV_FREQ__ = {B2: new Map(), C1: new Map(), C2: new Map()};
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
  let t=null, tries=0;
  do { t = pick(TOPICS); tries++; } while (t === lastTopic && tries < 20);
  return t;
}

// ===== Questions helpers =====

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


// ===== Vocab helpers =====
function buildVocabLevels(topic){
  const L = (VOCAB.topic_levels && VOCAB.topic_levels[topic]) || null;
  if (!L) return null;
  const take7 = arr => {
    const a=[...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];}
    return a.slice(0,7);
  };
  return { B2: take7(L.B2||[]), C1: take7(L.C1||[]), C2: take7(L.C2||[]) };
}


function pickUniqueForLevel(topic, level){
  const L = (VOCAB.topic_levels && VOCAB.topic_levels[topic] && VOCAB.topic_levels[topic][level]) || [];
  const freq = (window.__LV_FREQ__ && window.__LV_FREQ__[level]) || new Map();
  for (const w of L){
    if ((freq.get(String(w).toLowerCase())||0) === 1) return w;
  }
  const cat = (VOCAB.topic_to_cat && VOCAB.topic_to_cat[topic]) || 'general';
  let extras = [];
  if (VOCAB.cat && VOCAB.cat[cat]) extras = extras.concat(VOCAB.cat[cat]);
  if (VOCAB.cat && VOCAB.cat.general) extras = extras.concat(VOCAB.cat.general);
  for (const w of extras){
    const key = String(w).toLowerCase();
    if (!freq.has(key)) return w;
  }
  return L[0] || null;
}

// ===== Render =====
function render(topic){
  if (!topic || !QUESTIONS || !VOCAB) return;
  lastTopic = topic;
  img && (img.src = 'img/trans.png');
  topicEl.textContent = topic.toUpperCase();

  // Prompts
  const qs = getPrompts(topic);
  listEl.innerHTML = '';
  qs.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    listEl.appendChild(li);
  });

  // Vocab (by level)
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
      let arr = [...(levels[key] || [])];
      if (arr.length){
        const uniqWord = pickUniqueForLevel(topic, key);
        if (uniqWord){
          const set = new Set([uniqWord, ...arr]);
          arr = Array.from(set);
        }
      }
      for (let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
      arr.slice(0,7).forEach(w=>{
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = w;
        row.appendChild(chip);
      });
      g.appendChild(row);
      wrapper.appendChild(g);
    }
    vocabEl.appendChild(wrapper);
  }
}

// ===== Autocomplete =====
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

// ===== Generate & controls =====
function generateRandom(){
  if (busy || !TOPICS.length) return;
  busy = true;
  topicEl.textContent=''; listEl.innerHTML=''; vocabEl.innerHTML='';
  if (img) img.src = 'img/loader.gif';
  setTimeout(()=>{ render(pickNewTopic()); busy=false; }, 200);
}

btn.addEventListener('click', generateRandom);
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement !== searchInput) generateRandom();
});
diffInputs.forEach(r => r.addEventListener('change', (e)=>{
  DIFF = e.target.value;
  if (topicEl.textContent){
    const current = TOPICS.find(t => t.toUpperCase() === topicEl.textContent.trim());
    if (current) render(current);
  }
}));
