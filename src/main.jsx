import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

function setVh() {
  const isStandalone =
    ('standalone' in navigator && navigator.standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  const h = isStandalone ? screen.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
}

setVh();
window.addEventListener('load', setVh);
window.addEventListener('pageshow', setVh);
window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', () => setTimeout(setVh, 300));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registrato:', reg.scope))
      .catch(err => console.warn('[SW] Fallito:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
