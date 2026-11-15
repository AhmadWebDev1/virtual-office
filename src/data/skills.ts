export type WorkspaceToolGroup = "gmail" | "sheets";

export interface SkillDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  categoryAr: string;
  descriptionAr: string;
  promptInstruction: string;
  keywords: string[];
  toolGroup?: WorkspaceToolGroup;
}

export interface CustomSkillDefinition {
  id: string;
  nameAr: string;
  descriptionAr: string;
  promptInstruction: string;
  format: "markdown" | "json";
}

export const SKILL_CATALOG: SkillDefinition[] = [
  {
    id: "task-management",
    nameAr: "إدارة المهام",
    nameEn: "Task Management",
    categoryAr: "تنظيم وعمليات",
    descriptionAr: "تفكيك الأهداف الكبيرة إلى خطوات واضحة، ترتيب الأولويات، وتحديد خطة التنفيذ.",
    promptInstruction:
      "نظّم العمل في خطوات مرحلية واضحة مرتّبة بالأولوية، وحدد المخرجات المتوقعة والخطوة التالية في كل رد.",
    keywords: ["مهام", "خطة", "توزيع", "أولوية", "جدول", "متابعة", "إدارة", "فريق", "plan", "task"],
  },
  {
    id: "research-summary",
    nameAr: "البحث والتلخيص",
    nameEn: "Research & Summary",
    categoryAr: "تحليل ومحتوى",
    descriptionAr: "استخلاص النقاط الجوهرية من المعلومات المتاحة وصياغة ملخصات تنفيذية دقيقة.",
    promptInstruction:
      "لخّص الأفكار الرئيسية في نقاط مركّزة وواضحة دون حشو، وابرز القرارات أو المخاطر إن وُجدت.",
    keywords: ["بحث", "لخص", "تلخيص", "ملخص", "تقرير", "استخلاص", "مراجعة", "research", "summary"],
  },
  {
    id: "data-analysis",
    nameAr: "تحليل البيانات",
    nameEn: "Data Analysis",
    categoryAr: "بيانات ومؤشرات",
    descriptionAr: "قراءة الأرقام والمؤشرات، اكتشاف الاتجاهات، وتقديم توصيات مبنية على الأرقام.",
    promptInstruction:
      "حلّل الأرقام والمؤشرات بدقة، قارن بين المعطيات، واذكر النسب والاتجاهات والاستنتاجات العملية بوضوح.",
    keywords: ["تحليل", "بيانات", "احصائيات", "أرقام", "مؤشرات", "نمو", "تفاعل", "مبيعات", "analytics", "data"],
  },
  {
    id: "email-drafting",
    nameAr: "صياغة الإيميلات",
    nameEn: "Email Drafting",
    categoryAr: "تواصل مهني",
    descriptionAr: "صياغة رسائل بريدية احترافية، ردود للعملاء، وعروض تعاون بأسلوب رصين.",
    promptInstruction:
      "صُغ الرسائل والردود البريدية بنبرة مهنية واضحة مع عنوان مناسب ومقدمة موجزة ودعوة واضحة للإجراء.",
    keywords: ["صياغة", "رد", "عميل", "رسالة", "مراسلة", "عرض", "مبيعات", "تواصل", "draft", "reply"],
  },
  {
    id: "code-writing",
    nameAr: "كتابة الأكواد",
    nameEn: "Code Writing",
    categoryAr: "تطوير وهندسة",
    descriptionAr: "تصميم البنية البرمجية، كتابة الأكواد النظيفة، ومراجعة الأخطاء التقنية.",
    promptInstruction:
      "قدّم حلولاً برمجية دقيقة ومهيكلة وفق أفضل الممارسات، وحدد الملفات أو الدوال المعنية وحالات الاختبار.",
    keywords: [
      "كود",
      "برمجة",
      "مبرمج",
      "تطوير",
      "مطور",
      "ويب",
      "تطبيق",
      "موقع",
      "باك اند",
      "فرونت",
      "خطأ برمجي",
      "code",
      "dev",
      "developer",
      "web",
      "api",
      "bug",
    ],
  },
  {
    id: "gmail-workspace",
    nameAr: "Gmail (البريد الحقيقي)",
    nameEn: "Gmail Workspace API",
    categoryAr: "تكامل Google",
    descriptionAr: "قراءة الوارد الفعلي، فرز الرسائل، حفظ المسودات، وحذف الرسائل للمهملات بعد التأكيد.",
    promptInstruction:
      "لديك أدوات Gmail حقيقية (fetch_recent_emails, create_email_draft, trash_emails). استخدم الأداة المناسبة للأمر والتزم بنتائجها بدقة.",
    keywords: ["ايميل", "بريد", "وارد", "صادر", "سبام", "مهملات", "ترويج", "gmail", "email", "inbox", "trash"],
    toolGroup: "gmail",
  },
  {
    id: "sheets-finance",
    nameAr: "Google Sheets (المالية)",
    nameEn: "Google Sheets Finance API",
    categoryAr: "تكامل Google",
    descriptionAr: "قراءة السجلات المالية وحساب الدخل والمصروفات وتسجيل الفواتير في Google Sheets.",
    promptInstruction:
      "لديك أدوات Google Sheets حقيقية (get_financial_summary, log_expense_or_invoice). استدعِ الأداة المناسبة واعرض الأرقام والعملات الفعلية.",
    keywords: ["فاتورة", "مصروف", "مالي", "مالية", "محاسب", "ميزانية", "دخل", "ايراد", "sheets", "finance", "invoice", "expense"],
    toolGroup: "sheets",
  },
];

export function resolveSkillMeta(skillId: string): SkillDefinition | undefined {
  return SKILL_CATALOG.find((skill) => skill.id === skillId);
}

export function getActiveToolGroups(skills: string[]): Set<WorkspaceToolGroup> {
  const groups = new Set<WorkspaceToolGroup>();
  for (const id of skills) {
    const meta = resolveSkillMeta(id);
    if (meta?.toolGroup) {
      groups.add(meta.toolGroup);
    }
  }
  return groups;
}

export function normalizeSkillList(rawSkills: unknown): string[] {
  if (!Array.isArray(rawSkills)) return [];
  const valid = new Set(SKILL_CATALOG.map((item) => item.id));
  const result: string[] = [];
  for (const entry of rawSkills) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    // Match exact catalog id or alias by Arabic/English name.
    if (valid.has(trimmed)) {
      if (!result.includes(trimmed)) result.push(trimmed);
      continue;
    }
    const lower = trimmed.toLowerCase();
    const matched = SKILL_CATALOG.find(
      (item) =>
        item.nameEn.toLowerCase() === lower ||
        item.nameAr === trimmed ||
        item.keywords.some((kw) => lower.includes(kw.toLowerCase())),
    );
    if (matched && !result.includes(matched.id)) {
      result.push(matched.id);
    }
  }
  return result;
}

export function parseCustomSkillInput(
  rawInput: string,
): { ok: true; skill: CustomSkillDefinition } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: "ألصق تعريف المهارة بصيغة Markdown أو JSON أولاً." };
  }

  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: "صيغة JSON غير صالحة. تحقّق من الأقواس وعلامات التنصيص." };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "يجب أن يكون تعريف المهارة كائن JSON يحتوي على الاسم والتعليمات." };
    }
    const obj = parsed as Record<string, unknown>;
    const nameRaw = obj.nameAr ?? obj.name ?? obj.title;
    const instructionRaw = obj.promptInstruction ?? obj.instruction ?? obj.rules ?? obj.prompt;
    const descRaw = obj.descriptionAr ?? obj.description ?? "";

    const nameAr = typeof nameRaw === "string" ? nameRaw.trim().slice(0, 60) : "";
    const promptInstruction =
      typeof instructionRaw === "string" ? instructionRaw.trim().slice(0, 1200) : "";
    const descriptionAr =
      typeof descRaw === "string" && descRaw.trim()
        ? descRaw.trim().slice(0, 180)
        : promptInstruction.slice(0, 120);

    if (!nameAr || !promptInstruction) {
      return {
        ok: false,
        error: "يجب أن يتضمن JSON الحقلين nameAr (أو name) و promptInstruction (أو instruction).",
      };
    }

    return {
      ok: true,
      skill: {
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        nameAr,
        descriptionAr,
        promptInstruction,
        format: "json",
      },
    };
  }

  // Parse Markdown definition (# Title + body).
  const lines = trimmed.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#{1,3}\s+/.test(line.trim()));
  let nameAr = "";
  let bodyLines: string[] = [];

  if (headingIndex >= 0) {
    nameAr = lines[headingIndex].trim().replace(/^#{1,3}\s+/, "").trim().slice(0, 60);
    bodyLines = lines.slice(headingIndex + 1).map((line) => line.trim()).filter(Boolean);
  } else {
    nameAr = lines[0].trim().replace(/^[-*]\s*/, "").slice(0, 60);
    bodyLines = lines.slice(1).map((line) => line.trim()).filter(Boolean);
  }

  const promptInstruction = bodyLines.join("\n").slice(0, 1200);
  if (!nameAr || !promptInstruction) {
    return {
      ok: false,
      error: "في صيغة Markdown اكتب عنوان المهارة في السطر الأول (# اسم المهارة) ثم التعليمات في الأسطر التالية.",
    };
  }

  const firstSummary = bodyLines[0].replace(/^[-*>]\s*/, "").slice(0, 140);
  return {
    ok: true,
    skill: {
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      nameAr,
      descriptionAr: firstSummary,
      promptInstruction,
      format: "markdown",
    },
  };
}
