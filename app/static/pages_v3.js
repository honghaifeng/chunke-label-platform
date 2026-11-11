/* 春科标注平台 v3：作业中心、任务大厅、组件/算子/模型库、规则质检、运维中心与多模态工作台 */
(() => {
  'use strict';

  const $v = (s, r = document) => r.querySelector(s);
  const $$v = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const t = (s) => String(s ?? '');
  const money = (n) => String(n ?? 0);
  const time = (s) => (s ? String(s).slice(5, 16) : '');
  const projects = () => (window.CK_STATE && window.CK_STATE.projects) || [];
  const projectOpts = (sel = 0) => projects().map((p) => `<option value="${p.id}" ${Number(sel) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const can = (perm) => (window.CK_STATE && window.CK_STATE.permissions || []).includes(perm);
  const table = (heads, rows, empty = '暂无数据') => {
    if (!rows.length) return `<div class="empty">${empty}</div>`;
    return `<div class="table-wrap"><table class="table"><thead><tr>${heads.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const head = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div><div class="page-actions">${actions}</div></div>`;
  const tabs = (items, active, attr = 'data-tab') => `<div class="seg-tabs">${items.map(([k, label]) => `<button ${attr}="${k}" class="${k === active ? 'active' : ''}">${label}</button>`).join('')}</div>`;
  const chip = (label, cls = 'plain') => `<span class="chip ${cls}">${label}</span>`;
  const bar = (p) => `<div class="progress" style="min-width:80px"><i style="width:${Math.max(0, Math.min(100, Number(p) || 0))}%"></i></div>`;

  async function submitWb(wb) {
    if (!confirm('确认提交质检？提交后将进入质检流程。')) return;
    try {
      await api(`/api/tasks/${wb.task.id}/submit`, { method: 'POST', body: { payload: payloadOf(wb) } });
      toast('已提交质检', 'ok');
      location.hash = '#/tasks';
    } catch (err) { toast(err.message, 'err'); }
  }

  /* 渲染整页外壳（侧栏导航 + 顶栏）并重新绑定顶栏交互 */
  function mountPage(active, html, crumb) {
    document.getElementById('app').innerHTML = shell(active, html, crumb);
    const nb = document.getElementById('notif-btn');
    if (nb) {
      nb.onclick = () => { if (window.CK_OPEN_NOTIFICATIONS) window.CK_OPEN_NOTIFICATIONS(); };
      const dot = document.getElementById('notif-dot');
      const n = window.CK_STATE && window.CK_STATE.notifications;
      if (dot && n) { dot.style.display = n.unread ? '' : 'none'; dot.textContent = n.unread > 99 ? '99+' : String(n.unread || 0); }
    }
    const uc = document.getElementById('user-chip');
    if (uc) uc.onclick = () => userMenu();
    const ts = document.getElementById('top-search');
    if (ts) ts.onkeydown = (e) => { if (e.key === 'Enter') location.hash = `#/tasks?q=${encodeURIComponent(e.target.value.trim())}`; };
  }

  function wbShell(wb, title, meta, mainHtml, sideHtml) {
    mountPage('annotate', `
      <div class="wb">
        <div class="wb-head">
          <button class="btn ghost" onclick="location.hash='#/tasks'">返回</button>
          <h1>${esc(title)}</h1>
          <div class="wb-meta">${meta}</div>
          <div class="wb-actions">
            <span id="save-ind" class="hint"></span>
            <button class="btn" id="wb-save">保存草稿</button>
            <button class="btn primary" id="wb-submit">提交质检</button>
          </div>
        </div>
        <div class="wb-grid"><div class="col">${mainHtml}</div><div class="col">${sideHtml}</div></div>
      </div>`, '标注工作台');
    $v('#wb-save').onclick = () => save(wb);
    $v('#wb-submit').onclick = () => submitWb(wb);
  }

  /* ------------------------------------------------------------------ 任务大厅 */
  async function pageHall(query) {
    const pid = Number(query.get('project_id') || 0);
    const [data, pkgs] = await Promise.all([
      api(`/api/task-hall${pid ? `?project_id=${pid}` : ''}`),
      api(`/api/task-packages${pid ? `?project_id=${pid}` : ''}`),
    ]);
    mountPage('hall', `
      ${head('任务大厅', '公开待领取任务与任务包，领取后进入我的任务', `
        <select class="select" id="hall-proj" style="width:180px"><option value="0">全部项目</option>${projectOpts(pid)}</select>
        <button class="btn primary" id="hall-claim">领取选中任务</button>`)}
      <div class="grid three-col" id="pkg-list">
        ${pkgs.packages.map((p) => `<div class="card"><div class="card-head"><h3 class="card-title">${esc(p.name)}</h3><span class="card-sub">${p.task_count} 个任务</span></div>
          <div class="card-body"><div class="hint" style="margin-bottom:10px">${esc(p.project_name)} · ${esc(p.code)} · ${esc(p.description || '无描述')}</div>
          <button class="btn" data-pkg="${p.id}">整包领取</button></div></div>`).join('') || '<div class="empty">暂无开放任务包</div>'}
      </div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">待领取任务</h3><span class="card-sub">共 ${data.tasks.length} 个</span></div>
      ${table(['', '任务', '项目', '类型', '优先级', '批次', '创建时间'], data.tasks.map((x) => [
        `<input type="checkbox" class="hall-ck" value="${x.id}">`, `<span class="name">${esc(x.name)}</span>`, esc(x.project_name),
        chip(esc(x.modality)), esc(x.priority), esc(x.batch || '-'), time(x.created_at),
      ]), '暂无待领取任务')}</div>`, '任务大厅');
    $v('#hall-proj').onchange = (e) => { location.hash = `#/hall?project_id=${e.target.value}`; };
    $v('#hall-claim').onclick = async () => {
      const ids = $$v('.hall-ck:checked').map((x) => Number(x.value));
      if (!ids.length) return toast('请先勾选任务', 'err');
      const r = await api('/api/task-hall/claim', { method: 'POST', body: { task_ids: ids } });
      toast(`已领取 ${r.count} 个任务`, 'ok');
      await route();
    };
    $$v('[data-pkg]').forEach((b) => {
      b.onclick = async () => {
        const r = await api('/api/task-hall/claim', { method: 'POST', body: { package_id: Number(b.dataset.pkg) } });
        toast(`已整包领取 ${r.count} 个任务`, 'ok');
        await route();
      };
    });
  }

  /* ------------------------------------------------------------------ 作业中心 */
  async function pageJobs(query) {
    const tab = query.get('tab') || 'import';
    const data = await api('/api/jobs?limit=60');
    const jobRows = data.jobs.map((j) => [
      `<span class="name">${esc(j.name || j.kind_label)}</span><div class="sub mono">#${j.id} · ${esc(j.kind)}</div>`,
      chip(esc(j.kind_label)),
      `${bar(j.progress)}<div class="sub">${j.progress}% ${esc(j.message || '')}</div>`,
      j.status === 'failed' ? `<span class="chip danger">失败</span><div class="sub">${esc((j.error || '').slice(0, 40))}</div>` : chip(esc(j.status), j.status === 'done' ? 'done' : j.status === 'running' ? 'annotating' : 'pending'),
      time(j.created_at),
      `${j.status === 'done' && j.kind === 'dataset_export' ? `<a class="btn ghost" href="/api/jobs/${j.id}/download">下载</a> ` : ''}${['queued', 'running'].includes(j.status) ? `<button class="btn ghost" data-cancel="${j.id}">取消</button>` : ''}`,
    ]);
    mountPage('jobs', `
      ${head('作业中心', '批量导入、分片上传、异步预处理与导出作业', tabs([['import', '批量导入'], ['chunk', '分片上传'], ['queue', '作业队列']], tab))}
      <div id="job-panel"></div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">作业记录</h3><span class="card-sub">近 60 条</span><button class="btn ghost" id="job-refresh" style="margin-left:auto">刷新</button></div>
      ${table(['作业', '类型', '进度', '状态', '创建时间', '操作'], jobRows, '暂无作业')}</div>`, '作业中心');

    const panel = $v('#job-panel');
    if (tab === 'import') {
      panel.innerHTML = `<div class="card"><div class="card-head"><h3 class="card-title">文件 / ZIP / URL 批量导入</h3></div><div class="card-body">
        <div class="grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="field"><label>目标项目</label><select class="select" id="imp-proj">${projectOpts()}</select></div>
          <div class="field"><label>导入到</label><select class="select" id="imp-target"><option value="tasks">任务中心</option><option value="dataset">数据集</option></select></div>
          <div class="field"><label>批次名称</label><input class="input" id="imp-batch" placeholder="如 11月补采批次"></div>
        </div>
        <div class="field"><label>选择文件（支持多选、ZIP 压缩包，自动识别音视频/图片/点云/文本）</label><input class="input" type="file" id="imp-files" multiple></div>
        <button class="btn primary" id="imp-submit">开始导入</button>
        <span class="hint" id="imp-status" style="margin-left:10px"></span>
        <div class="grid" style="grid-template-columns:1fr auto;margin-top:18px;align-items:end">
          <div class="field" style="margin:0"><label>或按 URL 批量导入（每行一个）</label><textarea class="input" id="imp-urls" rows="3" placeholder="https://example.com/a.jpg"></textarea></div>
          <button class="btn" id="imp-url-submit">URL 导入</button>
        </div>
      </div></div>`;
      $v('#imp-submit').onclick = async () => {
        const files = $v('#imp-files').files;
        if (!files.length) return toast('请选择文件', 'err');
        const fd = new FormData();
        for (const f of files) fd.append('files', f);
        fd.append('project_id', $v('#imp-proj').value);
        fd.append('target', $v('#imp-target').value);
        fd.append('batch', $v('#imp-batch').value);
        $v('#imp-status').textContent = '上传中…';
        try {
          const r = await api('/api/import', { method: 'POST', body: fd });
          $v('#imp-status').textContent = `已导入 ${r.count} 个文件${r.dataset ? ` · 数据集 v${r.dataset.version}` : ''}`;
          toast('导入完成', 'ok');
          setTimeout(() => route(), 800);
        } catch (err) { $v('#imp-status').textContent = ''; toast(err.message, 'err'); }
      };
      $v('#imp-url-submit').onclick = async () => {
        const urls = $v('#imp-urls').value.split('\n').map((x) => x.trim()).filter(Boolean);
        if (!urls.length) return toast('请输入 URL', 'err');
        const r = await api('/api/import/url', { method: 'POST', body: { project_id: Number($v('#imp-proj').value), urls, batch: $v('#imp-batch').value } });
        toast(`已创建导入作业 #${r.job_id}`, 'ok');
        location.hash = '#/jobs?tab=queue';
      };
    } else if (tab === 'chunk') {
      panel.innerHTML = `<div class="card"><div class="card-head"><h3 class="card-title">大文件分片上传</h3><span class="card-sub">4MB / 片，断点续传</span></div><div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr;align-items:end">
          <div class="field"><label>目标项目</label><select class="select" id="chunk-proj">${projectOpts()}</select></div>
          <div class="field"><label>文件</label><input class="input" type="file" id="chunk-file"></div>
        </div>
        <button class="btn primary" id="chunk-start">开始上传</button>
        <div class="hint" id="chunk-status" style="margin-top:10px">选择文件后开始上传，完成后自动创建任务。</div>
        <div id="chunk-bar" style="margin-top:8px"></div>
      </div></div>`;
      $v('#chunk-start').onclick = async () => {
        const f = $v('#chunk-file').files[0];
        if (!f) return toast('请选择文件', 'err');
        const size = 4 * 1024 * 1024;
        const total = Math.ceil(f.size / size);
        const init = await api('/api/uploads/init', { method: 'POST', body: { filename: f.name, total_chunks: total, size: f.size, target: 'tasks', project_id: Number($v('#chunk-proj').value) } });
        const st = $v('#chunk-status');
        for (let i = 0; i < total; i++) {
          const blob = f.slice(i * size, Math.min(f.size, (i + 1) * size));
          await fetch(`/api/uploads/${init.upload_id}/chunks/${i}`, { method: 'PUT', body: blob, credentials: 'same-origin' });
          st.textContent = `上传中 ${i + 1}/${total} · ${Math.round((i + 1) / total * 100)}%`;
          $v('#chunk-bar').innerHTML = bar((i + 1) / total * 100);
        }
        const r = await api(`/api/uploads/${init.upload_id}/complete`, { method: 'POST', body: {} });
        st.textContent = `上传完成，已创建任务 #${r.task_id || '-'}（${r.media_type}）`;
        toast('分片上传完成', 'ok');
      };
    } else {
      panel.innerHTML = `<div class="card"><div class="card-head"><h3 class="card-title">任务预处理</h3></div><div class="card-body">
        <div class="grid" style="grid-template-columns:repeat(4,1fr);align-items:end">
          <div class="field"><label>任务 ID</label><input class="input" id="pre-task" placeholder="如 1"></div>
          <div class="field"><label>预处理类型</label><select class="select" id="pre-kind">
            <option value="audio_denoise">语音降噪（afftdn + 响度归一）</option>
            <option value="video_frames">视频抽帧</option>
            <option value="video_compress">视频转码压缩</option>
          </select></div>
          <div class="field"><label>抽帧间隔（秒）</label><input class="input" id="pre-interval" value="1"></div>
          <button class="btn primary" id="pre-run">创建作业</button>
        </div>
      </div></div>`;
      $v('#pre-run').onclick = async () => {
        const tid = Number($v('#pre-task').value);
        if (!tid) return toast('请输入任务 ID', 'err');
        const r = await api(`/api/tasks/${tid}/preprocess`, { method: 'POST', body: { kind: $v('#pre-kind').value, interval: Number($v('#pre-interval').value) || 1 } });
        toast(`预处理作业 #${r.job_id} 已启动`, 'ok');
        setTimeout(() => route(), 600);
      };
    }
    $v('#job-refresh').onclick = () => route();
    $$v('[data-cancel]').forEach((b) => {
      b.onclick = async () => { await api(`/api/jobs/${b.dataset.cancel}/cancel`, { method: 'POST', body: {} }); toast('已取消', 'ok'); await route(); };
    });
  }

  /* ------------------------------------------------------------------ 组件与资产库 */
  async function pageComponents(query) {
    const tab = query.get('tab') || 'components';
    const data = await api('/api/libraries');
    let body = '';
    if (tab === 'components') {
      body = `<div class="grid three-col">${data.components.map((c) => `<div class="card"><div class="card-head"><h3 class="card-title">${esc(c.name)}</h3><span class="card-sub">${esc(c.modality)}</span></div>
        <div class="card-body"><div class="hint" style="margin-bottom:10px">${esc(c.description || '')}</div>
        <div class="chip-row">${(c.schema.fields || []).map((f) => `<span class="tag">${esc(f.label || f.key)} · ${esc(f.type)}</span>`).join('')}</div>
        <div style="margin-top:12px;display:flex;gap:8px"><button class="btn ghost" data-preview="${c.id}">预览</button>${c.builtin ? '' : `<button class="btn ghost danger" data-del-cmp="${c.id}">删除</button>`}</div></div></div>`).join('')}</div>`;
    } else if (tab === 'labels') {
      body = table(['标签集', '模态', '标签组', '说明'], data.label_sets.map((l) => [
        `<span class="name">${esc(l.name)}</span><div class="sub mono">${esc(l.code)}</div>`, chip(esc(l.modality)),
        Object.keys(l.labels || {}).map((k) => `<span class="tag">${esc(k)} (${(l.labels[k] || []).length})</span>`).join(' '), esc(l.description || ''),
      ]));
    } else {
      body = table(['模型', '类型', '提供方', '版本', '指标', '状态'], data.models.map((m) => [
        `<span class="name">${esc(m.name)}</span>`, chip(esc(m.kind)), esc(m.provider), esc(m.version || '-'),
        Object.entries(m.metrics || {}).map(([k, v]) => `<span class="tag">${esc(k)}=${esc(v)}</span>`).join(' ') || '-', chip(esc(m.status), 'done'),
      ]));
    }
    mountPage('components', `
      ${head('组件与资产库', '可视化组件构建器、标签库与模型仓库', `${tabs([['components', '组件构建器'], ['labels', '标签库'], ['models', '模型仓库']], tab)} ${tab === 'components' ? '<button class="btn primary" id="cmp-add" style="margin-left:8px">新建组件</button>' : ''}`)}
      ${body}`, '组件库');
    $$v('[data-preview]').forEach((b) => {
      b.onclick = () => {
        const c = data.components.find((x) => x.id === Number(b.dataset.preview));
        openModal(`<div class="card-head"><h3 class="card-title">${esc(c.name)} · 组件预览</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
          <div class="card-body">${(c.schema.fields || []).map((f) => `<div class="field"><label>${esc(f.label || f.key)}</label>${
            f.type === 'select' ? `<select class="select">${(f.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>` :
            f.type === 'checkbox' ? `<div class="chip-row">${(f.options || []).map((o) => `<label class="tag"><input type="checkbox"> ${esc(o)}</label>`).join('')}</div>` :
            `<input class="input" placeholder="${esc(f.placeholder || '')}">`
          }</div>`).join('') || '<div class="empty">该组件暂无字段</div>'}</div>`);
      };
    });
    $$v('[data-del-cmp]').forEach((b) => {
      b.onclick = async () => { if (!confirm('确认删除该组件？')) return; await api(`/api/components/${b.dataset.delCmp}`, { method: 'DELETE' }); toast('已删除', 'ok'); await route(); };
    });
    const add = $v('#cmp-add');
    if (add) add.onclick = () => componentModal();
  }

  function componentModal() {
    openModal(`<div class="card-head"><h3 class="card-title">新建组件</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>组件名称</label><input class="input" id="cmp-name" placeholder="如 商品属性表单"></div>
          <div class="field"><label>适用模态</label><select class="select" id="cmp-modality"><option>image</option><option>audio</option><option>text</option><option>video</option><option>pointcloud</option></select></div>
        </div>
        <div class="field"><label>说明</label><input class="input" id="cmp-desc"></div>
        <div class="field"><label>字段（每行：key|label|类型(select/checkbox/text)|选项逗号分隔）</label><textarea class="input" id="cmp-fields" rows="5" placeholder="category|业务分类|select|咨询,投诉,售后"></textarea></div>
        <button class="btn primary" id="cmp-save">保存组件</button>
      </div>`);
    $v('#cmp-save').onclick = async () => {
      const fields = $v('#cmp-fields').value.split('\n').map((line) => {
        const [key, label, type, options] = line.split('|').map((x) => (x || '').trim());
        if (!key) return null;
        return { key, label: label || key, type: type || 'text', options: options ? options.split(',').map((x) => x.trim()).filter(Boolean) : [] };
      }).filter(Boolean);
      await api('/api/components', { method: 'POST', body: { name: $v('#cmp-name').value, modality: $v('#cmp-modality').value, description: $v('#cmp-desc').value, schema: { fields } } });
      closeModal(); toast('组件已创建', 'ok'); await route();
    };
  }

  /* ------------------------------------------------------------------ 算子中心 */
  async function pageOperators() {
    const [data, runs] = await Promise.all([api('/api/operators'), api('/api/operators/runs?limit=20')]);
    mountPage('operators', `
      ${head('算子中心', '可配置 HTTP 算子：OCR / SAM / 跟踪 / 质检 / ASR，统一接入与调用审计', '<button class="btn primary" id="op-add">新建算子</button>')}
      <div class="card"><div class="card-head"><h3 class="card-title">算子列表</h3><span class="card-sub">${data.operators.length} 个</span></div>
      ${table(['算子', '类型', '模态', '服务地址', '超时', '状态', '操作'], data.operators.map((o) => [
        `<span class="name">${esc(o.name)}</span><div class="sub mono">${esc(o.code)}</div>`, chip(esc(o.kind)), esc(o.modality || '-'),
        o.endpoint ? `<span class="mono">${esc(o.endpoint.slice(0, 46))}</span>` : '<span class="chip danger">未配置</span>',
        `${o.timeout}s`, o.enabled ? chip('启用', 'done') : chip('停用', 'plain'),
        `<button class="btn ghost" data-op-edit="${o.id}">配置</button> <button class="btn ghost" data-op-run="${o.id}">调用</button>`,
      ]))}</div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">调用记录</h3><span class="card-sub">最近 20 次</span></div>
      ${table(['算子', '任务', '状态', '耗时', '时间'], runs.runs.map((r) => [
        esc(r.operator_name || '-'), r.task_id ? `<a href="#/annotate/${r.task_id}">#${r.task_id}</a>` : '-',
        chip(esc(r.status), r.status === 'ok' ? 'done' : 'danger'), `${r.latency_ms}ms`, time(r.created_at),
      ]), '暂无调用记录')}</div>`, '算子中心');
    $v('#op-add').onclick = () => operatorModal();
    $$v('[data-op-edit]').forEach((b) => {
      b.onclick = () => operatorModal(data.operators.find((o) => o.id === Number(b.dataset.opEdit)));
    });
    $$v('[data-op-run]').forEach((b) => {
      b.onclick = () => {
        const o = data.operators.find((x) => x.id === Number(b.dataset.opRun));
        openModal(`<div class="card-head"><h3 class="card-title">调用算子 · ${esc(o.name)}</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
          <div class="card-body"><div class="field"><label>任务 ID（可选）</label><input class="input" id="op-task" placeholder="留空则使用自定义输入"></div>
          <div class="field"><label>自定义输入 JSON</label><textarea class="input" id="op-input" rows="4">{}</textarea></div>
          <button class="btn primary" id="op-do-run">执行</button><pre class="hint" id="op-result" style="margin-top:10px;white-space:pre-wrap"></pre></div>`);
        $v('#op-do-run').onclick = async () => {
          let input = {};
          try { input = JSON.parse($v('#op-input').value || '{}'); } catch { return toast('输入不是合法 JSON', 'err'); }
          try {
            const r = await api(`/api/operators/${o.id}/run`, { method: 'POST', body: { task_id: Number($v('#op-task').value) || 0, input } });
            $v('#op-result').textContent = JSON.stringify(r, null, 2).slice(0, 4000);
          } catch (err) { $v('#op-result').textContent = err.message; }
        };
      };
    });
  }

  function operatorModal(op) {
    const o = op || { name: '', code: '', kind: 'http', modality: '', endpoint: '', method: 'POST', timeout: 30, enabled: 1, description: '', headers: {}, input_map: {}, output_map: {} };
    openModal(`<div class="card-head"><h3 class="card-title">${op ? '配置算子' : '新建算子'}</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>名称</label><input class="input" id="f-name" value="${esc(o.name)}"></div>
          <div class="field"><label>编码</label><input class="input" id="f-code" value="${esc(o.code)}" ${op ? 'disabled' : ''}></div>
          <div class="field"><label>类型</label><input class="input" id="f-kind" value="${esc(o.kind)}" placeholder="ocr / sam / tracking / qa / asr / http"></div>
          <div class="field"><label>模态</label><input class="input" id="f-modality" value="${esc(o.modality)}"></div>
        </div>
        <div class="field"><label>服务地址 endpoint</label><input class="input" id="f-endpoint" value="${esc(o.endpoint)}" placeholder="http://127.0.0.1:9000/ocr"></div>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>方法</label><select class="select" id="f-method"><option ${o.method === 'POST' ? 'selected' : ''}>POST</option><option ${o.method === 'GET' ? 'selected' : ''}>GET</option></select></div>
          <div class="field"><label>超时（秒）</label><input class="input" id="f-timeout" value="${o.timeout}"></div>
          <div class="field"><label>启用</label><select class="select" id="f-enabled"><option value="1" ${o.enabled ? 'selected' : ''}>启用</option><option value="0" ${!o.enabled ? 'selected' : ''}>停用</option></select></div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>请求头 JSON</label><textarea class="input" id="f-headers" rows="3">${esc(JSON.stringify(o.headers || {}))}</textarea></div>
          <div class="field"><label>输出映射 JSON（平台字段 → 响应路径）</label><textarea class="input" id="f-outmap" rows="3">${esc(JSON.stringify(o.output_map || {}))}</textarea></div>
        </div>
        <div class="field"><label>说明</label><input class="input" id="f-desc" value="${esc(o.description)}"></div>
        <button class="btn primary" id="f-save">保存</button>
      </div>`);
    $v('#f-save').onclick = async () => {
      let headers = {}, output_map = {};
      try { headers = JSON.parse($v('#f-headers').value || '{}'); output_map = JSON.parse($v('#f-outmap').value || '{}'); } catch { return toast('JSON 格式错误', 'err'); }
      const body = { name: $v('#f-name').value, kind: $v('#f-kind').value, modality: $v('#f-modality').value, endpoint: $v('#f-endpoint').value, method: $v('#f-method').value, timeout: Number($v('#f-timeout').value) || 30, enabled: $v('#f-enabled').value === '1', description: $v('#f-desc').value, headers, output_map };
      if (op) await api(`/api/operators/${op.id}`, { method: 'PATCH', body });
      else await api('/api/operators', { method: 'POST', body: { ...body, code: $v('#f-code').value } });
      closeModal(); toast('已保存', 'ok'); await route();
    };
  }

  /* ------------------------------------------------------------------ 规则质检 */
  async function pageQuality() {
    const [rules, stats] = await Promise.all([api('/api/quality/rules'), api('/api/prelabel/stats')]);
    const s = stats.stats || {};
    mountPage('quality', `
      ${head('规则质检与预标注验收', '可配置质检规则引擎 + 预标注采纳率统计', '<button class="btn primary" id="rule-add">新建规则</button>')}
      <div class="grid kpi-grid" style="margin-bottom:14px">
        <div class="kpi"><div class="kpi-label">预标注运行</div><div class="kpi-value">${money(s.runs)}</div><div class="kpi-delta">候选 ${money(s.suggested)} 条</div></div>
        <div class="kpi"><div class="kpi-label">采纳标注</div><div class="kpi-value">${money(s.kept)}</div><div class="kpi-delta">已确认任务 ${money(s.confirmed_tasks)}</div></div>
        <div class="kpi"><div class="kpi-label">采纳率</div><div class="kpi-value">${s.acceptance_rate || 0}%</div><div class="kpi-delta">反映模型预标注质量</div></div>
        <div class="kpi"><div class="kpi-label">规则数量</div><div class="kpi-value">${rules.rules.length}</div><div class="kpi-delta">按项目/模态生效</div></div>
      </div>
      <div class="card"><div class="card-head"><h3 class="card-title">质检规则</h3></div>
      ${table(['规则', '项目', '模态', '配置', '状态', '操作'], rules.rules.map((r) => [
        `<span class="name">${esc(r.name)}</span>`, r.project_id ? `#${r.project_id}` : '<span class="tag">全局</span>', esc(r.modality || '全部'),
        Object.entries(r.config || {}).map(([k, v]) => `<span class="tag">${esc(k)}=${esc(Array.isArray(v) ? v.join('/') : v)}</span>`).join(' '),
        r.enabled ? chip('启用', 'done') : chip('停用'),
        `<button class="btn ghost" data-rule-run="${r.id}">试运行</button> <button class="btn ghost" data-rule-toggle="${r.id}" data-on="${r.enabled}">${r.enabled ? '停用' : '启用'}</button>`,
      ]))}</div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">按项目采纳率</h3></div>
      ${table(['项目', '运行', '候选', '采纳', '采纳率'], (stats.by_project || []).map((p) => [esc(p.project_name), p.runs, p.suggested, p.kept, `${p.acceptance_rate}%`]), '暂无预标注数据')}</div>`, '规则质检');
    $v('#rule-add').onclick = () => ruleModal();
    $$v('[data-rule-toggle]').forEach((b) => {
      b.onclick = async () => { await api(`/api/quality/rules/${b.dataset.ruleToggle}`, { method: 'PATCH', body: { enabled: b.dataset.on !== '1' } }); toast('已更新', 'ok'); await route(); };
    });
    $$v('[data-rule-run]').forEach((b) => {
      b.onclick = () => {
        openModal(`<div class="card-head"><h3 class="card-title">规则试运行</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
          <div class="card-body"><div class="field"><label>任务 ID</label><input class="input" id="rule-task" placeholder="输入要检查的任务 ID"></div>
          <button class="btn primary" id="rule-do">执行检查</button><pre class="hint" id="rule-out" style="margin-top:10px;white-space:pre-wrap"></pre></div>`);
        $v('#rule-do').onclick = async () => {
          try {
            const r = await api(`/api/tasks/${Number($v('#rule-task').value)}/qc/rules/run`, { method: 'POST', body: {} });
            $v('#rule-out').textContent = `得分 ${r.score} · ${JSON.stringify(r.dims)}\n` + (r.violations.map((v) => `[${v.level}] ${v.rule}：${v.message}`).join('\n') || '未发现违规');
          } catch (err) { $v('#rule-out').textContent = err.message; }
        };
      };
    });
  }

  function ruleModal() {
    openModal(`<div class="card-head"><h3 class="card-title">新建质检规则</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>规则名称</label><input class="input" id="r-name"></div>
          <div class="field"><label>项目（空=全局）</label><select class="select" id="r-proj"><option value="0">全局</option>${projectOpts()}</select></div>
          <div class="field"><label>模态</label><select class="select" id="r-mod"><option value="">全部</option><option>audio</option><option>image</option><option>video</option><option>text</option><option>pointcloud</option><option>timeseries</option></select></div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>最少标注条数</label><input class="input" id="r-min" value="1"></div>
          <div class="field"><label>最大音频空隙（秒）</label><input class="input" id="r-gap" value="0"></div>
          <div class="field"><label>最低置信度</label><input class="input" id="r-conf" value="0"></div>
        </div>
        <div class="field"><label>必填字段（逗号分隔）</label><input class="input" id="r-fields" placeholder="name,text"></div>
        <button class="btn primary" id="r-save">保存规则</button>
      </div>`);
    $v('#r-save').onclick = async () => {
      const config = { min_count: Number($v('#r-min').value) || 0, max_gap: Number($v('#r-gap').value) || 0, min_conf: Number($v('#r-conf').value) || 0 };
      const fields = $v('#r-fields').value.split(',').map((x) => x.trim()).filter(Boolean);
      if (fields.length) config.require_non_empty = fields;
      await api('/api/quality/rules', { method: 'POST', body: { name: $v('#r-name').value, project_id: Number($v('#r-proj').value) || null, modality: $v('#r-mod').value, config } });
      closeModal(); toast('规则已创建', 'ok'); await route();
    };
  }

  /* ------------------------------------------------------------------ 问题清单 */
  async function pageIssues(query) {
    const status = query.get('status') || '';
    const data = await api(`/api/issues${status ? `?status=${status}` : ''}`);
    mountPage('issues', `
      ${head('问题清单', '质检问题逐项追踪、指派与返修闭环', `<select class="select" id="iss-status" style="width:140px"><option value="">全部状态</option><option value="open" ${status === 'open' ? 'selected' : ''}>待处理</option><option value="resolved" ${status === 'resolved' ? 'selected' : ''}>已解决</option></select>`)}
      <div class="card">${table(['任务', '问题', '位置', '级别', '负责人', '状态', '创建时间', '操作'], data.issues.map((i) => [
        `<a href="#/annotate/${i.task_id}">${esc(i.task_name || `#${i.task_id}`)}</a>`,
        `<span class="name">${esc(i.title)}</span><div class="sub">${esc(i.description || '')}</div>`,
        i.item_index >= 0 ? `第 ${i.item_index + 1} 项` : esc(i.item_type || '-'),
        chip(esc(i.severity), i.severity === 'high' ? 'danger' : i.severity === 'low' ? 'plain' : 'pending'),
        esc(i.assignee_name || '-'), chip(esc(i.status), i.status === 'open' ? 'pending' : 'done'), time(i.created_at),
        `${i.status === 'open' ? `<button class="btn ghost" data-resolve="${i.id}">标记解决</button>` : ''} <button class="btn ghost danger" data-del-issue="${i.id}">删除</button>`,
      ]), '暂无问题项')}</div>`, '问题清单');
    $v('#iss-status').onchange = (e) => { location.hash = `#/issues${e.target.value ? `?status=${e.target.value}` : ''}`; };
    $$v('[data-resolve]').forEach((b) => {
      b.onclick = async () => { await api(`/api/issues/${b.dataset.resolve}`, { method: 'PATCH', body: { status: 'resolved' } }); toast('已标记解决', 'ok'); await route(); };
    });
    $$v('[data-del-issue]').forEach((b) => {
      b.onclick = async () => { if (!confirm('确认删除该问题？')) return; await api(`/api/issues/${b.dataset.delIssue}`, { method: 'DELETE' }); toast('已删除', 'ok'); await route(); };
    });
  }

  /* ------------------------------------------------------------------ 运维中心 */
  async function pageOps(query) {
    const tab = query.get('tab') || 'brand';
    let body = '';
    if (tab === 'brand') {
      const b = await api('/api/ops/brand');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">品牌配置</h3></div><div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>平台名称</label><input class="input" id="b-name" value="${esc(b.brand_name || '')}"></div>
          <div class="field"><label>简称</label><input class="input" id="b-short" value="${esc(b.brand_short || '')}"></div>
          <div class="field"><label>主色调</label><input class="input" id="b-color" value="${esc(b.brand_color || '#3B82F6')}"></div>
        </div>
        <div class="field"><label>Logo 地址（可选）</label><input class="input" id="b-logo" value="${esc(b.brand_logo || '')}"></div>
        <button class="btn primary" id="b-save">保存品牌</button></div></div>`;
    } else if (tab === 'storage') {
      const s = await api('/api/ops/storage');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">对象存储</h3><span class="card-sub">本地 / S3 兼容</span></div><div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>驱动</label><select class="select" id="s-driver"><option value="local" ${s.storage_driver !== 's3' ? 'selected' : ''}>本地存储</option><option value="s3" ${s.storage_driver === 's3' ? 'selected' : ''}>S3 / MinIO</option></select></div>
          <div class="field"><label>Bucket</label><input class="input" id="s-bucket" value="${esc(s.storage_bucket || '')}"></div>
          <div class="field"><label>Region</label><input class="input" id="s-region" value="${esc(s.storage_region || '')}"></div>
          <div class="field"><label>Endpoint</label><input class="input" id="s-endpoint" value="${esc(s.storage_endpoint || '')}"></div>
          <div class="field"><label>Access Key</label><input class="input" id="s-ak" value="${esc(s.storage_access_key || '')}"></div>
          <div class="field"><label>Secret Key</label><input class="input" id="s-sk" value="${esc(s.storage_secret_key || '')}"></div>
        </div>
        <button class="btn primary" id="s-save">保存存储配置</button>
        <div style="margin-top:14px" class="filters"><input class="input" id="s-file" placeholder="文件名，如 call-001.wav" style="width:240px"><button class="btn" id="s-presign">生成预签名链接</button></div>
        <pre class="hint" id="s-out" style="white-space:pre-wrap;margin-top:8px"></pre></div></div>`;
    } else if (tab === 'security') {
      const [p, baseline, sso] = await Promise.all([api('/api/ops/security/policy'), api('/api/ops/security/baseline'), api('/api/ops/sso')]);
      body = `<div class="grid" style="grid-template-columns:1.4fr 1fr">
        <div class="card"><div class="card-head"><h3 class="card-title">安全策略</h3></div><div class="card-body">
          <div class="field"><label>IP 白名单（逗号分隔，支持 192.168.1.*）</label><input class="input" id="sec-ip" value="${esc(p.ip_allowlist || '')}"></div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
            <div class="field"><label>媒体令牌 TTL（秒）</label><input class="input" id="sec-ttl" value="${esc(p.media_token_ttl || '600')}"></div>
            <div class="field"><label>动态水印</label><select class="select" id="sec-wm"><option value="on" ${p.watermark === 'on' ? 'selected' : ''}>开启</option><option value="off" ${p.watermark !== 'on' ? 'selected' : ''}>关闭</option></select></div>
            <div class="field"><label>强制 MFA</label><select class="select" id="sec-mfa"><option value="off" ${p.mfa_required !== 'on' ? 'selected' : ''}>关闭</option><option value="on" ${p.mfa_required === 'on' ? 'selected' : ''}>开启</option></select></div>
          </div>
          <div class="field"><label>日志留存天数</label><input class="input" id="sec-days" value="${esc(p.log_retention_days || '90')}"></div>
          <button class="btn primary" id="sec-save">保存策略</button>
          <button class="btn" id="sec-export" style="margin-left:8px">导出审计日志 CSV</button>
          <button class="btn" id="sec-retention" style="margin-left:8px">立即执行日志清理</button>
          <div style="margin-top:18px" class="card-head" ><h3 class="card-title">SSO / OIDC</h3></div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>Provider</label><input class="input" id="sso-provider" value="${esc(sso.sso_provider || '')}" placeholder="azure / okta / keycloak"></div>
            <div class="field"><label>Client ID</label><input class="input" id="sso-cid" value="${esc(sso.sso_client_id || '')}"></div>
            <div class="field"><label>Client Secret</label><input class="input" id="sso-secret" value="${esc(sso.sso_client_secret || '')}"></div>
            <div class="field"><label>Authorize URL</label><input class="input" id="sso-auth" value="${esc(sso.sso_authorize_url || '')}"></div>
            <div class="field"><label>Token URL</label><input class="input" id="sso-token" value="${esc(sso.sso_token_url || '')}"></div>
            <div class="field"><label>Redirect URI</label><input class="input" id="sso-redirect" value="${esc(sso.sso_redirect_uri || '')}"></div>
          </div>
          <button class="btn" id="sso-save">保存 SSO</button>
          <div class="field" style="margin-top:14px"><label>SCIM 同步 Token（供 HR/IdP 调用 /scim/v2/Users）</label><input class="input" id="scim-token" value="${esc(p.scim_token || '')}" placeholder="留空表示不启用 SCIM"></div>
          <button class="btn" id="scim-save">保存 SCIM Token</button>
        </div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">安全基线</h3><span class="card-sub">得分 ${baseline.score}</span></div><div class="card-body">
          ${baseline.checks.map((c) => `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(30,42,63,.5)">
            <span class="chip ${c.pass ? 'done' : 'danger'}" style="flex:none">${c.pass ? '通过' : '待改'}</span>
            <div><b style="font-size:12px">${esc(c.name)}</b><div class="sub">${esc(c.detail)}</div></div></div>`).join('')}
        </div></div></div>`;
    } else if (tab === 'backup') {
      const b = await api('/api/ops/backups');
      const v = await api('/api/ops/version');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">备份与恢复</h3><button class="btn primary" id="bk-create" style="margin-left:auto">立即备份</button></div>
        ${table(['备份文件', '大小', '说明', '时间', '操作'], b.backups.map((x) => [
          `<span class="mono">${esc(x.path.split('/').pop())}</span>`, `${(x.size / 1024 / 1024).toFixed(2)} MB`, esc(x.note), time(x.created_at),
          `<button class="btn ghost" data-restore="${x.id}">恢复</button>`,
        ]), '暂无备份')}</div>
        <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">版本与升级</h3><span class="card-sub">当前 1.0.0</span></div><div class="card-body">
          <div class="chip-row" style="margin-bottom:12px">${v.applied.map((m) => `<span class="tag">v${m.version} ${esc(m.name)}</span>`).join('')}</div>
          <div class="hint" style="margin-bottom:10px">待应用迁移：${v.pending.map((m) => `v${m.version} ${m.name}`).join('，') || '无'}</div>
          <button class="btn primary" id="up-run">应用升级</button>
          <button class="btn danger" id="up-rollback" style="margin-left:8px">回滚最近备份</button>
        </div></div>`;
    } else {
      const m = await api('/api/ops/monitor');
      body = `<div class="grid kpi-grid">
        <div class="kpi"><div class="kpi-label">运行时长</div><div class="kpi-value">${Math.floor(m.uptime_seconds / 3600)}h</div><div class="kpi-delta">${m.uptime_seconds}s</div></div>
        <div class="kpi"><div class="kpi-label">内存占用</div><div class="kpi-value">${m.memory_mb}MB</div><div class="kpi-delta">负载 ${(m.load_avg || []).map((x) => x.toFixed(2)).join(' / ')}</div></div>
        <div class="kpi"><div class="kpi-label">磁盘使用</div><div class="kpi-value">${m.disk.percent}%</div><div class="kpi-delta">${(m.disk.free / 1024 / 1024 / 1024).toFixed(1)} GB 可用</div></div>
        <div class="kpi"><div class="kpi-label">近一小时接口调用</div><div class="kpi-value">${m.api_requests_last_hour}</div><div class="kpi-delta">DB ${(m.db_size / 1024 / 1024).toFixed(1)} MB</div></div>
      </div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">作业与运行环境</h3><span class="card-sub"><a href="/metrics" target="_blank">Prometheus /metrics ↗</a></span></div><div class="card-body">
        <div class="chip-row" style="margin-bottom:10px">${Object.entries(m.jobs || {}).map(([k, v]) => `<span class="tag">${esc(k)}: ${v}</span>`).join('')}</div>
        <div class="hint">${esc(m.process.platform)} · Python ${esc(m.process.python)}</div>
      </div></div>`;
    }
    const navTab = tabs([['brand', '品牌'], ['storage', '存储'], ['security', '安全/SSO'], ['backup', '备份/升级'], ['monitor', '监控']], tab);
    mountPage('ops', `${head('运维中心', '品牌、存储、安全、备份、监控与升级回滚', navTab)}<div id="ops-body">${body}</div>`, '运维中心');

    const savePolicy = async (extra = {}) => {
      await api('/api/ops/security/policy', { method: 'POST', body: {
        ip_allowlist: $v('#sec-ip').value, media_token_ttl: $v('#sec-ttl').value, watermark: $v('#sec-wm').value,
        mfa_required: $v('#sec-mfa').value, log_retention_days: $v('#sec-days').value, ...extra,
      } });
      toast('安全策略已保存', 'ok');
    };
    if (tab === 'brand') {
      $v('#b-save').onclick = async () => {
        await api('/api/ops/brand', { method: 'POST', body: { brand_name: $v('#b-name').value, brand_short: $v('#b-short').value, brand_color: $v('#b-color').value, brand_logo: $v('#b-logo').value } });
        toast('品牌已更新，刷新后生效', 'ok');
      };
    } else if (tab === 'storage') {
      $v('#s-save').onclick = async () => {
        await api('/api/ops/storage', { method: 'POST', body: {
          storage_driver: $v('#s-driver').value, storage_bucket: $v('#s-bucket').value, storage_region: $v('#s-region').value,
          storage_endpoint: $v('#s-endpoint').value, storage_access_key: $v('#s-ak').value, storage_secret_key: $v('#s-sk').value,
        } });
        toast('存储配置已保存', 'ok');
      };
      $v('#s-presign').onclick = async () => {
        try {
          const r = await api('/api/ops/storage/presign', { method: 'POST', body: { name: $v('#s-file').value } });
          $v('#s-out').textContent = JSON.stringify(r, null, 2);
        } catch (err) { $v('#s-out').textContent = err.message; }
      };
    } else if (tab === 'security') {
      $v('#sec-save').onclick = () => savePolicy();
      $v('#sec-export').onclick = () => { window.open('/api/audit/export.csv', '_blank'); };
      $v('#sec-retention').onclick = async () => { const r = await api('/api/ops/retention/run', { method: 'POST', body: { days: Number($v('#sec-days').value) || 90 } }); toast(`已清理 ${JSON.stringify(r.removed)}`, 'ok'); };
      $v('#sso-save').onclick = async () => {
        await api('/api/ops/sso', { method: 'POST', body: {
          sso_provider: $v('#sso-provider').value, sso_client_id: $v('#sso-cid').value, sso_client_secret: $v('#sso-secret').value,
          sso_authorize_url: $v('#sso-auth').value, sso_token_url: $v('#sso-token').value, sso_redirect_uri: $v('#sso-redirect').value,
        } });
        toast('SSO 配置已保存', 'ok');
      };
      $v('#scim-save').onclick = async () => {
        await savePolicy({ scim_token: $v('#scim-token').value });
        toast('SCIM Token 已保存', 'ok');
      };
    } else if (tab === 'backup') {
      $v('#bk-create').onclick = async () => { await api('/api/ops/backup', { method: 'POST', body: { note: '手动备份' } }); toast('备份完成', 'ok'); await route(); };
      $$v('[data-restore]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('恢复将覆盖当前数据库，确认继续？')) return;
          await api(`/api/ops/backups/${btn.dataset.restore}/restore`, { method: 'POST', body: { confirm: 'RESTORE' } });
          toast('已恢复，建议重新登录', 'ok');
        };
      });
      $v('#up-run').onclick = async () => { const r = await api('/api/ops/upgrade', { method: 'POST', body: {} }); toast(`已应用 ${r.applied.length} 个迁移`, 'ok'); await route(); };
      $v('#up-rollback').onclick = async () => {
        if (!confirm('将恢复最近一次备份，确认回滚？')) return;
        await api('/api/ops/rollback', { method: 'POST', body: { confirm: 'ROLLBACK' } });
        toast('已回滚', 'ok');
      };
    }
  }

  /* ------------------------------------------------------------------ 帮助中心 / 偏好 */
  async function pageHelp(query) {
    const q = query.get('q') || '';
    const data = await api(`/api/help/articles${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    mountPage('help', `
      ${head('帮助中心', '使用指南、质检规范与运维手册', `<input class="input" id="help-q" value="${esc(q)}" placeholder="搜索帮助内容" style="width:220px"><button class="btn" id="help-search">搜索</button>`)}
      <div class="grid" style="grid-template-columns:180px 1fr">
        <div class="card"><div class="card-body" style="padding:8px">${data.categories.map((c) => `<div class="nav-item" style="height:32px">${esc(c)}</div>`).join('')}</div></div>
        <div class="grid">${data.articles.map((a) => `<div class="card"><div class="card-head"><h3 class="card-title">${esc(a.title)}</h3><span class="card-sub">${esc(a.category)}</span></div><div class="card-body hint" style="white-space:pre-wrap;line-height:1.8">${esc(a.body)}</div></div>`).join('') || '<div class="empty">没有匹配的帮助内容</div>'}</div>
      </div>`, '帮助中心');
    $v('#help-search').onclick = () => { location.hash = `#/help?q=${encodeURIComponent($v('#help-q').value)}`; };
  }

  async function pagePreferences() {
    const [pref, mfa] = await Promise.all([api('/api/preferences'), api('/api/auth/mfa/status')]);
    const p = pref.preferences || {};
    mountPage('preferences', `
      ${head('个人偏好', '界面语言、工作台默认值与账号安全')}
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card"><div class="card-head"><h3 class="card-title">工作偏好</h3></div><div class="card-body">
          <div class="field"><label>界面语言</label><select class="select" id="p-lang"><option value="zh" ${p.language !== 'en' ? 'selected' : ''}>简体中文</option><option value="en" ${p.language === 'en' ? 'selected' : ''}>English</option></select></div>
          <div class="field"><label>列表每页条数</label><input class="input" id="p-size" value="${esc(p.page_size || 20)}"></div>
          <div class="field"><label>默认项目</label><select class="select" id="p-proj"><option value="0">不指定</option>${projectOpts(p.default_project || 0)}</select></div>
          <div class="field"><label>快捷键</label><select class="select" id="p-keys"><option value="on" ${p.shortcuts !== 'off' ? 'selected' : ''}>启用（空格播放 / A、D 微调 / Delete 删除）</option><option value="off" ${p.shortcuts === 'off' ? 'selected' : ''}>关闭</option></select></div>
          <button class="btn primary" id="p-save">保存偏好</button>
        </div></div>
        <div class="card"><div class="card-head"><h3 class="card-title">账号安全 · 双因子认证</h3><span class="card-sub">${mfa.enabled ? '已启用' : mfa.required_globally ? '管理员强制' : '未启用'}</span></div><div class="card-body">
          <div class="hint" style="margin-bottom:12px">启用 TOTP 后，登录需要输入身份验证器 App 中的 6 位动态口令。</div>
          <button class="btn" id="mfa-setup">${mfa.enabled ? '重置密钥' : '生成密钥'}</button>
          <div id="mfa-box" style="margin-top:12px"></div>
        </div></div>
      </div>`, '个人偏好');
    $v('#p-save').onclick = async () => {
      await api('/api/preferences', { method: 'PUT', body: { preferences: { language: $v('#p-lang').value, page_size: Number($v('#p-size').value) || 20, default_project: Number($v('#p-proj').value) || 0, shortcuts: $v('#p-keys').value } } });
      document.documentElement.dataset.lang = $v('#p-lang').value;
      toast('偏好已保存', 'ok');
    };
    $v('#mfa-setup').onclick = async () => {
      const r = await api('/api/auth/mfa/setup', { method: 'POST', body: {} });
      $v('#mfa-box').innerHTML = `<div class="field"><label>密钥（手动添加）</label><input class="input mono" value="${esc(r.secret)}" readonly></div>
        <div class="hint" style="word-break:break-all;margin-bottom:10px">${esc(r.otpauth)}</div>
        <div class="field"><label>输入验证器生成的 6 位口令</label><input class="input" id="mfa-code" maxlength="6"></div>
        <button class="btn primary" id="mfa-enable">启用 MFA</button>
        <div class="hint" style="margin-top:10px">恢复码：${r.recovery_codes.map(esc).join('、')}</div>`;
      $v('#mfa-enable').onclick = async () => {
        await api('/api/auth/mfa/enable', { method: 'POST', body: { code: $v('#mfa-code').value } });
        toast('MFA 已启用', 'ok');
        await route();
      };
    };
  }

  /* ------------------------------------------------------------------ 多模态工作台 */
  const WB = {};
  const payloadOfTask = () => (window.CK_STATE && window.CK_STATE.wb) || {};

  WB.video = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    const tracks = payload.tracks || [];
    const media = wb.mediaName ? `/media/${wb.mediaName}` : '';
    wb.customPayload = () => ({ media_type: 'video', tracks, segments: [] });
    wbShell(wb, wb.task.name, `${chip('视频')}${chip(wb.project ? wb.project.name : '')}${chip(`轨迹 ${tracks.length} 条`)}`, `
      <div class="image-panel"><div class="image-toolbar"><span>视频轨迹标注（关键帧 + 线性插值）</span><span class="spacer"></span>
        <label class="toggle-wrap">类别 <input class="input" id="v-label" value="目标" style="width:96px;height:26px"></label>
        <button class="btn ghost" id="v-add">当前帧添加框</button>
        <button class="btn ghost" id="v-interp">补全关键帧</button></div>
        <div style="position:relative;background:#050912;min-height:420px;display:flex;align-items:center;justify-content:center" id="v-stage">
          ${media ? `<video id="v-video" src="${media}" controls style="max-width:100%;max-height:520px" preload="metadata"></video>` : '<div class="empty">请先在任务中心上传视频</div>'}
          <div id="v-overlay" style="position:absolute;inset:0;pointer-events:none"></div>
        </div>
        <div class="transport"><span class="mono" id="v-time">00:00</span><input type="range" id="v-seek" min="0" max="100" value="0" style="flex:1"><span class="mono" id="v-dur">00:00</span></div>
      </div>`, `
      <div class="card"><div class="card-head"><h3 class="card-title">轨迹列表</h3></div><div class="card-body" id="v-tracks" style="max-height:520px;overflow:auto"></div></div>`);
    const video = $v('#v-video');
    let current = 0;
    const draw = () => {
      $v('#v-tracks').innerHTML = tracks.map((tr, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <b style="font-size:12px">${esc(tr.label || '目标')}</b><span class="tag">${(tr.keyframes || []).length} 帧</span>
        <button class="btn ghost" data-kf="${i}" style="margin-left:auto">打关键帧</button>
        <button class="btn ghost danger" data-del-tr="${i}">删除</button></div>`).join('') || '<div class="empty">暂无轨迹</div>';
      $$v('[data-del-tr]').forEach((b) => { b.onclick = () => { tracks.splice(Number(b.dataset.delTr), 1); draw(); }; });
      $$v('[data-kf]').forEach((b) => { b.onclick = () => addKeyframe(Number(b.dataset.kf)); });
    };
    const addKeyframe = (i) => {
      const tr = tracks[i];
      const list = tr.keyframes || (tr.keyframes = []);
      const last = list[list.length - 1] || { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
      list.push({ t: current, x: last.x, y: last.y, w: last.w, h: last.h });
      list.sort((a, b) => a.t - b.t);
      tr.keyframes = list;
      draw();
    };
    $v('#v-add').onclick = () => {
      tracks.push({ uid: Math.random().toString(36).slice(2, 8), label: $v('#v-label').value || '目标', keyframes: [{ t: current, x: 0.2, y: 0.25, w: 0.25, h: 0.25 }] });
      draw();
    };
    $v('#v-interp').onclick = () => {
      tracks.forEach((tr) => {
        const kf = (tr.keyframes || []).slice().sort((a, b) => a.t - b.t);
        if (kf.length < 2) return;
        const out = [];
        for (let i = 0; i < kf.length - 1; i++) {
          const a = kf[i], b = kf[i + 1];
          const steps = Math.max(1, Math.round(b.t - a.t));
          for (let s = 0; s <= steps; s++) {
            const r = s / steps;
            out.push({ t: +(a.t + (b.t - a.t) * r).toFixed(2), x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, w: a.w + (b.w - a.w) * r, h: a.h + (b.h - a.h) * r });
          }
        }
        tr.keyframes = out;
      });
      draw(); toast('已按关键帧补齐逐帧框', 'ok');
    };
    if (video) {
      video.onloadedmetadata = () => { $v('#v-dur').textContent = fmtShort(video.duration); $v('#v-seek').max = video.duration || 0; };
      video.ontimeupdate = () => {
        current = video.currentTime;
        $v('#v-time').textContent = fmtShort(current);
        $v('#v-seek').value = current;
        const overlay = $v('#v-overlay');
        const rect = video.getBoundingClientRect();
        const stage = $v('#v-stage').getBoundingClientRect();
        overlay.innerHTML = tracks.map((tr) => {
          const kf = (tr.keyframes || []).find((k) => Math.abs(k.t - current) < 0.6) || (tr.keyframes || [])[0];
          if (!kf) return '';
          return `<div style="position:absolute;left:${rect.left - stage.left + kf.x * rect.width}px;top:${rect.top - stage.top + kf.y * rect.height}px;width:${kf.w * rect.width}px;height:${kf.h * rect.height}px;border:2px solid #3B82F6;border-radius:2px"><span style="position:absolute;left:-1px;top:-18px;background:#3B82F6;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px">${esc(tr.label || '目标')}</span></div>`;
        }).join('');
      };
      $v('#v-seek').oninput = (e) => { video.currentTime = Number(e.target.value); };
    }
    draw();
  };

  WB.text = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    let text = payload.text || state.current.task.name || '';
    const spans = payload.spans || [];
    const draw = () => {
      const parts = [];
      let pos = 0;
      spans.slice().sort((a, b) => a.start - b.start).forEach((s, i) => {
        if (s.start > pos) parts.push(esc(text.slice(pos, s.start)));
        parts.push(`<mark style="background:rgba(59,130,246,.3);border-bottom:2px solid #3B82F6" title="${esc(s.label)}">${esc(text.slice(s.start, s.end))}</mark>`);
        pos = s.end;
      });
      parts.push(esc(text.slice(pos)));
      $v('#t-preview').innerHTML = parts.join('') || '<span class="hint">在左侧输入文本</span>';
      $v('#t-spans').innerHTML = spans.map((s, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <span class="tag">${esc(s.label)}</span><span style="font-size:12px">${esc(text.slice(s.start, s.end))}</span>
        <button class="btn ghost danger" data-del-span="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无实体</div>';
      $$v('[data-del-span]').forEach((b) => { b.onclick = () => { spans.splice(Number(b.dataset.delSpan), 1); draw(); }; });
    };
    wb.customPayload = () => ({ media_type: 'text', text, spans });
    wbShell(wb, wb.task.name, `${chip('文本')}${chip(wb.project ? wb.project.name : '')}${chip(`实体 ${spans.length}`)}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">文本内容</h3><button class="btn ghost" id="t-load" style="margin-left:auto">从媒体文件加载</button></div><div class="card-body">
        <textarea class="input" id="t-text" rows="10" placeholder="粘贴或加载待标注文本">${esc(text)}</textarea>
        <div class="filters" style="margin-top:10px"><input class="input" id="t-label" placeholder="实体类型，如 产品/人名" style="width:160px"><button class="btn primary" id="t-span">标注选中文本</button></div>
        <div class="card" style="margin-top:12px"><div class="card-head"><h3 class="card-title">标注预览</h3></div><div class="card-body" id="t-preview" style="line-height:2;font-size:13.5px"></div></div>
      </div></div>`, `<div class="card"><div class="card-head"><h3 class="card-title">实体列表</h3></div><div class="card-body" id="t-spans"></div></div>`);
    $v('#t-text').oninput = (e) => { text = e.target.value; draw(); };
    $v('#t-load').onclick = async () => {
      if (!wb.mediaName) return toast('该任务没有文本文件', 'err');
      const r = await fetch(`/media/${encodeURIComponent(wb.mediaName)}`, { credentials: 'same-origin' });
      text = await r.text();
      $v('#t-text').value = text;
      draw();
    };
    $v('#t-span').onclick = () => {
      const ta = $v('#t-text');
      const start = ta.selectionStart, end = ta.selectionEnd;
      if (start === end) return toast('请先选中文本', 'err');
      spans.push({ start, end, label: $v('#t-label').value || '实体' });
      draw();
    };
    draw();
  };

  WB.llm = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    let messages = payload.messages || [{ role: 'user', content: '' }, { role: 'assistant', content: '' }];
    let rating = payload.rating || 0;
    const tags = payload.tags || [];
    const draw = () => {
      $v('#l-msgs').innerHTML = messages.map((m, i) => `<div class="field"><label>${esc(m.role)}</label>
        <textarea class="input" rows="4" data-msg="${i}">${esc(m.content)}</textarea>
        <div style="margin-top:6px"><button class="btn ghost danger" data-del-msg="${i}">删除</button></div></div>`).join('');
      $$v('[data-msg]').forEach((ta) => { ta.onchange = (e) => { messages[Number(ta.dataset.msg)].content = e.target.value; }; });
      $$v('[data-del-msg]').forEach((b) => { b.onclick = () => { messages.splice(Number(b.dataset.delMsg), 1); draw(); }; });
      $v('#l-stars').innerHTML = [1, 2, 3, 4, 5].map((n) => `<button class="btn ghost" data-star="${n}" style="color:${n <= rating ? '#F59E0B' : 'inherit'}">${n <= rating ? '★' : '☆'}</button>`).join('');
      $$v('[data-star]').forEach((b) => { b.onclick = () => { rating = Number(b.dataset.star); draw(); }; });
    };
    wb.customPayload = () => ({ media_type: 'llm', messages, rating, tags });
    wbShell(wb, wb.task.name, `${chip('LLM 数据')}${chip(wb.project ? wb.project.name : '')}${chip(`评分 ${rating || '-'}`)}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">对话 / 指令数据</h3><button class="btn ghost" id="l-add" style="margin-left:auto">新增消息</button></div><div class="card-body" id="l-msgs"></div></div>`,
      `<div class="card"><div class="card-head"><h3 class="card-title">质量评分</h3></div><div class="card-body"><div id="l-stars" style="display:flex;gap:2px"></div>
        <div class="field" style="margin-top:12px"><label>标签（逗号分隔）</label><input class="input" id="l-tags" value="${esc(tags.join(','))}" placeholder="有用,准确,需改写"></div>
        <div class="hint">评分与标签将随标注结果进入数据集，用于偏好训练与质量筛选。</div></div></div>`);
    $v('#l-add').onclick = () => { messages.push({ role: 'user', content: '' }); draw(); };
    $v('#l-tags').onchange = (e) => { tags.length = 0; tags.push(...e.target.value.split(',').map((x) => x.trim()).filter(Boolean)); };
    draw();
  };

  WB.timeseries = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    let rows = payload.rows || [];
    const intervals = payload.intervals || [];
    const draw = () => {
      const cvs = $v('#ts-canvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const w = (cvs.width = cvs.clientWidth * devicePixelRatio);
      const h = (cvs.height = 260 * devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      if (!rows.length) {
        ctx.fillStyle = '#64748B'; ctx.font = `${12 * devicePixelRatio}px sans-serif`;
        ctx.fillText('暂无时序数据，可在左侧粘贴 CSV（时间,数值）或加载文件', 16, 30);
        return;
      }
      const xs = rows.map((r) => Number(r[0]));
      const ys = rows.map((r) => Number(r[1]));
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const px = (x) => 24 + (x - minX) / (maxX - minX || 1) * (w - 48);
      const py = (y) => h - 24 - (y - minY) / (maxY - minY || 1) * (h - 48);
      intervals.forEach((iv) => {
        ctx.fillStyle = 'rgba(59,130,246,.18)';
        ctx.fillRect(px(iv.start), 10, Math.max(2, px(iv.end) - px(iv.start)), h - 20);
      });
      ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 1.6 * devicePixelRatio; ctx.beginPath();
      rows.forEach((r, i) => { const x = px(Number(r[0])), y = py(Number(r[1])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    };
    wb.customPayload = () => ({ media_type: 'timeseries', rows, intervals });
    wbShell(wb, wb.task.name, `${chip('时序')}${chip(wb.project ? wb.project.name : '')}${chip(`${rows.length} 点`)}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">时序曲线</h3><button class="btn ghost" id="ts-load" style="margin-left:auto">加载 CSV</button></div>
        <div class="card-body"><canvas id="ts-canvas" style="width:100%;height:260px"></canvas>
        <div class="filters" style="margin-top:10px"><input class="input" id="ts-start" placeholder="区间开始" style="width:110px"><input class="input" id="ts-end" placeholder="区间结束" style="width:110px"><input class="input" id="ts-label" placeholder="区间标签" style="width:120px"><button class="btn primary" id="ts-add">添加区间</button></div>
        <div class="field"><label>或粘贴 CSV（每行：时间,数值）</label><textarea class="input" id="ts-csv" rows="4"></textarea><button class="btn" id="ts-parse" style="margin-top:8px">解析</button></div></div></div>`,
      `<div class="card"><div class="card-head"><h3 class="card-title">标注区间</h3></div><div class="card-body">${intervals.map((iv, i) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)"><span class="tag">${esc(iv.label || '区间')}</span><span class="sub">${iv.start} → ${iv.end}</span><button class="btn ghost danger" data-del-iv="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无区间</div>'}</div></div>`);
    const parse = (txt) => {
      rows = txt.split('\n').map((l) => l.split(',').map((x) => Number(x.trim()))).filter((r) => r.length >= 2 && r.every((x) => isFinite(x)));
      draw();
    };
    $v('#ts-parse').onclick = () => parse($v('#ts-csv').value);
    $v('#ts-load').onclick = async () => {
      if (!wb.mediaName) return toast('该任务没有 CSV 文件', 'err');
      const r = await fetch(`/media/${encodeURIComponent(wb.mediaName)}`, { credentials: 'same-origin' });
      parse(await r.text());
    };
    $v('#ts-add').onclick = () => {
      const s = Number($v('#ts-start').value), e = Number($v('#ts-end').value);
      if (!isFinite(s) || !isFinite(e) || e <= s) return toast('请输入有效区间', 'err');
      intervals.push({ start: s, end: e, label: $v('#ts-label').value || '异常' });
      draw();
    };
    $$v('[data-del-iv]').forEach((b) => { b.onclick = () => { intervals.splice(Number(b.dataset.delIv), 1); draw(); }; });
    draw();
  };

  WB.pointcloud = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    let points = payload.sample || [];
    const boxes = payload.boxes || [];
    let yaw = 0.6, scale = 1;
    const draw = () => {
      const cvs = $v('#pc-canvas');
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const w = (cvs.width = cvs.clientWidth * devicePixelRatio);
      const h = (cvs.height = 420 * devicePixelRatio);
      ctx.fillStyle = '#050912'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const proj = (p) => {
        const [x, y, z] = p;
        const rx = x * Math.cos(yaw) - y * Math.sin(yaw);
        const ry = x * Math.sin(yaw) + y * Math.cos(yaw);
        return [cx + rx * 18 * scale + ry * 6 * scale, cy - z * 18 * scale + ry * 5 * scale, ry];
      };
      points.forEach((p) => {
        const [px, py, depth] = proj(p);
        if (px < 0 || px > w || py < 0 || py > h) return;
        const a = Math.max(0.15, Math.min(1, 1 - (depth + 40) / 80));
        ctx.fillStyle = `rgba(96,165,250,${a.toFixed(2)})`;
        ctx.fillRect(px, py, 1.6 * devicePixelRatio, 1.6 * devicePixelRatio);
      });
      boxes.forEach((b) => {
        const corners = [];
        for (const dx of [-b.l / 2, b.l / 2]) for (const dy of [-b.w / 2, b.w / 2]) for (const dz of [0, b.h]) {
          const ca = Math.cos(b.yaw || 0), sa = Math.sin(b.yaw || 0);
          corners.push(proj([b.x + dx * ca - dy * sa, b.y + dx * sa + dy * ca, b.z + dz]));
        }
        ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 1.5 * devicePixelRatio;
        const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        ctx.beginPath();
        edges.forEach(([a, b2]) => { ctx.moveTo(corners[a][0], corners[a][1]); ctx.lineTo(corners[b2][0], corners[b2][1]); });
        ctx.stroke();
        const c = proj([b.x, b.y, b.z + b.h]);
        ctx.fillStyle = '#FCD34D'; ctx.font = `${11 * devicePixelRatio}px sans-serif`;
        ctx.fillText(b.label || '3D 框', c[0], c[1] - 6);
      });
    };
    wb.customPayload = () => ({ media_type: 'pointcloud', boxes, sample: points.slice(0, 4000) });
    wbShell(wb, wb.task.name, `${chip('3D 点云')}${chip(wb.project ? wb.project.name : '')}${chip(`框 ${boxes.length}`)}`, `
      <div class="image-panel"><div class="image-toolbar"><span>点云预览（拖拽旋转 / 滚轮缩放）</span><span class="spacer"></span><button class="btn ghost" id="pc-load">加载点云</button></div>
        <div class="image-stage" id="pc-stage" style="min-height:420px;cursor:grab"><canvas id="pc-canvas" style="width:100%;height:420px;display:block"></canvas></div></div>`,
      `<div class="card"><div class="card-head"><h3 class="card-title">3D 检测框</h3></div><div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr">
          <div class="field"><label>X</label><input class="input" id="pc-x" value="0"></div><div class="field"><label>Y</label><input class="input" id="pc-y" value="0"></div>
          <div class="field"><label>Z</label><input class="input" id="pc-z" value="0"></div><div class="field"><label>长 L</label><input class="input" id="pc-l" value="4"></div>
          <div class="field"><label>宽 W</label><input class="input" id="pc-w" value="2"></div><div class="field"><label>高 H</label><input class="input" id="pc-h" value="1.6"></div>
        </div>
        <div class="field"><label>类别</label><input class="input" id="pc-label" value="轿车"></div>
        <button class="btn primary" id="pc-add">添加 3D 框</button>
        <div style="margin-top:12px">${boxes.map((b, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5)"><span class="tag">${esc(b.label)}</span><span class="sub">(${b.x},${b.y},${b.z}) L${b.l} W${b.w} H${b.h}</span><button class="btn ghost danger" data-del-3d="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无 3D 框</div>'}</div>
      </div></div>`);
    const stage = $v('#pc-stage');
    let dragging = null;
    stage.onmousedown = (e) => { dragging = e.clientX; };
    window.addEventListener('mouseup', () => { dragging = null; });
    stage.onmousemove = (e) => { if (dragging !== null) { yaw += (e.clientX - dragging) * 0.01; dragging = e.clientX; draw(); } };
    stage.onwheel = (e) => { e.preventDefault(); scale = Math.max(0.3, Math.min(4, scale * (e.deltaY > 0 ? 0.92 : 1.08))); draw(); };
    $v('#pc-load').onclick = async () => {
      if (!wb.mediaName) return toast('该任务没有点云文件', 'err');
      const r = await fetch(`/media/${encodeURIComponent(wb.mediaName)}`, { credentials: 'same-origin' });
      const txt = await r.text();
      points = [];
      txt.split('\n').forEach((line) => {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length >= 3 && parts.every((x) => isFinite(x))) points.push(parts.slice(0, 3));
      });
      if (!points.length) toast('未解析到点云坐标（仅支持 ASCII PCD/PLY）', 'err');
      draw();
    };
    $v('#pc-add').onclick = () => {
      boxes.push({ x: Number($v('#pc-x').value) || 0, y: Number($v('#pc-y').value) || 0, z: Number($v('#pc-z').value) || 0, l: Number($v('#pc-l').value) || 1, w: Number($v('#pc-w').value) || 1, h: Number($v('#pc-h').value) || 1, yaw: 0, label: $v('#pc-label').value || '目标' });
      draw();
    };
    $$v('[data-del-3d]').forEach((b) => { b.onclick = () => { boxes.splice(Number(b.dataset.del3d), 1); draw(); }; });
    draw();
  };

  WB.multimodal = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    const items = payload.items || [];
    const media = (state.current.media || []);
    const all = [{ name: wb.mediaName, kind: wb.mediaType, path: wb.mediaName ? `/media/${wb.mediaName}` : '' }, ...media.map((m) => ({ name: m.name, kind: m.kind, path: m.url }))];
    wb.customPayload = () => ({ media_type: 'multimodal', items });
    wbShell(wb, wb.task.name, `${chip('多模态')}${chip(wb.project ? wb.project.name : '')}${chip(`${all.length} 个媒体`)}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">媒体画廊</h3><span class="card-sub">主媒体 + 抽帧/附件</span></div><div class="card-body">
        <div class="grid three-col">${all.map((m, i) => `<div class="card" style="cursor:pointer" data-mm="${i}"><div class="card-body" style="padding:8px">
          ${m.kind === 'image' ? `<img src="${m.path}" style="width:100%;height:120px;object-fit:cover;border-radius:6px">` : m.kind === 'video' ? `<video src="${m.path}" style="width:100%;height:120px;object-fit:cover;border-radius:6px" muted></video>` : `<div class="empty" style="height:120px">${esc(m.kind)} 文件</div>`}
          <div class="sub" style="margin-top:6px">${esc(m.name || '主媒体')}</div></div></div>`).join('') || '<div class="empty">暂无媒体</div>'}</div>
      </div></div>`,
      `<div class="card"><div class="card-head"><h3 class="card-title">标注条目</h3><button class="btn ghost" id="mm-add" style="margin-left:auto">新增</button></div><div class="card-body" id="mm-items"></div></div>`);
    const draw = () => {
      $v('#mm-items').innerHTML = items.map((it, i) => `<div style="padding:7px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <div style="display:flex;gap:8px"><span class="tag">${esc(it.media || '主媒体')}</span><b style="font-size:12px">${esc(it.label || '')}</b><button class="btn ghost danger" data-del-mm="${i}" style="margin-left:auto">删除</button></div>
        <div class="sub">${esc(it.note || '')}</div></div>`).join('') || '<div class="empty">暂无条目</div>';
      $$v('[data-del-mm]').forEach((b) => { b.onclick = () => { items.splice(Number(b.dataset.delMm), 1); draw(); }; });
    };
    $v('#mm-add').onclick = () => {
      const name = prompt('标注对象（媒体名称，可留空表示主媒体）', '');
      if (name === null) return;
      const label = prompt('标签', '目标');
      if (label === null) return;
      items.push({ media: name.trim(), label, note: '' });
      draw();
    };
    draw();
  };

  /* ------------------------------------------------------------------ 治理中心 */
  async function pageGovernance(query) {
    const tab = query.get('tab') || 'plan';
    const pid = Number(query.get('project_id') || (projects()[0] || {}).id || 0);
    const tabsHtml = tabs([
      ['plan', '项目计划'], ['task', '任务计划'], ['roles', '角色权限'],
      ['sampling', '抽审策略'], ['data', '数据检索'], ['trash', '回收站'],
    ], tab);
    let body = '';

    if (tab === 'plan') {
      const [plan, mem] = await Promise.all([api(`/api/projects/${pid}/plan`), api('/api/members')]);
      const ms = plan.milestones.map((m) => `${m.name}|${m.date || ''}`).join('\n');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">项目计划 · ${esc(plan.project.name)}</h3><span class="card-sub">完成度 ${plan.progress}%</span></div>
        <div class="card-body"><div class="form-grid">
          <div class="field"><label>项目负责人</label><select class="select" id="gp-owner"><option value="0">未指定</option>${(mem.members || []).map((m) => `<option value="${m.id}" ${m.id === plan.project.owner_id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
          <div class="field"><label>状态</label><select class="select" id="gp-status">${['active', 'paused', 'closed'].map((s) => `<option value="${s}" ${plan.project.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>开始时间</label><input class="input" id="gp-start" value="${esc(plan.project.start_at || '')}" placeholder="YYYY-MM-DD" /></div>
          <div class="field"><label>结束时间</label><input class="input" id="gp-end" value="${esc(plan.project.end_at || '')}" placeholder="YYYY-MM-DD" /></div>
          <div class="field full"><label>里程碑（每行：名称|日期）</label><textarea class="input" id="gp-ms" rows="4">${esc(ms)}</textarea></div>
        </div>
        <div class="filters" style="margin-top:12px"><span class="hint">任务 ${plan.total} 个 · 已完成 ${plan.counts.done || 0} 个</span><span class="spacer"></span><button class="btn primary" id="gp-save">保存计划</button></div></div></div>`;
    } else if (tab === 'task') {
      const data = await api(`/api/tasks?project_id=${pid}&limit=200`);
      body = `<div class="card"><div class="card-head"><h3 class="card-title">任务计划</h3><span class="card-sub">共 ${(data.tasks || []).length} 个任务</span></div>
        ${table(['任务', '状态', '开始', '结束', '数据集版本', '模板版本', ''], (data.tasks || []).map((t) => [
          `<span class="name">${esc(t.name)}</span><div class="sub">#${t.id}</div>`, statusChip(t.status),
          `<input class="input" style="width:118px" value="${esc(t.start_at || '')}" data-tp="start_at" data-id="${t.id}" placeholder="YYYY-MM-DD">`,
          `<input class="input" style="width:118px" value="${esc(t.end_at || '')}" data-tp="end_at" data-id="${t.id}" placeholder="YYYY-MM-DD">`,
          `<input class="input" style="width:70px" type="number" value="${t.dataset_version || 0}" data-tp="dataset_version" data-id="${t.id}">`,
          `<input class="input" style="width:70px" type="number" value="${t.template_version || 0}" data-tp="template_version" data-id="${t.id}">`,
          `<button class="btn sm" data-tp-save="${t.id}">保存</button>`,
        ]), '暂无任务')}</div>`;
    } else if (tab === 'roles') {
      const data = await api('/api/roles');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">自定义角色</h3><button class="btn primary sm" id="role-add" style="margin-left:auto">新建角色</button></div>
        ${table(['角色', '说明', '权限数', '成员', '操作'], data.roles.map((r) => [
          `<span class="name">${esc(r.name)}</span>`, esc(r.description || '-'), String(r.permissions.length), String(r.member_count),
          `<button class="btn ghost sm" data-role-edit="${r.id}">编辑</button> <button class="btn ghost sm" data-role-assign="${r.id}">分配</button> <button class="btn ghost sm danger" data-role-del="${r.id}">删除</button>`,
        ]), '暂无自定义角色')}</div>`;
      window.__ckPermissions = data.permissions;
      window.__ckRoles = data.roles;
    } else if (tab === 'sampling') {
      const [policies, preview] = await Promise.all([
        api('/api/sampling/policies'), api(`/api/sampling/preview?project_id=${pid}`),
      ]);
      const cur = policies.policies.find((p) => p.project_id === pid) || { config: { sample_rate: 100 }, mode: 'layered' };
      const cfg = cur.config || {};
      const layer = (cfg.layers || [])[0] || {};
      body = `<div class="card"><div class="card-head"><h3 class="card-title">分层 / 风险抽审策略</h3></div><div class="card-body">
        <div class="form-grid">
          <div class="field"><label>基础抽审比例 %</label><input class="input" id="sp-rate" type="number" value="${cfg.sample_rate ?? 100}"></div>
          <div class="field"><label>模式</label><select class="select" id="sp-mode"><option value="layered" ${cur.mode === 'layered' ? 'selected' : ''}>分层抽审</option><option value="risk" ${cur.mode === 'risk' ? 'selected' : ''}>风险抽审</option></select></div>
          <div class="field"><label>分层字段</label><select class="select" id="sp-field">${['batch', 'priority', 'assignee_id'].map((f) => `<option ${layer.field === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
          <div class="field"><label>分层值</label><input class="input" id="sp-value" value="${esc(layer.value || '')}" placeholder="例如 1109 批次"></div>
          <div class="field"><label>该层抽审比例 %</label><input class="input" id="sp-layer-rate" type="number" value="${layer.rate ?? 100}"></div>
          <div class="field"><label>风险抽审比例 %</label><input class="input" id="sp-risk-rate" type="number" value="${(cfg.risk || {}).rate ?? 100}"></div>
          <div class="field"><label>低分阈值</label><input class="input" id="sp-low" type="number" value="${(cfg.risk || {}).low_score ?? 80}"></div>
          <div class="field"><label>返修必检</label><select class="select" id="sp-rework"><option value="1" ${(cfg.risk || {}).rework ? 'selected' : ''}>是</option><option value="0" ${!(cfg.risk || {}).rework ? 'selected' : ''}>否</option></select></div>
        </div>
        <div class="filters" style="margin-top:12px"><button class="btn primary" id="sp-save">保存策略</button><span class="spacer"></span><span class="hint">当前项目任务 ${preview.tasks.length} 个</span></div>
        ${table(['任务', '批次', '返修', '命中层级', '抽审率'], preview.tasks.slice(0, 20).map((t) => [
          esc(t.name), esc(t.batch || '-'), String(t.rework_count || 0), t.layer || (t.risk ? '风险' : '-'), `${t.rate}%`,
        ]), '暂无任务')}</div></div>`;
    } else if (tab === 'trash') {
      const data = await api('/api/dataset-trash');
      body = `<div class="card"><div class="card-head"><h3 class="card-title">数据集回收站</h3><span class="card-sub">归档 / 软删除</span></div>
        ${table(['数据集', '模态', '状态', '操作'], data.datasets.map((d) => [
          `<span class="name">${esc(d.name)}</span><div class="sub mono">${esc(d.code)}</div>`, chip(esc(d.modality)),
          d.deleted ? chip('已删除', 'danger') : chip('已归档', 'pending'),
          `<button class="btn ghost sm" data-ds-restore="${d.id}">恢复</button>`,
        ]), '回收站为空')}</div>`;
    } else {
      const [dsData, itemData] = await Promise.all([
        api(`/api/datasets${pid ? `?project_id=${pid}` : ''}`),
        api(`/api/datasets/${Number(query.get('dataset_id') || 0)}/items?page=1&limit=50`).catch(() => ({ rows: [], total: 0 })),
      ]);
      const dsid = Number(query.get('dataset_id') || (dsData.datasets[0] || {}).id || 0);
      const detail = dsid && !itemData.total ? await api(`/api/datasets/${dsid}/items?page=1&limit=50`) : itemData;
      body = `<div class="card"><div class="card-head"><h3 class="card-title">数据集检索与导出</h3></div><div class="card-body">
        <div class="filters">
          <select class="select" id="gd-ds" style="width:220px">${dsData.datasets.map((d) => `<option value="${d.id}" ${d.id === dsid ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
          <input class="input" id="gd-q" placeholder="名称关键字" style="width:160px">
          <select class="select" id="gd-type"><option value="">全部模态</option>${['image', 'audio', 'video', 'text', 'pointcloud', 'timeseries', 'multimodal'].map((m) => `<option>${m}</option>`).join('')}</select>
          <button class="btn" id="gd-search">检索</button>
          <span class="spacer"></span>
          <select class="select" id="gd-format">${['jsonl', 'json', 'csv', 'coco', 'voc', 'labelme'].map((f) => `<option>${f}</option>`).join('')}</select>
          <button class="btn primary" id="gd-export">异步导出</button>
          <button class="btn ghost" id="gd-archive" data-ds="${dsid}">归档数据集</button>
        </div>
        <div id="gd-list">${table(['条目', '模态', '任务状态', '标注', '大小', ''], (detail.rows || []).map((i) => [
          `<span class="name">${esc(i.name)}</span>`, chip(esc(i.media_type)), statusChip(i.task_status || 'pending'),
          String(i.ann_count || 0), `${Math.round((i.size || 0) / 1024)} KB`,
          `<button class="btn ghost sm" data-item="${i.id}">预览</button>`,
        ]), '该数据集暂无条目')}</div></div></div>`;
      window.__ckDataset = dsid;
    }

    mountPage('governance', `${head('治理中心', '计划、授权、抽审、检索与导出', `${tabsHtml}<select class="select" id="gv-proj" style="width:170px;margin-left:8px"><option value="0">全部项目</option>${projectOpts(pid)}</select>`)}${body}`, '治理中心');

    if ($v('#gv-proj')) $v('#gv-proj').onchange = (e) => { location.hash = `#/governance?tab=${tab}&project_id=${e.target.value}`; };
    if (tab === 'plan') {
      $v('#gp-save').onclick = async () => {
        const milestones = $v('#gp-ms').value.split('\n').filter((x) => x.trim()).map((line) => {
          const [name, date] = line.split('|');
          return { name: (name || '').trim(), date: (date || '').trim(), done: false };
        });
        await api(`/api/projects/${pid}/plan`, { method: 'PATCH', body: {
          owner_id: Number($v('#gp-owner').value) || 0, status: $v('#gp-status').value,
          start_at: $v('#gp-start').value, end_at: $v('#gp-end').value, milestones,
        } });
        toast('项目计划已保存', 'ok'); await route();
      };
    } else if (tab === 'task') {
      $$v('[data-tp-save]').forEach((b) => {
        b.onclick = async () => {
          const id = b.dataset.tpSave;
          const val = (f) => { const el = document.querySelector(`[data-tp="${f}"][data-id="${id}"]`); return el ? el.value : ''; };
          await api(`/api/tasks/${id}/plan`, { method: 'PATCH', body: {
            start_at: val('start_at'), end_at: val('end_at'),
            dataset_version: Number(val('dataset_version')) || 0, template_version: Number(val('template_version')) || 0,
          } });
          toast(`任务 #${id} 计划已保存`, 'ok');
        };
      });
    } else if (tab === 'roles') {
      const roleModal = (role) => {
        const perms = window.__ckPermissions || [];
        openModal(`<div class="modal-head"><h3>${role ? '编辑' : '新建'}自定义角色</h3><button class="x" onclick="closeModal()">×</button></div>
          <div class="modal-body"><div class="field"><label>角色名称</label><input class="input" id="rm-name" value="${esc(role ? role.name : '')}"></div>
          <div class="field" style="margin-top:10px"><label>说明</label><input class="input" id="rm-desc" value="${esc(role ? role.description : '')}"></div>
          <div class="panel-label" style="margin-top:14px">权限点</div>
          <div class="chip-row">${perms.map((p) => `<label class="tag"><input type="checkbox" value="${p.key}" ${role && role.permissions.includes(p.key) ? 'checked' : ''}> ${esc(p.label)}</label>`).join('')}</div></div>
          <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">取消</button><button class="btn primary" id="rm-save">保存</button></div>`);
        $v('#rm-save').onclick = async () => {
          const permissions = $$v('#rm-name') && Array.from(document.querySelectorAll('.chip-row input:checked')).map((x) => x.value);
          const payload = { name: $v('#rm-name').value.trim(), description: $v('#rm-desc').value.trim(), permissions };
          await api(role ? `/api/roles/${role.id}` : '/api/roles', { method: role ? 'PATCH' : 'POST', body: payload });
          closeModal(); toast('角色已保存', 'ok'); await route();
        };
      };
      if ($v('#role-add')) $v('#role-add').onclick = () => roleModal(null);
      $$v('[data-role-edit]').forEach((b) => {
        b.onclick = () => roleModal((window.__ckRoles || []).find((r) => r.id === Number(b.dataset.roleEdit)));
      });
      $$v('[data-role-del]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('确认删除该角色？已分配成员将退回默认权限。')) return;
          await api(`/api/roles/${b.dataset.roleDel}`, { method: 'DELETE' });
          toast('已删除', 'ok'); await route();
        };
      });
      $$v('[data-role-assign]').forEach((b) => {
        b.onclick = async () => {
          const mem = await api('/api/members');
          openModal(`<div class="modal-head"><h3>分配角色</h3><button class="x" onclick="closeModal()">×</button></div>
            <div class="modal-body"><select class="select" id="ra-user">${(mem.members || []).map((m) => `<option value="${m.id}">${esc(m.name)}（${esc(m.username)}）</option>`).join('')}</select></div>
            <div class="modal-foot"><button class="btn ghost" onclick="closeModal()">取消</button><button class="btn primary" id="ra-ok">分配</button></div>`);
          $v('#ra-ok').onclick = async () => {
            await api(`/api/roles/${b.dataset.roleAssign}/assign`, { method: 'POST', body: { user_id: Number($v('#ra-user').value) } });
            closeModal(); toast('已分配', 'ok');
          };
        };
      });
    } else if (tab === 'sampling') {
      $v('#sp-save').onclick = async () => {
        const layers = $v('#sp-value').value.trim() ? [{
          field: $v('#sp-field').value, value: $v('#sp-value').value.trim(), rate: Number($v('#sp-layer-rate').value) || 100,
        }] : [];
        await api('/api/sampling/policies', { method: 'POST', body: {
          project_id: pid, mode: $v('#sp-mode').value,
          config: {
            sample_rate: Number($v('#sp-rate').value) || 0, layers,
            risk: { rework: $v('#sp-rework').value === '1', low_score: Number($v('#sp-low').value) || 80, rate: Number($v('#sp-risk-rate').value) || 100 },
          },
        } });
        toast('抽审策略已保存', 'ok'); await route();
      };
    } else if (tab === 'trash') {
      $$v('[data-ds-restore]').forEach((b) => {
        b.onclick = async () => { await api(`/api/datasets/${b.dataset.dsRestore}/restore`, { method: 'POST', body: {} }); toast('已恢复', 'ok'); await route(); };
      });
    } else if (tab === 'data') {
      const dsid = window.__ckDataset;
      const go = () => { location.hash = `#/governance?tab=data&project_id=${pid}&dataset_id=${$v('#gd-ds').value}`; };
      $v('#gd-ds').onchange = async () => {
        const id = $v('#gd-ds').value;
        const d = await api(`/api/datasets/${id}/items?page=1&limit=50`);
        $v('#gd-list').innerHTML = table(['条目', '模态', '任务状态', '标注', '大小', ''], (d.rows || []).map((i) => [
          `<span class="name">${esc(i.name)}</span>`, chip(esc(i.media_type)), statusChip(i.task_status || 'pending'),
          String(i.ann_count || 0), `${Math.round((i.size || 0) / 1024)} KB`, `<button class="btn ghost sm" data-item="${i.id}">预览</button>`,
        ]), '该数据集暂无条目');
        bindItems();
      };
      $v('#gd-search').onclick = go;
      $v('#gd-export').onclick = async () => {
        const r = await api(`/api/datasets/${dsid}/export`, { method: 'POST', body: { format: $v('#gd-format').value } });
        toast(`导出作业 #${r.job_id} 已排队，可在作业中心下载`, 'ok');
      };
      if ($v('#gd-archive')) $v('#gd-archive').onclick = async () => {
        await api(`/api/datasets/${dsid}/archive`, { method: 'POST', body: {} });
        toast('数据集已归档', 'ok'); await route();
      };
      const bindItems = () => {
        $$v('[data-item]').forEach((b) => {
          b.onclick = async () => {
            const d = await api(`/api/datasets/items/${b.dataset.item}`);
            const it = d.item;
            const media = it.media_type === 'image' ? `<img src="${d.preview_url}" style="max-width:100%;border-radius:8px">`
              : it.media_type === 'video' ? `<video controls src="${d.preview_url}" style="width:100%;border-radius:8px"></video>`
              : it.media_type === 'audio' ? `<audio controls src="${d.preview_url}" style="width:100%"></audio>`
              : `<div class="hint">该模态暂不支持内联预览，可下载后查看。</div>`;
            openModal(`<div class="modal-head"><h3>${esc(it.name)}</h3><button class="x" onclick="closeModal()">×</button></div>
              <div class="modal-body">${media}<div class="kv"><span>模态</span><b>${esc(it.media_type)}</b></div>
              <div class="kv"><span>任务</span><b>#${it.task_id || '-'}</b></div>
              <div class="kv"><span>标注状态</span><b>${esc(d.annotation_status || '未保存')}</b></div>
              <pre class="code-block" style="margin-top:10px;max-height:220px">${esc(JSON.stringify(d.annotation, null, 2))}</pre></div>`);
          };
        });
      };
      bindItems();
    }
  }


  async function dashboardTodo() {
    const page = document.getElementById('page');
    if (!page || document.getElementById('ck-todo')) return;
    try {
      const data = await api('/api/my/todo');
      const total = Object.values(data.counts || {}).reduce((a, b) => a + b, 0);
      if (!total) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'ck-todo';
      card.style.marginTop = '14px';
      card.innerHTML = `<div class="card-head"><h3 class="card-title">我的待办</h3><span class="card-sub">共 ${total} 项</span></div>
        <div class="card-body">${data.groups.filter((g) => g.items.length).map((g) => `
          <div class="panel-label">${esc(g.label)} · ${g.items.length}</div>
          ${g.items.slice(0, 5).map((t) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
            <span class="name" style="font-size:12.5px">${esc(t.name)}</span><span class="sub">${esc(t.project_name || '')}</span>
            <span class="spacer"></span>${statusChip(t.status)}
            <a class="btn ghost sm" href="#/annotate/${t.id}">打开</a></div>`).join('')}`).join('')}</div>`;
      page.appendChild(card);
    } catch (e) { /* 待办为增强信息，失败不阻塞工作台 */ }
  }

  async function annotateExtras(page) {
    if (page === 'dashboard') return dashboardTodo();
    if (page !== 'annotate' || !window.CK_STATE || !window.CK_STATE.current) return;
    const task = window.CK_STATE.current.task;
    if (!task) return;
    const actions = document.querySelector('.wb-actions');
    if (!actions || document.getElementById('ck-extra-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ck-extra-btn';
    btn.className = 'btn ghost';
    btn.textContent = '问题/历史/质检';
    btn.onclick = () => openExtras(task.id);
    actions.insertBefore(btn, actions.firstChild);
  }

  async function openExtras(tid) {
    const [issues, hist] = await Promise.all([api(`/api/issues?task_id=${tid}`), api(`/api/tasks/${tid}/annotation/history`)]);
    openModal(`<div class="card-head"><h3 class="card-title">任务 #${tid} · 问题 / 版本 / 规则</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="filters"><input class="input" id="ex-title" placeholder="新增问题标题" style="width:200px"><input class="input" id="ex-desc" placeholder="说明（可选）" style="width:190px"><button class="btn primary" id="ex-add">新增问题</button><button class="btn" id="ex-rule">运行规则质检</button></div>
        <div id="ex-issues">${issues.issues.map((i) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)"><span class="chip ${i.status === 'open' ? 'pending' : 'done'}">${i.status === 'open' ? '待处理' : '已解决'}</span><span style="font-size:12px">${esc(i.title)}</span>${i.item_index >= 0 ? `<span class="tag">第 ${i.item_index + 1} 项</span>` : ''}<button class="btn ghost" data-ex-resolve="${i.id}" style="margin-left:auto">${i.status === 'open' ? '解决' : '重新打开'}</button></div>`).join('') || '<div class="empty">暂无问题</div>'}</div>
        <div class="card-head" style="margin-top:14px"><h3 class="card-title">标注版本</h3></div>
        <div>${hist.versions.map((v) => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)"><span class="tag">v${v.version}</span><span class="sub">${esc(v.note || '')} · ${time(v.created_at)} · ${esc(v.created_by_name || '')}</span><button class="btn ghost" data-ex-restore="${v.id}" style="margin-left:auto">恢复</button></div>`).join('') || '<div class="empty">暂无历史版本（保存后自动生成）</div>'}</div>
        <pre class="hint" id="ex-rule-out" style="white-space:pre-wrap;margin-top:10px"></pre>
      </div>`);
    $v('#ex-add').onclick = async () => {
      await api(`/api/tasks/${tid}/issues`, { method: 'POST', body: { title: $v('#ex-title').value, description: $v('#ex-desc').value } });
      toast('问题已创建', 'ok'); closeModal();
    };
    $v('#ex-rule').onclick = async () => {
      try {
        const r = await api(`/api/tasks/${tid}/qc/rules/run`, { method: 'POST', body: {} });
        $v('#ex-rule-out').textContent = `得分 ${r.score} · ${JSON.stringify(r.dims)}\n` + (r.violations.map((x) => `[${x.level}] ${x.rule}：${x.message}`).join('\n') || '未发现违规');
      } catch (err) { $v('#ex-rule-out').textContent = err.message; }
    };
    $$v('[data-ex-resolve]').forEach((b) => {
      b.onclick = async () => {
        const open = b.textContent.trim() === '解决';
        await api(`/api/issues/${b.dataset.exResolve}`, { method: 'PATCH', body: { status: open ? 'resolved' : 'open' } });
        toast('已更新', 'ok'); closeModal();
      };
    });
    $$v('[data-ex-restore]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('恢复该版本将覆盖当前草稿，确认？')) return;
        await api(`/api/tasks/${tid}/annotation/versions/${b.dataset.exRestore}/restore`, { method: 'POST', body: {} });
        toast('版本已恢复', 'ok'); location.reload();
      };
    });
  }

  /* ------------------------------------------------------------------ 通知 */
  async function openNotifications() {
    const data = await api('/api/notifications');
    openModal(`<div class="card-head"><h3 class="card-title">通知中心</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="filters"><button class="btn ghost" id="n-readall">全部已读</button><span class="spacer"></span><span class="hint">未读 ${data.unread}</span></div>
        ${data.notifications.map((n) => `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(30,42,63,.5);opacity:${n.read_at ? '.6' : '1'}">
          <span class="chip ${n.kind === 'rework' ? 'danger' : n.kind === 'qc' ? 'done' : 'pending'}">${esc(n.kind)}</span>
          <div><b style="font-size:12.5px">${esc(n.title)}</b><div class="sub">${esc(n.body || '')} · ${time(n.created_at)}</div></div>
          ${n.link ? `<a class="btn ghost" href="${esc(n.link)}" style="margin-left:auto" onclick="closeModal()">查看</a>` : ''}
        </div>`).join('') || '<div class="empty">暂无通知</div>'}
      </div>`);
    $v('#n-readall').onclick = async () => {
      await api('/api/notifications/read-all', { method: 'POST', body: {} });
      const dot = document.getElementById('notif-dot');
      if (dot) dot.style.display = 'none';
      toast('已全部已读', 'ok'); closeModal();
    };
  }

  window.CK_NAV = [
    ['hall', '任务大厅', 'tasks', 'task.read'],
    ['jobs', '作业中心', 'upload', 'task.write'],
    ['components', '组件与资产库', 'layers', 'template.read'],
    ['operators', '算子中心', 'spark', 'template.read'],
    ['quality', '规则质检', 'shield', 'task.review'],
    ['governance', '治理中心', 'database', 'org.read'],
    ['issues', '问题清单', 'qc', 'task.read'],
    ['ops', '运维中心', 'settings', 'settings.write'],
    ['help', '帮助中心', 'search', ''],
    ['preferences', '个人偏好', 'members', ''],
  ];
  window.CK_PAGES = {
    hall: pageHall, jobs: pageJobs, components: pageComponents, operators: pageOperators,
    quality: pageQuality, issues: pageIssues, ops: pageOps, help: pageHelp, preferences: pagePreferences,
    governance: pageGovernance,
  };
  window.CK_WORKBENCH = WB;
  window.CK_AFTER_MOUNT = annotateExtras;
  window.CK_OPEN_NOTIFICATIONS = openNotifications;
})();
