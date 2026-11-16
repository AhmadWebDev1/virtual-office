"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { STATUS_META, type Agent, type AgentId, type Room } from "@/data/agents";
import type { CommandTarget } from "@/lib/agent-contracts";
import AgentPortrait from "@/components/agent-portrait";
import {
  ChatPixelIcon,
  CrownIcon,
  FullscreenIcon,
  MinimizeIcon,
  RouteIcon,
  SendIcon,
  TrashIcon,
} from "@/components/icons";
import { playClickSound, playCompleteChime } from "@/lib/audio-effects";

export interface ChatMessage {
  id: string;
  sender: "user" | "agent" | "system";
  target?: CommandTarget;
  agentId?: AgentId;
  agentName?: string;
  agentRole?: string;
  text: string;
  timestamp: string;
  taskTitle?: string;
  status?: "pending" | "done" | "error";
  receipt?: string;
  rating?: "up" | "down";
  feedbackCritique?: string;
}

interface AgentChatModalProps {
  agents: Agent[];
  rooms: Room[];
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (
    target: CommandTarget,
    message: string,
  ) => Promise<{
    ok: boolean;
    agentId?: AgentId;
    startAr?: string;
    logAr?: string;
    completionAr?: string;
    error?: string;
  }>;
  sending: boolean;
  onAgentFeedback?: (
    agentId: AgentId,
    messageText: string,
    critique: string,
    rating: "up" | "down",
  ) => void;
}

const DEFAULT_PROMPTS: Record<string, string[]> = {
  auto: [
    "ما هي خطة النشر المقترحة لهذا الأسبوع؟",
    "حلل حساب الإنستغرام واقترح استراتيجية محتوى",
    "أعطني تقريراً عن حالة مهام المكتب الحالية",
  ],
  gm: [
    "ما هو ملخص سير العمل اليوم؟",
    "وزع مهام التسويق الرقمي على الفريق",
    "راجع التزام الوكلاء بالقواعد المحددة",
  ],
  "agent-marketing-analyst": [
    "حلل أداء الحساب ومعدل التفاعل الحالي",
    "ما هي أفضل أوقات النشر المقترحة؟",
    "كيف نرفع معدل حفظ ومشاركة المنشورات؟",
  ],
  "agent-marketing-reels": [
    "اقترح 3 أفكار ريلز تفاعلية وجذابة",
    "اكتب هوك (Hook) قوي لفيديو قادم",
    "كيف نحسن مدة المشاهدة في المقاطع القصيرة؟",
  ],
  "agent-marketing-designer": [
    "اقترح لوحة ألوان عصرية للحملة القادمة",
    "ما هي مواصفات وتنسيقات البوستات المقترحة؟",
    "صمم فكرة بوست تفاعلي من عدة شرائح",
  ],
};

function formatTime(): string {
  return new Date().toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AgentChatModal({
  agents,
  rooms,
  isOpen,
  onClose,
  onSendMessage,
  sending,
  onAgentFeedback,
}: AgentChatModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<CommandTarget>("auto");
  const [inputMessage, setInputMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [critiqueActiveId, setCritiqueActiveId] = useState<string | null>(null);
  const [critiqueText, setCritiqueText] = useState("");

  const handleRateMessage = (
    msgId: string,
    agentId: string,
    messageText: string,
    rating: "up" | "down",
    critique = "",
  ) => {
    playClickSound();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, rating, feedbackCritique: critique } : m,
      ),
    );
    if (rating === "down") {
      setCritiqueActiveId(null);
      setCritiqueText("");
      playCompleteChime();
    }
    onAgentFeedback?.(agentId, messageText, critique, rating);
  };
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "init-welcome",
      sender: "system",
      text: "مرحباً بك في غرفة عمليات وتواصل الوكلاء. يمكنك التحدث مباشرة مع أي وكيل أو توجيه الفريق كاملاً لتنفيذ المهام ومتابعة سير العمل.",
      timestamp: "الآن",
    },
    {
      id: "init-gm",
      sender: "agent",
      agentId: "gm",
      agentName: "سلمان العتيبي",
      agentRole: "المدير العام",
      text: "أهلاً بك! بصفتي المدير العام، أنا جاهز لتلقي توجيهاتك، تفويض المهام لوكلاء التسويق، أو مراجعة خطط الأداء.",
      timestamp: "الآن",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, sending]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeAgent = useMemo(
    () => (selectedTarget === "auto" ? null : agents.find((a) => a.id === selectedTarget)),
    [agents, selectedTarget],
  );

  const activeRoom = useMemo(() => {
    if (!activeAgent) return null;
    return rooms.find((r) => r.id === activeAgent.roomId) ?? null;
  }, [activeAgent, rooms]);

  const currentPrompts = useMemo(() => {
    if (selectedTarget === "auto") return DEFAULT_PROMPTS.auto;
    return DEFAULT_PROMPTS[selectedTarget] ?? [
      `أصدر تكليفاً سريعاً لـ ${activeAgent?.nameAr ?? "الوكيل"}`,
      `استعلم عن أولويات العمل`,
      `طلب تقرير مفصل`,
    ];
  }, [selectedTarget, activeAgent]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || sending) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      target: selectedTarget,
      text,
      timestamp: formatTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    try {
      const result = await onSendMessage(selectedTarget, text);
      if (result.ok) {
        const respondingAgentId = result.agentId ?? (selectedTarget === "auto" ? "gm" : selectedTarget);
        const agent = agents.find((a) => a.id === respondingAgentId);
        const replyText = result.logAr || result.startAr || "تم استلام التوجيه وتنفيذه.";

        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: "agent",
          agentId: respondingAgentId,
          agentName: agent?.nameAr ?? "الوكيل",
          agentRole: agent?.roleAr ?? "فريق العمل",
          text: replyText,
          timestamp: formatTime(),
          taskTitle: result.startAr,
          status: "done",
        };

        setMessages((prev) => [...prev, agentMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          sender: "system",
          text: result.error ?? "تعذّر وصول الرسالة للوكيل. يرجى المحاولة مرة أخرى.",
          timestamp: formatTime(),
          status: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: "system",
        text: "حدث خطأ غير متوقع أثناء إرسال الرسالة.",
        timestamp: formatTime(),
        status: "error",
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleHorizontalWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (event.deltaY !== 0) {
      event.currentTarget.scrollLeft += event.deltaY;
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `clear-${Date.now()}`,
        sender: "system",
        text: "تم مسح سجل المحادثة الحالي.",
        timestamp: formatTime(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <aside
      className={`agent-chat-window ${isExpanded ? "expanded" : ""}`}
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        bottom: 14,
        zIndex: 95,
      }}
      role="complementary"
      aria-labelledby="agent-chat-title"
    >
        {/* Header */}
        <header className="chat-window-header">
          <div className="chat-header-title">
            <span className="chat-header-icon" aria-hidden="true">
              <ChatPixelIcon width={16} height={16} />
            </span>
            <div>
              <h2 id="agent-chat-title" className="chat-title-text">
                محادثة الوكلاء الافتراضيين
              </h2>
              <span className="chat-title-sub">
                {activeAgent
                  ? `${activeAgent.nameAr} · ${activeAgent.roleAr}`
                  : "قناة التواصل العام · التوجيه الذكي"}
              </span>
            </div>
          </div>

          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-action-btn pixel-btn"
              onClick={clearChat}
              title="مسح سجل المحادثة"
              aria-label="مسح سجل المحادثة"
            >
              <TrashIcon width={13} height={13} />
            </button>
            <button
              type="button"
              className="chat-action-btn pixel-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? "تصغير النافذة" : "تكبير النافذة"}
              aria-label={isExpanded ? "تصغير النافذة" : "تكبير النافذة"}
            >
              {isExpanded ? (
                <MinimizeIcon width={13} height={13} />
              ) : (
                <FullscreenIcon width={13} height={13} />
              )}
            </button>
            <button
              type="button"
              className="chat-action-btn chat-close-btn pixel-btn"
              onClick={onClose}
              title="إغلاق المحادثة"
              aria-label="إغلاق المحادثة"
            >
              ×
            </button>
          </div>
        </header>

        {/* Target Agent Selector Bar */}
        <nav
          className="chat-agent-nav"
          aria-label="اختيار الوكيل المستلم"
          onWheel={handleHorizontalWheel}
        >
          <button
            type="button"
            className={`chat-target-chip ${selectedTarget === "auto" ? "active" : ""}`}
            onClick={() => setSelectedTarget("auto")}
          >
            <RouteIcon width={12} height={12} />
            <span>الفريق كاملاً</span>
          </button>

          {agents.map((agent) => {
            const meta = STATUS_META[agent.status];
            const isSelected = selectedTarget === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                className={`chat-target-chip ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedTarget(agent.id)}
              >
                <span
                  className="chat-chip-dot"
                  style={{ backgroundColor: meta.dot }}
                  aria-hidden="true"
                />
                <span>{agent.nameAr}</span>
              </button>
            );
          })}
        </nav>

        {/* Message Stream */}
        <div className="chat-messages-stream" role="log" aria-live="polite">
          {messages.map((msg) => {
            if (msg.sender === "system") {
              return (
                <div key={msg.id} className="chat-msg chat-msg-system">
                  <span className="chat-system-badge">نظام المكتب</span>
                  <p className="chat-system-text">{msg.text}</p>
                  <time className="chat-msg-time">{msg.timestamp}</time>
                </div>
              );
            }

            if (msg.sender === "user") {
              const targetName =
                msg.target === "auto"
                  ? "الفريق كاملاً"
                  : agents.find((a) => a.id === msg.target)?.nameAr ?? "الوكيل";

              return (
                <div key={msg.id} className="chat-msg chat-msg-user">
                  <div className="chat-bubble chat-bubble-user">
                    <div className="chat-msg-header">
                      <span className="chat-sender-tag">أنت</span>
                      <span className="chat-target-arrow">موجه إلى: {targetName}</span>
                    </div>
                    <p className="chat-msg-body">{msg.text}</p>
                    <time className="chat-msg-time">{msg.timestamp}</time>
                  </div>
                </div>
              );
            }

            // Agent response
            const agent = agents.find((a) => a.id === msg.agentId);

            return (
              <div key={msg.id} className="chat-msg chat-msg-agent">
                <div className="chat-agent-avatar-col" aria-hidden="true">
                  {agent ? (
                    <div className="chat-portrait-box">
                      <AgentPortrait agent={agent} size={36} />
                    </div>
                  ) : (
                    <div className="chat-portrait-box">
                      <CrownIcon width={24} height={24} />
                    </div>
                  )}
                </div>

                <div className="chat-bubble chat-bubble-agent">
                  <div className="chat-msg-header">
                    <span className="chat-agent-name">{msg.agentName ?? "الوكيل"}</span>
                    <span className="chat-agent-role">{msg.agentRole}</span>
                  </div>

                  <p className="chat-msg-body">{msg.text}</p>

                  {msg.taskTitle ? (
                    <div className="chat-task-receipt">
                      <span className="chat-receipt-icon">✓</span>
                      <span className="chat-receipt-text">{msg.taskTitle}</span>
                    </div>
                  ) : null}

                  <time className="chat-msg-time">{msg.timestamp}</time>

                  {/* Feedback & Self-Evolution Rating Buttons */}
                  {msg.agentId && (
                    <div className="chat-msg-feedback-row">
                      {msg.rating === "up" ? (
                        <span className="feedback-rated-badge up">
                          👍 ممتاز (تم تسجيل التقييم الإيجابي)
                        </span>
                      ) : msg.rating === "down" ? (
                        <span className="feedback-rated-badge down">
                          🧠 تم رفع الملاحظة للمدير العام وتحديث القواعد
                        </span>
                      ) : (
                        <div className="feedback-buttons-wrap">
                          <button
                            type="button"
                            className="pixel-btn feedback-rate-btn up"
                            onClick={() => handleRateMessage(msg.id, msg.agentId!, msg.text, "up")}
                            title="تقييم إيجابي ممتاز"
                          >
                            <span>👍 ممتاز</span>
                          </button>
                          <button
                            type="button"
                            className="pixel-btn feedback-rate-btn down"
                            onClick={() => setCritiqueActiveId(critiqueActiveId === msg.id ? null : msg.id)}
                            title="طلب تحسين ورفع ملاحظة للمدير العام"
                          >
                            <span>👎 تحسين</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline critique form when 👎 تحسين is clicked */}
                  {critiqueActiveId === msg.id && (
                    <div className="inline-critique-box">
                      <span className="critique-prompt-label">
                        ما الذي يجب على الوكيل تحسينه؟ (سيقوم المدير العام بإعادة صياغة قواعده):
                      </span>
                      <div className="critique-input-row">
                        <input
                          type="text"
                          className="settings-pixel-input"
                          placeholder="مثال: الرد طويل جداً، أو نسيت إدراج الجدول..."
                          value={critiqueText}
                          onChange={(e) => setCritiqueText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && critiqueText.trim()) {
                              handleRateMessage(msg.id, msg.agentId!, msg.text, "down", critiqueText);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="pixel-btn confirm-btn-primary"
                          disabled={!critiqueText.trim()}
                          onClick={() => handleRateMessage(msg.id, msg.agentId!, msg.text, "down", critiqueText)}
                        >
                          تطوير الوكيل 🧠
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending ? (
            <div className="chat-msg chat-msg-agent chat-msg-typing">
              <div className="chat-agent-avatar-col" aria-hidden="true">
                {activeAgent ? (
                  <div className="chat-portrait-box">
                    <AgentPortrait agent={activeAgent} size={36} />
                  </div>
                ) : (
                  <div className="chat-portrait-box">
                    <CrownIcon width={24} height={24} />
                  </div>
                )}
              </div>
              <div className="chat-bubble chat-bubble-agent">
                <div className="chat-typing-indicator">
                  <span>جارٍ التفكير والتحليل</span>
                  <span className="chat-typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="chat-prompts-bar">
          <span className="chat-prompts-label">مقترحات:</span>
          <div className="chat-prompts-list" onWheel={handleHorizontalWheel}>
            {currentPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="chat-prompt-chip"
                onClick={() => void handleSend(prompt)}
                disabled={sending}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <footer className="chat-input-area">
          <form
            className="chat-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              رسالتك إلى {activeAgent?.nameAr ?? "فريق الوكلاء"}
            </label>
            <textarea
              ref={inputRef}
              id={inputId}
              rows={1}
              className="chat-textarea"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`اكتب رسالتك لـ ${activeAgent?.nameAr ?? "فريق الوكلاء"}... (Enter للإرسال)`}
              disabled={sending}
            />

            <button
              type="submit"
              className="chat-send-btn pixel-btn"
              disabled={!inputMessage.trim() || sending}
              aria-label="إرسال الرسالة"
            >
              <SendIcon width={16} height={16} />
              <span>إرسال</span>
            </button>
          </form>
        </footer>
      </aside>
  );
}
