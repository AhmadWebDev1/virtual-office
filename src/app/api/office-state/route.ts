import { NextResponse } from "next/server";
import {
  clearServerOfficeState,
  getServerOfficeState,
  saveServerOfficeState,
} from "@/lib/server-office-storage";

export async function GET() {
  try {
    const state = getServerOfficeState();
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const result = saveServerOfficeState({
      agents: body.agents,
      rooms: body.rooms,
      theme: body.theme,
      sheetId: body.sheetId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal Error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const result = clearServerOfficeState();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal Error" },
      { status: 500 },
    );
  }
}
