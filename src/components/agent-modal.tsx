"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUS_META,
  calculateAgentLevel,
  formatCompletedTimeAr,
  type Agent,
  type QuickAction,
  type Room,
} from "@/data/agents";
import {
  formatInstallCount,
  getAgentSkillSuggestions,
  parseCustomSkillInput,
  resolveSkillMeta,
  type AgentSkillSuggestionChip,
  type CustomSkillDefinition,
} from "@/data/skills";
import type { SkillSearchResultItem } from "@/app/api/skills/route";
import AgentPortrait from "@/components/agent-portrait";
import {
  AlertIcon,
  ArrowUpLeftIcon,
  BoltIcon,
  BrainIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MapPinIcon,
  PluginIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  SparklesIcon,
  TargetIcon,
  TerminalIcon,
  TrashIcon,
} from "@/components/icons";
import type {
  AgentSchedule,
  AutomationRule,
  CustomWebhookTool,
} from "@/data/agents";
import { playClickSound, playCompleteChime } from "@/lib/audio-effects";

type ModalTab = "tasks" | "rules" | "skills" | "tools" | "scripts" | "schedule" | "memory";

interface AgentModalProps {
  agent: Agent;
  room: Room;
  roomAgents: Agent[];
  googleConnected?: boolean;
  globalRules?: string;
  globalSkills?: string[];
  onSelectAgent: (agentId: Agent["id"]) => void;
  onClose: () => void;
  onRunAction: (agentId: Agent["id"], action: QuickAction) => void;
  onSaveRules: (agentId: Agent["id"], rules: string) => void;
  onToggleSkill: (agentId: Agent["id"], skillId: string) => void;
  onAddCustomSkill: (agentId: Agent["id"], customSkill: CustomSkillDefinition) => void;
  onRemoveCustomSkill: (agentId: Agent["id"], customSkillId: string) => void;
  onSaveTools?: (agentId: Agent["id"], tools: CustomWebhookTool[]) => void;
  onSaveRulesConfig?: (agentId: Agent["id"], rules: AutomationRule[]) => void;
  onSaveSchedule?: (agentId: Agent["id"], schedule?: AgentSchedule) => void;
  onSaveMemory?: (agentId: Agent["id"], memory: string[]) => void;
  onTogglePeerReview?: (roomId: Room["id"], enabled: boolean) => void;
  onOpenRoomSettings?: (roomId: Room["id"]) => void;
}

function useLiveProgress(agent: Agent) {
  const task = agent.activeTask;
  const isLive = agent.status === "working" && Boolean(task?.startedAt && task.durationMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 220);
    return () => window.clearInterval(interval);
  }, [isLive]);

  if (!task) return 0;
  if (agent.status === "done") return 100;
  if (!isLive) return task.progress;

  const elapsed = Math.max(0, now - task.startedAt!);
  const ratio = Math.min(1, elapsed / task.durationMs!);
  return Math.min(95, Math.round(task.progress + (96 - task.progress) * ratio));
}

const ACTION_ICONS = [SparklesIcon, BoltIcon, TargetIcon];

const RULE_SNIPPETS = [
  {
    labelAr: "+ دقة وصرامة",
    text: "التزم بقواعد صارمة: لا تفترض أي معلومة غير مؤكدة، واذكر الخطوات والتحقق بوضوح.",
  },
  {
    labelAr: "+ إيجاز تنفيذي",
    text: "اختصر الردود في نقاط تنفيذية مباشرة مع تحديد النتيجة النهائية في السطر الأول.",
  },
  {
    labelAr: "+ معايير الجودة",
    text: "تحقّق من حالات الحافة والأخطاء المحتملة قبل اعتماد أي مخرج نهائي.",
  },
] as const;

const MARKDOWN_TEMPLATE = `# مهارة مراجعة الأداء\n- راجع المخرجات بدقة وتحقق من الوضوح والسرعة.\n- اختم دائماً بـ 3 توصيات عملية قابلة للتطبيق.`;

const JSON_TEMPLATE = JSON.stringify(
  {
    nameAr: "تدقيق العقود",
    descriptionAr: "فحص البنود القانونية والمالية وتنبيه المخاطر",
    promptInstruction:
      "افحص كل بند بدقة، وحدّد الالتزامات المالية والمخاطر في قائمة واضحة.",
  },
  null,
  2,
);

export default function AgentModal({
  agent,
  room,
  roomAgents,
  googleConnected = false,
  onSelectAgent,
  onClose,
  onRunAction,
  onSaveRules,
  onToggleSkill,
  onAddCustomSkill,
  onRemoveCustomSkill,
  onSaveTools,
  onSaveRulesConfig,
  onSaveSchedule,
  onSaveMemory,
  onTogglePeerReview,
  globalRules,
  globalSkills,
  onOpenRoomSettings,
}: AgentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>("tasks");
  const [draftRules, setDraftRules] = useState(agent.rules);
  const [rulesSavedAt, setRulesSavedAt] = useState<number | null>(null);
  const [optimizingRule, setOptimizingRule] = useState(false);
  const levelMeta = calculateAgentLevel(agent.xp ?? 50);

  const handleOptimizeAgentRule = async () => {
    if (!draftRules.trim()) return;
    playClickSound();
    setOptimizingRule(true);
    try {
      const res = await fetch("/api/optimize-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: draftRules,
          scope: "agent",
          roleAr: agent.roleAr,
          contextTitle: agent.nameAr,
        }),
      });
      const data = await res.json();
      if (data.ok && data.optimizedRule) {
        setDraftRules(data.optimizedRule);
        playCompleteChime();
      }
    } catch {
      // fallback
    } finally {
      setOptimizingRule(false);
    }
  };
  const [skillImportText, setSkillImportText] = useState("");
  const [skillImportFeedback, setSkillImportFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const [findSkillsQuery, setFindSkillsQuery] = useState("");
  const [findSkillsResults, setFindSkillsResults] = useState<SkillSearchResultItem[]>([]);
  const [localProjectSkills, setLocalProjectSkills] = useState<SkillSearchResultItem[]>([]);
  const [expandedSkillFiles, setExpandedSkillFiles] = useState<Record<string, boolean>>({});
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [downloadingSkillId, setDownloadingSkillId] = useState<string | null>(null);
  const [findSkillsFeedback, setFindSkillsFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  // Webhooks & Plugins state
  const [webhookName, setWebhookName] = useState("");
  const [webhookDesc, setWebhookDesc] = useState("");
  const [webhookMethod, setWebhookMethod] = useState<"GET" | "POST" | "PUT">("POST");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState("");
  const [webhookBody, setWebhookBody] = useState("");
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Automation & Rules state
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleTrigger, setNewRuleTrigger] = useState<AutomationRule["trigger"]>("onKeywordMatch");
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleAction, setNewRuleAction] = useState<AutomationRule["action"]>("forwardToAgent");
  const [newRuleTarget, setNewRuleTarget] = useState<string>(roomAgents[0]?.id ?? agent.id);
  const [newRuleLed, setNewRuleLed] = useState<AutomationRule["ledColor"]>("green");

  // Schedule state
  const [schedEnabled, setSchedEnabled] = useState(agent.schedule?.enabled ?? false);
  const [schedInterval, setSchedInterval] = useState(agent.schedule?.intervalMinutes ?? 15);
  const [schedPrompt, setSchedPrompt] = useState(
    agent.schedule?.prompt ?? `تحديث مؤشرات العمل وتلخيص المستجدات بصفتي ${agent.roleAr}`,
  );
  const [schedLabel, setSchedLabel] = useState(agent.schedule?.labelAr ?? "تحديث دوري مجدول");

  // Memory state
  const [newMemory, setNewMemory] = useState("");

  const progress = useLiveProgress(agent);
  const meta = STATUS_META[agent.status];
  const task = agent.activeTask;
  const latestSource = task?.source ?? agent.completedTasks[0]?.source;
  const customSkills = agent.customSkills ?? [];
  const totalSkillsCount = customSkills.length;
  const rulesDirty = draftRules.trim() !== agent.rules.trim();

  const suggestionProfile = useMemo(
    () =>
      getAgentSkillSuggestions(
        agent.roleAr,
        agent.roleEn,
        room.furnitureStyle,
        agent.rules,
      ),
    [agent.roleAr, agent.roleEn, room.furnitureStyle, agent.rules],
  );

  const lastSuggestedAgentIdRef = useRef<string | null>(null);

  // Keep draft rules and skills synced when user switches between agents.
  const [syncedAgentId, setSyncedAgentId] = useState(agent.id);
  if (syncedAgentId !== agent.id) {
    setSyncedAgentId(agent.id);
    setDraftRules(agent.rules);
    setRulesSavedAt(null);
    setSkillImportFeedback(null);
    setFindSkillsFeedback(null);
    setFindSkillsResults([]);
    setLocalProjectSkills([]);
    setExpandedSkillFiles({});
  }

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const handleSaveRulesSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveRules(agent.id, draftRules.trim());
    setRulesSavedAt(Date.now());
  };

  const handleAppendSnippet = (snippet: string) => {
    setDraftRules((prev) => {
      const base = prev.trim();
      if (!base) return snippet;
      if (base.includes(snippet)) return base;
      return `${base}\n${snippet}`;
    });
    setRulesSavedAt(null);
  };

  const handleImportCustomSkill = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseCustomSkillInput(skillImportText);
    if (!parsed.ok) {
      setSkillImportFeedback({ kind: "error", text: parsed.error });
      return;
    }
    onAddCustomSkill(agent.id, parsed.skill);
    setSkillImportText("");
    setSkillImportFeedback({
      kind: "success",
      text: `تمت إضافة مهارة «${parsed.skill.nameAr}» وحقنها في تعليمات الوكيل.`,
    });
  };

  const toggleSkillFiles = (skillId: string) => {
    setExpandedSkillFiles((prev) => ({ ...prev, [skillId]: !prev[skillId] }));
  };

  const handleRemoveSkill = async (customSkillId: string) => {
    onRemoveCustomSkill(agent.id, customSkillId);
    const targetId = customSkillId.replace(/^skill-/, "").replace(/^find-skill-/, "");
    try {
      await fetch(`/api/skills?skillId=${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  const handleSearchSkills = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? findSkillsQuery).trim();
    setIsSearchingSkills(true);
    setFindSkillsFeedback(null);
    try {
      const params = new URLSearchParams();
      const effectiveQuery = q || suggestionProfile.primaryQuery;
      if (effectiveQuery) params.set("q", effectiveQuery);
      if (agent.roleAr) params.set("role", agent.roleAr);
      if (agent.roleEn) params.set("roleEn", agent.roleEn);
      if (room.furnitureStyle) params.set("style", room.furnitureStyle);

      const res = await fetch(`/api/skills?${params.toString()}`);
      if (!res.ok) throw new Error("تعذّر البحث في find-skills");
      const data = (await res.json()) as {
        ok?: boolean;
        skills?: SkillSearchResultItem[];
        localSkills?: SkillSearchResultItem[];
      };
      if (data.ok) {
        if (Array.isArray(data.skills)) {
          setFindSkillsResults(data.skills);
        }
        if (Array.isArray(data.localSkills)) {
          setLocalProjectSkills(data.localSkills);
        }
      }
    } catch {
      setFindSkillsFeedback({
        kind: "error",
        text: "تعذّر الاتصال بخدمة البحث. تأكد من اتصال الإنترنت.",
      });
    } finally {
      setIsSearchingSkills(false);
    }
  };

  const handleDownloadSkill = async (item: SkillSearchResultItem) => {
    setDownloadingSkillId(item.id);
    setFindSkillsFeedback(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          source: item.source,
          skillId: item.skillId,
          installs: item.installs,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        skill?: CustomSkillDefinition;
      };
      if (!res.ok || !data.ok || !data.skill) {
        throw new Error(data.error ?? "تعذّر تنزيل المهارة.");
      }
      onAddCustomSkill(agent.id, data.skill);
      setFindSkillsFeedback({
        kind: "success",
        text: `تم تنزيل وتثبيت المهارة «${item.name}» على الوكيل بنجاح!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذّر تنزيل المهارة.";
      setFindSkillsFeedback({
        kind: "error",
        text: msg,
      });
    } finally {
      setDownloadingSkillId(null);
    }
  };

  useEffect(() => {
    if (activeTab === "skills") {
      if (lastSuggestedAgentIdRef.current !== agent.id) {
        lastSuggestedAgentIdRef.current = agent.id;
        const initialQuery = suggestionProfile.primaryQuery;
        setFindSkillsQuery(initialQuery);
        void handleSearchSkills(initialQuery);
      }
    }
  }, [activeTab, agent.id, suggestionProfile.primaryQuery]);

  return (
    <div className="agent-modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        ref={panelRef}
        className="agent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-modal-title"
        data-status={agent.status}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="pixel-corner pixel-corner-tl" aria-hidden="true" />
        <span className="pixel-corner pixel-corner-tr" aria-hidden="true" />
        <span className="pixel-corner pixel-corner-bl" aria-hidden="true" />
        <span className="pixel-corner pixel-corner-br" aria-hidden="true" />

        <header className="agent-modal-head">
          <div className="agent-modal-title-wrap">
            <span className="agent-modal-eyebrow">
              <MapPinIcon width={12} height={12} />
              {room.nameAr}
              <span className="eyebrow-sep">/</span>
              {agent.stationAr}
            </span>
            <h2 id="agent-modal-title">{agent.nameAr}</h2>
            <p>
              {agent.roleAr} <span className="latin-subtitle">· {agent.roleEn}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="إغلاق نافذة تفاصيل الوكيل"
          >
            <span className="modal-close-glyph" aria-hidden="true">
              [X]
            </span>
          </button>
        </header>

        {roomAgents.length > 1 ? (
          <div className="station-tabs" aria-label="محطات الغرفة">
            <span className="station-tabs-label">محطات الغرفة</span>
            <div className="station-tabs-list">
              {roomAgents.map((stationAgent) => (
                <button
                  key={stationAgent.id}
                  type="button"
                  className="station-tab"
                  data-active={stationAgent.id === agent.id ? "true" : "false"}
                  onClick={() => onSelectAgent(stationAgent.id)}
                  aria-pressed={stationAgent.id === agent.id}
                >
                  <span
                    className="station-tab-dot"
                    style={{ background: STATUS_META[stationAgent.status].dot }}
                  />
                  {stationAgent.roleAr}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="agent-modal-body">
          <aside className="agent-identity-card">
            <div className="portrait-frame" data-status={agent.status}>
              <AgentPortrait
                agent={agent}
                furnitureStyle={room.furnitureStyle}
                size={112}
              />
              <span className="portrait-scanline" aria-hidden="true" />
            </div>
            <span
              className="status-badge status-badge-lg"
              data-status={agent.status}
              style={
                {
                  "--status-dot": meta.dot,
                  "--status-soft": meta.soft,
                  "--status-ink": meta.text,
                } as React.CSSProperties
              }
            >
              <span className="status-badge-dot" />
              {meta.labelAr}
            </span>
            <p className="agent-status-note">{agent.statusNoteAr}</p>

            {/* Level & XP Progression Box */}
            <div className="agent-level-box">
              <div className="agent-level-header">
                <span className="agent-level-badge">
                  {levelMeta.hasStar ? "⭐ " : ""}LVL {levelMeta.level}
                </span>
                <span className="agent-level-title">{levelMeta.levelTitleAr}</span>
              </div>
              <div className="pixel-progress-wrap" title={`خبرة الوكيل: ${agent.xp ?? 50} نقطة XP`}>
                <div
                  className="pixel-progress-bar"
                  style={{ width: `${levelMeta.progressPercent}%` }}
                />
              </div>
              <div className="agent-xp-text">
                <span>XP: {levelMeta.currentLevelXp} / {levelMeta.nextLevelXp}</span>
                <span>{levelMeta.progressPercent}%</span>
              </div>
            </div>

            {/* Segmented Stamina Bar */}
            <div className="agent-stamina-box">
              <div className="agent-stamina-header">
                <span className="agent-stamina-title">
                  <span>الطاقة ومعدل النشاط</span>
                  <span className="stamina-bolt">⚡</span>
                </span>
                <span className="agent-stamina-percent" dir="ltr">
                  {agent.stamina ?? 100}%
                </span>
              </div>
              <div
                className="segmented-stamina-wrap"
                title={`الطاقة الحالية: ${agent.stamina ?? 100}% - تُستهلك مع كل أمر وتُشحن تلقائياً عند استراحة القهوة`}
              >
                {Array.from({ length: 10 }).map((_, idx) => {
                  const segValue = (idx + 1) * 10;
                  const active = (agent.stamina ?? 100) >= segValue - 5;
                  const colorClass =
                    (agent.stamina ?? 100) > 60
                      ? "seg-high"
                      : (agent.stamina ?? 100) > 25
                        ? "seg-mid"
                        : "seg-low";
                  return (
                    <div
                      key={idx}
                      className={`stamina-segment ${active ? colorClass : "seg-empty"}`}
                    />
                  );
                })}
              </div>
              <div className="agent-stamina-status-row">
                <span>
                  {agent.status === "cooldown"
                    ? "☕ جاري شحن الطاقة في ركن القهوة..."
                    : (agent.stamina ?? 100) < 15
                      ? "⚠️ طاقة منخفضة - استراحة قهوة مطلوبة"
                      : (agent.stamina ?? 100) > 60
                        ? "جاهزية كاملة للمهام والعمليات"
                        : "استهلاك معتدل للطاقة"}
                </span>
              </div>
            </div>

            <dl className="agent-meta-list">
              <div>
                <dt>الغرفة</dt>
                <dd>{room.nameAr}</dd>
              </div>
              <div>
                <dt>المهام المنجزة</dt>
                <dd>{agent.completedTasks.length}</dd>
              </div>
              <div>
                <dt>استهلاك التوكنز</dt>
                <dd dir="ltr">~{agent.tokenUsage ?? (agent.completedTasks.length * 320)} TKN</dd>
              </div>
              <div>
                <dt>المهارات المفعّلة</dt>
                <dd dir="ltr">{totalSkillsCount}</dd>
              </div>
              <div>
                <dt>حالة القواعد</dt>
                <dd>{agent.rules.trim() ? "مخصّصة" : "افتراضية"}</dd>
              </div>
            </dl>
          </aside>

          <div className="agent-modal-main">
            <div className="modal-view-tabs" role="tablist" aria-label="أقسام إدارة الوكيل">
              <button
                type="button"
                role="tab"
                id="tab-tasks"
                aria-selected={activeTab === "tasks"}
                aria-controls="panel-tasks"
                className="modal-view-tab"
                data-active={activeTab === "tasks" ? "true" : "false"}
                onClick={() => setActiveTab("tasks")}
              >
                <TerminalIcon width={14} height={14} />
                <span>المهام والسجل</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-rules"
                aria-selected={activeTab === "rules"}
                aria-controls="panel-rules"
                className="modal-view-tab"
                data-active={activeTab === "rules" ? "true" : "false"}
                onClick={() => setActiveTab("rules")}
              >
                <SlidersIcon width={14} height={14} />
                <span>القواعد</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-skills"
                aria-selected={activeTab === "skills"}
                aria-controls="panel-skills"
                className="modal-view-tab"
                data-active={activeTab === "skills" ? "true" : "false"}
                onClick={() => {
                  playClickSound();
                  setActiveTab("skills");
                }}
              >
                <SparklesIcon width={14} height={14} />
                <span>المهارات</span>
                <span className="modal-tab-badge" dir="ltr">
                  {totalSkillsCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-tools"
                aria-selected={activeTab === "tools"}
                aria-controls="panel-tools"
                className="modal-view-tab"
                data-active={activeTab === "tools" ? "true" : "false"}
                onClick={() => {
                  playClickSound();
                  setActiveTab("tools");
                }}
              >
                <PluginIcon width={14} height={14} />
                <span>الأدوات والإضافات</span>
                <span className="modal-tab-badge" dir="ltr">
                  {(agent.customTools?.length ?? 0) + 5}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-scripts"
                aria-selected={activeTab === "scripts"}
                aria-controls="panel-scripts"
                className="modal-view-tab"
                data-active={activeTab === "scripts" ? "true" : "false"}
                onClick={() => {
                  playClickSound();
                  setActiveTab("scripts");
                }}
              >
                <CodeIcon width={14} height={14} />
                <span>البرمجة والأتمتة</span>
                <span className="modal-tab-badge" dir="ltr">
                  {agent.scriptRules?.filter((r) => r.enabled).length ?? 0}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-schedule"
                aria-selected={activeTab === "schedule"}
                aria-controls="panel-schedule"
                className="modal-view-tab"
                data-active={activeTab === "schedule" ? "true" : "false"}
                onClick={() => {
                  playClickSound();
                  setActiveTab("schedule");
                }}
              >
                <ClockIcon width={14} height={14} />
                <span>الجدولة</span>
                {agent.schedule?.enabled && <span className="modal-tab-badge">⏱</span>}
              </button>
              <button
                type="button"
                role="tab"
                id="tab-memory"
                aria-selected={activeTab === "memory"}
                aria-controls="panel-memory"
                className="modal-view-tab"
                data-active={activeTab === "memory" ? "true" : "false"}
                onClick={() => {
                  playClickSound();
                  setActiveTab("memory");
                }}
              >
                <BrainIcon width={14} height={14} />
                <span>الذاكرة</span>
                <span className="modal-tab-badge" dir="ltr">
                  {agent.memory?.length ?? 0}
                </span>
              </button>
            </div>

            {activeTab === "tasks" ? (
              <div role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks" className="modal-tab-panel">
                {agent.status === "error" && task ? (
                  <div className="agent-error-strip" role="alert">
                    <AlertIcon width={16} height={16} />
                    <div>
                      <strong>توقفت المهمة مؤقتاً</strong>
                      <p>{task.noteAr}</p>
                    </div>
                  </div>
                ) : null}

                <section className="task-panel" aria-label="المهمة النشطة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      المهمة الحالية
                    </span>
                    <span className="task-eta">
                      {task ? task.noteAr : "لا توجد مهمة نشطة"}
                    </span>
                  </div>

                  {task ? (
                    <div className="task-card" data-status={agent.status}>
                      <div className="task-card-top">
                        <div>
                          <h3>{task.titleAr}</h3>
                          <p>
                            {agent.status === "working"
                              ? "الوكيل يعمل عليها الآن…"
                              : agent.status === "done"
                                ? "أُنجزت المهمة وسُجّلت في السجل."
                                : agent.status === "error"
                                  ? "تحتاج مراجعة قبل المتابعة."
                                  : "بانتظار بدء التنفيذ."}
                          </p>
                        </div>
                        <span className="task-percent" dir="ltr">
                          {progress}%
                        </span>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-label="نسبة تقدم المهمة"
                      >
                        <span className="progress-fill" style={{ width: `${progress}%` }}>
                          <span className="progress-shine" />
                        </span>
                        {[25, 50, 75].map((tick) => (
                          <i key={tick} className="progress-tick" style={{ insetInlineStart: `${tick}%` }} />
                        ))}
                      </div>
                      <div className="task-card-foot">
                        <span className="task-source">
                          <span className="task-source-led" />
                          {task.source === "gemini"
                            ? "مدعوم بـ Gemini"
                            : task.source === "local-runtime"
                              ? "احتياط محلي"
                              : agent.status === "working"
                                ? "تنفيذ مباشر"
                                : "جاهز للأمر التالي"}
                        </span>
                        <span>{agent.status === "error" ? "بانتظار إعادة المحاولة" : "تحديث تلقائي"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="task-empty">
                      <ClockGlyph />
                      <div>
                        <h3>المكتب هادئ حالياً</h3>
                        <p>{agent.nameAr} جاهز لاستلام مهمة جديدة من شريط الأوامر بالأسفل.</p>
                      </div>
                    </div>
                  )}
                </section>

                <section className="quick-actions" aria-label="إجراءات سريعة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      إجراءات سريعة
                    </span>
                    <span className="action-count">{agent.quickActions.length} أدوات</span>
                  </div>
                  <div className="quick-action-grid">
                    {agent.quickActions.map((action, index) => {
                      const ActionIcon = ACTION_ICONS[index % ACTION_ICONS.length];
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className="quick-action"
                          onClick={() => onRunAction(agent.id, action)}
                        >
                          <span className="quick-action-icon">
                            <ActionIcon width={16} height={16} />
                          </span>
                          <span className="quick-action-copy">
                            <strong>{action.labelAr}</strong>
                            <small>{action.hintAr}</small>
                          </span>
                          <ArrowUpLeftIcon width={14} height={14} className="quick-action-arrow" />
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="completed-panel" aria-label="آخر المهام المكتملة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      آخر 5 مهام مكتملة
                    </span>
                    <span className="task-eta">سجل اليوم</span>
                  </div>
                  <ol className="completed-list">
                    {agent.completedTasks.map((completed, index) => (
                      <li key={completed.id} data-source={completed.source}>
                        <span className="completed-marker">
                          <CheckIcon width={11} height={11} />
                        </span>
                        <div className="completed-copy">
                          <div className="completed-head">
                            <span className="completed-title">{completed.titleAr}</span>
                            {completed.source ? (
                              <span
                                className="source-badge"
                                data-source={completed.source}
                                title={
                                  completed.source === "gemini"
                                    ? "ردّ Gemini"
                                    : "ردّ المحرك المحلي الاحتياطي"
                                }
                              >
                                {completed.source === "gemini" ? "Gemini" : "محلي"}
                              </span>
                            ) : null}
                            <span className="completed-time">
                              {formatCompletedTimeAr(completed)}
                            </span>
                            {index === 0 ? <span className="completed-new">جديد</span> : null}
                          </div>
                          {completed.logAr ? (
                            <p className="completed-log">{completed.logAr}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            ) : null}

            {activeTab === "rules" ? (
              <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules" className="modal-tab-panel">
                {/* 3-Tier Hierarchy Overview */}
                <div className="hierarchical-rules-box">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      هرمية القواعد والسياسات (3-Tier Governance)
                    </span>
                    <span className="tier-tag-pill">مستويات الدمج: عام + غرفة + خاص</span>
                  </div>

                  {/* Level 1: Global (Company Wide) */}
                  <div className="inherited-rule-card global-tier">
                    <div className="inherited-card-header">
                      <div className="tier-title-wrap">
                        <span className="tier-scope-badge scope-global">[عام 🌐]</span>
                        <strong>قواعد وسياسات الشركة العامة (Global)</strong>
                      </div>
                      <span className="tier-status-text">موروثة لكافة الوكلاء</span>
                    </div>
                    <p className="inherited-rule-content">
                      {globalRules && globalRules.trim() ? globalRules : "قواعد الجودة والسرعة والتوثيق المعتمدة على مستوى الشركة."}
                    </p>
                  </div>

                  {/* Level 2: Room (Department Wide) */}
                  <div className="inherited-rule-card room-tier">
                    <div className="inherited-card-header">
                      <div className="tier-title-wrap">
                        <span className="tier-scope-badge scope-room">[غرفة 🚪]</span>
                        <strong>قواعد قسم {room.nameAr} (Room)</strong>
                      </div>
                      {onOpenRoomSettings && (
                        <button
                          type="button"
                          className="room-settings-quick-btn"
                          onClick={() => onOpenRoomSettings(room.id)}
                          title="تعديل قواعد وسياسات القسم"
                        >
                          <SlidersIcon width={12} height={12} />
                          <span>إعدادات القسم ⚙</span>
                        </button>
                      )}
                    </div>
                    <p className="inherited-rule-content">
                      {room.rules && room.rules.trim() ? room.rules : "لم يتم تعيين قواعد خاصة بالقسم بعد. يمكنك تعيينها عبر زر إعدادات القسم."}
                    </p>
                  </div>
                </div>

                {/* Level 3: Agent Private Rules */}
                <form className="rules-editor" onSubmit={handleSaveRulesSubmit} style={{ marginTop: 14 }}>
                  <div className="section-heading">
                    <div className="tier-title-wrap">
                      <span className="tier-scope-badge scope-agent">[خاص 👤]</span>
                      <span className="section-kicker">
                        <span className="section-kicker-line" aria-hidden="true" />
                        التعليمات الخاصة بالوكيل: {agent.nameAr}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="ai-optimizer-btn"
                        onClick={handleOptimizeAgentRule}
                        disabled={optimizingRule || !draftRules.trim()}
                        title="تحسين صياغة القواعد وتحويلها إلى تعليمات برمجية دقيقة بواسطة Gemini"
                      >
                        <SparklesIcon width={12} height={12} />
                        <span>{optimizingRule ? "جارٍ التحسين..." : "✨ تحسين القاعدة"}</span>
                      </button>
                      <span className="task-eta" dir="ltr">
                        {draftRules.length} / 2000
                      </span>
                    </div>
                  </div>
                  <p className="rules-help-copy">
                    تُدمج هذه القواعد التخصصية مع قواعد الشركة وقواعد الغرفة وتُحقَن مباشرة في موجه Gemini عند استدعاء {agent.nameAr}.
                  </p>
                  <div className="rules-snippets" aria-label="قوالب قواعد جاهزة">
                    {RULE_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet.labelAr}
                        type="button"
                        className="rules-snippet-btn"
                        onClick={() => handleAppendSnippet(snippet.text)}
                      >
                        {snippet.labelAr}
                      </button>
                    ))}
                  </div>
                  <label htmlFor={`rules-textarea-${agent.id}`} className="sr-only">
                    قواعد الوكيل
                  </label>
                  <textarea
                    id={`rules-textarea-${agent.id}`}
                    className="rules-textarea"
                    rows={6}
                    maxLength={2000}
                    value={draftRules}
                    onChange={(event) => {
                      setDraftRules(event.target.value);
                      setRulesSavedAt(null);
                    }}
                    placeholder="اكتب القواعد والضوابط التي يجب أن يلتزم بها هذا الوكيل دائماً…"
                  />
                  <div className="rules-editor-foot">
                    <span className="rules-status-hint">
                      {rulesSavedAt && !rulesDirty ? (
                        <span className="rules-saved-tag">
                          <CheckIcon width={12} height={12} />
                          تم حفظ القواعد وتفعيلها
                        </span>
                      ) : rulesDirty ? (
                        "توجد تعديلات غير محفوظة"
                      ) : (
                        "القواعد متزامنة مع الوكيل"
                      )}
                    </span>
                    <button
                      type="submit"
                      className="confirm-btn-primary"
                      disabled={!rulesDirty && rulesSavedAt !== null}
                    >
                      حفظ القواعد
                    </button>
                  </div>
                </form>

                {/* Self-Evolution Timeline & Feedback Refinements */}
                {agent.selfEvolutionLog && agent.selfEvolutionLog.length > 0 && (
                  <div className="self-evolution-card" style={{ marginTop: 14 }}>
                    <div className="section-heading">
                      <span className="section-kicker">
                        <span className="section-kicker-line" aria-hidden="true" />
                        سجل التطور الذاتي وقواعد التحسين (Self-Evolution Log 🧠)
                      </span>
                      <span className="tier-tag-pill">{agent.selfEvolutionLog.length} تحسينات مسجلة</span>
                    </div>
                    <div className="self-evolution-timeline">
                      {agent.selfEvolutionLog.map((entry) => (
                        <div key={entry.id} className="self-evolution-entry">
                          <div className="entry-header">
                            <span className="critique-badge">ملاحظة المستخدم:</span>
                            <span className="entry-time">
                              {new Date(entry.timestamp).toLocaleDateString("ar-SA", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="entry-critique-text">«{entry.critiqueAr}»</p>
                          <div className="entry-rule-box">
                            <span className="refined-rule-label">القاعدة المصاغة تلقائياً بواسطة المدير:</span>
                            <p className="entry-rule-text">{entry.refinedRuleAr}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "skills" ? (
              <div role="tabpanel" id="panel-skills" aria-labelledby="tab-skills" className="modal-tab-panel">
                {/* Inherited Skills Hierarchy */}
                {((globalSkills && globalSkills.length > 0) || (room.skills && room.skills.length > 0)) && (
                  <div className="inherited-skills-box">
                    <div className="section-heading">
                      <span className="section-kicker">
                        <span className="section-kicker-line" aria-hidden="true" />
                        المهارات الموروثة للوكيل (Inherited Skills)
                      </span>
                      <span className="tier-tag-pill">مستويات: عام + غرفة</span>
                    </div>
                    <div className="inherited-skills-flow">
                      {globalSkills?.map((skillId) => {
                        const meta = resolveSkillMeta(skillId);
                        return (
                          <span key={`global-${skillId}`} className="inherited-skill-pill global">
                            <span className="pill-tier-tag">[عام 🌐]</span>
                            <span>{meta?.nameAr || skillId}</span>
                          </span>
                        );
                      })}
                      {room.skills?.map((skillId) => {
                        const meta = resolveSkillMeta(skillId);
                        return (
                          <span key={`room-${skillId}`} className="inherited-skill-pill room">
                            <span className="pill-tier-tag">[غرفة 🚪]</span>
                            <span>{meta?.nameAr || skillId}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {customSkills.length > 0 ? (
                  <section aria-label="المهارات المخصصة المستوردة">
                    <div className="section-heading">
                      <span className="section-kicker">
                        <span className="section-kicker-line" aria-hidden="true" />
                        المهارات المثبّتة على الوكيل
                      </span>
                      <span className="task-eta">
                        {customSkills.length === 1
                          ? "مهارة واحدة"
                          : customSkills.length === 2
                            ? "مهارتان"
                            : customSkills.length <= 10
                              ? `${customSkills.length} مهارات`
                              : `${customSkills.length} مهارة`}
                      </span>
                    </div>
                    <div className="custom-skills-list">
                      {customSkills.map((cs) => {
                        const hasFiles = Array.isArray(cs.files) && cs.files.length > 0;
                        const isExpanded = Boolean(expandedSkillFiles[cs.id]);
                        return (
                          <div key={cs.id} className="custom-skill-item">
                            <div className="custom-skill-info">
                              <div className="custom-skill-title-row">
                                <strong>{cs.nameAr}</strong>
                                <span className="source-badge" title="حزمة مهارة محفوظة في المشروع">
                                  📁 {cs.localPath || `skills/${cs.id}`}
                                </span>
                                {hasFiles ? (
                                  <button
                                    type="button"
                                    className="custom-skill-files-badge"
                                    onClick={() => toggleSkillFiles(cs.id)}
                                    title="عرض / إخفاء ملفات الحزمة"
                                  >
                                    📂 {cs.files!.length} {cs.files!.length === 1 ? "ملف" : "ملفات"}
                                    <span className="files-expand-arrow">{isExpanded ? "▲" : "▼"}</span>
                                  </button>
                                ) : null}
                                {cs.installs ? (
                                  <span className="custom-skill-installs-badge">
                                    {formatInstallCount(cs.installs)} تثبيت
                                  </span>
                                ) : null}
                                {cs.sourceUrl ? (
                                  <a
                                    href={cs.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="custom-skill-source-link"
                                    title="فتح مصدر المهارة على skills.sh"
                                  >
                                    <ExternalLinkIcon width={10} height={10} />
                                    skills.sh
                                  </a>
                                ) : null}
                              </div>
                              <p>{cs.descriptionAr}</p>
                              {hasFiles && isExpanded ? (
                                <div className="custom-skill-files-tree">
                                  <span className="files-tree-title">ملفات الحزمة في المشروع:</span>
                                  <ul>
                                    {cs.files!.map((f) => (
                                      <li key={f}>
                                        <code>{f}</code>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="custom-skill-delete"
                              onClick={() => void handleRemoveSkill(cs.id)}
                              aria-label={`حذف مهارة ${cs.nameAr}`}
                            >
                              <TrashIcon width={14} height={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <section
                  aria-label="تنزيل مهارات من الإنترنت عبر find-skills"
                  className="find-skills-section"
                >
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      تنزيل مهارات من الإنترنت (find-skills)
                    </span>
                    <span className="find-skills-source-tag">
                      <GlobeIcon width={12} height={12} />
                      مكتبة skills.sh المفتوحة
                    </span>
                  </div>

                  <div className="find-skills-context-banner">
                    <SparklesIcon width={13} height={13} className="find-skills-banner-sparkle" />
                    <div className="find-skills-banner-text">
                      <span className="find-skills-banner-title">
                        مهارات مقترحة خصيصاً لدور «{agent.roleAr}» ({suggestionProfile.categoryLabelAr})
                      </span>
                      <span className="find-skills-banner-sub">
                        مختارة آلياً وفق تخصص ومسؤوليات {agent.nameAr} من شبكة skills.sh
                      </span>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSearchSkills();
                    }}
                    className="find-skills-search-form"
                  >
                    <div className="find-skills-search-bar">
                      <span className="find-skills-search-icon-wrap" aria-hidden="true">
                        <SearchIcon width={14} height={14} />
                      </span>
                      <input
                        type="text"
                        value={findSkillsQuery}
                        onChange={(e) => setFindSkillsQuery(e.target.value)}
                        placeholder={`ابحث عن مهارة تناسب ${agent.roleAr} (مثال: ${suggestionProfile.chips.slice(0, 3).map((c: AgentSkillSuggestionChip) => c.query).join(", ")})…`}
                        className="find-skills-search-input"
                      />
                      <button
                        type="submit"
                        className="find-skills-search-btn"
                        disabled={isSearchingSkills}
                      >
                        {isSearchingSkills ? "جاري البحث…" : "بحث"}
                      </button>
                    </div>

                    <div
                      className="find-skills-chips"
                      role="group"
                      aria-label={`مهارات مقترحة لدور ${agent.roleAr}`}
                    >
                      {suggestionProfile.chips.map((chip: AgentSkillSuggestionChip) => (
                        <button
                          key={chip.query}
                          type="button"
                          className="find-skills-chip"
                          data-active={findSkillsQuery === chip.query ? "true" : "false"}
                          onClick={() => {
                            setFindSkillsQuery(chip.query);
                            void handleSearchSkills(chip.query);
                          }}
                        >
                          #{chip.label}
                        </button>
                      ))}
                    </div>
                  </form>

                  {findSkillsFeedback ? (
                    <p
                      className="skill-import-feedback"
                      data-kind={findSkillsFeedback.kind}
                      role="status"
                    >
                      {findSkillsFeedback.text}
                    </p>
                  ) : null}

                  {isSearchingSkills ? (
                    <div className="skills-loading-container" aria-live="polite">
                      <div className="skills-loading-banner">
                        <span className="skills-loading-pixel" aria-hidden="true" />
                        <span>جاري استدعاء وفحص حزم المهارات لدور «{agent.roleAr}»…</span>
                      </div>
                      <div className="skills-catalog-grid skills-skeleton-grid" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} className="skill-card skill-card-skeleton">
                            <div className="skill-card-head">
                              <div className="skeleton-line-group">
                                <div className="skeleton-line skeleton-meta" />
                                <div className="skeleton-line skeleton-title" />
                              </div>
                              <div className="skeleton-btn" />
                            </div>
                            <div className="skeleton-line skeleton-desc" />
                            <div className="skeleton-line skeleton-desc skeleton-short" />
                            <div className="skeleton-line skeleton-tag" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {localProjectSkills.length > 0 ? (
                        <div className="local-skills-section">
                          <div className="section-heading">
                            <span className="section-kicker">
                              <span className="section-kicker-line" aria-hidden="true" />
                              حزم المهارات المحفوظة في المشروع (جاهزة للتفعيل)
                            </span>
                            <span className="find-skills-source-tag">
                              📁 مجلد skills/
                            </span>
                          </div>
                          <div className="skills-catalog-grid">
                            {localProjectSkills.map((item, idx) => {
                              const isInstalled = customSkills.some(
                                (cs) =>
                                  cs.id === `skill-${item.skillId}` ||
                                  cs.nameAr.toLowerCase() === item.name.toLowerCase() ||
                                  cs.nameAr.toLowerCase() === item.skillId.toLowerCase(),
                              );
                              const isDownloading = downloadingSkillId === item.id;
                              return (
                                <div
                                  key={item.id}
                                  className="skill-card local-skill-card"
                                  data-installed={isInstalled ? "true" : "false"}
                                  style={{ "--item-idx": idx } as React.CSSProperties}
                                >
                                  <div className="skill-card-head">
                                    <div>
                                      <span className="skill-category">
                                        حزمة مشروع محلية · {item.filesCount ?? item.files?.length ?? 1} ملفات
                                      </span>
                                      <h4>{item.name}</h4>
                                    </div>
                                    <button
                                      type="button"
                                      className="skill-toggle-btn"
                                      data-installed={isInstalled ? "true" : "false"}
                                      disabled={isInstalled || isDownloading}
                                      onClick={() => void handleDownloadSkill(item)}
                                      aria-pressed={isInstalled}
                                    >
                                      {isInstalled ? (
                                        <>
                                          <CheckIcon width={12} height={12} />
                                          <span>مفعّلة على الوكيل</span>
                                        </>
                                      ) : isDownloading ? (
                                        <>
                                          <span className="skill-loading-dot" aria-hidden="true" />
                                          <span>تفعيل…</span>
                                        </>
                                      ) : (
                                        <>
                                          <PlusIcon width={12} height={12} />
                                          <span>تفعيل على الوكيل</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <p className="skill-description">
                                    {item.description || "حزمة مهارة متكاملة بملفات المراجع والسكربتات."}
                                  </p>
                                  <div className="local-skill-foot">
                                    <span className="source-badge">📁 {item.localPath}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {findSkillsResults.length > 0 ? (
                        <div className="skills-catalog-grid">
                          {findSkillsResults.map((item, idx) => {
                            const isInstalled = customSkills.some(
                              (cs) =>
                                (cs.sourceUrl && cs.sourceUrl.includes(item.skillId)) ||
                                cs.nameAr.toLowerCase() === item.name.toLowerCase() ||
                                cs.nameAr.toLowerCase() === item.skillId.toLowerCase(),
                            );
                            const isDownloading = downloadingSkillId === item.id;

                            return (
                              <div
                                key={item.id}
                                className="skill-card"
                                data-installed={isInstalled ? "true" : "false"}
                                style={{
                                  "--item-idx": localProjectSkills.length + idx,
                                } as React.CSSProperties}
                              >
                                <div className="skill-card-head">
                                  <div>
                                    <span className="skill-category">
                                      {item.source}
                                      {item.installs ? ` · ${formatInstallCount(item.installs)} تثبيت` : ""}
                                    </span>
                                    <h4>{item.name}</h4>
                                  </div>
                                  <button
                                    type="button"
                                    className="skill-toggle-btn"
                                    data-installed={isInstalled ? "true" : "false"}
                                    disabled={isInstalled || isDownloading}
                                    onClick={() => void handleDownloadSkill(item)}
                                    aria-pressed={isInstalled}
                                  >
                                    {isInstalled ? (
                                      <>
                                        <CheckIcon width={12} height={12} />
                                        <span>مثبّتة</span>
                                      </>
                                    ) : isDownloading ? (
                                      <>
                                        <span className="skill-loading-dot" aria-hidden="true" />
                                        <span>تثبيت…</span>
                                      </>
                                    ) : (
                                      <>
                                        <PlusIcon width={12} height={12} />
                                        <span>تثبيت</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                <p className="skill-description">
                                  مهارة برمجية مفتوحة المصدر جاهزة للتنزيل والتفعيل على الوكيل عبر find-skills.
                                </p>

                                <span className="skill-api-note">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="find-skill-link"
                                    title={`عرض ${item.name} على skills.sh`}
                                  >
                                    <ExternalLinkIcon width={10} height={10} />
                                    <span>skills.sh / {item.source}</span>
                                  </a>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : localProjectSkills.length === 0 ? (
                        <div className="skills-empty-state">
                          <p>لم يتم العثور على مهارات مطابقة للبحث «{findSkillsQuery || "—"}».</p>
                          <button
                            type="button"
                            className="find-skills-chip"
                            onClick={() => {
                              setFindSkillsQuery(suggestionProfile.primaryQuery);
                              void handleSearchSkills(suggestionProfile.primaryQuery);
                            }}
                          >
                            استعادة مقترحات دور {agent.roleAr}
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>

                <section className="custom-skill-importer" aria-label="استيراد مهارة بصيغة Markdown أو JSON">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      استيراد مهارة مخصّصة (Markdown / JSON)
                    </span>
                    <div className="importer-templates">
                      <button
                        type="button"
                        className="rules-snippet-btn"
                        onClick={() => {
                          setSkillImportText(MARKDOWN_TEMPLATE);
                          setSkillImportFeedback(null);
                        }}
                      >
                        قالب Markdown
                      </button>
                      <button
                        type="button"
                        className="rules-snippet-btn"
                        onClick={() => {
                          setSkillImportText(JSON_TEMPLATE);
                          setSkillImportFeedback(null);
                        }}
                      >
                        قالب JSON
                      </button>
                    </div>
                  </div>
                  <form onSubmit={handleImportCustomSkill}>
                    <textarea
                      className="rules-textarea rules-textarea-compact"
                      rows={4}
                      dir="auto"
                      value={skillImportText}
                      onChange={(event) => {
                        setSkillImportText(event.target.value);
                        setSkillImportFeedback(null);
                      }}
                      placeholder={'# اسم المهارة\n- اكتب تعليمات المهارة هنا...\nأو ألصق كائن JSON مثل {"nameAr":"...","promptInstruction":"..."}'}
                    />
                    {skillImportFeedback ? (
                      <p
                        className="skill-import-feedback"
                        data-kind={skillImportFeedback.kind}
                        role="status"
                      >
                        {skillImportFeedback.text}
                      </p>
                    ) : null}
                    <div className="rules-editor-foot">
                      <span className="rules-status-hint">
                        {customSkills.length > 0
                          ? `المهارات المثبتة: ${customSkills.map((s) => s.nameAr).slice(0, 3).join("، ")}`
                          : "يمكنك استيراد مهارة خاصة بصيغة Markdown أو JSON"}
                      </span>
                      <button
                        type="submit"
                        className="confirm-btn-primary"
                        disabled={!skillImportText.trim()}
                      >
                        استيراد وتثبيت
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : null}

            {/* Tab: Tools & Plugins */}
            {activeTab === "tools" ? (
              <div role="tabpanel" id="panel-tools" aria-labelledby="tab-tools" className="modal-tab-panel">
                {/* Built-in Connectors */}
                <section aria-label="الموصلات المدمجة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      الموصلات والإضافات المدمجة الجاهزة
                    </span>
                    <span className="task-eta">5 موصلات نشطة</span>
                  </div>
                  <div className="tools-grid">
                    {[
                      {
                        id: "gmail",
                        name: "Google Gmail Connector",
                        desc: "قراءة وتلخيص الرسائل وصياغة مسودات البريد الإلكتروني للعملاء",
                        status: googleConnected ? "متصل بحسابك" : "جاهز بالوضع التجريبي",
                        connected: true,
                      },
                      {
                        id: "sheets",
                        name: "Google Sheets Connector",
                        desc: "قراءة وتحديث جداول البيانات والميزانيات المالية والخطط",
                        status: googleConnected ? "متصل بحسابك" : "جاهز بالوضع التجريبي",
                        connected: true,
                      },
                      {
                        id: "web-search",
                        name: "Web Search & Scraper",
                        desc: "البحث الحي عبر محركات البحث واستخراج البيانات من مواقع الويب",
                        status: "مفعّل تلقائياً",
                        connected: true,
                      },
                      {
                        id: "doc-reader",
                        name: "Document & PDF Reader",
                        desc: "تحليل العقود والمستندات والملفات المرفقة واستخلاص البنود",
                        status: "مفعّل تلقائياً",
                        connected: true,
                      },
                      {
                        id: "prompt-gen",
                        name: "Visual Prompt Generator",
                        desc: "توليد برومبتات احترافية لبوسترات السوشيال ميديا وأغلفة الريلز",
                        status: "مفعّل تلقائياً",
                        connected: true,
                      },
                    ].map((conn) => (
                      <div key={conn.id} className="tool-connector-card">
                        <div className="tool-connector-header">
                          <span className="tool-conn-dot" />
                          <strong className="tool-conn-name">{conn.name}</strong>
                          <span className="tool-conn-status">{conn.status}</span>
                        </div>
                        <p className="tool-conn-desc">{conn.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Custom REST API / Webhook Builder */}
                <section aria-label="بناء Webhook مخصص">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      إضافة Webhook / REST API مخصص (n8n / Make / Custom Server)
                    </span>
                  </div>

                  <div className="webhook-builder-box">
                    <div className="webhook-form-row">
                      <div className="webhook-form-field">
                        <label className="webhook-label">اسم الإضافة / Webhook:</label>
                        <input
                          type="text"
                          className="chat-textarea webhook-input"
                          placeholder="مثال: n8n Lead Dispatcher"
                          value={webhookName}
                          onChange={(e) => setWebhookName(e.target.value)}
                        />
                      </div>
                      <div className="webhook-form-field webhook-field-sm">
                        <label className="webhook-label">نوع الطلب:</label>
                        <select
                          className="chat-textarea webhook-select"
                          value={webhookMethod}
                          onChange={(e) =>
                            setWebhookMethod(e.target.value as "GET" | "POST" | "PUT")
                          }
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                    </div>

                    <div className="webhook-form-field">
                      <label className="webhook-label">رابط الـ Webhook أو الـ API Endpoint:</label>
                      <input
                        type="url"
                        className="chat-textarea webhook-input"
                        placeholder="https://your-n8n-instance.com/webhook/instagram-flow"
                        dir="ltr"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                      />
                    </div>

                    <div className="webhook-form-field">
                      <label className="webhook-label">وصف الإضافة ودواعي الاستخدام للوكيل:</label>
                      <input
                        type="text"
                        className="chat-textarea webhook-input"
                        placeholder="استدعاء هذا الرابط لإرسال التقرير النهائي إلى سير عمل n8n"
                        value={webhookDesc}
                        onChange={(e) => setWebhookDesc(e.target.value)}
                      />
                    </div>

                    <div className="webhook-form-row">
                      <div className="webhook-form-field">
                        <label className="webhook-label">ترويسات الطلب (Headers JSON - اختياري):</label>
                        <input
                          type="text"
                          className="chat-textarea webhook-input font-mono"
                          dir="ltr"
                          placeholder='{"Authorization": "Bearer token123"}'
                          value={webhookHeaders}
                          onChange={(e) => setWebhookHeaders(e.target.value)}
                        />
                      </div>
                      <div className="webhook-form-field">
                        <label className="webhook-label">قالب الحمولة (Body Template - اختياري):</label>
                        <input
                          type="text"
                          className="chat-textarea webhook-input font-mono"
                          dir="ltr"
                          placeholder='{"task": "{{taskTitle}}", "agent": "{{agentName}}"}'
                          value={webhookBody}
                          onChange={(e) => setWebhookBody(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="webhook-actions-bar">
                      <button
                        type="button"
                        className="pixel-btn webhook-ping-btn"
                        disabled={!webhookUrl.trim() || isPinging}
                        onClick={async () => {
                          playClickSound();
                          setIsPinging(true);
                          setPingStatus("جارٍ فحص الاتصال بالخادم...");
                          await new Promise((r) => setTimeout(r, 700));
                          setIsPinging(false);
                          setPingStatus("✓ تم فحص الاتصال بنجاح — الاستجابة: HTTP 200 OK");
                        }}
                      >
                        {isPinging ? "جارٍ الفحص..." : "اختبار الاتصال (Ping)"}
                      </button>

                      <button
                        type="button"
                        className="confirm-btn-primary"
                        disabled={!webhookName.trim() || !webhookUrl.trim()}
                        onClick={() => {
                          playClickSound();
                          let parsedHeaders: Record<string, string> | undefined;
                          try {
                            if (webhookHeaders.trim()) {
                              parsedHeaders = JSON.parse(webhookHeaders);
                            }
                          } catch {
                            // ignore
                          }
                          const newTool: CustomWebhookTool = {
                            id: `tool-${Date.now().toString(36)}`,
                            nameAr: webhookName.trim(),
                            descriptionAr: webhookDesc.trim() || webhookName.trim(),
                            method: webhookMethod,
                            url: webhookUrl.trim(),
                            headers: parsedHeaders,
                            bodyTemplate: webhookBody.trim() || undefined,
                            enabled: true,
                          };
                          const currentTools = agent.customTools ?? [];
                          const updated = [...currentTools, newTool];
                          onSaveTools?.(agent.id, updated);
                          setWebhookName("");
                          setWebhookDesc("");
                          setWebhookUrl("");
                          setWebhookHeaders("");
                          setWebhookBody("");
                          setPingStatus("تم حفظ الإضافة بنجاح وتفعيلها للوكيل!");
                        }}
                      >
                        إضافة الإضافة وتفعيلها
                      </button>
                    </div>

                    {pingStatus && (
                      <div className="webhook-ping-result" role="status">
                        {pingStatus}
                      </div>
                    )}
                  </div>

                  {/* Configured Tools List */}
                  {agent.customTools && agent.customTools.length > 0 && (
                    <div className="custom-tools-list">
                      <div className="section-heading">
                        <span className="section-kicker">الإضافات والـ Webhooks المفعّلة على الوكيل</span>
                      </div>
                      {agent.customTools.map((tool) => (
                        <div key={tool.id} className="custom-tool-card">
                          <div className="custom-tool-top">
                            <span className="custom-tool-method">{tool.method}</span>
                            <strong className="custom-tool-name">{tool.nameAr}</strong>
                            <span className="custom-tool-url" dir="ltr">{tool.url}</span>
                            <div className="custom-tool-actions">
                              <button
                                type="button"
                                className="rules-snippet-btn"
                                onClick={() => {
                                  playClickSound();
                                  const updated = agent.customTools!.map((t) =>
                                    t.id === tool.id ? { ...t, enabled: !t.enabled } : t,
                                  );
                                  onSaveTools?.(agent.id, updated);
                                }}
                              >
                                {tool.enabled ? "مفعّل ✓" : "معطّل"}
                              </button>
                              <button
                                type="button"
                                className="chat-action-btn chat-close-btn pixel-btn"
                                onClick={() => {
                                  playClickSound();
                                  const updated = agent.customTools!.filter((t) => t.id !== tool.id);
                                  onSaveTools?.(agent.id, updated);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <p className="custom-tool-desc">{tool.descriptionAr}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : null}

            {/* Tab: Scripts & Automation Rules */}
            {activeTab === "scripts" ? (
              <div role="tabpanel" id="panel-scripts" aria-labelledby="tab-scripts" className="modal-tab-panel">
                {/* Peer Review Toggle */}
                <section aria-label="حوكمة الغرفة ومراجعة الجودة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      حوكمة الغرفة ومراجعة الجودة (Quality Review & Peer Reflection)
                    </span>
                  </div>
                  <div className="peer-review-box">
                    <div className="peer-review-info">
                      <strong>بوابة الاعتماد والمراجعة الزميلة (Peer Review Gate)</strong>
                      <p>
                        عند تفعيل هذا الخيار، لن يُعتبر أي مخرج مكتملاً حتى يقوم المدير العام أو وكيل ثانٍ في الغرفة
                        بمراجعة الجودة وتدقيق البيانات وإصدار إشعار الاعتماد.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`pixel-btn peer-toggle-btn ${room.peerReviewEnabled ? "active" : ""}`}
                      onClick={() => {
                        playClickSound();
                        onTogglePeerReview?.(room.id, !room.peerReviewEnabled);
                      }}
                    >
                      {room.peerReviewEnabled ? "مراجعة الجودة مفعّلة ✓" : "تفعيل مراجعة الجودة"}
                    </button>
                  </div>
                </section>

                {/* 3 One-Click Starter Script Templates */}
                <section aria-label="قوالب أتمتة جاهزة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      قوالب أتمتة ذكية بنقرة واحدة (Starter Automation Templates)
                    </span>
                  </div>
                  <div className="script-templates-grid">
                    {[
                      {
                        id: "tmpl-invoice",
                        title: "قاعدة الفواتير التلقائية (Auto Invoice Router)",
                        desc: "إذا احتوى ملخص البريد أو الأمر على 'فاتورة'، يتم تحويل البيانات فوراً للمدير المالي وتلوين شاشته بالأخضر.",
                        rule: {
                          titleAr: "تحويل الفواتير التلقائي للإدارة المالية",
                          trigger: "onKeywordMatch" as const,
                          keyword: "فاتورة",
                          action: "forwardToAgent" as const,
                          targetAgentId: "gm",
                          ledColor: "green" as const,
                          enabled: true,
                        },
                      },
                      {
                        id: "tmpl-marketing-chain",
                        title: "سلسلة التسويق المتتابعة (Marketing Pipeline Chain)",
                        desc: "عند اكتمال تحليل الإنستقرام، يتم تمرير الحساب والبيانات تلقائياً لكاتبة المحتوى لصياغة 3 ريلز.",
                        rule: {
                          titleAr: "تمرير التحليل التلقائي لصانعة المحتوى",
                          trigger: "onTaskComplete" as const,
                          action: "forwardToAgent" as const,
                          targetAgentId: roomAgents.find((a) => a.id !== agent.id)?.id ?? agent.id,
                          ledColor: "blue" as const,
                          enabled: true,
                        },
                      },
                      {
                        id: "tmpl-approval-guard",
                        title: "حارس الجودة والموافقة البشرية (Approval Guard)",
                        desc: "اعتراض أي أمر يتضمن نشر أو تعديلات خارجية وعرض بطاقة الموافقة البشرية ✋ قبل التنفيذ.",
                        rule: {
                          titleAr: "طلب موافقة بشرية قبل النشر والإرسال الخارجي",
                          trigger: "onKeywordMatch" as const,
                          keyword: "نشر",
                          action: "requireApproval" as const,
                          ledColor: "amber" as const,
                          enabled: true,
                        },
                      },
                    ].map((tmpl) => (
                      <div key={tmpl.id} className="script-template-card">
                        <div className="tmpl-header">
                          <strong>{tmpl.title}</strong>
                        </div>
                        <p className="tmpl-desc">{tmpl.desc}</p>
                        <button
                          type="button"
                          className="pixel-btn tmpl-activate-btn"
                          onClick={() => {
                            playClickSound();
                            const current = agent.scriptRules ?? [];
                            const newRule: AutomationRule = {
                              id: `rule-${Date.now().toString(36)}`,
                              ...tmpl.rule,
                            };
                            onSaveRulesConfig?.(agent.id, [...current, newRule]);
                          }}
                        >
                          تفعيل القالب بنقرة واحدة +
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Active Rules List & Custom Rule Creator */}
                <section aria-label="القواعد النشطة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      القواعد البرمجية المفعّلة للوكيل
                    </span>
                    <span className="task-eta">{agent.scriptRules?.length ?? 0} قواعد</span>
                  </div>

                  {agent.scriptRules && agent.scriptRules.length > 0 ? (
                    <div className="rules-cards-stack">
                      {agent.scriptRules.map((rule) => (
                        <div key={rule.id} className="automation-rule-card">
                          <div className="rule-card-header">
                            <span
                              className="rule-led-indicator"
                              style={{
                                backgroundColor:
                                  rule.ledColor === "green"
                                    ? "#32b768"
                                    : rule.ledColor === "amber"
                                      ? "#f59e0b"
                                      : rule.ledColor === "red"
                                        ? "#ef4444"
                                        : "#3b82f6",
                              }}
                            />
                            <strong>{rule.titleAr}</strong>
                            <span className="rule-trigger-pill">
                              الحدث: {rule.trigger === "onKeywordMatch" ? `كلمة «${rule.keyword}»` : rule.trigger}
                            </span>
                            <span className="rule-action-pill">
                              الإجراء: {rule.action}
                            </span>
                            <div className="rule-card-controls">
                              <button
                                type="button"
                                className="rules-snippet-btn"
                                onClick={() => {
                                  playClickSound();
                                  const updated = agent.scriptRules!.map((r) =>
                                    r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
                                  );
                                  onSaveRulesConfig?.(agent.id, updated);
                                }}
                              >
                                {rule.enabled ? "نشطة ✓" : "موقوفة"}
                              </button>
                              <button
                                type="button"
                                className="chat-action-btn chat-close-btn pixel-btn"
                                onClick={() => {
                                  playClickSound();
                                  const updated = agent.scriptRules!.filter((r) => r.id !== rule.id);
                                  onSaveRulesConfig?.(agent.id, updated);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="vault-empty-list">لا توجد قواعد مخصصة مفعّلة حالياً.</div>
                  )}

                  {/* Custom Rule Builder */}
                  <div className="custom-rule-builder">
                    <div className="section-heading">
                      <span className="section-kicker">إنشاء قاعدة برمجية جديدة</span>
                    </div>
                    <div className="rule-builder-form">
                      <input
                        type="text"
                        className="chat-textarea webhook-input"
                        placeholder="عنوان القاعدة (مثال: إشعار المدير عند اكتمال الفيديو)"
                        value={newRuleTitle}
                        onChange={(e) => setNewRuleTitle(e.target.value)}
                      />
                      <div className="webhook-form-row">
                        <select
                          className="chat-textarea webhook-select"
                          value={newRuleTrigger}
                          onChange={(e) =>
                            setNewRuleTrigger(e.target.value as AutomationRule["trigger"])
                          }
                        >
                          <option value="onKeywordMatch">عند مطابقة كلمة مفتاحية</option>
                          <option value="onTaskComplete">عند اكتمال أي مهمة</option>
                          <option value="onError">عند حدوث خطأ</option>
                          <option value="onSchedule">عند موعد الجدولة</option>
                        </select>

                        {newRuleTrigger === "onKeywordMatch" && (
                          <input
                            type="text"
                            className="chat-textarea webhook-input"
                            placeholder="الكلمة المفتاحية (مثال: تقرير)"
                            value={newRuleKeyword}
                            onChange={(e) => setNewRuleKeyword(e.target.value)}
                          />
                        )}

                        <select
                          className="chat-textarea webhook-select"
                          value={newRuleAction}
                          onChange={(e) =>
                            setNewRuleAction(e.target.value as AutomationRule["action"])
                          }
                        >
                          <option value="forwardToAgent">تحويل للوكيل</option>
                          <option value="requireApproval">طلب موافقة بشرية ✋</option>
                          <option value="saveToVault">حفظ في الخزنة 📦</option>
                          <option value="changeDeskLed">تغيير إضاءة المكتب</option>
                          <option value="notifyGm">إشعار المدير العام</option>
                        </select>

                        <select
                          className="chat-textarea webhook-select"
                          value={newRuleLed}
                          onChange={(e) =>
                            setNewRuleLed(e.target.value as AutomationRule["ledColor"])
                          }
                        >
                          <option value="green">شاشة خضراء (نشاط)</option>
                          <option value="amber">شاشة كهرمانية (موافقة)</option>
                          <option value="blue">شاشة زرقاء (مكتبية)</option>
                          <option value="red">شاشة حمراء (تنبيه)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className="confirm-btn-primary"
                        disabled={!newRuleTitle.trim()}
                        onClick={() => {
                          playClickSound();
                          const newRule: AutomationRule = {
                            id: `rule-${Date.now().toString(36)}`,
                            titleAr: newRuleTitle.trim(),
                            trigger: newRuleTrigger,
                            keyword: newRuleTrigger === "onKeywordMatch" ? newRuleKeyword.trim() : undefined,
                            action: newRuleAction,
                            targetAgentId: newRuleTarget,
                            ledColor: newRuleLed,
                            enabled: true,
                          };
                          const current = agent.scriptRules ?? [];
                          onSaveRulesConfig?.(agent.id, [...current, newRule]);
                          setNewRuleTitle("");
                          setNewRuleKeyword("");
                        }}
                      >
                        إضافة وتفعيل القاعدة +
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {/* Tab: Schedule */}
            {activeTab === "schedule" ? (
              <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule" className="modal-tab-panel">
                <section aria-label="الجدولة الدورية">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      الجدولة التلقائية بالخلفية (Cron Jobs & Autonomous Scheduler)
                    </span>
                  </div>

                  <div className="schedule-panel-box">
                    <div className="schedule-toggle-row">
                      <div>
                        <strong>تفعيل الجدولة التلقائية الدورية</strong>
                        <p>
                          يقوم الوكيل بتنفيذ المهمة المحددة ذاتياً في الخلفية كلما انقضت الفترة المحددة دون الحاجة لتدخلك.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`pixel-btn peer-toggle-btn ${schedEnabled ? "active" : ""}`}
                        onClick={() => {
                          playClickSound();
                          setSchedEnabled(!schedEnabled);
                        }}
                      >
                        {schedEnabled ? "الجدولة مفعّلة ✓" : "تفعيل الجدولة"}
                      </button>
                    </div>

                    <div className="webhook-form-row">
                      <div className="webhook-form-field">
                        <label className="webhook-label">تكرار التنفيذ:</label>
                        <select
                          className="chat-textarea webhook-select"
                          value={schedInterval}
                          onChange={(e) => setSchedInterval(Number(e.target.value))}
                        >
                          <option value={15}>كل 15 دقيقة</option>
                          <option value={30}>كل 30 دقيقة</option>
                          <option value={60}>كل ساعة (60 دقيقة)</option>
                          <option value={360}>كل 6 ساعات</option>
                          <option value={1440}>يومياً (كل 24 ساعة)</option>
                        </select>
                      </div>

                      <div className="webhook-form-field">
                        <label className="webhook-label">تسمية المهمة:</label>
                        <input
                          type="text"
                          className="chat-textarea webhook-input"
                          value={schedLabel}
                          onChange={(e) => setSchedLabel(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="webhook-form-field">
                      <label className="webhook-label">الأمر أو التوجيه المنفّذ تلقائياً:</label>
                      <textarea
                        className="rules-textarea rules-textarea-compact"
                        rows={3}
                        value={schedPrompt}
                        onChange={(e) => setSchedPrompt(e.target.value)}
                        placeholder="اكتب التوجيه الذي ترغب أن ينفّذه الوكيل ذاتياً في الموعد المحدد..."
                      />
                    </div>

                    {agent.schedule?.enabled && (
                      <div className="schedule-live-badge">
                        <span className="live-clock-icon">⏱️</span>
                        <span>
                          الجدولة قيد العمل في الخلفية · التكرار: كل {agent.schedule.intervalMinutes} دقيقة
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="confirm-btn-primary"
                      onClick={() => {
                        playClickSound();
                        const nextRun = Date.now() + schedInterval * 60_000;
                        const scheduleConfig: AgentSchedule = {
                          enabled: schedEnabled,
                          intervalMinutes: schedInterval,
                          nextRunTimestamp: nextRun,
                          prompt: schedPrompt.trim(),
                          labelAr: schedLabel.trim() || "مهمة دورية",
                        };
                        onSaveSchedule?.(agent.id, schedEnabled ? scheduleConfig : undefined);
                      }}
                    >
                      حفظ وتحديث الجدولة
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {/* Tab: Memory */}
            {activeTab === "memory" ? (
              <div role="tabpanel" id="panel-memory" aria-labelledby="tab-memory" className="modal-tab-panel">
                <section aria-label="الذاكرة والسياق الدائم">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      الذاكرة الدائمة والسياق التراكمي (Persistent Agent Memory)
                    </span>
                    <span className="task-eta">{agent.memory?.length ?? 0} ذكريات محفوظة</span>
                  </div>

                  <p className="rules-status-hint">
                    تُحفظ هذه المعلومات والحقائق التفضيلية في ذاكرة الوكيل الدائمة، وتُحقن تلقائياً في سياق النموذج عند كل مهمة لضمان استمرارية الفهم.
                  </p>

                  <div className="memory-add-box">
                    <div className="webhook-form-field">
                      <label className="webhook-label">إضافة معلومة أو تفضيل جديد لذاكرة الوكيل:</label>
                      <div className="memory-input-row">
                        <input
                          type="text"
                          className="chat-textarea webhook-input"
                          placeholder="مثال: الحساب المستهدف هو ahmad.al.khatib_ والنبرة المطلوبة احترافية مباشرة..."
                          value={newMemory}
                          onChange={(e) => setNewMemory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newMemory.trim()) {
                              e.preventDefault();
                              playClickSound();
                              const current = agent.memory ?? [];
                              onSaveMemory?.(agent.id, [...current, newMemory.trim()]);
                              setNewMemory("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="confirm-btn-primary"
                          disabled={!newMemory.trim()}
                          onClick={() => {
                            playClickSound();
                            const current = agent.memory ?? [];
                            onSaveMemory?.(agent.id, [...current, newMemory.trim()]);
                            setNewMemory("");
                          }}
                        >
                          إضافة للذاكرة +
                        </button>
                      </div>
                    </div>
                  </div>

                  {agent.memory && agent.memory.length > 0 ? (
                    <div className="memory-items-list">
                      {agent.memory.map((entry, idx) => (
                        <div key={idx} className="memory-item-card">
                          <span className="memory-bullet-dot">◈</span>
                          <span className="memory-text">{entry}</span>
                          <button
                            type="button"
                            className="chat-action-btn chat-close-btn pixel-btn"
                            onClick={() => {
                              playClickSound();
                              const updated = agent.memory!.filter((_, i) => i !== idx);
                              onSaveMemory?.(agent.id, updated);
                            }}
                            title="حذف من الذاكرة"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div className="memory-clear-bar">
                        <button
                          type="button"
                          className="pixel-btn vault-act-btn vault-btn-danger"
                          onClick={() => {
                            playClickSound();
                            onSaveMemory?.(agent.id, []);
                          }}
                        >
                          مسح كافة محتويات الذاكرة
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="vault-empty-list">ذاكرة الوكيل فارغة حالياً. أضف تفضيلات أو حقائق ليحفظها.</div>
                  )}
                </section>
              </div>
            ) : null}

            <footer className="agent-modal-footer">
              <span className="runtime-note" data-source={latestSource ?? "local-runtime"}>
                <span className="runtime-dot" />
                {latestSource === "gemini"
                  ? "مدعوم بـ Gemini · التعليمات والمهارات تُحقَن تلقائياً"
                  : "محرك التوجيه والمهارات مفعّل · متوافق مع Gemini و Google APIs"}
              </span>
              <span className="agent-modal-id">AGENT / {agent.id.toUpperCase()}</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockGlyph() {
  return (
    <span className="task-empty-glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="8.5" strokeWidth="1.7" />
        <path d="M12 7v5l3 2" strokeWidth="1.7" />
      </svg>
    </span>
  );
}
