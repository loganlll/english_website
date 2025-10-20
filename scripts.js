
// ==============================
// Helpers
// ==============================
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const randInt = (n) => Math.floor(Math.random()*n);
const choice = (arr) => arr[randInt(arr.length)];
const shuffle = (arr) => arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(p=>p[1]);
const sample = (arr, k) => {
  if (k>=arr.length) return shuffle(arr);
  const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a.slice(0,k);
};
const titleCase = s => s.replace(/\s+/g,' ').trim();

// ==============================
// State
// ==============================
let QUESTIONS = null; // { version, questions: { topic: {easy,medium,hard} } }
let VOCAB = null;     // { levels: {B2:[],C1:[],C2:[]}, topic_levels: {topic:{B2:[],C1:[],C2:[]}} }
let TOPICS = [];
let LAST_TOPIC = null;
let CURRENT_TOPIC = null;
let CURRENT_LEVEL = "B2";

// ==============================
// Fetch questions & vocab
// ==============================
async function loadData(){
  const q = await fetch('questions.json', {cache:'no-store'}).then(r=>r.json());
  QUESTIONS = q;
  TOPICS = Object.keys(q.questions);
  try {
    VOCAB = await fetch('vocab.json', {cache:'no-store'}).then(r=>r.json());
  } catch(e){
    VOCAB = {levels:{B2:[],C1:[],C2:[]}, topic_levels:{}};
  }
}

// ==============================
// Render
// ==============================
function bandFromDepth(val){
  // 0..100 -> easy/medium/hard
  if (val < 34) return 'easy';
  if (val < 67) return 'medium';
  return 'hard';
}

function setTitle(topic){
  $('#topicTitle').textContent = topic.toUpperCase();
}

function renderQuestions(topic){
  const list = $('#questionList');
  list.innerHTML = '';

  const depthVal = +$('#depthRange').value;
  const band = bandFromDepth(depthVal);
  const all = QUESTIONS.questions[topic] || {easy:[],medium:[],hard:[]};
  let qs = (all[band] || []).slice(0);

  // Ensure 10 items by topping up from other bands if needed
  if (qs.length < 10){
    const rest = [...(all.easy||[]), ...(all.medium||[]), ...(all.hard||[])]
      .filter(x=>!qs.includes(x));
    qs = qs.concat(sample(rest, Math.max(0,10-qs.length)));
  } else {
    qs = sample(qs, 10);
  }

  qs.forEach((q, i) => {
    const li = document.createElement('li');
    li.textContent = q;
    li.className = 'q-enter';
    list.appendChild(li);
  });
}

function getVocabFor(topic, level){
  if (VOCAB.topic_levels && VOCAB.topic_levels[topic] && VOCAB.topic_levels[topic][level]){
    const arr = VOCAB.topic_levels[topic][level];
    if (arr && arr.length) return arr;
  }
  if (VOCAB.levels && VOCAB.levels[level] && VOCAB.levels[level].length){
    return VOCAB.levels[level];
  }
  return [];
}

function renderVocab(topic, level=CURRENT_LEVEL){
  CURRENT_LEVEL = level;
  // update buttons
  $$('.btn-level').forEach(b => b.classList.toggle('is-active', b.dataset.level===level));

  const chips = $('#vocabChips');
  chips.innerHTML = '';
  const words = getVocabFor(topic, level);
  const show = sample(words, Math.min(12, words.length || 0));
  if (!show.length){
    chips.innerHTML = '<span class="muted">No vocabulary available for this topic/level.</span>';
    return;
  }
  show.forEach(w => {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = w;
    chips.appendChild(span);
  });
}

function pickTopicFromSearch(){
  const s = titleCase($('#searchInput').value).toLowerCase();
  if (!s) return null;
  // exact first
  const exact = TOPICS.find(t => t.toLowerCase() === s);
  if (exact) return exact;
  // startsWith
  const starts = TOPICS.filter(t => t.toLowerCase().startsWith(s));
  if (starts.length) return starts[0];
  // includes
  const inc = TOPICS.filter(t => t.toLowerCase().includes(s));
  if (inc.length) return inc[0];
  return null;
}

function pickRandomTopic(){
  if (!TOPICS.length) return null;
  let t = choice(TOPICS);
  if (LAST_TOPIC && TOPICS.length > 1){
    let guard = 0;
    while (t === LAST_TOPIC && guard < 20){
      t = choice(TOPICS); guard++;
    }
  }
  return t;
}

function generate(){
  let topic = pickTopicFromSearch() || pickRandomTopic();
  if (!topic){ alert('No topics available.'); return; }
  CURRENT_TOPIC = topic;
  LAST_TOPIC = topic;
  setTitle(topic);
  renderQuestions(topic);
  renderVocab(topic, CURRENT_LEVEL);
}

function reshuffle(){
  if (!CURRENT_TOPIC) { generate(); return; }
  renderQuestions(CURRENT_TOPIC);
  renderVocab(CURRENT_TOPIC, CURRENT_LEVEL);
}

// ==============================
// Search suggestions
// ==============================
function updateSuggestions(){
  const box = $('#searchBox');
  const sug = $('#suggestions');
  const val = $('#searchInput').value.trim().toLowerCase();
  if (!val){ box.setAttribute('aria-expanded','false'); sug.innerHTML=''; return; }
  const items = TOPICS.filter(t => t.toLowerCase().includes(val)).slice(0, 8);
  sug.innerHTML = items.map(t=>`<button type="button" data-sel="${t}">${t}</button>`).join('');
  box.setAttribute('aria-expanded', items.length ? 'true' : 'false');
}

function bindSuggestionClicks(){
  $('#suggestions').addEventListener('click', e => {
    const b = e.target.closest('button[data-sel]');
    if (!b) return;
    $('#searchInput').value = b.dataset.sel;
    $('#searchBox').setAttribute('aria-expanded','false');
    generate();
  });
}

// ==============================
// Theme toggle (SVG icons)
// ==============================
(function(){
  const btn = document.getElementById('themeToggle');
  if(!btn) return;

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
  document.documentElement.dataset.theme = theme;
  setIcon(theme);

  btn.addEventListener('click', () => {
    const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    setIcon(next);
  });
})();

// ==============================
async function main(){
  await loadData();
  // events
  $('#generateBtn').addEventListener('click', generate);
  $('#reshuffleBtn').addEventListener('click', reshuffle);
  $('#depthRange').addEventListener('input', () => {
    if (CURRENT_TOPIC) renderQuestions(CURRENT_TOPIC);
  });
  $$('.btn-level').forEach(b => {
    b.addEventListener('click', ()=> renderVocab(CURRENT_TOPIC || pickRandomTopic(), b.dataset.level));
  });
  $('#shuffleVocab').addEventListener('click', () => {
    if (CURRENT_TOPIC) renderVocab(CURRENT_TOPIC, CURRENT_LEVEL);
  });
  $('#searchInput').addEventListener('input', updateSuggestions);
  bindSuggestionClicks();

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.isComposing){
      e.preventDefault(); generate();
    }
  });

  // autogenerate first topic
  generate();
}

main();
