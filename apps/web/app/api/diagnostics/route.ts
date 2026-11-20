import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/diagnostics – Xem danh sách các chẩn đoán gần đây
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let whereClause = '';
    const params: unknown[] = [limit];

    if (projectId) {
      params.push(projectId);
      whereClause = 'WHERE project_id = $2';
    }

    const result = await query(
      `SELECT * FROM bottleneck_diagnostics ${whereClause} ORDER BY created_at DESC LIMIT $1`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching diagnostics:', error);
    return NextResponse.json({ error: 'Failed to fetch diagnostics' }, { status: 500 });
  }
}

// POST /api/diagnostics – Lưu chẩn đoán từ Luồng 7 (n8n)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      project_id,
      diagnostic_type,
      severity,
      title,
      description,
      evidence = [],
      recommendations = [],
      affected_tasks = [],
      affected_members = [],
      ai_raw_response = null,
      metadata = {},
    } = body;

    // Lấy default project nếu project_id rỗng
    let targetProjectId = project_id;
    if (!targetProjectId) {
      const proj = await query('SELECT id FROM projects LIMIT 1');
      targetProjectId = proj.rows[0]?.id || null;
    }

    const result = await query(
      `INSERT INTO bottleneck_diagnostics (
        project_id,
        diagnostic_type,
        severity,
        title,
        description,
        evidence,
        recommendations,
        affected_tasks,
        affected_members,
        ai_raw_response,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        targetProjectId,
        diagnostic_type || 'GENERAL_BOTTLENECK',
        severity || 'MEDIUM',
        title || 'Phát hiện điểm nghẽn',
        description || 'Chẩn đoán tự động từ hệ thống AI',
        JSON.stringify(evidence),
        JSON.stringify(recommendations),
        JSON.stringify(affected_tasks),
        JSON.stringify(affected_members),
        ai_raw_response ? JSON.stringify(ai_raw_response) : null,
        JSON.stringify(metadata),
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error saving diagnostic:', error);
    return NextResponse.json({ error: 'Failed to save diagnostic' }, { status: 500 });
  }
}
