<template>
  <div
    ref="paneEl"
    class="comparison-pane-root"
    @scroll.passive="onScroll"
  >
    <!-- File label -->
    <div class="pane-label">
      {{ label }}
    </div>

    <!-- Diff mode: line-by-line raw text with change highlighting -->
    <div
      v-if="diffMode && lineDiffs.length > 0"
      class="diff-body"
    >
      <div
        v-for="(line, idx) in lineDiffs"
        :key="idx"
        :class="['diff-line', `diff-line--${line.type}`]"
      >
        <span class="diff-line-marker">{{ lineMarker(line.type) }}</span>
        <span class="diff-line-text">{{ line.text }}</span>
      </div>
    </div>

    <!-- Rendered markdown -->
    <div
      v-else-if="html"
      class="markdown-body"
      v-html="html"
    />

    <!-- Error state -->
    <div
      v-else-if="errorMessage"
      class="pane-error"
    >
      {{ errorMessage }}
    </div>

    <!-- Empty / loading state -->
    <div
      v-else
      class="pane-empty"
    >
      {{ filePath ? 'Loading…' : 'No file selected' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import MarkdownIt from 'markdown-it'

export interface LineDiff {
  text: string
  type: 'added' | 'removed' | 'unchanged'
}

const props = defineProps<{
  filePath: string | null
  /** When true, render in line-diff mode using lineDiffs instead of markdown */
  diffMode?: boolean
  /** Pre-computed per-line diff to display in diff mode */
  lineDiffs?: LineDiff[]
}>()

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

const paneEl = ref<HTMLElement | null>(null)
const html = ref('')
const errorMessage = ref('')

const label = computed(() => {
  if (!props.filePath) return '(none)'
  const parts = props.filePath.replace(/\\/g, '/').split('/')
  return parts.length > 1 ? parts.slice(-2).join('/') : parts[0] ?? props.filePath
})

const lineMarker = (type: LineDiff['type']): string => {
  if (type === 'added') return '+'
  if (type === 'removed') return '-'
  return ' '
}

const lineDiffs = computed<LineDiff[]>(() => props.lineDiffs ?? [])

const loadFile = async (filePath: string | null): Promise<void> => {
  html.value = ''
  errorMessage.value = ''
  if (!filePath) return

  try {
    const content = await window.fileUtils.readFile(filePath)
    const text = content instanceof Uint8Array
      ? new TextDecoder().decode(content)
      : String(content)
    html.value = md.render(text)
    rawContent.value = text
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

watch(() => props.filePath, loadFile, { immediate: true })

// ── Synchronized scrolling (S5) ────────────────────────────────────────────

/** Current scroll ratio [0, 1] — exposed for the parent to read. */
const scrollPercent = ref(0)

const onScroll = (): void => {
  const el = paneEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  scrollPercent.value = max > 0 ? el.scrollTop / max : 0
}

/** Scroll this pane to the given ratio without triggering a re-emit loop. */
const scrollToPercent = (pct: number): void => {
  const el = paneEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = pct * max
}

/** Raw text content — exposed for S6 diff highlighting. */
const rawContent = ref('')

defineExpose({ scrollPercent, scrollToPercent, rawContent })
</script>

<style scoped>
.comparison-pane-root {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  background: var(--editorBgColor);
}
.pane-label {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  color: var(--sideBarColor);
  background: var(--editorBgColor);
  border-bottom: 1px solid var(--editorBorderColor, #ddd);
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.markdown-body {
  padding: 16px 20px;
  line-height: 1.6;
  font-size: 14px;
  color: var(--editorColor);
  flex: 1;
}
.pane-error {
  padding: 20px;
  color: #f56c6c;
  font-size: 13px;
}
.pane-empty {
  padding: 20px;
  color: var(--iconColor);
  font-size: 13px;
}

/* ── Diff mode ─────────────────────────────────────────────────────────── */
.diff-body {
  font-family: var(--codeFontFamily, monospace);
  font-size: 13px;
  padding: 8px 0;
  flex: 1;
}
.diff-line {
  display: flex;
  align-items: baseline;
  padding: 0 12px;
  min-height: 1.5em;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-line--added {
  background: rgba(40, 167, 69, 0.12);
  color: var(--editorColor);
}
.diff-line--removed {
  background: rgba(220, 53, 69, 0.12);
  color: var(--editorColor);
}
.diff-line--unchanged {
  color: var(--editorColor);
}
.diff-line-marker {
  width: 14px;
  flex-shrink: 0;
  font-weight: bold;
  color: inherit;
  opacity: 0.6;
  user-select: none;
}
.diff-line--added .diff-line-marker {
  color: #28a745;
  opacity: 1;
}
.diff-line--removed .diff-line-marker {
  color: #dc3545;
  opacity: 1;
}
.diff-line-text {
  flex: 1;
  min-width: 0;
}

/* ── Basic markdown styles ─────────────────────────────────────────────── */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}
.markdown-body :deep(p) {
  margin: 0.5em 0;
}
.markdown-body :deep(pre) {
  background: var(--codeBlockBgColor, rgba(0,0,0,0.05));
  border-radius: 4px;
  padding: 10px 14px;
  overflow-x: auto;
  font-size: 13px;
}
.markdown-body :deep(code) {
  font-family: var(--codeFontFamily, monospace);
  background: var(--codeBlockBgColor, rgba(0,0,0,0.05));
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 13px;
}
.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--themeColor, #666);
  margin: 0.5em 0;
  padding-left: 12px;
  color: var(--sideBarColor);
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.4em 0;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--editorBorderColor, #ddd);
  margin: 1em 0;
}
.markdown-body :deep(a) {
  color: var(--themeColor, #4183c4);
  text-decoration: none;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--editorBorderColor, #ddd);
  padding: 4px 8px;
}
.markdown-body :deep(th) {
  background: var(--codeBlockBgColor, rgba(0,0,0,0.04));
  font-weight: 600;
}
</style>
