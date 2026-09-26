"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "0101010110AB3F".split("");

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
    if (!isFinePointer) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    document.body.classList.add("custom-cursor-active");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = 0;
    let lastTrail = 0;
    let lastGlyph = 0;

    const spawn = (className: string, x: number, y: number, content?: string) => {
      const el = document.createElement(content ? "span" : "div");
      el.className = className;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      if (content) el.textContent = content;
      layerRef.current?.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (reduceMotion) return;

      const now = performance.now();
      if (now - lastTrail > 40) {
        lastTrail = now;
        spawn("cursor-trail-dot", mouseX, mouseY);
      }
      if (now - lastGlyph > 550 + Math.random() * 500) {
        lastGlyph = now;
        spawn(
          "cursor-glyph",
          mouseX + (Math.random() - 0.5) * 40,
          mouseY - 10,
          GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        );
      }
    };

    const onDown = (e: MouseEvent) => {
      spawn("cursor-ripple", e.clientX, e.clientY);
    };

    const tick = () => {
      dotX += (mouseX - dotX) * 0.35;
      dotY += (mouseY - dotY) * 0.35;
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    rafId = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={layerRef} className="cursor-layer" aria-hidden="true">
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}