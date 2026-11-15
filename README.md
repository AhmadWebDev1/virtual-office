# المكتب الافتراضي — Virtual HQ

لوحة تحكم عربية (RTL) لمكتب افتراضي من طابق واحد، مبنيّة بـ Next.js 16 وReact 19 وTailwind CSS 4. الخريطة مرسومة بالكامل على Canvas بأسلوب pixel-art، وتشمل أربع غرف وخمسة وكلاء، وتبديل ليل/نهار، وتكبيراً وتحريكاً للكاميرا، ونافذة تفاصيل لكل وكيل، وشريط أوامر سفلي متصل بمسار API.

## التشغيل المحلي

المتطلبات: Node.js 20.9 أو أحدث (يُفضّل 22 LTS).

```powershell
cd "C:\Users\alkah\Desktop 2\Neuer Ordner (2)"
npm install
npm run dev
```

افتح `http://localhost:3000`.

يعمل المشروع بدون أي متغيرات بيئة عبر المحرك المحلي الاحتياطي. لتفعيل Gemini أضف `GEMINI_API_KEY` كما في القسم التالي.

## تفعيل Gemini

أنشئ ملف `.env.local` في جذر المشروع وأضف المفتاح:

```text
GEMINI_API_KEY=ضع_مفتاحك_هنا
```

احصل على المفتاح من [Google AI Studio](https://aistudio.google.com/apikey)، ثم أعد تشغيل الخادم.

- أمر `auto` يُصنّف عبر `gemini-3.5-flash-lite` مع Structured Outputs، ويتحوّل تلقائياً إلى `gemini-2.5-flash` عند تعذّر الموديل الأساسي أو نفاد حصته.
- لكل وكيل تعليمات نظام عربية ودور مستقل: المدير العام، الإيميلات، المالية، التصميم، والإنستغرام.
- الاستجابة تحمل `source: "gemini"`، و`messages.logAr` ملخصاً تفصيلياً، و`durationMs` بين 2000 و4000.
- عند غياب المفتاح أو فشل أي استدعاء، يعود المشروع تلقائياً إلى المحرك المحلي دون تعطّل الواجهة، ويحمل الرد `source: "local-runtime"`.
- المفتاح يُقرأ على الخادم فقط ولا يصل إلى المتصفح.

## التشغيل من الهاتف على نفس الشبكة

```powershell
npm run dev -- -H 0.0.0.0
```

افتح على الهاتف عنوان الشبكة الظاهر في مخرجات التشغيل، مثل `http://10.10.1.82:3000`. اسمح لـ Node.js عبر جدار حماية Windows عند ظهور الطلب.

## نسخة الإنتاج

لا تستخدم `npm run dev` للنشر. شغّل:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

يعمل الإنتاج افتراضياً على المنفذ 3000. لتغييره:

```powershell
npm run start -- -p 8080
```

للوصول من الهاتف في وضع الإنتاج:

```powershell
npm run start -- -H 0.0.0.0
```

## النشر على Vercel

اربط المستودع بـ Vercel أو شغّل `npx vercel` من مجلد المشروع. إعدادات Next.js تُكتشف تلقائياً، ومسار `/api/agent` يعمل كـ Serverless Route دون تعديل. أضف `GEMINI_API_KEY` في Project Settings → Environment Variables قبل النشر.

## ما الذي يعمل الآن، وما الذي يبقى تجريبياً

يعمل فعلياً:

- رسم المكتب والوكلاء والحالات والإضاءة والكاميرا والتصفية بالكامل في المتصفح.
- شريط الأوامر يستدعي `POST /api/agent`، والمسار يتحقق من الطلب ويعيد وكيلاً ومهمة ورسائل.
- توجيه تلقائي عبر Gemini Structured Outputs عند وجود المفتاح، ومطابقة كلمات مفتاحية محلية كاحتياط.
- خمس شخصيات عربية مستقلة تُولّد عنوان المهمة وفقاعات الحوار والملخص التفصيلي.
- تحديث حالة الوكيل من «يشتغل» إلى «خلصت» مع فقاعة حوار وسجل مهام.
- سجل المهام يعرض الردّ الكامل من Gemini مع شارة المصدر (`Gemini` أو `محلي`).
- حفظ حالات الوكلاء والمهام النشطة والسجل في `localStorage`، واستكمال المهام بعد إعادة تحميل الصفحة.
- زر «إعادة ضبط المكتب» في الرأس يمسح الحالة المحلية ويعيد الوكلاء إلى البداية.

يبقى تجريبياً:

- الحفظ محلي لكل متصفح، ولا يتزامن بين الأجهزة أو المستخدمين.
- لا توجد قاعدة بيانات أو مصادقة أو صلاحيات أو طابور مهام أو Rate Limiting.
- أدوات Gmail وGoogle Sheets غير موصولة بعد؛ هيكل الربط جاهز في `src/lib/agent-tools.ts`.

## ربط Gmail وGoogle Sheets

سجّل الأدوات في `src/lib/agent-tools.ts`:

```ts
export const AGENT_TOOLS: Partial<Record<AgentId, AgentToolSet>> = {
  email: {
    declarations: [{ name: "searchGmail", description: "...", parameters: { /* ... */ } }],
    execute: async (call, context) => {
      // Call the Gmail MCP server or Google API here.
      return { messages: [] };
    },
  },
  finance: {
    declarations: [{ name: "appendToSheet", description: "...", parameters: { /* ... */ } }],
    execute: async (call, context) => {
      // Call the Google Sheets MCP server or Sheets API here.
      return { updated: true };
    },
  },
};
```

- المحرك يرسل `declarations` إلى Gemini تلقائياً ويستدعي `execute` عند طلب النموذج أداة، ثم يعيد النتيجة للنموذج قبل الرد النهائي.
- اقرأ مفاتيح Gmail وGoogle من متغيرات بيئة على الخادم فقط.
- يمكن استبدال `execute` باستدعاء MCP server مباشرة دون تغيير المسار أو الواجهة.
- اختبر الصلاحيات: اطلب أقل نطاق ممكن (قراءة الوارد أو إضافة صف واحد) قبل فتح الكتابة الكاملة.

## واجهة الـ API

```http
POST /api/agent
Content-Type: application/json

{ "target": "auto", "command": "صمم كفر جديد لآيفون 16" }
```

- `target`: معرّف وكيل (`gm`, `email`, `finance`, `cover`, `instagram`) أو `auto`.
- `command`: من 1 إلى 320 حرفاً.
- الاستجابة: `agentId`, `routedBy`, `task`, `messages`, `source`.
- `messages`: `startAr` و`completionAr` للفقاعات، و`logAr` ملخص تفصيلي.
- `source`: `gemini` عند نجاح الاتصال، أو `local-runtime` عند استخدام الاحتياط.

```powershell
curl.exe -X POST http://localhost:3000/api/agent `
  -H "Content-Type: application/json" `
  -d '{\"target\":\"auto\",\"command\":\"راجع الوارد\"}'
```

## بنية المشروع

```text
src/app/                 الصفحة والتخطيط وglobals.css ومسار API
src/components/          الواجهة، الخريطة، النافذة، شريط الأوامر
src/components/office/   رسم المشهد والـ sprites
src/data/agents.ts       مصدر الحقيقة للوكلاء والغرف والحالات
src/lib/agent-runtime.ts محرك Gemini والتوجيه والاحتياط المحلي
src/lib/agent-tools.ts    ربط أدوات Gmail وGoogle Sheets بالوكلاء
src/lib/office-storage.ts حفظ واستعادة حالة المكتب من localStorage
src/lib/agent-contracts.ts عقود الطلب والاستجابة
```
