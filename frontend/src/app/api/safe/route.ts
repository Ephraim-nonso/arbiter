import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type Db = Record<string, string>; // key = `${chainId}:${ownerLower}`, value = safeLower

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "safes.json");

function keyOf(chainId: number, owner: string) {
  return `${chainId}:${owner.toLowerCase()}`;
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Db;
  } catch {
    return {};
  }
}

async function writeDb(db: Db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = (searchParams.get("owner") ?? "").toLowerCase();
  const chainId = Number(searchParams.get("chainId") ?? "");

  if (!owner.startsWith("0x") || owner.length !== 42 || !Number.isFinite(chainId)) {
    return NextResponse.json(
      { error: "Invalid owner or chainId" },
      { status: 400 }
    );
  }

  const db = await readDb();
  const safeAddress = db[keyOf(chainId, owner)] ?? null;
  return NextResponse.json({ safeAddress });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { owner?: string; chainId?: number; safeAddress?: string }
    | null;

  const owner = (body?.owner ?? "").toLowerCase();
  const safeAddress = (body?.safeAddress ?? "").toLowerCase();
  const chainId = Number(body?.chainId);

  if (
    !owner.startsWith("0x") ||
    owner.length !== 42 ||
    !safeAddress.startsWith("0x") ||
    safeAddress.length !== 42 ||
    !Number.isFinite(chainId)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = await readDb();
  db[keyOf(chainId, owner)] = safeAddress;
  await writeDb(db);

  return NextResponse.json({ ok: true, safeAddress });
}


