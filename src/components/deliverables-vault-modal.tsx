"use client";

import { useEffect, useMemo, useState } from "react";
import type { Agent, DeliverableItem } from "@/data/agents";
import {
  downloadDeliverable,
  copyTextToClipboard,
  deleteDeliverable,
} from "@/lib/vault-storage";
import { playClickSound } from "@/lib/audio-effects";
import AgentPortrait from "@/components/agent-portrait";

interface DeliverablesVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverables: DeliverableItem[];
  onUpdateDeliverables: (updated: DeliverableItem[]) => void;
  agents: Agent[];
}

const TYPE_LABELS: Record<DeliverableItem["type"], { labelAr: string; badgeColor: string }> = {
  report: { labelAr: "تقرير استراتيجي", badgeColor: "#2f80ed" },
  script: { labelAr: "سيناريو / سكريبت", badgeColor: "#9333ea" },
  table: { labelAr: "جدول بيانات", badgeColor: "#16a34a" },
  prompt: { labelAr: "برومبت مرئي", badgeColor: "#eab308" },
  code: { labelAr: "كود / سكريبت", badgeColor: "#06b6d4" },
  plan: { labelAr: "خطة تنفيذية", badgeColor: "#f97316" },
};

export default function DeliverablesVaultModal({
  isOpen,
  onClose,
  deliverables,
  onUpdateDeliverables,
  agents,
}: DeliverablesVaultModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && deliverables.length > 0 && !selectedId) {
      setSelectedId(deliverables[0].id);
    }
  }, [isOpen, deliverables, selectedId]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return deliverables;
    return deliverables.filter((item) => item.type === activeFilter);
  }, [deliverables, activeFilter]);

  const activeItem = useMemo(() => {
    return deliverables.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  }, [deliverables, selectedId, filteredItems]);

  const activeAgent = useMemo(() => {
    if (!activeItem) return null;
    return agents.find((a) => a.id === activeItem.agentId);
  }, [activeItem, agents]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!activeItem) return;
    playClickSound();
    const ok = await copyTextToClipboard(activeItem.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = (id: string) => {
    playClickSound();
    const updated = deleteDeliverable(id);
    onUpdateDeliverables(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id ?? null);
    }
  };

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
    >
      <div className="vault-modal-card pixel-panel">
        {/* Header */}
        <header className="vault-header">
          <div className="vault-header-title">
            <span className="vault-chest-icon">📦</span>
            <div>
              <h2 id="vault-modal-title" className="vault-title-text">
                خزنة المخرجات والأرشيف الذكي
              </h2>
              <span className="vault-title-sub">
                سجل المخرجات المكتملة، التقارير الاستراتيجية، وسيناريوهات المحتوى المعتمدة
              </span>
            </div>
          </div>
          <div className="vault-header-actions">
            <span className="vault-badge-count">{deliverables.length} مخرج محفوظ</span>
            <button
              type="button"
              className="chat-action-btn chat-close-btn pixel-btn"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              aria-label="إغلاق الخزنة"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Categories Bar */}
        <nav className="vault-nav-bar" aria-label="تصفية حسب نوع المخرج">
          {[
            { id: "all", label: "كافة المخرجات" },
            { id: "report", label: "تقارير" },
            { id: "script", label: "سيناريوهات وريلز" },
            { id: "table", label: "جداول وميزانيات" },
            { id: "prompt", label: "برومبتات مرئية" },
            { id: "code", label: "أكواد وأتمتة" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`vault-filter-chip ${activeFilter === cat.id ? "active" : ""}`}
              onClick={() => {
                playClickSound();
                setActiveFilter(cat.id);
              }}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Content Body: Sidebar List + Preview Pane */}
        <div className="vault-body">
          {/* Items Sidebar */}
          <aside className="vault-sidebar">
            {filteredItems.length === 0 ? (
              <div className="vault-empty-list">لا توجد مخرجات محفوظة في هذا التصنيف.</div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === (activeItem?.id ?? "");
                const typeMeta = TYPE_LABELS[item.type] ?? {
                  labelAr: "ملف",
                  badgeColor: "#64748b",
                };
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`vault-item-row ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      playClickSound();
                      setSelectedId(item.id);
                    }}
                  >
                    <div className="vault-row-header">
                      <span
                        className="vault-row-badge"
                        style={{ backgroundColor: typeMeta.badgeColor }}
                      >
                        {typeMeta.labelAr}
                      </span>
                      <time className="vault-row-time">
                        {new Date(item.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <div className="vault-row-title">{item.titleAr}</div>
                    <div className="vault-row-author">
                      بواسطة: {item.agentNameAr} ({item.agentRoleAr})
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          {/* Detailed Preview Pane */}
          <main className="vault-preview-pane">
            {activeItem ? (
              <div className="vault-preview-wrapper">
                <div className="vault-preview-header">
                  <div className="vault-preview-author-block">
                    {activeAgent && (
                      <div className="vault-author-avatar">
                        <AgentPortrait agent={activeAgent} size={40} />
                      </div>
                    )}
                    <div>
                      <h3 className="vault-preview-title">{activeItem.titleAr}</h3>
                      <div className="vault-preview-meta">
                        <span>إعداد الوكيل: {activeItem.agentNameAr}</span>
                        <span>•</span>
                        <span>الدور: {activeItem.agentRoleAr}</span>
                        <span>•</span>
                        <span>
                          {new Date(activeItem.timestamp).toLocaleDateString("ar-SA", {
                            weekday: "long",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Download Buttons */}
                  <div className="vault-preview-actions">
                    <button
                      type="button"
                      className="pixel-btn vault-act-btn"
                      onClick={handleCopy}
                      title="نسخ المحتوى"
                    >
                      {copied ? "تم النسخ ✓" : "نسخ النص"}
                    </button>
                    <button
                      type="button"
                      className="pixel-btn vault-act-btn vault-btn-primary"
                      onClick={() => {
                        playClickSound();
                        downloadDeliverable(activeItem, "md");
                      }}
                      title="تحميل بتنسيق Markdown"
                    >
                      تحميل MD
                    </button>
                    {activeItem.type === "table" && (
                      <button
                        type="button"
                        className="pixel-btn vault-act-btn"
                        onClick={() => {
                          playClickSound();
                          downloadDeliverable(activeItem, "csv");
                        }}
                        title="تحميل بتنسيق CSV"
                      >
                        تحميل CSV
                      </button>
                    )}
                    <button
                      type="button"
                      className="pixel-btn vault-act-btn"
                      onClick={() => {
                        playClickSound();
                        downloadDeliverable(activeItem, "json");
                      }}
                      title="تحميل بتنسيق JSON"
                    >
                      تحميل JSON
                    </button>
                    <button
                      type="button"
                      className="pixel-btn vault-act-btn vault-btn-danger"
                      onClick={() => handleDelete(activeItem.id)}
                      title="حذف هذا المخرج"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                {/* Content Box */}
                <div className="vault-content-box">
                  <pre className="vault-pre-content">{activeItem.content}</pre>
                </div>
              </div>
            ) : (
              <div className="vault-no-selection">اختر مخرجاً من القائمة الجانبية لمعاينته.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
