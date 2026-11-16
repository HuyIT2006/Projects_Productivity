// =============================================
// Cấu hình hiển thị cho trang Planning
// Mô tả 4 luồng tự động hoá + các bảng CSDL mà mỗi luồng đọc / ghi
// =============================================

export type FlowId = '1' | '2' | '3' | '4';
export type TableName = 'projects' | 'members' | 'tasks' | 'activity_history' | 'reports';
export type ServiceName = 'gemini' | 'gmail';

// Màu nhận diện cố định cho từng bảng CSDL – dùng xuyên suốt trang
export const TABLES: Record<TableName, { label: string; desc: string; chip: string; dot: string }> = {
  projects: {
    label: 'projects',
    desc: 'Dự án: ngày bắt đầu, deadline',
    chip: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
  },
  members: {
    label: 'members',
    desc: 'Thành viên: kỹ năng, tải tối đa, năng suất',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
  },
  tasks: {
    label: 'tasks',
    desc: 'Công việc: người làm, ưu tiên, hạn chót',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
  },
  activity_history: {
    label: 'activity_history',
    desc: 'Nhật ký mọi thay đổi do hệ thống thực hiện',
    chip: 'bg-teal-50 text-teal-700 ring-teal-200',
    dot: 'bg-teal-500',
  },
  reports: {
    label: 'reports',
    desc: 'Báo cáo & phân tích rủi ro do AI viết',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
  },
};

export const SERVICES: Record<ServiceName, { label: string; chip: string }> = {
  gemini: { label: '✨ Gemini AI', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  gmail: { label: '✉️ Gmail', chip: 'bg-red-50 text-red-700 ring-red-200' },
};

export interface FlowMeta {
  id: FlowId;
  icon: string;
  title: string;
  short: string;
  nodes: number;
  reads: TableName[];
  writes: { table: TableName; field?: string }[];
  services: ServiceName[];
  steps: string[];
  theme: { text: string; soft: string; ring: string; button: string; bar: string };
}

export const FLOWS: Record<FlowId, FlowMeta> = {
  '1': {
    id: '1',
    icon: '🤖',
    title: 'Bóc tách yêu cầu',
    short: 'AI chia một yêu cầu tính năng thành các task kỹ thuật',
    nodes: 17,
    reads: ['projects', 'tasks'],
    writes: [{ table: 'tasks', field: 'task mới' }, { table: 'activity_history', field: 'TASK_CREATED' }],
    services: ['gemini', 'gmail'],
    steps: [
      'Kiểm tra mô tả (≥ 10 ký tự), chuẩn hoá mã dự án và email',
      'Đọc tên dự án, deadline và các task đã có để AI không tạo trùng',
      'Gemini chia yêu cầu thành 3–5 task: story points, kỹ năng, ưu tiên',
      'Loại task trùng tên, giới hạn story points 1–8, lưu vào bảng tasks',
      'Ghi nhật ký TASK_CREATED và gửi email tổng kết',
    ],
    theme: {
      text: 'text-indigo-700',
      soft: 'bg-indigo-50',
      ring: 'ring-indigo-300',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      bar: 'bg-indigo-500',
    },
  },
  '2': {
    id: '2',
    icon: '⚖️',
    title: 'Cân bằng tải',
    short: 'Giao task chưa có người cho thành viên đang rảnh nhất',
    nodes: 15,
    reads: ['tasks', 'members'],
    writes: [{ table: 'tasks', field: 'assignee_id' }, { table: 'activity_history', field: 'TASK_ASSIGNED' }],
    services: ['gmail'],
    steps: [
      'Lấy các task chưa có người làm, xếp URGENT → LOW',
      'Đếm số task đang làm của từng thành viên',
      'Giao cho người có tỷ lệ tải thấp nhất, không vượt tải tối đa',
      'Cập nhật người làm, ghi nhật ký TASK_ASSIGNED',
      'Cảnh báo qua email nếu cả nhóm đã đầy tải',
    ],
    theme: {
      text: 'text-emerald-700',
      soft: 'bg-emerald-50',
      ring: 'ring-emerald-300',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      bar: 'bg-emerald-500',
    },
  },
  '3': {
    id: '3',
    icon: '🎯',
    title: 'Khớp kỹ năng',
    short: 'Chấm điểm và giao task chuyên môn cho người phù hợp nhất',
    nodes: 19,
    reads: ['tasks', 'members'],
    writes: [{ table: 'tasks', field: 'assignee_id' }, { table: 'reports', field: 'SKILL_MATCHING' }],
    services: ['gemini', 'gmail'],
    steps: [
      'Lấy các task chưa có người và có yêu cầu kỹ năng',
      'Chấm điểm: 60% kỹ năng + 25% slot trống + 15% năng suất',
      'Đạt ngưỡng → giao task; không đạt → đánh dấu cần xem xét',
      'Gemini giải thích lý do giao việc',
      'Lưu báo cáo SKILL_MATCHING và gửi email',
    ],
    theme: {
      text: 'text-amber-700',
      soft: 'bg-amber-50',
      ring: 'ring-amber-300',
      button: 'bg-amber-600 hover:bg-amber-700',
      bar: 'bg-amber-500',
    },
  },
  '4': {
    id: '4',
    icon: '📅',
    title: 'Xếp lịch Sprint',
    short: 'Tính hạn chót theo ngày làm việc và đánh giá rủi ro trễ hạn',
    nodes: 17,
    reads: ['projects', 'tasks', 'members'],
    writes: [
      { table: 'tasks', field: 'due_date' },
      { table: 'activity_history', field: 'DUE_DATE_SET' },
      { table: 'reports', field: 'DEADLINE_RISK' },
    ],
    services: ['gemini', 'gmail'],
    steps: [
      'Đọc ngày bắt đầu và deadline của dự án',
      'Lấy task chưa xong, xếp URGENT → LOW',
      'Tính số ngày theo story points và năng suất, bỏ qua Thứ 7 / Chủ nhật',
      'Mỗi người một lịch riêng; ghi due_date và nhật ký DUE_DATE_SET',
      'Nếu có task trễ deadline, Gemini phân tích rủi ro; lưu báo cáo DEADLINE_RISK',
    ],
    theme: {
      text: 'text-rose-700',
      soft: 'bg-rose-50',
      ring: 'ring-rose-300',
      button: 'bg-rose-600 hover:bg-rose-700',
      bar: 'bg-rose-500',
    },
  },
};

// Thứ tự chạy trong quy trình liên hoàn.
// Khớp kỹ năng (3) chạy trước Cân bằng tải (2) để task cần chuyên môn được giao đúng người trước,
// sau đó Cân bằng tải giao nốt phần còn lại.
export const PIPELINE: FlowId[] = ['1', '3', '2', '4'];

export const ACTION_META: Record<string, { label: string; flow?: FlowId }> = {
  TASK_CREATED: { label: 'Tạo task', flow: '1' },
  TASK_ASSIGNED: { label: 'Giao người làm', flow: '2' },
  DUE_DATE_SET: { label: 'Đặt hạn chót', flow: '4' },
  STATUS_CHANGE: { label: 'Đổi trạng thái' },
};

export const REPORT_META: Record<string, { label: string; flow?: FlowId }> = {
  SKILL_MATCHING: { label: 'Khớp kỹ năng', flow: '3' },
  DEADLINE_RISK: { label: 'Rủi ro trễ hạn', flow: '4' },
  WEEKLY_REPORT: { label: 'Báo cáo tuần' },
  STANDUP: { label: 'Standup' },
};
