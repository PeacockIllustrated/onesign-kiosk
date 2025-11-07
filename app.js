// Register SW on load (no functional change)
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// ---------- PANEL NAV ----------
const gate = document.getElementById('gate');
const catalogue = document.getElementById('catalogue');
const letters = document.getElementById('letters');

const internalBtn = document.getElementById('internalBtn');
const externalBtn = document.getElementById('externalBtn');
const backFromCatalogue = document.getElementById('backFromCatalogue');
const lettersCard = document.getElementById('lettersCard');

function show(el){ el.classList.remove('translate-x-full','-translate-x-full'); el.classList.add('translate-x-0'); }
function hideLeft(el){ el.classList.remove('translate-x-0','translate-x-full'); el.classList.add('-translate-x-full'); }
function hideRight(el){ el.classList.remove('translate-x-0','-translate-x-full'); el.classList.add('translate-x-full'); }

internalBtn.addEventListener('click', ()=>{ hideLeft(gate); show(catalogue); });
externalBtn.addEventListener('click', ()=>{ hideLeft(gate); show(catalogue); });
backFromCatalogue.addEventListener('click', ()=>{ hideRight(catalogue); show(gate); });
lettersCard.addEventListener('click', ()=>{ hideLeft(catalogue); show(letters); go(0); });

// ---------- LETTERS FLOW ----------
const L = {
  material:null, height:null, heightCustom:null,
  illumination:null, illuminationColour:null,
  fixing:null, install:null,
  email:'', postcode:''
};

const lwrap = document.getElementById('lwrap');
const lettersBack = document.getElementById('lettersBack');
const lettersNext = document.getElementById('lettersNext');
const dots = document.getElementById('dots');

let step = 0;          // 0..6
const TOTAL = 7;

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function renderDots() {
  if(!dots) return;
  dots.innerHTML = Array.from({length: TOTAL}, (_,i)=>
    `<span class="inline-block rounded-full ${i===step?'bg-black':'bg-black/20'}" style="width:8px;height:8px;"></span>`
  ).join('');
}

function go(n){
  step = clamp(n, 0, TOTAL-1);
  lwrap.style.transform = `translateX(-${step*100}vw)`;
  enforceInstallRules();
  updateSummary();
  renderDots();
}

// Selection handling
function setActive(group, value){
  document.querySelectorAll(`[data-choice="${group}"]`).forEach(el=>{
    const active = el.dataset.value === value;
    el.classList.toggle('tile-active', active);
  });
}

document.querySelectorAll('[data-choice]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const g = btn.dataset.choice; const v = btn.dataset.value;
    if(g==='material') L.material=v;
    if(g==='height') {
      L.height=v;
      if(v!=='Custom'){
        L.heightCustom=null;
        const hc=document.getElementById('heightCustom'); if(hc) hc.value='';
      }
    }
    if(g==='illumination'){ L.illumination=v; if(v==='No Illumination'){ L.illuminationColour=null; } }
    if(g==='illuminationColour') L.illuminationColour=v;
    if(g==='fixing') L.fixing=v;
    if(g==='install') L.install=v;
    setActive(g,v);
    enforceInstallRules();
    updateSummary();
  });
});

// Custom height input
const heightCustomInput = document.getElementById('heightCustom');
if(heightCustomInput){
  heightCustomInput.addEventListener('input', e=>{
    const mm = Number(e.target.value||0);
    if(mm>0){ L.height='Custom'; L.heightCustom=mm; setActive('height','Custom'); updateSummary(); }
  });
}

// Rules: spacers need installation
function enforceInstallRules(){
  const grid=document.getElementById('installGrid'); if(!grid) return;
  const btns=[...grid.querySelectorAll('[data-choice="install"]')];
  const needsInstall = L.fixing==='Aluminium wall spacers';
  btns.forEach(b=>{
    const isInstall = b.dataset.value==='Yes';
    if(needsInstall && !isInstall){ b.disabled=true; b.classList.add('opacity-50','cursor-not-allowed'); }
    else { b.disabled=false; b.classList.remove('opacity-50','cursor-not-allowed'); }
  });
  if(needsInstall){ L.install='Yes'; setActive('install','Yes'); }
}

// Compute next step with conditional skip (Illumination Colour)
function computeNextStep(cur){
  if(cur===2 && (L.illumination==='No Illumination' || L.material==='Foamex')){ return 4; }
  return clamp(cur+1, 0, TOTAL-1);
}

lettersBack.addEventListener('click', ()=>{
  if(step===0){ hideRight(letters); show(catalogue); } else { go(step-1); }
});

lettersNext.addEventListener('click', ()=>{
  if(step===6){ openSummary(); }
  else { go(computeNextStep(step)); }
});

// ---------- SUMMARY SHEET ----------
const sheetWrap=document.getElementById('sheetWrap');
const sheet=document.getElementById('sheet');
const sheetBackdrop=document.getElementById('sheetBackdrop');
const closeSheet=document.getElementById('closeSheet');
const summaryBox=document.getElementById('summary');

function updateSummary(){
  const h=L.height==='Custom'&&L.heightCustom?`Custom (${L.heightCustom}mm)`: (L.height||'—');
  const rows=[
    ['Material', L.material||'—'],
    ['Height', h],
    ['Illumination', L.material==='Foamex' ? '—' : (L.illumination||'—')],
    ['Colour', (L.illumination && L.illumination!=='No Illumination' && L.material!=='Foamex') ? (L.illuminationColour||'—') : '—'],
    ['Fixing', L.fixing||'—'],
    ['Install', L.install||'—'],
    ['Email', L.email||'—'],
    ['Postcode', L.postcode||'—']
  ];
  summaryBox.innerHTML = rows.map(([k,v]) =>
    `<div class="flex items-center justify-between border-b border-black/10 py-2"><span class="text-gray-600">${k}</span><span class="font-medium">${v}</span></div>`
  ).join('');
}

function openSummary(){
  sheetWrap.classList.remove('pointer-events-none');
  sheetBackdrop.classList.remove('opacity-0');
  sheet.classList.remove('translate-y-full');
}
function closeSummary(){
  sheetWrap.classList.add('pointer-events-none');
  sheetBackdrop.classList.add('opacity-0');
  sheet.classList.add('translate-y-full');
}

closeSheet.addEventListener('click', closeSummary);
sheetBackdrop.addEventListener('click', closeSummary);

const emailInput=document.getElementById('email');
const pcInput=document.getElementById('postcode');
if(emailInput){ emailInput.addEventListener('input', e=>{ L.email=e.target.value; updateSummary(); }); }
if(pcInput){ pcInput.addEventListener('input', e=>{ L.postcode=e.target.value; updateSummary(); }); }

// ---------- INIT ----------
go(0);

// ---------- BASIC TESTS (console) ----------
(function runTests(){
  console.group('%cOnesign Kiosk Tests','color:#111;background:#eee;padding:2px 6px;border-radius:6px');
  console.assert(computeNextStep(2)===3 || computeNextStep(2)===4, 'Next step from 2 should be 3 or 4 based on illumination.');
  const savedIll=L.illumination, savedMat=L.material;
  L.illumination='No Illumination'; L.material='MDF';
  console.assert(computeNextStep(2)===4, 'When No Illumination, colour slide must be skipped.');
  L.illumination=savedIll; L.material='Foamex';
  console.assert(computeNextStep(2)===4, 'When Foamex, colour slide must be skipped.');
  console.assert(clamp(-5,0,6)===0 && clamp(99,0,6)===6, 'Clamp should bound values.');
  L.material=savedMat;
  console.groupEnd();
})();
