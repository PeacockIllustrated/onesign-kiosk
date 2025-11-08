/**
 * Onesign Kiosk - Mobile Sign Configuration Flow
 * 
 * Key Features:
 * - Centered grids with safe-area support (iOS notch, Android cutouts)
 * - Next button gated by validation (Height Custom requires numeric value > 0)
 * - Auto-advance on selection (except Height Custom)
 * - Smart skip: Illumination Colour skipped when No Illumination or Foamex material
 * - Tappable progress dots with validation (cannot jump forward past incomplete slide)
 * - Swipe gestures (left=next, right=back) with configurable thresholds
 * - Keyboard support (ArrowLeft/Right) for desktop testing
 * - Haptic feedback via Vibration API (guarded, no errors on unsupported browsers)
 * - Full accessibility: semantic buttons, aria attributes, visible focus rings
 */

// --------- CONFIG ---------
const ENABLE_HAPTICS = true; // flip to false to disable vibrations

// Swipe gesture thresholds (tunable constants)
const SWIPE_THRESHOLD = 48; // minimum horizontal distance in px to trigger swipe
const SWIPE_RESTRAINT = 56; // maximum vertical distance in px to allow horizontal swipe

// --------- SW register ---------
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// --------- UTIL ---------
const vibrate = (ms=15) => { try { if (ENABLE_HAPTICS && navigator.vibrate) navigator.vibrate(ms); } catch{} };
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// --------- PANEL NAV ---------
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

internalBtn.addEventListener('click', ()=>{ hideLeft(gate); show(catalogue); vibrate(); });
externalBtn.addEventListener('click', ()=>{ hideLeft(gate); show(catalogue); vibrate(); });
backFromCatalogue.addEventListener('click', ()=>{ hideRight(catalogue); show(gate); vibrate(); });
lettersCard.addEventListener('click', ()=>{ hideLeft(catalogue); show(letters); go(0); vibrate(); });

// --------- LETTERS FLOW ---------
const L = {
  material:null, height:null, heightCustom:null,
  illumination:null, illuminationColour:null, illuminationColourHex:null,
  fixing:null, install:null,
  email:'', postcode:''
};

const lwrap = document.getElementById('lwrap');
const lettersBack = document.getElementById('lettersBack');
const lettersNext = document.getElementById('lettersNext');
const dots = document.getElementById('dots');
const rgbPicker = document.getElementById('rgbPicker');
const rgbValueLabel = document.getElementById('rgbValue');
const rgbPreview = document.querySelector('.rgb-preview');
const customSizeHint = document.querySelector('[data-choice="height"][data-value="Custom"] .tile-sub');

let step = 0;             // 0..6
const TOTAL = 7;

function syncRgbTile(hex){
  const hasHex = Boolean(hex);
  if(rgbValueLabel){
    rgbValueLabel.textContent = hasHex ? hex.toUpperCase() : 'choose colour';
  }
  if(rgbPreview){
    if(hasHex){
      rgbPreview.style.background = hex;
      rgbPreview.style.borderColor = '#fff';
      rgbPreview.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.4)';
    } else {
      rgbPreview.style.background = 'conic-gradient(from 0deg, #ff0000, #00ff00, #0000ff, #ff0000)';
      rgbPreview.style.borderColor = '#111';
      rgbPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    }
  }
}

// Render progress dots with validation: cannot jump forward past incomplete current slide
function renderDots() {
  if(!dots) return;
  dots.innerHTML = Array.from({length: TOTAL}, (_,i)=>{
    const isActive = i === step;
    const canNavigate = i <= step || (i > step && canLeaveStep(step));
    return `<button class="inline-block rounded-full ${isActive?'bg-black':'bg-black/20'}"
             data-dot="${i}" role="tab" aria-selected="${isActive}"
             ${!canNavigate ? 'disabled aria-disabled="true"' : ''}
             style="width:8px;height:8px;${!canNavigate ? 'opacity:0.35;pointer-events:none;' : ''}"></button>`;
  }).join('');

  // Tappable dots: only allow navigation if current step is valid or going backward
  dots.querySelectorAll('[data-dot]').forEach(btn=>{
    const targetStep = Number(btn.dataset.dot);
    btn.addEventListener('click', ()=>{
      // Can always go backward, but forward requires current step to be valid
      if(targetStep > step && !canLeaveStep(step)){
        vibrate(4); // error feedback
        return;
      }
      go(targetStep);
      vibrate(6);
    });
  });
}

function go(n){
  step = clamp(n, 0, TOTAL-1);
  lwrap.style.transform = `translateX(-${step*100}vw)`;
  enforceInstallRules();
  updateSummary();
  renderDots();
  updateNextEnabled();
}

function setActive(group, value){
  document.querySelectorAll(`[data-choice="${group}"]`).forEach(el=>{
    const active = el.dataset.value === value;
    el.classList.toggle('tile-active', active);
    el.setAttribute('aria-pressed', String(active));
  });
}

// Validation: determines if user can leave current step
// Height "Custom" requires a numeric value > 0 before enabling Next
function canLeaveStep(s){
  switch(s){
    case 0: return !!L.material;
    case 1: return !!L.height && (L.height !== 'Custom' || (L.heightCustom && L.heightCustom > 0));
    case 2: return L.material==='Foamex' ? true : !!L.illumination;
    case 3: return (L.material==='Foamex' || L.illumination==='No Illumination') ? true : !!L.illuminationColour;
    case 4: return !!L.fixing;
    case 5: return !!L.install;
    case 6: return true; // contact optional for flow
    default: return true;
  }
}

function updateNextEnabled(){
  lettersNext.disabled = !canLeaveStep(step);
}

// selection + auto-advance
document.querySelectorAll('[data-choice]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const g = btn.dataset.choice;
    const v = btn.dataset.value;
    let shouldAutoAdvance = true;

    if(g === 'material'){
      L.material = v;
    } else if(g === 'height'){
      L.height = v;
      shouldAutoAdvance = v !== 'Custom';
      if(v !== 'Custom'){
        L.heightCustom = null;
        const hc = document.getElementById('heightCustom');
        if(hc) hc.value = '';
        if(customSizeHint){
          customSizeHint.textContent = 'tap to enter';
        }
      } else {
        const hc = document.getElementById('heightCustom');
        if(hc){
          setTimeout(()=>hc.focus(), 100);
        }
      }
    } else if(g === 'illumination'){
      L.illumination = v;
      if(v === 'No Illumination'){
        L.illuminationColour = null;
        L.illuminationColourHex = null;
        syncRgbTile(null);
        setActive('illuminationColour', '');
      }
    } else if(g === 'illuminationColour'){
      if(v === 'RGB' && rgbPicker){
        rgbPicker.click();
        vibrate();
        return;
      }
      L.illuminationColour = v;
      L.illuminationColourHex = null;
      syncRgbTile(null);
    } else if(g === 'fixing'){
      L.fixing = v;
    } else if(g === 'install'){
      L.install = v;
    }

    setActive(g, v);
    enforceInstallRules();
    updateSummary();
    updateNextEnabled();
    vibrate();

    const next = computeNextStep(step);
    if(!(g === 'height' && v === 'Custom') && shouldAutoAdvance){
      go(next);
    }
  });
});

if(rgbPicker){
  rgbPicker.addEventListener('input', e=>{
    const hex = (e.target.value || '').trim();
    syncRgbTile(hex || null);
  });

  rgbPicker.addEventListener('change', e=>{
    const hex = (e.target.value || '').trim();
    if(!hex) return;
    L.illuminationColour = 'RGB';
    L.illuminationColourHex = hex;
    setActive('illuminationColour', 'RGB');
    updateSummary();
    updateNextEnabled();
    vibrate();
    syncRgbTile(hex);
    const next = computeNextStep(step);
    go(next);
  });
}

// Custom height input: requires numeric value > 0 before enabling Next
const heightCustomInput = document.getElementById('heightCustom');
if(heightCustomInput){
  heightCustomInput.addEventListener('input', e=>{
    const mm = Number(e.target.value||0);
    if(mm > 0){
      L.height = 'Custom';
      L.heightCustom = mm;
      setActive('height', 'Custom');
      if(customSizeHint){
        customSizeHint.textContent = `${mm}mm`;
      }
      updateSummary();
      updateNextEnabled();
      vibrate(8); // subtle feedback on valid input
    } else {
      L.heightCustom = null;
      if(customSizeHint){
        customSizeHint.textContent = 'tap to enter';
      }
      updateNextEnabled();
    }
  });
  
  // Also handle blur to validate on exit
  heightCustomInput.addEventListener('blur', ()=>{
    updateNextEnabled();
  });
}

// Install rule: spacers require installation
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

// Smart skip logic: If Illumination = "No Illumination" or Material = "Foamex", skip step 3 (Illumination Colour)
// When on step 2 (Illumination) and conditions are met, jump directly to step 4 (Fixing)
function computeNextStep(cur){
  if(cur === 2 && (L.illumination === 'No Illumination' || L.material === 'Foamex')){
    return 4; // Skip step 3 (Illumination Colour)
  }
  return clamp(cur + 1, 0, TOTAL - 1);
}

// Back navigation: skip step 3 (Illumination Colour) if it was skipped going forward
lettersBack.addEventListener('click', ()=>{
  if(step===0){ 
    hideRight(letters); 
    show(catalogue); 
  } else {
    let prevStep = step - 1;
    // If going back from step 4 and step 3 was skipped, go to step 2 instead
    if(step === 4 && (L.illumination === 'No Illumination' || L.material === 'Foamex')){
      prevStep = 2;
    }
    go(prevStep);
  }
  vibrate();
});

lettersNext.addEventListener('click', ()=>{
  if(!canLeaveStep(step)) return;
  if(step===6){ openSummary(); }
  else { go(computeNextStep(step)); }
  vibrate();
});

// Swipe gestures: left = Next (validate first), right = Back (or to Catalogue when on first Letters slide)
// Ignore mostly vertical gestures using restraint threshold
(()=>{
  let startX=0, startY=0, dragging=false;

  lwrap.addEventListener('touchstart', (e)=>{
    const t=e.changedTouches[0];
    startX=t.pageX;
    startY=t.pageY;
    dragging=true;
  }, {passive:true});

  lwrap.addEventListener('touchend', (e)=>{
    if(!dragging) return;
    const t=e.changedTouches[0];
    const dx=t.pageX-startX;
    const dy=t.pageY-startY;
    
    // Only trigger if horizontal movement exceeds threshold and vertical is within restraint
    if(Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dy) <= SWIPE_RESTRAINT){
      if(dx < 0){ // left swipe -> next
        if(canLeaveStep(step)){
          if(step === 6){ openSummary(); }
          else { go(computeNextStep(step)); }
          vibrate();
        } else {
          vibrate(4); // error feedback
        }
      } else { // right swipe -> back
        if(step === 0){ 
          hideRight(letters); 
          show(catalogue); 
        } else {
          let prevStep = step - 1;
          // If going back from step 4 and step 3 was skipped, go to step 2 instead
          if(step === 4 && (L.illumination === 'No Illumination' || L.material === 'Foamex')){
            prevStep = 2;
          }
          go(prevStep);
        }
        vibrate();
      }
    }
    dragging=false;
  }, {passive:true});
})();

// Keyboard support for desktop testing: Left/Right arrows mirror Back/Next
window.addEventListener('keydown', (e)=>{
  if(e.key === 'ArrowRight'){ 
    lettersNext.click(); 
  }
  if(e.key === 'ArrowLeft'){ 
    lettersBack.click(); 
  }
});

// --------- SUMMARY SHEET ---------
const sheetWrap=document.getElementById('sheetWrap');
const sheet=document.getElementById('sheet');
const sheetBackdrop=document.getElementById('sheetBackdrop');
const closeSheet=document.getElementById('closeSheet');
const summaryBox=document.getElementById('summary');

function updateSummary(){
  const h=L.height==='Custom'&&L.heightCustom?`Custom (${L.heightCustom}mm)`: (L.height||'—');
  const showColour = !!(L.illumination && L.illumination!=='No Illumination' && L.material!=='Foamex');
  const colourValue = showColour
    ? (L.illuminationColour === 'RGB'
        ? (L.illuminationColourHex ? `RGB (${L.illuminationColourHex.toUpperCase()})` : 'RGB')
        : (L.illuminationColour || '—'))
    : '—';
  const rows=[
    ['Material', L.material||'—'],
    ['Height', h],
    ['Illumination', L.material==='Foamex' ? '—' : (L.illumination||'—')],
    ['Colour', colourValue],
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

// --------- INIT ---------
go(0);
updateNextEnabled();
renderDots();
syncRgbTile(L.illuminationColour === 'RGB' ? L.illuminationColourHex : null);

// --------- BASIC TESTS (console) ---------
(function runTests(){
  console.group('%cOnesign Kiosk Tests','color:#111;background:#eee;padding:2px 6px;border-radius:6px');
  console.assert(computeNextStep(2)===3 || computeNextStep(2)===4, 'Next step from 2 should be 3 or 4.');
  const savedIll=L.illumination, savedMat=L.material;
  L.illumination='No Illumination'; L.material='MDF';
  console.assert(computeNextStep(2)===4, 'No Illumination skips colour.');
  L.illumination=savedIll; L.material='Foamex';
  console.assert(computeNextStep(2)===4, 'Foamex skips colour.');
  console.assert(clamp(-5,0,6)===0 && clamp(99,0,6)===6, 'Clamp bounds values.');
  L.material=savedMat;
  console.groupEnd();
})();

