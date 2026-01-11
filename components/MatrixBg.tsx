"use client";

import * as React from "react";

export function MatrixBg() {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    // Config (tweak safely)
    const fontSize = 14;           // glyph size
    const speedMin = 0.6;          // slower
    const speedMax = 1.6;          // faster
    const density = 0.95;          // higher => more glyphs
    const glyphs = "01ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ∑+-*/<>#$";

    const state = {
      w: 0,
      h: 0,
      cols: 0,
      drops: [] as number[],
      speeds: [] as number[],
    };

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      state.w = w;
      state.h = h;
      state.cols = Math.ceil(w / fontSize);

      state.drops = new Array(state.cols).fill(0).map(() => Math.random() * h);
      state.speeds = new Array(state.cols)
        .fill(0)
        .map(() => speedMin + Math.random() * (speedMax - speedMin));
    };

    resize();
    window.addEventListener("resize", resize);

    const step = () => {
      // Transparent black to create trail fade
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, state.w, state.h);

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

      for (let i = 0; i < state.cols; i++) {
        const x = i * fontSize;
        const y = state.drops[i];

        // Random glyph
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];

        // Bright head + dim trail effect
        const head = Math.random() > 0.85;
        ctx.fillStyle = head ? "rgba(125, 255, 178, 0.95)" : "rgba(92, 255, 128, 0.55)";
        ctx.fillText(ch, x, y);

        // Move down
        state.drops[i] += state.speeds[i] * fontSize * density;

        // Reset drop
        if (state.drops[i] > state.h + 50 && Math.random() > 0.975) {
          state.drops[i] = -Math.random() * 200;
          state.speeds[i] = speedMin + Math.random() * (speedMax - speedMin);
        }
      }

      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,          // behind everything
        pointerEvents: "none",
        opacity: 0.22,      // subtle so UI stays readable
      }}
    />
  );
}
