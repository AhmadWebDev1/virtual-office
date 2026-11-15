import type { Agent, AgentId, AgentStatus, ThemeMode } from "@/data/agents";
import { ROOMS } from "@/data/agents";
import { drawAgentSprite } from "./pixel-sprites";

type Ctx = CanvasRenderingContext2D;

const OUTLINE = "#211914";
const SHADOW = "rgba(18, 12, 8, 0.24)";

interface ScenePalette {
  outside: string;
  outsideAlt: string;
  hallA: string;
  hallB: string;
  wall: string;
  wallLight: string;
  wallDark: string;
  trim: string;
  sky: string;
  skyLight: string;
  windowGlow: string;
  leaf: string;
  leafDark: string;
}

const PALETTES: Record<ThemeMode, ScenePalette> = {
  day: {
    outside: "#cdbd9b",
    outsideAlt: "#c4b38f",
    hallA: "#d8c9a7",
    hallB: "#cfc09c",
    wall: "#4b3427",
    wallLight: "#6a4a34",
    wallDark: "#33231b",
    trim: "#d2a457",
    sky: "#9ed4dc",
    skyLight: "#d8f1ed",
    windowGlow: "#f9e8b2",
    leaf: "#5b8a58",
    leafDark: "#3d6440",
  },
  night: {
    outside: "#101b1b",
    outsideAlt: "#0c1616",
    hallA: "#38453f",
    hallB: "#313d38",
    wall: "#302720",
    wallLight: "#45352a",
    wallDark: "#211913",
    trim: "#8a6c3e",
    sky: "#14263b",
    skyLight: "#263f56",
    windowGlow: "#8da7bf",
    leaf: "#395b49",
    leafDark: "#294437",
  },
};

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function shade(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.2) {
  ctx.fillStyle = `rgba(20, 13, 8, ${alpha})`;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawRug(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  border: string,
  pattern: string,
) {
  px(ctx, x + 2, y + 3, w, h, SHADOW);
  px(ctx, x - 1, y - 1, w + 2, h + 2, border);
  px(ctx, x, y, w, h, base);
  px(ctx, x + 3, y + 3, w - 6, 1, border);
  px(ctx, x + 3, y + h - 4, w - 6, 1, border);
  px(ctx, x + 3, y + 3, 1, h - 6, border);
  px(ctx, x + w - 4, y + 3, 1, h - 6, border);

  const midY = Math.round(y + h / 2);
  const midX = Math.round(x + w / 2);
  for (let offset = -18; offset <= 18; offset += 12) {
    px(ctx, midX + offset, midY - 2, 4, 1, pattern);
    px(ctx, midX + offset + 1, midY - 1, 2, 1, pattern);
    px(ctx, midX + offset + 2, midY, 1, 1, pattern);
  }
  px(ctx, midX - 26, midY - 1, 10, 2, pattern);
  px(ctx, midX + 18, midY - 1, 10, 2, pattern);
  px(ctx, x + 6, y + 6, 2, 2, pattern);
  px(ctx, x + w - 8, y + 6, 2, 2, pattern);
  px(ctx, x + 6, y + h - 8, 2, 2, pattern);
  px(ctx, x + w - 8, y + h - 8, 2, 2, pattern);

  // Fringe.
  for (let fx = x + 2; fx < x + w - 2; fx += 4) {
    px(ctx, fx, y - 3, 1, 2, border);
    px(ctx, fx, y + h + 1, 1, 2, border);
  }
}

function drawPlant(ctx: Ctx, x: number, y: number, palette: ScenePalette, scale = 1) {
  const potW = Math.round(10 * scale);
  const potH = Math.round(8 * scale);
  const baseY = Math.round(y);
  px(ctx, x - 2, baseY + 3, potW + 4, 2, SHADOW);
  px(ctx, x, baseY - potH, potW, potH, OUTLINE);
  px(ctx, x + 1, baseY - potH + 1, potW - 2, potH - 2, "#9d5c3e");
  px(ctx, x + 1, baseY - potH + 1, potW - 2, 2, "#b9714b");
  px(ctx, x + potW / 2 - 1, baseY - potH - 12 * scale, 2, 12 * scale, palette.leafDark);
  px(ctx, x - 3 * scale, baseY - potH - 8 * scale, 5 * scale, 5 * scale, palette.leafDark);
  px(ctx, x + potW - 2 * scale, baseY - potH - 10 * scale, 5 * scale, 5 * scale, palette.leaf);
  px(ctx, x + potW / 2 - 4 * scale, baseY - potH - 14 * scale, 4 * scale, 4 * scale, palette.leaf);
  px(ctx, x + potW / 2 + 1, baseY - potH - 11 * scale, 3 * scale, 3 * scale, palette.leaf);
  px(ctx, x + potW / 2 - 1, baseY - potH - 7 * scale, 2, 5 * scale, palette.leaf);
}

function drawDesk(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  top = "#9a6740",
  edge = "#674128",
  inset?: string,
) {
  px(ctx, x + 3, y + 4, w, h, SHADOW);
  px(ctx, x, y, w, h, edge);
  px(ctx, x + 1, y + 1, w - 2, h - 3, top);
  px(ctx, x + 2, y + 2, w - 4, 1, "#c08a58");
  px(ctx, x + 1, y + h - 5, w - 2, 3, "#41291a");
  for (let plank = x + 18; plank < x + w - 4; plank += 22) {
    px(ctx, plank, y + 3, 1, h - 8, "rgba(83, 49, 27, 0.35)");
  }
  if (inset) {
    px(ctx, x + 20, y + 6, w - 40, h - 14, "#4b2e1d");
    px(ctx, x + 21, y + 7, w - 42, h - 16, inset);
  }
  px(ctx, x + 3, y + h - 8, 5, 3, "#d6a95e");
  px(ctx, x + w - 8, y + h - 8, 5, 3, "#d6a95e");
}

function drawKeyboard(ctx: Ctx, x: number, y: number, w = 24, color = "#cfc3aa") {
  px(ctx, x - 1, y, w + 2, 6, OUTLINE);
  px(ctx, x, y + 1, w, 4, color);
  for (let key = x + 2; key < x + w - 1; key += 3) {
    px(ctx, key, y + 2, 1, 1, "#675c4d");
    px(ctx, key, y + 3, 1, 1, "#837665");
  }
}

function drawMug(ctx: Ctx, x: number, y: number, color = "#d96c52") {
  px(ctx, x - 1, y, 6, 7, OUTLINE);
  px(ctx, x, y + 1, 4, 5, color);
  px(ctx, x + 4, y + 2, 2, 3, color);
  px(ctx, x + 4, y + 3, 1, 1, "#2a211a");
  px(ctx, x + 1, y + 1, 2, 1, "rgba(255,255,255,0.35)");
}

function drawPapers(ctx: Ctx, x: number, y: number, count = 3) {
  for (let index = 0; index < count; index += 1) {
    const offset = index * 2;
    px(ctx, x + offset, y - offset, 12, 9, OUTLINE);
    px(ctx, x + 1 + offset, y + 1 - offset, 10, 7, "#f2e6ca");
    px(ctx, x + 3 + offset, y + 3 - offset, 6, 1, "#a58f6f");
    px(ctx, x + 3 + offset, y + 5 - offset, 4, 1, "#a58f6f");
  }
}

function drawMonitor(
  ctx: Ctx,
  x: number,
  y: number,
  agentId: AgentId,
  palette: ScenePalette,
  width = 30,
  height = 18,
) {
  px(ctx, x + 1, y + height, 4, 2, OUTLINE);
  px(ctx, x + width / 2 - 2, y + height, 4, 3, "#2c2722");
  px(ctx, x, y, width, height, OUTLINE);
  px(ctx, x + 2, y + 2, width - 4, height - 5, "#152321");
  px(ctx, x + 2, y + 2, width - 4, 2, "#24433e");

  if (agentId === "gm") {
    px(ctx, x + 5, y + 6, 5, 8, "#3c7367");
    px(ctx, x + 12, y + 5, 5, 9, "#6aa398");
    px(ctx, x + 19, y + 8, 5, 6, "#d3b26e");
    px(ctx, x + 5, y + 4, 19, 1, "#87cabb");
  } else if (agentId === "email") {
    px(ctx, x + 5, y + 5, 19, 2, "#94d9ce");
    px(ctx, x + 5, y + 9, 14, 2, "#5b9b94");
    px(ctx, x + 5, y + 13, 10, 1, "#426f6b");
    px(ctx, x + width - 8, y + 9, 3, 3, "#e8c56e");
  } else if (agentId === "finance") {
    px(ctx, x + 6, y + 12, 3, 3, "#7ca56b");
    px(ctx, x + 11, y + 9, 3, 6, "#a5c682");
    px(ctx, x + 16, y + 5, 3, 10, "#dcc179");
    px(ctx, x + 21, y + 7, 3, 8, "#8eb99a");
    px(ctx, x + 5, y + 4, 20, 1, "#c7dca0");
  } else if (agentId === "cover") {
    px(ctx, x + 5, y + 5, 6, 6, "#e98f64");
    px(ctx, x + 12, y + 5, 6, 6, "#78c7b7");
    px(ctx, x + 19, y + 5, 6, 6, "#e8c66d");
    px(ctx, x + 5, y + 12, 20, 1, "#d8b58d");
  } else {
    px(ctx, x + 6, y + 5, 3, 3, "#f2a6aa");
    px(ctx, x + 6, y + 8, 9, 1, "#c46a74");
    px(ctx, x + 6, y + 11, 6, 1, "#8f5058");
    px(ctx, x + 18, y + 6, 2, 8, "#e2b768");
    px(ctx, x + 22, y + 9, 2, 5, "#c5924e");
  }

  // Glass reflection and tiny power LED.
  px(ctx, x + width - 9, y + 3, 5, 1, "rgba(255,255,255,0.18)");
  px(ctx, x + width - 3, y + height - 2, 1, 1, agentId === "finance" ? "#b9d991" : "#8be0c9");
  px(ctx, x + 1, y + 1, width - 2, 1, "#463b30");
}

function drawTray(ctx: Ctx, x: number, y: number, color: string) {
  px(ctx, x, y + 2, 24, 2, SHADOW);
  px(ctx, x, y, 24, 7, OUTLINE);
  px(ctx, x + 1, y + 1, 22, 5, color);
  px(ctx, x + 2, y + 2, 20, 1, "#e8dcc0");
  px(ctx, x + 2, y + 4, 16, 1, "#bba987");
}

function drawDeskLamp(ctx: Ctx, x: number, y: number, accent = "#dcb563") {
  px(ctx, x - 1, y + 6, 12, 2, "#3a2b20");
  px(ctx, x + 3, y - 5, 2, 11, "#6f5a3b");
  px(ctx, x + 3, y - 7, 9, 4, OUTLINE);
  px(ctx, x + 4, y - 6, 7, 2, accent);
  px(ctx, x + 9, y - 5, 2, 2, "#f7e7ae");
}

function drawBookshelf(ctx: Ctx, x: number, y: number, w: number, h: number, palette: ScenePalette) {
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#5b3b26");
  for (let shelfY = y + 4; shelfY < y + h - 4; shelfY += 11) {
    px(ctx, x + 2, shelfY, w - 4, 2, "#3e281a");
    const colors = ["#c46e51", "#d9b466", "#6a9882", "#8a6c96"];
    for (let book = 0; book < 4; book += 1) {
      px(ctx, x + 3 + book * 3, shelfY - 6, 2, 6, colors[(book + shelfY) % colors.length]);
    }
  }
  px(ctx, x, y, w, 2, palette.trim);
}

function drawCabinet(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 2, y + 3, w, h, SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#7a7668");
  px(ctx, x + 2, y + 3, w - 4, 1, "#b0aa98");
  for (let drawer = 0; drawer < 3; drawer += 1) {
    const dy = y + 6 + drawer * 15;
    px(ctx, x + 2, dy, w - 4, 12, "#646154");
    px(ctx, x + 4, dy + 2, w - 8, 1, "#969181");
    px(ctx, x + w / 2 - 2, dy + 6, 4, 2, "#c5b47c");
  }
}

function drawSafe(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 3, y + 4, w, h, SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#858a80");
  px(ctx, x + 2, y + 2, w - 4, 2, "#aeb1a4");
  px(ctx, x + 3, y + 4, w - 6, h - 7, "#6f756c");
  px(ctx, x + 5, y + 6, 3, 6, "#c8cbbd");
  px(ctx, x + 6, y + 7, 1, 4, "#762f2f");
  px(ctx, x + w - 9, y + h / 2 - 2, 5, 5, "#343b37");
  px(ctx, x + w - 8, y + h / 2 - 1, 3, 3, "#d6b361");
  px(ctx, x + 1, y + h - 3, w - 2, 2, "#4e544e");
}

function drawSofa(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 2, y + 3, w, h, SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, 6, "#8b5945");
  px(ctx, x + 1, y + 7, 5, h - 9, "#764632");
  px(ctx, x + w - 6, y + 7, 5, h - 9, "#764632");
  px(ctx, x + 7, y + 8, w - 14, h - 12, "#ad7157");
  px(ctx, x + 7, y + 8, w - 14, 2, "#c78b6a");
  px(ctx, x + w / 2 - 1, y + 9, 2, h - 14, "#95604a");
  px(ctx, x, y, 3, 10, "#5b3629");
  px(ctx, x + w - 3, y, 3, 10, "#5b3629");
}

function drawArtFrame(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  motif: "frame" | "heart" | "line" = "frame",
) {
  px(ctx, x + 2, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, "#332219");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#c49a5c");
  px(ctx, x + 2, y + 2, w - 4, h - 4, color);
  if (motif === "heart") {
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    px(ctx, cx - 4, cy - 3, 3, 3, "#e9b46b");
    px(ctx, cx + 1, cy - 3, 3, 3, "#e9b46b");
    px(ctx, cx - 3, cy, 7, 2, "#e9b46b");
    px(ctx, cx - 2, cy + 2, 5, 1, "#e9b46b");
    px(ctx, cx - 1, cy + 3, 3, 1, "#e9b46b");
  } else if (motif === "line") {
    px(ctx, x + 4, y + h - 5, w - 8, 1, "#efd8a6");
    px(ctx, x + 5, y + 4, 2, h - 9, "#efd8a6");
  } else {
    px(ctx, x + 4, y + 4, w - 8, 2, "#ead7af");
    px(ctx, x + 4, y + h - 6, w - 8, 2, "#b36b50");
  }
}

function drawKanban(ctx: Ctx) {
  px(ctx, 62, 103, 95, 34, "#2a1b12");
  px(ctx, 64, 105, 91, 30, "#6c4b30");
  px(ctx, 67, 108, 25, 24, "#e7d8b9");
  px(ctx, 96, 108, 25, 24, "#e7d8b9");
  px(ctx, 125, 108, 25, 24, "#e7d8b9");
  px(ctx, 67, 108, 25, 3, "#4a7568");
  px(ctx, 96, 108, 25, 3, "#c18f4e");
  px(ctx, 125, 108, 25, 3, "#aa6553");
  const notes = [
    [70, 114, "#e5b95f"],
    [70, 122, "#8ab7a2"],
    [99, 114, "#d68b6c"],
    [99, 122, "#cfc08b"],
    [128, 114, "#8fb7a6"],
    [128, 122, "#dfb375"],
  ] as const;
  notes.forEach(([x, y, color]) => px(ctx, x, y, 7, 5, color));
  px(ctx, 62, 136, 95, 2, "#352317");
  px(ctx, 157, 107, 1, 26, "#d3ae6a");
}

function drawWindow(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ScenePalette,
  theme: ThemeMode,
) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, "#2f2119");
  px(ctx, x, y, w, h, "#6c4b32");
  px(ctx, x + 2, y + 2, w - 4, h - 4, palette.sky);
  px(ctx, x + 2, y + 2, w - 4, 2, palette.skyLight);
  const mid = x + Math.floor(w / 2);
  px(ctx, mid, y + 2, 2, h - 4, "#5b3f2a");
  px(ctx, x + 2, y + Math.floor(h / 2), w - 4, 1, "#5b3f2a");

  if (theme === "day") {
    px(ctx, x + 7, y + 4, 6, 2, "#eef8ed");
    px(ctx, x + 9, y + 3, 4, 1, "#eef8ed");
    px(ctx, mid + 8, y + 5, 5, 1, "#e5f2e6");
    px(ctx, x + w - 10, y + 3, 3, 3, "#f6e7a6");
  } else {
    px(ctx, x + 8, y + 3, 2, 2, "#d9e4de");
    px(ctx, x + 14, y + 6, 1, 1, "#b9cdd0");
    px(ctx, mid + 9, y + 4, 1, 1, "#d9e4de");
    px(ctx, mid + 16, y + 5, 2, 2, "#e7d49c");
    px(ctx, mid + 15, y + 4, 3, 4, "#e7d49c");
  }
  px(ctx, x, y + h - 2, w, 2, "#d7b067");
}

function drawDoorGap(ctx: Ctx, x: number, y: number, w: number, orientation: "h" | "v") {
  if (orientation === "h") {
    px(ctx, x, y + 3, w, 6, "#c0ab84");
    px(ctx, x, y + 3, w, 1, "#8f7a5a");
    px(ctx, x, y + 8, w, 1, "#8f7a5a");
    px(ctx, x - 2, y, 2, 2, "#d3ae6a");
    px(ctx, x + w, y, 2, 2, "#d3ae6a");
  } else {
    px(ctx, x + 3, y, 6, w, "#c0ab84");
    px(ctx, x + 3, y, 1, w, "#8f7a5a");
    px(ctx, x + 8, y, 1, w, "#8f7a5a");
  }
}

function drawEnvelope(ctx: Ctx, x: number, y: number, scale = 1) {
  const w = 8 * scale;
  const h = 6 * scale;
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#f3e4c5");
  px(ctx, x + 2, y + 2, w - 4, 1, "#b2946b");
  px(ctx, x + Math.floor(w / 2) - 1, y + 2, 1, 1, "#b2946b");
}

function drawHeart(ctx: Ctx, x: number, y: number, color: string) {
  px(ctx, x, y, 3, 2, color);
  px(ctx, x + 4, y, 3, 2, color);
  px(ctx, x, y + 2, 7, 2, color);
  px(ctx, x + 1, y + 4, 5, 1, color);
  px(ctx, x + 2, y + 5, 3, 1, color);
  px(ctx, x + 3, y + 6, 1, 1, color);
}

function drawPixelRing(ctx: Ctx, cx: number, cy: number, radius: number, color: string) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const distance = Math.sqrt(x * x + y * y);
      if (distance <= radius && distance >= radius - 1.7) {
        px(ctx, cx + x, cy + y, 1, 1, color);
      }
    }
  }
}

function drawRingStand(ctx: Ctx, x: number, deskY: number) {
  drawPixelRing(ctx, x, 158, 12, "#2a2420");
  drawPixelRing(ctx, x, 158, 10, "#fff3d4");
  drawPixelRing(ctx, x, 158, 8, "#f8e4b7");
  px(ctx, x - 1, 169, 2, deskY - 169, "#5c503c");
  px(ctx, x - 6, deskY - 2, 12, 2, "#392d22");
  px(ctx, x - 3, deskY - 4, 6, 2, "#6f5e44");
  px(ctx, x - 1, 157, 2, 3, "#fdfdf4");
}

function drawWallBoard(ctx: Ctx, x: number, y: number, w: number, h: number, kind: "mail" | "chart") {
  px(ctx, x + 2, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, "#2b1d14");
  px(ctx, x + 1, y + 1, w - 2, h - 2, kind === "mail" ? "#435c50" : "#3d4e42");
  px(ctx, x, y, w, 2, "#d3ae6a");
  if (kind === "mail") {
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const lx = x + 6 + col * 14;
        const ly = y + 7 + row * 10;
        px(ctx, lx, ly, 10, 7, "#1f2c27");
        px(ctx, lx + 1, ly + 1, 8, 5, "#d9ceac");
        px(ctx, lx + 2, ly + 2, 6, 1, "#927d5d");
      }
    }
  } else {
    px(ctx, x + 5, y + h - 6, 4, 4, "#9fbe76");
    px(ctx, x + 11, y + h - 10, 4, 8, "#ccb568");
    px(ctx, x + 17, y + h - 8, 4, 6, "#7ba58d");
    px(ctx, x + 25, y + h - 13, 4, 11, "#d18a60");
    px(ctx, x + 5, y + 6, w - 10, 1, "#8fb19c");
  }
}

function paintExterior(ctx: Ctx, palette: ScenePalette, theme: ThemeMode) {
  px(ctx, 0, 0, 840, 600, palette.outside);
  for (let y = 0; y < 600; y += 16) {
    for (let x = 0; x < 840; x += 16) {
      if ((x / 16 + y / 16) % 3 === 0) px(ctx, x, y, 1, 1, palette.outsideAlt);
    }
  }
  // Soft outside border and entrance path.
  px(ctx, 0, 0, 840, 8, theme === "day" ? "#b9a683" : "#0a1212");
  px(ctx, 0, 592, 840, 8, theme === "day" ? "#b9a683" : "#0a1212");
  px(ctx, 384, 572, 72, 28, theme === "day" ? "#e0d0ad" : "#24302d");
  px(ctx, 390, 572, 60, 3, theme === "day" ? "#f1e3c3" : "#33403c");
  px(ctx, 390, 572, 2, 28, theme === "day" ? "#b3a17f" : "#111c1b");
  px(ctx, 448, 572, 2, 28, theme === "day" ? "#b3a17f" : "#111c1b");

  // Little pixel shrubs at the corners.
  const shrub = theme === "day" ? "#6e8860" : "#233d33";
  const shrubLight = theme === "day" ? "#89a26e" : "#2d4a3b";
  px(ctx, 52, 584, 14, 8, shrub);
  px(ctx, 56, 579, 8, 7, shrubLight);
  px(ctx, 782, 586, 18, 6, shrub);
  px(ctx, 788, 581, 8, 7, shrubLight);
  px(ctx, 22, 60, 8, 10, shrub);
  px(ctx, 814, 64, 7, 9, shrub);
}

function paintHallway(ctx: Ctx, palette: ScenePalette) {
  px(ctx, 40, 86, 760, 478, palette.hallB);
  for (let y = 86; y < 564; y += 14) {
    for (let x = 40; x < 800; x += 14) {
      const isAlt = (Math.floor((x - 40) / 14) + Math.floor((y - 86) / 14)) % 2 === 0;
      px(ctx, x, y, 14, 14, isAlt ? palette.hallA : palette.hallB);
      if (isAlt) px(ctx, x + 3, y + 3, 1, 1, "rgba(92, 74, 50, 0.22)");
    }
  }

  // Long hall runners.
  drawRug(ctx, 72, 309, 696, 32, "#355f58", "#b99a61", "#d0b77f");
  drawRug(ctx, 403, 102, 34, 450, "#7f493d", "#c49a5d", "#e0bc85");
}

function paintRoomFloors(ctx: Ctx) {
  // CEO: warm wood planks.
  px(ctx, 52, 98, 324, 188, "#a87448");
  for (let y = 98; y < 286; y += 10) {
    px(ctx, 52, y, 324, 1, "#8b5a36");
    px(ctx, 52 + ((y / 10) % 2 === 0 ? 0 : 46), y, 1, 9, "#8b5a36");
    px(ctx, 120 + ((y / 10) % 2 === 0 ? 0 : 28), y, 1, 9, "#8b5a36");
    if ((y / 10) % 3 === 0) px(ctx, 180, y + 4, 12, 1, "#bd8958");
  }
  shade(ctx, 52, 98, 324, 6, 0.2);
  shade(ctx, 52, 98, 5, 188, 0.16);
  shade(ctx, 371, 98, 5, 188, 0.16);

  // Email: pale oak with narrow boards.
  px(ctx, 52, 364, 324, 188, "#bd9061");
  for (let x = 52; x < 376; x += 12) {
    px(ctx, x, 364, 1, 188, "#9f744c");
  }
  for (let y = 364; y < 552; y += 24) {
    px(ctx, 52, y, 324, 1, "#a87a50");
  }
  shade(ctx, 52, 364, 324, 6, 0.2);
  shade(ctx, 52, 364, 5, 188, 0.16);
  shade(ctx, 371, 364, 5, 188, 0.16);

  // Finance: green-gray stone tiles.
  for (let y = 364; y < 552; y += 18) {
    for (let x = 464; x < 788; x += 18) {
      const alt = (Math.floor((x - 464) / 18) + Math.floor((y - 364) / 18)) % 2 === 0;
      px(ctx, x, y, 18, 18, alt ? "#787b6d" : "#707466");
      px(ctx, x, y, 18, 1, "#62685c");
      px(ctx, x, y, 1, 18, "#62685c");
    }
  }
  shade(ctx, 464, 364, 324, 6, 0.22);
  shade(ctx, 464, 364, 5, 188, 0.16);
  shade(ctx, 783, 364, 5, 188, 0.16);

  // Creative: terracotta tiles with cream accents.
  for (let y = 98; y < 286; y += 16) {
    for (let x = 464; x < 788; x += 16) {
      const alt = (Math.floor((x - 464) / 16) * 3 + Math.floor((y - 98) / 16)) % 7 === 0;
      px(ctx, x, y, 16, 16, alt ? "#c78b65" : (Math.floor(y / 16) % 2 === 0 ? "#b87450" : "#bc7a55"));
      px(ctx, x, y, 16, 1, "#9a5b40");
      px(ctx, x, y, 1, 16, "#9a5b40");
    }
  }
  // Paint splatters beneath the designer station.
  const splats = [
    [502, 238, "#e8c15f"],
    [584, 248, "#6fb2a1"],
    [520, 258, "#d97457"],
    [560, 234, "#e7d2a4"],
    [602, 256, "#d48a55"],
  ] as const;
  splats.forEach(([x, y, color]) => {
    px(ctx, x, y, 4, 2, color);
    px(ctx, x + 3, y + 2, 2, 1, color);
    px(ctx, x - 1, y + 1, 1, 2, color);
  });
  shade(ctx, 464, 98, 324, 6, 0.2);
  shade(ctx, 464, 98, 5, 188, 0.16);
  shade(ctx, 783, 98, 5, 188, 0.16);
}

function paintWalls(ctx: Ctx, palette: ScenePalette, theme: ThemeMode) {
  // Outer shell.
  px(ctx, 30, 76, 780, 8, palette.wallDark);
  px(ctx, 30, 76, 780, 2, palette.wallLight);
  px(ctx, 30, 76, 8, 496, palette.wall);
  px(ctx, 30, 564, 8, 8, palette.wallDark);
  px(ctx, 802, 76, 8, 496, palette.wall);
  px(ctx, 30, 76, 2, 496, palette.wallLight);
  px(ctx, 802, 76, 2, 496, palette.wallDark);
  px(ctx, 30, 564, 362, 8, palette.wallDark);
  px(ctx, 448, 564, 362, 8, palette.wallDark);
  px(ctx, 32, 566, 360, 2, palette.trim);
  px(ctx, 448, 566, 360, 2, palette.trim);
  px(ctx, 30, 76, 780, 1, palette.trim);
  px(ctx, 30, 76, 1, 496, palette.trim);

  // Inner room walls.
  const wall = palette.wall;
  const light = palette.wallLight;
  const trim = palette.trim;

  // GM room.
  px(ctx, 40, 86, 348, 12, wall);
  px(ctx, 40, 86, 348, 2, light);
  px(ctx, 40, 86, 12, 212, wall);
  px(ctx, 40, 86, 2, 212, light);
  px(ctx, 376, 98, 12, 200, wall);
  px(ctx, 376, 98, 2, 200, light);
  px(ctx, 40, 286, 160, 12, wall);
  px(ctx, 254, 286, 134, 12, wall);
  px(ctx, 40, 286, 160, 2, light);
  px(ctx, 254, 286, 134, 2, light);
  drawDoorGap(ctx, 200, 286, 54, "h");
  px(ctx, 52, 286, 324, 1, trim);
  px(ctx, 52, 98, 324, 1, trim);

  // Creative room.
  px(ctx, 452, 86, 348, 12, wall);
  px(ctx, 452, 86, 348, 2, light);
  px(ctx, 452, 98, 12, 200, wall);
  px(ctx, 452, 98, 2, 200, light);
  px(ctx, 788, 98, 12, 200, wall);
  px(ctx, 788, 98, 2, 200, light);
  px(ctx, 452, 286, 144, 12, wall);
  px(ctx, 650, 286, 150, 12, wall);
  px(ctx, 452, 286, 144, 2, light);
  px(ctx, 650, 286, 150, 2, light);
  drawDoorGap(ctx, 596, 286, 54, "h");
  px(ctx, 464, 286, 324, 1, trim);
  px(ctx, 464, 98, 324, 1, trim);

  // Email room.
  px(ctx, 40, 352, 120, 12, wall);
  px(ctx, 214, 352, 174, 12, wall);
  px(ctx, 40, 352, 120, 2, light);
  px(ctx, 214, 352, 174, 2, light);
  drawDoorGap(ctx, 160, 352, 54, "h");
  px(ctx, 40, 364, 12, 200, wall);
  px(ctx, 40, 364, 2, 200, light);
  px(ctx, 376, 364, 12, 188, wall);
  px(ctx, 376, 364, 2, 188, light);
  px(ctx, 40, 552, 348, 12, wall);
  px(ctx, 40, 552, 348, 2, light);
  px(ctx, 52, 364, 324, 1, trim);
  px(ctx, 52, 552, 324, 1, trim);

  // Finance room.
  px(ctx, 452, 352, 144, 12, wall);
  px(ctx, 650, 352, 150, 12, wall);
  px(ctx, 452, 352, 144, 2, light);
  px(ctx, 650, 352, 150, 2, light);
  drawDoorGap(ctx, 596, 352, 54, "h");
  px(ctx, 452, 364, 12, 188, wall);
  px(ctx, 452, 364, 2, 188, light);
  px(ctx, 788, 364, 12, 200, wall);
  px(ctx, 788, 364, 2, 200, light);
  px(ctx, 452, 552, 348, 12, wall);
  px(ctx, 452, 552, 348, 2, light);
  px(ctx, 464, 364, 324, 1, trim);
  px(ctx, 464, 552, 324, 1, trim);

  // Windows over the top wall bands.
  drawWindow(ctx, 252, 88, 80, 8, palette, theme);
  drawWindow(ctx, 612, 88, 116, 8, palette, theme);
  drawWindow(ctx, 248, 354, 80, 8, palette, theme);
  drawWindow(ctx, 576, 354, 88, 8, palette, theme);

  // Baseboards: a fine highlight where the wall meets the room.
  px(ctx, 52, 284, 324, 2, "#6b4e36");
  px(ctx, 464, 284, 324, 2, "#6b4e36");
  px(ctx, 52, 362, 324, 2, "#6b4e36");
  px(ctx, 464, 362, 324, 2, "#6b4e36");
}

function paintGeneralManagerRoom(ctx: Ctx, palette: ScenePalette) {
  drawRug(ctx, 122, 146, 204, 116, "#7f3d35", "#c8a25f", "#e1c57f");
  drawKanban(ctx);
  drawBookshelf(ctx, 54, 154, 16, 76, palette);
  drawPlant(ctx, 342, 254, palette, 1.25);
  drawPlant(ctx, 58, 228, palette);
  drawDesk(ctx, 132, 186, 192, 42, "#95623c", "#5f3a24", "#315047");
  drawMonitor(ctx, 212, 193, "gm", palette, 32, 18);
  drawKeyboard(ctx, 216, 215, 24, "#d8c9ae");
  drawPapers(ctx, 286, 213, 3);
  drawMug(ctx, 152, 199, "#dbb164");
  drawDeskLamp(ctx, 160, 192, "#e3c172");
  px(ctx, 182, 214, 12, 8, "#3e3024");
  px(ctx, 184, 215, 8, 5, "#6d5b43");
  drawPapers(ctx, 304, 197, 2);
  // Guest chair.
  px(ctx, 82, 238, 26, 22, OUTLINE);
  px(ctx, 84, 240, 22, 10, "#5f4433");
  px(ctx, 86, 250, 18, 8, "#7d5b43");
  px(ctx, 88, 252, 14, 3, "#9c7451");
}

function paintEmailRoom(ctx: Ctx, palette: ScenePalette) {
  drawRug(ctx, 106, 402, 222, 112, "#446c65", "#d8bd84", "#eed29a");
  drawWallBoard(ctx, 64, 368, 74, 28, "mail");
  drawCabinet(ctx, 330, 414, 30, 64);
  drawPlant(ctx, 64, 512, palette, 1.2);
  drawDesk(ctx, 116, 440, 194, 40, "#9e6a42", "#694229");
  drawMonitor(ctx, 178, 446, "email", palette, 28, 16);
  drawMonitor(ctx, 210, 446, "email", palette, 28, 16);
  drawKeyboard(ctx, 196, 466, 25, "#ded1b6");
  drawTray(ctx, 274, 447, "#c7a26b");
  drawTray(ctx, 274, 456, "#8bbab1");
  drawMug(ctx, 136, 451, "#8bc9bf");
  drawDeskLamp(ctx, 128, 444, "#d5bb76");
  drawPapers(ctx, 160, 470, 2);
  px(ctx, 306, 448, 10, 12, OUTLINE);
  px(ctx, 307, 449, 8, 10, "#b8ad94");
  px(ctx, 309, 451, 4, 1, "#7d735f");
  px(ctx, 309, 454, 4, 1, "#7d735f");
}

function paintFinanceRoom(ctx: Ctx, palette: ScenePalette) {
  drawRug(ctx, 522, 402, 238, 112, "#575a48", "#c7b47a", "#e1cf95");
  drawWallBoard(ctx, 480, 368, 84, 28, "chart");
  drawSafe(ctx, 744, 373, 32, 46);
  drawCabinet(ctx, 470, 414, 30, 64);
  drawPlant(ctx, 766, 512, palette, 1.2);
  drawDesk(ctx, 536, 440, 208, 40, "#866849", "#543e2d", "#434a3c");
  drawMonitor(ctx, 606, 446, "finance", palette, 32, 17);
  drawMonitor(ctx, 644, 447, "finance", palette, 26, 15);
  drawKeyboard(ctx, 616, 467, 24, "#cdc6ae");
  drawPapers(ctx, 550, 454, 4);
  drawMug(ctx, 714, 451, "#c9dd9f");
  px(ctx, 682, 448, 14, 10, OUTLINE);
  px(ctx, 683, 449, 12, 8, "#4b4a3c");
  px(ctx, 686, 451, 6, 4, "#c6d29c");
  drawPapers(ctx, 728, 465, 2);
}

function paintCreativeRoom(ctx: Ctx, palette: ScenePalette) {
  drawRug(ctx, 474, 138, 306, 118, "#7c4c3e", "#d2ac72", "#f0d8aa");
  drawArtFrame(ctx, 478, 104, 20, 20, "#4d756b", "line");
  drawArtFrame(ctx, 502, 104, 24, 18, "#c17454");
  drawArtFrame(ctx, 530, 104, 18, 20, "#d9b66b", "heart");
  // Neon heart sign over the social station.
  px(ctx, 704, 105, 28, 24, "#2a1b16");
  drawHeart(ctx, 711, 110, "#ef9ca7");
  px(ctx, 706, 107, 24, 1, "#6d4d42");
  px(ctx, 706, 126, 24, 1, "#6d4d42");

  drawDesk(ctx, 486, 186, 116, 38, "#996341", "#633f28", "#c9a477");
  // Drawing tablet and stylus.
  px(ctx, 504, 192, 30, 16, "#31312c");
  px(ctx, 506, 193, 26, 12, "#d6e4d1");
  px(ctx, 508, 195, 9, 3, "#e38e63");
  px(ctx, 508, 200, 15, 2, "#7db0a2");
  px(ctx, 519, 195, 8, 6, "#e9cf84");
  px(ctx, 535, 190, 2, 13, "#c8b485");
  drawMonitor(ctx, 548, 191, "cover", palette, 28, 17);
  drawMug(ctx, 494, 197, "#d5a55b");
  drawPapers(ctx, 580, 210, 2);
  drawPlant(ctx, 470, 266, palette, 0.8);

  drawDesk(ctx, 652, 186, 122, 38, "#996341", "#633f28", "#d0ad82");
  drawMonitor(ctx, 674, 191, "instagram", palette, 30, 17);
  // Phone on a little tripod.
  px(ctx, 724, 185, 10, 16, OUTLINE);
  px(ctx, 725, 186, 8, 13, "#f0d9b3");
  px(ctx, 727, 188, 4, 6, "#f0a6ab");
  px(ctx, 727, 196, 4, 1, "#a4835b");
  px(ctx, 728, 201, 2, 8, "#4d3b2b");
  px(ctx, 725, 208, 8, 2, "#35281e");
  drawKeyboard(ctx, 690, 209, 22, "#e0d1b4");
  drawMug(ctx, 742, 208, "#e8b6a9");
  drawRingStand(ctx, 768, 184);
  drawSofa(ctx, 690, 252, 82, 24);
  drawPlant(ctx, 630, 202, palette, 1);
  drawPlant(ctx, 774, 274, palette, 0.85);
  // Stray sketchbook on the rug.
  px(ctx, 592, 232, 18, 12, OUTLINE);
  px(ctx, 593, 233, 16, 10, "#e7d7b6");
  px(ctx, 596, 236, 8, 1, "#9e8868");
  px(ctx, 596, 239, 5, 1, "#9e8868");
}

function paintHallDecor(ctx: Ctx, palette: ScenePalette) {
  // Sconces on the corridor side of the lower rooms.
  const sconces = [
    [92, 344],
    [344, 344],
    [506, 344],
    [764, 344],
  ] as const;
  sconces.forEach(([x, y]) => {
    px(ctx, x, y, 10, 4, "#5a432d");
    px(ctx, x + 2, y + 2, 6, 4, "#e5c276");
    px(ctx, x + 3, y + 4, 4, 1, "#fff1c5");
  });

  // Entrance mat.
  drawRug(ctx, 403, 524, 34, 28, "#355f58", "#c5a562", "#e4c88c");

  // Small console at the top of the vertical hall.
  px(ctx, 401, 96, 38, 12, OUTLINE);
  px(ctx, 402, 97, 36, 10, "#68472e");
  px(ctx, 404, 99, 32, 1, "#98704b");
  drawPlant(ctx, 408, 95, palette, 0.68);
  drawPlant(ctx, 424, 95, palette, 0.68);
  // A low bench at the end of the left corridor.
  px(ctx, 50, 312, 4, 24, "#5b3e2a");
  px(ctx, 52, 312, 16, 24, OUTLINE);
  px(ctx, 53, 314, 14, 8, "#7c5538");
  px(ctx, 53, 322, 14, 11, "#62422c");
  px(ctx, 55, 325, 10, 1, "#9a7350");
}

function buildStaticScene(ctx: Ctx, theme: ThemeMode) {
  const palette = PALETTES[theme];
  ctx.clearRect(0, 0, 840, 600);
  ctx.imageSmoothingEnabled = false;
  paintExterior(ctx, palette, theme);

  // Building cast shadow, slab, and overall border.
  ctx.fillStyle = "rgba(5, 10, 9, 0.28)";
  ctx.fillRect(38, 84, 780, 490);
  px(ctx, 34, 78, 772, 488, "#1a1410");
  paintHallway(ctx, palette);
  paintRoomFloors(ctx);
  paintWalls(ctx, palette, theme);

  paintGeneralManagerRoom(ctx, palette);
  paintEmailRoom(ctx, palette);
  paintFinanceRoom(ctx, palette);
  paintCreativeRoom(ctx, palette);
  paintHallDecor(ctx, palette);

  // Entrance glass doors.
  px(ctx, 390, 564, 60, 4, "#2f2119");
  px(ctx, 392, 566, 26, 6, "rgba(158, 211, 209, 0.35)");
  px(ctx, 422, 566, 26, 6, "rgba(158, 211, 209, 0.35)");
  px(ctx, 418, 566, 3, 6, "#d3ae6a");
  px(ctx, 392, 566, 1, 6, "#dfc489");
  px(ctx, 447, 566, 1, 6, "#dfc489");
}

export function paintStaticOffice(ctx: Ctx, theme: ThemeMode) {
  buildStaticScene(ctx, theme);
}

interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  alpha: number;
}

const SCREEN_LIGHTS: LightSource[] = [
  { x: 228, y: 202, radius: 46, color: [111, 222, 194], alpha: 0.45 },
  { x: 195, y: 454, radius: 34, color: [111, 211, 204], alpha: 0.32 },
  { x: 226, y: 454, radius: 34, color: [111, 211, 204], alpha: 0.32 },
  { x: 620, y: 455, radius: 42, color: [191, 218, 139], alpha: 0.38 },
  { x: 660, y: 455, radius: 32, color: [191, 218, 139], alpha: 0.26 },
  { x: 562, y: 199, radius: 34, color: [240, 174, 132], alpha: 0.32 },
  { x: 689, y: 199, radius: 36, color: [238, 147, 158], alpha: 0.34 },
  { x: 768, y: 158, radius: 42, color: [255, 240, 203], alpha: 0.4 },
];

const DESK_LIGHTS: LightSource[] = [
  { x: 166, y: 192, radius: 34, color: [255, 205, 124], alpha: 0.32 },
  { x: 134, y: 447, radius: 28, color: [255, 205, 124], alpha: 0.28 },
  { x: 550, y: 450, radius: 26, color: [255, 205, 124], alpha: 0.24 },
  { x: 92, y: 346, radius: 22, color: [255, 201, 119], alpha: 0.26 },
  { x: 344, y: 346, radius: 22, color: [255, 201, 119], alpha: 0.26 },
  { x: 506, y: 346, radius: 22, color: [255, 201, 119], alpha: 0.26 },
  { x: 764, y: 346, radius: 22, color: [255, 201, 119], alpha: 0.26 },
];

const WINDOWS = [
  { x: 252, y: 96, width: 80, room: { x: 52, y: 98, w: 324, h: 188 } },
  { x: 612, y: 96, width: 116, room: { x: 464, y: 98, w: 324, h: 188 } },
  { x: 248, y: 362, width: 80, room: { x: 52, y: 364, w: 324, h: 188 } },
  { x: 576, y: 362, width: 88, room: { x: 464, y: 364, w: 324, h: 188 } },
];

function drawRadialGlow(ctx: Ctx, source: LightSource, strength = 1) {
  const { x, y, radius, color, alpha } = source;
  const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
  const [r, g, b] = color;
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * strength})`);
  gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${alpha * strength * 0.38})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawDaylight(ctx: Ctx, time: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const window of WINDOWS) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(window.room.x, window.room.y, window.room.w, window.room.h);
    ctx.clip();
    const beamAlpha = 0.07;
    ctx.fillStyle = `rgba(255, 218, 151, ${beamAlpha})`;
    ctx.beginPath();
    ctx.moveTo(window.x, window.y);
    ctx.lineTo(window.x + window.width, window.y);
    ctx.lineTo(window.x + window.width + 44, window.y + 138);
    ctx.lineTo(window.x + 18, window.y + 138);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 228, 173, ${beamAlpha * 0.75})`;
    ctx.beginPath();
    ctx.moveTo(window.x + 12, window.y);
    ctx.lineTo(window.x + window.width - 10, window.y);
    ctx.lineTo(window.x + window.width + 8, window.y + 96);
    ctx.lineTo(window.x - 12, window.y + 96);
    ctx.closePath();
    ctx.fill();

    // Slow dust motes inside the light shaft.
    ctx.fillStyle = "rgba(255, 245, 208, 0.32)";
    for (let index = 0; index < 5; index += 1) {
      const drift = (time * 0.006 + index * 31 + window.x) % 80;
      const moteY = window.y + 26 + ((time * 0.002 + index * 37) % 82);
      ctx.fillRect(
        Math.round(window.x + 16 + drift + index * 3) % (window.room.x + window.room.w),
        Math.round(moteY),
        1,
        1,
      );
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const source of SCREEN_LIGHTS) drawRadialGlow(ctx, source, 0.2);
  ctx.restore();
}

function drawNightLight(ctx: Ctx, time: number) {
  ctx.save();
  ctx.fillStyle = "rgba(7, 12, 23, 0.53)";
  ctx.fillRect(0, 0, 840, 600);

  ctx.globalCompositeOperation = "lighter";
  const flicker = 0.94 + Math.sin(time / 820) * 0.06;
  for (const source of SCREEN_LIGHTS) drawRadialGlow(ctx, source, flicker);
  for (const source of DESK_LIGHTS) drawRadialGlow(ctx, source, 1);
  drawRadialGlow(
    ctx,
    { x: 768, y: 158, radius: 46, color: [255, 248, 226], alpha: 0.26 },
    1.1,
  );
  drawRadialGlow(
    ctx,
    { x: 714, y: 116, radius: 30, color: [241, 139, 156], alpha: 0.16 },
    1,
  );

  // Cool moonlight from windows.
  ctx.save();
  for (const window of WINDOWS) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(window.room.x, window.room.y, window.room.w, window.room.h);
    ctx.clip();
    ctx.fillStyle = "rgba(117, 156, 208, 0.06)";
    ctx.beginPath();
    ctx.moveTo(window.x, window.y);
    ctx.lineTo(window.x + window.width, window.y);
    ctx.lineTo(window.x + window.width + 30, window.y + 112);
    ctx.lineTo(window.x + 6, window.y + 112);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();

  // Warm vignette, drawn over the lights for depth.
  const vignette = ctx.createRadialGradient(420, 300, 140, 420, 300, 510);
  vignette.addColorStop(0, "rgba(5, 9, 16, 0)");
  vignette.addColorStop(0.7, "rgba(5, 9, 16, 0.12)");
  vignette.addColorStop(1, "rgba(5, 9, 16, 0.48)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 840, 600);
}

function drawWorkingEffects(ctx: Ctx, agent: Agent, time: number) {
  if (agent.status !== "working") return;
  const { x, y } = agent.position;

  if (agent.id === "email") {
    for (let index = 0; index < 3; index += 1) {
      const progress = ((time / 2100 + index * 0.33) % 1 + 1) % 1;
      const ease = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
      const envelopeX = 280 - ease * 60;
      const envelopeY = 446 - Math.sin(progress * Math.PI) * 30 - progress * 28;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.9;
      drawEnvelope(ctx, envelopeX, envelopeY, 1);
    }
    ctx.globalAlpha = 1;
  } else if (agent.id === "instagram") {
    for (let index = 0; index < 2; index += 1) {
      const progress = ((time / 2600 + index * 0.5) % 1 + 1) % 1;
      const heartX = 742 - index * 10 + Math.sin(progress * Math.PI * 2) * 3;
      const heartY = 214 - progress * 38;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.9;
      drawHeart(ctx, heartX, heartY, index === 0 ? "#f3a8ae" : "#f0d090");
    }
    ctx.globalAlpha = 1;
  } else if (agent.id === "gm") {
    const progress = ((time / 2800) % 1 + 1) % 1;
    ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.8;
    const paperX = x + 14 + progress * 30;
    const paperY = y - 20 - Math.sin(progress * Math.PI) * 22;
    px(ctx, paperX, paperY, 10, 8, OUTLINE);
    px(ctx, paperX + 1, paperY + 1, 8, 6, "#f1e1be");
    px(ctx, paperX + 3, paperY + 3, 4, 1, "#9d845e");
    px(ctx, paperX + 3, paperY + 5, 6, 1, "#9d845e");
    ctx.globalAlpha = 1;
  } else if (agent.id === "cover") {
    for (let index = 0; index < 3; index += 1) {
      const progress = ((time / 2900 + index * 0.31) % 1 + 1) % 1;
      const dotX = x + 18 + Math.sin(progress * Math.PI * 2 + index) * 12;
      const dotY = y - 16 - progress * 25;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.85;
      px(ctx, dotX, dotY, 2, 2, ["#e8b566", "#78bfae", "#e28b64"][index]);
    }
    ctx.globalAlpha = 1;
  } else if (agent.id === "finance") {
    for (let index = 0; index < 2; index += 1) {
      const progress = ((time / 3200 + index * 0.5) % 1 + 1) % 1;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.7;
      const coinX = x + 16 + Math.sin(progress * Math.PI * 2) * 4;
      const coinY = y - 14 - progress * 20;
      px(ctx, coinX, coinY, 3, 3, "#e3c06b");
      px(ctx, coinX + 1, coinY + 1, 1, 1, "#8f7134");
    }
    ctx.globalAlpha = 1;
  }
}

function drawScreenFlicker(ctx: Ctx, time: number, workingAgents: Set<AgentId>) {
  const screens: Array<{ id: AgentId; x: number; y: number; w: number; h: number }> = [
    { id: "gm", x: 214, y: 195, w: 28, h: 14 },
    { id: "email", x: 180, y: 448, w: 24, h: 12 },
    { id: "email", x: 212, y: 448, w: 24, h: 12 },
    { id: "finance", x: 608, y: 448, w: 28, h: 13 },
    { id: "cover", x: 550, y: 193, w: 24, h: 13 },
    { id: "instagram", x: 676, y: 193, w: 26, h: 13 },
  ];
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (const screen of screens) {
    const glow = workingAgents.has(screen.id) ? 1 : 0.35;
    const scan = Math.floor((time / 620 + screen.x) % screen.h);
    px(ctx, screen.x + 1, screen.y + scan, screen.w - 2, 1, `rgba(214, 255, 236, ${0.28 * glow})`);
  }
  ctx.restore();
}

export interface DynamicSceneOptions {
  agents: Agent[];
  theme: ThemeMode;
  filter: AgentStatus | "all";
  time: number;
}

export function paintDynamicOffice(ctx: Ctx, options: DynamicSceneOptions) {
  const { agents, theme, filter, time } = options;
  // The caller composites this over the static office layer; clearing here would erase it.
  ctx.imageSmoothingEnabled = false;

  const workingAgents = new Set(
    agents.filter((agent) => agent.status === "working").map((agent) => agent.id),
  );

  // Draw agents back-to-front so lower desks overlap characters naturally.
  const sorted = [...agents].sort((a, b) => a.position.y - b.position.y);
  for (const agent of sorted) {
    const dimmed = filter !== "all" && agent.status !== filter;
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.25 : 1;
    drawAgentSprite(ctx, agent, time);
    drawWorkingEffects(ctx, agent, time);
    ctx.restore();
  }

  drawScreenFlicker(ctx, time, workingAgents);

  if (theme === "night") {
    drawNightLight(ctx, time);
  } else {
    drawDaylight(ctx, time);
  }
}

export function roomAtPoint(x: number, y: number) {
  return ROOMS.find(
    (room) =>
      x >= room.rect.x &&
      x <= room.rect.x + room.rect.w &&
      y >= room.rect.y &&
      y <= room.rect.y + room.rect.h,
  );
}
