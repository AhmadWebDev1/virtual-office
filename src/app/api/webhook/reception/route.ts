import { NextResponse } from "next/server";

export interface IncomingReceptionEvent {
  id: string;
  sender: string;
  channel: "email" | "webhook" | "chat" | "api";
  subject: string;
  message: string;
  timestamp: number;
  priority: "normal" | "high" | "urgent";
}

// In-memory ring buffer for recent incoming webhook events (latest 20)
const RECENT_INCOMING_EVENTS: IncomingReceptionEvent[] = [
  {
    id: "rec-evt-preset-1",
    sender: "عميل تجاري — متجر فخامة",
    channel: "webhook",
    subject: "طلب تسعيرة عاجل لحملة الجمعة البيضاء",
    message: "نحتاج تصميم 6 بوسترات تسويقية وكتابة سكريبتات ريلز تفاعلية للمتجر.",
    timestamp: 1763300000000 - 3600_000,
    priority: "urgent",
  },
];

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Virtual Office Public Receptionist Gateway",
    endpoint: "/api/webhook/reception",
    supportedMethods: ["POST", "GET"],
    schema: {
      sender: "string (اسم المرسل أو الخدمة)",
      channel: "email | webhook | chat | api",
      subject: "string (عنوان أو موضوع الطلب)",
      message: "string (نص الرسالة أو تفاصيل الطلب الوارد)",
      priority: "normal | high | urgent",
    },
    recentEventsCount: RECENT_INCOMING_EVENTS.length,
    recentEvents: RECENT_INCOMING_EVENTS.slice(0, 5),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<IncomingReceptionEvent>;

    const message = body.message?.trim();
    if (!message || message.length < 3) {
      return NextResponse.json(
        { ok: false, error: "يجب تقديم نص الرسالة (message) للطلب الوارد." },
        { status: 400 },
      );
    }

    const event: IncomingReceptionEvent = {
      id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      sender: body.sender?.trim() || "عميل خارجي",
      channel: body.channel || "webhook",
      subject: body.subject?.trim() || "رسالة واردة عبر بوابة الاستقبال",
      message: message.slice(0, 1000),
      timestamp: Date.now(),
      priority: body.priority || "normal",
    };

    RECENT_INCOMING_EVENTS.unshift(event);
    if (RECENT_INCOMING_EVENTS.length > 20) {
      RECENT_INCOMING_EVENTS.pop();
    }

    // Infer recommended target based on message content
    const norm = event.message.toLowerCase();
    let suggestedTarget = "gm";
    if (/(?:بوستر|تصميم|ريلز|انستقرام|محتوى|تسويق)/.test(norm)) {
      suggestedTarget = "room-marketing";
    } else if (/(?:فاتورة|حساب|ميزانية|سداد|مالي)/.test(norm)) {
      suggestedTarget = "finance";
    }

    return NextResponse.json({
      ok: true,
      message: "تم استلام الطلب الخارجي بنجاح في مكتب الاستقبال وتحويله للمدير العام.",
      event,
      suggestedTarget,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذّر استقبال الطلب.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
