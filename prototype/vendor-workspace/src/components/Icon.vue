<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number | string; color?: string }>(), {
  size: 14
})

const icons: Record<string, string> = {
  list: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.2"/><path d="M5.2 5.6h5.6M5.2 8h5.6M5.2 10.4h3.4"/>',
  clock: '<circle cx="8" cy="8" r="5.6"/><path d="M8 4.8V8l2.3 1.4"/>',
  bars: '<path d="M3 13V8.6M6.7 13V4.4M10.4 13V7M14 13V3.6"/>',
  userChart: '<circle cx="4.6" cy="5.2" r="2"/><path d="M1.6 12.8c.4-2.1 1.6-3.2 3-3.2 1.5 0 2.7 1.1 3.1 3.2"/><path d="M10.4 13V9M13 13V6.6"/>',
  users: '<circle cx="5.4" cy="5.1" r="2.1"/><circle cx="10.7" cy="5.7" r="1.7"/><path d="M1.7 12.9c.4-2.2 1.8-3.3 3.7-3.3s3.3 1.1 3.7 3.3"/><path d="M9.4 9.8c1.7.1 2.8 1.2 3.1 3.1"/>',
  shield: '<path d="M8 2.2 12.8 4v3.7c0 2.9-2 5-4.8 5.9-2.8-.9-4.8-3-4.8-5.9V4z"/><path d="m6 7.8 1.4 1.4 2.6-2.6"/>',
  gear: '<path d="M6.7 2.3h2.6l.4 1.7 1.2.7 1.7-.5 1.3 2.2-1.2 1.3v1.4l1.2 1.3-1.3 2.2-1.7-.5-1.2.7-.4 1.7H6.7l-.4-1.7-1.2-.7-1.7.5-1.3-2.2 1.2-1.3V7.7L2.1 6.4l1.3-2.2 1.7.5 1.2-.7z"/><circle cx="8" cy="8" r="2.1"/>',
  tree: '<rect x="6" y="2.2" width="4" height="3" rx=".7"/><rect x="2" y="10.8" width="4" height="3" rx=".7"/><rect x="10" y="10.8" width="4" height="3" rx=".7"/><path d="M8 5.2v2.4M4 10.8V7.6h8v3.2"/>',
  grid: '<rect x="2.4" y="2.4" width="4.6" height="4.6" rx=".8"/><rect x="9" y="2.4" width="4.6" height="4.6" rx=".8"/><rect x="2.4" y="9" width="4.6" height="4.6" rx=".8"/><rect x="9" y="9" width="4.6" height="4.6" rx=".8"/>',
  userPlus: '<circle cx="5.9" cy="5.4" r="2.2"/><path d="M1.9 13c.4-2.3 1.9-3.5 4-3.5 1 0 1.9.3 2.6.9"/><path d="M12.4 9.2v4M10.4 11.2h4"/>',
  checkSquare: '<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.3"/><path d="m5.2 8.2 1.9 1.9 3.8-3.9"/>',
  sliders: '<path d="M2 4.6h12M2 11.4h12"/><circle cx="6" cy="4.6" r="1.6"/><circle cx="10.4" cy="11.4" r="1.6"/>',
  flag: '<path d="M4 14V2.4M4 3h8.6l-1.9 2.9 1.9 2.8H4"/>',
  user: '<circle cx="8" cy="5.2" r="2.4"/><path d="M2.8 13.5c.5-2.7 2.5-4 5.2-4s4.7 1.3 5.2 4"/>',
  tool: '<path d="m9.9 2.6 3.5 3.5-7.9 7.9-3.5-.1-.1-3.5z"/><path d="m8.5 4 3.5 3.5"/>',
  swap: '<path d="M2.4 5.6h9.2l-2-2M13.6 10.4H4.4l2 2"/>',
  close: '<path d="m3.6 3.6 8.8 8.8M12.4 3.6l-8.8 8.8"/>',
  search: '<circle cx="7" cy="7" r="4.3"/><path d="m10.3 10.3 3 3"/>',
  refresh: '<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13.2 2.8v2.6h-2.6"/>',
  config: '<path d="M2 4h5.4M10.8 4H14M2 12h4.4M8.8 12H14"/><circle cx="9" cy="4" r="1.5"/><circle cx="7" cy="12" r="1.5"/>',
  eye: '<path d="M1.8 8S4.2 3.8 8 3.8 14.2 8 14.2 8 11.8 12.2 8 12.2 1.8 8 1.8 8z"/><circle cx="8" cy="8" r="1.9"/>',
  enter: '<path d="M5.8 3.4H3.4v9.2h2.4"/><path d="M6.6 8h6.2M10.2 5.4 12.8 8l-2.6 2.6"/>',
  play: '<path d="M5.2 3.2 12.2 8l-7 4.8z" fill="currentColor" stroke="none"/>',
  cube: '<path d="M8 2.2 13.2 5v6L8 13.8 2.8 11V5z"/><path d="M2.8 5 8 7.8 13.2 5M8 7.8v6"/>',
  checkCircle: '<circle cx="8" cy="8" r="5.6"/><path d="m5.5 8.2 1.7 1.7 3.4-3.6"/>',
  hourglass: '<path d="M5 2.4h6M5 13.6h6M5.8 2.4v1.5c0 1.7 2.2 2.5 2.2 4.1s-2.2 2.4-2.2 4.1v1.5M10.2 2.4v1.5c0 1.7-2.2 2.5-2.2 4.1s2.2 2.4 2.2 4.1v1.5"/>',
  bell: '<path d="M8 2.4a3.8 3.8 0 0 0-3.8 3.8c0 3-1.2 4-1.2 4h10s-1.2-1-1.2-4A3.8 3.8 0 0 0 8 2.4z"/><path d="M6.8 12.6a1.3 1.3 0 0 0 2.4 0"/>',
  help: '<circle cx="8" cy="8" r="5.6"/><path d="M6.3 6.2a1.7 1.7 0 1 1 2.5 1.6c-.5.2-.8.6-.8 1.1v.3"/><path d="M8 11.3v.2"/>',
  chevronLeft: '<path d="M10 3.6 5.6 8 10 12.4"/>',
  chevronDown: '<path d="M3.6 6 8 10.4 12.4 6"/>',
  chevronUp: '<path d="M3.6 10 8 5.6 12.4 10"/>',
  home: '<path d="M2.4 7.4 8 2.8l5.6 4.6V13h-4v-3.2h-3.2V13h-4z"/>',
  copy: '<rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1"/><path d="M10.6 5.4v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"/>',
  folder: '<path d="M2 4.2h4l1.2 1.5H14v6.5H2z"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  plus: '<path d="M8 3.6v8.8M3.6 8h8.8"/>',
  mic: '<rect x="6" y="2.4" width="4" height="7" rx="2"/><path d="M4 7.6a4 4 0 0 0 8 0M8 11.6V14"/>',
  star: '<path d="m8 2.4 1.7 3.4 3.8.6-2.7 2.6.6 3.7L8 11l-3.4 1.7.6-3.7L2.5 6.4l3.8-.6z"/>',
  save: '<path d="M2.8 2.8h8l2.4 2.4v8H2.8z"/><path d="M5 2.8v3.6h5.2V2.8M5 13.2V9.4h6v3.8"/>',
  check: '<path d="m3.4 8.3 3 3 6.2-6.6"/>',
  calendar: '<rect x="2.4" y="3.6" width="11.2" height="10" rx="1"/><path d="M2.4 6.6h11.2M5.4 2.4v2.4M10.6 2.4v2.4"/>',
  bot: '<rect x="3.2" y="5.6" width="9.6" height="7" rx="2.2"/><circle cx="6.3" cy="9" r=".9" fill="currentColor" stroke="none"/><circle cx="9.7" cy="9" r=".9" fill="currentColor" stroke="none"/><path d="M8 5.6V3.4M6.6 12.6v1.2M9.4 12.6v1.2"/>',
  book: '<path d="M8 4.3C6.5 3.2 4.7 2.8 2.5 2.8v8.5c2.2 0 4 .4 5.5 1.5 1.5-1.1 3.3-1.5 5.5-1.5V2.8c-2.2 0-4 .4-5.5 1.5z"/><path d="M8 4.3v8.5"/>',
  mail: '<rect x="2.2" y="4.2" width="11.6" height="8" rx="1.2"/><path d="m2.7 5 5.3 4 5.3-4"/>',
  panelLeft: '<rect x="2.2" y="3" width="11.6" height="10" rx="1.4"/><path d="M6.2 3v10"/><path d="m10.4 6.6-1.4 1.4 1.4 1.4"/>',
  sparkle: '<path d="M6.6 2.4 7.5 5.2l2.8.9-2.8.9-.9 2.8-.9-2.8L2.9 6.1l2.8-.9z"/><path d="M12.4 9.4v2.4M11.2 10.6h2.4"/>',
  cornerUpLeft: '<path d="M6.2 3.4 2.8 6.8l3.4 3.4"/><path d="M2.8 6.8h5.4a4.4 4.4 0 0 1 4.4 4.4v1.4"/>',
  aiA: '<path d="M2.4 12.8 6 3.4l3.6 9.4"/><path d="M3.8 9.6h4.4"/><path d="M11.8 2.8l.4 1.3 1.3.4-1.3.4-.4 1.3-.4-1.3-1.3-.4 1.3-.4z"/>',
  download: '<path d="M8 2.6v7.2"/><path d="M5.2 7.4 8 10.2l2.8-2.8"/><path d="M3 12.6h10"/>',
  wave: '<path d="M2.4 8h1.7l1.2-3.2 1.9 6.4 1.3-3.2h2.1l1-2.2.9 2.2h1.1"/>',
  puzzle: '<path d="M6.2 2.6h1.3a1.3 1.3 0 1 1 2.6 0h1.4v1.4a1.3 1.3 0 1 1 0 2.6v1.4h-1.4a1.3 1.3 0 1 1-2.6 0H6.2V6.6a1.3 1.3 0 1 1 0-2.6z"/>',
  upload: '<path d="M8 10.4V3M5.2 5.8 8 3l2.8 2.8"/><path d="M3 12.6h10"/>',
  xCircle: '<circle cx="8" cy="8" r="5.6"/><path d="m6 6 4 4M10 6l-4 4"/>',
  send: '<path d="M13.4 2.6 2.6 6.9l4.4 1.9 1.9 4.4z"/><path d="m7 8.8 3.2-3.2"/>',
  percent: '<path d="M12.4 3.6 3.6 12.4"/><circle cx="5" cy="5" r="1.7"/><circle cx="11" cy="11" r="1.7"/>',
  info: '<circle cx="8" cy="8" r="5.6"/><path d="M8 7.2v3.6M8 5.4v.2"/>',
  arrowUpRight: '<path d="M5.2 10.8 10.8 5.2"/><path d="M6.2 5.2h4.6v4.6"/>',
  chevronRight: '<path d="M6 3.6 10.4 8 6 12.4"/>',
  chartColumn: '<path d="M3 13V9.2M6.4 13V5.6M9.8 13V7.4M13.2 13V3.4"/>',
  userCog: '<circle cx="6" cy="5" r="2.2"/><path d="M1.9 13.2c.4-2.2 1.9-3.4 4.1-3.4 1.2 0 2.2.4 3 1.1"/><circle cx="11.9" cy="11.3" r="1.9"/><path d="M11.9 8.6v1M11.9 13v1M9.4 9.9l.9.5M13.5 12.2l.9.5M9.4 12.7l.9-.5M13.5 10.4l.9-.5"/>',
  warning: '<path d="M8 2.6 14 13H2z"/><path d="M8 6.4v3.1M8 11.6v.2"/>',
  clipboard: '<rect x="3.4" y="3.2" width="9.2" height="10.6" rx="1.2"/><path d="M5.8 3.2V2.2h4.4v1"/><path d="m6 9 1.5 1.5L10.4 7.4"/>',
  target: '<circle cx="8" cy="8" r="5.4"/><circle cx="8" cy="8" r="2.2"/><path d="M8 1.2v1.4M8 13.4v1.4M1.2 8h1.4M13.4 8h1.4"/>',
  languages: '<path d="M2.6 4.2h6M5.6 2.6v1.6c0 2.6-1.4 4.6-3 5.6"/><path d="M4 7.4c1 1.8 2.4 2.8 3.6 3.2"/><path d="M9.4 13.4 11.6 7l2.2 6.4M10.2 11.2h2.8"/>',
  tag: '<path d="M2.4 2.4h5l6.2 6.2-5 5L2.4 7.4z"/><circle cx="5" cy="5" r=".9"/>',
  audio: '<path d="M2.4 6.2v3.6h2.4L8.4 13V3L4.8 6.2z"/><path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4"/>',
  mailOpen: '<path d="M2.4 6.4 8 2.6l5.6 3.8v6.4H2.4z"/><path d="m2.4 6.4 5.6 4 5.6-4"/>',
  caretUpDown: '<path d="m5 6 3-3 3 3M5 10l3 3 3-3"/>',
  more: '<path d="M3.2 8h.01M8 8h.01M12.8 8h.01" stroke-width="2.6"/>',
  listTodo: '<rect x="2.2" y="2.6" width="4.8" height="4.8" rx="1"/><path d="m2.5 10.9 1.7 1.7 3.1-3.1"/><path d="M9.6 4.2h4.2M9.6 7.8h4.2M9.6 11.4h4.2"/>',
  penTool: '<path d="m8 12.7 4.7-4.7 2 2-4.7 4.7z"/><path d="m12 8.7-1-5L1.3 1.3l2.4 9.7 9.7 2.4 3.3-3.3z"/><path d="M1.3 1.3 6.4 6.4"/><circle cx="7.3" cy="7.3" r="1.3"/>',
  timer: '<path d="M6.3 2.4h3.4"/><circle cx="8" cy="9.2" r="4.9"/><path d="M8 6.6v2.8l1.8 1.2"/>',
  chartAxis: '<path d="M2.8 2.6v10.4h10.6"/><path d="M5.8 10.4V8.2M8.2 10.4V5.4M10.6 10.4V6.8"/>',
  rotateCcw: '<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M2.8 2.8v2.6h2.6"/>'
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    :stroke="color || 'currentColor'"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
    v-html="icons[name] || ''"
  />
</template>

<style scoped>
.icon { display: inline-block; flex: 0 0 auto; vertical-align: -2px; }
</style>
