'use client';

import { ActivityEntry } from '@/lib/types';

interface ActivityLogProps {
  activities: ActivityEntry[];
  isLoading: boolean;
}

export default function ActivityLog({ activities, isLoading }: ActivityLogProps) {
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusEmoji = (status: string | null) => {
    switch (status) {
      case 'TODO': return '📝';
      case 'IN_PROGRESS': return '🔄';
      case 'IN_REVIEW': return '👀';
      case 'DONE': return '✅';
      default: return '📋';
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-gray-800">📜 Activity History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-bold text-gray-800">
        📜 Activity History
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
          {activities.length}
        </span>
      </h3>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Chưa có hoạt động nào được ghi nhận.</p>
      ) : (
        <div className="max-h-[400px] space-y-2 overflow-y-auto pr-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
            >
              {/* Timeline dot */}
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs">
                {getStatusEmoji(activity.new_value)}
              </div>

              <div className="min-w-0 flex-1">
                {/* Main info */}
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">
                    {activity.member_name || 'System'}
                  </span>
                  {' đã chuyển '}
                  <span className="font-medium text-indigo-600">
                    {activity.task_title || 'Unknown Task'}
                  </span>
                </p>

                {/* Status change */}
                <p className="mt-0.5 text-xs text-gray-500">
                  {getStatusEmoji(activity.old_value)} {activity.old_value || '—'}
                  {' → '}
                  {getStatusEmoji(activity.new_value)} {activity.new_value}
                </p>

                {/* Lead time */}
                {activity.lead_time_hours && (
                  <p className="mt-1 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 inline-block">
                    ⏱️ Lead time: <strong>{activity.lead_time_hours} giờ</strong>
                  </p>
                )}

                {/* Timestamp */}
                <p className="mt-1 text-[11px] text-gray-400">
                  🕐 {formatTime(activity.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
