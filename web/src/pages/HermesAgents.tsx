import { memo, useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import {
  Bot, Send, Eye, Clock, CheckCircle2, AlertTriangle, Loader2, Plus, ChevronDown,
  GripVertical, Users, RefreshCw, ShieldAlert, LayoutList, LayoutGrid, Search,
  Trash2, Power, PowerOff, FileText, X, ArrowRight, FileCode, Terminal,
  Activity, AlertOctagon, Pause, Play, RotateCcw, Edit3, Save, Download,
} from 'lucide-react';
import { api } from '../lib/api';

type TopTab = 'instances' | 'workflows' | 'tasks';
type WorkflowSubTab = 'delegate' | 'kanban' | 'templates';
type TaskSubTab = 'running' | 'history' | 'logs' | 'alerts';
type ViewMode = 'table' | 'card';

interface HermesTeamMember {
  teamId: string;
  teamName?: string;
  agentId: string;
  agentName?: string;
  roleType?: string;
  enabled?: boolean;
  workspace?: string;
  skills?: string[];
  runningTasks?: number;
  lastActive?: number;
}

interface HermesTeam {
  id: string;
  name?: string;
  description?: string;
  managerAgentId?: string;
  defaultSummaryAgentId?: string;
  status?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface CompanyTask {
  id: string;
  teamId?: string;
  title?: string;
  goal?: string;
  status?: string;
  type?: string;
  managerAgentId?: string;
  workerAgentIds?: string[];
  summaryAgentId?: string;
  createdAt?: number;
  startedAt?: number;
  finishedAt?: number;
  resultText?: string;
  reviewResult?: string;
  errorText?: string;
  kanbanColumn?: string;
}

interface WorkflowTemplate {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  createdAt?: number;
  nodes?: any[];
  edges?: any[];
}

interface LogEvent {
  id: string;
  source?: string;
  type?: string;
  level?: string;
  message?: string;
  agentId?: string;
  taskId?: string;
  timestamp?: number;
}

const KANBAN_COLUMNS: { id: string; label: string; tone: string }[] = [
  { id: 'todo', label: '待认领', tone: 'bg-slate-400' },
  { id: 'in_progress', label: '执行中', tone: 'bg-blue-500' },
  { id: 'review', label: '待审核', tone: 'bg-amber-500' },
  { id: 'done', label: '已完成', tone: 'bg-emerald-500' },
  { id: 'failed', label: '异常/待重试', tone: 'bg-red-500' },
];

function statusTone(status?: string) {
  const s = (status || '').toLowerCase();
  if (s === 'running' || s === 'in_progress') return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-200';
  if (s === 'pending' || s === 'todo') return 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-200';
  if (s === 'success' || s === 'completed' || s === 'done') return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-200';
  if (s === 'failed' || s === 'error' || s === 'canceled' || s === 'cancelled') return 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-200';
  if (s === 'review' || s === 'awaiting') return 'text-violet-700 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-200';
  return 'text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300';
}

function StatusPill({ status }: { status?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone(status)}`}>
      {status || 'unknown'}
    </span>
  );
}

function logTone(line: string) {
  const c = line.toLowerCase();
  if (c.includes('error') || c.includes('traceback') || c.includes('failed')) return 'text-red-300';
  if (c.includes('warn') || c.includes('timeout')) return 'text-amber-300';
  if (c.includes('connected') || c.includes('started') || c.includes('running') || c.includes('success')) return 'text-emerald-300';
  return 'text-gray-200';
}

function fmtTime(ts?: number) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString(); } catch { return '-'; }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// =================== Tab 1: Agent 实例（Hermes 多 Agent 团队成员） ===================

function AgentInstancesTab() {
  const navigate = useNavigate();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [members, setMembers] = useState<HermesTeamMember[]>([]);
  const [teams, setTeams] = useState<HermesTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<ViewMode>('table');
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selected, setSelected] = useState<HermesTeamMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      // 1. 拉取所有团队
      const teamsResp = await api.getCompanyTeams();
      const teamList = (teamsResp?.teams || teamsResp || []) as HermesTeam[];
      setTeams(Array.isArray(teamList) ? teamList : []);

      // 2. 拉取每个团队的详情，提取成员
      const memberPromises = teamList.map(async (t) => {
        try {
          const detail = await api.getCompanyTeamDetail(t.id);
          const team = detail?.team || detail;
          const agents = (team?.agents || []) as any[];
          return agents.map((a: any) => ({
            teamId: t.id,
            teamName: t.name || t.id,
            agentId: a.agentId,
            agentName: a.agentName || a.agentId,
            roleType: a.roleType || 'generalist',
            enabled: a.enabled !== false,
            skills: a.skills || [],
          } as HermesTeamMember));
        } catch {
          return [];
        }
      });
      const all = (await Promise.all(memberPromises)).flat();
      setMembers(all);

      // 3. 拉取运行中任务，统计每个 agent 的并发数
      try {
        const tasksResp = await api.getCompanyTasks();
        const tasks = (tasksResp?.tasks || tasksResp || []) as CompanyTask[];
        const runningByAgent: Record<string, number> = {};
        const lastActiveByAgent: Record<string, number> = {};
        tasks.forEach(t => {
          const agents = [t.managerAgentId, t.summaryAgentId, ...(t.workerAgentIds || [])].filter((x): x is string => !!x);
          if (['running', 'pending'].includes((t.status || '').toLowerCase())) {
            agents.forEach(aid => { runningByAgent[aid] = (runningByAgent[aid] || 0) + 1; });
          }
          const ts = t.finishedAt || t.startedAt || t.createdAt;
          if (ts) {
            agents.forEach(aid => {
              if (!lastActiveByAgent[aid] || ts > lastActiveByAgent[aid]) lastActiveByAgent[aid] = ts;
            });
          }
        });
        setMembers(prev => prev.map(m => ({
          ...m,
          runningTasks: runningByAgent[m.agentId] || 0,
          lastActive: lastActiveByAgent[m.agentId],
        })));
      } catch {
        // 任务统计失败不影响主列表
      }
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // 角色去重
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => { if (m.roleType) set.add(m.roleType); });
    return Array.from(set);
  }, [members]);

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (keyword) {
        const k = keyword.toLowerCase();
        if (!((m.agentId || '').toLowerCase().includes(k) ||
              (m.agentName || '').toLowerCase().includes(k) ||
              (m.teamName || '').toLowerCase().includes(k))) return false;
      }
      if (roleFilter !== 'all' && m.roleType !== roleFilter) return false;
      if (statusFilter === 'enabled' && !m.enabled) return false;
      if (statusFilter === 'disabled' && m.enabled) return false;
      return true;
    });
  }, [members, keyword, roleFilter, statusFilter]);

  const openDetail = (m: HermesTeamMember) => setSelected(m);

  // KPI 统计
  const kpi = useMemo(() => ({
    total: members.length,
    enabled: members.filter(m => m.enabled).length,
    running: members.filter(m => (m.runningTasks || 0) > 0).length,
    teams: teams.length,
  }), [members, teams]);

  const cardToneClass = (tone: string) => {
    switch (tone) {
      case 'emerald': return 'border-emerald-100 dark:border-emerald-900/30';
      case 'blue':    return 'border-blue-100 dark:border-blue-900/30';
      case 'violet':  return 'border-violet-100 dark:border-violet-900/30';
      default:        return 'border-gray-100 dark:border-gray-700/50';
    }
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
          {err}
        </div>
      )}

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Agent 总数', value: kpi.total, tone: 'text-slate-700 dark:text-slate-200' },
          { label: '已启用', value: kpi.enabled, tone: 'emerald' },
          { label: '运行中', value: kpi.running, tone: 'blue' },
          { label: '团队数', value: kpi.teams, tone: 'violet' },
        ].map((c, i) => (
          <div key={i} className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800'} rounded-2xl border p-4 ${cardToneClass(c.tone)}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{c.label}</div>
            <div className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* 顶部筛选 & 操作栏 */}
      <div className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-3 flex flex-wrap items-center gap-2`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <Search size={14} className="text-gray-400" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索 Agent / 团队"
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-gray-400"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className={`px-2.5 py-1.5 text-xs rounded-lg border ${modern ? 'border-slate-200/60 dark:border-slate-700/50 bg-transparent' : 'border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800'}`}>
          <option value="all">全部角色</option>
          {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className={`px-2.5 py-1.5 text-xs rounded-lg border ${modern ? 'border-slate-200/60 dark:border-slate-700/50 bg-transparent' : 'border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800'}`}>
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <div className={`flex rounded-lg overflow-hidden ${modern ? '' : 'border border-gray-100 dark:border-gray-700/50'}`}>
          <button onClick={() => setView('table')}
            className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${view === 'table' ? 'bg-blue-500 text-white' : (modern ? 'page-modern-action' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300')}`}>
            <LayoutList size={12} /> 表格
          </button>
          <button onClick={() => setView('card')}
            className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${view === 'card' ? 'bg-blue-500 text-white' : (modern ? 'page-modern-action' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300')}`}>
            <LayoutGrid size={12} /> 卡片
          </button>
        </div>
        <button onClick={() => navigate('/company/teams')}
          className={`${modern ? 'page-modern-accent px-4 py-2 text-xs' : 'px-4 py-2 text-xs rounded-lg bg-blue-600 text-white'} inline-flex items-center gap-1.5`}>
          <Plus size={14} /> 管理团队
        </button>
      </div>

      {/* 主体 */}
      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Bot size={36} className="mb-2 opacity-50" />
          <span className="text-[12px]">暂无多 Agent 团队成员，请先在「管理团队」中创建团队</span>
          <button onClick={() => navigate('/company/teams')} className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[12px] font-bold">
            前往团队管理 →
          </button>
        </div>
      ) : view === 'table' ? (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Agent ID</th>
                <th className="px-3 py-2 text-left font-semibold">名称</th>
                <th className="px-3 py-2 text-left font-semibold">角色</th>
                <th className="px-3 py-2 text-left font-semibold">所属团队</th>
                <th className="px-3 py-2 text-left font-semibold">当前并发</th>
                <th className="px-3 py-2 text-left font-semibold">最后活跃</th>
                <th className="px-3 py-2 text-left font-semibold">状态</th>
                <th className="px-3 py-2 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={`${m.teamId}-${m.agentId}-${i}`} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <button onClick={() => openDetail(m)} className="hover:text-blue-600">{m.agentId}</button>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{m.agentName || '-'}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[10px] font-bold dark:bg-violet-900/30 dark:text-violet-300">
                      {m.roleType || 'generalist'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 text-[11px]">
                    <button onClick={() => navigate(`/company/teams/${m.teamId}`)} className="hover:text-blue-600">
                      {m.teamName || m.teamId}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {(m.runningTasks || 0) > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold animate-pulse">
                        {m.runningTasks} 个任务
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">{fmtTime(m.lastActive)}</td>
                  <td className="px-3 py-2">
                    {m.enabled
                      ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">已启用</span>
                      : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">已禁用</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => navigate(`/company/teams/${m.teamId}`)} className="text-blue-600 hover:underline text-[11px]">查看团队</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((m, i) => (
            <div key={`${m.teamId}-${m.agentId}-${i}`} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Bot size={16} className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{m.agentName || m.agentId}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{m.agentId}</div>
                </div>
                {m.enabled
                  ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">启用</span>
                  : <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">禁用</span>}
              </div>
              <div className="text-[11px] text-slate-500 space-y-1">
                <div>角色：<span className="text-violet-600 font-bold">{m.roleType || 'generalist'}</span></div>
                <div>团队：<button onClick={() => navigate(`/company/teams/${m.teamId}`)} className="text-blue-600 hover:underline">{m.teamName || m.teamId}</button></div>
                <div>并发：{(m.runningTasks || 0) > 0 ? <span className="text-blue-600 font-bold">{m.runningTasks} 个任务</span> : '-'}</div>
                <div>最后活跃：{fmtTime(m.lastActive)}</div>
              </div>
              {m.skills && m.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.skills.slice(0, 4).map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-500 font-bold">{s}</span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-1.5">
                <button onClick={() => openDetail(m)} className="flex-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200">详情</button>
                <button onClick={() => navigate(`/company/teams/${m.teamId}`)} className="flex-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100">查看团队</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent 详情弹窗 */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bot size={16} className="text-violet-500" /> {selected.agentName || selected.agentId}
              </h3>
              <button onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <div className="space-y-2 text-[12px]">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">Agent ID</div><div className="font-mono">{selected.agentId}</div></div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">角色</div><div>{selected.roleType || 'generalist'}</div></div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">所属团队</div><div>{selected.teamName || selected.teamId}</div></div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">启用状态</div><div>{selected.enabled ? '已启用' : '已禁用'}</div></div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">当前并发</div><div>{(selected.runningTasks || 0) > 0 ? `${selected.runningTasks} 个任务` : '-'}</div></div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"><div className="text-[10px] text-slate-500">最后活跃</div><div>{fmtTime(selected.lastActive)}</div></div>
              </div>
              {selected.skills && selected.skills.length > 0 && (
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-[10px] text-slate-500 mb-1.5">技能</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.skills.map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[10px] text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => navigate(`/company/teams/${selected.teamId}`)} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-bold hover:bg-blue-700">
                  打开团队详情 <ArrowRight size={12} className="inline ml-1" />
                </button>
                <button onClick={() => navigate(`/company/tasks`)} className="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-[12px] font-bold hover:bg-slate-200">
                  查看任务
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== Tab 2: 多 Agent 工作流 ===================

function DelegateSubTab() {
  const navigate = useNavigate();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', goal: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getCompanyTasks();
      const list = (resp?.tasks || resp || []) as CompanyTask[];
      setTasks(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const hasRunning = tasks.some(t => ['running', 'pending'].includes((t.status || '').toLowerCase()));
    if (!hasRunning) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load, tasks.length]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(t => (t.status || '').toLowerCase() === statusFilter);
  }, [tasks, statusFilter]);

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.goal.trim()) { setErr('请填写标题和目标'); return; }
    setSubmitting(true);
    setErr('');
    try {
      await api.createCompanyTask({ title: createForm.title.trim(), goal: createForm.goal.trim() });
      setCreateForm({ title: '', goal: '' });
      setShowCreate(false);
      void load();
    } catch (e: any) {
      setErr(e?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
          {err}
        </div>
      )}

      <div className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-3 flex flex-wrap items-center gap-2`}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]">
          <option value="all">全部状态</option>
          <option value="pending">等待</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700">
          <Plus size={12} /> 新建同步任务
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Send size={36} className="mb-2 opacity-50" />
          <span className="text-[12px]">暂无 Delegate 任务</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[13px] font-bold truncate">{t.title || t.id}</h4>
                    <StatusPill status={t.status} />
                    {t.type && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">{t.type}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{t.goal}</p>
                </div>
                <button onClick={() => navigate(`/company/tasks/${t.id}`)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 shrink-0">
                  详情 <ArrowRight size={11} />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-2">
                <span>ID: <code className="text-slate-600 dark:text-slate-300">{t.id}</code></span>
                <span>创建：{fmtTime(t.createdAt)}</span>
                {t.finishedAt && <span>完成：{fmtTime(t.finishedAt)}</span>}
                {t.workerAgentIds && t.workerAgentIds.length > 0 && <span>Workers: {t.workerAgentIds.length}</span>}
              </div>
              {t.errorText && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-[11px] text-red-700 dark:text-red-300">{t.errorText}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">新建 Delegate 任务</h3>
              <button onClick={() => setShowCreate(false)} disabled={submitting}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">任务标题 *</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">任务目标 *</label>
                <textarea value={createForm.goal} onChange={e => setCreateForm(f => ({ ...f, goal: e.target.value }))}
                  rows={5} placeholder="描述要完成的子任务目标..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} disabled={submitting} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[12px]">取消</button>
              <button onClick={handleCreate} disabled={submitting} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[12px] font-bold disabled:opacity-50">
                {submitting ? <><Loader2 size={11} className="inline animate-spin mr-1" />创建中</> : '立即执行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanSubTab() {
  const navigate = useNavigate();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getCompanyTasks();
      const list = (resp?.tasks || resp || []) as CompanyTask[];
      setTasks(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const hasRunning = tasks.some(t => ['running', 'pending'].includes((t.status || '').toLowerCase()));
    if (!hasRunning) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load, tasks.length]);

  const buckets = useMemo(() => {
    const map: Record<string, CompanyTask[]> = {};
    KANBAN_COLUMNS.forEach(c => { map[c.id] = []; });
    tasks.forEach(t => {
      const s = (t.status || '').toLowerCase();
      let col = (t.kanbanColumn as any) || 'todo';
      if (!map[col]) col = 'todo';
      // 智能归类
      if (col === 'todo' && s === 'running') col = 'in_progress';
      if (col === 'in_progress' && (s === 'completed' || s === 'success')) col = 'review';
      if (col === 'review' && t.reviewResult === 'approved') col = 'done';
      if (col === 'todo' && s === 'failed') col = 'failed';
      map[col]?.push(t);
    });
    return map;
  }, [tasks]);

  const onDragStart = (id: string) => setDragId(id);
  const onDrop = (col: string) => {
    if (!dragId) return;
    setTasks(prev => prev.map(t => t.id === dragId ? { ...t, kanbanColumn: col } : t));
    setDragId(null);
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
          {err}
        </div>
      )}

      <div className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-3 flex flex-wrap items-center gap-2`}>
        <span className="text-[11px] text-slate-500">看板视图（拖拽卡片跨列 · 状态仅前端）</span>
        <div className="flex-1" />
        <button onClick={load} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
          <RefreshCw size={11} /> 刷新
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map(col => (
            <div key={col.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(col.id)}
              className="flex-1 min-w-[260px] rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-2">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${col.tone}`} />
                <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{col.label}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">{buckets[col.id]?.length || 0}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {buckets[col.id]?.map(t => (
                  <div key={t.id} draggable
                    onDragStart={() => onDragStart(t.id)}
                    className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h5 className="text-[12px] font-bold flex-1 min-w-0 truncate">{t.title || t.id}</h5>
                      <StatusPill status={t.status} />
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mb-1.5">{t.goal}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{t.type || '-'}</span>
                      <button onClick={() => navigate(`/company/tasks/${t.id}`)} className="text-blue-600 hover:underline">详情 →</button>
                    </div>
                    <GripVertical size={11} className="text-slate-300 inline-block ml-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesSubTab() {
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getWorkflowTemplates();
      const list = (resp?.templates || resp || []) as WorkflowTemplate[];
      setTemplates(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!keyword) return templates;
    const k = keyword.toLowerCase();
    return templates.filter(t => ((t.name || t.id || '').toLowerCase().includes(k) || (t.description || '').toLowerCase().includes(k)));
  }, [templates, keyword]);

  const handleDelete = async (id: string) => {
    if (!confirm(`确定删除模板 "${id}" 吗？`)) return;
    try {
      await api.deleteWorkflowTemplate(id);
      void load();
    } catch (e: any) {
      setErr(e?.message || '删除失败');
    }
  };

  const handleExport = (t: WorkflowTemplate) => {
    downloadText(`workflow-template-${t.id || t.name}.json`, JSON.stringify(t, null, 2));
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const tpl = JSON.parse(text);
        await api.saveWorkflowTemplate(tpl);
        void load();
      } catch (err: any) {
        setErr('导入失败：' + (err?.message || ''));
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
          {err}
        </div>
      )}

      <div className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-3 flex flex-wrap items-center gap-2`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <Search size={14} className="text-slate-400" />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索模板"
            className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-slate-400" />
        </div>
        <button onClick={handleImport} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
          <Download size={12} /> 导入
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FileCode size={36} className="mb-2 opacity-50" />
          <span className="text-[12px]">暂无工作流模板</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(t => (
            <div key={t.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-bold truncate">{t.name || t.id}</h4>
                  {t.category && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">{t.category}</span>}
                </div>
                <FileCode size={16} className="text-slate-400 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 min-h-[2.5em]">{t.description || '无描述'}</p>
              <div className="text-[10px] text-slate-400 mb-3">创建：{fmtTime(t.createdAt)} · 节点 {t.nodes?.length || 0} · 连线 {t.edges?.length || 0}</div>
              <div className="flex gap-1.5">
                <button onClick={() => alert('请前往 /workflows 使用模板')} className="flex-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100">使用</button>
                <button onClick={() => handleExport(t)} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200"><Download size={11} /></button>
                <button onClick={() => handleDelete(t.id)} className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowsTab() {
  const [sub, setSub] = useState<WorkflowSubTab>('delegate');
  const subTabs: { id: WorkflowSubTab; label: string; icon: any }[] = [
    { id: 'delegate', label: 'Delegate 同步任务', icon: Send },
    { id: 'kanban', label: 'Kanban 异步看板', icon: LayoutGrid },
    { id: 'templates', label: '工作流模板', icon: FileCode },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit">
        {subTabs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              sub === s.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <s.icon size={12} /> {s.label}
          </button>
        ))}
      </div>
      {sub === 'delegate' && <DelegateSubTab />}
      {sub === 'kanban' && <KanbanSubTab />}
      {sub === 'templates' && <TemplatesSubTab />}
    </div>
  );
}

// =================== Tab 3: 任务 & 日志 ===================

function TaskListView({ filterStatus, title }: { filterStatus: string[]; title: string }) {
  const navigate = useNavigate();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getCompanyTasks();
      const list = (resp?.tasks || resp || []) as CompanyTask[];
      setTasks(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const hasRunning = filterStatus.includes('running') || filterStatus.includes('pending');
    if (hasRunning) {
      const t = setInterval(load, 2500);
      return () => clearInterval(t);
    }
  }, [load, filterStatus.join(',')]);

  const filtered = useMemo(() => tasks.filter(t => filterStatus.includes((t.status || '').toLowerCase())), [tasks, filterStatus]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 backdrop-blur-xl p-3 flex items-center gap-2">
        <h4 className="text-[12px] font-bold flex-1">{title}</h4>
        <span className="text-[10px] text-slate-500">{filtered.length} 条</span>
        <button onClick={load} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
          <RefreshCw size={11} /> 刷新
        </button>
      </div>
      {err && <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">{err}</div>}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> 加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Activity size={36} className="mb-2 opacity-50" />
          <span className="text-[12px]">暂无任务</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/50 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">任务 ID</th>
                <th className="px-3 py-2 text-left font-semibold">标题</th>
                <th className="px-3 py-2 text-left font-semibold">状态</th>
                <th className="px-3 py-2 text-left font-semibold">起止时间</th>
                <th className="px-3 py-2 text-right font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{t.id.slice(0, 16)}</td>
                  <td className="px-3 py-2 truncate max-w-[300px]">{t.title || t.id}</td>
                  <td className="px-3 py-2"><StatusPill status={t.status} /></td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">{fmtTime(t.startedAt || t.createdAt)} → {fmtTime(t.finishedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => navigate(`/company/tasks/${t.id}`)} className="text-blue-600 hover:underline text-[11px] mr-2">详情</button>
                    {['running', 'pending'].includes((t.status || '').toLowerCase()) && (
                      <button onClick={async () => {
                        try { await api.controlWorkflowRun(t.id, 'cancel'); void load(); } catch {}
                      }} className="text-red-600 hover:underline text-[11px]">取消</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GlobalLogsView() {
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    if (paused) return;
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getEvents({ limit: 200 });
      const list = (resp?.events || resp || []) as LogEvent[];
      setEvents(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [paused]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (levelFilter !== 'all') {
        const lvl = (e.level || e.type || '').toLowerCase();
        if (!lvl.includes(levelFilter)) return false;
      }
      if (keyword) {
        const k = keyword.toLowerCase();
        const text = `${e.message || ''} ${e.source || ''} ${e.agentId || ''} ${e.taskId || ''}`.toLowerCase();
        if (!text.includes(k)) return false;
      }
      return true;
    });
  }, [events, keyword, levelFilter]);

  return (
    <div className="space-y-3">
      <div className={`${modern ? 'page-modern-card' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-3 flex flex-wrap items-center gap-2`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <Search size={14} className="text-slate-400" />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索关键词 / 源 / Agent ID"
            className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-slate-400" />
        </div>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as any)}
          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]">
          <option value="all">全部级别</option>
          <option value="error">错误</option>
          <option value="warn">警告</option>
          <option value="info">信息</option>
        </select>
        <button onClick={() => setPaused(p => !p)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 text-[11px]">
          {paused ? <><Play size={11} /> 继续</> : <><Pause size={11} /> 暂停</>}
        </button>
        <button onClick={() => setEvents([])} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 text-[11px]">
          清空
        </button>
        <button onClick={() => downloadText('global-logs.txt', filtered.map(e => `[${fmtTime(e.timestamp)}] [${e.level || e.type || 'info'}] ${e.source || ''}: ${e.message || ''}`).join('\n'))}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold">
          <Download size={11} /> 导出
        </button>
      </div>
      {err && <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">{err}</div>}
      <div className="bg-gray-950 rounded-2xl p-4 font-mono text-xs leading-6 text-gray-200 max-h-[600px] overflow-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{loading ? '加载中…' : '暂无日志'}</div>
        ) : (
          filtered.map((e, idx) => (
            <div key={e.id || idx} className="flex gap-2">
              <span className="text-gray-500 w-12 text-right shrink-0">{String(idx + 1).padStart(4, '0')}</span>
              <span className={`flex-1 ${logTone(`${e.level || ''} ${e.message || ''}`)}`}>
                [{fmtTime(e.timestamp)}] [{e.source || 'system'}/{e.level || e.type || 'info'}]
                {e.agentId && ` [agent=${e.agentId}]`}
                {' '}{e.message || ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AlertsView() {
  const navigate = useNavigate();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const resp = await api.getEvents({ limit: 500, search: 'error' });
      const list = (resp?.events || resp || []) as LogEvent[];
      const filtered = list.filter(e => {
        const text = `${e.type || ''} ${e.level || ''} ${e.message || ''}`.toLowerCase();
        return text.includes('error') || text.includes('failed') || text.includes('timeout') || text.includes('crash');
      });
      setEvents(filtered);
    } catch (e: any) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-red-100 bg-red-50/30 dark:border-red-900/30 dark:bg-red-900/10 backdrop-blur-xl p-3 flex items-center gap-2">
        <AlertOctagon size={14} className="text-red-500" />
        <h4 className="text-[12px] font-bold flex-1 text-red-700 dark:text-red-300">异常告警</h4>
        <span className="text-[10px] text-red-600">{events.length} 条</span>
        <button onClick={load} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px]">
          <RefreshCw size={11} /> 刷新
        </button>
      </div>
      {err && <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">{err}</div>}
      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> 加载中…</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ShieldAlert size={36} className="mb-2 opacity-50" />
          <span className="text-[12px]">暂无异常告警</span>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e, idx) => (
            <div key={e.id || idx} className="rounded-2xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-[12px] font-bold text-red-700 dark:text-red-300">{e.type || e.level || 'error'}</span>
                  <span className="text-[10px] text-red-500">{fmtTime(e.timestamp)}</span>
                </div>
                <div className="flex gap-1.5">
                  {e.agentId && (
                    <button onClick={() => navigate(`/agents?focus=${e.agentId}`)} className="text-[10px] text-blue-600 hover:underline">查看 Agent</button>
                  )}
                  {e.taskId && (
                    <button onClick={() => navigate(`/company/tasks/${e.taskId}`)} className="text-[10px] text-blue-600 hover:underline">查看任务</button>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-red-900 dark:text-red-200">{e.message}</p>
              <div className="text-[10px] text-red-500 mt-1">源: {e.source || 'unknown'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TasksAndLogsTab() {
  const [sub, setSub] = useState<TaskSubTab>('running');
  const subTabs: { id: TaskSubTab; label: string; icon: any }[] = [
    { id: 'running', label: '运行中任务', icon: Loader2 },
    { id: 'history', label: '历史任务', icon: Clock },
    { id: 'logs', label: '全局日志', icon: Terminal },
    { id: 'alerts', label: '异常告警', icon: AlertOctagon },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 w-fit overflow-x-auto">
        {subTabs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
              sub === s.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <s.icon size={12} className={sub === s.id && s.id === 'running' ? 'animate-spin' : ''} /> {s.label}
          </button>
        ))}
      </div>
      {sub === 'running' && <TaskListView filterStatus={['running', 'pending']} title="运行中任务" />}
      {sub === 'history' && <TaskListView filterStatus={['completed', 'success', 'failed', 'canceled', 'cancelled']} title="历史任务" />}
      {sub === 'logs' && <GlobalLogsView />}
      {sub === 'alerts' && <AlertsView />}
    </div>
  );
}

// =================== 主页面 ===================

function HermesAgentsPage() {
  const { locale } = useI18n();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [searchParams, setSearchParams] = useSearchParams();
  const [topTab, setTopTab] = useState<TopTab>((searchParams.get('tab') as TopTab) || 'instances');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = searchParams.get('tab') as TopTab | null;
    if (t && ['instances', 'workflows', 'tasks'].includes(t)) setTopTab(t);
  }, [searchParams]);

  const switchTab = (tab: TopTab) => {
    setTopTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const tabs: { id: TopTab; label: string; icon: any }[] = [
    { id: 'instances', label: locale === 'zh-CN' ? 'Agent 实例' : 'Agent Instances', icon: Bot },
    { id: 'workflows', label: locale === 'zh-CN' ? '多 Agent 工作流' : 'Multi-Agent Workflows', icon: Send },
    { id: 'tasks', label: locale === 'zh-CN' ? '任务 & 日志' : 'Tasks & Logs', icon: Activity },
  ];

  const exportAll = () => {
    if (topTab === 'instances') alert('请先切换到数据列表');
    else if (topTab === 'workflows') alert('请在 Delegate/Kanban/模板 子页面使用导出');
    else if (topTab === 'tasks') alert('请在日志子页面使用导出');
  };

  return (
    <div className={`h-full flex flex-col ${modern ? 'page-modern' : ''}`}>
      <div className={`${modern ? 'page-modern-header' : 'flex items-center justify-between'} px-5 py-4`}>
        <div>
          <h2 className={`${modern ? 'page-modern-title text-xl' : 'text-xl font-bold text-gray-900 dark:text-white'}`}>
            {locale === 'zh-CN' ? 'Hermes 多 Agent 管理' : 'Hermes Multi-Agent Manager'}
          </h2>
          <p className={`${modern ? 'page-modern-subtitle mt-1 text-sm' : 'mt-1 text-sm text-gray-500'}`}>
            {locale === 'zh-CN' ? 'Agent 实例 / 多 Agent 工作流 / 任务 & 日志 一体化管理' : 'Agent instances / multi-agent workflows / tasks & logs unified'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)} className={`${modern ? 'page-modern-action px-3 py-2 text-xs' : 'px-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-800'} inline-flex items-center gap-2`}>
            <RefreshCw size={14} /> {locale === 'zh-CN' ? '刷新' : 'Refresh'}
          </button>
          <button onClick={exportAll} className={`${modern ? 'page-modern-action px-3 py-2 text-xs' : 'px-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-800'} inline-flex items-center gap-2`}>
            <Download size={14} /> {locale === 'zh-CN' ? '导出' : 'Export'}
          </button>
        </div>
      </div>

      <div className="space-y-6 px-5 pb-5" key={refreshKey}>
        <div className={`flex gap-1 p-1 rounded-xl w-fit ${modern ? 'bg-white/60 dark:bg-slate-800/60' : 'bg-gray-100 dark:bg-gray-800'}`}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                topTab === tab.id
                  ? (modern ? 'page-modern-card text-slate-900 dark:text-white shadow-sm' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm')
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {topTab === 'instances' && <AgentInstancesTab />}
        {topTab === 'workflows' && <WorkflowsTab />}
        {topTab === 'tasks' && <TasksAndLogsTab />}
      </div>
    </div>
  );
}

export default memo(HermesAgentsPage);
