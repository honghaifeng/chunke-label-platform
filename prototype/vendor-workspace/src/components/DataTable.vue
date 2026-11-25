<script setup lang="ts">
interface Column {
  key: string
  title: string
  width?: string
  align?: 'left' | 'right' | 'center'
}

withDefaults(
  defineProps<{
    columns: Column[]
    rows: Record<string, any>[]
    rowKey?: string
    selectable?: boolean
    selected?: (string | number)[]
    emptyText?: string
  }>(),
  { rowKey: 'id', selectable: false, selected: () => [], emptyText: '暂无数据' }
)

const emit = defineEmits<{
  (e: 'row-click', row: Record<string, any>): void
  (e: 'select', keys: (string | number)[]): void
}>()

function toggle(key: string | number, selected: (string | number)[]) {
  const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
  emit('select', next)
}

function toggleAll(rows: Record<string, any>[], key: string, selected: (string | number)[]) {
  emit('select', selected.length === rows.length ? [] : rows.map((r) => r[key]))
}
</script>

<template>
  <table class="table">
    <thead>
      <tr>
        <th v-if="selectable" style="width: 36px">
          <input
            type="checkbox"
            :checked="rows.length > 0 && selected.length === rows.length"
            @change="toggleAll(rows, rowKey, selected)"
          />
        </th>
        <th v-for="c in columns" :key="c.key" :style="{ width: c.width, textAlign: c.align || 'left' }">
          {{ c.title }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="!rows.length">
        <td :colspan="columns.length + (selectable ? 1 : 0)">
          <div class="empty" style="padding: 40px 0">{{ emptyText }}</div>
        </td>
      </tr>
      <tr
        v-for="row in rows"
        :key="row[rowKey]"
        :class="{ selected: selected.includes(row[rowKey]) }"
        @click="emit('row-click', row)"
      >
        <td v-if="selectable" @click.stop>
          <input type="checkbox" :checked="selected.includes(row[rowKey])" @change="toggle(row[rowKey], selected)" />
        </td>
        <td v-for="c in columns" :key="c.key" :style="{ textAlign: c.align || 'left' }">
          <slot :name="c.key" :row="row">{{ row[c.key] }}</slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>
