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
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 2 2m-5 1 2 2"/>',
};

const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

const STATUS = {
  pending: ['待标注', 'pending'],
  annotating: ['标注中', 'annotating'],
  submitted: ['待质检', 'submitted'],
  review: ['质检中', 'reviewing'],
  review_done: ['待验收', 'reviewing'],
  done: ['已完成', 'done'],
  paused: ['已暂停', 'pending'],
  ended: ['已结束', 'plain'],
  draft: ['草稿', 'plain'],
  approved: ['已通过', 'done'],
  rejected: ['已驳回', 'danger'],
};
const statusChip = (s) => {
  const [label, cls] = STATUS[s] || [s, 'plain'];
  return `<span class="chip ${cls}"><i class="dot"></i>${label}</span>`;
};
const MODALITY_ICON = { audio: 'audio', image: 'image', video: 'video', pointcloud: 'cloud', editing: 'spark' };
const SPK_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];

/* 目标类别配色：画布、列表、结果面板统一取色 */
const BOX_COLORS = {
  '商品主体': '#3B82F6', '价签': '#10B981', '货架': '#F59E0B', '遮挡': '#EF4444',
  '清晰': '#22C55E', '模糊': '#F97316', '过曝': '#E879F9',
  '行人': '#A855F7', '骑行者': '#06B6D4', '轿车': '#22D3EE', '货车': '#F59E0B',
  '卡车': '#EC4899', '公交车': '#8B5CF6',
};
const boxColor = (c) => BOX_COLORS[c] || '#64748B';
/* 按类型给出的常用名称候选，供名称输入框下拉快速选择 */
const NAME_SUGGEST = {
  '商品主体': ['瓶装饮料', '罐装饮料', '瓶装水', '袋装零食', '盒装麦片', '袋装咖啡', '罐装食品', '瓶装洗护', '盒装洗护', '牛奶', '饼干', '方便面'],
  '价签': ['价签', '促销价签', '电子价签', '手写价签', '缺货价签'],
  '货架': ['货架', '端架', '堆头', '陈列架', '层板'],
  '遮挡': ['遮挡', '被遮挡商品', '反光遮挡', '人物遮挡', '杂物遮挡'],
  '清晰': ['清晰'], '模糊': ['模糊'], '过曝': ['过曝'],
  '行人': ['行人', '过街行人', '候车行人', '成年男性', '成年女性', '儿童', '老人'],
  '骑行者': ['自行车骑手', '电动车骑手', '外卖骑手'],
  '轿车': ['出租车', '私家车', '网约车', 'SUV', '警车', '教练车'],
  '货车': ['厢式货车', '物流车', '卡车', '冷链车', '渣土车'],
  '公交车': ['公交车', '大巴', '中巴', 'BRT公交'],
};
const nameSuggestOf = (cls) => NAME_SUGGEST[cls] || [];
const sugId = (wb, cls) => `nm-${Math.max(0, clsOptions(wb).indexOf(cls))}`;
/* 目标在画面中的纵向上/中/下分区（货架分层用） */
const bandOf = (b) => {
  const cy = (b.y || 0) + (b.h || 0) / 2;
  return cy < 0.4 ? 0 : cy < 0.66 ? 1 : 2;
};
const iouBox = (a, b) => {
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.w, b.x + b.w), iy2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
};

const state = {
  user: null,
  settings: {},
  engines: [],
  projects: [],
  members: [],
  current: null,
  wb: null,
  context: null,
  space: '',
  pid: 0,
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
    const err = new Error((data && (data.detail || data.error)) || `请求失败(${res.status})`);
    err.data = data || {};
    err.status = res.status;
    throw err;
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
      state.context = null; state.space = ''; state.pid = 0;
      location.hash = '';
      await boot();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = '进入平台';
    }
  };
}

/* ---------------- 外壳 ---------------- */
const ADMIN_NAV = [
  ['dashboard', '平台总览', 'dashboard'],
  ['org', '租户与组织', 'shield'],
  ['members', '用户管理', 'members'],
  ['projects', '全部项目', 'projects'],
  ['stats', '平台统计', 'stats'],
  ['service', '运营服务', 'shield'],
  ['openapi', '开放平台', 'key'],
  ['ops', '运维中心', 'settings'],
  ['console', '平台控制台', 'shield'],
  ['settings', '系统设置', 'settings'],
];

const TENANT_NAV = [
  ['dashboard', '租户概览', 'dashboard'],
  ['projects', '项目管理', 'projects'],
  ['tasks', '任务中心', 'tasks'],
  ['qc', '质检中心', 'qc'],
  ['acceptance', '验收中心', 'check'],
  ['datasets', '数据集', 'database'],
  ['templates', '模板中心', 'layers'],
  ['workflows', '工作流', 'spark'],
  ['org', '组织架构', 'shield'],
  ['members', '成员管理', 'members'],
  ['stats', '数据统计', 'stats'],
  ['service', '运营服务', 'shield'],
];

const PROJECT_NAV = [
  ['dashboard', '工作台', 'dashboard'],
  ['tasks', '我的任务', 'tasks'],
  ['qc', '质检中心', 'qc'],
  ['acceptance', '验收中心', 'check'],
  ['projects', '项目空间', 'projects'],
  ['datasets', '数据集', 'database'],
  ['templates', '模板中心', 'layers'],
  ['workflows', '工作流', 'spark'],
  ['stats', '数据统计', 'stats'],
  ['help', '帮助中心', 'search'],
];

const NAV_PERM = {
  acceptance: 'task.accept',
  datasets: 'dataset.read', templates: 'template.read', workflows: 'workflow.read',
  org: 'org.read', members: 'member.read', openapi: 'api.read', settings: 'settings.write',
  ops: 'settings.write', console: 'settings.write', service: 'member.read',
};

// 项目平台执行类角色的精简导航：标注员/质检员/验收员只需与本职工作相关的入口
const PROJECT_NAV_BY_ROLE = {
  annotator: [
    ['dashboard', '工作台', 'dashboard'],
    ['tasks', '我的任务', 'tasks'],
    ['hall', '任务大厅', 'tasks'],
    ['issues', '问题清单', 'qc'],
    ['help', '帮助中心', 'search'],
    ['preferences', '个人偏好', 'members'],
  ],
  reviewer: [
    ['dashboard', '工作台', 'dashboard'],
    ['qc', '质检中心', 'qc'],
    ['quality', '规则质检', 'shield'],
    ['issues', '问题清单', 'qc'],
    ['help', '帮助中心', 'search'],
    ['preferences', '个人偏好', 'members'],
  ],
  acceptor: [
    ['dashboard', '工作台', 'dashboard'],
    ['acceptance', '验收中心', 'check'],
    ['help', '帮助中心', 'search'],
    ['preferences', '个人偏好', 'members'],
  ],
};

// 执行类角色可见的扩展（CK_NAV）入口白名单，其余治理/运维类入口一律隐藏
const WORKER_EXTRA_ALLOW = {
  annotator: ['hall', 'issues', 'help', 'preferences'],
  reviewer: ['quality', 'issues', 'help', 'preferences'],
  acceptor: ['help', 'preferences'],
};

function navDef() {
  const workerNav = state.space === 'project' ? PROJECT_NAV_BY_ROLE[state.user && state.user.platform_role] : null;
  const base = workerNav || (state.space === 'admin' ? ADMIN_NAV : state.space === 'tenant' ? TENANT_NAV : PROJECT_NAV);
  const extras = state.space === 'project'
    ? (window.CK_NAV || [])
      .filter(([, , , perm]) => !perm || can(perm))
      .filter(([key]) => !base.some(([k]) => k === key))
      .filter(([key]) => !workerNav || (WORKER_EXTRA_ALLOW[state.user.platform_role] || []).includes(key))
    : [];
  return base.concat(extras).filter(([key, , , perm]) => {
    const need = perm || NAV_PERM[key];
    return !need || can(need);
  });
}

function hrefFor(key) {
  if (state.space === 'project') return `#/project/${state.pid || 0}/${key}`;
  return `#/${state.space || 'project'}/${key}`;
}

function shell(active, content, crumb = '') {
  const nav = navDef().map(([key, label, ico]) => {
    const badge = key === 'qc'
      ? '<b class="tag" id="nav-qc-count">0</b>'
      : key === 'acceptance' ? '<b class="tag" id="nav-accept-count">0</b>' : '';
    return `<a class="nav-item ${active === key ? 'active' : ''}" href="${hrefFor(key)}" title="${esc(label)}" aria-current="${active === key ? 'page' : 'false'}">${icon(ico)}<span>${label}</span>${badge}</a>`;
  }).join('');
  const role = state.user.role_label || '';
  const ctx = state.context || {};
  const tenantName = ctx.tenant ? ctx.tenant.name : (ctx.space === 'admin' ? '平台视角' : '未归属租户');
  const scope = [
    ctx.tenant && ctx.tenant.code,
    ctx.org && ctx.org.name,
    ctx.team && ctx.team.name,
  ].filter(Boolean).join(' · ');
  return `
  <div class="layout">
    <aside class="sidebar">
      <div class="side-brand"><div class="logo-mark">CK</div><div><span>春科标注</span><small>${esc(ctx.space_label || 'CHUNKE LABEL')}</small></div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot">
        <b>${esc(state.user.name)}</b> · ${esc(role)}<br/>
        ${esc(scope || '未归属租户 / 团队')}
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="crumb">${esc(ctx.space_label || '春科数据')} / <b>${esc(crumb)}</b></div>
        <div class="top-actions">
          <button class="btn sm ghost tenant-btn" id="tenant-switch" title="当前：${esc(tenantName)}，点击切换租户">${icon('shield')}<span class="t-name">${esc(tenantName)}</span></button>
          <div class="search">${icon('search')}<input id="top-search" placeholder="搜索任务 / 项目" aria-label="搜索任务或项目" /></div>
          <button class="icon-btn" id="notif-btn" title="通知">${icon('bell')}<b class="tag" id="notif-dot" style="display:none">0</b></button>
          <div class="user-chip" id="user-chip" title="${esc(state.user.name)} · ${esc(role)}"><div class="avatar">${esc(state.user.name.slice(0, 1))}</div><div class="u-meta"><b>${esc(state.user.name)}</b><span>${esc(role)}</span></div></div>
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
  if (state.context && state.context.counts && state.context.counts.accept) {
    const el = $('#nav-accept-count');
    if (el) el.textContent = state.context.counts.accept;
  }
  $('#top-search').onkeydown = (e) => {
    if (e.key === 'Enter') {
      const base = hrefFor('tasks');
      location.hash = `${base}?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  };
  $('#user-chip').onclick = () => userMenu();
  $('#tenant-switch').onclick = () => tenantSwitcher();
  const nb = $('#notif-btn');
  if (nb) nb.onclick = () => { if (window.CK_OPEN_NOTIFICATIONS) window.CK_OPEN_NOTIFICATIONS(); };
  if (window.CK_AFTER_MOUNT) window.CK_AFTER_MOUNT(active);
}

async function tenantSwitcher() {
  const ctx = state.context || await api('/api/context');
  const items = ctx.tenants || [];
  const current = ctx.tenant ? ctx.tenant.id : 0;
  openModal(`
    <div class="modal-head"><h3>切换租户</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="hint" style="margin-bottom:10px">同一账号可加入多个租户，切换后组织、团队、项目与数据范围随之隔离。</div>
      <div class="tenant-list">${items.length ? items.map((t) => `
        <button class="tenant-item ${t.id === current ? 'active' : ''}" data-tenant="${t.id}">
          <b>${esc(t.name)}</b><span class="mono">${esc(t.code)}</span>
          ${t.id === current ? '<span class="chip done">当前</span>' : '<span class="chip plain">进入</span>'}
        </button>`).join('') : '<div class="empty">当前账号未加入任何租户</div>'}</div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`, 'sm');
  $$('[data-tenant]').forEach((b) => {
    b.onclick = async () => {
      try {
        await api('/api/tenant/switch', { method: 'POST', body: { tenant_id: Number(b.dataset.tenant) } });
        state.context = await api('/api/context');
        state.space = state.context.space;
        state.pid = state.context.projects && state.context.projects[0] ? state.context.projects[0].id : state.pid;
        closeModal();
        toast('已切换租户', 'ok');
        const qb = await api('/api/bootstrap');
        state.user = qb.user;
        state.permissions = qb.permissions || [];
        state.counts = qb.counts;
        location.hash = hrefFor('dashboard');
        await route();
      } catch (err) { toast(err.message, 'err'); }
    };
  });
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
    state.context = null; state.space = ''; state.pid = 0;
    closeModal();
    location.hash = '';
    renderLogin();
  };
}

/* ---------------- 路由 ---------------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '';
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  let space = '';
  let pid = 0;
  if (['admin', 'tenant', 'project'].includes(parts[0])) {
    space = parts.shift();
    if (space === 'project') pid = Number(parts.shift()) || 0;
  }
  return {
    space,
    pid,
    page: parts[0] || 'dashboard',
    id: parts[1] ? Number(parts[1]) : null,
    query: new URLSearchParams(query || ''),
  };
}

async function route() {
  if (!state.user) return;
  const h = parseHash();
  if (h.space && state.context) {
    const own = state.context.space;
    const allowed = own === 'admin'
      ? ['admin', 'tenant', 'project']
      : own === 'tenant' ? ['tenant', 'project'] : ['project'];
    if (!allowed.includes(h.space)) {
      const prefix = own === 'project' ? `/project/${state.pid || 0}` : `/${own}`;
      const q = h.query.toString();
      location.hash = `#${prefix}/${h.page}${q ? `?${q}` : ''}`;
      return;
    }
  }
  if (h.space) {
    state.space = h.space;
    if (h.pid) state.pid = h.pid;
  } else if (h.page !== 'annotate') {
    // 旧链接兼容：自动补全为当前入口的三段式路由
    const sp = state.space || (state.context && state.context.space) || 'project';
    const prefix = sp === 'project' ? `/project/${state.pid || 0}` : `/${sp}`;
    const q = h.query.toString();
    location.hash = `#${prefix}/${h.page}${q ? `?${q}` : ''}`;
    return;
  }
  const { page, id, query } = h;
  try {
    if (!document.getElementById('page')) $('#app').innerHTML = shell('', '', '');
    const need = NAV_PERM[page];
    if (need && !can(need)) {
      $('#page').innerHTML = `<div class="empty"><b>没有访问权限</b>当前角色未开通该模块，请联系平台管理员调整 RBAC 权限矩阵</div>`;
      return;
    }
    if (page === 'dashboard') await pageDashboard();
    else if (page === 'tasks') await pageTasks(query);
    else if (page === 'qc') await pageQC();
    else if (page === 'acceptance') await pageAcceptance();
    else if (page === 'projects') await pageProjects();
    else if (page === 'datasets') await pageDatasets();
    else if (page === 'templates') await pageTemplates();
    else if (page === 'workflows') await pageWorkflows();
    else if (page === 'org') await pageOrg();
    else if (page === 'openapi') await pageOpenapi();
    else if (page === 'members') await pageMembers();
    else if (page === 'stats') await pageStats();
    else if (page === 'settings') await pageSettings();
    else if (window.CK_PAGES && window.CK_PAGES[page]) await window.CK_PAGES[page](query, id);
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
  const nextTask = b.tasks.find((t) => t.status === 'pending' || t.status === 'annotating') || b.tasks[0];
  const maxTrend = Math.max(1, ...stats.trend.map((d) => Math.max(d.created, d.done)));
  const CHART_H = 88;
  const BASE = 120;
  const trendSvg = stats.trend.map((d, i) => {
    const x = 18 + i * 52;
    const h1 = Math.round((d.created / maxTrend) * CHART_H);
    const h2 = Math.round((d.done / maxTrend) * CHART_H);
    return `<g><title>${esc(d.day)}：新建 ${d.created} · 完成 ${d.done}</title>
      <rect x="${x}" y="${BASE - h1}" width="11" height="${Math.max(h1, 2)}" rx="2" fill="#3B82F6" opacity=".9"/>
      <rect x="${x + 14}" y="${BASE - h2}" width="11" height="${Math.max(h2, 2)}" rx="2" fill="#10B981" opacity=".9"/>
      <text x="${x + 12}" y="136" text-anchor="middle" fill="#64748B" font-size="9.5">${esc(d.day)}</text></g>`;
  }).join('');
  const grid = [0, 1, 2, 3].map((n) => {
    const y = Math.round(BASE - (CHART_H / 3) * n);
    return `<line x1="8" y1="${y}" x2="372" y2="${y}" stroke="#1E2A3F" stroke-dasharray="${n ? '3 5' : '0'}" opacity="${n ? '.7' : '1'}"/>`;
  }).join('');
  const qcQueue = (s.submitted || 0) + (s.reviewing || 0);
  const engineOnline = (e) => !!(e && e.online);
  const lsEngine = (b.engines || []).find((e) => /label/i.test(e.name)) || {};
  const cvatEngine = (b.engines || []).find((e) => /cvat/i.test(e.name)) || {};
  const hasTrend = stats.trend.some((d) => d.created || d.done);
  const chartHtml = hasTrend
    ? `<svg class="chart" viewBox="0 0 380 140" preserveAspectRatio="none" style="height:170px" role="img" aria-label="近 7 日任务吞吐柱状图">${grid}${trendSvg}</svg>`
    : '<div class="chart-empty">近 7 日暂无任务变动</div>';

  const content = `
    <div class="page-head">
      <div><h1 class="page-title">工作台</h1><p class="page-sub">${esc(state.user.name)}，今天有 ${s.pending || 0} 个待标注任务、${(s.submitted || 0) + (s.reviewing || 0)} 个待质检任务</p></div>
      <div class="page-actions">
        <a class="btn" href="${hrefFor('tasks')}">${icon('tasks')} 查看任务</a>
        <a class="btn primary" href="${nextTask ? `#/annotate/${nextTask.id}` : hrefFor('tasks')}">${icon('spark')} 进入标注</a>
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
          ${chartHtml}
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
        <div class="card-head"><h3 class="card-title">最近任务</h3><a class="card-sub" href="${hrefFor('tasks')}">全部任务 →</a></div>
        <div class="table-wrap">
          <table class="table"><thead><tr><th>任务</th><th>项目</th><th class="hide-sm">标注员</th><th>状态</th><th class="right">更新时间</th></tr></thead>
          <tbody>${recent.map((t) => `<tr onclick="location.hash='#/annotate/${t.id}'">
            <td><div class="name">${esc(t.name)}</div><div class="sub">${esc(t.batch || '')}</div></td>
            <td>${esc(t.project_name)}</td><td class="hide-sm">${esc(t.assignee_name || '—')}</td>
            <td>${statusChip(t.status)}</td><td class="right mono">${esc((t.updated_at || '').slice(5, 16))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">暂无任务</td></tr>'}</tbody></table>
        </div>
      </div>
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">引擎与预识别</h3><span class="card-sub">本地服务探测</span></div>
          <div>${b.engines.map((e) => `<div class="engine"><i class="dot ${e.online ? 'online' : 'offline'}"></i>
            <div class="engine-info"><b>${esc(e.name)}</b><span>${esc(e.desc)}</span></div>
            <a href="${esc(e.url)}" target="_blank" rel="noreferrer" title="${e.online ? '在新窗口打开' : '服务未启动'}">${e.online ? '打开' : '未启动'}</a></div>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">快捷入口</h3><span class="card-sub">常用操作</span></div>
          <div class="card-body">
            <div class="quick-grid">
              <a class="quick-link" href="${hrefFor('tasks')}">${icon('tasks')}<div class="q-text"><b>任务中心</b><span class="sub">${s.total || 0} 个任务</span></div></a>
              <a class="quick-link" href="${hrefFor('qc')}">${icon('qc')}<div class="q-text"><b>质检队列</b><span class="sub">${qcQueue} 个待质检</span></div></a>
              <a class="quick-link" href="${hrefFor('projects')}">${icon('projects')}<div class="q-text"><b>项目管理</b><span class="sub">${stats.projects.length} 个项目</span></div></a>
              <a class="quick-link" href="${esc(lsEngine.url || 'http://127.0.0.1:8080/')}" target="_blank" rel="noreferrer">${icon('audio')}<div class="q-text"><b>Label Studio</b><span class="sub">${engineOnline(lsEngine) ? '在线' : '未启动'}</span></div><span class="chip ${engineOnline(lsEngine) ? 'done' : 'plain'}">${engineOnline(lsEngine) ? '在线' : '离线'}</span></a>
              <a class="quick-link" href="${esc(cvatEngine.url || 'http://127.0.0.1:8090/')}" target="_blank" rel="noreferrer">${icon('cloud')}<div class="q-text"><b>CVAT</b><span class="sub">点云 / 视频</span></div><span class="chip ${engineOnline(cvatEngine) ? 'done' : 'plain'}">${engineOnline(cvatEngine) ? '在线' : '离线'}</span></a>
              <a class="quick-link" href="${hrefFor('stats')}">${icon('stats')}<div class="q-text"><b>数据统计</b><span class="sub">产能与质量</span></div></a>
            </div>
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
  const canManage = ['platform_admin', 'project_manager'].includes(state.user.platform_role);
  const projOptions = state.projects.map((p) => `<option value="${p.id}" ${String(p.id) === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const content = `
    <div class="page-head"><div><h1 class="page-title">任务中心</h1><p class="page-sub">按项目、状态筛选任务，点击行进入标注或质检</p></div>
      <div class="page-actions"><button class="btn" id="btn-export">${icon('download')} 导出清单</button>
      ${canManage ? `<button class="btn primary" id="btn-new-task">${icon('plus')} 新建任务</button>` : ''}</div></div>
    <div class="filters">
      <div class="seg-tabs" id="task-tabs">
        <button class="active" data-st="">全部</button><button data-st="pending">待标注</button>
        <button data-st="annotating">标注中</button><button data-st="__rework__">返修中</button>
        <button data-st="submitted">待质检</button><button data-st="review">质检中</button>
        <button data-st="review_done">待验收</button><button data-st="paused">已暂停</button>
        <button data-st="done">已完成</button>
      </div>
      <select class="select" id="filter-project" style="width:190px"><option value="">全部项目</option>${projOptions}</select>
      <span class="spacer"></span>
      <span class="tag">共 ${tasks.length} 条</span>
    </div>
    <div class="card"><div class="table-wrap">
      <table class="table"><thead><tr><th style="width:30px"></th><th>任务名称</th><th>项目</th><th class="hide-lg">模态</th><th class="hide-lg">批次</th><th>标注员</th><th class="hide-md">质检员</th><th>状态</th><th class="hide-md">优先级</th><th class="right">操作</th></tr></thead>
      <tbody id="task-body">${taskRows(tasks, canManage)}</tbody></table>
    </div></div>`;
  mount('tasks', '任务中心', content);

  $$('#task-tabs button').forEach((b) => (b.onclick = () => {
    $$('#task-tabs button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const set = b.dataset.st.split(',').filter(Boolean);
    const reworkOnly = set.includes('__rework__');
    $$('#task-body tr').forEach((tr) => {
      const statusOk = !set.length || reworkOnly || set.includes(tr.dataset.status);
      const reworkOk = !reworkOnly || tr.dataset.rework === '1';
      tr.style.display = statusOk && reworkOk ? '' : 'none';
    });
  }));
  $('#filter-project').onchange = (e) => { location.hash = `#/tasks?project=${e.target.value}`; };
  $('#btn-export').onclick = () => exportTasks(tasks);
  const nt = $('#btn-new-task');
  if (nt) nt.onclick = newTaskModal;
  $$('[data-assign]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    assignTaskModal(Number(b.dataset.assign), Number(b.dataset.pid));
  }));
}

function taskRows(tasks, canAssign = false) {
  return tasks.map((t) => `<tr data-status="${t.status}" data-rework="${(t.rework_count || 0) > 0 ? 1 : 0}" onclick="location.hash='#/annotate/${t.id}'">
    <td>${icon(MODALITY_ICON[t.modality] || 'tasks')}</td>
    <td><div class="name">${esc(t.name)}</div><div class="sub">#${t.id} · ${fmtShort(t.duration)}</div></td>
    <td>${esc(t.project_name)}</td><td class="hide-lg"><span class="tag">${esc(t.modality_label)}</span></td>
    <td class="mono hide-lg">${esc(t.batch || '—')}</td><td style="white-space:nowrap">${esc(t.assignee_name || '未分配')}</td><td class="hide-md">${esc(t.reviewer_name || '—')}</td>
    <td>${statusChip(t.status)}${(t.rework_count || 0) > 0 ? ` <span class="chip danger" title="已被驳回 ${t.rework_count} 次">返修×${t.rework_count}</span>` : ''}</td>
    <td class="hide-md">${t.priority === 'high' ? '<span class="chip danger">高</span>' : t.priority === 'low' ? '<span class="chip plain">低</span>' : '<span class="chip plain">普通</span>'}</td>
    <td class="right"><div style="display:flex;gap:4px;justify-content:flex-end">
      ${canAssign ? `<button class="btn sm ghost" data-assign="${t.id}" data-pid="${t.project_id}">分配</button>` : ''}
      <a class="btn sm" href="#/annotate/${t.id}" onclick="event.stopPropagation()">${t.status === 'submitted' ? '质检' : '标注'}</a></div></td></tr>`).join('')
    || '<tr><td colspan="10" class="empty"><b>没有符合条件的任务</b>调整筛选条件或新建任务</td></tr>';
}

function newTaskModal() {
  const projects = state.projects.filter(
    (p) => state.user.platform_role === 'platform_admin' || p.my_role === 'manager'
  );
  if (!projects.length) return toast('当前没有可创建任务的项目', 'warn');
  const modalityLabel = { audio: '语音', image: '图片', video: '视频', pointcloud: '点云' };
  openModal(`
    <div class="modal-head"><h3>新建任务</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>所属项目</label><select class="select" id="nt-project">
        ${projects.map((p) => `<option value="${p.id}" data-modality="${p.modality}">${esc(p.name)}（${esc(p.modality_label)}）</option>`).join('')}
      </select></div>
      <div class="field"><label>任务名称</label><input class="input" id="nt-name" placeholder="例如 货架巡检-门店-026" /></div>
      <div class="field"><label>数据类型</label><select class="select" id="nt-media">
        ${Object.entries(modalityLabel).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select></div>
      <div class="field"><label>批次</label><input class="input" id="nt-batch" placeholder="例如 巡检 11 月" /></div>
      <div class="field"><label>优先级</label><select class="select" id="nt-priority">
        <option value="normal">普通</option><option value="high">高</option><option value="low">低</option>
      </select></div>
      <div class="field"><label>标注员</label><select class="select" id="nt-assignee"><option value="0">暂不分配</option></select></div>
      <div class="field"><label>质检员</label><select class="select" id="nt-reviewer"><option value="0">暂不指定</option></select></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nt-ok">创建任务</button></div>`);
  const mediaSel = $('#nt-media');
  const projSel = $('#nt-project');
  const syncMedia = () => {
    const m = projSel.selectedOptions[0]?.dataset.modality;
    if (m) mediaSel.value = m;
  };
  const fillMembers = async () => {
    const pid = projSel.value;
    if (!pid) return;
    try {
      const d = await api(`/api/projects/${pid}/members`);
      const opts = (roles) => d.members
        .filter((m) => roles.includes(m.project_role))
        .map((m) => `<option value="${m.id}">${esc(m.name)}（${esc(m.project_role_label)}）</option>`).join('');
      $('#nt-assignee').innerHTML = `<option value="0">暂不分配</option>${opts(['annotator', 'manager'])}`;
      $('#nt-reviewer').innerHTML = `<option value="0">暂不指定</option>${opts(['reviewer', 'manager'])}`;
    } catch (err) { /* 忽略成员加载失败，仍可创建任务 */ }
  };
  syncMedia();
  fillMembers();
  projSel.onchange = () => { syncMedia(); fillMembers(); };
  $('#nt-ok').onclick = async () => {
    try {
      const r = await api('/api/tasks', {
        method: 'POST',
        body: {
          project_id: Number(projSel.value),
          name: $('#nt-name').value.trim(),
          media_type: mediaSel.value,
          batch: $('#nt-batch').value.trim(),
          priority: $('#nt-priority').value,
          assignee_id: Number($('#nt-assignee').value) || 0,
          reviewer_id: Number($('#nt-reviewer').value) || 0,
        },
      });
      closeModal();
      toast('任务已创建，可在标注页上传媒体文件', 'ok');
      await pageTasks(new URLSearchParams());
      if (r.id) location.hash = `#/annotate/${r.id}`;
    } catch (err) { toast(err.message, 'err'); }
  };
}

async function assignTaskModal(tid, pid) {
  const [d, t] = await Promise.all([
    api(`/api/projects/${pid}/members`),
    Promise.resolve((state.tasks || []).find((x) => x.id === tid)),
  ]);
  const opts = (roles, current, roleLabel) => {
    const list = d.members.filter((m) => roles.includes(m.project_role));
    let html = `<option value="">${current ? '保持不变' : '暂不分配'}</option>`;
    if (current) html += '<option value="0">未分配（清空）</option>';
    html += list.map((m) => `<option value="${m.id}">${esc(m.name)}（${esc(m.project_role_label)}）</option>`).join('');
    return { html, empty: !list.length, roleLabel };
  };
  const aOpt = opts(['annotator', 'manager'], t && t.assignee_id, '标注员');
  const rOpt = opts(['reviewer', 'manager'], t && t.reviewer_id, '质检员');
  const missing = [aOpt.empty ? '标注员' : '', rOpt.empty ? '质检员' : ''].filter(Boolean);
  const hint = missing.length
    ? `<div class="hint" style="margin-top:8px;color:#F59E0B">当前项目暂无可分配的${missing.join('、')}，请先在「项目管理 → 成员」中添加对应角色的成员。</div>`
    : `<div class="hint" style="margin-top:8px">选择「保持不变」时保留原负责人；选择「未分配（清空）」才会取消分配。</div>`;
  openModal(`
    <div class="modal-head"><h3>分配任务 · ${esc(t ? t.name : '')}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>标注员</label><select class="select" id="as-assignee">${aOpt.html}</select></div>
      <div class="field"><label>质检员</label><select class="select" id="as-reviewer">${rOpt.html}</select></div>
    </div>${hint}${missing.length ? '<div style="margin-top:10px"><button class="btn ghost sm" id="as-members">管理项目成员</button></div>' : ''}</div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="as-ok">保存</button></div>`, 'sm');
  const mb = $('#as-members');
  if (mb) mb.onclick = () => { closeModal(); projectMembers(pid); };
  $('#as-ok').onclick = async () => {
    const a = $('#as-assignee').value;
    const r = $('#as-reviewer').value;
    try {
      await api(`/api/tasks/${tid}/assign`, {
        method: 'POST',
        body: {
          assignee_id: a === '' ? null : Number(a),
          reviewer_id: r === '' ? null : Number(r),
        },
      });
      closeModal(); toast('任务已分配', 'ok');
      await pageTasks(parseHash().query);
    } catch (err) { toast(err.message, 'err'); }
  };
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
  const isEditing = !!(project && project.modality === 'editing');
  const mediaType = isEditing ? 'editing' : (task.media_type || (task.modality === 'image' ? 'image' : 'audio'));
  const labels = (project && project.labels) || {};
  const payload = (annotation && annotation.payload) || {};
  const pre = (annotation && annotation.prelabel) || {};

  // 统一 wb 结构：audio 和 image 共用头部/侧栏框架
  const classes = isEditing ? ['同类目标'] : (labels['目标类别'] || ['行人', '轿车', '公交车']);
  const wb = {
    task, project, labels, canEdit: can_edit,
    mediaType, mediaName, pre, editing: isEditing,
    media: data.media || [],
    edit: (payload.edit && typeof payload.edit === 'object') ? payload.edit : {},
    // 音频
    segments: (payload.segments && payload.segments.length ? payload.segments : pre.segments || []).map((s) => ({ ...s, events: s.events || [] })),
    // 图片
    boxes: Array.isArray(payload.boxes) && payload.boxes.length
      ? payload.boxes.map((b) => ({
          cls: classes.includes(b.cls) ? b.cls : classes[0],
          name: b.name || '',
          source: b.source || (typeof b.conf === 'number' ? 'ai' : 'manual'),
          auto_cls: b.auto_cls || '',
          conf: b.conf, x: b.x, y: b.y, w: b.w, h: b.h,
          target: !!b.target,
        }))
      : (Array.isArray(pre.boxes) ? pre.boxes.map((b) => ({
          cls: classes.includes(b.cls) ? b.cls : classes[0],
          name: '',
          source: 'ai',
          auto_cls: b.auto_cls || b.cls,
          conf: b.conf, x: b.x, y: b.y, w: b.w, h: b.h,
        })) : []),
    // 图形工具链状态（多边形/关键点/掩码/整图分类）
    polygons: Array.isArray(payload.polygons) ? payload.polygons : [],
    keypoints: Array.isArray(payload.keypoints) ? payload.keypoints : [],
    masks: Array.isArray(payload.masks) ? payload.masks : [],
    imageClass: payload.category || '',
    imgAttrs: payload.attrs || {},
    transcription: payload.transcription || '',
    tool: 'rect',
    brushSize: 18,
    selShape: null,   // {kind:'polygon'|'keypoint'|'mask', index}
    view: { zoom: 1, panX: 0, panY: 0, rot: 0, flip: false },
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
    filter: 'all', selected: -1, activeCls: classes[0],
  };
  state.wb = wb;

  if (mediaType === 'image') {
    renderImageWorkbench(wb, classes, qc);
  } else if (mediaType === 'audio') {
    renderAudioWorkbench(wb, labels, qc, mediaName);
  } else if (window.CK_WORKBENCH && window.CK_WORKBENCH[mediaType]) {
    window.CK_WORKBENCH[mediaType](wb, qc);
  } else {
    renderOtherWorkbench(wb);
  }
}

function renderOtherWorkbench(wb) {
  const { task, project, mediaType, mediaName } = wb;
  const typeLabel = { pointcloud: '点云', video: '视频' }[mediaType] || mediaType;
  const engineUrl = project && project.engine_url;
  const preview = mediaType === 'video' && mediaName
    ? `<video controls src="/media/${encodeURIComponent(mediaName)}" style="width:100%;border-radius:8px;margin-bottom:16px"></video>`
    : '';
  const content = `
  <div class="wb" id="wb">
    <div class="wb-head">
      <a class="btn ghost sm" href="#/tasks">← 返回</a>
      <div><h1>${esc(task.name)}</h1>
        <div class="wb-meta">${esc(project ? project.name : '')} · <span class="tag">${typeLabel}</span> ${statusChip(task.status)}</div></div>
    </div>
    <div class="card" style="padding:28px;max-width:720px;margin:24px auto">
      ${preview}
      <div class="empty" style="text-align:center">
        <b>暂不支持在线标注（${typeLabel}）</b>
        <p class="hint" style="margin-top:10px;line-height:1.8">
          ${mediaName ? `已挂载媒体：${esc(mediaName)}<br/>` : '该任务还没有上传媒体文件。<br/>'}
          内置工作台已覆盖 语音 / 图片 / 视频 / 文本 / 点云 / 大模型 / 多模态 / PDF / 图像编辑指令，
          当前任务类型未匹配到对应工作台，请在对应引擎中完成或联系管理员配置。
        </p>
        <div style="margin-top:16px">
          <button class="btn sm" id="btn-other-upload" ${wb.canEdit ? '' : 'disabled'}>${icon('upload')} ${mediaName ? '更换文件' : `上传${typeLabel}文件`}</button>
          <input type="file" id="other-file-input" hidden accept="${mediaType === 'pointcloud' ? '.pcd,.ply,.bin,.las,.laz' : 'video/*'}" />
        </div>
        ${engineUrl
          ? `<a class="btn primary" href="${esc(engineUrl)}" target="_blank" rel="noopener" style="margin-top:16px">打开 ${esc(project.engine || '标注引擎')} →</a>`
          : '<div class="hint" style="margin-top:12px">该项目未配置外部标注引擎地址。</div>'}
      </div>
      <div class="panel-section" style="margin-top:20px">
        <div class="panel-label">任务信息</div>
        <div class="kv"><span>项目</span><b>${esc(project ? project.name : '')}</b></div>
        <div class="kv"><span>批次</span><b>${esc(task.batch || '—')}</b></div>
        <div class="kv"><span>标注员</span><b>${esc(task.assignee_name || '未分配')}</b></div>
      </div>
    </div>
  </div>`;
  mount('tasks', '标注工作台', content);
  const btn = $('#btn-other-upload');
  if (btn) {
    const input = $('#other-file-input');
    btn.onclick = () => input.click();
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      toast('正在上传…');
      try {
        await api(`/api/tasks/${wb.task.id}/media`, { method: 'POST', body: fd });
        toast('文件已上传', 'ok');
        setTimeout(() => pageAnnotate(wb.task.id), 400);
      } catch (err) { toast(err.message, 'err'); }
    };
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
            <button class="btn sm" id="btn-upload" style="margin-top:10px" ${canEdit ? '' : 'disabled'}>${icon('upload')} ${mediaName ? '更换音频' : '上传音频'}</button>
            <input type="file" id="file-input" accept="audio/*" hidden />
            ${mediaName ? '' : '<div class="hint" style="margin-top:6px">该任务暂无音频，请先上传。</div>'}
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
            <div class="panel-section">
              <div class="panel-label">标注规范</div>
              <div id="spec-panel"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  mount('tasks', '标注工作台', content);
  if (mediaName) loadAudio(`/media/${encodeURIComponent(mediaName)}`, wb);
  bindWorkbench(wb, mediaName);
  mountSpecPanel(task, project, $('#spec-panel'));
}

function renderImageWorkbench(wb, classes, qc) {
  const { task, project, canEdit, mediaName, boxes, pre } = wb;
  const lastPrelabel = pre && pre.engine
    ? `${pre.engine} · ${pre.boxes?.length || 0} 框${pre.elapsed_ms ? ` · ${(pre.elapsed_ms / 1000).toFixed(1)}s` : ''}`
    : '—';
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
            <div class="seg-tabs" id="img-tools" style="flex-wrap:wrap">
              ${[
                ['rect', '矩形', 'R'], ['poly', '多边形', 'P'], ['circle', '圆形', 'C'], ['free', '自由', 'L'],
                ['brush', '画笔', 'B'], ['fill', '填充', 'G'], ['keypoint', '关键点', 'K'], ['pan', '平移', 'V'],
              ].map(([k, label, key]) => `<button class="img-tool ${k === 'rect' ? 'active' : ''}" data-tool="${k}" title="快捷键 ${key}">${label}</button>`).join('')}
            </div>
            <span class="hint" id="tool-hint">拖拽画框</span>
            <span class="spacer"></span>
            <label class="toggle-wrap" title="笔刷大小"><input type="range" id="brush-size" min="4" max="60" value="18" style="width:70px" /></label>
            <button class="btn sm ghost" id="btn-zoom-out">−</button>
            <button class="btn sm ghost" id="btn-zoom-in">＋</button>
            <button class="btn sm ghost" id="btn-rotate" title="旋转 90°(T)">旋转</button>
            <button class="btn sm ghost" id="btn-flip" title="水平镜像(F)">镜像</button>
            <button class="btn sm ghost" id="btn-compare" title="多图并列对比">对比</button>
            <button class="btn sm ghost" id="btn-img-upload" ${canEdit ? '' : 'disabled'}>${icon('upload')} ${mediaName ? '更换图片' : '上传图片'}</button>
            <input type="file" id="img-file-input" accept="image/*" hidden />
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
          <div class="card-head"><h3 class="card-title">识别结果</h3>
            <span class="card-sub" id="box-sub">${boxes.length} 个目标 · ${boxStats(wb).length} 类</span>
            <button class="btn sm ghost" id="btn-export-boxes" ${boxes.length ? '' : 'disabled'}>${icon('download')} 导出 CSV</button>
          </div>
          <div class="box-tools" id="box-tools">${boxTools(wb)}</div>
          <div id="name-datalists" style="display:contents">${nameDatalistsHTML(wb)}</div>
          <div class="box-list" id="box-list">${boxHead()}${boxRows(wb)}</div>
        </div>
      </div>
      <div class="col" style="min-height:0">
        <div class="side-panel" style="flex:1">
          <div class="panel-head">${icon('spark')} AI 预识别</div>
          <div class="panel-body">
            <div class="ai-card">
              <b>${icon('box')} Grounding DINO 本地检测</b>
              <p>零样本开放词汇 · 纯 CPU · 首次加载后 ~7s/次<br/>中文业务类 → 英文 prompt 检测 → 自动回填中文类别</p>
              <div class="ai-actions">
                <button class="btn sm primary" id="btn-img-prelabel" ${canEdit && mediaName ? '' : 'disabled'}>开始预识别</button>
              </div>
              <div class="hint" style="margin-top:8px">上次：${lastPrelabel}</div>
            </div>
            <div class="panel-section" id="result-panel">${resultPanelHTML(wb)}</div>
            <div class="panel-section">
              <div class="panel-label">筛选 / 画框与图形类别</div>
              <div class="cls-picker" id="cls-picker">${clsPickerHTML(wb)}</div>
              <div class="hint" style="margin-top:6px">点类别只显示该类目标；在图片上拖拽时按当前选中类别画框 / 图形。</div>
            </div>
            <div class="panel-section">
              <div class="panel-label">图形标注（多边形 / 关键点 / 分割实例）</div>
              <div class="filters" style="margin-bottom:6px">
                <input class="input" id="kp-label-input" placeholder="关键点名称，如 左眼" style="width:140px" />
                <span class="hint">Alt+涂抹=橡皮擦</span>
              </div>
              <div id="shape-list">${shapeListHTML(wb)}</div>
              <div class="filters" style="margin-top:6px">
                <button class="btn sm ghost" id="btn-shape-merge" title="勾选两个及以上多边形合并">合并</button>
                <button class="btn sm ghost" id="btn-shape-split" title="选中多边形在指定顶点拆分">拆分</button>
                <button class="btn sm ghost" id="btn-kp-copy" title="复刻上一组关键点">复刻关键点</button>
              </div>
            </div>
            <div class="panel-section">
              <div class="panel-label">整图分类与场景属性</div>
              <div class="field"><label>图片分类（层级，如 交通/路口）</label><input class="input" id="img-category" value="${esc(wb.imageClass)}" placeholder="交通/路口" /></div>
              <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:6px">
                <div class="field" style="margin:0"><label>天气</label><select class="select" id="img-attr-weather">${['', '晴', '阴', '雨', '雪', '雾'].map((x) => `<option ${wb.imgAttrs.weather === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
                <div class="field" style="margin:0"><label>时间段</label><select class="select" id="img-attr-daytime">${['', '白天', '黄昏', '夜间'].map((x) => `<option ${wb.imgAttrs.daytime === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
                <div class="field" style="margin:0"><label>场景</label><select class="select" id="img-attr-scene">${['', '路口', '路段', '高架', '广场', '停车场'].map((x) => `<option ${wb.imgAttrs.scene === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
              </div>
            </div>
            <div class="panel-section">
              <div class="panel-label">标注规范</div>
              <div id="spec-panel"></div>
            </div>
            <div class="panel-section">
              <div class="panel-label">OCR 转写校对（对照图片录入文字，疑似错误高亮）</div>
              <textarea class="input textarea" id="ocr-transcript" rows="4" placeholder="对照左侧图片录入文字内容，点击「校对」检查错别字/标点/语法">${esc(wb.transcription || '')}</textarea>
              <div class="filters" style="margin-top:6px">
                <button class="btn sm" id="btn-ocr-check">校对</button>
                <span class="hint" id="ocr-check-stat"></span>
              </div>
              <div id="ocr-check-out" style="margin-top:6px"></div>
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

/* ------------ 图片结果：统计 / 筛选 / 结构化展示 ------------ */
function clsOptions(wb) {
  const base = (wb.labels['目标类别'] || ['商品主体']).slice();
  wb.boxes.forEach((b) => { if (b.cls && !base.includes(b.cls)) base.push(b.cls); });
  return base;
}

function boxStats(wb) {
  const map = new Map();
  wb.boxes.forEach((b) => {
    const s = map.get(b.cls) || { cls: b.cls, n: 0, confSum: 0, confN: 0, area: 0 };
    s.n += 1;
    s.area += (b.w || 0) * (b.h || 0);
    if (typeof b.conf === 'number') { s.confSum += b.conf; s.confN += 1; }
    map.set(b.cls, s);
  });
  const order = wb.labels['目标类别'] || [];
  return Array.from(map.values()).sort((a, b) => {
    const ia = order.indexOf(a.cls), ib = order.indexOf(b.cls);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || b.n - a.n;
  });
}

function visibleIndexes(wb) {
  const f = wb.filter || 'all';
  return wb.boxes.map((b, i) => (f === 'all' || b.cls === f ? i : -1)).filter((i) => i >= 0);
}

function nameDatalistsHTML(wb) {
  return clsOptions(wb).map((c) => {
    const opts = nameSuggestOf(c);
    if (!opts.length) return '';
    return `<datalist id="${sugId(wb, c)}">${opts.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
  }).join('');
}

function boxHead() {
  return `<div class="box-thead"><span>编号</span><span>名称（可下拉选择）</span><span>类型</span><span>坐标 X,Y</span><span>尺寸 W×H</span><span>置信度</span><span>来源</span><span></span></div>`;
}

function boxRowHTML(wb, b, i) {
  const conf = typeof b.conf === 'number' ? b.conf : null;
  const sel = wb.selected === i;
  return `<div class="box-row ${b.auto_cls ? 'auto' : ''} ${sel ? 'sel' : ''}" data-i="${i}">
    <span class="box-idx"><i class="bdot" style="background:${boxColor(b.cls)}"></i>#${String(i + 1).padStart(2, '0')}</span>
    <input class="box-name" data-f="name" value="${esc(b.name || '')}" placeholder="${esc(b.cls)}" list="${sugId(wb, b.cls)}" title="点击选择或输入名称" />
    <select class="box-cls" data-f="cls">${clsOptions(wb).map((x) => `<option ${x === b.cls ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    <span class="box-pos">${(b.x * 100).toFixed(1)}, ${(b.y * 100).toFixed(1)}</span>
    <span class="box-size">${(b.w * 100).toFixed(1)}×${(b.h * 100).toFixed(1)}</span>
    <span class="box-conf">${conf == null
      ? '<em>—</em>'
      : `<span class="cbar"><i style="width:${Math.round(conf * 100)}%"></i></span>${Math.round(conf * 100)}%`}</span>
    <span class="box-src ${conf == null ? 'human' : 'ai'}">${conf == null ? '人工' : 'AI'}</span>
    <button class="box-del" data-del="${i}" title="删除">${icon('x')}</button>
  </div>`;
}

function boxRows(wb) {
  const total = wb.boxes.length;
  if (!total) return '<div class="empty"><b>还没有标注框</b>在图片上拖拽画第一个矩形，或先让 AI 预识别</div>';
  const filter = wb.filter || 'all';
  const groups = boxStats(wb).filter((s) => filter === 'all' || s.cls === filter);
  if (!groups.length) {
    return `<div class="empty"><b>「${esc(filter)}」暂无目标</b>切换上方筛选查看其他类别</div>`;
  }
  return groups.map((g) => {
    const rows = wb.boxes.map((b, i) => ({ b, i })).filter(({ b }) => b.cls === g.cls);
    return `<div class="box-group">
        <i style="background:${boxColor(g.cls)}"></i><b>${esc(g.cls)}</b>
        <span class="bg-n">${g.n} 个</span>
        ${g.confN ? `<span>平均置信度 ${Math.round((g.confSum / g.confN) * 100)}%</span>` : '<span>人工标注</span>'}
        <span class="spacer"></span>
        <span>画面占比 ${(g.area * 100).toFixed(1)}%</span>
      </div>
      ${rows.map(({ b, i }) => boxRowHTML(wb, b, i)).join('')}`;
  }).join('');
}

function boxTools(wb) {
  const total = wb.boxes.length;
  const filter = wb.filter || 'all';
  const stats = boxStats(wb);
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
      <button class="fchip ${filter === 'all' ? 'on' : ''}" data-filter="all">全部 <b>${total}</b></button>
      ${stats.map((s) => `<button class="fchip ${filter === s.cls ? 'on' : ''}" data-filter="${esc(s.cls)}"><i style="background:${boxColor(s.cls)}"></i>${esc(s.cls)} <b>${s.n}</b></button>`).join('')}
    </div>
    <span class="spacer"></span>
    <span class="box-count">显示 ${visibleIndexes(wb).length} / ${total}</span>`;
}

function exportBoxes(wb) {
  if (!wb.boxes.length) return toast('当前没有可导出的结果', 'warn');
  const head = ['目标编号', '名称', '类型', '来源', '置信度%', '坐标X%', '坐标Y%', '宽%', '高%', '中心X%', '中心Y%', '面积占比%', '画面分区', '检测短语'];
  const rows = wb.boxes.map((b, i) => {
    const cx = ((b.x || 0) + (b.w || 0) / 2) * 100;
    const cy = ((b.y || 0) + (b.h || 0) / 2) * 100;
    return [
      `#${String(i + 1).padStart(2, '0')}`, b.name || '', b.cls, typeof b.conf === 'number' ? 'AI' : '人工',
      typeof b.conf === 'number' ? Math.round(b.conf * 100) : '',
      ((b.x || 0) * 100).toFixed(1), ((b.y || 0) * 100).toFixed(1),
      ((b.w || 0) * 100).toFixed(1), ((b.h || 0) * 100).toFixed(1),
      cx.toFixed(1), cy.toFixed(1), ((b.w || 0) * (b.h || 0) * 100).toFixed(2),
      `${cx < 40 ? '左' : cx > 60 ? '右' : '中'}·${cy < 40 ? '上' : cy > 66 ? '下' : '中'}`,
      b.auto_cls || '',
    ];
  });
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `识别结果-${wb.task.name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`已导出 ${wb.boxes.length} 条结构化结果`, 'ok');
}

function clsPickerHTML(wb) {
  const filter = wb.filter || 'all';
  return `<button class="cls-btn ${filter === 'all' ? 'on' : ''}" data-filter="all">全部 <b>${wb.boxes.length}</b></button>
    ${clsOptions(wb).map((c) => {
      const n = wb.boxes.filter((b) => b.cls === c).length;
      return `<button class="cls-btn ${filter === c ? 'on' : ''}" data-filter="${esc(c)}" style="--cc:${boxColor(c)}"><i></i>${esc(c)} <b>${n}</b></button>`;
    }).join('')}`;
}

function detailHTML(b, i, wb) {
  const cx = ((b.x || 0) + (b.w || 0) / 2) * 100;
  const cy = ((b.y || 0) + (b.h || 0) / 2) * 100;
  const conf = typeof b.conf === 'number' ? Math.round(b.conf * 100) : null;
  const region = `${cx < 40 ? '左' : cx > 60 ? '右' : '中'}·${cy < 40 ? '上' : cy > 66 ? '下' : '中'}`;
  return `
    <div class="detail-head">
      <span class="box-no">目标 #${String(i + 1).padStart(2, '0')}</span>
      <span class="spacer"></span>
      <span class="src-badge ${conf == null ? 'human' : 'ai'}">${conf == null ? '人工' : 'AI'}</span>
    </div>
    <div class="detail-field"><label>目标名称</label>
      <input class="detail-name" data-i="${i}" value="${esc(b.name || '')}" placeholder="${esc(b.cls)}（可选择或输入）" list="${sugId(wb, b.cls)}" /></div>
    <div class="detail-field"><label>目标类型</label>
      <select class="detail-cls" data-i="${i}">${clsOptions(wb).map((x) => `<option ${x === b.cls ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    <div class="detail-grid">
      <div><span>置信度</span><b>${conf == null ? '—' : conf + '%'}</b></div>
      <div><span>画面分区</span><b>${region}</b></div>
      <div><span>坐标 X / Y</span><b class="mono">${((b.x || 0) * 100).toFixed(1)}% / ${((b.y || 0) * 100).toFixed(1)}%</b></div>
      <div><span>尺寸 W × H</span><b class="mono">${((b.w || 0) * 100).toFixed(1)}% × ${((b.h || 0) * 100).toFixed(1)}%</b></div>
      <div><span>中心点</span><b class="mono">${cx.toFixed(1)}% / ${cy.toFixed(1)}%</b></div>
      <div><span>面积占比</span><b>${((b.w || 0) * (b.h || 0) * 100).toFixed(1)}%</b></div>
    </div>
    ${b.auto_cls ? `<div class="detail-auto"><span>检测短语</span><code title="${esc(b.auto_cls)}">${esc(b.auto_cls)}</code></div>` : ''}
    ${conf == null ? '' : `<div class="conf-meter"><i style="width:${conf}%;background:${boxColor(b.cls)}"></i></div>`}`;
}

function resultPanelHTML(wb) {
  const total = wb.boxes.length;
  if (!total) {
    return `<div class="panel-label">识别结果</div>
      <div class="hint" style="line-height:1.8">暂无结果。点「开始预识别」用 Grounding DINO 自动检出，或在图片上拖拽手动画框。</div>`;
  }
  const stats = boxStats(wb);
  const ai = wb.boxes.filter((b) => typeof b.conf === 'number').length;
  const max = Math.max(...stats.map((s) => s.n));
  const filter = wb.filter || 'all';
  const selIdx = wb.selected >= 0 && wb.boxes[wb.selected] ? wb.selected : -1;
  const prods = wb.boxes.filter((b) => b.cls === '商品主体');
  return `
    <div class="panel-label">识别结果概览</div>
    <div class="res-kpi">
      <div><b>${total}</b><span>目标总数</span></div>
      <div><b>${stats.length}</b><span>类别数</span></div>
      <div><b>${ai}</b><span>AI 检出</span></div>
      <div><b>${total - ai}</b><span>人工补框</span></div>
    </div>
    <div class="panel-label" style="margin-top:12px">类别分布 · 点击筛选</div>
    <div class="dist-list">
      ${stats.map((s) => `<div class="dist-row ${filter === s.cls ? 'on' : ''}" data-filter="${esc(s.cls)}" title="只看 ${esc(s.cls)}">
        <i style="background:${boxColor(s.cls)}"></i>
        <span class="dist-name">${esc(s.cls)}</span>
        <span class="dist-bar"><i style="width:${Math.max(6, (s.n / max) * 100)}%;background:${boxColor(s.cls)}"></i></span>
        <b>${s.n}</b></div>`).join('')}
    </div>
    ${prods.length ? `<div class="panel-label" style="margin-top:12px">商品分层分布</div>
      ${['上部', '中部', '下部'].map((name, k) => {
        const n = prods.filter((b) => bandOf(b) === k).length;
        return `<div class="band-row"><span style="min-width:26px">${name}</span>
          <span class="band-bar"><i style="width:${(n / prods.length) * 100}%"></i></span><b class="mono">${n}</b></div>`;
      }).join('')}` : ''}
    <div class="panel-label" style="margin-top:12px">选中目标详情</div>
    ${selIdx >= 0 ? detailHTML(wb.boxes[selIdx], selIdx, wb)
      : '<div class="hint">点击列表中的行或图片上的目标框，查看置信度、坐标、尺寸等结构化信息。</div>'}`;
}

function setFilter(wb, cls) {
  const next = cls && cls !== 'all' ? cls : 'all';
  wb.filter = next;
  if (next !== 'all') wb.activeCls = next;
  if (wb.selected >= 0 && next !== 'all' && wb.boxes[wb.selected] && wb.boxes[wb.selected].cls !== next) {
    wb.selected = -1;
  }
  refreshBoxUI(wb);
  drawImageBoxes(wb);
}

function selectBox(wb, i) {
  wb.selected = wb.selected === i ? -1 : i;
  const list = $('#box-list');
  if (list) {
    list.querySelectorAll('.box-row').forEach((el) => el.classList.toggle('sel', Number(el.dataset.i) === wb.selected));
    const row = list.querySelector(`.box-row[data-i="${wb.selected}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
  }
  const rp = $('#result-panel');
  if (rp) rp.innerHTML = resultPanelHTML(wb);
  drawImageBoxes(wb);
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
        <select class="seg-lang" data-f="lang" title="语种">${['中文', '英文', '日语', '粤语', '混合', '其他'].map((x) => `<option ${(s.lang || '中文') === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <select class="seg-emo" data-f="emotion" title="情绪">${emotions.map((x) => `<option ${x === s.emotion ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <input class="seg-int" data-f="emo_intensity" type="number" min="1" max="5" value="${Number(s.emo_intensity) || 3}" title="情绪强度 1-5" />
        ${events.length ? `<select class="seg-evt" data-f="event" title="添加事件"><option value="">+ 事件</option>${events.filter((x) => !evs.includes(x)).map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : ''}
        <button class="seg-del" data-del="${i}" title="删除该段">${icon('x')}</button>
      </div>
      <textarea class="seg-text" data-f="text" rows="2" placeholder="转写文本…">${esc(s.text)}</textarea>
      <div class="seg-pron-row">
        <select data-f="pron_type" title="发音问题类型">${['无', '错读', '漏读', '多读', '声调错误'].map((x) => `<option ${(s.pron_type || '无') === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <input data-f="pron_note" value="${esc(s.pron_note || '')}" placeholder="发音校对说明，如：声调应读二声" />
      </div>
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

  // 类别筛选：右侧类别按钮、类别分布、左侧筛选条共用同一状态
  const applyFilter = (cls) => setFilter(wb, cls);
  const picker = $('#cls-picker');
  if (picker) picker.onclick = (e) => { const b = e.target.closest('[data-filter]'); if (b) applyFilter(b.dataset.filter); };
  const tools = $('#box-tools');
  if (tools) tools.onclick = (e) => { const b = e.target.closest('[data-filter]'); if (b) applyFilter(b.dataset.filter); };
  const rp = $('#result-panel');
  if (rp) {
    rp.onclick = (e) => { const b = e.target.closest('[data-filter]'); if (b) applyFilter(b.dataset.filter); };
    rp.oninput = (e) => {
      if (!e.target.classList.contains('detail-name')) return;
      const i = Number(e.target.dataset.i);
      if (!wb.boxes[i]) return;
      wb.boxes[i].name = e.target.value;
      const row = $(`#box-list .box-row[data-i="${i}"] input.box-name`);
      if (row) row.value = e.target.value;
      markDirty(wb); drawImageBoxes(wb);
    };
    rp.onchange = (e) => {
      if (!e.target.classList.contains('detail-cls')) return;
      const i = Number(e.target.dataset.i);
      if (!wb.boxes[i]) return;
      wb.boxes[i].cls = e.target.value;
      markDirty(wb);
      refreshBoxUI(wb);
      drawImageBoxes(wb);
    };
  }

  // 视图变换（缩放/平移/旋转/镜像）：screen = pan ∘ rot ∘ flip ∘ zoom ∘ (p-0.5) + 0.5
  const applyViewCSS = () => {
    const v = wb.view;
    imgEl.style.transformOrigin = '50% 50%';
    imgEl.style.transform = `translate(${v.panX * 100}%, ${v.panY * 100}%) rotate(${v.rot}deg) scaleX(${v.flip ? -1 : 1}) scale(${v.zoom})`;
    drawImageBoxes(wb);
  };
  const rotFwd = (x, y, rot) => {
    for (let i = 0; i < ((rot / 90) % 4 + 4) % 4; i++) { const t = x; x = -y; y = t; }
    return [x, y];
  };
  const rotInv = (x, y, rot) => {
    for (let i = 0; i < ((rot / 90) % 4 + 4) % 4; i++) { const t = x; x = y; y = -t; }
    return [x, y];
  };
  const viewToImage = (q) => {
    const v = wb.view;
    let x = (q.x - 0.5 - v.panX) / v.zoom, y = (q.y - 0.5 - v.panY) / v.zoom;
    [x, y] = rotInv(x, y, v.rot);
    if (v.flip) x = -x;
    return { x: x + 0.5, y: y + 0.5 };
  };
  const imageToView = (p) => {
    const v = wb.view;
    let x = p.x - 0.5, y = p.y - 0.5;
    if (v.flip) x = -x;
    [x, y] = rotFwd(x, y, v.rot);
    return { x: x * v.zoom + 0.5 + v.panX, y: y * v.zoom + 0.5 + v.panY };
  };
  wb._view = { applyViewCSS, viewToImage, imageToView };

  // 拖拽绘制（工具路由：以 canvas 实际显示区域为坐标系，经视图逆变换得到图片坐标）
  const getPos = (e) => {
    const rect = cvs.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(-0.2, Math.min(1.2, x)), y: Math.max(-0.2, Math.min(1.2, y)) };
  };
  const getImgPos = (e) => viewToImage(getPos(e));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const setTool = (t) => {
    wb.tool = t;
    $$('#img-tools .img-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    const hints = {
      rect: '拖拽画矩形框', poly: '点击加点，双击或点起点闭合', circle: '按住拖出圆形',
      free: '按住绘制自由曲线', brush: '涂抹生成分割实例', fill: '点击填充封闭区域',
      keypoint: '点击添加关键点（自动连线）', pan: '拖拽平移画布（滚轮缩放）',
    };
    const h = $('#tool-hint'); if (h) h.textContent = hints[t] || '';
    cvs.style.cursor = t === 'pan' ? 'grab' : 'crosshair';
  };
  wb._setTool = setTool;

  // 掩码层管理：每个实例一张位图，编辑后回写 png dataURL；渲染时按类别着色
  const maskCanvasCache = new Map();
  wb._maskCanvases = maskCanvasCache;
  wb._maskTinted = new Map();
  const refreshTint = (idx) => {
    const c = maskCanvasCache.get(idx);
    if (!c) return;
    const t = document.createElement('canvas');
    t.width = c.width; t.height = c.height;
    const tx = t.getContext('2d');
    tx.drawImage(c, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = boxColor(wb.masks[idx].label);
    tx.fillRect(0, 0, t.width, t.height);
    wb._maskTinted.set(idx, t);
  };
  const maskDims = () => {
    const w = 384;
    const h = wb.imgW && wb.imgH ? Math.round(384 * wb.imgH / wb.imgW) : 216;
    return { w, h };
  };
  const maskOf = (idx) => {
    if (maskCanvasCache.has(idx)) return maskCanvasCache.get(idx);
    const m = wb.masks[idx];
    const { w, h } = maskDims();
    const c = document.createElement('canvas'); c.width = m.w || w; c.height = m.h || h;
    const x = c.getContext('2d');
    if (m.png) {
      const im = new Image();
      im.onload = () => { x.drawImage(im, 0, 0); refreshTint(idx); drawImageBoxes(wb); };
      im.src = m.png;
    } else refreshTint(idx);
    maskCanvasCache.set(idx, c);
    return c;
  };
  const commitMask = (idx) => {
    const c = maskCanvasCache.get(idx);
    if (!c) return;
    wb.masks[idx].png = c.toDataURL('image/png');
    wb.masks[idx].w = c.width; wb.masks[idx].h = c.height;
    refreshTint(idx);
    markDirty(wb);
  };
  const activeMaskIdx = () => {
    // 同一类别取最后一个实例继续涂抹；没有则新建
    const cls = wb.activeCls;
    for (let i = wb.masks.length - 1; i >= 0; i--) if (wb.masks[i].label === cls) { maskOf(i); return i; }
    wb.masks.push({ label: cls, w: 0, h: 0, png: '' });
    const i = wb.masks.length - 1;
    maskOf(i); refreshTint(i);
    refreshShapeUI(wb);
    return i;
  };
  const paintMask = (idx, imgP, erase) => {
    const c = maskOf(idx);
    const x = c.getContext('2d');
    const r = wb.brushSize / 2;
    x.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(imgP.x * c.width, imgP.y * c.height, Math.max(1.5, r * c.width / (wb.imgW || c.width)), 0, Math.PI * 2);
    x.fill();
    drawImageBoxes(wb);
  };
  const floodMask = (idx, imgP) => {
    const c = maskOf(idx);
    const x = c.getContext('2d');
    const { w, h } = c;
    const src = x.getImageData(0, 0, w, h);
    const dst = x.createImageData(w, h);
    dst.data.set(src.data);
    const si = x.getImageData(0, 0, w, h).data;
    const sx = Math.round(imgP.x * w), sy = Math.round(imgP.y * h);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    const start = (sy * w + sx) * 4;
    const tr = si[start], tg = si[start + 1], tb = si[start + 2], ta = si[start + 3];
    const match = (i) => Math.abs(si[i] - tr) < 12 && Math.abs(si[i + 1] - tg) < 12 && Math.abs(si[i + 2] - tb) < 12 && Math.abs(si[i + 3] - ta) < 12;
    const q = [sx + sy * w];
    const seen = new Uint8Array(w * h);
    while (q.length) {
      const p = q.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      if (!match(i)) continue;
      dst.data[i] = 255; dst.data[i + 1] = 255; dst.data[i + 2] = 255; dst.data[i + 3] = 255;
      const px = p % w, py = (p / w) | 0;
      if (px > 0) q.push(p - 1);
      if (px < w - 1) q.push(p + 1);
      if (py > 0) q.push(p - w);
      if (py < h - 1) q.push(p + w);
    }
    x.putImageData(dst, 0, 0);
    drawImageBoxes(wb);
  };

  // 多边形顶点命中（图片坐标）
  const hitVertex = (imgP, pts) => pts.findIndex(([x, y]) => Math.hypot(imgP.x - x, imgP.y - y) < 0.012);
  const simplifyPath = (pts, eps = 0.004) => {
    if (pts.length < 4) return pts;
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let dmax = 0, idx = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const len = Math.hypot(bx - ax, by - ay) || 1e-6;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((pts[i][0] - ax) * (by - ay) - (pts[i][1] - ay) * (bx - ax)) / len;
        if (d > dmax) { dmax = d; idx = i; }
      }
      if (dmax > eps && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };

  let dragStart = null;      // 图片坐标（rect/circle 起点）
  let dragStartView = null;  // 屏幕坐标（pan 用）
  let dragKind = null;       // rect | circle | free | pan | poly-vertex | brush | kp
  let freePath = null;
  let brushErase = false;
  cvs.addEventListener('mousedown', (e) => {
    if (!wb.canEdit) return;
    if (e.button !== 0 && !(wb.tool === 'pan' && e.button === 0)) return;
    const sp = getPos(e);
    const p = viewToImage(sp);
    const T = wb.tool;
    if (T === 'pan' || e.button === 1) {
      dragKind = 'pan'; dragStartView = sp; cvs.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    if (T === 'rect') {
      // 命中已有目标 → 选中并高亮（删除走列表按钮或 Delete 键），按住 Shift 可叠加画新框
      const hit = visibleIndexes(wb).find((i) => {
        const b = wb.boxes[i];
        return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      });
      if (hit !== undefined && !e.shiftKey) { selectBox(wb, hit); return; }
      dragStart = p; dragKind = 'rect'; wb._dragging = true;
      return;
    }
    if (T === 'poly') {
      const draft = wb._polyDraft || (wb._polyDraft = []);
      // 拖拽已有顶点
      const target = wb.selShape && wb.selShape.kind === 'polygon' ? wb.polygons[wb.selShape.index] : null;
      if (target) {
        const vi = hitVertex(p, target.points);
        if (vi >= 0) { dragKind = 'poly-vertex'; dragStart = { poly: target, vi }; return; }
      }
      if (draft.length && Math.hypot(p.x - draft[0][0], p.y - draft[0][1]) < 0.012 && draft.length >= 3) {
        finishPolygon();
        return;
      }
      draft.push([clamp01(p.x), clamp01(p.y)]);
      drawImageBoxes(wb);
      return;
    }
    if (T === 'circle') { dragStart = p; dragKind = 'circle'; wb._dragCircle = { cx: p.x, cy: p.y, r: 0 }; return; }
    if (T === 'free') { dragStart = p; dragKind = 'free'; freePath = [[p.x, p.y]]; wb._freeLive = freePath; return; }
    if (T === 'brush') {
      dragKind = 'brush'; brushErase = e.altKey;
      paintMask(activeMaskIdx(), p, brushErase);
      markDirty(wb);
      return;
    }
    if (T === 'fill') {
      const idx = activeMaskIdx();
      floodMask(idx, p);
      commitMask(idx);
      return;
    }
    if (T === 'keypoint') {
      // 命中已有关键点可拖拽
      const ki = wb.keypoints.findIndex((k) => Math.hypot(p.x - k.x, p.y - k.y) < 0.012);
      if (ki >= 0) { dragKind = 'kp'; dragStart = { ki }; return; }
      const label = ($('#kp-label-input') && $('#kp-label-input').value.trim()) || `P${wb.keypoints.length + 1}`;
      wb.keypoints.push({ x: clamp01(p.x), y: clamp01(p.y), label, visibility: 2 });
      refreshShapeUI(wb); drawImageBoxes(wb); markDirty(wb);
      return;
    }
  });
  const finishPolygon = () => {
    const draft = wb._polyDraft || [];
    if (draft.length >= 3) {
      wb.polygons.push({ label: wb.activeCls, points: draft.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]) });
      wb.selShape = { kind: 'polygon', index: wb.polygons.length - 1 };
      markDirty(wb);
      refreshShapeUI(wb);
    }
    wb._polyDraft = null;
    drawImageBoxes(wb);
  };
  cvs.addEventListener('dblclick', () => { if (wb.tool === 'poly' && wb._polyDraft && wb._polyDraft.length >= 3) finishPolygon(); });
  cvs.addEventListener('mousemove', (e) => {
    const sp = getPos(e);
    if (dragKind === 'pan') {
      const dx = sp.x - dragStartView.x, dy = sp.y - dragStartView.y;
      wb.view.panX += dx; wb.view.panY += dy;
      dragStartView = sp;
      applyViewCSS();
      return;
    }
    const p = viewToImage(sp);
    if (dragKind === 'rect' && wb._dragging) {
      wb._dragRect = {
        x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y),
      };
      drawImageBoxes(wb);
      return;
    }
    if (dragKind === 'circle' && wb._dragCircle) {
      wb._dragCircle.r = Math.hypot(p.x - dragStart.x, p.y - dragStart.y);
      drawImageBoxes(wb);
      return;
    }
    if (dragKind === 'free' && freePath) {
      freePath.push([p.x, p.y]);
      drawImageBoxes(wb);
      return;
    }
    if (dragKind === 'brush') {
      paintMask(activeMaskIdx(), p, brushErase);
      return;
    }
    if (dragKind === 'poly-vertex' && dragStart) {
      dragStart.poly.points[dragStart.vi] = [clamp01(p.x), clamp01(p.y)];
      drawImageBoxes(wb);
      return;
    }
    if (dragKind === 'kp' && dragStart) {
      wb.keypoints[dragStart.ki].x = clamp01(p.x);
      wb.keypoints[dragStart.ki].y = clamp01(p.y);
      drawImageBoxes(wb);
      return;
    }
  });
  window.addEventListener('mouseup', () => {
    if (dragKind === 'pan') { dragKind = null; cvs.style.cursor = 'grab'; return; }
    if (dragKind === 'brush') { const idx = activeMaskIdx(); commitMask(idx); dragKind = null; return; }
    if (dragKind === 'circle' && wb._dragCircle) {
      const { cx, cy, r } = wb._dragCircle;
      wb._dragCircle = null;
      if (r > 0.008) {
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pts.push([Math.round((cx + r * Math.cos(a)) * 1e4) / 1e4, Math.round((cy + r * Math.sin(a)) * 1e4) / 1e4]);
        }
        wb.polygons.push({ label: wb.activeCls, shape: 'circle', cx: Math.round(cx * 1e4) / 1e4, cy: Math.round(cy * 1e4) / 1e4, r: Math.round(r * 1e4) / 1e4, points: pts });
        markDirty(wb); refreshShapeUI(wb);
      }
      drawImageBoxes(wb);
      dragKind = null;
      return;
    }
    if (dragKind === 'free' && freePath) {
      const pts = simplifyPath(freePath);
      freePath = null;
      wb._freeLive = null;
      if (pts.length >= 3) {
        wb.polygons.push({ label: wb.activeCls, points: pts.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]) });
        markDirty(wb); refreshShapeUI(wb);
      }
      drawImageBoxes(wb);
      dragKind = null;
      return;
    }
    if (dragKind === 'poly-vertex' || dragKind === 'kp') {
      markDirty(wb); refreshShapeUI(wb);
      dragKind = null;
      return;
    }
    dragKind = null;
    if (!wb._dragging) return;
    wb._dragging = false;
    const r = wb._dragRect;
    wb._dragRect = null;
    drawImageBoxes(wb);
    if (r && r.w > 0.005 && r.h > 0.005) {
      wb.boxes.push({ cls: wb.activeCls || (wb.labels['目标类别'] || classes)[0], name: '', source: 'manual', ...r });
      wb.selected = wb.boxes.length - 1;
      refreshBoxUI(wb); drawImageBoxes(wb); markDirty(wb);
    }
  });

  // 工具栏与视图控制
  const toolsBar = $('#img-tools');
  if (toolsBar) toolsBar.onclick = (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) setTool(b.dataset.tool);
  };
  $('#brush-size').oninput = (e) => { wb.brushSize = Number(e.target.value) || 18; };
  const zoomBy = (f) => {
    wb.view.zoom = Math.max(0.25, Math.min(8, wb.view.zoom * f));
    applyViewCSS();
  };
  $('#btn-zoom-in').onclick = () => zoomBy(1.25);
  $('#btn-zoom-out').onclick = () => zoomBy(0.8);
  cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 0.9);
  }, { passive: false });
  $('#btn-rotate').onclick = () => { wb.view.rot = (wb.view.rot + 90) % 360; applyViewCSS(); };
  $('#btn-flip').onclick = () => { wb.view.flip = !wb.view.flip; applyViewCSS(); };
  const resetView = () => { wb.view = { zoom: 1, panX: 0, panY: 0, rot: 0, flip: false }; applyViewCSS(); };
  wb._resetView = resetView;
  $('#btn-reset').onclick = resetView;
  $('#btn-compare').onclick = () => openCompareModal(wb);

  // 图形列表与操作
  bindShapeList(wb);
  const msBtn = $('#btn-shape-merge');
  if (msBtn) msBtn.onclick = () => mergeSelectedShapes(wb);
  const spBtn = $('#btn-shape-split');
  if (spBtn) spBtn.onclick = () => splitSelectedShape(wb);
  const kpBtn = $('#btn-kp-copy');
  if (kpBtn) kpBtn.onclick = () => copyKeypoints(wb);
  // 初始化掩码位图
  (wb.masks || []).forEach((_, i) => maskOf(i));
  // 标注规范面板
  mountSpecPanel(wb.task, wb.project, $('#spec-panel'));
  // OCR 转写校对
  const ta = $('#ocr-transcript');
  if (ta) ta.onchange = () => { wb.transcription = ta.value; markDirty(wb); };
  const chk = $('#btn-ocr-check');
  if (chk) chk.onclick = async () => {
    const text = (ta && ta.value.trim()) || '';
    if (!text) return toast('请先录入转写文本', 'warn');
    chk.disabled = true;
    try {
      const r = await api('/api/qc/operators/run', { method: 'POST', body: { text } });
      const issues = r.issues || [];
      $('#ocr-check-stat').textContent = issues.length ? `${issues.length} 处疑似问题 · 得分 ${r.score ?? '—'}` : '未发现问题';
      // 字符级高亮
      const marks = [];
      issues.forEach((it) => {
        const s = Number(it.start) || 0, e2 = Number(it.end) || s;
        if (e2 > s) marks.push([s, e2, it]);
      });
      marks.sort((a, b) => a[0] - b[0]);
      let html = '', pos = 0;
      marks.forEach(([s, e2, it]) => {
        if (s < pos) return;
        html += esc(text.slice(pos, s));
        html += `<mark title="${esc(it.message)}${it.suggestion ? ' → 建议：' + esc(it.suggestion) : ''}" style="background:rgba(239,68,68,.35);color:#FECACA;border-bottom:1px dashed #EF4444">${esc(text.slice(s, e2))}</mark>`;
        pos = e2;
      });
      html += esc(text.slice(pos));
      $('#ocr-check-out').innerHTML = `
        <div style="font-size:12.5px;line-height:2;background:rgba(13,21,36,.6);border:1px solid var(--border);border-radius:8px;padding:10px;max-height:180px;overflow:auto">${html || esc(text)}</div>
        ${issues.length ? `<div style="margin-top:6px">${issues.slice(0, 8).map((it) => `<div class="hint" style="line-height:1.7">[${it.level === 'error' ? '疑似错误' : '提示'}] ${esc(it.message)}${it.suggestion ? ` → ${esc(it.suggestion)}` : ''}</div>`).join('')}</div>` : ''}`;
    } catch (err) { toast(err.message, 'err'); }
    chk.disabled = false;
  };
  // 整图分类与场景属性
  const catInput = $('#img-category');
  if (catInput) catInput.onchange = () => { wb.imageClass = catInput.value.trim(); markDirty(wb); };
  [['weather', '#img-attr-weather'], ['daytime', '#img-attr-daytime'], ['scene', '#img-attr-scene']].forEach(([key, sel2]) => {
    const el2 = $(sel2);
    if (el2) el2.onchange = () => { wb.imgAttrs = { ...wb.imgAttrs, [key]: el2.value }; markDirty(wb); };
  });

  // 列表操作
  const list = $('#box-list');
  list.onclick = (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = Number(del.dataset.del);
      wb.boxes.splice(i, 1);
      if (wb.selected === i) wb.selected = -1;
      else if (wb.selected > i) wb.selected -= 1;
      refreshBoxUI(wb); drawImageBoxes(wb); markDirty(wb);
      return;
    }
    const row = e.target.closest('.box-row');
    if (row && !e.target.closest('select,input')) selectBox(wb, Number(row.dataset.i));
  };
  // 名称就地编辑：只同步数据与画布标签，不重绘列表以免打断输入
  list.oninput = (e) => {
    if (e.target.dataset.f !== 'name') return;
    const row = e.target.closest('.box-row'); if (!row) return;
    wb.boxes[Number(row.dataset.i)].name = e.target.value;
    markDirty(wb); drawImageBoxes(wb);
  };
  list.onchange = (e) => {
    const row = e.target.closest('.box-row'); if (!row) return;
    const i = Number(row.dataset.i); const f = e.target.dataset.f;
    if (f === 'cls') {
      wb.boxes[i].cls = e.target.value;
      markDirty(wb); refreshBoxUI(wb); drawImageBoxes(wb);
    }
  };

  // 快捷键：Delete 删除选中目标/图形，Esc 清除筛选/选中，字母键切换工具
  document.onkeydown = (e) => {
    if (!document.body.contains($('#wb'))) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const toolKey = { r: 'rect', p: 'poly', c: 'circle', l: 'free', b: 'brush', g: 'fill', k: 'keypoint', v: 'pan' }[e.key.toLowerCase()];
      if (toolKey && setTool) { setTool(toolKey); return; }
      if (e.key.toLowerCase() === 't') { wb.view.rot = (wb.view.rot + 90) % 360; applyViewCSS(); return; }
      if (e.key.toLowerCase() === 'f') { wb.view.flip = !wb.view.flip; applyViewCSS(); return; }
      if (e.key.toLowerCase() === 'w') { wb.view.panY += 0.05; applyViewCSS(); return; }
      if (e.key.toLowerCase() === 's' && wb.tool === 'pan') { wb.view.panY -= 0.05; applyViewCSS(); return; }
      if (e.key.toLowerCase() === 'a') { wb.view.panX += 0.05; applyViewCSS(); return; }
      if (e.key.toLowerCase() === 'd') { wb.view.panX -= 0.05; applyViewCSS(); return; }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && wb.canEdit) {
      if (wb.selShape) {
        e.preventDefault();
        const arr = wb.selShape.kind === 'polygon' ? wb.polygons : wb.selShape.kind === 'mask' ? wb.masks : wb.keypoints;
        arr.splice(wb.selShape.index, 1);
        wb.selShape = null;
        markDirty(wb); refreshShapeUI(wb); drawImageBoxes(wb);
        return;
      }
      if (wb.selected >= 0) {
        e.preventDefault();
        wb.boxes.splice(wb.selected, 1);
        wb.selected = -1;
        markDirty(wb); refreshBoxUI(wb); drawImageBoxes(wb);
      }
    }
    if (e.key === 'Escape') {
      wb.selected = -1;
      wb.selShape = null;
      wb._polyDraft = null;
      refreshShapeUI(wb); drawImageBoxes(wb);
      setFilter(wb, 'all');
    }
  };

  // 顶部按钮
  $('#btn-save').onclick = () => save(wb);
  $('#btn-export-boxes').onclick = () => exportBoxes(wb);
  $('#btn-submit').onclick = async () => {
    if (!wb.boxes.length) return toast('至少需要一个标注目标才能提交', 'warn');
    const ai = wb.boxes.filter((b) => b.source === 'ai').length;
    const ok = await confirmModal(
      '提交质检？',
      `共 ${wb.boxes.length} 个目标（AI ${ai} 个 / 人工 ${wb.boxes.length - ai} 个），提交后将进入质检队列。`,
      '提交质检'
    );
    if (!ok) return;
    try {
      await submitWithRuleGuard(`/api/tasks/${wb.task.id}/submit`, payloadOf(wb));
      toast('已提交质检', 'ok');
      setTimeout(() => (location.hash = '#/tasks'), 500);
    } catch (err) { toast(err.message, 'err'); }
  };

  // 上传 / 更换图片
  const imgUpBtn = $('#btn-img-upload');
  if (imgUpBtn) {
    const input = $('#img-file-input');
    imgUpBtn.onclick = () => input.click();
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      toast('正在上传图片…');
      try {
        await api(`/api/tasks/${wb.task.id}/media`, { method: 'POST', body: fd });
        toast('图片已上传', 'ok');
        setTimeout(() => pageAnnotate(wb.task.id), 400);
      } catch (err) { toast(err.message, 'err'); }
    };
  }

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
      // 每次识别都用新结果整体替换上一次 AI 目标，避免重复点击不断叠加；人工画的框保留
      const oldAI = wb.boxes.filter((b) => b.source === 'ai');
      const manual = wb.boxes.filter((b) => b.source !== 'ai');
      wb.boxes = manual;
      const bizCls = (wb.labels['目标类别'] || classes)[0];
      let added = 0, skipped = 0;
      for (const b of detected) {
        // 跳过极低置信度的噪声框
        if (b.conf < 0.10) { skipped++; continue; }
        // 同一位置重识别时沿用上次已填写的名称，避免重复劳动
        const prev = oldAI.find((o) => iouBox(o, b) > 0.5);
        // 保留 AI 判定的业务类；不在当前项目类别里才回退到第一个业务类
        wb.boxes.push({
          cls: classes.includes(b.cls) ? b.cls : bizCls,
          name: prev ? prev.name || '' : '',
          source: 'ai',
          auto_cls: b.auto_cls || b.cls,  // Grounding DINO 原始英文 label
          conf: b.conf,
          x: b.x, y: b.y, w: b.w, h: b.h,
        });
        added++;
      }
      markDirty(wb);
      wb.selected = -1;
      refreshBoxUI(wb);
      drawImageBoxes(wb);
      toast(`已用本次 AI 结果替换上次 AI 目标：入库 ${added} 个，保留人工 ${manual.length} 个${skipped ? `，忽略 ${skipped} 个低分框` : ''} · ${(pre.elapsed_ms / 1000).toFixed(1)}s`, 'ok');
      btn.textContent = '重新识别';
      if (status) status.textContent = `AI 检出 ${added} 个 / 人工补框 ${manual.length} 个`;
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
  // 应用视图变换（缩放/平移/旋转/镜像），后续绘制全部走图片归一化坐标
  const v = wb.view || { zoom: 1, panX: 0, panY: 0, rot: 0, flip: false };
  ctx.save();
  ctx.translate((0.5 + (v.panX || 0)) * sw, (0.5 + (v.panY || 0)) * sh);
  ctx.rotate((v.rot || 0) * Math.PI / 180);
  if (v.flip) ctx.scale(-1, 1);
  ctx.scale(v.zoom || 1, v.zoom || 1);
  ctx.translate(-0.5 * sw, -0.5 * sh);
  const hasSel = wb.selected >= 0 && !!wb.boxes[wb.selected];

  if (wb.showBox) {
    // 按筛选条件绘制：非选中目标在选中态下淡化，突出当前目标
    visibleIndexes(wb).forEach((i) => {
      if (i === wb.selected) return;
      drawOneBox(ctx, wb.boxes[i], i, sw, sh, hasSel ? 0.3 : 1, false);
    });
    if (hasSel) drawOneBox(ctx, wb.boxes[wb.selected], wb.selected, sw, sh, 1, true);
  }
  // 图形层：多边形 / 掩码 / 关键点（与框同坐标系）
  drawShapes(ctx, wb, sw, sh);
  // 正在拖的预览框
  if (wb._dragRect) {
    const r = wb._dragRect;
    ctx.strokeStyle = '#FCD34D'; ctx.setLineDash([5, 3]); ctx.lineWidth = 2;
    ctx.strokeRect(r.x * sw, r.y * sh, r.w * sw, r.h * sh);
    ctx.setLineDash([]);
  }
  // 圆形预览
  if (wb._dragCircle) {
    const { cx, cy, r } = wb._dragCircle;
    ctx.strokeStyle = boxColor(wb.activeCls); ctx.setLineDash([5, 3]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx * sw, cy * sh, r * sw, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  // 多边形草稿
  if (wb._polyDraft && wb._polyDraft.length) {
    const pts = wb._polyDraft;
    ctx.strokeStyle = '#FCD34D'; ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * sw, y * sh) : ctx.moveTo(x * sw, y * sh)));
    ctx.stroke();
    pts.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? '#22C55E' : '#FCD34D';
      ctx.fillRect(x * sw - 3, y * sh - 3, 6, 6);
    });
  }
  // 自由曲线草稿
  if (wb._freeLive && wb._freeLive.length > 1) {
    ctx.strokeStyle = boxColor(wb.activeCls); ctx.lineWidth = 2; ctx.beginPath();
    wb._freeLive.forEach(([x, y], i) => (i ? ctx.lineTo(x * sw, y * sh) : ctx.moveTo(x * sw, y * sh)));
    ctx.stroke();
  }
  ctx.restore();
}

/* ------------ 图形绘制：多边形 / 掩码 / 关键点 ------------ */
function drawShapes(ctx, wb, sw, sh) {
  const sel = wb.selShape;
  // 分割掩码：按实例类别着色（白色位图 → 类别色）
  (wb.masks || []).forEach((m, i) => {
    const tinted = wb._maskTinted && wb._maskTinted.get(i);
    if (!tinted) return;
    ctx.save();
    ctx.globalAlpha = sel && sel.kind === 'mask' && sel.index === i ? 0.85 : 0.5;
    ctx.drawImage(tinted, 0, 0, sw, sh);
    ctx.restore();
    const col = boxColor(m.label);
    ctx.fillStyle = col;
    ctx.font = '600 11px ui-sans-serif, system-ui';
    const text = `▨ ${m.label}#${i + 1}`;
    ctx.fillRect(4, 4 + i * 18, ctx.measureText(text).width + 10, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 8, 16 + i * 18);
  });
  // 多边形
  (wb.polygons || []).forEach((p, i) => {
    const pts = p.points || [];
    if (pts.length < 2) return;
    const col = boxColor(p.label);
    const selected = sel && sel.kind === 'polygon' && sel.index === i;
    ctx.save();
    ctx.globalAlpha = selected ? 0.95 : 0.8;
    ctx.strokeStyle = col; ctx.lineWidth = selected ? 2.4 : 1.6;
    ctx.fillStyle = col + '22';
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * sw, y * sh) : ctx.moveTo(x * sw, y * sh)));
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '600 11px ui-sans-serif, system-ui';
    ctx.fillRect(pts[0][0] * sw, pts[0][1] * sh - 14, ctx.measureText(p.label).width + 8, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.label, pts[0][0] * sw + 4, pts[0][1] * sh - 3);
    if (selected) {
      ctx.fillStyle = '#fff';
      pts.forEach(([x, y]) => ctx.fillRect(x * sw - 3, y * sh - 3, 6, 6));
    }
    ctx.restore();
  });
  // 关键点 + 骨骼连线
  const kps = wb.keypoints || [];
  if (kps.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(34,197,94,.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    kps.forEach((k, i) => {
      const x = k.x * sw, y = k.y * sh;
      if (i && k.link !== false) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    kps.forEach((k, i) => {
      const x = k.x * sw, y = k.y * sh;
      const col = sel && sel.kind === 'keypoint' && sel.index === i ? '#FCD34D' : '#22C55E';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#050912';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.font = '600 10px ui-sans-serif, system-ui';
      ctx.fillText(k.label || `P${i + 1}`, x + 7, y - 5);
    });
    ctx.restore();
  }
}

/* ------------ 图形列表与操作 ------------ */
function shapeListHTML(wb) {
  const sel = wb.selShape;
  const rows = [];
  (wb.polygons || []).forEach((p, i) => {
    const on = sel && sel.kind === 'polygon' && sel.index === i;
    rows.push(`<div class="shape-row ${on ? 'sel' : ''}" data-sel="polygon:${i}">
      <input type="checkbox" class="shape-ck" data-ck="polygon:${i}" title="合并候选" />
      <i style="background:${boxColor(p.label)}"></i><span class="shape-kind">多边形</span>
      <input class="box-name" data-shape-label="polygon:${i}" value="${esc(p.label)}" style="width:82px" />
      <span class="sub">${(p.points || []).length} 顶点${p.shape === 'circle' ? ' · 圆' : ''}</span>
      <button class="box-del" data-shape-del="polygon:${i}" title="删除">${icon('x')}</button></div>`);
  });
  (wb.masks || []).forEach((m, i) => {
    const on = sel && sel.kind === 'mask' && sel.index === i;
    rows.push(`<div class="shape-row ${on ? 'sel' : ''}" data-sel="mask:${i}">
      <i style="background:${boxColor(m.label)}"></i><span class="shape-kind">分割</span>
      <input class="box-name" data-shape-label="mask:${i}" value="${esc(m.label)}" style="width:82px" />
      <span class="sub">${m.w || '—'}×${m.h || '—'}</span>
      <button class="box-del" data-shape-del="mask:${i}" title="删除">${icon('x')}</button></div>`);
  });
  (wb.keypoints || []).forEach((k, i) => {
    const on = sel && sel.kind === 'keypoint' && sel.index === i;
    rows.push(`<div class="shape-row ${on ? 'sel' : ''}" data-sel="keypoint:${i}">
      <i style="background:#22C55E"></i><span class="shape-kind">关键点</span>
      <input class="box-name" data-shape-label="keypoint:${i}" value="${esc(k.label || `P${i + 1}`)}" style="width:82px" />
      <span class="sub">${(k.x * 100).toFixed(1)},${(k.y * 100).toFixed(1)}</span>
      <button class="box-del" data-shape-del="keypoint:${i}" title="删除">${icon('x')}</button></div>`);
  });
  return rows.join('') || '<div class="empty" style="padding:10px">暂无图形标注<br/>用多边形 / 画笔 / 关键点工具在画布上直接绘制</div>';
}

function refreshShapeUI(wb) {
  const el = $('#shape-list');
  if (el) el.innerHTML = shapeListHTML(wb);
  const hint = $('#tool-hint');
  if (hint && wb.tool === 'poly' && wb._polyDraft) hint.textContent = `多边形草稿 ${wb._polyDraft.length} 点 · 双击或点起点闭合`;
}

function bindShapeList(wb) {
  const el = $('#shape-list');
  if (!el || el._bound) return;
  el._bound = true;
  const arrOf = (kind) => kind === 'polygon' ? wb.polygons : kind === 'mask' ? wb.masks : wb.keypoints;
  el.onclick = (e) => {
    const del = e.target.closest('[data-shape-del]');
    if (del) {
      const [kind, idx] = del.dataset.shapeDel.split(':');
      arrOf(kind).splice(Number(idx), 1);
      if (wb.selShape && wb.selShape.kind === kind && wb.selShape.index === Number(idx)) wb.selShape = null;
      markDirty(wb); refreshShapeUI(wb); drawImageBoxes(wb);
      return;
    }
    const row = e.target.closest('[data-sel]');
    if (row && !e.target.closest('input')) {
      const [kind, idx] = row.dataset.sel.split(':');
      wb.selShape = { kind, index: Number(idx) };
      refreshShapeUI(wb); drawImageBoxes(wb);
    }
  };
  el.oninput = (e) => {
    const inp = e.target.closest('[data-shape-label]');
    if (!inp) return;
    const [kind, idx] = inp.dataset.shapeLabel.split(':');
    arrOf(kind)[Number(idx)].label = inp.value.trim() || arrOf(kind)[Number(idx)].label;
    markDirty(wb); drawImageBoxes(wb);
  };
}

/* 凸包（ Graham 扫描） */
function convexHull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of P) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function mergeSelectedShapes(wb) {
  const cks = $$('#shape-list .shape-ck:checked');
  if (cks.length < 2) return toast('请勾选两个及以上多边形', 'warn');
  const idxs = cks.map((c) => Number(c.dataset.ck.split(':')[1])).sort((a, b) => a - b);
  const all = [];
  idxs.forEach((i) => (wb.polygons[i].points || []).forEach((p) => all.push(p)));
  const hull = convexHull(all).map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
  if (hull.length < 3) return toast('合并结果无效', 'warn');
  const label = wb.polygons[idxs[0]].label;
  wb.polygons = wb.polygons.filter((_, i) => !idxs.includes(i));
  wb.polygons.push({ label, points: hull });
  wb.selShape = { kind: 'polygon', index: wb.polygons.length - 1 };
  markDirty(wb); refreshShapeUI(wb); drawImageBoxes(wb);
  toast(`已合并 ${idxs.length} 个多边形`, 'ok');
}

function splitSelectedShape(wb) {
  const sel = wb.selShape;
  if (!sel || sel.kind !== 'polygon') return toast('请先在列表选中一个多边形', 'warn');
  const poly = wb.polygons[sel.index];
  const pts = poly.points || [];
  if (pts.length < 4) return toast('顶点太少无法拆分', 'warn');
  // 按最长轴方向的中位顶点拆成两段
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  const axis = spanX >= spanY ? 0 : 1;
  const sorted = pts.map((p, i) => [p, i]).sort((a, b) => a[0][axis] - b[0][axis]);
  const cut = sorted[Math.floor(sorted.length / 2)][1];
  const a = pts.slice(0, cut + 1), b = pts.slice(cut);
  if (a.length < 3 || b.length < 3) return toast('该顶点位置无法拆分', 'warn');
  poly.points = a;
  wb.polygons.push({ label: poly.label, points: b });
  markDirty(wb); refreshShapeUI(wb); drawImageBoxes(wb);
  toast('已拆分为两个多边形', 'ok');
}

function copyKeypoints(wb) {
  if (!wb.keypoints.length) return toast('当前没有关键点可复制', 'warn');
  const n = wb.keypoints.length;
  wb.keypoints.forEach((k, i) => wb.keypoints.push({
    x: Math.min(1, k.x + 0.03), y: Math.min(1, k.y + 0.03),
    label: `P${n + i + 1}`, visibility: k.visibility,
  }));
  markDirty(wb); refreshShapeUI(wb); drawImageBoxes(wb);
  toast(`已复刻 ${n} 个关键点（相同姿态，偏移放置）`, 'ok');
}

/* 多图并列对比 */
function openCompareModal(wb) {
  const media = (wb.media || []).filter((m) => m.kind === 'image');
  if (!media.length) return toast('该任务没有其他图片可对比', 'warn');
  const cols = media.slice(0, 3).map((m, i) => `<div style="flex:1;min-width:200px">
      <div class="hint" style="margin-bottom:4px">${i === 0 ? '当前图' : `媒体 ${i + 1}`} · ${esc(m.name)}</div>
      <img src="${m.url}" style="width:100%;border-radius:8px;border:1px solid var(--border)" /></div>`).join('');
  openModal(`<div class="modal-head"><h3>多图并列对比</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div style="display:flex;gap:12px;flex-wrap:wrap">${cols}</div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`, 'wide');
}

/* ------------ 规范展示与违规预警（#8-11） ------------ */
const specCache = new Map();
async function fetchSpecForTask(task, project) {
  try {
    if (project && project.spec_id) {
      if (!specCache.has(project.spec_id)) {
        specCache.set(project.spec_id, await api(`/api/spec-templates/${project.spec_id}`).catch(() => null));
      }
      const t = specCache.get(project.spec_id);
      if (t) {
        return {
          title: t.name,
          source: '项目规范模板',
          lines: (t.content || '').split('\n').map((x) => x.trim()).filter(Boolean),
          samples: t.samples || [],
        };
      }
    }
  } catch (e) { /* 无规范模板 */ }
  if (task.instruction) {
    return { title: '本任务标注说明', source: '任务', lines: String(task.instruction).split('\n').map((x) => x.trim()).filter(Boolean), samples: [] };
  }
  return null;
}

async function mountSpecPanel(task, project, el) {
  if (!el) return;
  el.innerHTML = '<div class="hint">加载标注规范…</div>';
  const spec = await fetchSpecForTask(task, project);
  if (!spec) {
    el.innerHTML = '<div class="hint">该项目未绑定规范模板，可在「模板中心 → 规范模板」创建并在项目设置中绑定。</div>';
    return;
  }
  const sampleHtml = (spec.samples || []).slice(0, 6).map((s) => {
    const isPdf = /\.pdf$/i.test(s.url || '');
    return isPdf
      ? `<a class="btn sm ghost" href="${esc(s.url)}" target="_blank" rel="noopener">📄 ${esc(s.name || '规范文档')}</a>`
      : `<img src="${esc(s.url)}" title="${esc(s.name || '示例')}" style="width:72px;height:52px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer" data-spec-zoom="${esc(s.url)}" />`;
  }).join(' ');
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <b style="font-size:12px">${esc(spec.title)}</b>
      <span class="tag">${esc(spec.source)}</span>
      <button class="btn sm ghost" style="margin-left:auto" id="spec-toggle">收起</button>
    </div>
    <ul id="spec-lines" style="margin:0 0 6px 16px;padding:0;font-size:12px;line-height:1.9;color:var(--text)">
      ${spec.lines.map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="hint">模板暂无规范条文</li>'}
    </ul>
    ${sampleHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${sampleHtml}</div>` : ''}`;
  const tg = $('#spec-toggle');
  if (tg) tg.onclick = () => {
    const box = $('#spec-lines');
    const hidden = box && box.style.display === 'none';
    if (box) box.style.display = hidden ? '' : 'none';
    tg.textContent = hidden ? '收起' : '展开';
  };
  el.onclick = (e) => {
    const img = e.target.closest('[data-spec-zoom]');
    if (img) openModal(`<div class="modal-head"><h3>规范示例</h3><button class="x" data-close>×</button></div>
      <div class="modal-body"><img src="${img.dataset.specZoom}" style="width:100%;border-radius:8px" /></div>
      <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`);
  };
}

/* 违规列表渲染（工作台内实时预警） */
function violationsHTML(violations) {
  if (!violations || !violations.length) return '';
  return `<div style="margin-top:8px;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.08);border-radius:8px;padding:8px 10px">
    <div style="font-size:12px;font-weight:600;color:#FCA5A5;margin-bottom:4px">规范预警 · ${violations.length} 项</div>
    ${violations.map((v) => `<div style="font-size:11.5px;line-height:1.7;color:${v.level === 'error' ? '#FECACA' : '#FCD34D'}">[${v.level === 'error' ? '错误' : '警告'}] ${esc(v.message)}</div>`).join('')}
  </div>`;
}

function renderViolations(violations) {
  let box = $('#wb-violations');
  if (!violations || !violations.length) {
    if (box) box.remove();
    return;
  }
  if (!box) {
    const head = $('.wb-head');
    if (!head) return;
    box = document.createElement('div');
    box.id = 'wb-violations';
    box.style.cssText = 'flex-basis:100%;width:100%';
    head.parentNode.insertBefore(box, head.nextSibling);
  }
  box.innerHTML = violationsHTML(violations);
}

/* 提交守卫：428 违规 → 确认后强制提交 */
async function submitWithRuleGuard(path, payload, okText = '提交质检') {
  try {
    return await api(path, { method: 'POST', body: { payload } });
  } catch (err) {
    if (err.status === 428 && err.data && err.data.confirm_required) {
      const vs = err.data.violations || [];
      renderViolations(vs);
      const html = vs.map((v) => `<div style="font-size:12px;line-height:1.8;color:${v.level === 'error' ? '#FECACA' : '#FCD34D'}">[${v.level === 'error' ? '错误' : '警告'}] ${esc(v.message)}</div>`).join('');
      const ok = await confirmModal('存在规范违规', `<div style="text-align:left">${html}<div class="hint" style="margin-top:8px">修正后提交，或强制提交由质检环节复核。</div></div>`, '强制提交');
      if (!ok) throw err;
      return api(path, { method: 'POST', body: { payload, force: true } });
    }
    throw err;
  }
}

function drawOneBox(ctx, b, i, sw, sh, alpha = 1, selected = false) {
  const x = b.x * sw, y = b.y * sh, w = b.w * sw, h = b.h * sh;
  const col = boxColor(b.cls);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = selected ? 2.5 : 1.6;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = col + (selected ? '40' : '24');
  ctx.fillRect(x, y, w, h);
  // 标签：#编号 名称（未命名时显示类型）
  ctx.font = '600 11px ui-sans-serif, system-ui';
  const label = `#${i + 1} ${b.name || b.cls}`;
  const tw = ctx.measureText(label).width + 9;
  const ly = y - 16 < 0 ? y : y - 16;
  ctx.fillStyle = col;
  ctx.fillRect(x, ly, tw, 16);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x + 4, ly + 12);
  if (selected) {
    // 选中目标：四角把手 + 白色虚线内框
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, Math.max(1, w - 3), Math.max(1, h - 3));
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - 3, hy - 3, 6, 6);
    });
  }
  ctx.restore();
}

function refreshBoxUI(wb) {
  const list = $('#box-list');
  if (list) {
    const top = list.scrollTop;
    list.innerHTML = boxHead() + boxRows(wb);
    list.scrollTop = top;
  }
  const tools = $('#box-tools'); if (tools) tools.innerHTML = boxTools(wb);
  const dls = $('#name-datalists'); if (dls) dls.innerHTML = nameDatalistsHTML(wb);
  const picker = $('#cls-picker'); if (picker) picker.innerHTML = clsPickerHTML(wb);
  const rp = $('#result-panel'); if (rp) rp.innerHTML = resultPanelHTML(wb);
  const total = wb.boxes.length;
  const sub = $('#box-sub'); if (sub) sub.textContent = `${total} 个目标 · ${boxStats(wb).length} 类`;
  const exp = $('#btn-export-boxes'); if (exp) exp.disabled = !total;
  const toolbarHint = $('#wb .image-toolbar .hint');
  if (toolbarHint) {
    const shown = visibleIndexes(wb).length;
    toolbarHint.textContent = wb.filter && wb.filter !== 'all' ? `${shown} / ${total} 个框` : `${total} 个框`;
  }
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
    const step = (e.ctrlKey || e.metaKey) ? 5 : 0.5;
    if (e.key === 'ArrowLeft' && audio) audio.currentTime = Math.max(0, audio.currentTime - step);
    if (e.key === 'ArrowRight' && audio) audio.currentTime = Math.min(wb.duration, audio.currentTime + step);
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
    wb.segments.push({ start, end: Math.min(wb.duration || start + 3, start + 3), text: '', spk: speakerList(wb)[0] || '说话人1', emotion: (wb.labels['情绪'] || ['中性'])[0], emo_intensity: 3, lang: '中文', pron_type: '无', pron_note: '', events: [] });
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
      await submitWithRuleGuard(`/api/tasks/${wb.task.id}/submit`, payloadOf(wb));
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
  if (typeof wb.customPayload === 'function') return wb.customPayload();
  if (wb.mediaType === 'image') {
    return {
      media_type: 'image',
      img_size: { w: wb.imgW || 0, h: wb.imgH || 0 },
      boxes: wb.boxes.map((b) => ({
        cls: b.cls || '商品主体',
        name: b.name || '',
        source: b.source || 'manual',
        x: Number(b.x) || 0, y: Number(b.y) || 0,
        w: Number(b.w) || 0, h: Number(b.h) || 0,
        ...(typeof b.conf === 'number' ? { conf: b.conf } : {}),
        ...(b.auto_cls ? { auto_cls: b.auto_cls } : {}),
      })),
      polygons: (wb.polygons || []).map((p) => ({
        label: p.label, points: p.points,
        ...(p.shape === 'circle' ? { shape: 'circle', cx: p.cx, cy: p.cy, r: p.r } : {}),
      })),
      keypoints: (wb.keypoints || []).map((k) => ({
        label: k.label, x: Number(k.x) || 0, y: Number(k.y) || 0,
        visibility: k.visibility ?? 2,
      })),
      masks: (wb.masks || []).map((m) => ({ label: m.label, w: m.w || 0, h: m.h || 0, png: m.png || '' })),
      category: wb.imageClass || '',
      attrs: wb.imgAttrs || {},
      transcription: wb.transcription || '',
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
      emo_intensity: Number(s.emo_intensity) || 3,
      lang: s.lang || '中文',
      pron_type: s.pron_type && s.pron_type !== '无' ? s.pron_type : '',
      pron_note: s.pron_note || '',
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
    renderViolations(r.violations);
    const ind = $('#save-ind');
    if (ind) ind.textContent = '已保存 ' + r.saved_at.slice(11, 16);
    if (typeof wb.onSaved === 'function') wb.onSaved(r);
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
      <div class="page-actions"><span class="tag">${tasks.length} 个待质检</span>
        <button class="btn" id="qc-batch-approve">批量通过</button>
        <button class="btn danger" id="qc-batch-reject">批量驳回</button></div></div>
    <div class="card"><div class="table-wrap">
      <table class="table"><thead><tr><th style="width:30px"><input type="checkbox" id="qc-ck-all" /></th><th>任务</th><th>项目</th><th>标注员</th><th>批次</th><th>提交时间</th><th class="right">操作</th></tr></thead>
      <tbody>${tasks.map((t) => `<tr>
        <td><input type="checkbox" class="qc-ck" value="${t.id}" /></td>
        <td><div class="name">${esc(t.name)}</div><div class="sub">#${t.id} · ${esc(t.modality_label)}</div></td>
        <td>${esc(t.project_name)}</td><td>${esc(t.assignee_name || '—')}</td><td class="mono">${esc(t.batch || '—')}</td>
        <td class="mono">${esc((t.updated_at || '').slice(5, 16))}</td>
        <td class="right"><button class="btn sm primary" data-review="${t.id}">开始质检</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty"><b>质检队列为空</b>所有提交任务均已完成复核</td></tr>'}</tbody></table>
    </div></div>`;
  mount('qc', '质检中心', content);
  $$('[data-review]').forEach((b) => (b.onclick = () => openReview(Number(b.dataset.review))));
  const all = $('#qc-ck-all');
  if (all) all.onchange = () => $$('.qc-ck').forEach((c) => { c.checked = all.checked; });
  $('#qc-batch-approve').onclick = () => runBatchReview(tasks, 'approved');
  $('#qc-batch-reject').onclick = () => runBatchReview(tasks, 'rejected');
}

function checkedTaskIds(cls) {
  return $$(`.${cls}:checked`).map((c) => Number(c.value));
}

async function runBatchReview(tasks, result) {
  const ids = checkedTaskIds('qc-ck');
  if (!ids.length) return toast('请先勾选任务', 'warn');
  if (result === 'approved') {
    const ok = await confirmModal('批量质检通过？', `将对勾选的 ${ids.length} 个任务统一记 90 分通过，进入待验收。`, '批量通过');
    if (!ok) return;
    const r = await api('/api/tasks/batch-review', { method: 'POST', body: { task_ids: ids, result, score: 90 } });
    toast(`通过 ${r.done.length} 个${r.failed.length ? `，失败 ${r.failed.length} 个：${r.failed[0].reason}` : ''}`, r.failed.length ? 'warn' : 'ok');
    pageQC();
    return;
  }
  openModal(`<div class="modal-head"><h3>批量驳回返修</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>统一评分</label><input class="input" type="number" id="bqr-score" value="60" min="0" max="100" /></div>
      <div class="field full"><label>返修意见（必填）</label><textarea class="input textarea" id="bqr-comment" placeholder="统一返修说明"></textarea></div>
      <div class="field full"><label>错误类型</label><div class="filters" id="bqr-errors">
        ${['漏标', '错标', '框选偏差', '标签错误', '属性错误', '其他'].map((x) => `<label class="toggle-wrap"><input type="checkbox" value="${x}"> ${x}</label>`).join('')}
      </div></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn danger" id="bqr-ok">批量驳回</button></div>`);
  $('#bqr-ok').onclick = async () => {
    const comment = $('#bqr-comment').value.trim();
    if (!comment) return toast('请填写统一返修意见', 'warn');
    const r = await api('/api/tasks/batch-review', {
      method: 'POST',
      body: {
        task_ids: ids, result, score: Number($('#bqr-score').value) || 0, comment,
        error_types: $$('#bqr-errors input:checked').map((x) => x.value),
      },
    });
    closeModal();
    toast(`驳回 ${r.done.length} 个${r.failed.length ? `，失败 ${r.failed.length} 个：${r.failed[0].reason}` : ''}`, r.failed.length ? 'warn' : 'ok');
    pageQC();
  };
}

async function openReview(tid) {
  const d = await api(`/api/tasks/${tid}`);
  const ann = d.annotation;
  // 目前标注表未区分预识别/人工，这里把 prelabel 与最终结果并排展示
  const payload = (ann && ann.payload) || {};
  const pre = (ann && ann.prelabel) || {};
  const mediaType = d.task.media_type || payload.media_type || 'audio';
  const isImage = mediaType === 'image';
  const segs = payload.segments || [];
  const preSegs = pre.segments || [];
  const boxes = payload.boxes || [];
  const preBoxes = pre.boxes || [];
  const mediaName = d.task.media_path ? d.task.media_path.split('/').pop() : '';
  const isEditing = !!(d.project && d.project.modality === 'editing') || payload.media_type === 'editing';
  const edit = payload.edit || {};
  const resultMedia = (d.media || []).find((m) => m.meta && (m.meta.role === 'result' || m.meta.source === 'result'));
  const dimLabel = { color: '颜色', texture: '纹理', size: '尺寸', material: '材质' };
  const editPane = isEditing ? `<div class="review-pane"><h4>编辑指令</h4>
    ${[
      ['编辑类型', edit.edit_type === 'delete' ? '删除目标' : (edit.edit_type === 'attribute' ? '修改属性' : '未填写')],
      ['属性维度', (edit.attribute_dim || []).map((x) => dimLabel[x] || x).join('、') || '—'],
      ['属性值', edit.attribute_value || '—'],
      ['目标', `${edit.target_name || '未填写'} · ${edit.target_category || '未分类'}`],
      ['定位', edit.target_locator || '—'],
      ['同类目标数', edit.same_target_count || 0],
      ['影子调整', edit.shadow_adjusted ? '已确认' : '未确认'],
      ['指令', edit.instruction || '—'],
    ].map(([k, v]) => `<div class="review-line"><span class="s">${k}</span><span>${esc(String(v))}</span></div>`).join('')}
  </div>` : '';
  const pane = (arr, title) => `<div class="review-pane"><h4>${title} · ${arr.length} 段</h4>
    ${arr.map((s) => `<div class="review-line"><span class="t">${Number(s.start).toFixed(2)}</span><span class="s">${esc(s.spk || '—')}</span><span>${esc(s.text)}</span></div>`).join('') || '<div class="hint">无内容</div>'}</div>`;
  const boxPane = (arr, title) => `<div class="review-pane"><h4>${title} · ${arr.length} 个目标</h4>
    ${arr.map((b, i) => `<div class="review-line"><span class="t">#${i + 1}</span><span class="s">${esc(b.cls || '—')}</span><span>${esc(b.name || '未命名')}${typeof b.conf === 'number' ? ` · ${Math.round(b.conf * 100)}%` : ''} · 位置 ${(Number(b.x) * 100).toFixed(1)},${(Number(b.y) * 100).toFixed(1)} · 尺寸 ${(Number(b.w) * 100).toFixed(1)}×${(Number(b.h) * 100).toFixed(1)}%</span></div>`).join('') || '<div class="hint">无内容</div>'}</div>`;
  const panes = isImage
    ? `${editPane}${boxPane(boxes, '人工标注目标')}${preBoxes.length ? boxPane(preBoxes, 'AI 预识别目标') : ''}`
    : `${pane(segs, '人工标注结果')}${pane(preSegs, 'AI 预识别结果')}`;
  const mediaList = d.media || [];
  const audioMedia = mediaList.find((m) => m.kind === 'audio');
  const videoMedia = mediaList.find((m) => m.kind === 'video');
  const audioSrc = audioMedia ? audioMedia.url : (mediaType === 'audio' && mediaName ? `/media/${encodeURIComponent(mediaName)}` : '');
  const videoSrc = videoMedia ? videoMedia.url : (mediaType === 'video' && mediaName ? `/media/${encodeURIComponent(mediaName)}` : '');
  let preview = '';
  if (isImage && mediaName) {
    preview = `<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><div class="hint" style="margin-bottom:4px">原图</div><img src="/media/${encodeURIComponent(mediaName)}" alt="待质检图片" style="max-height:220px;max-width:100%;border-radius:8px;border:1px solid var(--border)" /></div>
        ${resultMedia ? `<div style="flex:1;min-width:220px"><div class="hint" style="margin-bottom:4px">编辑结果图</div><img src="${resultMedia.url}" alt="编辑结果" style="max-height:220px;max-width:100%;border-radius:8px;border:1px solid var(--border)" /></div>`
          : (isEditing ? '<div style="flex:1;min-width:220px"><div class="hint" style="margin-bottom:4px">编辑结果图</div><div class="empty" style="padding:30px 10px">未挂载结果图</div></div>' : '')}
      </div>`;
  } else if (audioSrc) {
    preview = `<div style="margin-bottom:12px"><div class="hint" style="margin-bottom:4px">原始音频 · ${esc((audioMedia && audioMedia.name) || mediaName)}</div>
      <audio controls preload="metadata" src="${audioSrc}" style="width:100%"></audio></div>`;
  } else if (videoSrc) {
    preview = `<div style="margin-bottom:12px"><div class="hint" style="margin-bottom:4px">原始视频 · ${esc((videoMedia && videoMedia.name) || mediaName)}</div>
      <video controls preload="metadata" src="${videoSrc}" style="max-height:240px;max-width:100%;border-radius:8px;border:1px solid var(--border)"></video></div>`;
  } else if (mediaName) {
    preview = `<div class="hint" style="margin-bottom:12px">媒体文件：${esc(mediaName)}（该模态暂不支持在线预览）</div>`;
  }
  const resultCount = isImage ? boxes.length : segs.length;
  openModal(`
    <div class="modal-head"><h3>质检 · ${esc(d.task.name)}</h3><span class="chip submitted" style="margin-left:auto">待质检</span><button class="x" data-close>×</button></div>
    <div class="modal-body">
      ${preview}
      <div class="review-grid">${panes}</div>
      ${isEditing ? '<div id="qc-editing-issues" style="margin-top:10px"><span class="hint">正在执行图像编辑规范校验…</span></div>' : ''}
      <div class="divider"></div>
      <div class="form-grid">
        <div class="field"><label>质检评分（0-100）</label><input class="input" type="number" id="qc-score" min="0" max="100" value="${resultCount ? 85 : 60}" /></div>
        <div class="field"><label>业务分类</label><input class="input" value="${esc(payload.business || '未分类')}" disabled /></div>
        <div class="field full"><label>错误类型（驳回时勾选）</label><div class="filters" id="qc-errors">
          ${['漏标', '错标', '框选偏差', '标签错误', '属性错误', '其他'].map((x) => `<label class="toggle-wrap"><input type="checkbox" value="${x}"> ${x}</label>`).join('')}
        </div></div>
        <div class="field full"><label>质检意见</label><textarea class="input textarea" id="qc-comment" placeholder="填写返修点或通过说明"></textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn ghost" data-close>取消</button>
      <button class="btn danger" id="qc-reject">驳回返修</button>
      <button class="btn success" id="qc-approve">通过</button>
    </div>`, 'wide');
  let editingOk = null;
  if (isEditing) {
    api(`/api/tasks/${tid}/editing/validate`, { method: 'POST', body: { payload } }).then((r) => {
      editingOk = !!r.ok;
      const box = $('#qc-editing-issues');
      if (!box) return;
      box.innerHTML = r.issues.length
        ? `<div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">图像编辑规范校验</div>` +
          r.issues.map((i) => `<div style="display:flex;gap:6px;padding:4px 0;font-size:11.5px">
            <span class="chip ${i.level === 'error' ? 'danger' : 'pending'}" style="flex:none">${i.level === 'error' ? '需修正' : '提示'}</span><span>${esc(i.message)}</span></div>`).join('')
        : '<span class="chip done">图像编辑规范校验通过</span>';
    }).catch(() => {
      const box = $('#qc-editing-issues');
      if (box) box.innerHTML = '<span class="hint">规范校验暂不可用</span>';
    });
  }
  const submit = async (result) => {
    if (result === 'approved' && isEditing && editingOk === false) {
      return toast('该样本未通过图像编辑规范校验，请驳回返修', 'err');
    }
    try {
      await api(`/api/tasks/${tid}/review`, {
        method: 'POST',
        body: { result, score: Number($('#qc-score').value) || 0, comment: $('#qc-comment').value.trim(), error_types: $$('#qc-errors input:checked').map((x) => x.value) },
      });
      closeModal(); toast(result === 'approved' ? '质检通过，已进入待验收' : '已驳回，任务回到标注中', 'ok');
      pageQC();
    } catch (err) { toast(err.message, 'err'); }
  };
  $('#qc-approve').onclick = () => submit('approved');
  $('#qc-reject').onclick = () => {
    if (!$('#qc-comment').value.trim()) return toast('驳回时请填写返修意见', 'warn');
    submit('rejected');
  };
}

/* ---------------- 验收中心 ---------------- */
async function pageAcceptance() {
  const data = await api('/api/acceptance');
  const tasks = data.tasks || [];
  const content = `
    <div class="page-head"><div><h1 class="page-title">验收中心</h1><p class="page-sub">质检通过的任务进入验收，验收通过后完成任务并进入交付</p></div>
      <div class="page-actions"><span class="tag">${tasks.length} 个待验收</span>
        <button class="btn" id="ac-batch-approve">批量通过</button>
        <button class="btn danger" id="ac-batch-reject">批量驳回</button></div></div>
    <div class="card"><div class="table-wrap">
      <table class="table"><thead><tr><th style="width:30px"><input type="checkbox" id="ac-ck-all" /></th><th>任务</th><th>项目</th><th>标注员</th><th>质检结果</th><th>验收员</th><th>更新时间</th><th class="right">操作</th></tr></thead>
      <tbody>${tasks.map((t) => {
        const qc = t.qc || {};
        const qcText = qc.result === 'approved' || qc.result === 'auto_approved'
          ? `${qc.result === 'auto_approved' ? '免检' : '通过'}${qc.score ? ` · ${qc.score} 分` : ''}`
          : (qc.result === 'rejected' ? '驳回' : '—');
        return `<tr>
          <td><input type="checkbox" class="ac-ck" value="${t.id}" /></td>
          <td><div class="name">${esc(t.name)}</div><div class="sub">#${t.id} · ${esc(t.modality_label)}</div></td>
          <td>${esc(t.project_name)}</td>
          <td>${esc(t.assignee_name || '—')}</td>
          <td>${esc(qcText)}</td>
          <td>${esc(t.acceptor_name || '未指派')}</td>
          <td class="mono">${esc((t.updated_at || '').slice(5, 16))}</td>
          <td class="right" style="white-space:nowrap">
            <a class="btn sm ghost" href="#/annotate/${t.id}">查看</a>
            <button class="btn sm success" data-accept="${t.id}">通过</button>
            <button class="btn sm danger" data-reject="${t.id}">驳回</button>
          </td></tr>`;
      }).join('') || '<tr><td colspan="8" class="empty"><b>验收队列为空</b>质检通过的任务会出现在这里</td></tr>'}</tbody></table>
    </div></div>`;
  mount('acceptance', '验收中心', content);
  const all = $('#ac-ck-all');
  if (all) all.onchange = () => $$('.ac-ck').forEach((c) => { c.checked = all.checked; });
  $('#ac-batch-approve').onclick = async () => {
    const ids = checkedTaskIds('ac-ck');
    if (!ids.length) return toast('请先勾选任务', 'warn');
    const ok = await confirmModal('批量验收通过？', `将完成勾选的 ${ids.length} 个任务并进入交付。`, '批量通过');
    if (!ok) return;
    const r = await api('/api/tasks/batch-accept', { method: 'POST', body: { task_ids: ids, result: 'approved' } });
    toast(`通过 ${r.done.length} 个${r.failed.length ? `，失败 ${r.failed.length} 个：${r.failed[0].reason}` : ''}`, r.failed.length ? 'warn' : 'ok');
    state.context = await api('/api/context');
    pageAcceptance();
  };
  $('#ac-batch-reject').onclick = () => {
    const ids = checkedTaskIds('ac-ck');
    if (!ids.length) return toast('请先勾选任务', 'warn');
    openModal(`<div class="modal-head"><h3>批量验收驳回</h3><button class="x" data-close>×</button></div>
      <div class="modal-body">
        <div class="field"><label>统一驳回原因</label><textarea class="input textarea" id="bac-comment" placeholder="说明需要整改的问题"></textarea></div>
        <div class="field"><label>退回阶段</label><select class="select" id="bac-target">
          <option value="annotating">标注阶段（返修）</option>
          <option value="review">质检阶段（复核）</option>
        </select></div>
      </div>
      <div class="modal-foot"><button class="btn ghost" data-close>取消</button>
      <button class="btn danger" id="bac-ok">批量驳回</button></div>`, 'sm');
    $('#bac-ok').onclick = async () => {
      const comment = $('#bac-comment').value.trim();
      if (!comment) return toast('请填写统一驳回原因', 'warn');
      const r = await api('/api/tasks/batch-accept', {
        method: 'POST',
        body: { task_ids: ids, result: 'rejected', comment, target: $('#bac-target').value },
      });
      closeModal();
      toast(`驳回 ${r.done.length} 个${r.failed.length ? `，失败 ${r.failed.length} 个：${r.failed[0].reason}` : ''}`, r.failed.length ? 'warn' : 'ok');
      state.context = await api('/api/context');
      pageAcceptance();
    };
  };
  $$('[data-accept]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal('验收通过', '确认通过该任务？通过后任务标记为已完成并进入交付。', '通过并完成'))) return;
    try {
      await api(`/api/tasks/${b.dataset.accept}/accept`, { method: 'POST', body: { result: 'approved' } });
      toast('验收通过，任务已完成', 'ok');
      state.context = await api('/api/context');
      pageAcceptance();
    } catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-reject]').forEach((b) => (b.onclick = () => rejectModal(Number(b.dataset.reject))));
}

function rejectModal(tid) {
  openModal(`
    <div class="modal-head"><h3>验收驳回</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="field"><label>驳回原因</label><textarea class="input textarea" id="ac-comment" placeholder="说明需要整改的问题"></textarea></div>
      <div class="field"><label>退回阶段</label><select class="select" id="ac-target">
        <option value="annotating">标注阶段（返修）</option>
        <option value="review">质检阶段（复核）</option>
      </select></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button>
    <button class="btn danger" id="ac-ok">确认驳回</button></div>`, 'sm');
  $('#ac-ok').onclick = async () => {
    const comment = $('#ac-comment').value.trim();
    if (!comment) return toast('请填写驳回原因', 'warn');
    try {
      await api(`/api/tasks/${tid}/accept`, {
        method: 'POST',
        body: { result: 'rejected', comment, target: $('#ac-target').value },
      });
      closeModal(); toast('已驳回', 'ok');
      state.context = await api('/api/context');
      pageAcceptance();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 项目管理 ---------------- */
async function pageProjects() {
  const data = await api('/api/projects');
  state.projects = data.projects;
  const canCreate = ['platform_admin', 'project_manager', 'tenant_admin'].includes(state.user.platform_role);
  const canManage = (p) => ['platform_admin', 'tenant_admin'].includes(state.user.platform_role) || p.my_role === 'manager';
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
          ${p.modality === 'editing' ? `${canManage(p) ? `<button class="btn sm" data-ed-import="${p.id}">样本目录导入</button>` : ''}<button class="btn sm" data-ed-audit="${p.id}">规范体检</button>` : ''}
          ${p.engine_url ? `<a class="btn sm" href="${esc(p.engine_url)}" target="_blank" rel="noreferrer">${icon('arrow')} ${esc(p.engine || '标注引擎')}</a>` : ''}
          <a class="btn sm primary" href="#/tasks?project=${p.id}">${icon('tasks')} 任务</a>
        </div>
      </div>`).join('') || '<div class="empty">暂无项目</div>'}
    </div>`;
  mount('projects', '项目管理', content);
  $$('[data-members]').forEach((b) => (b.onclick = () => projectMembers(Number(b.dataset.members))));
  $$('[data-ed-import]').forEach((b) => (b.onclick = () => editingImportModal(Number(b.dataset.edImport))));
  $$('[data-ed-audit]').forEach((b) => (b.onclick = () => editingAuditModal(`/api/projects/${b.dataset.edAudit}/editing/audit`, '项目规范体检')));
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
          <option value="annotator">标注员</option><option value="reviewer">质检员</option><option value="acceptor">验收员</option><option value="manager">项目经理</option><option value="viewer">只读</option></select></div>
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

function editingImportModal(pid) {
  const proj = (state.projects || []).find((p) => p.id === pid) || {};
  openModal(`
    <div class="modal-head"><h3>样本目录导入 · ${esc(proj.name || '')}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="hint" style="line-height:1.8;margin-bottom:10px">支持 ZIP 压缩包或直接选择多个文件。目录结构：<b>原图</b>（jpg/png）+ <b>结果图</b>（文件名含 result）+ <b>指令 txt</b>（同一前缀自动配对），每个样本生成一个任务，指令自动预填。</div>
      <div class="form-grid">
        <div class="field full"><label>样本文件（ZIP / 图片 / txt）</label><input class="input" type="file" id="ei-files" multiple accept=".zip,.jpg,.jpeg,.png,.webp,.txt,.md" /></div>
        <div class="field full"><label>批次名称（可选）</label><input class="input" id="ei-batch" placeholder="例如 0407-K-281 第一批" /></div>
      </div>
      <div id="ei-result" style="margin-top:12px"></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="ei-ok">开始导入</button></div>`);
  $('#ei-ok').onclick = async () => {
    const files = $('#ei-files').files;
    if (!files || !files.length) return toast('请选择样本文件或 ZIP 包', 'warn');
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    fd.append('batch', $('#ei-batch').value.trim());
    const btn = $('#ei-ok');
    btn.disabled = true;
    btn.textContent = '导入中…';
    try {
      const r = await api(`/api/projects/${pid}/editing/import`, { method: 'POST', body: fd });
      const errs = (r.errors || []).slice(0, 12).map((e) => `<div class="sub">${esc(e.sample)}：${esc(e.reason)}</div>`).join('');
      $('#ei-result').innerHTML = `<div class="chip done">成功创建 ${r.created} 个任务</div>
        ${r.skipped ? `<span class="chip pending">跳过 ${r.skipped} 个（同名已存在）</span>` : ''}
        ${errs ? `<div class="section-label" style="font-size:12px;color:var(--muted);margin:10px 0 4px">未导入样本</div>${errs}` : ''}`;
      toast(`导入完成：${r.created} 个任务`, 'ok');
      state.context = await api('/api/context');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '开始导入';
    }
  };
}

function newProjectModal() {
  const labels = { audio: '语音', image: '图片', video: '视频', pointcloud: '点云', editing: '图像编辑指令' };
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
  const canManage = can('member.write');
  const roles = { platform_admin: '平台管理员', tenant_admin: '租户管理员', project_manager: '项目经理', annotator: '标注员', reviewer: '质检员', acceptor: '验收员', client: '客户(只读)' };
  const roleOptions = isAdmin ? Object.entries(roles) : Object.entries(roles).filter(([k]) => !['platform_admin', 'tenant_admin'].includes(k));
  const content = `
    <div class="page-head"><div><h1 class="page-title">成员管理</h1><p class="page-sub">平台角色决定功能权限，项目角色决定数据可见范围</p></div>
      <div class="page-actions">${canManage ? `<button class="btn" id="btn-import-user">${icon('upload')} 批量导入</button><button class="btn primary" id="btn-new-user">${icon('plus')} 新增成员</button>` : ''}</div></div>
    <div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">平台成员</h3><span class="card-sub">${data.members.length} 人</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>成员</th><th>平台角色</th><th>项目数</th><th>状态</th><th class="right">操作</th></tr></thead>
        <tbody>${data.members.map((m) => {
          const editable = isAdmin || !['platform_admin', 'tenant_admin'].includes(m.platform_role);
          return `<tr>
          <td><div class="name">${esc(m.name)}</div><div class="sub mono">${esc(m.username)}</div>${m.tenant_name ? `<div class="sub">${esc(m.tenant_name)}</div>` : ''}</td>
          <td>${canManage && editable ? `<select class="select" data-role="${m.id}" style="width:130px;height:28px;padding:2px 6px">${roleOptions.map(([k, v]) => `<option value="${k}" ${m.platform_role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : `<span class="tag">${esc(m.role_label)}</span>`}</td>
          <td>${m.project_count}</td>
          <td>${m.status === 'active' ? '<span class="chip done">正常</span>' : '<span class="chip danger">停用</span>'}</td>
          <td class="right">${canManage && editable ? `<button class="btn sm ghost" data-toggle-user="${m.id}" data-status="${m.status}">${m.status === 'active' ? '停用' : '启用'}</button>` : '—'}</td>
        </tr>`; }).join('')}</tbody></table></div>
      </div>
      <div class="card"><div class="card-head"><h3 class="card-title">权限模型</h3><span class="card-sub">双重控制</span></div>
        <div class="card-body">
          <div class="panel-label">平台角色</div>
          <div class="kv"><span>平台管理员</span><b>全部项目 / 成员 / 设置</b></div>
          <div class="kv"><span>租户管理员</span><b>本租户的组织 / 团队 / 成员</b></div>
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
  $('#btn-import-user') && ($('#btn-import-user').onclick = importUserModal);
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
        <option value="annotator">标注员</option><option value="reviewer">质检员</option><option value="acceptor">验收员</option>
        <option value="project_manager">项目经理</option><option value="client">客户(只读)</option>${state.user.platform_role === 'platform_admin' ? '<option value="tenant_admin">租户管理员</option><option value="platform_admin">平台管理员</option>' : ''}</select>
        ${state.user.platform_role === 'platform_admin' ? '' : '<div class="hint">新成员将自动归入当前租户</div>'}</div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nu-ok">创建</button></div>`);
  $('#nu-ok').onclick = async () => {
    try {
      await api('/api/members', { method: 'POST', body: { username: $('#nu-username').value.trim(), name: $('#nu-name').value.trim(), password: $('#nu-pass').value, platform_role: $('#nu-role').value } });
      closeModal(); toast('成员已创建', 'ok'); pageMembers();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function importUserModal() {
  openModal(`
    <div class="modal-head"><h3>批量导入成员</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <p class="hint" style="margin-top:0">每行一个成员：<code>账号,姓名,角色,初始密码</code>。角色可填中文或英文键；密码留空则使用默认密码。</p>
      <textarea class="input" id="mi-text" rows="10" placeholder="zhangsan,张三,标注员,chunke123&#10;lisi,李四,质检员&#10;wangwu,王五,验收员"></textarea>
      <div id="mi-result" style="margin-top:10px"></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="mi-ok">开始导入</button></div>`);
  $('#mi-ok').onclick = async () => {
    const roleMap = { '平台管理员': 'platform_admin', '租户管理员': 'tenant_admin', '项目经理': 'project_manager', '标注员': 'annotator', '质检员': 'reviewer', '验收员': 'acceptor', '客户': 'client' };
    const users = $('#mi-text').value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [username, name, role, password] = line.split(/[,，\t]/).map((x) => (x || '').trim());
      return { username, name, platform_role: roleMap[role] || role || 'annotator', password: password || '' };
    });
    if (!users.length) return toast('请先填写导入数据', 'err');
    const btn = $('#mi-ok');
    btn.disabled = true; btn.textContent = '导入中…';
    try {
      const r = await api('/api/members/import-batch', { method: 'POST', body: { users } });
      $('#mi-result').innerHTML = `<div class="chip done">成功 ${r.created.length} 人</div>${r.failed.length ? `<div class="chip danger" style="margin-left:6px">失败 ${r.failed.length} 行</div><div style="margin-top:8px;max-height:160px;overflow:auto">${r.failed.map((f) => `<div class="sub">第 ${f.row} 行 ${esc(f.username || '')}：${esc(f.error)}</div>`).join('')}</div>` : ''}`;
      toast(`导入完成：成功 ${r.created.length} 人`, 'ok');
      if (r.created.length) setTimeout(() => { closeModal(); pageMembers(); }, 1200);
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = '开始导入';
    }
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

/* ---------------- 数据集 ---------------- */
const fmtBytes = (n) => {
  n = Number(n || 0);
  if (n > 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
};
const can = (perm) => state.user && (state.user.platform_role === 'platform_admin' || (state.permissions || []).includes(perm));
const mediaUrl = (name) => `/media/${encodeURIComponent(name || '')}`;

async function pageDatasets() {
  const [d, p] = await Promise.all([api('/api/datasets'), api('/api/projects')]);
  state.projects = p.projects;
  const list = d.datasets || [];
  const totalItems = list.reduce((s, x) => s + (x.item_count || 0), 0);
  const totalSize = list.reduce((s, x) => s + (x.size || 0), 0);
  const totalVersions = list.reduce((s, x) => s + (x.version_count || 0), 0);
  const content = `
    <div class="page-head"><div><h1 class="page-title">数据集管理</h1><p class="page-sub">原始数据汇聚、版本快照、预览与导出，支撑交付与训练回流</p></div>
      <div class="page-actions">${can('dataset.write') ? `<button class="btn primary" id="ds-new">${icon('plus')} 新建数据集</button>` : ''}</div></div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">${icon('database')} 数据集</div><div class="kpi-value">${list.length}</div><div class="kpi-delta">按项目隔离</div></div>
      <div class="kpi"><div class="kpi-label">${icon('layers')} 数据条目</div><div class="kpi-value">${totalItems}</div><div class="kpi-delta">跨全部版本累计</div></div>
      <div class="kpi"><div class="kpi-label">${icon('upload')} 存储容量</div><div class="kpi-value">${fmtBytes(totalSize)}</div><div class="kpi-delta">原始媒体文件</div></div>
      <div class="kpi"><div class="kpi-label">${icon('clock')} 版本快照</div><div class="kpi-value">${totalVersions}</div><div class="kpi-delta">可回滚与导出</div></div>
    </div>
    <div class="card"><div class="card-head"><h3 class="card-title">数据集列表</h3><span class="card-sub">${list.length} 个</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>数据集</th><th>项目</th><th class="hide-lg">类型</th><th>条目</th><th class="hide-md">版本</th><th class="hide-md">容量</th><th class="hide-lg">更新时间</th><th class="right">操作</th></tr></thead><tbody>
      ${list.map((x) => `<tr data-ds="${x.id}">
        <td><div class="name">${esc(x.name)}</div><div class="sub mono">${esc(x.code)}</div></td>
        <td>${esc(x.project_name || '未绑定')}</td>
        <td class="hide-lg"><span class="chip info">${esc(x.modality_label)}</span></td>
        <td><b>${x.item_count}</b></td>
        <td class="hide-md"><span class="tag">v${x.latest_version}</span></td>
        <td class="hide-md">${fmtBytes(x.size)}</td>
        <td class="sub hide-lg">${esc((x.updated_at || '').slice(5, 16))}</td>
        <td class="right"><button class="btn sm" data-detail="${x.id}">详情</button>
          <a class="btn sm" href="/api/datasets/${x.id}/export" data-export>导出</a></td>
      </tr>`).join('') || '<tr><td colspan="8"><div class="empty"><b>暂无数据集</b>先在数据集管理中创建，或从项目任务导入</div></td></tr>'}
      </tbody></table></div></div>`;
  mount('datasets', '数据集管理', content);
  $$('[data-detail]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); datasetDetail(Number(b.dataset.detail)); }));
  $$('tr[data-ds]').forEach((tr) => (tr.onclick = () => datasetDetail(Number(tr.dataset.ds))));
  $$('[data-export]').forEach((a) => (a.onclick = (e) => e.stopPropagation()));
  const nb = $('#ds-new');
  if (nb) nb.onclick = newDatasetModal;
}

function newDatasetModal() {
  openModal(`
    <div class="modal-head"><h3>新建数据集</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>数据集名称</label><input class="input" id="nd-name" placeholder="例如 客服通话 11 月批次" /></div>
      <div class="field"><label>绑定项目</label><select class="select" id="nd-proj"><option value="0">不绑定项目</option>
        ${state.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field full"><label>描述</label><textarea class="input textarea" id="nd-desc" placeholder="数据来源、采集口径与使用范围"></textarea></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nd-ok">创建数据集</button></div>`);
  $('#nd-ok').onclick = async () => {
    try {
      await api('/api/datasets', { method: 'POST', body: {
        name: $('#nd-name').value.trim(), project_id: Number($('#nd-proj').value), description: $('#nd-desc').value.trim(),
      } });
      closeModal(); toast('数据集已创建', 'ok'); pageDatasets();
    } catch (err) { toast(err.message, 'err'); }
  };
}

async function datasetDetail(id) {
  let d;
  try { d = await api(`/api/datasets/${id}`); } catch (err) { return toast(err.message, 'err'); }
  const items = d.items || [];
  openModal(`
    <div class="modal-head"><h3>${esc(d.name)} <span class="tag mono">${esc(d.code)}</span></h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="chip-row" style="margin-bottom:12px">
        <span class="chip info">${esc(d.modality_label)}</span>
        <span class="chip plain">${esc(d.project_name || '未绑定项目')}</span>
        <span class="chip purple">${d.item_count} 条目</span>
        <span class="chip plain">v${d.latest_version} · ${d.version_count} 个版本</span>
        <span class="chip plain">${fmtBytes(d.size)}</span>
      </div>
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${d.project_id ? '<button class="btn sm" id="dd-import">导入项目任务</button>' : ''}
        <button class="btn sm" id="dd-upload">${icon('upload')} 上传数据</button>
        <button class="btn sm" id="dd-version">新建版本快照</button>
        <a class="btn sm" href="/api/datasets/${d.id}/export">${icon('download')} 导出 CSV</a>
        ${d.modality === 'editing' ? `<button class="btn sm" id="dd-audit">图像编辑体检</button><a class="btn sm" href="/api/datasets/${d.id}/export.jsonl">${icon('download')} 导出 JSONL</a>` : ''}
        <input type="file" id="dd-file" style="display:none" />
      </div>
      <div class="divider"></div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:8px">版本历史</div>
      <div class="chip-row" style="margin-bottom:14px">
        ${(d.versions || []).map((v) => `<span class="chip plain" title="${esc(v.note)}">v${v.version} · ${v.item_count} 条 · ${esc(v.creator_name || '系统')}</span>`).join('') || '<span class="hint">暂无版本</span>'}
      </div>
      <div class="table-wrap" style="max-height:320px"><table class="table"><thead><tr><th>条目</th><th>类型</th><th>大小</th><th>任务状态</th><th class="right">预览</th></tr></thead><tbody>
        ${items.map((it) => `<tr><td><div class="name">${esc(it.name)}</div><div class="sub mono">${esc(it.media_name || '')}</div></td>
          <td><span class="chip plain">${esc(it.media_type_label)}</span></td><td>${fmtBytes(it.size)}</td>
          <td>${it.task_id ? `<span class="chip ${it.task_status || 'plain'}">${esc(it.task_status || '已关联')}</span>` : '<span class="hint">未建任务</span>'}</td>
          <td class="right">${['image', 'audio', 'video'].includes(it.media_type) ? `<button class="btn sm" data-preview="${it.id}">预览</button>` : '<span class="hint">3D 文件</span>'}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">暂无数据条目</div></td></tr>'}
      </tbody></table></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`, 'wide');
  $$('[data-preview]').forEach((b) => (b.onclick = () => {
    const it = items.find((x) => String(x.id) === b.dataset.preview);
    if (it) previewDatasetItem(it);
  }));
  const imp = $('#dd-import');
  if (imp) imp.onclick = async () => {
    try {
      const r = await api(`/api/datasets/${id}/import`, { method: 'POST', body: {} });
      toast(`导入完成，新增 ${r.added} 条，共 ${r.total} 条`, 'ok');
      datasetDetail(id);
    } catch (err) { toast(err.message, 'err'); }
  };
  const auditBtn = $('#dd-audit');
  if (auditBtn) auditBtn.onclick = () => editingAuditModal(`/api/datasets/${id}/editing/audit`, d.name);
  $('#dd-upload').onclick = () => $('#dd-file').click();
  $('#dd-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f); fd.append('create_task', '1');
    try {
      await api(`/api/datasets/${id}/upload`, { method: 'POST', body: fd });
      toast('数据已上传并创建任务', 'ok');
      datasetDetail(id);
    } catch (err) { toast(err.message, 'err'); }
  };
  $('#dd-version').onclick = async () => {
    if (!(await confirmModal('新建版本快照', '将基于当前全部条目生成新版本，历史版本保持不变。', '创建版本'))) return;
    try {
      const r = await api(`/api/datasets/${id}/versions`, { method: 'POST', body: { note: `手动快照 ${new Date().toLocaleString()}` } });
      toast(`已创建 v${r.version}，共 ${r.item_count} 条`, 'ok');
      datasetDetail(id);
    } catch (err) { toast(err.message, 'err'); }
  };
}

function previewDatasetItem(it) {
  const src = mediaUrl(it.media_name);
  const media = it.media_type === 'image' ? `<img src="${src}" style="max-width:100%;max-height:62vh;border-radius:10px" />`
    : it.media_type === 'video' ? `<video src="${src}" controls style="max-width:100%;max-height:62vh;border-radius:10px"></video>`
      : `<audio src="${src}" controls style="width:100%"></audio>`;
  openModal(`<div class="modal-head"><h3>${esc(it.name)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body" style="text-align:center">${media}<div class="hint" style="margin-top:10px">${esc(it.media_name)} · ${fmtBytes(it.size)}</div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`, 'wide');
}

async function editingAuditModal(url, title) {
  let d;
  try { d = await api(url); } catch (err) { return toast(err.message, 'err'); }
  const dist = (arr, key = 'label') => (arr || []).length
    ? arr.map((x) => `<span class="chip ${Number(x.percent) > 10 ? 'danger' : 'plain'}">${esc(x[key] || x.name)} · ${x.count}（${x.percent}%）</span>`).join('')
    : '<span class="hint">暂无</span>';
  const issueRows = (d.issues || []).map((i) => {
    const samples = (i.samples || []).slice(0, 4).map((s) => `<div class="sub">${esc(s.name || s.instruction || '')}${s.count ? ` ×${s.count}` : ''}${s.task_id ? ` · #${s.task_id}` : ''}</div>`).join('');
    return `<tr><td><span class="chip ${i.level === 'error' ? 'danger' : 'pending'}">${i.level === 'error' ? '需修正' : '提示'}</span></td>
      <td>${esc(i.message)}<div class="sub">${i.count} 条 · ${i.percent}%</div>${samples}</td></tr>`;
  }).join('');
  const typeRows = (d.detail_types || []).map((t) => `<tr><td>${esc(t.name)}</td><td class="mono">${t.count}</td>
    <td><span class="chip ${t.percent > 10 ? 'danger' : 'plain'}">${t.percent}%</span></td></tr>`).join('');
  openModal(`
    <div class="modal-head"><h3>图像编辑体检 · ${esc(title)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="grid three-col" style="margin-bottom:14px">
        <div class="card"><div class="card-body"><div class="hint">规范总分</div><div style="font-size:30px;font-weight:700;color:${d.passed ? 'var(--success)' : 'var(--danger)'}">${d.score}</div><div class="sub">${d.passed ? '通过' : '存在需修正项'}</div></div></div>
        <div class="card"><div class="card-body"><div class="hint">样本总数</div><div style="font-size:30px;font-weight:700">${d.total}</div><div class="sub">已完成 ${d.completed} · 未完成 ${d.pending}</div></div></div>
        <div class="card"><div class="card-body"><div class="hint">版本</div><div style="font-size:30px;font-weight:700">v${(d.dataset && d.dataset.version) || '—'}</div><div class="sub">单一细分类型上限 10%</div></div></div>
      </div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">编辑类型分布</div>
      <div class="chip-row" style="margin-bottom:12px">${dist(d.edit_types)}</div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">目标大类分布</div>
      <div class="chip-row" style="margin-bottom:12px">${dist(d.categories, 'name')}</div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">属性维度分布</div>
      <div class="chip-row" style="margin-bottom:12px">${dist(d.attributes)}</div>
      <div class="divider"></div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">合规问题</div>
      <div class="table-wrap" style="max-height:260px"><table class="table"><thead><tr><th style="width:90px">级别</th><th>问题与样例</th></tr></thead>
        <tbody>${issueRows || '<tr><td colspan="2"><div class="empty">未发现合规问题</div></td></tr>'}</tbody></table></div>
      <div class="divider"></div>
      <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">细分类型 Top 20</div>
      <div class="table-wrap" style="max-height:220px"><table class="table"><thead><tr><th>类型</th><th>数量</th><th>占比</th></tr></thead>
        <tbody>${typeRows || '<tr><td colspan="3"><div class="empty">暂无数据</div></td></tr>'}</tbody></table></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button></div>`, 'wide');
}

/* ---------------- 模板中心 ---------------- */
async function pageTemplates() {
  const [t, p] = await Promise.all([api('/api/templates'), api('/api/projects')]);
  state.templates = t.templates || [];
  state.projects = p.projects;
  const content = `
    <div class="page-head"><div><h1 class="page-title">模板中心</h1><p class="page-sub">标签体系与质检策略模板化，一键应用到项目与工作流</p></div>
      <div class="page-actions">${can('template.write') ? `<button class="btn primary" id="tpl-new">${icon('plus')} 新建模板</button>` : ''}</div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-head"><h3 class="card-title">标注规范模板库</h3>
      <span class="card-sub">可编辑、可复用；绑定到项目后，标注工作台实时展示规范要点与示例截图</span>
      ${can('template.write') ? `<button class="btn sm primary" id="spec-new" style="margin-left:auto">${icon('plus')} 新建规范</button>` : ''}</div>
      <div class="card-body" id="spec-list"><span class="hint">加载规范模板…</span></div></div>
    <div class="grid tpl-grid">
      ${state.templates.map((x) => {
        const labelGroups = Object.keys(x.labels || {});
        const qc = x.qc || {};
        return `<div class="tpl-card">
          <div class="tpl-top"><div class="proj-icon">${icon(MODALITY_ICON[x.modality] || 'layers')}</div>
            <div style="min-width:0"><h3>${esc(x.name)}</h3><p>${esc(x.description || '暂无描述')}</p></div>
            <span class="chip info" style="margin-left:auto">${esc(x.modality_label)}</span></div>
          <div class="chip-row">${labelGroups.map((g) => `<span class="chip plain">${esc(g)} · ${((x.labels[g] || []).length)}</span>`).join('')}
            ${x.builtin ? '<span class="chip purple">内置</span>' : ''}</div>
          <div class="tpl-qc"><span>抽审 <b>${qc.sample_rate ?? 100}%</b></span><span>及格 <b>${qc.min_score ?? 0}</b></span><span>返修上限 <b>${qc.max_rework ?? '-'}</b></span></div>
          <div class="tpl-foot"><span class="hint">${x.usage} 个项目在用</span>
            <button class="btn sm" data-tpl-view="${x.id}">配置</button>
            ${can('project.write') ? `<button class="btn sm primary" data-tpl-apply="${x.id}">应用到项目</button>` : ''}</div>
        </div>`;
      }).join('') || '<div class="empty">暂无模板</div>'}
    </div>`;
  mount('templates', '模板中心', content);
  refreshSpecManager();
  const specNew = $('#spec-new');
  if (specNew) specNew.onclick = () => openSpecModal(0);
  $$('[data-tpl-view]').forEach((b) => (b.onclick = () => templateDetail(Number(b.dataset.tplView))));
  $$('[data-tpl-apply]').forEach((b) => (b.onclick = () => applyTemplateModal(Number(b.dataset.tplApply))));
  const nb = $('#tpl-new');
  if (nb) nb.onclick = newTemplateModal;
}

async function refreshSpecManager() {
  const el = $('#spec-list');
  if (!el) return;
  const data = await api('/api/spec-templates').catch(() => ({ templates: [] }));
  const tpls = data.templates || [];
  const projData = state.projects || [];
  el.innerHTML = tpls.map((t) => `
    <div class="filters" style="border-bottom:1px solid rgba(30,42,63,.4);padding:8px 0;align-items:center">
      <b style="font-size:12.5px">${esc(t.name)}</b>
      <span class="chip plain">${t.modality ? esc(dbMODALITY(t.modality)) : '通用'}</span>
      <span class="sub">${(t.content || '').split('\n').filter(Boolean).length} 条规范 · ${(t.samples || []).length} 个示例</span>
      <span class="spacer"></span>
      <select class="select" data-spec-bind="${t.id}" style="width:170px;height:26px">
        <option value="">绑定到项目…</option>
        ${projData.filter((p) => can('project.write') || p.my_role === 'manager').map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
      </select>
      ${can('template.write') ? `<button class="btn sm" data-spec-edit="${t.id}">编辑</button>
      <button class="btn sm ghost danger" data-spec-del="${t.id}">删除</button>` : ''}
    </div>`).join('') || '<div class="empty">暂无规范模板，点击右上角「新建规范」创建</div>';
  $$('#spec-list [data-spec-edit]').forEach((b) => (b.onclick = () => openSpecModal(Number(b.dataset.specEdit))));
  $$('#spec-list [data-spec-del]').forEach((b) => (b.onclick = async () => {
    if (!await confirmModal('删除规范模板？', '删除后已绑定项目将不再显示该规范。', '删除')) return;
    await api(`/api/spec-templates/${b.dataset.specDel}`, { method: 'DELETE' });
    toast('已删除', 'ok');
    refreshSpecManager();
  }));
  $$('#spec-list [data-spec-bind]').forEach((s) => (s.onchange = async () => {
    if (!s.value) return;
    await api(`/api/projects/${s.value}`, { method: 'PATCH', body: { spec_id: Number(s.dataset.specBind) } });
    toast('已绑定到项目，标注工作台将实时展示该规范', 'ok');
    s.value = '';
  }));
}

function dbMODALITY(m) { return ({ audio: '语音', image: '图片', video: '视频', text: '文本', pointcloud: '点云', multimodal: '多模态', llm: '大模型', pdf: 'PDF' })[m] || m; }

async function openSpecModal(id) {
  const t = id ? await api(`/api/spec-templates/${id}`) : { name: '', modality: '', content: '', samples: [] };
  openModal(`<div class="modal-head"><h3>${id ? '编辑规范模板' : '新建规范模板'}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>模板名称</label><input class="input" id="sp-name" value="${esc(t.name)}" placeholder="例如：人车流量检测标注规范" /></div>
      <div class="field"><label>适用模态</label><select class="select" id="sp-modality">${['', 'image', 'audio', 'video', 'text', 'pointcloud'].map((m) => `<option value="${m}" ${t.modality === m ? 'selected' : ''}>${m ? dbMODALITY(m) : '通用'}</option>`).join('')}</select></div>
      <div class="field full"><label>规范条文（每行一条，工作台实时展示）</label><textarea class="input textarea" id="sp-content" rows="8" placeholder="1. 目标框需贴合目标边缘，误差不超过 2 像素&#10;2. 遮挡超过 50% 的目标标记为遮挡属性&#10;3. …">${esc(t.content)}</textarea></div>
      <div class="field full"><label>示例截图 / 规范文档（可上传多张）</label>
        <div id="sp-samples" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${(t.samples || []).map((s, i) => `<span style="position:relative"><img src="${esc(s.url)}" style="width:84px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" title="${esc(s.name)}" />
            <button class="x" data-sp-del-sample="${i}" style="position:absolute;top:-6px;right:-6px;background:#EF4444;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer">×</button></span>`).join('')}
        </div>
        <input type="file" id="sp-file" accept="image/*,application/pdf" />
      </div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button>
      ${id ? '<button class="btn danger" id="sp-del">删除</button>' : ''}
      <button class="btn primary" id="sp-save">保存模板</button></div>`, 'wide');
  let samples = (t.samples || []).slice();
  const fileInput = $('#sp-file');
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (!id) return toast('请先保存模板，再上传示例附件', 'warn');
    const fd = new FormData(); fd.append('file', f);
    const r = await api(`/api/spec-templates/${id}/attachment`, { method: 'POST', body: fd });
    samples.push({ name: r.name, url: r.url });
    openSpecModalRefreshSamples(samples);
  };
  const openSpecModalRefreshSamples = (ss) => {
    const box = $('#sp-samples');
    if (box) box.innerHTML = ss.map((s, i) => `<span style="position:relative"><img src="${esc(s.url)}" style="width:84px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" title="${esc(s.name)}" /></span>`).join('');
  };
  $('#sp-save').onclick = async () => {
    const body = {
      name: $('#sp-name').value.trim(),
      modality: $('#sp-modality').value,
      content: $('#sp-content').value,
      samples,
    };
    if (!body.name) return toast('请填写模板名称', 'warn');
    if (id) await api(`/api/spec-templates/${id}`, { method: 'PATCH', body });
    else await api('/api/spec-templates', { method: 'POST', body });
    closeModal(); toast('规范模板已保存', 'ok');
    specCache.clear();
    refreshSpecManager();
  };
  const delBtn = $('#sp-del');
  if (delBtn) delBtn.onclick = async () => {
    if (!await confirmModal('删除规范模板？', '删除后不可恢复。', '删除')) return;
    await api(`/api/spec-templates/${id}`, { method: 'DELETE' });
    closeModal(); toast('已删除', 'ok'); specCache.clear(); refreshSpecManager();
  };
  document.querySelectorAll('[data-sp-del-sample]').forEach((b) => {
    b.onclick = () => { samples.splice(Number(b.dataset.spDelSample), 1); openSpecModalRefreshSamples(samples); };
  });
}

function templateDetail(id) {
  const t = (state.templates || []).find((x) => x.id === id);
  if (!t) return;
  openModal(`
    <div class="modal-head"><h3>${esc(t.name)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="chip-row"><span class="chip info">${esc(t.modality_label)}</span><span class="chip plain mono">${esc(t.code)}</span>${t.builtin ? '<span class="chip purple">内置模板</span>' : ''}</div>
      <div class="divider"></div>
      <div class="field"><label>标注说明</label><div class="hint" style="line-height:1.8">${esc(t.instruction || '未填写')}</div></div>
      ${Object.entries(t.labels || {}).map(([g, vals]) => `<div class="field"><label>${esc(g)}</label><div class="chip-row">${vals.map((v) => `<span class="chip plain">${esc(v)}</span>`).join('')}</div></div>`).join('')}
      <div class="divider"></div>
      <div class="form-grid">
        <div class="kv"><span>抽审比例</span><b>${t.qc.sample_rate ?? 100}%</b></div>
        <div class="kv"><span>及格分</span><b>${t.qc.min_score ?? 0}</b></div>
        <div class="kv"><span>返修上限</span><b>${t.qc.max_rework ?? '-'}</b></div>
        <div class="kv"><span>返修必填意见</span><b>${t.qc.require_comment ? '是' : '否'}</b></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>关闭</button>${can('template.write') ? '<button class="btn primary" id="tpl-edit">编辑模板</button>' : ''}</div>`);
  const ed = $('#tpl-edit');
  if (ed) ed.onclick = () => editTemplateModal(t);
}

function newTemplateModal() {
  openModal(`
    <div class="modal-head"><h3>新建标注模板</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>模板名称</label><input class="input" id="nt-name" placeholder="例如 保险回访语音质检" /></div>
      <div class="field"><label>数据类型</label><select class="select" id="nt-modality"><option value="audio">语音</option><option value="image">图片</option><option value="video">视频</option><option value="pointcloud">点云</option></select></div>
      <div class="field full"><label>描述</label><input class="input" id="nt-desc" placeholder="模板适用场景" /></div>
      <div class="field full"><label>标签配置（JSON，分组 → 标签数组）</label><textarea class="input textarea mono" id="nt-labels" style="min-height:110px">{"业务分类":["咨询","投诉"],"情绪":["中性","不满"]}</textarea></div>
      <div class="field full"><label>标注说明</label><textarea class="input textarea" id="nt-instruction" placeholder="标注规范与注意事项"></textarea></div>
      <div class="field"><label>抽审比例 %</label><input class="input" id="nt-sample" type="number" value="30" /></div>
      <div class="field"><label>及格分</label><input class="input" id="nt-score" type="number" value="80" /></div>
      <div class="field"><label>返修上限</label><input class="input" id="nt-rework" type="number" value="2" /></div>
      <div class="field"><label>返修必填意见</label><select class="select" id="nt-comment"><option value="1">是</option><option value="0">否</option></select></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="nt-ok">创建模板</button></div>`);
  $('#nt-ok').onclick = async () => {
    let labels;
    try { labels = JSON.parse($('#nt-labels').value); } catch (e) { return toast('标签配置不是合法 JSON', 'err'); }
    try {
      await api('/api/templates', { method: 'POST', body: {
        name: $('#nt-name').value.trim(), modality: $('#nt-modality').value, description: $('#nt-desc').value.trim(),
        labels, instruction: $('#nt-instruction').value.trim(),
        qc: { sample_rate: Number($('#nt-sample').value), min_score: Number($('#nt-score').value), max_rework: Number($('#nt-rework').value), require_comment: $('#nt-comment').value === '1' },
      } });
      closeModal(); toast('模板已创建', 'ok'); pageTemplates();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function editTemplateModal(t) {
  openModal(`
    <div class="modal-head"><h3>编辑模板 · ${esc(t.name)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>模板名称</label><input class="input" id="et-name" value="${esc(t.name)}" /></div>
      <div class="field"><label>描述</label><input class="input" id="et-desc" value="${esc(t.description || '')}" /></div>
      <div class="field full"><label>标签配置（JSON）</label><textarea class="input textarea mono" id="et-labels" style="min-height:110px">${esc(JSON.stringify(t.labels || {}, null, 2))}</textarea></div>
      <div class="field full"><label>标注说明</label><textarea class="input textarea" id="et-instruction">${esc(t.instruction || '')}</textarea></div>
      <div class="field"><label>抽审比例 %</label><input class="input" id="et-sample" type="number" value="${t.qc.sample_rate ?? 100}" /></div>
      <div class="field"><label>及格分</label><input class="input" id="et-score" type="number" value="${t.qc.min_score ?? 80}" /></div>
      <div class="field"><label>返修上限</label><input class="input" id="et-rework" type="number" value="${t.qc.max_rework ?? 2}" /></div>
      <div class="field"><label>返修必填意见</label><select class="select" id="et-comment"><option value="1" ${t.qc.require_comment ? 'selected' : ''}>是</option><option value="0" ${!t.qc.require_comment ? 'selected' : ''}>否</option></select></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="et-ok">保存模板</button></div>`);
  $('#et-ok').onclick = async () => {
    let labels;
    try { labels = JSON.parse($('#et-labels').value); } catch (e) { return toast('标签配置不是合法 JSON', 'err'); }
    try {
      await api(`/api/templates/${t.id}`, { method: 'PATCH', body: {
        name: $('#et-name').value.trim(), description: $('#et-desc').value.trim(), instruction: $('#et-instruction').value.trim(),
        labels, qc: { sample_rate: Number($('#et-sample').value), min_score: Number($('#et-score').value), max_rework: Number($('#et-rework').value), require_comment: $('#et-comment').value === '1' },
      } });
      closeModal(); toast('模板已更新', 'ok'); pageTemplates();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function applyTemplateModal(id) {
  const t = (state.templates || []).find((x) => x.id === id);
  openModal(`
    <div class="modal-head"><h3>应用模板 · ${esc(t ? t.name : '')}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <p class="hint" style="line-height:1.8">应用后将覆盖目标项目的标签配置，并同步该项目的质检策略。请确认数据类型一致。</p>
      <div class="field"><label>目标项目</label><select class="select" id="at-proj">
        ${state.projects.map((p) => `<option value="${p.id}">${esc(p.name)} · ${esc(p.modality_label)}</option>`).join('')}</select></div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="at-ok">确认应用</button></div>`);
  $('#at-ok').onclick = async () => {
    try {
      await api(`/api/projects/${$('#at-proj').value}/apply-template`, { method: 'POST', body: { template_id: id } });
      closeModal(); toast('模板已应用到项目', 'ok'); pageTemplates();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 工作流 ---------------- */
async function pageWorkflows() {
  const [w, p, t, tasks] = await Promise.all([api('/api/workflows'), api('/api/projects'), api('/api/templates'), api('/api/tasks')]);
  state.workflows = w.workflows || [];
  state.projects = p.projects;
  state.templates = t.templates || [];
  state.tasks = tasks.tasks || [];
  const totalTask = state.workflows.reduce((s, x) => s + (x.task_count || 0), 0);
  const totalDone = state.workflows.reduce((s, x) => s + (x.done_count || 0), 0);
  const content = `
    <div class="page-head"><div><h1 class="page-title">任务工作流与质检策略</h1><p class="page-sub">流程绑定任务，按抽审比例、及格分与返修上限自动流转</p></div>
      <div class="page-actions">
        ${can('task.review') ? '<button class="btn" id="wf-sample">抽审任务</button>' : ''}
        ${can('workflow.write') ? `<button class="btn primary" id="wf-new">${icon('plus')} 新建流程</button>` : ''}</div></div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">${icon('spark')} 工作流</div><div class="kpi-value">${state.workflows.length}</div><div class="kpi-delta">可绑定到任务</div></div>
      <div class="kpi"><div class="kpi-label">${icon('tasks')} 覆盖任务</div><div class="kpi-value">${totalTask}</div><div class="kpi-delta">项目内任务</div></div>
      <div class="kpi"><div class="kpi-label">${icon('check')} 已完成</div><div class="kpi-value">${totalDone}</div><div class="kpi-delta">质检通过或自动通过</div></div>
      <div class="kpi"><div class="kpi-label">${icon('shield')} 待复核</div><div class="kpi-value">${totalTask - totalDone}</div><div class="kpi-delta">含抽审与返修</div></div>
    </div>
    <div class="card"><div class="card-head"><h3 class="card-title">流程清单</h3><span class="card-sub">${state.workflows.length} 条</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>流程</th><th>项目 / 模板</th><th>步骤</th><th>质检策略</th><th>进度</th><th class="right">操作</th></tr></thead><tbody>
      ${state.workflows.map((x) => {
        const q = x.qc_policy || {};
        const pct = x.task_count ? Math.round((x.done_count || 0) / x.task_count * 100) : 0;
        return `<tr><td><div class="name">${esc(x.name)}</div><div class="sub">${esc(x.description || '')}</div></td>
          <td><div>${esc(x.project_name || '全局')}</div><div class="sub">${esc(x.template_name || '默认模板')}</div></td>
          <td><div class="flow-steps">${(x.steps || []).map((s, i) => `${i ? '<i>→</i>' : ''}<span>${esc(s)}</span>`).join('')}</div></td>
          <td><div class="chip-row"><span class="chip info">抽审 ${q.sample_rate ?? 100}%</span><span class="chip plain">及格 ${q.min_score ?? 0}</span><span class="chip plain">返修 ≤${q.max_rework ?? '-'}</span></div></td>
          <td style="min-width:110px"><div class="progress"><i style="width:${pct}%"></i></div><div class="sub">${x.done_count || 0}/${x.task_count || 0}</div></td>
          <td class="right"><button class="btn sm" data-wf-edit="${x.id}">编辑</button>
            ${can('workflow.write') ? `<button class="btn sm" data-wf-bind="${x.id}">绑定任务</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="6"><div class="empty">暂无工作流</div></td></tr>'}
      </tbody></table></div></div>`;
  mount('workflows', '工作流', content);
  $$('[data-wf-edit]').forEach((b) => (b.onclick = () => workflowModal(Number(b.dataset.wfEdit))));
  $$('[data-wf-bind]').forEach((b) => (b.onclick = () => bindWorkflowModal(Number(b.dataset.wfBind))));
  const nb = $('#wf-new');
  if (nb) nb.onclick = () => workflowModal(0);
  const sb = $('#wf-sample');
  if (sb) sb.onclick = sampleModal;
}

function workflowModal(id) {
  const w = id ? (state.workflows || []).find((x) => x.id === id) : null;
  const q = (w && w.qc_policy) || { sample_rate: 30, min_score: 80, max_rework: 2, require_comment: true };
  openModal(`
    <div class="modal-head"><h3>${w ? '编辑工作流' : '新建工作流'}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>流程名称</label><input class="input" id="wf-name" value="${esc(w ? w.name : '')}" placeholder="例如 语音质检双人复核" /></div>
      <div class="field"><label>绑定项目</label><select class="select" id="wf-proj"><option value="0">全局流程</option>
        ${state.projects.map((p) => `<option value="${p.id}" ${w && w.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>关联模板</label><select class="select" id="wf-tpl"><option value="0">默认标签配置</option>
        ${state.templates.map((t) => `<option value="${t.id}" ${w && w.template_id === t.id ? 'selected' : ''}>${esc(t.name)}（${esc(t.modality_label)}）</option>`).join('')}</select></div>
      <div class="field"><label>步骤（逗号分隔）</label><input class="input" id="wf-steps" value="${esc(w ? (w.steps || []).join('，') : '标注，自检，抽审，返修，交付')}" /></div>
      <div class="field"><label>抽审比例 %</label><input class="input" id="wf-sample" type="number" value="${q.sample_rate ?? 30}" /></div>
      <div class="field"><label>及格分</label><input class="input" id="wf-score" type="number" value="${q.min_score ?? 80}" /></div>
      <div class="field"><label>返修上限</label><input class="input" id="wf-rework" type="number" value="${q.max_rework ?? 2}" /></div>
      <div class="field"><label>返修必填意见</label><select class="select" id="wf-comment"><option value="1" ${q.require_comment ? 'selected' : ''}>是</option><option value="0" ${!q.require_comment ? 'selected' : ''}>否</option></select></div>
      <div class="field full"><label>流程说明</label><textarea class="input textarea" id="wf-desc">${esc(w ? w.description || '' : '')}</textarea></div>
    </div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="wf-ok">${w ? '保存修改' : '创建流程'}</button></div>`);
  $('#wf-ok').onclick = async () => {
    const body = {
      name: $('#wf-name').value.trim(), project_id: Number($('#wf-proj').value),
      template_id: Number($('#wf-tpl').value) || 0,
      description: $('#wf-desc').value.trim(),
      steps: $('#wf-steps').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      qc_policy: { sample_rate: Number($('#wf-sample').value), min_score: Number($('#wf-score').value), max_rework: Number($('#wf-rework').value), require_comment: $('#wf-comment').value === '1' },
    };
    try {
      if (w) await api(`/api/workflows/${w.id}`, { method: 'PATCH', body });
      else await api('/api/workflows', { method: 'POST', body });
      closeModal(); toast(w ? '流程已更新' : '流程已创建', 'ok'); pageWorkflows();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function bindWorkflowModal(wid) {
  const w = (state.workflows || []).find((x) => x.id === wid);
  const tasks = (state.tasks || []).filter((t) => !w.project_id || t.project_id === w.project_id);
  openModal(`
    <div class="modal-head"><h3>绑定任务 · ${esc(w.name)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="field"><label>选择任务</label><select class="select" id="bw-task">
      ${tasks.map((t) => `<option value="${t.id}">${esc(t.project_name || '')} · ${esc(t.name)} · ${esc(t.status_label || t.status)}</option>`).join('')}</select></div>
      <div class="hint">绑定后该任务提交时将按此流程的抽审策略决定是否需要质检。</div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="bw-ok">绑定</button></div>`);
  $('#bw-ok').onclick = async () => {
    try {
      await api(`/api/tasks/${$('#bw-task').value}/workflow`, { method: 'POST', body: { workflow_id: wid } });
      closeModal(); toast('任务已绑定流程', 'ok'); pageWorkflows();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function sampleModal() {
  openModal(`
    <div class="modal-head"><h3>执行抽审</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <p class="hint" style="line-height:1.8">对待质检任务按比例标记抽审，未命中的任务可由策略自动通过。实际提交时也会按流程策略自动判定。</p>
      <div class="form-grid">
        <div class="field"><label>项目范围</label><select class="select" id="qs-proj"><option value="0">全部可见项目</option>
          ${state.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>抽审比例 %</label><input class="input" id="qs-percent" type="number" value="30" /></div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="qs-ok">执行抽审</button></div>`);
  $('#qs-ok').onclick = async () => {
    try {
      const r = await api('/api/qc/sample', { method: 'POST', body: { project_id: Number($('#qs-proj').value), percent: Number($('#qs-percent').value) } });
      closeModal(); toast(`已抽审 ${r.sampled}/${r.total} 个任务`, 'ok'); pageWorkflows();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 组织架构 / RBAC ---------------- */
async function pageOrg() {
  const [tree, mx] = await Promise.all([api('/api/org/tree'), api('/api/rbac/matrix')]);
  state.orgTree = tree; state.matrix = mx;
  const isAdmin = can('org.write');
  const isPlatformAdmin = state.user && state.user.platform_role === 'platform_admin';
  const orgs = (tree.tenants || []).flatMap((t) => t.orgs || []);
  const teams = orgs.flatMap((o) => o.teams || []);
  const content = `
    <div class="page-head"><div><h1 class="page-title">组织架构与权限</h1><p class="page-sub">多租户隔离，组织 → 团队 → 成员三层结构，RBAC 权限矩阵可按角色配置</p></div>
      <div class="page-actions">
        ${isPlatformAdmin ? `<button class="btn" id="org-add-tenant">新增租户</button>` : ''}
        ${isAdmin ? `<button class="btn" id="org-add-org">新增组织</button>
        <button class="btn primary" id="org-add-team">${icon('plus')} 新增团队</button>` : ''}</div></div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">租户</div><div class="kpi-value">${(tree.tenants || []).length}</div><div class="kpi-delta">逻辑隔离</div></div>
      <div class="kpi"><div class="kpi-label">组织</div><div class="kpi-value">${orgs.length}</div><div class="kpi-delta">含上下级</div></div>
      <div class="kpi"><div class="kpi-label">团队</div><div class="kpi-value">${teams.length}</div><div class="kpi-delta">标注 / 质检小组</div></div>
      <div class="kpi"><div class="kpi-label">成员</div><div class="kpi-value">${(tree.members || []).length}</div><div class="kpi-delta">平台账号</div></div>
    </div>
    <div class="grid two-col">
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        ${(tree.tenants || []).map((t) => `<div class="card"><div class="card-head"><h3 class="card-title">${esc(t.name)} <span class="tag mono">${esc(t.code)}</span></h3><span class="card-sub">${t.member_count} 人</span></div>
          <div class="card-body"><div class="org-list">
            ${(t.orgs || []).map((o) => `<div class="org-node">
              <div class="org-head"><b>${esc(o.name)}</b><span class="tag">${esc(o.code)}</span><span class="hint">负责人 ${esc(o.manager_name || '未设置')} · ${o.member_count} 人</span></div>
              <div class="team-list">${(o.teams || []).map((tm) => `<div class="team-node"><b>${esc(tm.name)}</b><span class="hint">${esc(tm.description || '')}</span>
                <div class="chip-row">${(tm.members || []).map((m) => `<span class="chip plain">${esc(m.name)}${m.team_role === 'leader' ? ' · 组长' : ''}</span>`).join('') || '<span class="hint">暂无成员</span>'}</div></div>`).join('') || '<span class="hint">暂无团队</span>'}</div>
            </div>`).join('')}
          </div></div></div>`).join('')}
        <div class="card"><div class="card-head"><h3 class="card-title">成员归属</h3><span class="card-sub">${(tree.members || []).length} 人</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>成员</th><th>平台角色</th><th>所属团队</th><th class="right">操作</th></tr></thead><tbody>
          ${(tree.members || []).map((m) => `<tr><td><div class="name">${esc(m.name)}</div><div class="sub mono">${esc(m.username)}</div></td>
            <td><span class="chip info">${esc(m.role_label)}</span></td><td>${esc(m.team_name || '未分配')}</td>
            <td class="right">${isAdmin ? `<button class="btn sm" data-scope="${m.id}">调整归属</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div></div>
      </div>
      <div class="card"><div class="card-head"><h3 class="card-title">RBAC 权限矩阵</h3><span class="card-sub">${isPlatformAdmin ? '点击勾选即时保存' : '只读'}</span></div>
        <div class="table-wrap" style="max-height:640px"><table class="table matrix"><thead><tr><th>权限点</th>
          ${mx.roles.map((r) => `<th class="center">${esc(r.label)}</th>`).join('')}</tr></thead><tbody>
          ${mx.permissions.map((p) => `<tr><td><div>${esc(p.label)}</div><div class="sub mono">${esc(p.key)}</div></td>
            ${mx.roles.map((r) => `<td class="center"><input type="checkbox" data-role="${r.key}" data-perm="${p.key}" ${(mx.matrix[r.key] || {})[p.key] ? 'checked' : ''} ${isPlatformAdmin && r.key !== 'platform_admin' ? '' : 'disabled'} /></td>`).join('')}
          </tr>`).join('')}
        </tbody></table></div></div>
    </div>`;
  mount('org', '组织架构', content);
  $$('[data-scope]').forEach((b) => (b.onclick = () => userScopeModal((tree.members || []).find((m) => m.id === Number(b.dataset.scope)))));
  $$('input[data-role]').forEach((cb) => {
    cb.onchange = async () => {
      try {
        await api('/api/rbac/matrix', { method: 'POST', body: { role: cb.dataset.role, permission: cb.dataset.perm, allowed: cb.checked } });
        toast('权限已更新', 'ok');
      } catch (err) { cb.checked = !cb.checked; toast(err.message, 'err'); }
    };
  });
  const at = $('#org-add-tenant'); if (at) at.onclick = tenantModal;
  const ao = $('#org-add-org'); if (ao) ao.onclick = orgModal;
  const atm = $('#org-add-team'); if (atm) atm.onclick = teamModal;
}

function tenantModal() {
  openModal(`<div class="modal-head"><h3>新增租户</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>租户名称 <span style="color:#EF4444">*</span></label><input class="input" id="tn-name" placeholder="如 华东数据服务有限公司" /></div>
      <div class="field"><label>租户编码</label><input class="input" id="tn-code" placeholder="留空由系统自动生成，如 T20261112-01" /></div>
      <div class="field"><label>管理员姓名</label><input class="input" id="tn-admin-name" placeholder="如 张伟" /></div>
      <div class="field"><label>管理员账号 <span style="color:#EF4444">*</span></label><input class="input" id="tn-admin-user" placeholder="登录账号，如 hd_admin" autocomplete="off" /></div>
      <div class="field full"><label>初始密码 <span style="color:#EF4444">*</span></label><input class="input" id="tn-admin-pass" type="text" value="chunke123" autocomplete="off" />
        <div class="hint">该账号将以「租户管理员」身份登录，只能查看和管理本租户的组织、团队与成员。</div></div>
    </div></div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="tn-ok">创建</button></div>`);
  $('#tn-ok').onclick = async () => {
    const name = $('#tn-name').value.trim();
    const username = $('#tn-admin-user').value.trim();
    const password = $('#tn-admin-pass').value.trim();
    if (!name) return toast('请填写租户名称', 'err');
    if (!username || !password) return toast('请设置管理员账号和初始密码', 'err');
    try {
      const r = await api('/api/tenants', { method: 'POST', body: {
        name, code: $('#tn-code').value.trim(),
        admin_name: $('#tn-admin-name').value.trim(),
        admin_username: username, admin_password: password,
      } });
      closeModal();
      toast(`租户已创建，编码 ${r.code}，管理员 ${username} 可直接登录`, 'ok');
      pageOrg();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function orgModal() {
  const t = state.orgTree.tenants[0];
  openModal(`<div class="modal-head"><h3>新增组织</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>所属租户</label><select class="select" id="og-tenant">${state.orgTree.tenants.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
      <div class="field"><label>组织名称</label><input class="input" id="og-name" /></div>
      <div class="field"><label>组织编码</label><input class="input" id="og-code" placeholder="north" /></div>
      <div class="field"><label>负责人</label><select class="select" id="og-manager"><option value="0">暂不设置</option>${state.orgTree.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
    </div></div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="og-ok">创建</button></div>`);
  $('#og-ok').onclick = async () => {
    try {
      await api('/api/orgs', { method: 'POST', body: { tenant_id: Number($('#og-tenant').value), name: $('#og-name').value.trim(), code: $('#og-code').value.trim(), manager_id: Number($('#og-manager').value) } });
      closeModal(); toast('组织已创建', 'ok'); pageOrg();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function teamModal() {
  const orgs = (state.orgTree.tenants || []).flatMap((t) => t.orgs || []);
  openModal(`<div class="modal-head"><h3>新增团队</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>所属组织</label><select class="select" id="tm-org">${orgs.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></div>
      <div class="field"><label>团队名称</label><input class="input" id="tm-name" /></div>
      <div class="field"><label>团队编码</label><input class="input" id="tm-code" placeholder="voice-team-2" /></div>
      <div class="field"><label>组长</label><select class="select" id="tm-leader"><option value="0">暂不设置</option>${state.orgTree.members.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div class="field full"><label>团队说明</label><input class="input" id="tm-desc" /></div>
    </div></div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="tm-ok">创建</button></div>`);
  $('#tm-ok').onclick = async () => {
    try {
      await api('/api/teams', { method: 'POST', body: { org_id: Number($('#tm-org').value), name: $('#tm-name').value.trim(), code: $('#tm-code').value.trim(), leader_id: Number($('#tm-leader').value), description: $('#tm-desc').value.trim() } });
      closeModal(); toast('团队已创建', 'ok'); pageOrg();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function userScopeModal(m) {
  const orgs = (state.orgTree.tenants || []).flatMap((t) => t.orgs || []);
  const teams = orgs.flatMap((o) => o.teams || []);
  openModal(`<div class="modal-head"><h3>调整归属 · ${esc(m.name)}</h3><button class="x" data-close>×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>租户</label><select class="select" id="us-tenant">${state.orgTree.tenants.map((t) => `<option value="${t.id}" ${m.tenant_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label>组织</label><select class="select" id="us-org"><option value="0">无</option>${orgs.map((o) => `<option value="${o.id}" ${m.org_id === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>
      <div class="field full"><label>团队</label><select class="select" id="us-team"><option value="0">无</option>${teams.map((t) => `<option value="${t.id}" ${m.team_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
    </div></div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="us-ok">保存</button></div>`);
  $('#us-ok').onclick = async () => {
    try {
      await api(`/api/org/users/${m.id}`, { method: 'PATCH', body: { tenant_id: Number($('#us-tenant').value), org_id: Number($('#us-org').value), team_id: Number($('#us-team').value) } });
      closeModal(); toast('归属已更新', 'ok'); pageOrg();
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------------- 开放平台 ---------------- */
async function pageOpenapi() {
  const [k, sec, spec, audit] = await Promise.all([api('/api/api-keys'), api('/api/security/overview'), api('/api/openapi/spec'), api('/api/audit')]);
  state.apiKeys = k.keys || [];
  const s = sec.summary || {};
  const content = `
    <div class="page-head"><div><h1 class="page-title">开放平台</h1><p class="page-sub">OpenAPI v1 · API Key 鉴权 · 调用审计与安全监控</p></div>
      <div class="page-actions">${can('api.write') ? `<button class="btn primary" id="key-new">${icon('plus')} 创建 API Key</button>` : ''}</div></div>
    <div class="grid kpi-grid" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">${icon('key')} 活跃密钥</div><div class="kpi-value">${s.keys_active || 0}</div><div class="kpi-delta">共 ${s.keys_total || 0} 个</div></div>
      <div class="kpi"><div class="kpi-label">${icon('arrow')} 累计调用</div><div class="kpi-value">${s.requests || 0}</div><div class="kpi-delta">最近 7 天趋势</div></div>
      <div class="kpi"><div class="kpi-label">${icon('shield')} 错误率</div><div class="kpi-value">${s.error_rate || 0}%</div><div class="kpi-delta warn">${s.errors || 0} 次异常</div></div>
      <div class="kpi"><div class="kpi-label">${icon('bell')} 安全事件</div><div class="kpi-value">${s.blocked || 0}</div><div class="kpi-delta warn">失败登录 / 无效密钥</div></div>
    </div>
    <div class="grid two-col">
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-head"><h3 class="card-title">API 密钥</h3><span class="card-sub">密钥仅创建时显示一次</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>名称</th><th>前缀</th><th>范围</th><th>调用</th><th>状态</th><th class="right">操作</th></tr></thead><tbody>
          ${state.apiKeys.map((x) => `<tr><td><div class="name">${esc(x.name)}</div><div class="sub">${esc(x.last_used_at || '未使用')}</div></td>
            <td class="mono">${esc(x.key_prefix)}…</td><td>${x.scopes.map((sc) => `<span class="chip plain">${esc(sc)}</span>`).join(' ')}</td>
            <td>${x.request_count}</td>
            <td><span class="chip ${x.status === 'active' ? 'done' : 'danger'}">${x.status === 'active' ? '启用' : '已吊销'}</span></td>
            <td class="right">${x.status === 'active' && can('api.write') ? `<button class="btn sm danger" data-revoke="${x.id}">吊销</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">暂无密钥，点击右上角创建</div></td></tr>'}
          </tbody></table></div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">接口文档</h3><span class="card-sub">OpenAPI ${esc(spec.info.version)}</span></div>
          <div class="card-body">
            <div class="hint" style="line-height:1.8;margin-bottom:10px">${esc(spec.info.description)}</div>
            <div class="endpoint-list">${Object.entries(spec.paths).map(([path, ops]) => Object.keys(ops).map((m) => `<div class="endpoint"><span class="method ${m}">${m.toUpperCase()}</span><code>${esc(path)}</code><span class="hint">${esc(ops[m].summary || '')}</span></div>`).join('')).join('')}</div>
            <div class="divider"></div>
            <div class="section-label" style="font-size:12px;color:var(--muted);margin-bottom:6px">调用示例</div>
            <pre class="code-block">curl -H "X-API-Key: ck_live_xxx" \\\n  ${location.origin}/api/v1/tasks?limit=10</pre>
          </div></div>
      </div>
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><div class="card-head"><h3 class="card-title">调用趋势</h3><span class="card-sub">近 7 天</span></div>
          <div class="card-body"><div class="spark-bars">
            ${(sec.trend || []).map((d) => `<div class="spark-col"><span>${d.total}</span><i style="height:${Math.max(4, Math.min(100, d.total * 12 + d.errors * 6))}%"></i><em>${esc(d.day)}</em></div>`).join('')}
          </div>
          <div class="chip-row">${(sec.top_keys || []).map((x) => `<span class="chip plain">${esc(x.key_name || '匿名')} · ${x.c}</span>`).join('') || '<span class="hint">暂无调用</span>'}</div></div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">安全事件</h3><span class="card-sub">最近 40 条</span></div>
          <div class="audit" style="max-height:240px;overflow:auto">
            ${(sec.events || []).map((e) => `<div class="row"><span class="time">${esc((e.created_at || '').slice(5, 16))}</span><span><b>${esc(e.kind)}</b> <span class="sev ${esc(e.severity)}">${esc(e.severity)}</span> ${esc(e.actor)} <span style="color:#64748B">${esc(e.ip)}</span> ${esc(e.detail)}</span></div>`).join('') || '<div class="hint">暂无安全事件</div>'}
          </div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">最近调用</h3><span class="card-sub">30 条</span></div>
          <div class="audit" style="max-height:240px;overflow:auto">
            ${(sec.requests || []).map((r) => `<div class="row"><span class="time">${esc((r.created_at || '').slice(5, 16))}</span><span><b>${esc(r.method)}</b> ${esc(r.path)} <span class="chip ${r.status_code >= 400 ? 'danger' : 'done'}">${r.status_code}</span> ${r.latency_ms}ms · ${esc(r.key_name || '匿名')}</span></div>`).join('') || '<div class="hint">暂无调用记录</div>'}
          </div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">操作审计</h3><span class="card-sub">最近 60 条</span></div>
          <div class="audit" style="max-height:240px;overflow:auto">
            ${audit.logs.map((l) => `<div class="row"><span class="time">${esc((l.created_at || '').slice(5, 16))}</span><span><b>${esc(l.actor_name || '系统')}</b> ${esc(l.action)} <span style="color:#64748B">${esc(l.target)}</span> ${esc(l.detail)}</span></div>`).join('') || '<div class="hint">暂无记录</div>'}
          </div></div>
      </div>
    </div>`;
  mount('openapi', '开放平台', content);
  const nb = $('#key-new'); if (nb) nb.onclick = newKeyModal;
  $$('[data-revoke]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmModal('吊销密钥', '吊销后使用该密钥的集成将立即失效，且不可恢复。', '确认吊销', true))) return;
    try { await api(`/api/api-keys/${b.dataset.revoke}/revoke`, { method: 'POST' }); toast('密钥已吊销', 'ok'); pageOpenapi(); }
    catch (err) { toast(err.message, 'err'); }
  }));
}

function newKeyModal() {
  openModal(`<div class="modal-head"><h3>创建 API Key</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <div class="field"><label>密钥名称</label><input class="input" id="ak-name" placeholder="例如 训练平台同步" /></div>
      <div class="field"><label>权限范围</label><div class="chip-row">
        <label class="chip info"><input type="checkbox" id="ak-read" checked /> read 读取</label>
        <label class="chip purple"><input type="checkbox" id="ak-write" checked /> write 写入</label>
        <label class="chip danger"><input type="checkbox" id="ak-admin" /> admin 管理</label>
      </div></div>
      <div class="hint">密钥用于服务端调用 /api/v1/*，请存放在环境变量中，不要写入前端代码。</div>
    </div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="ak-ok">创建密钥</button></div>`);
  $('#ak-ok').onclick = async () => {
    const scopes = [];
    if ($('#ak-read').checked) scopes.push('read');
    if ($('#ak-write').checked) scopes.push('write');
    if ($('#ak-admin').checked) scopes.push('admin');
    try {
      const r = await api('/api/api-keys', { method: 'POST', body: { name: $('#ak-name').value.trim(), scopes } });
      showKeyModal(r.key);
    } catch (err) { toast(err.message, 'err'); }
  };
}

function showKeyModal(key) {
  openModal(`<div class="modal-head"><h3>API Key 已创建</h3><button class="x" data-close>×</button></div>
    <div class="modal-body">
      <p class="hint" style="line-height:1.8">请立即复制并妥善保存，关闭后将无法再次查看完整密钥。</p>
      <div class="key-box"><code id="ak-key">${esc(key)}</code><button class="btn sm" id="ak-copy">复制</button></div>
      <pre class="code-block">curl -H "X-API-Key: ${esc(key)}" \\\n  ${location.origin}/api/v1/projects</pre>
    </div><div class="modal-foot"><button class="btn primary" data-close>我已保存</button></div>`);
  $('#ak-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(key); toast('已复制到剪贴板', 'ok'); }
    catch (e) { toast('复制失败，请手动选择', 'err'); }
  };
}

/* ---------------- 启动 ---------------- */
async function boot() {
  try {
    const [b, ctx] = await Promise.all([api('/api/bootstrap'), api('/api/context')]);
    state.user = b.user;
    state.permissions = b.permissions || [];
    state.projects = b.projects;
    state.engines = b.engines;
    state.settings = b.settings;
    state.counts = b.counts;
    state.preferences = b.preferences || {};
    state.notifications = b.notifications || {};
    state.context = ctx;
    state.space = ctx.space || 'project';
    state.pid = ctx.projects && ctx.projects[0] ? ctx.projects[0].id : 0;
    window.CK_STATE = state;
    applyBrand(b.brand, b.notifications);
    document.documentElement.dataset.lang = state.preferences.language || 'zh';
    if (!location.hash || location.hash === '#') {
      const prefix = state.space === 'project' ? `/project/${state.pid}` : `/${state.space}`;
      location.hash = `#${prefix}/dashboard`;
    }
    await route();
  } catch (err) {
    if (err.message === '请先登录') renderLogin();
    else {
      $('#app').innerHTML = `<div class="boot-screen"><div style="text-align:center"><b>加载失败</b><div class="hint" style="margin-top:6px">${esc(err.message)}</div></div></div>`;
    }
  }
}

function applyBrand(brand, notifications) {
  if (brand) {
    if (brand.color) document.documentElement.style.setProperty('--primary', brand.color);
    if (brand.name) document.title = brand.name;
    const short = $('.brand-text b');
    if (short && brand.short) short.textContent = brand.short;
    const loginTitle = $('#login-org');
    if (loginTitle && brand.name) loginTitle.textContent = brand.name;
  }
  document.querySelectorAll('.ck-watermark').forEach((el) => el.remove());
  if (brand && brand.watermark && state.user) {
    const wm = document.createElement('div');
    wm.className = 'ck-watermark';
    const who = `${state.user.name} · ${state.user.username}`;
    const ts = new Date().toLocaleString('zh-CN', { hour12: false });
    wm.innerHTML = Array.from({ length: 12 }, () => `<span>${esc(who)} · ${esc(ts)}</span>`).join('');
    document.body.appendChild(wm);
  }
  const dot = $('#notif-dot');
  if (dot && notifications) {
    dot.style.display = notifications.unread ? '' : 'none';
    dot.textContent = notifications.unread > 99 ? '99+' : String(notifications.unread || 0);
  }
}

window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('resize', () => { if (state.wb && $('#wave')) drawWave(state.wb); });
