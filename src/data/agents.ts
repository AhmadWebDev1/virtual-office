import { normalizeSkillList, type CustomSkillDefinition } from "@/data/skills";

export const OFFICE_GRID = {
  width: 840,
  paddingTop: 86,
  colX: [40, 452] as const,
  roomW: 348,
  roomH: 212,
  rowGap: 54,
  rowStride: 266, // roomH (212) + rowGap (54)
  hallX: 388,
  hallW: 64,
} as const;

export type ThemeMode = "day" | "night";

export const AGENT_STATUSES = ["working", "idle", "done", "error", "waiting_approval", "cooldown"] as const;
export const FURNITURE_STYLES = ["tech", "creative", "admin", "finance"] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type FurnitureStyle = (typeof FURNITURE_STYLES)[number];
export type AgentId = string;
export type RoomId = string;
export type AgentRuntimeSource = "gemini" | "local-runtime";

export const GM_AGENT_ID = "gm";
const GM_ROOM_ID = "gm";

export interface StatusMeta {
  labelAr: string;
  pillLabelAr: string;
  emoji: string;
  dot: string;
  soft: string;
  text: string;
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  working: {
    labelAr: "يشتغل",
    pillLabelAr: "يشتغل",
    emoji: "🟢",
    dot: "#32b768",
    soft: "#d9f5e4",
    text: "#116137",
  },
  idle: {
    labelAr: "فاضي",
    pillLabelAr: "فاضي",
    emoji: "🟡",
    dot: "#e0a72e",
    soft: "#fff2cf",
    text: "#7d5610",
  },
  done: {
    labelAr: "خلصت",
    pillLabelAr: "خلصت",
    emoji: "✅",
    dot: "#2f9c8a",
    soft: "#d7f3ee",
    text: "#125e54",
  },
  error: {
    labelAr: "خطأ",
    pillLabelAr: "خطأ",
    emoji: "🔴",
    dot: "#d9534f",
    soft: "#fbe0df",
    text: "#8a2623",
  },
  waiting_approval: {
    labelAr: "بانتظار الموافقة",
    pillLabelAr: "موافقة",
    emoji: "✋",
    dot: "#f59e0b",
    soft: "#fef3c7",
    text: "#92400e",
  },
  cooldown: {
    labelAr: "استراحة قهوة",
    pillLabelAr: "استراحة",
    emoji: "☕",
    dot: "#d97706",
    soft: "#fef3c7",
    text: "#b45309",
  },
};

export interface CompletedTask {
  id: string;
  titleAr: string;
  timeAr: string;
  outcome?: "done" | "error";
  logAr?: string;
  source?: AgentRuntimeSource;
  completedAt?: number;
}

export interface ActiveTask {
  id?: string;
  titleAr: string;
  progress: number;
  noteAr: string;
  startedAt?: number;
  durationMs?: number;
  startAr?: string;
  completionAr?: string;
  logAr?: string;
  source?: AgentRuntimeSource;
}

export function formatCompletedTimeAr(task: CompletedTask): string {
  if (!task.completedAt) return task.timeAr;
  const minutes = Math.max(0, Math.floor((Date.now() - task.completedAt) / 60_000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${arabicCount(minutes, "دقيقة", "دقيقتين", "دقائق")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${arabicCount(hours, "ساعة", "ساعتين", "ساعات")}`;
  const days = Math.floor(hours / 24);
  return `منذ ${arabicCount(days, "يوم", "يومين", "أيام")}`;
}

function arabicCount(value: number, singular: string, dual: string, plural: string): string {
  if (value === 1) return singular;
  if (value === 2) return dual;
  if (value <= 10) return `${value} ${plural}`;
  return `${value} ${singular}`;
}

export interface QuickAction {
  id: string;
  labelAr: string;
  command: string;
  hintAr: string;
}

export interface CustomWebhookTool {
  id: string;
  nameAr: string;
  descriptionAr: string;
  method: "GET" | "POST" | "PUT";
  url: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;
  enabled: boolean;
}

export interface AutomationRule {
  id: string;
  titleAr: string;
  trigger: "onTaskComplete" | "onKeywordMatch" | "onError" | "onSchedule";
  keyword?: string;
  action: "forwardToAgent" | "changeDeskLed" | "saveToVault" | "notifyGm" | "requireApproval";
  targetAgentId?: AgentId;
  ledColor?: "green" | "amber" | "red" | "blue" | "default";
  customPayload?: string;
  enabled: boolean;
}

export interface AgentSchedule {
  enabled: boolean;
  intervalMinutes: number;
  nextRunTimestamp: number;
  prompt: string;
  labelAr: string;
}

export interface DeliverableItem {
  id: string;
  titleAr: string;
  agentId: AgentId;
  agentNameAr: string;
  agentRoleAr: string;
  roomId?: RoomId;
  timestamp: number;
  type: "report" | "script" | "table" | "prompt" | "code" | "plan";
  summaryAr: string;
  content: string;
  format: "markdown" | "csv" | "json";
}

export interface ApprovalRequest {
  id: string;
  agentId: AgentId;
  agentNameAr: string;
  agentRoleAr: string;
  titleAr: string;
  actionDescriptionAr: string;
  impactLevel: "low" | "medium" | "high";
  payload: Record<string, unknown> | string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
}

export interface EscalationTicket {
  id: string;
  agentId: AgentId;
  agentNameAr: string;
  roomId?: RoomId;
  roomNameAr?: string;
  errorDescriptionAr: string;
  timestamp: number;
  status: "open" | "resolved";
  diagnosisAr?: string;
  actionTakenAr?: string;
}

export interface WarRoomDebateTurn {
  agentId: AgentId;
  agentNameAr: string;
  agentRoleAr: string;
  speechAr: string;
  timestamp: number;
}

export interface WarRoomMeeting {
  id: string;
  topicAr: string;
  selectedAgentIds: AgentId[];
  status: "idle" | "debating" | "synthesizing" | "completed";
  turns: WarRoomDebateTurn[];
  finalPlanAr?: string;
}

export interface OfficeBlueprint {
  version: "1.0";
  nameAr: string;
  exportedAt: number;
  globalRules?: string;
  globalSkills?: string[];
  rooms: Room[];
  agents: Agent[];
}

export interface RoomBlueprint {
  version: "1.0";
  nameAr: string;
  exportedAt: number;
  room: Room;
  agents: Agent[];
}

export const COFFEE_CORNER_POS = { x: 420, y: 114 } as const;

export interface SelfEvolutionEntry {
  id: string;
  agentId: AgentId;
  agentNameAr: string;
  roomId?: RoomId;
  critiqueAr: string;
  refinedRuleAr: string;
  timestamp: number;
}

export interface LedgerEntry {
  id: string;
  requestId: string;
  timestamp: number;
  agentId: AgentId;
  agentNameAr: string;
  roomId?: RoomId;
  roomNameAr?: string;
  taskTitleAr: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  source: AgentRuntimeSource;
}

export interface FloorDataPulse {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  color: string;
  labelAr: string;
}

export function calculateAgentLevel(xp = 0): {
  level: number;
  levelTitleAr: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  hasStar: boolean;
} {
  if (xp < 100) {
    return {
      level: 1,
      levelTitleAr: "مبتدئ · Novice",
      currentLevelXp: xp,
      nextLevelXp: 100,
      progressPercent: Math.min(100, Math.floor((xp / 100) * 100)),
      hasStar: false,
    };
  }
  if (xp < 250) {
    return {
      level: 2,
      levelTitleAr: "مختص · Specialist",
      currentLevelXp: xp - 100,
      nextLevelXp: 150,
      progressPercent: Math.min(100, Math.floor(((xp - 100) / 150) * 100)),
      hasStar: true,
    };
  }
  if (xp < 500) {
    return {
      level: 3,
      levelTitleAr: "خبير · Expert",
      currentLevelXp: xp - 250,
      nextLevelXp: 250,
      progressPercent: Math.min(100, Math.floor(((xp - 250) / 250) * 100)),
      hasStar: true,
    };
  }
  return {
    level: 4,
    levelTitleAr: "ماستر · Principal Lead",
    currentLevelXp: xp - 500,
    nextLevelXp: 500,
    progressPercent: 100,
    hasStar: true,
  };
}

export interface AgentAvatar {
  skin: string;
  skinShadow: string;
  hair: string;
  hairShadow: string;
  shirt: string;
  shirtShadow: string;
  accent: string;
  style: "short" | "long" | "curly" | "bun";
  accessory: "none" | "glasses" | "headset" | "beanie";
  beard?: boolean;
}

export interface Agent {
  id: AgentId;
  nameAr: string;
  roleAr: string;
  roleEn: string;
  roomId: RoomId;
  stationAr: string;
  status: AgentStatus;
  statusNoteAr: string;
  activeTask: ActiveTask | null;
  completedTasks: CompletedTask[];
  quickActions: QuickAction[];
  rules: string;
  skills: string[];
  customSkills?: CustomSkillDefinition[];
  avatar: AgentAvatar;
  position: { x: number; y: number };
  memory?: string[];
  schedule?: AgentSchedule;
  customTools?: CustomWebhookTool[];
  scriptRules?: AutomationRule[];
  deskLedColor?: "green" | "amber" | "red" | "blue" | "default";
  xp?: number;
  level?: number;
  tokenUsage?: number;
  consecutiveFailures?: number;
  rankBadge?: "star" | "crown" | "medal" | "none";
  stamina?: number;
  cooldownUntil?: number;
  originalPosition?: { x: number; y: number };
  selfEvolutionLog?: SelfEvolutionEntry[];
}

export interface Room {
  id: RoomId;
  nameAr: string;
  shortNameAr: string;
  descriptionAr: string;
  rect: { x: number; y: number; w: number; h: number };
  accent: string;
  furnitureStyle: FurnitureStyle;
  agentIds: AgentId[];
  peerReviewEnabled?: boolean;
  workflowChain?: AgentId[];
  rules?: string;
  skills?: string[];
}

export interface WorldDimensions {
  width: number;
  height: number;
  rowCount: number;
  buildingBottom: number;
}

export function getWorldDimensions(rooms: Room[]): WorldDimensions {
  const count = Math.max(1, rooms.length);
  const rowCount = Math.max(1, Math.ceil(count / 2));
  const lastRowBottom =
    OFFICE_GRID.paddingTop +
    (rowCount - 1) * OFFICE_GRID.rowStride +
    OFFICE_GRID.roomH;
  // Single-row HQ extends hallway down 46px to the stepped entrance; multi-row finishes cleanly below bottom row.
  const buildingBottom = rowCount === 1 ? lastRowBottom + 46 : lastRowBottom;
  const height = buildingBottom + 38;
  return {
    width: OFFICE_GRID.width,
    height,
    rowCount,
    buildingBottom,
  };
}

export function computeStationPosition(
  roomRect: { x: number; y: number; w: number; h: number },
  stationIndex: number,
  totalStations: number,
): { x: number; y: number } {
  if (totalStations <= 1) {
    return {
      x: roomRect.x + 188,
      y: roomRect.y + 88,
    };
  }
  const minX = roomRect.x + 138;
  const maxX = roomRect.x + 236;
  if (totalStations === 2) {
    return {
      x: stationIndex === 0 ? minX : maxX,
      y: roomRect.y + 88,
    };
  }
  const span = maxX - minX;
  const step = span / (totalStations - 1);
  return {
    x: Math.round(minX + stationIndex * step),
    y: roomRect.y + 88,
  };
}

export function normalizeRoomName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^غرفة\s+/, "")
    .replace(/^استوديو\s+/, "")
    .replace(/^مكتب\s+/, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

export function computeRoomPlacement(index: number): {
  col: 0 | 1;
  row: number;
  rect: { x: number; y: number; w: number; h: number };
  agentPosition: { x: number; y: number };
} {
  const col = (index % 2) as 0 | 1;
  const row = Math.floor(index / 2);
  const x = OFFICE_GRID.colX[col];
  const y = OFFICE_GRID.paddingTop + row * OFFICE_GRID.rowStride;
  return {
    col,
    row,
    rect: {
      x,
      y,
      w: OFFICE_GRID.roomW,
      h: OFFICE_GRID.roomH,
    },
    agentPosition: {
      x: x + 188,
      y: y + 88,
    },
  };
}

export const INITIAL_ROOMS: Room[] = [
  {
    id: GM_ROOM_ID,
    nameAr: "غرفة المدير العام",
    shortNameAr: "المدير العام",
    descriptionAr: "قيادة العمليات، توظيف الوكلاء الجدد، وتوزيع المهام على الفريق.",
    rect: { x: 40, y: 86, w: 348, h: 212 },
    accent: "#d8a54a",
    furnitureStyle: "admin",
    agentIds: [GM_AGENT_ID],
    rules: "التنسيق الاستراتيجي العام، التحقق من جودة المخرجات، وتوزيع المهام بدقة.",
    skills: ["task-management"],
  },
];

export const INITIAL_AGENTS: Agent[] = [
  {
    id: GM_AGENT_ID,
    nameAr: "سلمان العتيبي",
    roleAr: "المدير العام",
    roleEn: "General Manager",
    roomId: GM_ROOM_ID,
    stationAr: "مكتب الإدارة",
    status: "idle",
    statusNoteAr: "جاهز لبناء فريقك — اطلب منه توظيف أي وكيل أو توجيه المهام.",
    activeTask: null,
    completedTasks: [
      {
        id: "gm-boot-1",
        titleAr: "تجهيز المقر الرئيسي واستلام القيادة",
        timeAr: "منذ قليل",
        outcome: "done",
        logAr:
          "افتتحت المقر الرئيسي بنجاح. اطلب مني إنشاء أي وكيل جديد مثل مبرمج ويب، مسؤول مبيعات، أو مدير مالي وسأبني غرفته فوراً.",
      },
    ],
    quickActions: [
      {
        id: "gm-hire-dev",
        labelAr: "وظّف مبرمج ويب",
        command: "أنشئ وكيل مبرمج ويب وضع له قواعد صارمة لجودة الكود",
        hintAr: "إضافة غرفة جديدة",
      },
      {
        id: "gm-plan",
        labelAr: "خطّة العمل اليومية",
        command: "رتّب أولويات اليوم واقترح الوكلاء المطلوبين للفريق",
        hintAr: "تنظيم ذكي",
      },
      {
        id: "gm-brief",
        labelAr: "ملخص حالة المقر",
        command: "أعطني ملخصاً عن حالة المكتب والوكلاء الحاليين",
        hintAr: "تقرير سريع",
      },
    ],
    rules:
      "أنت المدير العام الذكي للمقر. تستقبل الأوامر العامة، تخطّط الأولويات، وتنشئ وكلاء جدد عند طلب المستخدم باستخدام الأداة create_new_agent مع تحديد مهاراتهم وقواعدهم وأسلوب غرفتهم.",
    skills: ["task-management", "research-summary"],
    customSkills: [],
    avatar: {
      skin: "#d7a071",
      skinShadow: "#ae7b50",
      hair: "#2b2320",
      hairShadow: "#171210",
      shirt: "#1f4b46",
      shirtShadow: "#14332f",
      accent: "#dfb35b",
      style: "short",
      accessory: "none",
      beard: true,
    },
    position: { x: 228, y: 174 },
    memory: [
      "المكتب الافتراضي يعمل بنظام RPG 16-بت وبدقة إدارية وحوكمة عالية.",
      "فريق العمل يضم وكلاء متخصصين في التسويق والتحليل وكتابة المحتوى والتصميم.",
      "يتم توجيه جميع المهام وفق بروتوكول التشغيل الذاتي والاعتماد الإداري.",
    ],
    scriptRules: [
      {
        id: "rule-invoice-auto",
        titleAr: "تحويل الفواتير التلقائي للإدارة المالية",
        trigger: "onKeywordMatch",
        keyword: "فاتورة",
        action: "forwardToAgent",
        targetAgentId: "gm",
        ledColor: "green",
        enabled: true,
      },
      {
        id: "rule-high-impact-approval",
        titleAr: "حارس الجودة والموافقة البشرية",
        trigger: "onKeywordMatch",
        keyword: "نشر",
        action: "requireApproval",
        ledColor: "amber",
        enabled: true,
      },
      {
        id: "rule-vault-save",
        titleAr: "أرشفة التقارير والمخرجات التلقائية في الخزنة",
        trigger: "onTaskComplete",
        action: "saveToVault",
        ledColor: "blue",
        enabled: true,
      },
    ],
    customTools: [
      {
        id: "tool-n8n-webhook",
        nameAr: "رابط أتمتة n8n / Make",
        descriptionAr: "إرسال التقارير والبيانات الجاهزة مباشرة إلى مسار عمل خارجي",
        method: "POST",
        url: "https://api.example.com/v1/webhook",
        bodyTemplate: '{"event": "task_deliverable", "summary": "{{summary}}"}',
        enabled: false,
      },
    ],
    xp: 320,
    level: 3,
    tokenUsage: 1420,
    consecutiveFailures: 0,
    rankBadge: "crown",
    stamina: 100,
  },
];

export function getAgentById(agentId: string, list: Agent[] = INITIAL_AGENTS): Agent | undefined {
  return list.find((agent) => agent.id === agentId);
}

export function getRoomById(roomId: string, list: Room[] = INITIAL_ROOMS): Room | undefined {
  return list.find((room) => room.id === roomId);
}

export function statusCounts(agents: Agent[]): Record<AgentStatus, number> {
  return agents.reduce(
    (counts, agent) => {
      counts[agent.status] += 1;
      return counts;
    },
    { working: 0, idle: 0, done: 0, error: 0, waiting_approval: 0, cooldown: 0 } satisfies Record<AgentStatus, number>,
  );
}

export function cloneAgents(agents: Agent[]): Agent[] {
  return agents.map((agent) => ({
    ...agent,
    skills: [...agent.skills],
    customSkills: agent.customSkills ? agent.customSkills.map((skill) => ({ ...skill })) : [],
    activeTask: agent.activeTask ? { ...agent.activeTask } : null,
    completedTasks: agent.completedTasks.map((task) => ({ ...task })),
    quickActions: agent.quickActions.map((action) => ({ ...action })),
    avatar: { ...agent.avatar },
    position: { ...agent.position },
    originalPosition: agent.originalPosition ? { ...agent.originalPosition } : undefined,
    memory: agent.memory ? [...agent.memory] : [],
    schedule: agent.schedule ? { ...agent.schedule } : undefined,
    customTools: agent.customTools ? agent.customTools.map((t) => ({ ...t, headers: t.headers ? { ...t.headers } : undefined })) : [],
    scriptRules: agent.scriptRules ? agent.scriptRules.map((r) => ({ ...r })) : [],
    deskLedColor: agent.deskLedColor,
    xp: agent.xp ?? 50,
    level: agent.level ?? 1,
    tokenUsage: agent.tokenUsage ?? 0,
    consecutiveFailures: agent.consecutiveFailures ?? 0,
    rankBadge: agent.rankBadge,
    stamina: agent.stamina ?? 100,
    cooldownUntil: agent.cooldownUntil,
    selfEvolutionLog: agent.selfEvolutionLog ? agent.selfEvolutionLog.map((e) => ({ ...e })) : [],
  }));
}

export function cloneRooms(rooms: Room[]): Room[] {
  return rooms.map((room) => ({
    ...room,
    rect: { ...room.rect },
    agentIds: [...room.agentIds],
    peerReviewEnabled: room.peerReviewEnabled,
    workflowChain: room.workflowChain ? [...room.workflowChain] : undefined,
    rules: room.rules,
    skills: room.skills ? [...room.skills] : [],
  }));
}

const SKIN_TONES = [
  { skin: "#e0ae82", skinShadow: "#b8825a" },
  { skin: "#d7a071", skinShadow: "#ae7b50" },
  { skin: "#c98d60", skinShadow: "#9e6842" },
  { skin: "#e3b087", skinShadow: "#b98258" },
] as const;

const HAIR_TONES = [
  { hair: "#211c1a", hairShadow: "#100d0c" },
  { hair: "#3a2722", hairShadow: "#201512" },
  { hair: "#6d3d2a", hairShadow: "#48251a" },
  { hair: "#2d3138", hairShadow: "#181b20" },
] as const;

const STYLE_SHIRT_PALETTES: Record<FurnitureStyle, Array<{ shirt: string; shirtShadow: string }>> = {
  tech: [
    { shirt: "#28506b", shirtShadow: "#19364a" },
    { shirt: "#2c5f63", shirtShadow: "#1b3f42" },
  ],
  creative: [
    { shirt: "#b75963", shirtShadow: "#853a43" },
    { shirt: "#c47d3d", shirtShadow: "#955527" },
  ],
  admin: [
    { shirt: "#1f4b46", shirtShadow: "#14332f" },
    { shirt: "#3e4b5c", shirtShadow: "#28313d" },
  ],
  finance: [
    { shirt: "#566b4a", shirtShadow: "#394a30" },
    { shirt: "#3f5b55", shirtShadow: "#293e39" },
  ],
};

const HAIR_STYLES: AgentAvatar["style"][] = ["short", "long", "curly", "bun"];
const ACCESSORIES: Record<FurnitureStyle, AgentAvatar["accessory"][]> = {
  tech: ["glasses", "headset", "beanie"],
  creative: ["beanie", "headset", "glasses"],
  admin: ["glasses", "none", "headset"],
  finance: ["glasses", "none", "headset"],
};

export function normalizeHexColor(value: unknown, style: FurnitureStyle): string {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())) {
    return value.trim();
  }
  if (style === "tech") return "#5aa9e6";
  if (style === "creative") return "#e58a62";
  if (style === "finance") return "#9ab77a";
  return "#d8a54a";
}

export function normalizeFurnitureStyle(value: unknown): FurnitureStyle {
  if (value === "tech" || value === "creative" || value === "admin" || value === "finance") {
    return value;
  }
  return "admin";
}

function generateProceduralAvatar(
  seedInput: string,
  themeColor: string,
  furnitureStyle: FurnitureStyle,
): AgentAvatar {
  let hash = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    hash = (hash * 31 + seedInput.charCodeAt(i)) >>> 0;
  }
  const skin = SKIN_TONES[hash % SKIN_TONES.length];
  const hair = HAIR_TONES[(hash >>> 2) % HAIR_TONES.length];
  const shirts = STYLE_SHIRT_PALETTES[furnitureStyle];
  const shirt = shirts[(hash >>> 4) % shirts.length];
  const style = HAIR_STYLES[(hash >>> 5) % HAIR_STYLES.length];
  const accessoryList = ACCESSORIES[furnitureStyle];
  const accessory = accessoryList[(hash >>> 7) % accessoryList.length];
  const beard = style === "short" && (hash % 3 !== 0);

  return {
    skin: skin.skin,
    skinShadow: skin.skinShadow,
    hair: hair.hair,
    hairShadow: hair.hairShadow,
    shirt: shirt.shirt,
    shirtShadow: shirt.shirtShadow,
    accent: normalizeHexColor(themeColor, furnitureStyle),
    style,
    accessory,
    beard,
  };
}

function buildStarterQuickActions(
  roleAr: string,
  style: FurnitureStyle,
  skills: string[],
): QuickAction[] {
  if (skills.includes("gmail-workspace")) {
    return [
      {
        id: "qa-mail-sort",
        labelAr: "فرز الوارد",
        command: "افرز صندوق الوارد ورتّب الرسائل حسب الأولوية",
        hintAr: "بريد Gmail",
      },
      {
        id: "qa-mail-summary",
        labelAr: "تلخيص الرسائل",
        command: "لخّص الرسائل المهمة التي وصلت اليوم",
        hintAr: "ملخص سريع",
      },
      {
        id: "qa-mail-draft",
        labelAr: "مسودة رد",
        command: "اكتب مسودة رد مهنية على آخر رسالة من عميل",
        hintAr: "مسودة جاهزة",
      },
    ];
  }
  if (skills.includes("sheets-finance") || style === "finance") {
    return [
      {
        id: "qa-fin-summary",
        labelAr: "الملخص المالي",
        command: "أعطني الملخص المالي هذا الشهر",
        hintAr: "تحليل مالي",
      },
      {
        id: "qa-fin-expense",
        labelAr: "تسجيل مصروف",
        command: "سجّل مصروف 250 ريال ضيافة ومستلزمات مكتب",
        hintAr: "إضافة صف",
      },
      {
        id: "qa-fin-audit",
        labelAr: "تدقيق الفواتير",
        command: "راجع الفواتير والمصروفات واستخرج أبرز الملاحظات",
        hintAr: "مراجعة",
      },
    ];
  }
  if (style === "tech") {
    return [
      {
        id: "qa-tech-arch",
        labelAr: "مراجعة الكود",
        command: `بصفتك ${roleAr}، راجع بنية النظام واقترح تحسينات تقنية`,
        hintAr: "هندسة برمجية",
      },
      {
        id: "qa-tech-bug",
        labelAr: "فحص الأعطال",
        command: `بصفتك ${roleAr}، صمّم خطة فحص للأعطال والأداء`,
        hintAr: "جودة واستقرار",
      },
      {
        id: "qa-tech-build",
        labelAr: "بناء ميزة",
        command: `بصفتك ${roleAr}، اقترح خطوات تنفيذ ميزة جديدة متكاملة`,
        hintAr: "تطوير سريع",
      },
    ];
  }
  if (style === "creative") {
    return [
      {
        id: "qa-cre-idea",
        labelAr: "أفكار حملة",
        command: `بصفتك ${roleAr}، اقترح 3 أفكار إبداعية لحملة جديدة`,
        hintAr: "إبداع وتسويق",
      },
      {
        id: "qa-cre-copy",
        labelAr: "صياغة عرض",
        command: `بصفتك ${roleAr}، جهّز نصاً تسويقياً جذاباً للعملاء`,
        hintAr: "محتوى جاهز",
      },
      {
        id: "qa-cre-review",
        labelAr: "خطة أسبوعية",
        command: `بصفتك ${roleAr}، رتّب خطة عمل أسبوعية واضحة`,
        hintAr: "جدول زمني",
      },
    ];
  }
  return [
    {
      id: "qa-gen-plan",
      labelAr: "خطة التنفيذ",
      command: `بصفتك ${roleAr}، ضع خطة عمل مرتبة للأولويات الحالية`,
      hintAr: "تنظيم المهام",
    },
    {
      id: "qa-gen-report",
      labelAr: "تقرير سريع",
      command: `بصفتك ${roleAr}، أعدّ تقريراً موجزاً عن التقدم والخطوات القادمة`,
      hintAr: "ملخص تنفيذي",
    },
    {
      id: "qa-gen-sop",
      labelAr: "قواعد التشغيل",
      command: `بصفتك ${roleAr}، اقترح ضوابط جودة لرفع كفاءة عملك`,
      hintAr: "معايير الجودة",
    },
  ];
}

function makeShortRoomName(roomNameAr: string, roleAr: string): string {
  const cleaned = roomNameAr.replace(/^غرفة\s+/, "").trim();
  if (cleaned.length > 0 && cleaned.length <= 16) return cleaned;
  return roleAr.slice(0, 16);
}

export interface CreateAgentSpecInput {
  id?: string;
  targetRoomId?: string;
  nameAr: string;
  roleAr: string;
  roleEn?: string;
  roomNameAr: string;
  rules: string;
  skills: string[];
  themeColor: string;
  furnitureStyle: FurnitureStyle;
}

export interface CreateAgentResult {
  agent: Agent;
  room: Room;
  isNewRoom: boolean;
  updatedExistingAgents: Agent[];
}

export function createAgentAndRoomFromSpec(
  spec: CreateAgentSpecInput,
  existingAgents: Agent[],
  existingRooms: Room[],
): CreateAgentResult {
  const furnitureStyle = normalizeFurnitureStyle(spec.furnitureStyle);
  const themeColor = normalizeHexColor(spec.themeColor, furnitureStyle);
  const skills = normalizeSkillList(spec.skills);
  const effectiveSkills =
    skills.length > 0
      ? skills
      : furnitureStyle === "tech"
        ? ["code-writing", "research-summary"]
        : furnitureStyle === "finance"
          ? ["data-analysis", "sheets-finance"]
          : furnitureStyle === "creative"
            ? ["email-drafting", "research-summary"]
            : ["task-management"];

  const nextIndex = existingRooms.length;
  const suffix = (nextIndex + 1).toString();
  const baseId =
    spec.id && /^[a-z0-9_-]{2,40}$/i.test(spec.id)
      ? spec.id
      : `agent-${suffix}-${Date.now().toString(36).slice(-4)}`;
  const uniqueAgentId = existingAgents.some((a) => a.id === baseId)
    ? `${baseId}-${Math.random().toString(36).slice(2, 5)}`
    : baseId;
  const uniqueRoomId = existingRooms.some((r) => r.id === `room-${uniqueAgentId}`)
    ? `room-${uniqueAgentId}-${Math.random().toString(36).slice(2, 4)}`
    : `room-${uniqueAgentId}`;

  // Find if an existing room matches targetRoomId or roomNameAr
  let targetRoom: Room | undefined;
  if (spec.targetRoomId) {
    targetRoom = existingRooms.find((r) => r.id === spec.targetRoomId);
  }
  if (!targetRoom && spec.roomNameAr) {
    const normInput = normalizeRoomName(spec.roomNameAr);
    if (normInput) {
      targetRoom = existingRooms.find((r) => {
        const normRoom = normalizeRoomName(r.nameAr);
        const normShort = normalizeRoomName(r.shortNameAr);
        return (
          normInput === normRoom ||
          normInput === normShort ||
          (normInput.length >= 4 && (normRoom.includes(normInput) || normInput.includes(normRoom)))
        );
      });
    }
  }

  const isNewRoom = !targetRoom;
  const roomNameAr = targetRoom ? targetRoom.nameAr : spec.roomNameAr.trim() || `غرفة ${spec.roleAr}`;
  const finalFurnitureStyle = targetRoom ? targetRoom.furnitureStyle : furnitureStyle;
  const finalThemeColor = targetRoom ? targetRoom.accent : themeColor;

  let room: Room;
  let agentPosition: { x: number; y: number };
  let stationAr: string;
  const updatedExistingAgents: Agent[] = [];

  if (targetRoom) {
    const updatedAgentIds = [
      ...targetRoom.agentIds.filter((id) => id !== uniqueAgentId),
      uniqueAgentId,
    ];
    const totalInRoom = updatedAgentIds.length;
    room = {
      ...targetRoom,
      agentIds: updatedAgentIds,
    };

    // Recompute station positions for existing occupants
    updatedAgentIds.slice(0, totalInRoom - 1).forEach((existingId, idx) => {
      const existing = existingAgents.find((a) => a.id === existingId);
      if (existing) {
        const pos = computeStationPosition(targetRoom!.rect, idx, totalInRoom);
        updatedExistingAgents.push({
          ...existing,
          position: pos,
          stationAr: `محطة ${idx + 1} · ${existing.roleAr}`,
        });
      }
    });

    agentPosition = computeStationPosition(targetRoom.rect, totalInRoom - 1, totalInRoom);
    stationAr = `محطة ${totalInRoom} · ${spec.roleAr.trim()}`;
  } else {
    const placement = computeRoomPlacement(nextIndex);
    agentPosition = placement.agentPosition;
    stationAr = `محطة ${spec.roleAr.trim()}`;
    const roleEn =
      spec.roleEn?.trim() ||
      (finalFurnitureStyle === "tech"
        ? "Tech Specialist"
        : finalFurnitureStyle === "finance"
          ? "Finance Specialist"
          : finalFurnitureStyle === "creative"
            ? "Creative Specialist"
            : "Operations Specialist");

    room = {
      id: uniqueRoomId,
      nameAr: roomNameAr,
      shortNameAr: makeShortRoomName(roomNameAr, spec.roleAr),
      descriptionAr: `${spec.roleAr} — ${spec.rules.slice(0, 95)}`,
      rect: placement.rect,
      accent: finalThemeColor,
      furnitureStyle: finalFurnitureStyle,
      agentIds: [uniqueAgentId],
    };
  }

  const roleEn =
    spec.roleEn?.trim() ||
    (finalFurnitureStyle === "tech"
      ? "Tech Specialist"
      : finalFurnitureStyle === "finance"
        ? "Finance Specialist"
        : finalFurnitureStyle === "creative"
          ? "Creative Specialist"
          : "Operations Specialist");

  const agent: Agent = {
    id: uniqueAgentId,
    nameAr: spec.nameAr.trim(),
    roleAr: spec.roleAr.trim(),
    roleEn,
    roomId: room.id,
    stationAr,
    status: "idle",
    statusNoteAr: isNewRoom
      ? "تم بناء الغرفة وتفعيل الوكيل — جاهز لاستلام الأوامر."
      : `تم تجهيز محطة عمل للوكيل داخل ${room.nameAr} — جاهز لاستلام الأوامر.`,
    activeTask: null,
    completedTasks: [
      {
        id: `hire-${uniqueAgentId}`,
        titleAr: isNewRoom
          ? `انضمام ${spec.nameAr.trim()} وتجهيز ${roomNameAr}`
          : `انضمام ${spec.nameAr.trim()} إلى ${roomNameAr}`,
        timeAr: "الآن",
        outcome: "done",
        completedAt: Date.now(),
        logAr: isNewRoom
          ? `تم إنشاء الوكيل بمهارات (${effectiveSkills.length}) وقواعد مخصصة من المدير العام.`
          : `تم تسكين الوكيل بمحطة جديدة في ${roomNameAr} بجوار زملائه في الفريق.`,
      },
    ],
    quickActions: buildStarterQuickActions(spec.roleAr.trim(), finalFurnitureStyle, effectiveSkills),
    rules: spec.rules.trim(),
    skills: effectiveSkills,
    customSkills: [],
    avatar: generateProceduralAvatar(
      `${spec.nameAr}-${spec.roleAr}-${nextIndex}`,
      finalThemeColor,
      finalFurnitureStyle,
    ),
    position: agentPosition,
  };

  return { agent, room, isNewRoom, updatedExistingAgents };
}

export interface AgentTaskInput {
  id: string;
  titleAr: string;
  durationMs: number;
  startAr?: string;
  completionAr?: string;
  logAr?: string;
  source?: AgentRuntimeSource;
}

export interface AgentTaskCompletion {
  id: string;
  titleAr: string;
  completionAr?: string;
  logAr?: string;
  source?: AgentRuntimeSource;
}

export function beginAgentTask(
  agents: Agent[],
  agentId: AgentId,
  task: AgentTaskInput,
): Agent[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      status: "working",
      statusNoteAr: `يستلم المهمة الجديدة الآن — ${task.titleAr}`,
      activeTask: {
        id: task.id,
        titleAr: task.titleAr,
        progress: 6,
        noteAr: "قيد التنفيذ الآن",
        startedAt: Date.now(),
        durationMs: task.durationMs,
        startAr: task.startAr,
        completionAr: task.completionAr,
        logAr: task.logAr,
        source: task.source,
      },
    };
  });
}

export function completeAgentTask(
  agents: Agent[],
  agentId: AgentId,
  task: AgentTaskCompletion,
): Agent[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    const completed: CompletedTask = {
      id: task.id,
      titleAr: task.titleAr,
      timeAr: "الآن",
      outcome: "done",
      completedAt: Date.now(),
      logAr: task.logAr ?? agent.activeTask?.logAr,
      source: task.source ?? agent.activeTask?.source,
    };
    const active = agent.activeTask ?? {
      titleAr: task.titleAr,
      progress: 100,
      noteAr: "اكتملت الآن",
    };
    return {
      ...agent,
      status: "done",
      statusNoteAr: "أنجز المهمة وحدّث سجل الفريق.",
      activeTask: {
        ...active,
        progress: 100,
        noteAr: "اكتملت الآن",
        completionAr: task.completionAr ?? active.completionAr,
        logAr: task.logAr ?? active.logAr,
        source: task.source ?? active.source,
      },
      completedTasks: [
        completed,
        ...agent.completedTasks.filter((entry) => entry.id !== completed.id),
      ].slice(0, 5),
    };
  });
}
