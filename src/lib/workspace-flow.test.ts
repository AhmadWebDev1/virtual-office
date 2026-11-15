import test from "node:test";
import assert from "node:assert/strict";
import { parseSpreadsheetId } from "./sheet-utils";
import { formatGoogleSignInError, isSameOriginAuthHost } from "./workspace-auth-error";
import {
  executeAgentCommand,
  localAgentRuntime,
  parseEmailCommandIntent,
} from "./agent-runtime";
import {
  INITIAL_AGENTS,
  INITIAL_ROOMS,
  computeRoomPlacement,
  createAgentAndRoomFromSpec,
  getWorldDimensions,
  type Agent,
} from "../data/agents";
import { parseCustomSkillInput } from "../data/skills";
import type { AgentPromptProfile } from "./agent-contracts";

function toPromptProfile(agent: Agent, roomNameAr: string): AgentPromptProfile {
  return {
    id: agent.id,
    nameAr: agent.nameAr,
    roleAr: agent.roleAr,
    roleEn: agent.roleEn,
    roomNameAr,
    rules: agent.rules,
    skills: [...agent.skills],
    customSkills: [...(agent.customSkills ?? [])],
  };
}

const TEST_EMAIL_FINANCE_AGENTS: AgentPromptProfile[] = [
  toPromptProfile(INITIAL_AGENTS[0], "غرفة المدير العام"),
  {
    id: "email",
    nameAr: "ريم الشمري",
    roleAr: "مدير الإيميلات",
    roleEn: "Email Manager",
    roomNameAr: "غرفة البريد",
    rules: "فرز البريد وحفظ المسودات وحذف الرسائل المزعجة بعد التأكيد.",
    skills: ["gmail-workspace", "email-drafting"],
    customSkills: [],
  },
  {
    id: "finance",
    nameAr: "خالد الدوسري",
    roleAr: "المدير المالي",
    roleEn: "Finance Manager",
    roomNameAr: "غرفة المالية",
    rules: "حساب التدفقات المالية وتسجيل المصروفات والفواتير في Google Sheets.",
    skills: ["sheets-finance", "data-analysis"],
    customSkills: [],
  },
];

test("initial virtual office starts with only 1 room and 1 General Manager agent", () => {
  assert.equal(INITIAL_ROOMS.length, 1);
  assert.equal(INITIAL_ROOMS[0].id, "gm");
  assert.equal(INITIAL_ROOMS[0].nameAr, "غرفة المدير العام");

  assert.equal(INITIAL_AGENTS.length, 1);
  assert.equal(INITIAL_AGENTS[0].id, "gm");
  assert.equal(INITIAL_AGENTS[0].roleAr, "المدير العام");
});

test("procedural grid layout expands rows and alternates columns accurately", () => {
  const row1Single = getWorldDimensions(INITIAL_ROOMS);
  assert.equal(row1Single.rowCount, 1);
  assert.equal(row1Single.height, 382);

  const p0 = computeRoomPlacement(0);
  const p1 = computeRoomPlacement(1);
  const p2 = computeRoomPlacement(2);
  const p4 = computeRoomPlacement(4);

  assert.equal(p0.col, 0);
  assert.equal(p0.row, 0);
  assert.equal(p1.col, 1);
  assert.equal(p1.row, 0);
  assert.equal(p2.col, 0);
  assert.equal(p2.row, 1);
  assert.equal(p4.col, 0);
  assert.equal(p4.row, 2);

  const dummyRooms3 = [INITIAL_ROOMS[0], INITIAL_ROOMS[0], INITIAL_ROOMS[0]];
  const row2 = getWorldDimensions(dummyRooms3);
  assert.equal(row2.rowCount, 2);
  assert.equal(row2.height, 602);

  const dummyRooms5 = [...dummyRooms3, INITIAL_ROOMS[0], INITIAL_ROOMS[0]];
  const row3 = getWorldDimensions(dummyRooms5);
  assert.equal(row3.rowCount, 3);
  assert.equal(row3.height, 868);
});

test("parseCustomSkillInput parses Markdown and JSON skills and rejects invalid input", () => {
  const md = parseCustomSkillInput(
    "# مهارة تدقيق الكود\n- راجع الأنواع بدقة.\n- اذكر حالات الاختبار.",
  );
  assert.equal(md.ok, true);
  if (md.ok) {
    assert.equal(md.skill.format, "markdown");
    assert.equal(md.skill.nameAr, "مهارة تدقيق الكود");
    assert.match(md.skill.promptInstruction, /راجع الأنواع/);
  }

  const json = parseCustomSkillInput(
    JSON.stringify({
      nameAr: "مراقب الجودة",
      descriptionAr: "تقييم المخرجات",
      promptInstruction: "تأكد من عدم وجود ثغرات قبل الاعتماد.",
    }),
  );
  assert.equal(json.ok, true);
  if (json.ok) {
    assert.equal(json.skill.format, "json");
    assert.equal(json.skill.nameAr, "مراقب الجودة");
  }

  const badJson = parseCustomSkillInput("{broken json");
  assert.equal(badJson.ok, false);

  const incomplete = parseCustomSkillInput(JSON.stringify({ nameAr: "بدون تعليمات" }));
  assert.equal(incomplete.ok, false);
});

test("GM creates new procedural agent + room and auto-router subsequently delegates matching commands", async () => {
  const createRes = await executeAgentCommand(
    {
      target: "auto",
      command: "أنشئ وكيل مبرمج ويب وضع له قواعد صارمة",
      agents: [toPromptProfile(INITIAL_AGENTS[0], INITIAL_ROOMS[0].nameAr)],
    },
    localAgentRuntime,
  );

  assert.equal(createRes.ok, true);
  assert.equal(createRes.agentId, "gm");
  assert.ok(createRes.createdAgent);
  assert.equal(createRes.createdAgent.furnitureStyle, "tech");
  assert.ok(createRes.createdAgent.skills.includes("code-writing"));
  assert.match(createRes.createdAgent.rules, /صارم|TypeScript/);

  const { agent: devAgent, room: devRoom } = createAgentAndRoomFromSpec(
    createRes.createdAgent,
    INITIAL_AGENTS,
    INITIAL_ROOMS,
  );
  assert.equal(devRoom.rect.x, 452); // Second slot (col 1, row 0)
  assert.equal(devRoom.furnitureStyle, "tech");
  assert.equal(devAgent.roomId, devRoom.id);

  // Subsequent coding request with target="auto" must dynamically route to the newly hired agent.
  const routedRes = await executeAgentCommand(
    {
      target: "auto",
      command: "اكتب كود React نظيف لمكون البحث",
      agents: [
        toPromptProfile(INITIAL_AGENTS[0], INITIAL_ROOMS[0].nameAr),
        toPromptProfile(devAgent, devRoom.nameAr),
      ],
    },
    localAgentRuntime,
  );

  assert.equal(routedRes.ok, true);
  assert.equal(routedRes.agentId, devAgent.id);
  assert.equal(routedRes.routedBy, "gm");
});

test("parseSpreadsheetId extracts ID from full URL and raw ID", () => {
  assert.equal(
    parseSpreadsheetId(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_123/edit#gid=0",
    ),
    "1AbCdEfGhIjKlMnOpQrStUvWxYz_123",
  );
  assert.equal(parseSpreadsheetId("  1RawSheetId_99  "), "1RawSheetId_99");
  assert.equal(parseSpreadsheetId("   "), "");
});

test("unauthenticated email and finance commands work cleanly via demo_fallback with >5 emails", async () => {
  const emailRes = await executeAgentCommand(
    {
      target: "email",
      command: "اعرض أحدث الرسائل الواردة",
      agents: TEST_EMAIL_FINANCE_AGENTS,
    },
    localAgentRuntime,
  );
  assert.equal(emailRes.ok, true);
  assert.equal(emailRes.agentId, "email");
  assert.equal(emailRes.pendingConfirmation, undefined);
  assert.match(emailRes.messages.logAr, /تجريبية/);
  assert.match(emailRes.messages.completionAr, /10 رسالة/);

  const financeRes = await executeAgentCommand(
    {
      target: "finance",
      command: "أعطني الملخص المالي هذا الشهر",
      agents: TEST_EMAIL_FINANCE_AGENTS,
    },
    localAgentRuntime,
  );
  assert.equal(financeRes.ok, true);
  assert.equal(financeRes.agentId, "finance");
  assert.match(financeRes.messages.logAr, /تجريبي/);
});

test("parseEmailCommandIntent extracts trash queries, explicit counts, and promotion filters", () => {
  const firebaseTrash = parseEmailCommandIntent("طلب محوّل: احذف ايميلات Firebase");
  assert.deepEqual(firebaseTrash, { intent: "trash", query: "Firebase", maxResults: 25 });

  const promoTrash = parseEmailCommandIntent("طلب محوّل: احذف الايميلات الترويجية");
  assert.deepEqual(promoTrash, {
    intent: "trash",
    query: "category:promotions",
    maxResults: 25,
  });

  const fetch30 = parseEmailCommandIntent("اعرض آخر 30 رسالة في صندوق الوارد");
  assert.deepEqual(fetch30, { intent: "fetch", query: "", maxResults: 30 });

  const fetchAll = parseEmailCommandIntent("افرز جميع الرسائل الواردة");
  assert.deepEqual(fetchAll, { intent: "fetch", query: "", maxResults: 50 });

  const quickSort = parseEmailCommandIntent("افرز صندوق الوارد ورتّب الرسائل حسب الأولوية");
  assert.deepEqual(quickSort, { intent: "fetch", query: "", maxResults: 20 });
});

test("authenticated fetch_recent_emails requests 20 emails by default (not capped to 5)", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/users/me/messages?")) {
      requestedUrl = url;
      return new Response(
        JSON.stringify({
          messages: Array.from({ length: 8 }, (_, idx) => ({ id: `m-${idx + 1}` })),
          resultSizeEstimate: 42,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        id: "m-1",
        snippet: "Hello",
        payload: { headers: [{ name: "Subject", value: "Test Subject" }] },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const res = await executeAgentCommand(
      {
        target: "auto",
        command: "افرز صندوق الوارد ورتب الرسائل حسب الأولوية",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
      },
      localAgentRuntime,
    );
    assert.equal(res.ok, true);
    assert.equal(res.agentId, "email");
    assert.match(requestedUrl, /maxResults=20/);
    assert.match(res.messages.completionAr, /8 رسالة/);
    assert.match(res.messages.logAr, /~42/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticated trash_emails requires pendingConfirmation first, then calls batchModify with TRASH", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body?: string }> = [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, body });

    if (url.includes("/users/me/messages?")) {
      return new Response(
        JSON.stringify({
          messages: [{ id: "fb-1" }, { id: "fb-2" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/users/me/messages/fb-")) {
      const id = url.includes("fb-1") ? "fb-1" : "fb-2";
      return new Response(
        JSON.stringify({
          id,
          snippet: "Firebase notification",
          payload: {
            headers: [
              { name: "From", value: "Firebase <firebase-noreply@google.com>" },
              { name: "Subject", value: id === "fb-1" ? "Blaze plan update" : "Welcome to Firebase" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/users/me/messages/batchModify") && method === "POST") {
      return new Response(null, { status: 204 });
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  try {
    const previewRes = await executeAgentCommand(
      {
        target: "auto",
        command: "احذف ايميلات Firebase",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
      },
      localAgentRuntime,
    );
    assert.equal(previewRes.ok, true);
    assert.equal(previewRes.agentId, "email");
    assert.ok(previewRes.pendingConfirmation);
    assert.equal(previewRes.pendingConfirmation.toolName, "trash_emails");
    assert.deepEqual(previewRes.pendingConfirmation.args.messageIds, ["fb-1", "fb-2"]);
    assert.equal(
      calls.some((c) => c.url.includes("batchModify")),
      false,
    );

    const confirmRes = await executeAgentCommand(
      {
        target: "email",
        command: "احذف ايميلات Firebase",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
        confirmAction: {
          toolName: "trash_emails",
          args: previewRes.pendingConfirmation.args,
        },
      },
      localAgentRuntime,
    );
    assert.equal(confirmRes.ok, true);
    assert.equal(confirmRes.pendingConfirmation, undefined);
    assert.match(confirmRes.messages.completionAr, /نُقلت 2 رسالة إلى سلة المهملات/);

    const modifyCall = calls.find((c) => c.url.includes("batchModify"));
    assert.ok(modifyCall);
    const modifyBody = JSON.parse(modifyCall.body ?? "{}") as {
      ids?: string[];
      addLabelIds?: string[];
      removeLabelIds?: string[];
    };
    assert.deepEqual(modifyBody.ids, ["fb-1", "fb-2"]);
    assert.deepEqual(modifyBody.addLabelIds, ["TRASH"]);
    assert.deepEqual(modifyBody.removeLabelIds, ["INBOX"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticated mutating email & finance commands require explicit pendingConfirmation first", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    throw new Error("fetch should not run before confirmation");
  }) as typeof fetch;

  try {
    const draftRes = await executeAgentCommand(
      {
        target: "email",
        command: "أنشئ مسودة رد إلى client@acme.com",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
      },
      localAgentRuntime,
    );
    assert.equal(draftRes.ok, true);
    assert.ok(draftRes.pendingConfirmation);
    assert.equal(draftRes.pendingConfirmation.toolName, "create_email_draft");
    assert.equal(draftRes.pendingConfirmation.args.to, "client@acme.com");

    const financeRes = await executeAgentCommand(
      {
        target: "finance",
        command: "سجل مصروف 250 ريال ضيافة",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
      },
      localAgentRuntime,
    );
    assert.equal(financeRes.ok, true);
    assert.ok(financeRes.pendingConfirmation);
    assert.equal(financeRes.pendingConfirmation.toolName, "log_expense_or_invoice");
    assert.equal(financeRes.pendingConfirmation.args.amount, 250);
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("confirmed finance mutation auto-creates Sheet when missing and returns createdSheetId", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; auth: string | null }> = [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
    });

    if (url === "https://sheets.googleapis.com/v4/spreadsheets" && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          spreadsheetId: "created-sheet-123",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/created-sheet-123/edit",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/values/") && init?.method === "PUT") {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    if (url.includes(":append")) {
      return new Response(
        JSON.stringify({ updates: { updatedRange: "'Transactions'!A2:F2" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  try {
    const res = await executeAgentCommand(
      {
        target: "finance",
        command: "سجل مصروف 250 ريال ضيافة",
        googleAccessToken: "user-oauth-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
        confirmAction: {
          toolName: "log_expense_or_invoice",
          args: {
            type: "expense",
            amount: 250,
            currency: "SAR",
            category: "مصروفات تشغيلية",
            description: "ضيافة",
          },
        },
      },
      localAgentRuntime,
    );

    assert.equal(res.ok, true);
    assert.equal(res.createdSheetId, "created-sheet-123");
    assert.equal(
      res.createdSheetUrl,
      "https://docs.google.com/spreadsheets/d/created-sheet-123/edit",
    );
    assert.equal(res.pendingConfirmation, undefined);
    assert.match(res.messages.completionAr, /250 SAR/);
    assert.equal(calls.length, 3);
    assert.ok(calls.every((c) => c.auth === "Bearer user-oauth-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Gmail 401 and 403 insufficient scope mark authExpired: true on AgentCommandResponse", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { code: 401 } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const res = await executeAgentCommand(
      {
        target: "email",
        command: "اعرض أحدث الرسائل الواردة",
        googleAccessToken: "expired-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
      },
      localAgentRuntime,
    );
    assert.equal(res.ok, true);
    assert.equal(res.authExpired, true);
    assert.match(res.messages.logAr, /انتهت صلاحية جلسة Google/);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { code: 403, message: "Request had insufficient authentication scopes." } }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const scopeRes = await executeAgentCommand(
      {
        target: "email",
        command: "احذف ايميلات Firebase",
        googleAccessToken: "readonly-token",
        agents: TEST_EMAIL_FINANCE_AGENTS,
        confirmAction: {
          toolName: "trash_emails",
          args: { query: "Firebase", messageIds: ["fb-1"] },
        },
      },
      localAgentRuntime,
    );
    assert.equal(scopeRes.ok, true);
    assert.equal(scopeRes.authExpired, true);
    assert.match(scopeRes.messages.logAr, /Sign in with Google/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("formatGoogleSignInError surfaces standalone tab link on popup-closed-by-user when embedded", () => {
  const embedded = formatGoogleSignInError({
    error: { code: "auth/popup-closed-by-user" },
    isEmbedded: true,
    currentUrl: "https://ais-dev.example.run.app/",
  });
  assert.equal(embedded.openTabUrl, "https://ais-dev.example.run.app/");
  assert.match(embedded.notice, /تبويب مستقل/);

  const standalone = formatGoogleSignInError({
    error: { code: "auth/popup-closed-by-user" },
    isEmbedded: false,
    currentUrl: "https://ais-dev.example.run.app/",
  });
  assert.equal(standalone.openTabUrl, null);
  assert.match(standalone.notice, /تم إغلاق نافذة تسجيل الدخول/);

  const proxyErr = formatGoogleSignInError({
    error: new TypeError("Cannot create proxy with a non-object as target or handler"),
    isEmbedded: true,
    currentUrl: "https://ais-dev.example.run.app/",
  });
  assert.equal(proxyErr.openTabUrl, "https://ais-dev.example.run.app/");
  assert.doesNotMatch(proxyErr.notice, /proxy/i);

  const redirectCancelled = formatGoogleSignInError({
    error: { code: "auth/redirect-cancelled-by-user" },
    isEmbedded: false,
    currentUrl: "https://ais-dev.example.run.app/",
  });
  assert.equal(redirectCancelled.openTabUrl, null);
  assert.match(redirectCancelled.notice, /إلغاء تسجيل الدخول/);
});

test("isSameOriginAuthHost enables same-origin proxy only on hosted run.app/firebase domains", () => {
  assert.equal(
    isSameOriginAuthHost("ais-dev-rcpyyguo5tx46dwhqyfnpj-1945748171.europe-west2.run.app"),
    true,
  );
  assert.equal(isSameOriginAuthHost("lunar-prism-423012-v6.firebaseapp.com"), true);
  assert.equal(isSameOriginAuthHost("lunar-prism-423012-v6.web.app"), true);
  assert.equal(isSameOriginAuthHost("localhost"), false);
});
