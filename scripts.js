// Static Topic Generator — 10 conversation prompts + robust vocab
const btn     = document.querySelector('.btn');
const img     = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl  = document.querySelector('#questions');
const vocabEl = document.querySelector('#vocab');

let QUESTIONS = null;
let VOCAB     = null;
let busy      = false;

// Bump these whenever you update the JSONs
const Q_VER = 'q12';
const V_VER = 'v12';

Promise.all([
  fetch('questions.json?' + Q_VER).then(r => r.json()),
  fetch('vocab.json?'     + V_VER).then(r => r.json())
]).then(([q, v]) => {
  QUESTIONS = q.questions;
  VOCAB     = v;
}).catch(err => {
  console.error('Load error:', err);
  topicEl.textContent = 'Error loading questions.';
});

const pick  = arr => arr[Math.floor(Math.random()*arr.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function uniq(arr){return [...new Set(arr)];}

function topicCategory(topic){
  const map = VOCAB.topic_to_cat || {};
  if (map[topic]) return map[topic];
  const t = topic.toLowerCase();
  for(const [cat, list] of Object.entries(VOCAB.cats || {})){
    if (list.some(k => t.includes(k.toLowerCase()))) return cat;
  }
  return 'general';
}

function buildVocab(topic){
  // Aim for 12 words. Prefer topic-specific, then fill with category/general.
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

function generate(){
  if (busy || !QUESTIONS || !VOCAB) return;
  busy = true;

  topicEl.textContent = '';
  listEl.innerHTML = '';
  vocabEl.innerHTML = '';
  if (img) img.src = 'img/loader.gif';

  setTimeout(() => {
    const topics = Object.keys(QUESTIONS);
    const topic  = pick(topics);
    const qs     = (QUESTIONS[topic] || []).slice(0, 10);

    if (img) img.src = 'img/trans.png';
    topicEl.textContent = topic.toUpperCase();

    qs.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      listEl.appendChild(li);
    });

    buildVocab(topic).forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = w;
      vocabEl.appendChild(chip);
    });

    busy = false;
  }, 250);
}

btn.addEventListener('click', generate);
document.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
