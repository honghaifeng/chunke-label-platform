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
      if (r.count > 0) toast(`已领取 ${r.count} 个任务`, 'ok');
      if (r.skipped && r.skipped.length) {
        toast(`${r.skipped.length} 个未领取：${r.skipped.slice(0, 3).map((s) => s.reason).join('；')}`, 'warn');
      }
      await route();
    };
    $$v('[data-pkg]').forEach((b) => {
      b.onclick = async () => {
        const r = await api('/api/task-hall/claim', { method: 'POST', body: { package_id: Number(b.dataset.pkg) } });
        if (r.count > 0) toast(`已整包领取 ${r.count} 个任务`, 'ok');
        else toast(r.skipped && r.skipped.length ? `未领取：${r.skipped[0].reason}` : '任务包暂无可领取任务', 'warn');
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
        <div class="hint" id="imp-edit-notice" style="display:none;margin:0 0 12px"></div>
        <div class="field"><label>选择文件（支持多选、ZIP 压缩包，自动识别音视频/图片/点云/文本）</label><input class="input" type="file" id="imp-files" multiple></div>
        <button class="btn primary" id="imp-submit">开始导入</button>
        <span class="hint" id="imp-status" style="margin-left:10px"></span>
        <div class="grid" style="grid-template-columns:1fr auto;margin-top:18px;align-items:end">
          <div class="field" style="margin:0"><label>或按 URL 批量导入（每行一个）</label><textarea class="input" id="imp-urls" rows="3" placeholder="https://example.com/a.jpg"></textarea></div>
          <button class="btn" id="imp-url-submit">URL 导入</button>
        </div>
        <div class="grid" style="grid-template-columns:150px 1fr auto;margin-top:14px;align-items:end">
          <div class="field" style="margin:0"><label>数据源类型</label><select class="select" id="imp-src-type">
            <option value="ftp">FTP</option><option value="hdfs">HDFS</option><option value="s3">S3</option><option value="http">HTTP 列表</option>
          </select></div>
          <div class="field" style="margin:0"><label>路径 / 地址（HTTP 类型可每行一个）</label><textarea class="input" id="imp-src-path" rows="2" placeholder="ftp://user:pass@host/dir 或 hdfs:///path 或 s3://bucket/prefix"></textarea></div>
          <button class="btn" id="imp-src-submit">数据源导入</button>
        </div>
      </div></div>`;
      /* 图像编辑项目：文件必须原图 + 结果图 + 指令 txt 成组配对，统一走「样本目录导入」 */
      const editPids = new Set(projects().filter((p) => p.modality === 'editing').map((p) => Number(p.id)));
      const notice = $v('#imp-edit-notice');
      const syncEditMode = () => {
        const pid = Number($v('#imp-proj').value);
        const isEdit = editPids.has(pid);
        notice.style.display = isEdit ? '' : 'none';
        notice.innerHTML = isEdit
          ? '图像编辑指令项目需按「原图 + 结果图 + 指令 txt」成组导入，系统会自动配对样本并预填指令。<button class="btn" id="imp-editing-entry" style="margin-left:8px">打开样本目录导入</button>'
          : '';
        ['#imp-submit', '#imp-url-submit', '#imp-src-submit'].forEach((s) => { $v(s).disabled = isEdit; });
        const btn = $v('#imp-editing-entry');
        if (btn) btn.onclick = () => window.editingImportModal && window.editingImportModal(pid);
      };
      $v('#imp-proj').onchange = syncEditMode;
      syncEditMode();

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
      $v('#imp-src-submit').onclick = async () => {
        const lines = $v('#imp-src-path').value.split('\n').map((x) => x.trim()).filter(Boolean);
        if (!lines.length) return toast('请输入路径或地址', 'err');
        const type = $v('#imp-src-type').value;
        const body = { project_id: Number($v('#imp-proj').value), type, batch: $v('#imp-batch').value };
        if (type === 'http') body.urls = lines; else body.path = lines[0];
        const r = await api('/api/import/source', { method: 'POST', body });
        toast(`已创建数据源导入作业 #${r.job_id}`, 'ok');
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
    const [rules, stats, errs] = await Promise.all([api('/api/quality/rules'), api('/api/prelabel/stats'), api('/api/quality/error-types')]);
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
      ${table(['项目', '运行', '候选', '采纳', '采纳率'], (stats.by_project || []).map((p) => [esc(p.project_name), p.runs, p.suggested, p.kept, `${p.acceptance_rate}%`]), '暂无预标注数据')}</div>
      <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">质检错误类型分布</h3><span class="card-sub">累计 ${errs.rejected || 0} 条驳回</span></div><div class="card-body">
        ${(errs.items || []).length ? errs.items.map((it) => {
          const max = Math.max(1, ...errs.items.map((x) => x.count));
          return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px"><span style="width:72px;font-size:12px">${esc(it.type)}</span>
            <div style="flex:1;height:8px;border-radius:4px;background:var(--bg-soft);overflow:hidden"><div style="width:${Math.round(it.count / max * 100)}%;height:100%;background:#EF4444"></div></div>
            <b style="width:34px;text-align:right;font-size:12px">${it.count}</b></div>`;
        }).join('') : '<div class="empty">暂无驳回错误类型数据，质检驳回时勾选错误类型即可统计</div>'}
      </div></div>`, '规则质检');
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
    const segments = payload.segments || [];
    let category = payload.category || '';
    let attrs = payload.attrs || '';
    const media = wb.mediaName ? `/media/${wb.mediaName}` : '';
    const behaviorLabels = (wb.labels && wb.labels['行为']) || ['正常', '异常'];
    wb.customPayload = () => ({ media_type: 'video', tracks, segments, category, attrs });
    wbShell(wb, wb.task.name, `${chip('视频')}${chip(wb.project ? wb.project.name : '')}${chip(`轨迹 ${tracks.length}`)}${chip(`行为 ${segments.length}`)}`, `
      <div class="image-panel"><div class="image-toolbar"><span>视频轨迹标注（关键帧 + 线性插值）</span><span class="spacer"></span>
        <label class="toggle-wrap">类别 <input class="input" id="v-label" value="目标" style="width:96px;height:26px"></label>
        <select class="select" id="v-rate" style="width:82px;height:26px"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option></select>
        <button class="btn ghost" id="v-prev">← 1帧</button>
        <button class="btn ghost" id="v-next">1帧 →</button>
        <button class="btn ghost" id="v-add">当前帧添加框</button>
        <button class="btn ghost" id="v-interp">补全关键帧</button></div>
        <div style="position:relative;background:#050912;min-height:420px;display:flex;align-items:center;justify-content:center" id="v-stage">
          ${media ? `<video id="v-video" src="${media}" controls style="max-width:100%;max-height:520px" preload="metadata"></video>` : '<div class="empty">请先在任务中心上传视频</div>'}
          <div id="v-overlay" style="position:absolute;inset:0;pointer-events:none"></div>
        </div>
        <div class="transport"><span class="mono" id="v-time">00:00</span><input type="range" id="v-seek" min="0" max="100" value="0" style="flex:1"><span class="mono" id="v-dur">00:00</span></div>
        <div class="hint" style="margin-top:6px">Enter 播放/暂停 · ←/→ 上一帧/下一帧 · Ctrl+←/→ 跳 10 帧 · T 新增轨迹 · B 新增行为区间</div>
      </div>`, `
      <div class="card"><div class="card-head"><h3 class="card-title">轨迹列表</h3></div><div class="card-body" id="v-tracks" style="max-height:300px;overflow:auto"></div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">行为区间</h3></div><div class="card-body">
        <div class="filters"><select class="select" id="v-b-label" style="width:96px">${behaviorLabels.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
          <input class="input" id="v-b-subject" placeholder="行为主体" style="width:100px"></div>
        <div class="filters" style="margin-top:6px"><input class="input" id="v-b-start" type="number" step="0.1" placeholder="开始秒" style="width:88px"><input class="input" id="v-b-end" type="number" step="0.1" placeholder="结束秒" style="width:88px"><button class="btn ghost" id="v-b-add">添加</button></div>
        <div id="v-segments" style="margin-top:8px"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">视频分类 / 属性</h3></div><div class="card-body">
        <div class="field"><label>分类（支持层级，如 安防/异常行为）</label><input class="input" id="v-cat" placeholder="内容审核/行为识别"></div>
        <div class="field"><label>属性（逗号分隔）</label><input class="input" id="v-attrs" placeholder="白天,室内,清晰"></div>
      </div></div>`);
    const video = $v('#v-video');
    let current = 0;
    const drawSegs = () => {
      $v('#v-segments').innerHTML = segments.map((s, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <span class="tag">${esc(s.label || '行为')}</span><span class="sub">${esc(s.subject || '')} ${Number(s.start).toFixed(1)}→${Number(s.end).toFixed(1)}s</span>
        <button class="btn ghost danger" data-del-seg="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无行为区间</div>';
      $$v('[data-del-seg]').forEach((b) => { b.onclick = () => { segments.splice(Number(b.dataset.delSeg), 1); drawSegs(); markDirty(wb); }; });
    };
    const draw = () => {
      $v('#v-tracks').innerHTML = tracks.map((tr, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <b style="font-size:12px">${esc(tr.label || '目标')}</b><span class="tag">${(tr.keyframes || []).length} 帧</span>
        <button class="btn ghost" data-kf="${i}" style="margin-left:auto">打关键帧</button>
        <button class="btn ghost" data-copy="${i}">复制上一帧</button>
        <button class="btn ghost" data-auto="${i}" title="按前两关键帧运动估计把目标传播到当前帧">自动跟踪</button>
        <button class="btn ghost danger" data-del-tr="${i}">删除</button></div>`).join('') || '<div class="empty">暂无轨迹</div>';
      $$v('[data-del-tr]').forEach((b) => { b.onclick = () => { tracks.splice(Number(b.dataset.delTr), 1); draw(); markDirty(wb); }; });
      $$v('[data-kf]').forEach((b) => { b.onclick = () => addKeyframe(Number(b.dataset.kf)); });
      $$v('[data-copy]').forEach((b) => { b.onclick = () => copyPrevKeyframe(Number(b.dataset.copy)); });
      $$v('[data-auto]').forEach((b) => { b.onclick = () => autoTrack(Number(b.dataset.auto)); });
      drawSegs();
    };
    // 内置自动跟踪降级：用最近两个关键帧做匀速运动估计，把框传播到当前帧（可接 operator.track.url 换真实模型）
    const autoTrack = (i) => {
      const tr = tracks[i];
      const list = (tr.keyframes || []).filter((k) => k.t < current).sort((a, b) => b.t - a.t);
      if (!list.length) return toast('当前帧之前没有关键帧', 'warn');
      let added;
      if (list.length >= 2) {
        const [k1, k2] = list; // k1 最新，k2 次新
        const dt = k1.t - k2.t || 0.04;
        const gap = current - k1.t;
        added = {
          t: current,
          x: Math.min(0.98, Math.max(0, k1.x + ((k1.x - k2.x) / dt) * gap)),
          y: Math.min(0.98, Math.max(0, k1.y + ((k1.y - k2.y) / dt) * gap)),
          w: Math.max(0.01, k1.w + ((k1.w - k2.w) / dt) * gap),
          h: Math.max(0.01, k1.h + ((k1.h - k2.h) / dt) * gap),
        };
      } else {
        added = { ...list[0], t: current };
      }
      tr.keyframes = [...(tr.keyframes || []), added].sort((a, b) => a.t - b.t);
      draw(); markDirty(wb);
      toast(`已把「${tr.label || '目标'}」传播到 ${current.toFixed(2)}s`, 'ok');
    };
    const addKeyframe = (i) => {
      const tr = tracks[i];
      const list = tr.keyframes || (tr.keyframes = []);
      const last = list[list.length - 1] || { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
      list.push({ t: current, x: last.x, y: last.y, w: last.w, h: last.h });
      list.sort((a, b) => a.t - b.t);
      tr.keyframes = list;
      draw(); markDirty(wb);
    };
    const copyPrevKeyframe = (i) => {
      const tr = tracks[i];
      const list = (tr.keyframes || []).filter((k) => k.t < current).sort((a, b) => b.t - a.t);
      if (!list.length) return toast('当前帧之前没有关键帧', 'warn');
      const prev = list[0], added = { ...prev, t: current };
      tr.keyframes = [...(tr.keyframes || []), added].sort((a, b) => a.t - b.t);
      draw(); markDirty(wb);
    };
    const renderOverlay = () => {
      const overlay = $v('#v-overlay');
      if (!video || !overlay) return;
      const rect = video.getBoundingClientRect();
      const stage = $v('#v-stage').getBoundingClientRect();
      overlay.innerHTML = tracks.map((tr) => {
        const kf = (tr.keyframes || []).slice().sort((a, b) => Math.abs(a.t - current) - Math.abs(b.t - current))[0];
        if (!kf || Math.abs(kf.t - current) > 1) return '';
        return `<div style="position:absolute;left:${rect.left - stage.left + kf.x * rect.width}px;top:${rect.top - stage.top + kf.y * rect.height}px;width:${kf.w * rect.width}px;height:${kf.h * rect.height}px;border:2px solid #3B82F6;border-radius:2px"><span style="position:absolute;left:-1px;top:-18px;background:#3B82F6;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px">${esc(tr.label || '目标')}</span></div>`;
      }).join('');
    };
    const seekFrame = (delta) => {
      if (!video) return;
      video.pause();
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta / 25));
      current = video.currentTime;
      $v('#v-time').textContent = fmtShort(current);
      $v('#v-seek').value = current;
      renderOverlay();
    };
    $v('#v-add').onclick = () => {
      tracks.push({ uid: Math.random().toString(36).slice(2, 8), label: $v('#v-label').value || '目标', keyframes: [{ t: current, x: 0.2, y: 0.25, w: 0.25, h: 0.25 }] });
      draw(); markDirty(wb);
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
      draw(); markDirty(wb); toast('已按关键帧补齐逐帧框', 'ok');
    };
    $v('#v-b-add').onclick = () => {
      const start = Number($v('#v-b-start').value) || current;
      const end = Number($v('#v-b-end').value) || Math.min(video ? video.duration : start + 1, start + 1);
      if (end <= start) return toast('结束时间需大于开始时间', 'err');
      segments.push({ label: $v('#v-b-label').value, subject: $v('#v-b-subject').value.trim(), start, end });
      $v('#v-b-start').value = ''; $v('#v-b-end').value = ''; $v('#v-b-subject').value = '';
      drawSegs(); markDirty(wb);
    };
    $v('#v-cat').onchange = (e) => { category = e.target.value.trim(); };
    $v('#v-attrs').onchange = (e) => { attrs = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).join(','); };
    $v('#v-rate').onchange = (e) => { if (video) video.playbackRate = Number(e.target.value); };
    $v('#v-prev').onclick = () => seekFrame(-1);
    $v('#v-next').onclick = () => seekFrame(1);
    if (video) {
      video.onloadedmetadata = () => { $v('#v-dur').textContent = fmtShort(video.duration); $v('#v-seek').max = video.duration || 0; };
      video.ontimeupdate = () => {
        current = video.currentTime;
        $v('#v-time').textContent = fmtShort(current);
        $v('#v-seek').value = current;
        renderOverlay();
      };
      $v('#v-seek').oninput = (e) => { video.currentTime = Number(e.target.value); };
    }
    document.onkeydown = (e) => {
      if (!document.getElementById('v-video')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'Enter') { e.preventDefault(); video && (video.paused ? video.play() : video.pause()); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekFrame((e.ctrlKey || e.metaKey) ? -10 : -1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); seekFrame((e.ctrlKey || e.metaKey) ? 10 : 1); }
      if (e.key.toLowerCase() === 't') $v('#v-add').click();
      if (e.key.toLowerCase() === 'b') $v('#v-b-add').click();
    };
    draw();
  };

  WB.text = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    // 不从任务名兜底：文本任务打开时自动加载媒体语料文件，无媒体时再手动粘贴
    let text = payload.text || '';
    const spans = (payload.spans || []).filter((s) => s && s.start < s.end);
    const posList = payload.pos || [];
    const matches = payload.matches || [];
    let sentiment = payload.sentiment || { polarity: '中性', intensity: 3, keywords: [] };
    let category = payload.category || '';
    const labels = (wb.labels && (wb.labels['实体'] || wb.labels['实体类型'])) || ['人名', '地名', '机构名', '时间', '数字', '产品', '其他'];
    const posTags = ['名词', '动词', '形容词', '副词', '代词', '介词', '连词', '数量词', '助词', '其他'];
    const relations = ['完全匹配', '部分匹配', '不匹配', '同义', '反义'];
    const spanDepth = (s) => spans.filter((o) => o !== s && o.start <= s.start && o.end >= s.end && (o.end - o.start) > (s.end - s.start)).length;
    const inRange = (s) => s.start >= 0 && s.end <= text.length && s.start < s.end;
    const drawText = () => {
      const valid = spans.filter(inRange);
      const bounds = Array.from(new Set([0, text.length, ...valid.flatMap((s) => [s.start, s.end])]))
        .filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b);
      let html = '';
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i], b = bounds[i + 1];
        if (b <= a) continue;
        const owners = valid.filter((s) => s.start <= a && s.end >= b).sort((x, y) => (x.end - x.start) - (y.end - y.start));
        const inner = owners[0];
        const raw = esc(text.slice(a, b));
        if (!inner) { html += raw; continue; }
        const d = spanDepth(inner);
        html += `<mark data-span="${spans.indexOf(inner)}" title="${esc(inner.label)}${d ? ` · L${d + 1}` : ''}" style="background:rgba(59,130,246,${(0.34 - d * 0.09).toFixed(2)});border-bottom:2px solid ${d ? '#22C55E' : '#3B82F6'}">${raw}</mark>`;
      }
      $v('#t-preview').innerHTML = html || '<span class="hint">在左侧输入文本</span>';
    };
    const draw = () => {
      drawText();
      $v('#t-spans').innerHTML = spans.map((s, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <span class="tag">${esc(s.label)}</span><span class="sub">L${spanDepth(s) + 1}</span>
        ${s.source === 'ai' ? '<span class="chip info">AI</span>' : ''}
        <span style="font-size:12px">${esc(text.slice(s.start, s.end))}</span>
        <button class="btn ghost danger" data-del-span="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无实体</div>';
      $v('#t-pos').innerHTML = posList.map((p, i) => `<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <span class="tag">${esc(p.tag)}</span><span style="font-size:12px">${esc(text.slice(p.start, p.end))}</span>
        <button class="btn ghost danger" data-del-pos="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无词性标注</div>';
      $v('#t-matches').innerHTML = matches.map((m, i) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(30,42,63,.5)">
        <span class="tag">${esc(m.relation)}</span><span class="sub">${esc(m.a)} ↔ ${esc(m.b)}</span>
        <button class="btn ghost danger" data-del-match="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无匹配对</div>';
      $v('#t-keywords').value = (sentiment.keywords || []).join(',');
      $v('#t-pol').value = sentiment.polarity;
      $v('#t-int').value = sentiment.intensity;
      $v('#t-int-val').textContent = sentiment.intensity;
      $v('#t-cat').value = category;
      $$v('#t-spans [data-del-span], #t-pos [data-del-pos], #t-matches [data-del-match]').forEach((b) => {
        b.onclick = () => {
          if (b.dataset.delSpan !== undefined) spans.splice(Number(b.dataset.delSpan), 1);
          if (b.dataset.delPos !== undefined) posList.splice(Number(b.dataset.delPos), 1);
          if (b.dataset.delMatch !== undefined) matches.splice(Number(b.dataset.delMatch), 1);
          draw();
        };
      });
    };
    wb.customPayload = () => ({ media_type: 'text', text, spans, pos: posList, matches, sentiment, category });
    wbShell(wb, wb.task.name, `${chip('文本')}${chip(wb.project ? wb.project.name : '')}${chip(`实体 ${spans.length}`)}${chip(`情感 ${sentiment.polarity}`)}${category ? chip(category) : ''}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">文本内容</h3><button class="btn ghost" id="t-load" style="margin-left:auto">从媒体文件加载</button></div><div class="card-body">
        <textarea class="input" id="t-text" rows="10" placeholder="粘贴或加载待标注文本">${esc(text)}</textarea>
        <div class="filters" style="margin-top:10px">
          <input class="input" id="t-label" list="t-label-list" placeholder="实体类型，如 产品/人名" style="width:160px">
          <datalist id="t-label-list">${labels.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
          <select class="select" id="t-span-parent" style="width:150px"><option value="">顶层实体</option>${spans.map((s, i) => `<option value="${i}">嵌套于：${esc(text.slice(s.start, s.end).slice(0, 12))}</option>`).join('')}</select>
          <button class="btn primary" id="t-span">标注选中文本</button>
          <button class="btn ghost" id="t-prelabel" title="内置词典预识别实体，供确认/删除">预识别实体</button>
        </div>
        <div class="hint" style="margin-top:6px">数字键 1–9 快速切换实体类型，Ctrl/Cmd+D 复制上一实体类型</div>
        <div class="card" style="margin-top:12px"><div class="card-head"><h3 class="card-title">标注预览</h3></div><div class="card-body" id="t-preview" style="line-height:2;font-size:13.5px"></div></div>
      </div></div>`, `
      <div class="card"><div class="card-head"><h3 class="card-title">实体列表</h3></div><div class="card-body" id="t-spans"></div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">情感与分类</h3></div><div class="card-body">
        <div class="field"><label>整体情感</label><select class="select" id="t-pol"><option>正面</option><option>负面</option><option>中性</option></select></div>
        <div class="field"><label>强度 <b id="t-int-val">3</b> / 5</label><input type="range" id="t-int" min="1" max="5" value="3" style="width:100%"></div>
        <div class="field"><label>情感关键词（逗号分隔）</label><input class="input" id="t-keywords" placeholder="失望,退款"></div>
        <div class="field"><label>文本分类（支持层级，如 评论/售后）</label><input class="input" id="t-cat" placeholder="新闻/评论/垃圾文本"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">词性标注</h3></div><div class="card-body">
        <div class="filters"><select class="select" id="t-pos-tag" style="width:110px">${posTags.map((x) => `<option>${x}</option>`).join('')}</select><button class="btn ghost" id="t-pos-add">标注选中文本</button></div>
        <div id="t-pos" style="margin-top:8px"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">语义匹配</h3></div><div class="card-body">
        <textarea class="input" id="t-ma" rows="2" placeholder="文本 A"></textarea>
        <textarea class="input" id="t-mb" rows="2" placeholder="文本 B" style="margin-top:6px"></textarea>
        <div class="filters" style="margin-top:6px"><select class="select" id="t-rel" style="width:120px">${relations.map((x) => `<option>${x}</option>`).join('')}</select><button class="btn ghost" id="t-match-add">添加匹配对</button></div>
        <div id="t-matches" style="margin-top:8px"></div>
      </div></div>`);
    $v('#t-text').oninput = (e) => { text = e.target.value; drawText(); };
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
      const parent = $v('#t-span-parent').value;
      const parentSpan = parent === '' ? null : spans[Number(parent)];
      spans.push({ start, end, label: $v('#t-label').value.trim() || labels[0], parent: parentSpan ? text.slice(parentSpan.start, parentSpan.end) : null });
      draw();
    };
    // 内置实体预识别（词典+规则，供确认/删除；配置外部 NER 后可在此替换）
    $v('#t-prelabel').onclick = () => {
      if (!text.trim()) return toast('请先输入或加载文本', 'warn');
      const rules = [
        ['机构名', /[一-龥A-Za-z0-9]{2,14}(公司|集团|大学|学院|医院|银行|政府|公安局|学校|火锅店|奶茶店|餐厅|商城|平台|旗舰店)/g],
        ['产品', /[一-龥A-Za-z0-9]{1,8}(手机|手环|耳机|电脑|笔记本|平板|手表|电视|空调|冰箱|洗衣机|运动鞋|包|口红|面膜|精华|奶粉|咖啡|毛肚|酥肉|锅底)/g],
        ['时间', /\d{4}年\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月|\d{1,2}月\d{1,2}[日号]|\d{1,2}号|周[一二三四五六日天]|[早晚]上|凌晨|中午|下午/g],
        ['数字', /\d+(\.\d+)?(%|个|只|条|次|款|台|件|小时|分钟|天|周|月|年|元|块|斤|公里)?/g],
        ['地名', /(北京|上海|广州|深圳|杭州|南京|苏州|成都|重庆|武汉|西安|长沙|天津|青岛|厦门|合肥|郑州|宁波|佛山|东莞)|[一-龥]{2,6}(省|市|区|县|州|路|街|站|机场)/g],
        ['人名', /(?:客服|店员|经理|服务员|老师|医生|教练|老板|技师)([一-龥]{1,2})/g],
      ];
      const found = [];
      rules.forEach(([label, re]) => {
        let m;
        while ((m = re.exec(text))) {
          const seg = m[1] && label === '人名' ? m[1] : m[0];
          const start = m.index + (label === '人名' ? m[0].indexOf(seg) : 0);
          found.push({ start, end: start + seg.length, label, source: 'ai' });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      });
      // 去重 + 去除与已有 span 重叠的部分
      const occupied = Array.from({ length: text.length }, () => false);
      spans.filter(inRange).forEach((s) => { for (let i = s.start; i < s.end; i++) occupied[i] = true; });
      const accepted = [];
      found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
      found.forEach((f) => {
        if (f.end <= f.start || f.end > text.length) return;
        for (let i = f.start; i < f.end; i++) if (occupied[i]) return;
        for (let i = f.start; i < f.end; i++) occupied[i] = true;
        accepted.push({ start: f.start, end: f.end, label: f.label, parent: null, source: 'ai' });
      });
      if (!accepted.length) return toast('未识别到新实体（可能与已有标注重叠）', 'warn');
      spans.push(...accepted);
      draw();
      toast(`预识别 ${accepted.length} 个实体，请在列表中确认或删除`, 'ok');
    };
    $v('#t-pos-add').onclick = () => {
      const ta = $v('#t-text');
      const start = ta.selectionStart, end = ta.selectionEnd;
      if (start === end) return toast('请先选中文本', 'err');
      posList.push({ start, end, tag: $v('#t-pos-tag').value });
      draw();
    };
    $v('#t-match-add').onclick = () => {
      const a = $v('#t-ma').value.trim(), b = $v('#t-mb').value.trim();
      if (!a || !b) return toast('请填写两段文本', 'err');
      matches.push({ a, b, relation: $v('#t-rel').value });
      $v('#t-ma').value = ''; $v('#t-mb').value = '';
      draw();
    };
    $v('#t-pol').onchange = (e) => { sentiment = { ...sentiment, polarity: e.target.value }; };
    $v('#t-int').oninput = (e) => { sentiment = { ...sentiment, intensity: Number(e.target.value) }; $v('#t-int-val').textContent = e.target.value; };
    $v('#t-keywords').onchange = (e) => { sentiment = { ...sentiment, keywords: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }; };
    $v('#t-cat').onchange = (e) => { category = e.target.value.trim(); };
    document.onkeydown = (e) => {
      if (!document.getElementById('t-text')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= labels.length) { $v('#t-label').value = labels[Number(e.key) - 1]; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && spans.length) {
        e.preventDefault();
        $v('#t-label').value = spans[spans.length - 1].label;
      }
    };
    draw();
    // 文本任务且尚无保存内容时，自动加载媒体语料文件
    if (!payload.text && wb.mediaName && state.current.task.media_type === 'text') $v('#t-load').click();
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

  WB.pointcloud = async (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    const classes = (wb.labels && wb.labels['目标类别']) || ['轿车', '行人', '骑行者', '货车'];
    let points = (payload.sample || []).map((p) => [Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0]);
    let intensity = (payload.intensity || []).slice(0, points.length);
    let boxes = payload.boxes || [];
    let keypoints = payload.keypoints || [];
    let lanes = payload.lanes || [];
    let frames = payload.frames || [];
    let segs = payload.seg || [];            // [{label, ranges:[start,count,...] (RLE over points)}]
    let category = payload.category || '';
    let attrs = payload.attrs || '';
    const calib = payload.calib || null;   // {P2[12], Tr[12], R0[9]} 用于 3D→2D 投影
    let selBox = -1, tool = 'select', segCls = classes[0], laneDraft = null, groundZ = -1.7;
    let playing = false, playTimer = null;

    /* ---------- three.js 场景 ---------- */
    let THREE;
    try {
      THREE = await import('/static/vendor/three.module.js');
    } catch (e) {
      toast('three.js 加载失败：请确认 app/static/vendor/three.module.js 存在', 'err');
      return;
    }
    const canvas = () => $v('#pc-canvas');
    const overlay = () => $v('#pc-overlay');
    // 渲染器延迟到画布挂载后创建（WB.pointcloud 先于 wbShell 执行）
    let renderer = null;
    const getRenderer = () => {
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ canvas: canvas(), antialias: true });
        renderer.setPixelRatio(devicePixelRatio || 1);
      }
      return renderer;
    };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050912);
    const camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 600);
    camera.up.set(0, 0, 1); // 世界坐标：x 前 y 左 z 上
    // 默认与 2D 相机同向：从车尾上方俯视前方道路（x 前 y 左 z 上）
    const DEFAULT_CAM = { yaw: Math.PI, pitch: 0.4, dist: 42, tx: 14, ty: 0, tz: -0.8 };
    const cam = { ...DEFAULT_CAM };
    const updateCamera = () => {
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      camera.position.set(
        cam.tx + cam.dist * cp * Math.cos(cam.yaw),
        cam.ty + cam.dist * cp * Math.sin(cam.yaw),
        cam.tz + cam.dist * sp,
      );
      camera.lookAt(cam.tx, cam.ty, cam.tz);
    };
    // 地面网格（XY 平面，法线 Z）
    const grid = new THREE.GridHelper(160, 16, 0x334155, 0x1e2a3f);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const segColorOf = {};
    classes.forEach((c, i) => { segColorOf[c] = new THREE.Color(`hsl(${(i * 67 + 20) % 360},85%,60%)`); });
    const BOX_EDGES = [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    const geoEdges = (l, w, h) => {
      const c = [
        [-l / 2, -w / 2, 0], [l / 2, -w / 2, 0], [-l / 2, w / 2, 0], [l / 2, w / 2, 0],
        [-l / 2, -w / 2, h], [l / 2, -w / 2, h], [-l / 2, w / 2, h], [l / 2, w / 2, h],
      ];
      const pos = [];
      BOX_EDGES.forEach(([a, b]) => pos.push(...c[a], ...c[b]));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return g;
    };
    const makeLabel = (text, color) => {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(5,9,18,.75)';
      x.fillRect(0, 8, 256, 44);
      x.fillStyle = color;
      x.font = 'bold 30px ui-sans-serif, system-ui';
      x.fillText(text, 10, 40);
      const tex = new THREE.CanvasTexture(cv);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(4.4, 1.1, 1);
      return sp;
    };

    /* 点云对象 */
    let pointsObj = null;
    const rebuildPointGeometry = () => {
      if (pointsObj) { scene.remove(pointsObj); pointsObj.geometry.dispose(); pointsObj.material.dispose(); }
      if (!points.length) { pointsObj = null; render(); return; }
      const pos = new Float32Array(points.length * 3);
      points.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(points.length * 3), 3));
      pointsObj = new THREE.Points(g, new THREE.PointsMaterial({
        size: 0.16, vertexColors: true, sizeAttenuation: true,
      }));
      pointsObj.frustumCulled = false;
      scene.add(pointsObj);
      rebuildColors();
    };
    const bgColor = new THREE.Color(0x050912);
    const tmpColor = new THREE.Color();
    const rebuildColors = () => {
      if (!pointsObj) return;
      const col = pointsObj.geometry.getAttribute('color');
      const intenOn = intensity.length === points.length;
      const [i0, i1] = intenRange;
      const mode = ($v('#pc-color') || {}).value || 'height';
      for (let i = 0; i < points.length; i++) {
        const [x, y, z] = points[i];
        const inRoi = x >= roi.x0 && x <= roi.x1 && y >= roi.y0 && y <= roi.y1 && z >= roi.z0 && z <= roi.z1;
        const inInten = !intenOn || (intensity[i] >= i0 && intensity[i] <= i1);
        if (!inRoi || !inInten) {
          col.setXYZ(i, bgColor.r, bgColor.g, bgColor.b);
          continue;
        }
        if (mode === 'distance') {
          const t = Math.min(1, Math.hypot(x, y) / 70);
          tmpColor.setHSL(0.5 + t * 0.33, 0.85, 0.6);
        } else {
          const t = Math.max(0, Math.min(1, (z + 2.5) / 7));
          tmpColor.setHSL((1 - t) * 0.47, 0.8, 0.52 + Math.min(1, Math.hypot(x, y) / 70) * 0.14);
        }
        col.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      segs.forEach((sg) => {
        const c = segColorOf[sg.label] || new THREE.Color('#F59E0B');
        rleDecode(sg.ranges || []).forEach((i) => {
          if (i < points.length) col.setXYZ(i, c.r, c.g, c.b);
        });
      });
      col.needsUpdate = true;
      render();
    };

    /* 3D 框对象 */
    let boxObjs = [];     // {group, fill, label(sprite)}
    let handlesGroup = null;
    const clearGroup = (g) => {
      if (!g) return;
      g.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
      scene.remove(g);
    };
    let boxLabels = [];
    const rebuildBoxes = () => {
      boxObjs.forEach((o) => clearGroup(o.group));
      boxLabels.forEach((o) => clearGroup(o));
      boxObjs = [];
      boxLabels = [];
      boxes.forEach((b, i) => {
        const group = new THREE.Group();
        const col = segColorOf[b.label] || new THREE.Color('#F59E0B');
        const lb = makeLabel(`${i + 1}·${b.label}`, col.getStyle());
        lb.position.set(b.x, b.y, b.z + b.h + 0.7);
        scene.add(lb);
        boxLabels.push(lb);
        const fillGeo = new THREE.BoxGeometry(Math.max(0.1, b.l), Math.max(0.1, b.w), Math.max(0.1, b.h));
        const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: selBox === i ? 0.28 : 0.1, depthWrite: false,
        }));
        fill.position.z = b.h / 2;
        fill.userData = { boxIndex: i };
        const edges = new THREE.LineSegments(
          geoEdges(b.l, b.w, b.h),
          new THREE.LineBasicMaterial({ color: selBox === i ? 0xfcd34d : (b.source === 'ai' ? 0x22d3ee : col) }),
        );
        edges.position.z = 0;
        group.add(fill); group.add(edges);
        group.position.set(b.x, b.y, b.z);
        group.rotation.z = b.yaw || 0;
        scene.add(group);
        boxObjs.push({ group, fill });
      });
      rebuildHandles();
      render();
    };
    const rebuildHandles = () => {
      if (handlesGroup) { clearGroup(handlesGroup); handlesGroup = null; }
      if (selBox < 0 || !boxes[selBox]) return;
      const b = boxes[selBox];
      handlesGroup = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
      const mk = (px, py, pz, kind, corner) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), mat.clone());
        s.position.set(px, py, pz);
        s.userData = { handle: kind, corner };
        handlesGroup.add(s);
        return s;
      };
      const l2 = b.l / 2, w2 = b.w / 2;
      mk(-l2, -w2, 0, 'resize', 0); mk(l2, -w2, 0, 'resize', 1);
      mk(-l2, w2, 0, 'resize', 2); mk(l2, w2, 0, 'resize', 3);
      mk(0, 0, b.h, 'height', -1);
      mk(l2 + 1.6, 0, b.h / 2, 'rotate', -1);
      handlesGroup.traverse((o) => { o.renderOrder = 999; });
      scene.add(handlesGroup);
      render();
    };

    /* 车道线 / 关键点 / 车道线草稿 */
    let laneObjs = [], kpObjs = [], laneDraftObj = null;
    const lineMat = (style, highlighted) => style === '虚线'
      ? new THREE.LineDashedMaterial({ color: highlighted ? 0xfcd34d : 0x22d3ee, dashSize: 0.8, gapSize: 0.5 })
      : new THREE.LineBasicMaterial({ color: highlighted ? 0xfcd34d : 0x06b6d4 });
    const lineFromPts = (pts, mat) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2] || groundZ)));
      const ln = new THREE.Line(g, mat);
      if (ln.computeLineDistances) ln.computeLineDistances();
      return ln;
    };
    const rebuildLanes = () => {
      laneObjs.forEach((o) => clearGroup(o));
      laneObjs = [];
      lanes.forEach((ln, i) => {
        const obj = lineFromPts(ln.points || [], lineMat(ln.style, i === selLane));
        scene.add(obj);
        laneObjs.push(obj);
      });
      render();
    };
    const rebuildKPs = () => {
      kpObjs.forEach((o) => clearGroup(o));
      kpObjs = [];
      keypoints.forEach((k) => {
        const g = new THREE.Group();
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x050912 }));
        g.add(s); g.add(core);
        g.position.set(k.x, k.y, k.z);
        const lb = makeLabel(k.label || '关键点', '#86EFAC');
        lb.scale.set(2.2, 0.55, 1);
        lb.position.set(k.x, k.y, k.z + 0.55);
        scene.add(g); scene.add(lb);
        kpObjs.push(g, lb);
      });
      render();
    };
    const rebuildLaneDraft = () => {
      if (laneDraftObj) { clearGroup(laneDraftObj); laneDraftObj = null; }
      if (laneDraft && laneDraft.length >= 2) {
        laneDraftObj = lineFromPts(laneDraft, new THREE.LineBasicMaterial({ color: 0xfcd34d }));
        scene.add(laneDraftObj);
      }
      render();
    };

    /* ---------- 分割 RLE ---------- */
    const rleEncode = (idxs) => {
      const s = Array.from(idxs).sort((a, b) => a - b);
      const out = [];
      let i = 0;
      while (i < s.length) {
        let j = i;
        while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
        out.push(s[i], j - i + 1);
        i = j + 1;
      }
      return out;
    };
    const rleDecode = (ranges) => {
      const out = [];
      for (let i = 0; i < ranges.length; i += 2) {
        for (let k = 0; k < ranges[i + 1]; k++) out.push(ranges[i] + k);
      }
      return out;
    };

    /* ---------- 2D 覆盖层（屏幕空间草稿/选区） ---------- */
    const drawOverlay = () => {
      const ov = overlay();
      if (!ov) return;
      const dpr = devicePixelRatio || 1;
      const w = ov.clientWidth, h = ov.clientHeight;
      if (ov.width !== w * dpr) { ov.width = w * dpr; ov.height = h * dpr; }
      const x = ov.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const css = getComputedStyle(document.documentElement).getPropertyValue('--pc-seg') || '#F59E0B';
      if (segDraft && segDraft.length) {
        x.strokeStyle = css;
        x.setLineDash([5, 3]);
        x.beginPath();
        segDraft.forEach(([sx, sy], i) => (i ? x.lineTo(sx, sy) : x.moveTo(sx, sy)));
        x.stroke();
        x.setLineDash([]);
      }
      if (segRect) {
        x.strokeStyle = css;
        x.setLineDash([5, 3]);
        x.strokeRect(segRect[0], segRect[1], segRect[2], segRect[3]);
        x.setLineDash([]);
      }
    };
    const toScreen = (v3) => {
      const v = v3.clone().project(camera);
      const ov = overlay();
      return [(v.x + 1) / 2 * ov.clientWidth, (1 - v.y) / 2 * ov.clientHeight];
    };

    // 3D 框 → 2D 相机画面投影（KITTI 标定：lidar→cam→pixel）
    const drawCamOverlay = () => {
      const img = $v('#pc-cam'), ov = $v('#pc-cam-overlay');
      if (!img || !ov || !img.naturalWidth || !calib) return;
      const rect = img.getBoundingClientRect();
      if (!rect.width) return;
      const dpr = devicePixelRatio || 1;
      if (ov.width !== Math.floor(rect.width * dpr)) { ov.width = rect.width * dpr; ov.height = rect.height * dpr; }
      const x = ov.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, rect.width, rect.height);
      const { P2, Tr, R0 } = calib;
      const proj = (p) => {
        // lidar -> cam
        const cx = Tr[0] * p[0] + Tr[1] * p[1] + Tr[2] * p[2] + Tr[3];
        const cy = Tr[4] * p[0] + Tr[5] * p[1] + Tr[6] * p[2] + Tr[7];
        const cz = Tr[8] * p[0] + Tr[9] * p[1] + Tr[10] * p[2] + Tr[11];
        const rx = R0[0] * cx + R0[1] * cy + R0[2] * cz;
        const ry = R0[3] * cx + R0[4] * cy + R0[5] * cz;
        const rz = R0[6] * cx + R0[7] * cy + R0[8] * cz;
        if (rz < 0.6) return null;
        const u = (P2[0] * rx + P2[1] * ry + P2[2] * rz + P2[3]) / rz;
        const v = (P2[4] * rx + P2[5] * ry + P2[6] * rz + P2[7]) / rz;
        return [u / img.naturalWidth * rect.width, v / img.naturalHeight * rect.height];
      };
      // 点云投影：近红远蓝，验证点云与图像同帧
      const projPts = $v('#pc-proj-pts');
      if (projPts && projPts.checked && points.length) {
        for (let i = 0; i < points.length; i++) {
          const s = proj(points[i]);
          if (!s || s[0] < 0 || s[0] > rect.width || s[1] < 0 || s[1] > rect.height) continue;
          const t = Math.max(0, Math.min(1, (points[i][0] - 2) / 55));
          x.fillStyle = `rgb(${Math.round(255 * (1 - t))},60,${Math.round(255 * t)})`;
          x.fillRect(s[0], s[1], 1.4, 1.4);
        }
      }
      const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      boxes.forEach((b, i) => {
        const ca = Math.cos(b.yaw || 0), sa = Math.sin(b.yaw || 0);
        const cs = [];
        for (const dx of [-b.l / 2, b.l / 2]) for (const dy of [-b.w / 2, b.w / 2]) for (const dz of [0, b.h]) {
          cs.push(proj([b.x + dx * ca - dy * sa, b.y + dx * sa + dy * ca, b.z + dz]));
        }
        const col = selBox === i ? '#FCD34D' : (b.source === 'ai' ? '#22D3EE' : '#FB923C');
        x.strokeStyle = col;
        x.lineWidth = selBox === i ? 2.2 : 1.5;
        x.beginPath();
        edges.forEach(([a, c2]) => {
          if (!cs[a] || !cs[c2]) return;
          x.moveTo(cs[a][0], cs[a][1]);
          x.lineTo(cs[c2][0], cs[c2][1]);
        });
        x.stroke();
        const top = cs[4] || cs[5] || cs[6] || cs[7];
        if (top) {
          x.fillStyle = col;
          x.font = '600 11px ui-sans-serif, system-ui';
          x.fillText(`${i + 1}·${b.label}${typeof b.conf === 'number' ? ' ' + b.conf : ''}`, Math.max(2, top[0] + 3), Math.max(12, top[1] - 3));
        }
      });
    };
    const render = () => {
      const c = canvas();
      if (!c) return;
      const w = c.clientWidth, h = c.clientHeight;
      if (!w) return;
      const r = getRenderer();
      if (c.width !== Math.floor(w * (devicePixelRatio || 1))) r.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      updateCamera();
      r.render(scene, camera);
      grid.position.z = groundZ;
      drawOverlay();
      drawCamOverlay();
      drawHud();
    };

    const drawHud = () => {
      const el = $v('#pc-hud');
      if (!el) return;
      const segCounts = segs.map((sg) => `${sg.label} ${rleDecode(sg.ranges || []).length}点`).join(' · ');
      el.textContent = `点 ${points.length.toLocaleString()} · 框 ${boxes.length} · 分割 ${segs.length} 类${segCounts ? '（' + segCounts + '）' : ''} · 帧 ${frames.length} · three.js r${THREE.REVISION}`;
    };

    /* ---------- 交互 ---------- */
    const raycaster = new THREE.Raycaster();
    const ndc = (sx, sy) => {
      const c = canvas();
      const r = c.getBoundingClientRect();
      return new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    };
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -groundZ);
    const groundHit = (sx, sy) => {
      raycaster.setFromCamera(ndc(sx, sy), camera);
      const pt = new THREE.Vector3();
      return raycaster.ray.intersectPlane(groundPlane, pt) ? pt : null;
    };
    let drag = null;
    let selLane = -1, segRect = null, segDraft = null;
    const roi = { x0: -60, x1: 60, y0: -60, y1: 60, z0: -3, z1: 5 };
    let intenRange = [0, 1];

    const bindCanvas = () => {
      const cvs = canvas();
      if (!cvs || cvs._pcBound) return;
      cvs._pcBound = true;
      cvs.addEventListener('contextmenu', (e) => e.preventDefault());
      cvs.addEventListener('mousedown', (e) => {
        if (!wb.canEdit && tool !== 'select' && tool !== 'pan') return;
        const sx = e.clientX, sy = e.clientY;
        if (e.button === 2 || e.button === 1 || tool === 'pan') {
          drag = { mode: 'pan', sx, sy };
          return;
        }
        if (tool === 'select') {
          raycaster.setFromCamera(ndc(sx, sy), camera);
          // 把手优先
          if (handlesGroup) {
            const hits = raycaster.intersectObjects(handlesGroup.children, false);
            if (hits.length) {
              const ud = hits[0].object.userData;
              drag = { mode: ud.handle, i: selBox, corner: ud.corner };
              return;
            }
          }
          const fills = boxObjs.map((o) => o.fill);
          const hits = raycaster.intersectObjects(fills, false);
          if (hits.length) {
            selBox = hits[0].object.userData.boxIndex;
            const g = groundHit(sx, sy);
            if (g) drag = { mode: 'boxmove', i: selBox, dx: boxes[selBox].x - g.x, dy: boxes[selBox].y - g.y };
            rebuildBoxes(); drawLists();
            return;
          }
          selBox = -1;
          rebuildBoxes(); drawLists();
          drag = { mode: 'orbit', sx, sy };
          return;
        }
        if (tool === 'box') {
          const g = groundHit(sx, sy);
          if (g) {
            boxes.push({
              x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10, z: groundZ,
              l: Number($v('#pc-l').value) || 4, w: Number($v('#pc-w').value) || 1.8,
              h: Number($v('#pc-h').value) || 1.6, yaw: 0, label: $v('#pc-label').value || segCls,
            });
            selBox = boxes.length - 1;
            markDirty(wb); drawLists(); rebuildBoxes();
          }
          return;
        }
        if (tool === 'lane') {
          const g = groundHit(sx, sy);
          if (g) { laneDraft = laneDraft || []; laneDraft.push([Math.round(g.x * 10) / 10, Math.round(g.y * 10) / 10, groundZ]); rebuildLaneDraft(); }
          return;
        }
        if (tool === 'keypoint') {
          const g = groundHit(sx, sy);
          if (g) {
            keypoints.push({ x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10, z: groundZ, label: $v('#kp-label').value.trim() || '关键点' });
            markDirty(wb); drawLists(); rebuildKPs();
          }
          return;
        }
        if (tool === 'segrect') { segRect = [sx - cvs.getBoundingClientRect().left, sy - cvs.getBoundingClientRect().top, 0, 0]; return; }
        if (tool === 'segpoly') { segDraft = segDraft || []; segDraft.push([sx - cvs.getBoundingClientRect().left, sy - cvs.getBoundingClientRect().top]); drawOverlay(); return; }
      });
      cvs.addEventListener('dblclick', () => {
        if (tool === 'lane' && laneDraft && laneDraft.length >= 2) {
          lanes.push({ type: $v('#ln-type').value, style: $v('#ln-style').value, points: laneDraft });
          laneDraft = null;
          markDirty(wb); drawLists(); rebuildLanes(); rebuildLaneDraft();
        }
        if (tool === 'segpoly' && segDraft && segDraft.length >= 3) {
          applySegPolygon(segDraft);
          segDraft = null;
          drawOverlay();
        }
      });
      cvs.addEventListener('mousemove', (e) => {
        if (!drag && tool !== 'select') return;
        const sx = e.clientX, sy = e.clientY;
        if (!drag) return;
        if (drag.mode === 'orbit') {
          cam.yaw += (sx - drag.sx) * 0.008;
          cam.pitch = Math.max(0.05, Math.min(1.45, cam.pitch + (sy - drag.sy) * 0.006));
          drag.sx = sx; drag.sy = sy;
          render();
        } else if (drag.mode === 'pan') {
          const k = cam.dist / 620;
          const dx = (sx - drag.sx) * k, dy = (sy - drag.sy) * k;
          const fwd = new THREE.Vector3();
          camera.getWorldDirection(fwd);
          const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
          const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
          cam.tx -= right.x * dx - up.x * dy;
          cam.ty -= right.y * dx - up.y * dy;
          cam.tz -= right.z * dx - up.z * dy;
          drag.sx = sx; drag.sy = sy;
          render();
        } else if (drag.mode === 'boxmove') {
          const g = groundHit(sx, sy);
          if (g) { boxes[drag.i].x = Math.round((g.x + drag.dx) * 10) / 10; boxes[drag.i].y = Math.round((g.y + drag.dy) * 10) / 10; rebuildBoxes(); }
        } else if (drag.mode === 'resize') {
          const b = boxes[drag.i];
          const g = groundHit(sx, sy);
          if (g) {
            const ca = Math.cos(b.yaw || 0), sa = Math.sin(b.yaw || 0);
            const dx = g.x - b.x, dy = g.y - b.y;
            const lx = Math.abs(dx * ca + dy * sa) * 2;
            const ly = Math.abs(-dx * sa + dy * ca) * 2;
            if (drag.corner === 0 || drag.corner === 3) b.l = Math.max(0.4, Math.round(lx * 10) / 10);
            if (drag.corner === 1 || drag.corner === 2) b.l = Math.max(0.4, Math.round(lx * 10) / 10);
            if (drag.corner === 0 || drag.corner === 1) b.w = Math.max(0.4, Math.round(ly * 10) / 10);
            if (drag.corner === 2 || drag.corner === 3) b.w = Math.max(0.4, Math.round(ly * 10) / 10);
            rebuildBoxes();
          }
        } else if (drag.mode === 'height') {
          const b = boxes[drag.i];
          // 与过框中心、面向相机的竖直平面求交
          raycaster.setFromCamera(ndc(sx, sy), camera);
          const fwd = new THREE.Vector3();
          camera.getWorldDirection(fwd);
          const n = new THREE.Vector3(fwd.x, fwd.y, 0).normalize();
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(b.x, b.y, 0));
          const pt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(plane, pt)) {
            b.h = Math.max(0.3, Math.round((pt.z - b.z) * 10) / 10);
            rebuildBoxes();
          }
        } else if (drag.mode === 'rotate') {
          const b = boxes[drag.i];
          const g = groundHit(sx, sy);
          if (g) { b.yaw = Math.round(Math.atan2(g.y - b.y, g.x - b.x) * 100) / 100; rebuildBoxes(); }
        } else if (drag.mode === 'segrect') {
          const r = canvas().getBoundingClientRect();
          segRect[2] = sx - r.left - segRect[0];
          segRect[3] = sy - r.top - segRect[1];
          drawOverlay();
        }
      });
      window.addEventListener('mouseup', () => {
        if (!drag) return;
        if (drag.mode === 'segrect' && segRect) {
          const r = normRect(segRect);
          if (r[2] > 6 && r[3] > 6) applySegRect(r);
          segRect = null;
        }
        if (drag.mode !== 'orbit' && drag.mode !== 'pan') markDirty(wb);
        drag = null;
        drawOverlay();
      });
      cvs.addEventListener('wheel', (e) => {
        e.preventDefault();
        cam.dist = Math.max(4, Math.min(180, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
        render();
      }, { passive: false });
    };
    const normRect = (r) => [Math.min(r[0], r[0] + r[2]), Math.min(r[1], r[1] + r[3]), Math.abs(r[2]), Math.abs(r[3])];

    /* ---------- 分割应用 ---------- */
    const collectSeg = (test) => {
      const idxs = [];
      for (let i = 0; i < points.length; i++) {
        const [sx, sy] = toScreen(new THREE.Vector3(points[i][0], points[i][1], points[i][2]));
        if (test(sx, sy)) idxs.push(i);
      }
      return idxs;
    };
    const applySegRect = (r) => {
      const idxs = collectSeg((x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]);
      applySegIdxs(idxs);
    };
    const applySegPolygon = (poly) => {
      const inPoly = (x, y) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
      applySegIdxs(collectSeg(inPoly));
    };
    const applySegIdxs = (idxs) => {
      if (!idxs.length) return toast('选区内没有点（注意裁剪/强度筛选会过滤点）', 'warn');
      segs = segs.filter((sg) => sg.label !== segCls);
      segs.push({ label: segCls, ranges: rleEncode(idxs) });
      rebuildColors();
      markDirty(wb); drawLists();
      toast(`已将 ${idxs.length.toLocaleString()} 点标记为「${segCls}」`, 'ok');
    };

    /* ---------- 点云文件解析（PCD 二进制/ASCII、PLY、KITTI BIN） ---------- */
    const loadCloudFile = async (file) => {
      const buf = await file.arrayBuffer();
      const name = (file.name || '').toLowerCase();
      let pts = [], inten = [];
      try {
        if (name.endsWith('.bin')) {
          const f = new Float32Array(buf);
          const stride = 4;
          const n = Math.floor(f.length / stride);
          const step = Math.max(1, Math.floor(n / 120000));
          for (let i = 0; i < n; i += step) {
            pts.push([f[i * stride], f[i * stride + 1], f[i * stride + 2]]);
            inten.push(f[i * stride + 3] || 0);
          }
        } else if (name.endsWith('.pcd')) {
          const headEnd = findSub(buf, 'DATA');
          const head = new TextDecoder().decode(buf.slice(0, headEnd.end));
          const fields = /FIELDS\s+([^\n]+)/.exec(head);
          const dataLine = /DATA\s+(\S+)/.exec(head);
          const fmt = dataLine ? dataLine[1] : 'ascii';
          const names = fields ? fields[1].trim().split(/\s+/) : ['x', 'y', 'z'];
          const ix = names.indexOf('x'), iy = names.indexOf('y'), iz = names.indexOf('z'), ii = names.indexOf('intensity');
          if (fmt === 'binary') {
            const off = /OFFSETS\s+([^\n]+)/.exec(head);
            const sizeM = /SIZE\s+([^\n]+)/.exec(head);
            const typeM = /TYPE\s+([^\n]+)/.exec(head);
            const sizes = sizeM ? sizeM[1].trim().split(/\s+/).map(Number) : [4, 4, 4];
            const types = typeM ? typeM[1].trim().split(/\s+/) : ['F', 'F', 'F'];
            const offs = off ? off[1].trim().split(/\s+/).map(Number) : sizes.reduce((a, s, i2) => (a.push(i2 ? a[i2 - 1] + sizes[i2 - 1] : 0), a), []);
            const rowSize = sizes.reduce((a, b2) => a + b2, 0);
            const dv = new DataView(buf, headEnd.end);
            const n = Math.floor(dv.byteLength / rowSize);
            const readF = (o, t, s) => (t === 'F' ? (s === 8 ? dv.getFloat64(o, true) : dv.getFloat32(o, true)) : (t === 'U' ? (s === 4 ? dv.getUint32(o, true) : dv.getUint16(o, true)) : dv.getInt32(o, true)));
            const step = Math.max(1, Math.floor(n / 120000));
            for (let i = 0; i < n; i += step) {
              const base = i * rowSize;
              pts.push([readF(base + offs[ix], types[ix], sizes[ix]), readF(base + offs[iy], types[iy], sizes[iy]), readF(base + offs[iz], types[iz], sizes[iz])]);
              if (ii >= 0) inten.push(readF(base + offs[ii], types[ii], sizes[ii]));
            }
          } else {
            new TextDecoder().decode(buf.slice(headEnd.end)).split('\n').forEach((line) => {
              const parts = line.trim().split(/\s+/).map(Number);
              if (parts.length >= 3 && parts.every((x) => isFinite(x))) {
                pts.push([parts[ix], parts[iy], parts[iz]]);
                if (ii >= 0) inten.push(parts[ii] || 0);
              }
            });
          }
        } else if (name.endsWith('.ply')) {
          const headEnd = findSub(buf, 'end_header');
          const head = new TextDecoder().decode(buf.slice(0, headEnd.end));
          const fmt = /format\s+(\S+)/.exec(head);
          const props = [...head.matchAll(/property\s+\S+\s+(\S+)/g)].map((m) => m[1]);
          const ix = props.indexOf('x'), iy = props.indexOf('y'), iz = props.indexOf('z'), ii = props.indexOf('intensity') >= 0 ? props.indexOf('intensity') : props.indexOf('scalar_intensity');
          if (fmt && fmt[1] === 'ascii') {
            new TextDecoder().decode(buf.slice(headEnd.end)).split('\n').forEach((line) => {
              const parts = line.trim().split(/\s+/).map(Number);
              if (parts.length >= 3 && parts.every((x) => isFinite(x))) {
                pts.push([parts[ix], parts[iy], parts[iz]]);
                if (ii >= 0) inten.push(parts[ii] || 0);
              }
            });
          } else {
            const dv = new DataView(buf, headEnd.end);
            const rowSize = props.length * 4;
            const n = Math.floor(dv.byteLength / rowSize);
            const step = Math.max(1, Math.floor(n / 120000));
            for (let i = 0; i < n; i += step) {
              const base = i * rowSize;
              const g = (k) => dv.getFloat32(base + k * 4, true);
              pts.push([g(ix), g(iy), g(iz)]);
              if (ii >= 0) inten.push(g(ii));
            }
          }
        } else {
          new TextDecoder().decode(buf).split('\n').forEach((line) => {
            const parts = line.trim().split(/[\s,]+/).map(Number);
            if (parts.length >= 3 && parts.every((x) => isFinite(x))) pts.push(parts.slice(0, 3));
          });
        }
      } catch (err) {
        console.error('点云解析失败', err);
      }
      if (!pts.length) return toast('未解析到点云数据', 'err');
      points = pts;
      intensity = inten.length === pts.length ? inten : [];
      if (intensity.length) {
        const mx = Math.max(...intensity);
        intenRange = [0, mx];
        const sl = $v('#pc-inten');
        if (sl) { sl.min = 0; sl.max = mx; sl.value = mx; $v('#pc-inten-val').textContent = mx.toFixed(1); }
      }
      rebuildPointGeometry();
      markDirty(wb);
      toast(`已加载 ${pts.length.toLocaleString()} 点${intensity.length ? '（含强度）' : ''}`, 'ok');
    };
    const findSub = (buf, str) => {
      const t = new TextEncoder().encode(str);
      const u8 = new Uint8Array(buf);
      for (let i = 0; i < u8.length - t.length; i++) {
        let ok = true;
        for (let j = 0; j < t.length; j++) if (u8[i + j] !== t[j]) { ok = false; break; }
        if (ok) {
          let end = i;
          while (end < u8.length && u8[end] !== 10) end++;
          return { start: i, end: Math.min(end + 1, u8.length) };
        }
      }
      return { start: 0, end: 0 };
    };

    /* ---------- 帧序列（4D） ---------- */
    const setFrame = (i) => {
      const f = frames[i];
      if (!f) return;
      boxes = JSON.parse(JSON.stringify(f.boxes || []));
      keypoints = JSON.parse(JSON.stringify(f.keypoints || []));
      lanes = JSON.parse(JSON.stringify(f.lanes || []));
      segs = JSON.parse(JSON.stringify(f.seg || []));
      if (f.sample && f.sample.length) { points = f.sample.map((p) => p.slice()); intensity = []; }
      selBox = -1;
      rebuildPointGeometry(); rebuildBoxes(); rebuildLanes(); rebuildKPs(); drawLists();
      const tl = $v('#pc-frame-cur');
      if (tl) tl.textContent = String(i + 1);
    };
    const snapshotFrame = () => {
      frames.push({
        name: `帧 ${frames.length + 1}`,
        sample: points.slice(0, 25000),
        boxes: JSON.parse(JSON.stringify(boxes)),
        keypoints: JSON.parse(JSON.stringify(keypoints)),
        lanes: JSON.parse(JSON.stringify(lanes)),
        seg: JSON.parse(JSON.stringify(segs)),
      });
      drawLists(); markDirty(wb);
      toast(`已保存第 ${frames.length} 帧`, 'ok');
    };
    const playFrames = () => {
      if (playing) {
        playing = false;
        clearInterval(playTimer);
        $v('#pc-play').textContent = '播放';
        return;
      }
      if (frames.length < 2) return toast('至少需要 2 帧才能播放', 'warn');
      playing = true;
      $v('#pc-play').textContent = '暂停';
      let i = Number($v('#pc-frame-cur').textContent || '1') - 1;
      playTimer = setInterval(() => {
        i = (i + 1) % frames.length;
        setFrame(i);
      }, 600);
    };

    /* ---------- 列表 ---------- */
    const drawLists = () => {
      $v('#pc-list').innerHTML = boxes.map((b, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5);align-items:center;${i === selBox ? 'background:rgba(252,211,77,.08)' : ''}">
        <span class="tag">${esc(b.label)}</span><span class="sub">(${b.x},${b.y},${b.z}) L${b.l} W${b.w} H${b.h} ${((b.yaw || 0) * 57.3).toFixed(0)}°</span>
        ${b.source === 'ai' ? `<span class="chip info" title="AI 预标注，请核对">AI ${typeof b.conf === 'number' ? b.conf : ''}</span>` : ''}
        <button class="btn ghost sm" data-cp-box="${i}" title="复制盒参数">复制</button>
        <button class="btn ghost danger" data-del-3d="${i}">删除</button></div>`).join('') || '<div class="empty">暂无 3D 框</div>';
      $v('#pc-kps').innerHTML = keypoints.map((k, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5)"><span class="tag">${esc(k.label)}</span><span class="sub">(${k.x},${k.y},${k.z})</span><button class="btn ghost danger" data-del-kp="${i}" style="margin-left:auto">删除</button></div>`).join('') || '<div class="empty">暂无关键点</div>';
      $v('#pc-lanes').innerHTML = lanes.map((ln, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5);align-items:center;${i === selLane ? 'background:rgba(34,211,238,.08)' : ''}"><span class="tag">${esc(ln.type)}</span><span class="sub">${esc(ln.style)} · ${(ln.points || []).length} 点</span><button class="btn ghost sm" data-cp-lane="${i}" title="复制到相邻帧/批量标注">复用</button><button class="btn ghost danger" data-del-lane="${i}">删除</button></div>`).join('') || '<div class="empty">暂无车道线</div>';
      $v('#pc-segs').innerHTML = segs.map((sg, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5);align-items:center"><i style="width:10px;height:10px;border-radius:2px;background:#F59E0B"></i><span class="tag">${esc(sg.label)}</span><span class="sub">${rleDecode(sg.ranges || []).length.toLocaleString()} 点</span><button class="btn ghost danger" data-del-seg="${i}" style="margin-left:auto">清除</button></div>`).join('') || '<div class="empty">暂无分割：框选或多边形圈选点后标记类别</div>';
      $v('#pc-frames').innerHTML = frames.map((f, i) => `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.5);align-items:center"><span class="tag">帧 ${i + 1}</span><span class="sub">${(f.boxes || []).length} 框 · ${(f.lanes || []).length} 车道线 · ${(f.seg || []).length} 分割</span><button class="btn ghost sm" data-load-f="${i}" style="margin-left:auto">载入</button><button class="btn ghost sm" data-cp-f="${i}" title="把当前标注复制到该帧">写入</button><button class="btn ghost danger" data-del-f="${i}">删除</button></div>`).join('') || '<div class="empty">暂无帧：点「+帧快照」把当前帧加入时间轴</div>';
      $$v('[data-del-3d]').forEach((b) => { b.onclick = () => { boxes.splice(Number(b.dataset.del3d), 1); if (selBox >= boxes.length) selBox = -1; drawLists(); rebuildBoxes(); markDirty(wb); }; });
      $$v('[data-cp-box]').forEach((b) => { b.onclick = () => { const src = boxes[Number(b.dataset.cpBox)]; boxes.push({ ...JSON.parse(JSON.stringify(src)), x: src.x + 1.5 }); drawLists(); rebuildBoxes(); markDirty(wb); toast('已复制盒参数（偏移 1.5m）', 'ok'); }; });
      $$v('[data-del-kp]').forEach((b) => { b.onclick = () => { keypoints.splice(Number(b.dataset.delKp), 1); drawLists(); rebuildKPs(); markDirty(wb); }; });
      $$v('[data-del-lane]').forEach((b) => { b.onclick = () => { lanes.splice(Number(b.dataset.delLane), 1); drawLists(); rebuildLanes(); markDirty(wb); }; });
      $$v('[data-cp-lane]').forEach((b) => { b.onclick = () => { const src = lanes[Number(b.dataset.cpLane)]; lanes.push(JSON.parse(JSON.stringify(src))); drawLists(); rebuildLanes(); markDirty(wb); toast('已复用车道线（可用于相邻/转向车道批量标注）', 'ok'); }; });
      $$v('[data-del-seg]').forEach((b) => { b.onclick = () => { segs.splice(Number(b.dataset.delSeg), 1); rebuildColors(); drawLists(); markDirty(wb); }; });
      $$v('[data-del-f]').forEach((b) => { b.onclick = () => { frames.splice(Number(b.dataset.delF), 1); drawLists(); markDirty(wb); }; });
      $$v('[data-load-f]').forEach((b) => { b.onclick = () => setFrame(Number(b.dataset.loadF)); });
      $$v('[data-cp-f]').forEach((b) => { b.onclick = () => { const i = Number(b.dataset.cpF); frames[i] = { ...frames[i], boxes: JSON.parse(JSON.stringify(boxes)), keypoints: JSON.parse(JSON.stringify(keypoints)), lanes: JSON.parse(JSON.stringify(lanes)), seg: JSON.parse(JSON.stringify(segs)) }; drawLists(); markDirty(wb); toast(`当前标注已写入帧 ${i + 1}`, 'ok'); }; });
      drawHud();
    };

    wb.customPayload = () => ({
      media_type: 'pointcloud',
      boxes, keypoints, lanes, frames, category, attrs,
      seg: segs,
      sample: points.slice(0, 25000),
      intensity: intensity.slice(0, 25000),
    });

    /* ---------- 布局 ---------- */
    const camImg = (wb.media || []).find((m) => m.kind === 'image');
    wbShell(wb, wb.task.name, `${chip('3D 点云')}${chip(wb.project ? wb.project.name : '')}${chip(`框 ${boxes.length}`)}${chip(`分割 ${segs.length} 类`)}${chip(`帧 ${frames.length}`)}`, `
      <div class="image-panel">
        <div class="image-toolbar" style="flex-wrap:wrap;gap:6px">
          ${[['select', '选择'], ['box', '画 3D 框'], ['segrect', '框选分割'], ['segpoly', '多边形分割'], ['lane', '车道线'], ['keypoint', '关键点'], ['pan', '平移']].map(([k, label]) => `<button class="img-tool pc-tool ${k === 'select' ? 'active' : ''}" data-pctool="${k}">${label}</button>`).join('')}
          <select class="select" id="pc-segcls" style="width:88px;height:26px">${classes.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
          <span class="spacer"></span>
          <span class="hint">地面Z</span><input class="input" id="pc-ground" type="number" step="0.1" value="-1.7" style="width:64px;height:26px">
          <select class="select" id="pc-color" style="width:90px;height:26px"><option value="height">按高度</option><option value="distance">按距离</option></select>
          强度 <input type="range" id="pc-inten" min="0" max="1" step="0.05" value="1" style="width:80px"><span class="hint" id="pc-inten-val">—</span>
          <button class="btn sm ghost" id="pc-home" title="回到与 2D 相机一致的视角">对齐视角</button>
          <button class="btn sm primary" id="pc-ai" title="内置聚类+PCA 自动检测目标，生成 AI 预标注框供核对">AI 预标注</button>
          <button class="btn sm ghost" id="pc-load">${icon('upload')} 加载点云</button><input type="file" id="pc-file" accept=".pcd,.ply,.bin,.txt" hidden>
        </div>
        <div style="display:grid;grid-template-columns:3fr 2fr;gap:10px;align-items:stretch">
          <div class="image-stage" id="pc-stage" style="min-height:460px;cursor:crosshair;position:relative;margin:0">
            <canvas id="pc-canvas" style="width:100%;height:460px;display:block"></canvas>
            <canvas id="pc-overlay" style="position:absolute;inset:0;width:100%;height:460px;pointer-events:none"></canvas>
          </div>
          <div class="card" style="margin:0;display:flex;flex-direction:column;min-width:0">
            <div class="card-head" style="padding:8px 12px"><h3 class="card-title" style="font-size:12px">2D 相机画面${calib ? ' · 3D 框实时投影' : ''}</h3>
              ${calib ? '<label class="toggle-wrap" style="margin-left:auto"><input type="checkbox" id="pc-proj-pts" /> 投影点云</label>' : ''}
              <span class="card-sub">${esc(camImg ? camImg.name : '未挂载')}</span></div>
            <div class="card-body" style="padding:8px;flex:1;display:flex;align-items:center;min-height:0">
              ${camImg ? `<div style="position:relative;width:100%">
                  <img id="pc-cam" src="${camImg.url}" style="width:100%;border-radius:6px;border:1px solid var(--border);display:block" />
                  <canvas id="pc-cam-overlay" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas>
                </div>`
                : '<div class="empty" style="width:100%">该任务未挂载相机图</div>'}
            </div>
          </div>
        </div>
        <div class="image-status" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span id="pc-hud">点 0 · 框 0</span>
          <span class="spacer"></span>
          <span class="hint">ROI 裁剪</span>
          <input class="input" id="roi-x0" placeholder="x≥" style="width:52px;height:24px" value="-60"><input class="input" id="roi-x1" placeholder="x≤" style="width:52px;height:24px" value="60">
          <input class="input" id="roi-y0" placeholder="y≥" style="width:52px;height:24px" value="-60"><input class="input" id="roi-y1" placeholder="y≤" style="width:52px;height:24px" value="60">
          <input class="input" id="roi-z0" placeholder="z≥" style="width:52px;height:24px" value="-3"><input class="input" id="roi-z1" placeholder="z≤" style="width:52px;height:24px" value="5">
        </div>
        <div class="filters" style="margin-top:8px;align-items:center">
          <b style="font-size:12px">4D 帧序列</b>
          <button class="btn sm" id="pc-snap">+ 帧快照</button>
          <button class="btn sm ghost" id="pc-play">播放</button>
          <button class="btn sm ghost" id="pc-prev">上一帧</button>
          <button class="btn sm ghost" id="pc-next">下一帧</button>
          <span class="tag">当前帧 <b id="pc-frame-cur">—</b> / ${frames.length}</span>
          <span class="hint">首帧标注后复制到后续帧，再逐帧微调即帧间追踪</span>
        </div>
      </div>
      `,
      `<div class="card"><div class="card-head"><h3 class="card-title">3D 检测框</h3><span class="card-sub">画布点击地面放置，拖动把手调尺寸/旋转</span></div><div class="card-body">
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
          <div class="field"><label>长 L</label><input class="input" id="pc-l" value="4"></div>
          <div class="field"><label>宽 W</label><input class="input" id="pc-w" value="1.8"></div>
          <div class="field"><label>高 H</label><input class="input" id="pc-h" value="1.6"></div>
        </div>
        <div class="field"><label>类别</label><input class="input" id="pc-label" value="${esc(classes[0])}"></div>
        <div id="pc-list" style="margin-top:10px"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">语义 / 实例分割</h3></div><div class="card-body">
        <div class="hint" style="margin-bottom:6px">框选或多边形圈选点云区域后，按当前类别写入分割；同类别互相覆盖，实例请用不同类别（如 轿车-1 / 轿车-2）。</div>
        <div id="pc-segs"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">关键点</h3></div><div class="card-body">
        <div class="filters"><input class="input" id="kp-label" placeholder="名称" style="width:110px"></div>
        <div class="hint" style="margin-top:4px">切到「关键点」工具，在点云地面点击放置。</div>
        <div id="pc-kps" style="margin-top:8px"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">车道线</h3></div><div class="card-body">
        <div class="filters"><select class="select" id="ln-type" style="width:88px">${['直道', '弯道', '匝道', '路口'].map((x) => `<option>${x}</option>`).join('')}</select><select class="select" id="ln-style" style="width:76px"><option>实线</option><option>虚线</option></select></div>
        <div class="hint" style="margin-top:4px">「车道线」工具连续点击地面取点，双击结束；支持折线/曲线点列与相邻车道复用。</div>
        <div id="pc-lanes" style="margin-top:8px"></div>
      </div></div>
      <div class="card"><div class="card-head"><h3 class="card-title">场景分类 / 帧序列</h3></div><div class="card-body">
        <div class="field"><label>场景分类</label><input class="input" id="pc-cat" value="${esc(category)}" placeholder="城市道路/高速/停车场"></div>
        <div class="field"><label>属性（逗号分隔）</label><input class="input" id="pc-attrs" value="${esc(attrs)}" placeholder="白天,雨天"></div>
        <div id="pc-frames" style="margin-top:8px"></div>
      </div></div>`);

    /* ---------- 事件绑定 ---------- */
    $$v('.pc-tool').forEach((b) => {
      b.onclick = () => {
        tool = b.dataset.pctool;
        $$v('.pc-tool').forEach((x) => x.classList.toggle('active', x === b));
        const cvs = canvas();
        if (cvs) cvs.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
      };
    });
    $v('#pc-segcls').onchange = (e) => { segCls = e.target.value; $v('#pc-label').value = segCls; };
    $v('#pc-ground').onchange = (e) => { groundZ = Number(e.target.value) || 0; groundPlane.constant = -groundZ; render(); };
    $v('#pc-color').onchange = () => rebuildColors();
    $v('#pc-inten').oninput = (e) => { intenRange[1] = Number(e.target.value); $v('#pc-inten-val').textContent = Number(e.target.value).toFixed(1); rebuildColors(); };
    [['roi-x0', 'x0'], ['roi-x1', 'x1'], ['roi-y0', 'y0'], ['roi-y1', 'y1'], ['roi-z0', 'z0'], ['roi-z1', 'z1']].forEach(([id, key]) => {
      $v(`#${id}`).onchange = (e) => { roi[key] = Number(e.target.value) || 0; rebuildColors(); };
    });
    $v('#pc-load').onclick = () => $v('#pc-file').click();
    $v('#pc-file').onchange = (e) => { const f = e.target.files[0]; if (f) loadCloudFile(f); e.target.value = ''; };
    $v('#pc-cat').onchange = (e) => { category = e.target.value.trim(); };
    $v('#pc-attrs').onchange = (e) => { attrs = e.target.value.split(',').map((x) => x.trim()).filter(Boolean).join(','); };
    $v('#pc-snap').onclick = snapshotFrame;
    $v('#pc-play').onclick = playFrames;
    $v('#pc-prev').onclick = () => { const i = Math.max(0, (Number($v('#pc-frame-cur').textContent || '1') - 2)); if (frames[i]) setFrame(i); };
    $v('#pc-next').onclick = () => { const i = Math.min(frames.length - 1, Number($v('#pc-frame-cur').textContent || '0')); if (frames[i]) setFrame(i); };
    // 内置 AI 预标注：地面滤除 → 网格聚类 → PCA 拟合 3D 框（可接外部检测算子替换）
    const autoLabel = () => {
      if (!points.length) return toast('请先加载点云', 'warn');
      const zs = points.map((p) => p[2]).sort((a, b) => a - b);
      const zGround = zs[Math.floor(zs.length * 0.08)] + 0.05;
      const cell = 0.6;
      const grid = new Map();
      const kept = [];
      points.forEach((p, i) => {
        const [x, y, z] = p;
        if (z < zGround + 0.25 || z > zGround + 2.6) return;
        if (Math.hypot(x, y) > 55 || x < roi.x0 || x > roi.x1 || y < roi.y0 || y > roi.y1) return;
        kept.push(i);
        const key = `${Math.round(x / cell)},${Math.round(y / cell)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      });
      if (!kept.length) return toast('滤除地面后没有剩余点', 'warn');
      // BFS 聚类（6 邻域膨胀一格）
      const seen = new Set();
      const clusters = [];
      const keyOf = (x, y) => `${Math.round(points[x][0] / cell)},${Math.round(points[x][1] / cell)}`;
      kept.forEach((start) => {
        if (seen.has(start)) return;
        const stack = [start];
        const cl = [];
        seen.add(start);
        while (stack.length) {
          const i = stack.pop();
          cl.push(i);
          const [x, y] = points[i];
          const cx = Math.round(x / cell), cy = Math.round(y / cell);
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const bucket = grid.get(`${cx + dx},${cy + dy}`);
            if (!bucket) continue;
            bucket.forEach((j) => {
              if (!seen.has(j)) { seen.add(j); stack.push(j); }
            });
          }
        }
        clusters.push(cl);
      });
      const found = [];
      clusters.forEach((cl) => {
        if (cl.length < 25 || cl.length > 6000) return;
        let cx = 0, cy = 0, zmax = -Infinity, zmin = Infinity;
        cl.forEach((i) => {
          cx += points[i][0]; cy += points[i][1];
          if (points[i][2] > zmax) zmax = points[i][2];
          if (points[i][2] < zmin) zmin = points[i][2];
        });
        cx /= cl.length; cy /= cl.length;
        if (zmax - zmin < 0.55) return; // 排除立面/地面残片
        // PCA（2x2 协方差）
        let sxx = 0, sxy = 0, syy = 0;
        cl.forEach((i) => {
          const dx = points[i][0] - cx, dy = points[i][1] - cy;
          sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
        });
        const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        const ct = Math.cos(theta), st = Math.sin(theta);
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        cl.forEach((i) => {
          const dx = points[i][0] - cx, dy = points[i][1] - cy;
          const u = dx * ct + dy * st, v = -dx * st + dy * ct;
          if (u < uMin) uMin = u; if (u > uMax) uMax = u;
          if (v < vMin) vMin = v; if (v > vMax) vMax = v;
        });
        const l = uMax - uMin + 0.3, w = vMax - vMin + 0.3, h = zmax - zGround + 0.15;
        if (l < 1.2 || l > 7 || w < 0.7 || w > 3 || h < 0.8 || h > 2.4) return;
        const density = cl.length / (l * w);
        if (density < 14) return; // 排除树木/围栏等稀疏簇
        const yaw = Math.round(Math.atan2(st, ct) * 100) / 100;
        found.push({
          x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10, z: Math.round(zGround * 100) / 100,
          l: Math.round(l * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10,
          yaw, label: $v('#pc-label').value || segCls,
          source: 'ai', auto_cls: 'auto-cluster',
          conf: Math.round(Math.min(0.95, 0.55 + cl.length / 300) * 100) / 100,
        });
      });
      if (!found.length) return toast('未检测到有效目标（可放宽 ROI/强度筛选后重试）', 'warn');
      const manual = boxes.filter((b) => b.source !== 'ai');
      boxes = [...manual, ...found];
      selBox = -1;
      markDirty(wb); drawLists(); rebuildBoxes();
      toast(`AI 预标注 ${found.length} 个目标（置信度见列表），请逐框核对`, 'ok');
    };
    $v('#pc-ai').onclick = autoLabel;
    $v('#pc-home').onclick = () => { Object.assign(cam, DEFAULT_CAM); render(); };
    window.addEventListener('resize', render);
    bindCanvas();
    const camEl = $v('#pc-cam');
    if (camEl) camEl.onload = () => render();
    const projChk = $v('#pc-proj-pts');
    if (projChk) projChk.onchange = () => render();
    rebuildPointGeometry();
    rebuildBoxes();
    rebuildLanes();
    rebuildKPs();
    drawLists();
    render();
  };


  WB.multimodal = (wb) => {
    const payload = (state.current.annotation && state.current.annotation.payload) || {};
    const items = payload.items || [];
    const media = (state.current.media || []).slice();
    const gallery = () => [
      { name: wb.mediaName, kind: wb.mediaType, path: wb.mediaName ? `/media/${wb.mediaName}` : '', main: true },
      ...media.map((m) => ({ name: m.name, kind: m.kind, path: m.url, id: m.id })),
    ];
    wb.customPayload = () => ({ media_type: 'multimodal', items });
    wbShell(wb, wb.task.name, `${chip('多模态')}${chip(wb.project ? wb.project.name : '')}${chip(`${gallery().length} 个媒体`)}`, `
      <div class="card"><div class="card-head"><h3 class="card-title">媒体画廊</h3><span class="card-sub">主媒体 + 挂载附件（双图对照）</span>
        ${wb.canEdit ? '<button class="btn ghost sm" id="mm-attach" style="margin-left:auto">挂载附件</button><input type="file" id="mm-attach-file" hidden multiple />' : ''}</div>
        <div class="card-body"><div class="grid three-col" id="mm-gallery"></div></div></div>`,
      `<div class="card"><div class="card-head"><h3 class="card-title">标注条目</h3><button class="btn ghost" id="mm-add" style="margin-left:auto">新增</button></div><div class="card-body" id="mm-items"></div></div>`);
    const drawGallery = () => {
      $v('#mm-gallery').innerHTML = gallery().map((m, i) => `<div class="card" style="cursor:pointer" data-mm="${i}"><div class="card-body" style="padding:8px">
          ${m.kind === 'image' ? `<img src="${m.path}" style="width:100%;height:120px;object-fit:cover;border-radius:6px">` : m.kind === 'video' ? `<video src="${m.path}" style="width:100%;height:120px;object-fit:cover;border-radius:6px" muted></video>` : `<div class="empty" style="height:120px">${esc(m.kind)} 文件</div>`}
          <div class="sub" style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.main ? (m.name || '主媒体') : (m.name || '附件'))}</span>
            ${m.id && wb.canEdit ? `<button class="btn ghost sm danger" data-mm-del="${m.id}" title="删除附件">删除</button>` : ''}
          </div></div></div>`).join('') || '<div class="empty">暂无媒体</div>';
      $$v('[data-mm-del]').forEach((b) => {
        b.onclick = async (e) => {
          e.stopPropagation();
          await api(`/api/tasks/${wb.task.id}/attachments/${b.dataset.mmDel}`, { method: 'DELETE' });
          const idx = media.findIndex((m) => String(m.id) === String(b.dataset.mmDel));
          if (idx >= 0) media.splice(idx, 1);
          state.current.media = media;
          drawGallery();
          toast('附件已删除', 'ok');
        };
      });
      $$v('[data-mm]').forEach((el) => {
        el.onclick = () => {
          const m = gallery()[+el.dataset.mm];
          if (m && m.path) window.open(m.path, '_blank');
        };
      });
    };
    if (wb.canEdit) {
      const input = $v('#mm-attach-file');
      $v('#mm-attach').onclick = () => input.click();
      input.onchange = async () => {
        for (const file of Array.from(input.files || [])) {
          const fd = new FormData();
          fd.append('file', file);
          const r = await api(`/api/tasks/${wb.task.id}/attachments`, { method: 'POST', body: fd });
          media.push({ id: r.id, name: r.name, kind: r.kind, url: r.url });
        }
        state.current.media = media;
        input.value = '';
        drawGallery();
        toast(`已挂载 ${media.length} 个附件`, 'ok');
      };
    }
    drawGallery();
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

  /* ------------------------------------------------------------------ 图像编辑指令工作台 */
  WB.editing = (wb) => {
    const e0 = wb.edit || {};
    const edit = {
      edit_type: e0.edit_type || '',
      attribute_dim: Array.isArray(e0.attribute_dim) ? e0.attribute_dim.slice() : [],
      attribute_value: e0.attribute_value || '',
      same_target_count: wb.boxes.length,
      target_locator: e0.target_locator || '',
      target_name: e0.target_name || '',
      target_category: e0.target_category || '',
      shadow_adjusted: !!e0.shadow_adjusted,
      instruction: e0.instruction || '',
      result_note: e0.result_note || '',
    };
    wb.edit = edit;
    const dims = [['color', '颜色'], ['texture', '纹理'], ['size', '尺寸'], ['material', '材质']];
    const cats = ['人物', '动物', '物品', '食物'];
    const field = (label, inner, hint = '') => `<div class="field"><label>${label}</label>${inner}${hint ? `<div class="hint" style="margin-top:4px">${hint}</div>` : ''}</div>`;

    wb.customPayload = () => ({
      media_type: 'editing',
      img_size: { w: wb.imgW || 0, h: wb.imgH || 0 },
      edit,
      boxes: wb.boxes.map((b) => ({
        cls: '同类目标', name: b.name || '', target: !!b.target,
        x: Number(b.x) || 0, y: Number(b.y) || 0, w: Number(b.w) || 0, h: Number(b.h) || 0,
      })),
    });

    wbShell(wb, wb.task.name, `${chip('图像编辑')}${chip(wb.project ? wb.project.name : '')}${chip(`${wb.boxes.length} 个同类目标`)}`, `
      <div class="image-panel">
        <div class="image-toolbar"><span class="hint">拖拽画框标记同类目标，选中「目标」单选框指向本次编辑对象</span><span class="spacer"></span>
          <button class="btn sm ghost" id="ed-clear" ${wb.canEdit ? '' : 'disabled'}>清空框</button></div>
        <div class="image-stage" id="ed-stage">
          ${wb.mediaName ? `<img id="work-img" src="/media/${encodeURIComponent(wb.mediaName)}" crossorigin="anonymous" />` : '<div class="empty"><b>暂无原图</b>请在任务中心上传原图</div>'}
          <canvas id="box-canvas"></canvas>
        </div>
        <div class="image-status" id="ed-status">加载中…</div>
      </div>
      <div class="card" style="flex:1;min-height:0;display:flex;flex-direction:column">
        <div class="card-head"><h3 class="card-title">同类目标标注</h3><span class="card-sub" id="ed-box-sub">${wb.boxes.length} 个</span></div>
        <div class="box-list" id="ed-box-list" style="max-height:240px;overflow:auto"></div>
      </div>`, `
      <div class="card">
        <div class="card-head"><h3 class="card-title">编辑结果图</h3><span class="card-sub">原图 / 结果图对照</span>
          ${wb.canEdit ? '<button class="btn ghost sm" id="ed-res-up" style="margin-left:auto">上传结果图</button><input type="file" id="ed-res-file" accept="image/*" hidden />' : ''}</div>
        <div class="card-body" id="ed-result"></div>
      </div>
      <div class="side-panel" style="flex:1;min-height:0">
        <div class="panel-head">编辑指令（结构化）</div>
        <div class="panel-body" style="overflow:auto">
          ${field('编辑类型', `<select class="select" id="ed-edit-type"><option value="">请选择</option><option value="delete" ${edit.edit_type === 'delete' ? 'selected' : ''}>删除目标</option><option value="attribute" ${edit.edit_type === 'attribute' ? 'selected' : ''}>修改属性</option></select>`)}
          <div id="ed-attr-wrap" style="display:${edit.edit_type === 'attribute' ? '' : 'none'}">
            ${field('属性维度（可多选）', `<div class="cls-picker" id="ed-dims">${dims.map(([k, v]) => `<label class="fchip ${edit.attribute_dim.includes(k) ? 'on' : ''}" style="cursor:pointer"><input type="checkbox" data-ed-dim="${k}" ${edit.attribute_dim.includes(k) ? 'checked' : ''} style="display:none">${v}</label>`).join('')}</div>`)}
            ${field('属性值', `<input class="input" id="ed-attr-value" value="${esc(edit.attribute_value)}" placeholder="例如：改为深棕色 / 放大 1.5 倍" />`)}
          </div>
          ${field('目标描述', `<input class="input" id="ed-target-name" value="${esc(edit.target_name)}" placeholder="例如：棕色圆凳" />`, '指令中必须能唯一指向该目标')}
          ${field('目标类别', `<select class="select" id="ed-target-cat"><option value="">请选择</option>${cats.map((c) => `<option ${edit.target_category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
          ${field('定位信息', `<input class="input" id="ed-locator" value="${esc(edit.target_locator)}" placeholder="例如：画面中央、餐台前方" />`, '用于唯一确定目标，支持位置 / 颜色 / 序数')}
          ${field('同类目标数', `<input class="input mono" id="ed-count" value="${wb.boxes.length}" readonly />`, '由标注框数量自动统计，至少 3 个')}
          <div class="panel-section">
            <label class="toggle-wrap" style="display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid var(--border);border-radius:8px">
              <input type="checkbox" id="ed-shadow" ${edit.shadow_adjusted ? 'checked' : ''} style="margin-top:2px" />
              <span>已按实际情况调整编辑后目标的影子<br/><span class="hint">未确认影子调整将无法提交</span></span>
            </label>
          </div>
          ${field('编辑指令', `<textarea class="input" id="ed-instruction" rows="4" placeholder="例如：将图中餐台前方，位于画面中央的棕色圆凳删除。">${esc(edit.instruction)}</textarea>`, `<span id="ed-ins-count">${edit.instruction.length}</span> / 120 字符`)}
          ${field('返修 / 结果说明（可选）', `<input class="input" id="ed-note" value="${esc(edit.result_note)}" placeholder="记录编辑细节或异常" />`)}
          <div class="filters" style="margin-top:6px"><button class="btn sm" id="ed-check">校验规范</button><span class="hint" style="margin-left:8px">提交前将强制校验</span></div>
          <div id="ed-issues" style="margin-top:10px"></div>
        </div>
      </div>`);

    const resultOf = () => (wb.media || []).find((m) => m.meta && (m.meta.role === 'result' || m.meta.source === 'result'));
    const renderResult = () => {
      const box = $v('#ed-result'); if (!box) return;
      const m = resultOf();
      if (m) {
        box.innerHTML = `<img src="${m.url}" style="width:100%;border-radius:8px;border:1px solid var(--border);display:block" />
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><span class="sub" style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(m.name || '结果图')}</span>
          ${wb.canEdit ? '<button class="btn ghost sm danger" id="ed-res-del">删除</button>' : ''}</div>`;
        const del = $v('#ed-res-del');
        if (del) del.onclick = async () => {
          await api(`/api/tasks/${wb.task.id}/attachments/${m.id}`, { method: 'DELETE' });
          wb.media = (wb.media || []).filter((x) => x.id !== m.id);
          renderResult();
          toast('结果图已删除', 'ok');
        };
      } else {
        box.innerHTML = `<div class="empty" style="padding:20px 0"><b>尚未挂载结果图</b>
          <div class="hint" style="margin-top:6px;line-height:1.7">提交前必须上传编辑后的结果图，用于双图对照质检。</div>
          ${wb.canEdit ? '<button class="btn sm" id="ed-res-empty" style="margin-top:10px">上传结果图</button>' : ''}</div>`;
        const empty = $v('#ed-res-empty');
        if (empty) empty.onclick = () => $v('#ed-res-file').click();
      }
    };
    if (wb.canEdit) {
      const input = $v('#ed-res-file');
      $v('#ed-res-up').onclick = () => input.click();
      input.onchange = async () => {
        const f = input.files[0]; if (!f) return;
        const fd = new FormData();
        fd.append('file', f);
        fd.append('role', 'result');
        try {
          const r = await api(`/api/tasks/${wb.task.id}/attachments`, { method: 'POST', body: fd });
          (wb.media || (wb.media = [])).push({ id: r.id, name: r.name, kind: r.kind, url: r.url, meta: { role: 'result' } });
          input.value = '';
          renderResult();
          toast('结果图已挂载', 'ok');
        } catch (err) { toast(err.message, 'err'); }
      };
    }
    renderResult();

    if (!wb.canEdit) {
      $$v('.side-panel input, .side-panel select, .side-panel textarea').forEach((x) => { x.disabled = true; });
      ['#wb-save', '#wb-submit', '#ed-clear'].forEach((s) => { const b = $v(s); if (b) b.disabled = true; });
      const ind = $v('#save-ind');
      if (ind) ind.textContent = '只读查看（当前用户无标注权限）';
    }

    const layout = () => {
      const img = $v('#work-img');
      const stage = $v('#ed-stage');
      const cv = $v('#box-canvas');
      if (!img || !stage || !cv || !img.naturalWidth) return;
      const rect = stage.getBoundingClientRect();
      const pad = 14;
      const bw = Math.max(40, rect.width - pad * 2);
      const bh = Math.max(40, rect.height - pad * 2);
      const nw = img.naturalWidth, nh = img.naturalHeight;
      let w = bw, h = w * nh / nw;
      if (h > bh) { h = bh; w = h * nw / nh; }
      const left = (rect.width - w) / 2;
      const top = (rect.height - h) / 2;
      Object.assign(img.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      Object.assign(cv.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
      wb.stageW = w; wb.stageH = h; wb.imgW = nw; wb.imgH = nh;
      redraw();
      const st = $v('#ed-status');
      if (st) st.textContent = `${nw}×${nh} · 缩放 ${(w / nw * 100).toFixed(0)}% · ${wb.boxes.length} 个同类目标`;
    };

    const redraw = () => {
      const cv = $v('#box-canvas');
      if (!cv || !wb.stageW) return;
      const ctx = cv.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, wb.stageW, wb.stageH);
      const paint = (b, color, fill, label, dashed) => {
        const x = b.x * wb.stageW, y = b.y * wb.stageH, w = b.w * wb.stageW, h = b.h * wb.stageH;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (dashed) ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (label) {
          ctx.font = '11px ui-monospace, Menlo, monospace';
          const tw = ctx.measureText(label).width + 10;
          const ly = y > 16 ? y - 16 : y + 2;
          ctx.fillStyle = color;
          ctx.fillRect(x, ly, tw, 14);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, x + 5, ly + 10.5);
        }
        ctx.restore();
      };
      wb.boxes.forEach((b, i) => {
        paint(b, b.target ? '#EF4444' : '#3B82F6', b.target ? 'rgba(239,68,68,.12)' : 'rgba(59,130,246,.08)',
          b.target ? `目标${b.name ? ' · ' + b.name : ''}` : `同类目标 ${i + 1}`, false);
      });
      if (wb.edDrag && wb.edDrag.w > 0.002 && wb.edDrag.h > 0.002) {
        paint(wb.edDrag, '#22D3EE', 'rgba(34,211,238,.08)', '', true);
      }
    };

    const syncCount = () => {
      edit.same_target_count = wb.boxes.length;
      const c = $v('#ed-count');
      if (c) c.value = wb.boxes.length;
      const sub = $v('#ed-box-sub');
      if (sub) sub.textContent = `${wb.boxes.length} 个`;
    };

    const renderBoxes = () => {
      const list = $v('#ed-box-list');
      if (!list) return;
      list.innerHTML = wb.boxes.length ? wb.boxes.map((b, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid rgba(30,42,63,.45);font-size:11.5px">
          <span class="box-idx"><i class="bdot" style="background:${b.target ? '#EF4444' : '#3B82F6'}"></i>#${String(i + 1).padStart(2, '0')}</span>
          <input class="input" data-ed-name="${i}" value="${esc(b.name || '')}" placeholder="目标名称（可选）" style="flex:1;height:26px;font-size:11px" />
          <span class="box-pos">${(b.x * 100).toFixed(1)}, ${(b.y * 100).toFixed(1)}</span>
          <span class="box-size">${(b.w * 100).toFixed(1)}×${(b.h * 100).toFixed(1)}</span>
          <label class="toggle-wrap"><input type="radio" name="ed-target" data-ed-target="${i}" ${b.target ? 'checked' : ''} /><span>目标</span></label>
          <button class="box-del" data-ed-del="${i}" title="删除">×</button>
        </div>`).join('') : '<div class="empty"><b>还没有框选同类目标</b>在左侧原图拖拽画框，至少 3 个同类目标。</div>';
      $$v('[data-ed-target]').forEach((r) => {
        r.onchange = () => {
          wb.boxes.forEach((b, i) => { b.target = String(i) === String(r.dataset.edTarget); });
          renderBoxes(); redraw(); markDirty(wb);
        };
      });
      $$v('[data-ed-del]').forEach((b) => {
        b.onclick = () => {
          const i = Number(b.dataset.edDel);
          const wasTarget = wb.boxes[i].target;
          wb.boxes.splice(i, 1);
          if (wasTarget && wb.boxes.length) wb.boxes[0].target = true;
          renderBoxes(); redraw(); markDirty(wb);
        };
      });
      $$v('[data-ed-name]').forEach((inp) => {
        inp.oninput = () => { wb.boxes[Number(inp.dataset.edName)].name = inp.value; markDirty(wb); redraw(); };
      });
      syncCount();
    };

    const cv = $v('#box-canvas');
    const pointOf = (ev) => {
      const r = cv.getBoundingClientRect();
      return { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
    };
    if (cv) {
      cv.onmousedown = (ev) => {
        if (!wb.canEdit) return;
        const p = pointOf(ev);
        wb.edDrag = { x: p.x, y: p.y, w: 0, h: 0, sx: p.x, sy: p.y };
      };
      cv.onmousemove = (ev) => {
        if (!wb.edDrag) return;
        const p = pointOf(ev);
        const s = wb.edDrag;
        wb.edDrag = { x: Math.min(s.sx, p.x), y: Math.min(s.sy, p.y), w: Math.abs(p.x - s.sx), h: Math.abs(p.y - s.sy), sx: s.sx, sy: s.sy };
        redraw();
      };
      cv.onmouseup = () => {
        const d = wb.edDrag;
        wb.edDrag = null;
        if (!d || d.w < 0.005 || d.h < 0.005) { redraw(); return; }
        wb.boxes.push({ cls: '同类目标', name: '', source: 'manual', target: wb.boxes.length === 0,
          x: +d.x.toFixed(6), y: +d.y.toFixed(6), w: +d.w.toFixed(6), h: +d.h.toFixed(6) });
        renderBoxes(); redraw(); markDirty(wb);
      };
      cv.onmouseleave = () => { if (wb.edDrag) { wb.edDrag = null; redraw(); } };
    }
    const clear = $v('#ed-clear');
    if (clear) clear.onclick = () => {
      if (!wb.boxes.length) return;
      if (!confirm('确认清空全部标注框？')) return;
      wb.boxes = [];
      renderBoxes(); redraw(); markDirty(wb);
    };

    const img = $v('#work-img');
    if (img) {
      img.onload = () => layout();
      img.onerror = () => {
        const st = $v('#ed-status');
        if (st) st.textContent = '原图加载失败，请检查任务媒体文件';
      };
      if (img.complete && img.naturalWidth) layout();
    }
    renderBoxes();
    redraw();
    /* 窗口尺寸变化后重新适配画布，避免框选位置与图片错位 */
    const onResize = () => {
      if (!$v('#ed-stage')) { window.removeEventListener('resize', onResize); return; }
      layout();
    };
    window.addEventListener('resize', onResize);

    const syncAttr = () => {
      const wrap = $v('#ed-attr-wrap');
      if (wrap) wrap.style.display = edit.edit_type === 'attribute' ? '' : 'none';
    };
    $v('#ed-edit-type').onchange = (ev) => {
      edit.edit_type = ev.target.value;
      if (edit.edit_type !== 'attribute') {
        edit.attribute_dim = [];
        edit.attribute_value = '';
        const av = $v('#ed-attr-value');
        if (av) av.value = '';
        $$v('[data-ed-dim]').forEach((cb) => { cb.checked = false; cb.closest('.fchip').classList.remove('on'); });
      }
      syncAttr(); markDirty(wb);
    };
    $$v('[data-ed-dim]').forEach((cb) => {
      cb.onchange = () => {
        edit.attribute_dim = $$v('[data-ed-dim]').filter((x) => x.checked).map((x) => x.dataset.edDim);
        cb.closest('.fchip').classList.toggle('on', cb.checked);
        markDirty(wb);
      };
    });
    ['ed-attr-value:attribute_value', 'ed-target-name:target_name', 'ed-locator:target_locator', 'ed-note:result_note', 'ed-instruction:instruction'].forEach((pair) => {
      const [sel, key] = pair.split(':');
      const el = $v(`#${sel}`);
      if (!el) return;
      el.oninput = () => {
        edit[key] = el.value;
        if (key === 'instruction') {
          const n = $v('#ed-ins-count');
          if (n) n.textContent = String(el.value.length);
        }
        markDirty(wb);
      };
    });
    $v('#ed-target-cat').onchange = (ev) => { edit.target_category = ev.target.value; markDirty(wb); };
    $v('#ed-shadow').onchange = (ev) => { edit.shadow_adjusted = ev.target.checked; markDirty(wb); };

    const renderIssues = (issues) => {
      const box = $v('#ed-issues');
      if (!box) return;
      if (!issues || !issues.length) {
        box.innerHTML = '<span class="chip done">规范校验通过，可提交质检</span>';
        return;
      }
      box.innerHTML = issues.map((i) => `<div style="display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(30,42,63,.45);font-size:11.5px">
        <span class="chip ${i.level === 'error' ? 'danger' : 'pending'}" style="flex:none">${i.level === 'error' ? '需修正' : '提示'}</span>
        <span>${esc(i.message)}</span></div>`).join('');
    };
    const validateNow = async () => {
      const r = await api(`/api/tasks/${wb.task.id}/editing/validate`, { method: 'POST', body: { payload: wb.customPayload() } });
      renderIssues(r.issues);
      return r;
    };
    $v('#ed-check').onclick = async () => {
      try {
        const r = await validateNow();
        toast(r.ok ? '校验通过' : '存在需修正项', r.ok ? 'ok' : 'warn');
      } catch (err) { toast(err.message, 'err'); }
    };
    $v('#wb-submit').onclick = async () => {
      if (!wb.canEdit) return;
      try {
        const r = await validateNow();
        if (!r.ok) {
          const first = r.issues.find((i) => i.level === 'error');
          toast(first ? first.message : '校验未通过，无法提交', 'err');
          return;
        }
        if (!confirm('规范校验通过，确认提交质检？')) return;
        await api(`/api/tasks/${wb.task.id}/submit`, { method: 'POST', body: { payload: wb.customPayload() } });
        toast('已提交质检', 'ok');
        location.hash = '#/tasks';
      } catch (err) { toast(err.message, 'err'); }
    };
    syncAttr();
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
    // 打开即视为已读：角标即时清零，无需手动刷新
    if (data.unread > 0) {
      api('/api/notifications/read-all', { method: 'POST', body: {} }).then(() => {
        const dot = document.getElementById('notif-dot');
        if (dot) dot.style.display = 'none';
      }).catch(() => {});
    }
    openModal(`<div class="card-head"><h3 class="card-title">通知中心</h3><button class="btn ghost" style="margin-left:auto" onclick="closeModal()">关闭</button></div>
      <div class="card-body">
        <div class="filters"><span class="hint">${data.unread > 0 ? `打开时已标记 ${data.unread} 条为已读` : '没有未读通知'}</span></div>
        ${data.notifications.map((n) => `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(30,42,63,.5);opacity:${n.read_at ? '.6' : '1'}">
          <span class="chip ${n.kind === 'rework' ? 'danger' : n.kind === 'qc' ? 'done' : 'pending'}">${esc(n.kind)}</span>
          <div><b style="font-size:12.5px">${esc(n.title)}</b><div class="sub">${esc(n.body || '')} · ${time(n.created_at)}</div></div>
          ${n.link ? `<a class="btn ghost" href="${esc(n.link)}" style="margin-left:auto" onclick="closeModal()">查看</a>` : ''}
        </div>`).join('') || '<div class="empty">暂无通知</div>'}
      </div>`);
  }

  /* ------------------------------------------------------------------ 运营服务 */
  async function pageService(query) {
    const st = window.CK_STATE || {};
    let projList = st.projects || [];
    if (!projList.length) {
      try { projList = (await api('/api/projects')).projects || []; } catch (e) { projList = []; }
    }
    const tab = query.get('tab') || 'report';
    const pid = Number(query.get('project_id') || st.pid || (projList[0] && projList[0].id) || 0);
    const month = query.get('month') || new Date().toISOString().slice(0, 7);
    const base = location.hash.split('?')[0];
    const go = (extra = {}) => {
      const q = new URLSearchParams({ tab, project_id: String(pid), month, ...extra });
      location.hash = `${base}?${q.toString()}`;
    };
    const kpi = (label, value, sub = '') => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-delta">${sub}</div></div>`;
    const projBar = `<select class="select" id="svc-proj" style="width:200px">${projList.map((p) => `<option value="${p.id}" ${Number(p.id) === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="0">暂无项目</option>'}</select>`;
    const tabNav = tabs([['report', '运营月报'], ['tickets', '服务工单'], ['agreements', '保密协议'], ['training', '培训考核']], tab);
    const ticketChip = (s) => chip(TICKET_LABEL[s] || s, s === 'resolved' || s === 'closed' ? 'done' : s === 'processing' ? 'reviewing' : 'pending');

    if (!pid) {
      mountPage('service', `${head('运营服务', '运营月报、服务工单、保密协议与培训考核', '')}<div class="empty">请先创建项目并选择项目后查看运营服务</div>`, '运营服务');
      return;
    }

    let body = '';
    if (tab === 'report') {
      const r = await api(`/api/service/report?project_id=${pid}&month=${encodeURIComponent(month)}`);
      const k = r.kpis;
      body = `
        <div class="filters" style="margin-bottom:14px">
          <input class="input" type="month" id="svc-month" value="${esc(month)}" style="width:170px" />
          <button class="btn" id="svc-month-go">查询</button>
          <a class="btn primary" href="/api/service/report.csv?project_id=${pid}&month=${encodeURIComponent(month)}">导出运营月报 CSV</a>
        </div>
        <div class="grid kpi-grid">
          ${kpi('新增任务', k.task_total, '条')}
          ${kpi('完成任务', k.task_done, '条')}
          ${kpi('质检通过率', `${k.qc_pass_rate}%`, `质检 ${k.qc_total} 条`)}
          ${kpi('返修率', `${k.rework_rate}%`, `平均 ${k.avg_score} 分`)}
          ${kpi('SLA 按时率', `${k.ticket_sla_rate}%`, `工单 ${k.ticket_total} / 解决 ${k.ticket_resolved}`)}
          ${kpi('保密协议覆盖率', `${k.agreement_rate}%`, `已签 ${k.agreement_signed} / ${k.member_total} 人`)}
          ${kpi('培训完成率', `${k.training_rate}%`, `完成 ${k.training_done} / ${k.training_total}`)}
        </div>
        <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">人员产能</h3><span class="card-sub">${esc(r.month)} · 按提交任务数</span></div>
          ${table(['姓名', '账号', '提交任务数'], r.production.map((x) => [esc(x.name), esc(x.username), x.tasks]), '本月暂无提交记录')}
        </div>
        <div class="hint" style="margin-top:10px">报告生成时间：${esc(r.generated_at)}</div>`;
    } else if (tab === 'tickets') {
      const d = await api(`/api/service/tickets?project_id=${pid}`);
      const s = d.summary;
      body = `
        <div class="grid kpi-grid" style="margin-bottom:14px">
          ${kpi('工单总数', s.total, '单')}
          ${kpi('待处理', s.open, '单')}
          ${kpi('SLA 按时率', `${s.sla_rate}%`, '已解决工单')}
        </div>
        <div class="card"><div class="card-head"><h3 class="card-title">服务工单</h3><button class="btn primary" id="svc-ticket-add" style="margin-left:auto">新建工单</button></div>
          ${table(['标题', '类别', '优先级', '状态', 'SLA', '负责人', '创建时间', '操作'], d.tickets.map((t) => [
            esc(t.title),
            esc(t.category_label),
            esc(t.priority_label),
            ticketChip(t.status),
            `${t.sla_hours}h${t.sla_met === true ? ' · 达标' : t.sla_met === false ? ' · 超时' : ''}`,
            esc(t.assignee_name || t.requester_name || '-'),
            time(t.created_at),
            t.status === 'open' ? `<button class="btn ghost sm" data-tk-start="${t.id}">开始处理</button>`
              : t.status === 'processing' ? `<button class="btn ghost sm" data-tk-done="${t.id}">解决</button>`
              : `<span class="sub">${esc(t.resolution || '已闭环')}</span>`,
          ]), '暂无服务工单')}
        </div>`;
    } else if (tab === 'agreements') {
      const d = await api(`/api/service/agreements?project_id=${pid}`);
      let memberOpts = '';
      try {
        const ms = (await api(`/api/projects/${pid}/members`)).members || [];
        memberOpts = ms.map((m) => `<option value="${m.id}">${esc(m.name)}（${esc(m.username)}）</option>`).join('');
      } catch (e) { /* 保持空选项 */ }
      const s = d.summary;
      body = `
        <div class="grid kpi-grid" style="margin-bottom:14px">
          ${kpi('项目成员', s.member_total, '人')}
          ${kpi('已签协议', s.signed, '人')}
          ${kpi('覆盖率', `${s.coverage}%`, '有效协议 / 成员')}
          ${kpi('30 天内到期', s.expiring, '份')}
          ${kpi('已过期', s.expired, '份')}
        </div>
        <div class="card"><div class="card-head"><h3 class="card-title">保密协议台账</h3><button class="btn primary" id="svc-ag-add" style="margin-left:auto">登记签署</button></div>
          ${table(['姓名', '账号', '协议编号', '签署日期', '到期日期', '状态', '操作'], d.agreements.map((a) => [
            esc(a.user_name),
            esc(a.username),
            esc(a.agreement_no || '-'),
            esc(a.signed_at || '-'),
            esc(a.expires_at || '-'),
            chip(AGREEMENT_LABEL[a.status] || a.status, a.status === 'active' ? 'done' : a.status === 'expired' ? 'danger' : 'plain'),
            a.status === 'active' ? `<button class="btn ghost sm" data-ag-renew="${a.id}">续签一年</button><button class="btn ghost sm danger" data-ag-revoke="${a.id}">撤销</button>` : '<span class="sub">-</span>',
          ]), '暂无协议记录')}
        </div>
        <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">成员签署状态</h3></div>
          ${table(['姓名', '账号', '项目角色', '状态'], d.members.map((m) => [
            esc(m.name), esc(m.username), esc(m.project_role || '-'), m.signed ? chip('已签署', 'done') : chip('未签署', 'danger'),
          ]), '暂无成员')}
        </div>`;
    } else {
      const d = await api('/api/service/training');
      const s = d.summary;
      body = `
        <div class="grid kpi-grid" style="margin-bottom:14px">
          ${kpi('培训记录', s.total, '条')}
          ${kpi('已完成', s.completed, '条')}
          ${kpi('完成率', `${s.rate}%`, '')}
          ${kpi('课程数', d.courses.length, '门')}
        </div>
        <div class="card"><div class="card-head"><h3 class="card-title">培训课程</h3>
          <button class="btn primary" id="svc-course-add" style="margin-left:auto">新建课程</button></div>
          ${table(['课程', '适用模态', '时长', '参训', '完成', '完成率'], d.courses.map((c) => [
            esc(c.title), esc(c.modality_label), `${c.duration_min} 分钟`, c.assigned, c.completed, bar(c.rate),
          ]), '暂无培训课程')}
        </div>
        <div class="card" style="margin-top:14px"><div class="card-head"><h3 class="card-title">培训与考核记录</h3>
          <button class="btn" id="svc-train-add" style="margin-left:auto">登记培训</button></div>
          ${table(['学员', '课程', '状态', '成绩', '完成时间', '操作'], d.records.map((r) => [
            esc(r.user_name), esc(r.course_title), chip(r.status_label, r.status === 'completed' ? 'done' : 'pending'),
            r.score ? `${r.score} 分` : '-', time(r.completed_at), r.status === 'completed' ? '<span class="sub">-</span>' : `<button class="btn ghost sm" data-tr-done="${r.id}">标记完成</button>`,
          ]), '暂无培训记录')}
        </div>`;
    }

    mountPage('service', `${head('运营服务', '运营月报、服务工单与 SLA、保密协议台账、培训考核记录',
      `${projBar}<span style="width:8px"></span>${tabNav}`)}<div id="svc-body">${body}</div>`, '运营服务');

    const sel = $v('#svc-proj');
    if (sel) sel.onchange = () => go({ project_id: sel.value, tab });
    const tabBtns = $$v('[data-tab]');
    tabBtns.forEach((b) => { b.onclick = () => go({ tab: b.getAttribute('data-tab') }); });
    const mg = $v('#svc-month-go');
    if (mg) mg.onclick = () => go({ month: $v('#svc-month').value || month });

    const reload = () => pageService(query);
    if (tab === 'report') return;

    if (tab === 'tickets') {
      const add = $v('#svc-ticket-add');
      if (add) add.onclick = () => {
        serviceForm('新建服务工单', `
          <div class="field"><label>标题</label><input class="input" id="tk-title" placeholder="例如：批次数据导入失败" /></div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>类别</label><select class="select" id="tk-cat">${Object.entries(TICKET_LABEL_CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
            <div class="field"><label>优先级</label><select class="select" id="tk-pri">${Object.entries(TICKET_LABEL_PRI).map(([k, v]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>响应时限（小时）</label><input class="input" id="tk-sla" type="number" min="1" value="24" /></div>
          <div class="field"><label>问题描述</label><textarea class="input" id="tk-detail" rows="3"></textarea></div>`, async () => {
          await api('/api/service/tickets', { method: 'POST', body: {
            project_id: pid, title: $v('#tk-title').value.trim(), category: $v('#tk-cat').value,
            priority: $v('#tk-pri').value, sla_hours: Number($v('#tk-sla').value) || 24, detail: $v('#tk-detail').value,
          } });
          toast('工单已创建', 'ok'); reload();
        });
      };
      $$v('[data-tk-start]').forEach((b) => { b.onclick = async () => {
        try { await api(`/api/service/tickets/${b.getAttribute('data-tk-start')}`, { method: 'PATCH', body: { status: 'processing' } }); toast('已开始处理', 'ok'); reload(); }
        catch (e) { toast(e.message, 'err'); }
      }; });
      $$v('[data-tk-done]').forEach((b) => { b.onclick = () => {
        const id = b.getAttribute('data-tk-done');
        serviceForm('解决工单', `<div class="field"><label>处理结论</label><textarea class="input" id="tk-res" rows="3" placeholder="填写处理过程与结果"></textarea></div>`, async () => {
          await api(`/api/service/tickets/${id}`, { method: 'PATCH', body: { status: 'resolved', resolution: $v('#tk-res').value.trim() } });
          toast('工单已解决', 'ok'); reload();
        });
      }; });
    }

    if (tab === 'agreements') {
      const add = $v('#svc-ag-add');
      if (add) add.onclick = () => {
        serviceForm('登记保密协议', `
          <div class="field"><label>签署人</label><select class="select" id="ag-user">${memberOpts || '<option value="">暂无可选成员</option>'}</select></div>
          <div class="field"><label>协议编号</label><input class="input" id="ag-no" placeholder="可选，例如 CK-NDA-2026-001" /></div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>签署日期</label><input class="input" type="date" id="ag-signed" value="${new Date().toISOString().slice(0, 10)}" /></div>
            <div class="field"><label>到期日期</label><input class="input" type="date" id="ag-expires" value="${new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)}" /></div>
          </div>
          <div class="field"><label>备注</label><input class="input" id="ag-note" /></div>`, async () => {
          const uid = Number($v('#ag-user').value);
          if (!uid) throw new Error('请选择签署人');
          await api('/api/service/agreements', { method: 'POST', body: {
            project_id: pid, user_id: uid, agreement_no: $v('#ag-no').value.trim(),
            signed_at: $v('#ag-signed').value, expires_at: $v('#ag-expires').value, note: $v('#ag-note').value.trim(),
          } });
          toast('协议已登记', 'ok'); reload();
        });
      };
      $$v('[data-ag-renew]').forEach((b) => { b.onclick = async () => {
        try {
          await api(`/api/service/agreements/${b.getAttribute('data-ag-renew')}`, { method: 'PATCH', body: {
            status: 'active', expires_at: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
          } });
          toast('已续签一年', 'ok'); reload();
        } catch (e) { toast(e.message, 'err'); }
      }; });
      $$v('[data-ag-revoke]').forEach((b) => { b.onclick = async () => {
        if (!(await confirmModal('撤销协议', '确认撤销该保密协议？撤销后成员将变为未签署状态。', '撤销', true))) return;
        try { await api(`/api/service/agreements/${b.getAttribute('data-ag-revoke')}`, { method: 'PATCH', body: { status: 'revoked' } }); toast('协议已撤销', 'ok'); reload(); }
        catch (e) { toast(e.message, 'err'); }
      }; });
    }

    if (tab === 'training') {
      let memberOpts = '';
      try {
        const ms = (await api(`/api/projects/${pid}/members`)).members || [];
        memberOpts = ms.map((m) => `<option value="${m.id}">${esc(m.name)}（${esc(m.username)}）</option>`).join('');
      } catch (e) { /* ignore */ }
      const courses = (await api('/api/service/training')).courses || [];
      const courseOpts = courses.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join('');
      const addCourse = $v('#svc-course-add');
      if (addCourse) addCourse.onclick = () => {
        serviceForm('新建培训课程', `
          <div class="field"><label>课程名称</label><input class="input" id="tc-title" placeholder="例如：图像编辑指令标注规范" /></div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>适用模态</label><select class="select" id="tc-mod"><option value="">通用</option>
              <option value="audio">语音</option><option value="image">图片</option><option value="video">视频</option>
              <option value="pointcloud">3D 点云</option><option value="editing">图像编辑指令</option></select></div>
            <div class="field"><label>时长（分钟）</label><input class="input" type="number" min="0" id="tc-dur" value="60" /></div>
          </div>
          <div class="field"><label>课程说明</label><textarea class="input" id="tc-desc" rows="3"></textarea></div>`, async () => {
          await api('/api/service/training/courses', { method: 'POST', body: {
            title: $v('#tc-title').value.trim(), modality: $v('#tc-mod').value,
            duration_min: Number($v('#tc-dur').value) || 0, description: $v('#tc-desc').value.trim(),
          } });
          toast('课程已创建', 'ok'); reload();
        });
      };
      const addTrain = $v('#svc-train-add');
      if (addTrain) addTrain.onclick = () => {
        serviceForm('登记培训记录', `
          <div class="field"><label>课程</label><select class="select" id="tr-course">${courseOpts || '<option value="">请先创建课程</option>'}</select></div>
          <div class="field"><label>学员</label><select class="select" id="tr-user">${memberOpts || '<option value="">暂无可选成员</option>'}</select></div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>状态</label><select class="select" id="tr-status"><option value="assigned">待完成</option><option value="completed">已完成</option></select></div>
            <div class="field"><label>考核成绩</label><input class="input" type="number" min="0" max="100" id="tr-score" value="0" /></div>
          </div>`, async () => {
          const cid = Number($v('#tr-course').value);
          const uid = Number($v('#tr-user').value);
          if (!cid) throw new Error('请先创建课程');
          if (!uid) throw new Error('请选择学员');
          await api('/api/service/training/records', { method: 'POST', body: {
            course_id: cid, user_id: uid, status: $v('#tr-status').value, score: Number($v('#tr-score').value) || 0,
          } });
          toast('培训记录已登记', 'ok'); reload();
        });
      };
      $$v('[data-tr-done]').forEach((b) => { b.onclick = () => {
        const id = b.getAttribute('data-tr-done');
        serviceForm('标记培训完成', `<div class="field"><label>考核成绩</label><input class="input" type="number" min="0" max="100" id="tr-done-score" value="90" /></div>`, async () => {
          await api(`/api/service/training/records/${id}`, { method: 'PATCH', body: { status: 'completed', score: Number($v('#tr-done-score').value) || 0 } });
          toast('已标记完成', 'ok'); reload();
        });
      }; });
    }
  }

  const TICKET_LABEL = { open: '待响应', processing: '处理中', resolved: '已解决', closed: '已关闭' };
  const TICKET_LABEL_CAT = { data: '数据问题', system: '系统故障', training: '培训支持', other: '其他' };
  const TICKET_LABEL_PRI = { low: '低', normal: '普通', high: '高', urgent: '紧急' };
  const AGREEMENT_LABEL = { active: '有效', expired: '已过期', revoked: '已撤销' };

  function serviceForm(title, bodyHtml, onSubmit) {
    openModal(`<div class="modal-head"><h3>${esc(title)}</h3><button class="x" data-close>×</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot"><button class="btn ghost" data-close>取消</button><button class="btn primary" id="svc-form-ok">确定</button></div>`, 'sm');
    $v('#svc-form-ok').onclick = async () => {
      try { await onSubmit(); closeModal(); } catch (e) { toast(e.message, 'err'); }
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
    ['service', '运营服务', 'shield', 'member.read'],
    ['help', '帮助中心', 'search', ''],
    ['preferences', '个人偏好', 'members', ''],
  ];
  window.CK_PAGES = {
    hall: pageHall, jobs: pageJobs, components: pageComponents, operators: pageOperators,
    quality: pageQuality, issues: pageIssues, ops: pageOps, help: pageHelp, preferences: pagePreferences,
    governance: pageGovernance, service: pageService,
  };
  window.CK_WORKBENCH = WB;
  window.CK_AFTER_MOUNT = annotateExtras;
  window.CK_OPEN_NOTIFICATIONS = openNotifications;
})();
