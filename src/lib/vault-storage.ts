"use client";

import type { DeliverableItem } from "@/data/agents";

const VAULT_STORAGE_KEY = "virtual_office_deliverables_vault";

export const INITIAL_DELIVERABLES: DeliverableItem[] = [
  {
    id: "deliv-ig-audit-1",
    titleAr: "خطة تدقيق حساب الإنستقرام واستراتيجية النمو الشاملة",
    agentId: "agent-marketing-analyst",
    agentNameAr: "فهد العصيمي",
    agentRoleAr: "محلل حسابات وإنستقرام",
    roomId: "room-marketing",
    timestamp: 1763300000000 - 3600_000 * 3,
    type: "report",
    summaryAr: "تحليل شامل لمعدلات الوصول والتفاعل وتوصيات تحسين البايو وتوقيتات النشر.",
    format: "markdown",
    content: `# تقرير التدقيق الفني واستراتيجية النمو — Instagram Studio

## 1. ملخص التدقيق الأولي
- **الحساب المستهدف:** @ahmad.al.khatib_
- **معدل التفاعل الحالي:** 3.8% (جيد مع إمكانية مضاعفته إلى 6.5%)
- **أبرز فجوات المحتوى:** غياب الخطاف البصري (Hook) في أول 3 ثوانٍ من مقاطع الريلز، وضعف الكلمات المفتاحية في السيرة الذاتية (Bio).

## 2. مصفوفة توقيتات النشر المثالية (بتوقيت مكة المكرمة)
| اليوم | نافذة النشر الأولى | نافذة النشر الثانية | نوع المحتوى الموصى به |
| :--- | :--- | :--- | :--- |
| الأحد | 1:30 ظهراً | 8:30 مساءً | ريلز تعليمي مكثف |
| الثلاثاء | 4:00 عصراً | 9:00 مساءً | كاروسيل نصائح وحلول |
| الخميس | 6:00 مساءً | 10:15 مساءً | ريلز تريند + سؤال تفاعلي |

## 3. خطة العمل المعتمدة للفريق
1. **ليلى الحربي:** كتابة 3 نصوص ريلز تعتمد على خطافات التناقض "لماذا يفشل 90% من...".
2. **طارق القحطاني:** تجهيز القوالب البصرية للكاروسيل وغلاف الريلز بالخط الكوفي الحديث.`,
  },
  {
    id: "deliv-reels-scripts-2",
    titleAr: "حزمة سكريبتات 3 مقاطع ريلز تفاعلية عالية الوصول",
    agentId: "agent-content-creator",
    agentNameAr: "ليلى الحربي",
    agentRoleAr: "كاتبة محتوى وسيناريو",
    roomId: "room-marketing",
    timestamp: 1763300000000 - 3600_000 * 2,
    type: "script",
    summaryAr: "سيناريوهات مصورة مع توجيهات الحركة وزوايا التصوير والنصوص على الشاشة.",
    format: "markdown",
    content: `# حزمة سكريبتات الريلز الأسبوعية (Reels Batch #1)

---

### المقطع 1: خطاف التناقض (The Contrarian Hook)
- **المدة:** 35 ثانية
- **الخطاف البصري (0-3 ثوانٍ):** المذيع ينظر مباشرة للكاميرا، ثم يظهر نص أحمر بارز: «توقف عن ارتكاب هذا الخطأ اليوم!»
- **المتن (4-25 ثانية):**
  > أغلب صناع المحتوى يركزون على عدد المرات التي ينشرون فيها، لكن الحقيقة الصادمة أن خوارزمية 2026 تكافئ معدل الحفظ (Saves) والمشاركة في الخاص (DMs) بنسبة 3 أضعاف المشاهدات المجردة.
- **الدعوة للإجراء (CTA - 26-35 ثانية):**
  > أرسل هذا المقطع لشريكك في العمل، واحفظه لتطبقه في منشورك القادم.

---

### المقطع 2: حيلة الخطوات الثلاث (Step-by-Step Value)
- **المدة:** 45 ثانية
- **الخطوة 1:** إعادة صياغة السطر الأول في البايو ليوضح القيمة خلال ثانيتين.
- **الخطوة 2:** تثبيت أفضل 3 مقاطع تجلب متابعين جدد في واجهة الحساب.
- **الخطوة 3:** الرد على أول 10 تعليقات خلال الـ 15 دقيقة الأولى من النشر.`,
  },
  {
    id: "deliv-finance-sheet-3",
    titleAr: "جدول الميزانية التقديرية للحملات التسويقية Q1",
    agentId: "agent-marketing-designer",
    agentNameAr: "طارق القحطاني",
    agentRoleAr: "مصمم هويات وبوسترات",
    roomId: "room-marketing",
    timestamp: 1763300000000 - 3600_000,
    type: "table",
    summaryAr: "توزيع ميزانيات التصاميم وحملات الترويج والإنتاج المرئي للربع الأول.",
    format: "csv",
    content: `البند,المسؤول,الميزانية المعتمدة (SAR),الحالة,الموعد النهائي
تصميم الهوية البصرية للريلز,طارق القحطاني,4500,مكتمل,2026-11-20
إنتاج مقاطع الفيديو الاحترافية,ليلى الحربي,6000,قيد التنفيذ,2026-11-25
إعلانات الترويج المستهدفة,فهد العصيمي,8000,مجدول,2026-12-01
تراخيص برامج التصميم والأدوات,سلمان العتيبي,1500,معتمد,2026-11-15`,
  },
];

export function loadDeliverables(): DeliverableItem[] {
  if (typeof window === "undefined") return INITIAL_DELIVERABLES;
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) {
      saveDeliverables(INITIAL_DELIVERABLES);
      return INITIAL_DELIVERABLES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_DELIVERABLES;
  } catch {
    return INITIAL_DELIVERABLES;
  }
}

export function saveDeliverables(items: DeliverableItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded or storage disabled
  }
}

export function addDeliverable(
  item: Omit<DeliverableItem, "id" | "timestamp">,
): DeliverableItem {
  const newItem: DeliverableItem = {
    ...item,
    id: `deliv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  const current = loadDeliverables();
  const updated = [newItem, ...current];
  saveDeliverables(updated);
  return newItem;
}

export function deleteDeliverable(id: string): DeliverableItem[] {
  const current = loadDeliverables();
  const updated = current.filter((item) => item.id !== id);
  saveDeliverables(updated);
  return updated;
}

/** Download deliverable content directly to user's computer */
export function downloadDeliverable(item: DeliverableItem, format?: "md" | "csv" | "json"): void {
  if (typeof window === "undefined") return;
  const targetFormat = format ?? (item.format === "csv" ? "csv" : item.format === "json" ? "json" : "md");
  let content = item.content;
  let mimeType = "text/markdown;charset=utf-8";
  let extension = "md";

  if (targetFormat === "csv") {
    mimeType = "text/csv;charset=utf-8";
    extension = "csv";
  } else if (targetFormat === "json") {
    mimeType = "application/json;charset=utf-8";
    extension = "json";
    if (typeof content === "string" && !content.trim().startsWith("{") && !content.trim().startsWith("[")) {
      content = JSON.stringify(item, null, 2);
    }
  }

  const cleanTitle = item.titleAr.replace(/[\/\\?%*:|"<>]/g, "_").slice(0, 40);
  const fileName = `${cleanTitle}_${item.id}.${extension}`;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
