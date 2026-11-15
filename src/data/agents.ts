export const WORLD = { width: 840, height: 600 } as const;

export type ThemeMode = "day" | "night";

export const AGENT_STATUSES = ["working", "idle", "done", "error"] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentId = "gm" | "email" | "finance" | "cover" | "instagram";
export type RoomId = "gm" | "email" | "finance" | "creative";

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
    pillLabelAr: "يشتغل 🟢",
    emoji: "🟢",
    dot: "#32b768",
    soft: "#d9f5e4",
    text: "#116137",
  },
  idle: {
    labelAr: "فاضي",
    pillLabelAr: "فاضي 🟡",
    emoji: "🟡",
    dot: "#e0a72e",
    soft: "#fff2cf",
    text: "#7d5610",
  },
  done: {
    labelAr: "خلصت",
    pillLabelAr: "خلصت ✅",
    emoji: "✅",
    dot: "#2f9c8a",
    soft: "#d7f3ee",
    text: "#125e54",
  },
  error: {
    labelAr: "خطأ",
    pillLabelAr: "خطأ 🔴",
    emoji: "🔴",
    dot: "#d9534f",
    soft: "#fbe0df",
    text: "#8a2623",
  },
};

export interface CompletedTask {
  id: string;
  titleAr: string;
  timeAr: string;
  outcome?: "done" | "error";
}

export interface ActiveTask {
  titleAr: string;
  progress: number;
  noteAr: string;
  startedAt?: number;
  durationMs?: number;
}

export interface QuickAction {
  id: string;
  labelAr: string;
  command: string;
  hintAr: string;
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
  avatar: AgentAvatar;
  position: { x: number; y: number };
}

export interface Room {
  id: RoomId;
  nameAr: string;
  shortNameAr: string;
  descriptionAr: string;
  rect: { x: number; y: number; w: number; h: number };
  accent: string;
  agentIds: AgentId[];
}

export const ROOMS: Room[] = [
  {
    id: "gm",
    nameAr: "غرفة المدير العام",
    shortNameAr: "المدير العام",
    descriptionAr: "قيادة العمليات، توزيع المهام، ومتابعة أداء الفريق.",
    rect: { x: 40, y: 86, w: 348, h: 212 },
    accent: "#d8a54a",
    agentIds: ["gm"],
  },
  {
    id: "creative",
    nameAr: "غرفة الإبداع والتسويق",
    shortNameAr: "الإبداع",
    descriptionAr: "استوديو مشترك للتصميم وصناعة المحتوى وإدارة المجتمع.",
    rect: { x: 452, y: 86, w: 348, h: 212 },
    accent: "#e58a62",
    agentIds: ["cover", "instagram"],
  },
  {
    id: "email",
    nameAr: "غرفة مدير الإيميلات",
    shortNameAr: "الإيميلات",
    descriptionAr: "فرز الوارد، صياغة الردود، وتلخيص الرسائل المهمة.",
    rect: { x: 40, y: 352, w: 348, h: 212 },
    accent: "#76b7b2",
    agentIds: ["email"],
  },
  {
    id: "finance",
    nameAr: "غرفة المدير المالي",
    shortNameAr: "المالية",
    descriptionAr: "متابعة الفواتير، المصروفات، والتقارير المالية الشهرية.",
    rect: { x: 452, y: 352, w: 348, h: 212 },
    accent: "#9ab77a",
    agentIds: ["finance"],
  },
];

export const AGENTS: Agent[] = [
  {
    id: "gm",
    nameAr: "سلمان العتيبي",
    roleAr: "المدير العام",
    roleEn: "General Manager",
    roomId: "gm",
    stationAr: "مكتب الإدارة",
    status: "working",
    statusNoteAr: "يراجع خطة إطلاق الربع الأخير ويوزّع أولويات اليوم.",
    activeTask: {
      titleAr: "مراجعة خطة إطلاق الربع الأخير",
      progress: 64,
      noteAr: "ينتهي خلال 12 دقيقة",
    },
    completedTasks: [
      { id: "gm-1", titleAr: "توزيع مهام الأسبوع على الوكلاء", timeAr: "منذ 25 دقيقة" },
      { id: "gm-2", titleAr: "مراجعة تقرير أداء الفريق اليومي", timeAr: "منذ ساعة" },
      { id: "gm-3", titleAr: "اعتماد ميزانية الحملة القادمة", timeAr: "منذ 3 ساعات" },
      { id: "gm-4", titleAr: "اجتماع تنسيق مع مدير الإبداع", timeAr: "أمس" },
      { id: "gm-5", titleAr: "تحديث خريطة أولويات الشهر", timeAr: "أمس" },
    ],
    quickActions: [
      {
        id: "gm-plan",
        labelAr: "وزّع المهام اليومية",
        command: "وزّع مهام اليوم على الوكلاء بحسب الأولوية",
        hintAr: "توزيع ذكي",
      },
      {
        id: "gm-brief",
        labelAr: "لخّص أداء الفريق",
        command: "أعطني ملخصاً سريعاً لأداء الفريق اليوم",
        hintAr: "تقرير قصير",
      },
      {
        id: "gm-week",
        labelAr: "راجع خطة الأسبوع",
        command: "راجع خطة الأسبوع القادم واقترح تعديلات",
        hintAr: "تخطيط",
      },
    ],
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
  },
  {
    id: "email",
    nameAr: "ريم الشمري",
    roleAr: "مدير الإيميلات",
    roleEn: "Email Manager",
    roomId: "email",
    stationAr: "مكتب البريد",
    status: "working",
    statusNoteAr: "تفرز صندوق الوارد وتلتقط الرسائل العاجلة.",
    activeTask: {
      titleAr: "فرز 42 رسالة واردة",
      progress: 42,
      noteAr: "متبقي 18 رسالة",
    },
    completedTasks: [
      { id: "em-1", titleAr: "تلخيص 6 رسائل من عملاء مهمين", timeAr: "منذ 18 دقيقة" },
      { id: "em-2", titleAr: "مسودة رد على استفسار الشراكة", timeAr: "منذ 40 دقيقة" },
      { id: "em-3", titleAr: "أرشفة رسائل الأرشيف القديم", timeAr: "منذ ساعتين" },
      { id: "em-4", titleAr: "تصعيد فاتورة متأخرة للمدير المالي", timeAr: "أمس" },
      { id: "em-5", titleAr: "تنظيف قائمة الاشتراكات البريدية", timeAr: "أمس" },
    ],
    quickActions: [
      {
        id: "em-sort",
        labelAr: "فرز الوارد",
        command: "افرز صندوق الوارد ورتّب الرسائل حسب الأولوية",
        hintAr: "42 رسالة",
      },
      {
        id: "em-summary",
        labelAr: "تلخيص الرسائل المهمة",
        command: "لخّص الرسائل المهمة التي وصلت اليوم",
        hintAr: "ملخص سريع",
      },
      {
        id: "em-draft",
        labelAr: "مسودة رد",
        command: "اكتب مسودة رد مهنية على آخر رسالة من عميل",
        hintAr: "رد جاهز",
      },
    ],
    avatar: {
      skin: "#e0ae82",
      skinShadow: "#b8825a",
      hair: "#3a2722",
      hairShadow: "#201512",
      shirt: "#2b6f6a",
      shirtShadow: "#1b4b47",
      accent: "#8fd6cd",
      style: "long",
      accessory: "headset",
    },
    position: { x: 212, y: 428 },
  },
  {
    id: "finance",
    nameAr: "خالد الدوسري",
    roleAr: "المدير المالي",
    roleEn: "Finance Manager",
    roomId: "finance",
    stationAr: "مكتب المالية",
    status: "error",
    statusNoteAr: "توقفت مطابقة كشف البنك بسبب صلاحية ناقصة.",
    activeTask: {
      titleAr: "مطابقة كشف البنك — أكتوبر",
      progress: 72,
      noteAr: "يحتاج تجديد صلاحية الاتصال",
    },
    completedTasks: [
      { id: "fi-1", titleAr: "إصدار تقرير المصروفات الأسبوعي", timeAr: "منذ 35 دقيقة" },
      { id: "fi-2", titleAr: "مراجعة 14 فاتورة مورد", timeAr: "منذ ساعتين" },
      { id: "fi-3", titleAr: "تحديث توقعات التدفق النقدي", timeAr: "منذ 4 ساعات" },
      { id: "fi-4", titleAr: "اعتماد مصروفات حملة الإنستغرام", timeAr: "أمس" },
      { id: "fi-5", titleAr: "تسوية مصروفات السفر", timeAr: "أمس" },
    ],
    quickActions: [
      {
        id: "fi-invoices",
        labelAr: "تحديث الفواتير",
        command: "حدّث حالة الفواتير المعلّقة واستخرج المتأخرة",
        hintAr: "14 فاتورة",
      },
      {
        id: "fi-expenses",
        labelAr: "تقرير المصروفات",
        command: "جهّز تقرير المصروفات لهذا الشهر",
        hintAr: "تقرير مالي",
      },
      {
        id: "fi-bank",
        labelAr: "مطابقة كشف البنك",
        command: "أعد محاولة مطابقة كشف البنك وأبلغني بالنتيجة",
        hintAr: "إعادة محاولة",
      },
    ],
    avatar: {
      skin: "#c98d60",
      skinShadow: "#9e6842",
      hair: "#211c1a",
      hairShadow: "#100d0c",
      shirt: "#566b4a",
      shirtShadow: "#394a30",
      accent: "#d6c084",
      style: "short",
      accessory: "glasses",
      beard: true,
    },
    position: { x: 636, y: 428 },
  },
  {
    id: "cover",
    nameAr: "فهد المطيري",
    roleAr: "مصمم الكفرات",
    roleEn: "Cover Designer",
    roomId: "creative",
    stationAr: "محطة التصميم",
    status: "done",
    statusNoteAr: "سلّم كفرات حملة الخريف وجاهز للمراجعة.",
    activeTask: {
      titleAr: "تسليم كفرات حملة الخريف",
      progress: 100,
      noteAr: "اكتملت قبل 8 دقائق",
    },
    completedTasks: [
      { id: "co-1", titleAr: "تصميم 3 كفرات لحملة الخريف", timeAr: "منذ 8 دقائق" },
      { id: "co-2", titleAr: "تنويعات ألوان كفر العرض الرئيسي", timeAr: "منذ 22 دقيقة" },
      { id: "co-3", titleAr: "تصدير ملفات التصميم النهائية", timeAr: "منذ ساعة" },
      { id: "co-4", titleAr: "تعديل مقاس كفر الريلز", timeAr: "أمس" },
      { id: "co-5", titleAr: "تجهيز لوحة مزاج للحملة", timeAr: "أمس" },
    ],
    quickActions: [
      {
        id: "co-cover",
        labelAr: "كفر حملة جديدة",
        command: "صمّم كفراً جديداً لحملة العودة إلى المدرسة",
        hintAr: "تصميم جديد",
      },
      {
        id: "co-colors",
        labelAr: "تنويعات الألوان",
        command: "اقترح ثلاث تنويعات لونية للكفر الحالي",
        hintAr: "3 خيارات",
      },
      {
        id: "co-export",
        labelAr: "تصدير الملفات النهائية",
        command: "صدّر كل ملفات الكفرات بالنسخ النهائية",
        hintAr: "ملفات جاهزة",
      },
    ],
    avatar: {
      skin: "#d29a6b",
      skinShadow: "#a8724b",
      hair: "#241b16",
      hairShadow: "#120d0b",
      shirt: "#c47d3d",
      shirtShadow: "#955527",
      accent: "#f2cd76",
      style: "curly",
      accessory: "beanie",
    },
    position: { x: 542, y: 174 },
  },
  {
    id: "instagram",
    nameAr: "دانة الزهراني",
    roleAr: "مدير الإنستغرام",
    roleEn: "Instagram Manager",
    roomId: "creative",
    stationAr: "محطة السوشيال",
    status: "idle",
    statusNoteAr: "بانتظار موجز الحملة القادمة قبل الجدولة.",
    activeTask: null,
    completedTasks: [
      { id: "ig-1", titleAr: "جدولة 3 منشورات للأسبوع", timeAr: "منذ ساعتين" },
      { id: "ig-2", titleAr: "تحليل تفاعل آخر 7 أيام", timeAr: "منذ 5 ساعات" },
      { id: "ig-3", titleAr: "الرد على 18 تعليقاً من المجتمع", timeAr: "أمس" },
      { id: "ig-4", titleAr: "اقتراح هاشتاقات للريل الجديد", timeAr: "أمس" },
      { id: "ig-5", titleAr: "تحديث تقويم المحتوى", timeAr: "قبل يومين" },
    ],
    quickActions: [
      {
        id: "ig-analytics",
        labelAr: "تحليل التفاعل",
        command: "حلّل تفاعل الحساب هذا الأسبوع واقترح تحسينات",
        hintAr: "تقرير أسبوعي",
      },
      {
        id: "ig-schedule",
        labelAr: "جدولة منشور",
        command: "جدول منشوراً جديداً للخميس الساعة الثامنة مساءً",
        hintAr: "تقويم المحتوى",
      },
      {
        id: "ig-hashtags",
        labelAr: "اقتراح هاشتاقات",
        command: "اقترح هاشتاقات مناسبة للمنشور القادم",
        hintAr: "وصول أوسع",
      },
    ],
    avatar: {
      skin: "#e3b087",
      skinShadow: "#b98258",
      hair: "#6d3d2a",
      hairShadow: "#48251a",
      shirt: "#b75963",
      shirtShadow: "#853a43",
      accent: "#f2b6b0",
      style: "bun",
      accessory: "headset",
    },
    position: { x: 704, y: 174 },
  },
];

export const DEFAULT_TARGET = "auto" as const;

export function getAgentById(agentId: string): Agent | undefined {
  return AGENTS.find((agent) => agent.id === agentId);
}

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && AGENTS.some((agent) => agent.id === value);
}

export function getRoomById(roomId: string): Room | undefined {
  return ROOMS.find((room) => room.id === roomId);
}

export function getAgentsForRoom(roomId: RoomId): Agent[] {
  return AGENTS.filter((agent) => agent.roomId === roomId);
}

export function statusCounts(agents: Agent[]): Record<AgentStatus, number> {
  return agents.reduce(
    (counts, agent) => {
      counts[agent.status] += 1;
      return counts;
    },
    { working: 0, idle: 0, done: 0, error: 0 } satisfies Record<AgentStatus, number>,
  );
}

export function cloneAgents(agents: Agent[]): Agent[] {
  return agents.map((agent) => ({
    ...agent,
    activeTask: agent.activeTask ? { ...agent.activeTask } : null,
    completedTasks: agent.completedTasks.map((task) => ({ ...task })),
    quickActions: agent.quickActions.map((action) => ({ ...action })),
    avatar: { ...agent.avatar },
    position: { ...agent.position },
  }));
}

export function beginAgentTask(
  agents: Agent[],
  agentId: AgentId,
  task: { titleAr: string; durationMs: number },
): Agent[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      status: "working",
      statusNoteAr: `تستلم المهمة الجديدة الآن — ${task.titleAr}`,
      activeTask: {
        titleAr: task.titleAr,
        progress: 6,
        noteAr: "قيد التنفيذ الآن",
        startedAt: Date.now(),
        durationMs: task.durationMs,
      },
    };
  });
}

export function completeAgentTask(
  agents: Agent[],
  agentId: AgentId,
  completedTitle: string,
): Agent[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    const task: CompletedTask = {
      id: `${agentId}-${Date.now()}`,
      titleAr: completedTitle,
      timeAr: "الآن",
      outcome: "done",
    };
    return {
      ...agent,
      status: "done",
      statusNoteAr: "أنجزت المهمة وحدّثت سجل الفريق.",
      activeTask: agent.activeTask
        ? { ...agent.activeTask, progress: 100, noteAr: "اكتملت الآن" }
        : {
            titleAr: completedTitle,
            progress: 100,
            noteAr: "اكتملت الآن",
          },
      completedTasks: [task, ...agent.completedTasks].slice(0, 5),
    };
  });
}

export function failAgentTask(agents: Agent[], agentId: AgentId, noteAr: string): Agent[] {
  return agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      status: "error",
      statusNoteAr: noteAr,
      activeTask: agent.activeTask ? { ...agent.activeTask, noteAr } : null,
    };
  });
}
