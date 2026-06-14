import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { ExternalLink, FileCog, RefreshCw, Save, SlidersHorizontal, Settings2, Download, ArrowUpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n';

interface HermesStatus {
  installed?: boolean;
  running?: boolean;
  version?: string;
  binaryPath?: string;
  configPath?: string;
  envPath?: string;
  homeDir?: string;
  docsUrl?: string;
  repoUrl?: string;
}

interface StructuredConfig {
  model?: Record<string, any>;
  gateway?: Record<string, any>;
  session?: Record<string, any>;
  tools?: Record<string, any>;
  memory?: Record<string, any>;
  personality?: Record<string, any>;
  profiles?: Record<string, any>;
}

export default function HermesConfig() {
  const { locale } = useI18n();
  const { uiMode } = (useOutletContext() as { uiMode?: 'modern' }) || {};
  const modern = uiMode === 'modern';
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [config, setConfig] = useState<StructuredConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [statusRes, configRes] = await Promise.all([
        api.getHermesStatus(),
        api.getHermesStructuredConfig(),
      ]);
      if (statusRes.ok) setStatus(statusRes.status || {});
      if (configRes.ok) setConfig(configRes.config || {});
    } catch {
      setErr(locale === 'zh-CN' ? '加载 Hermes 配置失败' : 'Failed to load Hermes config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateNested = (block: keyof StructuredConfig, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [block]: {
        ...(prev[block] || {}),
        [key]: value,
      },
    }));
  };

  const updateToggle = (block: keyof StructuredConfig, key: string, checked: boolean) => {
    updateNested(block, key, checked);
  };

  const updateBlock = (key: keyof StructuredConfig, text: string) => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      setConfig(prev => ({ ...prev, [key]: parsed }));
      setErr('');
    } catch (e) {
      setErr(locale === 'zh-CN' ? `配置块 ${String(key)} JSON 格式错误: ${String(e)}` : `Invalid JSON for ${String(key)}: ${String(e)}`);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const r = await api.updateHermesStructuredConfig(config);
      if (r.ok) {
        setMsg(locale === 'zh-CN' ? 'Hermes 结构化配置已保存' : 'Hermes structured config saved');
        await load();
      } else {
        setErr(r.error || 'Save failed');
      }
    } catch {
      setErr(locale === 'zh-CN' ? '保存 Hermes 配置失败' : 'Failed to save Hermes config');
    } finally {
      setSaving(false);
    }
  };

  const runUpgrade = async () => {
    setUpgrading(true);
    setUpgradeResult(null);
    try {
      const r = await api.runHermesAction('update');
      if (r.ok) {
        setUpgradeResult({ ok: true, message: r.message || (locale === 'zh-CN' ? '升级任务已启动' : 'Upgrade task started') });
        await load();
      } else {
        setUpgradeResult({ ok: false, message: r.error || (locale === 'zh-CN' ? '升级失败' : 'Upgrade failed') });
      }
    } catch {
      setUpgradeResult({ ok: false, message: locale === 'zh-CN' ? '升级请求失败' : 'Upgrade request failed' });
    } finally {
      setUpgrading(false);
    }
  };

  const blocks: Array<{ key: keyof StructuredConfig; label: string }> = [
    { key: 'model', label: 'Model' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'session', label: 'Session' },
    { key: 'tools', label: 'Tools' },
    { key: 'memory', label: 'Memory' },
    { key: 'personality', label: 'Personality' },
  ];

  return (
    <div className={`space-y-6 ${modern ? 'page-modern' : ''}`}>
      <div className={`${modern ? 'page-modern-header' : 'flex items-center justify-between'}`}>
        <div>
          <h2 className={`${modern ? 'page-modern-title text-xl' : 'text-xl font-bold text-gray-900 dark:text-white'}`}>{locale === 'zh-CN' ? 'Hermes 配置' : 'Hermes Config'}</h2>
          <p className={`${modern ? 'page-modern-subtitle mt-1 text-sm' : 'text-sm text-gray-500 mt-1'}`}>
            {locale === 'zh-CN'
              ? '这里优先承接 Hermes 的结构化配置域，避免直接手改整份 YAML。'
              : 'This page focuses on Hermes structured config domains instead of editing the entire YAML directly.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className={`${modern ? 'page-modern-action px-3 py-2 text-xs' : 'px-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-800'} inline-flex items-center gap-2`}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {locale === 'zh-CN' ? '刷新' : 'Refresh'}
          </button>
          <button onClick={save} disabled={saving} className={`${modern ? 'page-modern-accent px-4 py-2 text-xs disabled:opacity-50' : 'px-4 py-2 text-xs rounded-lg bg-blue-600 text-white disabled:opacity-50'} inline-flex items-center gap-2`}>
            <Save size={14} />
            {locale === 'zh-CN' ? '保存' : 'Save'}
          </button>
        </div>
      </div>

      {msg && <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">{msg}</div>}
      {err && <div className="rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">{err}</div>}

      {/* Version & Upgrade Section */}
      <div className={`${modern ? 'page-modern-panel' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status?.installed ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {status?.installed
                ? <CheckCircle2 size={20} className="text-emerald-500" />
                : <AlertCircle size={20} className="text-gray-400" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {locale === 'zh-CN' ? 'Hermes 版本' : 'Hermes Version'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {status?.version
                  ? status.version
                  : status?.installed
                    ? (locale === 'zh-CN' ? '已安装（版本未知）' : 'Installed (version unknown)')
                    : (locale === 'zh-CN' ? '未安装' : 'Not installed')}
              </div>
            </div>
            {status?.binaryPath && (
              <div className="hidden sm:block ml-2 text-[11px] font-mono text-gray-400 max-w-[200px] truncate" title={status.binaryPath}>
                {status.binaryPath}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status?.installed && (
              <button
                onClick={runUpgrade}
                disabled={upgrading}
                className={`${modern ? 'page-modern-accent' : 'bg-blue-600 text-white'} px-4 py-2 text-xs rounded-xl inline-flex items-center gap-2 disabled:opacity-50`}
              >
                <ArrowUpCircle size={14} className={upgrading ? 'animate-spin' : ''} />
                {upgrading
                  ? (locale === 'zh-CN' ? '升级中...' : 'Upgrading...')
                  : (locale === 'zh-CN' ? '升级到最新版' : 'Upgrade to latest')}
              </button>
            )}
            {!status?.installed && (
              <span className="text-xs text-gray-400">
                {locale === 'zh-CN' ? '请先安装 Hermes' : 'Please install Hermes first'}
              </span>
            )}
          </div>
        </div>
        {upgradeResult && (
          <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${upgradeResult.ok
            ? 'border border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300'
            : 'border border-red-100 bg-red-50/80 text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300'
          }`}>
            {upgradeResult.message}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={`${modern ? 'page-modern-panel' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-5 space-y-4`}>
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <Settings2 size={18} className="text-blue-500" />
            {locale === 'zh-CN' ? '常用模型设置' : 'Common Model Settings'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Provider</span>
              <input
                value={String(config.model?.provider || '')}
                onChange={e => updateNested('model', 'provider', e.target.value)}
                placeholder="openrouter / openai / anthropic"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Model Name</span>
              <input
                value={String(config.model?.name || '')}
                onChange={e => updateNested('model', 'name', e.target.value)}
                placeholder="anthropic/claude-sonnet-4-5"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Temperature</span>
              <input
                type="number"
                step="0.1"
                value={config.model?.temperature ?? ''}
                onChange={e => updateNested('model', 'temperature', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="0.7"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Max Tokens</span>
              <input
                type="number"
                value={config.model?.max_tokens ?? config.model?.maxTokens ?? ''}
                onChange={e => updateNested('model', 'max_tokens', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="4096"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Top P</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={config.model?.top_p ?? ''}
                onChange={e => updateNested('model', 'top_p', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="1.0"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Frequency Penalty</span>
              <input
                type="number"
                step="0.1"
                min="-2"
                max="2"
                value={config.model?.frequency_penalty ?? ''}
                onChange={e => updateNested('model', 'frequency_penalty', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="0.0"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Presence Penalty</span>
              <input
                type="number"
                step="0.1"
                min="-2"
                max="2"
                value={config.model?.presence_penalty ?? ''}
                onChange={e => updateNested('model', 'presence_penalty', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="0.0"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>
        </div>

        <div className={`${modern ? 'page-modern-panel' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-5 space-y-4`}>
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <Settings2 size={18} className="text-blue-500" />
            {locale === 'zh-CN' ? '常用运行设置' : 'Common Runtime Settings'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={Boolean(config.session?.group_sessions_per_user)} onChange={e => updateToggle('session', 'group_sessions_per_user', e.target.checked)} />
              {locale === 'zh-CN' ? '群会话按用户拆分' : 'Group Sessions Per User'}
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={Boolean(config.memory?.enabled)} onChange={e => updateToggle('memory', 'enabled', e.target.checked)} />
              {locale === 'zh-CN' ? '启用记忆' : 'Enable Memory'}
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={Boolean(config.tools?.enabled)} onChange={e => updateToggle('tools', 'enabled', e.target.checked)} />
              {locale === 'zh-CN' ? '启用工具' : 'Enable Tools'}
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{locale === 'zh-CN' ? '默认人格' : 'Default Personality'}</span>
              <input
                value={String(config.personality?.profile || '')}
                onChange={e => updateNested('personality', 'profile', e.target.value)}
                placeholder="helpful / concise / analyst"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{locale === 'zh-CN' ? '会话历史上限' : 'Session History Limit'}</span>
              <input
                type="number"
                value={config.session?.session_history_limit ?? ''}
                onChange={e => updateNested('session', 'session_history_limit', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="200"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{locale === 'zh-CN' ? 'Home Target' : 'Home Target'}</span>
              <input
                value={String((config.gateway as any)?.homeTarget || '')}
                onChange={e => updateNested('gateway', 'homeTarget', e.target.value)}
                placeholder="telegram-home / ops-room"
                className="w-full rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={`${modern ? 'page-modern-panel' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-5 space-y-4`}>
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <FileCog size={18} className="text-blue-500" />
            {locale === 'zh-CN' ? '配置路径' : 'Config Paths'}
          </div>
          {[
            { label: 'Home', value: status?.homeDir || '-' },
            { label: 'config.yaml', value: status?.configPath || '-' },
            { label: '.env', value: status?.envPath || '-' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">{item.label}</div>
              <div className="mt-1 font-mono break-all text-sm text-gray-800 dark:text-gray-100">{item.value}</div>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => status?.docsUrl && window.open(status.docsUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700/50 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <ExternalLink size={14} />
              {locale === 'zh-CN' ? '文档' : 'Docs'}
            </button>
            <button onClick={() => status?.repoUrl && window.open(status.repoUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-700/50 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-900/40">
              <ExternalLink size={14} />
              GitHub
            </button>
          </div>
        </div>

        <div className="xl:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {blocks.map(block => (
            <div key={block.key} className={`${modern ? 'page-modern-panel' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50'} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
                <SlidersHorizontal size={18} className="text-blue-500" />
                {block.label}
              </div>
              <textarea
                value={JSON.stringify(config[block.key] || {}, null, 2)}
                onChange={e => updateBlock(block.key, e.target.value)}
                className="w-full min-h-[240px] rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-900/40 p-4 text-sm font-mono text-gray-800 dark:text-gray-100 outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
