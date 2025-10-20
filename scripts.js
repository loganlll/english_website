const btn     = document.querySelector('.btn');
const img     = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl  = document.querySelector('#questions');
const vocabEl = document.querySelector('#vocab');

let QUESTIONS = null;
let VOCAB     = null;
let busy      = false;

// Cache-busting in case GitHub Pages serves old JSON
const Q_VER = 'v6';
const V_VER = 'v2';

Promise.all([
  fetch('questions.json?' + Q_VER).then(r=>r.json()),
  fetch('vocab.json?'     + V_VER).then(r=>r.json())
]).then(([q, v]) => {
  QUESTIONS = q.questions;
  VOCAB     = v;
}).catch(err => {
  console.error(err);
  topicEl.textContent = 'Error loading questions.';
});

const pick  = arr => arr[Math.floor(Math.random()*arr.length)];
const pickN = (arr, n) => {
  const pool=[...arr], out=[];
  while(pool.length && out.length<n){
    out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  return out;
};

function topicCategory(topic){
  const map = VOCAB.topic_to_cat || {};
  if (map[topic]) return map[topic];
  // Fallback: rough matching
  const t = topic.toLowerCase();
  for(const [cat, list] of Object.entries(VOCAB.cats)){
    if (list.some(k => t.includes(k.toLowerCase()))) return cat;
  }
  return 'general';
}

function buildVocab(topic){
  // 1) per-topic override
  if (VOCAB.topic && VOCAB.topic[topic]) {
    return pickN(VOCAB.topic[topic], Math.min(8, VOCAB.topic[topic].length));
  }
  // 2) category fallback
  const cat = topicCategory(topic);
  const bank = VOCAB.cat && VOCAB.cat[cat] ? VOCAB.cat[cat] : (VOCAB.cat.general || []);
  return pickN(bank, Math.min(8, bank.length));
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
    const qs     = (QUESTIONS[topic] || []).slice(0,5);

    if (img) img.src = 'img/trans.png'; // will auto-hide if missing (onerror in HTML)

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
  }, 300);
}

btn.addEventListener('click', generate);
document.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
