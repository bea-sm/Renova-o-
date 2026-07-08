/* =====================================================================
   DOCUMENTO CONFIDENCIAL — script.js
   SPA vanilla JS: navegação entre telas, efeitos, assinatura e áudio.
   Organizado em pequenos módulos independentes.
===================================================================== */

/* ---------------------------------------------------------------------
   0. UTILITÁRIOS GERAIS
--------------------------------------------------------------------- */
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Ajusta a variável --vh para lidar com barras de endereço móveis. */
function setViewportHeight() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', setViewportHeight);

/** Vibração leve em dispositivos compatíveis (silenciosamente ignorado se indisponível). */
function vibrate(pattern = 20) {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (e) { /* noop */ }
  }
}

/* ---------------------------------------------------------------------
   1. NAVEGAÇÃO ENTRE TELAS (SPA)
--------------------------------------------------------------------- */
const SCREEN_ORDER = [
  'screen-1', 'screen-2', 'screen-3', 'screen-4',
  'screen-5', 'screen-6', 'screen-7', 'screen-final'
];

const progressBar = qs('#progressBar');
let currentScreenId = 'screen-1';

function updateProgressBar(screenId) {
  const idx = SCREEN_ORDER.indexOf(screenId);
  if (idx === -1) return; // telas secretas não alteram o progresso
  const pct = ((idx + 1) / SCREEN_ORDER.length) * 100;
  progressBar.style.width = `${pct}%`;
}

/** Troca de tela com fade/blur/slide, disparando callbacks de entrada específicos. */
function goToScreen(targetId) {
  const current = qs(`#${currentScreenId}`);
  const target = qs(`#${targetId}`);
  if (!target || current === target) return;

  if (current) {
    current.classList.add('is-leaving');
    current.classList.remove('is-active');
    setTimeout(() => current.classList.remove('is-leaving'), 620);
  }

  requestAnimationFrame(() => {
    target.classList.add('is-active');
  });

  currentScreenId = targetId;
  updateProgressBar(targetId);
  vibrate(8);
  runScreenEnterHandler(targetId);
}

// Delegação de clique para qualquer botão com data-next
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-next]');
  if (!btn || btn.disabled) return;
  goToScreen(btn.getAttribute('data-next'));
});

/* ---------------------------------------------------------------------
   2. LOADING INICIAL
--------------------------------------------------------------------- */
window.addEventListener('load', () => {
  setTimeout(() => {
    const loading = qs('#screen-loading');
    const app = qs('#app');
    loading.classList.add('is-hidden');
    app.hidden = false;
    qs('#screen-1').classList.add('is-active');
    updateProgressBar('screen-1');
    runScreenEnterHandler('screen-1');
  }, 1400);
});

/* ---------------------------------------------------------------------
   3. HANDLERS DE ENTRADA POR TELA
--------------------------------------------------------------------- */
function runScreenEnterHandler(screenId) {
  switch (screenId) {
    case 'screen-1': revealScreen1(); break;
    case 'screen-3': runChecklistSequence(); break;
    case 'screen-4': runClauseSequence(); break;
    case 'screen-5': setupSignaturePad(); break;
    case 'screen-6': setupEnvelope(); break;
    case 'screen-7': revealLetter(); break;
    case 'screen-final': celebrateFinal(); break;
  }
}

/* --- Tela 1: revelação sequencial de texto --- */
function revealScreen1() {
  qsa('#screen-1 .reveal-line').forEach((el) => {
    if (el.classList.contains('is-revealed')) return;
    const delay = Number(el.dataset.delay || 0) * 260;
    setTimeout(() => el.classList.add('is-revealed'), delay);
  });
}

/* --- Tela 3: checklist item a item, depois "aprovado" --- */
let checklistDone = false;
function runChecklistSequence() {
  if (checklistDone) return;
  checklistDone = true;
  const items = qsa('#checklist .check-item');
  items.forEach((item, i) => {
    setTimeout(() => {
      item.classList.add('is-checked');
      vibrate(6);
    }, i * 420);
  });
  const total = items.length * 420 + 300;
  setTimeout(() => {
    qs('#approvedTag').classList.add('is-shown');
  }, total);
  setTimeout(() => {
    qs('#btnToScreen4').disabled = false;
  }, total + 500);
}

/* --- Tela 4: cláusulas do contrato + checkbox liberando botão --- */
let clausesDone = false;
function runClauseSequence() {
  if (clausesDone) return;
  clausesDone = true;
  const clauses = qsa('#clauseList li');
  clauses.forEach((li, i) => {
    setTimeout(() => li.classList.add('is-shown'), i * 380);
  });

  const checkbox = qs('#agreeCheckbox');
  const continueBtn = qs('#btnToScreen5');
  checkbox.addEventListener('change', () => {
    continueBtn.disabled = !checkbox.checked;
    if (checkbox.checked) vibrate(10);
  });
}

/* ---------------------------------------------------------------------
   4. ASSINATURA (Canvas — Touch + Mouse)
--------------------------------------------------------------------- */
let signatureCanvas, signatureCtx;
let isDrawing = false;
let hasSignature = false;
let signatureDataUrl = null;

function setupSignaturePad() {
  signatureCanvas = qs('#signaturePad');
  if (!signatureCanvas || signatureCanvas.dataset.ready) return;
  signatureCanvas.dataset.ready = 'true';

  const resizeCanvas = () => {
    const rect = signatureCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    signatureCanvas.width = rect.width * ratio;
    signatureCanvas.height = rect.height * ratio;
    signatureCtx = signatureCanvas.getContext('2d');
    signatureCtx.scale(ratio, ratio);
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.lineWidth = 2.6;
    signatureCtx.strokeStyle = '#1c1c20';
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const getPos = (evt) => {
    const rect = signatureCanvas.getBoundingClientRect();
    if (evt.touches && evt.touches.length) {
      return { x: evt.touches[0].clientX - rect.left, y: evt.touches[0].clientY - rect.top };
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const start = (evt) => {
    evt.preventDefault();
    isDrawing = true;
    const p = getPos(evt);
    signatureCtx.beginPath();
    signatureCtx.moveTo(p.x, p.y);
  };
  const move = (evt) => {
    if (!isDrawing) return;
    evt.preventDefault();
    const p = getPos(evt);
    signatureCtx.lineTo(p.x, p.y);
    signatureCtx.stroke();
    if (!hasSignature) {
      hasSignature = true;
      qs('.signature-hint').classList.add('is-hidden');
      qs('#btnSignConfirm').disabled = false;
    }
  };
  const end = () => { isDrawing = false; };

  signatureCanvas.addEventListener('mousedown', start);
  signatureCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  signatureCanvas.addEventListener('touchstart', start, { passive: false });
  signatureCanvas.addEventListener('touchmove', move, { passive: false });
  signatureCanvas.addEventListener('touchend', end);

  qs('#btnClearSig').addEventListener('click', () => {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasSignature = false;
    qs('.signature-hint').classList.remove('is-hidden');
    qs('#btnSignConfirm').disabled = true;
  });

  qs('#btnSignConfirm').addEventListener('click', onSignConfirm);
}

function onSignConfirm() {
  if (!hasSignature) return;
  signatureDataUrl = signatureCanvas.toDataURL('image/png');
  const preview = qs('#finalSignaturePreview');
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = signatureDataUrl;
  img.alt = 'Assinatura de Victor';
  preview.appendChild(img);

  vibrate([30, 40, 30]);
  playSfx('sfxConfirm');
  burstConfetti();

  setTimeout(() => goToScreen('screen-6'), 2000);
}

/* ---------------------------------------------------------------------
   5. ENVELOPE (tela 6)
--------------------------------------------------------------------- */
function setupEnvelope() {
  const envelope = qs('#envelope');
  if (!envelope || envelope.dataset.ready) return;
  envelope.dataset.ready = 'true';

  const open = () => {
    if (envelope.classList.contains('is-open')) return;
    envelope.classList.add('is-open');
    vibrate(15);
    playSfx('sfxPaper');
    setTimeout(() => goToScreen('screen-7'), 1100);
  };

  envelope.addEventListener('click', open);
  envelope.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}

/* ---------------------------------------------------------------------
   6. CARTA (tela 7) + BOTÃO SECRETO
--------------------------------------------------------------------- */
function revealLetter() {
  const sheet = qs('#letterSheet');
  requestAnimationFrame(() => sheet.classList.add('is-risen'));
  startHeartsRain(6000);

  const secret = qs('#secretHeart');
  if (secret && !secret.dataset.ready) {
    secret.dataset.ready = 'true';
    secret.addEventListener('click', () => {
      vibrate(12);
      goToScreen('screen-secret');
    });
  }
}

/* ---------------------------------------------------------------------
   7. TELA FINAL
--------------------------------------------------------------------- */
function celebrateFinal() {
  burstConfetti();
  startHeartsRain(4000);
  startSparkles(4000);
  const finalizeBtn = qs('#btnFinalize');
  if (finalizeBtn && !finalizeBtn.dataset.ready) {
    finalizeBtn.dataset.ready = 'true';
    finalizeBtn.addEventListener('click', () => {
      vibrate([20, 30, 20, 30, 20]);
      burstConfetti();
      startHeartsRain(3000);
    });
  }
}

/* ---------------------------------------------------------------------
   8. EFEITOS VISUAIS — canvas único para confetes, corações e brilhos
--------------------------------------------------------------------- */
const fxCanvas = qs('#fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
let fxParticles = [];
let fxAnimationId = null;

function resizeFxCanvas() {
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
resizeFxCanvas();
window.addEventListener('resize', resizeFxCanvas);

function ensureFxLoop() {
  if (fxAnimationId) return;
  const loop = () => {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fxParticles.forEach((p) => p.update());
    fxParticles = fxParticles.filter((p) => !p.dead);
    fxCtx.save();
    fxParticles.forEach((p) => p.draw(fxCtx));
    fxCtx.restore();

    if (fxParticles.length > 0) {
      fxAnimationId = requestAnimationFrame(loop);
    } else {
      fxAnimationId = null;
    }
  };
  fxAnimationId = requestAnimationFrame(loop);
}

/* --- Confetes --- */
class Confetto {
  constructor() {
    this.x = Math.random() * fxCanvas.width;
    this.y = -20;
    this.size = 6 + Math.random() * 6;
    this.speedY = 2 + Math.random() * 3;
    this.speedX = (Math.random() - 0.5) * 3;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
    this.color = ['#e39bb8', '#d8b984', '#ffffff', '#f3c9d8'][Math.floor(Math.random() * 4)];
    this.life = 0;
    this.dead = false;
  }
  update() {
    this.y += this.speedY;
    this.x += this.speedX + Math.sin(this.life / 12) * 0.6;
    this.rotation += this.rotationSpeed;
    this.life++;
    if (this.y > fxCanvas.height + 30) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    ctx.restore();
  }
}

function burstConfetti(count = 90) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => fxParticles.push(new Confetto()), i * 6);
  }
  ensureFxLoop();
}

/* --- Chuva de corações --- */
class HeartParticle {
  constructor() {
    this.x = Math.random() * fxCanvas.width;
    this.y = -20;
    this.size = 12 + Math.random() * 14;
    this.speedY = 0.8 + Math.random() * 1.6;
    this.drift = Math.random() * Math.PI * 2;
    this.opacity = 0.5 + Math.random() * 0.5;
    this.dead = false;
    this.life = 0;
  }
  update() {
    this.life++;
    this.y += this.speedY;
    this.x += Math.sin(this.life / 30 + this.drift) * 0.8;
    if (this.y > fxCanvas.height + 30) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = '#e39bb8';
    ctx.font = `${this.size}px serif`;
    ctx.fillText('♥', this.x, this.y);
    ctx.restore();
  }
}

let heartsInterval = null;
function startHeartsRain(duration = 5000) {
  if (heartsInterval) return;
  heartsInterval = setInterval(() => {
    fxParticles.push(new HeartParticle());
  }, 180);
  ensureFxLoop();
  setTimeout(() => {
    clearInterval(heartsInterval);
    heartsInterval = null;
  }, duration);
}

/* --- Brilhos / sparkles --- */
class Sparkle {
  constructor() {
    this.x = Math.random() * fxCanvas.width;
    this.y = Math.random() * fxCanvas.height;
    this.size = 1 + Math.random() * 2;
    this.life = 0;
    this.maxLife = 60 + Math.random() * 60;
    this.dead = false;
  }
  update() {
    this.life++;
    if (this.life > this.maxLife) this.dead = true;
  }
  draw(ctx) {
    const progress = this.life / this.maxLife;
    const alpha = Math.sin(progress * Math.PI);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d8b984';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let sparkleInterval = null;
function startSparkles(duration = 4000) {
  if (sparkleInterval) return;
  sparkleInterval = setInterval(() => {
    fxParticles.push(new Sparkle());
  }, 90);
  ensureFxLoop();
  setTimeout(() => {
    clearInterval(sparkleInterval);
    sparkleInterval = null;
  }, duration);
}

/* ---------------------------------------------------------------------
   9. ÁUDIO — música ambiente + efeitos sonoros
--------------------------------------------------------------------- */
const ambientAudio = qs('#ambientAudio');
const musicToggle = qs('#musicToggle');
let musicOn = false;

function playSfx(id) {
  const el = qs(`#${id}`);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => { /* arquivo de áudio ausente — ignora silenciosamente */ });
}

musicToggle.addEventListener('click', () => {
  musicOn = !musicOn;
  qs('#musicIconOn').style.display = musicOn ? 'block' : 'none';
  qs('#musicIconOff').style.display = musicOn ? 'none' : 'block';

  if (musicOn) {
    ambientAudio.volume = 0.5;
    ambientAudio.play().catch(() => { /* sem arquivo de áudio configurado ainda */ });
  } else {
    ambientAudio.pause();
  }
});
