"use client";

import { useEffect, useRef } from "react";
import type { Agent, FurnitureStyle } from "@/data/agents";
import { drawAvatarPortrait } from "@/components/office/pixel-sprites";

interface AgentPortraitProps {
  agent: Agent;
  furnitureStyle?: FurnitureStyle;
  size?: number;
  className?: string;
}

const PORTRAIT_SCALE = 2;
const PORTRAIT_LOGICAL = 64;

export default function AgentPortrait({
  agent,
  furnitureStyle,
  size = 104,
  className,
}: AgentPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = PORTRAIT_LOGICAL * PORTRAIT_SCALE;
    canvas.height = PORTRAIT_LOGICAL * PORTRAIT_SCALE;
    ctx.setTransform(PORTRAIT_SCALE, 0, 0, PORTRAIT_SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    const startedAt = performance.now();
    let last = 0;

    const renderFrame = (time: number) => {
      ctx.setTransform(PORTRAIT_SCALE, 0, 0, PORTRAIT_SCALE, 0, 0);
      ctx.imageSmoothingEnabled = false;
      drawAvatarPortrait(ctx, agent, time, PORTRAIT_LOGICAL, furnitureStyle);
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 80 || document.hidden) return;
      last = now;
      renderFrame(now - startedAt);
    };

    renderFrame(0);
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [agent, furnitureStyle]);

  return (
    <canvas
      ref={canvasRef}
      width={PORTRAIT_LOGICAL * PORTRAIT_SCALE}
      height={PORTRAIT_LOGICAL * PORTRAIT_SCALE}
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
