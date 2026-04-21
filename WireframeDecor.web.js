import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ── Flowing ribbon line art ───────────────────────────────────────────────────
export function WireFlow({ w = 280, h = 160, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const N       = 20;          // number of ribbon lines
    const spreadH = h * 0.78;   // total vertical spread at edges
    const waveAmp = h * 0.055;  // wave height
    const STEPS   = 140;

    let t = 0, raf;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.014;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < N; i++) {
        const frac  = i / (N - 1);          // 0 → 1
        const alpha = 0.18 + frac * 0.42;   // vary opacity across ribbon

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth   = 0.8;
        ctx.beginPath();

        for (let s = 0; s <= STEPS; s++) {
          const xn = s / STEPS;
          const x  = xn * w;

          // Twist: each line crosses from one vertical position to the inverse
          const startY = (frac - 0.5) * spreadH;
          const endY   = ((1 - frac) - 0.5) * spreadH;  // inverted → ribbon crosses itself

          // Smooth S-curve ease between start and end
          const ease  = (1 - Math.cos(xn * Math.PI)) / 2;
          const baseY = startY * (1 - ease) + endY * ease;

          // Layered sine waves for flowing motion
          const wave =
            Math.sin(xn * Math.PI * 2.6 + t        + frac * 1.8) * waveAmp +
            Math.sin(xn * Math.PI * 5.2 - t * 0.55 + frac * 0.9) * waveAmp * 0.28;

          const y = h / 2 + baseY + wave;

          if (s === 0) ctx.moveTo(x, y);
          else         ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [w, h]);

  return <canvas ref={ref} style={{ display:'block', width:w, height:h, maxWidth:'100%', maxHeight:'100%', aspectRatio:`${w}/${h}`, ...style }} />;
}

// ── Rotating wireframe icosphere ──────────────────────────────────────────────
export function WireSphere({ size = 180, opacity = 0.28, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 2.8;

    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true,
      opacity, transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      mesh.rotation.x += 0.003;
      mesh.rotation.y += 0.006;
      renderer.render(scene, cam);
    };
    tick();

    return () => { cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); };
  }, [size, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:size, height:size, maxWidth:'100%', maxHeight:'100%', aspectRatio:'1', objectFit:'contain', ...style }} />;
}

// ── Animated terrain / landscape ──────────────────────────────────────────────
export function WireTerrain({ w = 300, h = 140, opacity = 0.22, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    cam.position.set(0, 3, 6);
    cam.lookAt(0, 0, 0);

    const SEGS = 30;
    const geo  = new THREE.PlaneGeometry(8, 5, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2.5);
    const mat  = new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true,
      opacity, transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const pos  = geo.attributes.position;
    const baseY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) baseY[i] = pos.getY(i);

    let t = 0, raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.018;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, baseY[i] + Math.sin(x * 1.2 + t) * 0.38 + Math.sin(z * 1.9 + t * 0.55) * 0.22);
      }
      pos.needsUpdate = true;
      renderer.render(scene, cam);
    };
    tick();

    return () => { cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); };
  }, [w, h, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:w, height:h, maxWidth:'100%', maxHeight:'100%', aspectRatio:`${w}/${h}`, ...style }} />;
}

// ── Dual rotating wireframe cubes ─────────────────────────────────────────────
export function WireBox({ size = 130, opacity = 0.28, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 2.6;

    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity, transparent: true });

    const outer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), mat.clone());
    inner.rotation.set(0.5, 0.5, 0.3);
    scene.add(outer, inner);

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      outer.rotation.x += 0.004;
      outer.rotation.y += 0.007;
      inner.rotation.x -= 0.005;
      inner.rotation.y -= 0.009;
      renderer.render(scene, cam);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      outer.geometry.dispose(); inner.geometry.dispose();
      mat.dispose(); renderer.dispose();
    };
  }, [size, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:size, height:size, maxWidth:'100%', maxHeight:'100%', aspectRatio:'1', objectFit:'contain', ...style }} />;
}

// ── Tall wireframe cylinder ───────────────────────────────────────────────────
export function WireCylinder({ w = 90, h = 190, opacity = 0.26, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.set(0, 0, 3.8);

    const geo = new THREE.CylinderGeometry(0.55, 0.55, 2.4, 18, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      mesh.rotation.x += 0.003;
      mesh.rotation.y += 0.009;
      renderer.render(scene, cam);
    };
    tick();

    return () => { cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); };
  }, [w, h, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:w, height:h, maxWidth:'100%', maxHeight:'100%', aspectRatio:`${w}/${h}`, ...style }} />;
}

// ── Flow ribbon that stretches to fill its container ─────────────────────────
export function WireFlowFill({ h = 160, style = {} }) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const [drawW, setDrawW] = useState(200);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setDrawW(Math.floor(el.offsetWidth) || 200);
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || drawW < 4) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width  = drawW * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const N = 20, spreadH = h * 0.78, waveAmp = h * 0.055, STEPS = 160;
    let t = 0, raf;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.014;
      ctx.clearRect(0, 0, drawW, h);
      for (let i = 0; i < N; i++) {
        const frac = i / (N - 1);
        ctx.strokeStyle = `rgba(255,255,255,${0.18 + frac * 0.42})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let s = 0; s <= STEPS; s++) {
          const xn   = s / STEPS;
          const x    = xn * drawW;
          const ease = (1 - Math.cos(xn * Math.PI)) / 2;
          const baseY = ((frac - 0.5) * spreadH) * (1 - ease) + (((1 - frac) - 0.5) * spreadH) * ease;
          const wave  = Math.sin(xn * Math.PI * 2.6 + t + frac * 1.8) * waveAmp
                      + Math.sin(xn * Math.PI * 5.2 - t * 0.55 + frac * 0.9) * waveAmp * 0.28;
          const y = h / 2 + baseY + wave;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [drawW, h]);

  return (
    <div ref={wrapRef} style={{ width:'100%', height:h, overflow:'hidden', display:'block', ...style }}>
      <canvas ref={canvasRef} style={{ display:'block', width:drawW, height:h }} />
    </div>
  );
}

// ── DNA double helix (depth-ordered 3-layer render) ──────────────────────────
export function WireDNA({ w = 110, h = 360, opacity = 0.3, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx     = w / 2;
    const amp    = w * 0.44;     // wider spread = thicc helix
    const CYCLES = 6;
    const freq   = (CYCLES * 2 * Math.PI) / h;
    const STEPS  = 400;
    const RUNGS  = CYCLES * 10;

    let t = 0, raf;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.014;
      ctx.clearRect(0, 0, w, h);

      // Layer 1: ghost both strands (back layer, thin + faint)
      for (let strand = 0; strand < 2; strand++) {
        const phase = strand * Math.PI;
        ctx.beginPath();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.28})`;
        for (let i = 0; i <= STEPS; i++) {
          const y = (i / STEPS) * h;
          const x = cx + Math.sin(freq * y + t + phase) * amp;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Layer 2: rungs + node dots (depth-based opacity)
      for (let r = 0; r <= RUNGS; r++) {
        const y   = (r / RUNGS) * h;
        const ang = freq * y + t;
        const x1  = cx + Math.sin(ang) * amp;
        const x2  = cx + Math.sin(ang + Math.PI) * amp;
        const dep = (Math.cos(ang) + 1) / 2;  // 0=back, 1=front

        ctx.beginPath();
        ctx.moveTo(x1, y); ctx.lineTo(x2, y);
        ctx.strokeStyle = `rgba(255,255,255,${opacity * (0.22 + dep * 0.6)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        [[x1, dep], [x2, 1 - dep]].forEach(([x, d]) => {
          ctx.beginPath();
          ctx.arc(x, y, 3.0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${opacity * (0.45 + d * 0.55)})`;
          ctx.fill();
        });
      }

      // Layer 3: front-facing segments only (bright + thick)
      for (let strand = 0; strand < 2; strand++) {
        const phase = strand * Math.PI;
        for (let i = 0; i < STEPS; i++) {
          const ya   = (i / STEPS) * h;
          const yb   = ((i + 1) / STEPS) * h;
          const dep  = Math.cos(freq * ((ya + yb) / 2) + t + phase);
          if (dep <= 0) continue;
          const xa = cx + Math.sin(freq * ya + t + phase) * amp;
          const xb = cx + Math.sin(freq * yb + t + phase) * amp;
          ctx.beginPath();
          ctx.moveTo(xa, ya); ctx.lineTo(xb, yb);
          ctx.strokeStyle = `rgba(255,255,255,${opacity * (0.65 + dep * 0.35)})`;
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [w, h, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:w, height:h, maxWidth:'100%', maxHeight:'100%', aspectRatio:`${w}/${h}`, ...style }} />;
}

// ── Rotating wireframe torus ──────────────────────────────────────────────────
export function WireTorus({ size = 120, opacity = 0.24, style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 3;

    const geo = new THREE.TorusGeometry(0.8, 0.28, 14, 36);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      mesh.rotation.x += 0.005;
      mesh.rotation.y += 0.008;
      renderer.render(scene, cam);
    };
    tick();

    return () => { cancelAnimationFrame(raf); geo.dispose(); mat.dispose(); renderer.dispose(); };
  }, [size, opacity]);

  return <canvas ref={ref} style={{ display:'block', width:size, height:size, maxWidth:'100%', maxHeight:'100%', aspectRatio:'1', objectFit:'contain', ...style }} />;
}
