"use client";

import { useEffect, useMemo, useState } from "react";
import type { Agent, LedgerEntry, Room } from "@/data/agents";
import AgentPortrait from "@/components/agent-portrait";
import { playClickSound, playCompleteChime } from "@/lib/audio-effects";
import { ChartIcon, DownloadIcon, TrashIcon } from "@/components/icons";

interface AccountingLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgerEntries: LedgerEntry[];
  agents: Agent[];
  rooms: Room[];
  onClearLedger?: () => void;
}

export default function AccountingLedgerModal({
  isOpen,
  onClose,
  ledgerEntries,
  agents,
  rooms,
  onClearLedger,
}: AccountingLedgerModalProps) {
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredEntries = useMemo(() => {
    if (selectedAgentFilter === "all") return ledgerEntries;
    return ledgerEntries.filter((e) => e.agentId === selectedAgentFilter);
  }, [ledgerEntries, selectedAgentFilter]);

  const stats = useMemo(() => {
    const totalInput = ledgerEntries.reduce((sum, e) => sum + (e.inputTokens || 0), 0);
    const totalOutput = ledgerEntries.reduce((sum, e) => sum + (e.outputTokens || 0), 0);
    const totalTokens = totalInput + totalOutput;
    const totalCost = ledgerEntries.reduce((sum, e) => sum + (e.costUsd || 0), 0);
    const avgCostPerTask = ledgerEntries.length > 0 ? totalCost / ledgerEntries.length : 0;
    return { totalInput, totalOutput, totalTokens, totalCost, avgCostPerTask };
  }, [ledgerEntries]);

  // Breakdown per agent
  const agentBreakdowns = useMemo(() => {
    const map = new Map<string, { count: number; tokens: number; cost: number }>();
    for (const e of ledgerEntries) {
      const cur = map.get(e.agentId) ?? { count: 0, tokens: 0, cost: 0 };
      map.set(e.agentId, {
        count: cur.count + 1,
        tokens: cur.tokens + (e.totalTokens || 0),
        cost: cur.cost + (e.costUsd || 0),
      });
    }
    return map;
  }, [ledgerEntries]);

  const handleExportCsv = () => {
    playClickSound();
    const headers = ["ID", "Timestamp", "Agent", "Room", "Task", "InputTokens", "OutputTokens", "TotalTokens", "CostUSD", "Source"];
    const rows = ledgerEntries.map((e) => [
      e.id,
      new Date(e.timestamp).toISOString(),
      `"${e.agentNameAr}"`,
      `"${e.roomNameAr ?? ""}"`,
      `"${e.taskTitleAr.replace(/"/g, '""')}"`,
      e.inputTokens,
      e.outputTokens,
      e.totalTokens,
      e.costUsd.toFixed(6),
      e.source,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `office-token-ledger-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    playCompleteChime();
  };

  if (!isOpen) return null;

  return (
    <div
      className="vault-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ledger-modal-title"
    >
      <div className="vault-modal-card pixel-panel" style={{ maxWidth: 940, maxHeight: "92vh" }}>
        {/* Header */}
        <header className="vault-header" style={{ backgroundColor: "#1e3a1f" }}>
          <div className="vault-header-title">
            <span className="vault-chest-icon">💰</span>
            <div>
              <h2 id="ledger-modal-title" className="vault-title-text" style={{ color: "#86efac" }}>
                سجل المالية واستهلاك التوكنات (Financial & Token Ledger)
              </h2>
              <span className="vault-title-sub">
                تتبع التكلفة اللحظية بالدولار ومعدل استهلاك التوكنات لكل وكيل وكل مهمة منجزة
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="circuit-guard-badge" title="حامي الحلقات المفرغة نشط لحماية الرصيد">
              🛡️ حامي الحلقات: نشط (4 تفويضات كحد أقصى)
            </span>
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
          </div>
        </header>

        {/* Content Body */}
        <div className="vault-content-box" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* KPI Summary Grid */}
          <div className="ledger-kpis-grid">
            <div className="ledger-kpi-card cost-kpi">
              <span className="kpi-label">إجمالي التكلفة التقديرية</span>
              <strong className="kpi-value text-green">${stats.totalCost.toFixed(5)}</strong>
              <span className="kpi-sub">وفق تسعيرة Gemini 1.5/2.0 الرسمية</span>
            </div>
            <div className="ledger-kpi-card tokens-kpi">
              <span className="kpi-label">إجمالي التوكنات المستهلكة</span>
              <strong className="kpi-value text-cyan">{stats.totalTokens.toLocaleString("ar-SA")}</strong>
              <span className="kpi-sub">
                {stats.totalInput.toLocaleString("ar-SA")} إدخال • {stats.totalOutput.toLocaleString("ar-SA")} إخراج
              </span>
            </div>
            <div className="ledger-kpi-card tasks-kpi">
              <span className="kpi-label">عدد العمليات المحاسبية</span>
              <strong className="kpi-value">{ledgerEntries.length} مهمة</strong>
              <span className="kpi-sub">سجل العمليات المسجلة محلياً</span>
            </div>
            <div className="ledger-kpi-card avg-kpi">
              <span className="kpi-label">متوسط تكلفة المهمة</span>
              <strong className="kpi-value">${stats.avgCostPerTask.toFixed(6)}</strong>
              <span className="kpi-sub">كفاءة اقتصادية فائقة</span>
            </div>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="ledger-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="settings-label" style={{ margin: 0 }}>تصفية حسب الوكيل:</span>
              <select
                className="settings-pixel-input"
                style={{ padding: "4px 8px", width: "auto" }}
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
              >
                <option value="all">كافة الوكلاء ({ledgerEntries.length})</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameAr} ({a.roleAr})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="pixel-btn vault-act-btn"
                onClick={handleExportCsv}
                disabled={ledgerEntries.length === 0}
                title="تصدير السجل كملف Excel / CSV"
              >
                <DownloadIcon width={13} height={13} />
                <span>تصدير CSV</span>
              </button>
              {onClearLedger && (
                <button
                  type="button"
                  className="pixel-btn vault-act-btn"
                  onClick={() => {
                    playClickSound();
                    if (window.confirm("هل أنت متأكد من تصفير سجل العمليات المالية؟")) {
                      onClearLedger();
                    }
                  }}
                  disabled={ledgerEntries.length === 0}
                  title="تصفير السجل المحاسبي"
                >
                  <TrashIcon width={13} height={13} />
                  <span>تصفير السجل</span>
                </button>
              )}
            </div>
          </div>

          {/* Agent Cost Breakdown Row */}
          {agentBreakdowns.size > 0 && (
            <div className="ledger-agent-breakdowns-box">
              <span className="settings-label" style={{ fontSize: 11, marginBottom: 6 }}>
                توزيع استهلاك الرصيد بين الوكلاء:
              </span>
              <div className="ledger-agent-chips-wrap">
                {Array.from(agentBreakdowns.entries()).map(([agentId, data]) => {
                  const agent = agents.find((a) => a.id === agentId);
                  const tokenRatio = stats.totalTokens > 0 ? (data.tokens / stats.totalTokens) * 100 : 0;
                  return (
                    <div key={agentId} className="ledger-agent-chip">
                      <div style={{ width: 20, height: 20 }}>
                        {agent && <AgentPortrait agent={agent} size={20} />}
                      </div>
                      <div className="chip-meta">
                        <span className="chip-name">{agent?.nameAr ?? agentId}</span>
                        <span className="chip-cost">${data.cost.toFixed(5)} ({tokenRatio.toFixed(0)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transactions Table */}
          <div className="ledger-table-container">
            {filteredEntries.length === 0 ? (
              <div className="vault-empty-list" style={{ color: "#166534" }}>
                لا توجد عمليات مسجلة حتى الآن. تبدأ المعاملات بالتسجيل التلقائي فور تنفيذ المهام!
              </div>
            ) : (
              <table className="ledger-pixel-table">
                <thead>
                  <tr>
                    <th>التوقيت</th>
                    <th>الوكيل</th>
                    <th>القسم</th>
                    <th>المهمة المنفذة</th>
                    <th>إدخال</th>
                    <th>إخراج</th>
                    <th>الإجمالي</th>
                    <th>التكلفة ($)</th>
                    <th>المحرك</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="time-col">
                        {new Date(entry.timestamp).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="agent-col">
                        <strong>{entry.agentNameAr}</strong>
                      </td>
                      <td>{entry.roomNameAr || "غرفة عامة"}</td>
                      <td className="task-col" title={entry.taskTitleAr}>
                        {entry.taskTitleAr}
                      </td>
                      <td className="num-col">{entry.inputTokens.toLocaleString("ar-SA")}</td>
                      <td className="num-col">{entry.outputTokens.toLocaleString("ar-SA")}</td>
                      <td className="num-col font-bold">
                        {entry.totalTokens.toLocaleString("ar-SA")}
                      </td>
                      <td className="num-col cost-col font-bold text-green">
                        ${entry.costUsd.toFixed(5)}
                      </td>
                      <td>
                        <span className={`engine-badge ${entry.source}`}>
                          {entry.source === "gemini" ? "GEMINI" : "LOCAL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
