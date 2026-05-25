<template>
  <div class="open-by-path-dialog">
    <el-dialog
      v-model="visible"
      :show-close="true"
      :modal="true"
      custom-class="ag-dialog-table"
      width="520px"
      title="Open by Path"
      @close="onClose"
    >
      <div class="dialog-body">
        <div class="input-row">
          <input
            ref="pathInput"
            v-model="inputPath"
            type="text"
            class="path-input"
            placeholder="Enter file or folder path…"
            @keyup.enter="confirm"
            @keyup.esc="onClose"
          >
        </div>
        <p
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="onClose">
            Cancel
          </el-button>
          <el-button
            type="primary"
            :disabled="!inputPath.trim()"
            @click="confirm"
          >
            Open
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import bus from '../../bus'

const visible = ref(false)
const inputPath = ref('')
const errorMessage = ref('')
const pathInput = ref<HTMLInputElement | null>(null)

const show = (): void => {
  inputPath.value = ''
  errorMessage.value = ''
  visible.value = true
  nextTick(() => {
    pathInput.value?.focus()
  })
}

const onClose = (): void => {
  visible.value = false
  errorMessage.value = ''
}

const confirm = (): void => {
  const p = inputPath.value.trim()
  if (!p) return
  errorMessage.value = ''
  window.electron.ipcRenderer.send('mt::open-by-path', p)
  visible.value = false
}

onMounted(() => {
  bus.on('show-open-by-path-dialog', show)
})

onBeforeUnmount(() => {
  bus.off('show-open-by-path-dialog', show)
})
</script>

<style>
.open-by-path-dialog .el-dialog__body {
  padding: 12px 20px 4px;
}
.open-by-path-dialog .el-dialog__footer {
  padding: 8px 20px 16px;
}
</style>

<style scoped>
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-row {
  display: flex;
  width: 100%;
}
.path-input {
  width: 100%;
  height: 32px;
  outline: none;
  border: 1px solid var(--editorBorderColor, #ddd);
  border-radius: 3px;
  font-size: 13px;
  padding: 0 8px;
  background: transparent;
  color: var(--sideBarColor);
  box-sizing: border-box;
}
.path-input:focus {
  border-color: var(--themeColor);
}
.error-message {
  font-size: 12px;
  color: #f56c6c;
  margin: 0;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
