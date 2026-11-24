(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // ---------- Mermaid ----------
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        fontFamily: "'Outfit', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fontSize: '13px',
        primaryColor: '#eef2f8',
        primaryTextColor: ink,
        primaryBorderColor: accent,
        lineColor: muted,
        secondaryColor: '#e9f5f2',
        tertiaryColor: '#ffffff',
        clusterBkg: '#ffffff',
        edgeLabelBackground: '#ffffff'
      },
      flowchart: { curve: 'basis', nodeSpacing: 34, rankSpacing: 46, padding: 10, useMaxWidth: true }
    });
  }

  // ---------- Chart: routes by workspace ----------
  var routeEl = document.getElementById('chart-routes');
  if (routeEl && window.echarts) {
    var routeChart = echarts.init(routeEl, null, { renderer: 'svg' });
    var routeData = [
      { name: 'vendor 供应商', value: 99 },
      { name: 'platform 平台', value: 74 },
      { name: 'acceptance 验收', value: 23 },
      { name: 'temporary-resources 资源', value: 22 },
      { name: 'client 客户', value: 19 },
      { name: 'org 组织', value: 13 },
      { name: 'operator 运营', value: 6 },
      { name: '其他/公共页', value: 20 }
    ];
    routeChart.setOption({
      animation: false,
      grid: { left: 8, right: 46, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } },
        axisLine: { show: false }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: routeData.map(function (d) { return d.name; }),
        axisLabel: { color: ink, fontSize: 12 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'bar',
        data: routeData.map(function (d, i) {
          return {
            value: d.value,
            itemStyle: { color: i === 0 ? accent : (i === 1 ? accent2 : accent + '99'), borderRadius: [0, 3, 3, 0] }
          };
        }),
        barWidth: 16,
        label: { show: true, position: 'right', color: muted, fontSize: 11, formatter: '{c}' }
      }]
    });
    window.addEventListener('resize', function () { routeChart.resize(); });
  }

  // ---------- Chart: lazy chunks by family ----------
  var chunkEl = document.getElementById('chart-chunks');
  if (chunkEl && window.echarts) {
    var chunkChart = echarts.init(chunkEl, null, { renderer: 'svg' });
    var chunkData = [
      { name: 'Vendor 生产', value: 49 },
      { name: 'Client 客户', value: 19 },
      { name: 'Platform 平台', value: 10 },
      { name: 'Exam 考试', value: 7 },
      { name: 'Acceptance 验收', value: 6 },
      { name: 'LongAudio 长音频', value: 6 },
      { name: 'Script 剧本', value: 5 },
      { name: 'Stat 统计图表', value: 5 },
      { name: 'Data 数据池', value: 4 },
      { name: 'Notification 通知', value: 4 },
      { name: 'Org 组织', value: 4 },
      { name: 'Quality 质检', value: 3 },
      { name: 'Settlement 结算', value: 3 },
      { name: 'Temporary 资源', value: 3 },
      { name: '其他基础/零散', value: 190 }
    ];
    chunkChart.setOption({
      animation: false,
      grid: { left: 8, right: 46, top: 12, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } },
        axisLine: { show: false }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: chunkData.map(function (d) { return d.name; }),
        axisLabel: { color: ink, fontSize: 12 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [{
        type: 'bar',
        data: chunkData.map(function (d, i) {
          return {
            value: d.value,
            itemStyle: { color: i === 0 ? accent : (i < 8 ? accent2 + 'bb' : muted + '66'), borderRadius: [0, 3, 3, 0] }
          };
        }),
        barWidth: 14,
        label: { show: true, position: 'right', color: muted, fontSize: 11, formatter: '{c}' }
      }]
    });
    window.addEventListener('resize', function () { chunkChart.resize(); });
  }
})();
