"use client";

import { useEffect, useRef, useState } from "react";
import {
  STATUS_META,
  formatCompletedTimeAr,
  type Agent,
  type QuickAction,
  type Room,
} from "@/data/agents";
import {
  SKILL_CATALOG,
  parseCustomSkillInput,
  resolveSkillMeta,
  type CustomSkillDefinition,
} from "@/data/skills";
import AgentPortrait from "@/components/agent-portrait";
import {
  AlertIcon,
  ArrowUpLeftIcon,
  BoltIcon,
  CheckIcon,
  CloseIcon,
  MapPinIcon,
  PlusIcon,
  SlidersIcon,
  SparklesIcon,
  TargetIcon,
  TerminalIcon,
  TrashIcon,
} from "@/components/icons";

type ModalTab = "tasks" | "rules" | "skills";

interface AgentModalProps {
  agent: Agent;
  room: Room;
  roomAgents: Agent[];
  googleConnected?: boolean;
  onSelectAgent: (agentId: Agent["id"]) => void;
  onClose: () => void;
  onRunAction: (agentId: Agent["id"], action: QuickAction) => void;
  onSaveRules: (agentId: Agent["id"], rules: string) => void;
  onToggleSkill: (agentId: Agent["id"], skillId: string) => void;
  onAddCustomSkill: (agentId: Agent["id"], customSkill: CustomSkillDefinition) => void;
  onRemoveCustomSkill: (agentId: Agent["id"], customSkillId: string) => void;
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
}: AgentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>("tasks");
  const [draftRules, setDraftRules] = useState(agent.rules);
  const [rulesSavedAt, setRulesSavedAt] = useState<number | null>(null);
  const [skillImportText, setSkillImportText] = useState("");
  const [skillImportFeedback, setSkillImportFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const progress = useLiveProgress(agent);
  const meta = STATUS_META[agent.status];
  const task = agent.activeTask;
  const latestSource = task?.source ?? agent.completedTasks[0]?.source;
  const customSkills = agent.customSkills ?? [];
  const totalSkillsCount = agent.skills.length + customSkills.length;
  const rulesDirty = draftRules.trim() !== agent.rules.trim();

  // Keep draft rules synced when user switches between agents.
  const [syncedAgentId, setSyncedAgentId] = useState(agent.id);
  if (syncedAgentId !== agent.id) {
    setSyncedAgentId(agent.id);
    setDraftRules(agent.rules);
    setRulesSavedAt(null);
    setSkillImportFeedback(null);
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
            <CloseIcon width={18} height={18} />
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
            <dl className="agent-meta-list">
              <div>
                <dt>الغرفة</dt>
                <dd>{room.nameAr}</dd>
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
                onClick={() => setActiveTab("skills")}
              >
                <SparklesIcon width={14} height={14} />
                <span>المهارات</span>
                <span className="modal-tab-badge" dir="ltr">
                  {totalSkillsCount}
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
                <form className="rules-editor" onSubmit={handleSaveRulesSubmit}>
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      القواعد والتعليمات الدائمة (System Instructions)
                    </span>
                    <span className="task-eta" dir="ltr">
                      {draftRules.length} / 2000
                    </span>
                  </div>
                  <p className="rules-help-copy">
                    تُحقَن هذه القواعد مباشرة في تعليمات Gemini عند استدعاء {agent.nameAr} كما تُستخدم في التوجيه الذكي التلقائي.
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
                    rows={7}
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
              </div>
            ) : null}

            {activeTab === "skills" ? (
              <div role="tabpanel" id="panel-skills" aria-labelledby="tab-skills" className="modal-tab-panel">
                <section aria-label="مكتبة المهارات المدمجة">
                  <div className="section-heading">
                    <span className="section-kicker">
                      <span className="section-kicker-line" aria-hidden="true" />
                      مكتبة المهارات والأدوات
                    </span>
                    <span className="task-eta">اختر لتثبيت أو إلغاء التثبيت</span>
                  </div>
                  <div className="skills-catalog-grid">
                    {SKILL_CATALOG.map((skill) => {
                      const installed = agent.skills.includes(skill.id);
                      const isGoogleTool = Boolean(skill.toolGroup);
                      return (
                        <div
                          key={skill.id}
                          className="skill-card"
                          data-installed={installed ? "true" : "false"}
                        >
                          <div className="skill-card-head">
                            <div>
                              <span className="skill-category">{skill.categoryAr}</span>
                              <h4>{skill.nameAr}</h4>
                            </div>
                            <button
                              type="button"
                              className="skill-toggle-btn"
                              data-installed={installed ? "true" : "false"}
                              onClick={() => onToggleSkill(agent.id, skill.id)}
                              aria-pressed={installed}
                            >
                              {installed ? (
                                <>
                                  <CheckIcon width={12} height={12} />
                                  <span>مثبّتة</span>
                                </>
                              ) : (
                                <>
                                  <PlusIcon width={12} height={12} />
                                  <span>تثبيت</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="skill-description">{skill.descriptionAr}</p>
                          {isGoogleTool ? (
                            <span
                              className="skill-api-note"
                              data-connected={googleConnected ? "true" : "false"}
                            >
                              {googleConnected
                                ? "متصل بحساب Google الآن"
                                : "يعمل تجريبياً، وللتشغيل الفعلي سجّل بحساب Google"}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {customSkills.length > 0 ? (
                  <section aria-label="المهارات المخصصة المستوردة">
                    <div className="section-heading">
                      <span className="section-kicker">
                        <span className="section-kicker-line" aria-hidden="true" />
                        مهارات مخصّصة مستوردة
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
                      {customSkills.map((cs) => (
                        <div key={cs.id} className="custom-skill-item">
                          <div className="custom-skill-info">
                            <div className="custom-skill-title-row">
                              <strong>{cs.nameAr}</strong>
                              <span className="source-badge">
                                {cs.format === "json" ? "JSON" : "MD"}
                              </span>
                            </div>
                            <p>{cs.descriptionAr}</p>
                          </div>
                          <button
                            type="button"
                            className="custom-skill-delete"
                            onClick={() => onRemoveCustomSkill(agent.id, cs.id)}
                            aria-label={`حذف مهارة ${cs.nameAr}`}
                          >
                            <TrashIcon width={14} height={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

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
                        المهارات المفعّلة:{" "}
                        {agent.skills
                          .map((id) => resolveSkillMeta(id)?.nameAr ?? id)
                          .slice(0, 3)
                          .join("، ")}
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
