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
  // filenames like ezgif-frame-027.jpg
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

export default function ScrollFrameSequence({
  className = "",
  pinHeightVh = 180, // scroll distance while pinned
}) {
  const containerRef = useRef(null);
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
    // Vite: eager import image URLs at build-time.
    const urls = Object.entries(FRAME_MODULES)
      .map(([p, url]) => ({ p, url }))
      .sort((x, y) => sortFramePaths(x.p, y.p))
      .map((x) => x.url);
    return urls;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (prefersReducedMotion) {
        setReady(true);
        return;
      }
      const urls = frameUrls;
      if (!urls.length) {
        setReady(true);
        return;
      }

      // Preload all frames to prevent flicker.
      const imgs = new Array(urls.length);
      const decodePromises = urls.map((src, i) => {
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

      // Make first frame available ASAP (helps perceived perf).
      await Promise.race(decodePromises);
      if (cancelled) return;
      imagesRef.current = imgs;

      // Continue decoding rest in background.
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
    if (!containerRef.current || !canvasRef.current) return;
    if (!frameUrls.length) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // redraw current frame after resize
      const frame = Math.max(0, lastFrameRef.current);
      drawFrame(frame);
    };

    const drawFrame = (frameIdx) => {
      const imgs = imagesRef.current;
      const img = imgs[frameIdx] || imgs[0];
      if (!img) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      drawCover(ctx, img, w, h);
      ctx.restore();
    };

    // Initial paint (first frame)
    lastFrameRef.current = 0;
    drawFrame(0);
    resize();

    const state = { frame: 0 };
    const total = frameUrls.length;
    const scrollDistance = Math.max(800, (pinHeightVh / 100) * window.innerHeight);

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: `+=${scrollDistance}`,
      scrub: 0.35,
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const next = Math.min(total - 1, Math.max(0, Math.round(self.progress * (total - 1))));
        if (next === lastFrameRef.current) return;
        state.frame = next;
        lastFrameRef.current = next;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(state.frame));
      },
    });

    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      trigger?.kill?.();
    };
  }, [ready, prefersReducedMotion, frameUrls.length, pinHeightVh, frameUrls]);

  const firstFrameUrl = frameUrls[0] || "";

  return (
    <section ref={containerRef} className={`relative ${className}`}>
      <div className="relative h-[min(92vh,52rem)] w-full overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface-container shadow-ambient">
        {/* Canvas sequence */}
        {!prefersReducedMotion ? (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <img src={firstFrameUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface/0 via-surface/0 to-surface/65" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <p className="text-xs font-semibold text-on-primary-fixed/90">Scroll to preview</p>
          <p className="mt-2 max-w-xl text-sm text-on-primary-fixed/90">
            A frame-by-frame walkthrough that reacts to scroll speed. Images are preloaded to keep it smooth.
          </p>
        </div>

        {!ready && !prefersReducedMotion ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
            <div className="rounded-full border border-outline-variant/40 bg-surface px-4 py-2 text-xs font-semibold text-on-surface-variant">
              Loading…
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

