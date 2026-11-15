"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_META, type Agent, type QuickAction, type Room } from "@/data/agents";
import AgentPortrait from "@/components/agent-portrait";
import {
  AlertIcon,
  ArrowUpLeftIcon,
  BoltIcon,
  CheckIcon,
  CloseIcon,
  MapPinIcon,
  SparklesIcon,
  TargetIcon,
} from "@/components/icons";

interface AgentModalProps {
  agent: Agent;
  room: Room;
  roomAgents: Agent[];
  onSelectAgent: (agentId: Agent["id"]) => void;
  onClose: () => void;
  onRunAction: (agentId: Agent["id"], action: QuickAction) => void;
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

export default function AgentModal({
  agent,
  room,
  roomAgents,
  onSelectAgent,
  onClose,
  onRunAction,
}: AgentModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const progress = useLiveProgress(agent);
  const meta = STATUS_META[agent.status];
  const task = agent.activeTask;

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
              <AgentPortrait agent={agent} size={112} />
              <span className="portrait-scanline" aria-hidden="true" />
            </div>
            <span
              className="status-badge status-badge-lg"
              data-status={agent.status}
              style={{ "--status-dot": meta.dot, "--status-soft": meta.soft, "--status-ink": meta.text } as React.CSSProperties}
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
                <dt>المحطة</dt>
                <dd>{agent.stationAr}</dd>
              </div>
              <div>
                <dt>آخر نشاط</dt>
                <dd>قبل قليل</dd>
              </div>
            </dl>
          </aside>

          <div className="agent-modal-main">
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
                      {agent.status === "working" ? "تنفيذ مباشر" : "جاهز للأمر التالي"}
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
                <span className="action-count">3 أدوات</span>
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
                  <li key={completed.id}>
                    <span className="completed-marker">
                      <CheckIcon width={11} height={11} />
                    </span>
                    <span className="completed-title">{completed.titleAr}</span>
                    <span className="completed-time">{completed.timeAr}</span>
                    {index === 0 ? <span className="completed-new">جديد</span> : null}
                  </li>
                ))}
              </ol>
            </section>

            <footer className="agent-modal-footer">
              <span className="runtime-note">
                <span className="runtime-dot" />
                محرك محلي · جاهز للربط مع Gmail و Google Sheets
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
