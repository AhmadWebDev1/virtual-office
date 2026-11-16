"use client";

import { useEffect, useState } from "react";
import { playClickSound, playCompleteChime, playAlertBeep, playFlyPacketSound } from "@/lib/audio-effects";
import { copyTextToClipboard } from "@/lib/vault-storage";

interface ReceptionDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateIncomingEvent: (sender: string, subject: string, message: string) => void;
}

const PRESET_INCOMING = [
  {
    sender: "شركة قمم الرياض للمقاولات",
    subject: "طلب تسعيرة لحملة تدشين فرع جديد",
    message: "مرحباً، نرغب في إطلاق حملة تسويقية متكاملة تشمل تصاميم بوسترات وسيناريوهات ريلز وميزانية تقريبية.",
  },
  {
    sender: "نظام الفواتير السحابي (Cloud Invoicing)",
    subject: "إشعار فاتورة توريد سيرفرات جديدة #INV-8821",
    message: "تم إصدار فاتورة بمبلغ 4,500 ريال لتجديد خوادم الاستضافة. يرجى مراجعتها وتسجيلها في السجل المالي.",
  },
  {
    sender: "مؤثر رقمي — حساب تقني",
    subject: "مقترح شراكة ورعاية محتوى",
    message: "السلام عليكم، مهتم بعمل مراجعة وتقييم للمنتج عبر حسابي بـ 100 ألف متابع. أرجو توجيه الطلب للمسؤول.",
  },
];

export default function ReceptionDeskModal({
  isOpen,
  onClose,
  onSimulateIncomingEvent,
}: ReceptionDeskModalProps) {
  const [sender, setSender] = useState(PRESET_INCOMING[0].sender);
  const [subject, setSubject] = useState(PRESET_INCOMING[0].subject);
  const [message, setMessage] = useState(PRESET_INCOMING[0].message);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhook/reception`
    : "http://localhost:3000/api/webhook/reception";

  const curlExample = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"sender": "${sender}", "subject": "${subject}", "message": "${message}"}'`;

  const handleCopyCurl = async () => {
    playClickSound();
    const ok = await copyTextToClipboard(curlExample);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyPreset = (p: typeof PRESET_INCOMING[0]) => {
    playClickSound();
    setSender(p.sender);
    setSubject(p.subject);
    setMessage(p.message);
  };

  const handleSendSimulatedEvent = async () => {
    if (!message.trim()) return;
    playAlertBeep();
    setSending(true);
    setNotice("جارٍ إرسال الطلب إلى بوابة مكتب الاستقبال...");
    try {
      const res = await fetch("/api/webhook/reception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, subject, message }),
      });
      const data = await res.json();
      if (data.ok) {
        playFlyPacketSound();
        onSimulateIncomingEvent(sender, subject, message);
        playCompleteChime();
        setNotice("تم تسليم الطلب إلى موظف الاستقبال وجارٍ نقله للمدير العام!");
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setNotice(data.error || "تعذّر إرسال الطلب.");
      }
    } catch {
      setNotice("تعذّر الاتصال ببوابة الاستقبال.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-modal-title"
    >
      <div className="vault-modal-card pixel-panel" style={{ maxWidth: 740 }}>
        {/* Header */}
        <header className="vault-header" style={{ backgroundColor: "#1e293b" }}>
          <div className="vault-header-title">
            <span className="vault-chest-icon">🛎️</span>
            <div>
              <h2 id="reception-modal-title" className="vault-title-text" style={{ color: "#38bdf8" }}>
                بوابة الاستقبال الخارجية للمكتب (Public Receptionist Webhook)
              </h2>
              <span className="vault-title-sub">
                استقبال الطلبات، الفواتير، والرسائل الخارجية وتوجيهها آلياً للمدير العام وغرف المقر
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
            disabled={sending}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </header>

        {notice && (
          <div className="room-settings-notice">
            <span>{notice}</span>
          </div>
        )}

        <div className="vault-content-box" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Endpoint Details Card */}
          <div className="reception-endpoint-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="reception-badge">رابط الـ Webhook الخارجي (REST API):</span>
              <button
                type="button"
                className="pixel-btn vault-act-btn"
                onClick={handleCopyCurl}
              >
                {copied ? "تم نسخ أمر cURL ✓" : "نسخ كود cURL"}
              </button>
            </div>
            <code className="reception-url-box">{endpointUrl}</code>
            <p className="reception-help-text">
              يمكنك ربط هذا الرابط بأي نموذج موقع (Contact Form)، أو أتمتة Make / n8n، أو بوت تيليجرام لاستقبال الطلبات مباشرة في مكتبك الافتراضي.
            </p>
          </div>

          {/* Event Simulator Box */}
          <div className="reception-simulator-box">
            <label className="settings-label">
              محاكاة استلام رسالة خارجية (Test Simulator):
            </label>

            {/* Presets */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {PRESET_INCOMING.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="preset-chip pixel-btn"
                  onClick={() => handleApplyPreset(p)}
                >
                  {p.subject.slice(0, 32)}...
                </button>
              ))}
            </div>

            <div className="settings-row-split">
              <div className="settings-field">
                <label className="settings-label">اسم الجهة أو العميل:</label>
                <input
                  type="text"
                  className="settings-pixel-input"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">موضوع الطلب:</label>
                <input
                  type="text"
                  className="settings-pixel-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-field" style={{ marginTop: 10 }}>
              <label className="settings-label">نص الطلب أو الرسالة الواردة:</label>
              <textarea
                className="settings-pixel-textarea"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="pixel-btn vault-act-btn vault-btn-primary"
                style={{ height: 32, padding: "0 18px", fontSize: 12 }}
                onClick={handleSendSimulatedEvent}
                disabled={sending || !message.trim()}
              >
                {sending ? "جارٍ التوصيل..." : "🛎️ إرسال عبر الاستقبال إلى المدير العام"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
