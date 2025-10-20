
// --- theme toggle with crisp SVG icons (sun / moon) ---
(function(){
  const btn = document.getElementById('themeToggle') || document.querySelector('[data-theme-toggle]');
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

  function setIcon(theme){
    btn.innerHTML = theme==='dark' ? ICONS.sun : ICONS.moon;
  }

  // initial
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
