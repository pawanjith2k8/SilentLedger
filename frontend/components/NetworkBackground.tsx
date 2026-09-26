"use client";

import { useEffect, useRef } from "react";

const NODE_COUNT = 26;
const MAX_LINK_DIST = 140;
const GLYPHS = "01010101010101AF39E0".split("");

type Node = { x: number; y: number; vx: number; vy: number };
type Pulse = { from: Node; to: Node; t: number };

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glyphLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glyphLayer = glyphLayerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let rafId = 0;
    let running = false;
    let lastPulseSpawn = 0;
    let glyphInterval: ReturnType<typeof setInterval> | undefined;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initNodes() {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
      }));
    }

    function step(time: number) {
  ctx!.clearRect(0, 0, width, height);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      ctx!.lineWidth = 1;

for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i];
    const b = nodes[j];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);

    if (dist < MAX_LINK_DIST) {
      const alpha = (1 - dist / MAX_LINK_DIST) * 0.28;
      ctx!.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(b.x, b.y);
      ctx!.stroke();
    }
  }
}

for (const n of nodes) {
  ctx!.fillStyle = "rgba(34, 211, 238, 0.75)";
  ctx!.beginPath();
  ctx!.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
  ctx!.fill();
}


      if (time - lastPulseSpawn > 2600 + Math.random() * 2200) {
        lastPulseSpawn = time;
        const from = nodes[Math.floor(Math.random() * nodes.length)];
        let to = nodes[Math.floor(Math.random() * nodes.length)];
        let tries = 0;
        while (to === from && tries < 5) {
          to = nodes[Math.floor(Math.random() * nodes.length)];
          tries++;
        }
        pulses.push({ from, to, t: 0 });
      }

      pulses = pulses.filter((p) => p.t <= 1);
      for (const p of pulses) {
        p.t += 0.012;
        const px = p.from.x + (p.to.x - p.from.x) * p.t;
        const py = p.from.y + (p.to.y - p.from.y) * p.t;
        const fade = Math.sin(Math.PI * p.t);
        ctx!.fillStyle = `rgba(247, 147, 26, ${0.4 * fade})`;
        ctx!.beginPath();
        ctx!.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (running) {
  rafId = requestAnimationFrame(step);
}

    }

    function spawnGlyph() {
      if (!glyphLayer) return;
      const el = document.createElement("span");
      el.className = "bg-glyph";
      el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      glyphLayer.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    }

    function onVisibility() {
      const shouldRun = document.visibilityState === "visible" && !reduceMotion;
      if (shouldRun && !running) {
        running = true;
        rafId = requestAnimationFrame(step);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    }

    resize();
    initNodes();

    if (!reduceMotion) {
      running = true;
      rafId = requestAnimationFrame(step);
      glyphInterval = setInterval(spawnGlyph, 2200);
    } else {
      running = false;
      step(0); // single static frame
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (glyphInterval) clearInterval(glyphInterval);
    };
  }, []);

  return (
    <div className="app-background" aria-hidden="true">
      <div className="bg-grid bg-grid--far" />
      <div className="bg-grid bg-grid--near" />
      <canvas ref={canvasRef} className="bg-network-canvas" />
      <div ref={glyphLayerRef} className="bg-glyph-layer" />
      <div className="bg-scanline" />
    </div>
  );
}