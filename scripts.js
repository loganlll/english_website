/* Consolidated JS with search clear and no-repeat topic */ 
const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>Array.from(e.querySelectorAll(s));
const choice=a=>a[Math.floor(Math.random()*a.length)], shuffle=a=>a.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(p=>p[1]);
const sample=(a,n)=>shuffle(a).slice(0,Math.min(n,a.length));

const state={questions:null,vocab:null,topics:[],lastTopic:null,currentTopic:null,
  difficulty:localStorage.getItem('tg:difficulty')||'medium',
  fontSize:localStorage.getItem('tg:qsize')||'M',
  vocabLevel:localStorage.getItem('tg:vlevel')||'C2',
  theme:localStorage.getItem('tg:theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')};

const el={generate:$('#generateBtn'),reshuffle:$('#reshuffleBtn'),
  searchWrap:$('.search'),search:$('#searchInput'),suggestions:$('.search__suggestions'),clearBtn:$('.search__clear'),
  depth:$('#depthRange'),legends:{easy:$('#legendEasy'),med:$('#legendMed'),hard:$('#legendHard')},
  sizeBtns:$$('.fs-btn'),themeToggle:$('#themeToggle'),
  title:$('#topicTitle'),qlist:$('#questionsList'),
  vBtns:$$('.vbtn'),vChips:$('#vocabChips'),shuffleVocab:$('#shuffleVocab')};

document.addEventListener('DOMContentLoaded', async ()=>{
  document.documentElement.setAttribute('data-theme', state.theme);
  applySize(state.fontSize);
  const map={easy:0,medium:1,hard:2}; el.depth.value=map[state.difficulty]??1; setLegend();

  try{
    const [q,v]=await Promise.all([fetch('questions.json'),fetch('vocab.json')]);
    state.questions=await q.json(); state.vocab=await v.json();
    state.topics=Object.keys(state.questions.questions);
  }catch(e){ el.title.textContent='Error loading questions.'; return; }

  wire();
});

function wire(){
  el.generate.addEventListener('click', generate);
  el.reshuffle.addEventListener('click', ()=>state.currentTopic&&renderTopic(state.currentTopic));
  document.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && document.activeElement!==el.search) generate(); });

  el.search.addEventListener('input', onSearch);
  el.search.addEventListener('focus', ()=>el.searchWrap.setAttribute('aria-expanded','true'));
  el.search.addEventListener('blur', ()=>setTimeout(()=>el.searchWrap.setAttribute('aria-expanded','false'),120));
  el.suggestions.addEventListener('click', (e)=>{ const li=e.target.closest('li'); if(!li) return; el.search.value=li.dataset.topic; el.searchWrap.setAttribute('aria-expanded','false'); renderTopic(li.dataset.topic);});

  const toggleClear=()=>{ el.clearBtn.style.visibility = el.search.value ? 'visible':'hidden'; };
  toggleClear();
  el.search.addEventListener('input', toggleClear);
  el.clearBtn.addEventListener('click', ()=>{ 
    if(el.search.value){ el.search.value=''; el.suggestions.innerHTML=''; el.searchWrap.setAttribute('aria-expanded','false'); toggleClear(); el.search.focus(); }
    else { el.title.textContent=''; el.qlist.innerHTML=''; el.vChips.innerHTML=''; }
  });
  el.search.addEventListener('keydown', (e)=>{ if(e.key==='Escape') el.clearBtn.click(); });

  el.depth.addEventListener('input', ()=>{getBand(); state.currentTopic&&renderTopic(state.currentTopic)});
  el.sizeBtns.forEach(b=>b.addEventListener('click', ()=>{ el.sizeBtns.forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.fontSize=b.dataset.size; localStorage.setItem('tg:qsize',state.fontSize); applySize(state.fontSize);}));
  el.themeToggle.addEventListener('click', ()=>{ state.theme=(state.theme==='dark'?'light':'dark'); document.documentElement.setAttribute('data-theme',state.theme); localStorage.setItem('tg:theme',state.theme); });
  el.vBtns.forEach(b=>b.addEventListener('click', ()=>{ el.vBtns.forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.vocabLevel=b.dataset.level; localStorage.setItem('tg:vlevel',state.vocabLevel); renderVocab(state.currentTopic);}));
  el.shuffleVocab.addEventListener('click', ()=>renderVocab(state.currentTopic));
}

function generate(){
  let t=choice(state.topics);
  if(state.lastTopic && state.topics.length>1){
    let c=0; while(t===state.lastTopic && c<10){t=choice(state.topics);c++;}
  }
  renderTopic(t);
}


function adjustTopicCasing(q, topic){
  // Replace occurrences of the exact topic inside the sentence with lowercase,
  // except when it appears at the very beginning.
  const lc = topic.toLowerCase();
  let out = q;
  let i = out.indexOf(topic);
  while (i !== -1){
    if (i > 0){
      out = out.slice(0, i) + lc + out.slice(i + topic.length);
      i = out.indexOf(topic, i + lc.length);
    } else {
      i = out.indexOf(topic, i + topic.length);
    }
  }
  return out;
}

function renderTopic(topic){
  state.currentTopic=topic; state.lastTopic=topic;
  el.title.textContent = topic.toUpperCase();
  const band=getBand(); const all=state.questions.questions[topic]?.[band]||[]; const qs=sample(all,10);
  el.qlist.innerHTML='';
qs.forEach((q,i)=>{
  const li=document.createElement('li');
  li.textContent=q;
  li.classList.add('q-enter');
  li.style.animationDelay = `${i*40}ms`;
  el.qlist.appendChild(li);
});
renderVocab(topic);
}

function renderVocab(topic){
  el.vChips.innerHTML=''; if(!topic) return;
  const lvl=state.vocabLevel; const t=state.vocab.topic_levels?.[topic]?.[lvl]; const fallback=state.vocab.levels?.[lvl]||[]; 
  sample((t&&t.length?t:fallback), 12).forEach(w=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=w; el.vChips.appendChild(s); });
}

function onSearch(){
  const q=el.search.value.trim().toLowerCase(); const ul=el.suggestions; ul.innerHTML='';
  if(!q){ el.searchWrap.setAttribute('aria-expanded','false'); return; }
  state.topics.filter(t=>t.toLowerCase().includes(q)).slice(0,12).forEach(t=>{ const li=document.createElement('li'); li.textContent=t; li.dataset.topic=t; ul.appendChild(li); });
  el.searchWrap.setAttribute('aria-expanded','true');
}

function getBand(){ const v=Number(el.depth.value); const b=(v===0)?'easy':(v===2)?'hard':'medium'; state.difficulty=b; localStorage.setItem('tg:difficulty',b); setLegend(); return b; }
function setLegend(){ const v=Number(el.depth.value); el.legends.easy.classList.toggle('active', v===0); el.legends.med.classList.toggle('active', v===1); el.legends.hard.classList.toggle('active', v===2); }
function applySize(s){ const map={S:'20px',M:'22px',L:'26px'}; document.documentElement.style.setProperty('--qsize', map[s]||'22px'); }
