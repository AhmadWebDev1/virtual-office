import { Type, type FunctionDeclaration, type Tool } from "@google/genai";
import {
  GM_AGENT_ID,
  normalizeFurnitureStyle,
  normalizeHexColor,
  type AgentId,
} from "@/data/agents";
import { getActiveToolGroups, normalizeSkillList } from "@/data/skills";
import type { CreatedAgentSpec, PendingWorkspaceConfirmation } from "@/lib/agent-contracts";

export interface AgentToolContext {
  agentId: AgentId;
  command: string;
  googleAccessToken?: string;
  sheetId?: string;
  confirmedMutation?: boolean;
  onCreatedSheet?: (sheetId: string, sheetUrl: string) => void;
  onCreatedAgent?: (spec: CreatedAgentSpec) => void;
  onAuthExpired?: () => void;
  onPendingConfirmation?: (pending: PendingWorkspaceConfirmation) => void;
}

type AgentToolExecutor = (
  call: { name: string; args: Record<string, unknown> },
  context: AgentToolContext,
) => Promise<Record<string, unknown>>;

export interface AgentToolSet {
  declarations: FunctionDeclaration[];
  execute: AgentToolExecutor;
}

type IntegrationMode = "google_oauth" | "demo_fallback";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  category?: "primary" | "promotions" | "social" | "updates";
  unread?: boolean;
}

interface FinanceEntry {
  date: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  description: string;
}

const TOOL_HTTP_TIMEOUT_MS = 12_000;

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(cleaned)) return cleaned;
  }
  return fallback;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TOOL_HTTP_TIMEOUT_MS),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: response.ok, status: response.status, data, text };
}

async function callGmailApi(
  path: string,
  token: string,
  context: AgentToolContext,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const res = await fetchJson(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const insufficientScope =
    res.status === 403 &&
    /insufficient|permission|scope/i.test(res.text);
  if (res.status === 401 || insufficientScope) {
    context.onAuthExpired?.();
  }
  return res;
}

// ---------------------------------------------------------------------------
// Demo Fallback Data (used cleanly when user is not signed in with Google)
// ---------------------------------------------------------------------------

const INITIAL_DEMO_EMAILS: EmailItem[] = [
  {
    id: "demo-msg-1",
    from: "شركة النخبة للتوريد <billing@nokhba.sa>",
    subject: "عاجل: تأكيد استلام فاتورة أكتوبر #INV-2048",
    date: "2026-11-15T09:15:00Z",
    snippet: "نرجو تأكيد موعد سداد الفاتورة رقم INV-2048 بقيمة 4,200 ريال قبل نهاية الأسبوع.",
    category: "primary",
    unread: true,
  },
  {
    id: "demo-msg-2",
    from: "سارة المنصور <sara@creativehub.ae>",
    subject: "طلب تعاون لحملة إطلاق الربع الأخير",
    date: "2026-11-15T07:40:00Z",
    snippet: "مرحباً فريق العمل، نود التنسيق معكم حول باقة التصاميم والإعلانات للشهر القادم.",
    category: "primary",
    unread: true,
  },
  {
    id: "demo-msg-3",
    from: "Firebase <firebase-noreply@google.com>",
    subject: "[Firebase] Ihr Projekt „My First Project“ wurde aktualisiert",
    date: "2026-11-14T21:10:00Z",
    snippet: "Welcome to Firebase! Your project configuration and billing alert settings have been updated.",
    category: "updates",
    unread: false,
  },
  {
    id: "demo-msg-4",
    from: "Cloud Billing <noreply@cloud-provider.example>",
    subject: "Monthly usage invoice ready — $148.50",
    date: "2026-11-14T18:20:00Z",
    snippet: "Your monthly cloud infrastructure invoice for November is now available to download.",
    category: "updates",
    unread: false,
  },
  {
    id: "demo-msg-5",
    from: "أحمد الحربي <a.harbi@horizon-tech.sa>",
    subject: "متابعة تعديلات العرض الفني للمشروع",
    date: "2026-11-14T14:05:00Z",
    snippet: "هل تم اعتماد النسخة النهائية من العرض الفني تمهيداً للاجتماع غداً؟",
    category: "primary",
    unread: true,
  },
  {
    id: "demo-msg-6",
    from: "Firebase <firebase-noreply@google.com>",
    subject: "Welcome to Firebase",
    date: "2026-11-14T11:30:00Z",
    snippet: "Get started with Firebase Authentication, Firestore, and Hosting in your project.",
    category: "updates",
    unread: false,
  },
  {
    id: "demo-msg-7",
    from: "Adobe Creative Offers <offers@mail.adobe.com>",
    subject: "عرض خاص: خصم 40% على اشتراك Creative Cloud",
    date: "2026-11-13T16:45:00Z",
    snippet: "استفد من الخصم الحصري للفرق الإبداعية قبل انتهاء العرض الترويجي.",
    category: "promotions",
    unread: false,
  },
  {
    id: "demo-msg-8",
    from: "Newsletter Digest <updates@growthweekly.io>",
    subject: "أبرز مؤشرات التسويق الرقمي هذا الأسبوع",
    date: "2026-11-13T11:00:00Z",
    snippet: "ملخص أسبوعي لأهم اتجاهات المحتوى وإعلانات الإنستغرام.",
    category: "promotions",
    unread: false,
  },
  {
    id: "demo-msg-9",
    from: "Figma Community <noreply@figma.com>",
    subject: "New UI kits & templates for your design team",
    date: "2026-11-12T15:10:00Z",
    snippet: "Explore trending design systems and community templates this week.",
    category: "promotions",
    unread: false,
  },
  {
    id: "demo-msg-10",
    from: "بنك الأعمال <alerts@businessbank.sa>",
    subject: "إشعار تحويل وارد بقيمة 9,200 ريال",
    date: "2026-11-12T09:05:00Z",
    snippet: "تم إيداع مبلغ 9,200.00 SAR في حساب المؤسسة — مرجع #TX-88421.",
    category: "primary",
    unread: false,
  },
];

const demoEmailInbox: EmailItem[] = INITIAL_DEMO_EMAILS.map((email) => ({ ...email }));

const demoFinanceLedger: FinanceEntry[] = [
  {
    date: "2026-11-02",
    type: "income",
    amount: 18500,
    currency: "SAR",
    category: "عملاء",
    description: "دفعة عقد تصميم وهوية — شركة المدار",
  },
  {
    date: "2026-11-05",
    type: "expense",
    amount: 1450,
    currency: "SAR",
    category: "اشتراكات",
    description: "اشتراكات أدوات التصميم والذكاء الاصطناعي",
  },
  {
    date: "2026-11-08",
    type: "income",
    amount: 9200,
    currency: "SAR",
    category: "إدارة حسابات",
    description: "رسوم إدارة محتوى الإنستغرام — نوفمبر",
  },
  {
    date: "2026-11-11",
    type: "expense",
    amount: 3100,
    currency: "SAR",
    category: "تسويق",
    description: "ميزانية إعلانات ممولة لحملة الخريف",
  },
  {
    date: "2026-11-13",
    type: "expense",
    amount: 820,
    currency: "SAR",
    category: "استضافة",
    description: "خوادم وبنية سحابية شهرية",
  },
];

// ---------------------------------------------------------------------------
// Email Manager Implementation
// ---------------------------------------------------------------------------

function extractHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string,
): string {
  const match = headers?.find(
    (entry) => entry.name?.toLowerCase() === headerName.toLowerCase(),
  );
  return match?.value?.trim() ?? "";
}

async function fetchGmailMessageMetadata(
  messageIds: string[],
  token: string,
  context: AgentToolContext,
): Promise<EmailItem[]> {
  const results: EmailItem[] = [];
  const CHUNK_SIZE = 12;

  for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
    const chunk = messageIds.slice(i, i + CHUNK_SIZE);
    const items = await Promise.all(
      chunk.map(async (id) => {
        const msgRes = await callGmailApi(
          `users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          token,
          context,
        );
        if (!msgRes.ok || !msgRes.data || typeof msgRes.data !== "object") return null;
        const msg = msgRes.data as {
          id?: string;
          snippet?: string;
          payload?: { headers?: Array<{ name?: string; value?: string }> };
        };
        const headers = msg.payload?.headers;
        return {
          id: msg.id ?? id,
          from: extractHeader(headers, "From") || "مرسل غير معروف",
          subject: extractHeader(headers, "Subject") || "(بدون عنوان)",
          date: extractHeader(headers, "Date"),
          snippet: (msg.snippet ?? "").trim(),
        } satisfies EmailItem;
      }),
    );
    for (const item of items) {
      if (item) results.push(item);
    }
  }

  return results;
}

function matchesDemoEmailQuery(email: EmailItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q || q === "all") return true;

  if (q.includes("is:unread")) return Boolean(email.unread);
  if (q.includes("category:promotions")) return email.category === "promotions";
  if (q.includes("category:social")) return email.category === "social";
  if (q.includes("category:updates")) return email.category === "updates";

  const cleaned = q
    .replace(/\b(?:from|subject|category|is|in|label):\s*/g, "")
    .trim();
  if (!cleaned) return true;

  const haystack = `${email.from} ${email.subject} ${email.snippet}`.toLowerCase();
  return cleaned
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .some((token) => haystack.includes(token));
}

async function executeFetchRecentEmails(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const query = asString(args.query, "");
  const maxResults = Math.min(50, Math.max(1, Math.round(asNumber(args.maxResults, 20))));
  const userToken = context.googleAccessToken?.trim();

  if (userToken) {
    try {
      const searchParams = new URLSearchParams({ maxResults: String(maxResults) });
      if (query) searchParams.set("q", query);

      const listRes = await callGmailApi(
        `users/me/messages?${searchParams.toString()}`,
        userToken,
        context,
      );
      if (!listRes.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error:
            listRes.status === 401
              ? "انتهت صلاحية جلسة Google. اضغط «Sign in with Google» لتجديد الإذن."
              : `تعذّر جلب الرسائل من Gmail API (HTTP ${listRes.status}).`,
        };
      }

      const listPayload = (listRes.data ?? {}) as {
        messages?: Array<{ id?: string }>;
        resultSizeEstimate?: number;
      };
      const messageIds = (listPayload.messages ?? [])
        .map((ref) => ref.id)
        .filter((id): id is string => Boolean(id))
        .slice(0, maxResults);

      const emails = await fetchGmailMessageMetadata(messageIds, userToken, context);

      return {
        ok: true,
        mode: "google_oauth" satisfies IntegrationMode,
        query: query || "all",
        count: emails.length,
        totalEstimate: listPayload.resultSizeEstimate ?? emails.length,
        emails,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "google_oauth" satisfies IntegrationMode,
        error: error instanceof Error ? error.message : "Gmail API request failed.",
      };
    }
  }

  const matched = query
    ? demoEmailInbox.filter((email) => matchesDemoEmailQuery(email, query))
    : demoEmailInbox;
  const emails = matched.slice(0, maxResults);
  return {
    ok: true,
    mode: "demo_fallback" satisfies IntegrationMode,
    note: "بيانات تجريبية — سجّل الدخول بحساب Google من أعلى الصفحة لقراءة بريدك الفعلي.",
    query: query || "all",
    count: emails.length,
    totalEstimate: matched.length,
    emails,
  };
}

async function executeTrashEmails(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const query = asString(args.query, "");
  const maxResults = Math.min(100, Math.max(1, Math.round(asNumber(args.maxResults, 25))));
  const explicitIds = Array.isArray(args.messageIds)
    ? args.messageIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const previewSubjects = Array.isArray(args.previewSubjects)
    ? args.previewSubjects.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

  if (!query && explicitIds.length === 0) {
    return {
      ok: false,
      error: "حدّد الرسائل المطلوب حذفها (مثل: Firebase أو الرسائل الترويجية أو عنوان المرسل).",
    };
  }

  const userToken = context.googleAccessToken?.trim();

  if (userToken) {
    try {
      let targetIds = explicitIds;
      let matchedSubjects = previewSubjects;

      if (targetIds.length === 0 || !context.confirmedMutation) {
        const effectiveQuery = /\bin:trash\b/i.test(query) ? query : `${query} -in:trash`.trim();
        const searchParams = new URLSearchParams({
          maxResults: String(maxResults),
          q: effectiveQuery,
        });
        const listRes = await callGmailApi(
          `users/me/messages?${searchParams.toString()}`,
          userToken,
          context,
        );

        if (!listRes.ok) {
          return {
            ok: false,
            mode: "google_oauth" satisfies IntegrationMode,
            error:
              listRes.status === 401
                ? "انتهت صلاحية جلسة Google. اضغط «Sign in with Google» لتجديد الإذن."
                : `تعذّر البحث في Gmail API (HTTP ${listRes.status}).`,
          };
        }

        const listPayload = (listRes.data ?? {}) as { messages?: Array<{ id?: string }> };
        targetIds = (listPayload.messages ?? [])
          .map((m) => m.id)
          .filter((id): id is string => Boolean(id))
          .slice(0, maxResults);

        if (targetIds.length === 0) {
          return {
            ok: true,
            mode: "google_oauth" satisfies IntegrationMode,
            query,
            trashedCount: 0,
            count: 0,
            trashedSubjects: [],
            message: `لم أجد رسائل مطابقة للبحث «${query}» لنقلها إلى المهملات.`,
          };
        }

        const previewItems = await fetchGmailMessageMetadata(
          targetIds.slice(0, 6),
          userToken,
          context,
        );
        matchedSubjects = previewItems.map((item) => item.subject);

        if (!context.confirmedMutation) {
          const details: Array<{ labelAr: string; value: string }> = [
            { labelAr: "نطاق البحث", value: query },
            { labelAr: "العدد المطابق", value: `${targetIds.length} رسالة` },
            ...previewItems.slice(0, 4).map((item, idx) => ({
              labelAr: `رسالة ${idx + 1}`,
              value: `${item.subject} — ${item.from}`,
            })),
          ];
          if (targetIds.length > 4) {
            details.push({
              labelAr: "رسائل إضافية",
              value: `و ${targetIds.length - 4} رسالة أخرى مطابقة`,
            });
          }

          const pending: PendingWorkspaceConfirmation = {
            toolName: "trash_emails",
            targetAgentId: context.agentId,
            titleAr: `تأكيد نقل ${targetIds.length} رسالة إلى سلة المهملات`,
            descriptionAr:
              "سيقوم وكيل البريد بنقل هذه الرسائل المطابقة إلى سلة المهملات في Gmail (يمكنك استعادتها من المهملات خلال 30 يوماً).",
            details,
            args: {
              query,
              maxResults,
              messageIds: targetIds,
              previewSubjects: matchedSubjects,
            },
          };
          context.onPendingConfirmation?.(pending);
          return {
            ok: true,
            requiresConfirmation: true,
            mode: "google_oauth" satisfies IntegrationMode,
            pendingConfirmation: pending,
          };
        }
      }

      const modifyRes = await callGmailApi(
        "users/me/messages/batchModify",
        userToken,
        context,
        {
          method: "POST",
          body: JSON.stringify({
            ids: targetIds,
            addLabelIds: ["TRASH"],
            removeLabelIds: ["INBOX"],
          }),
        },
      );

      if (!modifyRes.ok) {
        const isScopeOrAuthError =
          modifyRes.status === 401 ||
          (modifyRes.status === 403 && /insufficient|permission|scope/i.test(modifyRes.text));
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error: isScopeOrAuthError
            ? "صلاحية جلسة Google الحالية لا تشمل تعديل/حذف البريد بعد. اضغط «Sign in with Google» لإعادة منح الصلاحية ثم حاول مجدداً."
            : `تعذّر نقل الرسائل إلى سلة المهملات (HTTP ${modifyRes.status}).`,
        };
      }

      return {
        ok: true,
        mode: "google_oauth" satisfies IntegrationMode,
        query,
        trashedCount: targetIds.length,
        trashedSubjects: matchedSubjects,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "google_oauth" satisfies IntegrationMode,
        error: error instanceof Error ? error.message : "Gmail trash operation failed.",
      };
    }
  }

  const matched = demoEmailInbox
    .filter((email) => matchesDemoEmailQuery(email, query))
    .slice(0, maxResults);
  const matchedIds = new Set(matched.map((email) => email.id));
  for (let i = demoEmailInbox.length - 1; i >= 0; i -= 1) {
    if (matchedIds.has(demoEmailInbox[i].id)) {
      demoEmailInbox.splice(i, 1);
    }
  }

  return {
    ok: true,
    mode: "demo_fallback" satisfies IntegrationMode,
    note: "تمت محاكاة نقل الرسائل إلى المهملات في البريد التجريبي — سجّل الدخول بحساب Google لتنفيذ الحذف على بريدك الفعلي.",
    query,
    trashedCount: matched.length,
    trashedSubjects: matched.map((item) => item.subject),
    remainingCount: demoEmailInbox.length,
  };
}

function encodeRfc2047Utf8(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

async function executeCreateEmailDraft(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const to = sanitizeHeaderValue(asString(args.to));
  const subject = sanitizeHeaderValue(asString(args.subject));
  const body = asString(args.body);

  if (!to || !subject || !body) {
    return {
      ok: false,
      error: "الحقول to و subject و body مطلوبة لإنشاء المسودة.",
    };
  }

  const userToken = context.googleAccessToken?.trim();

  // Require explicit user confirmation before writing a draft to the user's real Gmail account.
  if (userToken && !context.confirmedMutation) {
    const pending: PendingWorkspaceConfirmation = {
      toolName: "create_email_draft",
      targetAgentId: context.agentId,
      titleAr: "تأكيد إنشاء مسودة بريد في Gmail",
      descriptionAr:
        "سيقوم وكيل البريد بإنشاء هذه المسودة وحفظها في حسابك على Gmail (دون إرسالها).",
      details: [
        { labelAr: "المستلم", value: to },
        { labelAr: "الموضوع", value: subject },
        { labelAr: "النص", value: body.slice(0, 160) + (body.length > 160 ? "…" : "") },
      ],
      args: { to, subject, body },
    };
    context.onPendingConfirmation?.(pending);
    return {
      ok: true,
      requiresConfirmation: true,
      mode: "google_oauth" satisfies IntegrationMode,
      pendingConfirmation: pending,
    };
  }

  if (userToken) {
    try {
      const mimeLines = [
        `To: ${to}`,
        `Subject: ${encodeRfc2047Utf8(subject)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(body, "utf8").toString("base64"),
      ];
      const raw = base64UrlEncode(mimeLines.join("\r\n"));

      const draftRes = await callGmailApi("users/me/drafts", userToken, context, {
        method: "POST",
        body: JSON.stringify({ message: { raw } }),
      });

      if (!draftRes.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error:
            draftRes.status === 401
              ? "انتهت صلاحية جلسة Google. أعد تسجيل الدخول بحساب Google ثم حاول مجدداً."
              : `تعذّر إنشاء المسودة عبر Gmail API (HTTP ${draftRes.status}).`,
        };
      }

      const payload = (draftRes.data ?? {}) as { id?: string; message?: { id?: string } };
      return {
        ok: true,
        mode: "google_oauth" satisfies IntegrationMode,
        draftId: payload.id ?? "created",
        messageId: payload.message?.id ?? null,
        to,
        subject,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "google_oauth" satisfies IntegrationMode,
        error: error instanceof Error ? error.message : "Gmail draft creation failed.",
      };
    }
  }

  return {
    ok: true,
    mode: "demo_fallback" satisfies IntegrationMode,
    note: "تمت محاكاة إنشاء المسودة محلياً — سجّل الدخول بحساب Google لحفظها فعلياً في مسودات Gmail.",
    draftId: `draft-demo-${Date.now().toString(36)}`,
    to,
    subject,
    bodyPreview: body.slice(0, 160),
  };
}

// ---------------------------------------------------------------------------
// Finance Manager Implementation
// ---------------------------------------------------------------------------

function normalizeEntryType(raw: unknown): "income" | "expense" {
  const value = asString(raw).toLowerCase();
  if (
    value === "income" ||
    value === "credit" ||
    value.includes("دخل") ||
    value.includes("ايراد") ||
    value.includes("إيراد") ||
    value.includes("فاتورة ص")
  ) {
    return "income";
  }
  return "expense";
}

function parseSheetRows(values: unknown[][]): FinanceEntry[] {
  if (!Array.isArray(values) || values.length === 0) return [];

  const firstRow = values[0].map((cell) => asString(cell).toLowerCase());
  const looksLikeHeader = firstRow.some((cell) =>
    ["date", "type", "amount", "currency", "category", "description", "التاريخ", "النوع", "المبلغ"].some(
      (kw) => cell.includes(kw),
    ),
  );

  const findCol = (keywords: string[], fallbackIndex: number): number => {
    if (!looksLikeHeader) return fallbackIndex;
    const found = firstRow.findIndex((cell) => keywords.some((kw) => cell.includes(kw)));
    return found >= 0 ? found : fallbackIndex;
  };

  const dateCol = findCol(["date", "تاريخ"], 0);
  const typeCol = findCol(["type", "kind", "نوع"], 1);
  const amountCol = findCol(["amount", "total", "مبلغ", "قيمة"], 2);
  const currencyCol = findCol(["currency", "عملة"], 3);
  const categoryCol = findCol(["category", "فئة", "تصنيف"], 4);
  const descCol = findCol(["description", "desc", "note", "وصف", "بيان"], 5);

  const dataRows = looksLikeHeader ? values.slice(1) : values;
  const entries: FinanceEntry[] = [];

  for (const row of dataRows) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const amount = Math.abs(asNumber(row[amountCol], Number.NaN));
    if (!Number.isFinite(amount)) continue;

    entries.push({
      date: asString(row[dateCol], todayIsoDate()),
      type: normalizeEntryType(row[typeCol]),
      amount,
      currency: asString(row[currencyCol], "SAR").toUpperCase() || "SAR",
      category: asString(row[categoryCol], "عام"),
      description: asString(row[descCol], "بند مالي"),
    });
  }

  return entries;
}

function summarizeFinanceEntries(entries: FinanceEntry[], period: string) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const filtered =
    period === "this_month"
      ? entries.filter((entry) => !entry.date || entry.date.startsWith(currentMonth))
      : entries;

  const activeList = filtered.length > 0 || period !== "this_month" ? filtered : entries;

  let totalIncome = 0;
  let totalExpenses = 0;
  const currencyMap = new Map<string, { income: number; expenses: number }>();

  for (const entry of activeList) {
    const bucket = currencyMap.get(entry.currency) ?? { income: 0, expenses: 0 };
    if (entry.type === "income") {
      totalIncome += entry.amount;
      bucket.income += entry.amount;
    } else {
      totalExpenses += entry.amount;
      bucket.expenses += entry.amount;
    }
    currencyMap.set(entry.currency, bucket);
  }

  const byCurrency = Object.fromEntries(
    [...currencyMap.entries()].map(([currency, totals]) => [
      currency,
      {
        income: Math.round(totals.income * 100) / 100,
        expenses: Math.round(totals.expenses * 100) / 100,
        net: Math.round((totals.income - totals.expenses) * 100) / 100,
      },
    ]),
  );

  return {
    period,
    entryCount: activeList.length,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
    byCurrency,
    recentEntries: activeList.slice(-8).reverse(),
  };
}

async function getFirstSheetTitle(
  sheetId: string,
  token: string,
  context: AgentToolContext,
): Promise<{ ok: true; tabTitle: string } | { ok: false; status: number }> {
  const metaRes = await fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (metaRes.status === 401) {
    context.onAuthExpired?.();
  }
  if (!metaRes.ok) {
    return { ok: false, status: metaRes.status };
  }
  const meta = (metaRes.data ?? {}) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  const firstTitle = meta.sheets?.[0]?.properties?.title?.trim() || "Sheet1";
  return { ok: true, tabTitle: firstTitle };
}

function formatA1Range(tabTitle: string, cells: string): string {
  const escaped = tabTitle.replace(/'/g, "''");
  return `'${escaped}'!${cells}`;
}

async function createDefaultFinanceSheet(
  token: string,
  context: AgentToolContext,
): Promise<{ sheetId: string; sheetUrl: string; tabTitle: string }> {
  const tabTitle = "Transactions";
  const createRes = await fetchJson("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "المكتب الافتراضي — السجل المالي" },
      sheets: [{ properties: { title: tabTitle } }],
    }),
  });

  if (createRes.status === 401) {
    context.onAuthExpired?.();
  }
  if (!createRes.ok || !createRes.data || typeof createRes.data !== "object") {
    throw new Error(`تعذّر إنشاء جدول Google Sheet تلقائياً (HTTP ${createRes.status}).`);
  }

  const created = createRes.data as { spreadsheetId?: string; spreadsheetUrl?: string };
  const sheetId = asString(created.spreadsheetId);
  const sheetUrl =
    asString(created.spreadsheetUrl) ||
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit`;

  if (!sheetId) {
    throw new Error("لم يرجع Google Sheets معرّف الجدول الجديد.");
  }

  // Write clean column headers into the new spreadsheet
  await fetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(formatA1Range(tabTitle, "A1:F1"))}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [["date", "type", "amount", "currency", "category", "description"]],
      }),
    },
  );

  context.onCreatedSheet?.(sheetId, sheetUrl);
  return { sheetId, sheetUrl, tabTitle };
}

async function resolveTargetSheet(
  userSheetId: string,
  token: string,
  context: AgentToolContext,
): Promise<{ ok: true; sheetId: string; tabTitle: string } | { ok: false; error: string }> {
  if (!userSheetId) {
    const created = await createDefaultFinanceSheet(token, context);
    return { ok: true, sheetId: created.sheetId, tabTitle: created.tabTitle };
  }

  const meta = await getFirstSheetTitle(userSheetId, token, context);
  if (!meta.ok) {
    return {
      ok: false,
      error:
        meta.status === 401
          ? "انتهت صلاحية جلسة Google. أعد تسجيل الدخول بحساب Google."
          : `تعذّر الوصول إلى جدول Google Sheet (HTTP ${meta.status}).`,
    };
  }

  return { ok: true, sheetId: userSheetId, tabTitle: meta.tabTitle };
}

async function executeGetFinancialSummary(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const period = asString(args.period, "this_month") || "this_month";
  const userToken = context.googleAccessToken?.trim();
  const userSheetId = context.sheetId?.trim() ?? "";

  if (userToken) {
    try {
      const resolvedSheet = await resolveTargetSheet(userSheetId, userToken, context);
      if (!resolvedSheet.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error: resolvedSheet.error,
        };
      }
      const { sheetId, tabTitle } = resolvedSheet;

      const range = formatA1Range(tabTitle, "A:F");
      const res = await fetchJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${userToken}` },
        },
      );

      if (res.status === 401) {
        context.onAuthExpired?.();
      }
      if (!res.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error: `تعذّر قراءة Google Sheet (HTTP ${res.status}).`,
        };
      }

      const payload = (res.data ?? {}) as { values?: unknown[][] };
      const entries = parseSheetRows(payload.values ?? []);
      return {
        ok: true,
        mode: "google_oauth" satisfies IntegrationMode,
        sheetId,
        ...summarizeFinanceEntries(entries, period),
      };
    } catch (error) {
      return {
        ok: false,
        mode: "google_oauth" satisfies IntegrationMode,
        error: error instanceof Error ? error.message : "Google Sheets read failed.",
      };
    }
  }

  return {
    ok: true,
    mode: "demo_fallback" satisfies IntegrationMode,
    note: "ملخص مالي تجريبي — سجّل الدخول بحساب Google من أعلى الصفحة لربط Google Sheets تلقائياً.",
    ...summarizeFinanceEntries(demoFinanceLedger, period),
  };
}

async function executeLogExpenseOrInvoice(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const type = args.type === "income" ? "income" : "expense";
  const amount = Math.abs(asNumber(args.amount, Number.NaN));
  const currency = asString(args.currency, "SAR").toUpperCase() || "SAR";
  const category = asString(args.category, "عام");
  const description = asString(args.description);
  const date = asString(args.date, todayIsoDate()) || todayIsoDate();

  if (!Number.isFinite(amount) || amount <= 0 || !description) {
    return {
      ok: false,
      error: "المبلغ الموجب والوصف مطلوبان لتسجيل العملية المالية.",
    };
  }

  const entry: FinanceEntry = { date, type, amount, currency, category, description };
  const userToken = context.googleAccessToken?.trim();
  const userSheetId = context.sheetId?.trim() ?? "";

  // Require explicit user confirmation before appending to the user's real Google Sheet.
  if (userToken && !context.confirmedMutation) {
    const typeLabel = type === "income" ? "دخل / فاتورة واردة" : "مصروف";
    const pending: PendingWorkspaceConfirmation = {
      toolName: "log_expense_or_invoice",
      targetAgentId: context.agentId,
      titleAr: "تأكيد إضافة عملية مالية إلى Google Sheets",
      descriptionAr:
        "سيقوم الوكيل بإضافة هذا الصف الجديد إلى جدول Google Sheets المرتبط بحسابك.",
      details: [
        { labelAr: "النوع", value: typeLabel },
        { labelAr: "المبلغ", value: `${amount} ${currency}` },
        { labelAr: "التصنيف", value: category },
        { labelAr: "التاريخ", value: date },
        { labelAr: "الوصف", value: description },
      ],
      args: { ...entry },
    };
    context.onPendingConfirmation?.(pending);
    return {
      ok: true,
      requiresConfirmation: true,
      mode: "google_oauth" satisfies IntegrationMode,
      pendingConfirmation: pending,
    };
  }

  if (userToken) {
    try {
      const resolvedSheet = await resolveTargetSheet(userSheetId, userToken, context);
      if (!resolvedSheet.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error: resolvedSheet.error,
        };
      }
      const { sheetId, tabTitle } = resolvedSheet;

      const range = formatA1Range(tabTitle, "A:F");
      const res = await fetchJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [[date, type, amount, currency, category, description]],
          }),
        },
      );

      if (res.status === 401) {
        context.onAuthExpired?.();
      }
      if (!res.ok) {
        return {
          ok: false,
          mode: "google_oauth" satisfies IntegrationMode,
          error: `تعذّر إضافة الصف إلى Google Sheet (HTTP ${res.status}).`,
        };
      }

      const payload = (res.data ?? {}) as { updates?: { updatedRange?: string } };
      return {
        ok: true,
        mode: "google_oauth" satisfies IntegrationMode,
        sheetId,
        updatedRange: payload.updates?.updatedRange ?? range,
        entry,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "google_oauth" satisfies IntegrationMode,
        error: error instanceof Error ? error.message : "Google Sheets append failed.",
      };
    }
  }

  demoFinanceLedger.push(entry);
  return {
    ok: true,
    mode: "demo_fallback" satisfies IntegrationMode,
    note: "تمت محاكاة تسجيل العملية في السجل التجريبي — سجّل الدخول بحساب Google لحفظها في Google Sheets.",
    rowNumber: demoFinanceLedger.length + 1,
    entry,
  };
}

// ---------------------------------------------------------------------------
// Tool Registry (strictly scoped by agent role)
// ---------------------------------------------------------------------------

const EMAIL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "fetch_recent_emails",
    description:
      "جلب وفرز أحدث رسائل البريد الإلكتروني (المرسل، العنوان، التاريخ، والمقتطف) من صندوق الوارد أو بحسب استعلام.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "استعلام بحث Gmail مثل is:unread أو category:promotions أو اسم مرسل أو كلمة مفتاحية.",
        },
        maxResults: {
          type: Type.INTEGER,
          description: "عدد الرسائل المطلوبة (الافتراضي 20، بحد أقصى 50).",
        },
      },
    },
  },
  {
    name: "create_email_draft",
    description: "إنشاء مسودة رسالة أو رد بريد إلكتروني جديدة وحفظها في المسودات.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: {
          type: Type.STRING,
          description: "عنوان البريد الإلكتروني للمستلم.",
        },
        subject: {
          type: Type.STRING,
          description: "موضوع الرسالة.",
        },
        body: {
          type: Type.STRING,
          description: "محتوى الرسالة الكامل.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "trash_emails",
    description:
      "البحث عن رسائل بريد مطابقة (مثل رسائل شركة معينة أو category:promotions) ونقلها إلى سلة المهملات في Gmail بعد تأكيد المستخدم.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            "استعلام بحث Gmail لتحديد الرسائل المراد نقلها إلى المهملات، مثل Firebase أو category:promotions أو from:example@domain.com.",
        },
        maxResults: {
          type: Type.INTEGER,
          description: "الحد الأقصى لعدد الرسائل المطابقة التي تُنقل إلى المهملات (الافتراضي 25، بحد أقصى 100).",
        },
      },
      required: ["query"],
    },
  },
];

const FINANCE_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_financial_summary",
    description:
      "قراءة سجل الفواتير والمصروفات وحساب إجمالي الدخل والمصروفات وصافي الرصيد وأحدث البنود.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "الفترة المطلوبة: this_month أو all.",
        },
      },
    },
  },
  {
    name: "log_expense_or_invoice",
    description:
      "تسجيل مصروف جديد أو دخل/فاتورة في الجدول المالي وإرجاع تأكيد الصف المضاف.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ["income", "expense"],
          format: "enum",
          description: "نوع العملية: income للدخل أو expense للمصروف.",
        },
        amount: {
          type: Type.NUMBER,
          description: "قيمة المبلغ.",
        },
        currency: {
          type: Type.STRING,
          description: "العملة مثل SAR أو USD أو EUR.",
        },
        category: {
          type: Type.STRING,
          description: "التصنيف المالي للعملية.",
        },
        description: {
          type: Type.STRING,
          description: "وصف العملية أو الفاتورة.",
        },
        date: {
          type: Type.STRING,
          description: "التاريخ بصيغة YYYY-MM-DD (اختياري).",
        },
      },
      required: ["type", "amount", "currency", "category", "description"],
    },
  },
];

export async function executeCreateNewAgent(
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  const nameAr = asString(args.nameAr, "").slice(0, 60);
  const roleAr = asString(args.roleAr, "").slice(0, 60);
  const roomNameAr = asString(args.roomNameAr, "").slice(0, 80);
  const targetRoomId = asString(args.targetRoomId, "").trim() || undefined;
  const rules = asString(args.rules, "").slice(0, 1400);
  const furnitureStyle = normalizeFurnitureStyle(args.furnitureStyle);
  const themeColor = normalizeHexColor(args.themeColor, furnitureStyle);
  const skills = normalizeSkillList(args.skills);

  if (!nameAr || !roleAr) {
    return {
      ok: false,
      error: "اسم الوكيل (nameAr) ودوره الوظيفي (roleAr) مطلوبان لإنشاء وكيل جديد.",
    };
  }

  const resolvedRoomName = roomNameAr || `غرفة ${roleAr}`;
  const resolvedRules =
    rules ||
    `أنت ${nameAr} (${roleAr}). نفّذ المهام الموكلة إليك بدقة عالية وتقديم نتائج واضحة باللغة العربية.`;

  const spec: CreatedAgentSpec = {
    nameAr,
    roleAr,
    roleEn: asString(args.roleEn, ""),
    roomNameAr: resolvedRoomName,
    targetRoomId,
    rules: resolvedRules,
    skills,
    themeColor,
    furnitureStyle,
  };

  context.onCreatedAgent?.(spec);
  return {
    ok: true,
    created: spec,
  };
}

const GM_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "create_new_agent",
    description:
      "إنشاء وكيل ذكاء اصطناعي جديد وتسكينه في المقر الافتراضي — إما ببناء غرفة جديدة له أو بإضافته إلى غرفة موجودة إذا طلب المستخدم إضافته لنفس الغرفة أو مع وكيل آخر.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameAr: {
          type: Type.STRING,
          description: "الاسم العربي الكامل للوكيل الجديد مثل: طارق القحطاني أو نورة السبيعي أو ليلى الحربي.",
        },
        roleAr: {
          type: Type.STRING,
          description: "المسمى الوظيفي بالعربية مثل: مطوّر الويب أو مصممة بوسترات أو مسؤول المبيعات.",
        },
        roleEn: {
          type: Type.STRING,
          description: "المسمى الوظيفي بالإنجليزية (اختياري) مثل: Web Developer أو Poster Designer.",
        },
        roomNameAr: {
          type: Type.STRING,
          description:
            "اسم الغرفة بالعربية. إذا كان الوكيل سيضاف لغرفة قائمة، اكتب اسم تلك الغرفة بدقة (مثال: غرفة التسويق والمحتوى).",
        },
        targetRoomId: {
          type: Type.STRING,
          description:
            "معرّف الغرفة الموجودة في حال طلب المستخدم إضافة الوكيل لنفس الغرفة أو لغرفة قائمة من قائمة الغرف المتاحة (مثل معرّف غرفة موجودة أو gm). اتركه فارغاً فقط إذا طلب غرفة جديدة مستقلة.",
        },
        rules: {
          type: Type.STRING,
          description: "القواعد والتعليمات الصارمة التي يلتزم بها الوكيل في ردوده وعمله.",
        },
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "قائمة معرّفات المهارات المناسبة من: task-management, research-summary, data-analysis, email-drafting, code-writing, gmail-workspace, sheets-finance.",
        },
        themeColor: {
          type: Type.STRING,
          description: "لون السمة السداسي (hex) للغرفة والشخصية مثل #5aa9e6 أو #e58a62 أو #9ab77a.",
        },
        furnitureStyle: {
          type: Type.STRING,
          enum: ["tech", "creative", "admin", "finance"],
          format: "enum",
          description: "طراز الأثاث والديكور المناسب لدور الوكيل: tech أو creative أو admin أو finance.",
        },
      },
      required: ["nameAr", "roleAr", "roomNameAr", "rules", "skills", "themeColor", "furnitureStyle"],
    },
  },
];

async function executeWorkspaceTool(
  call: { name: string; args: Record<string, unknown> },
  context: AgentToolContext,
): Promise<Record<string, unknown>> {
  if (call.name === "create_new_agent") {
    return executeCreateNewAgent(call.args, context);
  }
  if (call.name === "fetch_recent_emails") {
    return executeFetchRecentEmails(call.args, context);
  }
  if (call.name === "create_email_draft") {
    return executeCreateEmailDraft(call.args, context);
  }
  if (call.name === "trash_emails") {
    return executeTrashEmails(call.args, context);
  }
  if (call.name === "get_financial_summary") {
    return executeGetFinancialSummary(call.args, context);
  }
  if (call.name === "log_expense_or_invoice") {
    return executeLogExpenseOrInvoice(call.args, context);
  }
  return { ok: false, error: `الأداة "${call.name}" غير مدعومة.` };
}

export function getToolsForAgent(agentId: AgentId, skills?: string[]): AgentToolSet {
  const declarations: FunctionDeclaration[] = [];

  if (agentId === GM_AGENT_ID) {
    declarations.push(...GM_DECLARATIONS);
  }

  const effectiveSkills =
    skills && skills.length > 0
      ? skills
      : agentId === "email"
        ? ["gmail-workspace"]
        : agentId === "finance"
          ? ["sheets-finance"]
          : [];

  const groups = getActiveToolGroups(effectiveSkills);
  if (groups.has("gmail")) {
    declarations.push(...EMAIL_DECLARATIONS);
  }
  if (groups.has("sheets")) {
    declarations.push(...FINANCE_DECLARATIONS);
  }

  return {
    declarations,
    execute: executeWorkspaceTool,
  };
}

export function getToolConfig(agentId: AgentId, skills?: string[]): Tool[] {
  const toolSet = getToolsForAgent(agentId, skills);
  if (toolSet.declarations.length === 0) return [];
  return [{ functionDeclarations: toolSet.declarations }];
}
