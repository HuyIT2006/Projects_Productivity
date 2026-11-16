'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task, Project, PRIORITY_COLORS } from '@/lib/types';
import {
  FLOWS,
  PIPELINE,
  TABLES,
  SERVICES,
  ACTION_META,
  REPORT_META,
  FlowId,
  TableName,
} from './config';

type Json = Record<string, unknown>;

interface RunState {
  status: 'idle' | 'running' | 'success' | 'error';
  durationMs?: number;
  data?: Json;
  error?: string;
  at?: number;
}

interface MemberLoad {
  id: string;
  full_name: string;
  skills: string[];
  max_workload: number;
  productivity_score: number;
  current_load: number;
}

interface ReportRow {
  id: string;
  report_type: string;
  risk_score: number | null;
  ai_summary: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  action_type: string;
  new_value: string | null;
  created_at: string;
  task_title: string;
  member_name: string | null;
}

type ChangeKind = 'new' | 'assigned' | 'scheduled';
interface ChangeInfo {
  flows: FlowId[];
  kinds: ChangeKind[];
}
type Filter = 'all' | 'unassigned' | 'unscheduled' | 'changed';

const SAMPLE_FEATURE = 'Xây dựng hệ thống đăng nhập bằng Google OAuth2 và bảo mật JWT';

const CHANGE_LABEL: Record<ChangeKind, string> = {
  new: 'Mới tạo',
  assigned: 'Vừa giao',
  scheduled: 'Vừa xếp lịch',
};

const asNum = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
const fmtTime = (d: string) =>
  new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

// Rút gọn JSON trả về từ n8n thành các con số dễ đọc
function summarize(flow: FlowId, data?: Json): { chips: [string, string][]; text?: string } {
  if (!data) return { chips: [] };
  const chips: [string, string][] = [];
  const n = (key: string, label: string, suffix = '') => {
    const v = asNum(data[key]);
    if (v !== null) chips.push([label, `${v}${suffix}`]);
  };
  if (flow === '1') {
    n('created_count', 'Task đã tạo');
    if (Array.isArray(data.skipped)) chips.push(['Task trùng bị bỏ', String(data.skipped.length)]);
    return { chips };
  }
  if (flow === '2') {
    n('assigned_count', 'Đã giao');
    n('unassigned_count', 'Chưa giao được');
    return { chips, text: asStr(data.message) ?? undefined };
  }
  if (flow === '3') {
    n('assigned', 'Đã giao');
    n('needs_review', 'Cần xem xét');
    return { chips, text: asStr(data.ai_summary) ?? asStr(data.message) ?? undefined };
  }
  n('total_tasks', 'Task được xếp lịch');
  n('late_tasks', 'Task trễ deadline');
  n('risk_score', 'Rủi ro', '%');
  return { chips, text: asStr(data.ai_analysis) ?? undefined };
}

// ---------- Thành phần nhỏ ----------
function TableChip({ name, field }: { name: TableName; field?: string }) {
  const t = TABLES[name];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] ring-1 ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {t.label}
      {field && <span className="font-sans opacity-70">· {field}</span>}
    </span>
  );
}

function StatusDot({ status }: { status: RunState['status'] }) {
  const map = {
    idle: 'bg-gray-300',
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-emerald-500',
    error: 'bg-red-500',
  };
  return <span className={`h-2.5 w-2.5 rounded-full ${map[status]}`} />;
}

const STATUS_TEXT: Record<RunState['status'], string> = {
  idle: 'Chưa chạy',
  running: 'Đang chạy…',
  success: 'Hoàn tất',
  error: 'Lỗi',
};

// =============================================
export default function PlanningDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [email, setEmail] = useState('');
  const [feature, setFeature] = useState(SAMPLE_FEATURE);
  const [minScore, setMinScore] = useState(40);
  const [pointsPerDay, setPointsPerDay] = useState(2);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<MemberLoad[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<FlowId>('1');
  const [runs, setRuns] = useState<Record<FlowId, RunState>>({
    '1': { status: 'idle' },
    '2': { status: 'idle' },
    '3': { status: 'idle' },
    '4': { status: 'idle' },
  });
  const [chainRunning, setChainRunning] = useState(false);
  const [changes, setChanges] = useState<Record<string, ChangeInfo>>({});
  const [filter, setFilter] = useState<Filter>('all');

  const tasksRef = useRef<Task[]>([]);

  // ---------- Tải dữ liệu ----------
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        const list: Project[] = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list.length) setProjectId(list[0].id);
      })
      .catch((e) => console.error('Failed to fetch projects:', e))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async (): Promise<Task[]> => {
    if (!projectId) return [];
    try {
      const [t, o] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/planning/overview?project_id=${projectId}`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      const list: Task[] = Array.isArray(t) ? t : [];
      tasksRef.current = list;
      setTasks(list);
      setMembers(Array.isArray(o.members) ? o.members : []);
      setReports(Array.isArray(o.reports) ? o.reports : []);
      setActivity(Array.isArray(o.activity) ? o.activity : []);
      return list;
    } catch (e) {
      console.error('Failed to refresh data:', e);
      return tasksRef.current;
    }
  }, [projectId]);

  useEffect(() => {
    setChanges({});
    refresh();
  }, [refresh]);

  // ---------- Chạy luồng ----------
  const setRun = (id: FlowId, state: RunState) => setRuns((prev) => ({ ...prev, [id]: state }));

  const runFlow = useCallback(
    async (id: FlowId, accumulate = false): Promise<boolean> => {
      setRun(id, { status: 'running' });
      const before = new Map(tasksRef.current.map((t) => [t.id, t]));

      const body: Json = { project_id: projectId };
      if (email.trim()) body.notify_email = email.trim();
      if (id === '1') body.feature_description = feature;
      if (id === '3') body.min_score = minScore;
      if (id === '4') body.points_per_day = pointsPerDay;

      try {
        const res = await fetch(`/api/n8n/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const out = await res.json();
        const data: Json | undefined = out.data && typeof out.data === 'object' ? out.data : undefined;

        if (!out.ok || data?.success === false) {
          const msg =
            asStr(data?.error) ??
            asStr(data?.message) ??
            out.error ??
            `n8n trả về HTTP ${out.status}. Kiểm tra workflow đã Publish và đúng Path webhook.`;
          setRun(id, { status: 'error', durationMs: out.duration_ms, data, error: msg, at: Date.now() });
          return false;
        }

        setRun(id, { status: 'success', durationMs: out.duration_ms, data, at: Date.now() });

        // So sánh trước / sau để tô sáng các task vừa thay đổi
        const after = await refresh();
        const diff: Record<string, ChangeInfo> = {};
        for (const t of after) {
          const b = before.get(t.id);
          const kinds: ChangeKind[] = [];
          if (!b) kinds.push('new');
          else {
            if (t.assignee_id && b.assignee_id !== t.assignee_id) kinds.push('assigned');
            if (t.due_date && b.due_date !== t.due_date) kinds.push('scheduled');
          }
          if (kinds.length) diff[t.id] = { flows: [id], kinds };
        }
        setChanges((prev) => {
          if (!accumulate) return diff;
          const merged = { ...prev };
          for (const [taskId, info] of Object.entries(diff)) {
            const old = merged[taskId];
            merged[taskId] = old
              ? {
                  flows: Array.from(new Set([...old.flows, ...info.flows])),
                  kinds: Array.from(new Set([...old.kinds, ...info.kinds])),
                }
              : info;
          }
          return merged;
        });
        if (Object.keys(diff).length) setFilter('changed');
        return true;
      } catch {
        setRun(id, { status: 'error', error: 'Không gọi được server Next.js', at: Date.now() });
        return false;
      }
    },
    [projectId, email, feature, minScore, pointsPerDay, refresh]
  );

  const runPipeline = async () => {
    setChainRunning(true);
    setChanges({});
    setRuns({ '1': { status: 'idle' }, '2': { status: 'idle' }, '3': { status: 'idle' }, '4': { status: 'idle' } });
    for (const id of PIPELINE) {
      setSelected(id);
      const ok = await runFlow(id, true);
      if (!ok) break;
    }
    setChainRunning(false);
  };

  // ---------- Số liệu ----------
  const busy = chainRunning || Object.values(runs).some((r) => r.status === 'running');
  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'DONE');
    return {
      total: tasks.length,
      unassigned: open.filter((t) => !t.assignee_id).length,
      unscheduled: open.filter((t) => !t.due_date).length,
      overloaded: members.filter((m) => m.current_load >= m.max_workload).length,
      lastRisk: reports.find((r) => r.report_type === 'DEADLINE_RISK')?.risk_score ?? null,
    };
  }, [tasks, members, reports]);

  const visibleTasks = useMemo(() => {
    const open = (t: Task) => t.status !== 'DONE';
    switch (filter) {
      case 'unassigned':
        return tasks.filter((t) => open(t) && !t.assignee_id);
      case 'unscheduled':
        return tasks.filter((t) => open(t) && !t.due_date);
      case 'changed':
        return tasks.filter((t) => changes[t.id]);
      default:
        return tasks;
    }
  }, [tasks, filter, changes]);

  const changedCount = Object.keys(changes).length;
  const flow = FLOWS[selected];
  const run = runs[selected];
  const result = summarize(selected, run.data);

  // =============================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">🧭 Lập kế hoạch & Phân bổ nguồn lực</h1>
            <p className="text-xs text-slate-500">
              Quy trình tự động: Bóc tách yêu cầu → Khớp kỹ năng → Cân bằng tải → Xếp lịch Sprint
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Dự án
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email nhận thông báo (tuỳ chọn)"
              className="w-60 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ================= SỐ LIỆU TỔNG QUAN ================= */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: 'Tổng task', value: stats.total, note: 'trong dự án', color: 'text-slate-900' },
            { label: 'Chưa có người làm', value: stats.unassigned, note: '→ Bước 2, 3', color: 'text-amber-600' },
            { label: 'Chưa có hạn chót', value: stats.unscheduled, note: '→ Bước 4', color: 'text-sky-600' },
            { label: 'Thành viên đầy tải', value: `${stats.overloaded}/${members.length}`, note: 'đạt tải tối đa', color: 'text-red-600' },
            {
              label: 'Rủi ro trễ hạn',
              value: stats.lastRisk === null ? '—' : `${stats.lastRisk}%`,
              note: 'báo cáo gần nhất',
              color: 'text-rose-600',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.note}</p>
            </div>
          ))}
        </section>

        {/* ================= QUY TRÌNH 4 BƯỚC ================= */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Quy trình tự động</h2>
              <p className="text-sm text-slate-500">
                Bấm vào từng bước để xem chi tiết và chạy riêng, hoặc chạy cả quy trình một lần.
              </p>
            </div>
            <button
              onClick={runPipeline}
              disabled={busy || !projectId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chainRunning ? '⏳ Đang chạy quy trình…' : '🚀 Chạy toàn bộ quy trình'}
            </button>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {PIPELINE.map((id, idx) => {
              const f = FLOWS[id];
              const r = runs[id];
              const active = selected === id;
              const nextDone = r.status === 'success';
              return (
                <div key={id} className="contents">
                  <button
                    onClick={() => setSelected(id)}
                    className={`flex flex-col rounded-xl border p-3 text-left transition ${
                      active ? `border-transparent ring-2 ${f.theme.ring} ${f.theme.soft}` : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Bước {idx + 1} · Luồng {id}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <StatusDot status={r.status} />
                        {STATUS_TEXT[r.status]}
                      </span>
                    </div>
                    <p className={`mt-1 text-base font-bold ${f.theme.text}`}>
                      {f.icon} {f.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{f.short}</p>
                    <div className="mt-2 space-y-1 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="w-8 text-slate-400">Đọc</span>
                        {f.reads.map((t) => (
                          <TableChip key={t} name={t} />
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="w-8 text-slate-400">Ghi</span>
                        {f.writes.map((w) => (
                          <TableChip key={w.table + w.field} name={w.table} />
                        ))}
                      </div>
                    </div>
                  </button>
                  {idx < PIPELINE.length - 1 && (
                    <div className="flex items-center justify-center">
                      <span
                        className={`rotate-90 text-2xl transition-colors lg:rotate-0 ${
                          nextDone ? 'text-emerald-500' : 'text-slate-300'
                        }`}
                      >
                        ➜
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            ℹ️ Khớp kỹ năng chạy trước Cân bằng tải để task cần chuyên môn được giao đúng người trước; Cân bằng tải giao
            nốt phần còn lại cho người đang rảnh nhất.
          </p>

          {/* Chú giải bảng CSDL */}
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bảng CSDL (PostgreSQL)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(TABLES) as TableName[]).map((t) => (
                <div key={t} className="flex flex-col gap-1">
                  <TableChip name={t} />
                  <span className="text-[11px] text-slate-500">{TABLES[t].desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= CHI TIẾT BƯỚC + NHẬT KÝ ================= */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Chi tiết bước đang chọn */}
          <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2`}>
            <div className={`rounded-t-2xl px-5 py-3 ${flow.theme.soft}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={`text-lg font-bold ${flow.theme.text}`}>
                  {flow.icon} Bước {PIPELINE.indexOf(selected) + 1}: {flow.title}
                  <span className="ml-2 text-xs font-medium text-slate-500">(Luồng {flow.id} · {flow.nodes} node n8n)</span>
                </h2>
                <div className="flex flex-wrap gap-1">
                  {flow.services.map((s) => (
                    <span key={s} className={`rounded-md px-1.5 py-0.5 text-[11px] ring-1 ${SERVICES[s].chip}`}>
                      {SERVICES[s].label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
              {/* Cách hoạt động */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Cách hoạt động</h3>
                <ol className="space-y-2">
                  {flow.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${flow.theme.bar}`}
                      >
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="w-10 font-medium text-slate-500">Đọc:</span>
                    {flow.reads.map((t) => (
                      <TableChip key={t} name={t} />
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="w-10 font-medium text-slate-500">Ghi:</span>
                    {flow.writes.map((w) => (
                      <TableChip key={w.table + w.field} name={w.table} field={w.field} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Đầu vào + chạy + kết quả */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Đầu vào</h3>
                {selected === '1' && (
                  <textarea
                    value={feature}
                    onChange={(e) => setFeature(e.target.value)}
                    rows={4}
                    placeholder="Mô tả tính năng cần xây dựng (ít nhất 10 ký tự)…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
                {selected === '2' && (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Không cần nhập. Hệ thống tự lấy <b>{stats.unassigned}</b> task chưa có người làm của dự án.
                  </p>
                )}
                {selected === '3' && (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Điểm tối thiểu để được giao
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                    />
                    / 100
                  </label>
                )}
                {selected === '4' && (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Năng suất chuẩn
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={pointsPerDay}
                      onChange={(e) => setPointsPerDay(Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                    />
                    story points / ngày
                  </label>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => runFlow(selected)}
                    disabled={busy || !projectId}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 ${flow.theme.button}`}
                  >
                    {run.status === 'running' ? '⏳ Đang chạy…' : '▶ Chạy bước này'}
                  </button>
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <StatusDot status={run.status} />
                    {STATUS_TEXT[run.status]}
                    {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ''}
                  </span>
                </div>

                {run.status === 'error' && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {run.error}</p>
                )}

                {run.status === 'success' && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kết quả</p>
                    <div className="flex flex-wrap gap-2">
                      {result.chips.map(([label, value]) => (
                        <span key={label} className={`rounded-full px-3 py-1 text-xs font-semibold ${flow.theme.soft} ${flow.theme.text}`}>
                          {label}: {value}
                        </span>
                      ))}
                    </div>
                    {result.text && <p className="text-sm italic text-slate-600">“{result.text}”</p>}
                    {changedCount > 0 && (
                      <button
                        onClick={() => setFilter('changed')}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Xem {changedCount} task vừa thay đổi trong bảng bên dưới ↓
                      </button>
                    )}
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer">Phản hồi JSON từ n8n</summary>
                      <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-slate-100">
                        {JSON.stringify(run.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nhật ký hoạt động */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Nhật ký</h2>
              <TableChip name="activity_history" />
            </div>
            <ol className="max-h-[440px] space-y-3 overflow-auto pr-1">
              {activity.map((a) => {
                const meta = ACTION_META[a.action_type] ?? { label: a.action_type };
                const f = meta.flow ? FLOWS[meta.flow] : null;
                return (
                  <li key={a.id} className="flex gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f ? f.theme.bar : 'bg-slate-400'}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">
                        {fmtTime(a.created_at)} · <span className={f ? f.theme.text : ''}>{meta.label}</span>
                      </p>
                      <p className="truncate text-sm text-slate-700" title={a.task_title}>
                        {a.task_title}
                      </p>
                      {a.action_type === 'TASK_ASSIGNED' && (a.member_name || a.new_value) && (
                        <p className="text-xs text-slate-500">→ {a.member_name ?? a.new_value}</p>
                      )}
                      {a.action_type === 'DUE_DATE_SET' && a.new_value && (
                        <p className="text-xs text-slate-500">→ hạn {a.new_value}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {!activity.length && <p className="text-sm italic text-slate-400">Chưa có hoạt động nào.</p>}
            </ol>
          </div>
        </section>

        {/* ================= TẢI THÀNH VIÊN ================= */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tải công việc thành viên</h2>
              <p className="text-xs text-slate-500">Số task đang làm (TODO / IN_PROGRESS / IN_REVIEW) trên mọi dự án</p>
            </div>
            <div className="flex gap-1">
              <TableChip name="members" />
              <TableChip name="tasks" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {members.map((m) => {
              const pct = m.max_workload > 0 ? Math.min(100, (m.current_load / m.max_workload) * 100) : 0;
              const full = m.current_load >= m.max_workload;
              const bar = full ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{m.full_name}</span>
                    <span className={`text-sm font-medium ${full ? 'text-red-600' : 'text-slate-500'}`}>
                      {m.current_load}/{m.max_workload} {full && '· đầy tải'}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {m.skills?.map((s) => (
                      <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {s}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">Năng suất {m.productivity_score}</span>
                  </div>
                </div>
              );
            })}
            {!members.length && !loading && <p className="text-sm italic text-slate-400">Chưa có thành viên.</p>}
          </div>
          {members.length > 0 && stats.overloaded === members.length && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚠️ Tất cả thành viên đã đầy tải — Cân bằng tải sẽ không giao thêm được task. Hãy tăng tải tối đa hoặc hoàn
              thành bớt task.
            </p>
          )}
        </section>

        {/* ================= BẢNG TASK ================= */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Danh sách task</h2>
              <TableChip name="tasks" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['all', `Tất cả (${tasks.length})`],
                  ['unassigned', `Chưa có người (${stats.unassigned})`],
                  ['unscheduled', `Chưa có hạn (${stats.unscheduled})`],
                  ['changed', `Vừa thay đổi (${changedCount})`],
                ] as [Filter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => refresh()}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                ↻ Làm mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Ưu tiên</th>
                  <th className="py-2 pr-3 text-center">SP</th>
                  <th className="py-2 pr-3">Kỹ năng cần</th>
                  <th className="py-2 pr-3">Người làm</th>
                  <th className="py-2 pr-3">Hạn chót</th>
                  <th className="py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((t) => {
                  const ch = changes[t.id];
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-slate-100 align-top transition-colors ${ch ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-900">{t.title}</p>
                        {ch && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ch.kinds.map((k) => (
                              <span key={k} className="rounded bg-yellow-200 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800">
                                {CHANGE_LABEL[k]}
                              </span>
                            ))}
                            {ch.flows.map((fid) => (
                              <span
                                key={fid}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${FLOWS[fid].theme.soft} ${FLOWS[fid].theme.text}`}
                              >
                                {FLOWS[fid].title}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-center">{t.story_points}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {t.required_skills?.map((s) => (
                            <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {t.assignee_name ? (
                          <span className="font-medium text-slate-800">{t.assignee_name}</span>
                        ) : (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Chưa có</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {fmtDate(t.due_date) ?? (
                          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">Chưa có</span>
                        )}
                      </td>
                      <td className="py-2 text-xs font-medium text-slate-600">{t.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleTasks.length && !loading && (
              <p className="py-6 text-center text-sm italic text-slate-400">Không có task nào trong bộ lọc này.</p>
            )}
          </div>
        </section>

        {/* ================= BÁO CÁO AI ================= */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Báo cáo AI</h2>
            <TableChip name="reports" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reports.map((r) => {
              const meta = REPORT_META[r.report_type] ?? { label: r.report_type };
              const f = meta.flow ? FLOWS[meta.flow] : null;
              return (
                <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${f ? `${f.theme.soft} ${f.theme.text}` : 'bg-slate-100'}`}>
                      {f?.icon} {meta.label}
                    </span>
                    {r.risk_score !== null && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">Rủi ro {r.risk_score}%</span>
                    )}
                    <span className="ml-auto text-slate-400">{fmtTime(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{r.ai_summary}</p>
                </div>
              );
            })}
            {!reports.length && (
              <p className="text-sm italic text-slate-400">Chưa có báo cáo — chạy bước Khớp kỹ năng hoặc Xếp lịch Sprint.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
