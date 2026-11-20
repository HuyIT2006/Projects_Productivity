'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DiagnosticItem {
  id: string;
  project_id: string | null;
  diagnostic_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  evidence: Array<{ type?: string; detail: string }>;
  recommendations: Array<{ action: string; priority?: string; detail: string }>;
  affected_tasks: Array<{ task_id: string; title: string }>;
  affected_members: Array<{ member_id: string; name: string }>;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; iconBg: string }> = {
  STUCK_TASKS:        { label: 'Task Tắc nghẽn',     icon: '⏳', bg: 'bg-amber-50',  text: 'text-amber-700',  iconBg: 'bg-amber-100' },
  OVERDUE_DEADLINE:   { label: 'Trễ hạn Deadline',   icon: '🚨', bg: 'bg-red-50',    text: 'text-red-700',    iconBg: 'bg-red-100'   },
  MEMBER_OVERLOAD:    { label: 'Quá tải nhân sự',     icon: '🔥', bg: 'bg-rose-50',   text: 'text-rose-700',   iconBg: 'bg-rose-100'  },
  WORKLOAD_IMBALANCE: { label: 'Lệch tải công việc',  icon: '⚖️', bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100'},
  GENERAL:            { label: 'Điểm nghẽn hệ thống', icon: '⚠️', bg: 'bg-gray-50',   text: 'text-gray-700',   iconBg: 'bg-gray-100'  },
};

const SEVERITY_CONFIG: Record<string, { badge: string; border: string }> = {
  CRITICAL: { badge: 'bg-red-600 text-white',    border: 'border-red-200'    },
  HIGH:     { badge: 'bg-orange-500 text-white', border: 'border-orange-200' },
  MEDIUM:   { badge: 'bg-amber-500 text-white',  border: 'border-amber-200'  },
  LOW:      { badge: 'bg-blue-500 text-white',   border: 'border-blue-200'   },
};

export default function AIDiagnosticsPanel({ projectId }: { projectId?: string }) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  /* ── Fetch: CHỈ theo đúng project đang chọn ── */
  const fetchDiagnostics = useCallback(() => {
    setIsLoading(true);
    const url = projectId
      ? `/api/diagnostics?project_id=${projectId}&limit=20`
      : `/api/diagnostics?limit=20`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => setDiagnostics(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [projectId]); // KHÔNG fallback sang project khác

  useEffect(() => { fetchDiagnostics(); }, [fetchDiagnostics]);

  /* ── Slider navigation ── */
  const scroll = (dir: 'left' | 'right') => {
    if (!sliderRef.current) return;
    sliderRef.current.scrollBy({ left: dir === 'right' ? 320 : -320, behavior: 'smooth' });
  };

  const criticalCount = diagnostics.filter(d => d.severity === 'CRITICAL').length;
  const highCount     = diagnostics.filter(d => d.severity === 'HIGH').length;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header (click để ẩn/hiện) ── */}
      <div
        className="flex cursor-pointer items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3.5 select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🤖</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">AI Chẩn đoán Điểm nghẽn</span>
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Luồng 7</span>
              {criticalCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{criticalCount} CRITICAL</span>
              )}
              {highCount > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">{highCount} HIGH</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isLoading
                ? 'Đang tải...'
                : diagnostics.length === 0
                  ? 'Dự án này chưa có chẩn đoán AI — hãy chạy Luồng 7 trên n8n'
                  : `${diagnostics.length} vấn đề được Gemini AI phân tích cho dự án này`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); fetchDiagnostics(); }}
            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 transition"
          >
            ↻ Làm mới
          </button>
          <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Body (accordion) ── */}
      {isOpen && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Đang tải kết quả AI...
            </div>
          ) : diagnostics.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="text-sm font-semibold text-gray-700">Chưa có chẩn đoán cho dự án này</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Mở n8n → chạy <strong>Flow 7 – AI Bottleneck Diagnostic</strong> để phân tích dự án đang chọn.
              </p>
            </div>
          ) : (
            /* ── Horizontal Slider ── */
            <div className="relative">
              {/* Nút scroll trái */}
              {diagnostics.length > 2 && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-600 hover:bg-gray-50 transition -ml-3"
                >
                  ‹
                </button>
              )}

              {/* Slide track */}
              <div
                ref={sliderRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-2 px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {diagnostics.map((item) => {
                  const tc = TYPE_CONFIG[item.diagnostic_type] || TYPE_CONFIG.GENERAL;
                  const sc = SEVERITY_CONFIG[item.severity]  || SEVERITY_CONFIG.MEDIUM;

                  return (
                    <div
                      key={item.id}
                      className={`flex-shrink-0 w-72 rounded-xl border ${sc.border} ${tc.bg} p-4 flex flex-col gap-2 shadow-sm`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${tc.iconBg}`}>
                            {tc.icon}
                          </span>
                          <div className="min-w-0">
                            <span className={`text-[10px] font-bold uppercase ${tc.text}`}>{tc.label}</span>
                            <p className="text-xs font-bold text-gray-900 leading-snug truncate max-w-[160px]" title={item.title}>
                              {item.title}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${sc.badge}`}>
                          {item.severity}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-2">{item.description}</p>

                      {/* Recommendations (compact) */}
                      {Array.isArray(item.recommendations) && item.recommendations.length > 0 && (
                        <div className="rounded-lg bg-white/80 border border-indigo-100 p-2.5">
                          <p className="text-[10px] font-black text-indigo-700 uppercase mb-1 flex items-center gap-1">
                            <span>💡</span> Khuyến nghị AI:
                          </p>
                          <ul className="space-y-1 text-[11px] text-gray-600">
                            {item.recommendations.slice(0, 2).map((r, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-indigo-400 font-bold">•</span>
                                <span><strong className="text-gray-800">{r.action}:</strong> {r.detail}</span>
                              </li>
                            ))}
                            {item.recommendations.length > 2 && (
                              <li className="text-indigo-500 font-semibold text-[10px]">
                                +{item.recommendations.length - 2} khuyến nghị khác
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Affected tags */}
                      {(item.affected_members?.length > 0 || item.affected_tasks?.length > 0) && (
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {item.affected_members?.slice(0, 2).map((m, i) => (
                            <span key={i} className="rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-700">
                              👤 {m.name}
                            </span>
                          ))}
                          {item.affected_tasks?.slice(0, 2).map((t, i) => (
                            <span key={i} className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-600">
                              📌 {t.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-auto pt-1.5 border-t border-gray-200/60 text-[10px] text-gray-400">
                        {new Date(item.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nút scroll phải */}
              {diagnostics.length > 2 && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md text-gray-600 hover:bg-gray-50 transition -mr-3"
                >
                  ›
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
