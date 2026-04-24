import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Vite requires glob patterns to be literals.
const FRAME_MODULES = import.meta.glob("../scroll-animation/*.{png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

function sortFramePaths(a, b) {
  const na = Number(String(a).match(/(\d+)(?=\.\w+$)/)?.[1] || 0);
  const nb = Number(String(b).match(/(\d+)(?=\.\w+$)/)?.[1] || 0);
  return na - nb;
}

function drawCover(ctx, img, cw, ch) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

/**
 * Full-viewport scroll-driven frame sequence background.
 * - Fixed canvas behind content
 * - ScrollTrigger binds progress to frame index (no pin; the page scrolls normally)
 * - Frames preloaded/decoded to avoid flicker
 */
export default function ScrollFrameBackground({ triggerRef, scrub = 0.35 }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const imagesRef = useRef([]);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(-1);
  const [ready, setReady] = useState(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  }, []);

  const frameUrls = useMemo(() => {
    return Object.entries(FRAME_MODULES)
      .map(([p, url]) => ({ p, url }))
      .sort((x, y) => sortFramePaths(x.p, y.p))
      .map((x) => x.url);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (prefersReducedMotion) {
        setReady(true);
        return;
      }
      if (!frameUrls.length) {
        setReady(true);
        return;
      }

      const imgs = new Array(frameUrls.length);
      const decodePromises = frameUrls.map((src, i) => {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.src = src;
        imgs[i] = img;
        const p =
          img.decode?.().catch(() => {}) ||
          new Promise((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          });
        return p;
      });

      await Promise.race(decodePromises);
      if (cancelled) return;
      imagesRef.current = imgs;
      Promise.allSettled(decodePromises).then(() => {});
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [frameUrls, prefersReducedMotion]);

  useLayoutEffect(() => {
    if (!ready) return;
    if (prefersReducedMotion) return;
    if (!canvasRef.current) return;
    if (!frameUrls.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    ctxRef.current = ctx;

    const drawFrame = (frameIdx) => {
      const imgs = imagesRef.current;
      const img = imgs[frameIdx] || imgs[0];
      if (!img) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      drawCover(ctx, img, w, h);
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame = Math.max(0, lastFrameRef.current);
      drawFrame(frame);
    };

    lastFrameRef.current = 0;
    resize();
    drawFrame(0);

    const total = frameUrls.length;
    const triggerEl = triggerRef?.current || document.documentElement;

    const st = ScrollTrigger.create({
      trigger: triggerEl,
      start: "top top",
      end: "bottom bottom",
      scrub,
      onUpdate: (self) => {
        const next = Math.min(total - 1, Math.max(0, Math.round(self.progress * (total - 1))));
        if (next === lastFrameRef.current) return;
        lastFrameRef.current = next;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(next));
      },
    });

    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      st?.kill?.();
    };
  }, [ready, prefersReducedMotion, frameUrls, scrub, triggerRef]);

  const first = frameUrls[0] || "";

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {!prefersReducedMotion ? (
        <canvas ref={canvasRef} className="h-full w-full" />
      ) : (
        <img src={first} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-surface-container-lowest/40 via-surface-container-lowest/70 to-surface-container-lowest/95" />
    </div>
  );
}

