'use strict';

/* ===== Config ===== */
const SOURCES = [
  { path: "Kitchen equipment.json", topic: "Kitchen equipment" },
  { path: "Opinion and argument.json", topic: "Opinion & Argument" },
  { path: "Doubt, guessing and certainty.json", topic: "Doubt, guessing and certainty" },
  { path: "Discussion and agreement.json", topic: "Discussion and agreement" },
  { path: "Personal Qualities.json", topic: "Personal Qualities" },
  { path: "Feelings.json", topic: "Feelings" },
];
const LEVELS = ["A1","A2","B1","B2","C1","C2"];

let DATA = []; // unified: { term, type, level, topic }
let TOPIC_COUNTS = new Map();

/* ===== Preferences (favorites & hidden) ===== */
const LS_FAV = "wg:favorites";
const LS_HIDDEN = "wg:hidden";
const LS_FAV_ONLY = "wg:fav-only";
const LS_LEVELS = "wg:levels";
const LS_TOPIC = "wg:topic";
const LS_COUNT = "wg:count";

const favorites = new Set(JSON.parse(localStorage.getItem(LS_FAV) || "[]"));
const hidden = new Set(JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]"));

/* ===== Elements ===== */
const levels = Array.from(document.querySelectorAll('.level'));
const toggleAny = document.getElementById('toggleAny');
const topicSelect = document.getElementById('topic');
const countInput = document.getElementById('count');
const countOut = document.getElementById('countOut');
const favoritesOnly = document.getElementById('favoritesOnly');
const btn = document.getElementById('generate');
const copySetBtn = document.getElementById('copySet');
const exportFavBtn = document.getElementById('exportFav');
const clearHiddenBtn = document.getElementById('clearHidden');
const list = document.getElementById('list');
const summary = document.getElementById('summary');

/* ===== Utilities ===== */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function choose(arr, n){
  const copy = arr.slice();
  const out = [];
  while (copy.length && out.length < n){
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  return out;
}

function setURLParams(params){
  const url = new URL(location.href);
  for (const [k,v] of Object.entries(params)){
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) url.searchParams.delete(k);
    else if (Array.isArray(v)) url.searchParams.set(k, v.join(","));
    else url.searchParams.set(k, String(v));
  }
  history.replaceState(null, "", url.toString());
}

function readURL(){
  const url = new URL(location.href);
  const topic = url.searchParams.get("topic");
  const levelsParam = url.searchParams.get("levels");
  const count = url.searchParams.get("n");
  const favOnly = url.searchParams.get("fav") === "1";
  return { topic, levels: levelsParam?.split(",").filter(Boolean) ?? null, count: count ? Number(count) : null, favOnly };
}

function persist(){
  localStorage.setItem(LS_FAV, JSON.stringify([...favorites]));
  localStorage.setItem(LS_HIDDEN, JSON.stringify([...hidden]));
}

/* Accessible clipboard helper */
async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ===== Rendering ===== */
function renderTopicOptions(){
  const optAll = document.createElement('option');
  optAll.value = "all";
  optAll.textContent = "All topics";
  topicSelect.appendChild(optAll);
  for (const s of SOURCES){
    const opt = document.createElement('option');
    opt.value = s.topic;
    const count = TOPIC_COUNTS.get(s.topic) ?? 0;
    opt.textContent = `${s.topic} (${count})`;
    topicSelect.appendChild(opt);
  }
}

function renderList(items){
  list.textContent = "";
  for (const it of items){
    const card = document.createElement('article');
    card.className = "card";

    const h3 = document.createElement('h3');
    h3.textContent = it.term;
    // Link-like behavior -> Oxford Learner's Dictionaries
    h3.setAttribute('role','link');
    h3.tabIndex = 0;
    h3.title = 'Open Oxford definition in a new tab';
    const dictUrl = 'https://www.oxfordlearnersdictionaries.com/search/english/?q=' + encodeURIComponent(it.term);
    const openDict = () => window.open(dictUrl, '_blank', 'noopener');
    h3.addEventListener('click', openDict);
    h3.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDict(); } });
    card.appendChild(h3);

    const meta = document.createElement('div');
    meta.className = "meta";
    meta.textContent = `${it.type || "—"} • ${it.level} • ${it.topic}`;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = "actions";

    // Favorite toggle
    const fav = document.createElement('button');
    fav.className = "icon-btn";
    fav.type = "button";
    fav.setAttribute("aria-label", "Favorite");
    fav.setAttribute("aria-pressed", favorites.has(it.term) ? "true" : "false");
    fav.textContent = favorites.has(it.term) ? "★" : "☆";
    fav.addEventListener('click', () => {
      if (favorites.has(it.term)) favorites.delete(it.term);
      else favorites.add(it.term);
      persist();
      fav.setAttribute("aria-pressed", favorites.has(it.term) ? "true" : "false");
      fav.textContent = favorites.has(it.term) ? "★" : "☆";
    });
    actions.appendChild(fav);

    // Hide toggle
    const hide = document.createElement('button');
    hide.className = "icon-btn";
    hide.type = "button";
    hide.setAttribute("aria-label", "Hide term");
    hide.textContent = hidden.has(it.term) ? "Unhide" : "Hide";
    hide.addEventListener('click', () => {
      if (hidden.has(it.term)) hidden.delete(it.term);
      else hidden.add(it.term);
      persist();
      generate(); // refresh list
    });
    actions.appendChild(hide);

    // Copy single
    const copy = document.createElement('button');
    copy.className = "icon-btn";
    copy.type = "button";
    copy.setAttribute("aria-label", "Copy term");
    copy.textContent = "Copy";
    copy.addEventListener('click', async () => {
      await copyText(it.term);
      copy.textContent = "Copied";
      await sleep(800);
      copy.textContent = "Copy";
    });
    actions.appendChild(copy);

    card.appendChild(actions);
    list.appendChild(card);
  }
}

/* ===== Filtering & Generation ===== */
function currentLevelFilter(){
  const checked = levels.filter(cb => cb.checked).map(cb => cb.value);
  return checked;
}

function filterItems(){
  const lvls = currentLevelFilter();
  const topic = topicSelect.value;
  const favOnly = favoritesOnly.checked;
  let items = DATA.filter(it => lvls.includes(it.level));
  if (topic !== "all") items = items.filter(it => it.topic === topic);
  if (favOnly) items = items.filter(it => favorites.has(it.term));
  items = items.filter(it => !hidden.has(it.term));
  return items;
}

function updateSummary(totalFiltered, shown){
  const favCount = favorites.size;
  const hiddenCount = hidden.size;
  const topic = topicSelect.value === "all" ? "All topics" : topicSelect.value;
  summary.textContent = `${shown} shown • ${totalFiltered} available after filters • Topic: ${topic} • Favorites: ${favCount} • Hidden: ${hiddenCount}`;
}

function generate(){
  list.setAttribute('aria-busy', 'true');
  const items = filterItems();
  const n = Number(countInput.value);
  const chosen = choose(items, n);
  renderList(chosen);
  updateSummary(items.length, chosen.length);
  list.setAttribute('aria-busy', 'false');
}

/* ===== State & URL sync ===== */
function applyInitialStateFromURL(){
  const { topic, levels: lvlFromURL, count, favOnly } = readURL();

  // Topic
  if (topic){
    const opt = Array.from(topicSelect.options).find(o => o.value === topic || o.textContent.startsWith(topic));
    if (opt) topicSelect.value = opt.value;
  }

  // Levels
  let levelsToCheck = lvlFromURL && lvlFromURL.every(l => LEVELS.includes(l)) ? lvlFromURL : null;
  if (!levelsToCheck){
    const saved = JSON.parse(localStorage.getItem(LS_LEVELS) || "[]");
    if (Array.isArray(saved) && saved.every(l => LEVELS.includes(l))) levelsToCheck = saved;
  }
  if (levelsToCheck){
    levels.forEach(cb => cb.checked = levelsToCheck.includes(cb.value));
    toggleAny.setAttribute("aria-pressed", String(levelsToCheck.length === LEVELS.length));
  }

  // Count
  const cSaved = Number(localStorage.getItem(LS_COUNT) || "0");
  countInput.value = String(count ?? (cSaved || 10));
  countOut.value = countInput.value;

  // Topic from storage
  const tSaved = localStorage.getItem(LS_TOPIC);
  if (!topic && tSaved){
    const opt = Array.from(topicSelect.options).find(o => o.value === tSaved);
    if (opt) topicSelect.value = opt.value;
  }

  // Favorites only
  const favSaved = localStorage.getItem(LS_FAV_ONLY) === "1";
  favoritesOnly.checked = favOnly ?? favSaved;
}

function updateURL(){
  const lvls = currentLevelFilter();
  setURLParams({
    topic: topicSelect.value,
    levels: lvls,
    n: Number(countInput.value),
    fav: favoritesOnly.checked ? 1 : 0
  });
}

/* ===== Data load ===== */
async function loadAll(){
  const all = [];
  for (const src of SOURCES){
    const res = await fetch(src.path);
    const arr = await res.json();
    for (const it of arr){
      all.push({ term: it.term, type: it.type, level: it.level, topic: src.topic });
    }
    TOPIC_COUNTS.set(src.topic, arr.length);
  }
  DATA = all;
}

/* ===== Init ===== */
(async function init(){
  // Populate topic select
  renderTopicOptions();

  // Type-to-select for topic (robust and no syntax error)
  let typed = "";
  let last = 0;
  topicSelect.addEventListener("keydown", (e) => {
    const now = Date.now();
    if (now - last > 800) typed = "";
    last = now;
    if (e.key.length === 1){
      typed += e.key.toLowerCase();
      const match = [...topicSelect.options].find(opt => opt.textContent.toLowerCase().startsWith(typed));
      if (match){
        topicSelect.value = match.value;
        e.preventDefault();
      }
    }
  });

  // Wire controls
  levels.forEach(cb => cb.addEventListener('change', () => {
    localStorage.setItem(LS_LEVELS, JSON.stringify(currentLevelFilter()));
    toggleAny.setAttribute("aria-pressed", String(currentLevelFilter().length === LEVELS.length));
    updateURL(); generate();
  }));
  toggleAny.addEventListener('click', () => {
    // 'Any level' means select ALL levels.
    levels.forEach(cb => cb.checked = true);
    localStorage.setItem(LS_LEVELS, JSON.stringify(currentLevelFilter()));
    toggleAny.setAttribute('aria-pressed', 'true');
    updateURL(); generate();
  });
  topicSelect.addEventListener('change', () => { localStorage.setItem(LS_TOPIC, topicSelect.value); updateURL(); generate(); });
  countInput.addEventListener('input', () => { countOut.value = countInput.value; });
  countInput.addEventListener('change', () => { localStorage.setItem(LS_COUNT, String(countInput.value)); updateURL(); generate(); });
  favoritesOnly.addEventListener('change', () => { localStorage.setItem(LS_FAV_ONLY, favoritesOnly.checked ? '1' : '0'); updateURL(); generate(); });
  btn.addEventListener('click', generate);

  copySetBtn.addEventListener('click', async () => {
    const words = [...list.querySelectorAll('.card h3')].map(h => h.textContent.trim());
    await copyText(words.join('\\n'));
    copySetBtn.textContent = "Copied set";
    await sleep(900);
    copySetBtn.textContent = "Copy set";
  });

  exportFavBtn.addEventListener('click', () => {
    const words = [...favorites];
    const blob = new Blob([words.join('\\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'favorites.txt';
    a.className = 'download';
    a.textContent = 'Download favorites.txt';
    exportFavBtn.insertAdjacentElement('afterend', a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  clearHiddenBtn.addEventListener('click', () => {
    hidden.clear();
    persist();
    generate();
  });

  // Keyboard shortcut: Space/Enter triggers generate if focus not in input
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const isFormEl = t && (t.closest('input,select,textarea,button'));
    if (!isFormEl && (e.key === ' ' || e.key === 'Enter')){
      e.preventDefault();
      btn.click();
    }
  });

  // Load data, apply state, render
  await loadAll();
  applyInitialStateFromURL();
  updateURL();
  generate();
})();
