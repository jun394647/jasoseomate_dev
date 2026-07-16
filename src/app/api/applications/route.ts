import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sessionOrResponse } from "@/lib/session";
import type { ApplicationWithCompany } from "@/lib/types";

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id
       WHERE a.user_id = ?
       ORDER BY a.updated_at DESC`
    )
    .all(session.id)) as ApplicationWithCompany[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { company_id, job_role, status, deadline, notes } = body as {
    company_id?: string;
    job_role?: string;
    status?: string;
    deadline?: string;
    notes?: string;
  };

  if (!company_id || !job_role?.trim()) {
    return NextResponse.json({ error: "company_id and job_role are required" }, { status: 400 });
  }

  const db = await getDb();
  const company = await db
    .prepare(`SELECT id FROM companies WHERE id = ? AND user_id = ?`)
    .get(company_id, session.id);
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });

  const id = randomUUID();
  await db.prepare(
    `INSERT INTO applications (id, user_id, company_id, job_role, status, deadline, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, session.id, company_id, job_role.trim(), status || "preparing", deadline || null, notes?.trim() || null);

  const row = await db
    .prepare(
      `SELECT a.*, c.name AS company_name, c.industry AS industry
       FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.id = ?`
    )
    .get(id);
  return NextResponse.json(row, { status: 201 });
}
