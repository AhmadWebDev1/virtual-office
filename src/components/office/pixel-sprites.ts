import type { Agent, RoomId } from "@/data/agents";

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

const OUTLINE = "#201814";

interface RoomScenePalette {
  wall: string;
  light: string;
  accent: string;
  floor: string;
}

const PORTRAIT_BACKGROUNDS: Record<RoomId, RoomScenePalette> = {
  gm: { wall: "#244740", light: "#e0b364", accent: "#f0d49a", floor: "#6f4a2f" },
  email: { wall: "#2f5e5b", light: "#8ad5cb", accent: "#e8f3e7", floor: "#795132" },
  finance: { wall: "#48583c", light: "#b9ce93", accent: "#f2e2b4", floor: "#584b39" },
  creative: { wall: "#6c3f32", light: "#e9976e", accent: "#ffd8ad", floor: "#8a5237" },
};

function drawChair(ctx: Ctx, x: number, y: number, accent: string) {
  // Office chair, viewed from above, behind the seated agent.
  px(ctx, x - 10, y - 31, 20, 22, OUTLINE);
  px(ctx, x - 8, y - 29, 16, 18, "#2f413d");
  px(ctx, x - 7, y - 28, 14, 4, "#3c534d");
  px(ctx, x - 8, y - 12, 16, 10, "#263733");
  px(ctx, x - 10, y - 18, 3, 10, "#1c2926");
  px(ctx, x + 7, y - 18, 3, 10, "#1c2926");
  px(ctx, x - 8, y - 3, 16, 3, OUTLINE);
  px(ctx, x - 6, y - 12, 3, 2, accent);
}

function drawHair(
  ctx: Ctx,
  agent: Agent,
  headX: number,
  headY: number,
  faceTop: number,
) {
  const { avatar } = agent;
  const hair = avatar.hair;
  const shadow = avatar.hairShadow;

  if (avatar.style === "long") {
    px(ctx, headX - 1, faceTop + 1, 14, 13, shadow);
    px(ctx, headX, faceTop, 12, 8, hair);
    px(ctx, headX - 2, faceTop + 4, 3, 11, hair);
    px(ctx, headX + 11, faceTop + 4, 3, 11, hair);
    px(ctx, headX - 2, faceTop + 13, 2, 3, shadow);
    px(ctx, headX + 12, faceTop + 13, 2, 3, shadow);
    px(ctx, headX + 1, faceTop - 1, 8, 2, hair);
  } else if (avatar.style === "curly") {
    px(ctx, headX - 2, faceTop + 2, 14, 7, shadow);
    px(ctx, headX - 2, faceTop - 1, 4, 4, hair);
    px(ctx, headX + 2, faceTop - 2, 4, 3, hair);
    px(ctx, headX + 7, faceTop - 1, 5, 4, hair);
    px(ctx, headX + 11, faceTop + 3, 3, 4, hair);
    px(ctx, headX - 3, faceTop + 4, 3, 4, hair);
    px(ctx, headX + 1, faceTop + 1, 8, 3, hair);
  } else if (avatar.style === "bun") {
    px(ctx, headX + 3, faceTop - 6, 7, 5, shadow);
    px(ctx, headX + 4, faceTop - 7, 5, 4, hair);
    px(ctx, headX, faceTop, 12, 7, hair);
    px(ctx, headX - 1, faceTop + 5, 2, 8, shadow);
    px(ctx, headX + 11, faceTop + 5, 2, 8, shadow);
  } else {
    px(ctx, headX, faceTop - 1, 12, 7, hair);
    px(ctx, headX - 1, faceTop + 3, 3, 5, hair);
    px(ctx, headX + 10, faceTop + 3, 3, 5, shadow);
    px(ctx, headX + 2, faceTop - 1, 6, 2, shadow);
  }
}

export function drawAgentSprite(ctx: Ctx, agent: Agent, time: number) {
  const { x, y } = agent.position;
  const { avatar } = agent;
  const seed = x * 0.13 + y * 0.07;
  const working = agent.status === "working";
  const bob = working
    ? Math.round(Math.sin(time / 260 + seed) * 0.6)
    : Math.round(Math.sin(time / 950 + seed) * 0.9);
  const typing = working && Math.floor(time / 190) % 2 === 0;
  const blink = Math.floor((time / 1000 + seed) % 4.4) < 0.13;

  ctx.save();
  drawChair(ctx, x, y, avatar.accent);

  // Soft pixel shadow around the chair.
  ctx.globalAlpha = 0.18;
  px(ctx, x - 12, y + 1, 24, 3, "#000000");
  ctx.globalAlpha = 1;

  // Legs / feet under the chair, mostly hidden.
  px(ctx, x - 5, y - 8, 3, 8, avatar.shirtShadow);
  px(ctx, x + 3, y - 8, 3, 8, avatar.shirtShadow);

  // Torso.
  const bodyY = y - 19 + bob;
  px(ctx, x - 8, bodyY, 16, 15, OUTLINE);
  px(ctx, x - 7, bodyY + 1, 14, 13, avatar.shirt);
  px(ctx, x - 7, bodyY + 10, 14, 4, avatar.shirtShadow);
  px(ctx, x - 2, bodyY + 1, 4, 2, avatar.accent);
  px(ctx, x - 1, bodyY + 5, 2, 5, avatar.accent);
  px(ctx, x - 7, bodyY + 1, 2, 9, avatar.shirt);
  px(ctx, x + 6, bodyY + 1, 2, 9, avatar.shirtShadow);

  // Neck.
  px(ctx, x - 2, bodyY - 3, 5, 4, avatar.skinShadow);

  // Left arm.
  const leftArmY = bodyY + 4 + (typing ? 1 : -1);
  px(ctx, x - 10, leftArmY, 3, 8, OUTLINE);
  px(ctx, x - 9, leftArmY + 1, 2, 7, avatar.shirtShadow);
  px(ctx, x - 9, leftArmY + 6, 2, 2, avatar.skin);

  // Right arm, opposite beat while typing.
  const rightArmY = bodyY + 4 + (typing ? -1 : 1);
  px(ctx, x + 8, rightArmY, 3, 8, OUTLINE);
  px(ctx, x + 8, rightArmY + 1, 2, 7, avatar.shirtShadow);
  px(ctx, x + 8, rightArmY + 6, 2, 2, avatar.skin);

  // Head.
  const faceTop = y - 32 + bob;
  px(ctx, x - 6, faceTop + 3, 12, 13, OUTLINE);
  px(ctx, x - 5, faceTop + 4, 10, 11, avatar.skin);
  px(ctx, x - 5, faceTop + 12, 10, 3, avatar.skinShadow);
  px(ctx, x - 7, faceTop + 7, 2, 3, avatar.skinShadow);
  px(ctx, x + 6, faceTop + 7, 2, 3, avatar.skinShadow);

  drawHair(ctx, agent, x - 6, faceTop, faceTop + 1);

  if (avatar.accessory === "beanie") {
    // Beanie sits above the hair for the designer.
    px(ctx, x - 7, faceTop + 1, 14, 4, OUTLINE);
    px(ctx, x - 6, faceTop + 1, 12, 3, avatar.accent);
    px(ctx, x - 7, faceTop + 4, 14, 2, "#8b4f31");
  }

  // Eyes.
  if (blink) {
    px(ctx, x - 4, faceTop + 10, 2, 1, OUTLINE);
    px(ctx, x + 2, faceTop + 10, 2, 1, OUTLINE);
  } else {
    px(ctx, x - 4, faceTop + 8, 2, 2, OUTLINE);
    px(ctx, x + 2, faceTop + 8, 2, 2, OUTLINE);
  }
  px(ctx, x - 1, faceTop + 11, 2, 1, avatar.skinShadow);

  if (avatar.beard) {
    px(ctx, x - 4, faceTop + 12, 8, 3, avatar.hairShadow);
    px(ctx, x - 3, faceTop + 11, 1, 1, avatar.hair);
    px(ctx, x + 2, faceTop + 11, 1, 1, avatar.hair);
  } else {
    px(ctx, x - 2, faceTop + 13, 3, 1, "#b96f5c");
  }

  if (avatar.accessory === "glasses") {
    px(ctx, x - 5, faceTop + 7, 4, 4, "#2d211a");
    px(ctx, x + 2, faceTop + 7, 4, 4, "#2d211a");
    px(ctx, x - 1, faceTop + 8, 2, 1, "#2d211a");
    px(ctx, x - 4, faceTop + 8, 2, 2, "#f7dfb1");
    px(ctx, x + 3, faceTop + 8, 2, 2, "#f7dfb1");
    px(ctx, x - 4, faceTop + 8, 1, 1, "#2d211a");
    px(ctx, x + 3, faceTop + 8, 1, 1, "#2d211a");
  }

  if (avatar.accessory === "headset") {
    px(ctx, x - 7, faceTop + 5, 14, 2, OUTLINE);
    px(ctx, x - 8, faceTop + 7, 2, 5, OUTLINE);
    px(ctx, x + 7, faceTop + 7, 2, 5, OUTLINE);
    px(ctx, x - 8, faceTop + 8, 1, 3, avatar.accent);
    px(ctx, x + 8, faceTop + 8, 1, 3, avatar.accent);
    px(ctx, x + 7, faceTop + 11, 3, 1, OUTLINE);
    px(ctx, x + 9, faceTop + 10, 1, 2, avatar.accent);
  }

  if (agent.status === "error") {
    const pulse = Math.floor(time / 420) % 2 === 0;
    px(ctx, x + 9, faceTop - 5, 7, 7, "#8f2626");
    px(ctx, x + 10, faceTop - 4, 5, 5, pulse ? "#ff6b5f" : "#e2493e");
    px(ctx, x + 12, faceTop - 3, 1, 3, "#fff5e8");
    px(ctx, x + 12, faceTop + 1, 1, 1, "#fff5e8");
  }

  ctx.restore();
}

export function drawAvatarPortrait(ctx: Ctx, agent: Agent, time: number, size = 64) {
  const palette = PORTRAIT_BACKGROUNDS[agent.roomId];
  const { avatar } = agent;
  const blink = Math.floor((time / 1000) % 4.2) < 0.14;
  const bob = Math.round(Math.sin(time / 800) * 0.7);

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // Backdrop: a tiny pixel room vignette.
  px(ctx, 0, 0, size, size, palette.wall);
  px(ctx, 0, 0, size, 3, "#182923");
  px(ctx, 4, 5, 18, 16, "#17322d");
  px(ctx, 6, 7, 14, 12, palette.light);
  px(ctx, 7, 8, 5, 5, "#f6e7b8");
  px(ctx, 14, 7, 5, 12, "#c47950");
  px(ctx, 5, 19, 16, 2, "#86563b");
  px(ctx, 42, 4, 18, 20, "#152622");
  px(ctx, 44, 6, 14, 16, "#24473f");
  px(ctx, 48, 9, 2, 2, "#d9b15d");
  px(ctx, 53, 12, 2, 2, "#d9b15d");
  px(ctx, 47, 16, 8, 2, "#8fc7b5");

  px(ctx, 0, size - 14, size, 14, palette.floor);
  px(ctx, 0, size - 14, size, 2, "#40291c");
  for (let x = 2; x < size; x += 10) {
    px(ctx, x, size - 12, 1, 12, "#6b452b");
  }
  px(ctx, 0, size - 16, size, 4, "rgba(15,20,18,0.25)");

  // Role prop.
  if (agent.id === "email") {
    px(ctx, 6, 34, 10, 7, "#f3e5c7");
    px(ctx, 6, 34, 10, 1, OUTLINE);
    px(ctx, 7, 40, 8, 1, OUTLINE);
    px(ctx, 7, 36, 3, 1, "#9d6b48");
    px(ctx, 11, 36, 3, 1, "#9d6b48");
  } else if (agent.id === "finance") {
    px(ctx, 7, 38, 3, 5, "#a7c985");
    px(ctx, 11, 35, 3, 8, "#d9b56c");
    px(ctx, 15, 32, 3, 11, "#e8895e");
  } else if (agent.id === "cover") {
    px(ctx, 6, 34, 6, 6, "#e8895e");
    px(ctx, 12, 34, 6, 6, "#78c5b6");
    px(ctx, 9, 39, 6, 6, "#e7c56b");
  } else if (agent.id === "instagram") {
    px(ctx, 8, 34, 6, 6, "#f0b6ab");
    px(ctx, 9, 35, 4, 4, "#b65561");
    px(ctx, 17, 39, 3, 3, "#e7c56b");
  } else {
    px(ctx, 6, 33, 11, 9, "#f0dcb2");
    px(ctx, 6, 33, 11, 1, OUTLINE);
    px(ctx, 8, 36, 2, 2, "#b15745");
    px(ctx, 12, 35, 3, 3, "#3f776b");
    px(ctx, 9, 39, 5, 1, "#9f7b4f");
  }

  const cx = Math.round(size / 2);
  const shoulderY = size - 22;
  const headTop = 19 + bob;

  // Shoulders / torso.
  px(ctx, cx - 17, shoulderY, 34, 22, OUTLINE);
  px(ctx, cx - 15, shoulderY + 1, 30, 18, avatar.shirt);
  px(ctx, cx - 15, shoulderY + 12, 30, 7, avatar.shirtShadow);
  px(ctx, cx - 3, shoulderY + 2, 6, 4, avatar.accent);
  px(ctx, cx - 1, shoulderY + 8, 2, 7, avatar.accent);

  // Neck.
  px(ctx, cx - 5, shoulderY - 5, 10, 7, avatar.skinShadow);

  // Head silhouette.
  px(ctx, cx - 12, headTop + 5, 24, 25, OUTLINE);
  px(ctx, cx - 10, headTop + 7, 20, 21, avatar.skin);
  px(ctx, cx - 10, headTop + 23, 20, 5, avatar.skinShadow);
  px(ctx, cx - 14, headTop + 12, 3, 6, avatar.skinShadow);
  px(ctx, cx + 11, headTop + 12, 3, 6, avatar.skinShadow);

  // Hair.
  const hairX = cx - 12;
  if (avatar.style === "long") {
    px(ctx, hairX, headTop + 2, 24, 15, avatar.hairShadow);
    px(ctx, hairX + 1, headTop, 22, 12, avatar.hair);
    px(ctx, hairX - 2, headTop + 10, 4, 19, avatar.hair);
    px(ctx, hairX + 22, headTop + 10, 4, 19, avatar.hair);
    px(ctx, hairX + 1, headTop + 1, 8, 2, avatar.hairShadow);
  } else if (avatar.style === "curly") {
    px(ctx, hairX - 2, headTop + 4, 28, 11, avatar.hairShadow);
    px(ctx, hairX - 2, headTop - 1, 7, 7, avatar.hair);
    px(ctx, hairX + 5, headTop - 3, 8, 6, avatar.hair);
    px(ctx, hairX + 14, headTop - 1, 7, 6, avatar.hair);
    px(ctx, hairX + 22, headTop + 4, 5, 7, avatar.hair);
    px(ctx, hairX - 4, headTop + 7, 4, 7, avatar.hair);
    px(ctx, hairX + 2, headTop + 2, 18, 7, avatar.hair);
  } else if (avatar.style === "bun") {
    px(ctx, cx - 8, headTop - 9, 16, 8, avatar.hairShadow);
    px(ctx, cx - 6, headTop - 11, 12, 8, avatar.hair);
    px(ctx, hairX + 1, headTop + 1, 22, 12, avatar.hair);
    px(ctx, hairX, headTop + 9, 3, 15, avatar.hairShadow);
    px(ctx, hairX + 21, headTop + 9, 3, 15, avatar.hairShadow);
  } else {
    px(ctx, hairX + 1, headTop - 1, 22, 11, avatar.hair);
    px(ctx, hairX, headTop + 6, 5, 7, avatar.hair);
    px(ctx, hairX + 20, headTop + 6, 5, 7, avatar.hairShadow);
    px(ctx, hairX + 3, headTop, 13, 3, avatar.hairShadow);
  }

  if (avatar.accessory === "beanie") {
    px(ctx, cx - 13, headTop + 2, 26, 7, OUTLINE);
    px(ctx, cx - 12, headTop + 2, 24, 5, avatar.accent);
    px(ctx, cx - 13, headTop + 7, 26, 3, "#8b4f31");
  }

  // Eyes and brows.
  if (blink) {
    px(ctx, cx - 7, headTop + 18, 4, 2, OUTLINE);
    px(ctx, cx + 4, headTop + 18, 4, 2, OUTLINE);
  } else {
    px(ctx, cx - 8, headTop + 16, 5, 4, "#fbf1dd");
    px(ctx, cx + 4, headTop + 16, 5, 4, "#fbf1dd");
    px(ctx, cx - 6, headTop + 17, 2, 3, OUTLINE);
    px(ctx, cx + 5, headTop + 17, 2, 3, OUTLINE);
  }
  px(ctx, cx - 8, headTop + 14, 5, 1, avatar.hairShadow);
  px(ctx, cx + 4, headTop + 14, 5, 1, avatar.hairShadow);
  px(ctx, cx - 1, headTop + 21, 3, 2, avatar.skinShadow);
  px(ctx, cx - 3, headTop + 25, 7, 2, "#a95e52");

  if (avatar.beard) {
    px(ctx, cx - 8, headTop + 23, 17, 7, avatar.hairShadow);
    px(ctx, cx - 3, headTop + 24, 8, 5, avatar.skinShadow);
    px(ctx, cx - 3, headTop + 25, 8, 1, avatar.hairShadow);
  }

  if (avatar.accessory === "glasses") {
    px(ctx, cx - 10, headTop + 15, 8, 7, "#2b211a");
    px(ctx, cx + 3, headTop + 15, 8, 7, "#2b211a");
    px(ctx, cx - 2, headTop + 16, 5, 1, "#2b211a");
    px(ctx, cx - 9, headTop + 16, 6, 5, "#f7dfb1");
    px(ctx, cx + 4, headTop + 16, 6, 5, "#f7dfb1");
    px(ctx, cx - 8, headTop + 17, 2, 2, "#2b211a");
    px(ctx, cx + 5, headTop + 17, 2, 2, "#2b211a");
  }

  if (avatar.accessory === "headset") {
    px(ctx, cx - 14, headTop + 10, 29, 3, OUTLINE);
    px(ctx, cx - 16, headTop + 14, 4, 10, OUTLINE);
    px(ctx, cx + 13, headTop + 14, 4, 10, OUTLINE);
    px(ctx, cx - 15, headTop + 15, 2, 7, avatar.accent);
    px(ctx, cx + 14, headTop + 15, 2, 7, avatar.accent);
    px(ctx, cx + 13, headTop + 23, 8, 2, OUTLINE);
    px(ctx, cx + 19, headTop + 21, 2, 3, avatar.accent);
  }

  // Fine pixel highlight.
  px(ctx, cx - 9, headTop + 8, 4, 2, "rgba(255,255,255,0.14)");
}
