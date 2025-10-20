// Clean, minimal JS: loads questions.json once, then serves 5 prompts per topic.
const btn = document.querySelector('.btn');
const img = document.querySelector('#image');
const topicEl = document.querySelector('#topic');
const listEl = document.querySelector('#questions');

let DB = null;
let busy = false;

// Load once
fetch('questions.json')
  .then(r => r.json())
  .then(data => { DB = data.questions; })
  .catch(err => {
    console.error('Failed to load questions.json', err);
    topicEl.textContent = 'Error loading questions.';
  });

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function generate(){
  if (busy || !DB) return;
  busy = true;
  topicEl.textContent = '';
  listEl.innerHTML = '';
  img.setAttribute('src','img/loader.gif');

  setTimeout(() => {
    const topics = Object.keys(DB);
    const topic = pick(topics);
    const qs = DB[topic] || [];
    img.setAttribute('src','img/trans.png');
    topicEl.textContent = topic.toUpperCase();
    (qs.slice(0,5)).forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      listEl.appendChild(li);
    });
    busy = false;
  }, 400);
}

btn.addEventListener('click', generate);
document.addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
