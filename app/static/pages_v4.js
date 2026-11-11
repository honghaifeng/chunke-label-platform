/* 春科标注平台 v4：平台控制台、模板编排/灰度、条件工作流、交互式算子与高级标注 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const e = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const projects = () => (window.CK_STATE && window.CK_STATE.projects) || [];
  const projectOpts = (sel = 0) => projects().map((p) => `<option value="${p.id}" ${Number(sel) === p.id ? 'selected' : ''}>${e(p.name)}</option>`).join('');
  const taskId = () => {
    const s = window.CK_STATE;
    return (s && s.current && s.current.task && s.current.task.id) || (s && s.wb && s.wb.task && s.wb.task.id) || 0;
  };
  const tabs = (items, active) => `<div class="seg-tabs">${items.map(([k, l]) => `<button data-tab="${k}" class="${k === active ? 'active' : ''}">${l}</button>`).join('')}</div>`;
  const head = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div><div class="page-actions">${actions}</div></div>`;
  const table = (heads, rows, empty = '暂无数据') => (rows.length
    ? `<div class="table-wrap"><table class="table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<div class="empty">${empty}</div>`);
  const box = (p) => `<div class="progress" style="min-width:70px"><i style="width:${Math.min(100, Number(p) || 0)}%"></i></div>`;
  const fmtBytes = (n) => {
    n = Number(n) || 0;
    if (n > 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB';
    if (n > 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + ' MB';
    if (n > 1024) return (n / 1024).toFixed(0) + ' KB';
    return n + ' B';
  };

  /* ================================================================== 平台控制台 */
  const can = (perm) => ((window.CK_STATE && window.CK_STATE.permissions) || []).includes(perm);

  async function pageConsole(query) {
    if (!can('settings.write')) { $('#page').innerHTML = '<div class="empty">需要平台管理员权限</div>'; return; }
    const tab = query.get('tab') || 'tenants';
    const page = $('#page');
    page.innerHTML = head('平台控制台', '三级平台 · 租户配额 · 计量计费 · 集成同步 · 安全合规 · 信创与容量',
      `<a class="btn ghost" href="#/governance?tab=roles">角色权限</a><a class="btn ghost" href="#/governance?tab=sampling">抽审策略</a>`)
      + tabs([['tenants', '租户与配额'], ['billing', '计量计费'], ['integration', '集成同步'],
        ['security', '安全合规'], ['system', '信创与容量'], ['qc', '文本质检算子']], tab)
      + `<div id="cs-body" style="margin-top:14px"></div>`;
    $$('[data-tab]', page).forEach((b) => { b.onclick = () => { location.hash = `#/console?tab=${b.dataset.tab}`; }; });
    const body = $('#cs-body');
    try {
      if (tab === 'tenants') await consoleTenants(body);
      else if (tab === 'billing') await consoleBilling(body);
      else if (tab === 'integration') await consoleIntegration(body);
      else if (tab === 'security') await consoleSecurity(body);
      else if (tab === 'system') await consoleSystem(body);
      else await consoleQc(body);
    } catch (err) { body.innerHTML = `<div class="empty">加载失败：${e(err.message)}</div>`; }
  }

  async function consoleTenants(body) {
    const data = await api('/api/platform/overview');
    const rows = data.tenants.map((t) => [
      `<b>${e(t.name)}</b><div class="sub">${e(t.code)}</div>`,
      `${t.usage.users} / ${t.quota.max_users}<br/>${box(t.usage_percent.users)}`,
      `${t.usage.projects} / ${t.quota.max_projects}<br/>${box(t.usage_percent.projects)}`,
      `${t.usage.tasks} 任务 · ${t.usage.annotations} 标注`,
      `${fmtBytes(t.usage.storage_bytes)} / ${t.quota.max_storage_gb} GB<br/>${box(t.usage_percent.storage)}`,
      `<button class="btn ghost sm" data-quota="${t.id}" data-u="${t.quota.max_users}" data-p="${t.quota.max_projects}" data-s="${t.quota.max_storage_gb}">配额</button>`,
    ]);
    body.innerHTML = `<div class="grid four-col" style="margin-bottom:14px">
      ${[['租户', data.totals.tenants], ['用户', data.totals.users], ['项目', data.totals.projects], ['任务', data.totals.tasks]]
        .map(([k, v]) => `<div class="card"><div class="card-body"><div class="sub">${k}</div><div style="font-size:26px;font-weight:600">${v}</div></div></div>`).join('')}
      </div><div class="card"><div class="card-head"><h3 class="card-title">租户隔离与配额</h3>
      <span class="card-sub">平台 → 租户 → 项目团队 三级；用户与业务数据按 tenant_id 隔离</span></div>
      <div class="card-body">${table(['租户', '用户配额', '项目配额', '业务量', '存储配额', '操作'], rows)}</div></div>`;
    $$('[data-quota]').forEach((b) => {
      b.onclick = () => {
        openModal(`<div class="modal-head"><h3>调整租户配额</h3><button class="x" data-close>×</button></div>
          <div class="modal-body">
            <div class="field"><label>最大用户数</label><input class="input" id="q-u" value="${b.dataset.u}"></div>
            <div class="field"><label>最大项目数</label><input class="input" id="q-p" value="${b.dataset.p}"></div>
            <div class="field"><label>最大存储 GB</label><input class="input" id="q-s" value="${b.dataset.s}"></div>
          </div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="q-save">保存</button></div>`);
        $('#q-save').onclick = async () => {
          await api(`/api/tenants/${b.dataset.quota}/quota`, { method: 'PATCH', body: { max_users: $('#q-u').value, max_projects: $('#q-p').value, max_storage_gb: $('#q-s').value } });
          toast('配额已更新', 'ok'); closeModal(); pageConsole(new URLSearchParams('tab=tenants'));
        };
      };
    });
  }

  async function consoleBilling(body) {
    const overview = await api('/api/platform/overview');
    const sel = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('tenant') || (overview.tenants[0] || {}).id || 0);
    const data = await api(`/api/usage?tenant_id=${sel}`);
    body.innerHTML = `<div class="card"><div class="card-head"><h3 class="card-title">用量与计费</h3>
      <span class="card-sub">按标注条数计量，支持配额与单价策略</span>
      <select class="input" id="bl-tenant" style="margin-left:auto;width:180px">${overview.tenants.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</select></div>
      <div class="card-body"><div class="grid four-col">
        ${[['标注条数', data.usage.annotations], ['任务数', data.usage.tasks], ['API 调用（本月）', data.billing.api_calls], ['预估费用', '¥' + data.billing.amount]]
          .map(([k, v]) => `<div class="card"><div class="card-body"><div class="sub">${k}</div><div style="font-size:24px;font-weight:600">${v}</div></div></div>`).join('')}
      </div>
      <div class="filters" style="margin-top:16px"><span class="hint">单价（元 / 千条）</span>
        <input class="input" id="bl-price" value="${data.billing.unit_price_per_k}" style="width:110px">
        <button class="btn primary" id="bl-save">保存计费策略</button>
        <span class="spacer"></span><span class="hint">存储 ${fmtBytes(data.usage.storage_bytes)} / 配额 ${data.quota.storage_gb} GB</span></div>
      </div></div>`;
    $('#bl-tenant').onchange = (ev) => { location.hash = `#/console?tab=billing&tenant=${ev.target.value}`; };
    $('#bl-save').onclick = async () => {
      await api('/api/billing/policy', { method: 'POST', body: { price_per_k: $('#bl-price').value } });
      toast('计费策略已保存', 'ok');
    };
  }

  async function consoleIntegration(body) {
    const [eps, mon] = await Promise.all([api('/api/integrations'), api('/api/monitoring/summary')]);
    body.innerHTML = `<div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">双向集成端点</h3>
        <button class="btn primary sm" id="ig-add" style="margin-left:auto">新增端点</button></div>
        <div class="card-body">${eps.endpoints.length ? eps.endpoints.map((x) => `<div style="padding:8px 0;border-bottom:1px solid rgba(30,42,63,.5)">
          <div style="display:flex;gap:8px;align-items:center"><b style="font-size:12.5px">${e(x.name)}</b>
            <span class="tag">${e(x.kind)}</span><span class="chip ${x.enabled ? 'done' : ''}">${x.enabled ? '启用' : '停用'}</span>
            <span class="spacer"></span>
            <button class="btn ghost sm" data-test="${x.id}">连通性</button>
            <button class="btn ghost sm" data-push="${x.id}">推送</button>
            <button class="btn ghost sm" data-pull="${x.id}">拉取</button>
            <button class="btn ghost sm danger" data-del="${x.id}">删除</button></div>
          <div class="sub">${e(x.url)} · ${e(x.last_status || '未同步')} · ${e(x.last_sync_at || '—')}</div></div>`).join('') : '<div class="empty">暂无集成端点（可对接中试基地数据集系统）</div>'}</div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">统一监控 / 数据湖</h3></div><div class="card-body">
        <div class="kv"><span>作业队列</span><b>${Object.entries(mon.queues).map(([k, v]) => k + ' ' + v).join(' · ') || '—'}</b></div>
        <div class="kv"><span>任务状态</span><b>${Object.entries(mon.tasks).map(([k, v]) => k + ' ' + v).join(' · ') || '—'}</b></div>
        <div class="kv"><span>API P95</span><b>${mon.api_p95_ms} ms（${mon.api_requests} 次）</b></div>
        <div class="field" style="margin-top:10px"><label>Prometheus 地址</label><input class="input" id="mn-p" value="${e(mon.sinks.prometheus)}"></div>
        <div class="field"><label>Loki 地址</label><input class="input" id="mn-l" value="${e(mon.sinks.loki)}"></div>
        <div class="field"><label>数据湖写入地址</label><input class="input" id="mn-d" value="${e(mon.sinks.datalake)}"></div>
        <div class="filters"><button class="btn primary" id="mn-save">保存</button><button class="btn" id="mn-push">立即推送指标</button></div>
        <div class="panel-label" style="margin-top:14px">最近安全事件</div>
        ${mon.recent_events.slice(0, 6).map((x) => `<div class="sub">${e(x.created_at)} · ${e(x.kind)} · ${e(x.detail)}</div>`).join('') || '<div class="empty">暂无</div>'}
      </div></div></div>`;
    const reload = () => pageConsole(new URLSearchParams('tab=integration'));
    $('#ig-add').onclick = () => {
      openModal(`<div class="modal-head"><h3>新增集成端点</h3><button class="x" data-close>×</button></div>
        <div class="modal-body">
          <div class="field"><label>名称</label><input class="input" id="ig-name" placeholder="中试基地数据集系统"></div>
          <div class="field"><label>地址（支持 http/https）</label><input class="input" id="ig-url" placeholder="https://base.example.com/api/datasets"></div>
          <div class="field"><label>鉴权 Token</label><input class="input" id="ig-token" placeholder="Bearer token（加密存储）"></div>
          <div class="field"><label>方向</label><select class="input" id="ig-dir"><option value="both">双向</option><option value="push">仅推送</option><option value="pull">仅拉取</option></select></div>
        </div><div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="ig-save">保存</button></div>`);
      $('#ig-save').onclick = async () => {
        await api('/api/integrations', { method: 'POST', body: { name: $('#ig-name').value, url: $('#ig-url').value, token: $('#ig-token').value, direction: $('#ig-dir').value } });
        toast('端点已创建', 'ok'); closeModal(); reload();
      };
    };
    $$('[data-test]').forEach((b) => { b.onclick = async () => { const r = await api(`/api/integrations/${b.dataset.test}/test`, { method: 'POST', body: {} }); toast(r.ok ? `连通正常（HTTP ${r.status}）` : `连接失败：${r.error}`, r.ok ? 'ok' : 'err'); }; });
    $$('[data-push]').forEach((b) => { b.onclick = async () => { const r = await api(`/api/integrations/${b.dataset.push}/push`, { method: 'POST', body: { project_id: (projects()[0] || {}).id } }); toast(`推送作业已提交 #${r.job_id}`, 'ok'); }; });
    $$('[data-pull]').forEach((b) => { b.onclick = async () => { const r = await api(`/api/integrations/${b.dataset.pull}/pull`, { method: 'POST', body: { project_id: (projects()[0] || {}).id } }); toast(`拉取作业已提交 #${r.job_id}`, 'ok'); }; });
    $$('[data-del]').forEach((b) => { b.onclick = async () => { if (!confirm('删除该端点？')) return; await api(`/api/integrations/${b.dataset.del}`, { method: 'DELETE' }); reload(); }; });
    $('#mn-save').onclick = async () => {
      await api('/api/monitoring/sinks', { method: 'POST', body: { prometheus_url: $('#mn-p').value, loki_url: $('#mn-l').value, datalake_url: $('#mn-d').value } });
      toast('监控配置已保存', 'ok');
    };
    $('#mn-push').onclick = async () => {
      try { const r = await api('/api/monitoring/push', { method: 'POST', body: {} }); toast(`指标推送作业 #${r.job_id}`, 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    };
  }

  async function consoleSecurity(body) {
    const [pol, base, secrets, attempts, dl] = await Promise.all([
      api('/api/security/policy'), api('/api/security/baseline'), api('/api/secrets'),
      api('/api/login/attempts'), api('/api/security/download-policy'),
    ]);
    const p = pol.policy;
    body.innerHTML = `<div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">安全策略</h3><span class="card-sub">等保三级功能项</span></div><div class="card-body">
        <div class="grid two-col">
          <div class="field"><label>密码最小长度</label><input class="input" id="sp-min" value="${p.password_min}"></div>
          <div class="field"><label>登录失败阈值</label><input class="input" id="sp-lock" value="${p.lock_threshold}"></div>
          <div class="field"><label>锁定时长（分钟）</label><input class="input" id="sp-lockm" value="${p.lock_minutes}"></div>
          <div class="field"><label>会话有效期（小时）</label><input class="input" id="sp-sess" value="${p.session_hours}"></div>
          <div class="field"><label>审计保留（天）</label><input class="input" id="sp-audit" value="${p.audit_days}"></div>
          <div class="field"><label>强制 MFA</label><select class="input" id="sp-mfa"><option value="off" ${pol.mfa_required !== 'on' ? 'selected' : ''}>关闭</option><option value="on" ${pol.mfa_required === 'on' ? 'selected' : ''}>开启</option></select></div>
        </div>
        <div class="filters"><label class="toggle-wrap"><input type="checkbox" id="sp-cx" ${p.complexity ? 'checked' : ''}> 口令复杂度</label>
          <label class="toggle-wrap"><input type="checkbox" id="sp-wm" ${p.watermark ? 'checked' : ''}> 数据水印</label>
          <label class="toggle-wrap"><input type="checkbox" id="sp-dl" ${p.download_disabled ? 'checked' : ''}> 禁用下载</label>
          <label class="toggle-wrap"><input type="checkbox" id="sp-tls" ${p.tls_required ? 'checked' : ''}> 强制 TLS</label></div>
        <button class="btn primary" id="sp-save">保存策略</button>
        <div class="hint" style="margin-top:8px">当前水印文本：${e(dl.watermark_text)}</div>
        <div class="panel-label" style="margin-top:16px">最近登录尝试</div>
        ${attempts.attempts.slice(0, 8).map((a) => `<div class="sub">${e(a.created_at)} · ${e(a.username)} · ${a.success ? '成功' : '失败'} · ${e(a.ip)}</div>`).join('') || '<div class="empty">暂无记录</div>'}
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">等保三级基线自检</h3>
        <span class="card-sub">得分 ${base.score} / 100</span></div><div class="card-body">
        ${base.checks.map((c) => `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
          <span class="chip ${c.ok ? 'done' : 'danger'}">${c.ok ? '通过' : '待补'}</span>
          <div><b style="font-size:12px">${e(c.name)}</b><div class="sub">${e(c.detail)}</div></div></div>`).join('')}
        <div class="panel-label" style="margin-top:16px">凭据加密库（${e(secrets.encryption)}）</div>
        <div class="filters"><input class="input" id="sec-name" placeholder="名称，如 s3.access_key" style="width:170px">
          <input class="input" id="sec-val" placeholder="明文（加密后存储）" style="width:180px"><button class="btn primary" id="sec-save">加密保存</button></div>
        ${secrets.secrets.map((s) => `<div class="sub" style="display:flex;gap:8px">🔒 ${e(s.name)} · ${e(s.hint)} · ${e(s.updated_at)}<button class="btn ghost sm danger" data-secdel="${s.id}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无凭据</div>'}
      </div></div></div>`;
    $('#sp-save').onclick = async () => {
      await api('/api/security/policy', { method: 'PATCH', body: {
        password_min: Number($('#sp-min').value), lock_threshold: Number($('#sp-lock').value),
        lock_minutes: Number($('#sp-lockm').value), session_hours: Number($('#sp-sess').value),
        audit_days: Number($('#sp-audit').value), complexity: $('#sp-cx').checked,
        watermark: $('#sp-wm').checked, download_disabled: $('#sp-dl').checked,
        tls_required: $('#sp-tls').checked, mfa_required: $('#sp-mfa').value === 'on',
      } });
      toast('安全策略已生效', 'ok'); pageConsole(new URLSearchParams('tab=security'));
    };
    $('#sec-save').onclick = async () => {
      try { await api('/api/secrets', { method: 'POST', body: { name: $('#sec-name').value, value: $('#sec-val').value } }); toast('凭据已加密保存', 'ok'); pageConsole(new URLSearchParams('tab=security')); }
      catch (err) { toast(err.message, 'err'); }
    };
    $$('[data-secdel]').forEach((b) => { b.onclick = async () => { await api(`/api/secrets/${b.dataset.secdel}`, { method: 'DELETE' }); pageConsole(new URLSearchParams('tab=security')); }; });
  }

  async function consoleSystem(body) {
    const [info, cap] = await Promise.all([api('/api/system/info'), api('/api/capacity')]);
    body.innerHTML = `<div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">运行环境与信创适配</h3></div><div class="card-body">
        <div class="kv"><span>操作系统</span><b>${e(info.os)} ${e(info.release)}</b></div>
        <div class="kv"><span>CPU 架构</span><b>${e(info.arch)}</b></div>
        <div class="kv"><span>Python</span><b>${e(info.python)}</b></div>
        <div class="kv"><span>数据库</span><b>${e(info.database)}</b></div>
        <div class="kv"><span>容器运行</span><b>${info.container ? '是（Docker/K8s）' : '否'}</b></div>
        <div class="panel-label" style="margin-top:12px">适配矩阵</div>
        ${Object.entries(info.adaptation).map(([k, v]) => `<div class="sub"><b>${k}</b>：${Array.isArray(v) ? v.map(e).join(' / ') : e(v)}</div>`).join('')}
        <div class="panel-label" style="margin-top:12px">交付检查</div>
        ${info.checks.map((c) => `<div class="sub">${c.ok ? '✓' : '✗'} ${e(c.item)}</div>`).join('')}
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">性能容量</h3><span class="card-sub">目标 200 用户 / 50 并发 / 100 万条目</span></div><div class="card-body">
        <div class="grid two-col">
          ${[['媒体文件', cap.files], ['数据集条目', cap.items], ['媒体容量', fmtBytes(cap.media_bytes)], ['数据库', fmtBytes(cap.db_bytes)], ['API P95', cap.api_p95_ms + ' ms'], ['判定', cap.verdict]]
            .map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}
        </div>
        <div class="panel-label" style="margin-top:12px">分页与索引</div>
        <div class="sub">默认分页 ${cap.paging.default} / 最大 ${cap.paging.max} · 索引 ${cap.indexes.length} 个</div>
        <div class="filters" style="margin-top:10px"><button class="btn primary" id="cap-snap">保存容量快照</button>
          <a class="btn ghost" href="/metrics" target="_blank">Prometheus 指标</a></div>
        ${cap.last_snapshot ? `<div class="hint" style="margin-top:8px">最近快照：${e(cap.last_snapshot.created_at)} · ${cap.last_snapshot.files} 文件 · ${cap.last_snapshot.items} 条目 · P95 ${cap.last_snapshot.p95_ms}ms</div>` : ''}
      </div></div></div>`;
    $('#cap-snap').onclick = async () => { await api('/api/capacity/snapshot', { method: 'POST', body: { note: '控制台手动快照' } }); toast('快照已保存', 'ok'); };
  }

  async function consoleQc(body) {
    const ops = await api('/api/qc/operators');
    const rules = ops.rules || {};
    const weights = rules.weights || {};
    body.innerHTML = `<div class="grid two-col">
      <div class="card"><div class="card-head"><h3 class="card-title">智能质检算子</h3>
        <span class="card-sub">错别字 / 拼写 / 标点 / 语法 / Markdown / LaTeX · 问题可字符定位</span></div><div class="card-body">
        <textarea class="input" id="qc-text" rows="7" placeholder="粘贴待检查文本（Markdown/LaTeX 亦可）"></textarea>
        <div class="filters" style="margin-top:10px">${ops.operators.map((o) => `<label class="toggle-wrap"><input type="checkbox" data-op="${o.key}" ${(rules.enabled || {})[o.key] === false ? '' : 'checked'}> ${o.label}</label>`).join('')}</div>
        <div class="filters"><button class="btn primary" id="qc-run">运行算子</button><span class="hint">阈值 ${rules.threshold ?? 60} · 权重 error ${weights.error ?? 6} / warn ${weights.warn ?? 2} / info ${weights.info ?? 0}</span></div>
        <div id="qc-out" style="margin-top:14px"></div></div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">组合规则与阈值</h3><span class="card-sub">阈值判定 + 多算子组合告警 + 自定义词</span></div>
        <div class="card-body">
          <div class="field"><label>通过阈值（得分 ≥ 阈值判为通过）</label><input class="input" id="qc-th" type="number" min="0" max="100" value="${rules.threshold ?? 60}"></div>
          <div class="filters"><span class="hint">扣分权重</span><input class="input" id="qc-w-error" type="number" value="${weights.error ?? 6}" style="width:70px" title="error"><input class="input" id="qc-w-warn" type="number" value="${weights.warn ?? 2}" style="width:70px" title="warn"><input class="input" id="qc-w-info" type="number" value="${weights.info ?? 0}" style="width:70px" title="info"></div>
          <div class="field"><label>自定义词（每行：错词,正确词,级别 warn/error）</label><textarea class="input" id="qc-words" rows="4" style="font-family:ui-monospace,monospace">${e((rules.custom_words || []).map((w) => `${w.bad},${w.good || ''},${w.level || 'warn'}`).join('\n'))}</textarea></div>
          <div class="field"><label>组合规则（每行：名称,算子1|算子2,命中数,级别）</label><textarea class="input" id="qc-combine" rows="3" style="font-family:ui-monospace,monospace">${e((rules.combine || []).map((c) => `${c.name},${(c.ops || []).join('|')},${c.min_count},${c.level}`).join('\n'))}</textarea></div>
          <button class="btn primary" id="qc-save">保存质检规则</button>
          <div class="hint" style="margin-top:6px">规则保存后对平台质检与该任务质检同时生效；组合规则会在多项算子同时命中时追加告警。</div>
        </div></div></div>`;
    $('#qc-run').onclick = async () => {
      const list = $$('[data-op]').filter((x) => x.checked).map((x) => x.dataset.op);
      try {
        const r = await api('/api/qc/operators/run', { method: 'POST', body: { text: $('#qc-text').value, ops: list } });
        $('#qc-out').innerHTML = `<div class="panel-label">得分 ${r.score} · 阈值 ${r.threshold} · ${r.passed ? '通过' : '未通过'} · 问题 ${r.count} 项</div>`
          + `<div style="margin-top:8px;line-height:1.9;padding:8px;background:rgba(15,23,38,.6);border-radius:6px">${highlightQc($('#qc-text').value, r.issues) || '<span class="hint">无文本</span>'}</div>`
          + table(['级别', '算子', '位置', '建议', '说明'], (r.issues || []).map((i) => [`<span class="chip ${i.level === 'error' ? 'danger' : i.level === 'warn' ? 'pending' : ''}">${i.level}</span>`, i.op, `${i.start}-${i.end}`, e(i.suggestion || '—'), e(i.message)]), '未发现问题');
      } catch (err) { toast(err.message, 'err'); }
    };
    $('#qc-save').onclick = async () => {
      const words = $('#qc-words').value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [bad, good, level] = s.split(/[,，]/).map((x) => (x || '').trim());
        return { bad, good: good || '', level: level === 'error' ? 'error' : 'warn' };
      }).filter((w) => w.bad);
      const combine = $('#qc-combine').value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [name, opsStr, min, level] = s.split(/[,，]/).map((x) => (x || '').trim());
        return { name, ops: (opsStr || '').split('|').filter(Boolean), min_count: +min || 1, level: level === 'error' ? 'error' : 'warn' };
      }).filter((c) => c.name && c.ops.length);
      const enabled = {};
      $$('[data-op]').forEach((x) => { enabled[x.dataset.op] = x.checked; });
      await api('/api/qc/rules', { method: 'PUT', body: { threshold: +$('#qc-th').value || 0,
        weights: { error: +$('#qc-w-error').value || 0, warn: +$('#qc-w-warn').value || 0, info: +$('#qc-w-info').value || 0 },
        custom_words: words, combine, enabled } });
      toast('质检规则已保存', 'ok');
    };
  }

  /* ================================================================== 模板编排 / 工作流 */
  let layout = [];
  let curTemplate = 0;
  const TYPES = [['container', '容器'], ['columns', '分栏'], ['text', '单行文本'], ['textarea', '多行文本'],
    ['radio', '单选'], ['checkbox', '多选'], ['select', '下拉'], ['tags', '标签'], ['timestamp', '时间戳'],
    ['unknown', '不定项'], ['timeline', '多时序对齐'], ['image', '图片引用'], ['audio', '音频引用'],
    ['video', '视频引用'], ['pdf', 'PDF 引用'], ['table', '表格'], ['code', '代码块'], ['llm', '大模型生成']];

  async function pageStudio(query) {
    if (!can('template.write')) { $('#page').innerHTML = '<div class="empty">需要模板编辑权限</div>'; return; }
    const tab = query.get('tab') || 'template';
    const page = $('#page');
    page.innerHTML = head('模板编排', '拖拽式组件树 · 属性校验 · 版本锁定与灰度升级 · 条件工作流',
      `<a class="btn ghost" href="#/templates">模板库</a>`)
      + tabs([['template', '模板编排'], ['workflow', '条件工作流']], tab)
      + `<div id="st-body" style="margin-top:14px"></div>`;
    $$('[data-tab]', page).forEach((b) => { b.onclick = () => { location.hash = `#/studio?tab=${b.dataset.tab}`; }; });
    if (tab === 'workflow') return studioWorkflow($('#st-body'));
    const tpls = await api('/api/templates').catch(() => ({ templates: [] }));
    const list = tpls.templates || [];
    curTemplate = Number(query.get('template') || (list[0] || {}).id || 0);
    if (!curTemplate) { $('#st-body').innerHTML = '<div class="empty">暂无模板，请先在模板库创建</div>'; return; }
    const data = await api(`/api/templates/${curTemplate}/layout`);
    layout = data.layout || [];
    $('#st-body').innerHTML = `<div class="card"><div class="card-head">
      <h3 class="card-title">组件编排</h3>
      <select class="input" id="st-tpl" style="margin-left:12px;width:200px">${list.map((t) => `<option value="${t.id}" ${t.id === curTemplate ? 'selected' : ''}>${e(t.name)}</option>`).join('')}</select>
      <span class="spacer"></span>
      <span class="hint">版本 v${data.version} · ${data.locked ? '已锁定' : '可编辑'}</span>
      <label class="toggle-wrap">灰度 <input type="range" id="st-gray" min="0" max="100" value="${data.gray_percent}" style="width:120px"><b id="st-gray-v">${data.gray_percent}%</b></label>
      <button class="btn ghost" id="st-lock">${data.locked ? '解锁' : '锁定版本'}</button>
      <button class="btn primary" id="st-save">保存并升版</button></div>
      <div class="card-body"><div class="grid" style="grid-template-columns:180px 1fr">
        <div><div class="panel-label">组件</div>${TYPES.map(([k, l]) => `<button class="btn ghost sm" data-add="${k}" style="display:block;width:100%;margin-bottom:6px;text-align:left">+ ${l}</button>`).join('')}
          <div class="hint" style="margin-top:10px">添加后可拖拽排序，容器/分栏/不定项支持子组件。</div></div>
        <div id="st-canvas"></div></div></div></div>`;
    $('#st-tpl').onchange = (ev) => { location.hash = `#/studio?tab=template&template=${ev.target.value}`; };
    $('#st-gray').oninput = (ev) => { $('#st-gray-v').textContent = ev.target.value + '%'; };
    $('#st-gray').onchange = async () => {
      await api(`/api/templates/${curTemplate}/rollout`, { method: 'POST', body: { gray_percent: Number($('#st-gray').value) } });
      toast('灰度比例已更新', 'ok');
    };
    $('#st-lock').onclick = async () => {
      await api(`/api/templates/${curTemplate}/layout`, { method: 'PUT', body: { layout, locked: data.locked ? 0 : 1, gray_percent: Number($('#st-gray').value) } });
      toast('已切换锁定状态', 'ok'); pageStudio(new URLSearchParams(`tab=template&template=${curTemplate}`));
    };
    $('#st-save').onclick = async () => {
      try {
        const r = await api(`/api/templates/${curTemplate}/layout`, { method: 'PUT', body: { layout, bump: true, gray_percent: Number($('#st-gray').value) } });
        toast(`已保存 v${r.version}`, 'ok');
      } catch (err) { toast(err.message, 'err'); }
    };
    $$('[data-add]').forEach((b) => {
      b.onclick = () => {
        const type = b.dataset.add;
        const node = { id: Math.random().toString(36).slice(2, 8), type, label: (TYPES.find((x) => x[0] === type) || [])[1], required: false, options: [], children: [] };
        if (type === 'table') node.columns = ['列1', '列2', '列3'];
        if (type === 'code') node.props = { language: 'text' };
        if (type === 'llm') node.props = { model: '', mode: 'generate' };
        if (['image', 'audio', 'video', 'pdf'].includes(type)) node.props = { accept: type, multiple: false };
        layout.push(node); drawLayout();
      };
    });
    drawLayout();
  }

  function drawLayout() {
    const canvas = $('#st-canvas');
    if (!canvas) return;
    const render = (nodes, parent) => nodes.map((n, i) => `<div class="card" draggable="true" data-node="${n.id}" style="margin-bottom:8px;border:1px solid rgba(30,42,63,.7)">
      <div class="card-body" style="padding:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="tag">${e((TYPES.find((t) => t[0] === n.type) || [])[1] || n.type)}</span>
          <input class="input" data-label="${n.id}" value="${e(n.label)}" style="width:160px;height:28px">
          <label class="toggle-wrap"><input type="checkbox" data-req="${n.id}" ${n.required ? 'checked' : ''}> 必填</label>
          ${n.type === 'timeline' ? `<input class="input" data-fields="${n.id}" value="${e((n.fields || []).join(','))}" placeholder="对齐字段,如 视频,音频" style="width:180px;height:28px">` : ''}
          ${['radio', 'checkbox', 'select', 'tags'].includes(n.type) ? `<input class="input" data-opts="${n.id}" value="${e((n.options || []).join(','))}" placeholder="选项，逗号分隔" style="width:180px;height:28px">` : ''}
          ${n.type === 'table' ? `<input class="input" data-cols="${n.id}" value="${e((n.columns || []).join(','))}" placeholder="列名，逗号分隔" style="width:180px;height:28px">` : ''}
          ${n.type === 'code' ? `<input class="input" data-lang="${n.id}" value="${e((n.props || {}).language || 'text')}" placeholder="语言" style="width:100px;height:28px">` : ''}
          ${n.type === 'llm' ? `<input class="input" data-model="${n.id}" value="${e((n.props || {}).model || '')}" placeholder="模型（留空用内置）" style="width:170px;height:28px">` : ''}
          ${['image', 'audio', 'video', 'pdf'].includes(n.type) ? `<input class="input" data-accept="${n.id}" value="${e((n.props || {}).accept || n.type)}" placeholder="accept" style="width:110px;height:28px"><label class="toggle-wrap"><input type="checkbox" data-multi="${n.id}" ${(n.props || {}).multiple ? 'checked' : ''}> 多选</label>` : ''}
          <span class="spacer"></span>
          ${['container', 'columns', 'unknown'].includes(n.type) ? `<button class="btn ghost sm" data-child="${n.id}">+ 子组件</button>` : ''}
          <button class="btn ghost sm" data-up="${n.id}">↑</button><button class="btn ghost sm" data-down="${n.id}">↓</button>
          <button class="btn ghost sm danger" data-del="${n.id}">删除</button>
        </div>
        ${n.children && n.children.length ? `<div style="margin:8px 0 0 18px;border-left:1px dashed rgba(59,130,246,.4);padding-left:10px">${render(n.children, n)}</div>` : ''}
      </div></div>`).join('');
    canvas.innerHTML = layout.length ? render(layout, null) : '<div class="empty">从左侧添加组件开始编排</div>';
    bindLayout();
  }

  function nodeById(nodes, id) {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = nodeById(n.children || [], id);
      if (hit) return hit;
    }
    return null;
  }

  function removeNode(nodes, id) {
    const i = nodes.findIndex((n) => n.id === id);
    if (i >= 0) { nodes.splice(i, 1); return true; }
    return nodes.some((n) => removeNode(n.children || [], id));
  }

  function bindLayout() {
    $$('[data-label]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.label); if (n) n.label = x.value; }; });
    $$('[data-req]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.req); if (n) n.required = x.checked; }; });
    $$('[data-opts]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.opts); if (n) n.options = x.value.split(',').map((s) => s.trim()).filter(Boolean); }; });
    $$('[data-fields]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.fields); if (n) n.fields = x.value.split(',').map((s) => s.trim()).filter(Boolean); }; });
    $$('[data-cols]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.cols); if (n) n.columns = x.value.split(',').map((s) => s.trim()).filter(Boolean); }; });
    $$('[data-lang]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.lang); if (n) n.props = { ...(n.props || {}), language: x.value }; }; });
    $$('[data-model]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.model); if (n) n.props = { ...(n.props || {}), model: x.value }; }; });
    $$('[data-accept]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.accept); if (n) n.props = { ...(n.props || {}), accept: x.value }; }; });
    $$('[data-multi]').forEach((x) => { x.onchange = () => { const n = nodeById(layout, x.dataset.multi); if (n) n.props = { ...(n.props || {}), multiple: x.checked }; }; });
    $$('[data-del]').forEach((x) => { x.onclick = () => { removeNode(layout, x.dataset.del); drawLayout(); }; });
    $$('[data-up]').forEach((x) => { x.onclick = () => { moveNode(x.dataset.up, -1); drawLayout(); }; });
    $$('[data-down]').forEach((x) => { x.onclick = () => { moveNode(x.dataset.down, 1); drawLayout(); }; });
    $$('[data-child]').forEach((x) => {
      x.onclick = () => {
        const n = nodeById(layout, x.dataset.child);
        if (!n) return;
        n.children = n.children || [];
        n.children.push({ id: Math.random().toString(36).slice(2, 8), type: 'text', label: '子项', required: false, options: [], children: [] });
        drawLayout();
      };
    });
    let dragId = null;
    $$('[data-node]').forEach((card) => {
      card.ondragstart = (ev) => { dragId = card.dataset.node; ev.dataTransfer.effectAllowed = 'move'; };
      card.ondragover = (ev) => ev.preventDefault();
      card.ondrop = (ev) => {
        ev.preventDefault();
        const target = card.dataset.node;
        if (!dragId || dragId === target) return;
        const node = nodeById(layout, dragId);
        if (node && removeNode(layout, dragId)) {
          const dest = nodeById(layout, target);
          if (dest) {
            const arr = layout.filter((n) => n.id === target);
            if (arr.length) layout.splice(layout.indexOf(arr[0]), 0, node);
            else (dest.children = dest.children || []).push(node);
          }
          drawLayout();
        }
      };
    });
  }

  function moveNode(id, delta) {
    const walk = (nodes) => {
      const i = nodes.findIndex((n) => n.id === id);
      if (i >= 0) { const j = i + delta; if (j >= 0 && j < nodes.length) { [nodes[i], nodes[j]] = [nodes[j], nodes[i]]; } return true; }
      return nodes.some((n) => walk(n.children || []));
    };
    walk(layout);
  }

  async function studioWorkflow(body) {
    const wfs = await api('/api/workflows').catch(() => ({ workflows: [] }));
    const list = wfs.workflows || [];
    if (!list.length) { body.innerHTML = '<div class="empty">暂无工作流，请先在流程页面创建</div>'; return; }
    const wf = list[0];
    let steps = (wf.steps || []).map((s) => (typeof s === 'string' ? { key: s, name: s, role: 'annotator' } : s));
    const draw = () => {
      body.innerHTML = `<div class="card"><div class="card-head"><h3 class="card-title">条件工作流</h3>
        <span class="card-sub">${e(wf.name)}</span><span class="spacer"></span>
        <button class="btn ghost sm" id="wf-add">+ 节点</button><button class="btn primary sm" id="wf-save">保存流程</button></div>
        <div class="card-body">${steps.map((s, i) => `<div class="card" style="margin-bottom:8px"><div class="card-body" style="padding:10px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="tag">${i + 1}</span>
            <input class="input" data-name="${i}" value="${e(s.name || '')}" placeholder="节点名称" style="width:150px;height:28px">
            <select class="input" data-role="${i}" style="width:130px;height:28px">${['annotator', 'reviewer', 'acceptor', 'manager'].map((r) => `<option value="${r}" ${s.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
            <span class="hint">条件</span>
            <input class="input" data-field="${i}" value="${e((s.condition || {}).field || '')}" placeholder="字段，如 status/priority" style="width:150px;height:28px">
            <select class="input" data-op="${i}" style="width:90px;height:28px">${['eq', 'ne', 'gt', 'lt', 'in', 'contains'].map((o) => `<option value="${o}" ${(s.condition || {}).op === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
            <input class="input" data-val="${i}" value="${e((s.condition || {}).value ?? '')}" placeholder="值" style="width:110px;height:28px">
            <input class="input" data-rate="${i}" value="${s.sample_rate ?? ''}" placeholder="质检比例" style="width:90px;height:28px">
            <button class="btn ghost sm danger" data-dels="${i}">删除</button>
          </div></div></div>`).join('') || '<div class="empty">暂无节点</div>'}
          <div class="hint">条件不满足的节点会跳过；节点角色用于任务级授权（可结合治理中心任务角色）。</div>
        </div></div>`;
      $('#wf-add').onclick = () => { steps.push({ key: 'step-' + Date.now(), name: '新节点', role: 'reviewer', condition: {}, sample_rate: 100 }); draw(); };
      $$('[data-name]').forEach((x) => { x.onchange = () => { steps[+x.dataset.name].name = x.value; }; });
      $$('[data-role]').forEach((x) => { x.onchange = () => { steps[+x.dataset.role].role = x.value; steps[+x.dataset.role].required_role = x.value; }; });
      $$('[data-field]').forEach((x) => { x.onchange = () => { steps[+x.dataset.field].condition = { ...(steps[+x.dataset.field].condition || {}), field: x.value }; }; });
      $$('[data-op]').forEach((x) => { x.onchange = () => { steps[+x.dataset.op].condition = { ...(steps[+x.dataset.op].condition || {}), op: x.value }; }; });
      $$('[data-val]').forEach((x) => { x.onchange = () => { steps[+x.dataset.val].condition = { ...(steps[+x.dataset.val].condition || {}), value: x.value }; }; });
      $$('[data-rate]').forEach((x) => { x.onchange = () => { steps[+x.dataset.rate].sample_rate = Number(x.value); }; });
      $$('[data-dels]').forEach((x) => { x.onclick = () => { steps.splice(+x.dataset.dels, 1); draw(); }; });
      $('#wf-save').onclick = async () => {
        await api(`/api/workflows/${wf.id}`, { method: 'PATCH', body: { steps } });
        toast('工作流已保存', 'ok');
      };
    };
    draw();
  }

  /* ================================================================== 高级标注面板 */
  const OPS = {};

  async function runOp(key, input) {
    try { return await api('/api/operators/run', { method: 'POST', body: { operator: key, task_id: taskId(), input } }); }
    catch (err) { toast(err.message, 'err'); return null; }
  }

  async function saveExtras(merge) {
    try {
      await api(`/api/tasks/${taskId()}/annotation/extras`, { method: 'POST', body: { merge } });
      toast('已保存到标注结果', 'ok');
      return true;
    } catch (err) { toast(err.message, 'err'); return false; }
  }

  const asObj = (v) => {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (err) { return {}; }
  };

  async function applyBoxes(boxes) {
    const tid = taskId();
    const data = await api(`/api/tasks/${tid}`);
    const payload = asObj(data.annotation && data.annotation.payload);
    const wb = window.CK_STATE.wb;
    const existing = payload.boxes || wb.boxes || [];
    payload.boxes = existing.concat(boxes.map((b) => ({ ...b, source: 'ai' })));
    await api(`/api/tasks/${tid}/annotation`, { method: 'POST', body: { payload } });
    toast(`已写入 ${boxes.length} 个目标，刷新可继续修正`, 'ok');
  }

  function panelShell(title) {
    const wb = $('#wb') || document.querySelector('.wb');
    if (!wb) return null;
    if (!wb.id) wb.id = 'wb';
    let host = $('#adv-panel');
    if (!host) {
      host = document.createElement('div');
      host.id = 'adv-panel';
      host.className = 'card';
      host.style.marginTop = '14px';
      (wb.querySelector('.wb-main') || wb).appendChild(host);
    }
    host.innerHTML = `<div class="card-head"><h3 class="card-title">${title}</h3>
      <span class="card-sub">交互式算子 · 扩展标注 · 批量与快捷键</span></div><div class="card-body" id="adv-body"></div>`;
    return $('#adv-body');
  }

  function installShortcuts() {
    if (window.__ckShortcuts) return;
    window.__ckShortcuts = true;
    document.addEventListener('keydown', (ev) => {
      const wb = window.CK_STATE && window.CK_STATE.wb;
      if (!wb || !['annotate'].includes((location.hash.match(/^#\/(\w+)/) || [])[1])) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        if (window.save) window.save(wb);
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault(); undoVersion(wb.task.id);
      }
      if (/^[1-9]$/.test(ev.key) && wb.boxes && wb.boxes.length) {
        const cls = (wb.task && wb.task.id) ? null : null;
        const list = (wb.labels && wb.labels['目标类别']) || [];
        if (list[Number(ev.key) - 1]) { wb.activeCls = list[Number(ev.key) - 1]; toast(`当前类别：${wb.activeCls}`); }
      }
      if (ev.key === 'Delete' && wb.boxes && wb.selected >= 0) {
        wb.boxes.splice(wb.selected, 1); wb.selected = -1;
        if (window.refreshBoxUI) window.refreshBoxUI(wb);
      }
    });
  }

  async function undoVersion(tid) {
    const h = await api(`/api/tasks/${tid}/annotation/history`);
    const v = (h.versions || [])[1] || (h.versions || [])[0];
    if (!v) return toast('暂无可撤销版本', 'warn');
    if (!confirm(`撤销到 v${v.version}（${v.note || '历史快照'}）？`)) return;
    await api(`/api/tasks/${tid}/annotation/versions/${v.id}/restore`, { method: 'POST', body: {} });
    toast('已撤销', 'ok'); location.reload();
  }

  function advancedPanel(wb) {
    installShortcuts();
    const type = wb.mediaType;
    const body = panelShell({ image: '图像高级标注（分割 / 关键点 / OCR / 开放词）', audio: '音频高级标注（情感 / TTS / 事件 / 切分转写）', video: '视频高级标注（事件区间 / 跟踪迭代）', llm: '大模型标注（偏好排序 / 视觉语言）', multimodal: '多模态对齐判断', pdf: '文档标注（区域 / 问答）', text: '文本标注（规则质检 / 批量）' }[type] || '高级标注');
    if (!body) return;
    if (type === 'image') imageTools(body, wb);
    else if (type === 'audio') audioTools(body, wb);
    else if (type === 'video') videoTools(body, wb);
    else if (type === 'llm') llmTools(body, wb);
    else if (type === 'multimodal') multiTools(body, wb);
    else body.innerHTML = '<div class="hint">该模态可直接使用工作台内置能力；文本质检请在“平台控制台 → 文本质检算子”运行。</div>';
    setTimeout(() => templateForm(wb), 0);
  }

  /* ---------------- 模板驱动表单：按任务模板渲染字段并回写 ---------------- */
  async function templateForm(wb) {
    const host = $('#wb');
    if (!host || !wb || !wb.task) return;
    let card = $('#adv-form');
    if (card && card.dataset.tid === String(wb.task.id)) return;
    const data = await api(`/api/tasks/${wb.task.id}/form`).catch(() => null);
    if (!data || !data.template || !(data.layout || []).length) return;
    if (!card) {
      card = document.createElement('div');
      card.id = 'adv-form';
      card.className = 'card';
      card.style.marginTop = '14px';
      (host.querySelector('.wb-main') || host).appendChild(card);
    }
    card.dataset.tid = String(wb.task.id);
    const values = data.values || {};
    const field = (n) => {
      const v = values[n.id];
      const req = n.required ? ' <b style="color:#ef4444">*</b>' : '';
      const wrap = (inner) => `<div class="field" data-node="${n.id}"><label>${e(n.label)}${req}</label>${inner}</div>`;
      const opts = n.options || [];
      if (['container', 'columns', 'unknown'].includes(n.type)) {
        return `<fieldset style="border:1px dashed rgba(59,130,246,.35);border-radius:8px;padding:8px;margin-bottom:10px"><legend class="sub">${e(n.label)}</legend>${field(n.children || [])}</fieldset>`;
      }
      if (n.type === 'textarea' || n.type === 'code' || n.type === 'llm') {
        const ph = n.type === 'code' ? `language: ${(n.props || {}).language || 'text'}` : (n.type === 'llm' ? '填写提示词或待生成内容' : (n.placeholder || ''));
        return wrap(`<textarea class="input" data-fid="${n.id}" rows="${n.type === 'code' ? 5 : 3}" ${n.type === 'code' ? 'style="font-family:ui-monospace,monospace"' : ''} placeholder="${e(ph)}">${e(v || n.default || '')}</textarea>`);
      }
      if (n.type === 'radio') {
        return wrap(opts.map((o) => `<label class="toggle-wrap"><input type="radio" name="f-${n.id}" data-fid="${n.id}" value="${e(o)}" ${v === o ? 'checked' : ''}> ${e(o)}</label>`).join('') || '<span class="hint">未配置选项</span>');
      }
      if (n.type === 'checkbox') {
        return wrap(opts.map((o) => `<label class="toggle-wrap"><input type="checkbox" data-fid="${n.id}" data-multi="1" value="${e(o)}" ${Array.isArray(v) && v.includes(o) ? 'checked' : ''}> ${e(o)}</label>`).join('') || '<span class="hint">未配置选项</span>');
      }
      if (n.type === 'select') {
        return wrap(`<select class="input" data-fid="${n.id}"><option value="">请选择</option>${opts.map((o) => `<option ${v === o ? 'selected' : ''}>${e(o)}</option>`).join('')}</select>`);
      }
      if (n.type === 'tags' || n.type === 'timeline') {
        return wrap(`<input class="input" data-fid="${n.id}" value="${e(Array.isArray(v) ? v.join(',') : (v || ''))}" placeholder="${n.type === 'tags' ? '逗号分隔标签' : '对齐点（秒），逗号分隔'}">`);
      }
      if (n.type === 'timestamp') {
        return wrap(`<div class="filters"><input class="input" data-fid="${n.id}" value="${e(v || '')}" placeholder="ISO 时间，如 2026-11-11T10:00:00"><button class="btn ghost sm" data-now="${n.id}">现在</button></div>`);
      }
      if (['image', 'audio', 'video', 'pdf'].includes(n.type)) {
        return wrap(`<div class="filters"><input class="input" data-fid="${n.id}" value="${e(v || '')}" placeholder="媒体名 / URL" style="flex:1">
          <input type="file" data-file="${n.id}" accept="${e((n.props || {}).accept || n.type)}" style="display:none">
          <button class="btn ghost sm" data-pick="${n.id}">选择文件</button></div><div class="sub" data-fname="${n.id}"></div>`);
      }
      if (n.type === 'table') {
        const cols = n.columns || [];
        const rows = Array.isArray(v) ? v : Array.from({ length: Math.max(1, (n.props || {}).rows || 3) }, () => cols.map(() => ''));
        return `<div class="field"><label>${e(n.label)}${req}</label><div class="table-wrap"><table class="table"><thead><tr>${cols.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>
          ${rows.map((r, ri) => `<tr>${cols.map((c, ci) => `<td><input class="input" data-cell="${n.id}" data-ri="${ri}" data-ci="${ci}" value="${e((r || [])[ci] || '')}" style="height:26px"></td>`).join('')}</tr>`).join('')}
        </tbody></table></div></div>`;
      }
      return wrap(`<input class="input" data-fid="${n.id}" value="${e(v || n.default || '')}" placeholder="${e(n.placeholder || '')}">`);
    };
    card.innerHTML = `<div class="card-head"><h3 class="card-title">模板表单 · ${e(data.template.name)}</h3>
      <span class="card-sub">v${data.version} · 灰度 ${data.gray_percent}% ${data.applied ? '' : '· 未命中灰度，按空白表单'}</span>
      <span class="spacer"></span><button class="btn primary sm" id="tf-save">保存表单</button></div>
      <div class="card-body"><div class="grid two-col" style="align-items:start">${field(data.layout)}</div>
      ${data.note ? `<div class="hint" style="margin-top:8px">${e(data.note)}</div>` : ''}</div>`;
    $$('[data-now]', card).forEach((b) => { b.onclick = () => { const el = card.querySelector(`[data-fid="${b.dataset.now}"]`); if (el) el.value = new Date().toISOString().slice(0, 19); }; });
    $$('[data-pick]', card).forEach((b) => { b.onclick = () => { const f = card.querySelector(`[data-file="${b.dataset.pick}"]`); if (f) f.click(); }; });
    $$('[data-file]', card).forEach((f) => {
      f.onchange = () => {
        const file = f.files[0];
        if (!file) return;
        const input = card.querySelector(`[data-fid="${f.dataset.file}"]`);
        if (input) input.value = file.name;
        const name = card.querySelector(`[data-fname="${f.dataset.file}"]`);
        if (name) name.textContent = `已选择：${file.name}（${(file.size / 1024).toFixed(1)} KB）`;
      };
    });
    $('#tf-save', card).onclick = async () => {
      const out = {};
      const walk = (nodes) => nodes.forEach((n) => {
        if (['container', 'columns', 'unknown'].includes(n.type)) { walk(n.children || []); return; }
        if (n.type === 'table') {
          const arr = [];
          card.querySelectorAll(`[data-cell="${n.id}"]`).forEach((el) => {
            const ri = Number(el.dataset.ri), ci = Number(el.dataset.ci);
            arr[ri] = arr[ri] || [];
            arr[ri][ci] = el.value;
          });
          out[n.id] = arr;
          return;
        }
        if (n.type === 'checkbox') {
          out[n.id] = Array.from(card.querySelectorAll(`[data-fid="${n.id}"][data-multi]`)).filter((x) => x.checked).map((x) => x.value);
          return;
        }
        if (n.type === 'radio') {
          const el = card.querySelector(`[data-fid="${n.id}"]:checked`);
          out[n.id] = el ? el.value : '';
          return;
        }
        const el = card.querySelector(`[data-fid="${n.id}"]`);
        out[n.id] = el ? el.value : '';
      });
      walk(data.layout);
      const missing = [];
      const check = (nodes) => nodes.forEach((n) => {
        if (['container', 'columns', 'unknown'].includes(n.type)) { check(n.children || []); return; }
        if (!n.required) return;
        const val = out[n.id];
        if (val === '' || val === undefined || (Array.isArray(val) && !val.flat().filter(Boolean).length)) missing.push(n.label);
      });
      check(data.layout);
      if (missing.length) return toast(`请填写必填项：${missing.slice(0, 3).join('、')}`, 'warn');
      try {
        await api(`/api/tasks/${wb.task.id}/form`, { method: 'POST', body: { values: out } });
        toast('模板表单已保存', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  function highlightQc(text, issues) {
    if (!text) return '';
    const marks = (issues || []).filter((i) => Number.isFinite(i.start) && i.start >= 0 && i.end >= i.start)
      .sort((a, b) => a.start - b.start);
    let out = '', pos = 0;
    marks.forEach((i) => {
      let s = Math.min(text.length, Math.max(0, i.start));
      let t = Math.min(text.length, Math.max(s + 1, i.end));
      if (s < pos) s = pos;
      if (t <= s) return;
      const color = i.level === 'error' ? 'rgba(239,68,68,.38)' : i.level === 'warn' ? 'rgba(245,158,11,.36)' : 'rgba(59,130,246,.32)';
      out += e(text.slice(pos, s)) + `<mark style="background:${color};color:inherit;border-radius:3px" title="${e(i.message)}">${e(text.slice(s, t))}</mark>`;
      pos = t;
    });
    return out + e(text.slice(pos));
  }

  async function readExtras(tid) {
    const s = window.CK_STATE || {};
    const id = tid || (s.current && s.current.task && s.current.task.id) || (s.wb && s.wb.task && s.wb.task.id) || 0;
    if (!id) return {};
    const ex = await api(`/api/tasks/${id}/annotation/extras`).catch(() => ({}));
    return ex.extras || {};
  }

  function editPoly(polys, idx, done) {
    const p = polys[idx] || { label: '区域', points: [] };
    const pts = (p.points || []).map((pt) => pt.join(',')).join('\n');
    const holes = (p.holes || []).map((h) => h.map((pt) => pt.join(',')).join(';')).join('\n');
    openModal(`<div class="modal-head"><h3>编辑多边形 / 掩码轮廓</h3><button class="x" data-close>×</button></div>
      <div class="modal-body">
        <div class="field"><label>标签</label><input class="input" id="pe-label" value="${e(p.label || '')}"></div>
        <div class="field"><label>顶点（每行 x,y，归一化 0~1，至少 3 个）</label><textarea class="input" id="pe-pts" rows="8" style="font-family:ui-monospace,monospace">${e(pts)}</textarea></div>
        <div class="field"><label>孔洞（每行一个孔洞，点用 ; 分隔，可留空）</label><textarea class="input" id="pe-holes" rows="4" style="font-family:ui-monospace,monospace">${e(holes)}</textarea></div>
      </div>
      <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="pe-save">保存轮廓</button></div>`);
    $('#pe-save').onclick = async () => {
      const parse = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)
        .map((x) => x.split(/[,，\s]+/).map(Number)).filter((a) => a.length >= 2 && a.every((v) => !isNaN(v)));
      const points = parse($('#pe-pts').value);
      if (points.length < 3) return toast('至少需要 3 个顶点', 'warn');
      const holeList = $('#pe-holes').value.split('\n').map((x) => x.trim()).filter(Boolean)
        .map((line) => line.split(';').map((x) => x.split(/[,，\s]+/).map(Number)))
        .filter((h) => h.length >= 3 && h.every((a) => a.length >= 2 && a.every((v) => !isNaN(v))));
      polys[idx] = { ...polys[idx], label: $('#pe-label').value || '区域', points, holes: holeList };
      await saveExtras({ polygons: polys });
      closeModal();
      if (done) done();
    };
  }

  function imageTools(body, wb) {
    body.innerHTML = `<div class="grid two-col">
      <div><div class="panel-label">SAM 交互分割（框 / 点提示 · 多实例）</div>
        <div class="filters"><select class="input" id="sam-mode" style="width:100px"><option value="box">框提示</option><option value="point">点提示</option><option value="mixed">框+点</option></select>
          <input class="input" id="sam-label" placeholder="标签" style="width:100px"><button class="btn primary sm" id="sam-run">生成实例</button></div>
        <div class="filters" id="sam-box-row"><input class="input" id="sam-x" placeholder="x" style="width:64px"><input class="input" id="sam-y" placeholder="y" style="width:64px">
          <input class="input" id="sam-w" placeholder="w" style="width:64px"><input class="input" id="sam-h" placeholder="h" style="width:64px"></div>
        <div class="filters" id="sam-pt-row"><input class="input" id="sam-px" placeholder="点 x" style="width:70px"><input class="input" id="sam-py" placeholder="点 y" style="width:70px">
          <label class="toggle-wrap"><input type="checkbox" id="sam-pos" checked> 正样本</label>
          <input class="input" id="sam-batch" placeholder="多框批量：x,y,w,h; x,y,w,h" style="flex:1">
          <button class="btn ghost sm" id="sam-batch-run">批量</button></div>
        <div class="hint" id="sam-note">未配置 SAM 服务时按提示框/点生成可编辑多边形与掩码框；配置 operator.sam.url 后返回真实掩码。</div>
        <div class="panel-label" style="margin-top:12px">掩码 / 多边形（顶点与孔洞可编辑）</div>
        <div id="poly-list"></div>
        <div class="panel-label" style="margin-top:12px">关键点</div>
        <div class="filters"><input class="input" id="kp-x" placeholder="x" style="width:80px"><input class="input" id="kp-y" placeholder="y" style="width:80px">
        <input class="input" id="kp-label" placeholder="关键点名称" style="width:130px"><button class="btn primary sm" id="kp-add">添加关键点</button></div></div>
      <div><div class="panel-label">OCR 区域与字段校对</div>
        <div class="filters"><input class="input" id="ocr-page" placeholder="页" value="1" style="width:52px"><input class="input" id="ocr-bbox" placeholder="x0,y0,x1,y1" value="0.1,0.1,0.9,0.3" style="width:140px">
          <input class="input" id="ocr-conf" placeholder="置信度" value="0.9" style="width:68px"><input class="input" id="ocr-field" placeholder="字段名" style="width:90px">
          <input class="input" id="ocr-text" placeholder="区域文本" style="flex:1"><button class="btn primary sm" id="ocr-add">添加区域</button></div>
        <div class="filters"><input class="input" id="ocr-mfield" placeholder="映射字段" style="width:110px"><input class="input" id="ocr-mvalue" placeholder="字段值" style="width:110px">
          <button class="btn ghost sm" id="ocr-map">添加映射</button><button class="btn primary sm" id="ocr-run">运行 OCR</button></div>
        <div class="panel-label" style="margin-top:8px">区域列表（可改文本/置信度/字段）</div><div id="ocr-regions"></div>
        <div class="panel-label" style="margin-top:8px">字段映射与校对</div><div id="ocr-fields"></div>
        <div class="hint" id="ocr-note"></div>
        <div class="panel-label" style="margin-top:12px">开放词检测</div>
        <div class="filters"><input class="input" id="ov-prompt" placeholder="提示词，逗号分隔，如 安全帽,反光衣" style="flex:1"><input class="input" id="ov-conf" value="0.3" style="width:70px"><button class="btn primary sm" id="ov-run">检测</button></div>
        <div id="ov-out" class="hint"></div>
        <div class="panel-label" style="margin-top:12px">批量操作与版本</div>
        <div class="filters"><select class="input" id="bt-class" style="width:140px">${((wb.labels && wb.labels['目标类别']) || ['目标']).map((c) => `<option>${e(c)}</option>`).join('')}</select>
          <button class="btn ghost sm" id="bt-apply">批量改类</button>
          <button class="btn ghost sm" id="bt-delai">删除 AI 框</button>
          <button class="btn ghost sm" id="bt-accept">全部采纳</button>
          <button class="btn ghost sm" id="bt-undo">撤销上一版本</button></div>
        <div class="hint">快捷键：Ctrl+S 保存 · 1-9 切换类别 · Delete 删除选中 · Ctrl+Z 撤销</div></div></div>`;
    const drawPoly = async () => {
      const ex = await readExtras();
      const polys = ex.polygons || [];
      $('#poly-list').innerHTML = polys.length ? polys.map((p, i) => `<div class="filters" style="margin-bottom:4px;border-bottom:1px solid rgba(30,42,63,.4);padding-bottom:4px">
        <b>${e(p.label)}</b><span class="sub">${(p.points || []).length} 顶点${(p.holes || []).length ? ` · ${p.holes.length} 孔洞` : ''}</span>
        <span class="spacer"></span><button class="btn ghost sm" data-pedit="${i}">编辑顶点</button><button class="btn ghost sm danger" data-pdel="${i}">删除</button></div>`).join('')
        : '<div class="hint">暂无多边形，运行 SAM 或手动添加后在此编辑。</div>';
      $$('[data-pedit]').forEach((b) => { b.onclick = () => editPoly(polys, +b.dataset.pedit, drawPoly); });
      $$('[data-pdel]').forEach((b) => {
        b.onclick = async () => {
          const cur = (await readExtras()).polygons || [];
          cur.splice(+b.dataset.pdel, 1);
          await saveExtras({ polygons: cur });
          drawPoly();
        };
      });
    };
    const runSam = async (input) => {
      const r = await runOp('sam', input);
      if (!r) return;
      const ex = await readExtras();
      await saveExtras({ polygons: (ex.polygons || []).concat(r.result.polygons || []),
        masks: (ex.masks || []).concat(r.result.masks || []) });
      $('#sam-note').textContent = r.result.note || '';
      drawPoly();
    };
    $('#sam-mode').onchange = () => {
      const m = $('#sam-mode').value;
      $('#sam-box-row').style.display = m === 'point' ? 'none' : '';
      $('#sam-pt-row').style.display = m === 'box' ? 'none' : '';
    };
    $('#sam-run').onclick = () => {
      const mode = $('#sam-mode').value;
      const label = $('#sam-label').value || '目标';
      const input = { label };
      if (mode !== 'point') input.box = { x: +$('#sam-x').value || 0.2, y: +$('#sam-y').value || 0.2, w: +$('#sam-w').value || 0.3, h: +$('#sam-h').value || 0.3 };
      if (mode !== 'box') input.points = [{ x: +$('#sam-px').value || 0.5, y: +$('#sam-py').value || 0.5, positive: $('#sam-pos').checked ? 1 : 0, label }];
      runSam(input);
    };
    $('#sam-batch-run').onclick = () => {
      const boxes = $('#sam-batch').value.split(';').map((s) => s.split(/[,，\s]+/).map(Number))
        .filter((a) => a.length >= 4 && a.every((v) => !isNaN(v))).map((a) => ({ x: a[0], y: a[1], w: a[2], h: a[3] }));
      if (!boxes.length) return toast('请输入至少一个框：x,y,w,h; x,y,w,h', 'warn');
      runSam({ boxes, label: $('#sam-label').value || '目标' });
    };
    const drawOcr = async () => {
      const ex = await readExtras();
      const regs = ex.ocr_regions || [];
      const flds = ex.ocr_fields || {};
      $('#ocr-regions').innerHTML = regs.length ? regs.map((r, i) => `<div class="filters" style="margin-bottom:3px">
        <span class="sub">p${r.page}</span><span class="tag">${(r.bbox || []).join(',')}</span>
        <input class="input" data-oreg-text="${i}" value="${e(r.text || '')}" style="flex:1">
        <input class="input" data-oreg-conf="${i}" value="${r.conf}" title="置信度" style="width:58px">
        <input class="input" data-oreg-field="${i}" value="${e(r.field || '')}" placeholder="字段" style="width:80px">
        <button class="btn ghost sm danger" data-oreg-del="${i}">删</button></div>`).join('') : '<div class="hint">暂无 OCR 区域</div>';
      $('#ocr-fields').innerHTML = Object.keys(flds).length ? Object.entries(flds).map(([k, v]) => `<div class="filters" style="margin-bottom:3px">
        <b style="min-width:80px">${e(k)}</b><input class="input" data-ofield-val="${e(k)}" value="${e(v.value || '')}" style="flex:1">
        <input class="input" data-ofield-conf="${e(k)}" value="${v.conf}" title="置信度" style="width:58px">
        <label class="toggle-wrap"><input type="checkbox" data-ofield-fix="${e(k)}" ${v.corrected ? 'checked' : ''}> 已校对</label></div>`).join('') : '<div class="hint">暂无字段映射</div>';
      $$('[data-oreg-text]').forEach((el) => { el.onchange = async () => { regs[+el.dataset.oregText].text = el.value; await saveExtras({ ocr_regions: regs }); }; });
      $$('[data-oreg-conf]').forEach((el) => { el.onchange = async () => { regs[+el.dataset.oregConf].conf = Math.max(0, Math.min(1, +el.value || 0)); await saveExtras({ ocr_regions: regs }); }; });
      $$('[data-oreg-field]').forEach((el) => { el.onchange = async () => { regs[+el.dataset.oregField].field = el.value; await saveExtras({ ocr_regions: regs }); }; });
      $$('[data-oreg-del]').forEach((el) => { el.onclick = async () => { regs.splice(+el.dataset.oregDel, 1); await saveExtras({ ocr_regions: regs }); drawOcr(); }; });
      $$('[data-ofield-val]').forEach((el) => { el.onchange = async () => { flds[el.dataset.ofieldVal].value = el.value; await saveExtras({ ocr_fields: flds }); }; });
      $$('[data-ofield-conf]').forEach((el) => { el.onchange = async () => { flds[el.dataset.ofieldConf].conf = Math.max(0, Math.min(1, +el.value || 0)); await saveExtras({ ocr_fields: flds }); }; });
      $$('[data-ofield-fix]').forEach((el) => { el.onchange = async () => { flds[el.dataset.ofieldFix].corrected = el.checked; await saveExtras({ ocr_fields: flds }); }; });
    };
    $('#ocr-add').onclick = async () => {
      const bbox = $('#ocr-bbox').value.split(',').map(Number);
      if (bbox.length !== 4 || bbox.some(isNaN)) return toast('bbox 需 4 个坐标', 'warn');
      const ex = await readExtras();
      const regs = (ex.ocr_regions || []).concat([{ page: +$('#ocr-page').value || 1, bbox,
        text: $('#ocr-text').value, conf: +$('#ocr-conf').value || 0, field: $('#ocr-field').value, engine: 'manual' }]);
      await saveExtras({ ocr_regions: regs });
      drawOcr();
    };
    $('#ocr-map').onclick = async () => {
      const name = $('#ocr-mfield').value.trim();
      if (!name) return toast('请填写字段名', 'warn');
      const ex = await readExtras();
      const flds = { ...(ex.ocr_fields || {}), [name]: { value: $('#ocr-mvalue').value, conf: +$('#ocr-conf').value || 0, corrected: false } };
      await saveExtras({ ocr_fields: flds });
      drawOcr();
    };
    $('#ocr-run').onclick = async () => {
      const ex = await readExtras();
      const regions = ex.ocr_regions || [];
      const fields = {};
      Object.entries(ex.ocr_fields || {}).forEach(([k, v]) => { fields[k] = v.value; });
      if (!regions.length && !Object.keys(fields).length) return toast('请先添加 OCR 区域或字段映射', 'warn');
      const r = await runOp('ocr', { regions, fields, hint: $('#ocr-text').value });
      if (!r) return;
      $('#ocr-note').textContent = `${r.result.note || ''} 平均置信度 ${r.result.mean_conf ?? 0}`;
      const outFields = {};
      (r.result.field_map || []).forEach((f) => { outFields[f.field] = { value: f.value, conf: f.conf, corrected: false }; });
      Object.entries(r.result.fields || {}).forEach(([k, v]) => { if (!outFields[k]) outFields[k] = { value: String(v), conf: 0, corrected: false }; });
      await saveExtras({ ocr_regions: (r.result.regions || []).length ? r.result.regions : regions, ocr_fields: outFields });
      drawOcr();
    };
    $('#kp-add').onclick = async () => {
      await saveExtras({ keypoints: [{ label: $('#kp-label').value || '关键点', x: +$('#kp-x').value || 0.5, y: +$('#kp-y').value || 0.5, visibility: 2 }] });
      toast('关键点已追加', 'ok');
    };
    $('#ov-run').onclick = async () => {
      const r = await runOp('open_vocab', { prompt: $('#ov-prompt').value, min_conf: +$('#ov-conf').value });
      if (!r) return;
      const boxes = r.result.boxes || [];
      $('#ov-out').innerHTML = boxes.length ? boxes.map((b) => `<div class="sub">${e(b.cls)} · ${(b.conf || 0).toFixed ? b.conf.toFixed(2) : b.conf} · (${b.x},${b.y},${b.w},${b.h})</div>`).join('') + `<button class="btn primary sm" id="ov-apply" style="margin-top:8px">写入标注</button>` : '未检出目标';
      if ($('#ov-apply')) $('#ov-apply').onclick = async () => { await applyBoxes(boxes); };
    };
    $('#bt-apply').onclick = () => {
      if (!wb.boxes) return toast('当前没有目标框', 'warn');
      wb.boxes.forEach((b) => { b.cls = $('#bt-class').value; });
      if (window.markDirty) window.markDirty(wb);
      if (window.refreshBoxUI) window.refreshBoxUI(wb);
      toast('已批量修改类别', 'ok');
    };
    $('#bt-delai').onclick = () => {
      wb.boxes = (wb.boxes || []).filter((b) => b.source !== 'ai');
      wb.selected = -1;
      if (window.markDirty) window.markDirty(wb);
      if (window.refreshBoxUI) window.refreshBoxUI(wb);
      toast('已删除 AI 预标注框，可重新运行预标注', 'ok');
    };
    $('#bt-accept').onclick = () => { (wb.boxes || []).forEach((b) => { b.source = 'manual'; }); if (window.markDirty) window.markDirty(wb); toast('已全部采纳为人工结果', 'ok'); };
    $('#bt-undo').onclick = () => undoVersion(wb.task.id);
    drawPoly();
    drawOcr();
  }

  function audioTools(body, wb) {
    const segOpts = (wb.segments || []).map((s, i) => `<option value="${i}">#${i + 1} ${Number(s.start).toFixed(2)}→${Number(s.end).toFixed(2)} ${e((s.text || '').slice(0, 12))}</option>`).join('');
    body.innerHTML = `<div class="grid two-col">
      <div><div class="panel-label">情感标注（作用于选中片段）</div>
        <div class="filters"><select class="input" id="au-seg" style="width:200px">${segOpts || '<option value="">暂无片段</option>'}</select>
        <select class="input" id="au-emo" style="width:110px"><option>中性</option><option>积极</option><option>消极</option><option>愤怒</option><option>犹豫</option></select>
        <button class="btn primary sm" id="au-emo-save">应用</button></div>
        <div class="panel-label" style="margin-top:12px">TTS 验证</div>
        <div class="filters"><select class="input" id="au-tts" style="width:140px"><option value="pass">自然度通过</option><option value="warn">韵律异常</option><option value="fail">发音错误</option></select>
        <input class="input" id="au-tts-note" placeholder="备注" style="width:150px"><button class="btn primary sm" id="au-tts-save">记录 TTS 校验</button></div>
        <div class="panel-label" style="margin-top:12px">音频事件</div>
        <div class="filters"><input class="input" id="au-ev-s" placeholder="开始" style="width:80px"><input class="input" id="au-ev-e" placeholder="结束" style="width:80px">
        <input class="input" id="au-ev-l" placeholder="事件，如 笑声" style="width:120px"><button class="btn primary sm" id="au-ev-add">添加事件</button></div></div>
      <div><div class="panel-label">切分并转写</div>
        <div class="filters"><input class="input" id="au-cut-s" placeholder="开始秒" style="width:90px"><input class="input" id="au-cut-e" placeholder="结束秒" style="width:90px">
        <button class="btn primary sm" id="au-cut-run">调用 ASR</button></div>
        <div id="au-cut-out" class="hint"></div>
        <div class="panel-label" style="margin-top:12px">规则质检</div>
        <button class="btn ghost sm" id="au-qc">检查转写文本</button><pre class="hint" id="au-qc-out" style="white-space:pre-wrap;margin-top:6px"></pre></div></div>`;
    $('#au-emo-save').onclick = async () => {
      const segs = wb.segments || [];
      const idx = Number($('#au-seg').value || 0);
      if (!segs[idx]) return toast('暂无片段时间轴', 'warn');
      segs[idx].emotion = $('#au-emo').value;
      await saveExtras({ emotion: segs.map((s) => ({ start: s.start, end: s.end, label: s.emotion || '中性' })) });
      if (window.markDirty) window.markDirty(wb);
    };
    $('#au-tts-save').onclick = async () => saveExtras({ tts: [{ verdict: $('#au-tts').value, note: $('#au-tts-note').value, at: new Date().toISOString() }] });
    $('#au-ev-add').onclick = async () => saveExtras({ events: [{ start: +$('#au-ev-s').value || 0, end: +$('#au-ev-e').value || 1, label: $('#au-ev-l').value || '音频事件' }] });
    $('#au-cut-run').onclick = async () => {
      const r = await runOp('asr', { start: +$('#au-cut-s').value || 0, end: +$('#au-cut-e').value || 0 });
      if (!r) return;
      const s0 = +$('#au-cut-s').value || 0, s1 = +$('#au-cut-e').value || 1e9;
      const hits = (r.result.segments || []).filter((s) => s.end >= s0 && s.start <= s1);
      $('#au-cut-out').innerHTML = hits.map((s) => `<div class="sub">${s.start} → ${s.end} · ${e(s.text)}</div>`).join('') || '该区间未识别到语音';
      if (hits.length) {
        wb.segments = (wb.segments || []).concat(hits);
        if (window.markDirty) window.markDirty(wb);
      }
    };
    $('#au-qc').onclick = async () => {
      const r = await api(`/api/tasks/${taskId()}/qc/operators/run`, { method: 'POST', body: {} });
      const data = await api(`/api/tasks/${taskId()}`).catch(() => ({}));
      const payload = asObj(data.annotation && data.annotation.payload);
      const text = payload.text || (wb.segments || []).map((s) => s.text || '').join('\n');
      $('#au-qc-out').innerHTML = `<div>得分 ${r.score} · 阈值 ${r.threshold} · ${r.passed ? '通过' : '未通过'}</div>`
        + (r.issues.length ? `<div style="margin-top:6px;line-height:1.9">${highlightQc(text, r.issues)}</div>`
          + r.issues.map((i) => `<div class="sub">[${i.level}] ${e(i.message)}${i.suggestion ? ` → ${e(i.suggestion)}` : ''} @${i.start}</div>`).join('')
          : '<div class="hint">未发现问题</div>');
    };
  }

  function videoTools(body, wb) {
    body.innerHTML = `<div class="grid two-col"><div>
      <div class="panel-label">事件区间与时间轴联动</div>
      <div class="filters"><input class="input" id="ve-s" placeholder="开始秒" style="width:80px"><input class="input" id="ve-e" placeholder="结束秒" style="width:80px">
      <input class="input" id="ve-l" placeholder="事件标签" style="width:110px"><button class="btn primary sm" id="ve-add">添加区间</button></div>
      <div id="ve-bar" style="height:24px;background:rgba(30,42,63,.7);border-radius:6px;position:relative;margin:6px 0;cursor:pointer" title="点击定位"></div>
      <div id="ve-list" class="hint"></div>
      <div class="panel-label" style="margin-top:12px">目标跟踪（向前/向后传播 · 断轨 · 合并）</div>
      <div class="filters"><select class="input" id="vt-dir" style="width:90px"><option value="both">双向传播</option><option value="forward">向前传播</option><option value="backward">向后传播</option></select>
        <input class="input" id="vt-gap" value="0.5" title="断轨间隔（秒）" style="width:80px">
        <input class="input" id="vt-merge" placeholder="合并轨迹：A,B; C,D" style="flex:1">
        <button class="btn primary sm" id="vt-run">传播并回填</button></div>
      <div id="vt-out" class="hint"></div></div>
      <div><div class="panel-label">逐帧操作</div>
      <div class="filters"><button class="btn ghost sm" id="vf-prev">上一帧</button><button class="btn ghost sm" id="vf-next">下一帧</button>
      <span class="hint">使用 ← / → 键逐帧（0.04s）</span></div>
      <div class="panel-label" style="margin-top:12px">规则质检（定位到帧/事件）</div><button class="btn ghost sm" id="vq-run">检查当前标注</button><pre class="hint" id="vq-out" style="white-space:pre-wrap;margin-top:6px"></pre></div></div>`;
    const vid = () => document.querySelector('#wb video') || document.querySelector('#v-video') || document.querySelector('video');
    const seek = (t) => {
      const v = vid();
      if (v) { v.currentTime = Math.max(0, Math.min(v.duration || t, t)); v.pause && v.pause(); }
      else toast(`已定位到 ${t.toFixed(2)}s（当前无视频元素）`, 'ok');
    };
    const drawEvents = async () => {
      const ex = await readExtras(wb.task.id);
      const evs = ex.events || [];
      const v = vid();
      const dur = (v && isFinite(v.duration) && v.duration) || Number(wb.task.duration) || Math.max(1, ...evs.map((x) => Number(x.end) || 0));
      $('#ve-bar').innerHTML = evs.map((x) => {
        const left = Math.max(0, Math.min(100, Number(x.start) / dur * 100));
        const width = Math.max(0.6, Math.min(100 - left, (Number(x.end) - Number(x.start)) / dur * 100));
        return `<i title="${e(x.label)} ${x.start}→${x.end}" style="position:absolute;left:${left}%;width:${width}%;top:0;bottom:0;background:rgba(59,130,246,.55);border-right:1px solid #3B82F6"></i>`;
      }).join('');
      $('#ve-list').innerHTML = evs.length ? evs.map((x, i) => `<div class="filters" style="margin-bottom:2px">
        <span class="tag">${x.start} → ${x.end}</span><b>${e(x.label)}</b><span class="spacer"></span>
        <button class="btn ghost sm" data-ev-seek="${i}">定位</button><button class="btn ghost sm danger" data-ev-del="${i}">删除</button></div>`).join('') : '暂无事件区间';
      $('#ve-bar').onclick = (ev) => { const r = $('#ve-bar').getBoundingClientRect(); seek(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * dur); };
      $$('[data-ev-seek]').forEach((b) => { b.onclick = () => { const x = evs[+b.dataset.evSeek]; if (x) seek((Number(x.start) + Number(x.end)) / 2); }; });
      $$('[data-ev-del]').forEach((b) => {
        b.onclick = async () => { evs.splice(+b.dataset.evDel, 1); await saveExtras({ events: evs }); drawEvents(); };
      });
    };
    $('#ve-add').onclick = async () => {
      const s = +$('#ve-s').value || 0, en = +$('#ve-e').value || (s + 1);
      if (en <= s) return toast('结束时间需大于开始时间', 'warn');
      const ex = await readExtras(wb.task.id);
      await saveExtras({ events: (ex.events || []).concat([{ start: s, end: en, label: $('#ve-l').value || '事件' }]) });
      drawEvents();
    };
    $('#vt-run').onclick = async () => {
      const data = await api(`/api/tasks/${taskId()}`);
      const payload = asObj(data.annotation && data.annotation.payload);
      const merge = $('#vt-merge').value.split(';').map((s) => s.split(/[,，\s]+/).filter(Boolean)).filter((a) => a.length === 2);
      const r = await runOp('track', { tracks: payload.tracks || [], direction: $('#vt-dir').value,
        max_gap: +$('#vt-gap').value || 0.5, merge });
      if (!r) return;
      payload.tracks = r.result.tracks || payload.tracks;
      await api(`/api/tasks/${taskId()}/annotation`, { method: 'POST', body: { payload } });
      const segs = r.result.tracks || [];
      $('#vt-out').innerHTML = `${e(r.result.note || '已完成传播')}<br/>${segs.map((t) => `<div class="sub">${e(t.label || t.id || '轨迹')} · ${(t.keyframes || []).length} 帧 · ${(t.segments || []).length} 段${t.breaks ? ` · 断轨 ${t.breaks}` : ''}${(t.merged_from || []).length ? ` · 合并 ${t.merged_from.map(e).join('、')}` : ''}</div>`).join('')}`;
      toast('跟踪结果已回填，可逐帧修正后再次传播', 'ok');
    };
    $('#vf-prev').onclick = () => { const v = vid(); if (v) v.currentTime = Math.max(0, v.currentTime - 0.04); };
    $('#vf-next').onclick = () => { const v = vid(); if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 0.04); };
    $('#vq-run').onclick = async () => {
      const r = await api(`/api/tasks/${taskId()}/qc/operators/run`, { method: 'POST', body: {} }).catch((err) => ({ error: err.message }));
      $('#vq-out').textContent = r.error || `得分 ${r.score} · 阈值 ${r.threshold} · ${r.passed ? '通过' : '未通过'}\n` + (r.issues.map((i) => `[${i.level}] ${i.message}`).join('\n') || '未发现问题');
    };
    document.addEventListener('keydown', (ev) => {
      const v = vid();
      if (!v || ev.target.matches('input,textarea,select')) return;
      if (ev.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 0.04);
      if (ev.key === 'ArrowRight') v.currentTime = Math.min(v.duration || 0, v.currentTime + 0.04);
    });
    drawEvents();
  }

  function llmTools(body, wb) {
    body.innerHTML = `<div class="grid two-col"><div>
      <div class="panel-label">偏好排序数据（chosen / rejected）</div>
      <div class="field"><label>问题 / 指令</label><textarea class="input" id="pf-prompt" rows="2"></textarea></div>
      <div class="field"><label>优选回答</label><textarea class="input" id="pf-chosen" rows="3"></textarea></div>
      <div class="field"><label>劣选回答</label><textarea class="input" id="pf-rejected" rows="3"></textarea></div>
      <div class="field"><label>偏好理由</label><input class="input" id="pf-reason" placeholder="如 更准确、更简洁"></div>
      <button class="btn primary" id="pf-save">保存偏好样本</button>
      <div class="panel-label" style="margin-top:12px">视觉语言标注</div>
      <div class="field"><label>图片 URL / 媒体名</label><input class="input" id="vl-img" placeholder="/media/xxx.jpg"></div>
      <div class="field"><label>描述</label><textarea class="input" id="vl-cap" rows="3"></textarea></div>
      <div class="field"><label>涉及对象（逗号分隔）</label><input class="input" id="vl-obj"></div>
      <div class="filters"><select class="input" id="vl-verdict" style="width:120px"><option value="ok">一致</option><option value="partial">部分一致</option><option value="bad">不一致</option></select>
      <button class="btn primary" id="vl-save">保存视觉语言样本</button></div></div>
      <div><div class="panel-label">指令问答对</div>
      <div class="field"><label>问题</label><input class="input" id="qa-q" placeholder="如：文档中的赔付标准是什么？"></div>
      <div class="field"><label>答案</label><textarea class="input" id="qa-a" rows="2"></textarea></div>
      <div class="field"><label>依据 / 出处</label><input class="input" id="qa-ev" placeholder="原文片段或页码"></div>
      <div class="filters"><button class="btn primary sm" id="qa-save">添加问答对</button>
        <button class="btn ghost sm" id="qa-gen">从文本生成候选</button>
        <button class="btn ghost sm" id="qa-compare">多算子对比</button></div>
      <div id="qa-list" style="margin-top:6px"></div>
      <div class="panel-label" style="margin-top:12px">多轮对话</div>
      <div class="filters"><select class="input" id="dl-role" style="width:96px"><option>user</option><option>assistant</option><option>system</option></select>
        <input class="input" id="dl-content" placeholder="对话内容" style="flex:1"><button class="btn primary sm" id="dl-add">添加轮次</button>
        <button class="btn ghost sm" id="dl-clear">清空</button></div>
      <div id="dl-list" style="margin-top:6px"></div>
      <div class="panel-label" style="margin-top:12px">评分与润色</div>
      <div class="filters"><select class="input" id="rt-dim" style="width:120px"><option>整体质量</option><option>准确性</option><option>有用性</option><option>安全性</option><option>风格一致性</option></select>
        <input class="input" id="rt-score" type="number" min="0" max="10" value="8" style="width:64px"><input class="input" id="rt-note" placeholder="评语" style="flex:1">
        <button class="btn primary sm" id="rt-add">提交评分</button></div>
      <div id="rt-list" style="margin-top:6px"></div>
      <div class="field" style="margin-top:8px"><label>待润色文本（留空取当前任务文本）</label><textarea class="input" id="pl-orig" rows="2"></textarea></div>
      <div class="filters"><input class="input" id="pl-style" value="简洁" placeholder="简洁/学术/口语" style="width:110px">
        <button class="btn primary sm" id="pl-run">润色</button><button class="btn ghost sm" id="pl-accept">采纳为答案</button></div>
      <div class="hint" id="pl-out" style="white-space:pre-wrap"></div>
      <div id="pl-list" style="margin-top:6px"></div>
      </div></div>`;
    $('#pf-save').onclick = async () => {
      if (!$('#pf-chosen').value.trim() || !$('#pf-rejected').value.trim()) return toast('请填写优选与劣选回答', 'warn');
      await saveExtras({ preference: { prompt: $('#pf-prompt').value, chosen: $('#pf-chosen').value, rejected: $('#pf-rejected').value, reason: $('#pf-reason').value } });
      toast('偏好样本已保存', 'ok');
    };
    $('#vl-save').onclick = async () => {
      await saveExtras({ vision: { image: $('#vl-img').value || wb.mediaName, caption: $('#vl-cap').value, objects: $('#vl-obj').value.split(',').filter(Boolean), verdict: $('#vl-verdict').value } });
      toast('视觉语言样本已保存', 'ok');
    };
    let candidates = [];
    const drawQa = async () => {
      const ex = await readExtras(wb.task.id);
      const qa = ex.qa || [];
      $('#qa-list').innerHTML = qa.length ? qa.map((q, i) => `<div style="border-bottom:1px solid rgba(30,42,63,.45);padding:4px 0">
        <b>${e(q.question)}</b><div class="sub">${e(q.answer)}</div>
        <div class="sub">出处：${e(q.evidence || '—')} · ${e(q.algo || 'human')}</div>
        <button class="btn ghost sm danger" data-qa-del="${i}">删除</button></div>`).join('') + (candidates.length ? '<div class="panel-label" style="margin-top:6px">候选（点击采纳）</div>' : '') : '<div class="hint">暂无问答对</div>';
      $$('[data-qa-del]').forEach((b) => { b.onclick = async () => { qa.splice(+b.dataset.qaDel, 1); await saveExtras({ qa }); drawQa(); }; });
      $$('[data-qa-take]').forEach((b) => {
        b.onclick = async () => {
          const c = candidates[+b.dataset.qaTake];
          if (!c) return;
          await saveExtras({ qa: qa.concat([{ question: $('#qa-q').value.trim() || '文档要点', answer: c.answer, evidence: c.evidence || c.answer, algo: 'builtin' }]) });
          toast('已采纳为问答对', 'ok');
          drawQa();
        };
      });
    };
    $('#qa-save').onclick = async () => {
      const q = $('#qa-q').value.trim(), a = $('#qa-a').value.trim();
      if (!q || !a) return toast('请填写问题与答案', 'warn');
      const ex = await readExtras(wb.task.id);
      await saveExtras({ qa: (ex.qa || []).concat([{ question: q, answer: a, evidence: $('#qa-ev').value, algo: 'human' }]) });
      $('#qa-a').value = '';
      toast('问答对已保存', 'ok');
      drawQa();
    };
    $('#qa-gen').onclick = async () => {
      const r = await api('/api/qa/compare', { method: 'POST', body: { task_id: wb.task.id, question: $('#qa-q').value, algos: ['template'] } }).catch((err) => ({ error: err.message }));
      if (r.error) return toast(r.error, 'err');
      candidates = ((r.results || [])[0] || {}).answers || [];
      if (!candidates.length) return toast('未生成候选，请先保存文本标注', 'warn');
      const ex = await readExtras(wb.task.id);
      const qa = ex.qa || [];
      $('#qa-list').innerHTML = qa.map((q, i) => `<div style="border-bottom:1px solid rgba(30,42,63,.45);padding:4px 0"><b>${e(q.question)}</b><div class="sub">${e(q.answer)}</div></div>`).join('')
        + '<div class="panel-label" style="margin-top:6px">候选（点击采纳）</div>'
        + candidates.map((c, i) => `<div class="filters" style="margin-bottom:3px"><span style="flex:1">${e(c.answer)}</span><button class="btn ghost sm" data-qa-take="${i}">采纳</button></div>`).join('');
      $$('[data-qa-take]').forEach((b) => {
        b.onclick = async () => {
          const c = candidates[+b.dataset.qaTake];
          await saveExtras({ qa: qa.concat([{ question: $('#qa-q').value.trim() || '文档要点', answer: c.answer, evidence: c.evidence || '', algo: 'builtin' }]) });
          toast('已采纳为问答对', 'ok');
          candidates = [];
          drawQa();
        };
      });
    };
    $('#qa-compare').onclick = () => {
      openModal(`<div class="modal-head"><h3>多算子 / 多模型问答对比</h3><button class="x" data-close>×</button></div>
        <div class="modal-body"><div class="filters"><input class="input" id="cmp-q" placeholder="输入问题（留空则按文档要点抽取）" style="flex:1">
        <button class="btn primary" id="cmp-run">对比运行</button></div><div id="cmp-out" style="margin-top:10px"></div></div>`);
      $('#cmp-run').onclick = async () => {
        $('#cmp-out').innerHTML = '<div class="hint">运行中…</div>';
        const r = await api('/api/qa/compare', { method: 'POST', body: { task_id: wb.task.id, question: $('#cmp-q').value, algos: ['extractive', 'template'], use_external: true } }).catch((err) => ({ error: err.message }));
        if (r.error) { $('#cmp-out').innerHTML = `<div class="hint">${e(r.error)}</div>`; return; }
        $('#cmp-out').innerHTML = (r.results || []).map((x) => `<div class="card" style="margin-bottom:8px"><div class="card-body">
          <div class="filters"><b>${e(x.name)}</b><span class="tag">${e(x.model || '')}</span><span class="spacer"></span><span class="sub">${(x.answers || []).length} 条</span></div>
          ${x.error ? `<div class="hint">${e(x.error)}</div>` : (x.answers || []).map((a) => `<div style="border-top:1px solid rgba(30,42,63,.45);padding:5px 0">
            <div>${e(a.answer)}</div><div class="sub">来源：${e(x.name)}${a.start != null ? ` @${a.start}-${a.end}` : ' · 生成'}${a.score != null ? ` · 相关度 ${a.score}` : ''}</div></div>`).join('')}
        </div></div>`).join('');
      };
    };
    const drawDialog = async () => {
      const ex = await readExtras(wb.task.id);
      const dialog = ex.dialog || [];
      $('#dl-list').innerHTML = dialog.length ? dialog.map((m, i) => `<div class="filters" style="margin-bottom:3px;align-items:flex-start">
        <span class="chip ${m.role === 'assistant' ? 'done' : m.role === 'system' ? 'plain' : 'annotating'}" style="min-width:62px">${e(m.role)}</span>
        <input class="input" data-dl-content="${i}" value="${e(m.content)}" style="flex:1">
        <input class="input" data-dl-rate="${i}" type="number" min="0" max="10" value="${m.rating || 0}" title="评分" style="width:58px">
        <button class="btn ghost sm danger" data-dl-del="${i}">删</button></div>`).join('') : '<div class="hint">暂无对话，按 user / assistant 顺序添加轮次。</div>';
      $$('[data-dl-content]').forEach((el) => { el.onchange = async () => { dialog[+el.dataset.dlContent].content = el.value; await saveExtras({ dialog }); }; });
      $$('[data-dl-rate]').forEach((el) => { el.onchange = async () => { dialog[+el.dataset.dlRate].rating = Math.max(0, Math.min(10, +el.value || 0)); await saveExtras({ dialog }); }; });
      $$('[data-dl-del]').forEach((b) => { b.onclick = async () => { dialog.splice(+b.dataset.dlDel, 1); await saveExtras({ dialog }); drawDialog(); }; });
    };
    $('#dl-add').onclick = async () => {
      const content = $('#dl-content').value.trim();
      if (!content) return toast('请输入对话内容', 'warn');
      const ex = await readExtras(wb.task.id);
      const dialog = (ex.dialog || []).concat([{ role: $('#dl-role').value, content, rating: 0, turn: (ex.dialog || []).length + 1 }]);
      await saveExtras({ dialog });
      $('#dl-content').value = '';
      drawDialog();
    };
    $('#dl-clear').onclick = async () => {
      if (!confirm('确认清空全部多轮对话？')) return;
      await saveExtras({ dialog: [] });
      drawDialog();
    };
    const drawRatings = async () => {
      const ex = await readExtras(wb.task.id);
      const ratings = ex.ratings || [];
      $('#rt-list').innerHTML = ratings.length ? ratings.map((r) => `<div class="filters" style="margin-bottom:3px">
        <span class="tag">${e(r.dimension)}</span><b>${r.score}/10</b><span class="sub" style="flex:1">${e(r.note || '')}</span></div>`).join('') : '<div class="hint">暂无评分</div>';
    };
    $('#rt-add').onclick = async () => {
      const ex = await readExtras(wb.task.id);
      await saveExtras({ ratings: (ex.ratings || []).concat([{ dimension: $('#rt-dim').value, score: +$('#rt-score').value || 0, note: $('#rt-note').value, target: wb.mediaName || '' }]) });
      toast('评分已提交', 'ok');
      drawRatings();
    };
    let lastPolish = null;
    const drawPolish = async () => {
      const ex = await readExtras(wb.task.id);
      const logs = ex.polish || [];
      $('#pl-list').innerHTML = logs.length ? logs.map((p) => `<div style="border-top:1px solid rgba(30,42,63,.45);padding:4px 0">
        <div class="sub">原文：${e(p.original)}</div><div>${e(p.polished)}</div>
        <div class="sub">${e(p.style)} · ${p.accepted ? '已采纳' : '未采纳'}</div></div>`).join('') : '';
    };
    $('#pl-run').onclick = async () => {
      let text = $('#pl-orig').value.trim();
      if (!text) {
        const data = await api(`/api/tasks/${wb.task.id}`).catch(() => ({}));
        text = asObj(data.annotation && data.annotation.payload).text || '';
      }
      if (!text) return toast('请输入文本或先保存文本标注', 'warn');
      const r = await runOp('llm', { text, style: $('#pl-style').value || '简洁' });
      if (!r) return;
      lastPolish = { original: text, polished: r.result.polished || text, style: r.result.style || '简洁' };
      $('#pl-out').textContent = `${r.result.note || ''}\n\n${lastPolish.polished}`;
    };
    $('#pl-accept').onclick = async () => {
      if (!lastPolish) return toast('请先运行润色', 'warn');
      const ex = await readExtras(wb.task.id);
      const qa = (ex.qa || []).concat([{ question: $('#qa-q').value.trim() || '润色文本', answer: lastPolish.polished, evidence: lastPolish.original.slice(0, 60), algo: 'polish' }]);
      await saveExtras({ polish: (ex.polish || []).concat([{ ...lastPolish, accepted: true }]), qa });
      toast('润色结果已采纳', 'ok');
      lastPolish = null;
      $('#pl-out').textContent = '';
      drawQa();
      drawPolish();
    };
    drawQa();
    drawDialog();
    drawRatings();
    drawPolish();
  }

  function multiTools(body, wb) {
    const media = (window.CK_STATE.current.media || []);
    const names = [wb.mediaName, ...media.map((m) => m.name)].filter(Boolean);
    body.innerHTML = `<div class="panel-label">跨模态配对（支持时间区间与区域对齐）</div>
      <div class="filters"><select class="input" id="mp-a" style="width:150px">${names.map((n) => `<option>${e(n)}</option>`).join('')}</select>
      <select class="input" id="mp-b" style="width:150px">${names.map((n) => `<option>${e(n)}</option>`).join('')}</select>
      <select class="input" id="mp-rel" style="width:118px"><option>图文对齐</option><option>音文对齐</option><option>视频文本对齐</option><option>视频音频对齐</option></select>
      <select class="input" id="mp-v" style="width:92px"><option value="match">一致</option><option value="mismatch">不一致</option><option value="uncertain">存疑</option></select>
      <input class="input" id="mp-note" placeholder="备注" style="width:140px"></div>
      <div class="filters"><span class="hint">A 区间</span><input class="input" id="mp-as" placeholder="开始秒" style="width:72px"><input class="input" id="mp-ae" placeholder="结束秒" style="width:72px">
        <span class="hint">B 区间</span><input class="input" id="mp-bs" placeholder="开始秒" style="width:72px"><input class="input" id="mp-be" placeholder="结束秒" style="width:72px">
        <input class="input" id="mp-ar" placeholder="A 区域 x,y,w,h" style="width:130px"><input class="input" id="mp-br" placeholder="B 区域 x,y,w,h" style="width:130px">
        <button class="btn primary sm" id="mp-add">保存配对</button></div>
      <div id="mp-sync-info" class="hint"></div>
      <div class="filters" style="margin-top:4px"><button class="btn ghost sm" id="mp-play">同步播放</button><button class="btn ghost sm" id="mp-pause">全部暂停</button>
        <span class="hint">多面板按配对起点同步定位，偏差与区间可视化展示</span></div>
      <div id="mp-list" style="margin-top:10px"></div>`;
    const els = () => Array.from(document.querySelectorAll('#wb video,#wb audio'));
    const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
    const region = (v) => v.split(',').map(Number).filter((x) => !isNaN(x)).slice(0, 4);
    const draw = async () => {
      const ex = await readExtras(wb.task.id);
      const pairs = ex.pairs || [];
      const maxT = Math.max(1, ...pairs.map((p) => Math.max(Number(p.a_end) || 0, Number(p.b_end) || 0, Number(p.a_start) || 0, Number(p.b_start) || 0)));
      $('#mp-list').innerHTML = pairs.length ? pairs.map((p, i) => {
        const aL = Math.min(100, (Number(p.a_start) || 0) / maxT * 100);
        const aW = Math.max(0.8, (Math.max(0, (Number(p.a_end) || 0) - (Number(p.a_start) || 0))) / maxT * 100);
        const bL = Math.min(100, (Number(p.b_start) || 0) / maxT * 100);
        const bW = Math.max(0.8, (Math.max(0, (Number(p.b_end) || 0) - (Number(p.b_start) || 0))) / maxT * 100);
        const label = { match: '一致', mismatch: '不一致', uncertain: '存疑' }[p.verdict] || p.verdict;
        return `<div style="border-bottom:1px solid rgba(30,42,63,.45);padding:5px 0">
          <div class="filters"><b>${e(p.a)}</b><span class="sub">${p.a_start != null ? `${p.a_start}→${p.a_end}` : ''}</span>
            <span class="hint">↔</span><b>${e(p.b)}</b><span class="sub">${p.b_start != null ? `${p.b_start}→${p.b_end}` : ''}</span>
            <span class="chip ${p.verdict === 'match' ? 'done' : p.verdict === 'mismatch' ? 'danger' : 'pending'}">${label}</span>
            <span class="spacer"></span><button class="btn ghost sm" data-mp-sync="${i}">同步定位</button>
            <button class="btn ghost sm" data-mp-play="${i}">同步播放</button><button class="btn ghost sm danger" data-mp-del="${i}">删除</button></div>
          <div class="sub">${e(p.relation)} · ${e(p.note || '')}${(p.a_region || []).length ? ` · A 区域 ${p.a_region.join(',')}` : ''}${(p.b_region || []).length ? ` · B 区域 ${p.b_region.join(',')}` : ''}</div>
          <div style="height:14px;margin-top:3px">
            <div style="height:6px;background:rgba(59,130,246,.35);border-radius:3px;position:relative"><i style="position:absolute;left:${aL}%;width:${aW}%;top:0;bottom:0;background:#3B82F6;border-radius:3px"></i></div>
            <div style="height:6px;background:rgba(16,185,129,.3);border-radius:3px;position:relative;margin-top:2px"><i style="position:absolute;left:${bL}%;width:${bW}%;top:0;bottom:0;background:#10B981;border-radius:3px"></i></div>
          </div></div>`;
      }).join('') : '<div class="hint">暂无跨模态配对</div>';
      $$('[data-mp-sync]').forEach((b) => { b.onclick = () => syncPair(pairs[+b.dataset.mpSync]); });
      $$('[data-mp-play]').forEach((b) => {
        b.onclick = () => {
          syncPair(pairs[+b.dataset.mpPlay]);
          els().forEach((el) => { const p = el.play && el.play(); if (p && p.catch) p.catch(() => {}); });
        };
      });
      $$('[data-mp-del]').forEach((b) => { b.onclick = async () => { pairs.splice(+b.dataset.mpDel, 1); await saveExtras({ pairs }); draw(); }; });
    };
    const syncPair = (p) => {
      if (!p) return;
      const list = els();
      const set = (el, t) => { if (el && t != null) el.currentTime = Math.max(0, t); };
      set(list[0], p.a_start ?? 0);
      set(list[1], p.b_start ?? p.a_start ?? 0);
      const diff = (p.b_start != null && p.a_start != null) ? (p.b_start - p.a_start) : 0;
      $('#mp-sync-info').textContent = `已同步定位：${p.a} @${p.a_start ?? 0}s ↔ ${p.b} @${p.b_start ?? p.a_start ?? 0}s`
        + `（起点偏差 ${diff.toFixed(2)}s，媒体元素 ${list.length} 个）`;
    };
    $('#mp-add').onclick = async () => {
      const ex = await readExtras(wb.task.id);
      const pair = { a: $('#mp-a').value, b: $('#mp-b').value, relation: $('#mp-rel').value,
        verdict: $('#mp-v').value, note: $('#mp-note').value,
        a_start: num($('#mp-as').value), a_end: num($('#mp-ae').value),
        b_start: num($('#mp-bs').value), b_end: num($('#mp-be').value),
        a_region: region($('#mp-ar').value), b_region: region($('#mp-br').value) };
      await saveExtras({ pairs: (ex.pairs || []).concat([pair]) });
      draw();
    };
    $('#mp-play').onclick = () => { els().forEach((el) => { const p = el.play && el.play(); if (p && p.catch) p.catch(() => {}); }); };
    $('#mp-pause').onclick = () => { els().forEach((el) => el.pause && el.pause()); };
    draw();
  }

  /* ================================================================== PDF 工作台 */
  function pdfWorkbench(wb) {
    const media = wb.mediaName ? `/media/${encodeURIComponent(wb.mediaName)}` : '';
    mount('tasks', '标注工作台', `<div class="wb" id="wb">
      <div class="wb-head"><a class="btn ghost sm" href="#/tasks">← 返回</a>
        <div><h1>${e(wb.task.name)}</h1><div class="wb-meta">${e(wb.project ? wb.project.name : '')} · <span class="tag">PDF 文档</span></div></div></div>
      <div class="grid" style="grid-template-columns:1.4fr 1fr;gap:14px;margin-top:14px">
        <div class="card"><div class="card-head"><h3 class="card-title">文档预览</h3><span class="card-sub">区域框选后录入结构化字段</span></div>
          <div class="card-body" style="padding:0">${media ? `<iframe src="${media}#toolbar=0&navpanes=0" style="width:100%;height:640px;border:0;background:#fff"></iframe>` : '<div class="empty" style="padding:40px">请先上传 PDF</div>'}</div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">文档区域、OCR 与问答对比</h3>
          <button class="btn ghost sm" id="pd-upload" style="margin-left:auto">${media ? '更换' : '上传'} PDF</button><input type="file" id="pd-file" accept=".pdf" hidden></div>
          <div class="card-body">
            <div class="filters"><input class="input" id="pd-page" placeholder="页" style="width:56px" value="1">
              <input class="input" id="pd-bbox" placeholder="x0,y0,x1,y1" style="width:132px" value="0.1,0.1,0.9,0.3">
              <input class="input" id="pd-field" placeholder="字段名" style="width:94px"><input class="input" id="pd-value" placeholder="字段值" style="width:104px">
              <button class="btn primary sm" id="pd-add">添加区域</button></div>
            <div class="filters"><button class="btn ghost sm" id="pd-ocr">OCR 提取</button><button class="btn ghost sm" id="pd-qa">生成问答对</button>
              <button class="btn ghost sm" id="pd-compare">多算子问答对比</button><button class="btn ghost sm" id="pd-qc">文本质检</button></div>
            <textarea class="input" id="pd-text" rows="4" placeholder="文档文本（用于问答生成与质检），留空则读取已保存文本"></textarea>
            <div class="panel-label" style="margin-top:8px">区域与字段映射（可校对）</div><div id="pd-regions"></div>
            <div class="panel-label" style="margin-top:8px">问答对比与来源</div>
            <div class="filters"><input class="input" id="pd-q" placeholder="针对文档/区域提问，留空则抽取要点" style="flex:1"><button class="btn primary sm" id="pd-q-run">运行</button></div>
            <div id="pd-out" style="max-height:300px;overflow:auto;margin-top:6px"></div>
          </div></div></div></div>`);
    const regionsOf = async () => (await readExtras(wb.task.id)).doc_regions || [];
    const draw = async () => {
      const ex = await readExtras(wb.task.id);
      const regs = ex.doc_regions || [];
      $('#pd-regions').innerHTML = regs.length ? regs.map((r, i) => `<div style="border-bottom:1px solid rgba(30,42,63,.45);padding:4px 0">
        <div class="filters"><span class="tag">第${r.page}页</span><span class="sub">${(r.bbox || []).join(',')}</span>
        <input class="input" data-pdr-text="${i}" value="${e(r.text || '')}" placeholder="区域文本" style="flex:1">
        <button class="btn ghost sm danger" data-pdr-del="${i}">删</button></div>
        <div class="filters">${Object.entries(r.fields || {}).map(([k, v]) => `<span class="tag">${e(k)}</span><input class="input" data-pdr-f="${i}" data-pdr-k="${e(k)}" value="${e(String(v))}" style="width:120px">`).join('') || '<span class="hint">无字段</span>'}</div>
      </div>`).join('') : '<div class="hint">暂无区域</div>';
      $$('[data-pdr-text]').forEach((el) => { el.onchange = async () => { regs[+el.dataset.pdrText].text = el.value; await saveExtras({ doc_regions: regs }); }; });
      $$('[data-pdr-f]').forEach((el) => {
        el.onchange = async () => {
          const r = regs[+el.dataset.pdrF] || {};
          r.fields = r.fields || {};
          r.fields[el.dataset.pdrK] = el.value;
          await saveExtras({ doc_regions: regs });
        };
      });
      $$('[data-pdr-del]').forEach((b) => { b.onclick = async () => { regs.splice(+b.dataset.pdrDel, 1); await saveExtras({ doc_regions: regs }); draw(); }; });
    };
    $('#pd-file').onchange = async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      await api(`/api/tasks/${wb.task.id}/media`, { method: 'POST', body: fd });
      toast('PDF 已上传', 'ok'); location.reload();
    };
    $('#pd-upload').onclick = () => $('#pd-file').click();
    $('#pd-add').onclick = async () => {
      const bbox = $('#pd-bbox').value.split(',').map(Number);
      if (bbox.length !== 4 || bbox.some(isNaN)) return toast('bbox 需 4 个坐标', 'warn');
      const regs = (await regionsOf()).concat([{ page: +$('#pd-page').value || 1, bbox,
        text: $('#pd-value').value, fields: { [$('#pd-field').value || '字段']: $('#pd-value').value } }]);
      await saveExtras({ doc_regions: regs });
      draw();
    };
    $('#pd-ocr').onclick = async () => {
      const regs = await regionsOf();
      const fields = Object.assign({}, ...regs.map((r) => r.fields || {}));
      const use = regs.map((r) => ({ page: r.page, bbox: r.bbox, text: r.text, conf: 0.9, field: Object.keys(r.fields || {})[0] || '' }));
      const r = await runOp('ocr', { regions: use, fields, hint: $('#pd-text').value });
      if (!r) return;
      const outFields = {};
      (r.result.field_map || []).forEach((f) => { outFields[f.field] = { value: f.value, conf: f.conf, corrected: false }; });
      Object.entries(r.result.fields || {}).forEach(([k, v]) => { if (!outFields[k]) outFields[k] = { value: String(v), conf: 0, corrected: false }; });
      await saveExtras({ ocr_regions: r.result.regions || use, ocr_fields: outFields });
      $('#pd-out').textContent = `${r.result.note || ''} 平均置信度 ${r.result.mean_conf ?? 0}`;
    };
    $('#pd-qa').onclick = async () => {
      const r = await runOp('qa', { text: $('#pd-text').value });
      if (!r) return;
      await saveExtras({ qa: r.result.qa || [] });
      draw();
    };
    $('#pd-q-run').onclick = async () => {
      $('#pd-out').innerHTML = '<div class="hint">运行中…</div>';
      const r = await api('/api/qa/compare', { method: 'POST', body: { task_id: wb.task.id, text: $('#pd-text').value, question: $('#pd-q').value, algos: ['extractive', 'template'], use_external: true } }).catch((err) => ({ error: err.message }));
      if (r.error) { $('#pd-out').innerHTML = `<div class="hint">${e(r.error)}</div>`; return; }
      $('#pd-out').innerHTML = (r.results || []).map((x) => `<div class="card" style="margin-bottom:6px"><div class="card-body">
        <div class="filters"><b>${e(x.name)}</b><span class="tag">${e(x.model || '')}</span></div>
        ${x.error ? `<div class="hint">${e(x.error)}</div>` : (x.answers || []).map((a) => `<div style="border-top:1px solid rgba(30,42,63,.45);padding:4px 0">
          <div>${e(a.answer)}</div><div class="sub">来源：${e(x.name)}${a.start != null ? ` @${a.start}-${a.end}` : ' · 生成'}${a.score != null ? ` · 相关度 ${a.score}` : ''}</div></div>`).join('')}
      </div></div>`).join('');
    };
    $('#pd-qc').onclick = async () => {
      const text = $('#pd-text').value;
      const r = text.trim()
        ? await api('/api/qc/operators/run', { method: 'POST', body: { text } })
        : await api(`/api/tasks/${wb.task.id}/qc/operators/run`, { method: 'POST', body: {} }).catch(() => ({ issues: [], score: 0, threshold: 0, passed: false }));
      $('#pd-out').innerHTML = `<div><b>得分 ${r.score} · 阈值 ${r.threshold} · ${r.passed ? '通过' : '未通过'}</b></div>`
        + (text ? `<div style="margin-top:6px;line-height:1.9">${highlightQc(text, r.issues)}</div>` : '')
        + (r.issues.map((i) => `<div class="sub">[${i.level}] ${e(i.message)}${i.suggestion ? ` → ${e(i.suggestion)}` : ''}</div>`).join('') || '<div class="hint">未发现问题</div>');
    };
    $('#pd-compare').onclick = () => $('#pd-q-run').click();
    draw();
  }

  /* ================================================================== 扩展点注册 */
  const nav = window.CK_NAV || [];
  nav.splice(Math.max(0, nav.length - 3), 0,
    ['console', '平台控制台', 'shield', 'settings.write'],
    ['studio', '模板编排', 'layers', 'template.write']);
  window.CK_NAV = nav;
  window.CK_PAGES = Object.assign({}, window.CK_PAGES, { console: pageConsole, studio: pageStudio });

  const BW = window.CK_WORKBENCH || {};
  const baseVideo = BW.video;
  BW.video = (wb, qc) => { if (baseVideo) baseVideo(wb, qc); setTimeout(() => advancedPanel(wb), 0); };
  const baseLlm = BW.llm;
  BW.llm = (wb, qc) => { if (baseLlm) baseLlm(wb, qc); setTimeout(() => advancedPanel(wb), 0); };
  const baseMulti = BW.multimodal;
  BW.multimodal = (wb, qc) => { if (baseMulti) baseMulti(wb, qc); setTimeout(() => advancedPanel(wb), 0); };
  BW.pdf = pdfWorkbench;
  window.CK_WORKBENCH = BW;

  const baseAfter = window.CK_AFTER_MOUNT;
  window.CK_AFTER_MOUNT = (page) => {
    if (baseAfter) baseAfter(page);
    // 图片工作台以 tasks 外壳挂载，需按 hash 判断是否处于标注页
    let tries = 0;
    const tick = () => {
      const m = location.hash.match(/^#\/annotate\/(\d+)/);
      if (!m) return;
      const wb = window.CK_STATE && window.CK_STATE.wb;
      const ready = wb && String(wb.task && wb.task.id) === m[1] && document.querySelector('#wb');
      if (ready && ['image', 'audio', 'text', 'timeseries', 'pointcloud'].includes(wb.mediaType)) {
        applyDownloadPolicy();
        if (!document.querySelector('#adv-panel')) advancedPanel(wb);
        return;
      }
      if (tries++ < 60) setTimeout(tick, 50);
    };
    setTimeout(tick, 0);
  };

  async function applyDownloadPolicy() {
    try {
      const p = await api('/api/security/download-policy');
      document.querySelectorAll('img,video,canvas').forEach((el) => {
        el.style.userSelect = 'none';
        if (p.download_disabled) {
          el.oncontextmenu = (ev) => { ev.preventDefault(); return false; };
          el.ondragstart = (ev) => { ev.preventDefault(); return false; };
        }
      });
      if (p.download_disabled) document.body.oncontextmenu = (ev) => { if (ev.target.closest('img,canvas,video')) ev.preventDefault(); };
      if (p.watermark) {
        const stage = document.querySelector('.image-stage, #v-stage, .wave-wrap');
        if (stage && !stage.querySelector('.ck-watermark')) {
          const d = document.createElement('div');
          d.className = 'ck-watermark';
          d.textContent = p.watermark_text;
          stage.appendChild(d);
        }
      }
    } catch (err) { /* 策略接口不可用时不影响标注 */ }
  }
})();
