import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
] as const;

function generateRuleLocally(
  draft: string,
  scope: string,
  roleAr?: string,
  contextTitle?: string,
): string {
  const cleanDraft = draft.trim().replace(/^قاعدة:\s*/, "");
  const roleName = roleAr || (scope === "global" ? "كافة وكلاء المقر" : "الوكيل المختص");
  const scopeLabel =
    scope === "global"
      ? "المستوى العام للشركة والمكتب"
      : scope === "room"
        ? `مستوى القسم (${contextTitle || "الغرفة"})`
        : `الوكيل الفردي (${roleName})`;

  return [
    `# ميثاق العمل والتعليمات الصارمة — [نطاق: ${scopeLabel}]`,
    `## 1. التوجيه الأساسي:`,
    `- يلتزم ${roleName} بتنفيذ التوجيه التالي بأقصى درجات الدقة والاحترافية: ${cleanDraft}.`,
    `## 2. معايير التنفيذ والقيود:`,
    `- التحقق الفوري من صحة المدخلات والبيانات المرفقة قبل الشروع في الإجراء.`,
    `- صياغة المخرجات والتقارير بلغة عربية فصحى موجزة مع استخدام الجداول والأرقام عند توفرها.`,
    `- عدم اتخاذ أي إجراء حذف أو تعديل خارجي حساس دون التحقق المسبق أو الحصول على موافقة معتمدة.`,
    `## 3. تسليم المخرجات:`,
    `- توثيق كافة النتائج في تقرير موجز مع إشعار المدير العام فور إتمام المهمة وحفظ المخرج في الخزنة.`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: string;
      scope?: "global" | "room" | "agent";
      roleAr?: string;
      contextTitle?: string;
    };

    const draft = body.draft?.trim() || "";
    const scope = body.scope || "agent";
    const roleAr = body.roleAr;
    const contextTitle = body.contextTitle;

    if (!draft || draft.length < 3) {
      return NextResponse.json(
        { ok: false, error: "يرجى كتابة مسودة أو فكرة للقاعدة أولاً." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `أنت مهندس صياغة تعليمات برمجية (Senior Prompt Engineer) متخصص لوكلاء الذكاء الاصطناعي في منصة RPG إدارية عربية.
مهمتك: تحويل مسودة المستخدم (سواء كانت عامية أو مختصرة أو فكرة خام) إلى تعليمة تشغيلية صارمة، واضحة، محكمة، وخالية من الحشو.
الشروط:
1. الصياغة بلغة عربية فصحى احترافية ومباشرة بصيغة التزامات وشروط تنفيذية.
2. مراعاة النطاق: ${scope} والدور: ${roleAr || "وكيل"}.
3. أخرج نص القاعدة النهائي مباشرة فقط دون أي تمهيد، اعتذار، أو ختام.`;

        for (const model of GEMINI_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `حوّل هذه المسودة إلى قاعدة نظام صارمة ودقيقة:\n«${draft}»\nسياق النطاق: ${scope} (${contextTitle || roleAr || "مكتب"})`,
                    },
                  ],
                },
              ],
              config: {
                systemInstruction,
                abortSignal: AbortSignal.timeout(12000),
              },
            });

            const candidate = response.text?.trim();
            if (candidate && candidate.length > 10) {
              return NextResponse.json({
                ok: true,
                optimizedRule: candidate,
                source: "gemini",
              });
            }
          } catch {
            // Try next model or fallback
          }
        }
      } catch {
        // Fallback to local rule optimizer
      }
    }

    // Local deterministic optimizer fallback
    const optimized = generateRuleLocally(draft, scope, roleAr, contextTitle);
    return NextResponse.json({
      ok: true,
      optimizedRule: optimized,
      source: "rule-engine",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذّر تحسين القاعدة.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
