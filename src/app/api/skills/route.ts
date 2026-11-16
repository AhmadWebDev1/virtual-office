import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import type { CustomSkillDefinition } from "@/data/skills";

const execFileAsync = promisify(execFile);

export interface SkillSearchResultItem {
  id: string;
  source: string;
  skillId: string;
  name: string;
  installs: number;
  url: string;
  isLocal?: boolean;
  localPath?: string;
  filesCount?: number;
  files?: string[];
  description?: string;
}

export type AgentDiscipline =
  | "tech"
  | "design"
  | "marketing"
  | "finance"
  | "management"
  | "support";

export const DISCIPLINE_SEARCH_KEYWORDS: Record<AgentDiscipline, string> = {
  tech: "code",
  design: "design",
  marketing: "marketing",
  finance: "finance",
  management: "management",
  support: "customer",
};

export function resolveDiscipline(
  role = "",
  style = "",
  query = "",
): AgentDiscipline {
  const text = `${role} ${style} ${query}`.toLowerCase();

  // 1. Tech & Programming
  if (
    style === "tech" ||
    /برمج|مطور|كود|تطوير|ويب|فرونت|باك|مهندس|هندس|تقن|سيرفر|قواعد بيانات|code|dev|developer|engineer|software|web|frontend|backend|react|next|typescript|api|bug|test|debug/.test(
      text,
    )
  ) {
    return "tech";
  }

  // 2. Design, UI & Visual Art
  if (
    /تصميم|مصمم|بوستر|جرافيك|فوتوشوب|فيغما|واجهات|ألوان|هوية|ui|ux|design|figma|poster|art|graphic|vector|illustrat/.test(
      text,
    )
  ) {
    return "design";
  }

  // 3. Marketing & Content
  if (
    style === "creative" ||
    /تسويق|محتوى|انستغرام|إنستغرام|سوشيال|إعلان|اعلان|سيو|كتابة محتوى|نشر|ريلز|منشور|marketing|social|content|instagram|copy|copywriting|seo|campaign|growth/.test(
      text,
    )
  ) {
    return "marketing";
  }

  // 4. Finance, Accounting & Sales
  if (
    style === "finance" ||
    /مالي|محاسب|حسابات|ميزانية|أرقام|ارقام|فواتير|فاتورة|مبيعات|صفقات|إيراد|ايراد|finance|account|sales|revops|invoice|sheet|budget|tax|crypto/.test(
      text,
    )
  ) {
    return "finance";
  }

  // 5. Customer Support
  if (
    /عملاء|خدمة|دعم|مساعدة|شكاوى|استفسار|support|customer|helpdesk|crm/.test(
      text,
    )
  ) {
    return "support";
  }

  // 6. Default / General Management (GM سلمان)
  return "management";
}

const SAFE_TOKEN_REGEX = /^[a-zA-Z0-9_\-\.\/]+$/;

function sanitizeSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 100 || !SAFE_TOKEN_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function sanitizeSkillId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 80 || !SAFE_TOKEN_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function listRelativeFiles(dir: string, baseDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...listRelativeFiles(fullPath, baseDir));
      } else if (entry.isFile()) {
        const rel = path.relative(baseDir, fullPath).replace(/\\/g, "/");
        files.push(rel);
      }
    }
  } catch (err) {
    console.warn(`Error reading dir ${dir}:`, err);
  }
  return files;
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

export function parseSkillContent(
  rawText: string,
  source: string,
  skillId: string,
): { nameAr: string; descriptionAr: string; promptInstruction: string } {
  const fmMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  let name = skillId;
  let description = "";
  let body = rawText;

  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2].trim();
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch?.[1]) {
      name = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
    }
    const descMatch = fm.match(/^description:\s*(?:>-\s*)?([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/m);
    if (descMatch?.[1]) {
      description = descMatch[1].replace(/\r?\n\s*/g, " ").trim().replace(/^['"]|['"]$/g, "");
    }
  }

  // Format clean Arabic title & description
  const cleanName = name || skillId;
  const nameAr = `${cleanName}`;
  const descriptionAr =
    description.slice(0, 240) || `مهارة ${cleanName} مستوردة من ${source} عبر find-skills.`;
  const promptInstruction = (body || rawText).slice(0, 4000);

  return { nameAr, descriptionAr, promptInstruction };
}

export function scanLocalProjectSkills(): SkillSearchResultItem[] {
  const skillsDir = path.join(process.cwd(), "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const results: SkillSearchResultItem[] = [];
  try {
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const skillId = d.name;
      const skillFolderPath = path.join(skillsDir, skillId);
      const skillMdPath = path.join(skillFolderPath, "SKILL.md");
      let name = skillId;
      let description = "";
      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const parsed = parseSkillContent(content, "local-project", skillId);
          name = parsed.nameAr;
          description = parsed.descriptionAr;
        } catch {
          // fallback
        }
      }
      const files = listRelativeFiles(skillFolderPath);
      results.push({
        id: `local/${skillId}`,
        source: "local-project",
        skillId,
        name,
        installs: 1,
        url: `/skills/${skillId}`,
        isLocal: true,
        localPath: `skills/${skillId}`,
        filesCount: files.length,
        files,
        description: description || `حزمة محلية في المشروع (${files.length} ملفات)`,
      });
    }
  } catch (err) {
    console.error("Failed to scan local skills:", err);
  }
  return results;
}

export async function searchSkillsOnline(
  query: string,
): Promise<SkillSearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const searchUrl = `https://skills.sh/api/search?q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { skills?: unknown[] };
    if (!Array.isArray(data.skills)) return [];

    const skills: SkillSearchResultItem[] = [];
    for (const item of data.skills) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const source = typeof obj.source === "string" ? obj.source.trim() : "";
      const skillId = typeof obj.skillId === "string" ? obj.skillId.trim() : "";
      const name = typeof obj.name === "string" ? obj.name.trim() : skillId;
      const installs = typeof obj.installs === "number" ? obj.installs : 0;
      if (!source || !skillId) continue;

      skills.push({
        id: `${source}/${skillId}`,
        source,
        skillId,
        name,
        installs,
        url: `https://skills.sh/${source}/${skillId}`,
      });
      if (skills.length >= 30) break;
    }

    return skills;
  } catch (err) {
    console.error("Online skill search failed:", err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim();
  const role = (
    searchParams.get("role") ??
    searchParams.get("roleEn") ??
    ""
  ).trim();
  const style = (searchParams.get("style") ?? "").trim();
  const rawDiscipline = (searchParams.get("discipline") ?? "").trim();

  const discipline: AgentDiscipline =
    rawDiscipline in DISCIPLINE_SEARCH_KEYWORDS
      ? (rawDiscipline as AgentDiscipline)
      : resolveDiscipline(role, style, rawQuery);

  // If query is empty or purely Arabic, use the discipline-specific English query term
  let searchQuery = rawQuery;
  const hasLatin = /[a-zA-Z]/.test(rawQuery);
  if (!rawQuery || !hasLatin) {
    searchQuery = DISCIPLINE_SEARCH_KEYWORDS[discipline] ?? "agent";
  }

  const [onlineSkills, localSkills] = await Promise.all([
    searchSkillsOnline(searchQuery),
    Promise.resolve(scanLocalProjectSkills()),
  ]);

  return NextResponse.json({
    ok: true,
    localSkills,
    skills: onlineSkills,
    discipline,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "تعذّر قراءة الطلب. تأكد من إرسال JSON صالح." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "صيغة الطلب غير صالحة." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const source = sanitizeSource(payload.source);
  const skillId = sanitizeSkillId(payload.skillId);
  const installs = typeof payload.installs === "number" ? payload.installs : undefined;

  if (!source || !skillId) {
    return NextResponse.json(
      { ok: false, error: "معرّف المهارة أو الحزمة غير صالح." },
      { status: 422 },
    );
  }

  const skillsDir = path.join(process.cwd(), "skills");
  const targetDir = path.join(skillsDir, skillId);
  const targetSkillMd = path.join(targetDir, "SKILL.md");
  const agentsSkillDir = path.join(process.cwd(), ".agents", "skills", skillId);

  await fs.promises.mkdir(skillsDir, { recursive: true });

  let rawSkillMd = "";

  // 1. If target directory already exists with SKILL.md, reuse it directly
  if (fs.existsSync(targetSkillMd)) {
    try {
      rawSkillMd = await fs.promises.readFile(targetSkillMd, "utf-8");
    } catch {
      // ignore
    }
  }

  // 2. If not in skills/, but exists in .agents/skills/<skillId>, copy it to skills/
  if (!rawSkillMd && fs.existsSync(agentsSkillDir)) {
    try {
      await copyDir(agentsSkillDir, targetDir);
      if (fs.existsSync(targetSkillMd)) {
        rawSkillMd = await fs.promises.readFile(targetSkillMd, "utf-8");
      }
    } catch (err) {
      console.warn("Failed to copy from .agents/skills:", err);
    }
  }

  // 3. If not found locally, run `npx skills add <source> --skill <skillId> -y --copy`
  if (!rawSkillMd) {
    try {
      const isWindows = process.platform === "win32";
      const npxCmd = isWindows ? "npx.cmd" : "npx";
      await execFileAsync(npxCmd, ["skills", "add", source, "--skill", skillId, "-y", "--copy"], {
        timeout: 25000,
        shell: isWindows,
        env: { ...process.env, CI: "true" },
      });

      if (fs.existsSync(agentsSkillDir)) {
        await copyDir(agentsSkillDir, targetDir);
        if (fs.existsSync(targetSkillMd)) {
          rawSkillMd = await fs.promises.readFile(targetSkillMd, "utf-8");
        }
      }
    } catch (err) {
      console.warn(`npx skills add failed for ${source}@${skillId}:`, err);
    }
  }

  // 4. Fallback: Direct GitHub raw candidate fetch into skills/<skillId>/SKILL.md
  if (!rawSkillMd) {
    const candidates = [
      `https://raw.githubusercontent.com/${source}/main/skills/${skillId}/SKILL.md`,
      `https://raw.githubusercontent.com/${source}/main/${skillId}/SKILL.md`,
      `https://raw.githubusercontent.com/${source}/main/skills/${skillId}.md`,
      `https://raw.githubusercontent.com/${source}/main/SKILL.md`,
      `https://raw.githubusercontent.com/${source}/master/skills/${skillId}/SKILL.md`,
      `https://raw.githubusercontent.com/${source}/master/${skillId}/SKILL.md`,
      `https://raw.githubusercontent.com/${source}/master/SKILL.md`,
    ];

    for (const candidateUrl of candidates) {
      try {
        const res = await fetch(candidateUrl, {
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 20) {
            rawSkillMd = text;
            await fs.promises.mkdir(targetDir, { recursive: true });
            await fs.promises.writeFile(targetSkillMd, text, "utf-8");
            break;
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
  }

  // 5. Fallback CLI `npx skills use`
  if (!rawSkillMd) {
    try {
      const isWindows = process.platform === "win32";
      const npxCmd = isWindows ? "npx.cmd" : "npx";
      const pkgSpec = `${source}@${skillId}`;
      const cmdResult = await execFileAsync(npxCmd, ["skills", "use", pkgSpec], {
        timeout: 12000,
        shell: isWindows,
        env: { ...process.env, CI: "true" },
      });
      const stdout = cmdResult.stdout || "";
      const match = stdout.match(/<SKILL\.md>([\s\S]*?)<\/SKILL\.md>/);
      rawSkillMd = match?.[1] ? match[1].trim() : stdout.trim();
      if (rawSkillMd && rawSkillMd.length > 20) {
        await fs.promises.mkdir(targetDir, { recursive: true });
        await fs.promises.writeFile(targetSkillMd, rawSkillMd, "utf-8");
      }
    } catch {
      // ignore
    }
  }

  if (!rawSkillMd || rawSkillMd.length < 20) {
    return NextResponse.json(
      {
        ok: false,
        error: `تعذّر تنزيل حزمة المهارة «${skillId}» من المصدر ${source}. تحقق من الاتصال بالإنترنت.`,
      },
      { status: 502 },
    );
  }

  const { nameAr, descriptionAr, promptInstruction } = parseSkillContent(
    rawSkillMd,
    source,
    skillId,
  );

  const relativeFiles = listRelativeFiles(targetDir);

  const customSkill: CustomSkillDefinition = {
    id: `skill-${skillId}`,
    nameAr,
    descriptionAr,
    promptInstruction,
    format: "markdown",
    sourceUrl: `https://skills.sh/${source}/${skillId}`,
    installs,
    localPath: `skills/${skillId}`,
    files: relativeFiles.length > 0 ? relativeFiles : ["SKILL.md"],
  };

  return NextResponse.json({
    ok: true,
    skill: customSkill,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSkillId = searchParams.get("skillId");
  const skillId = sanitizeSkillId(rawSkillId);
  if (!skillId) {
    return NextResponse.json({ ok: false, error: "معرف المهارة غير صالح." }, { status: 400 });
  }

  const targetDir = path.join(process.cwd(), "skills", skillId);
  if (fs.existsSync(targetDir)) {
    try {
      await fs.promises.rm(targetDir, { recursive: true, force: true });
    } catch (err) {
      console.warn("Failed to remove skill directory:", err);
    }
  }

  return NextResponse.json({ ok: true, removed: skillId });
}
