import test from "node:test";
import assert from "node:assert/strict";
import { parseSpreadsheetId } from "./sheet-utils";
import { formatGoogleSignInError, isSameOriginAuthHost } from "./workspace-auth-error";
import {
  executeAgentCommand,
  isCreateAgentCommand,
  loadLocalSkillPackageDetails,
  localAgentRuntime,
  parseEmailCommandIntent,
  splitMultipleAgentCreationClauses,
} from "./agent-runtime";
import {
  INITIAL_AGENTS,
  INITIAL_ROOMS,
  computeRoomPlacement,
  createAgentAndRoomFromSpec,
  getWorldDimensions,
  type Agent,
} from "../data/agents";
import {
  formatInstallCount,
  getAgentSkillSuggestions,
  parseCustomSkillInput,
} from "../data/skills";
import {
  DISCIPLINE_SEARCH_KEYWORDS,
  listRelativeFiles,
  resolveDiscipline,
  scanLocalProjectSkills,
} from "../app/api/skills/route";
import { clearOfficeState, loadOfficeState, saveOfficeState } from "./office-storage";
import {
  clearServerOfficeState,
  getServerOfficeState,
  saveServerOfficeState,
} from "./server-office-storage";
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

test("dynamic routing correctly selects sales agent for sales commands and GM for hiring", async () => {
  const hireSalesRes = await executeAgentCommand(
    {
      target: "auto",
      command: "وظف مسؤول مبيعات",
      agents: [toPromptProfile(INITIAL_AGENTS[0], INITIAL_ROOMS[0].nameAr)],
    },
    localAgentRuntime,
  );

  assert.equal(hireSalesRes.ok, true);
  assert.equal(hireSalesRes.agentId, "gm");
  assert.ok(hireSalesRes.createdAgent);
  assert.equal(hireSalesRes.createdAgent.furnitureStyle, "creative");
  assert.match(hireSalesRes.createdAgent.roleAr, /مبيعات/);

  const { agent: salesAgent, room: salesRoom } = createAgentAndRoomFromSpec(
    hireSalesRes.createdAgent,
    INITIAL_AGENTS,
    INITIAL_ROOMS,
  );

  // Auto-routing with both GM and Sales agent:
  // 1. Sales pitch command should route to Sales agent
  const salesTask = await executeAgentCommand(
    {
      target: "auto",
      command: "جهّز عرض أسعار واقترح استراتيجية للتواصل مع العملاء الجدد",
      agents: [
        toPromptProfile(INITIAL_AGENTS[0], INITIAL_ROOMS[0].nameAr),
        toPromptProfile(salesAgent, salesRoom.nameAr),
      ],
    },
    localAgentRuntime,
  );
  assert.equal(salesTask.ok, true);
  assert.equal(salesTask.agentId, salesAgent.id);
  assert.equal(salesTask.routedBy, "gm");

  // 2. Hiring another agent should route to GM
  const newHireTask = await executeAgentCommand(
    {
      target: "auto",
      command: "أنشئ وكيل مصمم جرافيك واجهات",
      agents: [
        toPromptProfile(INITIAL_AGENTS[0], INITIAL_ROOMS[0].nameAr),
        toPromptProfile(salesAgent, salesRoom.nameAr),
      ],
    },
    localAgentRuntime,
  );
  assert.equal(newHireTask.ok, true);
  assert.equal(newHireTask.agentId, "gm");
  assert.ok(newHireTask.createdAgent);
});

test("localStorage office state persistence and reset works seamlessly", () => {
  const storageMap = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() {
      return storageMap.size;
    },
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error Mocking window.localStorage in node test environment
  globalThis.window = { localStorage: mockStorage };

  try {
    // 1. Initially no saved state
    assert.equal(loadOfficeState(INITIAL_AGENTS, INITIAL_ROOMS), null);

    // 2. Create a dynamic agent and save
    const { agent: newAgent, room: newRoom } = createAgentAndRoomFromSpec(
      {
        nameAr: "فهد العازمي",
        roleAr: "مبرمج ويب",
        roomNameAr: "غرفة البرمجة",
        rules: "الالتزام بأعلى معايير الأمان وجودة الأكواد.",
        skills: ["code-writing"],
        themeColor: "#5aa9e6",
        furnitureStyle: "tech",
      },
      INITIAL_AGENTS,
      INITIAL_ROOMS,
    );

    const updatedAgents = [...INITIAL_AGENTS, newAgent];
    const updatedRooms = [...INITIAL_ROOMS, newRoom];
    saveOfficeState(updatedAgents, updatedRooms);

    // 3. Reload state from storage
    const restored = loadOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
    assert.ok(restored);
    assert.equal(restored.agents.length, 2);
    assert.equal(restored.rooms.length, 2);
    assert.equal(restored.agents[1].nameAr, "فهد العازمي");
    assert.equal(restored.rooms[1].furnitureStyle, "tech");

    // 4. Clear state (Reset Office)
    clearOfficeState();
    assert.equal(loadOfficeState(INITIAL_AGENTS, INITIAL_ROOMS), null);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("createAgentAndRoomFromSpec supports placing multiple agents in the same room", () => {
  // 1. Create first agent (Sara in Marketing Room)
  const result1 = createAgentAndRoomFromSpec(
    {
      nameAr: "سارة المطيري",
      roleAr: "مديرة إنستغرام",
      roomNameAr: "غرفة التسويق والمحتوى",
      rules: "نشر محتوى أسبوعي جذاب.",
      skills: ["data-analysis"],
      themeColor: "#e58a62",
      furnitureStyle: "creative",
    },
    INITIAL_AGENTS,
    INITIAL_ROOMS,
  );

  assert.equal(result1.isNewRoom, true);
  const marketingRoom = result1.room;
  const sara = result1.agent;
  const agentsState1 = [...INITIAL_AGENTS, sara];
  const roomsState1 = [...INITIAL_ROOMS, marketingRoom];

  // 2. Create second agent (Layla in the SAME room by roomNameAr)
  const result2 = createAgentAndRoomFromSpec(
    {
      nameAr: "ليلى الحربي",
      roleAr: "مصممة بوسترات",
      roomNameAr: "غرفة التسويق والمحتوى",
      rules: "تصميم بوسترات عالية الجودة.",
      skills: ["research-summary"],
      themeColor: "#e58a62",
      furnitureStyle: "creative",
    },
    agentsState1,
    roomsState1,
  );

  assert.equal(result2.isNewRoom, false);
  assert.equal(result2.room.id, marketingRoom.id);
  assert.equal(result2.room.agentIds.length, 2);
  assert.equal(result2.room.agentIds[0], sara.id);
  assert.equal(result2.room.agentIds[1], result2.agent.id);

  // Existing agent (Sara) should have been repositioned to Station 1
  assert.equal(result2.updatedExistingAgents.length, 1);
  const updatedSara = result2.updatedExistingAgents[0];
  assert.equal(updatedSara.id, sara.id);
  assert.equal(updatedSara.position.x, marketingRoom.rect.x + 138);

  // New agent (Layla) positioned at Station 2
  const layla = result2.agent;
  assert.equal(layla.roomId, marketingRoom.id);
  assert.equal(layla.position.x, marketingRoom.rect.x + 236);
  assert.notEqual(updatedSara.position.x, layla.position.x);

  // 3. Create third agent with targetRoomId explicitly
  const result3 = createAgentAndRoomFromSpec(
    {
      targetRoomId: marketingRoom.id,
      nameAr: "نورة القحطاني",
      roleAr: "كاتبة محتوى",
      roomNameAr: "غرفة جديدة لكن نوجهها بالمعرف",
      rules: "صياغة نصوص تسويقية.",
      skills: ["email-drafting"],
      themeColor: "#e58a62",
      furnitureStyle: "creative",
    },
    [INITIAL_AGENTS[0], updatedSara, layla],
    [INITIAL_ROOMS[0], result2.room],
  );

  assert.equal(result3.isNewRoom, false);
  assert.equal(result3.room.id, marketingRoom.id);
  assert.equal(result3.room.agentIds.length, 3);
  assert.equal(result3.updatedExistingAgents.length, 2);
});

test("loadOfficeState automatically deduplicates rooms with identical normalized names", () => {
  const storageMap = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() {
      return storageMap.size;
    },
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error Mocking window.localStorage in node test environment
  globalThis.window = { localStorage: mockStorage };

  try {
    // Simulate legacy/buggy persisted state where two rooms exist with identical names
    const legacyCorruptedPayload = {
      version: 2,
      savedAt: Date.now(),
      rooms: [
        {
          id: "gm",
          nameAr: "غرفة المدير العام",
          shortNameAr: "المدير العام",
          descriptionAr: "الإدارة",
          furnitureStyle: "admin",
          accent: "#d8a54a",
          agentIds: ["gm"],
        },
        {
          id: "room-sara",
          nameAr: "غرفة التسويق والمحتوى",
          shortNameAr: "التسويق",
          descriptionAr: "تسويق",
          furnitureStyle: "creative",
          accent: "#e58a62",
          agentIds: ["sara"],
        },
        {
          id: "room-layla",
          nameAr: "غرفة التسويق والمحتوى",
          shortNameAr: "التسويق",
          descriptionAr: "تسويق",
          furnitureStyle: "creative",
          accent: "#e58a62",
          agentIds: ["layla"],
        },
      ],
      agents: [
        {
          id: "gm",
          nameAr: "سلمان العتيبي",
          roleAr: "المدير العام",
          roomId: "gm",
          status: "idle",
          skills: [],
          rules: "",
        },
        {
          id: "sara",
          nameAr: "سارة المطيري",
          roleAr: "مديرة حساب إنستغرام",
          roomId: "room-sara",
          status: "idle",
          skills: [],
          rules: "",
        },
        {
          id: "layla",
          nameAr: "ليلى الحربي",
          roleAr: "مصممة بوسترات",
          roomId: "room-layla",
          status: "idle",
          skills: [],
          rules: "",
        },
      ],
    };

    mockStorage.setItem("virtual-office-state-v2", JSON.stringify(legacyCorruptedPayload));

    const restored = loadOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
    assert.ok(restored);

    // Deduplication should result in exactly 2 rooms (GM + 1 merged Marketing room)
    assert.equal(restored.rooms.length, 2);
    assert.equal(restored.rooms[1].nameAr, "غرفة التسويق والمحتوى");
    assert.equal(restored.rooms[1].agentIds.length, 2);

    // Both Sara and Layla should be mapped to the canonical room
    assert.equal(restored.agents.length, 3);
    const restoredSara = restored.agents.find((a) => a.id === "sara")!;
    const restoredLayla = restored.agents.find((a) => a.id === "layla")!;
    assert.equal(restoredSara.roomId, "room-sara");
    assert.equal(restoredLayla.roomId, "room-sara");

    // Both agents must have distinct station positions
    assert.notEqual(restoredSara.position.x, restoredLayla.position.x);
    assert.equal(restoredSara.position.x, restored.rooms[1].rect.x + 138);
    assert.equal(restoredLayla.position.x, restored.rooms[1].rect.x + 236);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("formatInstallCount formats install counts cleanly", () => {
  assert.equal(formatInstallCount(1430000), "1.4M");
  assert.equal(formatInstallCount(1000000), "1M");
  assert.equal(formatInstallCount(865485), "865.5K");
  assert.equal(formatInstallCount(450), "450");
  assert.equal(formatInstallCount(undefined), "");
});

test("custom skills with find-skills sourceUrl and installs persist cleanly", () => {
  const storageMap = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() {
      return storageMap.size;
    },
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error Mocking window.localStorage in node test environment
  globalThis.window = { localStorage: mockStorage };

  try {
    const agentWithDownloadedSkill: Agent = {
      ...INITIAL_AGENTS[0],
      customSkills: [
        {
          id: "find-skill-frontend-design-test",
          nameAr: "frontend-design",
          descriptionAr: "Guidance for distinctive visual design.",
          promptInstruction: "# Frontend Design Rules\nAlways check contrast and responsive layout.",
          format: "markdown",
          sourceUrl: "https://skills.sh/anthropics/skills/frontend-design",
          installs: 1120000,
        },
      ],
    };

    saveOfficeState([agentWithDownloadedSkill], INITIAL_ROOMS);
    const restored = loadOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
    assert.ok(restored);
    assert.equal(restored.agents[0].customSkills?.length, 1);
    const skill = restored.agents[0].customSkills![0];
    assert.equal(skill.nameAr, "frontend-design");
    assert.equal(skill.sourceUrl, "https://skills.sh/anthropics/skills/frontend-design");
    assert.equal(skill.installs, 1120000);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("getAgentSkillSuggestions provides role-tailored skills for all agent types", () => {
  // 1. Tech / Developer
  const dev = getAgentSkillSuggestions("مطوّر الويب", "Web Developer", "tech", "كتابة الأكواد النظيفة وحل المشاكل البرمجية.");
  assert.equal(dev.primaryQuery, "code");
  assert.equal(dev.categoryLabelAr, "البرمجة وتطوير البرمجيات");
  assert.ok(dev.chips.some((c) => c.query === "code"));
  assert.ok(dev.chips.some((c) => c.query === "react"));

  // 2. Poster / UI Designer
  const designer = getAgentSkillSuggestions("مصممة بوسترات", "Poster Designer", "creative", "تصميم بوسترات وهوية إعلانية متناسقة.");
  assert.equal(designer.primaryQuery, "design");
  assert.equal(designer.categoryLabelAr, "التصميم والواجهات والهوية");
  assert.ok(designer.chips.some((c) => c.query === "design"));
  assert.ok(designer.chips.some((c) => c.query === "mobile-apps"));

  // 3. Marketing / Instagram
  const marketing = getAgentSkillSuggestions("مديرة حساب إنستغرام", "Marketing Specialist", "creative", "صناعة المحتوى وكتابة الكابشن وإدارة الحملات.");
  assert.equal(marketing.primaryQuery, "marketing");
  assert.equal(marketing.categoryLabelAr, "التسويق وصناعة المحتوى");
  assert.ok(marketing.chips.some((c) => c.query === "marketing"));
  assert.ok(marketing.chips.some((c) => c.query === "copywriting"));

  // 4. Finance / Sales
  const finance = getAgentSkillSuggestions("محلل مالي", "Financial Analyst", "finance", "إدارة الميزانيات وتتبع الفواتير والتقارير المالية.");
  assert.equal(finance.primaryQuery, "finance");
  assert.equal(finance.categoryLabelAr, "المالية والحسابات والمبيعات");
  assert.ok(finance.chips.some((c) => c.query === "finance"));
  assert.ok(finance.chips.some((c) => c.query === "sheets"));

  // 5. General Manager (Salman)
  const gm = getAgentSkillSuggestions("المدير العام", "General Manager", "admin", "إدارة وتوزيع المهام ومتابعة الفريق.");
  assert.equal(gm.primaryQuery, "planning");
  assert.equal(gm.categoryLabelAr, "الإدارة والتخطيط وتنسيق المهام");
  assert.ok(gm.chips.some((c) => c.query === "planning"));
  assert.ok(gm.chips.some((c) => c.query === "management"));

  // 6. Support
  const support = getAgentSkillSuggestions("مسؤول خدمة العملاء", "Customer Support", "admin", "الرد على استفسارات العملاء وحل الشكاوى.");
  assert.equal(support.primaryQuery, "support");
  assert.equal(support.categoryLabelAr, "خدمة العملاء والدعم الفني");
  assert.ok(support.chips.some((c) => c.query === "support"));
});

test("resolveDiscipline and DISCIPLINE_SEARCH_KEYWORDS provide specialized online search keywords per discipline", () => {
  // 1. Tech / Developer agent
  const techDiscipline = resolveDiscipline("مطوّر الويب", "tech");
  assert.equal(techDiscipline, "tech");
  assert.equal(DISCIPLINE_SEARCH_KEYWORDS[techDiscipline], "code");

  // 2. Poster / Graphic Designer
  const designDiscipline = resolveDiscipline("مصممة بوسترات", "creative");
  assert.equal(designDiscipline, "design");
  assert.equal(DISCIPLINE_SEARCH_KEYWORDS[designDiscipline], "design");

  // 3. Instagram / Marketing Specialist
  const marketingDiscipline = resolveDiscipline("مديرة حساب إنستغرام", "creative");
  assert.equal(marketingDiscipline, "marketing");
  assert.equal(DISCIPLINE_SEARCH_KEYWORDS[marketingDiscipline], "marketing");

  // 4. Financial Analyst / Accountant
  const financeDiscipline = resolveDiscipline("محاسب مالي", "finance");
  assert.equal(financeDiscipline, "finance");
  assert.equal(DISCIPLINE_SEARCH_KEYWORDS[financeDiscipline], "finance");

  // 5. General Manager (Salman)
  const gmDiscipline = resolveDiscipline("المدير العام", "admin");
  assert.equal(gmDiscipline, "management");
  assert.equal(DISCIPLINE_SEARCH_KEYWORDS[gmDiscipline], "management");
});

test("server file office state persistence and reset works seamlessly", () => {
  try {
    // 1. Initially clear any state
    clearServerOfficeState();
    assert.equal(getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS), null);

    // 2. Create a dynamic agent and save to server file
    const { agent: newAgent, room: newRoom } = createAgentAndRoomFromSpec(
      {
        nameAr: "سعد الشهري",
        roleAr: "أخصائي أمان",
        roomNameAr: "غرفة الأمان السيبراني",
        rules: "فحص الحزم واكتشاف الثغرات بدقة.",
        skills: ["code-writing"],
        themeColor: "#42a872",
        furnitureStyle: "tech",
      },
      INITIAL_AGENTS,
      INITIAL_ROOMS,
    );

    const updatedAgents = [...INITIAL_AGENTS, newAgent];
    const updatedRooms = [...INITIAL_ROOMS, newRoom];
    const saveResult = saveServerOfficeState({
      agents: updatedAgents,
      rooms: updatedRooms,
      theme: "night",
      sheetId: "my-custom-sheet-id-456",
    });

    assert.ok(saveResult.ok);
    assert.ok(saveResult.savedAt > 0);

    // 3. Reload state directly from server file
    const restored = getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
    assert.ok(restored);
    assert.equal(restored.agents.length, 2);
    assert.equal(restored.rooms.length, 2);
    assert.equal(restored.agents[1].nameAr, "سعد الشهري");
    assert.equal(restored.agents[1].roleAr, "أخصائي أمان");
    assert.equal(restored.rooms[1].nameAr, "غرفة الأمان السيبراني");
    assert.equal(restored.theme, "night");
    assert.equal(restored.sheetId, "my-custom-sheet-id-456");

    // 4. Reset server state (Clear)
    const clearResult = clearServerOfficeState();
    assert.ok(clearResult.ok);
    assert.equal(getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS), null);
  } finally {
    clearServerOfficeState();
  }
});

test("full skill package scans local project packages and loads references into agent runtime", () => {
  // 1. Test scanning local project skills
  const localSkills = scanLocalProjectSkills();
  const apexSkill = localSkills.find((s) => s.skillId === "apex-ui-ux");
  assert.ok(apexSkill, "apex-ui-ux package should be discovered in skills/ directory");
  assert.equal(apexSkill.isLocal, true);
  assert.equal(apexSkill.localPath, "skills/apex-ui-ux");
  assert.ok(Array.isArray(apexSkill.files));
  assert.ok(apexSkill.files.length >= 8, `Should contain at least 8 files, found ${apexSkill.files.length}`);
  assert.ok(apexSkill.files.includes("SKILL.md"));
  assert.ok(apexSkill.files.some((f) => f.includes("references/tokens.md")));
  assert.ok(apexSkill.files.some((f) => f.includes("scripts/audit-ui.mjs")));

  // 2. Test reading reference notes and scripts from disk
  const details = loadLocalSkillPackageDetails(apexSkill.localPath);
  assert.ok(details.referenceNotes.length > 0, "Should load reference notes from references/ folder");
  assert.ok(details.availableScripts.length > 0, "Should load script references from scripts/ folder");

  // 3. Test persistence of custom skills with full package fields (localPath, files)
  const originalState = getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
  try {
    const customSkillDef = {
      id: "skill-apex-ui-ux",
      nameAr: "apex-ui-ux",
      descriptionAr: apexSkill.description || "حزمة تصميم واجهات متكاملة",
      promptInstruction: "التزم بمعايير التصميم والرموز الفنية الدقيقة.",
      format: "markdown" as const,
      sourceUrl: "https://skills.sh/local/apex-ui-ux",
      installs: 1,
      localPath: apexSkill.localPath,
      files: apexSkill.files,
    };

    const agentWithSkill: Agent = {
      ...INITIAL_AGENTS[0],
      customSkills: [customSkillDef],
    };

    saveServerOfficeState({
      agents: [agentWithSkill],
      rooms: INITIAL_ROOMS,
      theme: "day",
    });

    const reloaded = getServerOfficeState(INITIAL_AGENTS, INITIAL_ROOMS);
    assert.ok(reloaded);
    assert.equal(reloaded.agents[0].customSkills?.length, 1);
    const loadedSkill = reloaded.agents[0].customSkills![0];
    assert.equal(loadedSkill.id, "skill-apex-ui-ux");
    assert.equal(loadedSkill.localPath, "skills/apex-ui-ux");
    assert.ok(Array.isArray(loadedSkill.files));
    assert.equal(loadedSkill.files!.length, apexSkill.files.length);
  } finally {
    if (originalState) {
      saveServerOfficeState({
        agents: originalState.agents,
        rooms: originalState.rooms,
        theme: originalState.theme,
        sheetId: originalState.sheetId,
      });
    } else {
      clearServerOfficeState();
    }
  }
});

test("isCreateAgentCommand matches عميل and splitMultipleAgentCreationClauses creates multiple agents", async () => {
  const userPrompt = "انشيء عميل يفحص ويحلل صفحة الانستة الخاصة بي ول اخر يقترح افكار فديوهات ولاخر يصنع بوسترات";
  assert.equal(isCreateAgentCommand(userPrompt), true);

  const clauses = splitMultipleAgentCreationClauses(userPrompt);
  assert.equal(clauses.length, 3);
  assert.ok(clauses[0].includes("الانستة"));
  assert.ok(clauses[1].includes("فديوهات"));
  assert.ok(clauses[2].includes("بوسترات"));

  const response = await executeAgentCommand(
    {
      target: "gm",
      command: userPrompt,
      agents: [toPromptProfile(INITIAL_AGENTS[0], "غرفة المدير العام")],
      rooms: INITIAL_ROOMS.map((r) => ({
        id: r.id,
        nameAr: r.nameAr,
        shortNameAr: r.shortNameAr,
        furnitureStyle: r.furnitureStyle,
        agentIds: [...r.agentIds],
      })),
    },
    localAgentRuntime,
  );

  assert.ok(response.createdAgents, "Should return createdAgents array");
  assert.equal(response.createdAgents.length, 3, "Should create all 3 requested agents");
  assert.ok(response.createdAgents[0].roleAr.includes("إنستغرام") || response.createdAgents[0].roleAr.includes("محلل"));
  assert.ok(response.createdAgents[1].roleAr.includes("فيديو"));
  assert.ok(response.createdAgents[2].roleAr.includes("بوستر"));
  assert.ok(response.messages.logAr.includes("3 وكلاء"));
});

