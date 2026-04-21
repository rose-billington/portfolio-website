import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader }      from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls }   from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const lerp = (a, b, t) => a + (b - a) * t;
const sineEase = (timer) => (1 - Math.cos(timer * Math.PI)) / 2;

// Metro strips the /assets/ URL prefix and serves from project root.
// Files live at {project_root}/textures/software-icons/ → URL /assets/textures/software-icons/
const SKILL_ICONS = [
  '/portfolio-website/assets/assets/textures/software-icons/figma.png',
  '/portfolio-website/assets/assets/textures/software-icons/blender.png',
  '/portfolio-website/assets/assets/textures/software-icons/Framer.png',
  '/portfolio-website/assets/assets/textures/software-icons/Godot.png',
  '/portfolio-website/assets/assets/textures/software-icons/illustrator.png',
  '/portfolio-website/assets/assets/textures/software-icons/shopify.png',
  '/portfolio-website/assets/assets/textures/software-icons/Canva-New-Logo.png',
];

// ── Background music (starts on first user interaction, loops forever) ────────
const _bgMusic = new Audio('/portfolio-website/assets/assets/sound/bgmusic.mp3');
_bgMusic.loop   = true;
_bgMusic.volume = 0.18;
const BG_NORMAL_VOL = 0.18;
let _bgFadeInterval = null;
function _bgFadeTo(target, durationMs = 2000) {
  if (_bgFadeInterval) clearInterval(_bgFadeInterval);
  const step = 16;
  const diff = target - _bgMusic.volume;
  const inc  = diff / (durationMs / step);
  _bgFadeInterval = setInterval(() => {
    const next = _bgMusic.volume + inc;
    if ((inc > 0 && next >= target) || (inc < 0 && next <= target)) {
      _bgMusic.volume = target;
      clearInterval(_bgFadeInterval);
      _bgFadeInterval = null;
    } else {
      _bgMusic.volume = Math.max(0, Math.min(1, next));
    }
  }, step);
}
let _bgStarted  = false;
function _startBg() {
  if (_bgStarted) return;
  _bgStarted = true;
  _bgMusic.play().catch(() => {});
  ['click','keydown','touchstart'].forEach(e => document.removeEventListener(e, _startBg));
}
['click','keydown','touchstart'].forEach(e => document.addEventListener(e, _startBg, { once: true }));

export default function ParticleWave({ progressRef, setScrollEnabled, solarReadyRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Force black page background immediately ────────────────────────────
    const bgStyle = document.createElement('style');
    bgStyle.textContent = 'html,body{background:#000!important;margin:0;padding:0}*,*::before,*::after{cursor:none!important}canvas{cursor:none!important}';
    document.head.appendChild(bgStyle);

    // ── Custom crosshair cursor ───────────────────────────────────────────
    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = `
      #site-cursor {
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        width: 22px;
        height: 22px;
        transform-origin: center center;
        animation: ch-idle-glow 2.6s ease-in-out infinite;
      }
      @keyframes ch-idle-glow {
        0%, 100% { scale: 1;    filter: drop-shadow(0 0 2px rgba(255,255,255,0.3)); }
        50%       { scale: 1.1;  filter: drop-shadow(0 0 4px rgba(255,255,255,0.55)); }
      }
      #site-cursor.ch-active {
        animation: ch-active-glow 1.1s ease-in-out infinite;
      }
      @keyframes ch-active-glow {
        0%, 100% { scale: 1.1;  filter: drop-shadow(0 0 3px rgba(255,255,255,0.5)); }
        50%       { scale: 1.2;  filter: drop-shadow(0 0 5px rgba(255,255,255,0.75)); }
      }
      /* Ring */
      #site-cursor .ch-ring {
        display: block;
        position: absolute;
        inset: 0;
        background: transparent;
        border: 1.5px solid rgba(255,255,255,0.88);
        border-radius: 50%;
        transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease, border-color 0.28s;
      }
      #site-cursor.ch-active .ch-ring {
        transform: scale(0.08) rotate(120deg);
        opacity: 0;
        border-color: #ffffff;
      }
      /* Crosshair lines — shoot out from centre */
      #site-cursor span:not(.ch-ring) {
        display: block;
        position: absolute;
        background: #ffffff;
        border-radius: 1px;
        opacity: 0;
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease;
      }
      #site-cursor .ch-left  { width: 8px;   height: 1.5px; top: 50%; left: 0;    transform-origin: left center;   transform: translateY(-50%) scaleX(0); }
      #site-cursor .ch-right { width: 8px;   height: 1.5px; top: 50%; right: 0;   transform-origin: right center;  transform: translateY(-50%) scaleX(0); }
      #site-cursor .ch-top   { width: 1.5px; height: 8px;   left: 50%; top: 0;    transform-origin: center top;    transform: translateX(-50%) scaleY(0); }
      #site-cursor .ch-bot   { width: 1.5px; height: 8px;   left: 50%; bottom: 0; transform-origin: center bottom; transform: translateX(-50%) scaleY(0); }
      #site-cursor.ch-active .ch-left  { opacity: 1; transform: translateY(-50%) scaleX(1); }
      #site-cursor.ch-active .ch-right { opacity: 1; transform: translateY(-50%) scaleX(1); }
      #site-cursor.ch-active .ch-top   { opacity: 1; transform: translateX(-50%) scaleY(1); }
      #site-cursor.ch-active .ch-bot   { opacity: 1; transform: translateX(-50%) scaleY(1); }
    `;
    document.head.appendChild(cursorStyle);
    const cursorEl = document.createElement('div');
    cursorEl.id = 'site-cursor';
    ['ch-ring','ch-left','ch-right','ch-top','ch-bot'].forEach(cls => {
      const s = document.createElement('span'); s.className = cls; cursorEl.appendChild(s);
    });
    document.body.appendChild(cursorEl);

    const _SELECTABLE = 'a,button,[role="button"],.bg-cell,.icon-pill,#dv-back,#proj-back,[data-selectable]';
    const _RECT_SELECTABLE = '.dv-pin,.proj-card-wrap,.proj-dot';
    function _rectHit(selector, x, y) {
      const PAD = 12;
      return Array.from(document.querySelectorAll(selector)).some(el => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.05) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD;
      });
    }
    window.addEventListener('mousemove', e => {
      cursorEl.style.left = (e.clientX - 11) + 'px';
      cursorEl.style.top  = (e.clientY - 11) + 'px';
      const stack      = document.elementsFromPoint(e.clientX, e.clientY);
      const domHit     = stack.some(el => el !== cursorEl && el.matches?.(_SELECTABLE));
      const rectHit    = _rectHit(_RECT_SELECTABLE, e.clientX, e.clientY);
      const canvasHit  = !!window.__siteCanvasInteractive;
      const projHit    = !!window.__projPanelHover;
      const sidebarHit = !!window._pcHovered;
      cursorEl.classList.toggle('ch-active', domHit || rectHit || canvasHit || projHit || sidebarHit);
    });

    // ── Performance tier (low = older/weaker GPU) ─────────────────────────
    const _cores = navigator.hardwareConcurrency || 4;
    const _mem   = navigator.deviceMemory || 4;
    const LOW_END = _cores <= 4 || _mem <= 4;
    const MED_END = !LOW_END && (_cores <= 8 || _mem <= 8);

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW_END, alpha: false });
    renderer.setPixelRatio(LOW_END ? 1 : Math.min(window.devicePixelRatio, MED_END ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);

    // ── Google Font + HUD animation styles ───────────────────────────────
    const fontLink = document.createElement('link');
    fontLink.rel  = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Bungee+Hairline&family=Rubik+Mono+One&display=swap';
    document.head.appendChild(fontLink);

    const hudStyle = document.createElement('style');
    hudStyle.textContent = `
      @keyframes hud-flicker-a {
        0%   { opacity:0; }
        7%   { opacity:1; }
        11%  { opacity:0; }
        29%  { opacity:1; }
        33%  { opacity:0; }
        63%  { opacity:1; }
        100% { opacity:1; }
      }
      @keyframes hud-flicker-b {
        0%   { opacity:0; }
        19%  { opacity:0.9; }
        23%  { opacity:0; }
        49%  { opacity:1; }
        53%  { opacity:0; }
        80%  { opacity:1; }
        100% { opacity:1; }
      }
      @keyframes hud-flicker-c {
        0%   { opacity:0; }
        33%  { opacity:1; }
        36%  { opacity:0; }
        66%  { opacity:0.7; }
        69%  { opacity:0; }
        91%  { opacity:1; }
        100% { opacity:1; }
      }
    `;
    document.head.appendChild(hudStyle);

    // ── Planet skills (name + rating out of 5) ────────────────────────────
    const PLANET_SKILLS = [
      { name: 'Figma',       rating: 4 },
      { name: 'Blender',     rating: 3 },
      { name: 'Framer',      rating: 5 },
      { name: 'Godot',       rating: 4 },
      { name: 'Illustrator', rating: 3 },
      { name: 'Shopify',     rating: 5 },
      { name: 'Canva',       rating: 4 },
    ];

    // ── HUD DOM elements (one per planet, independent fade) ──────────────
    const _HUD_CSS = `position:fixed;pointer-events:none;font-family:'Bungee Hairline',sans-serif;text-transform:uppercase;letter-spacing:0.12em;opacity:0;transition:none;z-index:10;transform:translate(-50%,-250px);`;
    let menuEls = [];

    // ── Detail view UI ────────────────────────────────────────────────────
    // ── Tracer border SVG helper (same glow-orbit effect as dashboard) ────────
    const _tracerSVG = (col, count = null) => {
      const n = count ?? (Math.floor(Math.random() * 3) + 1);
      const PERIOD = 8;
      const rects = Array.from({ length: n }, (_, i) => {
        const delay = -((i / n) * PERIOD).toFixed(2);
        return `<rect x="1" y="1" width="99%" height="99%" fill="none"
          stroke="${col}" stroke-width="1" pathLength="1000"
          style="stroke-dasharray:35 965;animation:pvTracer ${PERIOD}s linear infinite;animation-delay:${delay}s;
          filter:drop-shadow(0 0 3px ${col}) drop-shadow(0 0 7px ${col}50)"/>`;
      }).join('');
      return `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
    };

    // ── Spring-physics 3D tilt for DOM elements ────────────────────────────
    function addTilt(el, maxDeg = 10) {
      let tx = 0, ty = 0, cx = 0, cy = 0, vx = 0, vy = 0, rafId = null;
      const STIFF = 0.055, DAMP = 0.84;
      function tick() {
        vx = vx * DAMP + (tx - cx) * STIFF;
        vy = vy * DAMP + (ty - cy) * STIFF;
        cx += vx; cy += vy;
        el.style.transform = `perspective(500px) rotateX(${cy}deg) rotateY(${cx}deg)`;
        if (Math.abs(cx-tx)>0.02||Math.abs(cy-ty)>0.02||Math.abs(vx)>0.02||Math.abs(vy)>0.02) {
          rafId = requestAnimationFrame(tick);
        } else { cx=tx; cy=ty; vx=0; vy=0; rafId=null; }
      }
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width  - 0.5;
        const ny = (e.clientY - r.top)  / r.height - 0.5;
        tx =  nx * maxDeg * 2;
        ty = -ny * maxDeg * 2;
        if (!rafId) rafId = requestAnimationFrame(tick);
      });
      el.addEventListener('mouseleave', () => {
        tx = 0; ty = 0;
        if (!rafId) rafId = requestAnimationFrame(tick);
      });
    }

    const detailStyle = document.createElement('style');
    detailStyle.textContent = `
      @keyframes pvTracer {
        from { stroke-dashoffset: 0; }
        to   { stroke-dashoffset: -1000; }
      }
      #dv-back {
        position:fixed; top:88px; left:32px; z-index:300;
        background:rgba(0,0,0,0.55); border:none;
        color:#fff; font-family:'Bungee Hairline',sans-serif;
        font-size:13px; letter-spacing:0.2em;
        padding:8px 20px; cursor:pointer;
        opacity:0; transition:opacity 0.4s;
        pointer-events:none;
        overflow:visible;
      }
      #dv-back.visible { opacity:1; pointer-events:auto; }
      #dv-back:hover { color:rgba(255,255,255,0.8); }

      @keyframes glowPulse {
        0%, 100% { filter: drop-shadow(0 0 2px var(--glow-color)); opacity: 0.75; }
        50%       { filter: drop-shadow(0 0 14px var(--glow-color)) drop-shadow(0 0 32px #8fd4ff); opacity: 1; }
      }
      #proj-title-display {
        position: fixed;
        top: 110px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 300;
        text-align: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.4s;
        white-space: nowrap;
      }
      #proj-title-display.visible { opacity: 1; }
      #proj-title-display .ptd-name {
        --glow-color: #fff;
        font-family: 'Rubik Mono One', 'Bungee Hairline', sans-serif;
        font-size: 26px; letter-spacing: 0.1em; text-transform: uppercase;
        line-height: 1; display: block;
        background: var(--glow-color);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: glowPulse 2.4s ease-in-out infinite;
      }

      #proj-back {
        position:fixed; top:88px; left:32px; z-index:300;
        background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.18);
        color:#fff; font-family:'Bungee Hairline',sans-serif;
        font-size:13px; letter-spacing:0.2em;
        padding:8px 20px; cursor:pointer;
        clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px));
        filter:drop-shadow(0 0 6px rgba(255,255,255,0.25));
        opacity:0; transition:opacity 0.35s, filter 0.2s;
        pointer-events:none;
        overflow:visible;
      }
      #proj-back.visible { opacity:1; pointer-events:auto; }
      #proj-back:hover { color:rgba(255,255,255,0.8); filter:drop-shadow(0 0 10px rgba(255,255,255,0.5)); }

      #dv-planet {
        position:fixed; top:100px; right:32px; z-index:300;
        display:flex; align-items:center; gap:12px;
        opacity:0; transition:opacity 0.4s; pointer-events:none;
      }
      #dv-planet.visible { opacity:1; }
      #dv-planet-dot {
        width:18px; height:18px; border-radius:50%;
        box-shadow:0 0 12px 4px currentColor;
      }
      #dv-planet-name {
        font-family:'Bungee Hairline',sans-serif;
        font-size:15px; letter-spacing:0.25em; color:#fff;
      }

      .dv-pin {
        position:fixed; z-index:100;
        font-family:'Bungee Hairline',sans-serif;
        font-size:11px; letter-spacing:0.18em; color:#fff;
        display:flex; flex-direction:column-reverse; align-items:center; gap:10px;
        opacity:0; transition:opacity 0.25s;
        pointer-events:none; transform:translateX(-50%);
        white-space:nowrap;
      }
      .dv-pin.visible { opacity:1; }
      .dv-pin-dot {
        width:7px; height:7px; border-radius:50%;
        background:#fff; flex-shrink:0;
        box-shadow:0 0 8px 2px rgba(255,255,255,0.8);
        transition:width 0.25s,height 0.25s,box-shadow 0.25s;
      }
      .dv-pin.blender-big .dv-pin-dot {
        width:13px; height:13px;
        box-shadow:0 0 14px 4px rgba(255,255,255,0.9);
      }
      .dv-pin span {
        padding:4px 10px 4px 8px;
        background:rgba(0,0,0,0.75);
        border:1px solid rgba(255,255,255,0.18);
        backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);
        text-transform:uppercase;
        text-shadow:0 0 8px currentColor;
        clip-path:polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
        transition:opacity 0.2s,transform 0.2s;
      }
      .dv-pin.dim span {
        opacity:0;
        transform:scale(0.85);
        pointer-events:none;
      }
    `;
    document.head.appendChild(detailStyle);

    // ── Planet carousel styles — left side ───────────────────────────────
    const sidebarStyle = document.createElement('style');
    sidebarStyle.textContent = `
      @keyframes pcDotPulse {
        0%,100% { box-shadow: 0 0 4px 2px currentColor; }
        50%      { box-shadow: 0 0 10px 5px currentColor; }
      }
      @keyframes pcOrbSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      /* ── Outer wrapper ── */
      #planet-sidebar {
        position: fixed;
        left: 28px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 100;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 14px;
        opacity: 0;
        pointer-events: none;
      }

      /* Stage column (arrows + stage stacked) */
      #pc-stage-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      /* ── Slot-machine stage — clips above/below, fades edges ── */
      #pc-stage {
        position: relative;
        width: 174px;
        height: 650px;          /* shows 3 cards: 1 above + active + 1 below */
        overflow: hidden;
        -webkit-mask-image: linear-gradient(
          to bottom,
          transparent 0%,
          black 18%,
          black 82%,
          transparent 100%
        );
        mask-image: linear-gradient(
          to bottom,
          transparent 0%,
          black 18%,
          black 82%,
          transparent 100%
        );
      }

      /* ── Arrow buttons above/below stage ── */
      .pc-arrow-btn {
        width: 36px; height: 28px;
        background: none;
        border: none;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: transform 0.12s, filter 0.18s;
        filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));
      }
      .pc-arrow-btn:hover {
        transform: scale(1.2);
        filter: drop-shadow(0 0 8px rgba(255,255,255,0.95)) drop-shadow(0 0 18px rgba(255,255,255,0.5));
      }
      .pc-arrow-btn:active { transform: scale(0.9); }
      .pc-arrow-btn svg { pointer-events: none; }
      @keyframes pcArrowEchoUp {
        0%   { transform: translateY(0);     opacity: 1; filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
        100% { transform: translateY(-18px); opacity: 0; filter: drop-shadow(0 0 2px rgba(255,255,255,0.1)); }
      }
      @keyframes pcArrowEchoDown {
        0%   { transform: translateY(0);    opacity: 1; filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
        100% { transform: translateY(18px); opacity: 0; filter: drop-shadow(0 0 2px rgba(255,255,255,0.1)); }
      }
      .pc-arrow-btn.pulse-up   { animation: pcArrowEchoUp   0.4s ease-out forwards; }
      .pc-arrow-btn.pulse-down { animation: pcArrowEchoDown 0.4s ease-out forwards; }

      /* ── Card — all stacked, JS applies per-card translateY + scale ── */
      .pcard {
        width: 170px;
        height: 190px;
        background: rgba(2,1,10,0.88);
        border: 1px solid;
        cursor: pointer;
        position: absolute;
        left: 2px;              /* slight inset for clip-path glow room */
        transform-origin: center center;
        clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
        font-family: 'Bungee Hairline', sans-serif;
        text-transform: uppercase;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 10px;
        box-sizing: border-box;
        overflow: hidden;
        will-change: transform, opacity;
      }
      /* top-left sheen */
      .pcard::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(140deg, rgba(255,255,255,0.055) 0%, transparent 50%);
        pointer-events: none;
      }

      /* ── Top-down orb ── */
      .pc-orb {
        position: relative;
        width: 112px; height: 112px;
        border-radius: 50%;
        flex-shrink: 0;
        overflow: hidden;
      }
      /* dashed orbit ring outside */
      .pc-orb::after {
        content: '';
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        border: 1px dashed;
        opacity: 0.3;
        animation: pcOrbSpin 18s linear infinite;
      }
      /* grid lines svg inside orb */
      .pc-orb-grid {
        position: absolute; inset: 0;
        pointer-events: none;
      }
      /* icon centred in orb */
      .pc-orb-icon {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .pc-orb-icon img {
        width: 52px; height: 52px;
        border-radius: 50%; object-fit: contain;
        pointer-events: none;
      }

      /* ── Name label ── */
      .pc-name {
        font-size: 14px;
        letter-spacing: 0.22em;
        text-align: center;
        line-height: 1;
      }

      /* ── Dot column ── */
      #pc-dots {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .pc-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        border: 1px solid;
        cursor: pointer;
        opacity: 0.28;
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s;
      }
      .pc-dot.active {
        opacity: 1;
        transform: scale(1.55);
        animation: pcDotPulse 2s ease-in-out infinite;
      }
      .pc-dot:hover { opacity: 0.7; transform: scale(1.3); }
    `;
    document.head.appendChild(sidebarStyle);

    const dvBack = document.createElement('button');
    dvBack.id = 'dv-back';
    dvBack.innerHTML = `<span style="position:relative;z-index:1">← SOLAR SYSTEM</span>`;
    document.body.appendChild(dvBack);

    const projBack = document.createElement('button');
    projBack.id = 'proj-back';
    projBack.textContent = '← BACK TO PROJECTS';
    document.body.appendChild(projBack);

    const projTitleDisplay = document.createElement('div');
    projTitleDisplay.id = 'proj-title-display';
    projTitleDisplay.innerHTML = `<span class="ptd-name"></span>`;
    document.body.appendChild(projTitleDisplay);

    const dvPlanet = document.createElement('div');
    dvPlanet.id = 'dv-planet';
    dvPlanet.innerHTML = `<div id="dv-planet-dot"></div><div id="dv-planet-name"></div>`;
    document.body.appendChild(dvPlanet);

    // 35 pin label elements (must match PIN_MAX — Blender has the most files)
    const dvPins = Array.from({ length: 35 }, (_, pi) => {
      const el = document.createElement('div');
      el.className = 'dv-pin';
      el.innerHTML = `<div class="dv-pin-dot"></div><span></span>`;
      document.body.appendChild(el);
      return el;
    });

    // Pin hover label
    // Back button handler
    dvBack.addEventListener('click', () => { if (!planetExitAllowed || Date.now() - projFileClosedAt < 1500) return; detailPlanetIdx = -1; projDetailIdx = -1; projDetailTimer = 0; setScrollEnabled?.(true); dvBack.blur(); _bgFadeTo(BG_NORMAL_VOL, 2000); });
    projBack.addEventListener('click', () => { if (Date.now() - projDetailOpenedAt < 1500) return; _playSound(_exitFileAudio, 0.8); projDetailIdx = -1; projFileClosedAt = Date.now(); if (dtTwInterval) { clearInterval(dtTwInterval); dtTwInterval = null; } prevDetailVisible = false; _bgFadeTo(BG_NORMAL_VOL, 2000); });

    // ── Blender grid constants (must be before grid panel creation) ──────────
    const BLENDER_PLANET_IDX = 1;
    const BLENDER_GRID_COLS  = 7;
    const BLENDER_GRID_ROWS  = 5;

    // ── Project cards panel (shown in planet detail view) ─────────────────
    const projPanelStyle = document.createElement('style');
    projPanelStyle.textContent = `
      #project-panel {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 115px;
        z-index: 100;
        overflow: visible;
        opacity: 0;
        pointer-events: none;
        height: 0;
      }
      #proj-dots {
        position: fixed;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.3s;
      }
      .proj-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        border: 1px solid currentColor;
        background: transparent;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s, background 0.2s;
      }
      .proj-dot.active {
        transform: scale(1.6);
        background: currentColor;
        box-shadow: 0 0 8px 3px currentColor;
      }
      /* ── outer wrapper — no clip, no overflow clip, files can fan freely ── */
      .proj-card-wrap {
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 260px;
        font-family: 'Bungee Hairline', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.10em;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
      }
      /* ── spread files — sit behind the folder face, slide up on hover ── */
      .proj-file {
        position: absolute;
        left: calc(50% - 120px);
        bottom: 0;
        width: 240px;
        height: 180px;
        border: 1px solid;
        box-sizing: border-box;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 7px;
        overflow: hidden;
        clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        transition: transform 0.30s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease;
        transform: translateY(0px) translateX(0px);
        opacity: 0;
        pointer-events: none;
        z-index: 0;
      }
      .proj-file img,
      .proj-file video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        pointer-events: none;
      }
      .proj-card-wrap:hover .proj-file,
      .proj-card-active .proj-file {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(-210px) translateX(var(--fan-x, 0px));
      }
      .proj-file-no-content { pointer-events: none !important; }
      .proj-file-line {
        height: 1px;
        opacity: 0.25;
        flex-shrink: 0;
      }
      .proj-file-datarow {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .proj-file-chip {
        font-size: 6px;
        letter-spacing: 0.2em;
        padding: 2px 5px;
        border: 1px solid;
        opacity: 0.55;
      }
      /* ── actual folder face (clipped, on top of files) ── */
      .proj-folder-face {
        width: 100%;
        background: rgba(4,4,6,0.9);
        border: 1px solid;
        position: relative;
        z-index: 2;
        clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        transition: background 0.25s;
      }
      .proj-card-wrap:hover .proj-folder-face { background: rgba(10,10,18,0.97); }
      .proj-card-corner {
        position: absolute; top: 0; right: 0;
        pointer-events: none; z-index: 3;
      }
      /* ── folder tab ── */
      .proj-folder-tab {
        padding: 5px 16px 4px 9px;
        display: flex;
        align-items: baseline;
        gap: 8px;
        border-bottom: 1px solid;
        flex-shrink: 0;
      }
      .proj-folder-tab-id {
        font-size: 6px;
        letter-spacing: 0.5em;
        opacity: 0.35;
      }
      .proj-folder-tab-name {
        font-size: 10px;
        letter-spacing: 0.22em;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* ── folder body ── */
      .proj-folder-body {
        padding: 8px 10px 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      /* ── thumbnail ── */
      .proj-thumb {
        width: 100%;
        height: 120px;
        position: relative;
        overflow: hidden;
        border: 1px solid;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .proj-thumb-scanline {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg, transparent, transparent 2px,
          rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px
        );
        pointer-events: none;
        z-index: 2;
      }
      /* ── meta boxes ── */
      .proj-meta-row {
        display: flex;
        gap: 5px;
      }
      .proj-metabox {
        flex: 1;
        border: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.025);
        padding: 4px 5px;
        box-sizing: border-box;
      }
      .proj-metabox-label {
        font-size: 5px;
        letter-spacing: 0.5em;
        opacity: 0.3;
        display: block;
        margin-bottom: 2px;
      }
      .proj-metabox-val {
        font-size: 8px;
        letter-spacing: 0.1em;
        display: block;
      }
    `;
    document.head.appendChild(projPanelStyle);

    const projPanel = document.createElement('div');
    projPanel.id = 'project-panel';
    document.body.appendChild(projPanel);

    // ── Blender grid panel ────────────────────────────────────────────────
    const blenderGridStyle = document.createElement('style');
    blenderGridStyle.textContent = `
      #blender-grid-panel {
        position: fixed;
        left: 50%;
        bottom: 72px;
        transform: translateX(-50%);
        z-index: 100;
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 0;
        pointer-events: auto;
      }
      #blender-grid {
        display: grid;
        grid-template-columns: repeat(7, 172px);
        grid-template-rows: repeat(5, 130px);
        gap: 8px;
      }
      .bg-cell {
        width: 172px;
        height: 130px;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid rgba(232,125,13,0.28);
        background: rgba(4,4,6,0.82);
        cursor: pointer;
        transition: border-color 0.22s, box-shadow 0.22s, transform 0.28s cubic-bezier(0.34,1.56,0.64,1), z-index 0s;
        clip-path: none;
        z-index: 1;
      }
      .bg-cell img, .bg-cell video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        display: block;
        pointer-events: none;
        transform: scale(0.94) translateY(-9px);
        filter: drop-shadow(0 0 4px rgba(232,125,13,0.3)) drop-shadow(0 0 9px rgba(232,125,13,0.12));
        transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), filter 0.28s;
      }
      .bg-cell-label {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        padding: 3px 6px;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 7px;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: rgba(232,125,13,0.7);
        background: rgba(4,4,6,0.72);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: opacity 0.22s;
      }
      .bg-cell.bg-active {
        border-color: #e87d0d;
        box-shadow: 0 0 22px 5px rgba(232,125,13,0.6), inset 0 0 10px 2px rgba(232,125,13,0.18);
        transform: scale(1.22);
        z-index: 10;
      }
      .bg-cell.bg-active .bg-cell-label {
        opacity: 1;
        font-size: 8px;
      }
      .bg-cell:not(.bg-active):not(.bg-entering):hover {
        border-color: rgba(232,125,13,0.7);
        transform: scale(1.06);
        z-index: 5;
      }
      .bg-cell.bg-entering:hover {
        border-color: rgba(232,125,13,0.45);
        box-shadow: 0 0 10px 2px rgba(232,125,13,0.18);
      }
      @keyframes bg-cell-bounce {
        0%   { transform: scale(1.22); }
        30%  { transform: scale(1.08); }
        60%  { transform: scale(1.28); }
        80%  { transform: scale(1.19); }
        100% { transform: scale(1.22); }
      }
      .bg-cell.bg-bounce {
        animation: bg-cell-bounce 0.38s cubic-bezier(0.36,0.07,0.19,0.97);
      }
      @keyframes bg-cell-enter {
        0%   { opacity: 0; transform: scale(0.6); box-shadow: none; }
        40%  { opacity: 0.6; transform: scale(1.04); box-shadow: 0 0 28px 8px rgba(232,125,13,0.35), inset 0 0 12px 2px rgba(232,125,13,0.12); }
        70%  { opacity: 0.9; transform: scale(1.0); box-shadow: 0 0 14px 4px rgba(232,125,13,0.18); }
        100% { opacity: 1; transform: scale(1); box-shadow: none; }
      }
      .bg-cell.bg-entering {
        animation: bg-cell-enter 1.4s cubic-bezier(0.16,1,0.3,1) both;
      }
      .bg-cell-empty {
        cursor: default;
        pointer-events: auto;
      }
      .bg-cell-empty:not(.bg-entering) {
        opacity: 0.6 !important;
        border-color: rgba(232,125,13,0.1) !important;
        box-shadow: none !important;
        transform: none !important;
      }
      .bg-cell-empty:not(.bg-entering):hover {
        transform: none !important;
        border-color: rgba(232,125,13,0.1) !important;
      }
      @keyframes qm-float {
        0%,100% { transform: translateY(0px) rotate(-4deg); opacity: 0.55; }
        50%      { transform: translateY(-7px) rotate(4deg); opacity: 0.85; }
      }
      .bg-cell-no-content {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .qm-single {
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 26px;
        color: rgba(255,150,30,0.95);
        text-shadow: 0 0 8px rgba(255,150,30,1), 0 0 22px rgba(232,125,13,0.7), 0 0 40px rgba(200,80,0,0.4);
        animation: qm-float var(--dur) ease-in-out infinite;
        animation-delay: var(--dl);
        user-select: none;
      }
      #blender-grid-hint {
        margin-top: 10px;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 7px;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: rgba(232,125,13,0.45);
        text-align: center;
      }
    `;
    document.head.appendChild(blenderGridStyle);

    const blenderGridPanel = document.createElement('div');
    blenderGridPanel.id = 'blender-grid-panel';
    const blenderGridEl = document.createElement('div');
    blenderGridEl.id = 'blender-grid';
    blenderGridPanel.appendChild(blenderGridEl);
    const blenderGridHint = document.createElement('div');
    blenderGridHint.id = 'blender-grid-hint';
    blenderGridHint.textContent = '↑ ↓ ← →  NAVIGATE   ENTER  OPEN';
    blenderGridPanel.appendChild(blenderGridHint);
    document.body.appendChild(blenderGridPanel);
    // Cells are built after APPLICATIONS is defined (see below)
    let blenderGridCells = [];


    let _bgGridWasVisible = false;
    let _bgGridLocked = false;
    let _bgGridLockTimer = null;

    function _triggerDiagonalEntrance() {
      if (_bgGridLockTimer) clearTimeout(_bgGridLockTimer);
      _bgGridLocked = true;
      _bgGridLockTimer = setTimeout(() => { _bgGridLocked = false; }, 500);
      blenderGridCells.forEach((cell, i) => {
        const row = Math.floor(i / BLENDER_GRID_COLS);
        const col = i % BLENDER_GRID_COLS;
        const delay = 1000 + (row + col) * 90; // 1s initial delay + diagonal stagger
        cell.classList.remove('bg-entering');
        void cell.offsetWidth;
        cell.style.animationDelay = delay + 'ms';
        cell.classList.add('bg-entering');
        cell.addEventListener('animationend', () => cell.classList.remove('bg-entering'), { once: true });
      });
    }

    function _cancelCellEnter(cell) {
      if (!cell.classList.contains('bg-entering')) return;
      const liveTransform = window.getComputedStyle(cell).transform;
      cell.classList.remove('bg-entering');
      cell.style.animationDelay = '';
      cell.style.transform = liveTransform; // hold current mid-animation scale
      requestAnimationFrame(() => {
        cell.style.transform = ''; // release — CSS transition carries it to bg-active
      });
    }

    function _refreshBlenderGrid(animate) {
      blenderGridCells.forEach((cell, i) => {
        const active = i === blenderGridIdx;
        cell.classList.toggle('bg-active', active);
        if (active) _cancelCellEnter(cell);
      });
      if (blenderGridCells[blenderGridIdx]) {
        blenderGridCells[blenderGridIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }

    function _bgCellBounce(idx) {
      const cell = blenderGridCells[idx];
      if (!cell) return;
      _cancelCellEnter(cell);
      cell.classList.remove('bg-bounce');
      void cell.offsetWidth;
      cell.classList.add('bg-bounce');
      cell.addEventListener('animationend', () => cell.classList.remove('bg-bounce'), { once: true });
    }

    // ── Planet loader ──────────────────────────────────────────────────────
    const planetLoaderStyle = document.createElement('style');
    const PL_R = 180, PL_CIRC = +(2 * Math.PI * PL_R).toFixed(2);
    planetLoaderStyle.textContent = `
      #planet-loader {
        position: fixed; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        z-index: 280; pointer-events: none;
        opacity: 0; transition: opacity 0.45s;
        display: flex; align-items: center; justify-content: center;
      }
      #planet-loader.visible { opacity: 1; }
      #pl-track { fill: none; stroke: rgba(255,255,255,0.07); stroke-width: 5; }
      #pl-ring  {
        fill: none; stroke-width: 7;
        stroke-linecap: round;
        stroke-dasharray: ${PL_CIRC};
        stroke-dashoffset: ${PL_CIRC};
        transform: rotate(-90deg); transform-origin: 50% 50%;
        transition: stroke 0.4s;
      }
      @keyframes plRingBreath {
        0%, 100% { stroke-width: 7;   filter: drop-shadow(0 0 2px var(--pl-col, white)); }
        50%       { stroke-width: 8.5; filter: drop-shadow(0 0 6px var(--pl-col, white)) drop-shadow(0 0 12px var(--pl-col, white)); }
      }
      @keyframes plPctBreath {
        0%, 100% { opacity: 0.7; letter-spacing: 0.19em; filter: drop-shadow(0 0 4px var(--pl-col, white)); }
        50%       { opacity: 1;   letter-spacing: 0.24em; filter: drop-shadow(0 0 14px var(--pl-col, white)) drop-shadow(0 0 28px var(--pl-col, white)); }
      }
      @keyframes plLabelBreath {
        0%, 100% { opacity: 0.45; letter-spacing: 0.42em; filter: drop-shadow(0 0 3px var(--pl-col, white)); }
        50%       { opacity: 0.85; letter-spacing: 0.52em; filter: drop-shadow(0 0 10px var(--pl-col, white)) drop-shadow(0 0 20px var(--pl-col, white)); }
      }
      #planet-loader:not(.done) svg {
        animation: plRingBreath 1.8s ease-in-out infinite;
      }
      #planet-loader:not(.done) #pl-pct {
        animation: plPctBreath 1.8s ease-in-out infinite;
      }
      #planet-loader:not(.done) #pl-label {
        animation: plLabelBreath 1.8s ease-in-out infinite;
      }
      #pl-pct {
        position: absolute;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 44px; letter-spacing: 0.2em;
        color: rgba(255,255,255,0.7);
      }
      #pl-label {
        position: absolute; top: calc(50% + 164px);
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 18px; letter-spacing: 0.45em;
        color: rgba(255,255,255,0.3); text-transform: uppercase;
        white-space: nowrap;
      }
      .pl-burst {
        position: absolute; inset: 0; margin: auto;
        width: 240px; height: 240px;
        border-radius: 50%; pointer-events: none;
        border: 1.5px solid var(--pl-col, white);
        opacity: 0; will-change: transform, opacity;
      }
      @keyframes plBurst {
        0%   { transform: scale(1);   opacity: 0.8; }
        60%  { opacity: 0.15; }
        100% { transform: scale(2.6); opacity: 0; }
      }
      #pl-screen-ripple {
        position: fixed; inset: 0; z-index: 275;
        pointer-events: none; opacity: 0;
      }
      #pl-screen-ripple.active {
        animation: plScreenRipple 1.3s cubic-bezier(0.1,0,0.6,1) forwards;
      }
      @keyframes plCompletePulse {
        0%   { transform: scale(1);    opacity: 1; }
        25%  { transform: scale(1.12); opacity: 1; }
        55%  { transform: scale(0.97); opacity: 0.95; }
        80%  { transform: scale(1.05); opacity: 0.85; }
        100% { transform: scale(1);    opacity: 0.7; }
      }
      @keyframes plRingFlash {
        0%   { filter: drop-shadow(0 0 2px var(--pl-col, white)); }
        30%  { filter: drop-shadow(0 0 8px var(--pl-col, white)) drop-shadow(0 0 16px var(--pl-col, white)); }
        70%  { filter: drop-shadow(0 0 5px var(--pl-col, white)); }
        100% { filter: drop-shadow(0 0 2px var(--pl-col, white)); }
      }
      #planet-loader.done #pl-pct {
        animation: plCompletePulse 0.85s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      #planet-loader.done svg {
        animation: plRingFlash 0.85s ease-out forwards;
      }
      @keyframes plLabelPulse {
        0%   { transform: scale(1);    opacity: 0.3; letter-spacing: 0.45em; }
        28%  { transform: scale(1.1);  opacity: 0.85; letter-spacing: 0.6em; }
        60%  { transform: scale(0.97); opacity: 0.6;  letter-spacing: 0.5em; }
        100% { transform: scale(1);    opacity: 0.3;  letter-spacing: 0.45em; }
      }
      #planet-loader.done #pl-label {
        animation: plLabelPulse 0.85s cubic-bezier(0.22,1,0.36,1) forwards;
      }
      @keyframes plDotPulse {
        0%   { transform: scale(1);   box-shadow: 0 0 0px 0px currentColor; }
        30%  { transform: scale(1.6); box-shadow: 0 0 7px 2px currentColor; background: currentColor; }
        100% { transform: scale(1);   box-shadow: 0 0 0px 0px currentColor; background: transparent; }
      }
      @keyframes plDotPulseActive {
        0%   { transform: scale(1.6); box-shadow: 0 0 8px 3px currentColor; }
        30%  { transform: scale(2.4); box-shadow: 0 0 14px 5px currentColor; }
        100% { transform: scale(1.6); box-shadow: 0 0 8px 3px currentColor; }
      }
    `;
    document.head.appendChild(planetLoaderStyle);
    const planetLoaderEl = document.createElement('div');
    planetLoaderEl.id = 'planet-loader';
    planetLoaderEl.innerHTML = `
      <div class="pl-burst" id="pl-burst-1"></div>
      <div class="pl-burst" id="pl-burst-2"></div>
      <div class="pl-burst" id="pl-burst-3"></div>
      <div class="pl-burst" id="pl-burst-4"></div>
      <svg width="440" height="440" viewBox="0 0 440 440">
        <circle id="pl-track" cx="220" cy="220" r="${PL_R}"/>
        <circle id="pl-ring"  cx="220" cy="220" r="${PL_R}" stroke="rgba(255,255,255,0.6)"/>
      </svg>
      <span id="pl-pct">0%</span>
      <span id="pl-label">Loading Planet</span>
    `;
    document.body.appendChild(planetLoaderEl);

    const plScreenRipple = document.createElement('div');
    plScreenRipple.id = 'pl-screen-ripple';
    document.body.appendChild(plScreenRipple);

    const plRing  = planetLoaderEl.querySelector('#pl-ring');
    const plPct   = planetLoaderEl.querySelector('#pl-pct');
    const plLabel = planetLoaderEl.querySelector('#pl-label');

    const projDotsEl = document.createElement('div');
    projDotsEl.id = 'proj-dots';
    document.body.appendChild(projDotsEl);
    const projDots = Array.from({ length: 5 }, (_, i) => {
      const dot = document.createElement('div');
      dot.className = 'proj-dot';
      dot.addEventListener('mouseenter', () => { window.__projPanelHover = true; });
      dot.addEventListener('mouseleave', () => { window.__projPanelHover = false; });
      dot.addEventListener('click', () => { if (!(plDoneAt > 0 && Date.now() - plDoneAt >= 1700)) return; projCarouselGo(i - projCarouselIdx); });
      projDotsEl.appendChild(dot);
      return dot;
    });

    let projCarouselIdx = 0;

    // ── Planet icon panel (bottom-left, detail view) ───────────────────────
    const iconPanelStyle = document.createElement('style');
    iconPanelStyle.textContent = `
      #planet-icon-panel {
        position: fixed;
        bottom: 36px;
        left: 32px;
        z-index: 500;
        opacity: 0;
        pointer-events: none;
        font-family: 'Bungee Hairline', sans-serif;
      }
      #planet-icon-panel .pip-frame {
        position: relative;
        width: 180px;
        padding: 18px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      #planet-icon-panel .pip-corner {
        position: absolute;
        width: 22px; height: 22px;
      }
      #planet-icon-panel .pip-tl { top: 0; left: 0; }
      #planet-icon-panel .pip-tr { top: 0; right: 0; transform: scaleX(-1); }
      #planet-icon-panel .pip-bl { bottom: 0; left: 0; transform: scaleY(-1); }
      #planet-icon-panel .pip-br { bottom: 0; right: 0; transform: scale(-1,-1); }
      #planet-icon-panel .pip-img-wrap {
        width: 120px; height: 120px;
        display: flex; align-items: center; justify-content: center;
        position: relative;
      }
      #planet-icon-panel .pip-img-wrap::before {
        content: '';
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        border: 1px solid;
        opacity: 0.35;
      }
      #planet-icon-panel .pip-img-wrap::after {
        content: '';
        position: absolute;
        inset: -18px;
        border-radius: 50%;
        border: 1px dashed;
        opacity: 0.18;
      }
      #planet-icon-panel .pip-icon {
        width: 110px; height: 110px;
        object-fit: contain;
        filter: drop-shadow(0 0 18px currentColor);
      }
      #planet-icon-panel .pip-divider {
        width: 100%;
        height: 1px;
        opacity: 0.3;
      }
      #planet-icon-panel .pip-name {
        font-size: 13px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        text-align: center;
      }
      #planet-icon-panel .pip-rating {
        font-size: 14px;
        letter-spacing: 0.12em;
        opacity: 0.75;
      }
      #planet-icon-panel .pip-tag {
        font-size: 8px;
        letter-spacing: 0.35em;
        opacity: 0.45;
        text-transform: uppercase;
      }
    `;
    document.head.appendChild(iconPanelStyle);

    const _pipCornerSVG = (col) => `<svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <polyline points="0,14 0,0 14,0" stroke="${col}" stroke-width="1.5" fill="none"/>
      <rect x="0" y="0" width="3" height="3" fill="${col}"/>
    </svg>`;

    const iconPanel = document.createElement('div');
    iconPanel.id = 'planet-icon-panel';
    document.body.appendChild(iconPanel);

    // ── File tree panel ───────────────────────────────────────────────────
    const fileTreeStyle = document.createElement('style');
    fileTreeStyle.textContent = `
      #file-tree-panel {
        position: fixed;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s;
        font-family: 'Bungee Hairline', sans-serif;
        z-index: 200;
        background: linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 22%);
      }
      #file-tree-panel.visible { opacity: 1; pointer-events: auto; }
      .fp-content {
        width: 480px;
        margin-left: auto;
        padding: 58px 32px 24px;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-sizing: border-box;
      }
      .fp-fixed-header {
        flex-shrink: 0;
        padding-bottom: 16px;
        margin-bottom: 0;
      }
      .fp-scroll-body {
        flex: 1;
        overflow-y: scroll;
        overflow-x: hidden;
        padding-top: 16px;
      }
      .fp-scroll-body::-webkit-scrollbar { display: none; }
      .fp-scroll-body { scrollbar-width: none; }
      .ftp-header {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 14px; padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      .ftp-path {
        font-size: 9px; letter-spacing: 0.4em;
        text-transform: uppercase; opacity: 0.5;
      }
      .ftp-header-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: currentColor; flex-shrink: 0;
        box-shadow: 0 0 6px 2px currentColor;
      }
      .ftp-row {
        display: flex; align-items: center;
        gap: 7px; padding: 5px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        cursor: default;
        transition: background 0.15s;
        border-radius: 2px;
      }
      .ftp-row:hover { background: rgba(255,255,255,0.04); }
      .ftp-indent {
        display: flex; align-items: center; gap: 0; flex-shrink: 0;
      }
      .ftp-indent-unit {
        width: 14px; height: 100%;
        border-left: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      .ftp-icon {
        font-size: 8px; opacity: 0.55; flex-shrink: 0; width: 10px;
      }
      .ftp-ext {
        font-size: 7px; letter-spacing: 0.18em;
        padding: 1px 4px;
        border: 1px solid rgba(255,255,255,0.15);
        opacity: 0.7; flex-shrink: 0;
        min-width: 26px; text-align: center;
      }
      .ftp-name {
        font-size: 11px; letter-spacing: 0.08em;
        color: #fff; flex: 1; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
      .ftp-dir .ftp-name { opacity: 0.85; }
      .ftp-size {
        font-size: 8px; letter-spacing: 0.1em;
        opacity: 0.35; flex-shrink: 0; padding-right: 4px;
      }
      .ftp-special {
        margin-bottom: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden;
      }
      .ftp-special-header {
        display: flex; align-items: center; gap: 7px;
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
      }
      .ftp-img-file {
        width: 100%; height: 160px;
        display: block; object-fit: cover;
        opacity: 0.88;
      }
      .ftp-img-placeholder {
        width: 100%; height: 160px;
        display: flex; align-items: center; justify-content: center;
        font-size: 8px; letter-spacing: 0.45em;
        text-transform: uppercase; opacity: 0.18;
        background: rgba(255,255,255,0.02);
      }
      .ftp-bio-body {
        padding: 10px 10px 12px;
        display: flex; flex-direction: column; gap: 0;
      }
      .ftp-bio-desc {
        font-size: 10px; line-height: 1.75; letter-spacing: 0.05em;
        color: rgba(255,255,255,0.55);
        padding-bottom: 10px;
        margin-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ftp-bio-field {
        display: flex; align-items: baseline; gap: 8px;
        padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .ftp-bio-field:last-child { border-bottom: none; }
      .ftp-bio-key {
        font-size: 7px; letter-spacing: 0.45em; text-transform: uppercase;
        opacity: 0.35; flex-shrink: 0; width: 48px;
      }
      .ftp-bio-val {
        font-size: 10px; letter-spacing: 0.1em; color: #fff; opacity: 0.8;
      }
      .ftp-bio-chips {
        display: flex; flex-wrap: wrap; gap: 4px;
      }
      .ftp-bio-chip {
        font-size: 7px; letter-spacing: 0.25em; text-transform: uppercase;
        padding: 2px 6px; border: 1px solid; opacity: 0.65;
      }
      .ftp-bio-status {
        font-size: 7px; letter-spacing: 0.4em; text-transform: uppercase;
        padding: 2px 8px; border: 1px solid;
      }
      .ftp-section-sep {
        font-size: 7px; letter-spacing: 0.45em; text-transform: uppercase;
        opacity: 0.25; padding: 10px 0 6px;
      }
      /* ── Project title ── */
      .fp-title {
        font-family: 'Rubik Mono One', 'Bungee Hairline', sans-serif;
        font-size: 38px; letter-spacing: 0.06em; text-transform: uppercase;
        color: #fff; line-height: 1.05;
        margin-bottom: 6px; margin-top: 8px;
        word-break: break-word;
        text-align: center;
      }
      .fp-subtitle {
        font-size: 9px; letter-spacing: 0.45em; text-transform: uppercase;
        opacity: 0.35; text-align: center;
      }
      /* ── Mini-portfolio bio card ── */
      .fp-bio {
        border: 1px solid rgba(255,255,255,0.07);
        padding: 16px 18px 18px;
        margin-bottom: 16px;
        background: rgba(255,255,255,0.02);
      }
      .fp-bio-desc {
        font-size: 12px; line-height: 1.8; letter-spacing: 0.04em;
        color: rgba(255,255,255,0.52);
        padding-bottom: 12px; margin-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .fp-bio-chips {
        display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;
      }
      .fp-chip {
        font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase;
        padding: 3px 9px; border: 1px solid; opacity: 0.65;
      }
      .fp-meta-row {
        display: flex; align-items: baseline; gap: 10px;
        font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase;
        padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .fp-meta-row:last-child { border-bottom: none; }
      .fp-meta-key { opacity: 0.3; flex-shrink: 0; width: 54px; }
      .fp-meta-val { opacity: 0.72; }
      .fp-status {
        font-size: 8px; letter-spacing: 0.4em; padding: 3px 10px;
        border: 1px solid; text-transform: uppercase;
      }
      /* ── Staggered media grid ── */
      .fp-media-grid {
        display: flex; flex-direction: column; gap: 10px;
        margin-bottom: 24px;
      }
      .fp-media-item {
        border: 2px solid rgba(255,255,255,0.28);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5);
        overflow: hidden; position: relative;
        transform-origin: center center;
      }
      .fp-media-item video {
        width: 100%; display: block;
        height: auto; min-height: 200px; max-height: 320px;
        object-fit: cover; background: #0a0a0a;
      }
      .fp-media-item img {
        width: 100%; display: block;
        height: auto; max-height: 320px;
        object-fit: cover;
      }
      .fp-media-label {
        position: absolute; bottom: 7px; left: 10px;
        font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase;
        color: rgba(255,255,255,0.4);
        text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      }
      .fp-no-content {
        display: flex; align-items: center; justify-content: center;
        height: 160px;
        border: 1px dashed rgba(255,255,255,0.12);
        border-radius: 4px;
        font-size: 9px; letter-spacing: 0.4em; text-transform: uppercase;
        color: rgba(255,255,255,0.2);
      }
    `;
    document.head.appendChild(fileTreeStyle);

    const fileTreePanel = document.createElement('div');
    fileTreePanel.id = 'file-tree-panel';
    document.body.appendChild(fileTreePanel);

    // ── Bio panel (centered area below title) ──────────────────────────────
    const bioPanelStyle = document.createElement('style');
    bioPanelStyle.textContent = `
      #bio-panel {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        top: 162px;
        bottom: 24px;
        width: 720px;
        overflow-y: auto;
        overflow-x: hidden;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s;
        z-index: 200;
        scrollbar-width: none;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 8px 48px rgba(0,0,0,0.6);
      }
      #bio-panel.visible { opacity: 1; pointer-events: auto; }
      #bio-panel::-webkit-scrollbar { display: none; }
      #bio-scrollbar {
        position: fixed;
        right: calc(50% - 364px);
        top: 174px;
        bottom: 36px;
        width: 6px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s;
        z-index: 201;
      }
      #bio-scrollbar.visible.tw-ready { opacity: 1; }
      #bio-scrollbar-track {
        position: absolute;
        inset: 0;
        background: rgba(255,255,255,0.03);
        border-left: 1px solid rgba(255,255,255,0.07);
        border-radius: 3px;
      }
      #bio-scrollbar-thumb {
        position: absolute;
        left: 0; right: 0;
        min-height: 28px;
        background: linear-gradient(180deg, #8fd4ff 0%, rgba(143,212,255,0.3) 100%);
        border-radius: 3px;
        border: 1px solid rgba(143,212,255,0.35);
        box-shadow: 0 0 8px rgba(143,212,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3);
      }
      .bp-body {
        font-family: 'Bungee Hairline', sans-serif;
        color: #fff;
        text-shadow: 0 0 8px rgba(255,255,255,0.3);
        font-size: 18px;
        line-height: 1.9;
        letter-spacing: 0.03em;
        overflow: hidden;
        padding: 24px 28px 48px;
      }
      .bp-text { margin: 0 0 20px 0; }
      .bp-img {
        display: block;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.1);
        max-width: 100%;
        object-fit: cover;
      }
      .bp-img-right {
        float: right;
        width: 44%;
        margin: 2px 0 20px 28px;
      }
      .bp-img-left {
        float: left;
        width: 44%;
        margin: 2px 28px 20px 0;
      }
      .bp-clear { clear: both; }
      .bp-meta {
        display: flex; flex-wrap: wrap; gap: 8px 24px;
        margin-bottom: 28px;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .bp-meta-item { display: flex; flex-direction: column; gap: 2px; }
      .bp-meta-key {
        font-size: 10px; letter-spacing: 0.35em;
        color: rgba(255,255,255,0.25); text-transform: uppercase;
      }
      .bp-meta-val { font-size: 14px; color: rgba(255,255,255,0.7); }
      .bp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 28px; }
      .bp-chip {
        font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
        border: 1px solid; border-radius: 2px;
        padding: 4px 10px;
      }
    `;
    document.head.appendChild(bioPanelStyle);

    const bioPanel = document.createElement('div');
    bioPanel.id = 'bio-panel';
    document.body.appendChild(bioPanel);

    const bioScrollbar = document.createElement('div');
    bioScrollbar.id = 'bio-scrollbar';
    bioScrollbar.innerHTML = '<div id="bio-scrollbar-track"></div><div id="bio-scrollbar-thumb"></div>';
    document.body.appendChild(bioScrollbar);
    const bioScrollThumb = bioScrollbar.querySelector('#bio-scrollbar-thumb');
    const _updateBioThumb = () => {
      const scrollable = bioPanel.scrollHeight - bioPanel.clientHeight;
      if (scrollable <= 0) return;
      const trackH = bioScrollbar.clientHeight;
      const thumbH = Math.max(28, trackH * (bioPanel.clientHeight / bioPanel.scrollHeight));
      const thumbTop = (bioPanel.scrollTop / scrollable) * (trackH - thumbH);
      bioScrollThumb.style.height = thumbH + 'px';
      bioScrollThumb.style.top    = thumbTop + 'px';
    };
    bioPanel.addEventListener('scroll', _updateBioThumb, { passive: true });

    // ── 3-D model viewer ──────────────────────────────────────────────────────
    // Canvas sized to fill bottom-right quadrant of screen
    const MODEL_W = Math.round(window.innerWidth  * 0.36);
    const MODEL_H = Math.round(window.innerHeight * 0.44);
    // Bio panel top offset (must match #bio-panel top: 162px)
    const BIO_TOP = 162;

    const modelViewerStyle = document.createElement('style');
    modelViewerStyle.textContent = `
      /* Staggered background box sitting behind the 3-D viewer */
      #model-viewer-bg {
        position: fixed;
        right: 86px;
        bottom: 86px;
        width: ${MODEL_W + 16}px;
        height: ${MODEL_H + 16}px;
        background: rgba(6,2,0,0.92);
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        border: 1px solid rgba(232,125,13,0.32);
        box-shadow: 0 0 28px 4px rgba(232,125,13,0.10), inset 0 0 20px 2px rgba(232,125,13,0.04);
        border-radius: 10px;
        z-index: 200;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s;
      }
      #model-viewer-bg.mv-visible { opacity: 1; }
      /* 3-D viewer: sits above its background box, slightly offset for stagger */
      #model-viewer {
        position: fixed;
        right: 94px;
        bottom: 94px;
        width: ${MODEL_W}px;
        height: ${MODEL_H}px;
        z-index: 201;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s cubic-bezier(0.4,0,0.2,1);
        background: transparent;
        border: none;
        border-radius: 6px;
        box-shadow: 0 0 36px 10px rgba(232,125,13,0.22), 0 0 80px 20px rgba(232,125,13,0.10);
        overflow: visible;
      }
      #model-viewer.mv-visible {
        opacity: 1;
        pointer-events: auto;
      }
      #model-viewer canvas {
        display: block;
        width: ${MODEL_W}px;
        height: ${MODEL_H}px;
      }
      #model-viewer-hint {
        position: absolute;
        bottom: 10px;
        left: 0; right: 0;
        text-align: center;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 7px;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: rgba(232,125,13,0.35);
        pointer-events: none;
      }
      #model-viewer-label {
        position: absolute;
        top: 10px;
        left: 14px;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 7px;
        letter-spacing: 0.45em;
        text-transform: uppercase;
        color: rgba(232,125,13,0.5);
        pointer-events: none;
      }
      #model-viewer-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Bungee Hairline', sans-serif;
        font-size: 8px;
        letter-spacing: 0.5em;
        text-transform: uppercase;
        color: rgba(232,125,13,0.45);
        pointer-events: none;
        transition: opacity 0.3s;
      }
    `;
    document.head.appendChild(modelViewerStyle);

    const modelViewerEl = document.createElement('div');
    modelViewerEl.id = 'model-viewer';
    const modelCanvas = document.createElement('canvas');
    modelCanvas.width  = MODEL_W * Math.min(window.devicePixelRatio, 2);
    modelCanvas.height = MODEL_H * Math.min(window.devicePixelRatio, 2);
    modelViewerEl.appendChild(modelCanvas);
    const modelViewerLabel = document.createElement('div');
    modelViewerLabel.id = 'model-viewer-label';
    modelViewerLabel.textContent = '3D PREVIEW';
    modelViewerEl.appendChild(modelViewerLabel);
    const modelViewerHint = document.createElement('div');
    modelViewerHint.id = 'model-viewer-hint';
    modelViewerHint.textContent = 'DRAG  ROTATE   SCROLL  ZOOM';
    modelViewerEl.appendChild(modelViewerHint);
    const modelViewerLoading = document.createElement('div');
    modelViewerLoading.id = 'model-viewer-loading';
    modelViewerLoading.textContent = 'LOADING MODEL...';
    modelViewerEl.appendChild(modelViewerLoading);
    document.body.appendChild(modelViewerEl);

    const modelViewerBg = document.createElement('div');
    modelViewerBg.id = 'model-viewer-bg';
    document.body.appendChild(modelViewerBg);

    // Separate THREE.js scene for the viewer
    const viewerRenderer = new THREE.WebGLRenderer({ canvas: modelCanvas, antialias: !LOW_END, alpha: true, premultipliedAlpha: false });
    viewerRenderer.setPixelRatio(LOW_END ? 1 : Math.min(window.devicePixelRatio, MED_END ? 1.5 : 2));
    viewerRenderer.setSize(MODEL_W, MODEL_H, true);
    viewerRenderer.setClearColor(0x020100, 1);
    viewerRenderer.outputColorSpace = THREE.SRGBColorSpace;
    viewerRenderer.toneMapping      = THREE.ACESFilmicToneMapping;
    viewerRenderer.toneMappingExposure = 1.3;
    viewerRenderer.shadowMap.enabled = true;

    const viewerScene  = new THREE.Scene();
    const viewerCamera = new THREE.PerspectiveCamera(40, MODEL_W / MODEL_H, 0.01, 500);
    viewerCamera.position.set(0, 0.8, 3.5);

    // Lights
    const vAmbient = new THREE.AmbientLight(0xffffff, 0.9);
    const vKey     = new THREE.DirectionalLight(0xfff5e8, 3.2);
    const vFill    = new THREE.DirectionalLight(0xe87d0d, 0.7);
    const vRim     = new THREE.DirectionalLight(0x88ccff, 0.5);
    vKey.position.set(4, 8, 5);
    vFill.position.set(-5, 1, -3);
    vRim.position.set(0, -3, -6);
    viewerScene.add(vAmbient, vKey, vFill, vRim);

    // Post-processing — bloom for emissive materials
    const viewerComposer = new EffectComposer(viewerRenderer);
    viewerComposer.addPass(new RenderPass(viewerScene, viewerCamera));
    const viewerBloom = new UnrealBloomPass(
      new THREE.Vector2(MODEL_W, MODEL_H),
      0.08,   // strength
      0.3,    // radius
      0.92    // threshold — only emissive bright spots glow
    );
    viewerComposer.addPass(viewerBloom);

    // OrbitControls
    const viewerControls = new OrbitControls(viewerCamera, modelCanvas);
    viewerControls.enableDamping  = true;
    viewerControls.dampingFactor  = 0.14;
    viewerControls.enablePan      = false;
    viewerControls.minDistance    = 2.0;
    viewerControls.maxDistance    = 3.2;
    viewerControls.minPolarAngle  = 0;
    viewerControls.maxPolarAngle  = Math.PI;
    viewerControls.autoRotate     = true;
    viewerControls.autoRotateSpeed = 2.2;

    let _viewerIdleTimer = null;
    function _resetViewerIdle() {
      if (_viewerIdleTimer) clearTimeout(_viewerIdleTimer);
      _viewerIdleTimer = setTimeout(() => {
        viewerControls.autoRotate = true;
      }, 1000);
    }

    // Smooth return-to-home — runs inside the render loop, no separate rAF
    let _HOME_PHI = Math.PI * 0.42; // updated on each model load
    function _nearestSideTheta(theta) {
      const arc = (from, to) => ((to - from + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      const dLeft  = arc(theta, -Math.PI / 2);
      const dRight = arc(theta,  Math.PI / 2);
      return Math.abs(dLeft) <= Math.abs(dRight) ? theta + dLeft : theta + dRight;
    }
    let _snapping = false;
    let _snapTargetTheta = 0;

    function _startReturnHome() {
      const sph = new THREE.Spherical().setFromVector3(
        viewerCamera.position.clone().sub(viewerControls.target)
      );
      _snapTargetTheta = _nearestSideTheta(sph.theta);
      _snapping = true;
    }

    modelCanvas.addEventListener('pointerdown', () => {
      _snapping = false;
      viewerControls.autoRotate = false;
      if (_viewerIdleTimer) clearTimeout(_viewerIdleTimer);
    });
    modelCanvas.addEventListener('pointerup', () => {
      if (_viewerIdleTimer) clearTimeout(_viewerIdleTimer);
      _viewerIdleTimer = setTimeout(_startReturnHome, 2000);
    });

    const gltfLoader = new GLTFLoader();
    let viewerModelRoot = null;
    let viewerModelKey  = '';
    let viewerAnimId    = null;

    // Per-material emissive entries: { mat, baseIntensity, rate, phase, breathe }
    let _emissiveFlashMats = [];

    // Animation mixer for GLB animations
    let _animMixer = null;
    const _animClock = new THREE.Clock();

    // Hover ring pulse pool for file-10
    let _hoverRings = [];
    let _hoverOriginY = 0;
    const RING_COUNT   = 4;
    const RING_PERIOD  = 0.9;  // seconds per ring cycle
    const RING_DROP    = 0.32;  // world-units to travel downward before vanishing

    function _setupHoverRings(root, scene) {
      _hoverRings.forEach(r => scene.remove(r.mesh));
      _hoverRings = [];

      // Find mesh named hovermat
      let sourceMesh = null;
      root.traverse(child => {
        if (child.isMesh && child.material?.name === 'hovermat') sourceMesh = child;
      });
      if (!sourceMesh) return;

      const worldPos  = sourceMesh.getWorldPosition(new THREE.Vector3());
      const worldQuat = sourceMesh.getWorldQuaternion(new THREE.Quaternion());
      const worldScale = sourceMesh.getWorldScale(new THREE.Vector3());
      _hoverOriginY = worldPos.y + 0.12; // shift system up

      const emCol = sourceMesh.material.emissive.clone();

      for (let i = 0; i < RING_COUNT; i++) {
        const mat = new THREE.MeshStandardMaterial({
          emissive: emCol,
          emissiveIntensity: 0,
          color: emCol,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sourceMesh.geometry, mat);
        mesh.position.copy(worldPos);
        mesh.position.y = _hoverOriginY;
        mesh.quaternion.copy(worldQuat);
        mesh.scale.copy(worldScale);
        scene.add(mesh);
        _hoverRings.push({ mesh, mat, originY: _hoverOriginY, phase: i / RING_COUNT });
      }
    }

    function _updateHoverRings(t) {
      _hoverRings.forEach(({ mesh, mat, originY, phase }) => {
        const p    = ((t / RING_PERIOD) + phase) % 1.0; // 0→1
        const fade = 1.0 - p;
        // Drop straight down from origin
        mesh.position.y = originY - p * RING_DROP;
        mat.opacity           = fade * 0.9;
        mat.emissiveIntensity = fade * 2.0;
        mat.needsUpdate       = true;
      });
    }

    // Canvas screen texture
    let _screenCanvas = null, _screenCtx = null, _screenTexture = null, _screenMats = [];

    function _initScreenCanvas() {
      _screenCanvas = document.createElement('canvas');
      _screenCanvas.width = _screenCanvas.height = 256;
      _screenCtx = _screenCanvas.getContext('2d');
      _screenTexture = new THREE.CanvasTexture(_screenCanvas);
      _screenTexture.colorSpace = THREE.SRGBColorSpace;
      _screenTexture.flipY = false;
      _drawScreen(0); // populate canvas before first render
    }

    function _drawScreen(t) {
      const ctx = _screenCtx, W = 256, H = 256;

      // Background
      ctx.fillStyle = '#000c08';
      ctx.fillRect(0, 0, W, H);

      // — Frequency analyser bars (bottom half) —
      const bars = 18;
      const bw = Math.floor(W / bars) - 2;
      for (let i = 0; i < bars; i++) {
        const h = (0.18 + 0.82 * Math.abs(
          Math.sin(t * 1.7 + i * 0.55) * 0.6 +
          Math.sin(t * 3.1 + i * 1.1) * 0.4
        )) * (H * 0.42);
        const x = i * (W / bars) + 1;
        const y = H * 0.88 - h;
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0,   '#00ffee');
        g.addColorStop(0.5, '#00cc55');
        g.addColorStop(1,   '#003318');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, bw, h);
      }

      // — Oscilloscope waveform (upper third) —
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const y = H * 0.28
          + Math.sin(x * 0.07 + t * 5.2) * 14
          + Math.sin(x * 0.14 + t * 3.1) * 7
          + Math.sin(x * 0.03 + t * 1.4) * 5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // — Header bar —
      ctx.fillStyle = 'rgba(0,255,160,0.08)';
      ctx.fillRect(0, 0, W, 22);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.fillText('MIXER 3000', 6, 14);
      // blinking cursor
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(W - 14, 5, 8, 12);
      }

      // — Status row —
      const statuses = ['PROCESSING', 'MIX ACTIVE', 'OUTPUT OK ', 'TEMP 72°C ', 'PWR 340W  '];
      const si = Math.floor(t * 0.8) % statuses.length;
      ctx.font = '8px monospace';
      ctx.fillStyle = '#009944';
      ctx.fillText('> ' + statuses[si], 6, H - 6);

      // — Divider lines —
      ctx.strokeStyle = 'rgba(0,200,100,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(W, 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H - 18); ctx.lineTo(W, H - 18); ctx.stroke();

      // — Scanlines overlay —
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);

      // — Occasional glitch band —
      if (Math.sin(t * 11.3) > 0.96) {
        const gy = (Math.random() * H * 0.7) | 0;
        ctx.fillStyle = 'rgba(0,255,120,0.07)';
        ctx.fillRect(0, gy, W, 4 + (Math.random() * 10 | 0));
        // horizontal shift glitch
        const slice = ctx.getImageData(0, gy, W, 4);
        ctx.putImageData(slice, (Math.random() * 12 - 6) | 0, gy);
      }

      _screenTexture.needsUpdate = true;
    }

    function _startViewerLoop() {
      if (viewerAnimId) return;
      (function loop() {
        viewerAnimId = requestAnimationFrame(loop);
        viewerControls.update();
        const _delta = _animClock.getDelta();
        if (_animMixer) { _animMixer.update(_delta); }
        if (_screenMats.length) { _drawScreen(performance.now() * 0.001); }
        if (_hoverRings.length) { _updateHoverRings(performance.now() * 0.001); }
        if (_emissiveFlashMats.length) {
          const t = performance.now() * 0.001;
          _emissiveFlashMats.forEach(({ mat, baseIntensity, rate, phase, breathe, minBright }) => {
            if (breathe) {
              const lo = minBright ?? 0.08;
              mat.emissiveIntensity = baseIntensity * (lo + (1 - lo) * (0.5 + 0.5 * Math.sin(t * rate + phase)));
            } else {
              mat.emissiveIntensity = (Math.sin(t * rate + phase) > 0) ? baseIntensity : 0;
            }
          });
        }
        if (_snapping) {
          const sph = new THREE.Spherical().setFromVector3(
            viewerCamera.position.clone().sub(viewerControls.target)
          );
          const dTheta = _snapTargetTheta - sph.theta;
          const dPhi   = _HOME_PHI - sph.phi;
          sph.theta += dTheta * 0.025;
          sph.phi   += dPhi   * 0.025;
          viewerCamera.position.setFromSpherical(sph).add(viewerControls.target);
          viewerCamera.lookAt(viewerControls.target);
          if (Math.abs(dTheta) < 0.002 && Math.abs(dPhi) < 0.002) {
            _snapping = false;
            viewerControls.autoRotate = true;
          }
        }
        viewerComposer.render();
      })();
    }
    function _stopViewerLoop() {
      if (viewerAnimId) { cancelAnimationFrame(viewerAnimId); viewerAnimId = null; }
    }

    function _loadViewerModel(url) {
      if (viewerModelKey === url) return;
      if (_viewerIdleTimer) clearTimeout(_viewerIdleTimer);
      viewerControls.autoRotate = true;
      viewerModelKey = url;
      if (viewerModelRoot) { viewerScene.remove(viewerModelRoot); viewerModelRoot = null; }
      _emissiveFlashMats = [];
      _screenMats = [];
      _hoverRings.forEach(r => viewerScene.remove(r.mesh));
      _hoverRings = [];
      _animMixer = null;
      _animClock.start();
      if (!url) return;
      modelViewerLoading.style.opacity = '1';
      modelViewerLoading.textContent   = 'LOADING MODEL...';
      const capturedKey = url;
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} – ${url}`);
          return r.arrayBuffer();
        })
        .then(buffer => {
          if (viewerModelKey !== capturedKey) return;
          gltfLoader.parse(buffer, '', (gltf) => {
            if (viewerModelKey !== capturedKey) return;
            const root = gltf.scene;
            const box    = new THREE.Box3().setFromObject(root);
            const centre = box.getCenter(new THREE.Vector3());
            const size   = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale  = 2.0 / maxDim;
            root.scale.setScalar(scale);
            root.position.copy(centre).multiplyScalar(-scale);
            _emissiveFlashMats = [];
            _screenMats = [];
            const isPolicecar  = capturedKey.includes('file-7');
            const isMixer      = capturedKey.includes('file-3');
            const isSpaceship  = capturedKey.includes('file-9');
            const isTank       = capturedKey.includes('file-10');
            if (isMixer) { _initScreenCanvas(); }
            let _matIdx = 0;
            root.traverse(child => {
              if (child.isMesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                  const thisMat = _matIdx++;
                  m.flatShading = false;
                  m.needsUpdate = true;
                  if (isSpaceship || isTank) {
                    const hasEmissive = (m.emissiveMap != null) ||
                      (m.emissive && m.emissive.getHex() !== 0x000000);
                    if (hasEmissive) {
                      const base = m.emissiveIntensity > 0 ? m.emissiveIntensity : 1.0;
                      const idx  = _emissiveFlashMats.length;
                      if (isTank) {
                        // Hover ship: slow breath with cascading echo across materials
                        _emissiveFlashMats.push({ mat: m, baseIntensity: base, rate: 0.9, phase: idx * (Math.PI * 0.6), breathe: true, minBright: 0.05 });
                      } else {
                        _emissiveFlashMats.push({ mat: m, baseIntensity: base, rate: 6.0 + idx * 0.05, phase: idx * 0.4, breathe: true, minBright: 0.35 });
                      }
                    }
                    return;
                  }
                  if (isMixer) {
                    // Kill emissive on white materials — they shouldn't glow
                    const hex0 = m.emissive ? m.emissive.getHex() : 0x000000;
                    const r0 = (hex0 >> 16) & 0xff, g0 = (hex0 >> 8) & 0xff, b0 = hex0 & 0xff;
                    if (r0 > 180 && g0 > 180 && b0 > 180) { m.emissiveIntensity = 0; m.needsUpdate = true; }
                  }
                  // Screen materials — apply canvas texture, skip flash enrollment
                  if (isMixer && m.name === 'Material.051') {
                    m.emissive.set('#00ff88');
                    m.emissiveIntensity = 1.0;
                    m.needsUpdate = true;
                    _emissiveFlashMats.push({ mat: m, baseIntensity: 1.0, rate: 1.2, phase: 0, breathe: true });
                    return;
                  }
                  if (isMixer && m.name === 'screen') {
                    m.emissiveMap      = _screenTexture;
                    m.emissive.set(1, 1, 1);
                    m.emissiveIntensity = 1.5;
                    m.map              = _screenTexture; // also drive base color so it shows in all lighting
                    m.color.set(1, 1, 1);
                    m.needsUpdate = true;
                    _screenMats.push(m);
                    return;
                  }
                  if (isPolicecar || isMixer) {
                    const hasEmissive = (m.emissiveMap != null) ||
                      (m.emissive && m.emissive.getHex() !== 0x000000);
                    const isMat36  = isMixer && m.name === 'Material.036';
                    if (hasEmissive || isMat36) {
                      const hex = m.emissive ? m.emissive.getHex() : 0x000000;
                      const r = (hex >> 16) & 0xff;
                      const g = (hex >> 8)  & 0xff;
                      const b =  hex        & 0xff;
                      const isRed    = r > 150 && g < 80  && b < 80;
                      const isBlue   = b > 150 && r < 80  && g < 80;
                      const isOrange = r > 180 && g > 80  && g < 160 && b < 60;
                      const isGreen  = g > 150 && r < 100 && b < 100;
                      const isYellow = r > 180 && g > 160 && b < 80;
                      const isWhite  = r > 180 && g > 180 && b > 180;
                      if (isPolicecar && !isRed && !isBlue) return;
                      if (isMixer && !isOrange && !isRed && !isGreen && !isBlue && !isYellow && !isMat36) return;
                      const base = m.emissiveIntensity > 0 ? m.emissiveIntensity : 1.0;
                      const idx  = _emissiveFlashMats.length;
                      let rate, phase, breathe = false, screen = false;
                      if (isPolicecar) {
                        rate  = 14.0;
                        phase = isRed ? 0 : Math.PI;
                      } else {
                        // Mixer: orange/red/green flash at different rates; white+blue breathe
                        if (isMat36) {
                          rate  = 6.0; phase = 0;
                        } else if (isBlue) {
                          breathe = true;
                          rate  = 1.2;
                          phase = idx * 0.8;
                        } else if (isOrange) {
                          rate  = 6.0; phase = 0;
                        } else if (isRed) {
                          rate  = 8.0; phase = Math.PI * 0.5;
                        } else if (isGreen) {
                          rate  = 5.0; phase = Math.PI;
                        } else if (isYellow) {
                          rate  = 7.0; phase = Math.PI * 1.5;
                        }
                      }
                      _emissiveFlashMats.push({ mat: m, baseIntensity: base, rate, phase, breathe, screen });
                    }
                  }
                });
              }
            });
            viewerModelRoot = root;
            viewerScene.add(root);
            if (isTank) _setupHoverRings(root, viewerScene);
            if (gltf.animations?.length) {
              _animMixer = new THREE.AnimationMixer(root);
              gltf.animations.forEach(clip => {
                const action = _animMixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.play();
              });
              _animClock.start();
            }

            // Fit camera to bounding sphere of the scaled+centered model
            const scaledSphere = new THREE.Box3().setFromObject(root)
              .getBoundingSphere(new THREE.Sphere());
            const fovRad  = viewerCamera.fov * (Math.PI / 180);
            const fitDist = (scaledSphere.radius / Math.tan(fovRad * 0.5)) * 0.85;
            const camY = scaledSphere.center.y + fitDist * 0.18;
            viewerCamera.position.set(0, camY, fitDist);
            const _initRel = viewerCamera.position.clone().sub(scaledSphere.center);
            _HOME_PHI = new THREE.Spherical().setFromVector3(_initRel).phi;
            viewerCamera.near = fitDist * 0.01;
            viewerCamera.far  = fitDist * 100;
            viewerCamera.updateProjectionMatrix();
            viewerControls.minDistance = fitDist * 0.5;
            viewerControls.maxDistance = fitDist * 3.0;
            viewerControls.target.copy(scaledSphere.center);
            viewerControls.autoRotate = true;
            viewerControls.update();
            modelViewerLoading.style.opacity = '0';
          }, (err) => {
            console.error('[ModelViewer] Parse error:', err);
            modelViewerLoading.textContent = 'PARSE ERROR';
          });
        })
        .catch(err => {
          console.error('[ModelViewer] Fetch error:', err);
          modelViewerLoading.textContent = 'LOAD ERROR: ' + err.message;
        });
    }

    const detailLogoStyle = document.createElement('style');
    detailLogoStyle.textContent = `
      #detail-logo-overlay {
        position: fixed;
        left: 8%;
        top: 50%;
        transform: translateY(-50%);
        z-index: 250;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22vw;
        max-width: 320px;
      }
      #detail-logo-overlay.visible { opacity: 1; }
      #detail-logo-glow-ring {
        position: absolute;
        width: 110%;
        padding-top: 110%;
        border-radius: 50%;
        background: radial-gradient(circle, var(--logo-glow, #ffffff22) 0%, transparent 70%);
        animation: logoGlowBreathe 2.8s ease-in-out infinite;
        z-index: 0;
      }
      @keyframes logoGlowBreathe {
        0%, 100% { transform: scale(0.88); opacity: 0.45; }
        50%       { transform: scale(1.12); opacity: 1; }
      }
      #detail-logo-overlay img {
        position: relative;
        z-index: 1;
        width: 100%;
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 18px var(--logo-glow, #ffffff55));
        animation: logoFloat 4s ease-in-out infinite;
      }
      @keyframes logoFloat {
        0%   { transform: translateY(0px)    rotate(-1.2deg); }
        25%  { transform: translateY(-10px)  rotate(0deg);    }
        50%  { transform: translateY(-14px)  rotate(1.2deg);  }
        75%  { transform: translateY(-6px)   rotate(0deg);    }
        100% { transform: translateY(0px)    rotate(-1.2deg); }
      }
    `;
    document.head.appendChild(detailLogoStyle);

    const detailLogoOverlay = document.createElement('div');
    detailLogoOverlay.id = 'detail-logo-overlay';
    detailLogoOverlay.innerHTML = `
      <div id="detail-logo-glow-ring"></div>
      <img src="" alt="" onerror="this.style.display='none'">
    `;
    document.body.appendChild(detailLogoOverlay);

    // ── (existing) Flatten tree / extract videos helpers ───────────────────
    // Flatten a file tree into render rows (depth-first)
    function flattenTree(nodes, depth = 0) {
      const rows = [];
      for (const node of nodes) {
        rows.push({ ...node, depth });
        if (node.dir && node.c) rows.push(...flattenTree(node.c, depth + 1));
      }
      return rows;
    }
    function extractVideos(nodes) {
      const vids = [];
      for (const node of nodes) {
        if (node.v) vids.push(node);
        if (node.dir && node.c) vids.push(...extractVideos(node.c));
      }
      return vids;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // APPLICATION DATA
    // One entry per planet (matches PLANET_SKILLS order: Figma, Blender, Framer,
    // Godot, Illustrator, Shopify, Canva).  Each application has 5 files (File 1–5).
    //
    // Per file:
    //   img    – drop image in public/assets/projects/<app>/file-<n>.png
    //   desc   – 1–2 sentence description
    //   role   – your role on the project
    //   stack  – array of technology tags
    //   year   – year or date range
    //   status – e.g. 'ACTIVE', 'COMPLETE', 'LIVE', 'STABLE'
    //   link   – optional URL string (leave '' to hide)
    //   tree   – source file tree shown in the right panel (see helpers below)
    // ══════════════════════════════════════════════════════════════════════════
    const _f = (n, e, s) => ({ n, e, s });
    const _d = (n, ...c) => ({ n, dir: true, c });
    const _v = (n, src) => ({ n, e: 'MP4', v: src });

    const APPLICATIONS = [
      // ── Figma (Planet 0) ─────────────────────────────────────────────────
      { name: 'Figma', files: [
        { // File 1
          img: '/portfolio-website/assets/projects/figma/file-1/preview.png',
          desc: 'A unified design system powering products across web and mobile. Covers tokens, motion, and full component library.',
          role: 'Lead Designer', stack: ['Figma', 'Auto Layout', 'Components', 'Variables'], year: '2023 – 2024', status: 'ACTIVE', link: '',
          tree: [ _d('tokens', _f('colors.json','JSON','4.2kb'), _f('typography.json','JSON','2.1kb'), _f('spacing.json','JSON','1.4kb')),
                  _d('components', _f('Button.fig','FIG','8.3kb'), _f('Input.fig','FIG','6.7kb'), _f('Modal.fig','FIG','11.2kb')),
                  _f('README.md','MD','3.1kb') ] },
        { // File 2
          img: '/portfolio-website/assets/projects/figma/file-2/preview.png',
          desc: 'Atomic component library with full accessibility annotations, documentation, and interactive prototypes.',
          role: 'UX Designer', stack: ['Figma', 'Prototyping', 'Accessibility'], year: '2023', status: 'STABLE', link: '',
          tree: [ _d('atoms', _f('Text.fig','FIG','4.1kb'), _f('Box.fig','FIG','2.9kb'), _f('Stack.fig','FIG','3.4kb')),
                  _d('molecules', _f('Card.fig','FIG','6.2kb'), _f('Form.fig','FIG','9.1kb')),
                  _f('README.md','MD','2.6kb') ] },
        { // File 3
          img: '/portfolio-website/assets/projects/figma/file-3/preview.png',
          desc: 'Visual token system for colour, type, and spacing — single source of truth exported to multiple platforms.',
          role: 'Design Systems', stack: ['Figma', 'Tokens Studio', 'Style Dictionary'], year: '2022 – 2023', status: 'COMPLETE', link: '',
          tree: [ _f('colors.json','JSON','6.4kb'), _f('typography.json','JSON','3.8kb'),
                  _f('spacing.json','JSON','2.2kb'), _f('shadows.json','JSON','1.9kb'),
                  _f('README.md','MD','1.8kb') ] },
        { // File 4
          img: '/portfolio-website/assets/projects/figma/file-4/preview.png',
          desc: 'Motion design guidelines and interactive prototype demos for spring, timeline, and easing animations.',
          role: 'Motion Designer', stack: ['Figma', 'Prototyping', 'Smart Animate'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _d('examples', _f('spring.fig','FIG','3.2kb'), _f('timeline.fig','FIG','4.1kb')),
                  _f('guidelines.md','MD','5.2kb') ] },
        { // File 5
          img: '/portfolio-website/assets/projects/figma/file-5/preview.png',
          desc: 'Brand theme builder — a Figma plugin that generates complete theme packages from a base palette.',
          role: 'Plugin Developer', stack: ['Figma API', 'TypeScript', 'Tokens'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _d('src', _f('plugin.ts','TS','6.1kb'), _f('ui.tsx','TSX','4.8kb')),
                  _f('manifest.json','JSON','0.9kb'), _f('README.md','MD','2.2kb') ] },
      ] },

      // ── Blender (Planet 1) ────────────────────────────────────────────────
      { name: 'Blender', files: [
        { // File 1
          title: 'Sniper',
          img: '/portfolio-website/projects/blender/file-1/preview.png',
          model: '/portfolio-website/projects/models/Sniper.glb',
          desc: 'The model that started it all. Modelled after a real-world sniper rifle, this was the initial spark behind "Death and Desire" — a Fallout-style first-person shooter. Built with accurate proportions and PBR materials, it became the visual foundation and design language for the entire weapon system in the game.',
          role: '3D Weapon Artist', stack: ['Blender', 'Cycles', 'PBR', 'Reference Modelling'], year: '2022', status: 'COMPLETE', link: '',
          tree: [ _d('scene', _f('environment.blend','BLEND','84mb'), _f('lighting.blend','BLEND','12mb')),
                  _d('textures', _f('ground_ao.exr','EXR','22mb'), _f('sky_hdri.hdr','HDR','48mb')),
                  _f('render_settings.json','JSON','1.4kb') ] },
        { // File 2
          title: 'Grenade Launcher',
          img: '/portfolio-website/projects/blender/file-2/preview.png',
          model: '/portfolio-website/projects/models/GRENADE_LAUNCHER.glb',
          desc: 'The second weapon added to "Death and Desire", inspired by the iconic grenade launcher from Team Fortress 2. Beyond being a key part of the game\'s arsenal, this model holds a special place — its silhouette and design became the basis for the Death and Desire logo.',
          role: '3D Weapon Artist', stack: ['Blender', 'Cycles', 'PBR', 'Game Asset'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('character.blend','BLEND','142mb'), _f('rig.blend','BLEND','38mb'),
                  _d('textures', _f('diffuse.png','PNG','8mb'), _f('normal.png','PNG','8mb'), _f('roughness.png','PNG','8mb')) ] },
        { // File 3
          title: 'Mixer 3000',
          img: '/portfolio-website/projects/blender/file-3/preview.png',
          model: '/portfolio-website/projects/blender/file-3/model.glb',
          desc: 'A core gameplay prop from "Getting Fired" — a comedy puzzle game where you mix items together to brew drinks that prank your boss and coworkers, unlocking new areas throughout the office. The Mixer 3000 sits at the heart of the game\'s mechanics, serving as the player\'s main crafting station.',
          role: '3D Prop Artist', stack: ['Blender', 'Cycles', 'Game Asset', 'PBR'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _d('renders', _f('hero_shot.exr','EXR','18mb'), _f('turntable.mp4','MP4','320mb')),
                  _f('product.blend','BLEND','54mb') ] },
        { // File 4
          title: 'Hand Painted Grass',
          img: '/portfolio-website/projects/blender/file-4/preview.png',
          model: '/portfolio-website/projects/blender/file-4/model.glb',
          desc: 'One of a set of 3 hand-painted environment assets created for "Project: Waterfall", an advanced third-person movement system. This was my first serious attempt at fully hand-painted textures — no PBR, just raw brush work — built to give the world a stylised, painterly feel.',
          role: '3D Environment Artist', stack: ['Blender', 'Hand Painted', 'Stylised'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('geo_nodes_library.blend','BLEND','28mb'),
                  _d('presets', _f('scatter.blend','BLEND','6mb'), _f('buildings.blend','BLEND','9mb')) ] },
        { // File 5
          title: 'Hand Painted Palm Tree',
          img: '/portfolio-website/projects/blender/file-5/preview.png',
          model: '/portfolio-website/projects/blender/file-5/model.glb',
          desc: 'One of a set of 3 hand-painted environment assets created for "Project: Waterfall", an advanced third-person movement system. Part of my first full dive into hand-painted texturing, this palm tree was built to populate the world with a warm, tropical, stylised aesthetic.',
          role: '3D Environment Artist', stack: ['Blender', 'Hand Painted', 'Stylised'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('short_film.blend','BLEND','210mb'),
                  _d('shots', _f('shot_01.blend','BLEND','32mb'), _f('shot_02.blend','BLEND','28mb'), _f('shot_03.blend','BLEND','41mb')),
                  _f('storyboard.pdf','PDF','4.2mb') ] },
        { // File 6
          title: 'Hand Painted Mushroom',
          img: '/portfolio-website/projects/blender/file-6/preview.png',
          model: '/portfolio-website/projects/blender/file-6/model.glb',
          desc: 'One of a set of 3 hand-painted environment assets created for "Project: Waterfall", an advanced third-person movement system. The final piece of the trio — this mushroom wrapped up my first full hand-painted texture series and helped define the visual identity of the project.',
          role: '3D Environment Artist', stack: ['Blender', 'Hand Painted', 'Stylised'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('robot.blend','BLEND','96mb'), _d('textures', _f('metal_albedo.png','PNG','12mb'), _f('metal_normal.png','PNG','12mb')) ] },
        { // File 7
          title: 'Police Car',
          img: '/portfolio-website/projects/blender/file-7/preview.png',
          model: '/portfolio-website/projects/blender/file-7/model.glb',
          desc: 'Modelled for "Tanky Toys: Neighborhood Mayhem", a spinoff to Tanky Toys where you cause havoc on the streets in a toy tank. The police cars are the opposing force — charging down the player to restore order. This model also became the test subject for my first ever A* pathfinding system, navigating the streets in pursuit.',
          role: '3D Vehicle Artist', stack: ['Blender', 'Cycles', 'Game Asset', 'Low Poly'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('interior.blend','BLEND','118mb'), _d('assets', _f('furniture.blend','BLEND','34mb'), _f('lighting.blend','BLEND','8mb')) ] },
        { // File 8
          title: 'Axe and Logs',
          img: '/portfolio-website/projects/blender/file-8/preview.png',
          model: '/portfolio-website/projects/blender/file-8/model.glb',
          desc: 'A prop from "The Adventures of Gami" — an ongoing game that takes inspiration from Paper Mario: The Thousand Year Door, blending flat paper-style characters with low-poly 3D environments. The game demands a large volume of assets and this chopping block set is one of many props built to bring Gami\'s world to life.',
          role: '3D Prop Artist', stack: ['Blender', 'Low Poly', 'Stylised', 'Game Asset'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('vehicle.blend','BLEND','74mb'), _d('textures', _f('paint.png','PNG','16mb'), _f('wear_mask.png','PNG','8mb')) ] },
        { // File 9
          title: 'Hyperdriven Hovership',
          img: '/portfolio-website/projects/blender/file-9/preview.png',
          model: '/portfolio-website/projects/blender/file-9/model.glb',
          desc: 'The hero ship from "Hyperdriven" — my first ever game. Tasked with defending planets across the galaxy from waves of robots, aliens, and enemy ships, this vessel was the player\'s only means of survival. Modelling it was a milestone moment that kicked off my journey into game development.',
          role: '3D Vehicle Artist', stack: ['Blender', 'Cycles', 'Game Asset', 'Low Poly'], year: '2022', status: 'COMPLETE', link: '',
          tree: [ _f('ocean_sim.blend','BLEND','188mb'), _d('cache', _f('fluid_cache.vdb','VDB','2.4gb')) ] },
        { // File 10
          title: 'Tanky Toy Wrecktifier',
          img: '/portfolio-website/projects/blender/file-10/preview.png',
          model: '/portfolio-website/projects/blender/file-10/model.glb',
          desc: 'The player\'s weapon of chaos in "Tanky Toys: Neighborhood Mayhem". The Wrecktifier draws inspiration from Resist Design, Sci-Fi aesthetics, and the world of Hyperdriven — armed with a pulse cannon that fires electrified sci-fi cubes at the incoming police force. A tank built to wreck.',
          role: '3D Vehicle Artist', stack: ['Blender', 'Cycles', 'Game Asset', 'Sci-Fi'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('corridor.blend','BLEND','64mb'), _d('kit', _f('tiles.blend','BLEND','22mb'), _f('props.blend','BLEND','18mb')) ] },
        { // File 11
          img: '/portfolio-website/projects/blender/file-11/preview.png',
          desc: 'Abstract generative sculpture series — 12 unique forms driven entirely by procedural modifiers.',
          role: '3D Artist', stack: ['Blender', 'Geometry Nodes', 'Shader Nodes'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('sculptures.blend','BLEND','38mb'), _f('renders.zip','ZIP','420mb') ] },
        { // File 12
          img: '/portfolio-website/projects/blender/file-12/preview.png',
          desc: 'Fantasy weapon set — sword, shield, and staff with hand-painted texture atlas and PBR bake.',
          role: 'Game Asset Artist', stack: ['Blender', 'Substance', 'Cycles'], year: '2022', status: 'COMPLETE', link: '',
          tree: [ _f('weapon_set.blend','BLEND','52mb'), _d('textures', _f('albedo_atlas.png','PNG','8mb'), _f('normal_atlas.png','PNG','8mb')) ] },
        { // File 13
          img: '/portfolio-website/projects/blender/file-13/preview.png',
          desc: 'Motion graphics package — looping logo reveal and lower thirds with driver-animated paths.',
          role: 'Motion Designer', stack: ['Blender', 'NLA Editor', 'Driver'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('logo_reveal.blend','BLEND','14mb'), _f('lower_thirds.blend','BLEND','9mb') ] },
        { // File 14
          img: '/portfolio-website/projects/blender/file-14/preview.png',
          desc: 'Crowd simulation with particle instances — stadium fill, flow paths, and per-agent animation.',
          role: '3D Artist', stack: ['Blender', 'Geometry Nodes', 'Particles'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('crowd_sim.blend','BLEND','156mb'), _d('agents', _f('male_agent.blend','BLEND','28mb'), _f('female_agent.blend','BLEND','26mb')) ] },
        { // File 15
          img: '/portfolio-website/projects/blender/file-15/preview.png',
          desc: 'Nature scene — forest floor with scatter-distributed foliage, bark shaders, and god-rays.',
          role: '3D Environment Artist', stack: ['Blender', 'Cycles', 'Geometry Nodes'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('forest.blend','BLEND','204mb'), _d('plants', _f('fern.blend','BLEND','18mb'), _f('moss.blend','BLEND','12mb'), _f('tree.blend','BLEND','46mb')) ] },
        { // File 16
          img: '/portfolio-website/projects/blender/file-16/preview.png',
          desc: 'Product animation — cosmetics bottle with liquid fill shader, caustics, and turntable loop.',
          role: '3D Generalist', stack: ['Blender', 'Cycles', 'ACES'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('cosmetics.blend','BLEND','42mb'), _d('renders', _f('turntable.mp4','MP4','280mb')) ] },
        { // File 17
          img: '/portfolio-website/projects/blender/file-17/preview.png',
          desc: 'Cyberpunk street scene at night — neon signs, rain reflections, and volumetric street lighting.',
          role: '3D Environment Artist', stack: ['Blender', 'Cycles', 'Compositing'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('cyberpunk_street.blend','BLEND','178mb'), _d('signs', _f('neon_pack.blend','BLEND','24mb')) ] },
        { // File 18
          img: '/portfolio-website/projects/blender/file-18/preview.png',
          desc: 'Fabric and cloth simulation study — wind dynamics, sewing patterns, and material properties.',
          role: '3D Artist', stack: ['Blender', 'Cloth Sim', 'Cycles'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('cloth_study.blend','BLEND','88mb'), _d('cache', _f('cloth_cache.zip','ZIP','340mb')) ] },
        { // File 19
          img: '/portfolio-website/projects/blender/file-19/preview.png',
          desc: 'Low-poly game world tileset — village buildings, terrain pieces, and prop library.',
          role: 'Game Asset Artist', stack: ['Blender', 'Eevee', 'UV Packing'], year: '2022', status: 'COMPLETE', link: '',
          tree: [ _f('tileset.blend','BLEND','36mb'), _d('props', _f('house.blend','BLEND','6mb'), _f('tree_low.blend','BLEND','4mb'), _f('fence.blend','BLEND','2mb')) ] },
        { // File 20
          img: '/portfolio-website/projects/blender/file-20/preview.png',
          desc: 'Explosion VFX using smoke sim, fire shader, and frame-by-frame compositing in Blender.',
          role: 'VFX Artist', stack: ['Blender', 'Mantaflow', 'Compositing'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('explosion.blend','BLEND','122mb'), _d('cache', _f('smoke_cache.vdb','VDB','1.8gb')) ] },
        { // File 21
          img: '/portfolio-website/projects/blender/file-21/preview.png',
          desc: 'Stylised cartoon character with squash-and-stretch rig, blend shapes, and walk cycle.',
          role: 'Character Artist', stack: ['Blender', 'Rigify', 'NLA Editor'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('cartoon_char.blend','BLEND','68mb'), _d('animations', _f('walk.blend','BLEND','12mb'), _f('idle.blend','BLEND','8mb')) ] },
        { // File 22
          img: '/portfolio-website/projects/blender/file-22/preview.png',
          desc: 'Procedural city generator — randomised building heights, street layouts, and window patterns.',
          role: '3D Artist', stack: ['Blender', 'Geometry Nodes', 'Shader Nodes'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('city_gen.blend','BLEND','58mb'), _f('preset_configs.json','JSON','4.2kb') ] },
        { // File 23
          img: '/portfolio-website/projects/blender/file-23/preview.png',
          desc: 'Jewellery product render — diamond caustics, gold material, and studio light setup.',
          role: '3D Generalist', stack: ['Blender', 'Cycles', 'HDRI'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('jewellery.blend','BLEND','28mb'), _d('renders', _f('beauty.exr','EXR','42mb'), _f('alpha.exr','EXR','16mb')) ] },
        { // File 24
          img: '/portfolio-website/projects/blender/file-24/preview.png',
          desc: 'Rigged mechanical arm with IK constraints, custom bone shapes, and hydraulic piston drivers.',
          role: '3D Artist', stack: ['Blender', 'Rigging', 'Drivers'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('mech_arm.blend','BLEND','48mb'), _d('animations', _f('reach.blend','BLEND','6mb'), _f('grip.blend','BLEND','5mb')) ] },
        { // File 25
          img: '/portfolio-website/projects/blender/file-25/preview.png',
          desc: 'Isometric diorama scene — miniature city block with hand-painted look and custom outline shader.',
          role: '3D Artist', stack: ['Blender', 'Eevee', 'Shader Nodes'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('diorama.blend','BLEND','82mb'), _d('assets', _f('buildings.blend','BLEND','24mb'), _f('vehicles.blend','BLEND','16mb')) ] },
        { // File 26
          img: '/portfolio-website/projects/blender/file-26/preview.png',
          desc: 'Particle hair system — realistic grooming, strand-based rendering, and wind dynamics.',
          role: '3D Character Artist', stack: ['Blender', 'Cycles', 'Curve Hair'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('hair_system.blend','BLEND','74mb'), _d('grooms', _f('hero_hair.blend','BLEND','18mb')) ] },
        { // File 27
          img: '/portfolio-website/projects/blender/file-27/preview.png',
          desc: 'Space nebula scene — volumetric gas clouds, star field, and camera fly-through animation.',
          role: '3D Artist', stack: ['Blender', 'Cycles', 'Volumetrics'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('nebula.blend','BLEND','62mb'), _d('renders', _f('flythrough.mp4','MP4','640mb')) ] },
        { // File 28
          img: '/portfolio-website/projects/blender/file-28/preview.png',
          desc: 'Organic creature sculpt — high-poly ZBrush-style detail pass, retopology, and texture bake.',
          role: 'Creature Artist', stack: ['Blender', 'Dyntopo', 'Baking'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('creature_hi.blend','BLEND','310mb'), _f('creature_lo.blend','BLEND','22mb'), _d('bakes', _f('normal.png','PNG','16mb')) ] },
        { // File 29
          img: '/portfolio-website/projects/blender/file-29/preview.png',
          desc: 'Glass material study — dispersion, caustics, and total internal reflection under studio lighting.',
          role: '3D Artist', stack: ['Blender', 'Cycles', 'Light Paths'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('glass_study.blend','BLEND','24mb'), _d('renders', _f('dispersion.exr','EXR','28mb')) ] },
        { // File 30
          img: '/portfolio-website/projects/blender/file-30/preview.png',
          desc: 'Retro arcade machine model with screen shader, button animations, and neon trim lighting.',
          role: '3D Artist', stack: ['Blender', 'Eevee', 'Shader Nodes'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('arcade_machine.blend','BLEND','44mb'), _d('textures', _f('screen_emit.png','PNG','4mb'), _f('cabinet_ao.png','PNG','8mb')) ] },
        { // File 31
          img: '/portfolio-website/projects/blender/file-31/preview.png',
          desc: 'Destruction sim — concrete wall collapse with rigid body, fracture, and dust particle overlay.',
          role: 'VFX Artist', stack: ['Blender', 'Rigid Body', 'Particles'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('destruction.blend','BLEND','138mb'), _d('cache', _f('rbody_cache.zip','ZIP','890mb')) ] },
        { // File 32
          img: '/portfolio-website/projects/blender/file-32/preview.png',
          desc: 'Underwater scene — caustic light shafts, kelp geometry nodes, and school-of-fish particle system.',
          role: '3D Environment Artist', stack: ['Blender', 'Cycles', 'Volumetrics'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('underwater.blend','BLEND','92mb'), _d('creatures', _f('fish.blend','BLEND','14mb'), _f('kelp.blend','BLEND','8mb')) ] },
        { // File 33
          img: '/portfolio-website/projects/blender/file-33/preview.png',
          desc: 'Typography 3D animation — text extrude, bevel, and per-letter staggered reveal with driver curves.',
          role: 'Motion Designer', stack: ['Blender', 'NLA Editor', 'Font Curves'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('type_anim.blend','BLEND','18mb'), _d('renders', _f('reveal.mp4','MP4','180mb')) ] },
        { // File 34
          img: '/portfolio-website/projects/blender/file-34/preview.png',
          desc: 'Sci-fi weapon with emission maps, holographic scope shader, and disassembly animation.',
          role: 'Game Asset Artist', stack: ['Blender', 'Cycles', 'Shader Nodes'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('scifi_weapon.blend','BLEND','56mb'), _d('textures', _f('emissive.png','PNG','8mb'), _f('hologram.png','PNG','4mb')) ] },
        { // File 35
          img: '/portfolio-website/projects/blender/file-35/preview.png',
          desc: 'Showreel compilation render — multi-scene sequence with matched colour grading and final composite.',
          role: 'Director / 3D Artist', stack: ['Blender', 'Cycles', 'Compositing'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('showreel.blend','BLEND','520mb'), _d('scenes', _f('sc01.blend','BLEND','84mb'), _f('sc02.blend','BLEND','96mb'), _f('sc03.blend','BLEND','78mb')) ] },
      ] },

      // ── Framer (Planet 2) ─────────────────────────────────────────────────
      { name: 'Framer', files: [
        { // File 1
          img: '/portfolio-website/assets/projects/framer/file-1/preview.png',
          desc: 'Cross-platform app prototype with native-feel transitions, shared state, and full interaction design.',
          role: 'Interaction Designer', stack: ['Framer', 'React', 'Motion'], year: '2023 – 2024', status: 'LIVE', link: '',
          tree: [ _d('screens', _f('Home.framer','FR','8.4kb'), _f('Profile.framer','FR','6.2kb')),
                  _d('components', _f('Nav.framer','FR','4.1kb'), _f('Card.framer','FR','3.6kb')),
                  _f('prototype.json','JSON','2.8kb') ] },
        { // File 2
          img: '/portfolio-website/assets/projects/framer/file-2/preview.png',
          desc: 'Notification flow prototype with animated state transitions and platform-specific gesture handling.',
          role: 'Product Designer', stack: ['Framer', 'Variables', 'Gestures'], year: '2023', status: 'STABLE', link: '',
          tree: [ _f('notifications.framer','FR','5.6kb'), _d('assets', _f('icons.svg','SVG','1.4kb')) ] },
        { // File 3
          img: '/portfolio-website/assets/projects/framer/file-3/preview.png',
          desc: 'Offline-mode UX flow — empty states, sync indicators, and conflict resolution interactions.',
          role: 'UX Designer', stack: ['Framer', 'Prototyping', 'UX Writing'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('offline_flow.framer','FR','9.2kb'), _f('states.md','MD','2.1kb') ] },
        { // File 4
          img: '/portfolio-website/assets/projects/framer/file-4/preview.png',
          desc: 'Deep link and navigation prototype demonstrating app-to-app routing and web fallback flows.',
          role: 'Product Designer', stack: ['Framer', 'Variables', 'Conditions'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _f('deeplink_flow.framer','FR','5.8kb'), _f('routing_map.md','MD','1.8kb') ] },
        { // File 5
          img: '/portfolio-website/assets/projects/framer/file-5/preview.png',
          desc: 'Analytics dashboard prototype with live data simulation, filter interactions, and data-vis animations.',
          role: 'Interaction Designer', stack: ['Framer', 'CMS', 'Overrides'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _f('analytics.framer','FR','6.2kb'), _d('data', _f('mock_data.json','JSON','1.6kb')) ] },
      ] },

      // ── Godot (Planet 3) ──────────────────────────────────────────────────
      { name: 'Godot', files: [
        { // File 1
          title: 'THE ADVENTURES OF GAMI',
          logo: '/portfolio-website/projects/godot/file-1/logo.png',
          img: null,
          desc: 'A Paper Mario-inspired adventure game — my long-term personal project and a lifelong dream in the making.',
          role: 'Game Developer', stack: ['Godot 4', 'GDScript', 'Pixel Art'], year: '2023 – Present', status: 'IN DEVELOPMENT', link: '',
          bioText: `Growing up, Paper Mario: The Thousand Year Door was my favourite game. I spent years as a kid dreaming up my own puzzles, levels, and characters — sketching ideas that never had anywhere to go. The Adventure of Gami is where all of that finally lands.\n\nThis is my current long-term personal project, built from the ground up in Godot 4. It draws deep inspiration from the charm, humour, and inventive puzzle design that made Thousand Year Door so special — while carving out its own world and identity.\n\nEvery system is built by hand: the dialogue engine, the turn-based combat, the puzzle logic, the world traversal. It is a labour of love in the truest sense — something I work on because I genuinely cannot stop thinking about it.\n\nThe goal is a full Steam release. No timeline I am willing to commit to publicly — only a promise that it ships when it is ready and not a moment before.\n\nBATTLE SYSTEM — Combat in Gami is turn-based with an action layer on top. Every attack and defence has a timed input window — press at the right moment to land a critical hit or deflect incoming damage. No two encounters feel passive. Enemies have distinct patterns and weaknesses, and learning them is part of the fun. The system rewards skill without punishing newcomers, keeping the loop satisfying from the first fight to the last.\n\n8 PILLAR COLLECTION — The world of Gami is structured around eight Pillars — ancient keystones scattered across distinct regions, each tied to a unique theme, dungeon, and boss. Collecting all eight is the backbone of the game's progression. Each Pillar unlocks new areas, abilities, and story beats, giving the player a clear sense of momentum and purpose throughout the journey. The eight-chapter structure also lets every region feel fully realised rather than rushed.\n\nPARTNER SYSTEM — Gami never travels alone. Throughout the adventure the player picks up a roster of partners — each with their own personality, backstory, and abilities both in and out of combat. In the field, partners interact with the environment in ways Gami cannot, opening up puzzle solutions and hidden paths. In battle, they fight alongside you with their own move sets and timed inputs. Building the right team for each challenge is a quiet but constant strategic layer woven through the whole game.`,
          bioImgs: [],
          tree: [ _d('videos', _v('gami.mp4','/portfolio-website/projects/godot/file-1/gami.mp4'), _v('gamiorange.mp4','/portfolio-website/projects/godot/file-1/gamiorange.mp4'), _v('walrus.mp4','/portfolio-website/projects/godot/file-1/walrus.mp4')) ] },
        { // File 2
          title: 'TANKY TOYS',
          logo: '/portfolio-website/projects/godot/file-2/logo.png',
          img: '/portfolio-website/projects/godot/file-2/tank toys.png',
          desc: 'A level design learning project — top-down tank combat with puzzles, enemy fights, weapons, and tank customization.',
          role: 'Game Developer / Level Designer', stack: ['Godot 4', 'GDScript', 'TileMap', 'Level Design'], year: '2023', status: 'COMPLETE', link: '',
          bioText: `Tanky Toys started as a focused learning project — I set myself a clear goal: design a specific number of levels, each one distinct, and ship them. No scope creep, no feature chasing. Just the discipline of finishing what I started and learning through doing.\n\nThe game is a top-down tank combat experience. Players fight through enemy tanks, solve environmental puzzles, and push toward an endpoint on each level. A weapon system and tank customization layer give the player meaningful choices before and during each run — loadout matters, and levels are designed with that in mind.\n\nEvery level was built around a different constraint or idea. Some lean into combat, some are puzzle-first, some mix both. The goal was to make sure no two levels felt like the same problem wearing a different coat.\n\nThe project also spawned a spinoff: Tanky Toys — Neighbourhood Mayhem. A complete tonal shift — you play as a criminal in a tank, unleashing chaos across a city while the police escalate their response. No endpoint, no puzzles. Just survival. How long can you hold out before the force overwhelms you? It was a fast, fun experiment built on the same foundation, and ended up being its own thing entirely.`,
          bioImgs: [],
          tree: [ _d('videos', _v('tankytoys.mp4','/portfolio-website/projects/godot/file-2/tankytoys.mp4'), _v('tankytoystopdown.mp4','/portfolio-website/projects/godot/file-2/tankytoystopdown.mp4')) ] },
        { // File 3
          title: 'HEART OF THE DUNGEON',
          logo: '/portfolio-website/projects/godot/file-3/logo.png',
          img: null,
          desc: 'An Enter the Gungeon-inspired roguelite with a melee twist, procedural dungeons, and a performance-friendly enemy pool system.',
          role: 'Game Developer', stack: ['Godot 4', 'GDScript', 'Procedural Generation'], year: '2024', status: 'COMPLETE', link: '',
          bioText: `Heart of the Dungeon is a top-down roguelite built as a love letter to Enter the Gungeon — but with the guns stripped out and replaced entirely with melee combat. Up close, personal, and unforgiving. Every fight demands positioning and timing rather than keeping your distance and spraying.\n\nThe dungeon generates fresh every run. Rooms are stitched together procedurally, ensuring no two runs share the same layout. Furniture and props also spawn randomly within each room — crates, barrels, and obstacles are placed at runtime, so the battlefield itself is never predictable.\n\nEnemies are managed through a pool system built for performance. Rather than spawning and destroying enemies constantly, the game recycles instances from a pre-allocated pool — keeping frame time smooth even when rooms fill up with aggressive targets. It was one of the more technically satisfying problems to solve on the project.\n\nCoins drop from enemies and destructible props, feeding into a between-run economy. Damage numbers, hit feedback, and coin pickups are all handled through the same pooled particle and label system — lightweight, readable, and never cluttering the screen during busy fights.`,
          bioImgs: [],
          tree: [ _d('videos', _v('HOTD.mp4','/portfolio-website/projects/godot/file-3/HOTD.mp4')) ] },
        { // File 4
          title: 'UNINSURED',
          logo: '/portfolio-website/projects/godot/file-4/logo.png',
          img: null,
          desc: 'A quirky home defence game where your insurance gets hacked and only an old gifted security system stands between your house and chaos.',
          role: 'Game Developer', stack: ['Godot 4', 'GDScript', 'Pixel Art', '3D Rendering'], year: '2023', status: 'COMPLETE', link: '',
          bioText: `Uninsured follows a young woman who has just moved into her new home — only to have her house insurance mysteriously cancelled by a suspicious hacker. With no coverage and no protection, she falls back on one thing: an old security system gifted to her by a friend, cobbled together and barely holding up.\n\nThe game is a frantic home defence experience. Threats come from every angle — robbers trying to break in, fires sparked by lightning strikes, rogue drones smashing through windows, raccoons raiding the trash, termite infestations eating through the walls, and a growing list of absurd hazards that escalate as the nights go on. No two sessions play out the same.\n\nThe visual style is one of the most distinctive things about the project. The game is rendered to look like an old 3D pixel arcade cabinet — chunky geometry, low-resolution pixel textures, and a deliberate retro aesthetic that makes it feel like something pulled from a 1990s arcade floor. The entire colour palette is built around cool blues, giving every scene a consistent and moody nocturnal tone.\n\nThe contrast between the silly premise and the lo-fi visual language is what gives Uninsured its personality — it is weird, charming, and genuinely stressful in the best possible way.`,
          bioImgs: [],
          tree: [ _d('videos', _v('uninsured.mp4','/portfolio-website/projects/godot/file-4/uninsured.mp4')) ] },
        { // File 5
          title: 'DEATH AND DESIRE',
          logo: '/portfolio-website/projects/godot/file-5/logo.png',
          img: null,
          desc: 'A Fallout-inspired low poly FPS mockup — a personal learning project covering inventories, game states, enemy UI, footstep audio, and VFX.',
          role: 'Game Developer', stack: ['Godot 4', 'GDScript', 'Low Poly', 'FPS'], year: '2024', status: 'COMPLETE', link: '',
          bioText: `Death and Desire was never meant to be a shipped game — it was a deliberate learning project, and a thorough one. Built as a low poly first-person shooter inspired by Fallout, it became the sandbox where I tackled a whole list of systems I had not built before and refused to move on until each one felt right.\n\nThe inventory system was one of the biggest undertakings — both a standard player inventory and an external one, letting the player loot containers and transfer items between them. Getting the UI states, slot logic, and item data to stay in sync cleanly took real iteration.\n\nThe FPS UI covers health, ammo, and equipped item readouts. Enemy UI tracks health bars that appear on hit and fade when combat ends. Game states — menus, pause, death, and resume — are all wired up cleanly through a central state manager.\n\nOne of the more satisfying details is the footstep system. Each surface material triggers a different set of sound samples — concrete, wood, gravel, grass — detected at runtime by raycasting beneath the player. It is a small thing but it makes the world feel grounded.\n\nVFX round out the experience: muzzle flashes, impact particles, and hit reactions that give every shot a sense of weight. For a project that was never meant to be more than a classroom, it ended up feeling surprisingly alive.`,
          bioImgs: [],
          tree: [ _d('videos', _v('DeathandDesire.mp4','/portfolio-website/projects/godot/file-5/DeathandDesire.mp4')) ] },
      ] },

      // ── Illustrator (Planet 4) ────────────────────────────────────────────
      { name: 'Illustrator', files: [
        { // File 1
          img: '/portfolio-website/assets/projects/illustrator/file-1/preview.png',
          desc: 'Full brand identity system — logo suite, colour palette, typography, and usage guidelines.',
          role: 'Brand Designer', stack: ['Illustrator', 'InDesign', 'Pantone'], year: '2023 – 2024', status: 'ACTIVE', link: '',
          tree: [ _d('logo', _f('logo_primary.ai','AI','4.2mb'), _f('logo_alt.ai','AI','3.8mb'), _f('favicon.svg','SVG','8kb')),
                  _d('guidelines', _f('brand_guide.pdf','PDF','18mb')),
                  _f('color_palette.ase','ASE','12kb') ] },
        { // File 2
          img: '/portfolio-website/assets/projects/illustrator/file-2/preview.png',
          desc: 'Icon library of 200+ custom line icons in a consistent grid system, exported to SVG and icon font.',
          role: 'Icon Designer', stack: ['Illustrator', 'IcoMoon', 'SVG'], year: '2023', status: 'STABLE', link: '',
          tree: [ _d('icons', _f('arrows.ai','AI','2.1mb'), _f('ui.ai','AI','3.4mb'), _f('social.ai','AI','1.8mb')),
                  _f('icon_font.woff2','WOFF2','42kb'), _f('sprite.svg','SVG','84kb') ] },
        { // File 3
          img: '/portfolio-website/assets/projects/illustrator/file-3/preview.png',
          desc: 'Print and digital poster series — editorial illustration with custom typography and ink-press textures.',
          role: 'Illustrator', stack: ['Illustrator', 'Photoshop', 'Print'], year: '2022 – 2023', status: 'COMPLETE', link: '',
          tree: [ _d('posters', _f('vol_01.ai','AI','14mb'), _f('vol_02.ai','AI','16mb'), _f('vol_03.ai','AI','12mb')),
                  _d('textures', _f('grain.psd','PSD','22mb'), _f('paper.psd','PSD','18mb')) ] },
        { // File 4
          img: '/portfolio-website/assets/projects/illustrator/file-4/preview.png',
          desc: 'Infographic data visualisation series — complex datasets turned into clean, readable vector graphics.',
          role: 'Data Visualiser', stack: ['Illustrator', 'Data Merge', 'SVG'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _d('infographics', _f('report_q1.ai','AI','8.4mb'), _f('report_q2.ai','AI','9.1mb')),
                  _d('data', _f('q1.csv','CSV','48kb'), _f('q2.csv','CSV','54kb')) ] },
        { // File 5
          img: '/portfolio-website/assets/projects/illustrator/file-5/preview.png',
          desc: 'Custom typeface design — 3 weights, Latin + extended character set, exported to OTF and WOFF2.',
          role: 'Type Designer', stack: ['Illustrator', 'Glyphs', 'FontLab'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _d('glyphs', _f('regular.ai','AI','6.2mb'), _f('bold.ai','AI','6.8mb'), _f('light.ai','AI','5.9mb')),
                  _d('export', _f('font.otf','OTF','124kb'), _f('font.woff2','WOFF2','88kb')) ] },
      ] },

      // ── Shopify (Planet 5) ────────────────────────────────────────────────
      { name: 'Shopify', files: [
        { // File 1
          img: '/portfolio-website/assets/projects/shopify/file-1/preview.png',
          desc: 'Custom Shopify theme built from scratch — mobile-first, sub-second LCP, and full Liquid templating.',
          role: 'Shopify Developer', stack: ['Liquid', 'JavaScript', 'CSS', 'Shopify CLI'], year: '2022 – 2023', status: 'LIVE', link: '',
          tree: [ _d('templates', _f('index.liquid','LQD','4.8kb'), _f('product.liquid','LQD','6.2kb'), _f('collection.liquid','LQD','5.4kb')),
                  _d('assets', _f('theme.js','JS','18kb'), _f('theme.css','CSS','22kb')),
                  _f('config/settings_schema.json','JSON','8.4kb') ] },
        { // File 2
          img: '/portfolio-website/assets/projects/shopify/file-2/preview.png',
          desc: 'Shopify app for custom checkout extensions — upsell logic, dynamic discounts, and post-purchase flows.',
          role: 'App Developer', stack: ['Shopify Functions', 'Node.js', 'React', 'GraphQL'], year: '2023', status: 'STABLE', link: '',
          tree: [ _d('extensions', _f('checkout-ui.tsx','TSX','7.8kb'), _f('discount.js','JS','5.2kb')),
                  _d('web', _f('app.jsx','JSX','9.1kb'), _f('api.js','JS','4.4kb')),
                  _f('shopify.app.toml','TOML','1.8kb') ] },
        { // File 3
          img: '/portfolio-website/assets/projects/shopify/file-3/preview.png',
          desc: 'Headless Shopify storefront with Next.js — Storefront API, ISR, and sub-50ms TTFB globally via CDN.',
          role: 'Full-Stack Developer', stack: ['Next.js', 'Storefront API', 'TypeScript', 'Vercel'], year: '2023', status: 'LIVE', link: '',
          tree: [ _d('pages', _f('index.tsx','TSX','6.8kb'), _f('[handle].tsx','TSX','8.4kb')),
                  _d('lib', _f('shopify.ts','TS','4.9kb'), _f('queries.ts','TS','6.1kb')),
                  _f('next.config.js','JS','1.4kb') ] },
        { // File 4
          img: '/portfolio-website/assets/projects/shopify/file-4/preview.png',
          desc: 'Shopify metafield-powered product configurator with real-time pricing and variant selection.',
          role: 'Shopify Developer', stack: ['Liquid', 'Alpine.js', 'Metafields', 'REST API'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _d('snippets', _f('configurator.liquid','LQD','12.4kb'), _f('variant-picker.liquid','LQD','8.1kb')),
                  _d('assets', _f('configurator.js','JS','9.6kb'), _f('configurator.css','CSS','4.2kb')) ] },
        { // File 5
          img: '/portfolio-website/assets/projects/shopify/file-5/preview.png',
          desc: 'Multi-store Shopify setup with shared inventory, automated sync via Flows, and custom analytics.',
          role: 'Shopify Expert', stack: ['Shopify Flow', 'Webhooks', 'Node.js', 'Postgres'], year: '2024', status: 'ACTIVE', link: '',
          tree: [ _d('flows', _f('sync_inventory.json','JSON','4.8kb'), _f('notify_low_stock.json','JSON','3.2kb')),
                  _d('src', _f('sync.js','JS','6.4kb'), _f('analytics.js','JS','5.8kb')),
                  _f('README.md','MD','4.1kb') ] },
      ] },
      // ── Canva (Planet 6) ──────────────────────────────────────────────────
      { name: 'Canva', files: [
        { // File 1
          img: '/portfolio-website/assets/projects/canva/file-1/preview.png',
          desc: 'Brand identity kit built in Canva — logo suite, colour palette, typography, and social templates.',
          role: 'Brand Designer', stack: ['Canva', 'Brand Kit', 'Typography', 'Colour Theory'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _d('brand', _f('logo-primary.png','PNG','2.4kb'), _f('logo-mono.png','PNG','1.8kb'), _f('palette.json','JSON','0.6kb')),
                  _d('templates', _f('instagram-post.canva','CANVA','8.2kb'), _f('story.canva','CANVA','6.4kb')),
                  _f('brand-guidelines.pdf','PDF','4.1kb') ] },
        { // File 2
          img: '/portfolio-website/assets/projects/canva/file-2/preview.png',
          desc: 'Social media content calendar — 60+ branded posts across Instagram, LinkedIn, and Twitter.',
          role: 'Content Designer', stack: ['Canva', 'Social Media', 'Content Strategy'], year: '2023', status: 'ACTIVE', link: '',
          tree: [ _d('instagram', _f('feed-post-1.canva','CANVA','7.1kb'), _f('story-template.canva','CANVA','5.8kb')),
                  _d('linkedin', _f('article-banner.canva','CANVA','6.3kb'), _f('carousel.canva','CANVA','9.2kb')),
                  _f('content-calendar.csv','CSV','2.1kb') ] },
        { // File 3
          img: '/portfolio-website/assets/projects/canva/file-3/preview.png',
          desc: 'Pitch deck template system — modular slides with investor-ready layouts and data visualisations.',
          role: 'Presentation Designer', stack: ['Canva', 'Data Viz', 'Infographics'], year: '2023', status: 'COMPLETE', link: '',
          tree: [ _d('slides', _f('cover.canva','CANVA','4.8kb'), _f('problem.canva','CANVA','5.2kb'), _f('solution.canva','CANVA','6.1kb'), _f('traction.canva','CANVA','7.4kb')),
                  _d('charts', _f('revenue.canva','CANVA','3.9kb'), _f('market-size.canva','CANVA','4.2kb')),
                  _f('README.md','MD','1.8kb') ] },
        { // File 4
          img: '/portfolio-website/assets/projects/canva/file-4/preview.png',
          desc: 'Event branding package — signage, name badges, stage backdrop, and digital assets for a 500-person conference.',
          role: 'Event Designer', stack: ['Canva', 'Print Design', 'Signage', 'Brand'], year: '2024', status: 'COMPLETE', link: '',
          tree: [ _d('print', _f('backdrop-3m.canva','CANVA','12.4kb'), _f('banner-rollup.canva','CANVA','8.6kb'), _f('badge-template.canva','CANVA','3.2kb')),
                  _d('digital', _f('slide-loop.canva','CANVA','9.1kb'), _f('social-announce.canva','CANVA','5.4kb')) ] },
        { // File 5
          img: '/portfolio-website/assets/projects/canva/file-5/preview.png',
          desc: 'Marketing collateral suite — flyers, email headers, and ad creatives for a product launch campaign.',
          role: 'Marketing Designer', stack: ['Canva', 'Email Design', 'Ad Creative', 'Campaign'], year: '2024', status: 'LIVE', link: '',
          tree: [ _d('ads', _f('facebook-1200x628.canva','CANVA','6.8kb'), _f('google-display.canva','CANVA','5.1kb')),
                  _d('email', _f('header-banner.canva','CANVA','4.4kb'), _f('footer.canva','CANVA','2.8kb')),
                  _f('launch-brief.pdf','PDF','3.6kb') ] },
      ] },
    ];

    // Per-project metadata shown in folder files
    const PROJ_META = [
      // [type, status, chips...]
      ['FRONTEND', 'ACTIVE',   ['REACT', 'TS', 'FIGMA']],
      ['BACKEND',  'COMPLETE', ['NODE', 'REST', 'AUTH']],
      ['SYSTEM',   'ACTIVE',   ['PIPELINE', 'ETL', 'SQL']],
      ['INFRA',    'STABLE',   ['REDIS', 'CDN', 'CACHE']],
      ['SERVICE',  'LIVE',     ['WEBHOOKS', 'QUEUE', 'API']],
    ];

    const projCards = Array.from({ length: 5 }, (_, pi) => {
      const el = document.createElement('div');
      el.className = 'proj-card-wrap';
      el.addEventListener('mouseenter', () => { hoveredProjCardIdx = pi; window.__projPanelHover = true; });
      el.addEventListener('mouseleave', () => { hoveredProjCardIdx = -1; window.__projPanelHover = false; });
      el.addEventListener('click', () => {
        if (projDetailIdx < 0 && projDetailTimer < 0.05 && detailTimer > 0.8 && plDoneAt > 0 && Date.now() - plDoneAt >= 1700) {
          _playSound(_enterFileAudio, 0.8);
          projDetailIdx      = pi;
          projDetailOpenedAt = Date.now();
          hoveredProjCardIdx = -1;
        }
      });
      projPanel.appendChild(el);
      return el;
    });

    function projRefresh(animate) {
      projCards.forEach((el, i) => {
        const dist    = i - projCarouselIdx;
        const absDist = Math.abs(dist);
        const offset  = dist * 284;
        const sc      = absDist === 0 ? 1.0 : absDist === 1 ? 0.82 : 0.65;
        const op      = absDist === 0 ? 1.0 : absDist === 1 ? 0.50 : absDist === 2 ? 0.18 : 0;
        el.style.transition = animate
          ? 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.22s'
          : 'none';
        el.style.transform    = `translateX(calc(-50% + ${offset}px)) scale(${sc})`;
        el.style.opacity      = String(op);
        el.style.zIndex       = String(10 - absDist);
        el.style.pointerEvents = absDist === 0 ? 'auto' : 'none';
        el.style.visibility   = op > 0 ? 'visible' : 'hidden';
        el.classList.toggle('proj-card-active', absDist === 0);
      });
      projDots.forEach((dot, i) => dot.classList.toggle('active', i === projCarouselIdx));
      hoveredProjCardIdx = projCarouselIdx;
    }

    function projCarouselGo(dir) {
      if (detailPlanetIdx === BLENDER_PLANET_IDX) return;
      _playCycleRandom(0.45);
      projCarouselIdx = ((projCarouselIdx + dir) % 5 + 5) % 5;
      projRefresh(true);
    }

    // Shared matrix charset — must be declared before cell build AND showDetailUI
    const _MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*<>?/|\\^~=+-';

    // ── Build Blender grid cells (APPLICATIONS now in scope) ─────────────────
    blenderGridCells = Array.from({ length: BLENDER_GRID_ROWS * BLENDER_GRID_COLS }, (_, ci) => {
      const cell = document.createElement('div');
      const appFile = APPLICATIONS[BLENDER_PLANET_IDX]?.files[ci] ?? {};
      const hasContent = !!appFile.model;
      cell.className = 'bg-cell' + (hasContent ? '' : ' bg-cell-empty');

      if (hasContent && appFile.img) {
        const img = document.createElement('img');
        img.src = appFile.img;
        img.alt = '';
        cell.appendChild(img);
      }

      if (!hasContent) {
        const noContent = document.createElement('div');
        noContent.className = 'bg-cell-no-content';
        const dur = (2.8 + Math.random() * 2.0).toFixed(2);
        const dl  = (-Math.random() * parseFloat(dur)).toFixed(2);
        noContent.innerHTML = `<span class="qm-single" style="--dur:${dur}s;--dl:${dl}s">?</span>`;
        cell.appendChild(noContent);
      }

      const label = document.createElement('div');
      label.className = 'bg-cell-label';
      if (appFile.title) {
        label.textContent = appFile.title;
      } else {
        // Seed with random chars immediately; _startMatrixLabels will animate it
        let s = '';
        for (let c = 0; c < 12; c++) s += _MATRIX_CHARS[Math.floor(Math.random() * _MATRIX_CHARS.length)];
        label.textContent = s;
      }
      cell.appendChild(label);

      cell.addEventListener('mouseenter', () => {
        if (!hasContent) return;
        if (cell.classList.contains('bg-entering')) return;
        if (ci !== blenderGridIdx) _playCycleRandom(0.45);
        blenderGridIdx = ci; _refreshBlenderGrid(false);
      });
      cell.addEventListener('click', () => {
        if (!hasContent) return;
        const cellOpacity = parseFloat(window.getComputedStyle(cell).opacity);
        if (cellOpacity < 0.65) return;
        if (!_bgGridLocked && projDetailIdx < 0 && projDetailTimer < 0.05 && detailTimer > 0.8 && plDoneAt > 0 && Date.now() - plDoneAt >= 1700) {
          blenderGridIdx = ci;
          _refreshBlenderGrid(false);
          _bgCellBounce(ci);
          _playSound(_enterFileAudio, 0.8);
          projDetailIdx      = ci;
          projDetailOpenedAt = Date.now();
        }
      });
      blenderGridEl.appendChild(cell);
      return cell;
    });

    // Helper: show / update detail UI for a planet
    const _pinWorld = new THREE.Vector3();
    const _pinProj  = new THREE.Vector3();

    // ── Single-loop matrix system — one RAF drives ALL scrambling text ────────
    // Each entry: { el, len, speed, last }  speed = ms between updates
    const _matrixEntries = [];
    let _matrixRaf = null;

    function _matrixTick(ts) {
      for (let i = 0; i < _matrixEntries.length; i++) {
        const e = _matrixEntries[i];
        if (ts - e.last >= e.speed) {
          let s = '';
          for (let c = 0; c < e.len; c++) s += _MATRIX_CHARS[Math.floor(Math.random() * _MATRIX_CHARS.length)];
          e.el.textContent = s;
          e.last = ts;
        }
      }
      _matrixRaf = requestAnimationFrame(_matrixTick);
    }
    function _matrixAdd(el, len, speedMin, speedMax) {
      _matrixEntries.push({ el, len, speed: speedMin + Math.random() * (speedMax - speedMin), last: 0 });
      if (!_matrixRaf) _matrixRaf = requestAnimationFrame(_matrixTick);
    }
    function _startMatrixLabels(planetIdx) {
      // Remove only pin-label entries (cell label entries stay until grid teardown)
      _matrixEntries.length = 0;
      // Re-add cell labels if on blender
      if (planetIdx === BLENDER_PLANET_IDX) {
        blenderGridCells.forEach((cell, ci) => {
          const appFile = APPLICATIONS[BLENDER_PLANET_IDX]?.files[ci] ?? {};
          if (!appFile.title) {
            const lbl = cell.querySelector('.bg-cell-label');
            if (lbl) _matrixAdd(lbl, 12, 80, 160);
          }
        });
      }
      // Add pin labels
      const files = PLANET_PROJECTS[planetIdx] || [];
      dvPins.forEach((el, pi) => {
        if (!files[pi] || APPLICATIONS[planetIdx].files[pi]?.title) return;
        const span = el.querySelector('span');
        if (span) _matrixAdd(span, 15, 70, 150);
      });
    }
    function _stopMatrixLabels() {
      _matrixEntries.length = 0;
      if (_matrixRaf) { cancelAnimationFrame(_matrixRaf); _matrixRaf = null; }
    }

    function showDetailUI(idx) {
      projCarouselIdx = 0;
      if (idx === BLENDER_PLANET_IDX) { blenderGridIdx = 0; _refreshBlenderGrid(false); }
      const p    = PLANET_DATA[idx];
      const col  = '#' + new THREE.Color(p.color).getHexString();
      const colD = col + '44';
      const skill = PLANET_SKILLS[idx];
      const stars = '★'.repeat(skill.rating) + '☆'.repeat(5 - skill.rating);
      dvBack.innerHTML = `<span style="position:relative;z-index:1">← SOLAR SYSTEM</span>${_tracerSVG(col, 2)}`;
      dvBack.classList.add('visible');
      dvPlanet.innerHTML = `<div id="dv-planet-dot"></div><div id="dv-planet-name"></div>`;
      dvPlanet.classList.add('visible');
      document.getElementById('dv-planet-dot').style.cssText += `;background:${col};color:${col}`;
      const initialLabel = `PLANET ${skill.name.toUpperCase()}`;
      document.getElementById('dv-planet-name').textContent = initialLabel;
      twText = initialLabel; twTarget = initialLabel; twLastLabel = initialLabel; twPhase = 'idle';
      dvPins.forEach((el, pi) => {
        const hasTitle = !!APPLICATIONS[idx].files[pi]?.title;
        const span = el.querySelector('span');
        if (hasTitle) {
          span.textContent = PLANET_PROJECTS[idx][pi] ?? '';
        } else {
          // Immediately fill with random chars so "File #N" never flashes
          let s = '';
          for (let c = 0; c < 15; c++) s += _MATRIX_CHARS[Math.floor(Math.random() * _MATRIX_CHARS.length)];
          span.textContent = s;
        }
        el.querySelector('.dv-pin-dot').style.background = col;
        el.querySelector('.dv-pin-dot').style.boxShadow  = `0 0 8px 2px ${col}`;
      });
      _startMatrixLabels(idx);
      // Update project cards — sci-fi folder design with fan-out files
      projCards.forEach((el, pi) => {
        const num  = String(pi + 1).padStart(2, '0');
        const meta = PROJ_META[pi];
        const [mType, mStatus, mChips] = meta;
        el.style.borderColor = col + '66';

        // Unique abstract SVG thumbnail per card (deterministic from pi + idx)
        const seed = (pi * 7 + idx * 3);
        const thumbLines = Array.from({ length: 6 }, (_, i) => {
          const y  = 10 + i * 10;
          const w  = 30 + ((seed * (i + 1) * 37) % 110);
          const op = 0.15 + ((seed * (i + 3) * 13) % 40) / 100;
          return `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${col}" stroke-width="1" opacity="${op.toFixed(2)}"/>`;
        }).join('');
        const thumbDots = Array.from({ length: 8 }, (_, i) => {
          const cx = 10 + ((seed * (i + 2) * 29) % 140);
          const cy = 8  + ((seed * (i + 5) * 17) % 54);
          const r  = 1 + ((seed * (i + 1) * 11) % 3);
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="0.35"/>`;
        }).join('');

        const appFile = APPLICATIONS[idx]?.files[pi] ?? {};
        const treeVids = extractVideos(appFile.tree || []).map(v => ({ src: v.v, isVideo: true }));
        const stillImgs = [appFile.img, ...(appFile.bioImgs || [])].filter(Boolean).map(s => ({ src: s, isVideo: false }));
        const media = [...stillImgs, ...treeVids].slice(0, 4);
        const mockups = [
          `<div style="font-size:6px;letter-spacing:0.4em;opacity:0.3">// LOG</div>
           <div class="proj-file-line" style="background:${col}"></div>
           <div style="font-size:6px;opacity:0.18;line-height:2;letter-spacing:0.28em">[OK] INIT_${String((seed*13)%99+1).padStart(2,'0')}<br>[OK] AUTH_PASS<br>[--] PENDING</div>`,
          `<div style="font-size:6px;letter-spacing:0.4em;opacity:0.3">// METRICS</div>
           <div class="proj-file-line" style="background:${col}"></div>
           ${[70,45,88].map((v,i)=>`<div style="display:flex;align-items:center;gap:5px;margin-top:3px"><div style="font-size:5px;letter-spacing:0.3em;opacity:0.35;width:22px">M${i+1}</div><div style="flex:1;height:3px;background:${col}18;position:relative"><div style="position:absolute;left:0;top:0;height:100%;width:${v}%;background:${col};opacity:0.55"></div></div><div style="font-size:5px;opacity:0.35">${v}%</div></div>`).join('')}`,
          `<div style="font-size:6px;letter-spacing:0.4em;opacity:0.35">// REFS</div>
           <div class="proj-file-line" style="background:${col}"></div>
           <div class="proj-file-datarow">${mChips.map(c=>`<span class="proj-file-chip" style="border-color:${col}33;color:${col}">${c}</span>`).join('')}</div>`,
          `<div style="font-size:6px;letter-spacing:0.4em;opacity:0.35">// DATA</div>
           <div class="proj-file-line" style="background:${col}"></div>
           <div class="proj-metabox" style="border-color:${col}22"><span class="proj-metabox-label">TYPE</span><span class="proj-metabox-val" style="color:${col}">${mType}</span></div>
           <div class="proj-metabox" style="border-color:${col}22;margin-top:4px"><span class="proj-metabox-label">STATUS</span><span class="proj-metabox-val" style="color:${col}">${mStatus}</span></div>`,
        ];
        const FAN_X = {
          1: [0],
          2: [-124, 124],
          3: [-248, 0, 248],
          4: [-372, -124, 124, 372],
        };
        const fanPositions = FAN_X[media.length] || [];
        const noContentLayer = `
          <div style="position:absolute;inset:0;padding:7px 9px;box-sizing:border-box;display:flex;flex-direction:column;gap:5px;font-family:'Bungee Hairline',sans-serif">
            <div style="font-size:6px;letter-spacing:0.4em;color:${col};opacity:0.5">// PREVIEW</div>
            <div style="height:1px;background:${col};opacity:0.2;flex-shrink:0"></div>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <rect x="1" y="1" width="24" height="24" rx="1" stroke="${col}" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.5"/>
                <line x1="7" y1="13" x2="19" y2="13" stroke="${col}" stroke-width="0.8" opacity="0.4"/>
                <line x1="13" y1="7" x2="13" y2="19" stroke="${col}" stroke-width="0.8" opacity="0.4"/>
              </svg>
              <span style="font-size:6px;letter-spacing:0.35em;color:${col};opacity:0.5;text-transform:uppercase">No Content</span>
            </div>
          </div>`;
        const fanCards = media.length === 0
          ? `<div class="proj-file proj-file-no-content" style="--fan-x:0px;background:rgba(4,4,8,0.95);border-color:${col}44;padding:0;overflow:hidden">
               <div style="position:relative;width:100%;height:100%">${noContentLayer}</div>
             </div>`
          : media.map((item, i) => {
              const xpx = `${fanPositions[i]}px`;
              return item.isVideo
                ? `<div class="proj-file proj-fan-video" data-src="${item.src}" style="--fan-x:${xpx};background:#000;border-color:${col}44;padding:0;overflow:hidden"></div>`
                : `<div class="proj-file" style="--fan-x:${xpx};background:rgba(4,4,8,0.95);border-color:${col}44;padding:0;overflow:hidden">
                     <div style="position:relative;width:100%;height:100%">
                       ${noContentLayer}
                       <img src="${item.src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.82;display:block;pointer-events:none" onerror="this.style.display='none'"/>
                     </div>
                   </div>`;
            }).join('');

        el.innerHTML = `
          ${fanCards}

          <!-- Folder face on top of files -->
          <div class="proj-folder-face" style="border-color:${col}55;color:${col}">
            <svg class="proj-card-corner" width="12" height="12">
              <polygon points="0,0 12,12 12,0" fill="${col}" opacity="0.55"/>
            </svg>
            <div class="proj-folder-tab" style="border-bottom-color:${col}33">
              <span class="proj-folder-tab-id">SYS-${num}</span>
              <span class="proj-folder-tab-name" style="text-shadow:0 0 8px ${col}55">${PLANET_PROJECTS[idx][pi]}</span>
            </div>
            <div class="proj-folder-body">
              <div class="proj-thumb" style="border-color:${col}2a">
                <svg width="100%" height="120" style="display:block;position:absolute;top:0;left:0">
                  <defs>
                    <linearGradient id="pg${idx}${pi}" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="${col}" stop-opacity="0.08"/>
                      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  ${thumbLines}
                  ${thumbDots}
                  <rect x="0" y="0" width="100%" height="100%" fill="url(#pg${idx}${pi})" opacity="0.5"/>
                </svg>
                <div class="proj-thumb-scanline"></div>
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none">
                  ${appFile.logo
                    ? `<img src="${appFile.logo}" style="max-width:75%;max-height:70%;object-fit:contain;opacity:0.85;filter:drop-shadow(0 0 12px ${col}88)" onerror="this.style.display='none'">`
                    : `<span style="font-family:'Bungee Hairline',sans-serif;font-size:22px;letter-spacing:0.25em;text-transform:uppercase;color:${col};opacity:0.55;text-shadow:0 0 18px ${col},0 0 40px ${col}66;user-select:none">${APPLICATIONS[idx]?.name || ''}</span>`
                  }
                </div>
              </div>
              <div style="padding:2px 2px 0;font-size:9px;letter-spacing:0.18em;color:${col};text-shadow:0 0 10px ${col}88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase">${appFile.title || PLANET_PROJECTS[idx][pi]}</div>
            </div>
          </div>
        `;
      });
      // ── Planet loader: collect all media and track load progress ────────
      plLoadProgress = 0; plLoadReady = false; plFadeOutTimer = 0; plVisible = true; plFadeInTimer = 0; plFilesCanFadeIn = false; plDispPct = 0; plDigitTimer = 0; plRingSmooth = 0; plPauseTimer = 0;
      const _pauseCount = 1 + Math.floor(Math.random() * 3);
      plPausePoints = Array.from({ length: _pauseCount }, () => 10 + Math.floor(Math.random() * 80)).sort((a,b) => a-b);
      plRing.style.stroke = col;
      planetLoaderEl.style.setProperty('--pl-col', col);
      plLabel.textContent = `Loading ${skill.name}`;
      planetLoaderEl.classList.add('visible');
      _loadingAudio.currentTime = 0;
      _loadingAudio.play().catch(() => {});

      const allFanMedia = [];
      projCards.forEach((_, pi) => {
        const af = APPLICATIONS[idx]?.files[pi] ?? {};
        const vids = extractVideos(af.tree || []).map(v => ({ src: v.v, isVideo: true }));
        const imgs = [af.img, ...(af.bioImgs || [])].filter(Boolean).map(s => ({ src: s, isVideo: false }));
        [...imgs, ...vids].slice(0, 4).forEach(m => allFanMedia.push(m));
      });

      const total = allFanMedia.length;
      if (total === 0) {
        // Still do a short fake tick so the ring shows briefly
        let step = 0;
        const tick = () => {
          step++;
          plLoadProgress = step / 3;
          if (step >= 3) { plLoadReady = true; } else { setTimeout(tick, 100); }
        };
        setTimeout(tick, 100);
      } else {
        let step = 0;
        const tick = () => {
          step++;
          plLoadProgress = step / total;
          if (step >= total) { plLoadReady = true; } else { setTimeout(tick, 100); }
        };
        setTimeout(tick, 100);
      }

      // Wire up fan-out video elements (must use createElement — innerHTML videos don't autoplay)
      projPanel.querySelectorAll('.proj-fan-video').forEach((div, fi) => {
        const video = document.createElement('video');
        video.src         = div.dataset.src;
        video.muted       = true;
        video.loop        = true;
        video.playsInline = true;
        video.preload     = 'none';
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0.82;display:block;pointer-events:none';
        div.appendChild(video);
        const tryPlay = () => video.play().catch(() => {});
        video.addEventListener('loadeddata',    () => { video.currentTime = 0; tryPlay(); }, { once: true });
        video.addEventListener('canplaythrough', tryPlay, { once: true });
        setTimeout(() => video.load(), fi * 600);
      });

      // Set dot colors and reset carousel
      projDots.forEach(dot => { dot.style.color = col; });
      projRefresh(false);
      // Update icon panel
      const corner = _pipCornerSVG(col);
      iconPanel.innerHTML = `
        <div class="pip-frame" style="color:${col}">
          <div class="pip-corner pip-tl">${corner}</div>
          <div class="pip-corner pip-tr">${corner}</div>
          <div class="pip-corner pip-bl">${corner}</div>
          <div class="pip-corner pip-br">${corner}</div>
          <div class="pip-tag" style="color:${col}">// SKILL NODE</div>
          <div class="pip-img-wrap" style="border-color:${col}; color:${col}">
            <img src="${p.image}" class="pip-icon" style="color:${col}" />
          </div>
          <div class="pip-divider" style="background:linear-gradient(to right,transparent,${col},transparent)"></div>
          <div class="pip-name" style="color:${col};text-shadow:0 0 12px ${col}88">${skill.name.toUpperCase()}</div>
          <div class="pip-rating" style="color:${col}">${stars}</div>
        </div>
      `;
    }
    function hideDetailUI() {
      _stopMatrixLabels();
      _loadingAudio.pause();
      _loadingAudio.currentTime = 0;
      _playSound(_exitAudio, 0.8);
      dvBack.classList.remove('visible');
      dvPlanet.classList.remove('visible');
      dvPins.forEach(el => el.classList.remove('visible'));
      iconPanel.innerHTML = '';
      plLoadProgress = 0; plLoadReady = false; plFadeOutTimer = 0; plVisible = false; plFadeInTimer = 0; plFilesCanFadeIn = false; plDispPct = 0; plDigitTimer = 0; plRingSmooth = 0; plPauseTimer = 0; plPausePoints = []; planetExitAllowed = false; plDoneAt = 0; plExitToken++;
      if (plFadeTimeoutId) { clearTimeout(plFadeTimeoutId); plFadeTimeoutId = null; }
      planetLoaderEl.classList.remove('visible', 'done');
      spherePulseT = -1;
      // Reset ring/text opacity in case they were mid-fade
      const _plSvg = planetLoaderEl.querySelector('svg');
      if (_plSvg) { _plSvg.style.opacity = ''; _plSvg.style.animation = ''; }
      plPct.style.opacity = ''; plPct.style.animation = '';
      plLabel.style.opacity = ''; plLabel.style.animation = '';
      [1,2,3,4].forEach(n => {
        const el = document.getElementById(`pl-burst-${n}`);
        if (el) el.style.animation = 'none';
      });
    }

    // ── HUD builder ───────────────────────────────────────────────────────
    function buildHudHTML(skill, col, bgCol, image) {
      const { name, rating } = skill;
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      // Layout: top panels (110px) + ring SVG (280px) = 390px total
      // Ring center at (140, 110+140) = (140, 250) from top-left of container
      // menuEl transform will shift so ring center sits on planet
      const W = 280, RX = W/2, RY = W/2;
      const OR = 120;
      const fn = n => n.toFixed(2);

      function arc(r, s, e) {
        const rad = a => (a - 90) * Math.PI / 180;
        const x1 = RX + r*Math.cos(rad(s)), y1 = RY + r*Math.sin(rad(s));
        const x2 = RX + r*Math.cos(rad(e)), y2 = RY + r*Math.sin(rad(e));
        return `M${fn(x1)},${fn(y1)} A${r},${r} 0 ${(e-s)>180?1:0} 1 ${fn(x2)},${fn(y2)}`;
      }

      let ticks = '';
      for (let a = 0; a < 360; a += 6) {
        const rad = (a - 90) * Math.PI / 180;
        const long = a % 30 === 0, med = a % 12 === 0;
        const len = long ? 11 : med ? 7 : 4;
        const op  = long ? 0.75 : med ? 0.4 : 0.2;
        const sw  = long ? 1.5 : 0.8;
        ticks += `<line
          x1="${fn(RX+(OR-len)*Math.cos(rad))}" y1="${fn(RY+(OR-len)*Math.sin(rad))}"
          x2="${fn(RX+OR*Math.cos(rad))}"       y2="${fn(RY+OR*Math.sin(rad))}"
          stroke="${col}" stroke-width="${sw}" opacity="${op}"/>`;
      }

      return `
      <div style="position:relative;width:${W}px;">
        <!-- ── Skill name — full-width header ── -->
        <div style="
          background:${bgCol};border:1px solid ${col}55;border-bottom:2px solid ${col};
          padding:10px 16px 8px;
          clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%);
          position:relative;
          display:flex;align-items:center;gap:12px;
        ">
          <div style="flex:1;min-width:0;">
            <div style="font-size:9px;color:${col};opacity:0.55;letter-spacing:0.35em;margin-bottom:5px">// TARGET ACQUIRED</div>
            <div style="font-size:22px;color:${col};text-shadow:0 0 14px ${col},0 0 30px ${col}55;font-weight:900;letter-spacing:0.06em">${name}</div>
          </div>
          ${image ? `
          <div style="position:relative;width:48px;height:48px;flex-shrink:0;">
            <svg width="48" height="48" style="position:absolute;top:0;left:0;overflow:visible;">
              <circle cx="24" cy="24" r="21" fill="none" stroke="${col}" stroke-width="1" opacity="0.4"/>
            </svg>
            <img src="${image}" style="
              position:absolute;left:50%;top:50%;
              transform:translate(-50%,-50%);
              width:40px;height:40px;
              border-radius:50%;object-fit:contain;opacity:0.9;
            "/>
          </div>
          ` : ''}
          <svg style="position:absolute;top:0;right:0" width="18" height="18">
            <polygon points="0,0 18,18 18,0" fill="${col}" opacity="0.6"/>
          </svg>
        </div>
        <!-- horizontal scan line -->
        <div style="height:2px;background:linear-gradient(to right,${col}aa,${col}22,transparent);margin-bottom:0"></div>
        <!-- ── Star rating — left tab ── -->
        <div style="
          display:inline-block;background:${bgCol};
          border:1px solid ${col}44;border-top:none;border-right:1px solid ${col}66;
          padding:5px 14px 6px;margin-bottom:4px;
          clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);
        ">
          <div style="font-size:12px;color:${col};text-shadow:0 0 10px ${col};letter-spacing:0.2em">${stars}</div>
        </div>
        <!-- ── Ring SVG (planet shows through, rings drawn on top) ── -->
        <div style="position:relative;display:inline-block;">
          <svg width="${W}" height="${W}" style="display:block;overflow:visible;position:relative;z-index:1;">

          <!-- Outer halo — JS-driven sporadic rotation -->
          <g style="filter:drop-shadow(0 0 6px ${col}) drop-shadow(0 0 18px ${col})">
            <g data-ring="outer">
              <path d="${arc(OR+16, 15, 80)}"  fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/>
              <path d="${arc(OR+16,105,165)}"  fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/>
              <path d="${arc(OR+16,195,345)}"  fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/>
            </g>
          </g>

          <!-- Main outer ring — two arcs with gaps at top and bottom -->
          <path d="${arc(OR,  8, 172)}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.6"/>
          <path d="${arc(OR,188, 352)}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.6"/>

          <!-- Tick marks -->
          ${ticks}

          <!-- Mid arcs — JS-driven sporadic counter-rotation -->
          <g style="filter:drop-shadow(0 0 8px ${col}) drop-shadow(0 0 22px ${col}) drop-shadow(0 0 40px ${col}55)">
            <g data-ring="mid">
              <path d="${arc(102, 20, 95)}"  fill="none" stroke="${col}" stroke-width="2.5" opacity="1"/>
              <path d="${arc(102,120,175)}"  fill="none" stroke="${col}" stroke-width="2.5" opacity="1"/>
              <path d="${arc(102,200,350)}"  fill="none" stroke="${col}" stroke-width="2.5" opacity="1"/>
            </g>
          </g>

          <!-- Bright accent arc bottom-right — extra glow -->
          <g style="filter:drop-shadow(0 0 10px ${col}) drop-shadow(0 0 28px ${col}) drop-shadow(0 0 50px ${col})">
            <path d="${arc(102, 295, 355)}" fill="none" stroke="${col}" stroke-width="6" opacity="1" stroke-linecap="round"/>
          </g>

          <!-- Inner ring -->
          <path d="${arc(82,  5, 172)}" fill="none" stroke="${col}" stroke-width="0.8" opacity="0.2"/>
          <path d="${arc(82,192, 355)}" fill="none" stroke="${col}" stroke-width="0.8" opacity="0.2"/>

          <!-- Left angle bracket — flicker-a -->
          <g style="animation:hud-flicker-a 1.0s 0.10s ease both">
            <path d="M${fn(RX-OR-10)},${fn(RY-16)} L${fn(RX-OR-24)},${RY} L${fn(RX-OR-10)},${fn(RY+16)}"
              fill="none" stroke="${col}" stroke-width="2.5" opacity="0.8" stroke-linecap="round" stroke-linejoin="round"/>
          </g>

          <!-- Right angle bracket — flicker-b -->
          <g style="animation:hud-flicker-b 1.1s 0.20s ease both">
            <path d="M${fn(RX+OR+10)},${fn(RY-16)} L${fn(RX+OR+24)},${RY} L${fn(RX+OR+10)},${fn(RY+16)}"
              fill="none" stroke="${col}" stroke-width="2.5" opacity="0.8" stroke-linecap="round" stroke-linejoin="round"/>
          </g>

          <!-- Top crosshair — flicker-c -->
          <g style="animation:hud-flicker-c 0.9s 0.00s ease both">
            <line x1="${RX-6}" y1="${RY-OR-10}" x2="${RX+6}" y2="${RY-OR-10}" stroke="${col}" stroke-width="2" opacity="0.9"/>
            <line x1="${RX}"   y1="${RY-OR-4}"  x2="${RX}"   y2="${RY-OR-16}" stroke="${col}" stroke-width="2" opacity="0.9"/>
          </g>

          <!-- Bottom tick — flicker-a, delayed -->
          <g style="animation:hud-flicker-a 1.2s 0.35s ease both">
            <line x1="${RX-6}" y1="${RY+OR+10}" x2="${RX+6}" y2="${RY+OR+10}" stroke="${col}" stroke-width="2" opacity="0.9"/>
          </g>

          <!-- Left data labels — staggered flickers -->
          <g style="animation:hud-flicker-b 1.3s 0.15s ease both">
            <text x="${fn(RX-OR-32)}" y="${fn(RY-24)}" fill="${col}" font-family="'Bungee Hairline',sans-serif" font-size="9" opacity="0.55" text-anchor="end">${(rating/5*100).toFixed(0)}%</text>
            <line x1="${fn(RX-OR-24)}" y1="${fn(RY-26)}" x2="${fn(RX-OR-3)}" y2="${fn(RY-26)}" stroke="${col}" stroke-width="0.7" opacity="0.3"/>
          </g>
          <g style="animation:hud-flicker-c 1.1s 0.25s ease both">
            <rect x="${fn(RX-OR-54)}" y="${fn(RY-8)}" width="44" height="16" fill="none" stroke="${col}" stroke-width="0.8" opacity="0.4"/>
            <text x="${fn(RX-OR-32)}" y="${fn(RY+5)}" fill="${col}" font-family="'Bungee Hairline',sans-serif" font-size="9" opacity="0.75" text-anchor="middle">LVL ${rating}</text>
            <line x1="${fn(RX-OR-10)}" y1="${fn(RY+8)}" x2="${fn(RX-OR-3)}" y2="${fn(RY+8)}" stroke="${col}" stroke-width="0.7" opacity="0.3"/>
          </g>
          <g style="animation:hud-flicker-a 1.4s 0.40s ease both">
            <text x="${fn(RX-OR-32)}" y="${fn(RY+28)}" fill="${col}" font-family="'Bungee Hairline',sans-serif" font-size="9" opacity="0.45" text-anchor="end">${(rating*20-10).toFixed(0)}p</text>
            <line x1="${fn(RX-OR-24)}" y1="${fn(RY+26)}" x2="${fn(RX-OR-3)}" y2="${fn(RY+26)}" stroke="${col}" stroke-width="0.7" opacity="0.3"/>
          </g>
        </svg>
        </div>
      </div>`;
    }

    // ── Scene & Camera ────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 32, 2);
    camera.lookAt(new THREE.Vector3(0, 2, -12));

    // ── Dot texture (soft radial gradient, 64x64) ─────────────────────────
    function makeGlowTex(size, stops) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const cx = c.getContext('2d');
      const g  = cx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      stops.forEach(([pos, col]) => g.addColorStop(pos, col));
      cx.fillStyle = g;
      cx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }
    const dotTex = makeGlowTex(64, [
      [0,    'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,0.5)'],
      [1,    'rgba(255,255,255,0)'],
    ]);

    // ── Procedural planet terrain texture ────────────────────────────────
    function makePlanetTexture(baseHex, accentHex) {
      const SIZE = 512;
      const base   = new THREE.Color(baseHex);
      const accent = new THREE.Color(accentHex);

      // Perlin noise — seeded per planet via baseHex for distinct terrain on each planet
      const seed = baseHex >>> 0;
      const p256 = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p256[i] = i;
      let rng = seed;
      for (let i = 255; i > 0; i--) {
        rng = (rng * 1664525 + 1013904223) >>> 0;
        const j = rng % (i + 1);
        const tmp = p256[i]; p256[i] = p256[j]; p256[j] = tmp;
      }
      const perm = new Uint8Array(512);
      for (let i = 0; i < 512; i++) perm[i] = p256[i & 255];
      const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
      const grad2 = (h, x, y) => {
        switch (h & 7) {
          case 0: return  x + y; case 1: return -x + y;
          case 2: return  x - y; case 3: return -x - y;
          case 4: return  x;     case 5: return -x;
          case 6: return  y;     default: return -y;
        }
      };
      const lp = (a, b, t) => a + t * (b - a);
      const pnoise = (x, y) => {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = fade(xf), v = fade(yf);
        const aa = perm[perm[X]  +Y],   ab = perm[perm[X]  +Y+1];
        const ba = perm[perm[X+1]+Y],   bb = perm[perm[X+1]+Y+1];
        return (lp(lp(grad2(aa,xf,yf),   grad2(ba,xf-1,yf),   u),
                   lp(grad2(ab,xf,yf-1), grad2(bb,xf-1,yf-1), u), v) + 1) * 0.5;
      };
      const fbm = (x, y) => {
        let v=0, a=0.5, f=1;
        for (let o=0; o<7; o++) { v+=a*pnoise(x*f,y*f); a*=0.5; f*=2.1; }
        return v;
      };

      // Pass 1 — build height map
      const hmap = new Float32Array(SIZE * SIZE);
      for (let y=0; y<SIZE; y++) {
        for (let x=0; x<SIZE; x++) {
          const ang  = (x/SIZE)*Math.PI*2;
          const cx_s = Math.cos(ang)*1.5+2, sx_s = Math.sin(ang)*1.5+2;
          const ny   = (y/SIZE)*4;
          const n1   = fbm(cx_s,       ny+sx_s*0.25);
          const n2   = fbm(cx_s+5.2,   ny+sx_s*0.25+1.3);
          hmap[y*SIZE+x] = fbm(cx_s+n1*1.6, ny+sx_s*0.25+n2*1.6);
        }
      }

      // Pass 2 — color + baked bump shading from height gradient
      const colorCv = document.createElement('canvas');
      colorCv.width = colorCv.height = SIZE;
      const colorImg = colorCv.getContext('2d').createImageData(SIZE, SIZE);
      const cpx = colorImg.data;

      const bumpCv = document.createElement('canvas');
      bumpCv.width = bumpCv.height = SIZE;
      const bumpCtx = bumpCv.getContext('2d');
      const bumpImg = bumpCtx.createImageData(SIZE, SIZE);
      const bpx = bumpImg.data;

      for (let y=0; y<SIZE; y++) {
        for (let x=0; x<SIZE; x++) {
          const w = hmap[y*SIZE+x];

          // Terrain coloring — no baked shading, MeshStandardMaterial + scene lights handle it
          let r, g, b;
          if (w < 0.38) {
            const t = w/0.38;
            r=lerp(base.r*0.35, base.r*0.75, t);
            g=lerp(base.g*0.35, base.g*0.75, t);
            b=lerp(base.b*0.35, base.b*0.75, t);
          } else if (w < 0.62) {
            const t = (w-0.38)/0.24;
            r=lerp(base.r*0.75, accent.r, t);
            g=lerp(base.g*0.75, accent.g, t);
            b=lerp(base.b*0.75, accent.b, t);
          } else {
            const t = (w-0.62)/0.38;
            r=lerp(accent.r, Math.min(1,base.r*1.4), t);
            g=lerp(accent.g, Math.min(1,base.g*1.4), t);
            b=lerp(accent.b, Math.min(1,base.b*1.4), t);
          }

          const i = (y*SIZE+x)*4;
          cpx[i]   = Math.round(Math.min(255,Math.max(0, r*255)));
          cpx[i+1] = Math.round(Math.min(255,Math.max(0, g*255)));
          cpx[i+2] = Math.round(Math.min(255,Math.max(0, b*255)));
          cpx[i+3] = 255;

          const bv = Math.round(w * 255);
          bpx[i]=bpx[i+1]=bpx[i+2]=bv; bpx[i+3]=255;
        }
      }

      colorCv.getContext('2d').putImageData(colorImg, 0, 0);
      bumpCtx.putImageData(bumpImg, 0, 0);
      return {
        colorTex: new THREE.CanvasTexture(colorCv),
        bumpTex:  new THREE.CanvasTexture(bumpCv),
      };
    }

    // Accent colours — the "other colour" visible in terrain alongside the orb's base colour
    const PLANET_ACCENTS = [
      0x1abcfe, // Figma      → Figma blue accent over purple
      0x4488cc, // Blender    → blue accent over orange
      0xffffff, // Framer     → white over black
      0xddeeff, // Godot      → near-white over blue
      0xcc3300, // Illustrator→ dark orange over orange
      0x4488cc, // Shopify    → blue over green
    ];

    // ── Rectangular wave grid ─────────────────────────────────────────────
    const COLS = 0;
    const ROWS = 0;
    const SPACING = 0.65;
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const baseXZ    = new Float32Array(count * 2);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        const x = (col - COLS / 2) * SPACING;
        const z = (row - ROWS / 2) * SPACING;
        positions[i*3]   = x;
        positions[i*3+1] = 0;
        positions[i*3+2] = z;
        baseXZ[i*2]   = x;
        baseXZ[i*2+1] = z;
        colors[i*3] = colors[i*3+1] = colors[i*3+2] = 0.3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.13,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      alphaMap: dotTex,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    points.position.y = -5;
    points.renderOrder = 1;
    scene.add(points);

    // ── Disc pre-computation ───────────────────────────────────────────────
    // 7 concentric orbital bands
    // Fibonacci sunflower disc — each particle gets a unique position
    // in a circle centred on the sun, uniformly filled
    const DISC_MAX_R    = 26;          // world radius of the disc
    const DISC_LOCAL_Y  = 7;          // local Y (world Y = 2, matches orbit ring plane)
    const DISC_GOLDEN   = Math.PI * (3 - Math.sqrt(5));
    const DISC_TILT     = 0.0;        // flat on XZ plane, matches particle grid

    // Sun world position
    const SUN_WORLD = new THREE.Vector3(0, 2, -12);

    // Lights — only affect MeshStandardMaterial (planets); MeshBasicMaterial ignores them
    scene.add(new THREE.AmbientLight(0x888899, 2.5));
    const sunLight = new THREE.PointLight(0xffffcc, 8, 150, 0.5);
    sunLight.position.copy(SUN_WORLD);
    scene.add(sunLight);

    // disc targets — concentric rings centred on the sun
    const discTargetX    = new Float32Array(count);
    const discTargetZ    = new Float32Array(count);
    const discRingIndex  = new Uint8Array(count);   // 0=even ring, 1=odd ring
    const discRingRadius = new Float32Array(count); // orbit radius per particle
    const discBaseAngle  = new Float32Array(count); // base angle per particle
    {
      const DISC_RING_GAP = 0.60;
      let di = 0;
      for (let r = 1; di < count; r++) {
        const radius  = DISC_RING_GAP * r * (1 + 0.12 * r);
        const dotGap  = 0.10 + 0.09 * r; // super dense at center, sparse at edge
        const n = Math.min(
          Math.max(6, Math.round((2 * Math.PI * radius) / dotGap)),
          count - di
        );
        for (let j = 0; j < n; j++) {
          const angle = (j / n) * Math.PI * 2;
          discTargetX[di]    = SUN_WORLD.x + radius * Math.cos(angle);
          discTargetZ[di]    = SUN_WORLD.z + radius * Math.sin(angle);
          discRingIndex[di]  = r % 2;
          discRingRadius[di] = radius;
          discBaseAngle[di]  = angle;
          di++;
        }
      }
    }
    // Points mesh is at y = -5, so local offset = world.y - (-5) = world.y + 5
    const POINTS_Y_OFFSET = 5; // points.position.y = -5, so localY = worldY + 5

    // ── Sphere formation (planet detail mode) ─────────────────────────────
    // Sphere centered at SUN_WORLD → local (0, 7, -12)
    const SPHERE_R  = 6.5;
    const SPHERE_CY = 7; // local Y of sphere center
    const SPHERE_CZ = -12; // local Z of sphere center
    const SPHERE_DOT_COUNT = 500; // max dots on sphere in planet detail view
    const sphNX = new Float32Array(SPHERE_DOT_COUNT); // unit sphere normals (pre-rotation)
    const sphNY = new Float32Array(SPHERE_DOT_COUNT);
    const sphNZ = new Float32Array(SPHERE_DOT_COUNT);
    const sphBreathFreq  = new Float32Array(SPHERE_DOT_COUNT); // cycles/sec per dot
    const sphBreathPhase = new Float32Array(SPHERE_DOT_COUNT); // phase offset per dot
    const sphBreathAmp   = new Float32Array(SPHERE_DOT_COUNT); // radius variation per dot
    const sphPulseAmp    = new Float32Array(SPHERE_DOT_COUNT); // per-dot pulse expansion amount
    for (let i = 0; i < SPHERE_DOT_COUNT; i++) {
      const yy  = 1 - (i / (SPHERE_DOT_COUNT - 1)) * 2;
      const rr  = Math.sqrt(Math.max(0, 1 - yy * yy));
      const th  = DISC_GOLDEN * i;
      sphNX[i]  = rr * Math.cos(th);
      sphNY[i]  = yy;
      sphNZ[i]  = rr * Math.sin(th);
      const r1 = ((i * 2654435761) >>> 0) / 4294967296;
      const r2 = ((i * 1234567891 + 999) >>> 0) / 4294967296;
      const r3 = ((i * 987654321  +  42) >>> 0) / 4294967296;
      const r4 = ((i * 1357924680 + 777) >>> 0) / 4294967296;
      sphBreathFreq[i]  = 0.06 + r1 * 0.12;
      sphBreathPhase[i] = r2 * Math.PI * 2;
      sphBreathAmp[i]   = 0.012 + r3 * 0.02;
      sphPulseAmp[i]    = 0.06 + r4 * 0.12; // 0.06–0.18 subtle random expansion per dot
    }

    // Derive PLANET_PROJECTS from APPLICATIONS — use project title when available
    const PLANET_PROJECTS = APPLICATIONS.map(app => app.files.map((f, i) => f.title || `File ${i + 1}`));

    // Pin unit-sphere normals (shared shape for all planets)
    const PIN_MAX = 35;
    const PIN_UNIT = Array.from({ length: PIN_MAX }, (_, i) => {
      const golden = Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (i / (PIN_MAX - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      return { nx: Math.cos(theta) * r, ny: y, nz: Math.sin(theta) * r };
    });

    // ── Rim glow shader ───────────────────────────────────────────────────
    const rimVertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-worldPos.xyz);
        gl_Position = projectionMatrix * worldPos;
      }
    `;
    const rimFragmentShader = `
      uniform vec3 glowColor;
      uniform float intensity;
      uniform float opacity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 norm = normalize(vNormal);
        vec3 viewDir = normalize(vViewDir);
        float rimFactor = pow(1.0 - dot(norm, viewDir), 2.5) * intensity;
        gl_FragColor = vec4(glowColor, rimFactor * opacity);
      }
    `;

    function makeRimMaterial(color, intensity) {
      return new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(color) },
          intensity: { value: intensity },
          opacity:   { value: 1.0 },
        },
        vertexShader:   rimVertexShader,
        fragmentShader: rimFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      });
    }

    // ── Corona sprite texture ─────────────────────────────────────────────
    const coronaTex = makeGlowTex(256, [
      [0,    'rgba(255,255,200,1)'],
      [0.12, 'rgba(255,220,80,0.9)'],
      [0.35, 'rgba(255,140,20,0.5)'],
      [0.65, 'rgba(255,80,0,0.12)'],
      [1,    'rgba(255,50,0,0)'],
    ]);

    // ── Galaxy starfield background ───────────────────────────────────────
    const STAR_COUNT = 0;
    const starPos  = new Float32Array(STAR_COUNT * 3);
    const starCol  = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      // 65% in a galactic band, 35% scattered
      const inBand = Math.random() < 0.65;
      const theta  = Math.random() * Math.PI * 2;
      const phi    = inBand
        ? Math.PI / 2 + (Math.random() - 0.5) * 0.5   // near equatorial band
        : Math.acos(2 * Math.random() - 1);             // uniform sphere
      const r = 200 + Math.random() * 80;
      starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      starPos[i*3+1] = r * Math.cos(phi);
      starPos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      // Color: blue-white / white / warm-white mix
      const cr = Math.random();
      const br = 0.55 + Math.random() * 0.45; // brightness
      if (cr < 0.3) { starCol[i*3]=br*0.72; starCol[i*3+1]=br*0.82; starCol[i*3+2]=br; }      // blue-white
      else if (cr < 0.5) { starCol[i*3]=br; starCol[i*3+1]=br*0.92; starCol[i*3+2]=br*0.65; } // warm
      else { starCol[i*3]=br; starCol[i*3+1]=br; starCol[i*3+2]=br; }                          // white
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color',    new THREE.BufferAttribute(starCol, 3));
    const starTex = makeGlowTex(32, [
      [0,   'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.6)'],
      [1,   'rgba(255,255,255,0)'],
    ]);
    const starMat = new THREE.PointsMaterial({
      size: 0.55, sizeAttenuation: true,
      vertexColors: true, transparent: true,
      alphaMap: starTex, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.9,
    });
    const starField = new THREE.Points(starGeo, starMat);
    starField.renderOrder = -2;
    scene.add(starField);

    // ── Nebula sky — GLSL shader on a BackSide sphere (infinite resolution, zero RAM)
    //    Vertex shader strips camera translation → sphere always centered on camera.
    //    gl_Position = pos.xyww → depth = 1.0 → always behind every scene object.
    //    Fragment shader: Gaussian gradient ellipses in spherical lon/lat space,
    //    domain-warped by fBm for organic wispy edges. Runs per-pixel on the GPU.
    const _nebVert = `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 pos = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = pos.xyww;
      }
    `;
    const _nebFrag = `
      varying vec3 vDir;
      const float PI = 3.14159265359;

      // ── 3-D value noise — continuous on the sphere, no seams ──────────────
      float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      float vnoise3(vec3 p) {
        vec3 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
        return mix(
          mix(mix(hash3(i),               hash3(i+vec3(1,0,0)), u.x),
              mix(hash3(i+vec3(0,1,0)),   hash3(i+vec3(1,1,0)), u.x), u.y),
          mix(mix(hash3(i+vec3(0,0,1)),   hash3(i+vec3(1,0,1)), u.x),
              mix(hash3(i+vec3(0,1,1)),   hash3(i+vec3(1,1,1)), u.x), u.y), u.z);
      }
      float fbm3(vec3 p) {
        float v=0.0, a=0.5;
        for(int i=0;i<5;i++){ v+=a*vnoise3(p); p=p*2.1+vec3(1.7,9.2,5.4); a*=0.5; }
        return v;
      }

      // ── Gaussian gradient ellipse in (lon, lat) space ─────────────────────
      float blob(vec2 ll, vec2 cen, float rLon, float rLat, float rot) {
        vec2 d = ll - cen;
        d.x = mod(d.x + PI, 2.0*PI) - PI;
        float cs = cos(rot), sn = sin(rot);
        d = vec2(cs*d.x - sn*d.y, sn*d.x + cs*d.y);
        float t = length(vec2(d.x/rLon, d.y/rLat));
        return exp(-t * t * 2.4);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float lon = atan(dir.x, -dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        vec2  ll  = vec2(lon, lat);

        // Domain warp — use 3-D noise on the direction vector so there
        // is NO discontinuity anywhere on the sphere (fixes the back seam).
        float wx = fbm3(dir * 1.1);
        float wy = fbm3(dir * 1.1 + vec3(5.2, 1.3, 2.8));
        vec2 warp = (vec2(wx, wy) - 0.5) * 0.35;
        vec2 wll  = ll + warp;

        vec3 col = vec3(0.0);

        // ── Base haze — full-sphere dark purple wash ──────────────────────
        col += vec3(0.04,0.01,0.14) * blob(ll, vec2(0.0,  0.0), PI,    PI*0.5, 0.0) * 0.22;
        col += vec3(0.04,0.01,0.14) * blob(ll, vec2(PI,   0.0), PI,    PI*0.5, 0.0) * 0.18;
        col += vec3(0.04,0.01,0.14) * blob(ll, vec2(0.0,  1.4), PI,    PI*0.4, 0.0) * 0.18;
        col += vec3(0.04,0.01,0.14) * blob(ll, vec2(0.0, -1.4), PI,    PI*0.4, 0.0) * 0.18;

        // ── Blue streaks — centre-front (lon ≈ 0) ────────────────────────
        col += vec3(0.15,0.35,0.95) * blob(wll, vec2( 0.00, 0.05), 0.90, 0.22,  0.32) * 0.45;
        col += vec3(0.10,0.25,0.90) * blob(wll, vec2(-0.12,-0.05), 0.78, 0.18, -0.20) * 0.35;
        col += vec3(0.18,0.38,0.98) * blob(wll, vec2( 0.12, 0.08), 0.68, 0.16,  0.52) * 0.30;

        // ── Purple / violet — upper-right ─────────────────────────────────
        col += vec3(0.52,0.09,0.88) * blob(wll, vec2( 0.35*PI, 0.30), 0.65, 0.30, -0.30) * 0.44;
        col += vec3(0.45,0.07,0.78) * blob(wll, vec2( 0.55*PI, 0.45), 0.52, 0.24, -0.52) * 0.36;

        // ── Magenta — lower-left ──────────────────────────────────────────
        col += vec3(0.78,0.07,0.52) * blob(wll, vec2(-0.48*PI,-0.28), 0.62, 0.27,  0.58) * 0.42;
        col += vec3(0.68,0.06,0.45) * blob(wll, vec2(-0.68*PI,-0.44), 0.50, 0.22,  0.82) * 0.34;

        // ── Upper-left purple ─────────────────────────────────────────────
        col += vec3(0.38,0.11,0.84) * blob(wll, vec2(-0.28*PI, 0.38), 0.58, 0.25, -0.68) * 0.40;

        // ── Lower-right violet ────────────────────────────────────────────
        col += vec3(0.55,0.10,0.82) * blob(wll, vec2( 0.72*PI,-0.34), 0.56, 0.25,  0.48) * 0.38;

        // ── Behind (lon ≈ ±π) ─────────────────────────────────────────────
        col += vec3(0.40,0.11,0.84) * blob(wll, vec2( PI-0.30, 0.15), 0.65, 0.27,  0.10) * 0.40;
        col += vec3(0.72,0.07,0.54) * blob(wll, vec2(-PI+0.20,-0.22), 0.55, 0.22, -0.20) * 0.34;
        col += vec3(0.18,0.32,0.94) * blob(wll, vec2( PI-0.15, 0.10), 0.60, 0.25,  0.40) * 0.32;

        // ── Sides (lon ≈ ±π/2) ────────────────────────────────────────────
        col += vec3(0.44,0.10,0.85) * blob(wll, vec2(-0.52*PI, 0.05), 0.70, 0.30,  0.15) * 0.38;
        col += vec3(0.20,0.26,0.92) * blob(wll, vec2( 0.52*PI,-0.05), 0.70, 0.30, -0.15) * 0.36;

        // ── Top cap ───────────────────────────────────────────────────────
        col += vec3(0.30,0.08,0.76) * blob(wll, vec2(-0.50*PI, 0.85), 0.60, 0.32,  0.20) * 0.32;
        col += vec3(0.22,0.22,0.90) * blob(wll, vec2( 0.50*PI, 0.80), 0.60, 0.30, -0.28) * 0.28;
        col += vec3(0.52,0.09,0.82) * blob(wll, vec2( 0.00,    0.92), 0.55, 0.28,  0.05) * 0.26;

        // ── Bottom cap ────────────────────────────────────────────────────
        col += vec3(0.55,0.09,0.80) * blob(wll, vec2(-0.20*PI,-0.80), 0.58, 0.30,  0.38) * 0.30;
        col += vec3(0.68,0.08,0.52) * blob(wll, vec2( 0.20*PI,-0.85), 0.56, 0.28, -0.22) * 0.28;
        col += vec3(0.25,0.28,0.92) * blob(wll, vec2(-0.80*PI,-0.75), 0.52, 0.26,  0.50) * 0.24;
        col += vec3(0.58,0.08,0.84) * blob(wll, vec2( 0.80*PI,-0.72), 0.52, 0.26, -0.45) * 0.24;

        // Filmic tone map — prevents harsh clipping when blobs overlap
        col = vec3(1.0) - exp(-col * 1.4);

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    const _nebGeo  = new THREE.SphereGeometry(500, 60, 40);
    const _nebMat  = new THREE.ShaderMaterial({
      vertexShader: _nebVert, fragmentShader: _nebFrag,
      side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    const _nebMesh = new THREE.Mesh(_nebGeo, _nebMat);
    _nebMesh.renderOrder = -100;
    _nebMesh.frustumCulled = false;
    scene.add(_nebMesh);
    const nebulaSprites = []; // kept so disposal line below compiles

    // ── Sun ───────────────────────────────────────────────────────────────
    const sunGeo  = new THREE.SphereGeometry(2.6, 32, 32);
    const sunMat  = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.0, depthWrite: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(SUN_WORLD);
    sunMesh.renderOrder = 0;
    sunMesh.visible = false;
    scene.add(sunMesh);

    const sunGlowGeo = new THREE.SphereGeometry(2.6, 32, 32);
    const sunGlowMat = makeRimMaterial(0xff9900, 2.5);
    const sunGlowMesh = new THREE.Mesh(sunGlowGeo, sunGlowMat);
    sunGlowMesh.position.copy(SUN_WORLD);
    sunGlowMesh.renderOrder = 0;
    sunGlowMesh.visible = false;
    scene.add(sunGlowMesh);

    const coronaSpriteMat = new THREE.SpriteMaterial({
      map: coronaTex,
      color: 0xff9900,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.0,
    });
    const coronaSprite = new THREE.Sprite(coronaSpriteMat);
    coronaSprite.scale.set(12, 12, 1);
    coronaSprite.position.copy(SUN_WORLD);
    coronaSprite.renderOrder = 0;
    coronaSprite.visible = false;
    scene.add(coronaSprite);

    // ── HUD background overlay (detail view only) ────────────────────────
    const hudBgStyle = document.createElement('style');
    hudBgStyle.textContent = `
      #hud-bg {
        position: fixed;
        inset: 0;
        z-index: 1;
        top: 58px;
        pointer-events: none;
        opacity: 0;
        font-family: 'Bungee Hairline', monospace;
        overflow: hidden;
        /* Full radial fill — color at center, deeper at edges */
        background: radial-gradient(ellipse at center, transparent 62%, rgba(0,55,88,0.15) 73%, rgba(0,45,75,0.55) 88%, rgba(0,15,28,0.85) 100%);
      }
      #hud-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(circle, rgba(80,170,210,0.22) 1px, transparent 1px);
        background-size: 24px 24px;
        -webkit-mask-image: radial-gradient(ellipse at center, transparent 28%, black 65%);
        mask-image: radial-gradient(ellipse at center, transparent 28%, black 65%);
      }
      .hud-corner { position: absolute; width: 90px; height: 90px; }
      .hud-tl { top: 12px; left: 12px; }
      .hud-tr { top: 12px; right: 12px; transform: scaleX(-1); }
      .hud-bl { bottom: 12px; left: 12px; transform: scaleY(-1); }
      .hud-br { bottom: 12px; right: 12px; transform: scale(-1,-1); }
      .hud-edge-line-h {
        position: absolute;
        left: 90px; right: 90px;
        height: 1px;
        background: rgba(80,170,210,0.25);
      }
      .hud-edge-line-v {
        position: absolute;
        top: 90px; bottom: 90px;
        width: 1px;
        background: rgba(80,170,210,0.18);
      }
      .hud-top-bar {
        position: absolute;
        top: 12px; left: 102px; right: 102px;
        height: 26px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 8.5px;
        letter-spacing: 0.18em;
        color: rgba(110,195,230,0.75);
      }
      .hud-spacer { flex: 1; }
      .hud-seg {
        height: 1px;
        background: rgba(80,170,210,0.4);
        flex-shrink: 0;
      }
      .hud-left-pips {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: center;
      }
      .hud-pip {
        width: 5px; height: 5px;
        background: rgba(80,170,210,0.5);
        flex-shrink: 0;
      }
      .hud-pip.lg { width: 8px; height: 8px; background: rgba(80,170,210,0.75); }
      .hud-right-bar {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-items: flex-end;
      }
      .hud-right-seg {
        height: 1px;
        background: rgba(80,170,210,0.3);
      }
    `;
    document.head.appendChild(hudBgStyle);

    const _cornerSVG = `<svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="0,50 0,0 50,0" stroke="rgba(80,190,230,0.8)" stroke-width="1.5" fill="none"/>
      <polyline points="0,22 10,22 10,10 22,10 22,0" stroke="rgba(80,190,230,0.35)" stroke-width="1" fill="none"/>
      <line x1="26" y1="0" x2="46" y2="0" stroke="rgba(80,190,230,0.45)" stroke-width="1.5"/>
      <line x1="0" y1="26" x2="0" y2="46" stroke="rgba(80,190,230,0.45)" stroke-width="1.5"/>
      <rect x="0" y="0" width="3.5" height="3.5" fill="rgba(80,190,230,0.9)"/>
    </svg>`;

    const hudBgEl = document.createElement('div');
    hudBgEl.id = 'hud-bg';
    hudBgEl.innerHTML = `
      <div class="hud-corner hud-tl">${_cornerSVG}</div>
      <div class="hud-corner hud-tr">${_cornerSVG}</div>
      <div class="hud-corner hud-bl">${_cornerSVG}</div>
      <div class="hud-corner hud-br">${_cornerSVG}</div>

      <div class="hud-edge-line-h" style="top:12px"></div>
      <div class="hud-edge-line-h" style="bottom:12px"></div>
      <div class="hud-edge-line-v" style="left:12px"></div>
      <div class="hud-edge-line-v" style="right:12px"></div>

      <div class="hud-top-bar">
        <div class="hud-spacer"></div>
        <span>SYSTEM STATUS: NOMINAL // LDK: ENCRYPTED</span>
        <div class="hud-spacer"></div>
      </div>


      <div class="hud-left-pips">
        <div class="hud-pip lg"></div>
        <div class="hud-pip"></div>
        <div class="hud-pip"></div>
        <div class="hud-pip"></div>
        <div class="hud-pip lg"></div>
        <div class="hud-pip"></div>
        <div class="hud-pip"></div>
        <div class="hud-pip lg"></div>
      </div>

      <div class="hud-right-bar">
        <div class="hud-right-seg" style="width:30px"></div>
        <div class="hud-right-seg" style="width:18px"></div>
        <div class="hud-right-seg" style="width:24px"></div>
        <div class="hud-right-seg" style="width:12px"></div>
        <div class="hud-right-seg" style="width:28px"></div>
      </div>

    `;
    document.body.appendChild(hudBgEl);

    // ── Planets ───────────────────────────────────────────────────────────
    const PLANET_DATA = [
      { orbitR: 5.0,  sphereR: 0.38, speed: 1.5,  color: 0xa259ff, glowColor: 0xcc88ff, image: SKILL_ICONS[0] }, // Figma      — purple + bright purple glow
      { orbitR: 7.0,  sphereR: 0.42, speed: 1.0,  color: 0xe87d0d, glowColor: 0xffaa44, image: SKILL_ICONS[1] }, // Blender    — orange, bright orange glow
      { orbitR: 9.0,  sphereR: 0.45, speed: 0.72, color: 0xffffff, glowColor: 0xddeeff, image: SKILL_ICONS[2] }, // Framer     — white, soft white-blue glow
      { orbitR: 11.5, sphereR: 0.42, speed: 0.48, color: 0x478cbf, glowColor: 0x88ccff, image: SKILL_ICONS[3] }, // Godot      — blue, bright blue glow
      { orbitR: 14.0, sphereR: 0.55, speed: 0.26, color: 0xff7c00, glowColor: 0xffaa55, image: SKILL_ICONS[4] }, // Illustrator— orange, lighter orange glow
      { orbitR: 17.0, sphereR: 0.50, speed: 0.16, color: 0x5baa3f, glowColor: 0x88dd66, image: SKILL_ICONS[5] }, // Shopify    — green, bright green glow
      { orbitR: 20.0, sphereR: 0.46, speed: 0.10, color: 0x00c4cc, glowColor: 0x44eef5, image: SKILL_ICONS[6] }, // Canva      — teal, bright cyan glow
    ];

    // Pre-compute planet glow colors as {r,g,b} for fast lerp
    const PLANET_GLOW_RGB = PLANET_DATA.map(p => {
      const c = new THREE.Color(p.glowColor);
      return { r: c.r, g: c.g, b: c.b };
    });

    // Build one HUD element per planet now that PLANET_DATA and buildHudHTML are ready
    menuEls = PLANET_DATA.map((p, idx) => {
      const el = document.createElement('div');
      el.style.cssText = _HUD_CSS;
      const col = '#' + new THREE.Color(p.color).getHexString();
      el.innerHTML = buildHudHTML(PLANET_SKILLS[idx], col, 'rgba(8,8,12,0.88)', p.image);
      document.body.appendChild(el);
      return el;
    });

    // Pre-assign random starting angle per planet
    const PLANET_OFFSETS = PLANET_DATA.map((_, idx) => (idx * 1234567 % 628318) / 100000);

    const planetMeshes = PLANET_DATA.map((p, idx) => {
      const geo  = new THREE.SphereGeometry(p.sphereR, 64, 64);
      const { colorTex, bumpTex } = makePlanetTexture(p.color, PLANET_ACCENTS[idx]);
      const mat  = new THREE.MeshStandardMaterial({
        map: colorTex, bumpMap: bumpTex, bumpScale: 0.4,
        roughness: 0.88, metalness: 0.0,
        transparent: true, opacity: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 0;
      mesh.visible = false;
      scene.add(mesh);

      const glowGeo  = new THREE.SphereGeometry(p.sphereR * 1.18, 32, 32);
      const glowMat  = makeRimMaterial(p.glowColor, 4.5);
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.renderOrder = 0;
      glowMesh.visible = false;
      scene.add(glowMesh);

      // Invisible hit-sphere — larger target for reliable hover detection
      const hitGeo  = new THREE.SphereGeometry(Math.max(p.sphereR * 4, 1.2), 8, 8);
      const hitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.visible = false;
      scene.add(hitMesh);

      return { mesh, glowMesh, hitMesh };
    });

    // ── Planet billboard sprites (always face camera → always circular) ─────
    // Used when hovered to replace the 3-D sphere (which distorts at oblique angles)
    const planetSprites = PLANET_DATA.map(p => {
      const col = new THREE.Color(p.color);
      const glw = new THREE.Color(p.glowColor);
      const r  = Math.round(col.r * 255), g  = Math.round(col.g * 255), b  = Math.round(col.b * 255);
      const gr = Math.round(glw.r * 255), gg = Math.round(glw.g * 255), gb = Math.round(glw.b * 255);

      const bodyTex = makeGlowTex(128, [
        [0,    `rgba(255,255,255,1)`],
        [0.4,  `rgba(${r},${g},${b},1)`],
        [0.85, `rgba(${r},${g},${b},0.4)`],
        [1,    `rgba(${r},${g},${b},0)`],
      ]);
      const bodyMat = new THREE.SpriteMaterial({
        map: bodyTex, transparent: true,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
      });
      const bodySprite = new THREE.Sprite(bodyMat);
      bodySprite.renderOrder = 10;
      bodySprite.visible = false;
      scene.add(bodySprite);

      const glowTex = makeGlowTex(128, [
        [0,    `rgba(${gr},${gg},${gb},0)`],
        [0.70, `rgba(${gr},${gg},${gb},0)`],
        [0.85, `rgba(${gr},${gg},${gb},1)`],
        [1,    `rgba(${gr},${gg},${gb},0)`],
      ]);
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex, transparent: true,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
      });
      const glowSprite = new THREE.Sprite(glowMat);
      glowSprite.renderOrder = 10;
      glowSprite.visible = false;
      scene.add(glowSprite);

      return { bodySprite, glowSprite, bodyTex, glowTex };
    });

    // ── Orbit rings (visible lines for each planet orbit) ─────────────────
    const orbitRings = PLANET_DATA.map(p => {
      const pts = [];
      const SEG = 128;
      const cosT = Math.cos(DISC_TILT), sinT = Math.sin(DISC_TILT);
      for (let s = 0; s <= SEG; s++) {
        const a  = (s / SEG) * Math.PI * 2;
        const lx = p.orbitR * Math.cos(a);
        const lz = p.orbitR * Math.sin(a);
        pts.push(new THREE.Vector3(
          SUN_WORLD.x + lx,
          SUN_WORLD.y - lz * sinT,
          SUN_WORLD.z + lz * cosT,
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Line(geo, mat);
      ring.visible = false;
      ring.renderOrder = 0;
      scene.add(ring);
      return ring;
    });

    // Hovered sidebar card — drives camera re-centering
    let hoveredCardIdx     = -1;
    let hoveredProjCardIdx = -1;   // which bottom project card is hovered (-1 = none)
    let projDetailIdx      = -1;   // which project card was clicked into (-1 = none)
    let blenderGridIdx     = 0;    // 0–34, active cell in Blender 7×5 grid
    let projDetailTimer    = 0;    // 0→1 animation progress
    let projDetailOpenedAt = 0;   // Date.now() when a file was opened
    let projFileClosedAt   = 0;   // Date.now() when a file was closed
    let plDoneAt           = 0;   // Date.now() when loading hit 100%
    let plLoadProgress     = 0;    // 0-1 actual loaded fraction
    let plLoadReady        = false; // all media loaded
    let plFadeOutTimer     = 0;    // counts up after load complete, drives fade-out
    let planetExitAllowed  = false; // true after file-show sound + 0.7s
    let plExitToken        = 0;    // incremented on reset to invalidate stale timeouts
    let plVisible          = false;
    let plFadeInTimer      = 0;    // 0-1, drives menu fade-in after loader hides
    let plFilesCanFadeIn   = false; // set true when ring/text fade out, files start coming in
    let plDispPct          = 0;    // integer display value that counts up smoothly
    let plDigitTimer       = 0;    // accumulator — fires a +1 tick every interval
    let plRingSmooth       = 0;    // 0-100 smoothed value driving the arc, lerps toward plDispPct
    let plPausePoints      = [];   // pre-generated pct values where the counter stalls
    let plPauseTimer       = 0;    // counts down during a stall
    let plFadeTimeoutId    = null; // setTimeout ID for post-pulse fade
    // ── Detail-view typewriter ────────────────────────────────────────────
    let dtTwInterval    = null;
    let prevDetailVisible = false;
    const _twAudio        = new Audio('/portfolio-website/assets/assets/sound/type.mp3');
    const _enterAudio     = new Audio('/portfolio-website/assets/assets/sound/enter-planet.mp3');
    const _exitAudio      = new Audio('/portfolio-website/assets/assets/sound/exit-planet.mp3');
    const _enterFileAudio = new Audio('/portfolio-website/assets/assets/sound/enter-file.mp3');
    const _exitFileAudio  = new Audio('/portfolio-website/assets/assets/sound/exit-file.mp3');
    const _cycleAudio     = new Audio('/portfolio-website/assets/assets/sound/menu-cycle.mp3');
    const _loadingAudio   = new Audio('/portfolio-website/assets/assets/sound/loading-progress.mp3');
    const _successAudio   = new Audio('/portfolio-website/assets/assets/sound/load-success.mp3');
    const _fileShowAudio    = new Audio('/portfolio-website/assets/assets/sound/file-show.mp3');
    _loadingAudio.loop    = true;
    _loadingAudio.volume  = 0.5;
    _successAudio.volume  = 0.8;
    [_twAudio, _enterAudio, _exitAudio, _enterFileAudio, _exitFileAudio, _cycleAudio, _loadingAudio, _successAudio, _fileShowAudio].forEach(a => { a.preload = 'auto'; });

    let _hoverPlanetCtx = null;
    let _hoverPlanetBuf = null;
    function _initHoverPlanetCtx() {
      if (_hoverPlanetCtx) return;
      _hoverPlanetCtx = new (window.AudioContext || window.webkitAudioContext)();
      fetch('/portfolio-website/assets/assets/sound/hover-planet.mp3')
        .then(r => r.arrayBuffer())
        .then(buf => _hoverPlanetCtx.decodeAudioData(buf))
        .then(decoded => { _hoverPlanetBuf = decoded; })
        .catch(() => {});
    }
    function _playHoverPlanet() {
      _initHoverPlanetCtx();
      if (!_hoverPlanetBuf) return;
      const src  = _hoverPlanetCtx.createBufferSource();
      src.buffer = _hoverPlanetBuf;
      src.detune.value = 0;
      const gain = _hoverPlanetCtx.createGain();
      gain.gain.value = 0.35;
      src.connect(gain);
      gain.connect(_hoverPlanetCtx.destination);
      src.start();
    }
    function _playCycleRandom(volume = 0.5) {
      const a = _cycleAudio.cloneNode();
      a.playbackRate = 1.4 + Math.random() * 1.2;
      a.volume = volume;
      a.play().catch(() => {});
    }

    function _playSound(audio, volume = 1) {
      const a = audio.cloneNode();
      a.volume = volume;
      a.play().catch(() => {});
    }

    function _twClick() {
      const a = _twAudio.cloneNode();
      a.playbackRate = 0.85 + Math.random() * 0.55; // 0.85–1.40 pitch range
      a.volume = 0.18;
      a.play().catch(() => {});
    }

    function startDetailTw() {
      if (dtTwInterval) clearInterval(dtTwInterval);
      bioScrollbar.classList.remove('tw-ready');
      const titleEl  = projTitleDisplay.querySelector('.ptd-name');
      const descEls  = Array.from(bioPanel.querySelectorAll('.bp-text'));
      const titleFull = titleEl.textContent;
      const descData  = descEls.map(el => { const t = el.textContent; el.textContent = ''; return { el, t }; });
      titleEl.textContent = '';
      let titlePos = 0, descIdx = 0, descPos = 0, charCount = 0;
      let nextSound = 14 + Math.floor(Math.random() * 9);
      dtTwInterval = setInterval(() => {
        for (let step = 0; step < 4; step++) {
          if (titlePos < titleFull.length) {
            titleEl.textContent = titleFull.slice(0, ++titlePos);
            if (++charCount >= nextSound) { _twClick(); charCount = 0; nextSound = 14 + Math.floor(Math.random() * 9); }
          } else if (descIdx < descData.length) {
            const d = descData[descIdx];
            d.el.textContent = d.t.slice(0, ++descPos);
            if (++charCount >= nextSound) { _twClick(); charCount = 0; nextSound = 14 + Math.floor(Math.random() * 9); }
            if (descPos >= d.t.length) { descIdx++; descPos = 0; }
          } else {
            clearInterval(dtTwInterval); dtTwInterval = null;
            setTimeout(() => { if (bioPanel.scrollHeight > bioPanel.clientHeight) { _updateBioThumb(); bioScrollbar.classList.add('tw-ready'); } }, 1000);
            return;
          }
        }
      }, 3);
    }

    function stopDetailTw() {
      if (dtTwInterval) { clearInterval(dtTwInterval); dtTwInterval = null; }
      // Flush remaining text immediately so nothing is left empty
      const titleEl = projTitleDisplay.querySelector('.ptd-name');
      if (titleEl && titleEl._dtFull) titleEl.textContent = titleEl._dtFull;
      bioPanel.querySelectorAll('.bp-text[data-full]').forEach(el => { el.textContent = el.dataset.full; });
      if (bioPanel.scrollHeight > bioPanel.clientHeight) { _updateBioThumb(); bioScrollbar.classList.add('tw-ready'); }
    }

    // ── Typewriter state for planet name label ────────────────────────────
    let twText      = '';      // currently displayed string
    let twTarget    = '';      // string we're typing toward
    let twPhase     = 'idle';  // 'idle' | 'erase' | 'type'
    let twTimer     = 0;       // seconds since last character change
    let twLastLabel = '';      // last desired label (change detection)
    const TW_ERASE  = 0.04;   // seconds per character erased
    const TW_TYPE   = 0.06;   // seconds per character typed
    const cardOrbitCenter  = new THREE.Vector3().copy(SUN_WORLD);
    const planetWorldPos   = PLANET_DATA.map(() => new THREE.Vector3().copy(SUN_WORLD));

    // ── Planet carousel — left side, top-down orb cards ─────────────────
    const sidebarEl = document.createElement('div');
    sidebarEl.id = 'planet-sidebar';
    document.body.appendChild(sidebarEl);

    // Stage column: up arrow + stage + down arrow
    const pcStageCol = document.createElement('div');
    pcStageCol.id = 'pc-stage-col';
    sidebarEl.appendChild(pcStageCol);

    const pcUpBtn = document.createElement('button');
    pcUpBtn.className = 'pc-arrow-btn';
    pcUpBtn.setAttribute('aria-label', 'Previous skill');
    pcUpBtn.innerHTML = `<svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 9L8 2L15 9" stroke="rgba(255,255,255,0.75)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    pcUpBtn.addEventListener('click', () => pcPrev());
    pcStageCol.appendChild(pcUpBtn);

    const pcStage = document.createElement('div');
    pcStage.id = 'pc-stage';
    pcStageCol.appendChild(pcStage);

    const pcDownBtn = document.createElement('button');
    pcDownBtn.className = 'pc-arrow-btn';
    pcDownBtn.setAttribute('aria-label', 'Next skill');
    pcDownBtn.innerHTML = `<svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L8 8L15 1" stroke="rgba(255,255,255,0.75)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    pcDownBtn.addEventListener('click', () => pcNext());
    pcStageCol.appendChild(pcDownBtn);

    const pcDotsEl = document.createElement('div');
    pcDotsEl.id = 'pc-dots';
    sidebarEl.appendChild(pcDotsEl);

    // ── Carousel state ────────────────────────────────────────────────────
    const N = PLANET_DATA.length;
    let pcOffset  = 0;          // continuous running position — never clamped
    let pcIdx     = 0;          // active card index (derived from pcOffset)
    const pcCards     = [];
    const pcDots      = [];
    const pcPrevSlots = new Array(N).fill(0); // track last slot per card to detect teleport

    // Slot-machine layout constants
    const PC_CARD_H  = 190;   // card height px
    const PC_GAP     = 14;    // gap between cards px
    const PC_STEP    = PC_CARD_H + PC_GAP;   // 204px per slot
    const PC_STAGE_H = 650;
    const PC_CENTER  = (PC_STAGE_H - PC_CARD_H) / 2;

    function pcRefresh(animate) {
      pcCards.forEach((card, i) => {
        // Find the shortest-path slot in the infinite ring.
        // slot = distance from card i to the current offset, choosing the nearest copy.
        let slot = i - pcOffset;
        slot = slot - Math.round(slot / N) * N;

        // If this card just teleported (jumped more than 1 step) suppress its transition
        // so the snap happens while it's already faded at the edge — invisible to the user.
        const teleported = animate && Math.abs(slot - pcPrevSlots[i]) > 1;
        pcPrevSlots[i] = slot;

        const absDist = Math.abs(slot);
        const topPx   = PC_CENTER + slot * PC_STEP;
        const sc      = absDist === 0 ? 1 : Math.max(0.82, 1 - absDist * 0.12);
        const op      = absDist === 0 ? 1 : absDist === 1 ? 0.55 : 0;
        // Keep visibility:visible so opacity can animate smoothly — hide only when fully faded
        const visible = absDist <= 2;

        const col = '#' + new THREE.Color(PLANET_DATA[i].color).getHexString();

        if (teleported) {
          // Snap to new position while invisible, then fade in — prevents visible jump
          card.style.transition    = 'none';
          card.style.top           = `${topPx}px`;
          card.style.transform     = `scale(${sc})`;
          card.style.opacity       = '0';
          card.style.zIndex        = `${10 - absDist}`;
          card.style.pointerEvents = 'none';
          card.style.visibility    = 'visible';
          card.style.borderColor   = absDist === 0 ? col + 'aa' : col + '33';
          card.style.boxShadow     = 'none';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              card.style.transition = 'opacity 0.32s';
              card.style.opacity    = `${op}`;
            });
          });
        } else {
          card.style.transition    = animate
            ? 'top 0.15s cubic-bezier(0.4,0,0.2,1), transform 0.15s cubic-bezier(0.4,0,0.2,1), opacity 0.15s, box-shadow 0.15s, border-color 0.15s'
            : 'none';
          card.style.top           = `${topPx}px`;
          card.style.transform     = `scale(${sc})`;
          card.style.opacity       = `${op}`;
          card.style.zIndex        = `${10 - absDist}`;
          card.style.pointerEvents = absDist === 0 ? 'auto' : 'none';
          card.style.visibility    = visible ? 'visible' : 'hidden';
          card.style.borderColor   = absDist === 0 ? col + 'aa' : col + '33';
          card.style.boxShadow     = absDist === 0 ? `0 0 20px 3px ${col}44` : 'none';
        }
      });
      pcDots.forEach((d, i) => d.classList.toggle('active', i === pcIdx));
      hoveredCardIdx = pcIdx;
    }

    let pcCooldown = false;
    function pcGo(direction) {
      if (planetInteractionLocked) return;
      if (!solarZoneActive) return;
      if (pcCooldown) return;
      pcCooldown = true;
      setTimeout(() => { pcCooldown = false; }, 180);
      mouseMode = false;
      _mouseModeBlockedUntil = Date.now() + 2500;
      _playCycleRandom(0.5);
      pcOffset += direction;
      pcIdx = ((Math.round(pcOffset) % N) + N) % N;
      pcRefresh(true);

      // Echo the arrow that was activated
      const btn       = direction > 0 ? pcDownBtn : pcUpBtn;
      const pulseClass = direction > 0 ? 'pulse-down' : 'pulse-up';
      btn.classList.remove('pulse-up', 'pulse-down');
      void btn.offsetWidth; // force reflow so re-adding restarts the animation
      btn.classList.add(pulseClass);
      btn.addEventListener('animationend', () => btn.classList.remove(pulseClass), { once: true });
    }

    function pcNext() { pcGo(1); }
    function pcPrev() { pcGo(-1); }

    // ── Build cards ───────────────────────────────────────────────────────
    PLANET_DATA.forEach((p, idx) => {
      const col  = '#' + new THREE.Color(p.color).getHexString();
      const skill = PLANET_SKILLS[idx];

      // Top-down orb: latitude ellipses + dashed meridian
      const R = 56;
      const lats = [0.45, 0.72, 0.92].map(f => {
        const ry = R * f * 0.22;
        return `<ellipse cx="${R}" cy="${R}" rx="${R*f}" ry="${ry}" fill="none" stroke="${col}" stroke-width="0.5" opacity="0.2"/>`;
      }).join('');
      const meridian = `<ellipse cx="${R}" cy="${R}" rx="${R*0.16}" ry="${R}" fill="none" stroke="${col}" stroke-width="0.5" opacity="0.15" stroke-dasharray="3 5"/>`;

      const card = document.createElement('div');
      card.className = 'pcard';
      card.style.borderColor = col + '55';

      card.innerHTML = `
        <div class="pc-orb" style="
          border: 1px solid ${col}55;
          background: radial-gradient(circle at 38% 34%, ${col}2a 0%, ${col}12 45%, transparent 75%),
                      radial-gradient(circle at 35% 30%, rgba(255,255,255,0.14) 0%, transparent 48%);
          box-shadow: 0 0 24px 5px ${col}44,
                      inset -4px -4px 14px rgba(0,0,0,0.7),
                      inset 2px 2px 6px rgba(255,255,255,0.04);
        ">
          <svg class="pc-orb-grid" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg">
            ${lats}${meridian}
          </svg>
          <div class="pc-orb-icon">
            ${p.image
              ? `<img src="${p.image}" style="width:52px;height:52px;border-radius:50%;object-fit:contain;filter:drop-shadow(0 0 8px ${col}cc) drop-shadow(0 0 2px rgba(0,0,0,0.9));"/>`
              : `<svg width="20" height="20"><circle cx="10" cy="10" r="7" fill="${col}" opacity="0.85"/></svg>`
            }
          </div>
          <!-- spinning dashed ring uses ::after via colour trick -->
          <div style="position:absolute;inset:-8px;border-radius:50%;border:1px dashed ${col};opacity:0.28;animation:pcOrbSpin 20s linear infinite;pointer-events:none;"></div>
        </div>
        <div class="pc-name" style="color:${col};text-shadow:0 0 10px ${col}99">
          ${skill.name.toUpperCase()}
        </div>
        ${_tracerSVG(col)}
      `;

      // Clicking front card → enter planet detail; otherwise just advance
      card.addEventListener('click', () => {
        if (sineEase(solarTimer) > 0.8 && !planetInteractionLocked) {
          planetInteractionLocked = true;
          detailPlanetIdx = idx;
          bounceActive = false; bouncePlanetIdx = -1; exitingDetailIdx = -1;
          for (let pi = 0; pi < nP; pi++) planetHover[pi] = 0;
          detailPlanetPos.copy(planetMeshes[idx].mesh.position);
          setScrollEnabled?.(false);
        }
      });

      card.addEventListener('mouseenter', () => { window._pcHovered = true;  });
      card.addEventListener('mouseleave', () => { window._pcHovered = false; });
      pcCards.push(card);
      pcStage.appendChild(card);

      // Dot
      const dot = document.createElement('div');
      dot.className = 'pc-dot';
      dot.style.borderColor = col;
      dot.style.background  = col + '55';
      dot.style.color       = col;
      dot.addEventListener('mouseenter', () => { window._pcHovered = true;  });
      dot.addEventListener('mouseleave', () => { window._pcHovered = false; });
      dot.addEventListener('click', () => {
        if (planetInteractionLocked) return;
        if (!solarZoneActive) return;
        if (pcCooldown) return;
        pcCooldown = true;
        setTimeout(() => { pcCooldown = false; }, 180);
        mouseMode = false;
        _mouseModeBlockedUntil = Date.now() + 2500;
        _playCycleRandom(0.5);
        pcOffset = idx;
        pcIdx    = idx;
        pcRefresh(true);
      });
      pcDots.push(dot);
      pcDotsEl.appendChild(dot);
    });

    // Enter the currently selected planet (same logic as clicking the active card)
    function pcEnter() {
      console.log('[pcEnter] solar:', sineEase(solarTimer).toFixed(2), 'locked:', planetInteractionLocked, 'pcIdx:', pcIdx, 'detailPlanetIdx:', detailPlanetIdx);
      const targetIdx = hoveredPlanetIdx >= 0 ? hoveredPlanetIdx : pcIdx;
      if (sineEase(solarTimer) > 0.8 && !planetInteractionLocked && planetHover[targetIdx] > 0) {
        mouseMode = false;
        pcOffset = targetIdx;
        pcIdx    = targetIdx;
        pcRefresh(false);
        _playSound(_enterAudio, 0.8);
        planetInteractionLocked = true;
        detailPlanetIdx = targetIdx;
        bounceActive = false; bouncePlanetIdx = -1; exitingDetailIdx = -1;
        for (let pi = 0; pi < nP; pi++) planetHover[pi] = 0;
        detailPlanetPos.copy(planetMeshes[targetIdx].mesh.position);
        setScrollEnabled?.(false);
      }
    }

    // Initial state — left/right arrows + mouse wheel cycle the carousel
    pcRefresh(false);
    window._pcNext  = pcNext;
    window._pcPrev  = pcPrev;
    window._pcEnter = pcEnter;

    // ── Keyboard hint bar ─────────────────────────────────────────────────
    const kbHintStyle = document.createElement('style');
    kbHintStyle.textContent = `
      #kb-hints {
        position: fixed;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9000;
        display: flex;
        align-items: center;
        gap: 18px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s;
        font-family: 'Bungee Hairline', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 9px;
        color: rgba(255,255,255,0.72);
        white-space: nowrap;
      }
      #kb-hints.visible { opacity: 1; }
      .kb-group {
        display: flex; align-items: center; gap: 6px;
      }
      /* label text beside the keys */
      .kb-group span {
        font-size: 17px;
        color: #ffffff;
        text-shadow: 0 0 6px rgba(255,255,255,1), 0 0 14px rgba(255,255,255,0.9), 0 0 30px rgba(255,255,255,0.7), 0 0 60px rgba(255,255,255,0.35);
        letter-spacing: 0.22em;
      }
      .kb-key {
        display: flex; align-items: center; justify-content: center;
        min-width: 30px; height: 30px;
        padding: 0 10px;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        box-shadow: 0 0 3px 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08);
        font-size: 11px;
        color: #ffffff;
        font-family: 'Bungee Hairline', sans-serif;
        letter-spacing: 0.08em;
      }
      .kb-key svg { pointer-events: none; }
      .kb-sep {
        width: 1px; height: 18px;
        background: rgba(255,255,255,0.20);
        border-radius: 1px;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(kbHintStyle);

    const kbHints = document.createElement('div');
    kbHints.id = 'kb-hints';
    kbHints.innerHTML = `
      <div class="kb-group">
        <div class="kb-key">
          <svg width="10" height="13" viewBox="0 0 8 10" fill="none"><path d="M7 1.5L1.5 5L7 8.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/><defs><filter id="glow"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        </div>
        <div class="kb-key">
          <svg width="10" height="13" viewBox="0 0 8 10" fill="none"><path d="M1 1.5L6.5 5L1 8.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow2)"/><defs><filter id="glow2"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        </div>
        <span>CYCLE SKILLS</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key">
          <svg width="13" height="10" viewBox="0 0 10 8" fill="none"><path d="M1 7L5 1.5L9 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow3)"/><defs><filter id="glow3"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        </div>
        <div class="kb-key">
          <svg width="13" height="10" viewBox="0 0 10 8" fill="none"><path d="M1 1L5 6.5L9 1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow4)"/><defs><filter id="glow4"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
        </div>
        <span>CHANGE PAGE</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key" style="min-width:48px;">ENTER</div>
        <div class="kb-key" style="min-width:28px;gap:5px;">
          <svg width="11" height="16" viewBox="0 0 11 16" fill="none"><rect x="1" y="1" width="9" height="14" rx="4.5" stroke="#fff" stroke-width="1.3"/><line x1="5.5" y1="4" x2="5.5" y2="7" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><line x1="1" y1="7" x2="10" y2="7" stroke="#fff" stroke-width="1"/></svg>
          CLICK
        </div>
        <span>EXPLORE PLANET</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key" style="min-width:28px;gap:5px;">
          <svg width="11" height="16" viewBox="0 0 11 16" fill="none"><rect x="1" y="1" width="9" height="14" rx="4.5" stroke="#fff" stroke-width="1.3"/><line x1="5.5" y1="4" x2="5.5" y2="7" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><line x1="1" y1="7" x2="10" y2="7" stroke="#fff" stroke-width="1"/></svg>
          CLICK/DRAG
        </div>
        <span>ROTATE</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key" style="min-width:36px;">ESC</div>
        <span>BACK TO DASHBOARD</span>
      </div>
    `;
    document.body.appendChild(kbHints);

    const kbPlanetHints = document.createElement('div');
    kbPlanetHints.id = 'kb-planet-hints';
    kbPlanetHints.innerHTML = `
      <div class="kb-group">
        <div class="kb-key" style="min-width:48px;">ENTER</div>
        <span>VIEW PROJECT</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key">
          <svg width="10" height="13" viewBox="0 0 8 10" fill="none"><path d="M7 1.5L1.5 5L7 8.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="kb-key">
          <svg width="10" height="13" viewBox="0 0 8 10" fill="none"><path d="M1 1.5L6.5 5L1 8.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="kb-key" style="min-width:28px;gap:5px;">
          <svg width="11" height="16" viewBox="0 0 11 16" fill="none"><rect x="1" y="1" width="9" height="14" rx="4.5" stroke="#fff" stroke-width="1.3"/><line x1="5.5" y1="4" x2="5.5" y2="7" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><line x1="1" y1="7" x2="10" y2="7" stroke="#fff" stroke-width="1"/></svg>
          SCROLL
        </div>
        <span>CYCLE PROJECTS</span>
      </div>
      <div class="kb-sep"></div>
      <div class="kb-group">
        <div class="kb-key" style="min-width:28px;gap:5px;">
          <svg width="11" height="16" viewBox="0 0 11 16" fill="none"><rect x="1" y="1" width="9" height="14" rx="4.5" stroke="#fff" stroke-width="1.3"/><line x1="5.5" y1="4" x2="5.5" y2="7" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><line x1="1" y1="7" x2="10" y2="7" stroke="#fff" stroke-width="1"/></svg>
          CLICK/DRAG
        </div>
        <span>ROTATE PLANET</span>
      </div>
    `;
    kbPlanetHints.style.cssText = `
      position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9000;
      display:flex;align-items:center;gap:18px;opacity:0;pointer-events:none;
      transition:opacity 0.4s;font-family:'Bungee Hairline',sans-serif;
      text-transform:uppercase;letter-spacing:0.18em;font-size:9px;
      color:rgba(255,255,255,0.72);white-space:nowrap;
    `;
    document.body.appendChild(kbPlanetHints);

    // Mouse wheel on the carousel — cycles one card at a time, never leaks to page scroll
    let pcWheelCooldown = false;
    sidebarEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pcWheelCooldown) return;
      if (e.deltaY > 0) pcNext();
      else if (e.deltaY < 0) pcPrev();
      else return;
      pcWheelCooldown = true;
      setTimeout(() => { pcWheelCooldown = false; }, 180);
    }, { passive: false, capture: true });

    // Helper: compute a position in the disc plane given sun center, orbit radius, angle
    // Returns world position
    function discWorldPos(orbitR, angle) {
      const lx = orbitR * Math.cos(angle);
      const lz = orbitR * Math.sin(angle);
      _discPos.set(
        SUN_WORLD.x + lx,
        SUN_WORLD.y - lz * _sinDT,
        SUN_WORLD.z + lz * _cosDT
      );
      return _discPos;
    }

    // ── Mouse ─────────────────────────────────────────────────────────────
    const raycaster   = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const mouseWorld  = new THREE.Vector3(9999, 0, 9999);

    // Per-planet hover / pulse state
    const planetHover       = PLANET_DATA.map(() => 0);
    const planetOrbitOffset = PLANET_DATA.map((_, i) => PLANET_OFFSETS[i]);
    const planetFrozenAngle = PLANET_DATA.map(() => 0);
    const planetWasHovered  = PLANET_DATA.map(() => false);
    const planetPulseTimer  = PLANET_DATA.map(() => -1); // -1 = inactive
    const planetPulseAmp    = PLANET_DATA.map(() => 0);
    let hoveredPlanetIdx    = -1;
    let prevHoveredPlanetIdx = -1;
    let mouseMode = false; // true = mouse took over from arrow keys
    let _mouseModeBlockedUntil  = 0;
    let _mouseModeWasBlocked    = false;
    let orbitPausedAt = 0; // timestamp when orbit was last paused by mouse hover
    let lastMouseHoveredPlanet = -1;

    // ── Orbit camera drag ─────────────────────────────────────────────────
    const _camOff = new THREE.Vector3().subVectors(camera.position, SUN_WORLD);
    let camR     = _camOff.length();
    let camTheta = Math.atan2(_camOff.x, _camOff.z);
    let camPhi   = Math.acos(Math.max(-1, Math.min(1, _camOff.y / camR)));
    const PHI_MIN = 0.10; // ~6° from straight above
    const PHI_MAX = 1.45; // ~83° — won't dip below the disc
    let isDragging = false;
    let dragLastX  = 0;
    let dragLastY  = 0;
    let hasDragged = false;

    const updateOrbitCamera = () => {
      const sp = Math.sin(camPhi);
      camera.position.set(
        SUN_WORLD.x + camR * sp * Math.sin(camTheta),
        SUN_WORLD.y + camR * Math.cos(camPhi),
        SUN_WORLD.z + camR * sp * Math.cos(camTheta)
      );
      camera.lookAt(SUN_WORLD);
    };

    const planetMeshList  = planetMeshes.map(pm => pm.hitMesh);
    let solarZoneActive = false; // true only while inYellow — goes false immediately on exit
    const hudOpacities   = new Float32Array(PLANET_DATA.length);
    const hudHoverTimers = new Float32Array(PLANET_DATA.length);
    const hudRings = menuEls.map(el => ({
      outer: el.querySelector('[data-ring="outer"]'),
      mid:   el.querySelector('[data-ring="mid"]'),
    }));

    function triggerPulse(idx, amp) {
      planetPulseTimer[idx] = 0;
      planetPulseAmp[idx]   = amp;
    }

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - dragLastX;
        const dy = e.clientY - dragLastY;
        dragLastX = e.clientX;
        dragLastY = e.clientY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged = true;
        camTheta -= dx * 0.005;
        camPhi = Math.max(PHI_MIN, Math.min(PHI_MAX, camPhi - dy * 0.005));
        return;
      }
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x: nx, y: ny }, camera);

      // Ground plane for wave interaction
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        hit.y -= points.position.y;
        mouseWorld.copy(hit);
      }

      // Release interaction lock only when fully back in solar with all planets visible
      const allPlanetsRevealed = !planetReveal.some(r => r < 1);
      if (planetInteractionLocked && detailPlanetIdx < 0) {
        planetInteractionLocked = false;
      }

      // Hover detection — off while interaction locked or mouse-mode cooldown active
      const _mouseModeBlocked = Date.now() < _mouseModeBlockedUntil;
      if (_mouseModeWasBlocked && !_mouseModeBlocked) mouseMode = true; // timer just expired → snap to sun
      _mouseModeWasBlocked = _mouseModeBlocked;
      const _rawHits = planetInteractionLocked ? [] : raycaster.intersectObjects(planetMeshList);
      const hoverHits = _mouseModeBlocked ? [] : _rawHits;
      hoveredPlanetIdx = hoverHits.length > 0
        ? planetMeshList.indexOf(hoverHits[0].object)
        : -1;
      if (planetInteractionLocked) hoveredPlanetIdx = -1;
      if (hoveredPlanetIdx >= 0 && hoveredPlanetIdx !== prevHoveredPlanetIdx) _playCycleRandom(0.45);
      prevHoveredPlanetIdx = hoveredPlanetIdx;
      window.__siteCanvasInteractive = hoveredPlanetIdx >= 0;

      // Any mouse movement in solar zone activates mouse mode (unless recently scrolled/arrowed)
      if (solarZoneActive && sineEase(detailTimer) < 0.1 && !planetInteractionLocked && Date.now() >= _mouseModeBlockedUntil) mouseMode = true;

      // Swipe pulse — fires when ray passes within proximity but isn't hovering
      if (hoveredPlanetIdx < 0) {
        planetMeshList.forEach((mesh, idx) => {
          if (!mesh.visible) return;
          const dist = raycaster.ray.distanceToPoint(mesh.position);
          if (dist < 1.8 && planetPulseTimer[idx] < 0) {
            triggerPulse(idx, 0.5);
          }
        });
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    const onClick = (e) => {
      if (hasDragged) { hasDragged = false; return; }
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera({ x: nx, y: ny }, camera);
      const clickHits = raycaster.intersectObjects(planetMeshList);
      if (clickHits.length > 0) {
        const idx = planetMeshList.indexOf(clickHits[0].object);
        if (sineEase(solarTimer) > 0.8 && !planetInteractionLocked) {
          _playSound(_enterAudio, 0.8);
          // Enter planet detail / globe view — capture planet's current world pos
          planetInteractionLocked = true;
          detailPlanetIdx = idx;
          detailPlanetPos.copy(planetMeshes[idx].mesh.position);
          setScrollEnabled?.(false);
          // Kill any lingering bounce/exit state from the previous planet
          bounceActive     = false;
          bouncePlanetIdx  = -1;
          exitingDetailIdx = -1;
          for (let pi = 0; pi < nP; pi++) planetHover[pi] = 0;
        } else {
          triggerPulse(idx, 2.0);
        }
      }
    };
    window.addEventListener('click', onClick);

    const onMouseDown = (e) => {
      if (sineEase(solarTimer) < 0.85) return; // locked in wave mode
      if (projDetailTimer > 0.2) return;        // locked in project detail view
      if (hoveredPlanetIdx >= 0) return;        // don't drag when clicking a planet
      isDragging = true;
      hasDragged = false;
      dragLastX  = e.clientX;
      dragLastY  = e.clientY;
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // ── Disable browser zoom ──────────────────────────────────────────────
    // Update viewport meta to block pinch-zoom on mobile
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }
    const prevViewport = viewportMeta.content;
    viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

    // Escape → exit planet detail view or project file view
    // Left/Right → cycle planet cards when solar is fully shown
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (projDetailIdx >= 0 && Date.now() - projDetailOpenedAt >= 1500) {
          _playSound(_exitFileAudio, 0.8);
          projDetailIdx    = -1;
          projFileClosedAt = Date.now();
          _bgFadeTo(BG_NORMAL_VOL, 2000);
          e.stopImmediatePropagation();
        } else if (projDetailIdx >= 0) {
          // still within lock window — swallow the key, do nothing
          e.stopImmediatePropagation();
        } else if (detailPlanetIdx >= 0 && planetExitAllowed && Date.now() - projFileClosedAt >= 1500) {
          detailPlanetIdx = -1;
          projDetailIdx   = -1;
          projDetailTimer = 0;
          setScrollEnabled?.(true);
          e.stopImmediatePropagation();
          document.activeElement?.blur();
          canvas.focus();
        }
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.repeat && detailPlanetIdx >= 0 && projDetailIdx < 0 && plDoneAt > 0 && Date.now() - plDoneAt >= 1700) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (detailPlanetIdx === BLENDER_PLANET_IDX && _bgGridLocked) { /* still animating */ } else
        if (detailPlanetIdx === BLENDER_PLANET_IDX) {
          let row = Math.floor(blenderGridIdx / BLENDER_GRID_COLS);
          let col = blenderGridIdx % BLENDER_GRID_COLS;
          if      (e.key === 'ArrowRight') col = (col + 1) % BLENDER_GRID_COLS;
          else if (e.key === 'ArrowLeft')  col = (col - 1 + BLENDER_GRID_COLS) % BLENDER_GRID_COLS;
          else if (e.key === 'ArrowDown')  row = (row + 1) % BLENDER_GRID_ROWS;
          else if (e.key === 'ArrowUp')    row = (row - 1 + BLENDER_GRID_ROWS) % BLENDER_GRID_ROWS;
          const candidate = row * BLENDER_GRID_COLS + col;
          const candidateFile = APPLICATIONS[BLENDER_PLANET_IDX]?.files[candidate] ?? {};
          if (!candidateFile.model) return; // skip empty cells
          blenderGridIdx = candidate;
          _refreshBlenderGrid(true);
          _playCycleRandom(0.45);
        } else {
          projCarouselGo(e.key === 'ArrowRight' ? 1 : -1);
        }
      } else if (e.key === 'Enter' && !_bgGridLocked && detailPlanetIdx >= 0 && projDetailIdx < 0 && projDetailTimer < 0.05 && detailTimer > 0.8 && plDoneAt > 0 && Date.now() - plDoneAt >= 1700) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (detailPlanetIdx === BLENDER_PLANET_IDX) {
          const activeFile = APPLICATIONS[BLENDER_PLANET_IDX]?.files[blenderGridIdx] ?? {};
          if (!(activeFile.model || activeFile.img)) return;
          _refreshBlenderGrid(false);
          _bgCellBounce(blenderGridIdx);
        }
        _playSound(_enterFileAudio, 0.8);
        projDetailIdx      = detailPlanetIdx === BLENDER_PLANET_IDX ? blenderGridIdx : projCarouselIdx;
        projDetailOpenedAt = Date.now();
        hoveredProjCardIdx = -1;
      }



      // Arrow-key scroll for bio panel when a detail file is open
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && projDetailIdx >= 0) {
        e.preventDefault();
        _bioScrollBy(e.key === 'ArrowDown' ? 90 : -90);
      }

      // Block Ctrl+scroll zoom and Ctrl+± / Ctrl+0 keyboard zoom
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    };
    const onWheelZoom = (e) => { if (e.ctrlKey) e.preventDefault(); };
    window.addEventListener('wheel',   onWheelZoom, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    // Smooth scroll state
    let bioScrollTarget = 0;
    let bioScrollRafId  = null;
    const _bioScrollStep = () => {
      const diff = bioScrollTarget - bioPanel.scrollTop;
      if (Math.abs(diff) < 0.5) { bioPanel.scrollTop = bioScrollTarget; bioScrollRafId = null; return; }
      bioPanel.scrollTop += diff * 0.12;
      bioScrollRafId = requestAnimationFrame(_bioScrollStep);
    };
    const _bioScrollBy = (delta) => {
      const max = bioPanel.scrollHeight - bioPanel.clientHeight;
      bioScrollTarget = Math.max(0, Math.min(max, bioScrollTarget + delta));
      if (!bioScrollRafId) bioScrollRafId = requestAnimationFrame(_bioScrollStep);
    };

    // Handle wheel on bio panel explicitly so OrbitControls never sees it
    bioPanel.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _bioScrollBy(e.deltaY);
    }, { passive: false });

    let projWheelCooldown = false;
    const onProjWheel = (e) => {
      if (detailPlanetIdx < 0 || projDetailIdx >= 0 || plDispPct < 100) return;
      e.preventDefault();
      e.stopPropagation();
      if (projWheelCooldown) return;
      projCarouselGo(e.deltaY > 0 ? 1 : -1);
      projWheelCooldown = true;
      setTimeout(() => { projWheelCooldown = false; }, 180);
    };
    projPanel.addEventListener('wheel', onProjWheel, { passive: false, capture: true });
    canvas.addEventListener('wheel', onProjWheel, { passive: false, capture: false });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Wave spring state ──────────────────────────────────────────────────
    const springY = new Float32Array(count).fill(0);
    const springV = new Float32Array(count).fill(0);

    const WAVE_SK  = 0.08;
    const WAVE_D   = 0.80;
    const WAVE_F   = 0.9;
    const WAVE_R   = 3.0;
    const WAVE_MAX = 1.2;

    // ── Animation ─────────────────────────────────────────────────────────
    let rafId, lastMs = 0;
    let solarTimer  = 0;
    let prevInYellow = false;
    let hoverDimT   = 0; // 0=full brightness, 1=dimmed
    let detailTimer = 0; // 0=solar, 1=planet detail globe view
    let detailPlanetIdx = -1;
    let planetInteractionLocked = false; // hard lock: no hover/click until fully back in solar
    let sphereAngle = 0; // Y-axis rotation of the dot globe
    let spherePitch = 0; // X-axis rotation (tilt up/down)
    let spherePulse  = 0;  // 0-1, drives dot expansion on sonic boom
    let spherePulseT = -1; // -1=inactive, 0-1=progress through expand+retract
    const detailPlanetPos = new THREE.Vector3(); // world pos of clicked planet

    // ── Return-to-solar state ─────────────────────────────────────────────────
    let prevDetailPlanetIdx = -1;
    let detailUIShown       = false; // guard so showDetailUI runs only once per entry
    let exitingDetailIdx    = -1;  // keeps detail planet visible during wind-down
    let bouncePlanetIdx     = -1;  // planet playing the bounce-expand animation
    let bounceTimer         = 0;
    let bounceActive        = false;
    let returnElapsed       = 0;   // seconds since back was pressed
    const nP = 7; // number of planets — avoids PLANET_DATA reference before it's defined below
    const planetReveal      = new Float32Array(nP).fill(1); // 0=hidden 1=fully visible
    const planetRevealDelay = new Float32Array(nP).fill(0); // per-planet stagger delay (s)
    const posAttr = geometry.attributes.position;
    const colAttr = geometry.attributes.color;
    const clearCol = new THREE.Color();

    // ── Wave / solar camera constants ─────────────────────────────────────
    const WAVE_CAM_POS    = new THREE.Vector3(0, 8, 18);
    const WAVE_CAM_TARGET = new THREE.Vector3(0, -2, -5);
    const _solarCamPos    = new THREE.Vector3();
    const _camTarget      = new THREE.Vector3();

    // Reusable vec3 to avoid allocations in loop
    const _discPos      = new THREE.Vector3();
    const _camFwd       = new THREE.Vector3();
    const _camRight     = new THREE.Vector3();
    const _edgePt       = new THREE.Vector3();
    const _cp           = new THREE.Vector3();
    const _hudProj      = new THREE.Vector3();
    const _orbitCenter  = new THREE.Vector3();
    const MIN_SCREEN_R   = 12;
    const HOVER_SCREEN_R = 55;
    const _cosDT = Math.cos(DISC_TILT);
    const _sinDT = Math.sin(DISC_TILT);

    const animate = (ms) => {
      rafId = requestAnimationFrame(animate);
      const dt   = Math.min((ms - lastMs) * 0.001, 0.05);
      lastMs = ms;
      const t    = ms * 0.001;
      const prog = progressRef?.current ?? 0;

      // ── Auto-shifting dark hue (replaces scroll-driven color) ─────────────
      // Full hue cycle every ~120 s. HSL: s=0.55, l=0.17 → very dark but tinted.
      const aHue = (t * 3.0) % 360;
      const _as = 0.45, _al = 0.06;
      const _ac = (1 - Math.abs(2 * _al - 1)) * _as;
      const _ax = _ac * (1 - Math.abs(((aHue / 60) % 2) - 1));
      const _am = _al - _ac / 2;
      let _ar = _am, _ag = _am, _ab = _am;
      if      (aHue < 60)  { _ar = _ac+_am; _ag = _ax+_am; _ab = _am;     }
      else if (aHue < 120) { _ar = _ax+_am; _ag = _ac+_am; _ab = _am;     }
      else if (aHue < 180) { _ar = _am;     _ag = _ac+_am; _ab = _ax+_am; }
      else if (aHue < 240) { _ar = _am;     _ag = _ax+_am; _ab = _ac+_am; }
      else if (aHue < 300) { _ar = _ax+_am; _ag = _am;     _ab = _ac+_am; }
      else                  { _ar = _ac+_am; _ag = _am;     _ab = _ax+_am; }
      const cr = { r: _ar, g: _ag, b: _ab };

      // Solar mode: triggered when progress is between 0.35 and 0.65
      const inYellow = prog > 0.35 && prog < 0.65;
      solarZoneActive = inYellow;
      solarTimer = Math.max(0, Math.min(1, solarTimer + (inYellow ? 1 : -1) * dt / 1.4));
      if (solarReadyRef) solarReadyRef.current = solarTimer >= 1;
      if (inYellow && !prevInYellow) {
        _playSound(_enterAudio, 0.8);
        window._solarLocked = true;
        setTimeout(() => { window._solarLocked = false; }, 2500);
      }
      if (!inYellow && prevInYellow) { _playSound(_exitAudio, 0.8); mouseMode = false; }
      if (!inYellow) window._solarLocked = false;
      prevInYellow = inYellow;
      const solarT   = sineEase(solarTimer);
      const showSolar = solarT > 0.01;

      // Auto-exit detail view if user scrolls away from the solar section
      if (!inYellow && detailPlanetIdx >= 0 && planetExitAllowed && Date.now() - projFileClosedAt >= 1500) {
        detailPlanetIdx = -1;
        projDetailIdx   = -1;
        setScrollEnabled?.(true);
        _bgFadeTo(BG_NORMAL_VOL, 2000);
      }

      // ── Detail mode timer ─────────────────────────────────────────────────
      const enteringDetail = detailPlanetIdx >= 0;
      detailTimer = Math.max(0, Math.min(1, detailTimer + (enteringDetail ? 1 : -1) * dt / 1.1));
      const detailT = sineEase(detailTimer);

      // ── Mouse mode: sync carousel to hovered planet (no animation fight) ──
      if (mouseMode && hoveredPlanetIdx >= 0 && detailT < 0.1 && hoveredPlanetIdx !== pcIdx) {
        pcOffset = hoveredPlanetIdx;
        pcIdx    = hoveredPlanetIdx;
        pcRefresh(false);
      }
      // Fresh fade-in when switching to a new planet in mouse mode
      if (mouseMode && hoveredPlanetIdx !== lastMouseHoveredPlanet) {
        if (hoveredPlanetIdx >= 0) {
          planetHover[hoveredPlanetIdx] = 0;
          hoverDimT = 1;
        }
        lastMouseHoveredPlanet = hoveredPlanetIdx;
      }

      // In detail view, shift effective color toward the planet's glow color
      let ecr = cr;
      if (detailT > 0 && detailPlanetIdx >= 0) {
        const pg = PLANET_GLOW_RGB[detailPlanetIdx];
        ecr = {
          r: lerp(cr.r, pg.r, detailT),
          g: lerp(cr.g, pg.g, detailT),
          b: lerp(cr.b, pg.b, detailT),
        };
      }

      // Show/hide detail UI
      if (detailTimer > 0.5 && enteringDetail && !detailUIShown) {
        showDetailUI(detailPlanetIdx);
        detailUIShown = true;
      }
      // Hide pins immediately when back is pressed — don't wait for wind-down
      if (!enteringDetail && detailUIShown) {
        dvPins.forEach(el => el.classList.remove('visible'));
      }
      if (detailTimer < 0.05 && detailUIShown) {
        hideDetailUI();
        detailUIShown = false;
      }

      // ── Back-press detection & return-to-solar animations ────────────────
      if (prevDetailPlanetIdx >= 0 && detailPlanetIdx < 0) {
        // Moment back was pressed — set up sporadic planet reveal
        exitingDetailIdx = prevDetailPlanetIdx;
        returnElapsed    = 0;
        bounceActive     = false;
        bounceTimer      = 0;
        // Sort planets by orbit distance for a clean inside-out stagger
        const sortedByOrbit = Array.from({length: nP}, (_, i) => i)
          .filter(i => i !== exitingDetailIdx)
          .sort((a, b) => PLANET_DATA[a].orbitR - PLANET_DATA[b].orbitR);
        for (let pi = 0; pi < nP; pi++) {
          planetReveal[pi] = 0;
          if (pi === exitingDetailIdx) {
            planetRevealDelay[pi] = 0; // exiting planet pops in first
          } else {
            const order = sortedByOrbit.indexOf(pi);
            planetRevealDelay[pi] = 0.08 + order * 0.07; // tight 70ms stagger
          }
        }
      }
      // Reset UI shown flag when planet changes so a new entry rebuilds the panel
      if (detailPlanetIdx !== prevDetailPlanetIdx) {
        if (detailUIShown) hideDetailUI();
        detailUIShown = false;
        window._inPlanetDetail = detailPlanetIdx >= 0;
        window._setDashBtnVisible?.(detailPlanetIdx < 0);
        if (prevDetailPlanetIdx >= 0 && detailPlanetIdx < 0 && inYellow) {
          window._solarLocked = true;
          setTimeout(() => { window._solarLocked = false; }, 2500);
        }
      }
      prevDetailPlanetIdx = detailPlanetIdx;

      // Tick sporadic reveals
      if (!enteringDetail && exitingDetailIdx >= 0) {
        returnElapsed += dt;
        for (let pi = 0; pi < nP; pi++) {
          if (planetReveal[pi] < 1 && returnElapsed > planetRevealDelay[pi]) {
            planetReveal[pi] = Math.min(1, planetReveal[pi] + dt / 0.18);
          }
        }
      }
      // Once fully wound down, clear exiting state
      if (detailTimer < 0.01 && exitingDetailIdx >= 0 && !bounceActive) {
        exitingDetailIdx = -1;
      }

      // Release interaction lock in render loop so Enter works without requiring mouse move first
      if (planetInteractionLocked && detailPlanetIdx < 0) {
        const allRevealed = !planetReveal.some(r => r < 1);
        if (allRevealed) planetInteractionLocked = false;
      }

      // Trigger bounce when the exiting planet finishes shrinking back
      if (exitingDetailIdx >= 0 && !bounceActive && detailTimer < 0.08) {
        bounceActive    = true;
        bouncePlanetIdx = exitingDetailIdx;
        bounceTimer     = 0;
        returnElapsed   = 0; // restart reveal clock so exiting planet appears after bounce peak
        planetRevealDelay[bouncePlanetIdx] = 0; // exiting planet reveals immediately
      }
      if (bounceActive) {
        bounceTimer += dt;
        if (bounceTimer > 1.8) {
          bounceActive    = false;
          bouncePlanetIdx = -1;
          exitingDetailIdx = -1;
        }
      }

      // ── Project detail (click-into-card) animation ───────────────────────
      const enteringProjDetail = projDetailIdx >= 0;
      projDetailTimer = Math.max(0, Math.min(1, projDetailTimer + (enteringProjDetail ? 1 : -1) * dt / 1.1));

      const projDetailT = sineEase(projDetailTimer);
      // Extra spin: -2π * projDetailT gives a smooth 360° left spin; reverses on back
      const spinOffset = -Math.PI * 2 * projDetailT;

      // ── Sphere rotation — idle spin or rotate active pin to face camera ──
      const activePinIdx = detailPlanetIdx === BLENDER_PLANET_IDX ? blenderGridIdx : hoveredProjCardIdx;
      if (detailT > 0.5 && activePinIdx >= 0 && detailPlanetIdx >= 0 && projDetailT < 0.05) {
        const pu = PIN_UNIT[activePinIdx];

        // ── Target yaw (Y-axis): align pin's XZ azimuth with camera XZ azimuth ──
        // After Y-rotation by a: atan2(rz, rx) = atan2(nz, nx) - a
        // Camera XZ direction: atan2(cos(camTheta), sin(camTheta))
        const pinPhiXZ = Math.atan2(pu.nz, pu.nx);
        const camPhiXZ = Math.atan2(Math.cos(camTheta), Math.sin(camTheta));
        const targetYaw = pinPhiXZ - camPhiXZ;
        let yawDiff = ((targetYaw - sphereAngle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        sphereAngle += yawDiff * Math.min(1, dt * 4.0);

        // ── Target pitch (X-axis): align pin's elevation with camera elevation ──
        // Pin elevation above XZ plane
        const pinXZLen = Math.sqrt(pu.nx * pu.nx + pu.nz * pu.nz);
        const pinEl    = Math.atan2(pu.ny, pinXZLen);
        // Camera elevation above XZ plane (camPhi is polar from Y-up, so el = PI/2 - camPhi)
        const camEl    = Math.PI / 2 - camPhi;
        const targetPitch = pinEl - camEl;
        let pitchDiff = ((targetPitch - spherePitch) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        spherePitch += pitchDiff * Math.min(1, dt * 4.0);
      } else {
        // Normal idle spin, pitch returns to 0
        sphereAngle += dt * 0.06 * detailT;
        let pitchReturn = ((0 - spherePitch) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        spherePitch += pitchReturn * Math.min(1, dt * 2.5);
      }

      // Slowly orbit camera around the hovered card's planet
      if (hoveredCardIdx >= 0 && !isDragging && detailT < 0.1) {
        if (mouseMode && hoveredPlanetIdx >= 0) {
          orbitPausedAt = Date.now();
        } else {
          const secsSincePause = (Date.now() - orbitPausedAt) / 1000;
          const ramp = orbitPausedAt > 0 ? Math.min(1, Math.max(0, (secsSincePause - 3) / 2)) : 1;
          camTheta -= dt * 0.22 * ramp;
        }
      }

      // ── In proj detail, reset camera to a fixed angle so planet is always centred ──
      if (projDetailTimer > 0) {
        const targetTheta = 0;                  // camera faces straight-on (+Z side)
        const targetPhi   = Math.PI / 2.2;      // slight elevation
        const snap = Math.min(1, dt * 3.5 * projDetailT + dt * 1.0);
        let tDiff = ((targetTheta - camTheta) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        camTheta += tDiff * snap;
        camPhi    = camPhi + (targetPhi - camPhi) * snap;
        camPhi    = Math.max(PHI_MIN, Math.min(PHI_MAX, camPhi));
        isDragging = false; // force-release any drag in progress
      }

      // Zoom camera in for detail view, proj-detail (closer), or sidebar card hover
      const camRTarget = projDetailT > 0.01
        ? lerp(22, 14, projDetailT)
        : detailT > 0.01 ? 22
        : mouseMode ? 36
        : hoveredCardIdx >= 0 ? 26
        : 33;
      camR = lerp(camR, camRTarget, dt * 1.8);

      // ── Camera: lerp between fixed wave view and orbit solar/planet view ────
      {
        // Mouse mode: always center on sun; card mode: orbit toward active card's planet
        const _cardTarget = mouseMode ? SUN_WORLD
          : hoveredCardIdx >= 0 ? planetWorldPos[hoveredCardIdx] : SUN_WORLD;
        cardOrbitCenter.lerp(_cardTarget, dt * 3.5);
        // Detail view overrides: lerp from card-tracked center to clicked planet
        _orbitCenter.lerpVectors(cardOrbitCenter, detailPlanetPos, detailT);
        const sp = Math.sin(camPhi);
        _solarCamPos.set(
          _orbitCenter.x + camR * sp * Math.sin(camTheta),
          _orbitCenter.y + camR * Math.cos(camPhi),
          _orbitCenter.z + camR * sp * Math.cos(camTheta)
        );
        _solarCamPos.y -= detailT * 3.0;
        camera.position.lerpVectors(WAVE_CAM_POS, _solarCamPos, solarT);
        _camTarget.lerpVectors(WAVE_CAM_TARGET, _orbitCenter, solarT);
        // Shift look-target right along camera-right axis → planet drifts to left of screen
        const lateralShift = projDetailT * 10.0;
        _camTarget.x += Math.cos(camTheta) * lateralShift;
        _camTarget.z -= Math.sin(camTheta) * lateralShift;
        camera.lookAt(_camTarget);
      }

      // ── Project pin screen positions ──────────────────────────────────────
      if (detailTimer > 0.3 && detailPlanetIdx >= 0) {
        const effAngle = sphereAngle + spinOffset;
        const cS = Math.cos(effAngle), sS = Math.sin(effAngle);
        const cP = Math.cos(spherePitch),  sP = Math.sin(spherePitch);
        const paX = Math.cos(camTheta), paZ = -Math.sin(camTheta);
        // Camera forward to determine front-face visibility
        camera.getWorldDirection(_camFwd);
        PIN_UNIT.forEach((p, pi) => {
          // Y-axis rotation (yaw)
          const ry_x =  p.nx * cS + p.nz * sS;
          const ry_y =  p.ny;
          const ry_z = -p.nx * sS + p.nz * cS;
          // Pitch around camera-right axis via Rodrigues
          const pdot = ry_x * paX + ry_z * paZ;
          const crX  = -paZ * ry_y;
          const crY  =  paZ * ry_x - paX * ry_z;
          const crZ  =  paX * ry_y;
          const rx = ry_x * cP + crX * sP + paX * pdot * (1 - cP);
          const ry = ry_y * cP + crY * sP;
          const rz = ry_z * cP + crZ * sP + paZ * pdot * (1 - cP);
          // World position of pin
          _pinWorld.set(
            detailPlanetPos.x + rx * SPHERE_R,
            detailPlanetPos.y + ry * SPHERE_R,
            detailPlanetPos.z + rz * SPHERE_R
          );
          // Visibility: dot with cam forward (negative = facing camera)
          const toPin = _pinWorld.clone().sub(camera.position).normalize();
          const facing = toPin.dot(_camFwd) < 0 ? 0 : 1; // 0=front-facing
          const frontFace = rx * (-_camFwd.x) + ry * (-_camFwd.y) + rz * (-_camFwd.z);
          const fileCount = detailPlanetIdx >= 0 ? PLANET_PROJECTS[detailPlanetIdx].length : PIN_MAX;
          const visible = frontFace > 0.1 && detailT > 0.6 && pi < fileCount;
          // Project to screen
          _pinProj.copy(_pinWorld).project(camera);
          const sx = (_pinProj.x *  0.5 + 0.5) * window.innerWidth;
          const sy = (_pinProj.y * -0.5 + 0.5) * window.innerHeight;
          const el = dvPins[pi];
          el.style.left = `${sx}px`;
          el.style.top  = `${sy - 52}px`;
          if (visible) el.classList.add('visible');
          else         el.classList.remove('visible');
          const isBlender = detailPlanetIdx === BLENDER_PLANET_IDX;
          el.classList.toggle('dim', visible && pi !== activePinIdx);
          el.classList.toggle('blender-big', isBlender);

        });
      }

      // Card hover also counts as hovering that planet (shows HUD, brightens it, dims others)
      const effectiveHoveredIdx = hoveredPlanetIdx >= 0 ? hoveredPlanetIdx : mouseMode ? -1 : hoveredCardIdx;

      // Dim everything except hovered planet when hovering
      const isHovering = effectiveHoveredIdx >= 0 && showSolar;
      hoverDimT = Math.max(0, Math.min(1, hoverDimT + (isHovering ? 1 / 0.12 : -1 / 0.35) * dt));
      const DIM = 0.08; // how dark non-hovered things get

      // Background — slightly darkened on planet hover
      const bgDim = 1 - hoverDimT * 0.35;
      clearCol.setRGB(cr.r * 0.06 * bgDim, cr.g * 0.06 * bgDim, cr.b * 0.06 * bgDim);
      renderer.setClearColor(clearCol, 1);
      const ri = Math.round(cr.r * 130 * bgDim);
      const gi = Math.round(cr.g * 130 * bgDim);
      const bi = Math.round(cr.b * 130 * bgDim);
      canvas.style.background = `
        radial-gradient(ellipse 150% 50% at 50% 100%,
          rgba(${ri},${gi},${bi},0.45) 0%,rgba(0,0,0,0) 70%),
        rgb(${Math.round(cr.r * 15 * bgDim)},${Math.round(cr.g * 15 * bgDim)},${Math.round(cr.b * 15 * bgDim)})
      `;

      // ── Solar system visibility + animation ───────────────────────────

      // Sun — dims when any planet is hovered
      sunMesh.visible      = showSolar;
      sunGlowMesh.visible  = showSolar;
      coronaSprite.visible = showSolar;
      if (showSolar) {
        const sunBright = lerp(1, DIM, hoverDimT) * (1 - detailT);
        sunMat.opacity                              = solarT * sunBright;
        sunGlowMesh.material.uniforms.opacity.value = solarT * sunBright;
        coronaSpriteMat.opacity                     = solarT * 0.45 * sunBright;
        // Push sun behind hovered planet
        sunMesh.renderOrder     = isHovering ? -1 : 0;
        sunGlowMesh.renderOrder = isHovering ? -1 : 0;
        coronaSprite.renderOrder = isHovering ? -1 : 0;
      }

      // Camera right vector for screen-space radius computation (computed once per frame)
      camera.getWorldDirection(_camFwd);
      _camRight.crossVectors(_camFwd, camera.up).normalize();

      // Planets + orbit rings
      PLANET_DATA.forEach((p, idx) => {
        const { mesh, glowMesh, hitMesh } = planetMeshes[idx];
        const ring    = orbitRings[idx];
        const hovered = idx === effectiveHoveredIdx && showSolar;

        // Smooth hover lerp
        planetHover[idx] = Math.max(0, Math.min(1,
          planetHover[idx] + (hovered ? 1 / 0.1 : -1 / 0.25) * dt
        ));
        const hv = planetHover[idx];

        // Freeze / resume orbit without jumping
        const frozenForDetail = idx === detailPlanetIdx;
        const effectiveHovered = hovered || frozenForDetail;
        if (effectiveHovered && !planetWasHovered[idx]) {
          planetFrozenAngle[idx] = t * p.speed + planetOrbitOffset[idx];
        }
        if (!effectiveHovered && planetWasHovered[idx]) {
          planetOrbitOffset[idx] = planetFrozenAngle[idx] - t * p.speed;
        }
        planetWasHovered[idx] = effectiveHovered;
        const angle = effectiveHovered
          ? planetFrozenAngle[idx]
          : t * p.speed + planetOrbitOffset[idx];

        // Keep exiting planet in detail branch while detailTimer winds down
        const isDetailPlanet = idx === detailPlanetIdx || (idx === exitingDetailIdx && detailTimer > 0.01);
        // Planets reveal sporadically; exiting planet controlled separately via detail branch
        const showThisPlanet = showSolar && (isDetailPlanet || planetReveal[idx] > 0);
        mesh.visible     = showThisPlanet;
        glowMesh.visible = showThisPlanet;
        // Disable hover hit detection for all planets once detail starts
        hitMesh.visible  = showSolar && detailT < 0.1;
        ring.visible     = showSolar && detailT < 0.1;

        const { bodySprite, glowSprite } = planetSprites[idx];
        // Sprites disabled — terrain-textured mesh stays visible on hover
        bodySprite.visible = false;
        glowSprite.visible = false;

        if (showThisPlanet) {
          const wpos = discWorldPos(p.orbitR, angle);
          planetWorldPos[idx].copy(wpos); // keep live position for camera tracking
          mesh.position.copy(wpos);
          glowMesh.position.copy(wpos);
          hitMesh.position.copy(wpos);

          if (isDetailPlanet) {
            // Scale planet to match dot sphere radius as detail opens
            const detailSc = lerp(1, SPHERE_R * 0.78 / p.sphereR, detailT);
            mesh.scale.setScalar(detailSc);
            glowMesh.scale.setScalar(detailSc);
            mesh.material.opacity                    = solarT;
            glowMesh.material.uniforms.opacity.value = solarT * 0.6;
            mesh.material.depthTest  = false;
            glowMesh.material.depthTest = false;
            mesh.renderOrder     = 5;
            glowMesh.renderOrder = 5;
          } else {
            // Normal solar system planet rendering
            const PULSE_DUR = 0.7;
            let pulse = 0;
            if (planetPulseTimer[idx] >= 0) {
              planetPulseTimer[idx] += dt;
              if (planetPulseTimer[idx] >= PULSE_DUR) {
                planetPulseTimer[idx] = -1;
              } else {
                pulse = Math.sin((planetPulseTimer[idx] / PULSE_DUR) * Math.PI)
                        * planetPulseAmp[idx];
              }
            }
            _edgePt.copy(wpos).addScaledVector(_camRight, p.sphereR);
            _edgePt.project(camera);
            _cp.copy(wpos).project(camera);
            const screenR1 = Math.abs((_edgePt.x - _cp.x) * 0.5 * window.innerWidth);
            const minSc    = screenR1 > 0 ? Math.max(1, MIN_SCREEN_R / screenR1) : 1;
            const hoverSc  = screenR1 > 0 ? HOVER_SCREEN_R / screenR1 : minSc;
            // Bounce-expand for the planet you just exited
            const bounceAmt = (bounceActive && idx === bouncePlanetIdx)
              ? Math.max(0, Math.exp(-4.5 * bounceTimer) * Math.sin(Math.PI * 2 * bounceTimer * 3) * 0.7)
              : 0;
            const sc = lerp(minSc, hoverSc, hv) + pulse + bounceAmt;
            mesh.scale.setScalar(sc);
            glowMesh.scale.setScalar(sc);
            const planetBright = hovered ? 1 : lerp(1, DIM, hoverDimT);
            // Fade in sporadically when returning from detail view
            const revealAlpha  = planetReveal[idx];
            mesh.material.opacity                    = solarT * planetBright * revealAlpha * (1 - detailT);
            glowMesh.material.uniforms.opacity.value = solarT * planetBright * (hovered ? 0.8 : 0.4) * revealAlpha * (1 - detailT);
            mesh.material.depthTest     = true;
            glowMesh.material.depthTest = true;
            mesh.renderOrder     = 0;
            glowMesh.renderOrder = 0;
          }
        }
      });

      // ── Sidebar visibility ────────────────────────────────────────────────
      const sidebarOpacity = solarT * (1 - detailT);
      sidebarEl.style.opacity        = sidebarOpacity.toFixed(3);
      sidebarEl.style.pointerEvents  = (solarT > 0.5 && detailT < 0.3) ? 'auto' : 'none';
      if (sidebarOpacity > 0.5) {
        if (!kbHints._showTimer && !kbHints.classList.contains('visible')) {
          kbHints._showTimer = setTimeout(() => {
            kbHints.classList.add('visible');
            kbHints._showTimer = null;
          }, 800);
        }
      } else {
        clearTimeout(kbHints._showTimer);
        kbHints._showTimer = null;
        kbHints.classList.remove('visible');
      }
      // ── Planet loader ring update ──────────────────────────────────────────
      if (plVisible) {
        const targetPct = Math.round(Math.min(1, plLoadProgress) * 100);
        if (plDispPct < targetPct) {
          // Check if we're sitting on a pause point
          if (plPausePoints.length && plPausePoints[0] === plDispPct) {
            plPauseTimer += dt;
            if (plPauseTimer >= 0.05) { plPauseTimer = 0; plPausePoints.shift(); }
          } else {
            const lag = targetPct - plDispPct;
            const interval = lag > 10 ? 0.012 : lag > 3 ? 0.02 : 0.03;
            plDigitTimer += dt;
            while (plDigitTimer >= interval && plDispPct < targetPct) {
              plDigitTimer -= interval;
              plDispPct++;
            }
          }
        }

        plPct.textContent = plDispPct + '%';
        plRingSmooth += (plDispPct - plRingSmooth) * Math.min(1, 6 * dt);
        plRing.style.strokeDashoffset = String(+(PL_CIRC * (1 - plRingSmooth / 100)).toFixed(3));

        if (plDispPct >= 100 && !planetLoaderEl.classList.contains('done')) {
          _loadingAudio.pause();
          _loadingAudio.currentTime = 0;
          _playSound(_successAudio, 0.8);
          planetLoaderEl.classList.add('done');
          plFadeOutTimer = 0;
          plDoneAt = Date.now();
          // Let the pulse/flash CSS animations play, then fade everything out
          const _plSvg = planetLoaderEl.querySelector('svg');
          const _fadeOut = 'opacity 0.55s ease-out';
          plFadeTimeoutId = setTimeout(() => {
            plFadeTimeoutId = null;
            if (_plSvg) { _plSvg.style.transition = _fadeOut; _plSvg.style.opacity = '0'; }
            plPct.style.animation = 'none';
            plPct.style.transition = _fadeOut; plPct.style.opacity = '0';
            plLabel.style.transition = _fadeOut; plLabel.style.opacity = '0';
          }, 850);
          // Burst rings on completion
          [1,2,3,4].forEach((n, i) => {
            const el = document.getElementById(`pl-burst-${n}`);
            if (!el) return;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = `plBurst 0.65s cubic-bezier(0.2,0,0.8,1) ${i * 0.09}s forwards`;
          });
          // Pulse sphere dots outward
          spherePulseT = 0;
          // Pulse nav dots outward from active dot
          projDots.forEach((dot, i) => {
            const dist  = Math.abs(i - projCarouselIdx);
            const delay = dist * 0.07;
            const anim  = (i === projCarouselIdx) ? 'plDotPulseActive' : 'plDotPulse';
            dot.style.animation = 'none';
            void dot.offsetWidth;
            dot.style.animation = `${anim} 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}s forwards`;
          });
          // Drive screen ripple with planet color
          const _ripCol = getComputedStyle(planetLoaderEl).getPropertyValue('--pl-col').trim() || '#ffffff';
          plScreenRipple.style.animation = 'none';
          plScreenRipple.style.background = `radial-gradient(circle at 50% 50%, ${_ripCol}22 0%, transparent 35%)`;
          plScreenRipple.style.opacity = '1';
          void plScreenRipple.offsetWidth;
          plScreenRipple.style.transition = 'opacity 1.3s cubic-bezier(0.1,0,0.6,1), background 1.3s cubic-bezier(0.1,0,0.6,1)';
          requestAnimationFrame(() => {
            plScreenRipple.style.background = `radial-gradient(circle at 50% 50%, ${_ripCol}00 0%, transparent 100%)`;
            plScreenRipple.style.opacity = '0';
          });
        }
        if (planetLoaderEl.classList.contains('done')) {
          plFadeOutTimer += dt;
          if (plFadeOutTimer > 0.5 && !plFilesCanFadeIn) { plFilesCanFadeIn = true; const _tok = plExitToken; setTimeout(() => { const a = _fileShowAudio.cloneNode(); a.volume = 0.5; a.playbackRate = 0.75; a.play().catch(() => {}); setTimeout(() => { if (plExitToken === _tok) planetExitAllowed = true; }, 700); }, 300); }
          // Wait for last wave (delay 0.84s + dur 3.4s = 4.24s) before hiding loader
          if (plFadeOutTimer > 3.0) {
            plVisible = false;
            planetLoaderEl.classList.remove('visible', 'done');
          }
        }
      }

      // ── Project panel visibility (fades out when a card is clicked into) ────
      if (detailUIShown && plFilesCanFadeIn && plFadeInTimer < 1) plFadeInTimer = Math.min(1, plFadeInTimer + dt / 1.0);
      const loaderGate = (!plFilesCanFadeIn || !detailUIShown) ? 0 : Math.pow(plFadeInTimer, 2.5);
      const projOpacity = Math.max(0, (detailT - 0.3) / 0.7) * (1 - projDetailT) * loaderGate;
      const _isBlenderPlanet = detailPlanetIdx === BLENDER_PLANET_IDX;
      projPanel.style.opacity       = _isBlenderPlanet ? '0' : projOpacity.toFixed(3);
      projPanel.style.pointerEvents = (!_isBlenderPlanet && detailT > 0.6 && projDetailT < 0.1 && !plVisible) ? 'auto' : 'none';
      projDotsEl.style.opacity      = _isBlenderPlanet ? '0' : projOpacity.toFixed(3);
      projDotsEl.style.pointerEvents = projPanel.style.pointerEvents;
      const _bgGridVisible = _isBlenderPlanet && projOpacity > 0.01 && projDetailT < 0.1;
      blenderGridPanel.style.display = _bgGridVisible ? 'flex' : 'none';
      blenderGridPanel.style.opacity = _isBlenderPlanet ? projOpacity.toFixed(3) : '0';
      if (_bgGridVisible && !_bgGridWasVisible) { _triggerDiagonalEntrance(); }

      _bgGridWasVisible = _bgGridVisible;
      iconPanel.style.opacity       = (Math.max(0, (detailT - 0.3) / 0.7) * loaderGate).toFixed(3);
      kbPlanetHints.style.opacity   = projOpacity.toFixed(3);
      dvPins.forEach(el => { el.style.opacity = el.classList.contains('visible') ? loaderGate.toFixed(3) : '0'; });

      // Hide "← SOLAR SYSTEM" button while a project file is open
      dvBack.style.opacity      = (projDetailT < 0.01 ? '' : Math.max(0, 1 - projDetailT * 5).toFixed(3));
      dvBack.style.pointerEvents = projDetailT > 0.1 ? 'none' : '';

      // ── Typewriter: planet label ↔ project file name ─────────────────────
      {
        const nameEl = document.getElementById('dv-planet-name');
        if (nameEl && detailPlanetIdx >= 0) {
          const skillLabel = `PLANET ${PLANET_SKILLS[detailPlanetIdx].name.toUpperCase()}`;
          const projLabel  = projDetailIdx >= 0
            ? PLANET_PROJECTS[detailPlanetIdx][projDetailIdx].toUpperCase()
            : skillLabel;
          const desiredLabel = projDetailT > 0.45 ? projLabel : skillLabel;

          // Kick off typewriter when desired label changes
          if (desiredLabel !== twLastLabel) {
            twLastLabel = desiredLabel;
            twTarget    = desiredLabel;
            twPhase     = 'erase';
            twTimer     = 0;
          }

          // Advance typewriter state
          twTimer += dt;
          if (twPhase === 'erase') {
            while (twTimer >= TW_ERASE && twText.length > 0) {
              twText  = twText.slice(0, -1);
              twTimer -= TW_ERASE;
            }
            if (twText.length === 0) { twPhase = 'type'; twTimer = 0; }
          } else if (twPhase === 'type') {
            while (twTimer >= TW_TYPE && twText.length < twTarget.length) {
              twText  = twTarget.slice(0, twText.length + 1);
              twTimer -= TW_TYPE;
            }
            if (twText === twTarget) twPhase = 'idle';
          }

          // Show text + blinking cursor while animating
          const cursor = twPhase !== 'idle' ? (Math.floor(t * 8) % 2 === 0 ? '|' : '') : '';
          const display = twText + cursor;
          if (nameEl.textContent !== display) nameEl.textContent = display;
        }
      }

      // ── File tree panel ───────────────────────────────────────────────────
      {
        const treeVisible = projDetailTimer > 0.75 && enteringProjDetail;
        fileTreePanel.classList.toggle('visible', treeVisible);

        // Rebuild tree content when entering a new project
        if (enteringProjDetail && detailPlanetIdx >= 0 && projDetailIdx >= 0) {
          const treeKey = `${detailPlanetIdx}-${projDetailIdx}`;
          if (fileTreePanel.dataset.treeKey !== treeKey) {
            fileTreePanel.querySelectorAll('video').forEach(v => { v.pause(); v.muted = true; v.volume = 0; });
            fileTreePanel.dataset.treeKey = treeKey;
            const col = '#' + new THREE.Color(PLANET_DATA[detailPlanetIdx].color).getHexString();
            const appFile  = APPLICATIONS[detailPlanetIdx]?.files[projDetailIdx] ?? {};
            const tree = appFile.tree ?? [];
            const bio  = appFile;
            const appName  = APPLICATIONS[detailPlanetIdx]?.name ?? '';
            const projName = `${appName.toLowerCase()}/file-${projDetailIdx + 1}`;

            // ── Set static content (no video elements yet) ───────────────
            const videos = extractVideos(tree);
            const projectTitle = bio.title || appName.toUpperCase();
            // Update centered title display
            projTitleDisplay.querySelector('.ptd-name').textContent = projectTitle;
            projTitleDisplay.querySelector('.ptd-name').style.setProperty('--glow-color', col);

            // Update detail logo overlay
            const logoImg = detailLogoOverlay.querySelector('img');
            if (bio.logo) {
              logoImg.src = bio.logo;
              logoImg.style.display = '';
              detailLogoOverlay.style.setProperty('--logo-glow', col + '88');
            } else {
              logoImg.src = '';
              logoImg.style.display = 'none';
            }

            // ── Populate bio panel ───────────────────────────────────────
            {
              const chips = (bio.stack ?? []).map(s =>
                `<span class="bp-chip" style="border-color:${col}55;color:${col}">${s}</span>`
              ).join('');
              const paragraphs = (bio.bioText || bio.desc || '').split('\n\n').filter(p => p.trim());
              const imgs = bio.bioImgs || (bio.img ? [bio.img] : []);
              let imgIdx = 0;
              let bpHTML = `<div class="bp-body">`;
              bpHTML += `<div class="bp-meta">`;
              if (bio.role)   bpHTML += `<div class="bp-meta-item"><span class="bp-meta-key">ROLE</span><span class="bp-meta-val">${bio.role}</span></div>`;
              if (bio.year)   bpHTML += `<div class="bp-meta-item"><span class="bp-meta-key">YEAR</span><span class="bp-meta-val">${bio.year}</span></div>`;
              if (bio.status) bpHTML += `<div class="bp-meta-item"><span class="bp-meta-key">STATUS</span><span class="bp-meta-val" style="color:${col}">${bio.status}</span></div>`;
              bpHTML += `</div>`;
              if (chips) bpHTML += `<div class="bp-chips">${chips}</div>`;
              const _wrapBlenderText = (text, shortCols, fullLines) => {
                const words = text.split(' ');
                const lines = [];
                let line = '';
                for (const word of words) {
                  const test = line ? line + ' ' + word : word;
                  if (lines.length < fullLines) {
                    // Full zone: push line when it hits 50 chars, then start fresh
                    if (line && test.length > 54) {
                      lines.push(line);
                      line = word;
                    } else {
                      line = test;
                    }
                  } else {
                    // Short zone: break before word if it would exceed limit
                    if (test.length <= shortCols) {
                      line = test;
                    } else {
                      if (line) lines.push(line);
                      line = word;
                    }
                  }
                }
                if (line) lines.push(line);
                return lines.join('\n');
              };
              paragraphs.forEach((para, i) => {
                if (imgIdx < imgs.length && i % 2 === 1) {
                  const side = (imgIdx % 2 === 0) ? 'right' : 'left';
                  bpHTML += `<img class="bp-img bp-img-${side}" src="${imgs[imgIdx]}" alt="" onerror="this.style.display='none'">`;
                  imgIdx++;
                }
                const isBlenderDetail = detailPlanetIdx === BLENDER_PLANET_IDX;
                const formatted = isBlenderDetail
                  ? _wrapBlenderText(para, 38, 2)
                  : para;
                const pStyle = isBlenderDetail ? ' style="white-space:pre-wrap"' : '';
                bpHTML += `<p class="bp-text"${pStyle}>${formatted}</p>`;
                if (imgIdx < imgs.length && i === paragraphs.length - 1) {
                  bpHTML += `<div class="bp-clear"></div>`;
                }
              });
              bpHTML += `</div>`;
              bioPanel.innerHTML = bpHTML;
              bioPanel.scrollTop = 0; bioScrollTarget = 0;
            }

            fileTreePanel.innerHTML = `
              <div class="fp-content">
                <div class="fp-fixed-header">
                  <div class="ftp-header" style="color:${col}">
                    <div class="ftp-header-dot"></div>
                    <span class="ftp-path">// ${projName}</span>
                  </div>
                </div>
                <div class="fp-scroll-body">
                  <div class="fp-media-grid"></div>
                </div>
              </div>
            `;

            // ── Build staggered media grid with programmatic video elements ──
            const STAGGER = [
              { width:'100%',  marginLeft:'0',    marginRight:'0',    rotate:'-0.7deg'  },
              { width:'88%',   marginLeft:'auto', marginRight:'0',    rotate:'1.3deg'   },
              { width:'80%',   marginLeft:'0',    marginRight:'auto', rotate:'-1.8deg'  },
              { width:'94%',   marginLeft:'auto', marginRight:'0',    rotate:'0.6deg'   },
              { width:'86%',   marginLeft:'0',    marginRight:'auto', rotate:'-0.9deg'  },
            ];
            const grid = fileTreePanel.querySelector('.fp-media-grid');
            if (grid) {
              const MAX_MEDIA = 4;
              const cappedVideos = videos.slice(0, MAX_MEDIA);
              const showImg = bio.img && cappedVideos.length < MAX_MEDIA;
              const totalItems = cappedVideos.length + (showImg ? 1 : 0);

              if (totalItems === 0) {
                const empty = document.createElement('div');
                empty.className = 'fp-no-content';
                empty.textContent = 'No content';
                grid.appendChild(empty);
              } else {
                cappedVideos.forEach((vid, i) => {
                  const sg = STAGGER[i % STAGGER.length];
                  const item = document.createElement('div');
                  item.className = 'fp-media-item';
                  item.style.width       = sg.width;
                  item.style.marginLeft  = sg.marginLeft;
                  item.style.marginRight = sg.marginRight;
                  item.style.transform   = `rotate(${sg.rotate})`;

                  const video = document.createElement('video');
                  video.muted       = true;
                  video.loop        = true;
                  video.playsInline = true;
                  video.preload     = i === 0 ? 'auto' : 'none';
                  video.src         = vid.v;

                  const label = document.createElement('span');
                  label.className   = 'fp-media-label';
                  label.textContent = vid.n;

                  item.appendChild(video);
                  item.appendChild(label);
                  grid.appendChild(item);

                  const myKey = treeKey;
                  const isActive = () => fileTreePanel.dataset.treeKey === myKey && projDetailIdx >= 0;
                  const tryPlay = () => { if (isActive()) video.play().catch(() => {}); };
                  video.addEventListener('loadeddata', () => { video.currentTime = 0.1; tryPlay(); }, { once: true });
                  video.addEventListener('canplaythrough', tryPlay, { once: true });
                  setTimeout(() => { if (isActive()) video.load(); }, i === 0 ? 0 : i * 1500);
                  if (i === 0) {
                    video._audioFadeId = setTimeout(() => {
                      if (!isActive()) return;
                      video.muted  = false;
                      video.volume = 0;
                      const TARGET_VOL = 0.2;
                      const FADE_MS = 3500;
                      const step = 16;
                      const inc = TARGET_VOL / (FADE_MS / step);
                      const fade = setInterval(() => {
                        if (!isActive()) { clearInterval(fade); video.muted = true; video.volume = 0; return; }
                        video.volume = Math.min(TARGET_VOL, video.volume + inc);
                        if (video.volume >= TARGET_VOL) clearInterval(fade);
                      }, step);
                    }, 1500);
                  }
                });

                if (showImg) {
                  const sg = STAGGER[cappedVideos.length % STAGGER.length];
                  const item = document.createElement('div');
                  item.className = 'fp-media-item';
                  item.style.width       = sg.width;
                  item.style.marginLeft  = sg.marginLeft;
                  item.style.marginRight = sg.marginRight;
                  item.style.transform   = `rotate(${sg.rotate})`;
                  const img = document.createElement('img');
                  img.src = bio.img;
                  img.alt = projName;
                  img.onerror = () => { item.style.display = 'none'; };
                  item.appendChild(img);
                  grid.appendChild(item);
                }
              }
            }
          }
        } else if (!enteringProjDetail) {
          fileTreePanel.dataset.treeKey = '';
          fileTreePanel.innerHTML = '';
          bioPanel.innerHTML = '';
          detailLogoOverlay.querySelector('img').src = '';
        }
      }


      // ── "Back to projects" button visibility ─────────────────────────────
      const projBackVisible = projDetailTimer > 0.85 && enteringProjDetail;
      projBack.classList.toggle('visible', projBackVisible);
      const detailLogoSrc = detailLogoOverlay.querySelector('img').src;
      const hasDetailLogo = detailLogoSrc && !detailLogoSrc.endsWith('/');
      const detailVisible = projDetailTimer > 0.75 && enteringProjDetail;
      projTitleDisplay.classList.toggle('visible', detailVisible && !hasDetailLogo);
      detailLogoOverlay.classList.toggle('visible', detailVisible && hasDetailLogo);
      bioPanel.classList.toggle('visible', detailVisible);
      bioScrollbar.classList.toggle('visible', detailVisible);
      if (!detailVisible) bioScrollbar.classList.remove('tw-ready');
      // ── 3-D model viewer show/hide + load ──────────────────────────────────
      {
        const appFile   = (detailVisible && detailPlanetIdx >= 0 && projDetailIdx >= 0)
          ? (APPLICATIONS[detailPlanetIdx]?.files[projDetailIdx] ?? {})
          : {};
        const modelUrl  = appFile.model || '';
        const mvVisible = detailVisible && !!modelUrl;
        modelViewerEl.classList.toggle('mv-visible', mvVisible);
        modelViewerBg.classList.toggle('mv-visible', mvVisible);
        if (mvVisible) {
          _loadViewerModel(modelUrl);
          _startViewerLoop();
        } else {
          _stopViewerLoop();
        }
      }

      if (detailVisible && !prevDetailVisible) { startDetailTw(); if (detailPlanetIdx !== BLENDER_PLANET_IDX) _bgFadeTo(0, 1500); }
      if (!detailVisible && prevDetailVisible && dtTwInterval) { clearInterval(dtTwInterval); dtTwInterval = null; }
      if (!detailVisible && prevDetailVisible) {
        if (detailPlanetIdx !== BLENDER_PLANET_IDX) _bgFadeTo(BG_NORMAL_VOL, 2000);
        fileTreePanel.querySelectorAll('video').forEach(v => {
          if (v._audioFadeId) { clearTimeout(v._audioFadeId); v._audioFadeId = null; }
          if (v.muted || v.volume === 0) { v.pause(); return; }
          const step = 16; const dec = v.volume / (1000 / step);
          const fo = setInterval(() => {
            v.volume = Math.max(0, v.volume - dec);
            if (v.volume <= 0) { clearInterval(fo); v.pause(); v.muted = true; }
          }, step);
        });
      }
      prevDetailVisible = detailVisible;
      projBack.style.borderColor = '';
      projBack.style.color       = '';

      // ── HUD background opacity + color tint ───────────────────────────────
      hudBgEl.style.opacity = detailT.toFixed(3);
      // Compute hue of ecr and hue-rotate the base cyan (≈201°) to match planet
      {
        const emax = Math.max(ecr.r, ecr.g, ecr.b);
        const emin = Math.min(ecr.r, ecr.g, ecr.b);
        const ed   = emax - emin;
        let eHue = 0;
        if (ed > 0.001) {
          if (emax === ecr.r)      eHue = (((ecr.g - ecr.b) / ed) % 6 + 6) % 6 * 60;
          else if (emax === ecr.g) eHue = ((ecr.b - ecr.r) / ed + 2) * 60;
          else                     eHue = ((ecr.r - ecr.g) / ed + 4) * 60;
        }
        hudBgEl.style.filter = detailT > 0.01
          ? `hue-rotate(${(eHue - 201).toFixed(1)}deg)`
          : '';
      }
      renderer.setClearColor(0x000000, 1);

      // ── HUD: per-planet independent fade ─────────────────────────────────
      const HUD_CX = 140, HUD_CY = 140;
      for (let idx = 0; idx < PLANET_DATA.length; idx++) {
        const isHovered = effectiveHoveredIdx === idx && inYellow && detailT < 0.1;
        if (isHovered) {
          const hMesh = planetMeshes[idx].mesh;
          _hudProj.copy(hMesh.position).project(camera);
          menuEls[idx].style.left = `${( _hudProj.x * 0.5 + 0.5) * window.innerWidth}px`;
          menuEls[idx].style.top  = `${(-_hudProj.y * 0.5 + 0.5) * window.innerHeight}px`;
          hudHoverTimers[idx] += dt;
          if (hudHoverTimers[idx] >= 0.15) hudOpacities[idx] = Math.min(1, hudOpacities[idx] + dt / 0.25);
        } else {
          hudOpacities[idx] = Math.max(0, hudOpacities[idx] - dt / 0.1);
          if (hudOpacities[idx] > 0) {
            const fadeMesh = planetMeshes[idx].mesh;
            _hudProj.copy(fadeMesh.position).project(camera);
            menuEls[idx].style.left = `${( _hudProj.x * 0.5 + 0.5) * window.innerWidth}px`;
            menuEls[idx].style.top  = `${(-_hudProj.y * 0.5 + 0.5) * window.innerHeight}px`;
          } else {
            hudHoverTimers[idx] = 0;
          }
        }
        if (hudOpacities[idx] > 0) {
          const { outer, mid } = hudRings[idx];
          if (outer) {
            const deg = t * 22 + 28 * Math.sin(t * 0.55 + 0.5) + 18 * Math.sin(t * 1.05 + 2.1);
            outer.setAttribute('transform', `rotate(${deg.toFixed(2)},${HUD_CX},${HUD_CY})`);
          }
          if (mid) {
            const deg = -(t * 16 + 26 * Math.sin(t * 0.48 + 1.3) + 20 * Math.sin(t * 0.9 + 3.0));
            mid.setAttribute('transform', `rotate(${deg.toFixed(2)},${HUD_CX},${HUD_CY})`);
          }
        }
        menuEls[idx].style.opacity = hudOpacities[idx].toFixed(3);
      }

      // ── Particles ────────────────────────────────────────────────────
      // Wave amplitude fades as solarT increases
      const waveAmp = 1 - solarT;

      for (let i = 0; i < count; i++) {
        const wx = baseXZ[i*2];
        const wz = baseXZ[i*2+1];

        // ── Wave height ───────────────────────────────────────────────
        const rawWaveY = (
          Math.sin(wx * 0.18 + t * 0.45) * 1.4 +
          Math.sin(wz * 0.15 + t * 0.35) * 1.2 +
          Math.sin(wx * 0.22 + wz * 0.14 + t * 0.40) * 1.0 +
          Math.sin(wx * 0.28 - wz * 0.20 + t * 0.30) * 0.7
        ) * waveAmp;

        // ── Wave spring mouse reaction (active only when solarT < 0.5) ─
        if (solarT < 0.5) {
          const ddx = wx - mouseWorld.x;
          const ddz = wz - mouseWorld.z;
          const dd  = Math.sqrt(ddx * ddx + ddz * ddz);
          if (dd < WAVE_R) {
            const pp = 1 - dd / WAVE_R;
            springV[i] += pp * pp * WAVE_F;
          }
          springV[i] -= WAVE_SK * springY[i];
          springV[i] *= WAVE_D;
          springY[i] += springV[i];
          if (springY[i] >  WAVE_MAX) { springY[i] =  WAVE_MAX; springV[i] = 0; }
          if (springY[i] < -WAVE_MAX) { springY[i] = -WAVE_MAX; springV[i] = 0; }
        }

        const waveLocalY = rawWaveY + springY[i] * (1 - solarT);

        // ── Disc rings — fly to ring positions, spin CW/CCW, Y flattens ─
        const spinDir   = discRingIndex[i] === 0 ? 1 : -1; // even=CW, odd=CCW
        const spinAngle = discBaseAngle[i] + spinDir * t * 0.08 * (1 - detailT);
        const spinX     = SUN_WORLD.x + discRingRadius[i] * Math.cos(spinAngle);
        const spinZ     = SUN_WORLD.z + discRingRadius[i] * Math.sin(spinAngle);
        const discX = lerp(wx,         spinX,        solarT);
        const discY = lerp(waveLocalY, DISC_LOCAL_Y, solarT);
        const discZ = lerp(wz,         spinZ,        solarT);

        // ── Sphere — all particles map to sphere, wrapping via modulo ────────
        let finalX = discX, finalY = discY, finalZ = discZ;
        let excessFade = 1; // used by color section below
        if (detailT > 0) {
          const si       = i % SPHERE_DOT_COUNT;
          const isExcess = i >= SPHERE_DOT_COUNT;
          const effAngle = sphereAngle + spinOffset;
          const cS = Math.cos(effAngle), sS = Math.sin(effAngle);
          const cP = Math.cos(spherePitch),  sP = Math.sin(spherePitch);
          // Pitch axis = camera right vector: (cos(camTheta), 0, -sin(camTheta))
          const paX = Math.cos(camTheta), paZ = -Math.sin(camTheta);
          const sphCX = detailPlanetPos.x;
          const sphCY = detailPlanetPos.y + POINTS_Y_OFFSET;
          const sphCZ = detailPlanetPos.z;
          // Y-axis rotation (yaw)
          const ry_x = sphNX[si] * cS + sphNZ[si] * sS;
          const ry_y = sphNY[si];
          const ry_z = sphNZ[si] * cS - sphNX[si] * sS;
          // Pitch around camera-right axis via Rodrigues (axY=0 simplifies cross product)
          const pdot = ry_x * paX + ry_z * paZ;
          const crX  = -paZ * ry_y;
          const crY  =  paZ * ry_x - paX * ry_z;
          const crZ  =  paX * ry_y;
          // Snappy float out, damped spring wobble back
          let dotPulse = 0;
          if (spherePulseT >= 0) {
            const peak = 0.22;
            if (spherePulseT < peak) {
              dotPulse = 1 - Math.pow(1 - spherePulseT / peak, 3.2);
            } else {
              const n = (spherePulseT - peak) / (1.0 - peak);
              dotPulse = Math.cos(n * Math.PI * 3.5) * Math.exp(-n * 4.0) * (1 - n * n);
            }
          }
          const breath = sphBreathAmp[si] * Math.sin(t * sphBreathFreq[si] * Math.PI * 2 + sphBreathPhase[si]) * detailT;
          const _sphR = SPHERE_R * (1 + breath + sphPulseAmp[si] * dotPulse);
          const sphX = sphCX + _sphR * (ry_x * cP + crX * sP + paX * pdot * (1 - cP));
          const sphY = sphCY + _sphR * (ry_y * cP + crY * sP);
          const sphZ = sphCZ + _sphR * (ry_z * cP + crZ * sP + paZ * pdot * (1 - cP));
          if (isExcess) {
            // Excess dots move in slower — delayed + eased
            const moveT = Math.pow(Math.max(0, (detailT - 0.12) / 0.88), 1.8);
            finalX = lerp(discX, sphX, moveT);
            finalY = lerp(discY, sphY, moveT);
            finalZ = lerp(discZ, sphZ, moveT);
            // Sporadic fade — each particle gets a unique random threshold
            const rnd       = ((i * 2654435761) >>> 0) / 4294967296;
            const fadeStart = 0.15 + rnd * 0.5; // fades begin anywhere between 15%-65% open
            excessFade = Math.max(0, 1 - Math.max(0, (detailT - fadeStart) / 0.25));
          } else {
            finalX = lerp(discX, sphX, detailT);
            finalY = lerp(discY, sphY, detailT);
            finalZ = lerp(discZ, sphZ, detailT);
          }
        }

        posAttr.array[i*3]   = finalX;
        posAttr.array[i*3+1] = finalY;
        posAttr.array[i*3+2] = finalZ;

        // ── Color ─────────────────────────────────────────────────────
        const norm   = Math.max(0, Math.min(1, (waveLocalY + 6) / 12));
        const _dp    = (typeof dotPulse !== 'undefined') ? dotPulse : 0;
        const bright = (0.20 + Math.pow(norm, 1.0) * 0.80) * (1 + _dp * 0.7);
        const whites = Math.pow(norm, 0.8) * 0.45;
        // Alternate rings pulse in/out during solar mode
        const ringPulse = Math.sin(t * 1.8) * 0.5 + 0.5; // 0–1
        const isOdd     = discRingIndex[i];
        const ringDim   = solarT > 0
          ? lerp(1, isOdd ? ringPulse : (1 - ringPulse), solarT)
          : 1;
        colAttr.array[i*3]   = bright * ringDim * excessFade * (ecr.r * (1 - whites) + whites);
        colAttr.array[i*3+1] = bright * ringDim * excessFade * (ecr.g * (1 - whites) + whites);
        colAttr.array[i*3+2] = bright * excessFade * (ecr.b * (1 - whites) + whites);
      }

      if (spherePulseT >= 0) { spherePulseT = Math.min(1.0, spherePulseT + dt / 2.8); if (spherePulseT >= 1.0) spherePulseT = -1; }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel',   onWheelZoom);
      projPanel.removeEventListener('wheel', onProjWheel, { capture: true });
      canvas.removeEventListener('wheel', onProjWheel, { capture: false });
      window.removeEventListener('keydown', onKeyDown);
      viewportMeta.content = prevViewport;
      window.removeEventListener('mousedown', onMouseDown);
      menuEls.forEach(el => document.body.removeChild(el));
      document.body.removeChild(dvBack);
      document.body.removeChild(projBack);
      document.body.removeChild(dvPlanet);
      _stopMatrixLabels();
      dvPins.forEach(el => document.body.removeChild(el));
      document.head.removeChild(bgStyle);
      document.head.removeChild(fontLink);
      document.head.removeChild(hudStyle);
      document.head.removeChild(detailStyle);
      document.head.removeChild(sidebarStyle);
      document.body.removeChild(sidebarEl);
      document.head.removeChild(kbHintStyle);
      document.body.removeChild(kbHints);
      document.body.removeChild(kbPlanetHints);
      document.head.removeChild(projPanelStyle);
      document.body.removeChild(projPanel);
      document.body.removeChild(projDotsEl);

      document.head.removeChild(blenderGridStyle);
      document.body.removeChild(blenderGridPanel);
      document.head.removeChild(planetLoaderStyle);
      document.body.removeChild(planetLoaderEl);
      document.body.removeChild(plScreenRipple);
      document.head.removeChild(iconPanelStyle);
      document.body.removeChild(iconPanel);
      document.head.removeChild(fileTreeStyle);
      document.body.removeChild(fileTreePanel);
      document.head.removeChild(hudBgStyle);
      document.body.removeChild(hudBgEl);
      document.body.removeChild(projTitleDisplay);
      document.head.removeChild(bioPanelStyle);
      document.body.removeChild(bioPanel);
      document.body.removeChild(bioScrollbar);
      _stopViewerLoop();
      if (_viewerIdleTimer) clearTimeout(_viewerIdleTimer);
      viewerRenderer.dispose();
      viewerControls.dispose();
      if (viewerModelRoot) viewerScene.remove(viewerModelRoot);
      document.head.removeChild(modelViewerStyle);
      document.body.removeChild(modelViewerEl);
      document.body.removeChild(modelViewerBg);
      document.head.removeChild(detailLogoStyle);
      document.body.removeChild(detailLogoOverlay);

      // Dispose galaxy starfield
      starGeo.dispose(); starMat.dispose(); starTex.dispose();
      _nebGeo.dispose(); _nebMat.dispose();

      // Dispose solar objects
      sunGeo.dispose();
      sunMat.dispose();
      sunGlowGeo.dispose();
      sunGlowMesh.material.dispose();
      coronaSpriteMat.dispose();
      coronaTex.dispose();

      orbitRings.forEach(r => { r.geometry.dispose(); r.material.dispose(); });
      planetSprites.forEach(({ bodySprite, glowSprite, bodyTex, glowTex }) => {
        bodySprite.material.dispose(); bodyTex.dispose();
        glowSprite.material.dispose(); glowTex.dispose();
      });
      planetMeshes.forEach(({ mesh, glowMesh, hitMesh }) => {
        mesh.geometry.dispose();
        if (mesh.material.map)     mesh.material.map.dispose();
        if (mesh.material.bumpMap) mesh.material.bumpMap.dispose();
        mesh.material.dispose();
        glowMesh.geometry.dispose();
        glowMesh.material.dispose();
        hitMesh.geometry.dispose();
        hitMesh.material.dispose();
      });

      renderer.dispose();
      geometry.dispose();
      material.dispose();
      dotTex.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} tabIndex={-1} style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      display: 'block', zIndex: 0,
      outline: 'none',
    }} />
  );
}
