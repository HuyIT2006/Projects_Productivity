import { NextResponse } from 'next/server';

// Proxy gọi Webhook n8n từ server -> tránh lỗi CORS khi gọi trực tiếp từ trình duyệt.
// Cấu hình trong .env.local (xem .env.example).
const BASE = process.env.N8N_WEBHOOK_BASE || 'http://localhost:5678/webhook';

const FLOW_PATHS: Record<string, string> = {
  '1': process.env.N8N_PATH_FLOW1 || 'task-breakdown',
  '2': process.env.N8N_PATH_FLOW2 || 'workload-balancer',
  '3': process.env.N8N_PATH_FLOW3 || 'skill-matching',
  '4': process.env.N8N_PATH_FLOW4 || 'sprint-auto-schedule',
};

// POST /api/n8n/[flow]  (flow = 1 | 2 | 3 | 4)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flow: string }> }
) {
  const { flow } = await params;
  const path = FLOW_PATHS[flow];
  if (!path) {
    return NextResponse.json({ ok: false, error: 'Luồng không hợp lệ' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const startedAt = Date.now();

  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000), // luồng có gọi Gemini có thể mất 20-60s
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(
      { ok: res.ok, status: res.status, duration_ms: Date.now() - startedAt, webhook: `${BASE}/${path}`, data },
      { status: res.ok ? 200 : 502 }
    );
  } catch (error) {
    console.error(`Error calling n8n flow ${flow}:`, error);
    return NextResponse.json(
      {
        ok: false,
        status: 0,
        duration_ms: Date.now() - startedAt,
        webhook: `${BASE}/${path}`,
        error: 'Không kết nối được n8n. Kiểm tra Docker đang chạy và workflow đã Publish.',
      },
      { status: 502 }
    );
  }
}
