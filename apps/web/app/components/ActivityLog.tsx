'use client';

import { useState } from 'react';
import { ActivityEntry } from '@/lib/types';

interface ActivityLogProps {
  activities: ActivityEntry[];
  isLoading: boolean;
}

const STATUS_EMOJI: Record<string, string> = {
  TODO: '📝', IN_PROGRESS: '🔄', IN_REVIEW: '👀', DONE: '✅',
};

const STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done',
};

export default function ActivityLog({ activities, isLoading }: ActivityLogProps) {
  const [isOpen, setIsOpen] = useState(false); // Mặc định đóng để gọn trang
  const [showAll, setShowAll] = useState(false);

  const fmtTime = (d: string) =>
    new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const displayed = showAll ? activities : activities.slice(0, 5);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header accordion */}
      <div
        className="flex cursor-pointer items-center justify-between bg-gray-50 px-5 py-3.5 select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📜</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Nhật ký Hoạt động</span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">Luồng 5</span>
              {!isLoading && activities.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {activities.length} thao tác
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isLoading ? 'Đang tải...' : isOpen ? 'Lịch sử thay đổi trạng thái task' : 'Bấm để xem lịch sử'}
            </p>
          </div>
        </div>
        <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="px-5 pb-4 pt-3">
          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3 items-center">
                  <div className="h-6 w-6 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400 italic">Chưa có hoạt động nào được ghi nhận.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {displayed.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-2.5 hover:bg-gray-100 transition-colors"
                  >
                    {/* Avatar circle */}
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                      {(a.member_name || 'S').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800">
                        <span className="font-semibold text-gray-900">{a.member_name || 'System'}</span>
                        {' '}<span className="text-gray-500">chuyển</span>{' '}
                        <span className="font-semibold text-indigo-700 truncate">{a.task_title || 'task'}</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                        <span>
                          {STATUS_EMOJI[a.old_value || ''] || '—'} {STATUS_LABEL[a.old_value || ''] || a.old_value || '—'}
                          {' → '}
                          {STATUS_EMOJI[a.new_value || '']} {STATUS_LABEL[a.new_value || ''] || a.new_value}
                        </span>
                        {a.lead_time_hours && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">
                            ⏱ {a.lead_time_hours}h
                          </span>
                        )}
                        <span className="text-gray-400">🕐 {fmtTime(a.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activities.length > 5 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  {showAll ? '▲ Thu gọn' : `▼ Xem thêm ${activities.length - 5} thao tác khác`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
