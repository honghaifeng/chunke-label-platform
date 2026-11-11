(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var ok = style.getPropertyValue('--ok').trim();
  var part = style.getPropertyValue('--part').trim();
  var no = style.getPropertyValue('--no').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();

  var cat = echarts.init(document.getElementById('chart-cat'), null, { renderer: 'svg' });
  cat.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: muted, fontSize: 11 } },
    grid: { left: 8, right: 20, top: 12, bottom: 40, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, fontSize: 11 } },
    yAxis: { type: 'category', data: ["组织与权限管理", "数据管理", "项目、任务与工作流", "模板与标注工具", "智能标注与算子", "开放接口与系统集成", "安全与运维"], axisLine: { lineStyle: { color: rule } }, axisTick: { show: false }, axisLabel: { color: ink, fontSize: 11 } },
    series: [
      { name: '满足', type: 'bar', stack: 't', data: [5, 9, 11, 12, 15, 6, 12], itemStyle: { color: ok }, barWidth: 16 },
      { name: '部分满足', type: 'bar', stack: 't', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: part } },
      { name: '不满足', type: 'bar', stack: 't', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: no } }
    ]
  });

  var key = echarts.init(document.getElementById('chart-key'), null, { renderer: 'svg' });
  key.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}：{c} 项（{d}%）' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: muted, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['46%', '70%'], center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { color: ink, fontSize: 11, formatter: '{b}\n{c} 项' },
      data: [
        { value: 40, name: '满足', itemStyle: { color: ok } },
        { value: 0, name: '部分满足', itemStyle: { color: part } },
        { value: 0, name: '不满足', itemStyle: { color: no } }
      ]
    }]
  });

  window.addEventListener('resize', function () { cat.resize(); key.resize(); });
})();
