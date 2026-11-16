"use client";

import { useId, useRef, useState } from "react";
import { STATUS_META, type Agent } from "@/data/agents";
import type { CommandTarget } from "@/lib/agent-contracts";
import {
  ChevronDownIcon,
  CommandIcon,
  CrownIcon,
  RouteIcon,
  SendIcon,
  TerminalIcon,
} from "@/components/icons";
import AgentPortrait from "@/components/agent-portrait";

export interface CommandReceipt {
  id: number;
  agentNameAr: string;
  text: string;
  status: "pending" | "done" | "error";
}

interface CommandBarProps {
  agents: Agent[];
  target: CommandTarget;
  onTargetChange: (target: CommandTarget) => void;
  onSubmit: (target: CommandTarget, command: string) => void;
  sending: boolean;
  receipt?: CommandReceipt;
}

export default function CommandBar({
  agents,
  target,
  onTargetChange,
  onSubmit,
  sending,
  receipt,
}: CommandBarProps) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const canSubmit = command.trim().length > 0 && !sending;
  const selectedAgent = target === "auto" ? null : agents.find((agent) => agent.id === target);
  const selectedMeta = selectedAgent ? STATUS_META[selectedAgent.status] : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const value = command.trim();
    onSubmit(target, value);
    setCommand("");
    inputRef.current?.focus();
  };

  return (
    <div className="command-dock">
      <div className="command-dock-inner pixel-panel">
        <div className="command-dialogue">
          <aside
            className="command-portrait"
            data-status={selectedAgent?.status ?? "auto"}
            aria-hidden="true"
          >
            <div className="command-portrait-frame">
              {selectedAgent ? (
                <AgentPortrait agent={selectedAgent} size={54} />
              ) : (
                <CrownIcon width={34} height={34} />
              )}
              <span className="command-portrait-led" />
            </div>
            <span className="command-portrait-name">
              {selectedAgent?.nameAr ?? "المدير العام"}
            </span>
            <span className="command-portrait-role">
              {selectedAgent?.roleAr ?? "توجيه تلقائي"}
            </span>
          </aside>

          <div className="command-dialogue-main">
            {receipt ? (
              <div className="command-receipt" data-status={receipt.status} key={receipt.id}>
                <span className="receipt-led" aria-hidden="true" />
                <span className="receipt-agent">{receipt.agentNameAr}</span>
                <span className="receipt-divider" aria-hidden="true" />
                <span className="receipt-text">{receipt.text}</span>
                <span className="receipt-status">
                  {receipt.status === "pending"
                    ? "يشتغل الآن"
                    : receipt.status === "done"
                      ? "تم التنفيذ"
                      : "تعذّر الإرسال"}
                </span>
              </div>
            ) : (
              <div className="command-receipt command-receipt-idle">
                <span className="receipt-led" aria-hidden="true" />
                <span className="receipt-text">
                  أصدر أمراً للمدير العام: وظّف وكيلاً، وزّع مهمة، أو عدّل قواعد الفريق.
                </span>
                <span className="receipt-shortcut">
                  <kbd>Enter</kbd> للإرسال
                </span>
              </div>
            )}

            <form className="command-form" onSubmit={submit}>
              <div className="command-target">
                <span className="command-target-label">
                  {target === "auto" ? (
                    <RouteIcon width={13} height={13} />
                  ) : (
                    selectedMeta && (
                      <span
                        className="target-status-dot"
                        style={{ background: selectedMeta.dot }}
                      />
                    )
                  )}
                  <span>إلى</span>
                </span>
                <select
                  value={target}
                  onChange={(event) => onTargetChange(event.target.value as CommandTarget)}
                  className="command-select"
                  aria-label="اختر الوكيل المستلم للأمر"
                >
                  <option value="auto">توجيه تلقائي · عبر المدير العام</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.nameAr} · {agent.roleAr}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon width={13} height={13} className="command-select-chevron" />
              </div>

              <div className="command-input-wrap">
                <CommandIcon width={16} height={16} className="command-input-icon" />
                <label htmlFor={inputId} className="sr-only">
                  اكتب أمراً للمدير العام أو فريق الوكلاء
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  className="command-input"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="مثال: أنشئ وكيل مبرمج ويب وضع له قواعد صارمة…"
                  maxLength={500}
                  autoComplete="off"
                  disabled={sending}
                />
                <span className="command-count" aria-hidden="true">
                  {command.length > 0 ? `${command.length}/500` : ""}
                </span>
              </div>

              <button
                type="submit"
                className="command-submit"
                disabled={!canSubmit}
                aria-label={sending ? "جارٍ إرسال الأمر" : "إرسال الأمر"}
              >
                {sending ? (
                  <span className="send-loader" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <SendIcon width={17} height={17} />
                )}
                <span className="command-submit-label">{sending ? "يرسل" : "تنفيذ"}</span>
              </button>
            </form>

            <div className="command-meta">
              <span>
                <TerminalIcon width={11} height={11} />
                وحدة العمليات · CONSOLE
              </span>
              <span className="command-meta-route">
                <RouteIcon width={11} height={11} />
                التوجيه الذكي مفعّل ({agents.length} {agents.length === 1 ? "وكيل" : "وكلاء"})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
