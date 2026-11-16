"use client";

import { useEffect, useState } from "react";
import type { Agent, DeliverableItem, WarRoomDebateTurn } from "@/data/agents";
import AgentPortrait from "@/components/agent-portrait";
import { playClickSound, playCompleteChime, playAlertBeep, playFlyPacketSound } from "@/lib/audio-effects";
import { addDeliverable } from "@/lib/vault-storage";

interface WarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  onDeliverableCreated: () => void;
}

const PRESET_TOPICS = [
  "خطة مضاعفة مبيعات المتجر الإلكتروني بنسبة 50% خلال الربع القادم",
  "إدارة أزمة تراجع التفاعل على إنستقرام وابتكار صيغ ريلز فيروسية",
  "إطلاق حملة تسويقية لموسم التخفيضات الكبرى وتصميم الهوية البصرية",
];

export default function WarRoomModal({
  isOpen,
  onClose,
  agents,
  onDeliverableCreated,
}: WarRoomModalProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [topic, setTopic] = useState(PRESET_TOPICS[0]);
  const [isDebating, setIsDebating] = useState(false);
  const [turns, setTurns] = useState<WarRoomDebateTurn[]>([]);
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState<number | null>(null);
  const [finalPlan, setFinalPlan] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    if (isOpen && agents.length > 0 && selectedAgentIds.length === 0) {
      // Pick up to 3 initial agents
      setSelectedAgentIds(agents.slice(0, 3).map((a) => a.id));
    }
  }, [isOpen, agents, selectedAgentIds]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDebating) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isDebating]);

  if (!isOpen) return null;

  const toggleAgent = (id: string) => {
    playClickSound();
    if (selectedAgentIds.includes(id)) {
      if (selectedAgentIds.length > 2) {
        setSelectedAgentIds((prev) => prev.filter((aId) => aId !== id));
      }
    } else {
      if (selectedAgentIds.length < 4) {
        setSelectedAgentIds((prev) => [...prev, id]);
      }
    }
  };

  const startDebate = async () => {
    if (!topic.trim() || selectedAgentIds.length < 2) return;
    playAlertBeep();
    setIsDebating(true);
    setTurns([]);
    setFinalPlan(null);
    setIsSynthesizing(false);

    const participatingAgents = agents.filter((a) => selectedAgentIds.includes(a.id));

    // Sequential debate turns
    const generatedTurns: WarRoomDebateTurn[] = [];

    for (let i = 0; i < participatingAgents.length; i++) {
      const currentAgent = participatingAgents[i];
      setActiveSpeakerIndex(i);
      playFlyPacketSound();

      await new Promise((r) => setTimeout(r, 1200));

      let speech = "";
      const role = currentAgent.roleAr;

      if (role.includes("مدير") || currentAgent.id === "gm") {
        speech = `بصفتي ${role}، الهدف الأساسي من هذا الاجتماع هو إيجاد حلول ملموسة لـ «${topic}». يجب أن نركز على العائد الاستثماري وسرعة التنفيذ. استمع لآراء الفريق أولاً.`;
      } else if (role.includes("محلل") || role.includes("حسابات")) {
        speech = `الأرقام والمؤشرات الحالية توضح فجوة أساسية في مرحلة جذب الاهتمام. أقترح تدقيق أوقات الذروة واستهداف الجمهور المتفاعل بين 8 و 10 مساءً مع استبعاد الفئات غير المجدية.`;
      } else if (role.includes("محتوى") || role.includes("سيناريو") || role.includes("ريلز")) {
        speech = `لدينا فرصة ضخمة في مقاطع الريلز القصيرة (Hooks). الحل يكمن في خطافات بصرية جريئة في أول ثانيتين وإشراك الجمهور بسؤال مثير في التعليقات يرفع الحفظ والمشاركة.`;
      } else if (role.includes("مصمم") || role.includes("بوستر") || role.includes("بصرية")) {
        speech = `من الناحية البصرية، الكاروسيل ذو التباين العالي وأغلفة الريلز الموحدة بالهوية ستعطي ثقة فورية وتضاعف نسبة النقر للظهور بنسبة 40% على الأقل.`;
      } else {
        speech = `من جانبي، أقترح خطة عمل مرحلية مقسمة على 3 فترات زمنية، مع متابعة مؤشرات الأداء أسبوعياً واختبار نسختين (A/B Test) لضمان النجاح.`;
      }

      const turn: WarRoomDebateTurn = {
        agentId: currentAgent.id,
        agentNameAr: currentAgent.nameAr,
        agentRoleAr: currentAgent.roleAr,
        speechAr: speech,
        timestamp: Date.now(),
      };

      generatedTurns.push(turn);
      setTurns([...generatedTurns]);
      playClickSound();

      await new Promise((r) => setTimeout(r, 1800));
    }

    setActiveSpeakerIndex(null);
    setIsSynthesizing(true);
    await new Promise((r) => setTimeout(r, 1500));

    // Synthesize final action plan
    const plan = `# خطة عمل مخرجات العصف الذهني — ${topic}

**تاريخ الجلسة:** ${new Date().toLocaleDateString("ar-SA")}
**المشاركون في غرفة العمليات:**
${participatingAgents.map((a) => `- ${a.nameAr} (${a.roleAr})`).join("\n")}

---

## 1. التشخيص والتوصيف المتفق عليه
أجمع أعضاء الاجتماع على أن مواجهة «${topic}» تتطلب تدخلاً متزامناً يجمع بين دقة البيانات التحليلية، قوة خطافات المحتوى، والجاذبية البصرية.

## 2. مصفوفة المهام والمسؤوليات التنفيذية
1. **${participatingAgents[0]?.nameAr ?? "المنسق"}:** الإشراف والمتابعة الاستراتيجية وتحديد الميزانية التشغيلية.
2. **${participatingAgents[1]?.nameAr ?? "الفريق الفني"}:** تدقيق المؤشرات واقتراح نصوص الخطافات المباشرة.
${participatingAgents[2] ? `3. **${participatingAgents[2].nameAr}:** تجهيز النماذج البصرية والقوالب المتطابقة مع الهوية.\n` : ""}
## 3. مؤشرات النجاح المستهدفة (KPIs)
- رفع معدل الوصول والتفاعل بنسبة لا تقل عن 35%.
- تسليم التقارير والتصاميم خلال 5 أيام عمل.`;

    setFinalPlan(plan);
    setIsSynthesizing(false);
    setIsDebating(false);
    playCompleteChime();
  };

  const handleSaveToVault = () => {
    if (!finalPlan) return;
    playClickSound();
    addDeliverable({
      titleAr: `خطة عمل غرفة الاجتماعات — ${topic}`,
      agentId: selectedAgentIds[0] || "gm",
      agentNameAr: "فريق غرفة الاجتماعات",
      agentRoleAr: "جلسة عصف ذهني مشتركة",
      type: "plan",
      format: "markdown",
      summaryAr: `مخرجات جلسة العصف الذهني حول «${topic}» بمشاركة ${selectedAgentIds.length} وكلاء.`,
      content: finalPlan,
    });
    onDeliverableCreated();
    playCompleteChime();
    onClose();
  };

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDebating) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="war-room-title"
    >
      <div className="vault-modal-card pixel-panel" style={{ maxWidth: 860, maxHeight: "90vh" }}>
        {/* Header */}
        <header className="vault-header" style={{ backgroundColor: "#451a03" }}>
          <div className="vault-header-title">
            <span className="vault-chest-icon">⚔️</span>
            <div>
              <h2 id="war-room-title" className="vault-title-text" style={{ color: "#fef08a" }}>
                غرفة العمليات المشتركة والعصف الذهني (War Room)
              </h2>
              <span className="vault-title-sub">
                حوار ونقاش متسلسل بين نخبة من الوكلاء للخروج بخطة عمل استراتيجية موحدة
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
            disabled={isDebating}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </header>

        <div className="vault-content-box" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Agent Selection & Topic Box */}
          <div className="war-room-setup-card">
            <label className="settings-label">
              1. اختر الوكلاء المشاركين في الجلسة (2 إلى 4 وكلاء):
            </label>
            <div className="war-room-agents-grid">
              {agents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={`war-agent-card ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleAgent(agent.id)}
                    disabled={isDebating}
                  >
                    <div style={{ width: 34, height: 34, flexShrink: 0 }}>
                      <AgentPortrait agent={agent} size={34} />
                    </div>
                    <div style={{ textAlign: "start" }}>
                      <div className="war-agent-name">{agent.nameAr}</div>
                      <div className="war-agent-role">{agent.roleAr}</div>
                    </div>
                    {isSelected && <span className="war-agent-check">✓</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="settings-label">2. موضوع النقاش والتحدي المطروح:</label>
              <input
                type="text"
                className="settings-pixel-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isDebating}
                placeholder="اكتب التحدي أو المشكلة التي تريد من الفريق حلها..."
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {PRESET_TOPICS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-chip pixel-btn"
                    onClick={() => setTopic(preset)}
                    disabled={isDebating}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="pixel-btn vault-act-btn vault-btn-primary"
                style={{ height: 30, padding: "0 16px", fontSize: 12 }}
                onClick={startDebate}
                disabled={isDebating || selectedAgentIds.length < 2 || !topic.trim()}
              >
                {isDebating ? "جارٍ الحوار والنقاش..." : "⚔️ بدء جلسة العصف الذهني الآن"}
              </button>
            </div>
          </div>

          {/* Virtual Meeting Table Visual */}
          <div className="war-meeting-stage">
            <div className="war-table-round">
              <span>طاولة الاجتماع الاستراتيجي</span>
            </div>

            {selectedAgentIds.map((agentId, idx) => {
              const agent = agents.find((a) => a.id === agentId);
              if (!agent) return null;
              const isSpeaking = activeSpeakerIndex === idx;
              return (
                <div
                  key={agentId}
                  className={`war-seat war-seat-${idx} ${isSpeaking ? "speaking" : ""}`}
                >
                  <div style={{ width: 44, height: 44 }}>
                    <AgentPortrait agent={agent} size={44} />
                  </div>
                  <span className="war-seat-name">{agent.nameAr}</span>
                  {isSpeaking && <span className="war-speaking-glow">يتحدث الآن...</span>}
                </div>
              );
            })}
          </div>

          {/* Dialogue Turns Stream */}
          <div className="war-turns-stream">
            {turns.length === 0 && !isDebating && (
              <div className="war-empty-state">
                اختر الوكلاء والموضوع واضغط «بدء جلسة العصف الذهني» لبدء النقاش المشترك.
              </div>
            )}

            {turns.map((turn, index) => {
              const speaker = agents.find((a) => a.id === turn.agentId);
              return (
                <div key={index} className="war-turn-bubble">
                  {speaker && (
                    <div style={{ width: 36, height: 36, flexShrink: 0 }}>
                      <AgentPortrait agent={speaker} size={36} />
                    </div>
                  )}
                  <div className="war-bubble-content">
                    <div className="war-bubble-header">
                      <strong>{turn.agentNameAr}</strong>
                      <span>({turn.agentRoleAr})</span>
                    </div>
                    <p className="war-bubble-text">{turn.speechAr}</p>
                  </div>
                </div>
              );
            })}

            {isSynthesizing && (
              <div className="war-synthesizing-box">
                <span className="sparkle-anim">✨</span>
                <span>جارٍ تلخيص آراء الفريق وصياغة خطة العمل النهائية...</span>
              </div>
            )}

            {finalPlan && (
              <div className="war-final-plan-box">
                <div className="war-plan-header">
                  <h4>خطة العمل المعتمدة من الجلسة ✓</h4>
                  <button
                    type="button"
                    className="pixel-btn vault-act-btn vault-btn-primary"
                    onClick={handleSaveToVault}
                  >
                    📦 اعتماد وحفظ الخطة في الخزنة
                  </button>
                </div>
                <pre className="vault-pre-content">{finalPlan}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
