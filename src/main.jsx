import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

function setAppHeight() {
  const isStandalone =
    ('standalone' in navigator && navigator.standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  // In standalone su iOS screen.height include la fascia home-indicator;
  // innerHeight/visualViewport no. Letto dal primo frame, fuori da React.
  const h = isStandalone ? screen.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', h + 'px');
  document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
}

setAppHeight();
window.addEventListener('load', setAppHeight);
window.addEventListener('pageshow', setAppHeight);
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 300));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
