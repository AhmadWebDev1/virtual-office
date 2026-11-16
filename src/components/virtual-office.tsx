"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_STATUSES,
  GM_AGENT_ID,
  INITIAL_ROOMS,
  STATUS_META,
  beginAgentTask,
  cloneAgents,
  cloneRooms,
  completeAgentTask,
  createAgentAndRoomFromSpec,
  getAgentById,
  getRoomById,
  statusCounts,
  calculateAgentLevel,
  COFFEE_CORNER_POS,
  type Agent,
  type AgentId,
  type AgentStatus,
  type AgentTaskCompletion,
  type EscalationTicket,
  type FloorDataPulse,
  type FurnitureStyle,
  type LedgerEntry,
  type OfficeBlueprint,
  type QuickAction,
  type Room,
  type RoomBlueprint,
  type RoomId,
  type SelfEvolutionEntry,
  type ThemeMode,
} from "@/data/agents";
import type { CustomSkillDefinition } from "@/data/skills";
import type {
  AgentCommandError,
  AgentCommandRequest,
  AgentCommandResponse,
  AgentPromptProfile,
  CommandTarget,
  CreatedAgentSpec,
  PendingWorkspaceConfirmation,
} from "@/lib/agent-contracts";
import {
  clearGoogleAccessToken,
  getGoogleAccessToken,
  googleLogout,
  googleSignIn,
  initGoogleAuth,
  isInEmbeddedFrame,
  parseSpreadsheetId,
  type GoogleWorkspaceUser,
} from "@/lib/google-workspace-auth";
import { formatGoogleSignInError } from "@/lib/workspace-auth-error";
import {
  clearOfficeState,
  clearOfficeStateOnServer,
  loadOfficeState,
  saveOfficeStateToServer,
} from "@/lib/office-storage";
import AgentModal from "@/components/agent-modal";
import AgentChatModal from "@/components/agent-chat-modal";
import type { CommandReceipt } from "@/components/command-bar";
import OfficeStage, {
  type AgentSpeech,
  type FlyingPacket,
  type OfficeStageHandle,
  type WalkingMessenger,
} from "@/components/office-stage";
import {
  ChartIcon,
  ChatPixelIcon,
  CodeIcon,
  CrownIcon,
  MailIcon,
  PaletteIcon,
  RouteIcon,
  SpeakerIcon,
  VaultIcon,
} from "@/components/icons";
import type {
  AgentSchedule,
  ApprovalRequest,
  AutomationRule,
  CustomWebhookTool,
  DeliverableItem,
} from "@/data/agents";
import {
  isSoundEnabled,
  playAlertBeep,
  playClickSound,
  playCompleteChime,
  playFlyPacketSound,
  setSoundEnabled,
} from "@/lib/audio-effects";
import {
  INITIAL_DELIVERABLES,
  addDeliverable,
  loadDeliverables,
} from "@/lib/vault-storage";
import DeliverablesVaultModal from "@/components/deliverables-vault-modal";
import ApprovalGateModal from "@/components/approval-gate-modal";
import RoomSettingsModal from "@/components/room-settings-modal";
import WarRoomModal from "@/components/war-room-modal";
import ReceptionDeskModal from "@/components/reception-desk-modal";
import IncidentModal from "@/components/incident-modal";
import AccountingLedgerModal from "@/components/accounting-ledger-modal";

interface VirtualOfficeProps {
  initialAgents: Agent[];
  initialRooms?: Room[];
  initialTheme?: ThemeMode;
  initialSheetId?: string | null;
}

interface CompletionAnnouncement extends AgentTaskCompletion {
  completionAr: string;
}

interface PendingConfirmState {
  agentId: AgentId;
  command: string;
  confirmation: PendingWorkspaceConfirmation;
}

const SHEET_ID_STORAGE_KEY = "office-finance-sheet-id";
const LEDGER_STORAGE_KEY = "virtual_office_ledger_entries";

const DEFAULT_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: "led-init-1",
    requestId: "task-init-1",
    timestamp: Date.now() - 3600000 * 2,
    agentId: "fahad",
    agentNameAr: "فهد العصيمي",
    roomId: "marketing",
    roomNameAr: "غرفة التسويق الرقمي",
    taskTitleAr: "تحليل حساب إنستقرام وتقديم استراتيجية النمو",
    inputTokens: 1250,
    outputTokens: 480,
    totalTokens: 1730,
    costUsd: 0.000238,
    source: "gemini",
  },
  {
    id: "led-init-2",
    requestId: "task-init-2",
    timestamp: Date.now() - 3600000,
    agentId: "gm",
    agentNameAr: "سلمان العتيبي",
    roomId: "gm",
    roomNameAr: "غرفة المدير العام",
    taskTitleAr: "تفويض المهام وتوجيه وكلاء التسويق والمحتوى",
    inputTokens: 820,
    outputTokens: 310,
    totalTokens: 1130,
    costUsd: 0.000155,
    source: "gemini",
  },
];

const STYLE_ICONS: Record<FurnitureStyle, typeof CrownIcon> = {
  admin: CrownIcon,
  tech: CodeIcon,
  finance: ChartIcon,
  creative: PaletteIcon,
};

function toAgentPromptProfile(agent: Agent, rooms?: Room[]): AgentPromptProfile {
  const room = rooms?.find((r) => r.id === agent.roomId);
  return {
    id: agent.id,
    nameAr: agent.nameAr,
    roleAr: agent.roleAr,
    roleEn: agent.roleEn,
    roomId: agent.roomId,
    roomNameAr: room?.nameAr,
    rules: agent.rules,
    skills: agent.skills,
    customSkills: agent.customSkills ?? [],
  };
}

export default function VirtualOffice({
  initialAgents,
  initialRooms = INITIAL_ROOMS,
  initialTheme = "day",
  initialSheetId = null,
}: VirtualOfficeProps) {
  const [agents, setAgents] = useState<Agent[]>(() => cloneAgents(initialAgents));
  const [rooms, setRooms] = useState<Room[]>(() => cloneRooms(initialRooms));
  const [filter, setFilter] = useState<AgentStatus | "all">("all");
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [target, setTarget] = useState<CommandTarget>("auto");
  const [sending, setSending] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [speeches, setSpeeches] = useState<Partial<Record<AgentId, AgentSpeech>>>({});
  const [receipt, setReceipt] = useState<CommandReceipt | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOpenTabUrl, setNoticeOpenTabUrl] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Deliverables Vault
  const [vaultOpen, setVaultOpen] = useState(false);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>(INITIAL_DELIVERABLES);

  // Sound Engine
  const [soundActive, setSoundActive] = useState<boolean>(true);

  // Human-in-the-Loop Approval Gate
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);

  // Multi-Agent Collaboration & Movement Animations
  const [flyingPackets, setFlyingPackets] = useState<FlyingPacket[]>([]);
  const [walkingMessenger, setWalkingMessenger] = useState<WalkingMessenger | null>(null);

  // 3-Tier Governance & Global Scope
  const [globalRules, setGlobalRules] = useState<string>(
    "الالتزام بأعلى معايير الدقة والسرعة في التنفيذ، وتوثيق كافة المخرجات والنتائج في الخزنة تلقائياً.",
  );
  const [globalSkills, setGlobalSkills] = useState<string[]>(["task-management"]);

  // Sandbox Mode (Live vs Dry-Run Simulation)
  const [sandboxMode, setSandboxMode] = useState<boolean>(false);

  // War Room / Emergency Meeting
  const [warRoomOpen, setWarRoomOpen] = useState<boolean>(false);

  // Reception Desk & Webhooks
  const [receptionOpen, setReceptionOpen] = useState<boolean>(false);

  // Room Settings Modal
  const [roomSettingsRoomId, setRoomSettingsRoomId] = useState<RoomId | null>(null);

  // Incident Escalation Tickets
  const [escalationTickets, setEscalationTickets] = useState<EscalationTicket[]>([]);
  const [incidentOpen, setIncidentOpen] = useState<boolean>(false);

  // Phase 2: Accounting Ledger & Financial Telemetry
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(DEFAULT_LEDGER_ENTRIES);
  const [ledgerOpen, setLedgerOpen] = useState<boolean>(false);

  // Phase 2: 16-Bit Circuit Wires & Live Data Pulses
  const [showCircuitWires, setShowCircuitWires] = useState<boolean>(true);
  const [floorPulses, setFloorPulses] = useState<FloorDataPulse[]>([]);

  // Google Workspace OAuth state (token stays strictly in memory via google-workspace-auth.ts)
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<GoogleWorkspaceUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [sheetId, setSheetId] = useState(initialSheetId ?? "");
  const [sheetInput, setSheetInput] = useState(initialSheetId ?? "");
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmState | null>(null);

  const stageRef = useRef<OfficeStageHandle>(null);
  const speechTimers = useRef(new Map<AgentId, ReturnType<typeof setTimeout>>());
  const completionTimers = useRef(new Map<AgentId, ReturnType<typeof setTimeout>>());
  const nextSpeechId = useRef(1);
  const nextReceiptId = useRef(1);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const resetEpoch = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const cleanupTimers = completionTimers.current;
    const cleanupSpeeches = speechTimers.current;
    return () => {
      cleanupTimers.forEach((timer) => clearTimeout(timer));
      cleanupSpeeches.forEach((timer) => clearTimeout(timer));
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNotice(null);
    setNoticeOpenTabUrl(null);
  }, []);

  const showNotice = useCallback((message: string, openTabUrl: string | null = null) => {
    setNotice(message);
    setNoticeOpenTabUrl(openTabUrl);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice(null);
      setNoticeOpenTabUrl(null);
    }, openTabUrl ? 25000 : 5200);
  }, []);

  const showSpeech = useCallback((agentId: AgentId, text: string, duration = 6000) => {
    const existing = speechTimers.current.get(agentId);
    if (existing) clearTimeout(existing);
    const id = nextSpeechId.current++;
    setSpeeches((current) => ({ ...current, [agentId]: { id, text } }));
    const timer = setTimeout(() => {
      setSpeeches((current) => {
        if (current[agentId]?.id !== id) return current;
        const next = { ...current };
        delete next[agentId];
        return next;
      });
      speechTimers.current.delete(agentId);
    }, duration);
    speechTimers.current.set(agentId, timer);
  }, []);

  // Phase 2: Live Floor Data Pulses Generator
  const triggerFloorPulse = useCallback(
    (fromId: string, toId: string, color = "#00f0ff", labelAr = "بيانات") => {
      const findCoord = (id: string) => {
        if (id === "reception") return { x: 420, y: 320 };
        if (id === "coffee") return COFFEE_CORNER_POS;
        if (id === "vault") return { x: 228, y: 174 };
        const ag = agents.find((a) => a.id === id);
        if (ag) return ag.position;
        const rm = rooms.find((r) => r.id === id);
        if (rm) return { x: rm.rect.x + rm.rect.w / 2, y: rm.rect.y + rm.rect.h / 2 };
        return { x: 420, y: 180 };
      };

      const from = findCoord(fromId);
      const to = findCoord(toId);
      const newPulse: FloorDataPulse = {
        id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        progress: 0,
        color,
        labelAr,
      };

      setFloorPulses((cur) => [...cur.slice(-12), newPulse]);
    },
    [agents, rooms],
  );

  useEffect(() => {
    if (floorPulses.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setFloorPulses((prev) =>
        prev
          .map((p) => ({ ...p, progress: p.progress + 0.04 }))
          .filter((p) => p.progress < 1),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [floorPulses]);

  // Phase 2: Stamina RPG Recovery Ticker (Checks agents in cooldown at Coffee Corner)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setAgents((prev) => {
        let changed = false;
        const updated = prev.map((a) => {
          if (a.status === "cooldown" && a.cooldownUntil && now >= a.cooldownUntil) {
            changed = true;
            return {
              ...a,
              status: "idle" as AgentStatus,
              stamina: 100,
              cooldownUntil: undefined,
              position: a.originalPosition ?? a.position,
              originalPosition: undefined,
            };
          }
          return a;
        });
        if (changed) {
          playCompleteChime();
          showNotice("اكتملت استراحة القهوة وعاد الوكلاء إلى مكاتبهم بطاقة كاملة (100%)! ⚡");
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNotice]);

  // Phase 2: Self-Evolving Office & Feedback Loop (Rating: 👍 ممتاز / 👎 تحسين)
  const handleAgentFeedback = useCallback(
    (agentId: AgentId, messageText: string, critique?: string, rating: "up" | "down" = "up") => {
      if (rating === "up") {
        setAgents((prev) =>
          prev.map((a) => {
            if (a.id !== agentId) return a;
            const newXp = (a.xp ?? 50) + 15;
            const { level, hasStar } = calculateAgentLevel(newXp);
            return {
              ...a,
              xp: newXp,
              level,
              rankBadge: hasStar ? (level >= 3 ? ("crown" as const) : ("star" as const)) : undefined,
            };
          }),
        );
        playCompleteChime();
        showNotice("تم تسجيل تقييمك الممتاز وترقية نقاط خبرة الوكيل (+15 XP)!");
        return;
      }

      if (!critique || !critique.trim()) return;
      const agent = getAgentById(agentId, agents);
      if (!agent) return;

      playClickSound();
      const refinedRule = `[تطوير ذاتي من المدير العام]: يجب مراعاة الملاحظة التالية وتجنب تكرارها: ${critique.trim()}`;
      const newEvolutionEntry: SelfEvolutionEntry = {
        id: `evo-${Date.now()}`,
        agentId,
        agentNameAr: agent.nameAr,
        roomId: agent.roomId,
        critiqueAr: critique.trim(),
        refinedRuleAr: refinedRule,
        timestamp: Date.now(),
      };

      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId) return a;
          const currentRules = a.rules ? `${a.rules}\n- ${refinedRule}` : `- ${refinedRule}`;
          const currentLog = a.selfEvolutionLog ?? [];
          return {
            ...a,
            rules: currentRules,
            selfEvolutionLog: [newEvolutionEntry, ...currentLog],
          };
        }),
      );

      triggerFloorPulse("gm", agentId, "#c084fc", "تطوير ذاتي");
      showSpeech("gm", `قمت بتحليل ملاحظتك وصياغة قاعدة عمل جديدة لتحسين مخرجات ${agent.nameAr}! 🧠`, 5000);
      showNotice(`قام المدير العام بتطوير قواعد ${agent.nameAr} الذاتية وفق ملاحظتك!`);
    },
    [agents, showNotice, showSpeech, triggerFloorPulse],
  );

  const announceCompletion = useCallback(
    (agentId: AgentId, task: CompletionAnnouncement, receiptId?: number) => {
      setAgents((current) => {
        const next = completeAgentTask(current, agentId, task);
        return next.map((a) => {
          if (a.id !== agentId) return a;
          const currentXp = a.xp ?? 50;
          const newXp = currentXp + 35;
          const { level, hasStar } = calculateAgentLevel(newXp);
          return {
            ...a,
            xp: newXp,
            level,
            rankBadge: hasStar ? (level >= 3 ? ("crown" as const) : ("star" as const)) : undefined,
            consecutiveFailures: 0,
            deskLedColor: a.deskLedColor === "red" ? "green" : a.deskLedColor,
          };
        });
      });
      showSpeech(agentId, task.completionAr, 7000);
      playCompleteChime();

      // Check if task output produces a deliverable for the Vault
      if (task.logAr && task.logAr.length > 50) {
        const agent = getAgentById(agentId, agents);
        const format =
          task.titleAr.includes("جدول") || task.titleAr.includes("ميزانية")
            ? "csv"
            : "markdown";
        const type: DeliverableItem["type"] = task.titleAr.includes("جدول")
          ? "table"
          : task.titleAr.includes("سكريبت") || task.titleAr.includes("سيناريو")
            ? "script"
            : "report";

        addDeliverable({
          titleAr: task.titleAr,
          agentId,
          agentNameAr: agent?.nameAr ?? "الوكيل",
          agentRoleAr: agent?.roleAr ?? "فريق العمل",
          roomId: agent?.roomId,
          type,
          format,
          summaryAr: task.completionAr,
          content: `# ${task.titleAr}\n\n**المسؤول:** ${agent?.nameAr} (${agent?.roleAr})\n**التاريخ:** ${new Date().toLocaleDateString("ar-SA")}\n\n## تفاصيل المخرج والإنجاز:\n${task.logAr}\n\n## التوصيات والخطوات التالية:\n- تم الاعتماد الإداري وحفظ المخرج في الخزنة الذكية.`,
        });
        setDeliverables(loadDeliverables());
      }

      // Phase 2: Live green data pulse from Agent to Vault upon completion
      triggerFloorPulse(agentId, "vault", "#22c55e", "مخرج مكتمل");

      if (receiptId === undefined) return;
      setReceipt((current) =>
        current && current.id === receiptId
          ? { ...current, text: task.completionAr, status: "done" }
          : current,
      );
    },
    [showSpeech, agents, triggerFloorPulse],
  );

  useEffect(() => {
    // One-time migration: if server has only 1 GM room, check if client had existing state in localStorage
    try {
      if (typeof window !== "undefined") {
        const localState = loadOfficeState(initialAgents, initialRooms);
        if (localState && initialAgents.length === 1 && localState.agents.length > 1) {
          setAgents(localState.agents);
          setRooms(localState.rooms);
          const savedLocalTheme = (window.localStorage.getItem("office-theme") as ThemeMode) || initialTheme;
          const savedLocalSheetId = window.localStorage.getItem(SHEET_ID_STORAGE_KEY) || initialSheetId;
          if (savedLocalTheme) setTheme(savedLocalTheme);
          if (savedLocalSheetId) {
            setSheetId(savedLocalSheetId);
            setSheetInput(savedLocalSheetId);
          }
          saveOfficeStateToServer({
            agents: localState.agents,
            rooms: localState.rooms,
            theme: savedLocalTheme,
            sheetId: savedLocalSheetId,
          });
        }
        // Purge legacy browser localStorage keys completely
        window.localStorage.removeItem("virtual-office-state-v2");
        window.localStorage.removeItem("virtual-office-state-v1");
        window.localStorage.removeItem("office-theme");
        window.localStorage.removeItem(SHEET_ID_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable or blocked
    }

    const now = Date.now();
    for (const agent of agents) {
      const task = agent.activeTask;
      if (agent.status !== "working" || !task?.startedAt || !task.durationMs) continue;
      if (task.startedAt + task.durationMs > now && task.startAr) {
        showSpeech(agent.id, task.startAr, 5000);
      }
    }
    setDeliverables(loadDeliverables());
    if (typeof window !== "undefined") {
      try {
        const savedLedger = window.localStorage.getItem(LEDGER_STORAGE_KEY);
        if (savedLedger) {
          const parsed = JSON.parse(savedLedger);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLedgerEntries(parsed);
          }
        }
      } catch {
        // ignore
      }
    }
    setSoundActive(isSoundEnabled());
    setHydrated(true);
  }, [initialAgents, initialRooms, initialTheme, initialSheetId, showSpeech]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveOfficeStateToServer({
        agents,
        rooms,
        theme,
        sheetId: sheetId.trim() ? sheetId.trim() : null,
      });
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [agents, rooms, theme, sheetId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    for (const agent of agents) {
      const task = agent.activeTask;
      if (agent.status !== "working" || !task?.startedAt || !task.durationMs) continue;
      if (completionTimers.current.has(agent.id)) continue;

      const taskId = task.id ?? `task-${agent.id}-${task.startedAt}`;
      const remaining = task.startedAt + task.durationMs - Date.now();
      const finish = () => {
        if (!mountedRef.current) return;
        announceCompletion(agent.id, {
          id: taskId,
          titleAr: task.titleAr,
          completionAr: task.completionAr ?? "تم ✅ أنجزت المهمة.",
          logAr: task.logAr,
          source: task.source,
        });
        completionTimers.current.delete(agent.id);
      };

      if (remaining <= 0) {
        finish();
        continue;
      }

      const timer = setTimeout(finish, remaining);
      completionTimers.current.set(agent.id, timer);
    }
  }, [agents, hydrated, announceCompletion]);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, _token, meta) => {
        if (!mountedRef.current) return;
        setGoogleUser(user);
        setNeedsAuth(false);
        if (meta?.fromRedirect) {
          showNotice("تم ربط حساب Google بنجاح. Gmail وGoogle Sheets جاهزان الآن.");
        }
      },
      (user) => {
        if (!mountedRef.current) return;
        setGoogleUser(user);
        setNeedsAuth(true);
      },
      (error) => {
        if (!mountedRef.current) return;
        const formatted = formatGoogleSignInError({
          error,
          isEmbedded: isInEmbeddedFrame(),
          currentUrl: typeof window !== "undefined" ? window.location.href : null,
        });
        showNotice(formatted.notice, formatted.openTabUrl);
      },
    );
    return () => unsubscribe();
  }, [showNotice]);

  const openAgent = useCallback((agentId: AgentId) => {
    setSelectedAgentId(agentId);
  }, []);

  const openRoom = useCallback(
    (roomId: RoomId) => {
      const room = getRoomById(roomId, rooms);
      if (room?.agentIds[0]) setSelectedAgentId(room.agentIds[0]);
    },
    [rooms],
  );

  const closeModal = useCallback(() => setSelectedAgentId(null), []);

  const handleSaveAgentRules = useCallback(
    (agentId: AgentId, rules: string) => {
      setAgents((current) =>
        current.map((entry) =>
          entry.id === agentId
            ? {
                ...entry,
                rules,
              }
            : entry,
        ),
      );
      showNotice("تم حفظ القواعد وتفعيلها في تعليمات الوكيل.");
    },
    [showNotice],
  );

  const handleToggleAgentSkill = useCallback((agentId: AgentId, skillId: string) => {
    setAgents((current) =>
      current.map((entry) => {
        if (entry.id !== agentId) return entry;
        const exists = entry.skills.includes(skillId);
        const nextSkills = exists
          ? entry.skills.filter((s) => s !== skillId)
          : [...entry.skills, skillId];
        return {
          ...entry,
          skills: nextSkills,
        };
      }),
    );
  }, []);

  const handleAddCustomSkill = useCallback(
    (agentId: AgentId, customSkill: CustomSkillDefinition) => {
      setAgents((current) =>
        current.map((entry) =>
          entry.id === agentId
            ? {
                ...entry,
                customSkills: [...(entry.customSkills ?? []), customSkill],
              }
            : entry,
        ),
      );
      showNotice(`تم تثبيت المهارة المخصصة «${customSkill.nameAr}».`);
    },
    [showNotice],
  );

  const handleRemoveCustomSkill = useCallback((agentId: AgentId, customSkillId: string) => {
    setAgents((current) =>
      current.map((entry) =>
        entry.id === agentId
          ? {
              ...entry,
              customSkills: (entry.customSkills ?? []).filter((s) => s.id !== customSkillId),
            }
          : entry,
      ),
    );
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);
    let redirected = false;
    try {
      const result = await googleSignIn();
      if (!mountedRef.current) return;
      if (!result) {
        redirected = true;
        return;
      }
      setGoogleUser(result.user);
      setNeedsAuth(false);
      showNotice("تم ربط حساب Google بنجاح. Gmail وGoogle Sheets جاهزان الآن.");
    } catch (error) {
      if (!mountedRef.current) return;
      const currentUrl = typeof window !== "undefined" ? window.location.href : null;
      const formatted = formatGoogleSignInError({
        error,
        isEmbedded: isInEmbeddedFrame(),
        currentUrl,
      });
      showNotice(formatted.notice, formatted.openTabUrl);
    } finally {
      if (mountedRef.current && !redirected) setAuthLoading(false);
    }
  }, [authLoading, showNotice]);

  const handleGoogleSignOut = useCallback(async () => {
    await googleLogout();
    if (!mountedRef.current) return;
    setGoogleUser(null);
    setNeedsAuth(true);
    setGoogleModalOpen(false);
    showNotice("تم فصل حساب Google. ستعمل أدوات Gmail وSheets بالوضع التجريبي.");
  }, [showNotice]);

  const handleSaveSheetId = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = parseSpreadsheetId(sheetInput);
      setSheetId(parsed);
      setSheetInput(parsed);
      if (parsed) {
        showNotice("تم حفظ معرّف جدول Google Sheets في ملفات المشروع بنجاح.");
      } else {
        showNotice("تم مسح المعرّف — سيُنشأ جدول جديد تلقائياً عند أول طلب مالي.");
      }
      setGoogleModalOpen(false);
    },
    [sheetInput, showNotice],
  );

  const performResetOffice = useCallback(() => {
    resetEpoch.current += 1;
    completionTimers.current.forEach((timer) => clearTimeout(timer));
    completionTimers.current.clear();
    speechTimers.current.forEach((timer) => clearTimeout(timer));
    speechTimers.current.clear();
    clearOfficeState();
    clearOfficeStateOnServer().catch(() => {});

    setAgents(cloneAgents(initialAgents));
    setRooms(cloneRooms(initialRooms));
    setSpeeches({});
    setReceipt(undefined);
    setSelectedAgentId(null);
    setConfirmResetOpen(false);
    setPendingConfirm(null);
    setFilter("all");
    setTarget("auto");
    showNotice("تمت إعادة ضبط المكتب إلى غرفة المدير العام فقط وتحديث ملف المشروع.");
  }, [initialAgents, initialRooms, showNotice]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmResetOpen || googleModalOpen || pendingConfirm) {
        if (event.key === "Escape") {
          event.preventDefault();
          setConfirmResetOpen(false);
          setGoogleModalOpen(false);
          setPendingConfirm(null);
        }
        return;
      }

      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (!isInput && (event.key === "c" || event.key === "C" || event.key === "ؤ")) {
        event.preventDefault();
        setChatOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmResetOpen, googleModalOpen, pendingConfirm]);

  // Hallway Messenger Walking Animation
  const animateHallwayMessenger = useCallback(
    (targetRoom: Room) => {
      const startX = 228;
      const startY = 174;
      const doorX = 388;
      const doorY = 188;
      const hallX = 420;
      const targetDoorX =
        targetRoom.rect.x > 400 ? targetRoom.rect.x : targetRoom.rect.x + targetRoom.rect.w;
      const targetY = targetRoom.rect.y + 100;

      const waypoints = [
        { x: startX, y: startY },
        { x: doorX, y: doorY },
        { x: hallX, y: doorY },
        { x: targetDoorX, y: targetY },
      ];

      let currentWaypoint = 0;
      let stepCount = 0;

      setWalkingMessenger({
        id: `walk-${Date.now()}`,
        x: startX,
        y: startY,
        targetRoomId: targetRoom.id,
        labelAr: `تكليف من المدير العام إلى ${targetRoom.shortNameAr}`,
        step: 0,
      });

      const walkInterval = setInterval(() => {
        stepCount++;
        const wp = waypoints[currentWaypoint];
        const nextWp = waypoints[currentWaypoint + 1];
        if (!nextWp) {
          clearInterval(walkInterval);
          setWalkingMessenger(null);
          return;
        }

        const dx = nextWp.x - wp.x;
        const dy = nextWp.y - wp.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
          currentWaypoint++;
          if (currentWaypoint >= waypoints.length - 1) {
            clearInterval(walkInterval);
            setWalkingMessenger(null);
            if (targetRoom.agentIds[0]) {
              showSpeech(
                targetRoom.agentIds[0],
                "استلمت تكليف المدير العام وأبدأ العمل فوراً!",
                4000,
              );
            }
            return;
          }
        }

        const speed = 4.0;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        setWalkingMessenger((prev) =>
          prev
            ? {
                ...prev,
                x: prev.x + vx,
                y: prev.y + vy,
                step: stepCount,
              }
            : null,
        );
      }, 35);
    },
    [showSpeech],
  );

  const runCommand = useCallback(
    async (
      commandTarget: CommandTarget,
      command: string,
      confirmAction?: AgentCommandRequest["confirmAction"],
    ): Promise<{
      ok: boolean;
      agentId?: AgentId;
      startAr?: string;
      logAr?: string;
      completionAr?: string;
      error?: string;
    }> => {
      if (sending) return { ok: false, error: "يوجد أمر قيد التنفيذ حالياً." };
      const epoch = resetEpoch.current;
      setSending(true);
      setNotice(null);

      // Phase 2: Check if target agent is in Cooldown (Coffee Corner)
      const targetAgentId: AgentId =
        commandTarget !== "auto" && !commandTarget.startsWith("room:")
          ? (commandTarget as AgentId)
          : GM_AGENT_ID;

      const targetAgent = getAgentById(targetAgentId, agents);
      if (targetAgent?.status === "cooldown") {
        const remainingSecs = Math.max(1, Math.ceil(((targetAgent.cooldownUntil ?? 0) - Date.now()) / 1000));
        setSending(false);
        showNotice(`الوكيل ${targetAgent.nameAr} في استراحة قهوة لشحن طاقته وحماية الكوتا (متبقي ${remainingSecs} ثوانٍ) ☕`);
        return {
          ok: false,
          error: `الوكيل في استراحة قهوة مؤقتة (${remainingSecs} ثانية متبقية).`,
        };
      }

      // Phase 2: Consume Stamina (-25%) & trigger auto Cooldown if stamina < 15%
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== targetAgentId) return a;
          const curStamina = a.stamina ?? 100;
          const nextStamina = Math.max(0, curStamina - 25);
          if (nextStamina < 15) {
            showSpeech(a.id, "طاقتي قاربت على النفاد! سأتوجه لركن القهوة للاستراحة وشحن طاقتي (15 ثانية)... ☕", 6000);
            return {
              ...a,
              stamina: nextStamina,
              status: "cooldown",
              originalPosition: a.originalPosition ?? a.position,
              position: COFFEE_CORNER_POS,
              cooldownUntil: Date.now() + 15000,
            };
          }
          return {
            ...a,
            stamina: nextStamina,
          };
        }),
      );

      // Human-in-the-Loop rule interception
      if (!confirmAction) {
        const matchingRule = agents
          .flatMap((a) => a.scriptRules ?? [])
          .find(
            (r) =>
              r.enabled &&
              r.action === "requireApproval" &&
              r.keyword &&
              command.includes(r.keyword),
          );

        if (matchingRule) {
          const targetId = commandTarget === "auto" ? GM_AGENT_ID : commandTarget;
          const agent = getAgentById(targetId, agents);
          setPendingApproval({
            id: `appr-${Date.now()}`,
            agentId: targetId,
            agentNameAr: agent?.nameAr ?? "الوكيل",
            agentRoleAr: agent?.roleAr ?? "فريق العمل",
            titleAr: matchingRule.titleAr,
            actionDescriptionAr: `الأمر يتطلب موافقتك الشخصية قبل تطبيقه: «${command}»`,
            impactLevel: "high",
            payload: { command, target: commandTarget, rule: matchingRule.titleAr },
            timestamp: Date.now(),
            status: "pending",
          });
          setAgents((cur) =>
            cur.map((a) => (a.id === targetId ? { ...a, status: "waiting_approval" } : a)),
          );
          playAlertBeep();
          setSending(false);
          return {
            ok: true,
            agentId: targetId,
            startAr: "✋ بانتظار الموافقة البشرية قبل التنفيذ...",
            logAr: "تم تعليق الإجراء بانتظار موافقتك الصريحة عبر نافذة الحوكمة والاعتماد.",
          };
        }
      }

      try {
        const accessToken = getGoogleAccessToken();
        const requestBody: AgentCommandRequest = {
          target: commandTarget,
          command,
          agents: agents.map((a) => toAgentPromptProfile(a, rooms)),
          rooms: rooms.map((r) => ({
            id: r.id,
            nameAr: r.nameAr,
            shortNameAr: r.shortNameAr,
            furnitureStyle: r.furnitureStyle,
            agentIds: [...r.agentIds],
            rules: r.rules,
            skills: r.skills,
          })),
          globalRules,
          globalSkills,
          sandboxMode,
          ...(sheetId ? { sheetId } : {}),
          ...(confirmAction ? { confirmAction } : {}),
        };

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(requestBody),
        });
        const payload = (await response.json()) as AgentCommandResponse | AgentCommandError;
        if (resetEpoch.current !== epoch) return { ok: false, error: "تمت إعادة ضبط المكتب." };
        if (!response.ok || !payload.ok) {
          throw new Error("error" in payload ? payload.error : "تعذّر تنفيذ الأمر.");
        }

        const commandResult = payload;

        // Phase 2: Infinite Loop Circuit Breaker Check
        if ("loopBreakerTriggered" in commandResult && commandResult.loopBreakerTriggered) {
          playAlertBeep();
          showNotice("🛑 تم تشغيل قاطع الدائرة الذكي لمنع تكرار الحلقات اللا نهائية وحفظ الرصيد!");
        }

        if (commandResult.createdSheetId) {
          setSheetId(commandResult.createdSheetId);
          setSheetInput(commandResult.createdSheetId);
          showNotice("تم إنشاء جدول «المكتب الافتراضي — السجل المالي» في Google Sheets وربطه تلقائياً وحفظه بالمشروع.");
        }

        if (commandResult.authExpired) {
          clearGoogleAccessToken();
          setNeedsAuth(true);
          showNotice("انتهت صلاحية جلسة Google. اضغط «Sign in with Google» لتجديد الإذن.");
        }

        if (commandResult.pendingConfirmation) {
          setPendingConfirm({
            agentId: commandResult.agentId,
            command,
            confirmation: commandResult.pendingConfirmation,
          });
          return {
            ok: true,
            agentId: commandResult.agentId,
            startAr: "يتطلب هذا الإجراء تأكيداً منك قبل التنفيذ.",
            logAr: commandResult.pendingConfirmation.descriptionAr,
          };
        }

        let currentAgentsSnapshot = agents;
        let currentRoomsSnapshot = rooms;

        const specsToCreate: CreatedAgentSpec[] =
          commandResult.createdAgents && commandResult.createdAgents.length > 0
            ? commandResult.createdAgents
            : commandResult.createdAgent
              ? [commandResult.createdAgent]
              : [];

        if (specsToCreate.length > 0) {
          let runningAgents = [...agents];
          let runningRooms = [...rooms];
          const createdAgentInstances: Agent[] = [];

          for (const spec of specsToCreate) {
            const {
              agent: newAgent,
              room: targetRoom,
              isNewRoom,
              updatedExistingAgents,
            } = createAgentAndRoomFromSpec(spec, runningAgents, runningRooms);

            if (isNewRoom) {
              runningRooms = [...runningRooms, targetRoom];
              runningAgents = [...runningAgents, newAgent];
            } else {
              runningRooms = runningRooms.map((r) => (r.id === targetRoom.id ? targetRoom : r));
              const updatedMap = new Map(updatedExistingAgents.map((a) => [a.id, a]));
              runningAgents = [...runningAgents.map((a) => updatedMap.get(a.id) ?? a), newAgent];
            }
            createdAgentInstances.push(newAgent);
          }

          currentRoomsSnapshot = runningRooms;
          currentAgentsSnapshot = runningAgents;

          setRooms(currentRoomsSnapshot);
          setAgents(() =>
            beginAgentTask(currentAgentsSnapshot, commandResult.agentId, {
              id: commandResult.task.id,
              titleAr: commandResult.task.titleAr,
              durationMs: commandResult.task.durationMs,
              startAr: commandResult.messages.startAr,
              completionAr: commandResult.messages.completionAr,
              logAr: commandResult.messages.logAr,
              source: commandResult.source,
            }),
          );

          if (createdAgentInstances.length === 1) {
            const newAgent = createdAgentInstances[0];
            showSpeech(newAgent.id, `مرحباً! أنا ${newAgent.nameAr} (${newAgent.roleAr}).`, 5500);
            showNotice(`تم توظيف ${newAgent.nameAr} (${newAgent.roleAr}) بنجاح!`);
          } else {
            for (const agent of createdAgentInstances) {
              showSpeech(agent.id, `جاهز للعمل! (${agent.roleAr})`, 6000);
            }
            showNotice(`تم توظيف ${createdAgentInstances.length} وكلاء جدد وتجهيز غرفهم بنجاح!`);
          }
        } else {
          setAgents((current) =>
            beginAgentTask(current, commandResult.agentId, {
              id: commandResult.task.id,
              titleAr: commandResult.task.titleAr,
              durationMs: commandResult.task.durationMs,
              startAr: commandResult.messages.startAr,
              completionAr: commandResult.messages.completionAr,
              logAr: commandResult.messages.logAr,
              source: commandResult.source,
            }),
          );
        }

        const resolvedAgent = getAgentById(commandResult.agentId, currentAgentsSnapshot);
        const resolvedName = resolvedAgent?.nameAr ?? "الوكيل";

        // Phase 2: Financial Accounting Ledger Recording
        const usage = commandResult.usage ?? {
          inputTokens: Math.floor(command.length * 3.5) + 350,
          outputTokens: Math.floor((commandResult.messages.logAr?.length ?? 100) * 0.8) + 120,
          totalTokens: 0,
          costUsd: 0,
        };
        const totalToks = usage.totalTokens || (usage.inputTokens + usage.outputTokens);
        const calculatedCost = usage.costUsd || ((usage.inputTokens * 0.075 + usage.outputTokens * 0.30) / 1_000_000);

        const newLedgerItem: LedgerEntry = {
          id: `led-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          requestId: commandResult.task.id,
          timestamp: Date.now(),
          agentId: commandResult.agentId,
          agentNameAr: resolvedName,
          roomId: resolvedAgent?.roomId,
          roomNameAr: getRoomById(resolvedAgent?.roomId ?? "", rooms)?.nameAr,
          taskTitleAr: commandResult.task.titleAr,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: totalToks,
          costUsd: calculatedCost,
          source: commandResult.source,
        };

        setLedgerEntries((prev) => {
          const updated = [newLedgerItem, ...prev];
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(updated.slice(0, 100)));
            } catch {
              // ignore
            }
          }
          return updated;
        });

        // Phase 2: Live Circuit Data Pulse from initiator to target agent
        if (commandResult.routedBy && commandResult.routedBy !== commandResult.agentId) {
          triggerFloorPulse(commandResult.routedBy, commandResult.agentId, "#00f0ff", "أمر عمل");
        } else {
          triggerFloorPulse("gm", commandResult.agentId, "#00f0ff", "بيانات");
        }

        const existingTimer = completionTimers.current.get(commandResult.agentId);
        if (existingTimer) clearTimeout(existingTimer);

        showSpeech(
          commandResult.agentId,
          commandResult.messages.startAr,
          Math.min(5000, commandResult.task.durationMs),
        );

        if (
          commandResult.routedBy &&
          commandResult.routedBy !== commandResult.agentId &&
          commandResult.routedBy === "gm"
        ) {
          showSpeech(
            commandResult.routedBy,
            `أحوّل الطلب إلى ${resolvedName} الآن.`,
            2600,
          );
          const targetRoom = rooms.find((r) => r.id === resolvedAgent?.roomId);
          if (targetRoom) {
            animateHallwayMessenger(targetRoom);
          }
        }

        const pendingReceipt: CommandReceipt = {
          id: nextReceiptId.current++,
          agentNameAr: resolvedName,
          text: commandResult.messages.startAr,
          status: "pending",
        };
        setReceipt(pendingReceipt);

        const timer = setTimeout(() => {
          if (!mountedRef.current) return;
          announceCompletion(
            commandResult.agentId,
            {
              id: commandResult.task.id,
              titleAr: commandResult.task.titleAr,
              completionAr: commandResult.messages.completionAr,
              logAr: commandResult.messages.logAr,
              source: commandResult.source,
            },
            pendingReceipt.id,
          );
          completionTimers.current.delete(commandResult.agentId);
        }, commandResult.task.durationMs);
        completionTimers.current.set(commandResult.agentId, timer);

        setFilter("all");

        return {
          ok: true,
          agentId: commandResult.agentId,
          startAr: commandResult.messages.startAr,
          logAr: commandResult.messages.logAr,
          completionAr: commandResult.messages.completionAr,
        };
      } catch (error) {
        if (resetEpoch.current !== epoch) return { ok: false, error: "تمت إعادة ضبط المكتب." };
        const message =
          error instanceof Error && error.message !== "Failed to fetch"
            ? error.message
            : "تعذّر الوصول إلى محرك الوكلاء. تحقّق من الاتصال وحاول مجدداً.";
        setReceipt({
          id: nextReceiptId.current++,
          agentNameAr: "مركز العمليات",
          text: message,
          status: "error",
        });
        showNotice(message);

        // Smart Incident Escalation Tracking (after 3 failures -> file EscalationTicket)
        const targetAgentId: AgentId =
          commandTarget !== "auto" && !commandTarget.startsWith("room:")
            ? (commandTarget as AgentId)
            : GM_AGENT_ID;

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id !== targetAgentId) return a;
            const failures = (a.consecutiveFailures ?? 0) + 1;
            const isAlert = failures >= 3;
            if (isAlert) {
              const ticket: EscalationTicket = {
                id: `ticket-${Date.now()}`,
                agentId: a.id,
                agentNameAr: a.nameAr,
                roomId: a.roomId,
                roomNameAr: getRoomById(a.roomId, rooms)?.nameAr,
                errorDescriptionAr: `تعثر متكرر (${failures} مرات متتالية): ${message}`,
                timestamp: Date.now(),
                status: "open",
                diagnosisAr:
                  "تكرار الفشل 3 مرات متتالية أثناء تنفيذ المهام. تم تفعيل شارة الطوارئ وإخطار المدير العام للتدخل وإعادة التوجيه.",
              };
              setEscalationTickets((curr) => [ticket, ...curr.filter((t) => t.agentId !== a.id)]);
              playAlertBeep();
            }
            return {
              ...a,
              consecutiveFailures: failures,
              deskLedColor: isAlert ? "red" : a.deskLedColor,
            };
          }),
        );

        if (commandTarget !== "auto") {
          showSpeech(commandTarget, "تعذّر الاتصال. سأحاول مرة أخرى عند وصول الأمر.", 5000);
        }
        return {
          ok: false,
          error: message,
        };
      } finally {
        if (mountedRef.current) setSending(false);
      }
    },
    [sending, agents, rooms, sheetId, announceCompletion, showNotice, showSpeech],
  );

  const handleConfirmPendingAction = useCallback(() => {
    if (!pendingConfirm) return;
    const active = pendingConfirm;
    setPendingConfirm(null);
    void runCommand(active.agentId, active.command, {
      toolName: active.confirmation.toolName,
      targetAgentId: active.agentId,
      args: active.confirmation.args,
    });
  }, [pendingConfirm, runCommand]);

  const handleCancelPendingAction = useCallback(() => {
    setPendingConfirm(null);
    showNotice("تم إلغاء الإجراء دون تعديل بيانات Google.");
  }, [showNotice]);

  const runQuickAction = useCallback(
    (agentId: AgentId, action: QuickAction) => {
      setSelectedAgentId(null);
      void runCommand(agentId, action.command);
    },
    [runCommand],
  );

  // Sound Engine Toggle
  const toggleSound = useCallback(() => {
    setSoundActive((prev) => {
      const next = !prev;
      setSoundEnabled(next);
      if (next) playClickSound();
      return next;
    });
  }, []);

  // Human-in-the-Loop Handlers
  const handleApproveRequest = useCallback(
    (req: ApprovalRequest) => {
      playCompleteChime();
      setPendingApproval(null);
      showNotice(`تمت الموافقة على إجراء «${req.titleAr}» وجارٍ تنفيذه.`);
      void runCommand(
        req.agentId,
        typeof req.payload === "string" ? req.payload : req.titleAr,
      );
    },
    [runCommand, showNotice],
  );

  const handleRejectRequest = useCallback(
    (req: ApprovalRequest) => {
      playClickSound();
      setPendingApproval(null);
      setAgents((current) =>
        current.map((a) => (a.id === req.agentId ? { ...a, status: "idle" } : a)),
      );
      showNotice(`تم رفض الإجراء وإلغاء التنفيذ.`);
    },
    [showNotice],
  );

  // Multi-Agent Sequential Collaboration
  const runCollaborativeWorkflow = useCallback(
    async (roomId: RoomId, promptTitle: string) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || room.agentIds.length < 2) {
        showNotice("تتطلب سلسلة العمل الجماعي وكيلين على الأقل في نفس الغرفة.");
        return;
      }

      showNotice(`بدء سلسلة العمل الجماعي في ${room.nameAr}...`);
      playFlyPacketSound();

      const agent1Id = room.agentIds[0];
      const agent2Id = room.agentIds[1];
      const agent3Id = room.agentIds[2] ?? null;

      const agent1 = getAgentById(agent1Id, agents);
      const agent2 = getAgentById(agent2Id, agents);
      const agent3 = agent3Id ? getAgentById(agent3Id, agents) : null;

      showSpeech(
        agent1Id,
        `أبدأ المرحلة الأولى: التدقيق والتحليل لـ ${promptTitle}...`,
        4000,
      );
      setAgents((current) =>
        beginAgentTask(current, agent1Id, {
          id: `task-stage1-${Date.now()}`,
          titleAr: `المرحلة 1: التدقيق والتحليل لـ ${promptTitle}`,
          durationMs: 3000,
          startAr: "جارٍ فحص البيانات واستخراج المؤشرات...",
          completionAr: "تم إنهاء المرحلة الأولى واستخراج البيانات.",
          logAr: "أنجزت التحليل الاستراتيجي وسلّمت المؤشرات لصانع المحتوى.",
        }),
      );

      setTimeout(() => {
        playFlyPacketSound();
        if (agent1 && agent2) {
          const packetId = `pkt-${Date.now()}`;
          setFlyingPackets([
            {
              id: packetId,
              fromX: agent1.position.x,
              fromY: agent1.position.y - 10,
              toX: agent2.position.x,
              toY: agent2.position.y - 10,
              progress: 0,
              labelAr: "بيانات التحليل والمؤشرات ✉",
            },
          ]);

          const startTime = Date.now();
          const duration = 800;
          const animInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            setFlyingPackets((prev) =>
              prev.map((p) => (p.id === packetId ? { ...p, progress } : p)),
            );
            if (progress >= 1) {
              clearInterval(animInterval);
              setTimeout(() => setFlyingPackets([]), 300);
              playCompleteChime();

              showSpeech(
                agent2Id,
                `استلمت بيانات التحليل! أبدأ صياغة المحتوى وسيناريوهات الريلز...`,
                4500,
              );
              setAgents((current) =>
                beginAgentTask(current, agent2Id, {
                  id: `task-stage2-${Date.now()}`,
                  titleAr: `المرحلة 2: صياغة سيناريوهات المحتوى لـ ${promptTitle}`,
                  durationMs: 3200,
                  startAr: "جارٍ كتابة سكريبتات الريلز والخطافات...",
                  completionAr: "تم إعداد سيناريوهات الريلز بنجاح.",
                  logAr: "صغت 3 سكريبتات ريلز متطابقة مع نتائج التحليل وسلمتها للمصمم.",
                }),
              );

              if (agent3Id && agent3) {
                setTimeout(() => {
                  playFlyPacketSound();
                  const packet2Id = `pkt2-${Date.now()}`;
                  setFlyingPackets([
                    {
                      id: packet2Id,
                      fromX: agent2.position.x,
                      fromY: agent2.position.y - 10,
                      toX: agent3.position.x,
                      toY: agent3.position.y - 10,
                      progress: 0,
                      labelAr: "نصوص وسيناريوهات الفيديو ✉",
                    },
                  ]);

                  const start2Time = Date.now();
                  const anim2Interval = setInterval(() => {
                    const elapsed2 = Date.now() - start2Time;
                    const progress2 = Math.min(1, elapsed2 / duration);
                    setFlyingPackets((prev) =>
                      prev.map((p) => (p.id === packet2Id ? { ...p, progress: progress2 } : p)),
                    );
                    if (progress2 >= 1) {
                      clearInterval(anim2Interval);
                      setTimeout(() => setFlyingPackets([]), 300);
                      playCompleteChime();

                      showSpeech(
                        agent3Id,
                        `أبدأ تصميم القوالب البصرية للكاروسيل وأغلفة الريلز...`,
                        4500,
                      );
                      setAgents((current) =>
                        beginAgentTask(current, agent3Id, {
                          id: `task-stage3-${Date.now()}`,
                          titleAr: `المرحلة 3: إنتاج الهوية البصرية والقوالب لـ ${promptTitle}`,
                          durationMs: 3000,
                          startAr: "جارٍ ضبط الألوان وتوليد البرومبتات...",
                          completionAr: "تم إنهاء التصاميم وتجهيز الحزمة الكاملة.",
                          logAr: "أعددت القوالب البصرية والبوسترات وسلمت الحزمة للاعتماد.",
                        }),
                      );

                      setTimeout(() => {
                        if (room.peerReviewEnabled) {
                          showSpeech(
                            GM_AGENT_ID,
                            `أراجع مخرجات فريق ${room.nameAr} وأعتمدها رسمياً. ✓`,
                            5000,
                          );
                        }
                        addDeliverable({
                          titleAr: `حزمة العمل المشترك — ${promptTitle}`,
                          agentId: agent1Id,
                          agentNameAr: `فريق ${room.shortNameAr}`,
                          agentRoleAr: "عمل تعاوني مشترك",
                          roomId: room.id,
                          type: "plan",
                          format: "markdown",
                          summaryAr: `مخرج تعاوني متكامل شارك فيه ${agent1?.nameAr} و${agent2?.nameAr}${agent3 ? ` و${agent3.nameAr}` : ""}.`,
                          content: `# مخرج تعاوني متكامل — ${promptTitle}\n\n## مسار العمل المشترك:\n1. **${agent1?.nameAr}:** أنجز التحليل الاستراتيجي.\n2. **${agent2?.nameAr}:** أعد سيناريوهات المحتوى.\n${agent3 ? `3. **${agent3.nameAr}:** أنجز التصاميم والهوية البصرية.\n` : ""}4. **الاعتماد الإداري:** تم التدقيق والتسليم في الخزنة بنجاح.`,
                        });
                        setDeliverables(loadDeliverables());
                        showNotice(`اكتملت سلسلة العمل الجماعي وحُفظ المخرج في خزنة المخرجات!`);
                        playCompleteChime();
                      }, 3200);
                    }
                  }, 30);
                }, 3400);
              }
            }
          }, 30);
        }
      }, 3200);
    },
    [rooms, agents, showNotice, showSpeech],
  );

  // Background Autonomous Scheduler (Cron Loop)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const agent of agents) {
        if (!agent.schedule?.enabled) continue;
        if (agent.status === "working") continue;
        if (now >= agent.schedule.nextRunTimestamp) {
          showNotice(`⏰ تشغيل المهمة المجدولة لـ ${agent.nameAr}: ${agent.schedule.labelAr}`);
          playAlertBeep();
          void runCommand(agent.id, agent.schedule.prompt);
          const nextRun = now + agent.schedule.intervalMinutes * 60_000;
          setAgents((current) =>
            current.map((a) =>
              a.id === agent.id && a.schedule
                ? { ...a, schedule: { ...a.schedule, nextRunTimestamp: nextRun } }
                : a,
            ),
          );
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [agents, runCommand, showNotice]);

  // Agent Modal Handlers
  const handleSaveAgentTools = useCallback(
    (agentId: AgentId, tools: CustomWebhookTool[]) => {
      setAgents((current) =>
        current.map((a) => (a.id === agentId ? { ...a, customTools: tools } : a)),
      );
      showNotice("تم تحديث وحفظ قائمة الإضافات والـ Webhooks بنجاح.");
    },
    [showNotice],
  );

  const handleSaveAgentRulesConfig = useCallback(
    (agentId: AgentId, rules: AutomationRule[]) => {
      setAgents((current) =>
        current.map((a) => (a.id === agentId ? { ...a, scriptRules: rules } : a)),
      );
      showNotice("تم حفظ قواعد الأتمتة البرمجية وتفعيلها على الوكيل.");
    },
    [showNotice],
  );

  const handleSaveAgentSchedule = useCallback(
    (agentId: AgentId, schedule?: AgentSchedule) => {
      setAgents((current) =>
        current.map((a) => (a.id === agentId ? { ...a, schedule } : a)),
      );
      showNotice(
        schedule
          ? "تم تفعيل وحفظ الجدولة التلقائية بنجاح."
          : "تم إيقاف الجدولة التلقائية.",
      );
    },
    [showNotice],
  );

  const handleSaveAgentMemory = useCallback(
    (agentId: AgentId, memory: string[]) => {
      setAgents((current) =>
        current.map((a) => (a.id === agentId ? { ...a, memory } : a)),
      );
      showNotice("تم تحديث ذاكرة الوكيل الدائمة بنجاح.");
    },
    [showNotice],
  );

  const handleTogglePeerReview = useCallback(
    (roomId: RoomId, enabled: boolean) => {
      setRooms((current) =>
        current.map((r) => (r.id === roomId ? { ...r, peerReviewEnabled: enabled } : r)),
      );
      showNotice(
        enabled
          ? "تم تفعيل مراجعة الجودة والاعتماد الإداري للغرفة."
          : "تم إيقاف مراجعة الجودة.",
      );
    },
    [showNotice],
  );

  const handleExportOfficeBlueprint = useCallback(() => {
    const blueprint: OfficeBlueprint = {
      version: "1.0",
      nameAr: "مخطط المكتب الافتراضي الكامل",
      exportedAt: Date.now(),
      globalRules,
      globalSkills,
      rooms,
      agents,
    };
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `office-blueprint-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playCompleteChime();
    showNotice("تم تصدير المخطط الكامل للمكتب بنجاح!");
  }, [globalRules, globalSkills, rooms, agents, showNotice]);

  const handleImportOfficeBlueprint = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string) as OfficeBlueprint;
          if (data.rooms && data.agents) {
            setRooms(cloneRooms(data.rooms));
            setAgents(cloneAgents(data.agents));
            if (data.globalRules) setGlobalRules(data.globalRules);
            if (data.globalSkills) setGlobalSkills(data.globalSkills);
            playCompleteChime();
            showNotice(`تم استيراد مخطط «${data.nameAr || "المكتب"}» بنجاح!`);
          } else {
            showNotice("فشل الاستيراد: ملف المخطط لا يحتوي على غرف أو وكلاء صالحين.");
          }
        } catch {
          showNotice("فشل الاستيراد: ملف JSON غير صالح.");
        }
      };
      reader.readAsText(file);
    },
    [showNotice],
  );

  const selectedAgent = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId) ?? null
    : null;
  const selectedRoom = selectedAgent ? getRoomById(selectedAgent.roomId, rooms) : null;
  const roomAgents = useMemo(
    () => (selectedRoom ? agents.filter((agent) => agent.roomId === selectedRoom.id) : []),
    [agents, selectedRoom],
  );

  const counts = statusCounts(agents);

  const filterItems = useMemo(
    () =>
      [
        { id: "all" as const, label: "الكل", count: agents.length },
        ...AGENT_STATUSES.map((status) => ({
          id: status,
          label: STATUS_META[status].pillLabelAr,
          count: counts[status],
        })),
      ],
    [agents.length, counts],
  );

  return (
    <div className={`app-root ${sandboxMode ? "sandbox-frame-active" : ""}`} data-theme={theme}>
      <div className="app-texture" aria-hidden="true" />
      {sandboxMode && (
        <div className="sandbox-mode-banner" role="status">
          <span className="sandbox-banner-icon">⚠️</span>
          <span className="sandbox-banner-text">
            <strong>وضع التدريب والمحاكاة (SANDBOX) قيد التشغيل:</strong> يتم اعتراض استدعاءات الأدوات الخارجية وتقديم مخرجات افتراضية دون مساس بالبيانات الحقيقية.
          </span>
          <button
            type="button"
            className="sandbox-banner-exit-btn pixel-btn"
            onClick={() => setSandboxMode(false)}
          >
            العودة للوضع المباشر (LIVE)
          </button>
        </div>
      )}
      <main className="app-main">
        <section className="stage-wrap" aria-label="خريطة المكتب">
          <OfficeStage
            ref={stageRef}
            agents={agents}
            rooms={rooms}
            filter={filter}
            theme={theme}
            speeches={speeches}
            flyingPackets={flyingPackets}
            walkingMessenger={walkingMessenger}
            showCircuitWires={showCircuitWires}
            floorPulses={floorPulses}
            onOpenAgent={openAgent}
            onOpenRoom={openRoom}
            onOpenRoomSettings={(roomId) => {
              playClickSound();
              setRoomSettingsRoomId(roomId);
            }}
          />

          <div className="room-travel stage-room-travel pixel-panel" aria-label="التنقل السريع بين غرف المكتب">
            <span className="toolbar-label">انتقال</span>
            <nav className="room-nav" aria-label="التنقل بين غرف المكتب">
              {rooms.map((room) => {
                const roomAgent = agents.find((a) => room.agentIds.includes(a.id));
                const RoomIcon =
                  roomAgent?.skills.includes("gmail-workspace")
                    ? MailIcon
                    : STYLE_ICONS[room.furnitureStyle];
                return (
                  <button
                    key={room.id}
                    type="button"
                    className="room-nav-button"
                    onClick={() => stageRef.current?.focusRoom(room.id)}
                  >
                    <RoomIcon width={13} height={13} />
                    <span>{room.shortNameAr}</span>
                    <i aria-hidden="true">{room.agentIds.length}</i>
                  </button>
                );
              })}
              <button
                type="button"
                className="room-nav-button room-nav-reset"
                onClick={() => stageRef.current?.fitAll()}
              >
                <span className="room-nav-reset-grid" aria-hidden="true" />
                <span>عرض المكتب</span>
              </button>
            </nav>
          </div>

          <div className="filter-cluster stage-filter-cluster pixel-panel">
            <span className="toolbar-label">الحالة</span>
            <div className="filter-pills" role="group" aria-label="تصفية حسب حالة الوكيل">
              {filterItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="filter-pill"
                  data-status={item.id}
                  data-active={filter === item.id ? "true" : "false"}
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                >
                  <span className="filter-led" aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className="filter-count">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Symmetrical bottom controls: Camera pad is at bottom-left, Operations HUD pad is at bottom-right */}
          <div
            className="agent-chat-pad pixel-panel"
            role="region"
            aria-label="لوحة تحكم وعمليات الوكلاء"
          >
            {pendingApproval ? (
              <button
                type="button"
                className="hud-action-btn approval-alert-pill pixel-btn"
                onClick={() => {
                  playAlertBeep();
                }}
                title="إجراء بانتظار موافقتك الشخصية"
              >
                <span className="approval-dot-pulse" aria-hidden="true" />
                <span>✋ موافقة معلّقة</span>
              </button>
            ) : null}

            {rooms.some((r) => r.agentIds.length >= 2) ? (
              <button
                type="button"
                className="hud-action-btn collab-hud-btn pixel-btn"
                onClick={() => {
                  const multiRoom = rooms.find((r) => r.agentIds.length >= 2);
                  if (multiRoom) {
                    void runCollaborativeWorkflow(
                      multiRoom.id,
                      "إطلاق خطة المحتوى والتسويق المتكاملة",
                    );
                  }
                }}
                title="إطلاق سلسلة عمل تعاوني بين وكلاء الغرفة المشتركة"
              >
                <RouteIcon width={14} height={14} />
                <span>تعاون الفريق</span>
              </button>
            ) : null}

            {/* Escalation Incidents Alert Pill */}
            {escalationTickets.length > 0 && (
              <button
                type="button"
                className="hud-action-btn incident-hud-pill pixel-btn pulse-red"
                onClick={() => {
                  playAlertBeep();
                  setIncidentOpen(true);
                }}
                title="تذاكر تصعيد وأزمات نشطة تتطلب تدخل المدير العام"
              >
                <span>🚨 {escalationTickets.length} بلاغ</span>
              </button>
            )}

            {/* Sandbox / Dry-Run Simulation Toggle */}
            <button
              type="button"
              className={`hud-action-btn sandbox-hud-btn pixel-btn ${sandboxMode ? "sandbox-on" : "live-on"}`}
              onClick={() => {
                playClickSound();
                setSandboxMode((prev) => !prev);
              }}
              title={
                sandboxMode
                  ? "وضع التدريب والمحاكاة مفعل: اعتراض الأدوات الخارجية وتنفيذ سيناريوهات وهمية"
                  : "الوضع المباشر (LIVE): تنفيذ الأوامر واستدعاء الأدوات الحقيقية"
              }
            >
              <span className={`sandbox-led ${sandboxMode ? "amber" : "green"}`} />
              <span>{sandboxMode ? "تدريب" : "مباشر"}</span>
            </button>

            {/* War Room / Emergency Meeting */}
            <button
              type="button"
              className="hud-action-btn war-room-hud-btn pixel-btn"
              onClick={() => {
                playClickSound();
                setWarRoomOpen(true);
              }}
              title="غرفة الاجتماعات والعصف الذهني بين الوكلاء"
            >
              <span>⚔️ الاجتماع</span>
            </button>

            {/* Public Receptionist Webhook Desk */}
            <button
              type="button"
              className="hud-action-btn reception-hud-btn pixel-btn"
              onClick={() => {
                playClickSound();
                setReceptionOpen(true);
              }}
              title="مكتب الاستقبال وبوابة الويب هوك الخارجية"
            >
              <span>🛎️ الاستقبال</span>
            </button>

            {/* Blueprint Export / Import */}
            <button
              type="button"
              className="hud-action-btn blueprint-hud-btn pixel-btn"
              onClick={handleExportOfficeBlueprint}
              title="تصدير المخطط الكامل للمكتب كملف JSON"
            >
              <span>📦 تصدير</span>
            </button>
            <label
              className="hud-action-btn blueprint-hud-btn pixel-btn"
              title="استيراد مخطط مكتب JSON"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", margin: 0 }}
            >
              <span>📥 استيراد</span>
              <input
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleImportOfficeBlueprint}
              />
            </label>

            <button
              type="button"
              className="hud-action-btn vault-hud-btn pixel-btn"
              onClick={() => {
                playClickSound();
                setVaultOpen(true);
              }}
              title="خزنة المخرجات الذكية (حفظ وتحميل التقارير والسيناريوهات)"
            >
              <VaultIcon width={14} height={14} />
              <span>الخزنة</span>
              {hydrated && deliverables.length > 0 ? (
                <span className="hud-badge-count">{deliverables.length}</span>
              ) : null}
            </button>

            {/* Phase 2: Circuit Wires & Data Pulses Overlay Toggle */}
            <button
              type="button"
              className={`hud-action-btn circuit-hud-btn pixel-btn ${showCircuitWires ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setShowCircuitWires((prev) => !prev);
              }}
              title="خريطة التوصيل المرئي وأسلاك البيانات بين الغرف (16-bit Circuit Lines)"
            >
              <span>🔌 {showCircuitWires ? "الربط ⚡" : "الربط"}</span>
            </button>

            {/* Phase 2: Accounting Ledger & Financial Telemetry */}
            <button
              type="button"
              className="hud-action-btn ledger-hud-btn pixel-btn"
              onClick={() => {
                playClickSound();
                setLedgerOpen(true);
              }}
              title="سجل التكلفة والتوكنات المالي لكل مهمة ووكيل"
            >
              <span>💰 المالية</span>
              {hydrated && ledgerEntries.length > 0 ? (
                <span className="hud-badge-count">
                  ${ledgerEntries.reduce((s, e) => s + (e.costUsd || 0), 0).toFixed(3)}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              className={`hud-action-btn sound-hud-btn pixel-btn ${hydrated && soundActive ? "active" : ""}`}
              onClick={toggleSound}
              title={soundActive ? "كتم المؤثرات الصوتية 8-Bit" : "تفعيل المؤثرات الصوتية 8-Bit"}
            >
              <SpeakerIcon width={14} height={14} />
              <span>{hydrated ? (soundActive ? "صوت" : "كتم") : "صوت"}</span>
            </button>

            <button
              type="button"
              className={`agent-chat-trigger-btn pixel-btn ${chatOpen ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setChatOpen((prev) => !prev);
              }}
              aria-label={chatOpen ? "إغلاق محادثة الوكلاء" : "فتح محادثة الوكلاء"}
              aria-expanded={chatOpen}
              title="محادثة الوكلاء (شات)"
            >
              <ChatPixelIcon width={16} height={16} />
              <span>شات الوكلاء</span>
              <span className="chat-badge-dot" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      {/* Floating / Expandable Agent Chat Dialogue */}
      <AgentChatModal
        agents={agents}
        rooms={rooms}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onSendMessage={runCommand}
        sending={sending}
        onAgentFeedback={handleAgentFeedback}
      />

      {notice ? (
        <div className="app-notice" role="alert">
          <span className="app-notice-led" />
          <span className="app-notice-text">{notice}</span>
          {noticeOpenTabUrl ? (
            <a
              href={noticeOpenTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="app-notice-link"
            >
              فتح في تبويب مستقل ↗
            </a>
          ) : null}
          <button
            type="button"
            className="app-notice-close"
            onClick={dismissNotice}
            aria-label="إغلاق التنبيه"
          >
            ×
          </button>
        </div>
      ) : null}

      {selectedAgent && selectedRoom ? (
        <AgentModal
          agent={selectedAgent}
          room={selectedRoom}
          roomAgents={roomAgents}
          googleConnected={!needsAuth}
          globalRules={globalRules}
          globalSkills={globalSkills}
          onSelectAgent={setSelectedAgentId}
          onClose={closeModal}
          onRunAction={runQuickAction}
          onSaveRules={handleSaveAgentRules}
          onToggleSkill={handleToggleAgentSkill}
          onAddCustomSkill={handleAddCustomSkill}
          onRemoveCustomSkill={handleRemoveCustomSkill}
          onSaveTools={handleSaveAgentTools}
          onSaveRulesConfig={handleSaveAgentRulesConfig}
          onSaveSchedule={handleSaveAgentSchedule}
          onSaveMemory={handleSaveAgentMemory}
          onTogglePeerReview={handleTogglePeerReview}
          onOpenRoomSettings={(roomId) => {
            playClickSound();
            setRoomSettingsRoomId(roomId);
          }}
        />
      ) : null}

      <DeliverablesVaultModal
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        deliverables={deliverables}
        onUpdateDeliverables={(updated) => setDeliverables(updated)}
        agents={agents}
      />

      <ApprovalGateModal
        request={pendingApproval}
        agent={pendingApproval ? getAgentById(pendingApproval.agentId, agents) : undefined}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />

      {/* Room Settings Modal */}
      <RoomSettingsModal
        room={roomSettingsRoomId ? getRoomById(roomSettingsRoomId, rooms) ?? null : null}
        roomAgents={roomSettingsRoomId ? agents.filter((a) => a.roomId === roomSettingsRoomId) : []}
        isOpen={Boolean(roomSettingsRoomId)}
        onClose={() => setRoomSettingsRoomId(null)}
        onSaveRoom={(updatedRoom) => {
          setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
          showNotice(`تم حفظ وتحديث إعدادات قسم «${updatedRoom.nameAr}» بنجاح!`);
        }}
        onImportBlueprint={(blueprint) => {
          setRooms((prev) => prev.map((r) => (r.id === blueprint.room.id ? blueprint.room : r)));
          setAgents((prev) => {
            const bpAgentMap = new Map(blueprint.agents.map((a) => [a.id, a]));
            return prev.map((a) => bpAgentMap.get(a.id) ?? a);
          });
          showNotice(`تم استيراد قالب قسم «${blueprint.room.nameAr}» بنجاح!`);
        }}
      />

      {/* War Room / Emergency Meeting Modal */}
      <WarRoomModal
        isOpen={warRoomOpen}
        onClose={() => setWarRoomOpen(false)}
        agents={agents}
        onDeliverableCreated={() => {
          setDeliverables(loadDeliverables());
          showNotice("تم حفظ مخرجات العصف الذهني في الخزنة كخطة عمل استراتيجية!");
        }}
      />

      {/* Reception Desk Modal */}
      <ReceptionDeskModal
        isOpen={receptionOpen}
        onClose={() => setReceptionOpen(false)}
        onSimulateIncomingEvent={(sender, subject, message) => {
          showNotice(`تم استقبال طلب خارجي من [${sender}]: جارٍ توجيهه للمدير العام...`);
          void runCommand(`رسالة خارجية واردة من ${sender} بخصوص «${subject}»: ${message}`, "auto");
        }}
      />

      {/* Incident & Escalation Drawer */}
      <IncidentModal
        isOpen={incidentOpen}
        onClose={() => setIncidentOpen(false)}
        tickets={escalationTickets}
        agents={agents}
        onResolveTicket={(ticketId, actionNote) => {
          setEscalationTickets((prev) => prev.filter((t) => t.id !== ticketId));
          setAgents((prev) =>
            prev.map((a) => ({
              ...a,
              consecutiveFailures: 0,
              deskLedColor: a.deskLedColor === "red" ? "blue" : a.deskLedColor,
            })),
          );
          showNotice(`تم إغلاق البلاغ: ${actionNote}`);
        }}
        onReassignTask={(ticketId, newAgentId) => {
          const ticket = escalationTickets.find((t) => t.id === ticketId);
          if (ticket) {
            setEscalationTickets((prev) => prev.filter((t) => t.id !== ticketId));
            const newAgent = getAgentById(newAgentId, agents);
            showNotice(`تمت إعادة توجيه المهمة إلى ${newAgent?.nameAr ?? newAgentId}.`);
            void runCommand(ticket.errorDescriptionAr, newAgentId);
          }
        }}
      />

      {/* Phase 2: Financial & Token Ledger Modal */}
      <AccountingLedgerModal
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        ledgerEntries={ledgerEntries}
        agents={agents}
        rooms={rooms}
        onClearLedger={() => {
          setLedgerEntries([]);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(LEDGER_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
          showNotice("تم تصفير سجل العمليات المالية بنجاح.");
        }}
      />

      {pendingConfirm ? (
        <div
          className="agent-modal-backdrop"
          onMouseDown={handleCancelPendingAction}
          role="presentation"
        >
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workspace-confirm-title"
            aria-describedby="workspace-confirm-desc"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="workspace-confirm-title">{pendingConfirm.confirmation.titleAr}</h2>
            <p id="workspace-confirm-desc">{pendingConfirm.confirmation.descriptionAr}</p>
            <dl className="confirm-modal-details">
              {pendingConfirm.confirmation.details.map((item) => (
                <div key={item.labelAr} className="confirm-detail-row">
                  <dt>{item.labelAr}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-btn-cancel"
                onClick={handleCancelPendingAction}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="confirm-btn-primary"
                onClick={handleConfirmPendingAction}
              >
                تأكيد التنفيذ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {googleModalOpen ? (
        <div
          className="agent-modal-backdrop"
          onMouseDown={() => setGoogleModalOpen(false)}
          role="presentation"
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="google-modal-title">اتصال Google Workspace</h2>
            <p>
              الحساب المتصل: <strong>{googleUser?.email ?? googleUser?.displayName ?? "Google"}</strong>
              <br />
              الصلاحيات المفعّلة: Gmail (قراءة، مسودات، وحذف إلى المهملات) وGoogle Sheets للوكلاء ذوي المهارات المتوافقة.
            </p>
            <form onSubmit={handleSaveSheetId} className="google-sheet-form">
              <label htmlFor="google-sheet-input" className="google-sheet-label">
                رابط أو معرّف جدول Google Sheets المالي (اختياري)
              </label>
              <input
                id="google-sheet-input"
                type="text"
                className="google-sheet-input"
                dir="ltr"
                value={sheetInput}
                onChange={(event) => setSheetInput(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
              <small className="google-sheet-hint">
                اتركه فارغاً ليُنشأ جدول «المكتب الافتراضي — السجل المالي» تلقائياً عند أول طلب.
              </small>
              {sheetId ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="google-sheet-link"
                >
                  فتح الجدول الحالي في Google Sheets ↗
                </a>
              ) : null}
              <div className="confirm-modal-actions google-modal-actions">
                <button
                  type="button"
                  className="confirm-btn-danger"
                  onClick={() => void handleGoogleSignOut()}
                >
                  تسجيل الخروج
                </button>
                <div className="google-modal-save-group">
                  <button
                    type="button"
                    className="confirm-btn-cancel"
                    onClick={() => setGoogleModalOpen(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className="confirm-btn-primary">
                    حفظ المعرّف
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmResetOpen ? (
        <div
          className="agent-modal-backdrop"
          onMouseDown={() => setConfirmResetOpen(false)}
          role="presentation"
        >
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-desc"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="reset-confirm-title">إعادة ضبط المكتب</h2>
            <p id="reset-confirm-desc">
              إعادة ضبط المكتب ستحذف جميع الوكلاء والغرف المنشأة والقواعد والمهارات المحفوظة، وتُرجع المكتب إلى غرفة المدير العام فقط. هل تريد المتابعة؟
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-btn-cancel"
                onClick={() => setConfirmResetOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="confirm-btn-danger"
                onClick={performResetOffice}
              >
                تأكيد إعادة الضبط
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
