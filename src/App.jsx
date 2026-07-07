import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';

/* ============= GLOBAL STYLES ============= */
const GLOBAL_CSS = `
  html, body {
    margin: 0; padding: 0;
    background: #000000;
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
  }
  @keyframes rv-fade-up {
    from { opacity:0; transform:translateY(18px) scale(0.98); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }
  @keyframes rv-scale-in {
    from { opacity:0; transform:scale(0.94); }
    to   { opacity:1; transform:scale(1); }
  }
  @keyframes rv-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes rv-breathe {
    0%,100% { opacity:1; }
    50%      { opacity:0.45; }
  }
  @keyframes rv-orb-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes rv-orb-breathe {
    0%   { transform: scale(0.94) rotate(-2deg) translateY(0px); }
    25%  { transform: scale(1.08) rotate(1deg) translateY(-1.5px); }
    50%  { transform: scale(1.13) rotate(3deg) translateY(-2px); }
    75%  { transform: scale(1.06) rotate(1deg) translateY(-0.8px); }
    100% { transform: scale(0.94) rotate(-2deg) translateY(0px); }
  }
  @keyframes rv-orb-think {
    0%, 100% { transform: scale(1.05); }
    25%      { transform: scale(1.32); }
    55%      { transform: scale(1.18); }
    80%      { transform: scale(1.28); }
  }
  .rv-page { animation: rv-fade-up 0.36s cubic-bezier(0.34,1.18,0.64,1) both; }
  .rv-card {
    animation: rv-scale-in 0.30s cubic-bezier(0.25,0.46,0.45,0.94) both;
    transition: transform 0.20s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.20s ease;
  }
  .rv-btn {
    transition: transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94), background 0.18s ease;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .rv-btn.rv-pressing { transform: scale(0.93) !important; }
  .rv-row {
    transition: background 0.16s ease, transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94);
    -webkit-tap-highlight-color: transparent;
  }
  .rv-row.rv-pressing { transform: scale(0.990) !important; }
  .rv-seg-pill {
    transition: background 0.22s cubic-bezier(0.25,0.46,0.45,0.94), color 0.18s ease, transform 0.18s;
  }
  .rv-seg-pill.rv-pressing { transform: scale(0.92) !important; }
  .rv-tab-btn {
    transition: background 0.22s cubic-bezier(0.25,0.46,0.45,0.94);
    -webkit-tap-highlight-color: transparent;
  }
  .rv-tab-icon { transition: transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94); }
  .rv-tab-btn.rv-pressing .rv-tab-icon { transform: scale(0.86) !important; }
  .rv-live-dot { animation: rv-breathe 2.2s ease-in-out infinite; }
  .rv-orb-animated {
    animation: rv-orb-spin 22s linear infinite, rv-orb-breathe 4.8s cubic-bezier(0.45,0.05,0.55,0.95) infinite;
  }
  .rv-orb-thinking .rv-orb-animated {
    animation: rv-orb-spin 5s linear infinite, rv-orb-think 0.85s ease-in-out infinite !important;
  }
  .rv-shimmer-overlay {
    background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.055) 50%, transparent 75%);
    background-size: 200% 100%;
    animation: rv-shimmer 4s linear infinite;
    pointer-events: none;
    border-radius: inherit;
  }
  .rv-stagger-1 { animation-delay: 0.04s; }
  .rv-stagger-2 { animation-delay: 0.08s; }
  .rv-stagger-3 { animation-delay: 0.12s; }
  .rv-stagger-4 { animation-delay: 0.16s; }
  .rv-stagger-5 { animation-delay: 0.20s; }
  * { -webkit-tap-highlight-color: transparent; }
`;

function injectCSS() {
  if (typeof document === 'undefined') return;
  // Viewport-fit=cover deve essere presente subito per env(safe-area-inset-bottom)
  let vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.name = 'viewport';
    document.head.appendChild(vp);
  }
  if (!vp.content.includes('viewport-fit')) {
    vp.content = (vp.content || 'width=device-width, initial-scale=1') + ', viewport-fit=cover';
  }
  if (document.getElementById('rv-styles')) return;
  const s = document.createElement('style');
  s.id = 'rv-styles';
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

/* ============= HAPTIC ============= */
const _vibe = (p) => { try { navigator?.vibrate?.(p); } catch(_) {} };
const haptic = {
  selection: () => _vibe(2),
  light:     () => _vibe(4),
  medium:    () => _vibe(7),
  success:   () => _vibe([5, 60, 9]),
  error:     () => _vibe([10,40,10,40,14]),
};

/* ============= PRESS MANAGER ============= */
function injectPressManager() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('rv-press-mgr')) return;
  const marker = document.createElement('div');
  marker.id = 'rv-press-mgr';
  document.body.appendChild(marker);
  const SELECTORS = '.rv-btn,.rv-row,.rv-seg-pill,.rv-tab-btn';
  const HAPTIC_MAP = { 'rv-tab-btn':'selection','rv-seg-pill':'selection','rv-btn':'medium','rv-row':'light' };
  let target=null, startX=0, startY=0;
  const getH = el => { for (const [cls,h] of Object.entries(HAPTIC_MAP)) { if (el.classList.contains(cls)) return h; } return 'light'; };
  document.addEventListener('touchstart', e => {
    const el = e.target.closest(SELECTORS); if (!el) return;
    target=el; startX=e.touches[0].clientX; startY=e.touches[0].clientY;
    el.classList.add('rv-pressing'); haptic[getH(el)]?.();
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!target) return;
    if (Math.abs(e.touches[0].clientX-startX)>8||Math.abs(e.touches[0].clientY-startY)>8) {
      target.classList.remove('rv-pressing'); target=null;
    }
  }, { passive: true });
  document.addEventListener('touchend', () => { if (target) { target.classList.remove('rv-pressing'); target=null; } });
  document.addEventListener('mousedown', e => {
    const el = e.target.closest(SELECTORS); if (!el) return;
    el.classList.add('rv-pressing');
    const up = () => { el.classList.remove('rv-pressing'); document.removeEventListener('mouseup', up); };
    document.addEventListener('mouseup', up);
  });
}

/* ============= PALETTE ============= */
const palette = {
  dark: {
    green:'#39FF14', cyan:'#7DF9FF', purple:'#C77DFF', red:'#FF073A',
    yellow:'#FFE600', orange:'#FFB627', pink:'#FF457A', teal:'#00FFD4',
    bg:'#000000', glass:'#1C1C1E', glass2:'#2C2C2E', glass3:'#3A3A3C',
    glassBar:'#1C1C1E', sep:'rgba(255,255,255,0.08)', sep2:'rgba(255,255,255,0.12)',
    primary:'#FFFFFF', secondary:'rgba(255,255,255,0.65)', tertiary:'rgba(255,255,255,0.38)',
    quat:'rgba(255,255,255,0.18)', ambient:'none',
  },
  light: {
    green:'#00B814', cyan:'#0099B3', purple:'#8B2EBC', red:'#D9001F',
    yellow:'#B89400', orange:'#D17500', pink:'#C92668', teal:'#007A6A',
    bg:'#F2F2F7', glass:'rgba(255,255,255,0.72)', glass2:'rgba(245,245,247,0.85)',
    glass3:'rgba(229,229,234,0.85)', glassBar:'rgba(255,255,255,0.78)',
    sep:'rgba(0,0,0,0.08)', sep2:'rgba(0,0,0,0.12)',
    primary:'#000000', secondary:'rgba(0,0,0,0.65)', tertiary:'rgba(0,0,0,0.40)',
    quat:'rgba(0,0,0,0.20)',
    ambient:`radial-gradient(circle at 20% 0%, #C77DFF20, transparent 50%), radial-gradient(circle at 80% 100%, #7DF9FF15, transparent 50%)`,
  },
};
const FONT = {
  display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
  text:    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
  mono:    '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
};
const RADIUS = { card: 28, inset: 20, pill: 999 };
const neonText = (color, scheme) => scheme !== 'dark' ? {} : { textShadow: `0 0 24px ${color}1E, 0 0 8px ${color}0F` };

function injectPWAMeta() {
  // All PWA meta is static in index.html — nothing to do at runtime
}


function useColorScheme() {
  const [s, setS] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const h = (e) => setS(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return s;
}
function usePersistedState(key, def) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  const set = useCallback((val) => { setV(prev => { const n = typeof val==='function'?val(prev):val; try{localStorage.setItem(key,JSON.stringify(n));}catch{} return n; }); }, [key]);
  return [v, set];
}

/* ===== import PDF/CSV rimosso — ora inserimento manuale ===== */

/* ============= DATA ANALYSIS ============= */
function analyzeTransactions(txs) {
  if (!txs?.length) return null;
  const sorted = [...txs].sort((a,b)=>a.date-b.date);

  // ── Income / Expense totals ────────────────────────────────────────────────
  // Priority 1: use the official "Riepilogo del saldo" totals extracted directly
  // from the PDF — these are always correct, EUR-only, exclude crypto/USD pockets.
  // Priority 2: fall back to summing balance deltas (more accurate than parser signs).
  // Priority 3: last resort — sum parser-assigned signs.
  let income, expense;

  // Commissioni: sempre denaro in uscita, sommate a parte (anche quelle sulle conversioni).
  const totalFees = Math.round(sorted.reduce((s,t) => s + Math.abs(t.fee || 0), 0) * 100) / 100;

  if (txs._summaryIncome != null && txs._summaryExpense != null) {
    // Import legacy (PDF): totali dal riepilogo Revolut.
    income  = txs._summaryIncome;
    expense = txs._summaryExpense;
  } else {
    // Manuale: entrate = importi positivi, uscite = importi negativi (lordi).
    // Le conversioni interne sono neutre; le commissioni contano a parte.
    income = 0; expense = 0;
    for (const t of sorted) {
      if (t.internal) continue;
      if (t.amount > 0) income  += t.amount;
      else              expense += Math.abs(t.amount);
    }
    income  = Math.round(income  * 100) / 100;
    expense = Math.round(expense * 100) / 100;
  }
  // Flusso netto = entrate − uscite − commissioni.
  const netFlow = Math.round((income - expense - totalFees) * 100) / 100;
  // Andamento saldo: usa i saldi reali se presenti (import legacy), altrimenti
  // costruisce un saldo cumulato dai movimenti manuali (le conversioni sono neutre).
  const hasRealBalance = sorted.some(t=>t.balance!=null);
  let balHistory;
  if (hasRealBalance) {
    balHistory = sorted.filter(t=>t.balance!=null).map(t=>({date:t.dateStr,balance:t.balance}));
  } else {
    let run=0; balHistory=[];
    for (const t of sorted) { run += (t.internal ? 0 : t.amount) - Math.abs(t.fee || 0); balHistory.push({date:t.dateStr,balance:Math.round(run*100)/100}); }
  }
  const byMonth = {};
  for (const t of sorted) {
    const m = t.dateStr.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { month: m, income: 0, expense: 0, count: 0, fees: 0 };
    byMonth[m].fees += Math.abs(t.fee || 0);   // commissioni: anche sulle conversioni
    if (t.internal) continue;                  // entrate/uscite escludono le conversioni
    if (t.amount > 0) byMonth[m].income  += t.amount;
    else              byMonth[m].expense += Math.abs(t.amount);
    byMonth[m].count++;
  }
  // Round monthly totals to cents
  for (const m of Object.values(byMonth)) {
    m.income  = Math.round(m.income  * 100) / 100;
    m.expense = Math.round(m.expense * 100) / 100;
    m.fees    = Math.round(m.fees    * 100) / 100;
  }
  const monthlyData = Object.values(byMonth).sort((a,b)=>a.month.localeCompare(b.month));
  const catMap = {};
  for (const t of txs) {
    if (t.internal || t.amount>=0) continue;
    if ((t.type||'').toLowerCase().trim()==='commissione') continue;
    const cat = categorizeTx(t);
    if (!catMap[cat]) catMap[cat]=0; catMap[cat]+=Math.abs(t.amount);
  }
  const categories = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([name,amount])=>({name,amount}));
  const merchantMap = {};
  for (const t of txs) {
    if (t.internal || t.amount>=0) continue;
    const key=t.description||'Sconosciuto';
    if(!merchantMap[key]) merchantMap[key]={name:key,total:0,count:0};
    merchantMap[key].total+=Math.abs(t.amount); merchantMap[key].count++;
  }
  const topMerchants = Object.values(merchantMap).sort((a,b)=>b.total-a.total).slice(0,10);
  const descCount = {};
  for (const t of txs) {
    if (t.internal || t.amount>=0) continue;
    const key=t.description;
    if(!descCount[key]) descCount[key]={name:key,count:0,total:0};
    descCount[key].count++; descCount[key].total+=Math.abs(t.amount);
  }
  const recurring = Object.values(descCount).filter(d=>d.count>=2).sort((a,b)=>b.total-a.total).slice(0,8);
  const now = new Date();
  const weeklyData = [];
  for (let w=11;w>=0;w--) {
    const end=new Date(now); end.setDate(end.getDate()-w*7);
    const start=new Date(end); start.setDate(start.getDate()-7);
    const week=txs.filter(t=>t.date>=start&&t.date<end&&!t.internal);
    weeklyData.push({label:`S${12-w}`,income:week.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),expense:week.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)});
  }
  const firstDate=sorted[0].date, lastDate=sorted[sorted.length-1].date;
  const days=Math.max(1,Math.round((lastDate-firstDate)/86400000));
  // Use active expense days (days with at least 1 real expense) for a more accurate daily avg
  const activeDays = new Set(sorted.filter(t=>!t.internal&&t.amount<0).map(t=>t.dateStr)).size;
  const avgDailySpend = activeDays > 0 ? expense / activeDays : expense / days;
  const curSet = new Set(txs.map(t=>t.currency||'EUR'));
  for (const t of txs) { if (t.internal) { if (t.fromCur) curSet.add(t.fromCur); if (t.toCur) curSet.add(t.toCur); } }
  const convCount = txs.filter(t=>t.internal).length;
  return {
    income,expense,netFlow,totalFees,savingRate:income>0?(netFlow/income)*100:0,
    balHistory,monthlyData,categories,currencies:[...curSet],convCount,
    firstDate,lastDate,days,avgDailySpend,
    topMerchants,weeklyData,recurring,totalTxs:txs.filter(t=>!t.internal).length,
    latestBalance:sorted[sorted.length-1].balance,
    latestTxs:sorted.slice(-30).reverse(),
  };
}

/* ============= FORMATTERS ============= */
const fmt = {
  currency: (n,cur='EUR') => { if(isNaN(n)) return '—'; try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:cur,minimumFractionDigits:2}).format(n);}catch{return `${cur} ${n.toFixed(2)}`;} },
  short: (n) => Math.abs(n)>=1000?`${(n/1000).toFixed(1)}k`:n.toFixed(0),
  pct: (n) => `${n.toFixed(1)}%`,
  date: (d) => d?new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}):'—',
  monthLabel: (m) => { const [y,mo]=m.split('-'); return `${'GenFebMarAprMagGiuLugAgoSetOttNovDic'.match(/.{3}/g)[parseInt(mo)-1]} ${y.slice(2)}`; },
};

/* ============= COMPONENTS ============= */
const PADDING_MAP = {'p-5':'20px','p-4':'16px','p-3':'12px','':'0px'};
const Glass = ({C,children,className='',padding='p-5',radius=RADIUS.card,style={}}) => (
  <div className={`rv-card ${className}`} style={{background:C.glass,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',border:`0.5px solid ${C.sep2}`,borderRadius:radius,overflow:'hidden',position:'relative',...style}}>
    <div className="rv-shimmer-overlay" style={{position:'absolute',top:0,left:0,right:0,bottom:0,opacity:0.5}}/>
    <div style={{position:'relative',padding:PADDING_MAP[padding]??padding}}>{children}</div>
  </div>
);
const SectionTitle = ({C,children}) => <h2 style={{fontFamily:FONT.display,fontSize:22,fontWeight:700,letterSpacing:'-0.4px',color:C.primary,marginBottom:16}}>{children}</h2>;
const MetricCard = ({C,label,value,sub,color,delay=0}) => (
  <div className={`rv-card rv-stagger-${delay+1}`} style={{background:C.glass,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.inset,padding:'16px 18px',position:'relative',overflow:'hidden'}}>
    <div className="rv-shimmer-overlay" style={{position:'absolute',top:0,left:0,right:0,bottom:0,opacity:0.4}}/>
    <div style={{position:'relative'}}>
      <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:500,letterSpacing:'0.2px',marginBottom:8}}>{label}</div>
      <div style={{color:color||C.primary,fontSize:26,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-0.6px',lineHeight:1,fontVariantNumeric:'tabular-nums',...neonText(color||C.primary,C.scheme)}}>{value}</div>
      {sub&&<div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginTop:6}}>{sub}</div>}
    </div>
  </div>
);
/* ============= SHARED CATEGORIZE ============= */
function categorizeTx(t) {
  if (t.category) return t.category;   // transazioni manuali: categoria esplicita
  const desc = (t.description + ' ' + (t.type||'')).toLowerCase();
  if (/nomupay|nomupayvt|mexc|mexc global|kraken|ftmo|axicorp|axitrader|bybit|binance|coinbase|forex|cfd|trading|broker|invest|spherenode|not ltd/i.test(desc)) return 'Investimenti';
  if (/amazon(?! prime)|shop|acquist|mercato|market|aliexpress|ebay|zalando|fashion|h&m|zara|galaxus/i.test(desc)) return 'Shopping';
  if (/restaurant|ristorante|pizz|sushi|burger|mcdonald|kfc|bar |caffe|trattoria|osteria|food|deliveroo|glovo|uber eat|just eat/i.test(desc)) return 'Cibo & Ristoranti';
  if (/netflix|spotify|amazon prime|disney|prime video|youtube premium|abbonamento|subscription|tradingview|apple one/i.test(desc)) return 'Abbonamenti';
  if (/apple(?! one| pay| prime)|icloud|app store|itunes/i.test(desc)) return 'Abbonamenti';
  if (/affitto|rent|appartamento|housing/i.test(desc)) return 'Affitto';
  if (/farmac|medic|doctor|hospital|health|salute|ottic/i.test(desc)) return 'Salute';
  if (/atm|prelievo|cash|bancomat/i.test(desc)) return 'Contanti';
  if (/taxi|uber(?! eat)|bolt|treno|trenitalia|italo|frecciarossa|flixbus|trasport|metro |autobus|blablacar/i.test(desc)) return 'Trasporti';
  if (/hotel|airbnb|booking|viaggio|vacanza|travel|ryanair|easyjet|flight|volo|ryanair/i.test(desc)) return 'Viaggi';
  if (/luce|gas |acqua|internet|tim |vodafone|iliad|wind|utility|bolletta|energia/i.test(desc)) return 'Utenze';
  // Only flag as trasferimento if the TYPE is explicitly a transfer (not payment)
  const tipo = (t.type||'').toLowerCase().trim();
  if (tipo === 'pagamento' || tipo === 'pagamento con carta') return 'Altro';
  if (/transfer|bonifico/i.test(tipo)) return 'Trasferimenti';
  return 'Altro';
}

const SegCtrl = ({C,options,value,onChange}) => (
  <div style={{display:'flex',background:C.glass2,borderRadius:RADIUS.pill,padding:3,gap:2}}>
    {options.map(o=>(
      <button key={o.id} className="rv-btn rv-seg-pill" onClick={()=>onChange(o.id)} style={{flex:1,padding:'6px 12px',fontSize:11,fontFamily:FONT.text,fontWeight:600,border:'none',cursor:'pointer',borderRadius:RADIUS.pill,background:value===o.id?C.primary:'transparent',color:value===o.id?C.bg:C.secondary}}>
        {o.label}
      </button>
    ))}
  </div>
);

/* ============= OVERVIEW ============= */
function OverviewPage({C,data,txs}) {
  const [period,setPeriod]=useState('all');
  const [customFrom,setCustomFrom]=useState('');
  const [customTo,setCustomTo]=useState('');
  const cur=txs[0]?.currency||'EUR';

  const periodTxs=useMemo(()=>filterByPeriod(txs,period,customFrom,customTo),[txs,period,customFrom,customTo]);
  const periodData=useMemo(()=>periodTxs.length?analyzeTransactions(periodTxs):null,[periodTxs]);
  const d=period==='all'?data:periodData;
  const netColor=d?.netFlow>=0?C.green:C.red;

  const EmptyPeriod=()=>(
    <Glass C={C} style={{marginTop:8}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'28px 16px'}}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={C.sep2} strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke={C.sep2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <div style={{color:C.secondary,fontSize:14,fontFamily:FONT.text,fontWeight:600,textAlign:'center'}}>Nessuna transazione</div>
        <div style={{color:C.tertiary,fontSize:12,fontFamily:FONT.text,textAlign:'center',lineHeight:1.5}}>Non ci sono movimenti nel periodo selezionato.</div>
      </div>
    </Glass>
  );

  if(!d) return (
    <div className="rv-page" style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:16}}>
      <SegCtrl C={C} options={PERIOD_OPTS} value={period} onChange={setPeriod}/>
      {period==='custom'&&<CustomDatePicker C={C} from={customFrom} to={customTo} onChange={(f,t)=>{setCustomFrom(f);setCustomTo(t);}}/>}
      <EmptyPeriod/>
      {[{label:'Transazioni totali',val:'—'},{label:'Commissioni pagate',val:'—'},{label:'Valute',val:'—'}].map((r,i)=>(
        <Glass C={C} key={i}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{color:C.secondary,fontSize:13,fontFamily:FONT.text}}>{r.label}</span><span style={{color:C.tertiary,fontSize:13,fontFamily:FONT.mono}}>{r.val}</span></div></Glass>
      ))}
    </div>
  );

  return (
    <div className="rv-page" style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:16}}>
      <SegCtrl C={C} options={PERIOD_OPTS} value={period} onChange={setPeriod}/>
      {period==='custom'&&<CustomDatePicker C={C} from={customFrom} to={customTo} onChange={(f,t)=>{setCustomFrom(f);setCustomTo(t);}}/>}
      <Glass C={C}>
        <div style={{textAlign:'center',padding:'8px 0'}}>
          <div style={{color:C.secondary,fontSize:12,fontFamily:FONT.text,fontWeight:500,marginBottom:8}}>
            {period==='all'?'Saldo Attuale':'Flusso Netto Periodo'}
          </div>
          <div style={{color:C.primary,fontSize:48,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-2px',lineHeight:1,fontVariantNumeric:'tabular-nums',...neonText(C.primary,C.scheme)}}>
            {period==='all'&&d.latestBalance!=null?fmt.currency(d.latestBalance,cur):fmt.currency(d.netFlow,cur)}
          </div>
          <div style={{display:'flex',justifyContent:'center',marginTop:10}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 12px',background:`${netColor}18`,border:`0.5px solid ${netColor}50`,borderRadius:RADIUS.pill}}>
              <span style={{color:netColor,fontSize:12,fontFamily:FONT.mono,fontWeight:600}}>{d.netFlow>=0?'+':''}{fmt.currency(d.netFlow,cur)}</span>
              <span style={{color:C.tertiary,fontSize:10}}>flusso netto</span>
            </div>
          </div>
          <div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginTop:8}}>{fmt.date(d.firstDate)} → {fmt.date(d.lastDate)} · {d.days}g</div>
        </div>
      </Glass>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <MetricCard C={C} label="Entrate" value={fmt.currency(d.income,cur)} color={C.green} delay={0}/>
        <MetricCard C={C} label="Uscite" value={fmt.currency(d.expense,cur)} color={C.red} delay={1}/>
        <MetricCard C={C} label="Saving Rate" value={fmt.pct(d.savingRate)} color={d.savingRate>0?C.cyan:C.orange} delay={2}/>
        <MetricCard C={C} label="Spesa/giorno" value={fmt.currency(d.avgDailySpend,cur)} color={C.orange} delay={3}/>
      </div>
      {d.balHistory.length>1&&(
        <Glass C={C}>
          <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:12}}>Andamento Saldo</div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={d.balHistory||[]} margin={{left:-20,right:0,top:4,bottom:0}}>
              <defs><linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={C.cyan} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.sep} vertical={false}/>
              <XAxis dataKey="date" tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={v=>fmt.short(v)}/>
              <Area type="monotone" dataKey="balance" stroke={C.cyan} strokeWidth={2} fill="url(#balGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Glass>
      )}
      {d.monthlyData.length>0&&(
        <Glass C={C}>
          <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:12}}>Entrate vs Uscite Mensili</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={(d.monthlyData||[]).slice(-12)} margin={{left:-20,right:0,top:4,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.sep} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={fmt.monthLabel}/>
              <YAxis tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={v=>fmt.short(v)}/>
              <Bar dataKey="income" fill={C.green} radius={[3,3,0,0]} maxBarSize={18} opacity={0.85}/>
              <Bar dataKey="expense" fill={C.red} radius={[3,3,0,0]} maxBarSize={18} opacity={0.85}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:16,marginTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:C.green}}/><span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono}}>Entrate</span></div>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:C.red}}/><span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono}}>Uscite</span></div>
          </div>
        </Glass>
      )}
      <Glass C={C}>
        {(()=>{
          const rows=[{label:'Transazioni totali',val:d.totalTxs.toString()}];
          if(d.convCount>0) rows.push({label:'Conversioni valuta',val:d.convCount.toString(),color:C.cyan});
          if(d.totalFees>0) rows.push({label:'Commissioni pagate',val:fmt.currency(d.totalFees,cur),color:C.orange});
          rows.push({label:'Valute',val:d.currencies.join(', ')});
          return rows.map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:i<rows.length-1?'12px':0,borderBottom:i<rows.length-1?`0.5px solid ${C.sep}`:'none',marginBottom:i<rows.length-1?12:0}}>
              <span style={{color:C.secondary,fontSize:13,fontFamily:FONT.text}}>{r.label}</span>
              <span style={{color:r.color||C.primary,fontSize:13,fontFamily:FONT.mono,fontWeight:600}}>{r.val}</span>
            </div>
          ));
        })()}
      </Glass>
    </div>
  );
}

/* ============= SPESE ============= */
const PERIOD_OPTS = [
  {id:'7d',label:'7G'},{id:'month',label:'Mese'},{id:'3m',label:'3M'},
  {id:'year',label:'Anno'},{id:'all',label:'Tutto'},{id:'custom',label:'↔'},
];
function filterByPeriod(list, period, customFrom, customTo) {
  const now = new Date();
  if (period==='7d')    { const s=new Date(now);s.setDate(s.getDate()-7);return list.filter(t=>t.date>=s); }
  if (period==='month') { const s=new Date(now.getFullYear(),now.getMonth(),1);return list.filter(t=>t.date>=s); }
  if (period==='3m')    { const s=new Date(now);s.setMonth(s.getMonth()-3);return list.filter(t=>t.date>=s); }
  if (period==='year')  { const s=new Date(now.getFullYear(),0,1);return list.filter(t=>t.date>=s); }
  if (period==='custom'&&customFrom&&customTo) {
    const f=new Date(customFrom), t2=new Date(customTo); t2.setHours(23,59,59);
    return list.filter(t=>t.date>=f&&t.date<=t2);
  }
  return list;
}

function CustomDatePicker({C, from, to, onChange}) {
  return (
    <div style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',background:C.glass2,border:`0.5px solid ${C.sep}`,borderRadius:RADIUS.inset}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={C.tertiary} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={C.tertiary} strokeWidth="2" strokeLinecap="round"/></svg>
      <input type="date" value={from} onChange={e=>onChange(e.target.value,to)} style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.secondary,fontSize:12,fontFamily:FONT.mono,colorScheme:'dark'}}/>
      <span style={{color:C.tertiary,fontSize:11}}>→</span>
      <input type="date" value={to} onChange={e=>onChange(from,e.target.value)} style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.secondary,fontSize:12,fontFamily:FONT.mono,colorScheme:'dark'}}/>
    </div>
  );
}

function SpesePage({C,data,txs}) {
  const [period,setPeriod]=useState('all');
  const [customFrom,setCustomFrom]=useState('');
  const [customTo,setCustomTo]=useState('');
  const [activeCat,setActiveCat]=useState(null);
  const cur=txs[0]?.currency||'EUR';

  const baseFiltered=useMemo(()=>{
    let list=txs.filter(t=>t.amount<0&&!t.internal&&(t.type||'').toLowerCase().trim()!=='commissione');
    return filterByPeriod(list,period,customFrom,customTo);
  },[txs,period,customFrom,customTo]);

  const total=baseFiltered.reduce((s,t)=>s+Math.abs(t.amount),0);
  const catMap={};
  for(const t of baseFiltered){ const c=categorizeTx(t); if(!catMap[c])catMap[c]=0; catMap[c]+=Math.abs(t.amount); }
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([name,amount])=>({name,amount,pct:total>0?(amount/total)*100:0}));

  const displayTxs=useMemo(()=>activeCat?baseFiltered.filter(t=>categorizeTx(t)===activeCat):baseFiltered,[baseFiltered,activeCat]);

  // Top merchants for current period
  const merchantMap={};
  for(const t of baseFiltered){ const k=t.description||'?'; if(!merchantMap[k])merchantMap[k]={name:k,total:0,count:0}; merchantMap[k].total+=Math.abs(t.amount); merchantMap[k].count++; }
  const topMerchants=Object.values(merchantMap).sort((a,b)=>b.total-a.total).slice(0,8);

  // Recurring for current period
  const descCount={};
  for(const t of baseFiltered){ const k=t.description; if(!descCount[k])descCount[k]={name:k,count:0,total:0}; descCount[k].count++; descCount[k].total+=Math.abs(t.amount); }
  const recurring=Object.values(descCount).filter(d=>d.count>=2).sort((a,b)=>b.total-a.total).slice(0,8);

  const COLORS=[C.purple,C.cyan,C.orange,C.red,C.green,C.pink,C.yellow,C.teal];

  const EmptySpese=()=>(
    <Glass C={C} style={{marginTop:4}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'28px 16px'}}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C.sep2} strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke={C.sep2} strokeWidth="1.8" strokeLinecap="round"/></svg>
        <div style={{color:C.secondary,fontSize:14,fontFamily:FONT.text,fontWeight:600}}>Nessuna spesa</div>
        <div style={{color:C.tertiary,fontSize:12,fontFamily:FONT.text,textAlign:'center',lineHeight:1.5}}>Non ci sono uscite nel periodo selezionato.</div>
      </div>
    </Glass>
  );

  return (
    <div className="rv-page" style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:14}}>
      <SegCtrl C={C} options={PERIOD_OPTS} value={period} onChange={v=>{setPeriod(v);setActiveCat(null);}}/>
      {period==='custom'&&<CustomDatePicker C={C} from={customFrom} to={customTo} onChange={(f,t)=>{setCustomFrom(f);setCustomTo(t);setActiveCat(null);}}/>}
      <Glass C={C}><div style={{textAlign:'center',padding:'4px 0'}}>
        <div style={{color:C.secondary,fontSize:12,fontFamily:FONT.text,fontWeight:500,marginBottom:6}}>
          {activeCat?`Categoria: ${activeCat}`:'Totale Spese'}
          {activeCat&&<button onClick={()=>setActiveCat(null)} style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',color:C.tertiary,fontSize:11,fontFamily:FONT.text}}>× tutto</button>}
        </div>
        <div style={{color:C.cyan,fontSize:42,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-1.5px',fontVariantNumeric:'tabular-nums',...neonText(C.cyan,C.scheme)}}>{fmt.currency(activeCat?displayTxs.reduce((s,t)=>s+Math.abs(t.amount),0):total,cur)}</div>
        <div style={{color:C.tertiary,fontSize:11,fontFamily:FONT.mono,marginTop:6}}>{displayTxs.length} transazioni</div>
      </div></Glass>
      {baseFiltered.length===0&&<EmptySpese/>}
      {cats.length>0&&(
        <Glass C={C}>
          <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:14}}>Per Categoria <span style={{color:C.tertiary,fontWeight:400,fontSize:10}}>{activeCat?'— tocca per resettare':'— tocca per filtrare'}</span></div>
          {cats.slice(0,9).map((cat,i)=>(
            <div key={cat.name} onClick={()=>setActiveCat(activeCat===cat.name?null:cat.name)} style={{marginBottom:i<cats.length-1?10:0,cursor:'pointer',opacity:activeCat&&activeCat!==cat.name?0.4:1,transition:'opacity 0.2s'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:8,height:8,borderRadius:2,background:COLORS[i%COLORS.length]}}/>
                  <span style={{color:C.primary,fontSize:13,fontFamily:FONT.text}}>{cat.name}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:C.tertiary,fontSize:11,fontFamily:FONT.mono}}>{fmt.pct(cat.pct)}</span>
                  <span style={{color:C.primary,fontSize:13,fontFamily:FONT.mono,fontWeight:600}}>{fmt.currency(cat.amount,cur)}</span>
                </div>
              </div>
              <div style={{height:4,borderRadius:2,background:C.glass3,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:COLORS[i%COLORS.length],width:`${cat.pct}%`,transition:'width 0.5s ease'}}/></div>
            </div>
          ))}
        </Glass>
      )}
      {topMerchants.length>0&&(
        <Glass C={C} padding="">
          <div style={{padding:'16px 18px 4px'}}><div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>Top Commercianti</div></div>
          {topMerchants.map((m,i)=>(
            <div key={m.name} className="rv-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px',borderBottom:i<topMerchants.length-1?`0.5px solid ${C.sep}`:'none'}}>
              <div><div style={{color:C.primary,fontSize:13,fontFamily:FONT.text,fontWeight:500}}>{m.name}</div><div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginTop:2}}>{m.count}× transazioni</div></div>
              <span style={{color:C.red,fontSize:14,fontFamily:FONT.mono,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>−{fmt.currency(m.total,cur)}</span>
            </div>
          ))}
          <div style={{height:4}}/>
        </Glass>
      )}
      {recurring.length>0&&(
        <Glass C={C} padding="">
          <div style={{padding:'16px 18px 4px'}}><div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>Pagamenti Ricorrenti</div></div>
          {recurring.map((r,i)=>(
            <div key={r.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px',borderBottom:i<recurring.length-1?`0.5px solid ${C.sep}`:'none'}}>
              <div><div style={{color:C.primary,fontSize:13,fontFamily:FONT.text}}>{r.name}</div><div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginTop:2}}>{r.count}× · media {fmt.currency(r.total/r.count,cur)}/volta</div></div>
              <div style={{padding:'3px 10px',background:`${C.orange}18`,border:`0.5px solid ${C.orange}40`,borderRadius:RADIUS.pill,fontSize:11,fontFamily:FONT.mono,fontWeight:600,color:C.orange}}>{fmt.currency(r.total,cur)}</div>
            </div>
          ))}
          <div style={{height:4}}/>
        </Glass>
      )}
    </div>
  );
}

/* ============= INSERIMENTO MANUALE ============= */
// Categorie coerenti con categorizeTx (uscite) + set entrate.
const EXPENSE_CATS = ['Cibo & Ristoranti','Shopping','Abbonamenti','Trasporti','Utenze','Affitto','Salute','Viaggi','Investimenti','Contanti','Trasferimenti','Altro'];
const INCOME_CATS  = ['Stipendio','Rimborso','Investimenti','Vendita','Regalo','Altro'];
const CURRENCIES   = ['EUR','USD','USDC','GBP','CHF'];

// Campo del form (top-level = tipo stabile, niente remount/perdita focus).
const AtField = ({C,label,children}) => (
  <div>
    <div style={{color:C.tertiary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>{label}</div>
    {children}
  </div>
);

function AddTransactionModal({C,open,onClose,accounts=[],activeAccountId,editTx=null,onAdd,onUpdate,onDelete}) {
  const ALL_ID='__all__';
  const pickDefaultAcc=()=> activeAccountId && activeAccountId!==ALL_ID ? activeAccountId : (accounts[0]?.id||null);
  const todayStr=()=>{ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const accountOfTx=(id)=> accounts.find(a=>(a.rawTxs||[]).some(t=>t.id===id))?.id;
  const numToInput=(n)=> n==null?'':String(n).replace('.',',');

  const [type,setType]=useState('out');            // 'in' | 'out' | 'transfer'
  const [amount,setAmount]=useState('');
  const [fee,setFee]=useState('');
  const [cat,setCat]=useState(EXPENSE_CATS[0]);
  const [desc,setDesc]=useState('');
  const [dateStr,setDateStr]=useState(todayStr);
  const [accId,setAccId]=useState(pickDefaultAcc);
  const [fromCur,setFromCur]=useState('EUR');
  const [toCur,setToCur]=useState('USD');

  useEffect(()=>{
    if(!open) return;
    if(editTx){
      const et = editTx.internal ? 'transfer' : (editTx.amount>0?'in':'out');
      setType(et);
      setAmount(numToInput(Math.abs(editTx.amount)));
      setFee(editTx.fee ? numToInput(Math.abs(editTx.fee)) : '');
      setDateStr(editTx.dateStr || todayStr());
      setAccId(accountOfTx(editTx.id) || pickDefaultAcc());
      setFromCur(editTx.fromCur || 'EUR');
      setToCur(editTx.toCur || 'USD');
      setCat(et==='transfer' ? EXPENSE_CATS[0] : (editTx.category || (et==='in'?INCOME_CATS[0]:EXPENSE_CATS[0])));
      const auto = editTx.description===editTx.type || (editTx.fromCur && editTx.description===`${editTx.fromCur} → ${editTx.toCur}`);
      setDesc(auto ? '' : (editTx.description||''));
    } else {
      setType('out'); setAmount(''); setFee(''); setCat(EXPENSE_CATS[0]); setDesc('');
      setDateStr(todayStr()); setAccId(pickDefaultAcc()); setFromCur('EUR'); setToCur('USD');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,editTx]);

  if(!open) return null;

  const parseAmt=(s)=>{ const v=parseFloat(String(s).replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,'')); return isNaN(v)?NaN:v; };
  const amt=parseAmt(amount);
  const valid=!isNaN(amt)&&amt>0&&!!accId;
  const cats=type==='in'?INCOME_CATS:EXPENSE_CATS;
  const typeColor=type==='in'?C.green:type==='out'?C.red:C.cyan;

  const feeVal = Math.max(0, Math.round((parseAmt(fee)||0)*100)/100);
  const save=()=>{
    if(!valid){ haptic.error(); return; }
    const abs=Math.round(amt*100)/100;
    let signed, internal, category, typeLabel;
    if(type==='in'){ signed=abs; internal=false; category=cat; typeLabel='Entrata'; }
    else if(type==='out'){ signed=-abs; internal=false; category=cat; typeLabel='Uscita'; }
    else { internal=true; category='Conversioni'; typeLabel='Conversione'; signed=-abs; }
    const [y,m,dd]=dateStr.split('-').map(Number);
    const date=new Date(y||2000,(m||1)-1,dd||1,12,0,0);
    const defDesc = type==='transfer' ? `${fromCur} → ${toCur}` : typeLabel;
    const tx={
      id: editTx ? editTx.id : ('tx_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),
      type:typeLabel, date, dateStr,
      description:desc.trim()||defDesc,
      amount:signed, fee:feeVal, currency:'EUR', balance:null,
      internal, category, manual:true,
      ...(type==='transfer'?{fromCur,toCur}:{}),
    };
    if(editTx) onUpdate?.(editTx.id, accId, tx); else onAdd?.(accId, tx);
    haptic.success(); onClose();
  };
  const removeTx=()=>{
    if(!editTx) return;
    if(typeof window!=='undefined' && window.confirm('Eliminare questa transazione?')){ onDelete?.(editTx.id); haptic.medium(); onClose(); }
  };

  const TYPES=[{id:'in',label:'Entrata',col:C.green},{id:'out',label:'Uscita',col:C.red},{id:'transfer',label:'Conversione',col:C.cyan}];

  return createPortal(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:210,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}/>
      {/* Foglio ancorato in basso, altezza max fissa e scroll interno: semplice e
          robusto (niente calcoli sul viewport che possono incastrarsi). La tastiera
          copre temporaneamente il fondo, ma il campo attivo resta visibile e appena
          la chiudi tutto torna raggiungibile. */}
      <div className="rv-card" style={{
        position:'fixed',left:0,right:0,bottom:0,zIndex:211,
        background:C.glass,backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',
        borderRadius:'28px 28px 0 0',border:`0.5px solid ${C.sep2}`,
        maxHeight:'88vh',overflowY:'auto',WebkitOverflowScrolling:'touch',
        paddingBottom:'env(safe-area-inset-bottom,0px)',
      }}>
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.glass3}}/>
        </div>
        <div style={{padding:'0 20px 24px',display:'flex',flexDirection:'column',gap:18}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:C.primary,fontSize:17,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-0.3px'}}>{editTx?'Modifica transazione':'Nuova transazione'}</span>
            <button onClick={onClose} className="rv-btn" style={{width:30,height:30,borderRadius:15,background:C.glass2,border:`0.5px solid ${C.sep}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke={C.secondary} strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Tipo */}
          <div style={{display:'flex',background:C.glass2,borderRadius:RADIUS.pill,padding:3,gap:2}}>
            {TYPES.map(o=>(
              <button key={o.id} onClick={()=>{setType(o.id);haptic.selection();setCat(o.id==='in'?INCOME_CATS[0]:EXPENSE_CATS[0]);}} className="rv-btn rv-seg-pill" style={{flex:1,padding:'8px 6px',fontSize:12,fontFamily:FONT.text,fontWeight:600,border:'none',cursor:'pointer',borderRadius:RADIUS.pill,background:type===o.id?o.col:'transparent',color:type===o.id?C.bg:C.secondary}}>{o.label}</button>
            ))}
          </div>

          {/* Importo */}
          <AtField C={C} label="Importo">
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:C.glass2,border:`0.5px solid ${typeColor}45`,borderRadius:RADIUS.inset}}>
              <span style={{color:typeColor,fontSize:26,fontFamily:FONT.display,fontWeight:700}}>€</span>
              <input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00" style={{flex:1,minWidth:0,background:'transparent',border:'none',outline:'none',color:C.primary,fontSize:26,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-0.5px',fontVariantNumeric:'tabular-nums'}}/>
            </div>
          </AtField>

          {/* Commissione (facoltativa) */}
          <AtField C={C} label="Commissione (facoltativa)">
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:C.glass2,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.inset}}>
              <span style={{color:C.tertiary,fontSize:16,fontFamily:FONT.display,fontWeight:700}}>€</span>
              <input inputMode="decimal" value={fee} onChange={e=>setFee(e.target.value)} placeholder="0,00" style={{flex:1,minWidth:0,background:'transparent',border:'none',outline:'none',color:C.primary,fontSize:16,fontFamily:FONT.mono,fontWeight:600,fontVariantNumeric:'tabular-nums'}}/>
              {type==='transfer'&&<span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.text,flexShrink:0}}>spread / fee cambio</span>}
            </div>
          </AtField>

          {/* Conversione: valuta di origine → destinazione */}
          {type==='transfer'&&(
            <AtField C={C} label="Conversione valuta">
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{color:C.tertiary,fontSize:9,fontFamily:FONT.mono,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px'}}>Da</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {CURRENCIES.map(cu=>(
                      <button key={cu} onClick={()=>{setFromCur(cu);haptic.light();}} className="rv-btn" style={{padding:'6px 10px',fontSize:11,fontFamily:FONT.mono,fontWeight:700,borderRadius:RADIUS.pill,border:`0.5px solid ${fromCur===cu?C.cyan:C.sep}`,background:fromCur===cu?`${C.cyan}22`:C.glass2,color:fromCur===cu?C.cyan:C.secondary,cursor:'pointer'}}>{cu}</button>
                    ))}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:18}}><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" stroke={C.cyan} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div style={{flex:1}}>
                  <div style={{color:C.tertiary,fontSize:9,fontFamily:FONT.mono,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.4px'}}>A</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {CURRENCIES.map(cu=>(
                      <button key={cu} onClick={()=>{setToCur(cu);haptic.light();}} className="rv-btn" style={{padding:'6px 10px',fontSize:11,fontFamily:FONT.mono,fontWeight:700,borderRadius:RADIUS.pill,border:`0.5px solid ${toCur===cu?C.cyan:C.sep}`,background:toCur===cu?`${C.cyan}22`:C.glass2,color:toCur===cu?C.cyan:C.secondary,cursor:'pointer'}}>{cu}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.text,marginTop:10,lineHeight:1.4}}>La conversione è neutra: non conta come entrata né come uscita.</div>
            </AtField>
          )}

          {/* Categoria (entrata/uscita) */}
          {type!=='transfer'&&(
            <AtField C={C} label="Categoria">
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {cats.map(c=>(
                  <button key={c} onClick={()=>{setCat(c);haptic.light();}} className="rv-btn" style={{padding:'7px 12px',fontSize:12,fontFamily:FONT.text,fontWeight:600,borderRadius:RADIUS.pill,border:`0.5px solid ${cat===c?typeColor:C.sep}`,background:cat===c?`${typeColor}22`:C.glass2,color:cat===c?typeColor:C.secondary,cursor:'pointer'}}>{c}</button>
                ))}
              </div>
            </AtField>
          )}

          {/* Descrizione */}
          <AtField C={C} label={type==='transfer'?'Nota':'Descrizione'}>
            <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder={type==='in'?'Es. Stipendio, cliente...':type==='out'?'Es. Esselunga, Amazon...':'Facoltativa — es. cambio su Revolut'} style={{width:'100%',boxSizing:'border-box',padding:'11px 14px',background:C.glass2,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.inset,color:C.primary,fontSize:14,fontFamily:FONT.text,outline:'none'}}/>
          </AtField>

          {/* Data */}
          <AtField C={C} label="Data">
            <input type="date" value={dateStr} onChange={e=>setDateStr(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'11px 14px',background:C.glass2,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.inset,color:C.primary,fontSize:14,fontFamily:FONT.mono,outline:'none',colorScheme:C.scheme}}/>
          </AtField>

          {/* Conto (solo se piu' di uno) */}
          {accounts.length>1&&(
            <AtField C={C} label="Conto">
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {accounts.map(a=>(
                  <button key={a.id} onClick={()=>{setAccId(a.id);haptic.light();}} className="rv-btn" style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',fontSize:12,fontFamily:FONT.text,fontWeight:600,borderRadius:RADIUS.pill,border:`0.5px solid ${accId===a.id?a.color:C.sep}`,background:accId===a.id?`${a.color}20`:C.glass2,color:accId===a.id?C.primary:C.secondary,cursor:'pointer'}}>
                    <div style={{width:8,height:8,borderRadius:4,background:a.color}}/>{a.name}
                  </button>
                ))}
              </div>
            </AtField>
          )}

          <button onClick={save} disabled={!valid} className="rv-btn" style={{padding:'13px',background:valid?typeColor:C.glass3,border:'none',borderRadius:RADIUS.pill,cursor:valid?'pointer':'default',color:valid?C.bg:C.tertiary,fontSize:15,fontFamily:FONT.text,fontWeight:700,letterSpacing:'-0.2px'}}>
            {editTx?'Salva modifiche':(type==='in'?'Aggiungi entrata':type==='out'?'Aggiungi uscita':'Aggiungi conversione')}
          </button>
          {editTx&&(
            <button onClick={removeTx} className="rv-btn" style={{padding:'11px',background:'transparent',border:`0.5px solid ${C.red}40`,borderRadius:RADIUS.pill,cursor:'pointer',color:C.red,fontSize:13,fontFamily:FONT.text,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Elimina transazione
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ============= MOVIMENTI ============= */
function MovimentiPage({C,txs,accounts=[],activeAccountId,onAddTransaction,onUpdateTransaction,onDeleteTransaction}) {
  const [showAdd,setShowAdd]=useState(false);
  const [editTx,setEditTx]=useState(null);
  const [filter,setFilter]=useState('all');
  const [period,setPeriod]=useState('all');
  const [customFrom,setCustomFrom]=useState('');
  const [customTo,setCustomTo]=useState('');
  const [search,setSearch]=useState('');
  const [catFilter,setCatFilter]=useState('tutte');
  const [visible,setVisible]=useState(40);
  const cur=txs[0]?.currency||'EUR';
  const sorted=useMemo(()=>[...txs].sort((a,b)=>b.date-a.date),[txs]);

  const allCats=useMemo(()=>{
    const s=new Set(sorted.filter(t=>t.amount<0&&!t.internal).map(t=>categorizeTx(t)));
    return ['tutte',...Array.from(s).sort()];
  },[sorted]);

  const filtered=useMemo(()=>{
    let list=sorted;
    list=filterByPeriod(list,period,customFrom,customTo);
    if(filter==='in')  list=list.filter(t=>t.amount>0&&!t.internal);
    if(filter==='out') list=list.filter(t=>t.amount<0&&!t.internal);
    if(filter==='int') list=list.filter(t=>t.internal);
    if(catFilter!=='tutte'&&filter!=='in') list=list.filter(t=>t.amount<0&&!t.internal&&categorizeTx(t)===catFilter);
    if(search) list=list.filter(t=>(t.description||'').toLowerCase().includes(search.toLowerCase())||(t.type||'').toLowerCase().includes(search.toLowerCase()));
    return list;
  },[sorted,filter,period,customFrom,customTo,search,catFilter]);

  // reset visible when filters change
  const [prevFiltered, setPrevFiltered] = useState(filtered);
  if (filtered !== prevFiltered) { setPrevFiltered(filtered); setVisible(40); }

  // Escludi le conversioni (interne) dai totali dei box, per coerenza con Home/Analisi.
  const totalIn=filtered.filter(t=>t.amount>0&&!t.internal).reduce((s,t)=>s+t.amount,0);
  const totalOut=filtered.filter(t=>t.amount<0&&!t.internal).reduce((s,t)=>s+Math.abs(t.amount),0);

  return (
    <div className="rv-page" style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:12}}>
      {/* Search */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.glass2,border:`0.5px solid ${C.sep}`,borderRadius:RADIUS.inset}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={C.tertiary} strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke={C.tertiary} strokeWidth="2" strokeLinecap="round"/></svg>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca transazione..." style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.primary,fontSize:14,fontFamily:FONT.text}}/>
        {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:C.tertiary,fontSize:18,lineHeight:1}}>×</button>}
      </div>
      {/* Period filter */}
      <SegCtrl C={C} options={PERIOD_OPTS} value={period} onChange={v=>{setPeriod(v);}} />
      {period==='custom'&&<CustomDatePicker C={C} from={customFrom} to={customTo} onChange={(f,t)=>{setCustomFrom(f);setCustomTo(t);}}/>}
      {/* Type filter */}
      <SegCtrl C={C} options={[{id:'all',label:'Tutti'},{id:'in',label:'Entrate'},{id:'out',label:'Uscite'},{id:'int',label:'Interni'}]} value={filter} onChange={v=>{setFilter(v);setCatFilter('tutte');}}/>
      {/* Category filter — only for uscite */}
      {(filter==='all'||filter==='out')&&allCats.length>2&&(
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:2,WebkitOverflowScrolling:'touch'}}>
          {allCats.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)} className="rv-btn" style={{
              flexShrink:0,padding:'5px 12px',fontSize:11,fontFamily:FONT.text,fontWeight:600,
              borderRadius:RADIUS.pill,border:`0.5px solid ${catFilter===c?C.purple:C.sep}`,
              background:catFilter===c?`${C.purple}25`:C.glass2,
              color:catFilter===c?C.purple:C.secondary,cursor:'pointer',whiteSpace:'nowrap',
            }}>{c==='tutte'?'Tutte':c}</button>
          ))}
        </div>
      )}
      {/* Aggiungi transazione — sempre visibile, sopra i box entrate/uscite */}
      <button onClick={()=>{setEditTx(null);setShowAdd(true);haptic.medium();}} className="rv-btn" style={{
        width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        padding:'12px 0',border:'none',borderRadius:RADIUS.pill,cursor:'pointer',
        background:`linear-gradient(135deg, ${C.green}, ${C.cyan})`,
        color:'#001A10',fontSize:14,fontFamily:FONT.text,fontWeight:700,letterSpacing:'-0.2px',
        boxShadow:C.scheme==='dark'?`0 6px 20px ${C.cyan}33`:'none',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#001A10" strokeWidth="2.6" strokeLinecap="round"/></svg>
        Aggiungi transazione
      </button>
      {/* Summary */}
      {filtered.length>0&&(
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1,padding:'10px 14px',background:`${C.green}12`,border:`0.5px solid ${C.green}30`,borderRadius:RADIUS.inset}}>
            <div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginBottom:3}}>ENTRATE</div>
            <div style={{color:C.green,fontSize:15,fontFamily:FONT.mono,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>+{fmt.currency(totalIn,cur)}</div>
          </div>
          <div style={{flex:1,padding:'10px 14px',background:`${C.red}12`,border:`0.5px solid ${C.red}30`,borderRadius:RADIUS.inset}}>
            <div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginBottom:3}}>USCITE</div>
            <div style={{color:C.red,fontSize:15,fontFamily:FONT.mono,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>−{fmt.currency(totalOut,cur)}</div>
          </div>
        </div>
      )}
      {/* Transaction list */}
      <Glass C={C} padding="">
        <div style={{padding:'4px 0'}}>
          {filtered.slice(0,visible).map((t,i)=>{
            const isLast=i===Math.min(visible,filtered.length)-1;
            const amtColor=t.amount>=0?C.green:t.internal?C.tertiary:C.red;
            const cat=t.amount<0&&!t.internal?categorizeTx(t):null;
            const canEdit=t.id&&onUpdateTransaction;
            return (
              <div key={t.id||i} className="rv-row" onClick={canEdit?()=>{setEditTx(t);setShowAdd(true);haptic.light();}:undefined} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:!isLast?`0.5px solid ${C.sep}`:'none',opacity:t.internal?0.6:1,cursor:canEdit?'pointer':'default'}}>
                <div style={{flex:1,marginRight:12}}>
                  <div style={{color:C.primary,fontSize:13,fontFamily:FONT.text,fontWeight:500,marginBottom:2}}>{t.description||t.type||'Transazione'}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono}}>{t.date?.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'2-digit'})}</span>
                    {t.type&&<span style={{fontSize:9,fontFamily:FONT.text,fontWeight:600,color:C.tertiary,padding:'1px 6px',background:C.glass3,borderRadius:RADIUS.pill,textTransform:'uppercase',letterSpacing:'0.3px'}}>{t.type}</span>}
                    {cat&&<span style={{fontSize:9,fontFamily:FONT.text,fontWeight:600,color:C.purple,padding:'1px 6px',background:`${C.purple}18`,borderRadius:RADIUS.pill}}>{cat}</span>}
                    {t.fee>0&&<span style={{fontSize:9,fontFamily:FONT.mono,fontWeight:600,color:C.orange,padding:'1px 6px',background:`${C.orange}18`,borderRadius:RADIUS.pill}}>fee {fmt.currency(t.fee,cur)}</span>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:amtColor,fontSize:14,fontFamily:FONT.mono,fontWeight:700,fontVariantNumeric:'tabular-nums',...neonText(amtColor,C.scheme)}}>{t.amount>=0?'+':''}{fmt.currency(t.amount,cur)}</div>
                    {t.balance!=null&&<div style={{color:C.tertiary,fontSize:9,fontFamily:FONT.mono,marginTop:2}}>= {fmt.currency(t.balance,cur)}</div>}
                  </div>
                  {canEdit&&<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,opacity:0.35}}><path d="M9 6l6 6-6 6" stroke={C.tertiary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
            );
          })}
          {filtered.length>visible&&(
            <div style={{padding:'14px',textAlign:'center'}}>
              <button className="rv-btn" onClick={()=>setVisible(v=>v+40)} style={{padding:'8px 20px',fontSize:12,fontFamily:FONT.text,fontWeight:600,background:C.glass2,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.pill,cursor:'pointer',color:C.secondary}}>
                Mostra altri ({filtered.length-visible} rimasti)
              </button>
            </div>
          )}
          {filtered.length===0&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'36px 16px'}}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={C.sep2} strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke={C.sep2} strokeWidth="1.8" strokeLinecap="round"/></svg>
              <div style={{color:C.secondary,fontSize:14,fontFamily:FONT.text,fontWeight:600}}>Nessuna transazione</div>
              <div style={{color:C.tertiary,fontSize:12,fontFamily:FONT.text,textAlign:'center',lineHeight:1.5}}>Tocca <span style={{color:C.cyan,fontWeight:600}}>Aggiungi transazione</span> per inserire il primo movimento.</div>
            </div>
          )}
        </div>
      </Glass>

      <AddTransactionModal C={C} open={showAdd} editTx={editTx} onClose={()=>{setShowAdd(false);setEditTx(null);}} accounts={accounts} activeAccountId={activeAccountId} onAdd={onAddTransaction} onUpdate={onUpdateTransaction} onDelete={onDeleteTransaction}/>
    </div>
  );
}

/* ============= AI ============= */
// La AI passa dalla funzione serverless /api/coach (chiave lato server).


function AIPage({C,data,txs,setInputFocused,input,setInput,send,inputRef}) {
  const CHAT_KEY='hb_chat_history';
  const [messages,setMessages]=useState(()=>{
    try{const s=localStorage.getItem(CHAT_KEY);return s?JSON.parse(s):[];}catch{return [];}
  });
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  // Persist chat to localStorage on every change
  useEffect(()=>{
    try{localStorage.setItem(CHAT_KEY,JSON.stringify(messages));}catch{}
  },[messages]);
  const scrollRef=useRef(null);
  const cur=txs[0]?.currency||'EUR';

  const buildContext=useMemo(()=>{
    if(!data) return `Sei l'assistente finanziario personale dell'app HomeBanking di Emanuele. Emanuele inserisce manualmente le proprie transazioni (entrate, uscite e conversioni di valuta, es. EUR↔USD o USDC→EUR). Al momento non c'è ancora nessuna transazione inserita: invita gentilmente Emanuele ad aggiungere i suoi movimenti dalla scheda "Storico", con il pulsante "Aggiungi transazione", e spiega brevemente cosa potrai analizzare quando i dati saranno presenti (spese per categoria, tasso di risparmio, andamento mensile, ecc.). Rispondi sempre in italiano, conciso e diretto.`;
    return `Sei l'assistente finanziario personale esperto dell'app HomeBanking. Analizzi i dati che Emanuele inserisce MANUALMENTE nell'app: ogni movimento è un'entrata, un'uscita o una conversione di valuta. Le conversioni di valuta (es. EUR↔USD, USDC→EUR) sono neutre e NON contano come entrate né come uscite. Le uscite sono classificate per categoria (es. Cibo & Ristoranti, Shopping, Abbonamenti, Trasporti, Utenze, Affitto, Salute, Viaggi, Investimenti, Contanti, Trasferimenti, Altro).
Dati finanziari:
- Periodo: ${fmt.date(data.firstDate)} → ${fmt.date(data.lastDate)} (${data.days} giorni)
- Saldo netto (entrate − uscite − commissioni): ${data.latestBalance!=null?fmt.currency(data.latestBalance,cur):fmt.currency(data.netFlow,cur)}
- Entrate totali: ${fmt.currency(data.income,cur)}
- Uscite totali: ${fmt.currency(data.expense,cur)}
- Commissioni pagate: ${fmt.currency(data.totalFees,cur)}
- Conversioni valuta: ${data.convCount}
- Flusso netto: ${fmt.currency(data.netFlow,cur)}
- Tasso di risparmio: ${fmt.pct(data.savingRate)}
- Spesa giornaliera media: ${fmt.currency(data.avgDailySpend,cur)}
- Totale transazioni: ${data.totalTxs}
- Spesa per categoria: ${(data.categories||[]).slice(0,8).map(c=>`${c.name}: ${fmt.currency(c.amount,cur)}`).join(', ')}
- Voci di spesa principali: ${(data.topMerchants||[]).slice(0,5).map(m=>`${m.name} (${fmt.currency(m.total,cur)}, ${m.count}x)`).join(', ')}
- Mesi analizzati: ${(data.monthlyData||[]).length}
Rispondi sempre in italiano, conciso e diretto. Rispondi a QUALSIASI domanda di Emanuele, inclusi consigli concreti e pratici su budget, risparmio, spese e gestione del denaro: dai indicazioni schiette e azionabili senza disclaimer ripetuti. Emanuele è adulto e consapevole, decide da solo. Usa SOLO i numeri reali qui sopra: non inventare dati, se manca qualcosa dillo.`;
  },[data,cur]);

  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[messages,loading]);

  const sendInternal=async()=>{
    const text=input.trim();
    if(!text||loading) return;
    setError(null);
    const newMessages=[...messages,{role:'user',content:text}];
    setMessages(newMessages); setInput(''); setLoading(true); haptic.medium();
    try {
      // Build Gemini-compatible contents array
      const contents=newMessages.map(m=>({
        role:m.role==='assistant'?'model':'user',
        parts:[{text:m.content}]
      }));
      const resp=await fetch('/api/coach',
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({
           system:buildContext,
           contents,
           generationConfig:{temperature:0.7,maxOutputTokens:800},
         })}
      );
      const d=await resp.json();
      if(!resp.ok||d.error){
        setError(d.error||`Errore ${resp.status}`); haptic.error();
      } else {
        const reply=d.text||'Nessuna risposta.';
        setMessages([...newMessages,{role:'assistant',content:reply}]); haptic.success();
      }
    } catch(e) { setError('Connessione fallita: '+e.message); haptic.error(); }
    finally { setLoading(false); }
  };

  // Wire the send prop (called from outside input bar) to sendInternal
  useEffect(()=>{ if(send) send.current=sendInternal; });

  const clearChat=()=>{
    if(messages.length===0) return;
    if(window.confirm('Cancellare tutta la conversazione?')){haptic.medium();setMessages([]);setError(null);try{localStorage.removeItem(CHAT_KEY);}catch{}}
  };

  const SUGG=['Analizza le mie spese principali','Come posso risparmiare di più?','Quali abbonamenti potrei tagliare?','Confronta entrate e uscite mensili'];

  return (
    <div className="rv-page" style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden',gap:0,padding:'0'}}>
      {messages.length>0&&(
        <div style={{flexShrink:0,display:'flex',justifyContent:'flex-end'}}>
          <button onClick={clearChat} className="rv-btn" style={{padding:'6px 12px',fontSize:11,fontFamily:FONT.text,fontWeight:600,color:C.tertiary,background:'transparent',border:`0.5px solid ${C.sep}`,borderRadius:RADIUS.pill,cursor:'pointer'}}>Nuova chat</button>
        </div>
      )}

      {/* Messages scroll area — bottom padding leaves space for fixed input bar */}
      <div ref={scrollRef} style={{flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',padding:'12px 16px 80px'}}>
        {messages.length===0&&(
          <div className="rv-card" style={{background:C.glass,backdropFilter:'blur(32px)',WebkitBackdropFilter:'blur(32px)',border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.card,overflow:'hidden',position:'relative',padding:24}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:12}}>
              <div style={{width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <RvIconAI color={C.primary}/>
              </div>
              <div>
                <div style={{color:C.primary,fontSize:16,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-0.3px',marginBottom:4}}>Chiedimi qualunque cosa</div>
                <div style={{color:C.tertiary,fontSize:12,fontFamily:FONT.text,lineHeight:1.5,maxWidth:280}}>Ho accesso ai tuoi movimenti inseriti manualmente e ti aiuto ad analizzarli.</div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:4}}>
                {SUGG.map((s,i)=>(
                  <button key={i} onClick={()=>{haptic.selection();setInput(s);inputRef.current?.focus();}} className="rv-btn" style={{padding:'6px 12px',fontSize:11,fontFamily:FONT.text,fontWeight:500,color:C.secondary,background:C.glass2,border:`0.5px solid ${C.sep}`,borderRadius:RADIUS.pill,cursor:'pointer'}}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m,i)=>(
          <div key={i} className="rv-page" style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:10}}>
            <div style={{maxWidth:'85%',padding:'10px 14px',borderRadius:m.role==='user'?'20px 20px 6px 20px':'20px 20px 20px 6px',background:m.role==='user'?C.glass3:C.glass2,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',border:`0.5px solid ${C.sep2}`,color:C.primary,fontSize:14,fontFamily:FONT.text,fontWeight:400,letterSpacing:'-0.1px',lineHeight:1.45,whiteSpace:'pre-wrap',wordBreak:'break-word',boxShadow:'0 1px 0 rgba(255,255,255,0.04) inset'}}>{m.content}</div>
          </div>
        ))}

        {loading&&(
          <div style={{display:'flex',justifyContent:'flex-start',marginBottom:10}}>
            <div style={{padding:'12px 16px',borderRadius:'20px 20px 20px 6px',background:C.glass2,border:`0.5px solid ${C.sep2}`,display:'flex',alignItems:'center',gap:6}}>
              {[0,1,2].map(j=><div key={j} className="rv-live-dot" style={{width:6,height:6,borderRadius:3,background:C.secondary,opacity:0.6,animationDelay:`${j*0.15}s`}}/>)}
            </div>
          </div>
        )}

        {error&&(
          <div style={{background:`${C.red}15`,border:`0.5px solid ${C.red}40`,borderRadius:14,padding:'10px 14px',color:C.red,fontSize:12,fontFamily:FONT.mono,marginBottom:10}}>⚠️ {error}</div>
        )}
      </div>
    </div>
  );
}

/* ============= ANALYTICS ============= */
function AnalyticsPage({C,data,txs}) {
  const [period,setPeriod]=useState('all');
  const [customFrom,setCustomFrom]=useState('');
  const [customTo,setCustomTo]=useState('');
  const cur=txs[0]?.currency||'EUR';

  const periodTxs=useMemo(()=>filterByPeriod(txs,period,customFrom,customTo),[txs,period,customFrom,customTo]);
  const d=useMemo(()=>periodTxs.length?analyzeTransactions(periodTxs):null,[periodTxs]);
  if(!d) return <div style={{padding:32,textAlign:'center',color:C.tertiary,fontSize:13,fontFamily:FONT.text}}>Nessun dato per il periodo selezionato</div>;

  const dowMap={0:'Dom',1:'Lun',2:'Mar',3:'Mer',4:'Gio',5:'Ven',6:'Sab'};
  const dowData=Array.from({length:7},(_,i)=>({name:dowMap[i],amount:0,count:0}));
  for(const t of periodTxs){if(t.amount>=0||!t.date||t.internal) continue; const dw=t.date.getDay(); dowData[dw].amount+=Math.abs(t.amount); dowData[dw].count++;}
  const maxDow=Math.max(...dowData.map(x=>x.amount));

  // Monthly view: if period is <3m show weekly, else monthly
  const showWeekly = period==='7d'||period==='month';
  const chartData = showWeekly ? d.weeklyData : (d.monthlyData||[]).slice(-14);

  return (
    <div className="rv-page" style={{padding:'0 16px 24px',display:'flex',flexDirection:'column',gap:16}}>
      <SegCtrl C={C} options={PERIOD_OPTS} value={period} onChange={setPeriod}/>
      {period==='custom'&&<CustomDatePicker C={C} from={customFrom} to={customTo} onChange={(f,t)=>{setCustomFrom(f);setCustomTo(t);}}/>}

      {/* Income vs Expense chart */}
      <Glass C={C}>
        <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:12}}>
          {showWeekly?'Flusso Settimanale':'Entrate vs Uscite Mensili'}
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{left:-20,right:0,top:4,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.sep} vertical={false}/>
            <XAxis dataKey={showWeekly?'label':'month'} tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={showWeekly?undefined:fmt.monthLabel}/>
            <YAxis tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={v=>fmt.short(v)}/>
            <Bar dataKey="income" fill={C.green} radius={[3,3,0,0]} maxBarSize={18} opacity={0.85}/>
            <Bar dataKey="expense" fill={C.red} radius={[3,3,0,0]} maxBarSize={18} opacity={0.85}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:'flex',gap:16,marginTop:4}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:C.green}}/><span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono}}>Entrate</span></div>
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:C.red}}/><span style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono}}>Uscite</span></div>
        </div>
      </Glass>

      {/* Saving rate */}
      {!showWeekly&&(d.monthlyData||[]).length>1&&(
        <Glass C={C}>
          <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:12}}>Saving Rate Mensile</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={(d.monthlyData||[]).slice(-14).map(m=>({...m,sr:m.income>0?((m.income-m.expense-(m.fees||0))/m.income)*100:0}))} margin={{left:-10,right:0,top:4,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.sep} vertical={false}/>
              <XAxis dataKey="month" tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={fmt.monthLabel}/>
              <YAxis tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={v=>`${v.toFixed(0)}%`}/>
              <ReferenceLine y={0} stroke={C.sep2}/>
              <Bar dataKey="sr" radius={[4,4,0,0]} maxBarSize={24}>
                {(d.monthlyData||[]).slice(-14).map((m,i)=>{const sr=m.income>0?((m.income-m.expense-(m.fees||0))/m.income)*100:0;return <Cell key={i} fill={sr>=0?C.green:C.red} opacity={0.85}/>;}) }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Glass>
      )}

      {/* Day of week */}
      <Glass C={C}>
        <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:12}}>Spese per Giorno della Settimana</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={dowData} margin={{left:-20,right:0,top:4,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.sep} vertical={false}/>
            <XAxis dataKey="name" tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false}/>
            <YAxis tick={{fill:C.tertiary,fontSize:9,fontFamily:FONT.mono}} tickLine={false} axisLine={false} tickFormatter={v=>fmt.short(v)}/>
            <Bar dataKey="amount" radius={[4,4,0,0]} maxBarSize={24}>
              {dowData.map((dw,i)=><Cell key={i} fill={dw.amount===maxDow?C.orange:C.purple} opacity={0.85}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Glass>

      {/* Monthly detail table */}
      {!showWeekly&&(d.monthlyData||[]).length>0&&(
        <Glass C={C} padding="">
          <div style={{padding:'14px 18px 4px'}}><div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>Dettaglio Mensile</div></div>
          {(d.monthlyData||[]).slice().reverse().map((m,i)=>{const net=m.income-m.expense-(m.fees||0);const nc=net>=0?C.green:C.red;return(
            <div key={m.month} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px',borderBottom:i<(d.monthlyData.length-1)?`0.5px solid ${C.sep}`:'none'}}>
              <span style={{color:C.primary,fontSize:13,fontFamily:FONT.mono,fontWeight:500,width:60}}>{fmt.monthLabel(m.month)}</span>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <span style={{color:C.green,fontSize:11,fontFamily:FONT.mono,fontVariantNumeric:'tabular-nums'}}>+{fmt.short(m.income)}</span>
                <span style={{color:C.red,fontSize:11,fontFamily:FONT.mono,fontVariantNumeric:'tabular-nums'}}>−{fmt.short(m.expense)}</span>
                <span style={{color:nc,fontSize:12,fontFamily:FONT.mono,fontWeight:700,fontVariantNumeric:'tabular-nums',minWidth:52,textAlign:'right',...neonText(nc,C.scheme)}}>{net>=0?'+':''}{fmt.short(net)}</span>
              </div>
            </div>
          );})}
          <div style={{height:4}}/>
        </Glass>
      )}
    </div>
  );
}

/* ===== UploadScreen rimosso — inserimento manuale via scheda Storico ===== */

/* ============= APP ICONS (xautrader style) ============= */
const RvAppIcon = ({ children, gradient, active, size = 32 }) => (
  <div style={{
    width: size, height: size,
    borderRadius: size * 0.32,
    background: gradient,
    display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow: active
      ? `0 0 0 0.5px rgba(255,255,255,0.18), 0 4px 12px rgba(0,0,0,0.5)`
      : `0 0 0 0.5px rgba(255,255,255,0.08)`,
    transition:'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: active ? 'scale(1)' : 'scale(0.92)',
    flexShrink: 0,
  }}>
    {children}
  </div>
);

/* Tab icon glyphs — 14×14 filled, white on gradient bg */
const RvIconOverview = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="none" stroke="#000000" strokeWidth="2" strokeLinejoin="round"/>
    <polyline points="9 22 9 12 15 12 15 22" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const RvIconSpese = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2"/>
    <path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const RvIconMovimenti = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M7 4v16M7 4L4 7M7 4l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 20V4M17 20l-3-3M17 20l3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const RvIconAnalytics = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <rect x="3"  y="11" width="4" height="10" rx="1.2" fill={color}/>
    <rect x="10" y="6"  width="4" height="15" rx="1.2" fill={color}/>
    <rect x="17" y="2"  width="4" height="19" rx="1.2" fill={color}/>
  </svg>
);

/* IconAI — identical particle-orb from xautrader */
const RvIconAI = ({ color = '#FFFFFF', size = 34 } = {}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" overflow="hidden" style={{ color }}>
    <circle cx="7.56" cy="18.6" r="0.38" fill="currentColor" opacity="0.76"/>
    <circle cx="6.97" cy="15.55" r="0.18" fill="currentColor" opacity="0.78"/>
    <circle cx="8.8" cy="8.35" r="0.16" fill="currentColor" opacity="0.69"/>
    <circle cx="24.94" cy="21.73" r="0.28" fill="currentColor" opacity="0.57"/>
    <circle cx="27.52" cy="14.71" r="0.28" fill="currentColor" opacity="0.83"/>
    <circle cx="16.79" cy="17.21" r="0.22" fill="currentColor" opacity="0.58"/>
    <circle cx="18.13" cy="21.4" r="0.14" fill="currentColor" opacity="0.76"/>
    <circle cx="5.92" cy="19.95" r="0.22" fill="currentColor" opacity="0.84"/>
    <circle cx="6.4" cy="16.01" r="0.20" fill="currentColor" opacity="0.68"/>
    <circle cx="27.77" cy="15.83" r="0.30" fill="currentColor" opacity="0.87"/>
    <circle cx="13.75" cy="21.19" r="0.18" fill="currentColor" opacity="0.58"/>
    <circle cx="16.76" cy="8.57" r="0.30" fill="currentColor" opacity="0.72"/>
    <circle cx="26.49" cy="13.17" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="22.84" cy="11.68" r="0.32" fill="currentColor" opacity="0.73"/>
    <circle cx="24.39" cy="20.15" r="0.28" fill="currentColor" opacity="0.67"/>
    <circle cx="21.81" cy="19.54" r="0.32" fill="currentColor" opacity="0.89"/>
    <circle cx="20.32" cy="19.96" r="0.16" fill="currentColor" opacity="0.58"/>
    <circle cx="17.45" cy="11.24" r="0.22" fill="currentColor" opacity="0.75"/>
    <circle cx="19.68" cy="25.4" r="0.16" fill="currentColor" opacity="0.84"/>
    <circle cx="21.69" cy="21.12" r="0.18" fill="currentColor" opacity="0.67"/>
    <circle cx="26.4" cy="14.08" r="0.18" fill="currentColor" opacity="0.95"/>
    <circle cx="17.81" cy="23.18" r="0.30" fill="currentColor" opacity="0.84"/>
    <circle cx="25.48" cy="22.92" r="0.18" fill="currentColor" opacity="0.67"/>
    <circle cx="16.96" cy="9.3" r="0.18" fill="currentColor" opacity="0.58"/>
    <circle cx="23.6" cy="20.83" r="0.16" fill="currentColor" opacity="0.82"/>
    <circle cx="10.5" cy="21.73" r="0.32" fill="currentColor" opacity="0.77"/>
    <circle cx="6.2" cy="11.04" r="0.18" fill="currentColor" opacity="0.62"/>
    <circle cx="24.95" cy="10.19" r="0.16" fill="currentColor" opacity="0.64"/>
    <circle cx="15.24" cy="4.58" r="0.18" fill="currentColor" opacity="0.98"/>
    <circle cx="22.77" cy="9.82" r="0.20" fill="currentColor" opacity="0.6"/>
    <circle cx="27.24" cy="18.79" r="0.16" fill="currentColor" opacity="0.87"/>
    <circle cx="15.53" cy="26.7" r="0.24" fill="currentColor" opacity="0.68"/>
    <circle cx="20.52" cy="24.94" r="0.14" fill="currentColor" opacity="0.65"/>
    <circle cx="5.85" cy="12.03" r="0.24" fill="currentColor" opacity="0.68"/>
    <circle cx="20.63" cy="13.36" r="0.14" fill="currentColor" opacity="0.67"/>
    <circle cx="13.27" cy="16.97" r="0.16" fill="currentColor" opacity="0.72"/>
    <circle cx="12.15" cy="14.12" r="0.18" fill="currentColor" opacity="0.95"/>
    <circle cx="25.49" cy="14.83" r="0.26" fill="currentColor" opacity="0.81"/>
    <circle cx="17.41" cy="17.71" r="0.14" fill="currentColor" opacity="0.96"/>
    <circle cx="12.49" cy="4.97" r="0.14" fill="currentColor" opacity="0.84"/>
    <circle cx="5.98" cy="17.12" r="0.18" fill="currentColor" opacity="1.0"/>
    <circle cx="23.76" cy="19.97" r="0.26" fill="currentColor" opacity="0.96"/>
    <circle cx="15.2" cy="6.13" r="0.28" fill="currentColor" opacity="0.96"/>
    <circle cx="10.17" cy="23.84" r="0.30" fill="currentColor" opacity="0.94"/>
    <circle cx="6.9" cy="21.22" r="0.28" fill="currentColor" opacity="0.81"/>
    <circle cx="10.84" cy="10.84" r="0.22" fill="currentColor" opacity="0.82"/>
    <circle cx="24.26" cy="20.56" r="0.32" fill="currentColor" opacity="0.95"/>
    <circle cx="15.0" cy="8.71" r="0.26" fill="currentColor" opacity="0.81"/>
    <circle cx="5.94" cy="19.94" r="0.14" fill="currentColor" opacity="0.89"/>
    <circle cx="24.99" cy="17.7" r="0.20" fill="currentColor" opacity="0.65"/>
    <circle cx="13.35" cy="8.11" r="0.24" fill="currentColor" opacity="0.96"/>
    <circle cx="15.95" cy="17.25" r="0.18" fill="currentColor" opacity="0.86"/>
    <circle cx="17.43" cy="20.65" r="0.30" fill="currentColor" opacity="0.85"/>
    <circle cx="5.59" cy="19.98" r="0.18" fill="currentColor" opacity="0.85"/>
    <circle cx="18.46" cy="23.34" r="0.28" fill="currentColor" opacity="0.96"/>
    <circle cx="21.34" cy="11.0" r="0.22" fill="currentColor" opacity="0.69"/>
    <circle cx="21.45" cy="22.28" r="0.28" fill="currentColor" opacity="0.93"/>
    <circle cx="13.23" cy="4.84" r="0.16" fill="currentColor" opacity="0.63"/>
    <circle cx="10.11" cy="17.89" r="0.16" fill="currentColor" opacity="0.74"/>
    <circle cx="10.16" cy="10.11" r="0.18" fill="currentColor" opacity="0.93"/>
    <circle cx="23.89" cy="15.11" r="0.14" fill="currentColor" opacity="0.56"/>
    <circle cx="17.68" cy="14.28" r="0.26" fill="currentColor" opacity="0.81"/>
    <circle cx="12.19" cy="25.78" r="0.14" fill="currentColor" opacity="0.61"/>
    <circle cx="14.22" cy="16.52" r="0.28" fill="currentColor" opacity="0.66"/>
    <circle cx="17.62" cy="17.98" r="0.24" fill="currentColor" opacity="0.75"/>
    <circle cx="9.46" cy="9.04" r="0.28" fill="currentColor" opacity="0.98"/>
    <circle cx="13.89" cy="11.17" r="0.20" fill="currentColor" opacity="0.63"/>
    <circle cx="24.09" cy="16.55" r="0.26" fill="currentColor" opacity="0.63"/>
    <circle cx="15.03" cy="22.87" r="0.26" fill="currentColor" opacity="0.78"/>
    <circle cx="8.28" cy="9.24" r="0.20" fill="currentColor" opacity="0.91"/>
    <circle cx="18.9" cy="14.06" r="0.30" fill="currentColor" opacity="0.88"/>
    <circle cx="21.44" cy="21.79" r="0.24" fill="currentColor" opacity="0.96"/>
    <circle cx="9.64" cy="22.22" r="0.28" fill="currentColor" opacity="0.91"/>
    <circle cx="23.55" cy="13.24" r="0.24" fill="currentColor" opacity="0.64"/>
    <circle cx="14.13" cy="5.49" r="0.24" fill="currentColor" opacity="0.87"/>
    <circle cx="18.56" cy="26.9" r="0.32" fill="currentColor" opacity="0.99"/>
    <circle cx="5.79" cy="13.59" r="0.18" fill="currentColor" opacity="0.96"/>
    <circle cx="20.3" cy="10.52" r="0.14" fill="currentColor" opacity="0.75"/>
    <circle cx="6.17" cy="12.79" r="0.20" fill="currentColor" opacity="0.56"/>
    <circle cx="17.08" cy="13.22" r="0.28" fill="currentColor" opacity="0.63"/>
    <circle cx="10.67" cy="25.02" r="0.16" fill="currentColor" opacity="0.62"/>
    <circle cx="6.02" cy="14.96" r="0.28" fill="currentColor" opacity="0.86"/>
    <circle cx="23.81" cy="13.23" r="0.30" fill="currentColor" opacity="0.59"/>
    <circle cx="17.53" cy="24.43" r="0.18" fill="currentColor" opacity="0.88"/>
    <circle cx="10.52" cy="9.46" r="0.28" fill="currentColor" opacity="0.8"/>
    <circle cx="13.25" cy="22.75" r="0.28" fill="currentColor" opacity="0.96"/>
    <circle cx="18.82" cy="26.51" r="0.30" fill="currentColor" opacity="0.79"/>
    <circle cx="11.26" cy="13.66" r="0.22" fill="currentColor" opacity="0.78"/>
    <circle cx="14.45" cy="14.79" r="0.30" fill="currentColor" opacity="0.78"/>
    <circle cx="7.43" cy="22.18" r="0.22" fill="currentColor" opacity="0.77"/>
    <circle cx="14.9" cy="13.18" r="0.22" fill="currentColor" opacity="0.74"/>
    <circle cx="26.93" cy="12.96" r="0.16" fill="currentColor" opacity="0.76"/>
    <circle cx="21.43" cy="21.56" r="0.28" fill="currentColor" opacity="0.96"/>
    <circle cx="9.43" cy="16.98" r="0.16" fill="currentColor" opacity="0.83"/>
    <circle cx="19.79" cy="14.08" r="0.28" fill="currentColor" opacity="0.56"/>
    <circle cx="17.94" cy="21.28" r="0.24" fill="currentColor" opacity="0.69"/>
    <circle cx="10.29" cy="23.33" r="0.14" fill="currentColor" opacity="0.88"/>
    <circle cx="22.04" cy="21.88" r="0.16" fill="currentColor" opacity="0.64"/>
    <circle cx="8.34" cy="14.52" r="0.18" fill="currentColor" opacity="0.74"/>
    <circle cx="11.36" cy="15.14" r="0.16" fill="currentColor" opacity="0.83"/>
    <circle cx="10.46" cy="9.44" r="0.28" fill="currentColor" opacity="0.83"/>
    <circle cx="19.54" cy="11.54" r="0.26" fill="currentColor" opacity="0.91"/>
    <circle cx="21.43" cy="12.19" r="0.18" fill="currentColor" opacity="0.97"/>
    <circle cx="18.34" cy="27.55" r="0.28" fill="currentColor" opacity="0.61"/>
    <circle cx="16.67" cy="26.04" r="0.16" fill="currentColor" opacity="0.59"/>
    <circle cx="19.78" cy="9.34" r="0.26" fill="currentColor" opacity="0.61"/>
    <circle cx="8.0" cy="21.6" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="11.36" cy="5.74" r="0.30" fill="currentColor" opacity="0.6"/>
    <circle cx="5.73" cy="15.63" r="0.20" fill="currentColor" opacity="0.86"/>
    <circle cx="17.17" cy="18.91" r="0.14" fill="currentColor" opacity="0.57"/>
    <circle cx="7.98" cy="13.3" r="0.22" fill="currentColor" opacity="0.62"/>
    <circle cx="18.13" cy="20.88" r="0.28" fill="currentColor" opacity="1.0"/>
    <circle cx="19.26" cy="14.39" r="0.14" fill="currentColor" opacity="0.98"/>
    <circle cx="5.97" cy="18.44" r="0.18" fill="currentColor" opacity="0.76"/>
    <circle cx="8.3" cy="15.26" r="0.24" fill="currentColor" opacity="0.56"/>
    <circle cx="12.72" cy="5.67" r="0.16" fill="currentColor" opacity="0.75"/>
    <circle cx="15.5" cy="8.5" r="0.16" fill="currentColor" opacity="0.62"/>
    <circle cx="14.54" cy="15.88" r="0.28" fill="currentColor" opacity="0.91"/>
    <circle cx="12.92" cy="5.49" r="0.24" fill="currentColor" opacity="0.73"/>
    <circle cx="9.21" cy="11.09" r="0.30" fill="currentColor" opacity="0.91"/>
    <circle cx="15.42" cy="27.25" r="0.26" fill="currentColor" opacity="0.9"/>
    <circle cx="18.97" cy="9.1" r="0.28" fill="currentColor" opacity="0.95"/>
    <circle cx="12.49" cy="6.28" r="0.26" fill="currentColor" opacity="0.73"/>
    <circle cx="15.46" cy="12.91" r="0.18" fill="currentColor" opacity="0.76"/>
    <circle cx="23.02" cy="16.47" r="0.24" fill="currentColor" opacity="0.83"/>
    <circle cx="17.29" cy="27.4" r="0.24" fill="currentColor" opacity="0.7"/>
    <circle cx="11.22" cy="8.49" r="0.22" fill="currentColor" opacity="0.73"/>
    <circle cx="25.46" cy="15.99" r="0.26" fill="currentColor" opacity="0.89"/>
    <circle cx="17.77" cy="15.78" r="0.24" fill="currentColor" opacity="0.88"/>
    <circle cx="15.69" cy="23.47" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="13.37" cy="18.61" r="0.16" fill="currentColor" opacity="0.96"/>
    <circle cx="8.0" cy="13.4" r="0.30" fill="currentColor" opacity="0.81"/>
    <circle cx="25.42" cy="15.71" r="0.28" fill="currentColor" opacity="0.58"/>
    <circle cx="7.59" cy="10.09" r="0.14" fill="currentColor" opacity="0.97"/>
    <circle cx="20.35" cy="22.84" r="0.16" fill="currentColor" opacity="0.77"/>
    <circle cx="13.81" cy="14.16" r="0.30" fill="currentColor" opacity="0.74"/>
    <circle cx="7.0" cy="14.47" r="0.18" fill="currentColor" opacity="0.68"/>
    <circle cx="11.04" cy="8.69" r="0.16" fill="currentColor" opacity="0.87"/>
    <circle cx="15.6" cy="17.34" r="0.16" fill="currentColor" opacity="0.57"/>
    <circle cx="21.68" cy="24.54" r="0.18" fill="currentColor" opacity="0.95"/>
    <circle cx="26.32" cy="16.26" r="0.20" fill="currentColor" opacity="0.93"/>
    <circle cx="28.36" cy="16.58" r="0.16" fill="currentColor" opacity="0.71"/>
    <circle cx="26.51" cy="18.43" r="0.16" fill="currentColor" opacity="0.92"/>
    <circle cx="26.85" cy="19.25" r="0.20" fill="currentColor" opacity="0.87"/>
    <circle cx="25.77" cy="19.78" r="0.18" fill="currentColor" opacity="0.71"/>
    <circle cx="25.43" cy="20.2" r="0.16" fill="currentColor" opacity="0.56"/>
    <circle cx="26.17" cy="22.0" r="0.16" fill="currentColor" opacity="0.62"/>
    <circle cx="25.01" cy="22.66" r="0.18" fill="currentColor" opacity="0.74"/>
    <circle cx="24.98" cy="24.67" r="0.18" fill="currentColor" opacity="0.61"/>
    <circle cx="24.87" cy="24.59" r="0.18" fill="currentColor" opacity="0.78"/>
    <circle cx="22.88" cy="24.39" r="0.18" fill="currentColor" opacity="0.75"/>
    <circle cx="22.37" cy="25.84" r="0.18" fill="currentColor" opacity="0.59"/>
    <circle cx="22.22" cy="26.9" r="0.20" fill="currentColor" opacity="0.9"/>
    <circle cx="20.5" cy="25.32" r="0.14" fill="currentColor" opacity="0.69"/>
    <circle cx="19.11" cy="25.97" r="0.16" fill="currentColor" opacity="0.53"/>
    <circle cx="19.11" cy="27.41" r="0.16" fill="currentColor" opacity="0.78"/>
    <circle cx="17.67" cy="27.23" r="0.14" fill="currentColor" opacity="0.65"/>
    <circle cx="16.25" cy="28.21" r="0.14" fill="currentColor" opacity="0.55"/>
    <circle cx="15.11" cy="27.66" r="0.18" fill="currentColor" opacity="0.6"/>
    <circle cx="14.63" cy="26.73" r="0.18" fill="currentColor" opacity="0.67"/>
    <circle cx="13.01" cy="28.21" r="0.16" fill="currentColor" opacity="0.75"/>
    <circle cx="11.88" cy="27.7" r="0.16" fill="currentColor" opacity="0.67"/>
    <circle cx="11.63" cy="27.5" r="0.14" fill="currentColor" opacity="0.54"/>
    <circle cx="10.55" cy="25.97" r="0.18" fill="currentColor" opacity="0.63"/>
    <circle cx="10.04" cy="24.5" r="0.14" fill="currentColor" opacity="0.8"/>
    <circle cx="9.55" cy="24.82" r="0.18" fill="currentColor" opacity="0.81"/>
    <circle cx="8.88" cy="23.78" r="0.16" fill="currentColor" opacity="0.83"/>
    <circle cx="8.2" cy="23.0" r="0.18" fill="currentColor" opacity="0.76"/>
    <circle cx="5.63" cy="22.89" r="0.20" fill="currentColor" opacity="0.7"/>
    <circle cx="6.45" cy="21.32" r="0.14" fill="currentColor" opacity="0.68"/>
    <circle cx="4.65" cy="20.87" r="0.14" fill="currentColor" opacity="0.66"/>
    <circle cx="5.69" cy="20.03" r="0.16" fill="currentColor" opacity="0.67"/>
    <circle cx="4.96" cy="19.41" r="0.18" fill="currentColor" opacity="0.74"/>
    <circle cx="4.57" cy="17.68" r="0.14" fill="currentColor" opacity="0.84"/>
    <circle cx="5.14" cy="16.56" r="0.14" fill="currentColor" opacity="0.73"/>
    <circle cx="4.44" cy="15.95" r="0.20" fill="currentColor" opacity="0.79"/>
    <circle cx="5.72" cy="14.76" r="0.16" fill="currentColor" opacity="0.85"/>
    <circle cx="5.7" cy="14.57" r="0.18" fill="currentColor" opacity="0.9"/>
    <circle cx="4.58" cy="13.35" r="0.14" fill="currentColor" opacity="0.84"/>
    <circle cx="5.96" cy="12.06" r="0.14" fill="currentColor" opacity="0.84"/>
    <circle cx="5.17" cy="10.75" r="0.16" fill="currentColor" opacity="0.65"/>
    <circle cx="6.15" cy="9.47" r="0.16" fill="currentColor" opacity="0.74"/>
    <circle cx="6.53" cy="8.79" r="0.20" fill="currentColor" opacity="0.68"/>
    <circle cx="7.37" cy="7.95" r="0.18" fill="currentColor" opacity="0.86"/>
    <circle cx="7.78" cy="6.81" r="0.20" fill="currentColor" opacity="0.79"/>
    <circle cx="8.6" cy="6.68" r="0.18" fill="currentColor" opacity="0.69"/>
    <circle cx="10.12" cy="7.24" r="0.18" fill="currentColor" opacity="0.95"/>
    <circle cx="10.86" cy="6.73" r="0.14" fill="currentColor" opacity="0.69"/>
    <circle cx="10.84" cy="4.59" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="11.94" cy="4.97" r="0.18" fill="currentColor" opacity="0.58"/>
    <circle cx="13.01" cy="5.1" r="0.16" fill="currentColor" opacity="0.91"/>
    <circle cx="14.12" cy="5.71" r="0.14" fill="currentColor" opacity="0.6"/>
    <circle cx="15.15" cy="4.11" r="0.16" fill="currentColor" opacity="0.6"/>
    <circle cx="16.15" cy="5.13" r="0.14" fill="currentColor" opacity="0.84"/>
    <circle cx="17.33" cy="4.56" r="0.18" fill="currentColor" opacity="0.72"/>
    <circle cx="18.45" cy="3.92" r="0.20" fill="currentColor" opacity="0.65"/>
    <circle cx="19.92" cy="4.13" r="0.16" fill="currentColor" opacity="0.6"/>
    <circle cx="20.38" cy="4.32" r="0.18" fill="currentColor" opacity="0.67"/>
    <circle cx="21.45" cy="5.94" r="0.14" fill="currentColor" opacity="0.95"/>
    <circle cx="22.07" cy="7.11" r="0.14" fill="currentColor" opacity="0.71"/>
    <circle cx="23.43" cy="6.43" r="0.18" fill="currentColor" opacity="0.77"/>
    <circle cx="23.04" cy="8.11" r="0.16" fill="currentColor" opacity="0.62"/>
    <circle cx="24.89" cy="8.8" r="0.18" fill="currentColor" opacity="0.95"/>
    <circle cx="25.13" cy="9.04" r="0.14" fill="currentColor" opacity="0.85"/>
    <circle cx="26.12" cy="9.24" r="0.18" fill="currentColor" opacity="0.87"/>
    <circle cx="25.57" cy="10.89" r="0.18" fill="currentColor" opacity="0.54"/>
    <circle cx="26.59" cy="12.0" r="0.20" fill="currentColor" opacity="0.76"/>
    <circle cx="26.63" cy="13.47" r="0.18" fill="currentColor" opacity="0.69"/>
    <circle cx="26.32" cy="14.57" r="0.18" fill="currentColor" opacity="0.59"/>
    <circle cx="27.42" cy="15.02" r="0.14" fill="currentColor" opacity="0.87"/>
    <circle cx="10.86" cy="28.67" r="0.12" fill="currentColor" opacity="0.5"/>
    <circle cx="1.51" cy="19.03" r="0.14" fill="currentColor" opacity="0.65"/>
    <circle cx="26.95" cy="24.57" r="0.14" fill="currentColor" opacity="0.77"/>
    <circle cx="23.03" cy="3.17" r="0.12" fill="currentColor" opacity="0.53"/>
    <circle cx="12.65" cy="2.96" r="0.14" fill="currentColor" opacity="0.56"/>
    <circle cx="31.54" cy="17.02" r="0.16" fill="currentColor" opacity="0.46"/>
    <circle cx="5.85" cy="6.93" r="0.14" fill="currentColor" opacity="0.6"/>
    <circle cx="11.9" cy="29.12" r="0.14" fill="currentColor" opacity="0.65"/>
    <circle cx="15.46" cy="29.35" r="0.16" fill="currentColor" opacity="0.51"/>
    <circle cx="29.53" cy="11.13" r="0.16" fill="currentColor" opacity="0.51"/>
    <circle cx="22.07" cy="4.44" r="0.12" fill="currentColor" opacity="0.42"/>
    <circle cx="9.51" cy="2.72" r="0.12" fill="currentColor" opacity="0.54"/>
    <circle cx="23.51" cy="3.64" r="0.12" fill="currentColor" opacity="0.47"/>
    <circle cx="23.25" cy="26.97" r="0.14" fill="currentColor" opacity="0.41"/>
    <circle cx="28.29" cy="9.31" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="17.6" cy="0.99" r="0.14" fill="currentColor" opacity="0.51"/>
    <circle cx="5.06" cy="22.74" r="0.14" fill="currentColor" opacity="0.66"/>
    <circle cx="30.91" cy="14.3" r="0.16" fill="currentColor" opacity="0.62"/>
    <circle cx="29.63" cy="17.6" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="26.88" cy="24.58" r="0.14" fill="currentColor" opacity="0.7"/>
    <circle cx="22.6" cy="3.08" r="0.12" fill="currentColor" opacity="0.69"/>
    <circle cx="27.75" cy="7.79" r="0.14" fill="currentColor" opacity="0.58"/>
    <circle cx="25.31" cy="27.51" r="0.18" fill="currentColor" opacity="0.59"/>
    <circle cx="12.73" cy="1.22" r="0.12" fill="currentColor" opacity="0.76"/>
    <circle cx="6.68" cy="6.43" r="0.12" fill="currentColor" opacity="0.48"/>
    <circle cx="2.92" cy="9.18" r="0.14" fill="currentColor" opacity="0.75"/>
    <circle cx="6.93" cy="26.79" r="0.12" fill="currentColor" opacity="0.77"/>
    <circle cx="26.1" cy="27.54" r="0.14" fill="currentColor" opacity="0.6"/>
    <circle cx="3.42" cy="10.99" r="0.18" fill="currentColor" opacity="0.78"/>
    <circle cx="21.96" cy="2.8" r="0.12" fill="currentColor" opacity="0.71"/>
    <circle cx="12.32" cy="30.86" r="0.12" fill="currentColor" opacity="0.61"/>
    <circle cx="22.47" cy="4.36" r="0.14" fill="currentColor" opacity="0.41"/>
    <circle cx="29.04" cy="18.66" r="0.18" fill="currentColor" opacity="0.76"/>
    <circle cx="8.56" cy="4.54" r="0.16" fill="currentColor" opacity="0.68"/>
    <circle cx="5.36" cy="25.79" r="0.16" fill="currentColor" opacity="0.39"/>
    <circle cx="20.4" cy="29.41" r="0.12" fill="currentColor" opacity="0.53"/>
    <circle cx="3.96" cy="10.38" r="0.14" fill="currentColor" opacity="0.49"/>
    <circle cx="3.51" cy="10.31" r="0.16" fill="currentColor" opacity="0.4"/>
    <circle cx="9.71" cy="4.39" r="0.18" fill="currentColor" opacity="0.62"/>
    <circle cx="2.3" cy="18.62" r="0.14" fill="currentColor" opacity="0.66"/>
    <circle cx="16.75" cy="1.11" r="0.14" fill="currentColor" opacity="0.78"/>
    <circle cx="24.0" cy="3.08" r="0.14" fill="currentColor" opacity="0.55"/>
    <circle cx="1.96" cy="9.82" r="0.14" fill="currentColor" opacity="0.59"/>
    <circle cx="2.04" cy="22.33" r="0.12" fill="currentColor" opacity="0.4"/>
    <circle cx="13.66" cy="0.86" r="0.16" fill="currentColor" opacity="0.62"/>
    {/* Extra dots — strato aggiuntivo denso */}
    <circle cx="9.0" cy="16.0" r="0.15" fill="currentColor" opacity="0.72"/>
    <circle cx="11.5" cy="19.5" r="0.13" fill="currentColor" opacity="0.65"/>
    <circle cx="14.0" cy="20.0" r="0.17" fill="currentColor" opacity="0.8"/>
    <circle cx="19.0" cy="18.0" r="0.14" fill="currentColor" opacity="0.7"/>
    <circle cx="22.0" cy="15.0" r="0.16" fill="currentColor" opacity="0.6"/>
    <circle cx="18.0" cy="12.0" r="0.13" fill="currentColor" opacity="0.75"/>
    <circle cx="12.0" cy="12.0" r="0.15" fill="currentColor" opacity="0.82"/>
    <circle cx="16.0" cy="14.0" r="0.12" fill="currentColor" opacity="0.9"/>
    <circle cx="20.0" cy="16.0" r="0.14" fill="currentColor" opacity="0.68"/>
    <circle cx="10.0" cy="14.0" r="0.16" fill="currentColor" opacity="0.77"/>
    <circle cx="23.0" cy="18.0" r="0.13" fill="currentColor" opacity="0.63"/>
    <circle cx="15.0" cy="18.0" r="0.15" fill="currentColor" opacity="0.85"/>
    <circle cx="9.5" cy="12.5" r="0.12" fill="currentColor" opacity="0.7"/>
    <circle cx="19.5" cy="22.5" r="0.14" fill="currentColor" opacity="0.6"/>
    <circle cx="13.5" cy="10.0" r="0.16" fill="currentColor" opacity="0.73"/>
    <circle cx="22.5" cy="9.0" r="0.13" fill="currentColor" opacity="0.8"/>
    <circle cx="7.5" cy="17.5" r="0.15" fill="currentColor" opacity="0.65"/>
    <circle cx="24.5" cy="12.0" r="0.14" fill="currentColor" opacity="0.72"/>
    <circle cx="11.0" cy="22.5" r="0.16" fill="currentColor" opacity="0.58"/>
    <circle cx="20.5" cy="7.5" r="0.13" fill="currentColor" opacity="0.67"/>
    <circle cx="16.5" cy="25.0" r="0.15" fill="currentColor" opacity="0.76"/>
    <circle cx="8.5" cy="10.5" r="0.14" fill="currentColor" opacity="0.89"/>
    <circle cx="25.0" cy="16.5" r="0.12" fill="currentColor" opacity="0.61"/>
    <circle cx="14.5" cy="8.0" r="0.16" fill="currentColor" opacity="0.74"/>
    <circle cx="21.0" cy="25.5" r="0.13" fill="currentColor" opacity="0.55"/>
    <circle cx="6.5" cy="13.0" r="0.15" fill="currentColor" opacity="0.79"/>
    <circle cx="26.0" cy="20.0" r="0.14" fill="currentColor" opacity="0.64"/>
    <circle cx="12.5" cy="24.0" r="0.16" fill="currentColor" opacity="0.71"/>
    <circle cx="18.5" cy="7.0" r="0.13" fill="currentColor" opacity="0.83"/>
    <circle cx="9.0" cy="20.5" r="0.15" fill="currentColor" opacity="0.68"/>
    <circle cx="23.5" cy="22.0" r="0.14" fill="currentColor" opacity="0.57"/>
    <circle cx="15.5" cy="11.0" r="0.12" fill="currentColor" opacity="0.91"/>
    <circle cx="20.0" cy="11.0" r="0.16" fill="currentColor" opacity="0.66"/>
    <circle cx="7.0" cy="16.5" r="0.13" fill="currentColor" opacity="0.78"/>
    <circle cx="24.0" cy="23.5" r="0.15" fill="currentColor" opacity="0.53"/>
    <circle cx="13.0" cy="7.0" r="0.14" fill="currentColor" opacity="0.86"/>
    <circle cx="22.0" cy="6.0" r="0.16" fill="currentColor" opacity="0.69"/>
    <circle cx="10.0" cy="26.5" r="0.13" fill="currentColor" opacity="0.62"/>
    <circle cx="19.0" cy="29.0" r="0.15" fill="currentColor" opacity="0.48"/>
    <circle cx="6.0" cy="23.5" r="0.14" fill="currentColor" opacity="0.73"/>
    <circle cx="27.0" cy="11.0" r="0.16" fill="currentColor" opacity="0.59"/>
    <circle cx="14.0" cy="28.5" r="0.13" fill="currentColor" opacity="0.55"/>
    <circle cx="21.0" cy="3.5" r="0.15" fill="currentColor" opacity="0.7"/>
    <circle cx="8.0" cy="7.0" r="0.14" fill="currentColor" opacity="0.82"/>
    <circle cx="25.5" cy="8.0" r="0.16" fill="currentColor" opacity="0.65"/>
    <circle cx="11.5" cy="3.5" r="0.13" fill="currentColor" opacity="0.77"/>
    <circle cx="17.0" cy="3.0" r="0.15" fill="currentColor" opacity="0.68"/>
    <circle cx="28.0" cy="14.0" r="0.14" fill="currentColor" opacity="0.56"/>
    <circle cx="3.0" cy="15.0" r="0.16" fill="currentColor" opacity="0.71"/>
    <circle cx="29.0" cy="20.0" r="0.13" fill="currentColor" opacity="0.49"/>
    <circle cx="4.0" cy="12.0" r="0.15" fill="currentColor" opacity="0.74"/>
    <circle cx="28.5" cy="22.0" r="0.14" fill="currentColor" opacity="0.43"/>
    <circle cx="2.5" cy="14.0" r="0.16" fill="currentColor" opacity="0.67"/>
    <circle cx="30.0" cy="16.0" r="0.13" fill="currentColor" opacity="0.52"/>
    <circle cx="1.5" cy="16.0" r="0.15" fill="currentColor" opacity="0.6"/>
    <circle cx="16.0" cy="30.5" r="0.14" fill="currentColor" opacity="0.44"/>
    <circle cx="16.0" cy="1.5" r="0.16" fill="currentColor" opacity="0.7"/>
    <circle cx="9.3" cy="18.2" r="0.13" fill="currentColor" opacity="0.69"/>
    <circle cx="14.8" cy="16.8" r="0.15" fill="currentColor" opacity="0.77"/>
    <circle cx="18.6" cy="15.5" r="0.12" fill="currentColor" opacity="0.85"/>
    <circle cx="11.8" cy="16.3" r="0.14" fill="currentColor" opacity="0.71"/>
    <circle cx="20.8" cy="13.5" r="0.16" fill="currentColor" opacity="0.63"/>
    <circle cx="13.6" cy="19.3" r="0.13" fill="currentColor" opacity="0.79"/>
    <circle cx="17.0" cy="20.0" r="0.15" fill="currentColor" opacity="0.67"/>
    <circle cx="10.4" cy="12.8" r="0.14" fill="currentColor" opacity="0.86"/>
    <circle cx="22.5" cy="17.5" r="0.16" fill="currentColor" opacity="0.58"/>
    <circle cx="15.8" cy="13.5" r="0.13" fill="currentColor" opacity="0.92"/>
    <circle cx="19.3" cy="20.5" r="0.15" fill="currentColor" opacity="0.64"/>
    <circle cx="12.8" cy="18.2" r="0.14" fill="currentColor" opacity="0.75"/>
    <circle cx="21.2" cy="14.8" r="0.16" fill="currentColor" opacity="0.7"/>
    <circle cx="8.6" cy="18.8" r="0.13" fill="currentColor" opacity="0.8"/>
    <circle cx="16.4" cy="22.0" r="0.15" fill="currentColor" opacity="0.6"/>
    <circle cx="11.2" cy="11.5" r="0.14" fill="currentColor" opacity="0.88"/>
    <circle cx="24.2" cy="17.0" r="0.16" fill="currentColor" opacity="0.53"/>
    <circle cx="14.6" cy="23.5" r="0.13" fill="currentColor" opacity="0.72"/>
    <circle cx="20.6" cy="8.0" r="0.15" fill="currentColor" opacity="0.78"/>
    <circle cx="7.8" cy="11.5" r="0.14" fill="currentColor" opacity="0.83"/>
    <circle cx="23.8" cy="10.5" r="0.16" fill="currentColor" opacity="0.61"/>
    <circle cx="12.4" cy="26.5" r="0.13" fill="currentColor" opacity="0.57"/>
    <circle cx="18.8" cy="24.0" r="0.15" fill="currentColor" opacity="0.69"/>
    <circle cx="9.8" cy="8.0" r="0.14" fill="currentColor" opacity="0.9"/>
    <circle cx="22.2" cy="23.0" r="0.16" fill="currentColor" opacity="0.54"/>
    <circle cx="15.2" cy="10.5" r="0.13" fill="currentColor" opacity="0.84"/>
    <circle cx="17.8" cy="9.5" r="0.15" fill="currentColor" opacity="0.76"/>
    <circle cx="10.6" cy="20.0" r="0.14" fill="currentColor" opacity="0.67"/>
    <circle cx="20.2" cy="21.0" r="0.16" fill="currentColor" opacity="0.59"/>
    <circle cx="13.2" cy="13.0" r="0.13" fill="currentColor" opacity="0.87"/>
    <circle cx="21.8" cy="16.5" r="0.15" fill="currentColor" opacity="0.65"/>
    <circle cx="8.4" cy="15.0" r="0.14" fill="currentColor" opacity="0.81"/>
    <circle cx="24.6" cy="14.5" r="0.16" fill="currentColor" opacity="0.56"/>
    <circle cx="16.8" cy="24.5" r="0.13" fill="currentColor" opacity="0.63"/>
    <circle cx="19.6" cy="6.5" r="0.15" fill="currentColor" opacity="0.79"/>
    <circle cx="7.2" cy="19.5" r="0.14" fill="currentColor" opacity="0.73"/>
    <circle cx="25.8" cy="21.0" r="0.16" fill="currentColor" opacity="0.48"/>
    <circle cx="11.6" cy="7.5" r="0.13" fill="currentColor" opacity="0.85"/>
    <circle cx="23.4" cy="25.0" r="0.15" fill="currentColor" opacity="0.52"/>
    <circle cx="6.8" cy="9.0" r="0.14" fill="currentColor" opacity="0.76"/>
    <circle cx="27.6" cy="13.0" r="0.16" fill="currentColor" opacity="0.61"/>
    <circle cx="14.4" cy="27.5" r="0.13" fill="currentColor" opacity="0.58"/>
    <circle cx="21.4" cy="27.5" r="0.15" fill="currentColor" opacity="0.45"/>
    <circle cx="5.4" cy="17.0" r="0.14" fill="currentColor" opacity="0.78"/>
    <circle cx="26.8" cy="16.0" r="0.16" fill="currentColor" opacity="0.55"/>
    <circle cx="12.0" cy="29.5" r="0.13" fill="currentColor" opacity="0.5"/>
    <circle cx="18.4" cy="28.5" r="0.15" fill="currentColor" opacity="0.46"/>
    <circle cx="4.2" cy="21.5" r="0.14" fill="currentColor" opacity="0.69"/>
    <circle cx="28.8" cy="12.0" r="0.16" fill="currentColor" opacity="0.57"/>
    <circle cx="10.8" cy="6.0" r="0.13" fill="currentColor" opacity="0.81"/>
    <circle cx="24.4" cy="5.5" r="0.15" fill="currentColor" opacity="0.64"/>
    <circle cx="6.2" cy="24.5" r="0.14" fill="currentColor" opacity="0.7"/>
    <circle cx="27.2" cy="22.5" r="0.16" fill="currentColor" opacity="0.47"/>
    <circle cx="13.8" cy="3.5" r="0.13" fill="currentColor" opacity="0.74"/>
    <circle cx="20.0" cy="3.0" r="0.15" fill="currentColor" opacity="0.68"/>
    <circle cx="4.8" cy="11.5" r="0.14" fill="currentColor" opacity="0.77"/>
    <circle cx="29.5" cy="15.0" r="0.16" fill="currentColor" opacity="0.44"/>
    <circle cx="8.2" cy="26.0" r="0.13" fill="currentColor" opacity="0.6"/>
    <circle cx="25.6" cy="6.5" r="0.15" fill="currentColor" opacity="0.66"/>
    <circle cx="3.6" cy="18.0" r="0.14" fill="currentColor" opacity="0.71"/>
    <circle cx="28.4" cy="19.5" r="0.16" fill="currentColor" opacity="0.42"/>
    <circle cx="11.4" cy="30.0" r="0.13" fill="currentColor" opacity="0.47"/>
    <circle cx="19.4" cy="30.5" r="0.15" fill="currentColor" opacity="0.41"/>
    <circle cx="2.0" cy="13.0" r="0.14" fill="currentColor" opacity="0.65"/>
    <circle cx="30.5" cy="18.0" r="0.16" fill="currentColor" opacity="0.38"/>
    <circle cx="15.0" cy="31.0" r="0.13" fill="currentColor" opacity="0.43"/>
    <circle cx="17.5" cy="1.5" r="0.15" fill="currentColor" opacity="0.73"/>
  </svg>
);

/* ============= TAB BAR (floating pill — xautrader style) ============= */
const TAB_ORDER=['overview','movimenti','ai','spese','analytics'];
const TAB_DEFS=[
  {id:'overview',  label:'Home',      gradient:(C)=>C.green, iconColor:(C)=>C.yellow},
  {id:'movimenti', label:'Storico',   gradient:()=>`linear-gradient(160deg, #72E4F8, #3DB8D4)`},
  {id:'ai',        label:'AI',        gradient:null},
  {id:'spese',     label:'Spese',     gradient:(C)=>`linear-gradient(135deg, ${C.red}, #b3001a)`},
  {id:'analytics', label:'Analisi',   gradient:(C)=>`linear-gradient(135deg, ${C.purple}, #5500cc)`},
];
const TAB_ICONS={overview:RvIconOverview,spese:RvIconSpese,movimenti:RvIconMovimenti,analytics:RvIconAnalytics};

function TabBar({C,tabIdx,onTabTap,scheme}) {
  return (
    <div style={{pointerEvents:'auto'}}>
      <div style={{
        background:C.glassBar,
        backdropFilter:'saturate(200%) blur(52px)',
        WebkitBackdropFilter:'saturate(200%) blur(52px)',
        border:`0.5px solid ${C.sep2}`,
        borderRadius:36,
        padding:'4px 16px',
        display:'flex',
        alignItems:'center',
        gap:12,
        boxShadow:scheme==='dark'
          ?'0 14px 44px rgba(0,0,0,0.70), 0 0 0 0.5px rgba(255,255,255,0.05) inset'
          :'0 14px 44px rgba(0,0,0,0.20), 0 0 0 0.5px rgba(255,255,255,0.55) inset',
      }}>
        {TAB_DEFS.map((t,i)=>{
          const active=tabIdx===i;
          const isAI=t.id==='ai';
          const Icon=TAB_ICONS[t.id];
          const grad=t.gradient?t.gradient(C):null;
          return (
            <button key={t.id} onClick={()=>onTabTap(i)}
              className="rv-btn rv-tab-btn"
              style={{
                padding:'7px 14px',
                borderRadius:30,
                background:(!isAI&&active)?(scheme==='dark'?'rgba(255,255,255,0.09)':'rgba(0,0,0,0.06)'):'transparent',
                border:'none',cursor:'pointer',
              }}>
              <div className="rv-tab-icon">
                {isAI?(
                  <div className={`rv-orb-animated`} style={{
                    width:40,height:40,borderRadius:'50%',
                    background:scheme==='dark'
                      ?'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)'
                      :'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04) 0%, transparent 70%)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transform:active?'scale(1.04)':'scale(1)',
                    transition:'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                    flexShrink:0,
                    filter:scheme==='dark'?'none':'contrast(1.7) brightness(0.4)',
                  }}>
                    <RvIconAI size={38} color={scheme==='dark'?'#FFFFFF':'#000000'}/>
                  </div>
                ):(
                  <RvAppIcon gradient={grad} active={active} size={32}>
                    <Icon color={t.iconColor ? t.iconColor(C) : '#000000'}/>
                  </RvAppIcon>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============= MAIN ============= */

/* ============= SETTINGS MODAL ============= */
const BANK_COLORS = ['#39FF14','#7DF9FF','#C77DFF','#FF073A','#FFB627','#FF457A','#00FFD4'];

function SettingsModal({C,open,onClose,schemeOverride,setSchemeOverride,accounts,setAccounts,activeAccountId,setActiveAccountId,onLoadForAccount}) {
  const [editingId,setEditingId]=useState(null);
  const [newName,setNewName]=useState('');
  const [newColor,setNewColor]=useState(BANK_COLORS[0]);

  if(!open) return null;

  const addAccount=()=>{
    if(!newName.trim()) return;
    const id='acc_'+Date.now();
    setAccounts(prev=>[...prev,{id,name:newName.trim(),color:newColor,rawTxs:null}]);
    // Se non c'è un conto attivo valido (es. dopo aver eliminato l'ultimo), seleziona questo.
    if(!accounts.some(a=>a.id===activeAccountId)) setActiveAccountId(id);
    setNewName(''); setNewColor(BANK_COLORS[0]);
    haptic.success();
  };

  const removeAccount=(id)=>{
    const acc=accounts.find(a=>a.id===id);
    const n=acc?.rawTxs?.length||0;
    const msg = n>0
      ? `Eliminare il conto "${acc?.name}" e le sue ${n} transazioni? L'operazione non è reversibile.`
      : `Eliminare il conto "${acc?.name}"?`;
    if(typeof window!=='undefined' && !window.confirm(msg)) return;
    setAccounts(prev=>prev.filter(a=>a.id!==id));
    if(activeAccountId===id){
      const next=accounts.find(a=>a.id!==id);
      setActiveAccountId(next?next.id:null);
    }
    haptic.medium();
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(4px)'}}/>
      <div className="rv-card" style={{
        position:'relative',zIndex:1,
        background:C.glass,backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',
        borderRadius:'28px 28px 0 0',border:`0.5px solid ${C.sep2}`,
        maxHeight:'82vh',overflowY:'auto',paddingBottom:'env(safe-area-inset-bottom,0px)',
      }}>
        {/* Handle */}
        <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.glass3}}/>
        </div>
        <div style={{padding:'0 20px 24px',display:'flex',flexDirection:'column',gap:22}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:C.primary,fontSize:17,fontFamily:FONT.display,fontWeight:700,letterSpacing:'-0.3px'}}>Impostazioni</span>
            <button onClick={onClose} className="rv-btn" style={{width:30,height:30,borderRadius:15,background:C.glass2,border:`0.5px solid ${C.sep}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke={C.secondary} strokeWidth="2.5" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Appearance */}
          <div>
            <div style={{color:C.tertiary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Aspetto</div>
            <div style={{display:'flex',background:C.glass2,borderRadius:RADIUS.pill,padding:3,gap:2}}>
              {[{id:'auto',label:'Auto'},{id:'dark',label:'Scuro'},{id:'light',label:'Chiaro'}].map(o=>(
                <button key={o.id} onClick={()=>{setSchemeOverride(o.id);haptic.selection();}} className="rv-btn rv-seg-pill" style={{
                  flex:1,padding:'7px 12px',fontSize:12,fontFamily:FONT.text,fontWeight:600,
                  border:'none',cursor:'pointer',borderRadius:RADIUS.pill,
                  background:schemeOverride===o.id?C.primary:'transparent',
                  color:schemeOverride===o.id?C.bg:C.secondary,
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          {/* Conti */}
          <div>
            <div style={{color:C.tertiary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Conti Bancari</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {accounts.length===0&&(
                <div style={{padding:'12px 14px',background:C.glass2,border:`0.5px dashed ${C.sep2}`,borderRadius:RADIUS.inset,color:C.tertiary,fontSize:12,fontFamily:FONT.text,textAlign:'center'}}>
                  Nessun conto. Creane uno qui sotto.
                </div>
              )}
              {accounts.map(acc=>(
                <div key={acc.id}>
                  <div className="rv-row" style={{
                    display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                    background:activeAccountId===acc.id?`${acc.color}14`:C.glass2,
                    border:`0.5px solid ${activeAccountId===acc.id?acc.color+'50':C.sep}`,
                    borderRadius:RADIUS.inset,cursor:'pointer',
                  }} onClick={()=>{setActiveAccountId(acc.id);haptic.light();}}>
                    <div style={{width:10,height:10,borderRadius:5,background:acc.color,flexShrink:0,boxShadow:`0 0 8px ${acc.color}80`}}/>
                    <div style={{flex:1}}>
                      <div style={{color:C.primary,fontSize:13,fontFamily:FONT.text,fontWeight:600}}>{acc.name}</div>
                      <div style={{color:C.tertiary,fontSize:10,fontFamily:FONT.mono,marginTop:1}}>
                        {acc.rawTxs?`${acc.rawTxs.length} transazioni`:'Nessun dato'}
                      </div>
                    </div>
                    {activeAccountId===acc.id&&<div style={{width:7,height:7,borderRadius:4,background:acc.color,boxShadow:`0 0 6px ${acc.color}`}}/>}
                    <button onClick={e=>{e.stopPropagation();removeAccount(acc.id);}} className="rv-btn" style={{
                        width:24,height:24,borderRadius:12,background:`${C.red}20`,border:`0.5px solid ${C.red}40`,
                        cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aggiungi conto */}
          <div>
            <div style={{color:C.tertiary,fontSize:11,fontFamily:FONT.text,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Aggiungi Conto</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <input
                value={newName} onChange={e=>setNewName(e.target.value)}
                placeholder="Nome banca (es. Revolut, N26, Fineco...)"
                style={{
                  padding:'10px 14px',background:C.glass2,border:`0.5px solid ${C.sep2}`,
                  borderRadius:RADIUS.inset,color:C.primary,fontSize:13,fontFamily:FONT.text,
                  outline:'none',
                }}
              />
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {BANK_COLORS.map(col=>(
                  <div key={col} onClick={()=>{setNewColor(col);haptic.light();}} style={{
                    width:24,height:24,borderRadius:12,background:col,cursor:'pointer',
                    border:`2px solid ${newColor===col?col:'transparent'}`,
                    boxShadow:newColor===col?`0 0 10px ${col}80`:'none',
                    outline:newColor===col?`2px solid ${col}60`:'none',
                    outlineOffset:2,
                  }}/>
                ))}
              </div>
              <button onClick={addAccount} className="rv-btn" disabled={!newName.trim()} style={{
                padding:'10px',background:newName.trim()?C.primary:C.glass3,
                border:'none',borderRadius:RADIUS.pill,cursor:newName.trim()?'pointer':'default',
                color:newName.trim()?C.bg:C.tertiary,fontSize:13,fontFamily:FONT.text,fontWeight:600,
              }}>
                Aggiungi Conto
              </button>
            </div>
          </div>

          {/* Vista aggregata */}
          {accounts.length>1&&(
            <div style={{padding:'12px 14px',background:`${C.purple}14`,border:`0.5px solid ${C.purple}40`,borderRadius:RADIUS.inset}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <div style={{width:7,height:7,borderRadius:4,background:C.purple,boxShadow:`0 0 6px ${C.purple}`}}/>
                <span style={{color:C.purple,fontSize:12,fontFamily:FONT.text,fontWeight:700}}>Vista Aggregata</span>
              </div>
              <div style={{color:C.secondary,fontSize:11,fontFamily:FONT.text,lineHeight:1.4}}>
                Seleziona "Tutti i conti" dalla barra in alto per vedere il riepilogo combinato di tutte le banche.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============= ACCOUNT SELECTOR (header pill) ============= */
function AccountPill({C,accounts,activeAccountId,setActiveAccountId}) {
  const [open,setOpen]=useState(false);
  const [dropPos,setDropPos]=useState({top:60,right:12});
  const btnRef=useRef();
  const ALL_ID='__all__';
  const options=[
    ...(accounts.length>1?[{id:ALL_ID,name:'Tutti i conti',color:C.purple}]:[]),
    ...accounts,
  ];
  const current=options.find(a=>a.id===activeAccountId)||options[0];
  if(!current) return null;

  const handleOpen=()=>{
    if(btnRef.current){
      const r=btnRef.current.getBoundingClientRect();
      setDropPos({top:r.bottom+6, right:window.innerWidth-r.right});
    }
    setOpen(o=>!o);
    haptic.selection();
  };

  return (
    <div style={{position:'relative'}}>
      <button ref={btnRef} onClick={handleOpen} className="rv-btn" style={{
        display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
        background:C.glass2,border:`0.5px solid ${C.sep2}`,borderRadius:RADIUS.pill,
        cursor:'pointer',WebkitTapHighlightColor:'transparent',touchAction:'manipulation',
        userSelect:'none',WebkitUserSelect:'none',
      }}>
        <div style={{width:8,height:8,borderRadius:4,background:current.color,boxShadow:`0 0 6px ${current.color}80`}}/>
        <span style={{color:C.primary,fontSize:12,fontFamily:FONT.text,fontWeight:600,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{current.name}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d={open?"M18 15l-6-6-6 6":"M6 9l6 6 6-6"} stroke={C.tertiary} strokeWidth="2.5" strokeLinecap="round"/></svg>
      </button>
      {open&&createPortal(
        <>
          <div onClick={()=>setOpen(false)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:998}}/>
          <div className="rv-card" style={{
            position:'fixed',top:dropPos.top,right:dropPos.right,minWidth:190,zIndex:9999,
            background:C.glassBar,backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',
            border:`0.5px solid ${C.sep2}`,borderRadius:18,overflow:'hidden',
            boxShadow:'0 8px 32px rgba(0,0,0,0.55)',
          }}>
          {options.map((a,i)=>(
            <div key={a.id} className="rv-row" onClick={()=>{setActiveAccountId(a.id);setOpen(false);haptic.light();}} style={{
              display:'flex',alignItems:'center',gap:8,padding:'12px 16px',
              background:activeAccountId===a.id?`${a.color}18`:'transparent',
              borderBottom:i<options.length-1?`0.5px solid ${C.sep}`:'none',
              cursor:'pointer',
            }}>
              <div style={{width:8,height:8,borderRadius:4,background:a.color,boxShadow:`0 0 6px ${a.color}80`}}/>
              <span style={{color:C.primary,fontSize:13,fontFamily:FONT.text,fontWeight:activeAccountId===a.id?600:400}}>{a.name}</span>
              {activeAccountId===a.id&&<div style={{marginLeft:'auto',width:5,height:5,borderRadius:3,background:a.color}}/>}
            </div>
          ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/* ============= MAIN APP ============= */
export default function App() {
  useEffect(()=>{injectCSS();injectPressManager();injectPWAMeta();},[]);

  // ── Altezza reale ────────────────────────────────────────────────────────
  const getH = () => {
    const isStandalone =
      ('standalone' in navigator && navigator.standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return screen.height;
    // In-browser: usa il viewport VISIBILE (esclude la tastiera). Così alla
    // chiusura della tastiera l'altezza si ripristina e non resta l'area nera.
    return (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  };
  const [appHeight, setAppHeight] = useState(() => getH());
  useEffect(() => {
    const update = () => setAppHeight(getH());
    update();
    const t = setTimeout(update, 300);
    // Alla chiusura della tastiera iOS può lasciare lo scroll spostato e mostrare
    // il fondo nero della pagina: riporto lo scroll a 0 e rimisuro (più volte,
    // perché iOS ripristina il viewport con un piccolo ritardo).
    const restore = () => { try { window.scrollTo(0, 0); } catch(_){} update(); };
    const onFocusOut = () => { setTimeout(restore, 50); setTimeout(restore, 250); setTimeout(restore, 500); };
    window.addEventListener('pageshow', update);
    window.addEventListener('resize', update);
    window.addEventListener('focusout', onFocusOut);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);

  const sysScheme=useColorScheme();
  const [schemeOverride,setSchemeOverride]=usePersistedState('hb_scheme','auto');
  const scheme=schemeOverride==='auto'?sysScheme:schemeOverride;
  const C={...palette[scheme],scheme};

  const [settingsOpen,setSettingsOpen]=useState(false);
  const [inputFocused,setInputFocused]=useState(false);
  const [aiInput,setAiInput]=useState('');
  const aiInputRef=useRef(null);
  const aiSendRef=useRef(null); // AIPage will wire its sendInternal here
  const [aiLoading,setAiLoading]=useState(false); // mirrored for button state

  // Multi-account state
  const [accounts,setAccounts]=usePersistedState('hb_accounts',[
    {id:'main',name:'Revolut',color:'#7DF9FF',rawTxs:null},
  ]);
  const [activeAccountId,setActiveAccountId]=usePersistedState('hb_active','main');
  const ALL_ID='__all__';

  const onLoadForAccount=useCallback((id,txs)=>{
    setAccounts(prev=>prev.map(a=>a.id===id?{
      ...a,
      rawTxs:txs,
      summaryIncome: txs._summaryIncome ?? null,
      summaryExpense: txs._summaryExpense ?? null,
    }:a));
  },[setAccounts]);

  // Inserimento manuale: aggiunge una transazione al conto scelto.
  // Azzera gli eventuali totali "summary" cosi' i totali vengono ricalcolati dalla lista.
  const addTransaction=useCallback((accId,tx)=>{
    if(!accId||!tx) return;
    setAccounts(prev=>prev.map(a=>a.id===accId?{
      ...a,
      rawTxs:[...(a.rawTxs||[]),tx],
      summaryIncome:null, summaryExpense:null,
    }:a));
  },[setAccounts]);

  const deleteTransaction=useCallback((txId)=>{
    if(!txId) return;
    setAccounts(prev=>prev.map(a=>a.rawTxs?{
      ...a,
      rawTxs:a.rawTxs.filter(t=>t.id!==txId),
    }:a));
  },[setAccounts]);

  // Modifica in-place: rimuove la vecchia transazione (ovunque sia) e reinserisce
  // quella aggiornata (stesso id) nel conto scelto. Gestisce anche lo spostamento di conto.
  const updateTransaction=useCallback((txId,accId,tx)=>{
    if(!txId||!accId||!tx) return;
    setAccounts(prev=>{
      const cleaned=prev.map(a=>a.rawTxs?{...a,rawTxs:a.rawTxs.filter(t=>t.id!==txId)}:a);
      return cleaned.map(a=>a.id===accId?{...a,rawTxs:[...(a.rawTxs||[]),tx],summaryIncome:null,summaryExpense:null}:a);
    });
  },[setAccounts]);

  const activeTxs=useMemo(()=>{
    if(activeAccountId===ALL_ID){
      const all=accounts.flatMap(a=>a.rawTxs||[]);
      if(!all.length) return null;
      const result=all.map(t=>({...t,date:t.date instanceof Date?t.date:new Date(t.date)})).filter(t=>t.date&&!isNaN(t.date.getTime()));
      // For "all accounts" sum up summaries from each account
      const totalIn  = accounts.reduce((s,a)=>s+(a.summaryIncome??0),0);
      const totalOut = accounts.reduce((s,a)=>s+(a.summaryExpense??0),0);
      if(totalIn>0)  result._summaryIncome  = totalIn;
      if(totalOut>0) result._summaryExpense = totalOut;
      return result;
    }
    const acc=accounts.find(a=>a.id===activeAccountId);
    if(!acc?.rawTxs) return null;
    const result=acc.rawTxs.map(t=>({...t,date:t.date instanceof Date?t.date:new Date(t.date)})).filter(t=>t.date&&!isNaN(t.date.getTime()));
    // Reattach summary totals from the account object (survives localStorage serialization)
    if(acc.summaryIncome  != null) result._summaryIncome  = acc.summaryIncome;
    if(acc.summaryExpense != null) result._summaryExpense = acc.summaryExpense;
    return result;
  },[accounts,activeAccountId]);

  const data=useMemo(()=>activeTxs&&activeTxs.length?analyzeTransactions(activeTxs):null,[activeTxs]);

  // Se non ci sono ancora transazioni, parti dalla scheda "Storico" (dove si aggiunge).
  const initialTab=(activeTxs&&activeTxs.length)?0:1;
  const [tabIdx,setTabIdx]=useState(initialTab);
  const tabIdxRef=useRef(initialTab);
  useEffect(()=>{tabIdxRef.current=tabIdx;},[tabIdx]);

  const snapTo=(idx)=>{
    const c=Math.max(0,Math.min(TAB_ORDER.length-1,idx));
    if(c!==tabIdxRef.current){tabIdxRef.current=c;setTabIdx(c);}
  };
  const handleTabTap=(idx)=>{
    if(idx===tabIdx){haptic.selection();return;}
    haptic.medium();snapTo(idx);window.scrollTo({top:0,behavior:'instant'});
  };

  const activeAcc=accounts.find(a=>a.id===activeAccountId);
  const safeTxs=activeTxs||[];   // le pagine gestiscono la lista vuota autonomamente
  const currentTab=TAB_ORDER[tabIdx];

  return (
    <div style={{
      background:C.bg, color:C.primary, fontFamily:FONT.text,
      WebkitFontSmoothing:'antialiased', MozOsxFontSmoothing:'grayscale',
      position:'fixed', top:0, left:0, right:0, height:appHeight,
      display:'flex', flexDirection:'column',
    }}>
      <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,pointerEvents:'none',background:C.ambient}}/>

      <SettingsModal
        C={C} open={settingsOpen} onClose={()=>setSettingsOpen(false)}
        schemeOverride={schemeOverride} setSchemeOverride={setSchemeOverride}
        accounts={accounts} setAccounts={setAccounts}
        activeAccountId={activeAccountId} setActiveAccountId={setActiveAccountId}
        onLoadForAccount={onLoadForAccount}
      />

      {/* HEADER — logica identica a XAUTrader: top:0, overflow:hidden, transform translateY(-6px) */}
      <header style={{position:'sticky',zIndex:30,
        top: 0,
        overflow: 'hidden',
        transform: 'translateY(-6px)',
        background: scheme==='dark'?'rgba(0,0,0,0.48)':'rgba(255,255,255,0.58)',
        backdropFilter: 'saturate(200%) blur(32px)',
        WebkitBackdropFilter: 'saturate(200%) blur(32px)',
        borderBottom: `0.5px solid ${C.sep}`,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
      }}>
        <div className="rv-shimmer-overlay" style={{position:'absolute',top:0,left:0,right:0,bottom:0,opacity:scheme==='dark'?1:0.4}}/>
        <div style={{maxWidth:'100%',margin:'0 auto',padding:'2px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,position:'relative'}}>
          <span style={{fontFamily:FONT.text,fontSize:13,fontWeight:600,color:C.primary,letterSpacing:'-0.2px',flexShrink:0,marginRight:8}}>{activeAccountId==='__all__'?'Tutti i conti':activeAcc?.name||'HomeBanking'}</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            {accounts.length>0&&<AccountPill C={C} accounts={accounts} activeAccountId={activeAccountId} setActiveAccountId={setActiveAccountId}/>}
            <button onClick={()=>setSettingsOpen(true)} className="rv-btn" style={{width:30,height:30,borderRadius:15,background:C.glass2,border:`0.5px solid ${C.sep}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={C.secondary} strokeWidth="1.8"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={C.secondary} strokeWidth="1.8"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* PAGER — AI separato, scroll wrapper con safe-area */}
      {currentTab==='ai' ? (
        <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',maxWidth:896,width:'100%',margin:'0 auto',padding:'0 0',paddingBottom:'env(safe-area-inset-bottom, 0px)'}}>
            <AIPage C={C} data={data} txs={safeTxs} setInputFocused={setInputFocused} input={aiInput} setInput={setAiInput} send={aiSendRef} inputRef={aiInputRef}/>
          </div>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',overscrollBehavior:'none'}}>
        <div style={{paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))', paddingTop:12}}>
            {currentTab==='overview'  &&<OverviewPage   C={C} data={data} txs={safeTxs}/>}
            {currentTab==='spese'     &&<SpesePage      C={C} data={data} txs={safeTxs}/>}
            {currentTab==='movimenti' &&<MovimentiPage  C={C} txs={safeTxs} accounts={accounts} activeAccountId={activeAccountId} onAddTransaction={addTransaction} onUpdateTransaction={updateTransaction} onDeleteTransaction={deleteTransaction}/>}
            {currentTab==='analytics' &&<AnalyticsPage  C={C} data={data} txs={safeTxs}/>}
          </div>
        </div>
      )}

      {/* TAB BAR */}
      <div style={{position:'fixed',left:'50%',zIndex:50,
        transform: inputFocused ? 'translateX(-50%) translateY(120%)' : 'translateX(-50%) translateY(0)',
        opacity: inputFocused ? 0 : 1,
        pointerEvents: inputFocused ? 'none' : 'auto',
        bottom: 17,
        transition: 'transform 0.28s cubic-bezier(0.34, 1.18, 0.64, 1), opacity 0.22s ease-out',
      }}>
        <TabBar C={C} tabIdx={tabIdx} onTabTap={handleTabTap} scheme={scheme}/>
      </div>

      {/* AI INPUT BAR — fixed, appena sopra la tab bar; quando tastiera aperta iOS la solleva automaticamente */}
      {currentTab==='ai'&&(
        <div style={{
          position:'fixed',
          left:0,right:0,
          bottom: inputFocused ? -2 : 'calc(17px + 48px - 8px + env(safe-area-inset-bottom, 0px))',
          zIndex:49,
          padding:'6px 12px',
          paddingBottom: inputFocused ? 'env(safe-area-inset-bottom, 0px)' : '6px',
          transition:'bottom 0.25s ease, padding-bottom 0.25s ease',
          pointerEvents:'auto',
        }}>
          <div style={{display:'flex',alignItems:'flex-end',gap:8,background:C.glass,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',border:`0.5px solid ${C.sep2}`,borderRadius:24,padding:'6px 6px 6px 14px',boxShadow:scheme==='dark'?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 32px rgba(0,0,0,0.12)'}}>
            <textarea
              ref={aiInputRef}
              value={aiInput}
              onChange={e=>setAiInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSendRef.current?.();}}}
              onFocus={()=>setInputFocused(true)}
              onBlur={()=>setInputFocused(false)}
              placeholder="Chiedi qualcosa sui tuoi dati..."
              rows={1}
              style={{flex:1,background:'transparent',border:'none',outline:'none',color:C.primary,fontSize:16,fontFamily:FONT.text,resize:'none',padding:'8px 0',maxHeight:120,letterSpacing:'-0.1px',lineHeight:1.4}}
            />
            <button
              onClick={()=>aiSendRef.current?.()}
              disabled={!aiInput.trim()}
              className="rv-btn"
              style={{width:36,height:36,borderRadius:18,background:!aiInput.trim()?C.glass3:C.primary,border:'none',cursor:!aiInput.trim()?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s'}}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke={!aiInput.trim()?C.tertiary:C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
