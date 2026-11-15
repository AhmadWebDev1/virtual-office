"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_STATUSES,
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
  type Agent,
  type AgentId,
  type AgentStatus,
  type AgentTaskCompletion,
  type FurnitureStyle,
  type QuickAction,
  type Room,
  type RoomId,
  type ThemeMode,
} from "@/data/agents";
import type { CustomSkillDefinition } from "@/data/skills";
import type {
  AgentCommandError,
  AgentCommandRequest,
  AgentCommandResponse,
  AgentPromptProfile,
  CommandTarget,
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
import { clearOfficeState, loadOfficeState, saveOfficeState } from "@/lib/office-storage";
import AgentModal from "@/components/agent-modal";
import CommandBar, { type CommandReceipt } from "@/components/command-bar";
import OfficeStage, {
  type AgentSpeech,
  type OfficeStageHandle,
} from "@/components/office-stage";
import {
  ChartIcon,
  CodeIcon,
  CrownIcon,
  MailIcon,
  MoonIcon,
  PaletteIcon,
  PixelLogo,
  ResetIcon,
  SunIcon,
  WifiIcon,
} from "@/components/icons";

interface VirtualOfficeProps {
  initialAgents: Agent[];
  initialRooms?: Room[];
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

const STYLE_ICONS: Record<FurnitureStyle, typeof CrownIcon> = {
  admin: CrownIcon,
  tech: CodeIcon,
  finance: ChartIcon,
  creative: PaletteIcon,
};

function toAgentPromptProfile(agent: Agent): AgentPromptProfile {
  return {
    id: agent.id,
    nameAr: agent.nameAr,
    roleAr: agent.roleAr,
    roleEn: agent.roleEn,
    rules: agent.rules,
    skills: agent.skills,
    customSkills: agent.customSkills ?? [],
  };
}

export default function VirtualOffice({
  initialAgents,
  initialRooms = INITIAL_ROOMS,
}: VirtualOfficeProps) {
  const [agents, setAgents] = useState<Agent[]>(() => cloneAgents(initialAgents));
  const [rooms, setRooms] = useState<Room[]>(() => cloneRooms(initialRooms));
  const [filter, setFilter] = useState<AgentStatus | "all">("all");
  const [theme, setTheme] = useState<ThemeMode>("day");
  const [target, setTarget] = useState<CommandTarget>("auto");
  const [sending, setSending] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [speeches, setSpeeches] = useState<Partial<Record<AgentId, AgentSpeech>>>({});
  const [receipt, setReceipt] = useState<CommandReceipt | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOpenTabUrl, setNoticeOpenTabUrl] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Google Workspace OAuth state (token stays strictly in memory via google-workspace-auth.ts)
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<GoogleWorkspaceUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [sheetInput, setSheetInput] = useState("");
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
    const savedTheme = window.localStorage.getItem("office-theme");
    if (savedTheme === "night" || savedTheme === "day") {
      const themeTimer = window.setTimeout(() => setTheme(savedTheme), 0);
      return () => window.clearTimeout(themeTimer);
    }
  }, []);

  useEffect(() => {
    const savedSheetId = window.localStorage.getItem(SHEET_ID_STORAGE_KEY);
    if (savedSheetId) {
      const sheetTimer = window.setTimeout(() => {
        setSheetId(savedSheetId);
        setSheetInput(savedSheetId);
      }, 0);
      return () => window.clearTimeout(sheetTimer);
    }
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

  const announceCompletion = useCallback(
    (agentId: AgentId, task: CompletionAnnouncement, receiptId?: number) => {
      setAgents((current) => completeAgentTask(current, agentId, task));
      showSpeech(agentId, task.completionAr, 7000);
      if (receiptId === undefined) return;
      setReceipt((current) =>
        current && current.id === receiptId
          ? { ...current, text: task.completionAr, status: "done" }
          : current,
      );
    },
    [showSpeech],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadOfficeState(initialAgents, initialRooms);
      if (restored) {
        setAgents(restored.agents);
        setRooms(restored.rooms);
        const now = Date.now();
        for (const agent of restored.agents) {
          const task = agent.activeTask;
          if (agent.status !== "working" || !task?.startedAt || !task.durationMs) continue;
          if (task.startedAt + task.durationMs > now && task.startAr) {
            showSpeech(agent.id, task.startAr, 5000);
          }
        }
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialAgents, initialRooms, showSpeech]);

  useEffect(() => {
    if (!hydrated) return;
    saveOfficeState(agents, rooms);
  }, [agents, rooms, hydrated]);

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

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    window.localStorage.setItem("office-theme", nextTheme);
  }, []);

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
        window.localStorage.setItem(SHEET_ID_STORAGE_KEY, parsed);
        showNotice("تم حفظ معرّف جدول Google Sheets بنجاح.");
      } else {
        window.localStorage.removeItem(SHEET_ID_STORAGE_KEY);
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

    setAgents(cloneAgents(initialAgents));
    setRooms(cloneRooms(initialRooms));
    setSpeeches({});
    setReceipt(undefined);
    setSelectedAgentId(null);
    setConfirmResetOpen(false);
    setPendingConfirm(null);
    setFilter("all");
    setTarget("auto");
    showNotice("تمت إعادة ضبط المكتب إلى غرفة المدير العام فقط.");
  }, [initialAgents, initialRooms, showNotice]);

  useEffect(() => {
    if (!confirmResetOpen && !googleModalOpen && !pendingConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmResetOpen(false);
        setGoogleModalOpen(false);
        setPendingConfirm(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmResetOpen, googleModalOpen, pendingConfirm]);

  const runCommand = useCallback(
    async (
      commandTarget: CommandTarget,
      command: string,
      confirmAction?: AgentCommandRequest["confirmAction"],
    ) => {
      if (sending) return;
      const epoch = resetEpoch.current;
      setSending(true);
      setNotice(null);
      try {
        const accessToken = getGoogleAccessToken();
        const requestBody: AgentCommandRequest = {
          target: commandTarget,
          command,
          agents: agents.map(toAgentPromptProfile),
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
        if (resetEpoch.current !== epoch) return;
        if (!response.ok || !payload.ok) {
          throw new Error("error" in payload ? payload.error : "تعذّر تنفيذ الأمر.");
        }

        const commandResult = payload;

        if (commandResult.createdSheetId) {
          setSheetId(commandResult.createdSheetId);
          setSheetInput(commandResult.createdSheetId);
          window.localStorage.setItem(SHEET_ID_STORAGE_KEY, commandResult.createdSheetId);
          showNotice("تم إنشاء جدول «المكتب الافتراضي — السجل المالي» في Google Sheets وربطه تلقائياً.");
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
          return;
        }

        let currentAgentsSnapshot = agents;
        let currentRoomsSnapshot = rooms;

        if (commandResult.createdAgent) {
          const { agent: newAgent, room: newRoom } = createAgentAndRoomFromSpec(
            commandResult.createdAgent,
            agents,
            rooms,
          );
          currentAgentsSnapshot = [...agents, newAgent];
          currentRoomsSnapshot = [...rooms, newRoom];
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
          showSpeech(newAgent.id, `مرحباً! أنا ${newAgent.nameAr} (${newAgent.roleAr}).`, 5500);
          showNotice(`تم إنشاء «${newRoom.nameAr}» وتعيين ${newAgent.nameAr}!`);
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
      } catch (error) {
        if (resetEpoch.current !== epoch) return;
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
        if (commandTarget !== "auto") {
          showSpeech(commandTarget, "تعذّر الاتصال. سأحاول مرة أخرى عند وصول الأمر.", 5000);
        }
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

  const selectedAgent = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId) ?? null
    : null;
  const selectedRoom = selectedAgent ? getRoomById(selectedAgent.roomId, rooms) : null;
  const roomAgents = useMemo(
    () => (selectedRoom ? agents.filter((agent) => agent.roomId === selectedRoom.id) : []),
    [agents, selectedRoom],
  );

  const counts = statusCounts(agents);
  const activeCount = counts.working;

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

  const shortGoogleName =
    googleUser?.displayName?.split(" ")[0] ||
    googleUser?.email?.split("@")[0] ||
    "Google متصل";

  return (
    <div className="app-root" data-theme={theme}>
      <div className="app-texture" aria-hidden="true" />
      <main className="app-main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <PixelLogo width={38} height={38} />
            </span>
            <div className="brand-copy">
              <span className="brand-eyebrow">VIRTUAL HQ / DYNAMIC AGENT BUILDER</span>
              <h1>المكتب الافتراضي</h1>
              <p>ابدأ مع المدير العام وابنِ فريق وكلائك وغرفهم بالمهارات والقواعد الخاصة بك.</p>
            </div>
          </div>

          <div className="topbar-status">
            <span className="live-pill">
              <span className="live-dot" />
              مباشر
            </span>
            <span className="topbar-status-copy">
              <strong>{activeCount}</strong> يعمل · <strong>{agents.length}</strong> بالمقر
            </span>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="topbar-sync">
              <WifiIcon width={13} height={13} />
              متزامن مع محرك البناء
            </span>
          </div>

          <div className="topbar-actions">
            {needsAuth ? (
              <button
                type="button"
                className="gsi-material-button"
                dir="ltr"
                onClick={() => void handleGoogleSignIn()}
                disabled={authLoading}
                aria-label="تسجيل الدخول بحساب Google لربط Gmail و Google Sheets"
                title="ربط Gmail و Google Sheets بنقرة واحدة"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon" aria-hidden="true">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      width="16"
                      height="16"
                      style={{ display: "block" }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {authLoading ? "Connecting…" : "Sign in with Google"}
                  </span>
                  <span style={{ display: "none" }}>Sign in with Google</span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                className="google-connected-btn"
                onClick={() => {
                  setSheetInput(sheetId);
                  setGoogleModalOpen(true);
                }}
                aria-label="إدارة اتصال حساب Google وجدول Google Sheets"
                title={googleUser?.email ?? "إدارة اتصال Google"}
              >
                <span className="google-connected-dot" aria-hidden="true" />
                <span className="google-connected-label">{shortGoogleName}</span>
                <span className="google-connected-tag">
                  {sheetId ? "Sheet مربوط" : "Gmail + Sheets"}
                </span>
              </button>
            )}

            <button
              type="button"
              className="office-reset"
              onClick={() => setConfirmResetOpen(true)}
              aria-label="إعادة ضبط المكتب"
              title="حذف الغرف والوكلاء المضافين وإرجاع المكتب إلى غرفة المدير العام فقط"
            >
              <ResetIcon width={14} height={14} />
              <span>إعادة ضبط المكتب</span>
            </button>
            <button
              type="button"
              className="theme-switch"
              onClick={() => applyTheme(theme === "day" ? "night" : "day")}
              aria-label={theme === "day" ? "التبديل إلى وضع الليل" : "التبديل إلى وضع النهار"}
              title={theme === "day" ? "تشغيل الإضاءة الليلية" : "تشغيل إضاءة النهار"}
            >
              <span className="theme-switch-sky" data-mode={theme} aria-hidden="true">
                {theme === "day" ? (
                  <>
                    <SunIcon width={16} height={16} />
                    <span className="theme-cloud theme-cloud-one" />
                    <span className="theme-cloud theme-cloud-two" />
                  </>
                ) : (
                  <>
                    <MoonIcon width={16} height={16} />
                    <span className="theme-star theme-star-one">+</span>
                    <span className="theme-star theme-star-two">+</span>
                  </>
                )}
              </span>
              <span className="theme-switch-copy">
                <small>الإضاءة</small>
                <strong>{theme === "day" ? "وضع الليل" : "وضع النهار"}</strong>
              </span>
              <span
                className="theme-switch-track"
                data-mode={theme}
                aria-hidden="true"
                role="presentation"
              >
                <span className="theme-switch-thumb" />
              </span>
            </button>
          </div>
        </header>

        <section className="dashboard-toolbar" aria-label="تصفية الوكلاء والتنقل بين الغرف">
          <div className="filter-cluster">
            <span className="toolbar-label">حالة الوكلاء</span>
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
                  <span>{item.label}</span>
                  <span className="filter-count">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="room-nav-cluster">
            <span className="toolbar-label">انتقال سريع</span>
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
        </section>

        <section className="stage-wrap" aria-label="خريطة المكتب">
          <OfficeStage
            ref={stageRef}
            agents={agents}
            rooms={rooms}
            filter={filter}
            theme={theme}
            speeches={speeches}
            onOpenAgent={openAgent}
            onOpenRoom={openRoom}
          />
          <div className="stage-edit-legend" aria-hidden="true">
            <span className="legend-item">
              <span className="legend-dot legend-working" />
              يعمل
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-idle" />
              متاح
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-error" />
              يحتاج انتباه
            </span>
          </div>
        </section>
      </main>

      <CommandBar
        agents={agents}
        target={target}
        onTargetChange={setTarget}
        onSubmit={(nextTarget, command) => void runCommand(nextTarget, command)}
        sending={sending}
        receipt={receipt}
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
          onSelectAgent={setSelectedAgentId}
          onClose={closeModal}
          onRunAction={runQuickAction}
          onSaveRules={handleSaveAgentRules}
          onToggleSkill={handleToggleAgentSkill}
          onAddCustomSkill={handleAddCustomSkill}
          onRemoveCustomSkill={handleRemoveCustomSkill}
        />
      ) : null}

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
