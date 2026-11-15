import type { Agent, FurnitureStyle } from "@/data/agents";

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, Math.round(w * 2) / 2, Math.round(h * 2) / 2);
}

const OUTLINE = "#1d1511";

interface RoomScenePalette {
  wall: string;
  wallShade: string;
  wainscot: string;
  light: string;
  accent: string;
  floor: string;
  floorGrain: string;
}

const STYLE_PORTRAIT_BACKGROUNDS: Record<FurnitureStyle, RoomScenePalette> = {
  admin: {
    wall: "#203f38",
    wallShade: "#162d28",
    wainscot: "#4d3221",
    light: "#e4b868",
    accent: "#f3d99e",
    floor: "#6b452b",
    floorGrain: "#52331f",
  },
  tech: {
    wall: "#1e3a48",
    wallShade: "#142733",
    wainscot: "#43342c",
    light: "#8ad5ec",
    accent: "#d5f4ff",
    floor: "#5c4938",
    floorGrain: "#433326",
  },
  finance: {
    wall: "#3f4e37",
    wallShade: "#2c3827",
    wainscot: "#493728",
    light: "#b9ce93",
    accent: "#f2e2b4",
    floor: "#584b39",
    floorGrain: "#433829",
  },
  creative: {
    wall: "#643a2e",
    wallShade: "#492820",
    wainscot: "#5d3b27",
    light: "#ec9c73",
    accent: "#ffd8ad",
    floor: "#8a5237",
    floorGrain: "#6a3c27",
  },
};

function inferPortraitStyle(agent: Agent, explicitStyle?: FurnitureStyle): FurnitureStyle {
  if (explicitStyle) return explicitStyle;
  if (agent.skills.includes("code-writing")) return "tech";
  if (agent.skills.includes("sheets-finance") || agent.skills.includes("data-analysis")) return "finance";
  if (agent.skills.includes("email-drafting") || agent.skills.includes("gmail-workspace")) return "creative";
  return "admin";
}

function drawChair(ctx: Ctx, x: number, y: number, accent: string) {
  // Subtle 5-star caster wheels peeking beneath the seat.
  px(ctx, x - 9, y - 2, 3, 2, "#242829");
  px(ctx, x + 6, y - 2, 3, 2, "#242829");
  px(ctx, x - 1.5, y + 0.5, 3, 2, "#191c1d");

  // Ergonomic backrest behind the agent.
  px(ctx, x - 10, y - 33, 20, 23, OUTLINE);
  px(ctx, x - 9, y - 32, 18, 21, "#2a3b37");
  // Contoured headrest & upper bolster.
  px(ctx, x - 6, y - 34, 12, 5, OUTLINE);
  px(ctx, x - 5, y - 33, 10, 3.5, "#384e49");
  px(ctx, x - 4, y - 32.5, 8, 1, "#4b6660");
  // Lumbar cushion & accent stitching.
  px(ctx, x - 7.5, y - 26, 15, 11, "#334742");
  px(ctx, x - 6.5, y - 25, 13, 2, "#435c56");
  px(ctx, x - 7.5, y - 14, 15, 3, "#22312d");
  // Seat pan.
  px(ctx, x - 9, y - 12, 18, 10, "#243430");
  px(ctx, x - 8, y - 4, 16, 2.5, "#192421");
  // Padded armrests.
  px(ctx, x - 11, y - 19, 3.5, 11, OUTLINE);
  px(ctx, x - 10.5, y - 18.5, 2.5, 9.5, "#364642");
  px(ctx, x + 7.5, y - 19, 3.5, 11, OUTLINE);
  px(ctx, x + 8, y - 18.5, 2.5, 9.5, "#364642");
  // Accent piping on backrest.
  px(ctx, x - 6, y - 15, 3, 1.5, accent);
  px(ctx, x + 3, y - 15, 3, 1.5, accent);
}

function drawHair(
  ctx: Ctx,
  agent: Agent,
  headX: number,
  faceTop: number,
) {
  const { avatar } = agent;
  const hair = avatar.hair;
  const shadow = avatar.hairShadow;
  const sheen = "rgba(255, 240, 212, 0.16)";

  if (avatar.style === "long") {
    px(ctx, headX - 1.5, faceTop + 0.5, 15, 14, shadow);
    px(ctx, headX - 0.5, faceTop - 0.5, 13, 8, hair);
    px(ctx, headX - 2.5, faceTop + 3.5, 3.5, 12, hair);
    px(ctx, headX + 11, faceTop + 3.5, 3.5, 12, hair);
    px(ctx, headX - 2.5, faceTop + 13.5, 2.5, 3, shadow);
    px(ctx, headX + 12, faceTop + 13.5, 2.5, 3, shadow);
    px(ctx, headX + 1, faceTop - 1, 9, 2, hair);
    px(ctx, headX + 2, faceTop + 0.5, 6, 1, sheen);
  } else if (avatar.style === "curly") {
    px(ctx, headX - 2.5, faceTop + 1.5, 15, 7.5, shadow);
    px(ctx, headX - 2.5, faceTop - 1.5, 4.5, 4.5, hair);
    px(ctx, headX + 1.5, faceTop - 2.5, 5, 4, hair);
    px(ctx, headX + 6.5, faceTop - 1.5, 5.5, 4.5, hair);
    px(ctx, headX + 11, faceTop + 2.5, 3, 4.5, hair);
    px(ctx, headX - 3, faceTop + 3.5, 3, 4.5, hair);
    px(ctx, headX + 1, faceTop + 0.5, 9, 3, hair);
    px(ctx, headX + 2.5, faceTop - 1.5, 2.5, 1.5, sheen);
    px(ctx, headX + 7.5, faceTop - 0.5, 2, 1.5, sheen);
  } else if (avatar.style === "bun") {
    px(ctx, headX + 2.5, faceTop - 6.5, 8, 5.5, OUTLINE);
    px(ctx, headX + 3, faceTop - 6, 7, 5, shadow);
    px(ctx, headX + 4, faceTop - 7, 5, 4, hair);
    px(ctx, headX + 5, faceTop - 6.5, 3, 1, sheen);
    px(ctx, headX, faceTop, 12, 7, hair);
    px(ctx, headX + 2, faceTop + 1, 6, 1, sheen);
    px(ctx, headX - 1, faceTop + 5, 2, 8.5, shadow);
    px(ctx, headX + 11, faceTop + 5, 2, 8.5, shadow);
  } else {
    px(ctx, headX - 0.5, faceTop - 1.5, 13, 7.5, hair);
    px(ctx, headX - 1.5, faceTop + 2.5, 3, 5.5, hair);
    px(ctx, headX + 10.5, faceTop + 2.5, 3, 5.5, shadow);
    px(ctx, headX + 2, faceTop - 1, 6.5, 2, shadow);
    px(ctx, headX + 3, faceTop, 5, 1, sheen);
  }
}

export function drawAgentSprite(ctx: Ctx, agent: Agent, time: number) {
  const { x, y } = agent.position;
  const { avatar } = agent;
  const seed = x * 0.13 + y * 0.07;
  const working = agent.status === "working";
  const bob = working
    ? Math.round(Math.sin(time / 240 + seed) * 1.2) / 2
    : Math.round(Math.sin(time / 920 + seed) * 1.4) / 2;
  const typing = working && Math.floor(time / 180) % 2 === 0;
  const blink = ((time / 1000 + seed) % 4.4) < 0.14;

  ctx.save();
  // Grounded drop shadow around the chair base.
  ctx.fillStyle = "rgba(12, 8, 5, 0.24)";
  ctx.fillRect(Math.round((x - 13) * 2) / 2, Math.round((y - 1) * 2) / 2, 26, 4.5);

  drawChair(ctx, x, y, avatar.accent);

  // Legs / trousers hint under chair front.
  px(ctx, x - 5, y - 8, 3.5, 8, avatar.shirtShadow);
  px(ctx, x + 2.5, y - 8, 3.5, 8, avatar.shirtShadow);

  // Torso with shoulder bevel, collar & lapel.
  const bodyY = y - 19 + bob;
  px(ctx, x - 8.5, bodyY, 17, 15, OUTLINE);
  px(ctx, x - 7.5, bodyY + 1, 15, 13, avatar.shirt);
  px(ctx, x - 7.5, bodyY + 9.5, 15, 4.5, avatar.shirtShadow);
  // Subtle left highlight & right shadow fold.
  px(ctx, x - 7.5, bodyY + 1, 2.5, 9, "rgba(255,255,255,0.12)");
  px(ctx, x + 5.5, bodyY + 1, 2, 12, avatar.shirtShadow);
  // Collar & placket / tie accent.
  px(ctx, x - 3, bodyY + 1, 6, 2, "#f3e8d0");
  px(ctx, x - 2.5, bodyY + 1, 5, 1.5, avatar.accent);
  px(ctx, x - 1, bodyY + 4.5, 2, 6, avatar.accent);

  // Neck.
  px(ctx, x - 2, bodyY - 3, 4.5, 4, avatar.skinShadow);

  // Left arm.
  const leftArmY = bodyY + 3.5 + (typing ? 1 : -0.5);
  px(ctx, x - 10.5, leftArmY, 3.5, 8.5, OUTLINE);
  px(ctx, x - 9.5, leftArmY + 0.5, 2.5, 7.5, avatar.shirtShadow);
  px(ctx, x - 9.5, leftArmY + 6, 2.5, 2, avatar.skin);

  // Right arm (opposite rhythm while typing).
  const rightArmY = bodyY + 3.5 + (typing ? -0.5 : 1);
  px(ctx, x + 7.5, rightArmY, 3.5, 8.5, OUTLINE);
  px(ctx, x + 8, rightArmY + 0.5, 2.5, 7.5, avatar.shirtShadow);
  px(ctx, x + 8, rightArmY + 6, 2.5, 2, avatar.skin);

  // Head.
  const faceTop = y - 32 + bob;
  px(ctx, x - 6.5, faceTop + 2.5, 13, 13.5, OUTLINE);
  px(ctx, x - 5.5, faceTop + 3.5, 11, 11.5, avatar.skin);
  px(ctx, x - 5.5, faceTop + 12, 11, 3, avatar.skinShadow);
  // Warm cheek tint & forehead rim.
  px(ctx, x - 4.5, faceTop + 4, 4, 1, "rgba(255,244,225,0.22)");
  px(ctx, x - 5, faceTop + 11, 2, 1, "rgba(216,118,98,0.28)");
  px(ctx, x + 3, faceTop + 11, 2, 1, "rgba(216,118,98,0.28)");
  // Ears.
  px(ctx, x - 7.5, faceTop + 7, 2, 3, avatar.skinShadow);
  px(ctx, x + 5.5, faceTop + 7, 2, 3, avatar.skinShadow);

  drawHair(ctx, agent, x - 6, faceTop + 1);

  if (avatar.accessory === "beanie") {
    px(ctx, x - 7.5, faceTop + 0.5, 15, 4.5, OUTLINE);
    px(ctx, x - 6.5, faceTop + 1, 13, 3, avatar.accent);
    px(ctx, x - 7.5, faceTop + 4, 15, 2.5, "#8b4f31");
    // Knit rib pattern on cuff.
    for (let rx = x - 6; rx <= x + 5; rx += 3) {
      px(ctx, rx, faceTop + 4.5, 1, 1.5, "#673720");
    }
  }

  // Eyes with tiny catchlight.
  if (blink) {
    px(ctx, x - 4.5, faceTop + 10, 2.5, 1, OUTLINE);
    px(ctx, x + 2, faceTop + 10, 2.5, 1, OUTLINE);
  } else {
    px(ctx, x - 4.5, faceTop + 8, 2.5, 2.5, OUTLINE);
    px(ctx, x + 2, faceTop + 8, 2.5, 2.5, OUTLINE);
    px(ctx, x - 4, faceTop + 8, 1, 1, "#fff6e3");
    px(ctx, x + 2.5, faceTop + 8, 1, 1, "#fff6e3");
  }
  px(ctx, x - 1, faceTop + 11, 2, 1, avatar.skinShadow);

  if (avatar.beard) {
    px(ctx, x - 4.5, faceTop + 12, 9, 3.5, avatar.hairShadow);
    px(ctx, x - 3, faceTop + 11, 1.5, 1, avatar.hair);
    px(ctx, x + 1.5, faceTop + 11, 1.5, 1, avatar.hair);
  } else {
    px(ctx, x - 2, faceTop + 13, 3.5, 1, "#b96f5c");
  }

  if (avatar.accessory === "glasses") {
    px(ctx, x - 5.5, faceTop + 7, 4.5, 4, "#2d211a");
    px(ctx, x + 1.5, faceTop + 7, 4.5, 4, "#2d211a");
    px(ctx, x - 1, faceTop + 8, 2.5, 1, "#2d211a");
    px(ctx, x - 4.5, faceTop + 8, 2.5, 2, "#f8e4bc");
    px(ctx, x + 2.5, faceTop + 8, 2.5, 2, "#f8e4bc");
    px(ctx, x - 4, faceTop + 8.5, 1, 1, "#2d211a");
    px(ctx, x + 3, faceTop + 8.5, 1, 1, "#2d211a");
  }

  if (avatar.accessory === "headset") {
    px(ctx, x - 7.5, faceTop + 5, 15, 2, OUTLINE);
    px(ctx, x - 8.5, faceTop + 7, 2.5, 5, OUTLINE);
    px(ctx, x + 6.5, faceTop + 7, 2.5, 5, OUTLINE);
    px(ctx, x - 8, faceTop + 7.5, 1.5, 3.5, avatar.accent);
    px(ctx, x + 7, faceTop + 7.5, 1.5, 3.5, avatar.accent);
    px(ctx, x + 6.5, faceTop + 11, 3.5, 1, OUTLINE);
    px(ctx, x + 9, faceTop + 10, 1.5, 2, avatar.accent);
  }

  if (agent.status === "error") {
    const pulse = Math.floor(time / 440) % 2 === 0;
    px(ctx, x + 8.5, faceTop - 5.5, 8, 8, "#6f1d1d");
    px(ctx, x + 9.5, faceTop - 4.5, 6, 6, pulse ? "#ff6d61" : "#df483d");
    px(ctx, x + 12, faceTop - 3.5, 1, 3, "#fff6eb");
    px(ctx, x + 12, faceTop + 0.5, 1, 1, "#fff6eb");
  }

  ctx.restore();
}

export function drawAvatarPortrait(
  ctx: Ctx,
  agent: Agent,
  time: number,
  size = 64,
  furnitureStyle?: FurnitureStyle,
) {
  const resolvedStyle = inferPortraitStyle(agent, furnitureStyle);
  const palette = STYLE_PORTRAIT_BACKGROUNDS[resolvedStyle];
  const { avatar } = agent;
  const blink = ((time / 1000) % 4.2) < 0.14;
  const bob = Math.round(Math.sin(time / 780) * 1.2) / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // Room wall & wood wainscot backdrop.
  px(ctx, 0, 0, size, size, palette.wall);
  px(ctx, 0, 0, size, 3.5, "#15231e");
  px(ctx, 0, 3.5, size, 1, avatar.accent || "#c89f58");
  px(ctx, 0, 32, size, 18, palette.wallShade);
  px(ctx, 0, 32, size, 1.5, palette.wainscot);

  // Left paned window with warm sky & curtain accent.
  px(ctx, 3.5, 5.5, 19, 17, "#162d28");
  px(ctx, 5, 7, 16, 14, palette.light);
  px(ctx, 6, 8, 6, 6, "#f8ecc1");
  px(ctx, 12.5, 7, 1.5, 14, "#4b3323");
  px(ctx, 5, 13.5, 16, 1.5, "#4b3323");
  px(ctx, 15.5, 7, 5, 14, "#b66f49");
  px(ctx, 4, 21.5, 18, 2, "#8c5c3e");

  // Right framed studio board / chart / artwork.
  px(ctx, 41.5, 5.5, 18.5, 20, "#152622");
  px(ctx, 43, 7, 15.5, 17, "#24473f");
  px(ctx, 43, 7, 15.5, 1.5, avatar.accent || "#c89f58");
  px(ctx, 46, 10.5, 3, 3, "#dfb35d");
  px(ctx, 51, 13.5, 4, 2, "#e88b63");
  px(ctx, 46, 17.5, 9, 2, "#8fc7b5");

  // Wooden desk foreground at bottom.
  px(ctx, 0, size - 15, size, 15, palette.floor);
  px(ctx, 0, size - 15, size, 2, "#3b2518");
  px(ctx, 0, size - 13, size, 1, "rgba(255,225,180,0.18)");
  for (let gx = 4; gx < size; gx += 12) {
    px(ctx, gx, size - 12, 1, 12, palette.floorGrain);
  }
  px(ctx, 0, size - 17, size, 2.5, "rgba(12, 18, 15, 0.25)");

  // Role signature props on the desk corner.
  if (resolvedStyle === "tech") {
    px(ctx, 4.5, 33.5, 14, 10, OUTLINE);
    px(ctx, 5.5, 34.5, 12, 8, "#16262f");
    px(ctx, 7, 36.5, 5, 1, "#6ad7ec");
    px(ctx, 7, 38.5, 8.5, 1, "#94e0a8");
    px(ctx, 7, 40.5, 6.5, 1, "#f0c86d");
  } else if (resolvedStyle === "finance") {
    px(ctx, 6.5, 38, 3, 6, "#a7c985");
    px(ctx, 10.5, 35, 3, 9, "#d9b56c");
    px(ctx, 14.5, 32, 3, 12, "#e8895e");
    px(ctx, 5.5, 44, 13, 1.5, "#f2e2b4");
  } else if (resolvedStyle === "creative") {
    px(ctx, 5.5, 34, 6.5, 6.5, "#e8895e");
    px(ctx, 12, 34, 6.5, 6.5, "#78c5b6");
    px(ctx, 8.5, 39.5, 6.5, 6.5, "#e7c56b");
  } else if (agent.skills.includes("gmail-workspace")) {
    px(ctx, 5, 35, 11.5, 8, OUTLINE);
    px(ctx, 6, 36, 9.5, 6, "#f4e6c9");
    px(ctx, 7, 37.5, 3.5, 1, "#a26e49");
    px(ctx, 11.5, 37.5, 3, 1, "#82b7ac");
    px(ctx, 7, 39.5, 7, 1, "#b9a180");
  } else {
    px(ctx, 5.5, 33.5, 12, 9.5, OUTLINE);
    px(ctx, 6.5, 34.5, 10, 7.5, "#f0dcb2");
    px(ctx, 8, 36.5, 2.5, 2.5, "#b15745");
    px(ctx, 12, 35.5, 3, 3.5, "#3f776b");
    px(ctx, 8.5, 40, 6, 1, "#9f7b4f");
  }

  const cx = Math.round(size / 2);
  const shoulderY = size - 22;
  const headTop = 18.5 + bob;

  // Shoulders & blazer/shirt shading.
  px(ctx, cx - 17.5, shoulderY, 35, 22, OUTLINE);
  px(ctx, cx - 15.5, shoulderY + 1, 31, 18, avatar.shirt);
  px(ctx, cx - 15.5, shoulderY + 12, 31, 7, avatar.shirtShadow);
  px(ctx, cx - 14.5, shoulderY + 2, 4, 14, "rgba(255,255,255,0.1)");
  px(ctx, cx + 10.5, shoulderY + 2, 5, 15, avatar.shirtShadow);
  px(ctx, cx - 4, shoulderY + 1.5, 8, 4, "#f4ebd6");
  px(ctx, cx - 3, shoulderY + 2, 6, 3.5, avatar.accent);
  px(ctx, cx - 1, shoulderY + 7.5, 2, 8, avatar.accent);

  // Neck.
  px(ctx, cx - 5, shoulderY - 5, 10, 7, avatar.skinShadow);

  // Head silhouette with soft jaw & cheek warmth.
  px(ctx, cx - 12.5, headTop + 4.5, 25, 25.5, OUTLINE);
  px(ctx, cx - 10.5, headTop + 6.5, 21, 21.5, avatar.skin);
  px(ctx, cx - 10.5, headTop + 23, 21, 5, avatar.skinShadow);
  px(ctx, cx - 9, headTop + 20, 3.5, 2, "rgba(216,112,92,0.28)");
  px(ctx, cx + 5.5, headTop + 20, 3.5, 2, "rgba(216,112,92,0.28)");
  // Ears.
  px(ctx, cx - 14, headTop + 12, 3, 6, avatar.skinShadow);
  px(ctx, cx + 11, headTop + 12, 3, 6, avatar.skinShadow);

  // Hair.
  const hairX = cx - 12;
  const hairSheen = "rgba(255, 240, 212, 0.16)";
  if (avatar.style === "long") {
    px(ctx, hairX - 0.5, headTop + 1.5, 25, 16, avatar.hairShadow);
    px(ctx, hairX + 0.5, headTop - 0.5, 23, 12.5, avatar.hair);
    px(ctx, hairX - 2.5, headTop + 9.5, 4.5, 20, avatar.hair);
    px(ctx, hairX + 22, headTop + 9.5, 4.5, 20, avatar.hair);
    px(ctx, hairX + 2, headTop + 1, 9, 2, hairSheen);
  } else if (avatar.style === "curly") {
    px(ctx, hairX - 2.5, headTop + 4, 29, 11.5, avatar.hairShadow);
    px(ctx, hairX - 2.5, headTop - 1.5, 7.5, 7.5, avatar.hair);
    px(ctx, hairX + 4.5, headTop - 3.5, 9, 6.5, avatar.hair);
    px(ctx, hairX + 13.5, headTop - 1.5, 7.5, 6.5, avatar.hair);
    px(ctx, hairX + 21.5, headTop + 4, 5.5, 7.5, avatar.hair);
    px(ctx, hairX - 4.5, headTop + 7, 4.5, 7.5, avatar.hair);
    px(ctx, hairX + 2, headTop + 2, 18, 7, avatar.hair);
    px(ctx, hairX + 6, headTop - 2, 4, 2, hairSheen);
  } else if (avatar.style === "bun") {
    px(ctx, cx - 8.5, headTop - 9.5, 17, 9, OUTLINE);
    px(ctx, cx - 8, headTop - 9, 16, 8, avatar.hairShadow);
    px(ctx, cx - 6, headTop - 11, 12, 8, avatar.hair);
    px(ctx, cx - 4, headTop - 10, 6, 1.5, hairSheen);
    px(ctx, hairX + 1, headTop + 1, 22, 12, avatar.hair);
    px(ctx, hairX + 3, headTop + 2.5, 10, 1.5, hairSheen);
    px(ctx, hairX - 0.5, headTop + 9, 3.5, 15, avatar.hairShadow);
    px(ctx, hairX + 21, headTop + 9, 3.5, 15, avatar.hairShadow);
  } else {
    px(ctx, hairX + 0.5, headTop - 1.5, 23, 11.5, avatar.hair);
    px(ctx, hairX - 0.5, headTop + 6, 5.5, 7.5, avatar.hair);
    px(ctx, hairX + 19.5, headTop + 6, 5.5, 7.5, avatar.hairShadow);
    px(ctx, hairX + 3, headTop - 0.5, 13, 3, avatar.hairShadow);
    px(ctx, hairX + 4, headTop + 1, 9, 1.5, hairSheen);
  }

  if (avatar.accessory === "beanie") {
    px(ctx, cx - 13.5, headTop + 1.5, 27, 7.5, OUTLINE);
    px(ctx, cx - 12.5, headTop + 2, 25, 5.5, avatar.accent);
    px(ctx, cx - 13.5, headTop + 7, 27, 3.5, "#8b4f31");
    for (let rx = cx - 11; rx <= cx + 10; rx += 4) {
      px(ctx, rx, headTop + 7.5, 1.5, 2.5, "#673720");
    }
  }

  // Eyes, iris catchlight, and brows.
  if (blink) {
    px(ctx, cx - 7.5, headTop + 18, 4.5, 2, OUTLINE);
    px(ctx, cx + 3.5, headTop + 18, 4.5, 2, OUTLINE);
  } else {
    px(ctx, cx - 8.5, headTop + 16, 5.5, 4.5, "#fbf1dd");
    px(ctx, cx + 3.5, headTop + 16, 5.5, 4.5, "#fbf1dd");
    px(ctx, cx - 6.5, headTop + 17, 2.5, 3, OUTLINE);
    px(ctx, cx + 4.5, headTop + 17, 2.5, 3, OUTLINE);
    px(ctx, cx - 6, headTop + 17, 1, 1, "#ffffff");
    px(ctx, cx + 5, headTop + 17, 1, 1, "#ffffff");
  }
  px(ctx, cx - 8.5, headTop + 14, 5.5, 1.5, avatar.hairShadow);
  px(ctx, cx + 3.5, headTop + 14, 5.5, 1.5, avatar.hairShadow);
  px(ctx, cx - 1, headTop + 21, 3, 2, avatar.skinShadow);
  px(ctx, cx - 3, headTop + 25, 7, 2, "#a95e52");

  if (avatar.beard) {
    px(ctx, cx - 8.5, headTop + 23, 17.5, 7.5, avatar.hairShadow);
    px(ctx, cx - 3, headTop + 24, 7.5, 5, avatar.skinShadow);
    px(ctx, cx - 3, headTop + 25, 7.5, 1.5, avatar.hairShadow);
  }

  if (avatar.accessory === "glasses") {
    px(ctx, cx - 10.5, headTop + 14.5, 8.5, 7.5, "#2b211a");
    px(ctx, cx + 2.5, headTop + 14.5, 8.5, 7.5, "#2b211a");
    px(ctx, cx - 2, headTop + 16, 4.5, 1.5, "#2b211a");
    px(ctx, cx - 9.5, headTop + 15.5, 6.5, 5.5, "#f7dfb1");
    px(ctx, cx + 3.5, headTop + 15.5, 6.5, 5.5, "#f7dfb1");
    px(ctx, cx - 7.5, headTop + 17, 2.5, 2.5, "#2b211a");
    px(ctx, cx + 4.5, headTop + 17, 2.5, 2.5, "#2b211a");
    px(ctx, cx - 9, headTop + 16, 2, 1, "rgba(255,255,255,0.65)");
    px(ctx, cx + 4, headTop + 16, 2, 1, "rgba(255,255,255,0.65)");
  }

  if (avatar.accessory === "headset") {
    px(ctx, cx - 14.5, headTop + 10, 29.5, 3, OUTLINE);
    px(ctx, cx - 16, headTop + 14, 4, 10, OUTLINE);
    px(ctx, cx + 12.5, headTop + 14, 4, 10, OUTLINE);
    px(ctx, cx - 15, headTop + 15, 2, 7.5, avatar.accent);
    px(ctx, cx + 13.5, headTop + 15, 2, 7.5, avatar.accent);
    px(ctx, cx + 12.5, headTop + 23, 8.5, 2, OUTLINE);
    px(ctx, cx + 19, headTop + 21, 2, 3, avatar.accent);
  }

  // Subtle top highlight across forehead.
  px(ctx, cx - 9, headTop + 7.5, 5, 1.5, "rgba(255,255,255,0.16)");
}
