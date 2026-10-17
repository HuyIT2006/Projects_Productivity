import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

// PUT /api/tasks/[id]/status – Đổi trạng thái task + ghi log + tính lead time + gọi n8n webhook
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { new_status, changed_by } = body;

    // 1. Lấy task hiện tại
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskResult.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskResult.rows[0];
    const old_status = task.status;

    if (old_status === new_status) {
      return NextResponse.json({ message: 'Status unchanged', old_status, new_status });
    }

    // 2. Cập nhật trạng thái task trong DB
    await query(
      'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [new_status, id]
    );

    // 3. Ghi vào task_logs
    await query(
      `INSERT INTO task_logs (task_id, changed_by, old_status, new_status, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, changed_by || null, old_status, new_status, `Status changed: ${old_status} → ${new_status}`]
    );

    // 4. Tính lead time (nếu chuyển sang DONE)
    let lead_time_hours: number | null = null;
    if (new_status === 'DONE') {
      const startTime = new Date(task.created_at);
      const endTime = new Date();
      lead_time_hours = Math.round(
        ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * 100
      ) / 100;
    }

    // 5. Ghi vào activity_history
    await query(
      `INSERT INTO activity_history
         (task_id, member_id, action_type, old_value, new_value, lead_time_hours, metadata)
       VALUES ($1, $2, 'STATUS_CHANGE', $3, $4, $5, $6)`,
      [
        id,
        changed_by || null,
        old_status,
        new_status,
        lead_time_hours,
        JSON.stringify({
          task_title: task.title,
          project_id: task.project_id,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    // 6. Gọi n8n Webhook (fire-and-forget, không chặn response)
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(`${webhookUrl}/webhook/flow5-status-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: id,
          task_title: task.title,
          project_id: task.project_id,
          old_status,
          new_status,
          changed_by,
          lead_time_hours,
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) =>
        console.error('n8n webhook call failed (non-blocking):', err)
      );
    }

    // 7. Trả kết quả
    return NextResponse.json({
      success: true,
      old_status,
      new_status,
      lead_time_hours,
      message: lead_time_hours
        ? `✅ Task hoàn thành! Lead time: ${lead_time_hours} giờ`
        : `Status đã chuyển sang ${new_status}`,
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json(
      { error: 'Failed to update task status' },
      { status: 500 }
    );
  }
}
