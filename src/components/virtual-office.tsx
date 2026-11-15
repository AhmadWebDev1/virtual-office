"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_STATUSES,
  ROOMS,
  STATUS_META,
  beginAgentTask,
  cloneAgents,
  completeAgentTask,
  getAgentById,
  getRoomById,
  statusCounts,
  type Agent,
  type AgentId,
  type AgentStatus,
  type QuickAction,
  type RoomId,
  type ThemeMode,
} from "@/data/agents";
import type {
  AgentCommandError,
  AgentCommandResponse,
  CommandTarget,
} from "@/lib/agent-contracts";
import AgentModal from "@/components/agent-modal";
import CommandBar, { type CommandReceipt } from "@/components/command-bar";
import OfficeStage, {
  type AgentSpeech,
  type OfficeStageHandle,
} from "@/components/office-stage";
import {
  ChartIcon,
  CrownIcon,
  MailIcon,
  MoonIcon,
  PaletteIcon,
  PixelLogo,
  SunIcon,
  WifiIcon,
} from "@/components/icons";

interface VirtualOfficeProps {
  initialAgents: Agent[];
}

const ROOM_ICONS = {
  gm: CrownIcon,
  email: MailIcon,
  finance: ChartIcon,
  creative: PaletteIcon,
} as const;

export default function VirtualOffice({ initialAgents }: VirtualOfficeProps) {
  const [agents, setAgents] = useState<Agent[]>(() => cloneAgents(initialAgents));
  const [filter, setFilter] = useState<AgentStatus | "all">("all");
  const [theme, setTheme] = useState<ThemeMode>("day");
  const [target, setTarget] = useState<CommandTarget>("auto");
  const [sending, setSending] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null);
  const [speeches, setSpeeches] = useState<Partial<Record<AgentId, AgentSpeech>>>({});
  const [receipt, setReceipt] = useState<CommandReceipt | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const stageRef = useRef<OfficeStageHandle>(null);
  const speechTimers = useRef(new Map<AgentId, ReturnType<typeof setTimeout>>());
  const completionTimers = useRef(new Map<AgentId, ReturnType<typeof setTimeout>>());
  const nextSpeechId = useRef(1);
  const nextReceiptId = useRef(1);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("office-theme");
    if (savedTheme !== "night" && savedTheme !== "day") return;
    const timer = window.setTimeout(() => setTheme(savedTheme), 0);
    return () => window.clearTimeout(timer);
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

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5200);
  }, []);

  const applyTheme = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    window.localStorage.setItem("office-theme", nextTheme);
  }, []);

  const openAgent = useCallback((agentId: AgentId) => {
    setSelectedAgentId(agentId);
  }, []);

  const openRoom = useCallback((roomId: RoomId) => {
    const room = getRoomById(roomId);
    if (room?.agentIds[0]) setSelectedAgentId(room.agentIds[0]);
  }, []);

  const closeModal = useCallback(() => setSelectedAgentId(null), []);

  const runCommand = useCallback(
    async (commandTarget: CommandTarget, command: string) => {
      if (sending) return;
      setSending(true);
      setNotice(null);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: commandTarget, command }),
        });
        const payload = (await response.json()) as AgentCommandResponse | AgentCommandError;
        if (!response.ok || !payload.ok) {
          throw new Error("error" in payload ? payload.error : "تعذّر تنفيذ الأمر.");
        }

        const commandResult = payload;
        const resolvedAgent = getAgentById(commandResult.agentId);
        const resolvedName = resolvedAgent?.nameAr ?? "الوكيل";

        const existingTimer = completionTimers.current.get(commandResult.agentId);
        if (existingTimer) clearTimeout(existingTimer);

        setAgents((current) =>
          beginAgentTask(current, commandResult.agentId, {
            titleAr: commandResult.task.titleAr,
            durationMs: commandResult.task.durationMs,
          }),
        );

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
          setAgents((current) =>
            completeAgentTask(current, commandResult.agentId, commandResult.task.titleAr),
          );
          showSpeech(commandResult.agentId, commandResult.messages.completionAr, 7000);
          setReceipt((current) =>
            current && current.id === pendingReceipt.id
              ? {
                  ...current,
                  text: commandResult.messages.completionAr,
                  status: "done",
                }
              : current,
          );
          completionTimers.current.delete(commandResult.agentId);
        }, commandResult.task.durationMs);
        completionTimers.current.set(commandResult.agentId, timer);

        // Make the assigned agent easy to find in a busy room.
        setFilter("all");
      } catch (error) {
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
    [sending, showNotice, showSpeech],
  );

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
  const selectedRoom = selectedAgent ? getRoomById(selectedAgent.roomId) : null;
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
              <span className="brand-eyebrow">VIRTUAL HQ / ELITE AGENTS</span>
              <h1>المكتب الافتراضي</h1>
              <p>غرفة عمليات فريقك الذكي — كل وكيل في مكانه.</p>
            </div>
          </div>

          <div className="topbar-status">
            <span className="live-pill">
              <span className="live-dot" />
              مباشر
            </span>
            <span className="topbar-status-copy">
              <strong>{activeCount}</strong> وكلاء يعملون الآن
            </span>
            <span className="topbar-divider" aria-hidden="true" />
            <span className="topbar-sync">
              <WifiIcon width={13} height={13} />
              متزامن مع محرك الفريق
            </span>
          </div>

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
              {ROOMS.map((room) => {
                const RoomIcon = ROOM_ICONS[room.id];
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
          {notice}
        </div>
      ) : null}

      {selectedAgent && selectedRoom ? (
        <AgentModal
          agent={selectedAgent}
          room={selectedRoom}
          roomAgents={roomAgents}
          onSelectAgent={setSelectedAgentId}
          onClose={closeModal}
          onRunAction={runQuickAction}
        />
      ) : null}
    </div>
  );
}
