import type {
  Agent,
  AgentStatus,
  FurnitureStyle,
  Room,
  ThemeMode,
} from "@/data/agents";
import {
  INITIAL_ROOMS,
  OFFICE_GRID,
  getWorldDimensions,
  type WorldDimensions,
} from "@/data/agents";
import { drawAgentSprite } from "./pixel-sprites";

type Ctx = CanvasRenderingContext2D;

const OUTLINE = "#1f1712";
const SHADOW = "rgba(15, 10, 6, 0.26)";
const DEEP_SHADOW = "rgba(12, 8, 5, 0.34)";

interface ScenePalette {
  outside: string;
  outsideAlt: string;
  paverGrout: string;
  paverHighlight: string;
  gardenSoil: string;
  hallA: string;
  hallB: string;
  hallGrout: string;
  wall: string;
  wallLight: string;
  wallDark: string;
  wainscot: string;
  trim: string;
  sky: string;
  skyLight: string;
  windowGlow: string;
  leaf: string;
  leafMid: string;
  leafDark: string;
}

const PALETTES: Record<ThemeMode, ScenePalette> = {
  day: {
    outside: "#cbb995",
    outsideAlt: "#c0ae89",
    paverGrout: "#a89673",
    paverHighlight: "#dfd1b1",
    gardenSoil: "#6e553b",
    hallA: "#ddd0af",
    hallB: "#d2c39f",
    hallGrout: "#b9a882",
    wall: "#4e3627",
    wallLight: "#725139",
    wallDark: "#302118",
    wainscot: "#5e4330",
    trim: "#d8aa5b",
    sky: "#98d2db",
    skyLight: "#daf2ed",
    windowGlow: "#f9e8b2",
    leaf: "#689861",
    leafMid: "#507d4f",
    leafDark: "#365a3a",
  },
  night: {
    outside: "#0f1a1b",
    outsideAlt: "#0b1516",
    paverGrout: "#081011",
    paverHighlight: "#192829",
    gardenSoil: "#18211b",
    hallA: "#3c4942",
    hallB: "#33403a",
    hallGrout: "#26312c",
    wall: "#322821",
    wallLight: "#4c3b2f",
    wallDark: "#1f1712",
    wainscot: "#3d2f25",
    trim: "#957442",
    sky: "#12243a",
    skyLight: "#253e56",
    windowGlow: "#8da7bf",
    leaf: "#3f6550",
    leafMid: "#2e4e3e",
    leafDark: "#20392d",
  },
};

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x * 2) / 2,
    Math.round(y * 2) / 2,
    Math.round(w * 2) / 2,
    Math.round(h * 2) / 2,
  );
}

function shade(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.2) {
  ctx.fillStyle = `rgba(18, 11, 6, ${alpha})`;
  ctx.fillRect(
    Math.round(x * 2) / 2,
    Math.round(y * 2) / 2,
    Math.round(w * 2) / 2,
    Math.round(h * 2) / 2,
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return [216, 165, 74];
  const n = Number.parseInt(cleaned, 16);
  if (Number.isNaN(n)) return [216, 165, 74];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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
  ornate = false,
) {
  px(ctx, x + 2, y + 3, w, h, SHADOW);
  px(ctx, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  px(ctx, x, y, w, h, border);
  px(ctx, x + 2, y + 2, w - 4, h - 4, base);
  px(ctx, x + 4.5, y + 4.5, w - 9, 1, border);
  px(ctx, x + 4.5, y + h - 5.5, w - 9, 1, border);
  px(ctx, x + 4.5, y + 4.5, 1, h - 9, border);
  px(ctx, x + w - 5.5, y + 4.5, 1, h - 9, border);

  const midY = Math.round(y + h / 2);
  const midX = Math.round(x + w / 2);

  if (ornate) {
    px(ctx, midX - 10, midY - 6, 20, 12, border);
    px(ctx, midX - 8, midY - 4, 16, 8, pattern);
    px(ctx, midX - 4, midY - 2, 8, 4, base);
    px(ctx, midX - 1.5, midY - 1, 3, 2, border);
    for (const dx of [-36, 36]) {
      if (w > 110) {
        px(ctx, midX + dx - 4, midY - 3, 8, 6, border);
        px(ctx, midX + dx - 2, midY - 1.5, 4, 3, pattern);
      }
    }
  } else {
    for (let offset = -18; offset <= 18; offset += 12) {
      px(ctx, midX + offset, midY - 2, 4, 1, pattern);
      px(ctx, midX + offset + 1, midY - 1, 2, 1, pattern);
      px(ctx, midX + offset + 2, midY, 1, 1, pattern);
    }
    px(ctx, midX - 26, midY - 1, 10, 2, pattern);
    px(ctx, midX + 18, midY - 1, 10, 2, pattern);
  }

  px(ctx, x + 7, y + 7, 3, 3, pattern);
  px(ctx, x + w - 10, y + 7, 3, 3, pattern);
  px(ctx, x + 7, y + h - 10, 3, 3, pattern);
  px(ctx, x + w - 10, y + h - 10, 3, 3, pattern);

  for (let fx = x + 2; fx < x + w - 2; fx += 3.5) {
    px(ctx, fx, y - 3, 1, 2, border);
    px(ctx, fx, y + h + 1, 1, 2, border);
  }
}

function drawPlant(ctx: Ctx, x: number, y: number, palette: ScenePalette, scale = 1) {
  const potW = Math.round(11 * scale);
  const potH = Math.round(8.5 * scale);
  const baseY = Math.round(y);
  px(ctx, x - 2, baseY + 1, potW + 5, 3, SHADOW);
  px(ctx, x, baseY - potH, potW, potH, OUTLINE);
  px(ctx, x + 1, baseY - potH + 1, potW - 2, potH - 2, "#9a593b");
  px(ctx, x + 1, baseY - potH + 1, 3, potH - 2, "#b56e4b");
  px(ctx, x - 0.5, baseY - potH, potW + 1, 2.5, "#bd7652");
  px(ctx, x + 1, baseY - potH + 0.5, potW - 2, 1, "#d9936a");
  px(ctx, x + 1.5, baseY - potH + 2.5, potW - 3, 1, "#452d1d");
  px(ctx, x + potW / 2 - 1, baseY - potH - 13 * scale, 2, 13 * scale, palette.leafDark);
  px(ctx, x - 4 * scale, baseY - potH - 9 * scale, 6 * scale, 5.5 * scale, palette.leafDark);
  px(ctx, x + potW - 2.5 * scale, baseY - potH - 11 * scale, 6 * scale, 5.5 * scale, palette.leafMid);
  px(ctx, x + potW / 2 - 4.5 * scale, baseY - potH - 15 * scale, 5 * scale, 5 * scale, palette.leafMid);
  px(ctx, x + potW / 2, baseY - potH - 13 * scale, 4.5 * scale, 4.5 * scale, palette.leaf);
  px(ctx, x - 2.5 * scale, baseY - potH - 11 * scale, 3.5 * scale, 3 * scale, palette.leaf);
  px(ctx, x + potW / 2 - 2 * scale, baseY - potH - 16 * scale, 3 * scale, 2.5 * scale, palette.leaf);
  px(ctx, x + potW / 2 - 1, baseY - potH - 7.5 * scale, 2.5 * scale, 4.5 * scale, palette.leaf);
}

function drawCourtyardTree(ctx: Ctx, x: number, y: number, palette: ScenePalette, theme: ThemeMode) {
  px(ctx, x - 8, y + 6, 20, 6, DEEP_SHADOW);
  px(ctx, x - 2, y - 3, 5, 11, "#4a301e");
  px(ctx, x - 1, y - 3, 2, 10, "#68452c");
  px(ctx, x - 11, y - 16, 23, 15, OUTLINE);
  px(ctx, x - 10, y - 15, 21, 13, palette.leafDark);
  px(ctx, x - 9, y - 18, 19, 12, palette.leafMid);
  px(ctx, x - 7, y - 21, 14, 9, palette.leaf);
  px(ctx, x - 4, y - 20, 7, 4, theme === "day" ? "#84b678" : "#517c62");
  if (theme === "day") {
    px(ctx, x - 5, y - 13, 2, 2, "#f0d394");
    px(ctx, x + 4, y - 16, 2, 2, "#e8b48c");
  }
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
  px(ctx, x + 3, y + 4.5, w, h, DEEP_SHADOW);
  px(ctx, x - 0.5, y - 0.5, w + 1, h + 1, OUTLINE);
  px(ctx, x, y, w, h, edge);
  px(ctx, x + 1, y + 1, w - 2, h - 3.5, top);
  px(ctx, x + 2, y + 1.5, w - 4, 1.5, "#c58f5c");
  px(ctx, x + 1, y + h - 5.5, w - 2, 3.5, "#3d2517");
  px(ctx, x + 1, y + h - 6.5, w - 2, 1, "#553622");
  for (let plank = x + 18; plank < x + w - 4; plank += 22) {
    px(ctx, plank, y + 3.5, 1, h - 10, "rgba(74, 42, 22, 0.34)");
  }
  if (inset) {
    px(ctx, x + 19, y + 5.5, w - 38, h - 13, "#432818");
    px(ctx, x + 20, y + 6.5, w - 40, h - 15, inset);
    px(ctx, x + 21, y + 7, w - 42, 1, "rgba(255,255,255,0.12)");
  }
  px(ctx, x + 4, y + h - 8.5, 6, 3, "#2b1c12");
  px(ctx, x + 5, y + h - 8, 4, 2, "#dfb264");
  px(ctx, x + w - 10, y + h - 8.5, 6, 3, "#2b1c12");
  px(ctx, x + w - 9, y + h - 8, 4, 2, "#dfb264");
}

function drawKeyboard(ctx: Ctx, x: number, y: number, w = 24, color = "#cfc3aa") {
  px(ctx, x - 1, y, w + 2, 6, OUTLINE);
  px(ctx, x, y + 1, w, 4, color);
  for (let key = x + 2; key < x + w - 1; key += 2.5) {
    px(ctx, key, y + 1.5, 1.5, 1, "#675c4d");
    px(ctx, key, y + 3, 1.5, 1, "#837665");
  }
  px(ctx, x + w + 3.5, y - 0.5, 7, 7, "#2a3531");
  px(ctx, x + w + 5, y + 1, 4, 4, OUTLINE);
  px(ctx, x + w + 5.5, y + 1.5, 3, 3, "#e4d8be");
}

function drawMug(ctx: Ctx, x: number, y: number, color = "#d96c52") {
  px(ctx, x - 1.5, y + 4.5, 7, 3, "#7a5335");
  px(ctx, x - 1, y, 6, 7, OUTLINE);
  px(ctx, x, y + 1, 4, 5, color);
  px(ctx, x + 4, y + 2, 2, 3, color);
  px(ctx, x + 4, y + 3, 1, 1, "#2a211a");
  px(ctx, x + 0.5, y + 1.5, 3, 1, "#4e2e1d");
  px(ctx, x + 1, y + 1, 2, 0.5, "rgba(255,255,255,0.4)");
}

function drawPapers(ctx: Ctx, x: number, y: number, count = 3) {
  for (let index = 0; index < count; index += 1) {
    const offset = index * 2;
    px(ctx, x + offset, y - offset, 12, 9, OUTLINE);
    px(ctx, x + 1 + offset, y + 1 - offset, 10, 7, index % 2 === 0 ? "#f4e8cd" : "#ebe0c4");
    px(ctx, x + 3 + offset, y + 3 - offset, 6, 1, "#a58f6f");
    px(ctx, x + 3 + offset, y + 5 - offset, 4, 1, "#829d93");
  }
}

function drawMonitor(
  ctx: Ctx,
  x: number,
  y: number,
  style: FurnitureStyle,
  accent: string,
  width = 30,
  height = 18,
  secondary = false,
) {
  const [r, g, b] = hexToRgb(accent);
  px(ctx, x + 2, y + height + 1, width - 4, 5, `rgba(${r}, ${g}, ${b}, 0.16)`);

  px(ctx, x + width / 2 - 4, y + height + 2, 8, 2, OUTLINE);
  px(ctx, x + width / 2 - 2, y + height - 0.5, 4, 3.5, "#332c26");
  px(ctx, x, y, width, height, OUTLINE);
  px(ctx, x + 1, y + 1, width - 2, 1, "#4c4136");
  px(ctx, x + 1.5, y + 1.5, width - 3, height - 4, style === "tech" ? "#0d1a22" : "#12201e");
  px(ctx, x + 2, y + 2, width - 4, 2, style === "tech" ? "#1d3d4f" : "#24433e");

  if (style === "tech") {
    if (!secondary) {
      px(ctx, x + 4, y + 5.5, 9, 1.5, "#67d7ec");
      px(ctx, x + 6, y + 8, 16, 1.5, "#94e0a8");
      px(ctx, x + 6, y + 10.5, 12, 1.5, "#f0c86d");
      px(ctx, x + 4, y + 13, 18, 1.5, "#74b6e8");
    } else {
      px(ctx, x + 4, y + 5.5, width - 8, 2.5, "#234a54");
      px(ctx, x + 4, y + 9.5, 8, 4.5, "#5dc9b4");
      px(ctx, x + 14, y + 9.5, 9, 4.5, "#d8b467");
    }
  } else if (style === "finance") {
    px(ctx, x + 5.5, y + 11.5, 3, 3.5, "#7ca56b");
    px(ctx, x + 10.5, y + 8.5, 3, 6.5, "#a5c682");
    px(ctx, x + 15.5, y + 5, 3, 10, "#dcc179");
    px(ctx, x + 20.5, y + 7, 3, 8, "#8eb99a");
    px(ctx, x + 5, y + 4, 20, 1, "#c7dca0");
  } else if (style === "creative") {
    px(ctx, x + 4.5, y + 5, 6, 6.5, "#e98f64");
    px(ctx, x + 11.5, y + 5, 6, 6.5, "#78c7b7");
    px(ctx, x + 18.5, y + 5, 6, 6.5, "#e8c66d");
    px(ctx, x + 4.5, y + 12.5, 20, 1.5, "#d8b58d");
  } else {
    px(ctx, x + 4.5, y + 5.5, 5.5, 8.5, "#3c7367");
    px(ctx, x + 11.5, y + 4.5, 5.5, 9.5, "#6aa398");
    px(ctx, x + 18.5, y + 7.5, 5.5, 6.5, "#d8b56d");
    px(ctx, x + 4.5, y + 4, 20, 1, "#87cabb");
    px(ctx, x + 25.5, y + 5.5, 2, 2, "#e68e6b");
  }

  px(ctx, x + width - 9, y + 3, 5, 1, "rgba(255,255,255,0.22)");
  px(ctx, x + width - 3, y + height - 2, 1.5, 1.5, accent || "#8be0c9");
}

function drawDeskLamp(ctx: Ctx, x: number, y: number, accent = "#dcb563") {
  px(ctx, x - 1, y + 6, 12, 2.5, "#2f2218");
  px(ctx, x + 3, y - 5, 2, 11, "#7b6342");
  px(ctx, x + 3, y - 7.5, 9.5, 4.5, OUTLINE);
  px(ctx, x + 4, y - 6.5, 7.5, 2.5, accent);
  px(ctx, x + 9, y - 5.5, 2.5, 2, "#fff0ba");
}

function drawBookshelf(ctx: Ctx, x: number, y: number, w: number, h: number, palette: ScenePalette) {
  px(ctx, x + 2, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#5b3b26");
  for (let shelfY = y + 6; shelfY < y + h - 4; shelfY += 12) {
    px(ctx, x + 2, shelfY, w - 4, 2, "#392316");
    const colors = ["#c87153", "#dfb664", "#6b9a84", "#8a6d98", "#5f8896"];
    for (let book = 0; book < 4; book += 1) {
      const bh = 6 + ((book + shelfY) % 3);
      px(ctx, x + 2.5 + book * 3, shelfY - bh, 2.5, bh, colors[(book + shelfY) % colors.length]);
    }
  }
  px(ctx, x, y, w, 2, palette.trim);
  px(ctx, x + 5, y - 5, 6, 5, OUTLINE);
  px(ctx, x + 6, y - 4, 4, 3, "#6aa494");
  px(ctx, x + 7, y - 1, 2, 1.5, "#d8aa5b");
}

function drawServerRack(ctx: Ctx, x: number, y: number, accent: string) {
  px(ctx, x + 2, y + 3, 24, 54, DEEP_SHADOW);
  px(ctx, x, y, 24, 54, OUTLINE);
  px(ctx, x + 1, y + 1, 22, 52, "#242c33");
  px(ctx, x + 2, y + 2, 20, 2, "#3d4954");
  for (let slot = 0; slot < 4; slot += 1) {
    const sy = y + 7 + slot * 11;
    px(ctx, x + 2.5, sy, 19, 8.5, "#151a1f");
    px(ctx, x + 4, sy + 2, 11, 1.5, "#364552");
    px(ctx, x + 4, sy + 5, 8, 1.5, "#2b3742");
    px(ctx, x + 17.5, sy + 3, 2, 2, slot % 2 === 0 ? accent : "#6ae3a3");
  }
}

function drawWhiteboard(ctx: Ctx, x: number, y: number, w: number, h: number, accent: string) {
  px(ctx, x + 2, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, "#2b1d14");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#ebe3d0");
  px(ctx, x, y, w, 2, "#8799a6");
  // Architecture boxes & connectors drawn on whiteboard.
  px(ctx, x + 6, y + 6, 16, 7, "#3a6e7e");
  px(ctx, x + 28, y + 6, 16, 7, accent || "#5aa9e6");
  px(ctx, x + 50, y + 6, 16, 7, "#5a8e72");
  px(ctx, x + 22, y + 9, 6, 1.5, "#425059");
  px(ctx, x + 44, y + 9, 6, 1.5, "#425059");
  px(ctx, x + 10, y + 17, 24, 1.5, "#7e8a94");
  px(ctx, x + 10, y + 21, 38, 1.5, "#a0aab2");
  // Marker tray.
  px(ctx, x + 10, y + h - 2, 26, 2, "#59636b");
}

function drawCabinet(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 2, y + 3, w, h, DEEP_SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#787567");
  px(ctx, x + 2, y + 2.5, w - 4, 1.5, "#b5afa0");
  for (let drawer = 0; drawer < 3; drawer += 1) {
    const dy = y + 6 + drawer * 17;
    px(ctx, x + 2.5, dy, w - 5, 14, "#615e51");
    px(ctx, x + 3.5, dy + 1, w - 7, 1, "#8c8777");
    px(ctx, x + w / 2 - 4, dy + 4, 8, 3, "#c9b67e");
    px(ctx, x + w / 2 - 3, dy + 5, 6, 1, "#f2e7ca");
    px(ctx, x + w / 2 - 2.5, dy + 9, 5, 2, "#d8c38a");
  }
}

function drawSafe(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 3, y + 4, w, h, DEEP_SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#80867c");
  px(ctx, x + 2, y + 2, w - 4, 2.5, "#b3b6aa");
  px(ctx, x + 3.5, y + 5, w - 7, h - 8.5, "#676e65");
  px(ctx, x + 3, y + 8, 2.5, 6, "#414641");
  px(ctx, x + 3, y + h - 14, 2.5, 6, "#414641");
  for (const ry of [7, 18, 29, 39]) {
    px(ctx, x + 5, y + ry, 1, 1, "#c4c7ba");
    px(ctx, x + w - 6, y + ry, 1, 1, "#c4c7ba");
  }
  const dx = x + w - 12;
  const dy = y + Math.floor(h / 2) - 4;
  px(ctx, dx, dy, 8, 8, "#2b322e");
  px(ctx, dx + 1.5, dy + 1.5, 5, 5, "#ddb864");
  px(ctx, dx + 3, dy + 3, 2, 2, "#594520");
  px(ctx, x + 7, y + 8, 9, 4, "#363c37");
  px(ctx, x + 8, y + 9, 7, 2, "#c8cbbd");
  px(ctx, x + 1, y + h - 3, w - 2, 2, "#464c46");
}

function drawSofa(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 2, y + 3.5, w, h, DEEP_SHADOW);
  px(ctx, x, y, w, h, OUTLINE);
  px(ctx, x + 1, y + 1, w - 2, 6.5, "#875440");
  px(ctx, x + 2, y + 2, w - 4, 1.5, "#a96e56");
  px(ctx, x + 1, y + 7, 6, h - 9, "#734430");
  px(ctx, x + w - 7, y + 7, 6, h - 9, "#734430");
  px(ctx, x + 7.5, y + 8, w - 15, h - 12, "#ad7157");
  px(ctx, x + 7.5, y + 8, w - 15, 2, "#ca8e6e");
  px(ctx, x + w / 2 - 1, y + 9, 2, h - 14, "#8b5641");
  px(ctx, x + 9, y + 9, 9, 7, "#dfb869");
  px(ctx, x + 10, y + 10, 7, 5, "#f0cf84");
  px(ctx, x + w - 19, y + 9, 9, 7, "#5e8f84");
  px(ctx, x + w - 18, y + 10, 7, 5, "#7bb0a3");
  px(ctx, x + 2, y + h, 3, 2, "#45291d");
  px(ctx, x + w - 5, y + h, 3, 2, "#45291d");
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
  px(ctx, x + 1.5, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, "#2c1d15");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#cea362");
  px(ctx, x + 2, y + 2, w - 4, h - 4, color);
  if (motif === "heart") {
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    px(ctx, cx - 4, cy - 3, 3, 3, "#f1ba71");
    px(ctx, cx + 1, cy - 3, 3, 3, "#f1ba71");
    px(ctx, cx - 3, cy, 7, 2, "#f1ba71");
    px(ctx, cx - 2, cy + 2, 5, 1, "#f1ba71");
    px(ctx, cx - 1, cy + 3, 3, 1, "#f1ba71");
  } else if (motif === "line") {
    px(ctx, x + 4, y + h - 5, w - 8, 1.5, "#efd8a6");
    px(ctx, x + 5, y + 4, 2, h - 9, "#efd8a6");
    px(ctx, x + 9, y + 6, 4, 4, "#d88d65");
  } else {
    px(ctx, x + 4, y + 4, w - 8, 2.5, "#f0ddb4");
    px(ctx, x + 4, y + 8, w - 10, 2, "#6c9e92");
    px(ctx, x + 4, y + h - 6, w - 8, 2.5, "#b36b50");
  }
}

function drawKanban(ctx: Ctx, x: number, y: number) {
  px(ctx, x + 2, y + 2, 96, 35, SHADOW);
  px(ctx, x, y, 96, 34, "#291a11");
  px(ctx, x + 2, y + 2, 92, 30, "#6c4b30");
  px(ctx, x + 5, y + 5, 25, 24, "#ece0c5");
  px(ctx, x + 34, y + 5, 25, 24, "#ece0c5");
  px(ctx, x + 63, y + 5, 25, 24, "#ece0c5");
  px(ctx, x + 5, y + 5, 25, 3, "#427164");
  px(ctx, x + 34, y + 5, 25, 3, "#c4904a");
  px(ctx, x + 63, y + 5, 25, 3, "#ac6350");
  const notes = [
    [8, 11, "#e8bc60"],
    [8, 19, "#85b59f"],
    [18, 14, "#d9926c"],
    [37, 11, "#d68b6c"],
    [37, 19, "#cfc08b"],
    [48, 13, "#7ab1a4"],
    [66, 11, "#8fb7a6"],
    [66, 19, "#dfb375"],
    [77, 15, "#c97466"],
  ] as const;
  notes.forEach(([nx, ny, color]) => {
    px(ctx, x + nx, y + ny, 7.5, 5, color);
    px(ctx, x + nx + 3, y + ny - 0.5, 1.5, 1.5, "#3a291d");
  });
  px(ctx, x, y + 33, 96, 2, "#352317");
  px(ctx, x + 96, y + 4, 1, 26, "#d3ae6a");
}

function drawWallBoard(ctx: Ctx, x: number, y: number, w: number, h: number) {
  px(ctx, x + 2, y + 2, w, h, SHADOW);
  px(ctx, x, y, w, h, "#2b1d14");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#3a4d41");
  px(ctx, x, y, w, 2, "#d8b26a");
  px(ctx, x + 6, y + h - 6, 4.5, 4, "#9fbe76");
  px(ctx, x + 13, y + h - 10, 4.5, 8, "#ccb568");
  px(ctx, x + 20, y + h - 8, 4.5, 6, "#7ba58d");
  px(ctx, x + 27, y + h - 13, 4.5, 11, "#d58b60");
  px(ctx, x + 36, y + 9, w - 42, 1.5, "#8fb19c");
  px(ctx, x + 36, y + 13, w - 46, 1.5, "#c5d29a");
  px(ctx, x + 36, y + 17, w - 48, 1.5, "#d8b36b");
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
  px(ctx, x - 1.5, y - 1.5, w + 3, h + 3, "#261a13");
  px(ctx, x, y, w, h, "#6c4b32");
  px(ctx, x + 2, y + 2, w - 4, h - 4, palette.sky);
  px(ctx, x + 2, y + 2, w - 4, 2, palette.skyLight);
  const mid = x + Math.floor(w / 2);
  px(ctx, mid, y + 2, 2, h - 4, "#5b3f2a");
  px(ctx, x + 2, y + Math.floor(h / 2), w - 4, 1, "#5b3f2a");

  px(
    ctx,
    x + 2,
    y + 2,
    4,
    h - 4,
    theme === "day" ? "rgba(248, 240, 220, 0.45)" : "rgba(44, 62, 74, 0.65)",
  );
  px(
    ctx,
    x + w - 6,
    y + 2,
    4,
    h - 4,
    theme === "day" ? "rgba(248, 240, 220, 0.45)" : "rgba(44, 62, 74, 0.65)",
  );

  if (theme === "day") {
    px(ctx, x + 8, y + 4, 7, 2, "#eef8ed");
    px(ctx, x + 10, y + 3, 4, 1, "#eef8ed");
    px(ctx, mid + 8, y + 5, 6, 1.5, "#e5f2e6");
    px(ctx, x + w - 12, y + 3, 3, 3, "#f7e8a8");
  } else {
    px(ctx, x + 9, y + 3, 2, 2, "#d9e4de");
    px(ctx, x + 15, y + 6, 1, 1, "#b9cdd0");
    px(ctx, mid + 9, y + 4, 1, 1, "#d9e4de");
    px(ctx, mid + 15, y + 3.5, 3, 3.5, "#efe0a8");
  }
  px(ctx, x - 0.5, y + h - 2, w + 1, 2.5, "#d8b168");
}

function drawVerticalDoorGap(ctx: Ctx, x: number, y: number, h: number) {
  px(ctx, x + 2, y, 8, h, "#c7b28b");
  px(ctx, x + 2, y, 1.5, h, "#877151");
  px(ctx, x + 8.5, y, 1.5, h, "#877151");
  px(ctx, x + 5.5, y + 2, 1, h - 4, "#d9b468");
  px(ctx, x, y - 3, 12, 3, "#5c3f2b");
  px(ctx, x, y + h, 12, 3, "#5c3f2b");
  px(ctx, x + 1, y - 2, 2, 2, "#dfb76c");
  px(ctx, x + 1, y + h, 2, 2, "#dfb76c");
}

function drawPixelRing(ctx: Ctx, cx: number, cy: number, radius: number, color: string) {
  for (let y = -radius; y <= radius; y += 0.5) {
    for (let x = -radius; x <= radius; x += 0.5) {
      const distance = Math.sqrt(x * x + y * y);
      if (distance <= radius && distance >= radius - 1.6) {
        px(ctx, cx + x, cy + y, 0.5, 0.5, color);
      }
    }
  }
}

function drawRingStand(ctx: Ctx, x: number, topY: number, deskY: number) {
  const ringCy = topY + 72;
  drawPixelRing(ctx, x, ringCy, 11, "#2a2420");
  drawPixelRing(ctx, x, ringCy, 9, "#fff4d7");
  drawPixelRing(ctx, x, ringCy, 7, "#f8e4b7");
  px(ctx, x - 1, ringCy + 10, 2, deskY - (ringCy + 10), "#5c503c");
  px(ctx, x - 6, deskY - 2, 12, 2, "#392d22");
  px(ctx, x - 3, deskY - 4, 6, 2, "#6f5e44");
  px(ctx, x - 1, ringCy - 1, 2, 3, "#fdfdf4");
}

function paintRoomFloor(ctx: Ctx, room: Room) {
  const fx = room.rect.x + 12;
  const fy = room.rect.y + 12;
  const fw = room.rect.w - 24;
  const fh = room.rect.h - 24;

  if (room.furnitureStyle === "admin") {
    px(ctx, fx, fy, fw, fh, "#a67044");
    for (let y = fy; y < fy + fh; y += 10) {
      px(ctx, fx, y, fw, 1, "#855432");
      px(ctx, fx + ((y / 10) % 2 === 0 ? 0 : 46), y, 1, 9, "#855432");
      px(ctx, fx + 82 + ((y / 10) % 2 === 0 ? 0 : 28), y, 1, 9, "#855432");
      if ((y / 10) % 3 === 0) px(ctx, fx + 128, y + 4, 14, 1, "#bd8754");
      px(ctx, fx, y + 1, fw, 1, "rgba(255, 224, 180, 0.08)");
    }
  } else if (room.furnitureStyle === "tech") {
    px(ctx, fx, fy, fw, fh, "#6d787d");
    for (let y = fy; y < fy + fh; y += 18) {
      for (let x = fx; x < fx + fw; x += 18) {
        const alt = (Math.floor((x - fx) / 18) + Math.floor((y - fy) / 18)) % 2 === 0;
        px(ctx, x, y, 18, 18, alt ? "#69767c" : "#616e74");
        px(ctx, x, y, 18, 1, "#505c62");
        px(ctx, x, y, 1, 18, "#505c62");
        px(ctx, x + 1, y + 1, 16, 1, "rgba(205, 240, 255, 0.08)");
      }
    }
  } else if (room.furnitureStyle === "finance") {
    for (let y = fy; y < fy + fh; y += 18) {
      for (let x = fx; x < fx + fw; x += 18) {
        const alt = (Math.floor((x - fx) / 18) + Math.floor((y - fy) / 18)) % 2 === 0;
        px(ctx, x, y, 18, 18, alt ? "#7a7d6f" : "#6f7365");
        px(ctx, x, y, 18, 1, "#5d6357");
        px(ctx, x, y, 1, 18, "#5d6357");
        px(ctx, x + 1, y + 1, 16, 1, "rgba(255, 255, 240, 0.08)");
      }
    }
  } else {
    for (let y = fy; y < fy + fh; y += 16) {
      for (let x = fx; x < fx + fw; x += 16) {
        const alt = (Math.floor((x - fx) / 16) * 3 + Math.floor((y - fy) / 16)) % 7 === 0;
        px(
          ctx,
          x,
          y,
          16,
          16,
          alt ? "#ca8f68" : Math.floor(y / 16) % 2 === 0 ? "#ba7551" : "#bf7b56",
        );
        px(ctx, x, y, 16, 1, "#96583d");
        px(ctx, x, y, 1, 16, "#96583d");
        px(ctx, x + 1, y + 1, 14, 1, "rgba(255, 224, 195, 0.1)");
      }
    }
    const splats = [
      [fx + 38, fy + 140, "#e8c15f"],
      [fx + 120, fy + 150, "#6fb2a1"],
      [fx + 56, fy + 160, "#d97457"],
    ] as const;
    splats.forEach(([sx, sy, color]) => {
      px(ctx, sx, sy, 4, 2, color);
      px(ctx, sx + 3, sy + 2, 2, 1, color);
    });
  }

  shade(ctx, fx, fy, fw, 7, 0.22);
  shade(ctx, fx, fy, 6, fh, 0.18);
  shade(ctx, fx + fw - 6, fy, 6, fh, 0.16);
}

function paintRoomWalls(
  ctx: Ctx,
  room: Room,
  col: 0 | 1,
  palette: ScenePalette,
  theme: ThemeMode,
) {
  const { x: rx, y: ry, w: rw, h: rh } = room.rect;
  const wall = palette.wall;
  const light = palette.wallLight;
  const trim = palette.trim;

  // Top & Bottom horizontal walls.
  px(ctx, rx, ry, rw, 12, wall);
  px(ctx, rx, ry, rw, 2.5, light);
  px(ctx, rx, ry + rh - 12, rw, 12, wall);
  px(ctx, rx, ry + rh - 12, rw, 2.5, light);

  // Outer vertical wall.
  if (col === 0) {
    // Left wall solid; right wall opens into the central vertical hall.
    px(ctx, rx, ry, 12, rh, wall);
    px(ctx, rx, ry, 2.5, rh, light);

    const doorOffset = 82;
    const doorHeight = 46;
    px(ctx, rx + rw - 12, ry + 12, 12, doorOffset - 12, wall);
    px(ctx, rx + rw - 12, ry + 12, 2.5, doorOffset - 12, light);
    px(ctx, rx + rw - 12, ry + doorOffset + doorHeight, 12, rh - 12 - (doorOffset + doorHeight), wall);
    px(ctx, rx + rw - 12, ry + doorOffset + doorHeight, 2.5, rh - 12 - (doorOffset + doorHeight), light);
    drawVerticalDoorGap(ctx, rx + rw - 12, ry + doorOffset, doorHeight);
  } else {
    // Right wall solid; left wall opens into the central vertical hall.
    px(ctx, rx + rw - 12, ry, 12, rh, wall);
    px(ctx, rx + rw - 12, ry, 2.5, rh, light);

    const doorOffset = 82;
    const doorHeight = 46;
    px(ctx, rx, ry + 12, 12, doorOffset - 12, wall);
    px(ctx, rx, ry + 12, 2.5, doorOffset - 12, light);
    px(ctx, rx, ry + doorOffset + doorHeight, 12, rh - 12 - (doorOffset + doorHeight), wall);
    px(ctx, rx, ry + doorOffset + doorHeight, 2.5, rh - 12 - (doorOffset + doorHeight), light);
    drawVerticalDoorGap(ctx, rx, ry + doorOffset, doorHeight);
  }

  // Interior trim, wainscot, and top paned window.
  px(ctx, rx + 12, ry + 12, rw - 24, 1, trim);
  px(ctx, rx + 12, ry + rh - 12, rw - 24, 1, trim);
  px(ctx, rx + 12, ry + 13, rw - 24, 4, palette.wainscot);
  px(ctx, rx + 12, ry + rh - 14, rw - 24, 2, "#6b4e36");

  drawWindow(ctx, rx + 212, ry + 2, 82, 9, palette, theme);
}

function paintRoomFurniture(ctx: Ctx, room: Room, palette: ScenePalette) {
  const { x: rx, y: ry } = room.rect;
  const style = room.furnitureStyle;
  const accent = room.accent || "#d8a54a";

  if (style === "admin") {
    drawRug(ctx, rx + 80, ry + 60, 208, 118, "#7e3c34", "#cda763", accent, true);
    drawKanban(ctx, rx + 22, ry + 17);
    drawBookshelf(ctx, rx + 15, ry + 68, 16, 76, palette);
    drawPlant(ctx, rx + 304, ry + 168, palette, 1.2);
    drawPlant(ctx, rx + 18, ry + 154, palette, 0.92);
    drawDesk(ctx, rx + 92, ry + 100, 192, 42, "#95623c", "#5f3a24", "#2f5046");
    drawMonitor(ctx, rx + 172, ry + 107, "admin", accent, 32, 18);
    drawKeyboard(ctx, rx + 176, ry + 129, 24, "#d8c9ae");
    drawPapers(ctx, rx + 246, ry + 127, 3);
    drawMug(ctx, rx + 112, ry + 113, "#dbb164");
    drawDeskLamp(ctx, rx + 120, ry + 106, "#e3c172");
    px(ctx, rx + 141, ry + 127, 14, 9, OUTLINE);
    px(ctx, rx + 142, ry + 128, 12, 7, "#3e3024");
    px(ctx, rx + 144, ry + 129, 8, 5, "#6d5b43");
    // Visitor armchair & side table.
    px(ctx, rx + 44, ry + 154, 26, 22, SHADOW);
    px(ctx, rx + 42, ry + 152, 26, 22, OUTLINE);
    px(ctx, rx + 44, ry + 154, 22, 10, "#5c4130");
    px(ctx, rx + 46, ry + 164, 18, 8, "#7f5b43");
    px(ctx, rx + 48, ry + 166, 14, 3, "#a17954");
    px(ctx, rx + 72, ry + 161, 14, 12, OUTLINE);
    px(ctx, rx + 73, ry + 162, 12, 10, "#754c30");
    px(ctx, rx + 75, ry + 164, 7, 5, "#e8d6b0");
  } else if (style === "tech") {
    drawRug(ctx, rx + 72, ry + 58, 220, 120, "#244757", accent, "#96d7ec", true);
    drawWhiteboard(ctx, rx + 24, ry + 18, 84, 28, accent);
    drawServerRack(ctx, rx + 292, ry + 20, accent);
    drawPlant(ctx, rx + 24, ry + 162, palette, 1.15);
    drawPlant(ctx, rx + 306, ry + 166, palette, 0.95);
    drawDesk(ctx, rx + 88, ry + 100, 198, 42, "#5b483a", "#382a20", "#1b333d");
    // Wide primary + angled secondary developer monitors.
    drawMonitor(ctx, rx + 152, ry + 107, "tech", accent, 34, 18, false);
    drawMonitor(ctx, rx + 190, ry + 108, "tech", accent, 28, 17, true);
    drawKeyboard(ctx, rx + 170, ry + 129, 26, "#d4dce0");
    drawMug(ctx, rx + 108, ry + 112, accent);
    drawDeskLamp(ctx, rx + 116, ry + 106, accent);
    drawPapers(ctx, rx + 246, ry + 124, 2);
  } else if (style === "finance") {
    drawRug(ctx, rx + 74, ry + 58, 218, 118, "#545846", "#cab77d", "#e3d197", true);
    drawWallBoard(ctx, rx + 24, ry + 19, 86, 28);
    drawSafe(ctx, rx + 292, ry + 22, 32, 46);
    drawCabinet(ctx, rx + 18, ry + 66, 30, 66);
    drawPlant(ctx, rx + 306, ry + 166, palette, 1.15);
    drawDesk(ctx, rx + 88, ry + 100, 196, 40, "#866849", "#543e2d", "#41493a");
    drawMonitor(ctx, rx + 156, ry + 106, "finance", accent, 32, 17, false);
    drawMonitor(ctx, rx + 194, ry + 107, "finance", accent, 26, 15, true);
    drawKeyboard(ctx, rx + 168, ry + 127, 24, "#cdc6ae");
    drawPapers(ctx, rx + 102, ry + 114, 4);
    drawDeskLamp(ctx, rx + 96, ry + 104, "#549b76");
    drawMug(ctx, rx + 258, ry + 111, "#c9dd9f");
    px(ctx, rx + 230, ry + 108, 14, 10, OUTLINE);
    px(ctx, rx + 231, ry + 109, 12, 8, "#4b4a3c");
    px(ctx, rx + 234, ry + 111, 6, 4, "#c6d29c");
  } else {
    // Creative studio.
    drawRug(ctx, rx + 62, ry + 56, 248, 122, "#7b4b3d", "#d5af74", "#f2daac", true);
    drawArtFrame(ctx, rx + 22, ry + 19, 20, 20, "#4d756b", "line");
    drawArtFrame(ctx, rx + 46, ry + 19, 24, 18, "#c17454");
    drawArtFrame(ctx, rx + 74, ry + 19, 18, 20, "#d9b66b", "heart");
    // Studio color-swatch moodboard.
    px(ctx, rx + 99, ry + 21, 36, 18, SHADOW);
    px(ctx, rx + 98, ry + 19, 36, 18, "#291c14");
    px(ctx, rx + 99, ry + 20, 34, 16, "#4f3a2a");
    px(ctx, rx + 101, ry + 22, 9, 12, "#e88b63");
    px(ctx, rx + 111.5, ry + 22, 9, 12, "#74beb0");
    px(ctx, rx + 122, ry + 22, 9, 12, "#ebc76d");

    drawDesk(ctx, rx + 88, ry + 100, 192, 40, "#996341", "#633f28", "#c9a477");
    // Pen display + creative monitor.
    px(ctx, rx + 126, ry + 107, 30, 16, "#2c2c27");
    px(ctx, rx + 128, ry + 108, 26, 12, "#d8e6d3");
    px(ctx, rx + 130, ry + 110, 9, 3, "#e38e63");
    px(ctx, rx + 130, ry + 115, 15, 2, "#7db0a2");
    drawMonitor(ctx, rx + 170, ry + 106, "creative", accent, 30, 17, false);
    drawKeyboard(ctx, rx + 172, ry + 127, 22, "#e0d1b4");
    drawMug(ctx, rx + 104, ry + 111, "#e8b6a9");
    drawDeskLamp(ctx, rx + 244, ry + 106, accent);
    drawRingStand(ctx, rx + 266, ry, ry + 100);
    drawSofa(ctx, rx + 214, ry + 158, 76, 24);
    drawPlant(ctx, rx + 24, ry + 162, palette, 1.0);
    drawPlant(ctx, rx + 306, ry + 166, palette, 0.9);
  }
}

function paintExpansionPad(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: ScenePalette,
  theme: ThemeMode,
) {
  // Architectural landscaped courtyard pad ready for the next room expansion.
  px(ctx, x, y, w, h, theme === "day" ? "#bfb08d" : "#121e1e");
  for (let py = y + 6; py < y + h - 6; py += 20) {
    for (let pxPos = x + 8; pxPos < x + w - 12; pxPos += 28) {
      px(ctx, pxPos, py, 26, 18, theme === "day" ? "#d3c4a2" : "#1a2929");
      px(ctx, pxPos + 1, py + 1, 24, 1, theme === "day" ? "#e4d7b7" : "#243736");
    }
  }
  // Wooden pergola deck border & subtle brass blueprint corner brackets.
  px(ctx, x + 6, y + 6, w - 12, 3, "#6d4e35");
  px(ctx, x + 6, y + h - 9, w - 12, 3, "#6d4e35");
  px(ctx, x + w - 9, y + 6, 3, h - 12, "#6d4e35");
  const corner = palette.trim;
  px(ctx, x + 16, y + 16, 14, 2, corner);
  px(ctx, x + 16, y + 16, 2, 14, corner);
  px(ctx, x + w - 30, y + 16, 14, 2, corner);
  px(ctx, x + w - 18, y + 16, 2, 14, corner);
  px(ctx, x + 16, y + h - 18, 14, 2, corner);
  px(ctx, x + 16, y + h - 30, 2, 14, corner);
  px(ctx, x + w - 30, y + h - 18, 14, 2, corner);
  px(ctx, x + w - 18, y + h - 30, 2, 14, corner);

  // Garden trees, planter hedge & oak bench inside the expansion terrace.
  drawCourtyardTree(ctx, x + 86, y + 72, palette, theme);
  drawCourtyardTree(ctx, x + 264, y + 76, palette, theme);
  drawPlant(ctx, x + 56, y + 158, palette, 1.15);
  drawPlant(ctx, x + 286, y + 158, palette, 1.15);

  // Terrace bench.
  px(ctx, x + 144, y + 126, 62, 18, SHADOW);
  px(ctx, x + 142, y + 122, 62, 18, OUTLINE);
  px(ctx, x + 144, y + 124, 58, 6, "#8d613e");
  px(ctx, x + 144, y + 131, 58, 7, "#6c482d");
  px(ctx, x + 146, y + 133, 54, 1, "#b4865b");
}

function paintExterior(
  ctx: Ctx,
  palette: ScenePalette,
  theme: ThemeMode,
  world: WorldDimensions,
) {
  px(ctx, 0, 0, world.width, world.height, palette.outside);

  for (let y = 0; y < world.height; y += 24) {
    const rowOffset = (Math.floor(y / 24) % 2) * 18;
    for (let x = -18; x < world.width; x += 36) {
      const pxPos = x + rowOffset;
      const tone =
        (Math.floor(x / 36) + Math.floor(y / 24)) % 3 === 0
          ? palette.outsideAlt
          : palette.outside;
      px(ctx, pxPos, y, 36, 24, tone);
      px(ctx, pxPos, y, 36, 1, palette.paverGrout);
      px(ctx, pxPos, y, 1, 24, palette.paverGrout);
      px(ctx, pxPos + 1, y + 1, 34, 1, palette.paverHighlight);
    }
  }

  const drawBed = (bx: number, by: number, bw: number, bh: number) => {
    px(ctx, bx, by, bw, bh, "#4c3827");
    px(ctx, bx + 2, by + 2, bw - 4, bh - 4, palette.gardenSoil);
    px(ctx, bx + 3, by + 3, bw - 6, bh - 6, palette.leafDark);
  };

  // Top courtyard beds & trees.
  drawBed(16, 18, 150, 34);
  drawBed(674, 18, 150, 34);
  drawCourtyardTree(ctx, 42, 40, palette, theme);
  drawCourtyardTree(ctx, 138, 42, palette, theme);
  drawCourtyardTree(ctx, 704, 42, palette, theme);
  drawCourtyardTree(ctx, 796, 40, palette, theme);

  // Bottom courtyard beds & trees anchored to world height.
  const bottomBedY = world.height - 52;
  drawBed(16, bottomBedY, 118, 36);
  drawBed(706, bottomBedY, 118, 36);
  drawCourtyardTree(ctx, 48, bottomBedY + 20, palette, theme);
  drawCourtyardTree(ctx, 792, bottomBedY + 20, palette, theme);

  // Side planter hedges along every row.
  for (let r = 0; r < world.rowCount; r += 1) {
    const rowBaseY = OFFICE_GRID.paddingTop + r * OFFICE_GRID.rowStride;
    for (const dy of [54, 154]) {
      const hy = rowBaseY + dy;
      px(ctx, 12, hy, 12, 24, SHADOW);
      px(ctx, 10, hy - 2, 12, 22, OUTLINE);
      px(ctx, 11, hy - 1, 10, 20, palette.leafDark);
      px(ctx, 12, hy, 8, 16, palette.leafMid);
      px(ctx, 13, hy + 1, 5, 10, palette.leaf);

      px(ctx, 818, hy, 12, 24, SHADOW);
      px(ctx, 818, hy - 2, 12, 22, OUTLINE);
      px(ctx, 819, hy - 1, 10, 20, palette.leafDark);
      px(ctx, 820, hy, 8, 16, palette.leafMid);
      px(ctx, 821, hy + 1, 5, 10, palette.leaf);
    }
  }

  // Stepped stone entrance promenade anchored to buildingBottom.
  const stepY = world.buildingBottom + 4;
  px(ctx, 368, stepY, 104, 34, theme === "day" ? "#8b7b60" : "#121c1d");
  px(ctx, 374, stepY + 2, 92, 32, theme === "day" ? "#e3d4b2" : "#263331");
  px(ctx, 378, stepY + 4, 84, 5, theme === "day" ? "#f2e5c7" : "#344440");
  px(ctx, 374, stepY + 2, 3, 32, theme === "day" ? "#b6a280" : "#172221");
  px(ctx, 463, stepY + 2, 3, 32, theme === "day" ? "#b6a280" : "#172221");
  px(ctx, 378, stepY + 13, 84, 1.5, theme === "day" ? "#baa683" : "#1a2524");
  px(ctx, 378, stepY + 22, 84, 1.5, theme === "day" ? "#baa683" : "#1a2524");

  for (const lx of [376, 456]) {
    px(ctx, lx, stepY + 5, 8, 8, OUTLINE);
    px(ctx, lx + 1, stepY + 6, 6, 6, "#5a422b");
    px(ctx, lx + 2, stepY + 7, 4, 4, theme === "day" ? "#f5e3af" : "#ffd67c");
  }
  drawPlant(ctx, 356, stepY + 18, palette, 1.05);
  drawPlant(ctx, 473, stepY + 18, palette, 1.05);
}

function paintHallwayTiles(
  ctx: Ctx,
  palette: ScenePalette,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  px(ctx, x, y, w, h, palette.hallB);
  for (let ty = y; ty < y + h; ty += 14) {
    for (let tx = x; tx < x + w; tx += 14) {
      const isAlt = (Math.floor((tx - x) / 14) + Math.floor((ty - y) / 14)) % 2 === 0;
      const cw = Math.min(14, x + w - tx);
      const ch = Math.min(14, y + h - ty);
      px(ctx, tx, ty, cw, ch, isAlt ? palette.hallA : palette.hallB);
      px(ctx, tx, ty, cw, 1, palette.hallGrout);
      px(ctx, tx, ty, 1, ch, palette.hallGrout);
      if (isAlt && cw > 4 && ch > 4) {
        px(ctx, tx + 2, ty + 2, 1.5, 1.5, "rgba(255, 250, 232, 0.14)");
      }
    }
  }
}

function paintBuildingShellAndCorridors(
  ctx: Ctx,
  palette: ScenePalette,
  rooms: Room[],
  world: WorldDimensions,
) {
  const { buildingBottom, rowCount } = world;
  const hallHeight = buildingBottom - 86;

  // Cast building drop shadow & foundation border.
  ctx.fillStyle = "rgba(5, 10, 9, 0.3)";
  ctx.fillRect(38, 84, 780, hallHeight + 12);
  px(ctx, 34, 78, 772, hallHeight + 10, "#18120e");

  // Paint full building interior slab with hallway tiles first.
  paintHallwayTiles(ctx, palette, 40, 86, 760, hallHeight);

  // Central vertical spine rug.
  drawRug(
    ctx,
    402,
    118,
    36,
    Math.max(96, hallHeight - 54),
    "#7e463a",
    "#c89d5f",
    "#e3c088",
    true,
  );

  // Horizontal corridor runners between every pair of rows.
  for (let r = 0; r < rowCount - 1; r += 1) {
    const corrY = OFFICE_GRID.paddingTop + r * OFFICE_GRID.rowStride + OFFICE_GRID.roomH;
    drawRug(ctx, 70, corrY + 10, 700, 34, "#315b54", "#c5a15f", "#dfc286", true);

    // Wall sconces above lower row rooms.
    for (const sx of [92, 344, 506, 764]) {
      px(ctx, sx, corrY + 46, 10, 4, "#5a432d");
      px(ctx, sx + 2, corrY + 48, 6, 4, "#e7c478");
      px(ctx, sx + 3, corrY + 50, 4, 1.5, "#fff3ca");
    }
  }

  // Single-row lower lobby waiting bench + sconce.
  if (rowCount === 1) {
    drawRug(ctx, 84, 304, 286, 30, "#315b54", "#c5a15f", "#dfc286", false);
  }

  // Outer building perimeter shell with brass molding cap.
  px(ctx, 30, 76, 780, 9, palette.wallDark);
  px(ctx, 30, 76, 780, 2.5, palette.wallLight);
  px(ctx, 30, 76, 9, hallHeight + 18, palette.wall);
  px(ctx, 801, 76, 9, hallHeight + 18, palette.wall);
  px(ctx, 30, 76, 2.5, hallHeight + 18, palette.wallLight);
  px(ctx, 801, 76, 2.5, hallHeight + 18, palette.wallDark);

  px(ctx, 30, buildingBottom, 360, 9, palette.wallDark);
  px(ctx, 450, buildingBottom, 360, 9, palette.wallDark);
  px(ctx, 32, buildingBottom + 2.5, 358, 2, palette.trim);
  px(ctx, 450, buildingBottom + 2.5, 358, 2, palette.trim);
  px(ctx, 30, 76, 780, 1, palette.trim);
  px(ctx, 30, 76, 1, hallHeight + 18, palette.trim);

  // Welcome mat & espresso/hydration console at top of spine hall.
  drawRug(ctx, 402, buildingBottom - 40, 36, 28, "#315b54", "#c7a663", "#e6ca8e");

  px(ctx, 399, 98, 42, 15, SHADOW);
  px(ctx, 399, 96, 42, 14, OUTLINE);
  px(ctx, 400, 97, 40, 12, "#6c482e");
  px(ctx, 402, 99, 36, 1.5, "#9c744e");
  px(ctx, 415, 92, 10, 9, OUTLINE);
  px(ctx, 416, 93, 8, 7, "#b6b1a3");
  px(ctx, 417, 94, 6, 2, "#3a3731");
  px(ctx, 418, 98, 2, 2, "#e8dcc2");
  drawPlant(ctx, 403, 103, palette, 0.65);
  drawPlant(ctx, 429, 103, palette, 0.65);

  // Entrance glass doors at bottom of spine hallway.
  px(ctx, 390, buildingBottom, 60, 4, "#2f2119");
  px(ctx, 392, buildingBottom + 2, 26, 6, "rgba(158, 211, 209, 0.42)");
  px(ctx, 422, buildingBottom + 2, 26, 6, "rgba(158, 211, 209, 0.42)");
  px(ctx, 418, buildingBottom + 2, 3, 6, "#d7b36d");
  px(ctx, 392, buildingBottom + 2, 1, 6, "#e3c88d");
  px(ctx, 447, buildingBottom + 2, 1, 6, "#e3c88d");

  // If the bottom right grid slot is unoccupied, fill it with a welcoming courtyard expansion pad.
  if (rooms.length % 2 === 1) {
    const emptyRow = Math.floor(rooms.length / 2);
    const padX = OFFICE_GRID.colX[1];
    const padY = OFFICE_GRID.paddingTop + emptyRow * OFFICE_GRID.rowStride;
    paintExpansionPad(ctx, padX, padY, OFFICE_GRID.roomW, OFFICE_GRID.roomH, palette, "day");
  }
}

export function paintStaticOffice(
  ctx: Ctx,
  theme: ThemeMode,
  rooms: Room[] = INITIAL_ROOMS,
) {
  const activeRooms = rooms.length > 0 ? rooms : INITIAL_ROOMS;
  const world = getWorldDimensions(activeRooms);
  const palette = PALETTES[theme];

  ctx.clearRect(0, 0, world.width, world.height);
  ctx.imageSmoothingEnabled = false;

  paintExterior(ctx, palette, theme, world);
  paintBuildingShellAndCorridors(ctx, palette, activeRooms, world);

  if (activeRooms.length % 2 === 1) {
    const emptyRow = Math.floor(activeRooms.length / 2);
    paintExpansionPad(
      ctx,
      OFFICE_GRID.colX[1],
      OFFICE_GRID.paddingTop + emptyRow * OFFICE_GRID.rowStride,
      OFFICE_GRID.roomW,
      OFFICE_GRID.roomH,
      palette,
      theme,
    );
  }

  activeRooms.forEach((room) => {
    const col = room.rect.x < 400 ? 0 : 1;
    paintRoomFloor(ctx, room);
    paintRoomWalls(ctx, room, col, palette, theme);
    paintRoomFurniture(ctx, room, palette);
  });
}

interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  alpha: number;
}

function collectDynamicDecor(rooms: Room[], world: WorldDimensions) {
  const windows: Array<{ x: number; y: number; width: number; room: Room["rect"] }> = [];
  const screenLights: LightSource[] = [];
  const deskLights: LightSource[] = [];
  const mugs: Array<{ x: number; y: number }> = [];
  const screens: Array<{ roomId: string; x: number; y: number; w: number; h: number }> = [];
  const techServerSpots: Array<{ x: number; y: number }> = [];

  for (const room of rooms) {
    const { x: rx, y: ry } = room.rect;
    const rgb = hexToRgb(room.accent || "#d8a54a");

    windows.push({
      x: rx + 212,
      y: ry + 10,
      width: 82,
      room: { x: rx + 12, y: ry + 12, w: room.rect.w - 24, h: room.rect.h - 24 },
    });

    screenLights.push({
      x: rx + 188,
      y: ry + 115,
      radius: 50,
      color: rgb,
      alpha: 0.44,
    });

    if (room.furnitureStyle === "tech") {
      screenLights.push({
        x: rx + 206,
        y: ry + 115,
        radius: 36,
        color: [106, 215, 236],
        alpha: 0.34,
      });
      deskLights.push({ x: rx + 122, y: ry + 107, radius: 34, color: rgb, alpha: 0.3 });
      mugs.push({ x: rx + 110, y: ry + 111 });
      screens.push(
        { roomId: room.id, x: rx + 154, y: ry + 109, w: 30, h: 14 },
        { roomId: room.id, x: rx + 192, y: ry + 110, w: 24, h: 13 },
      );
      techServerSpots.push({ x: rx + 309, y: ry + 29 });
    } else if (room.furnitureStyle === "finance") {
      deskLights.push({ x: rx + 102, y: ry + 106, radius: 34, color: [148, 222, 174], alpha: 0.28 });
      mugs.push({ x: rx + 260, y: ry + 110 });
      screens.push({ roomId: room.id, x: rx + 158, y: ry + 108, w: 28, h: 13 });
    } else if (room.furnitureStyle === "creative") {
      screenLights.push({ x: rx + 266, y: ry + 72, radius: 42, color: [255, 240, 203], alpha: 0.42 });
      deskLights.push({ x: rx + 250, y: ry + 107, radius: 34, color: [255, 205, 134], alpha: 0.32 });
      mugs.push({ x: rx + 106, y: ry + 110 });
      screens.push({ roomId: room.id, x: rx + 172, y: ry + 108, w: 26, h: 13 });
    } else {
      deskLights.push({ x: rx + 126, y: ry + 106, radius: 38, color: [255, 205, 124], alpha: 0.34 });
      mugs.push({ x: rx + 114, y: ry + 112 });
      screens.push({ roomId: room.id, x: rx + 174, y: ry + 109, w: 28, h: 14 });
    }
  }

  // Exterior entrance lanterns.
  const stepY = world.buildingBottom + 4;
  deskLights.push(
    { x: 380, y: stepY + 9, radius: 24, color: [255, 210, 126], alpha: 0.34 },
    { x: 460, y: stepY + 9, radius: 24, color: [255, 210, 126], alpha: 0.34 },
  );

  return { windows, screenLights, deskLights, mugs, screens, techServerSpots };
}

function drawCoffeeSteam(ctx: Ctx, time: number, mugs: Array<{ x: number; y: number }>) {
  ctx.save();
  for (let m = 0; m < mugs.length; m += 1) {
    const mug = mugs[m];
    for (let w = 0; w < 2; w += 1) {
      const cycle = ((time / 2200 + m * 0.23 + w * 0.5) % 1 + 1) % 1;
      const sy = mug.y - cycle * 9;
      const sx = mug.x + Math.sin(cycle * Math.PI * 2 + m) * 1.3;
      ctx.fillStyle = `rgba(255, 248, 232, ${Math.sin(cycle * Math.PI) * 0.34})`;
      ctx.fillRect(Math.round(sx * 2) / 2, Math.round(sy * 2) / 2, 1, 1.5);
    }
  }
  ctx.restore();
}

function drawStatusHardwareLeds(
  ctx: Ctx,
  time: number,
  theme: ThemeMode,
  windows: Array<{ x: number; y: number }>,
  techServerSpots: Array<{ x: number; y: number }>,
) {
  const fastPulse = Math.floor(time / 480) % 2 === 0;
  // Espresso power indicator.
  px(ctx, 422, 95, 1, 1, "#f08c55");

  for (const spot of techServerSpots) {
    px(ctx, spot.x, spot.y, 2, 2, fastPulse ? "#72e8b0" : "#2c6b4d");
    px(ctx, spot.x, spot.y + 11, 2, 2, fastPulse ? "#5cc8f2" : "#2d5f75");
  }

  if (theme === "night") {
    const twinkle = Math.floor(time / 700) % 2 === 0;
    windows.forEach((win, idx) => {
      px(ctx, win.x + 18, win.y - 7, 1, 1, (idx % 2 === 0 ? twinkle : !twinkle) ? "#fff8d9" : "#7fa2bd");
      px(ctx, win.x + 48, win.y - 4, 1, 1, twinkle ? "#8ab4ce" : "#fff8d9");
    });
  }
}

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

function drawDaylight(
  ctx: Ctx,
  time: number,
  windows: Array<{ x: number; y: number; width: number; room: Room["rect"] }>,
  screenLights: LightSource[],
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const win of windows) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.room.x, win.room.y, win.room.w, win.room.h);
    ctx.clip();
    const beamAlpha = 0.08;
    ctx.fillStyle = `rgba(255, 221, 156, ${beamAlpha})`;
    ctx.beginPath();
    ctx.moveTo(win.x, win.y);
    ctx.lineTo(win.x + win.width, win.y);
    ctx.lineTo(win.x + win.width + 44, win.y + 138);
    ctx.lineTo(win.x + 18, win.y + 138);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255, 246, 212, 0.36)`;
    for (let index = 0; index < 5; index += 1) {
      const drift = (time * 0.006 + index * 31 + win.x) % 82;
      const moteY = win.y + 24 + ((time * 0.002 + index * 37) % 84);
      ctx.fillRect(
        Math.round(win.x + 14 + drift + index * 3) % (win.room.x + win.room.w),
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
  for (const source of screenLights) drawRadialGlow(ctx, source, 0.22);
  ctx.restore();
}

function drawNightLight(
  ctx: Ctx,
  time: number,
  world: WorldDimensions,
  windows: Array<{ x: number; y: number; width: number; room: Room["rect"] }>,
  screenLights: LightSource[],
  deskLights: LightSource[],
) {
  ctx.save();
  ctx.fillStyle = "rgba(7, 12, 23, 0.54)";
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.globalCompositeOperation = "lighter";
  const flicker = 0.94 + Math.sin(time / 820) * 0.06;
  for (const source of screenLights) drawRadialGlow(ctx, source, flicker);
  for (const source of deskLights) drawRadialGlow(ctx, source, 1);

  ctx.save();
  for (const win of windows) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.room.x, win.room.y, win.room.w, win.room.h);
    ctx.clip();
    ctx.fillStyle = "rgba(122, 162, 214, 0.065)";
    ctx.beginPath();
    ctx.moveTo(win.x, win.y);
    ctx.lineTo(win.x + win.width, win.y);
    ctx.lineTo(win.x + win.width + 32, win.y + 114);
    ctx.lineTo(win.x + 6, win.y + 114);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();

  const cx = world.width / 2;
  const cy = world.height / 2;
  const maxR = Math.max(world.width, world.height) * 0.72;
  const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.28, cx, cy, maxR);
  vignette.addColorStop(0, "rgba(5, 9, 16, 0)");
  vignette.addColorStop(0.7, "rgba(5, 9, 16, 0.12)");
  vignette.addColorStop(1, "rgba(5, 9, 16, 0.48)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, world.width, world.height);
}

function drawWorkingEffects(
  ctx: Ctx,
  agent: Agent,
  room: Room | undefined,
  time: number,
) {
  if (agent.status !== "working") return;
  const { x, y } = agent.position;
  const style = room?.furnitureStyle ?? "admin";

  if (style === "tech") {
    for (let index = 0; index < 3; index += 1) {
      const progress = ((time / 2200 + index * 0.31) % 1 + 1) % 1;
      const bitX = x + 16 + Math.sin(progress * Math.PI * 2 + index) * 11;
      const bitY = y - 16 - progress * 24;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.88;
      px(ctx, bitX, bitY, 3, 2, index === 0 ? "#6be0f2" : index === 1 ? "#94e0a8" : "#f0c86d");
    }
    ctx.globalAlpha = 1;
  } else if (style === "finance") {
    for (let index = 0; index < 2; index += 1) {
      const progress = ((time / 3000 + index * 0.5) % 1 + 1) % 1;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.82;
      const coinX = x + 16 + Math.sin(progress * Math.PI * 2) * 4;
      const coinY = y - 14 - progress * 20;
      px(ctx, coinX, coinY, 3.5, 3.5, "#e3c06b");
      px(ctx, coinX + 1, coinY + 1, 1.5, 1.5, "#8f7134");
    }
    ctx.globalAlpha = 1;
  } else if (style === "creative") {
    for (let index = 0; index < 3; index += 1) {
      const progress = ((time / 2700 + index * 0.33) % 1 + 1) % 1;
      const dotX = x + 18 + Math.sin(progress * Math.PI * 2 + index) * 12;
      const dotY = y - 16 - progress * 25;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.85;
      px(ctx, dotX, dotY, 2.5, 2.5, ["#e8b566", "#78bfae", "#e28b64"][index]);
    }
    ctx.globalAlpha = 1;
  } else {
    const progress = ((time / 2800) % 1 + 1) % 1;
    ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.85;
    const paperX = x + 14 + progress * 28;
    const paperY = y - 20 - Math.sin(progress * Math.PI) * 20;
    px(ctx, paperX, paperY, 10, 8, OUTLINE);
    px(ctx, paperX + 1, paperY + 1, 8, 6, "#f1e1be");
    px(ctx, paperX + 3, paperY + 3, 4, 1, "#9d845e");
    px(ctx, paperX + 3, paperY + 5, 6, 1, "#9d845e");
    ctx.globalAlpha = 1;
  }
}

function drawScreenFlicker(
  ctx: Ctx,
  time: number,
  screens: Array<{ roomId: string; x: number; y: number; w: number; h: number }>,
  workingRoomIds: Set<string>,
) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (const screen of screens) {
    const glow = workingRoomIds.has(screen.roomId) ? 1 : 0.35;
    const scan = Math.floor((time / 620 + screen.x) % screen.h);
    px(ctx, screen.x + 1, screen.y + scan, screen.w - 2, 1, `rgba(214, 255, 236, ${0.28 * glow})`);
  }
  ctx.restore();
}

export interface DynamicSceneOptions {
  agents: Agent[];
  rooms: Room[];
  theme: ThemeMode;
  filter: AgentStatus | "all";
  time: number;
}

export function paintDynamicOffice(ctx: Ctx, options: DynamicSceneOptions) {
  const { agents, rooms, theme, filter, time } = options;
  const activeRooms = rooms.length > 0 ? rooms : INITIAL_ROOMS;
  const world = getWorldDimensions(activeRooms);
  ctx.imageSmoothingEnabled = false;

  const workingRoomIds = new Set(
    agents.filter((agent) => agent.status === "working").map((agent) => agent.roomId),
  );
  const roomMap = new Map(activeRooms.map((r) => [r.id, r]));

  const sorted = [...agents].sort((a, b) => a.position.y - b.position.y);
  for (const agent of sorted) {
    const dimmed = filter !== "all" && agent.status !== filter;
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.25 : 1;
    drawAgentSprite(ctx, agent, time);
    drawWorkingEffects(ctx, agent, roomMap.get(agent.roomId), time);
    ctx.restore();
  }

  const decor = collectDynamicDecor(activeRooms, world);
  drawScreenFlicker(ctx, time, decor.screens, workingRoomIds);
  drawCoffeeSteam(ctx, time, decor.mugs);
  drawStatusHardwareLeds(ctx, time, theme, decor.windows, decor.techServerSpots);

  if (theme === "night") {
    drawNightLight(ctx, time, world, decor.windows, decor.screenLights, decor.deskLights);
  } else {
    drawDaylight(ctx, time, decor.windows, decor.screenLights);
  }
}

export function roomAtPoint(x: number, y: number, rooms: Room[] = INITIAL_ROOMS) {
  return rooms.find(
    (room) =>
      x >= room.rect.x &&
      x <= room.rect.x + room.rect.w &&
      y >= room.rect.y &&
      y <= room.rect.y + room.rect.h,
  );
}
