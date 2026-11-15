"use client";

import { useEffect, useRef } from "react";
import type { Agent } from "@/data/agents";
import { drawAvatarPortrait } from "@/components/office/pixel-sprites";

interface AgentPortraitProps {
  agent: Agent;
  size?: number;
  className?: string;
}

export default function AgentPortrait({ agent, size = 104, className }: AgentPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 64;
    canvas.height = 64;
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    const startedAt = performance.now();
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 80 || document.hidden) return;
      last = now;
      drawAvatarPortrait(ctx, agent, now - startedAt, 64);
    };

    drawAvatarPortrait(ctx, agent, 0, 64);
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [agent]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className={className}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
      aria-label={`صورة رمزية لـ${agent.nameAr}`}
      role="img"
    />
  );
}
