<template>
  <div
    class="editor-with-tabs"
    :style="{ 'max-width': `calc(100vw - ${effectiveSideBarWidth}px)` }"
  >
    <!-- Normal editing mode -->
    <template v-if="!comparisonMode">
      <tabs v-show="showTabBar" />
      <div class="container">
        <editor
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        />
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :muya-index-cursor="muyaIndexCursor"
          :text-direction="textDirection"
        />
      </div>
      <tab-notifications />
    </template>

    <!-- Comparison mode: two panes side by side -->
    <template v-else>
      <div class="comparison-header">
        <span class="comparison-label">Comparing files</span>
        <div class="comparison-actions">
          <button
            class="comparison-toggle"
            :class="{ active: showDiff }"
            @click="showDiff = !showDiff"
          >
            {{ showDiff ? '⬜ Hide Diff' : '⬛ Show Diff' }}
          </button>
          <button
            class="comparison-exit"
            @click="exitComparison"
          >
            ✕ Exit Comparison
          </button>
        </div>
      </div>
      <div class="comparison-container">
        <comparison-pane
          ref="paneA"
          class="comparison-pane"
          :file-path="comparisonFileA"
          :diff-mode="showDiff"
          :line-diffs="lineDiffsA"
        />
        <div class="comparison-divider" />
        <comparison-pane
          ref="paneB"
          class="comparison-pane"
          :file-path="comparisonFileB"
          :diff-mode="showDiff"
          :line-diffs="lineDiffsB"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { diffLines } from 'diff'
import { useLayoutStore } from '@/store/layout'
import { storeToRefs } from 'pinia'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import ComparisonPane, { type LineDiff } from './comparisonPane.vue'

defineProps<{
  markdown: string
  // `cursor` originates as `IFileState.cursor` which is `unknown`
  // (see src/shared/types/files.ts); align here instead of forcing every
  // caller to widen.
  cursor: unknown
  muyaIndexCursor?: unknown
  sourceCode: boolean
  showTabBar: boolean
  textDirection: string
  platform: string
}>()

const layoutStore = useLayoutStore()
const { effectiveSideBarWidth, comparisonMode, comparisonFileA, comparisonFileB } =
  storeToRefs(layoutStore)
const { exitComparison } = layoutStore

// ── Synchronized scrolling (S5) ────────────────────────────────────────────

type ComparisonPaneInstance = InstanceType<typeof ComparisonPane>
const paneA = ref<ComparisonPaneInstance | null>(null)
const paneB = ref<ComparisonPaneInstance | null>(null)

// Which pane is currently driving the scroll (prevents feedback loops)
let syncSource: 'a' | 'b' | null = null

watch(
  () => paneA.value?.scrollPercent,
  (pct) => {
    if (syncSource === 'b' || pct === undefined) return
    syncSource = 'a'
    paneB.value?.scrollToPercent(pct)
    syncSource = null
  }
)

watch(
  () => paneB.value?.scrollPercent,
  (pct) => {
    if (syncSource === 'a' || pct === undefined) return
    syncSource = 'b'
    paneA.value?.scrollToPercent(pct)
    syncSource = null
  }
)

// ── Diff highlighting (S6) ─────────────────────────────────────────────────

const showDiff = ref(false)

// Reset diff toggle when exiting comparison
watch(comparisonMode, (active) => {
  if (!active) showDiff.value = false
})

interface SideDiffs {
  a: LineDiff[]
  b: LineDiff[]
}

const diffResult = computed<SideDiffs>(() => {
  const rawA = paneA.value?.rawContent ?? ''
  const rawB = paneB.value?.rawContent ?? ''
  if (!rawA && !rawB) return { a: [], b: [] }

  const changes = diffLines(rawA, rawB)
  const sideA: LineDiff[] = []
  const sideB: LineDiff[] = []

  for (const change of changes) {
    const lines = change.value.split('\n')
    // diffLines includes a trailing empty string when the value ends with \n; drop it
    if (lines[lines.length - 1] === '') lines.pop()

    if (change.added) {
      for (const line of lines) {
        sideB.push({ text: line, type: 'added' })
      }
    } else if (change.removed) {
      for (const line of lines) {
        sideA.push({ text: line, type: 'removed' })
      }
    } else {
      for (const line of lines) {
        sideA.push({ text: line, type: 'unchanged' })
        sideB.push({ text: line, type: 'unchanged' })
      }
    }
  }

  return { a: sideA, b: sideB }
})

// Recompute diff when file content changes (pane rawContent is a ref exposed via defineExpose)
const lineDiffsA = computed<LineDiff[]>(() =>
  showDiff.value ? diffResult.value.a : []
)
const lineDiffsB = computed<LineDiff[]>(() =>
  showDiff.value ? diffResult.value.b : []
)
</script>

<style scoped>
.editor-with-tabs {
  position: relative;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;

  overflow: hidden;
  background: var(--editorBgColor);
  & > .container {
    flex: 1;
    overflow: hidden;
  }
}

/* Comparison mode styles */
.comparison-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--editorBgColor);
  border-bottom: 1px solid var(--editorBorderColor, #ddd);
  font-size: 13px;
  flex-shrink: 0;
}
.comparison-label {
  color: var(--sideBarColor);
  font-weight: 500;
}
.comparison-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.comparison-toggle {
  background: none;
  border: 1px solid var(--editorBorderColor, #ddd);
  cursor: pointer;
  font-size: 11px;
  color: var(--iconColor);
  padding: 2px 8px;
  border-radius: 3px;
  &:hover,
  &.active {
    background: var(--themeColor, #4183c4);
    color: #fff;
    border-color: transparent;
  }
}
.comparison-exit {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--iconColor);
  padding: 2px 6px;
  border-radius: 3px;
  &:hover {
    background: var(--floatHoverColor, rgba(0,0,0,0.06));
  }
}
.comparison-container {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}
.comparison-pane {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
.comparison-divider {
  width: 1px;
  background: var(--editorBorderColor, #ddd);
  flex-shrink: 0;
}
</style>
