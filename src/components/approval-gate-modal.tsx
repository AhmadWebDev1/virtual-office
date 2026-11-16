"use client";

import type { Agent, ApprovalRequest } from "@/data/agents";
import { playAlertBeep, playClickSound } from "@/lib/audio-effects";
import AgentPortrait from "@/components/agent-portrait";
import { useEffect } from "react";

interface ApprovalGateModalProps {
  request: ApprovalRequest | null;
  agent?: Agent;
  onApprove: (request: ApprovalRequest) => void;
  onReject: (request: ApprovalRequest) => void;
}

export default function ApprovalGateModal({
  request,
  agent,
  onApprove,
  onReject,
}: ApprovalGateModalProps) {
  useEffect(() => {
    if (request) {
      playAlertBeep();
    }
  }, [request]);

  if (!request) return null;

  const payloadString =
    typeof request.payload === "string"
      ? request.payload
      : JSON.stringify(request.payload, null, 2);

  return (
    <div
      className="approval-modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      aria-describedby="approval-desc"
    >
      <div className="approval-card pixel-panel">
        <header className="approval-header">
          <div className="approval-badge-pulse">
            <span className="approval-hand-icon">✋</span>
            <span className="approval-badge-text">بانتظار موافقتك الشخصية</span>
          </div>
          <span className="approval-impact-tag">
            {request.impactLevel === "high"
              ? "إجراء خارجي عالي الخطورة"
              : "إجراء تنفيذي يتطلب تأكيداً"}
          </span>
        </header>

        <div className="approval-body">
          <div className="approval-agent-row">
            {agent && (
              <div className="approval-agent-portrait">
                <AgentPortrait agent={agent} size={44} />
              </div>
            )}
            <div>
              <h3 id="approval-title" className="approval-action-title">
                {request.titleAr}
              </h3>
              <p className="approval-agent-meta">
                المسؤول: {request.agentNameAr} ({request.agentRoleAr})
              </p>
            </div>
          </div>

          <p id="approval-desc" className="approval-description">
            {request.actionDescriptionAr}
          </p>

          <div className="approval-payload-box">
            <div className="approval-payload-label">حمولة البيانات (Payload):</div>
            <pre className="approval-pre-payload">{payloadString}</pre>
          </div>
        </div>

        <footer className="approval-footer">
          <button
            type="button"
            className="pixel-btn approval-reject-btn"
            onClick={() => {
              playClickSound();
              onReject(request);
            }}
          >
            إلغاء ورفض
          </button>
          <button
            type="button"
            className="pixel-btn approval-approve-btn"
            onClick={() => {
              playClickSound();
              onApprove(request);
            }}
          >
            موافقة وتنفيذ الإجراء ✓
          </button>
        </footer>
      </div>
    </div>
  );
}
