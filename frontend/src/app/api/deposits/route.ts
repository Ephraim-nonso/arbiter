import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type DepositRow = { amountMicros: string; txHash?: string; ts: number };
type DbValue = { totalDepositedMicros: string; deposits: DepositRow[] };
type Db = Record<string, DbValue>; // key = `${chainId}:${safeLower}`

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "deposits.json");

function keyOf(chainId: number, safe: string) {
  return `${chainId}:${safe.toLowerCase()}`;
}

function isAddr(a: string) {
  return a.startsWith("0x") && a.length === 42;
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
  const safeAddress = (searchParams.get("safeAddress") ?? "").toLowerCase();
  const chainId = Number(searchParams.get("chainId") ?? "");

  if (!isAddr(safeAddress) || !Number.isFinite(chainId)) {
    return NextResponse.json(
      { error: "Invalid safeAddress or chainId" },
      { status: 400 }
    );
  }

  const db = await readDb();
  const v = db[keyOf(chainId, safeAddress)] ?? {
    totalDepositedMicros: "0",
    deposits: [],
  };
  return NextResponse.json(v);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        chainId?: number;
        safeAddress?: string;
        amountMicros?: string;
        txHash?: string;
        ts?: number;
      }
    | null;

  const safeAddress = (body?.safeAddress ?? "").toLowerCase();
  const chainId = Number(body?.chainId);
  const amountMicros = String(body?.amountMicros ?? "");
  const txHash = (body?.txHash ?? "").toLowerCase();
  const ts = typeof body?.ts === "number" && Number.isFinite(body.ts) ? body.ts : Date.now();

  if (!isAddr(safeAddress) || !Number.isFinite(chainId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!/^\d+$/.test(amountMicros)) {
    return NextResponse.json({ error: "Invalid amountMicros" }, { status: 400 });
  }
  if (txHash && !(txHash.startsWith("0x") && txHash.length === 66)) {
    return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
  }

  const add = BigInt(amountMicros);
  if (add <= 0n) {
    return NextResponse.json({ error: "amountMicros must be > 0" }, { status: 400 });
  }

  const db = await readDb();
  const k = keyOf(chainId, safeAddress);
  const prev = db[k] ?? { totalDepositedMicros: "0", deposits: [] };
  const nextTotal = BigInt(prev.totalDepositedMicros || "0") + add;
  const next: DbValue = {
    totalDepositedMicros: nextTotal.toString(),
    deposits: [
      ...prev.deposits,
      { amountMicros: add.toString(), txHash: txHash || undefined, ts },
    ],
  };
  db[k] = next;
  await writeDb(db);

  return NextResponse.json(next);
}


