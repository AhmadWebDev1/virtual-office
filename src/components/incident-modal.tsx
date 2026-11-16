"use client";

import { useEffect, useState } from "react";
import type { EscalationTicket, Agent } from "@/data/agents";
import AgentPortrait from "@/components/agent-portrait";
import { playClickSound, playCompleteChime, playAlertBeep } from "@/lib/audio-effects";

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: EscalationTicket[];
  agents: Agent[];
  onResolveTicket: (ticketId: string, actionNote: string) => void;
  onReassignTask: (ticketId: string, newAgentId: string) => void;
}

export default function IncidentModal({
  isOpen,
  onClose,
  tickets,
  agents,
  onResolveTicket,
  onReassignTask,
}: IncidentModalProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tickets.length > 0 && !selectedTicketId) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [isOpen, tickets, selectedTicketId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTicket = tickets.find((t) => t.id === selectedTicketId) ?? tickets[0] ?? null;
  const targetAgent = activeTicket ? agents.find((a) => a.id === activeTicket.agentId) : null;

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
    >
      <div className="vault-modal-card pixel-panel" style={{ maxWidth: 820 }}>
        {/* Header */}
        <header className="vault-header" style={{ backgroundColor: "#7f1d1d" }}>
          <div className="vault-header-title">
            <span className="vault-chest-icon">🚨</span>
            <div>
              <h2 id="incident-modal-title" className="vault-title-text" style={{ color: "#fecaca" }}>
                نظام الأزمات وتذاكر التصعيد الإداري (Incident & Escalation Gate)
              </h2>
              <span className="vault-title-sub">
                متابعة الأعطال وتكرار إخفاق الوكلاء واتخاذ قرارات التدخل الإداري السريع
              </span>
            </div>
          </div>
          <button
            type="button"
            className="chat-action-btn chat-close-btn pixel-btn"
            onClick={() => {
              playClickSound();
              onClose();
            }}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </header>

        <div className="vault-body">
          {/* Sidebar */}
          <aside className="vault-sidebar" style={{ width: 280 }}>
            {tickets.length === 0 ? (
              <div className="vault-empty-list" style={{ color: "#15803d" }}>
                لا توجد تذاكر تصعيد نشطة حالياً. جميع الوكلاء يعملون بكفاءة عالية! ✓
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = t.id === activeTicket?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`vault-item-row ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      playClickSound();
                      setSelectedTicketId(t.id);
                    }}
                  >
                    <div className="vault-row-header">
                      <span className="vault-row-badge" style={{ backgroundColor: "#dc2626" }}>
                        تصعيد طارئ 🚨
                      </span>
                      <time className="vault-row-time">
                        {new Date(t.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <div className="vault-row-title">{t.errorDescriptionAr}</div>
                    <div className="vault-row-author">المعني: {t.agentNameAr}</div>
                  </button>
                );
              })
            )}
          </aside>

          {/* Details Pane */}
          <main className="vault-preview-pane">
            {activeTicket ? (
              <div className="vault-preview-wrapper">
                <div className="vault-preview-header">
                  <div className="vault-preview-author-block">
                    {targetAgent && (
                      <div className="vault-author-avatar">
                        <AgentPortrait agent={targetAgent} size={40} />
                      </div>
                    )}
                    <div>
                      <h3 className="vault-preview-title" style={{ color: "#991b1b" }}>
                        تذكرة تصعيد رقم #{activeTicket.id}
                      </h3>
                      <div className="vault-preview-meta">
                        <span>الوكيل: {activeTicket.agentNameAr}</span>
                        <span>•</span>
                        <span>
                          {new Date(activeTicket.timestamp).toLocaleString("ar-SA")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnostics Box */}
                <div className="vault-content-box" style={{ marginBottom: 12, borderInlineStart: "4px solid #dc2626" }}>
                  <h4 style={{ margin: "0 0 6px 0", color: "#7f1d1d", fontSize: 13, fontWeight: 900 }}>
                    تفاصيل الخطأ والتشخيص الإداري للمدير العام:
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#241407" }}>
                    {activeTicket.errorDescriptionAr}
                  </p>
                  <p style={{ margin: "8px 0 0 0", fontSize: 11.5, color: "#64533e", fontStyle: "italic" }}>
                    {activeTicket.diagnosisAr || "التشخيص: تكرار الفشل 3 مرات متتالية، تم تعليق مهام الوكيل مؤقتاً لحماية سلامة البيانات ومنع استهلاك التوكنات دون جدوى."}
                  </p>
                </div>

                {/* Resolution Actions */}
                <div className="incident-actions-box">
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#241407" }}>
                    إجراءات المعالجة والتعافي:
                  </span>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="pixel-btn vault-act-btn vault-btn-primary"
                      onClick={() => {
                        playClickSound();
                        onResolveTicket(activeTicket.id, "إعادة تعيين ومسح عداد الإخفاق");
                        playCompleteChime();
                      }}
                    >
                      ✓ تشخيص وتصفير عداد الأخطاء واستئناف العمل
                    </button>
                    {agents.filter((a) => a.id !== activeTicket.agentId).length > 0 && (
                      <button
                        type="button"
                        className="pixel-btn vault-act-btn"
                        onClick={() => {
                          const backup = agents.find((a) => a.id !== activeTicket.agentId);
                          if (backup) {
                            playClickSound();
                            onReassignTask(activeTicket.id, backup.id);
                            playCompleteChime();
                          }
                        }}
                      >
                        🔄 تفويض المهمة لوكيل بديل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="vault-no-selection">
                لا توجد أي أزمات حالياً. كافة العمليات مستقرة.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
