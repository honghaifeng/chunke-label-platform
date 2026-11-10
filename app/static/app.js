/* 春科数据标注平台 - 前端应用 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
const fmtShort = (sec) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  return `${String(m).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
};

const ICONS = {
  dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-5H3v5Zm10 0h8V11h-8v10Zm0-18v5h8V3h-8Z"/>',
  tasks: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  annotate: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/>',
  qc: '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  members: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<path d="M8 5v14l11-7-11-7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L5 20"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 19h11Z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/>',
  upload: '<path d="M12 21V9m0 0 4 4m-4-4-4 4M4 3h16"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/>',
};

const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

const STATUS = {
  pending: ['待标注', 'pending'],
  annotating: ['标注中', 'annotating'],
  submitted: ['待质检', 'submitted'],
  review: ['质检中', 'reviewing'],
  done: ['已完成', 'done'],
  draft: ['草稿', 'plain'],
  approved: ['已通过', 'done'],
  rejected: ['已驳回', 'danger'],
};
const statusChip = (s) => {
  const [label, cls] = STATUS[s] || [s, 'plain'];
  return `<span class="chip ${cls}"><i class="dot"></i>${label}</span>`;
};
const MODALITY_ICON = { audio: 'audio', image: 'image', video: 'video', pointcloud: 'cloud' };
const SPK_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];

const state = {
  user: null,
  settings: {},
  engines: [],
  projects: [],
  members: [],
  current: null,
  wb: null,
};

/* ---------------- API ---------------- */
async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
  if (opts.body instanceof FormData) {
    init.body = opts.body;
  } else if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401) { state.user = null; renderLogin(); }
    throw new Error((data && (data.detail || data.error)) || `请求失败(${res.status})`);
  }
  return data;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; el.style.transition = 'all .25s'; }, 2800);
  setTimeout(() => el.remove(), 3200);
}

function openModal(inner, cls = '') {
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><div class="modal ${cls}">${inner}</div></div>`;
  $('#modal-root').onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); };
  $$('[data-close]', $('#modal-root')).forEach((b) => (b.onclick = closeModal));
}

function closeModal() { $('#modal-root').innerHTML = ''; }

function confirmModal(title, text, okText = '确认', danger = false) {
  return new Promise((resolve) => {
    openModal(
      `<div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-close>×</button></div>
       <div class="modal-body"><p style="margin:0;color:var(--muted);line-height:1.8">${esc(text)}</p></div>
       <div class="modal-foot"><button class="btn ghost" data-close>取消</button>
       <button class="btn ${danger ? 'danger' : 'primary'}" id="m-ok">${esc(okText)}</button></div>`,
      'sm'
    );
    $('#m-ok').onclick = () => { closeModal(); resolve(true); };
    const root = $('#modal-root');
    const orig = root.onclick;
    root.onclick = (e) => {
      if (e.target.classList.contains('modal-backdrop') || e.target.hasAttribute('data-close')) resolve(false);
      if (orig) orig(e);
    };
  });
}

/* ---------------- 登录 ---------------- */
function renderLogin() {
  document.title = '春科数据标注平台 · 登录';
  $('#app').innerHTML = `
  <div class="login-wrap">
    <div class="login-left">
      <div class="login-logo"><div class="logo-mark">CK</div><span>春科数据标注平台</span></div>
      <div class="login-hero">
        <h1>一站式多模态<br/>数据标注与质检平台</h1>
        <p>语音转写 · 说话人分离 · 图像检测 · 智驾点云。自研统一门户 + CVAT / labelU / FunASR 引擎，覆盖项目创建到质检交付的完整链路。</p>
        <div class="hero-points">
          <div><b>4</b>模态统一调度</div>
          <div><b>6</b>级角色权限</div>
          <div><b>本地</b>AI 预识别</div>
        </div>
      </div>
      <div class="hint">春科数据 · 标注中台 v1.0</div>
    </div>
    <div class="login-right">
      <div class="login-card">
        <h2>登录工作台</h2>
        <div class="sub">使用平台账号进入，或联系管理员开通</div>
        <form id="login-form">
          <div class="field"><label>账号</label><input class="input" name="username" id="login-user" autocomplete="username" placeholder="例如 admin" required /></div>
          <div class="field"><label>密码</label><input class="input" type="password" name="password" autocomplete="current-password" placeholder="请输入密码" required /></div>
          <button class="btn primary lg" type="submit" id="login-btn">进入平台</button>
        </form>
        <div class="login-hint">
          体验账号（密码 <code>chunke123</code>）<br/>
          平台管理员 <code>admin</code> · 项目经理 <code>liuxiao</code> · 标注员 <code>wangmin</code> · 质检员 <code>zhoulan</code>
        </div>
      </div>
    </div>
  </div>`;
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    btn.disabled = true; btn.textContent = '正在登录…';
    try {
      const r = await api('/api/login', { method: 'POST', body: { username: $('#login-user').value.trim(), password: e.target.password.value } });
      state.user = r.user;
      location.hash = '#/dashboard';
      await boot();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = '进入平台';
    }
  };
}

/* ---------------- 外壳 ---------------- */
const NAV = [
  ['dashboard', '工作台', 'dashboard'],
  ['tasks', '任务中心', 'tasks'],
  ['qc', '质检中心', 'qc'],
  ['projects', '项目管理', 'projects'],
  ['members', '成员管理', 'members'],
  ['stats', '数据统计', 'stats'],
  ['settings', '系统设置', 'settings'],
];

function shell(active, content, crumb = '') {
  const nav = NAV.map(([key, label, ico]) => {
    const href = key === 'tasks' ? '#/tasks' : `#/${key}`;
    return `<a class="nav-item ${active === key ? 'active' : ''}" href="${href}">${icon(ico)}<span>${label}</span>${key === 'qc' ? '<b class="tag" id="nav-qc-count">0</b>' : ''}</a>`;
  }).join('');
  const role = state.user.role_label || '';
  return `
  <div class="layout">
    <aside class="sidebar">
      <div class="side-brand"><div class="logo-mark">CK</div><div><span>春科标注</span><small>CHUNKE LABEL</small></div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot">
        <b>${esc(state.user.name)}</b> · ${esc(role)}<br/>
        引擎：CVAT · labelU · FunASR
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="crumb">春科数据 / <b>${esc(crumb)}</b></div>
        <div class="top-actions">
          <div class="search">${icon('search')}<input id="top-search" placeholder="搜索任务或项目，回车" /></div>
          <button class="icon-btn" title="通知">${icon('bell')}</button>
          <div class="user-chip" id="user-chip"><div class="avatar">${esc(state.user.name.slice(0, 1))}</div><div><b>${esc(state.user.name)}</b><br/><span>${esc(role)}</span></div></div>
        </div>
      </div>
      <div class="page" id="page">${content}</div>
    </div>
  </div>`;
}

function mount(active, crumb, content) {
  $('#app').innerHTML = shell(active, content, crumb);
  if (state.counts && state.counts.review) {
    const el = $('#nav-qc-count');
    if (el) el.textContent = state.counts.review;
  }
  $('#top-search').onkeydown = (e) => {
    if (e.key === 'Enter') location.hash = `#/tasks?q=${encodeURIComponent(e.target.value.trim())}`;
  };
  $('#user-chip').onclick = () => userMenu();
}

async function userMenu() {
  const r = await api('/api/me');
  openModal(`
    <div class="modal-head"><h3>账号信息</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="kv"><span>姓名</span><b>${esc(r.user.name)}</b></div>
      <div class="kv"><span>账号</span><b class="mono">${esc(r.user.username)}</b></div>
      <div class="kv"><span>平台角色</span><b>${esc(r.role_label)}</b></div>
      <div class="kv"><span>数据权限</span><b>按项目隔离</b></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button><button class="btn danger" id="logout-btn">退出登录</button></div>`, 'sm');
  $('#logout-btn').onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    state.user = null;
    closeModal();
    renderLogin();
  };
}

/* ---------------- 路由 ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { page: parts[0] || 'dashboard', id: parts[1] ? Number(parts[1]) : null, query: new URLSearchParams(query || '') };
}

async function route() {
  if (!state.user) return;
  const { page, id, query } = parseHash();
  try {
    if (page === 'dashboard') await pageDashboard();
    else if (page === 'tasks') await pageTasks(query);
    else if (page === 'qc') await pageQC();
    else if (page === 'projects') await pageProjects();
    else if (page === 'members') await pageMembers();
    else if (page === 'stats') await pageStats();
    else if (page === 'settings') await pageSettings();
    else if (page === 'annotate' && id) await pageAnnotate(id);
    else await pageDashboard();
  } catch (err) {
    if (err.message && err.message !== '请先登录') toast(err.message, 'err');
  }
}

window.addEventListener('hashchange', route);

/* ---------------- 工作台 ---------------- */
async function pageDashboard() {
  const [stats, b] = await Promise.all([api('/api/stats'), api('/api/bootstrap')]);
  state.projects = b.projects; state.engines = b.engines; state.counts = b.counts;
  const s = stats.summary || {};
  const recent = b.tasks.slice(0, 7);
  const maxTrend = Math.max(1, ...stats.trend.map((d) => Math.max(d.created, d.done)));
  const trendSvg = stats.trend.map((d, i) => {
    const x = 18 + i * 52;
    const h1 = Math.round((d.created / maxTrend) * 76);
    const h2 = Math.round((d.done / maxTrend) * 76);
    return `<g><rect x="${x}" y="${100 - h1}" width="11" height="${h1}" rx="2" fill="#3B82F6" opacity=".85"/>
      <rect x="${x + 14}" y="${100 - h2}" width="11" height="${h2}" rx="2" fill="#10B981" opacity=".85"/>
      <text x="${x + 12}" y="116" text-anchor="middle" fill="#64748B" font-size="9">${d.day}</text></g>`;
  }).join('');

  const content = `
    <div class="page-head">
      <div><h1 class="page-title">工作台</h1><p class="page-sub">${esc(state.user.name)}，今天有 ${s.pending || 0} 个待标注任务、${(s.submitted || 0) + (s.reviewing || 0)} 个待质检任务</p></div>
      <div class="page-actions">
        <a class="btn" href="#/tasks">${icon('tasks')} 查看任务</a>
        <a class="btn primary" href="#/annotate/1">${icon('spark')} 进入标注</a>
      </div>
    </div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">任务总量</div><div class="kpi-value">${s.total || 0}</div><div class="kpi-delta">覆盖 ${stats.projects.length} 个项目</div></div>
      <div class="kpi"><div class="kpi-label">待标注</div><div class="kpi-value">${s.pending || 0}</div><div class="kpi-delta warn">建议今日优先处理</div></div>
      <div class="kpi"><div class="kpi-label">质检中</div><div class="kpi-value">${(s.submitted || 0) + (s.reviewing || 0)}</div><div class="kpi-delta">平均返修率 8.4%</div></div>
      <div class="kpi"><div class="kpi-label">质检通过率</div><div class="kpi-value">${s.qc_pass_rate || 0}<small style="font-size:14px">%</small></div><div class="kpi-delta up">累计质检 ${s.qc_total || 0} 次</div></div>
    </div>
    <div class="grid two-col" style="margin-bottom:14px">
      <div class="card">
        <div class="card-head"><h3 class="card-title">近 7 日任务吞吐</h3><span class="card-sub">新建 / 完成</span></div>
        <div class="card-body">
          <svg class="chart" viewBox="0 0 380 124" preserveAspectRatio="none" height="124">${trendSvg || ''}
            <line x1="8" y1="101" x2="372" y2="101" stroke="#1E2A3F"/></svg>
          <div class="legend"><span><i style="background:#3B82F6"></i>新建任务</span><span><i style="background:#10B981"></i>完成质检</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">任务状态分布</h3><span class="card-sub">实时</span></div>
        <div class="card-body">
          ${stats.by_status.map((x) => {
            const pct = s.total ? Math.round((x.value / s.total) * 100) : 0;
            return `<div class="bar-row"><span>${x.name}</span><div class="bar"><i style="width:${pct}%;background:${x.key === 'done' ? '#10B981' : x.key === 'pending' ? '#64748B' : x.key === 'annotating' ? '#3B82F6' : '#F59E0B'}"></i></div><b>${x.value}</b></div>`;
          }).join('')}
          <div class="divider"></div>
          <div class="kv"><span>多模态覆盖</span><b>${stats.by_modality.map((m) => `${m.name} ${m.value}`).join(' · ') || '—'}</b></div>
        </div>
      </div>
    </div>
    <div class="grid two-col">
      <div class="card">
        <div class="card-head"><h3 class="card-title">最近任务</h3><a class="card-sub" href="#/tasks">全部任务 →</a></div>
        <div class="table-wrap">
          <table class="table"><thead><tr><th>任务</th><th>项目</th><th>标注员</th><th>状态</th><th class="right">更新时间</th></tr></thead>
          <tbody>${recent.map((t) => `<tr onclick="location.hash='#/annotate/${t.id}'">
            <td><div class="name">${esc(t.name)}</div><div class="sub">${esc(t.batch || '')}</div></td>
            <td>${esc(t.project_name)}</td><td>${esc(t.assignee_name || '—')}</td>
            <td>${statusChip(t.status)}</td><td class="right mono">${esc((t.updated_at || '').slice(5, 16))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">暂无任务</td></tr>'}</tbody></table>
        </div>
      </div>
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">引擎与预识别</h3><span class="card-sub">本地服务探测</span></div>
          <div>${b.engines.map((e) => `<div class="engine"><i class="dot ${e.online ? 'online' : 'offline'}"></i>
            <div class="engine-info"><b>${esc(e.name)}</b><span>${esc(e.desc)}</span></div>
            <a href="${esc(e.url)}" target="_blank" rel="noreferrer">${e.online ? '打开' : '未启动'}</a></div>`).join('')}</div>
        </div>
        <div class="card"><div class="card-head"><h3 class="card-title">快捷入口</h3></div>
          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <a class="btn" href="#/qc">${icon('qc')} 质检队列</a>
            <a class="btn" href="#/projects">${icon('projects')} 项目管理</a>
            <a class="btn" href="http://127.0.0.1:8080/" target="_blank">${icon('audio')} Label Studio</a>
            <a class="btn" href="http://127.0.0.1:8090/" target="_blank">${icon('cloud')} CVAT</a>
          </div>
        </div>
      </div>
    </div>`;
  mount('dashboard', '工作台', content);
}

/* ---------------- 任务中心 ---------------- */
async function pageTasks(query) {
  const q = query.get('q') || '';
  const pid = query.get('project') || '';
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (pid) params.set('project_id', pid);
  const data = await api('/api/tasks?' + params.toString());
  state.tasks = data.tasks;
  const tasks = data.tasks;
  const projOptions = state.projects.map((p) => `<option value="${p.id}" ${String(p.id) === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const content = `
    <div class="page-head"><div><h1 class="page-title">任务中心</h1><p class="page-sub">按项目、状态筛选任务，点击行进入标注或质检</p></div>
      <div class="page-actions"><button class="btn" id="btn-export">${icon('download')} 导出清单</button><a class="btn primary" href="#/projects">${icon('plus')} 新建项目</a></div></div>
    <div class="filters">
      <div class="seg-tabs" id="task-tabs">
        <button class="active" data-st="">全部</button><button data-st="pending">待标注</button>
        <button data-st="annotating">标注中</button><button data-st="submitted">待质检</button><button data-st="done">已完成</button>
      </div>
      <select class="select" id="filter-project" style="width:190px"><option value="">全部项目</option>${projOptions}</select>
      <span class="spacer"></span>
      <span class="tag">共 ${tasks.length} 条</span>
    </div>
    <div class="card"><div class="table-wrap">
      <table class="table"><thead><tr><th style="width:30px"></th><th>任务名称</th><th>项目</th><th>模态</th><th>批次</th><th>标注员</th><th>质检员</th><th>状态</th><th>优先级</th><th class="right">操作</th></tr></thead>
      <tbody id="task-body">${taskRows(tasks)}</tbody></table>
    </div></div>`;
  mount('tasks', '任务中心', content);

  $$('#task-tabs button').forEach((b) => (b.onclick = () => {
    $$('#task-tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const st = b.dataset.st;
    $$('#task-body tr').forEach((tr) => { tr.style.display = !st || tr.dataset.status === st ? '' : 'none'; });
  }));
  $('#filter-project').onchange = (e) => { location.hash = `#/tasks?project=${e.target.value}`; };
  $('#btn-export').onclick = () => exportTasks(tasks);
}

function taskRows(tasks) {
  return tasks.map((t) => `<tr data-status="${t.status}" onclick="location.hash='#/annotate/${t.id}'">
    <td>${icon(MODALITY_ICON[t.modality] || 'tasks')}</td>
    <td><div class="name">${esc(t.name)}</div><div class="sub">#${t.id} · ${fmtShort(t.duration)}</div></td>
    <td>${esc(t.project_name)}</td><td><span class="tag">${esc(t.modality_label)}</span></td>
    <td class="mono">${esc(t.batch || '—')}</td><td>${esc(t.assignee_name || '未分配')}</td><td>${esc(t.reviewer_name || '—')}</td>
    <td>${statusChip(t.status)}</td>
    <td>${t.priority === 'high' ? '<span class="chip danger">高</span>' : t.priority === 'low' ? '<span class="chip plain">低</span>' : '<span class="chip plain">普通</span>'}</td>
    <td class="right"><a class="btn sm" href="#/annotate/${t.id}" onclick="event.stopPropagation()">${t.status === 'submitted' ? '质检' : '标注'}</a></td></tr>`).join('')
    || '<tr><td colspan="10" class="empty"><b>没有符合条件的任务</b>调整筛选条件或新建任务</td></tr>';
}

function exportTasks(tasks) {
  const head = ['ID', '任务', '项目', '模态', '批次', '标注员', '质检员', '状态', '更新时间'];
  const rows = tasks.map((t) => [t.id, t.name, t.project_name, t.modality_label, t.batch, t.assignee_name || '', t.reviewer_name || '', (STATUS[t.status] || [t.status])[0], t.updated_at]);
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `春科任务清单-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('任务清单已导出', 'ok');
}

/* ---------------- 标注工作台 ---------------- */
async function pageAnnotate(id) {
  const data = await api(`/api/tasks/${id}`);
  state.current = data;
  const { task, project, annotation, qc, can_edit } = data;
  const mediaName = task.media_path ? task.media_path.split('/').pop() : '';
  const mediaType = task.media_type || (task.modality === 'image' ? 'image' : 'audio');
  const labels = (project && project.labels) || {};
  const payload = (annotation && annotation.payload) || {};
  const pre = (annotation && annotation.prelabel) || {};

  // 统一 wb 结构：audio 和 image 共用头部/侧栏框架
  const classes = labels['目标类别'] || ['商品主体', '价签', '货架', '遮挡'];
  const wb = {
    task, project, labels, canEdit: can_edit,
    mediaType, mediaName,
    // 音频
    segments: (payload.segments && payload.segments.length ? payload.segments : pre.segments || []).map((s) => ({ ...s, events: s.events || [] })),
    // 图片
    boxes: Array.isArray(payload.boxes) ? payload.boxes : [],
    img: null, imgLoaded: false, imgW: 0, imgH: 0,
    // 共用
    summary: payload.summary || '',
    business: payload.business || '',
    quality: payload.quality_score || 0,
    duration: pre.duration || task.duration || 0,
    dirty: false, saving: false,
    // 音频专属
    audio: null, peaks: [], playing: false, currentTime: 0,
    // 图片专属
    imgDrag: null, scale: 1, showBox: true,
  };
  state.wb = wb;

  if (mediaType === 'image') {
    renderImageWorkbench(wb, classes, qc);
  } else {
    renderAudioWorkbench(wb, labels, qc, mediaName);
  }
}

function renderAudioWorkbench(wb, labels, qc, mediaName) {
  const { task, project, canEdit, pre } = wb;
  const content = `
  <div class="wb" id="wb">
    <div class="wb-head">
      <a class="btn ghost sm" href="#/tasks">← 返回</a>
      <div><h1>${esc(task.name)}</h1>
        <div class="wb-meta">${esc(project.name)} · <span class="tag">音频</span> ${statusChip(task.status)}
        ${task.priority === 'high' ? '<span class="chip danger">高优</span>' : ''}</div></div>
      <div class="wb-actions">
        <span class="hint" id="save-ind">未保存</span>
        <button class="btn" id="btn-save" ${canEdit ? '' : 'disabled'}>保存草稿</button>
        <button class="btn primary" id="btn-submit" ${canEdit ? '' : 'disabled'}>提交质检</button>
      </div>
    </div>
    <div class="wb-grid">
      <div class="col">
        <div class="wave-panel">
          <div class="wave-toolbar">
            <button class="play-btn" id="btn-play">${icon('play')}</button>
            <span class="time" id="time-label">00:00.00 / ${fmt(wb.duration)}</span>
            <span class="spacer"></span>
            <button class="btn sm ghost" id="btn-back10">-10s</button>
            <button class="btn sm ghost" id="btn-fwd10">+10s</button>
            <select class="select" id="rate" style="width:82px;height:28px;padding:2px 6px"><option value="0.5">0.5x</option><option value="1" selected>1.0x</option><option value="1.5">1.5x</option><option value="2">2.0x</option></select>
          </div>
          <canvas class="wave-canvas" id="wave"></canvas>
          <div class="transport">
            <span class="mono" id="cur-t">00:00.00</span>
            <div class="seek" id="seek"><i id="seek-bar"></i></div>
            <span class="mono" id="total-t">${fmt(wb.duration)}</span>
          </div>
        </div>
        <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column">
          <div class="card-head"><h3 class="card-title">转写与标注结果</h3>
            <span class="card-sub">${wb.segments.length} 段 · 空格播放/暂停</span>
            <button class="btn sm" id="btn-add-seg" ${canEdit ? '' : 'disabled'}>${icon('plus')} 新增段</button>
          </div>
          <div class="seg-list" id="seg-list">${segRows(wb)}</div>
        </div>
      </div>
      <div class="col" style="min-height:0">
        <div class="side-panel" style="flex:1">
          <div class="panel-head">${icon('spark')} AI 预识别</div>
          <div class="panel-body">
            <div class="ai-card">
              <b>${icon('audio')} FunASR 本地引擎</b>
              <p>Paraformer 转写 + FSMN-VAD 切分 + CAM++ 说话人聚类${pre.elapsed_ms ? ` · 上次 ${(pre.elapsed_ms / 1000).toFixed(1)}s` : ''}</p>
              <div class="ai-actions">
                <button class="btn sm primary" id="btn-prelabel" ${canEdit ? '' : 'disabled'}>开始预识别</button>
                <button class="btn sm" id="btn-prelabel-emo" ${canEdit ? '' : 'disabled'}>含情绪</button>
              </div>
            </div>
            ${mediaName ? '' : `<div class="hint" style="margin-top:10px">该任务暂无音频，请先上传。</div><button class="btn sm" id="btn-upload" style="margin-top:8px">${icon('upload')} 上传音频</button><input type="file" id="file-input" accept="audio/*" hidden />`}
            <div class="panel-section" style="margin-top:16px">
              <div class="panel-label">说话人管理</div>
              <div class="spk-editor" id="spk-editor">${spkEditor(wb)}</div>
            </div>
            <div class="panel-section">
              <div class="panel-label">业务分类</div>
              <select class="select" id="business">${(labels['业务分类'] || []).map((x) => `<option ${x === wb.business ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="">未分类</option></select>
            </div>
            <div class="panel-section">
              <div class="panel-label">质检结论</div>
              ${qc ? `<div class="chip ${qc.result === 'approved' ? 'done' : 'danger'}">${qc.result === 'approved' ? '已通过' : '已驳回'} · ${qc.score} 分</div>
                <div class="hint" style="margin-top:6px">${esc(qc.comment || '无备注')}</div>` : '<div class="hint">尚未质检</div>'}
            </div>
            <div class="panel-section">
              <div class="panel-label">任务信息</div>
              <div class="kv"><span>项目</span><b>${esc(project.name)}</b></div>
              <div class="kv"><span>批次</span><b>${esc(task.batch || '—')}</b></div>
              <div class="kv"><span>标注员</span><b>${esc(task.assignee_name || '未分配')}</b></div>
              <div class="kv"><span>质检员</span><b>${esc(task.reviewer_name || '—')}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  mount('tasks', '标注工作台', content);
  if (mediaName) loadAudio(`/media/${encodeURIComponent(mediaName)}`, wb);
  bindWorkbench(wb, mediaName);
}

function renderImageWorkbench(wb, classes, qc) {
  const { task, project, canEdit, mediaName, boxes, pre } = wb;
  const lastPrelabel = pre && pre.engine ? `${pre.engine} · ${pre.boxes?.length || 0} 框 · ${(pre.elapsed_ms / 1000).toFixed(1)}s` : '—';
  const content = `
  <div class="wb" id="wb">
    <div class="wb-head">
      <a class="btn ghost sm" href="#/tasks">← 返回</a>
      <div><h1>${esc(task.name)}</h1>
        <div class="wb-meta">${esc(project.name)} · <span class="tag">图片</span> ${statusChip(task.status)}
        ${task.priority === 'high' ? '<span class="chip danger">高优</span>' : ''}</div></div>
      <div class="wb-actions">
        <span class="hint" id="save-ind">未保存</span>
        <button class="btn" id="btn-save" ${canEdit ? '' : 'disabled'}>保存草稿</button>
        <button class="btn primary" id="btn-submit" ${canEdit ? '' : 'disabled'}>提交质检</button>
      </div>
    </div>
    <div class="wb-grid">
      <div class="col">
        <div class="image-panel">
          <div class="image-toolbar">
            <span class="hint">${boxes.length} 个框</span>
            <span class="spacer"></span>
            <label class="toggle-wrap"><input type="checkbox" id="toggle-box" checked /><span>显示框</span></label>
            <button class="btn sm ghost" id="btn-reset">重置视图</button>
          </div>
          <div class="image-stage" id="img-stage">
            ${mediaName
              ? `<img id="work-img" src="/media/${encodeURIComponent(mediaName)}" crossorigin="anonymous" />`
              : `<div class="empty"><b>暂无图片</b>请先上传</div>`}
            <canvas id="box-canvas"></canvas>
          </div>
          <div class="image-status" id="img-status">加载中…</div>
        </div>
        <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column">
          <div class="card-head"><h3 class="card-title">标注框列表</h3>
            <span class="card-sub">${boxes.length} 个目标 · 拖拽图片画矩形框，或按侧栏 AI 自动生成</span>
          </div>
          <div class="box-list" id="box-list">${boxRows(wb)}</div>
        </div>
      </div>
      <div class="col" style="min-height:0">
        <div class="side-panel" style="flex:1">
          <div class="panel-head">${icon('spark')} AI 预识别</div>
          <div class="panel-body">
            <div class="ai-card">
              <b>${icon('box')} YOLOv8n 本地检测</b>
              <p>COCO 80 类预训练 · 纯 CPU · 二次推理 ~1s<br/>检出后按类别手工调整到业务类</p>
              <div class="ai-actions">
                <button class="btn sm primary" id="btn-img-prelabel" ${canEdit && mediaName ? '' : 'disabled'}>开始预识别</button>
              </div>
              <div class="hint" style="margin-top:8px">上次：${lastPrelabel}</div>
            </div>
            <div class="panel-section">
              <div class="panel-label">目标类别（检测后按这里分类）</div>
              <div class="cls-picker" id="cls-picker">
                ${classes.map((c, i) => `<button class="cls-btn ${i === 0 ? 'on' : ''}" data-cls="${esc(c)}">${esc(c)}</button>`).join('')}
              </div>
            </div>
            <div class="panel-section">
              <div class="panel-label">操作提示</div>
              <div class="hint" style="line-height:1.8">
                • 先点「开始预识别」AI 自动检出<br/>
                • 结果合并到框列表，改类别即可<br/>
                • 多余的框直接删，遗漏的手动画<br/>
                • 所有调整在框列表里即时同步
              </div>
            </div>
            ${qc ? `<div class="panel-section">
              <div class="panel-label">质检结论</div>
              <div class="chip ${qc.result === 'approved' ? 'done' : 'danger'}">${qc.result === 'approved' ? '已通过' : '已驳回'} · ${qc.score} 分</div>
              <div class="hint" style="margin-top:6px">${esc(qc.comment || '无备注')}</div>
            </div>` : ''}
            <div class="panel-section">
              <div class="panel-label">任务信息</div>
              <div class="kv"><span>项目</span><b>${esc(project.name)}</b></div>
              <div class="kv"><span>图片</span><b>${esc(mediaName || '—')}</b></div>
              <div class="kv"><span>批次</span><b>${esc(task.batch || '—')}</b></div>
              <div class="kv"><span>标注员</span><b>${esc(task.assignee_name || '未分配')}</b></div>
              <div class="kv"><span>质检员</span><b>${esc(task.reviewer_name || '—')}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  mount('tasks', '标注工作台', content);
  bindImageWorkbench(wb, classes);
}

function boxRows(wb) {
  if (!wb.boxes.length) return '<div class="empty"><b>还没有标注框</b>在图片上拖拽画第一个矩形，或先让 AI 预识别</div>';
  return wb.boxes.map((b, i) => `
    <div class="box-row ${b.auto_cls ? 'auto' : ''}" data-i="${i}">
      <span class="box-idx">#${String(i + 1).padStart(2, '0')}${b.auto_cls ? `·${Math.round((b.conf || 0) * 100)}%` : ''}</span>
      <select class="box-cls" data-f="cls">${(wb.labels['目标类别'] || ['商品主体']).map((x) => `<option ${x === b.cls ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      ${b.auto_cls ? `<span class="box-auto">${esc(b.auto_cls)}</span>` : ''}
      <span class="box-pos">${Math.round(b.x * 1000) / 10}%, ${Math.round(b.y * 1000) / 10}%</span>
      <button class="box-del" data-del="${i}" title="删除">${icon('x')}</button>
    </div>`).join('');
}

function segRows(wb) {
  if (!wb.segments.length) return '<div class="empty"><b>还没有标注内容</b>点击「开始预识别」自动生成，或手动新增段</div>';
  const speakers = speakerList(wb);
  const emotions = wb.labels['情绪'] || ['中性', '满意', '不满', '愤怒'];
  const events = wb.labels['事件'] || [];
  return wb.segments.map((s, i) => {
    const color = SPK_COLORS[Math.max(0, speakers.indexOf(s.spk)) % SPK_COLORS.length];
    const dur = Math.max(0, Number(s.end) - Number(s.start));
    const evs = s.events || [];
    return `<div class="seg-row" data-i="${i}" style="border-left-color:${color}">
      <div class="seg-head">
        <span class="seg-no">${String(i + 1).padStart(2, '0')}</span>
        <span class="seg-spk"><span class="spk-dot" style="background:${color}"></span>
          <select data-f="spk" title="说话人">${speakers.map((x) => `<option ${x === s.spk ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        </span>
        <span class="seg-time">
          <input value="${Number(s.start).toFixed(2)}" data-f="start" title="开始（秒）" />
          <em>→</em>
          <input value="${Number(s.end).toFixed(2)}" data-f="end" title="结束（秒）" />
        </span>
        <span class="seg-dur">${dur.toFixed(2)}s</span>
        <span class="spacer"></span>
        <select class="seg-emo" data-f="emotion" title="情绪">${emotions.map((x) => `<option ${x === s.emotion ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        ${events.length ? `<select class="seg-evt" data-f="event" title="添加事件"><option value="">+ 事件</option>${events.filter((x) => !evs.includes(x)).map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : ''}
        <button class="seg-del" data-del="${i}" title="删除该段">${icon('x')}</button>
      </div>
      <textarea class="seg-text" data-f="text" rows="2" placeholder="转写文本…">${esc(s.text)}</textarea>
      ${evs.length ? `<div class="seg-tags">${evs.map((x) => `<span class="seg-tag">${esc(x)}<button type="button" data-del-event="${esc(x)}" data-seg="${i}" title="移除">${icon('x')}</button></span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

function renderSegs(wb) {
  const list = $('#seg-list');
  if (!list) return;
  list.innerHTML = segRows(wb);
  wb._activeIdx = -2;
  markActiveSegment(wb);
}

function markActiveSegment(wb) {
  const list = $('#seg-list');
  if (!list || !list.querySelector('.seg-row')) return;
  const t = wb.currentTime || 0;
  const idx = wb.segments.findIndex((s) => t >= Number(s.start) && t < Number(s.end));
  if (idx === wb._activeIdx) return;
  wb._activeIdx = idx;
  list.querySelectorAll('.seg-row').forEach((el) => el.classList.toggle('playing', Number(el.dataset.i) === idx));
}

function speakerList(wb) {
  const set = new Set(wb.segments.map((s) => s.spk).filter(Boolean));
  (wb.labels['说话人'] || []).forEach((x) => set.add(x));
  ['说话人1', '说话人2'].forEach((x) => set.add(x));
  return Array.from(set);
}

function spkEditor(wb) {
  const speakers = speakerList(wb);
  return speakers.map((sp, i) => `<div class="row"><span class="spk-dot" style="background:${SPK_COLORS[i % SPK_COLORS.length]}"></span>
    <input value="${esc(sp)}" data-spk="${i}" /><span class="hint">${wb.segments.filter((s) => s.spk === sp).length} 段</span></div>`).join('');
}

function loadAudio(url, wb) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  wb.audio = audio;
  audio.addEventListener('loadedmetadata', () => {
    wb.duration = audio.duration || wb.duration;
    $('#total-t').textContent = fmt(wb.duration);
    updateTimeLabel(wb);
    drawWave(wb);
  });
  audio.addEventListener('timeupdate', () => {
    wb.currentTime = audio.currentTime;
    updateTimeLabel(wb);
    const pct = wb.duration ? (audio.currentTime / wb.duration) * 100 : 0;
    const bar = $('#seek-bar');
    if (bar) bar.style.width = pct + '%';
    drawWave(wb, true);
  });
  audio.addEventListener('ended', () => {
    wb.playing = false;
    const b = $('#btn-play');
    if (b) b.innerHTML = icon('play');
  });
  audio.load();
  fetch(url, { credentials: 'same-origin' })
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx.decodeAudioData(buf).then((ab) => {
        wb.buffer = ab;
        wb.duration = wb.duration || ab.duration;
        wb.peaks = calcPeaks(ab, 1400);
        drawWave(wb);
      });
    })
    .catch(() => drawWave(wb));
}

function calcPeaks(buffer, n) {
  const ch = buffer.getChannelData(0);
  const block = Math.floor(ch.length / n) || 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j += 4) max = Math.max(max, Math.abs(ch[start + j] || 0));
    out[i] = max;
  }
  return out;
}

function drawWave(wb, playheadOnly = false) {
  const cvs = $('#wave');
  if (!cvs) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cvs.clientWidth || 800;
  const h = 188;
  if (cvs.width !== Math.round(w * dpr)) { cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr); }
  const ctx = cvs.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0B1424';
  ctx.fillRect(0, 0, w, h);

  const dur = wb.duration || 1;
  const padL = 10, padR = 10;
  const plotW = w - padL - padR;
  const rulerY = 18;
  ctx.strokeStyle = '#1C2B44';
  ctx.fillStyle = '#5B6B85';
  ctx.font = '9px ui-monospace, monospace';
  const step = dur > 60 ? 10 : dur > 20 ? 5 : 2;
  for (let t = 0; t <= dur; t += step) {
    const x = padL + (t / dur) * plotW;
    ctx.beginPath(); ctx.moveTo(x, rulerY); ctx.lineTo(x, h); ctx.stroke();
    ctx.fillText(fmtShort(t), x + 3, 12);
  }

  // 波形
  const midY = 74;
  const amp = 40;
  if (wb.peaks && wb.peaks.length) {
    ctx.fillStyle = 'rgba(59,130,246,.55)';
    const bars = Math.min(plotW, wb.peaks.length);
    for (let i = 0; i < bars; i++) {
      const v = wb.peaks[Math.floor((i / bars) * wb.peaks.length)];
      const bh = Math.max(1, v * amp * 2);
      ctx.fillRect(padL + i, midY - bh / 2, 1.2, bh);
    }
  } else {
    ctx.strokeStyle = '#334155';
    ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(w - padR, midY); ctx.stroke();
  }

  // 分段轨道
  const laneY = 132, laneH = 30;
  wb.segments.forEach((s, i) => {
    const speakers = speakerList(wb);
    const color = SPK_COLORS[Math.max(0, speakers.indexOf(s.spk)) % SPK_COLORS.length];
    const x1 = padL + (Math.max(0, s.start) / dur) * plotW;
    const x2 = padL + (Math.min(dur, Math.max(s.end, s.start + 0.05)) / dur) * plotW;
    ctx.fillStyle = color + '33';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x1, laneY + (i % 2) * 15, Math.max(3, x2 - x1), 12, 3);
    ctx.fill(); ctx.stroke();
  });

  ctx.fillStyle = '#334155';
  ctx.fillRect(padL, laneY + 34, plotW, 1);

  // 播放指针
  const ph = padL + (Math.min(dur, wb.currentTime || 0) / dur) * plotW;
  ctx.strokeStyle = playheadOnly ? '#F87171' : '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ph, 20); ctx.lineTo(ph, h - 4); ctx.stroke();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath(); ctx.moveTo(ph - 4, 20); ctx.lineTo(ph + 4, 20); ctx.lineTo(ph, 26); ctx.closePath(); ctx.fill();
}

function updateTimeLabel(wb) {
  const t = wb.currentTime || 0;
  const a = $('#time-label'); if (a) a.textContent = `${fmt(t)} / ${fmt(wb.duration)}`;
  const b = $('#cur-t'); if (b) b.textContent = fmt(t);
  markActiveSegment(wb);
}

/* ------------ 图片标注 ------------ */
function bindImageWorkbench(wb, classes) {
  const imgEl = $('#work-img');
  const cvs = $('#box-canvas');
  const stage = $('#img-stage');
  const status = $('#img-status');
  if (!imgEl || !cvs) return;

  // 图片加载后设置 canvas 尺寸
  imgEl.addEventListener('load', () => {
    wb.imgLoaded = true;
    wb.imgW = imgEl.naturalWidth;
    wb.imgH = imgEl.naturalHeight;
    fitStage(wb);
    status.textContent = `${wb.imgW}×${wb.imgH} · ${wb.boxes.length} 个框`;
    drawImageBoxes(wb);
  });
  if (imgEl.complete && imgEl.naturalWidth) imgEl.dispatchEvent(new Event('load'));
  else imgEl.onerror = () => { status.textContent = '图片加载失败'; };

  // 显示/隐藏框
  $('#toggle-box').onchange = (e) => { wb.showBox = e.target.checked; drawImageBoxes(wb); };
  $('#btn-reset').onclick = () => { wb.scale = 1; imgEl.style.transform = 'scale(1)'; drawImageBoxes(wb); };

  // 类别按钮
  const clsPicker = $('#cls-picker');
  let activeCls = (wb.labels['目标类别'] || classes)[0];
  clsPicker.onclick = (e) => {
    const b = e.target.closest('.cls-btn');
    if (!b) return;
    clsPicker.querySelectorAll('.cls-btn').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    activeCls = b.dataset.cls;
  };

  // 拖拽画框
  const getPos = (e) => {
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  let dragStart = null;
  cvs.addEventListener('mousedown', (e) => {
    if (!wb.canEdit) return;
    if (e.button !== 0) return;
    // 先检查是否点中已有框 → 选中/删除
    const p = getPos(e);
    const hit = wb.boxes.findIndex((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (hit >= 0 && !e.shiftKey) {
      // 右键或者点 shift 新建
      if (confirm(`删除 #${hit + 1} ${wb.boxes[hit].cls}？`)) {
        wb.boxes.splice(hit, 1);
        refreshBoxUI(wb); drawImageBoxes(wb); markDirty(wb);
      }
      return;
    }
    dragStart = p;
    wb._dragging = true;
  });
  cvs.addEventListener('mousemove', (e) => {
    if (!wb._dragging) return;
    const p = getPos(e);
    wb._dragRect = {
      x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y),
    };
    drawImageBoxes(wb);
  });
  window.addEventListener('mouseup', () => {
    if (!wb._dragging) return;
    wb._dragging = false;
    const r = wb._dragRect;
    wb._dragRect = null;
    drawImageBoxes(wb);
    if (r && r.w > 0.005 && r.h > 0.005) {
      wb.boxes.push({ cls: activeCls, ...r });
      refreshBoxUI(wb); drawImageBoxes(wb); markDirty(wb);
    }
  });

  // 列表操作
  const list = $('#box-list');
  list.onclick = (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      wb.boxes.splice(Number(del.dataset.del), 1);
      refreshBoxUI(wb); drawImageBoxes(wb); markDirty(wb);
    }
    const row = e.target.closest('.box-row');
    if (row && !e.target.closest('select')) {
      const i = Number(row.dataset.i);
      flashBox(wb, i);
    }
  };
  list.onchange = (e) => {
    const row = e.target.closest('.box-row'); if (!row) return;
    const i = Number(row.dataset.i); const f = e.target.dataset.f;
    if (f === 'cls') { wb.boxes[i].cls = e.target.value; markDirty(wb); }
  };

  // 顶部按钮
  $('#btn-save').onclick = () => save(wb);
  $('#btn-submit').onclick = async () => {
    try {
      await api(`/api/tasks/${wb.task.id}/submit`, { method: 'POST', body: { payload: payloadOf(wb) } });
      toast('已提交质检', 'ok');
      setTimeout(() => (location.hash = '#/tasks'), 500);
    } catch (err) { toast(err.message, 'err'); }
  };

  // AI 预识别
  $('#btn-img-prelabel').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = '检测中…';
    try {
      const resp = await api(`/api/tasks/${wb.task.id}/prelabel`, { method: 'POST', body: {} });
      const pre = resp.prelabel || {};
      const detected = pre.boxes || [];
      wb.prelabel = pre;
      wb.imgLoaded = true; wb.imgW = pre.img_size?.w || wb.imgW; wb.imgH = pre.img_size?.h || wb.imgH;
      // 追加到现有 boxes，不覆盖人工已画的
      const bizCls = (wb.labels['目标类别'] || classes)[0];
      let added = 0, skipped = 0;
      for (const b of detected) {
        // 跳过极低置信度的 person / backpack 等与货架无关的
        if (b.conf < 0.10) { skipped++; continue; }
        // 把 YOLO 原始类存在 auto_cls 里，默认映射到第一个业务类（人工在列表里改）
        wb.boxes.push({
          cls: bizCls,      // 默认业务类，人工后改
          auto_cls: b.cls,  // YOLO 原始类（apple, banana, person...）
          conf: b.conf,
          x: b.x, y: b.y, w: b.w, h: b.h,
        });
        added++;
      }
      markDirty(wb);
      refreshBoxUI(wb);
      drawImageBoxes(wb);
      toast(`AI 检出 ${detected.length} 个，新增 ${added} 个（跳过 ${skipped} 个）· ${(pre.elapsed_ms / 1000).toFixed(1)}s`, 'ok');
      btn.textContent = '重新预识别';
      if (status) status.textContent = `AI 检出 ${detected.length} / 已入库 ${added}`;
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = !wb.canEdit;
    }
  };

  window.addEventListener('resize', () => { fitStage(wb); drawImageBoxes(wb); });
}

function fitStage(wb) {
  const imgEl = $('#work-img'); if (!imgEl) return;
  const stage = $('#img-stage');
  const cvs = $('#box-canvas');
  // 让图片最大宽度 = stage 宽度，按比例缩放
  const sw = stage.clientWidth;
  const sh = stage.clientHeight || 500;
  const ratio = wb.imgW && wb.imgH ? wb.imgW / wb.imgH : 1.49;
  let w = sw, h = w / ratio;
  if (h > sh) { h = sh; w = h * ratio; }
  imgEl.style.width = Math.round(w) + 'px';
  imgEl.style.height = Math.round(h) + 'px';
  imgEl.style.left = Math.round((sw - w) / 2) + 'px';
  imgEl.style.top = Math.round((sh - h) / 2) + 'px';
  cvs.style.width = Math.round(w) + 'px';
  cvs.style.height = Math.round(h) + 'px';
  cvs.style.left = imgEl.style.left;
  cvs.style.top = imgEl.style.top;
  cvs.width = Math.round(w); cvs.height = Math.round(h);
}

function drawImageBoxes(wb) {
  const cvs = $('#box-canvas'); if (!cvs) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  const sw = cvs.width, sh = cvs.height;
  const COLORS = { '商品主体': '#3B82F6', '价签': '#10B981', '货架': '#F59E0B', '遮挡': '#EF4444', '行人': '#A855F7', '轿车': '#06B6D4', '卡车': '#EC4899' };
  const col = (c) => COLORS[c] || '#64748B';

  if (wb.showBox) {
    wb.boxes.forEach((b, i) => {
      const x = b.x * sw, y = b.y * sh, w = b.w * sw, h = b.h * sh;
      ctx.strokeStyle = col(b.cls); ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = col(b.cls) + '33';
      ctx.fillRect(x, y, w, h);
      // 标签
      ctx.font = '11px ui-sans-serif, system-ui';
      const label = `#${i + 1} ${b.cls}`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = col(b.cls);
      ctx.fillRect(x, Math.max(0, y - 16), tw, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 4, Math.max(12, y - 4));
    });
  }
  // 正在拖的预览框
  if (wb._dragRect) {
    const r = wb._dragRect;
    ctx.strokeStyle = '#FCD34D'; ctx.setLineDash([5, 3]); ctx.lineWidth = 2;
    ctx.strokeRect(r.x * sw, r.y * sh, r.w * sw, r.h * sh);
    ctx.setLineDash([]);
  }
}

function refreshBoxUI(wb) {
  const list = $('#box-list'); if (!list) return;
  list.innerHTML = boxRows(wb);
  const sub = list.parentElement.querySelector('.card-sub');
  if (sub) sub.textContent = `${wb.boxes.length} 个目标 · 拖拽图片画矩形框`;
  const toolbarHint = $('#wb .image-toolbar .hint');
  if (toolbarHint) toolbarHint.textContent = `${wb.boxes.length} 个框`;
}

function flashBox(wb, i) {
  // 简单实现：红框闪烁一下
  const cvs = $('#box-canvas'); if (!cvs) return;
  const sw = cvs.width, sh = cvs.height;
  const b = wb.boxes[i]; if (!b) return;
  const ctx = cvs.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 3;
  ctx.strokeRect(b.x * sw - 2, b.y * sh - 2, b.w * sw + 4, b.h * sh + 4);
  ctx.restore();
  setTimeout(() => drawImageBoxes(wb), 400);
}

function bindWorkbench(wb, mediaName) {
  const audio = wb.audio;
  const playBtn = $('#btn-play');
  const toggle = () => {
    if (!audio) return toast('该任务还没有音频文件', 'warn');
    if (audio.paused) { audio.play(); wb.playing = true; playBtn.innerHTML = icon('pause'); }
    else { audio.pause(); wb.playing = false; playBtn.innerHTML = icon('play'); }
  };
  playBtn.onclick = toggle;
  $('#btn-back10').onclick = () => { if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10); };
  $('#btn-fwd10').onclick = () => { if (audio) audio.currentTime = Math.min(wb.duration, audio.currentTime + 10); };
  $('#rate').onchange = (e) => { if (audio) audio.playbackRate = Number(e.target.value); };

  $('#wave').onclick = (e) => {
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - 10) / (rect.width - 20);
    audio.currentTime = Math.max(0, Math.min(wb.duration, ratio * wb.duration));
    wb.currentTime = audio.currentTime;
    updateTimeLabel(wb); drawWave(wb, true);
  };
  $('#seek').onclick = (e) => {
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * wb.duration;
  };

  document.onkeydown = (e) => {
    if (!document.body.contains($('#wb'))) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowLeft' && audio) audio.currentTime = Math.max(0, audio.currentTime - 1);
    if (e.key === 'ArrowRight' && audio) audio.currentTime = Math.min(wb.duration, audio.currentTime + 1);
  };

  const list = $('#seg-list');
  list.onclick = (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = Number(del.dataset.del);
      wb.segments.splice(i, 1);
      markDirty(wb);
      renderSegs(wb);
      drawWave(wb); return;
    }
    const tag = e.target.closest('[data-del-event]');
    if (tag) {
      const i = Number(tag.dataset.seg);
      wb.segments[i].events = (wb.segments[i].events || []).filter((x) => x !== tag.dataset.delEvent);
      markDirty(wb);
      renderSegs(wb); return;
    }
    const row = e.target.closest('.seg-row');
    if (row && !e.target.closest('input,textarea,select') && audio) {
      const i = Number(row.dataset.i);
      audio.currentTime = wb.segments[i].start;
      wb.currentTime = audio.currentTime;
      updateTimeLabel(wb); drawWave(wb, true);
    }
  };
  list.oninput = (e) => {
    const row = e.target.closest('.seg-row'); if (!row) return;
    const i = Number(row.dataset.i); const f = e.target.dataset.f; if (!f) return;
    if (f === 'start' || f === 'end') {
      wb.segments[i][f] = Number(e.target.value) || 0;
      const durEl = row.querySelector('.seg-dur');
      if (durEl) durEl.textContent = Math.max(0, Number(wb.segments[i].end) - Number(wb.segments[i].start)).toFixed(2) + 's';
    } else wb.segments[i][f] = e.target.value;
    markDirty(wb); drawWave(wb);
  };
  list.onchange = (e) => {
    const row = e.target.closest('.seg-row'); if (!row) return;
    const i = Number(row.dataset.i); const f = e.target.dataset.f;
    if (f === 'event' && e.target.value) {
      wb.segments[i].events = Array.from(new Set([...(wb.segments[i].events || []), e.target.value]));
      markDirty(wb);
      renderSegs(wb);
      $('#spk-editor').innerHTML = spkEditor(wb);
    }
  };

  $('#btn-add-seg').onclick = () => {
    const start = Math.round((audio ? audio.currentTime : 0) * 100) / 100;
    wb.segments.push({ start, end: Math.min(wb.duration || start + 3, start + 3), text: '', spk: speakerList(wb)[0] || '说话人1', emotion: (wb.labels['情绪'] || ['中性'])[0], events: [] });
    markDirty(wb);
    renderSegs(wb); drawWave(wb);
  };

  const spkEl = $('#spk-editor');
  spkEl.onchange = (e) => {
    const i = Number(e.target.dataset.spk);
    const oldName = speakerList(wb)[i];
    const newName = e.target.value.trim();
    if (!oldName || !newName || oldName === newName) return;
    wb.segments.forEach((s) => { if (s.spk === oldName) s.spk = newName; });
    markDirty(wb);
    spkEl.innerHTML = spkEditor(wb); renderSegs(wb); drawWave(wb);
  };

  $('#business').onchange = (e) => { wb.business = e.target.value; markDirty(wb); };

  const doPrelabel = async (withEmotion) => {
    if (!mediaName) return toast('请先上传音频', 'warn');
    if (wb.segments.length) {
      const ok = await confirmModal('覆盖现有标注？', '预识别结果将替换当前 ' + wb.segments.length + ' 个分段，未保存的修改会丢失。', '开始预识别');
      if (!ok) return;
    }
    const page = $('#wb');
    page.style.position = 'relative';
    const ov = document.createElement('div');
    ov.className = 'loading-overlay';
    ov.innerHTML = `<div style="text-align:center"><div class="spinner" style="margin:0 auto 10px"></div><div class="hint">本地 FunASR 正在转写与说话人聚类…<br/>首次加载模型约需 10-20 秒</div></div>`;
    page.appendChild(ov);
    try {
      const r = await api(`/api/tasks/${wb.task.id}/prelabel`, { method: 'POST', body: { emotion: withEmotion } });
      const pre = r.prelabel;
      wb.segments = (pre.segments || []).map((s) => ({ ...s, events: s.events || [] }));
      wb.duration = pre.duration || wb.duration;
      if (wb.audio) { /* 保持当前媒体 */ }
      wb.prelabel = pre;
      renderSegs(wb);
      $('#spk-editor').innerHTML = spkEditor(wb);
      drawWave(wb);
      toast(`预识别完成：${wb.segments.length} 段，耗时 ${(pre.elapsed_ms / 1000).toFixed(1)}s`, 'ok');
      await save(wb, true);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      ov.remove();
    }
  };
  $('#btn-prelabel').onclick = () => doPrelabel(false);
  $('#btn-prelabel-emo').onclick = () => doPrelabel(true);

  $('#btn-save').onclick = () => save(wb);
  $('#btn-submit').onclick = async () => {
    if (!wb.segments.length) return toast('至少需要一段标注结果', 'warn');
    const ok = await confirmModal('提交质检？', `共 ${wb.segments.length} 段标注，提交后将进入质检队列，标注内容暂不可修改。`, '提交质检');
    if (!ok) return;
    try {
      await api(`/api/tasks/${wb.task.id}/submit`, { method: 'POST', body: { payload: payloadOf(wb) } });
      toast('已提交质检', 'ok');
      setTimeout(() => (location.hash = '#/tasks'), 500);
    } catch (err) { toast(err.message, 'err'); }
  };

  const uploadBtn = $('#btn-upload');
  if (uploadBtn) {
    const input = $('#file-input');
    uploadBtn.onclick = () => input.click();
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      toast('正在上传并转码为 16k 单声道…');
      try {
        const r = await api(`/api/tasks/${wb.task.id}/media`, { method: 'POST', body: fd });
        toast(`上传成功，时长 ${fmt(r.duration)}`, 'ok');
        setTimeout(() => pageAnnotate(wb.task.id), 400);
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  setTimeout(() => drawWave(wb), 30);
}

function payloadOf(wb) {
  if (wb.mediaType === 'image') {
    return {
      media_type: 'image',
      img_size: { w: wb.imgW || 0, h: wb.imgH || 0 },
      boxes: wb.boxes.map((b) => ({
        cls: b.cls || '商品主体',
        x: Number(b.x) || 0, y: Number(b.y) || 0,
        w: Number(b.w) || 0, h: Number(b.h) || 0,
      })),
      summary: wb.summary || '',
      quality_score: wb.quality || 0,
    };
  }
  return {
    media_type: 'audio',
    segments: wb.segments.map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: s.text || '',
      spk: s.spk || '说话人1',
      emotion: s.emotion || '中性',
      events: s.events || [],
    })),
    summary: wb.summary || '',
    business: wb.business || '',
    quality_score: wb.quality || 0,
  };
}

let saveTimer = null;
function markDirty(wb) {
  wb.dirty = true;
  const ind = $('#save-ind');
  if (ind) ind.textContent = '未保存';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(wb, true), 4000);
}

async function save(wb, silent = false) {
  if (wb.saving) return;
  wb.saving = true;
  try {
    const r = await api(`/api/tasks/${wb.task.id}/annotation`, { method: 'POST', body: { payload: payloadOf(wb) } });
    wb.dirty = false;
    const ind = $('#save-ind');
    if (ind) ind.textContent = '已保存 ' + r.saved_at.slice(11, 16);
    if (!silent) toast('草稿已保存', 'ok');
  } catch (err) {
    if (!silent) toast(err.message, 'err');
  } finally {
    wb.saving = false;
  }
}

/* ---------------- 质检中心 ---------------- */
async function pageQC() {
  const data = await api('/api/qc');
  const tasks = data.tasks;
  const content = `
    <div class="page-head"><div><h1 class="page-title">质检中心</h1><p class="page-sub">对待质检任务执行复核、评分与返修，质检记录写入审计日志</p></div>
      <div class="page-actions"><span class="tag">${tasks.length} 个待质检</span></div></div>
    <div class="card"><div class="table-wrap">
      <table class="table"><thead><tr><th>任务</th><th>项目</th><th>标注员</th><th>批次</th><th>提交时间</th><th class="right">操作</th></tr></thead>
      <tbody>${tasks.map((t) => `<tr>
        <td><div class="name">${esc(t.name)}</div><div class="sub">#${t.id} · ${esc(t.modality_label)}</div></td>
        <td>${esc(t.project_name)}</td><td>${esc(t.assignee_name || '—')}</td><td class="mono">${esc(t.batch || '—')}</td>
        <td class="mono">${esc((t.updated_at || '').slice(5, 16))}</td>
        <td class="right"><button class="btn sm primary" data-review="${t.id}">开始质检</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty"><b>质检队列为空</b>所有提交任务均已完成复核</td></tr>'}</tbody></table>
    </div></div>`;
  mount('qc', '质检中心', content);
  $$('[data-review]').forEach((b) => (b.onclick = () => openReview(Number(b.dataset.review))));
}

async function openReview(tid) {
  const d = await api(`/api/tasks/${tid}`);
  const ann = d.annotation;
  // 目前标注表未区分预识别/人工，这里把 prelabel 与最终结果并排展示
  const payload = (ann && ann.payload) || {};
  const pre = (ann && ann.prelabel) || {};
  const segs = payload.segments || [];
  const preSegs = pre.segments || [];
  const pane = (arr, title) => `<div class="review-pane"><h4>${title} · ${arr.length} 段</h4>
    ${arr.map((s) => `<div class="review-line"><span class="t">${Number(s.start).toFixed(2)}</span><span class="s">${esc(s.spk || '—')}</span><span>${esc(s.text)}</span></div>`).join('') || '<div class="hint">无内容</div>'}</div>`;
  openModal(`
    <div class="modal-head"><h3>质检 · ${esc(d.task.name)}</h3><span class="chip submitted" style="margin-left:auto">待质检</span><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="review-grid">${pane(segs, '人工标注结果')}${pane(preSegs, 'AI 预识别结果')}</div>
      <div class="divider"></div>
      <div class="form-grid">
        <div class="field"><label>质检评分（0-100）</label><input class="input" type="number" id="qc-score" min="0" max="100" value="${segs.length ? 85 : 60}" /></div>
        <div class="field"><label>业务分类</label><input class="input" value="${esc(payload.business || '未分类')}" disabled /></div>
        <div class="field full"><label>质检意见</label><textarea class="input textarea" id="qc-comment" placeholder="填写返修点或通过说明"></textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-close>取消</button>
      <button class="btn danger" id="qc-reject">驳回返修</button>
      <button class="btn success" id="qc-approve">通过</button>
    </div>`, 'wide');
  const submit = async (result) => {
    try {
      await api(`/api/tasks/${tid}/review`, {
        method: 'POST',
        body: { result, score: Number($('#qc-score').value) || 0, comment: $('#qc-comment').value.trim() },
      });
      closeModal(); toast(result === 'approved' ? '质检通过，任务已完成' : '已驳回，任务回到标注中', 'ok');
      pageQC();
    } catch (err) { toast(err.message, 'err'); }
  };
  $('#qc-approve').onclick = () => submit('approved');
  $('#qc-reject').onclick = () => {
    if (!$('#qc-comment').value.trim()) return toast('驳回时请填写返修意见', 'warn');
    submit('rejected');
  };
}

/* ---------------- 项目管理 ---------------- */
async function pageProjects() {
  const data = await api('/api/projects');
  state.projects = data.projects;
  const canCreate = ['platform_admin', 'project_manager'].includes(state.user.platform_role);
  const content = `
    <div class="page-head"><div><h1 class="page-title">项目管理</h1><p class="page-sub">项目级数据隔离，平台角色与项目角色双重控制</p></div>
      <div class="page-actions">${canCreate ? `<button class="btn primary" id="btn-new-proj">${icon('plus')} 新建项目</button>` : ''}</div></div>
    <div class="grid proj-grid">
      ${data.projects.map((p) => `<div class="proj">
        <div class="proj-top"><div class="proj-icon">${icon(MODALITY_ICON[p.modality] || 'projects')}</div>
          <div style="min-width:0"><h3>${esc(p.name)}</h3><p>${esc(p.description || '暂无描述')}</p></div>
          <span class="chip ${p.status === 'active' ? 'done' : 'plain'}" style="margin-left:auto">${p.status === 'active' ? '进行中' : '已归档'}</span></div>
        <div class="chip-row"><span class="chip info">${esc(p.modality_label)}</span><span class="chip plain">${esc(p.code)}</span><span class="chip purple">我的角色：${esc(p.my_role_label)}</span></div>
        <div class="proj-stats"><span>任务 <b>${p.stats.total}</b></span><span>完成 <b>${p.stats.done}</b></span><span>质检中 <b>${p.stats.reviewing}</b></span><span>进度 <b>${p.stats.progress}%</b></span></div>
        <div class="progress"><i style="width:${p.stats.progress}%"></i></div>
        <div class="proj-foot">
          <button class="btn sm" data-members="${p.id}">${icon('members')} 成员</button>
          ${p.engine_url ? `<a class="btn sm" href="${esc(p.engine_url)}" target="_blank" rel="noreferrer">${icon('arrow')} ${esc(p.engine || '标注引擎')}</a>` : ''}
          <a class="btn sm primary" href="#/tasks?project=${p.id}">${icon('tasks')} 任务</a>
        </div>
      </div>`).join('') || '<div class="empty">暂无项目</div>'}
    </div>`;
  mount('projects', '项目管理', content);
  $$('[data-members]').forEach((b) => (b.onclick = () => projectMembers(Number(b.dataset.members))));
  const nb = $('#btn-new-proj');
  if (nb) nb.onclick = newProjectModal;
}

async function projectMembers(pid) {
  const [d, all] = await Promise.all([api(`/api/projects/${pid}/members`), api('/api/members').catch(() => ({ members: [] }))]);
  const proj = state.projects.find((p) => p.id === pid);
  const canManage = state.user.platform_role === 'platform_admin' || (proj && ['manager'].includes(proj.my_role));
  openModal(`
    <div class="modal-head"><h3>项目成员 · ${esc(proj ? proj.name : '')}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="table-wrap"><table class="table"><thead><tr><th>成员</th><th>平台角色</th><th>项目角色</th></tr></thead>
      <tbody>${d.members.map((m) => `<tr><td><div class="name">${esc(m.name)}</div><div class="sub mono">${esc(m.username)}</div></td>
        <td>${esc(m.platform_role)}</td><td><span class="chip info">${esc(m.project_role_label)}</span></td></tr>`).join('')}</tbody></table></div>
      ${canManage ? `<div class="divider"></div><div class="form-grid">
        <div class="field"><label>添加成员</label><select class="select" id="pm-user">${all.members.map((u) => `<option value="${u.id}">${esc(u.name)}（${esc(u.username)}）</option>`).join('')}</select></div>
        <div class="field"><label>项目角色</label><select class="select" id="pm-role">
          <option value="annotator">标注员</option><option value="reviewer">质检员</option><option value="manager">项目经理</option><option value="viewer">只读</option></select></div>
      </div>` : ''}
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button>${canManage ? '<button class="btn primary" id="pm-add">添加成员</button>' : ''}</div>`);
  const add = $('#pm-add');
  if (add) add.onclick = async () => {
    try {
      await api(`/api/projects/${pid}/members`, { method: 'POST', body: { user_id: Number($('#pm-user').value), project_role: $('#pm-role').value } });
      toast('成员已加入项目', 'ok');
      projectMembers(pid);
    } catch (err) { toast(err.message, 'err'); }
  };
}

function newProjectModal() {
  const labels = { audio: '语音', image: '图片', video: '视频', pointcloud: '点云' };
  openModal(`
    <div class="modal-head"><h3>新建项目</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>项目名称</label><input class="input" id="np-name" placeholder="例如 语音-保险回访质检" /></div>
      <div class="field"><label>项目编码</label><input class="input" id="np-code" placeholder="voice-insurance" /></div>
      <div class="field"><label>数据类型</label><select class="select" id="np-modality">${Object.entries(labels).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>标注引擎</label><input class="input" id="np-engine" placeholder="FunASR / CVAT / labelU" /></div>
      <div class="field full"><label>项目描述</label><textarea class="input textarea" id="np-desc" placeholder="说明业务目标、标注规范与验收标准"></textarea></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="np-ok">创建项目</button></div>`);
  $('#np-ok').onclick = async () => {
    try {
      await api('/api/projects', {
        method: 'POST',
        body: { name: $('#np-name').value.trim(), code: $('#np-code').value.trim(), modality: $('#np-modality').value, engine: $('#np-engine').value.trim(), description: $('#np-desc').value.trim() },
      });
      closeModal(); toast('项目已创建', 'ok'); pageProjects();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 成员管理 ---------------- */
async function pageMembers() {
  let data;
  try { data = await api('/api/members'); } catch (e) { data = { members: [] }; }
  state.members = data.members;
  const isAdmin = state.user.platform_role === 'platform_admin';
  const roles = { platform_admin: '平台管理员', project_manager: '项目经理', annotator: '标注员', reviewer: '质检员', client: '客户(只读)' };
  const content = `
    <div class="page-head"><div><h1 class="page-title">成员管理</h1><p class="page-sub">平台角色决定功能权限，项目角色决定数据可见范围</p></div>
      <div class="page-actions">${isAdmin ? `<button class="btn primary" id="btn-new-user">${icon('plus')} 新增成员</button>` : ''}</div></div>
    <div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">平台成员</h3><span class="card-sub">${data.members.length} 人</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>成员</th><th>平台角色</th><th>项目数</th><th>状态</th><th class="right">操作</th></tr></thead>
        <tbody>${data.members.map((m) => `<tr>
          <td><div class="name">${esc(m.name)}</div><div class="sub mono">${esc(m.username)}</div></td>
          <td>${isAdmin ? `<select class="select" data-role="${m.id}" style="width:130px;height:28px;padding:2px 6px">${Object.entries(roles).map(([k, v]) => `<option value="${k}" ${m.platform_role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : `<span class="tag">${esc(m.role_label)}</span>`}</td>
          <td>${m.project_count}</td>
          <td>${m.status === 'active' ? '<span class="chip done">正常</span>' : '<span class="chip danger">停用</span>'}</td>
          <td class="right">${isAdmin ? `<button class="btn sm ghost" data-toggle-user="${m.id}" data-status="${m.status}">${m.status === 'active' ? '停用' : '启用'}</button>` : '—'}</td>
        </tr>`).join('')}</tbody></table></div>
      </div>
      <div class="card"><div class="card-head"><h3 class="card-title">权限模型</h3><span class="card-sub">双重控制</span></div>
        <div class="card-body">
          <div class="panel-label">平台角色</div>
          <div class="kv"><span>平台管理员</span><b>全部项目 / 成员 / 设置</b></div>
          <div class="kv"><span>项目经理</span><b>所属项目全流程</b></div>
          <div class="kv"><span>标注员</span><b>仅本人任务</b></div>
          <div class="kv"><span>质检员</span><b>被指派项目的质检</b></div>
          <div class="kv"><span>客户(只读)</span><b>只读查看进度</b></div>
          <div class="divider"></div>
          <div class="panel-label">数据隔离规则</div>
          <div class="hint">• 非平台管理员只能看到 <b style="color:#93C5FD">project_members</b> 中授权的项目<br/>
          • 标注员只能访问 assignee_id 为自己的任务<br/>
          • 质检员只能复核 reviewer_id 为自己的任务<br/>
          • 所有跨项目访问在后端二次校验，不依赖前端隐藏</div>
        </div>
      </div>
    </div>`;
  mount('members', '成员管理', content);
  $('#btn-new-user') && ($('#btn-new-user').onclick = newUserModal);
  $$('[data-role]').forEach((s) => (s.onchange = async () => {
    try {
      await api(`/api/members/${s.dataset.role}`, { method: 'PATCH', body: { platform_role: s.value } });
      toast('角色已更新', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-toggle-user]').forEach((b) => (b.onclick = async () => {
    try {
      await api(`/api/members/${b.dataset.toggleUser}`, { method: 'PATCH', body: { status: b.dataset.status === 'active' ? 'disabled' : 'active' } });
      toast('状态已更新', 'ok'); pageMembers();
    } catch (err) { toast(err.message, 'err'); }
  }));
}

function newUserModal() {
  openModal(`
    <div class="modal-head"><h3>新增成员</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>账号</label><input class="input" id="nu-username" placeholder="登录账号" /></div>
      <div class="field"><label>姓名</label><input class="input" id="nu-name" placeholder="真实姓名" /></div>
      <div class="field"><label>初始密码</label><input class="input" id="nu-pass" value="chunke123" /></div>
      <div class="field"><label>平台角色</label><select class="select" id="nu-role">
        <option value="annotator">标注员</option><option value="reviewer">质检员</option>
        <option value="project_manager">项目经理</option><option value="client">客户(只读)</option><option value="platform_admin">平台管理员</option></select></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nu-ok">创建</button></div>`);
  $('#nu-ok').onclick = async () => {
    try {
      await api('/api/members', { method: 'POST', body: { username: $('#nu-username').value.trim(), name: $('#nu-name').value.trim(), password: $('#nu-pass').value, platform_role: $('#nu-role').value } });
      closeModal(); toast('成员已创建', 'ok'); pageMembers();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 数据统计 ---------------- */
async function pageStats() {
  const s = await api('/api/stats');
  const maxTrend = Math.max(1, ...s.trend.map((d) => Math.max(d.created, d.done)));
  const chart = s.trend.map((d, i) => {
    const x = 40 + i * 82;
    const h1 = Math.round((d.created / maxTrend) * 150);
    const h2 = Math.round((d.done / maxTrend) * 150);
    return `<g>
      <rect x="${x}" y="${200 - h1}" width="18" height="${h1}" rx="3" fill="#3B82F6" opacity=".9"/>
      <rect x="${x + 22}" y="${200 - h2}" width="18" height="${h2}" rx="3" fill="#10B981" opacity=".9"/>
      <text x="${x + 20}" y="218" text-anchor="middle" fill="#64748B" font-size="10">${d.day}</text>
      <text x="${x + 9}" y="${195 - h1}" text-anchor="middle" fill="#93C5FD" font-size="9">${d.created || ''}</text>
    </g>`;
  }).join('');
  const content = `
    <div class="page-head"><div><h1 class="page-title">数据统计</h1><p class="page-sub">任务吞吐、质检通过率与项目进度</p></div></div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">累计任务</div><div class="kpi-value">${s.summary.total || 0}</div><div class="kpi-delta">近 7 日持续产出</div></div>
      <div class="kpi"><div class="kpi-label">已完成</div><div class="kpi-value">${s.summary.done || 0}</div><div class="kpi-delta up">交付进度 ${s.summary.total ? Math.round((s.summary.done || 0) / s.summary.total * 100) : 0}%</div></div>
      <div class="kpi"><div class="kpi-label">质检通过率</div><div class="kpi-value">${s.summary.qc_pass_rate || 0}<small style="font-size:14px">%</small></div><div class="kpi-delta">共 ${s.summary.qc_total || 0} 次质检</div></div>
      <div class="kpi"><div class="kpi-label">待处理</div><div class="kpi-value">${(s.summary.pending || 0) + (s.summary.annotating || 0)}</div><div class="kpi-delta warn">含待标注与标注中</div></div>
    </div>
    <div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">近 7 日吞吐</h3><span class="card-sub">新建 / 完成</span></div>
        <div class="card-body"><svg class="chart" viewBox="0 0 620 230" height="230">
          <line x1="30" y1="201" x2="610" y2="201" stroke="#1E2A3F"/>
          ${[0, 50, 100, 150].map((v, i) => `<line x1="30" y1="${201 - v}" x2="610" y2="${201 - v}" stroke="#16213A" stroke-dasharray="3 4"/>
            <text x="22" y="${205 - v}" text-anchor="end" fill="#475569" font-size="9">${v}</text>`).join('')}
          ${chart}</svg>
          <div class="legend"><span><i style="background:#3B82F6"></i>新建任务</span><span><i style="background:#10B981"></i>完成</span></div>
        </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">项目进度</h3><span class="card-sub">按完成率</span></div>
        <div class="card-body">${s.projects.map((p) => `
          <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${esc(p.name)} <span class="tag">${esc(p.modality)}</span></span><b>${p.done}/${p.total}</b></div>
          <div class="progress"><i style="width:${p.progress}%"></i></div></div>`).join('') || '<div class="hint">暂无项目</div>'}
        </div></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">模态分布</h3></div>
      <div class="card-body"><div class="chip-row">${s.by_modality.map((m) => `<span class="chip info">${esc(m.name)} · ${m.value} 任务</span>`).join('') || '<span class="hint">暂无数据</span>'}</div></div></div>`;
  mount('stats', '数据统计', content);
}

/* ---------------- 系统设置 ---------------- */
async function pageSettings() {
  const [cfg, audit] = await Promise.all([api('/api/settings'), api('/api/audit')]);
  state.settings = cfg;
  const isAdmin = state.user.platform_role === 'platform_admin';
  const content = `
    <div class="page-head"><div><h1 class="page-title">系统设置</h1><p class="page-sub">预识别参数、引擎状态与操作审计</p></div></div>
    <div class="grid two-col">
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-head"><h3 class="card-title">AI 预识别配置</h3><span class="card-sub">${cfg.worker_ready ? '本地 worker 就绪' : 'worker 未就绪'}</span></div>
          <div class="card-body">
            <div class="form-grid">
              <div class="field"><label>识别引擎</label><select class="select" id="set-engine">
                <option value="funasr-paraformer" ${cfg.asr_engine === 'funasr-paraformer' ? 'selected' : ''}>FunASR Paraformer + CAM++（推荐）</option>
                <option value="funasr-sensevoice" ${cfg.asr_engine === 'funasr-sensevoice' ? 'selected' : ''}>SenseVoice（多语种 + 情绪）</option>
                <option value="whisper" ${cfg.asr_engine === 'whisper' ? 'selected' : ''}>Whisper large-v3-turbo（兜底）</option></select></div>
              <div class="field"><label>说话人数上限</label><select class="select" id="set-spk">
                <option value="0" ${cfg.spk_num === '0' ? 'selected' : ''}>自动聚类</option>
                <option value="2" ${cfg.spk_num === '2' ? 'selected' : ''}>2 人</option>
                <option value="3" ${cfg.spk_num === '3' ? 'selected' : ''}>3 人</option>
                <option value="4" ${cfg.spk_num === '4' ? 'selected' : ''}>4 人</option></select></div>
              <div class="field full"><label>热词表（逗号分隔，用于业务术语纠错）</label>
                <textarea class="input textarea" id="set-hotwords">${esc(cfg.hotwords || '')}</textarea></div>
              <div class="field full"><label>自动预识别</label>
                <div style="display:flex;align-items:center;gap:10px"><div class="toggle ${cfg.auto_prelabel === 'on' ? 'on' : ''}" id="set-auto"></div><span class="hint">新任务导入后自动触发转写与说话人分离</span></div></div>
            </div>
            <div class="divider"></div>
            <button class="btn primary" id="set-save" ${isAdmin ? '' : 'disabled'}>保存配置</button>
            <span class="hint" style="margin-left:10px">模型路径：/Volumes/ORICO/voice-ai/models</span>
          </div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">操作审计</h3><span class="card-sub">最近 60 条</span></div>
          <div class="card-body audit" style="max-height:300px;overflow:auto">
            ${audit.logs.map((l) => `<div class="row"><span class="time">${esc((l.created_at || '').slice(5, 16))}</span><span><b>${esc(l.actor_name || '系统')}</b> ${esc(l.action)} <span style="color:#64748B">${esc(l.target)}</span> ${esc(l.detail)}</span></div>`).join('') || '<div class="hint">暂无记录</div>'}
          </div></div>
      </div>
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-head"><h3 class="card-title">引擎状态</h3><span class="card-sub">实时探测</span></div>
          <div>${cfg.engines.map((e) => `<div class="engine"><i class="dot ${e.online ? 'online' : 'offline'}"></i>
            <div class="engine-info"><b>${esc(e.name)}</b><span>${esc(e.desc)}</span></div>
            <a href="${esc(e.url)}" target="_blank" rel="noreferrer">${e.online ? '打开' : '离线'}</a></div>`).join('')}</div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">本地模型</h3></div>
          <div class="card-body">
            <div class="kv"><span>中文 ASR</span><b>Paraformer-large</b></div>
            <div class="kv"><span>多语种 / 情绪</span><b>SenseVoiceSmall</b></div>
            <div class="kv"><span>端点检测</span><b>FSMN-VAD</b></div>
            <div class="kv"><span>说话人</span><b>CAM++ + 层次聚类</b></div>
            <div class="kv"><span>重叠语音</span><b>pyannote seg-3.0 (ONNX)</b></div>
            <div class="kv"><span>人声分离</span><b>UVR5 MDX</b></div>
            <div class="hint" style="margin-top:8px">音频预识别在本地 CPU 运行，数据不出内网。</div>
          </div></div>
      </div>
    </div>`;
  mount('settings', '系统设置', content);
  const auto = $('#set-auto');
  auto.onclick = () => auto.classList.toggle('on');
  $('#set-save').onclick = async () => {
    try {
      await api('/api/settings', { method: 'POST', body: {
        asr_engine: $('#set-engine').value, spk_num: $('#set-spk').value,
        hotwords: $('#set-hotwords').value.trim(), auto_prelabel: auto.classList.contains('on') ? 'on' : 'off',
      } });
      toast('配置已保存', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 启动 ---------------- */
async function boot() {
  try {
    const b = await api('/api/bootstrap');
    state.user = b.user;
    state.projects = b.projects;
    state.engines = b.engines;
    state.settings = b.settings;
    state.counts = b.counts;
    if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
    await route();
  } catch (err) {
    if (err.message === '请先登录') renderLogin();
    else {
      $('#app').innerHTML = `<div class="boot-screen"><div style="text-align:center"><b>加载失败</b><div class="hint" style="margin-top:6px">${esc(err.message)}</div></div></div>`;
    }
  }
}

window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('resize', () => { if (state.wb && $('#wave')) drawWave(state.wb); });
