"use client";

import { useEffect, useState } from "react";
import type { FurnitureStyle, Room, RoomBlueprint, Agent } from "@/data/agents";
import { CATALOG_SKILLS, type SkillDefinition } from "@/data/skills";
import { playClickSound, playCompleteChime } from "@/lib/audio-effects";
import { SparkleIcon } from "@/components/icons";

interface RoomSettingsModalProps {
  room: Room | null;
  roomAgents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  onSaveRoom: (updatedRoom: Room) => void;
  onImportBlueprint?: (blueprint: RoomBlueprint) => void;
}

export default function RoomSettingsModal({
  room,
  roomAgents,
  isOpen,
  onClose,
  onSaveRoom,
  onImportBlueprint,
}: RoomSettingsModalProps) {
  const [nameAr, setNameAr] = useState("");
  const [shortNameAr, setShortNameAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [rules, setRules] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [peerReview, setPeerReview] = useState(false);
  const [furnitureStyle, setFurnitureStyle] = useState<FurnitureStyle>("creative");
  const [optimizing, setOptimizing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    setNameAr(room.nameAr);
    setShortNameAr(room.shortNameAr);
    setDescriptionAr(room.descriptionAr);
    setRules(room.rules ?? "");
    setSkills(room.skills ? [...room.skills] : []);
    setPeerReview(Boolean(room.peerReviewEnabled));
    setFurnitureStyle(room.furnitureStyle);
  }, [room]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !room) return null;

  const handleToggleSkill = (skillId: string) => {
    playClickSound();
    setSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId],
    );
  };

  const handleOptimizeRule = async () => {
    if (!rules.trim()) return;
    playClickSound();
    setOptimizing(true);
    setNotice("جارٍ استدعاء مساعد تحسين القواعد الذكي...");
    try {
      const res = await fetch("/api/optimize-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: rules,
          scope: "room",
          contextTitle: nameAr,
        }),
      });
      const data = await res.json();
      if (data.ok && data.optimizedRule) {
        setRules(data.optimizedRule);
        playCompleteChime();
        setNotice(`تم تحسين وضبط قواعد القسم بنجاح (${data.source === "gemini" ? "Gemini AI" : "محرك القواعد الذكي"}).`);
      } else {
        setNotice(data.error || "تعذّر تحسين القاعدة.");
      }
    } catch {
      setNotice("تعذّر الاتصال بمحرك التحسين.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleExportBlueprint = () => {
    playClickSound();
    const blueprint: RoomBlueprint = {
      version: "1.0",
      nameAr,
      exportedAt: Date.now(),
      room: {
        ...room,
        nameAr,
        shortNameAr,
        descriptionAr,
        rules,
        skills,
        peerReviewEnabled: peerReview,
        furnitureStyle,
      },
      agents: roomAgents,
    };
    const blob = new Blob([JSON.stringify(blueprint, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-blueprint-${room.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("تم تصدير قالب القسم بصيغة JSON بنجاح.");
  };

  const handleImportBlueprintFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as RoomBlueprint;
        if (parsed.room) {
          setNameAr(parsed.room.nameAr || nameAr);
          setShortNameAr(parsed.room.shortNameAr || shortNameAr);
          setDescriptionAr(parsed.room.descriptionAr || descriptionAr);
          setRules(parsed.room.rules || "");
          setSkills(parsed.room.skills || []);
          setPeerReview(Boolean(parsed.room.peerReviewEnabled));
          setFurnitureStyle(parsed.room.furnitureStyle || furnitureStyle);
          onImportBlueprint?.(parsed);
          playCompleteChime();
          setNotice("تم استيراد وتطبيق قالب القسم بنجاح.");
        }
      } catch {
        setNotice("ملف القالب غير صالح.");
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    playClickSound();
    onSaveRoom({
      ...room,
      nameAr,
      shortNameAr,
      descriptionAr,
      rules,
      skills,
      peerReviewEnabled: peerReview,
      furnitureStyle,
    });
    onClose();
  };

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-settings-title"
    >
      <div className="vault-modal-card pixel-panel" style={{ maxWidth: 720 }}>
        {/* Header */}
        <header className="vault-header">
          <div className="vault-header-title">
            <span className="vault-chest-icon">🚪</span>
            <div>
              <h2 id="room-settings-title" className="vault-title-text">
                إعدادات القسم وقواعد الغرفة · {room.shortNameAr}
              </h2>
              <span className="vault-title-sub">
                تحديد القواعد الموروثة لكافة أعضاء الغرفة وإدارة قوالب القسم
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

        {/* Notice alert if any */}
        {notice && (
          <div className="room-settings-notice">
            <span>{notice}</span>
          </div>
        )}

        {/* Body Form */}
        <div className="vault-content-box" style={{ padding: 16 }}>
          <div className="settings-field-group">
            <div className="settings-row-split">
              <div className="settings-field">
                <label className="settings-label">اسم الغرفة الكامل:</label>
                <input
                  type="text"
                  className="settings-pixel-input"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">الاسم المختصر على اللافتة:</label>
                <input
                  type="text"
                  className="settings-pixel-input"
                  value={shortNameAr}
                  onChange={(e) => setShortNameAr(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-field" style={{ marginTop: 10 }}>
              <label className="settings-label">وصف القسم والدور العام:</label>
              <input
                type="text"
                className="settings-pixel-input"
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
              />
            </div>

            {/* 3-Tier Rules Engine: Room Scope */}
            <div className="settings-field" style={{ marginTop: 14 }}>
              <div className="settings-field-header">
                <label className="settings-label">
                  قواعد القسم الموروثة [خاص بالغرفة 🚪]:
                  <span className="settings-label-sub">
                    (تُحقن تلقائياً في تعليمات كافة وكلاء هذا القسم فوق قواعدهم الفردية)
                  </span>
                </label>
                <button
                  type="button"
                  className="pixel-btn ai-opt-btn"
                  onClick={handleOptimizeRule}
                  disabled={optimizing || !rules.trim()}
                  title="تحسين مسودة القاعدة وصياغتها باحترافية عبر الذكاء الاصطناعي"
                >
                  <SparkleIcon width={12} height={12} />
                  <span>{optimizing ? "جارٍ التحسين..." : "✨ تحسين القاعدة الذكي"}</span>
                </button>
              </div>
              <textarea
                className="settings-pixel-textarea"
                rows={4}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="اكتب القواعد الإلزامية المشتركة لكافة أعضاء الغرفة (مثال: الالتزام بالدليل البصري للشركة، تسليم المخرجات في غضون 24 ساعة...)"
              />
            </div>

            {/* Inherited Room Skills */}
            <div className="settings-field" style={{ marginTop: 14 }}>
              <label className="settings-label">
                المهارات الموروثة للغرفة [مهارات القسم ⚙]:
              </label>
              <div className="room-skills-chips-grid">
                {CATALOG_SKILLS.slice(0, 8).map((cat: SkillDefinition) => {
                  const active = skills.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`room-skill-pill ${active ? "active" : ""}`}
                      onClick={() => handleToggleSkill(cat.id)}
                    >
                      <span className="skill-dot-led" />
                      <span>{cat.nameAr}</span>
                      {active && <span className="skill-check-mark">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Governance & Peer Review */}
            <div className="peer-review-toggle-box" style={{ marginTop: 14 }}>
              <div>
                <strong style={{ fontSize: 12, color: "#241407" }}>
                  بوابة الاعتماد والمراجعة الزميلة (Peer Review Gate)
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#64533e" }}>
                  إلزام مخرجات وكلاء هذا القسم بمراجعة وتوقيع المدير العام قبل الاعتماد النهائي في الخزنة.
                </p>
              </div>
              <button
                type="button"
                className={`pixel-btn ${peerReview ? "vault-btn-primary" : ""}`}
                onClick={() => {
                  playClickSound();
                  setPeerReview(!peerReview);
                }}
              >
                {peerReview ? "المراجعة مفعّلة ✓" : "تفعيل المراجعة"}
              </button>
            </div>

            {/* Blueprints Export / Import */}
            <div className="blueprint-box" style={{ marginTop: 14 }}>
              <div>
                <strong style={{ fontSize: 12, color: "#241407" }}>
                  تصدير واستيراد قوالب القسم (Blueprints)
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#64533e" }}>
                  حفظ إعدادات الغرفة ووكلائها بالكامل كملف JSON مستقل، أو تحميل قالب محفوظ مسبقاً.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="pixel-btn vault-act-btn"
                  onClick={handleExportBlueprint}
                >
                  📥 تصدير القالب (JSON)
                </button>
                <label className="pixel-btn vault-act-btn" style={{ cursor: "pointer" }}>
                  📤 استيراد قالب
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBlueprintFile}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="vault-header" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="pixel-btn vault-act-btn"
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="pixel-btn vault-act-btn vault-btn-primary"
            onClick={handleSave}
          >
            حفظ إعدادات القسم ✓
          </button>
        </footer>
      </div>
    </div>
  );
}
