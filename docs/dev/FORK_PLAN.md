# Personal Fork Plan

> **Purpose**: Ongoing implementation roadmap for personal MarkText improvements.  
> **Load this at the start of every session** to restore full context.  
> **Update this file** when a slice is completed (mark ✅) or when a slice changes.

---

## Goals

1. **Better Windows/WSL browsing support** — MarkText running as a native Windows app should be able to open, watch, and display files stored on a WSL Linux distribution (`\\wsl$\Ubuntu\...` or `\\wsl.localhost\Ubuntu\...`).
2. **Side-by-side comparison of two markdown files** — Split the window into two panes, each rendering a different file, with synchronized scrolling and optional diff highlighting.

---

## Codebase Discovery Tasks

Run these **before writing code for Slice W1 or S1**. They validate assumptions made during planning.

| # | Task | What to Look For |
|---|------|-----------------|
| D1 | Open `File > Open` on Windows with `\\wsl$\Ubuntu\...` as the target | Does the native dialog allow navigating there? Does `isSamePathSync` throw? Does chokidar silently fail? |
| D2 | Grep all `path.join` / `path.resolve` calls in `src/main/` and `src/renderer/` that touch file paths before they reach the store | Catalog every transform point where a UNC path could be corrupted |
| D3 | Search `src/muya/lib/` for image `src` rewriting — look for `path.join`, `path.resolve`, or `src=` in render files | Find the exact location where `./image.png` becomes an absolute path — this is where WSL images break |
| D4 | Open DevTools on a running window with a large file, profile `new Muya(ele, options)` — check time and DOM node count | Determines whether two simultaneous Muya instances in one window are feasible for comparison panes |
| D5 | Read `src/preload/index.ts` and `src/types/global.d.ts` | Find the exact renderer-side call signature for reading a file (e.g., `window.electron.invoke('mt::fs::read-file', path)` or a `window.fileUtils.*` method) |

---

## Warning List

### Electron + Filesystem Hazards

| Risk | Where | Impact |
|------|--------|--------|
| `path.join('\\\\wsl$', 'Ubuntu', 'file.md')` produces a wrong result | Any path construction touching UNC paths | Silent corruption; file not found |
| `fs.watch` / chokidar does not receive inotify events across the WSL boundary | `src/main/filesystem/watcher.ts` | File-changed-on-disk prompt never fires for WSL files |
| Electron's native file dialog won't navigate to `\\wsl$\` in its tree | `dialog.showOpenDialog` | Users can't browse to WSL files via the normal open dialog |
| `shell.openExternal` with a WSL UNC path fails silently | Link-opening, external-tool image open | Clicked links in WSL-hosted files don't open |
| `app.getPath('documents')` returns a Windows path even for WSL files | Default save-as location | Save As defaults to Windows documents, not the WSL file's directory |
| Relative image paths resolved via `path.join` against a UNC base | Image rendering in Muya | Images appear broken in WSL-hosted files |

### Editor State Hazards

| Risk | Where | Impact |
|------|--------|--------|
| `currentFile` in editor store is a singleton for the whole window | `src/renderer/src/store/editor.ts` | If a comparison-pane file is set as `currentFile`, all save/export menu actions target the wrong file |
| Auto-save timers are keyed by tab ID | `editor.ts` `autoSaveTimers` Map | A read-only comparison pane must never get a save timer attached |
| `debouncedSendBufferedState()` persists scroll position per tab | Buffer store | Synchronized scrolling will fight with buffer-state restoration on reload |
| Muya has no `readOnly` constructor option | `src/muya/lib/config/index.js` | Two full Muya instances in one window doubles DOM + event listeners; use a lighter renderer (`markdown-it`) for comparison panes instead |
| Muya may use `document.querySelector` without scoping | `src/muya/lib/eventHandler/` | A second instance in the same DOM could pick up events from the first instance's elements |

### IPC Hazards

| Risk | Where | Impact |
|------|--------|--------|
| `mt::save-tabs` iterates all tab objects | `editor.ts` | A comparison pane modeled as a "tab" could be accidentally saved |
| `mt::open-new-tab` targets the whole window, not a specific pane | `editor.ts` `LISTEN_FOR_NEW_TAB` | Main process cannot route a file directly to comparison pane 2 |
| `second-instance` path forwarding opens paths as real tabs | `app/index.ts` lines 73–104 | A WSL file opened from WSL terminal via second-instance enters the normal tab pipeline with a potentially unhandled path |

---

## Implementation Order

```
Phase 1 — Foundations (zero UI risk, fully testable)
  W1  WSL path utility module
  W2  isSamePathSync fix
  S1  Comparison layout store state

Phase 2 — WSL MVP (enables WSL file editing)
  W3  Open by Path dialog         ← first WSL user-visible feature
  W4  chokidar polling fix         ← makes WSL files reliable

Phase 3 — Comparison MVP (end-to-end useful)
  S2  Split-pane layout shell
  S3  Render markdown in panes     ← first real comparison value
  S4  Compare Files menu           ← ties the feature together

Phase 4 — Polish and power features
  W5  WSL image path fix           ← QoL for users with images
  S5  Synchronized scrolling       ← comfortable comparison
  S6  Diff highlighting            ← the "wow" feature; do last
```

---

## Slice Risk and Effort Summary

| Slice | Feature | Category | Risk | Est. Effort |
|-------|---------|----------|------|-------------|
| W1 | WSL path utility module | MVP | 🟢 None | 1–2 h |
| W2 | isSamePathSync WSL fix | MVP | 🟢 Low | 30 min |
| W3 | Open by Path dialog | MVP | 🟡 Medium | 3–4 h |
| W4 | chokidar polling for WSL | MVP | 🟢 Low | 30 min |
| W5 | WSL image path fix | QoL | 🟡 Medium | 2–3 h |
| S1 | Comparison layout state | MVP | 🟢 None | 30 min |
| S2 | Split-pane layout shell | MVP | 🟢 Low | 2 h |
| S3 | Render markdown in panes | MVP | 🟡 Medium | 3–4 h |
| S4 | Compare Files menu | MVP | 🟢 Low | 2 h |
| S5 | Synchronized scrolling | QoL | 🟡 Medium | 2–3 h |
| S6 | Diff highlighting | Nice-to-have | 🔴 High | 4–6 h |

---

## Feature A: WSL / Windows Path Support

### W1 — WSL Path Utility Module
**Status**: ⬜ Not started  
**Category**: MVP  
**Branch**: `feat/wsl-path-utils`  
**Commit**: `feat(common): add WSL UNC path detection and normalization utilities`

**User value**: Foundational — enables all other WSL fixes. Nothing else in Feature A can land without a reliable way to detect and normalize WSL UNC paths.

**Technical objective**: Create `src/common/filesystem/wsl.ts` with pure, well-tested utility functions. No UI changes. No behavior changes to existing code.

**Code areas**:
- `src/common/filesystem/wsl.ts` — create new file
- `test/unit/specs/wsl-paths.spec.ts` — create new test file
- `src/common/filesystem/paths.ts` — style reference only

**Dependencies**: None  
**Risks**: None — pure utility, additive only

**Acceptance criteria**:
- `isWslUncPath('\\\\wsl$\\Ubuntu\\home\\user\\file.md')` → `true`
- `isWslUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\file.md')` → `true`
- `isWslUncPath('C:\\Users\\user\\file.md')` → `false`
- `isWslUncPath('/home/user/file.md')` → `false`
- `wslUncToLinuxPath('\\\\wsl$\\Ubuntu\\home\\user\\file.md')` → `'/home/user/file.md'`
- `wslUncDistroName('\\\\wsl$\\Ubuntu\\home\\user\\file.md')` → `'Ubuntu'`
- All unit tests pass: `pnpm exec vitest run test/unit/specs/wsl-paths.spec.ts`

**Manual test steps**: `pnpm run test:unit` — all tests green

<details>
<summary>Prompt for coding agent</summary>

```
In /home/bk1/workspace/tools/marktext/src/common/filesystem/, create a new
TypeScript file wsl.ts. It should export:

- isWslUncPath(p: string): boolean — returns true if the path starts with
  \\wsl$\ or \\wsl.localhost\ (case-insensitive, handle both Windows backslash
  and escaped forms)
- wslUncDistroName(p: string): string | null — extracts the distro name
  (e.g., 'Ubuntu') from a WSL UNC path; returns null for non-WSL paths
- wslUncToLinuxPath(p: string): string — converts \\wsl$\Ubuntu\home\user\file.md
  → /home/user/file.md (strips the \\wsl$\Ubuntu prefix, converts remaining
  backslashes to forward slashes). Returns input unchanged if not a WSL UNC path.
- normalizeWslPath(p: string): string — if input isWslUncPath, return
  wslUncToLinuxPath(p); otherwise return p unchanged.

Also write test/unit/specs/wsl-paths.spec.ts using Vitest. Cover all four
exported functions with WSL UNC paths using both \\wsl$\ and \\wsl.localhost\
prefixes, normal Windows paths (C:\Users\...), and normal Linux paths (/home/...).

Follow the code style of src/common/filesystem/paths.ts: TypeScript strict
mode, 2-space indentation, no semicolons, single quotes.
```
</details>

---

### W2 — Fix isSamePathSync for WSL UNC Paths
**Status**: ⬜ Not started  
**Category**: MVP  
**Branch**: `fix/wsl-path-comparison`  
**Commit**: `fix(common): normalize WSL UNC paths before path comparison`

**User value**: Prevents MarkText from opening the same WSL file twice (once via `\\wsl$\Ubuntu\...` and once via a normalized path after reopening).

**Technical objective**: Update `isSamePathSync` and `normalizeMarkdownPath` in `src/common/filesystem/paths.ts` to normalize WSL UNC paths before comparison.

**Code areas**:
- `src/common/filesystem/paths.ts` — `isSamePathSync`, `normalizeMarkdownPath`
- `src/main/ipc/paths.ts` — where `isSamePathSync` is exposed (no change needed, verify only)

**Dependencies**: W1  
**Risks**: Low — single localized change; all existing tests must still pass

**Acceptance criteria**:
- `isSamePathSync('\\\\wsl$\\Ubuntu\\home\\user\\file.md', '\\\\wsl.localhost\\Ubuntu\\home\\user\\file.md')` → `true`
- All existing `isSamePathSync` tests still pass
- Opening a WSL file that is already open switches to its tab, not a duplicate

**Manual test steps**:
1. `pnpm run test:unit` — all green
2. Open a WSL file, try to open the same path again → switches to existing tab

<details>
<summary>Prompt for coding agent</summary>

```
In /home/bk1/workspace/tools/marktext/src/common/filesystem/paths.ts:

1. Import isWslUncPath and wslUncToLinuxPath from ./wsl.
2. In isSamePathSync(a, b): at the very top of the function, before any
   existing logic, add:
     if (isWslUncPath(a)) a = wslUncToLinuxPath(a)
     if (isWslUncPath(b)) b = wslUncToLinuxPath(b)
3. In normalizeMarkdownPath(p) (INVESTIGATE: find the actual function name —
   it may differ): apply the same normalization at the top.

Do not change any other logic. Run pnpm run test:unit and confirm all tests
pass. Add two new test cases to test/unit/specs/wsl-paths.spec.ts for the
updated comparison behavior.
```
</details>

---

### W3 — "Open by Path…" Manual Path Input Dialog
**Status**: ⬜ Not started  
**Category**: MVP  
**Branch**: `feat/open-by-path`  
**Commit**: `feat(menu): add File > Open by Path for WSL and UNC paths (Ctrl+Shift+O)`

**User value**: WSL users can type or paste a full UNC path to open a file, bypassing the native file dialog which cannot navigate to `\\wsl$\` in its tree view.

**Technical objective**: Add `File > Open by Path…` (Ctrl+Shift+O). A renderer-side Vue dialog shows a text input. On submit, the path is validated and opened via the existing file-open pipeline.

**Code areas**:
- `src/main/menu/templates/file.ts` — add menu item
- `src/main/menu/actions/file.ts` — add IPC handler
- `src/renderer/src/components/openByPathDialog.vue` — new dialog component
- `src/renderer/src/store/editor.ts` or `layout.ts` — IPC listener to show dialog

**Dependencies**: W1, W2  
**Risks**: Medium — must hook into the existing file-open pipeline exactly; incorrect hooking could bypass deduplication. Electron has no built-in text-input dialog; must build a Vue component.

**Acceptance criteria**:
- `File > Open by Path…` exists in the File menu with Ctrl+Shift+O
- Dialog has text input, placeholder: `Paste absolute path or \\wsl$\Ubuntu\...`
- Valid existing path → opens in new tab
- Already-open path → switches to that tab (no duplicate)
- Nonexistent path → existing error notification style
- Cancel → no side effects

**Manual test steps**:
1. File > Open by Path… → paste `\\wsl$\Ubuntu\home\<user>\<file>.md` → opens
2. Repeat same path → switches to tab, no duplicate
3. Paste nonexistent path → error notification
4. Cancel → nothing happens

<details>
<summary>Prompt for coding agent</summary>

```
In MarkText (/home/bk1/workspace/tools/marktext):

1. src/main/menu/templates/file.ts: Add a separator and menu item
   "Open by Path…" with accelerator CmdOrCtrl+Shift+O after the existing
   open items. The click handler sends IPC mt::show-open-by-path-dialog
   to the focused window (match the pattern used by other items in this file).

2. In src/main/menu/actions/file.ts (or wherever appropriate), register
   an IPC handler that forwards mt::show-open-by-path-dialog to the
   renderer via win.webContents.send.

3. Create src/renderer/src/components/openByPathDialog.vue — a minimal
   Vue 3 component using Element Plus ElDialog + ElInput. Show it when
   a store flag or bus event triggers. On confirm:
   - Call window.electron.invoke (check src/preload/index.ts for the
     exact API) with mt::fs::path-exists to validate the path
   - If valid, send mt::open-by-path to main with the path string
   - If invalid, show an inline error
   On cancel: close dialog.

4. In src/main/, add an IPC handler for mt::open-by-path:
   - Normalize path with normalizeMarkdownPath (handles WSL from W2)
   - Check it exists
   - If already open (isSamePathSync), send mt::switch-tab-by-file_path
   - If new, open via the existing file-open pipeline
   - If not found, send mt::show-notification with error

5. Register OpenByPathDialog globally (check how other global dialogs
   are registered in src/renderer/src/).

Follow existing code style. Do not break existing file-open behavior.
```
</details>

---

### W4 — Force Polling Mode for WSL File Watcher
**Status**: ⬜ Not started  
**Category**: MVP  
**Branch**: `fix/watcher-wsl-polling`  
**Commit**: `fix(watcher): enable polling mode for WSL UNC paths`

**User value**: File-changed-on-disk detection works for WSL files. Without this, MarkText silently shows stale content after the file is modified from a WSL terminal.

**Technical objective**: In `src/main/filesystem/watcher.ts`, detect if the watched path is WSL UNC and override `usePolling` to `true` with `interval: 1000`.

**Code areas**:
- `src/main/filesystem/watcher.ts` — `watch()` method, chokidar options object (~line 196)

**Dependencies**: W1  
**Risks**: Low — one options object change, gated by `isWslUncPath`. Polling is already the macOS default in this codebase.

**Acceptance criteria**:
- Watching `\\wsl$\Ubuntu\...` uses `{ usePolling: true, interval: 1000 }`
- Watching a local Windows path retains existing behavior
- Editing a WSL file from WSL terminal triggers MarkText's file-changed prompt within ~2 seconds

**Manual test steps**:
1. Open `\\wsl$\Ubuntu\home\user\test.md` in MarkText via W3
2. In WSL terminal: `echo "## New Section" >> test.md`
3. MarkText shows "file changed on disk" prompt within ~2 seconds

<details>
<summary>Prompt for coding agent</summary>

```
In /home/bk1/workspace/tools/marktext/src/main/filesystem/watcher.ts:

1. Import isWslUncPath from ../../common/filesystem/wsl.
2. Find the watch() method and the chokidar options object (around line 196).
3. The current options have:
     usePolling: isOsx ? true : preferences.getItem('watcherUsePolling')
   Change this to:
     usePolling: isWslUncPath(watchedPath) || isOsx
       ? true
       : preferences.getItem('watcherUsePolling')
   (INVESTIGATE: confirm the exact variable name for the watched path —
   it may be filePath, p, targetPath, or similar.)
4. Add to the same options object:
     interval: isWslUncPath(watchedPath) ? 1000 : undefined

Do not change any other watcher logic. Do not change behavior for non-WSL paths.
```
</details>

---

### W5 — Fix Relative Image Paths in WSL-Hosted Files
**Status**: ⬜ Not started  
**Category**: QoL  
**Branch**: `fix/wsl-image-paths`  
**Commit**: `fix(editor): resolve relative image paths correctly for WSL UNC base paths`

**User value**: Images referenced as `![](./screenshot.png)` in WSL-hosted files render correctly instead of broken image icons.

**⚠️ INVESTIGATE FIRST (D3)**: Find where image `src` values are resolved to absolute paths. Likely in `src/muya/lib/parser/render/` or in the `imageAction`/`clipboardFilePath` callbacks in `editor.vue` lines ~1165–1207.

**Technical objective**: At the image-path-resolution site, if the document's base path `isWslUncPath`, construct the absolute image path using string concatenation + backslash normalization rather than `path.join`.

**Code areas**:
- `src/muya/lib/parser/render/` — image renderer (INVESTIGATE)
- `src/renderer/src/components/editorWithTabs/editor.vue` lines ~1165–1207 — `imageAction`, `clipboardFilePath` callbacks

**Dependencies**: W1, W3  
**Risks**: Medium — image path resolution not fully mapped yet; risk of breaking normal image paths. Use `isWslUncPath` guard strictly.

**Acceptance criteria**:
- File at `\\wsl$\Ubuntu\home\user\docs\notes.md` with `![](./img/chart.png)` correctly loads `\\wsl$\Ubuntu\home\user\docs\img\chart.png`
- Normal Windows and macOS relative image paths unaffected
- Absolute image paths unaffected

**Manual test steps**:
1. Create WSL file at `\\wsl$\Ubuntu\home\user\test\notes.md` with `![test](./test.png)`
2. Copy any PNG to `\\wsl$\Ubuntu\home\user\test\test.png`
3. Open `notes.md` via Open by Path
4. Image renders correctly in the editor

<details>
<summary>Prompt for coding agent</summary>

```
INVESTIGATE FIRST: Search /home/bk1/workspace/tools/marktext for where image
src paths are resolved to absolute paths. Key places:
- src/muya/lib/parser/render/ — search for path.join, path.resolve, src=
- src/renderer/src/components/editorWithTabs/editor.vue lines ~1165–1207
  — look at imageAction and clipboardFilePath callbacks passed to Muya

Once found: import isWslUncPath from the appropriate relative path to
src/common/filesystem/wsl.ts. At the resolution site, add:

  if (isWslUncPath(basePath)) {
    // Safe UNC join — path.join corrupts UNC paths on Windows
    const relativeWindows = relativePath.replace(/\//g, '\\')
    return basePath.replace(/\\$/, '') + '\\' + relativeWindows
  } else {
    // existing path.join logic unchanged
  }

Do not modify the else branch. Do not change behavior for non-WSL paths.
```
</details>

---

## Feature B: Side-by-Side File Comparison

### S1 — Add Comparison-Mode State to Layout Store
**Status**: ⬜ Not started  
**Category**: MVP (foundation)  
**Branch**: `feat/comparison-layout-state`  
**Commit**: `feat(layout): add comparison-mode state and enter/exit actions`

**User value**: None visible yet — pure state scaffolding required by all B slices.

**Technical objective**: Add `comparisonMode`, `comparisonFileA`, `comparisonFileB` refs plus `enterComparison` / `exitComparison` actions to `layout.ts`. Additive only.

**Code areas**:
- `src/renderer/src/store/layout.ts`

**Dependencies**: None  
**Risks**: None — additive state, no side effects

**Acceptance criteria**:
- `useLayoutStore().comparisonMode` is a reactive boolean, default `false`
- `enterComparison(fileA, fileB)` sets both paths and flips mode to `true`
- `exitComparison()` resets mode to `false`, clears both paths to `null`
- Pinia DevTools show the new state shape

**Manual test steps**: DevTools → Vue/Pinia panel → confirm state shape exists

<details>
<summary>Prompt for coding agent</summary>

```
In /home/bk1/workspace/tools/marktext/src/renderer/src/store/layout.ts,
inside the existing useLayoutStore store, add:

State (after the existing refs):
  const comparisonMode = ref(false)
  const comparisonFileA = ref<string | null>(null)
  const comparisonFileB = ref<string | null>(null)

Actions:
  function enterComparison(fileA: string, fileB: string) {
    comparisonFileA.value = fileA
    comparisonFileB.value = fileB
    comparisonMode.value = true
  }
  function exitComparison() {
    comparisonMode.value = false
    comparisonFileA.value = null
    comparisonFileB.value = null
  }

Add all three refs and both functions to the return statement.
Do not change any existing state or actions.
Follow existing code style (TypeScript strict mode, no semicolons,
single quotes, 2-space indent).
```
</details>

---

### S2 — Split-Pane Layout Shell
**Status**: ⬜ Not started  
**Category**: MVP (foundation)  
**Branch**: `feat/comparison-pane-shell`  
**Commit**: `feat(editor): render split-pane shell when comparison mode is active`

**User value**: Visual confirmation that comparison mode exists; gives the user the two-pane frame before file loading is wired up.

**Technical objective**: In `src/renderer/src/components/editorWithTabs/index.vue`, when `comparisonMode` is `true`, render two equal-width side-by-side panes (with filename headers and placeholder bodies). Normal editor renders unchanged when `false`.

**Code areas**:
- `src/renderer/src/components/editorWithTabs/index.vue`

**Dependencies**: S1  
**Risks**: Low — gated by `v-if` on `comparisonMode`; normal editing path untouched

**Acceptance criteria**:
- `comparisonMode = true` → editor area replaced by two equal panes with filename headers
- Pane A header shows last segment of `comparisonFileA` (or "File A" if null)
- 1px vertical divider between panes
- Panes respond to sidebar width changes (respect `effectiveSideBarWidth`)
- `comparisonMode = false` → normal editor, no regression

**Manual test steps**:
1. DevTools → Pinia → set `comparisonMode = true`, `comparisonFileA = '/home/user/a.md'`
2. Editor splits; pane A header shows `a.md`
3. Set `comparisonMode = false` → normal editor returns

<details>
<summary>Prompt for coding agent</summary>

```
In /home/bk1/workspace/tools/marktext/src/renderer/src/components/editorWithTabs/index.vue:

1. Import useLayoutStore and destructure comparisonMode, comparisonFileA,
   comparisonFileB, exitComparison.
2. Add computed helpers:
     const fileNameA = computed(() => comparisonFileA.value?.split(/[\\/]/).pop() ?? 'File A')
     const fileNameB = computed(() => comparisonFileB.value?.split(/[\\/]/).pop() ?? 'File B')
3. Wrap the entire existing template content in <template v-if="!comparisonMode">.
4. Add <template v-else> with:
   <div class="comparison-container">
     <div class="comparison-pane">
       <div class="comparison-header">
         {{ fileNameA }}
         <span class="comparison-path">{{ comparisonFileA }}</span>
         <button class="comparison-close" @click="exitComparison">✕</button>
       </div>
       <div class="comparison-body">No file loaded</div>
     </div>
     <div class="comparison-divider"></div>
     <div class="comparison-pane">
       <div class="comparison-header">{{ fileNameB }}
         <span class="comparison-path">{{ comparisonFileB }}</span>
       </div>
       <div class="comparison-body">No file loaded</div>
     </div>
   </div>
5. Add scoped CSS:
   .comparison-container { display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden; }
   .comparison-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
   .comparison-header { height: 36px; padding: 0 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--el-border-color); flex-shrink: 0; }
   .comparison-path { font-weight: 400; opacity: 0.6; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
   .comparison-close { margin-left: auto; background: none; border: none; cursor: pointer; opacity: 0.6; }
   .comparison-close:hover { opacity: 1; }
   .comparison-divider { width: 1px; background: var(--el-border-color); flex-shrink: 0; }
   .comparison-body { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; color: var(--el-text-color-secondary); }

Do not modify anything inside the v-if="!comparisonMode" block.
```
</details>

---

### S3 — Render Markdown Content in Comparison Panes
**Status**: ⬜ Not started  
**Category**: MVP (first real user value)  
**Branch**: `feat/comparison-render`  
**Commit**: `feat(comparison): render markdown files as HTML in comparison panes using markdown-it`

**User value**: Users can actually read both files side by side. This is the first genuinely useful comparison slice.

**Technical objective**: Create `comparisonPane.vue` that reads a file via IPC, renders it as HTML using `markdown-it` (add as new dependency), and displays in the pane body.

**⚠️ INVESTIGATE FIRST (D5)**: Confirm exact renderer-side API for reading a file. Check `src/preload/index.ts` and `src/types/global.d.ts`.

**Code areas**:
- `src/renderer/src/components/editorWithTabs/comparisonPane.vue` — create
- `src/renderer/src/components/editorWithTabs/index.vue` — replace S2 placeholders
- `package.json` — add `markdown-it` + `@types/markdown-it`

**Dependencies**: S1, S2  
**Risks**: Medium — new dependency; confirm it bundles with electron-vite ESM renderer. `v-html` XSS risk — use `html: false` in markdown-it options.

**Acceptance criteria**:
- Both panes render markdown as HTML (headings, lists, code blocks, bold/italic, tables)
- Long files are independently scrollable in each pane
- Invalid / missing path shows an error message in that pane
- Files reload when `filePath` prop changes
- Normal editing mode completely unaffected

**Manual test steps**:
1. DevTools → Pinia → set `comparisonMode = true`, set both file paths to real `.md` files
2. Both files render as HTML
3. Scroll each pane independently
4. Set a nonexistent path → error state in that pane

<details>
<summary>Prompt for coding agent</summary>

```
In MarkText (/home/bk1/workspace/tools/marktext):

1. Run: pnpm add markdown-it && pnpm add -D @types/markdown-it

2. INVESTIGATE FIRST (D5): Check src/preload/index.ts and src/types/global.d.ts
   to find the exact renderer-side call for reading a file by path. Use whatever
   the existing codebase uses in src/renderer/src/ for file reads.

3. Create src/renderer/src/components/editorWithTabs/comparisonPane.vue:
   Props: filePath: string | null
   State: rawContent: ref(''), renderedHtml: ref(''), loading: ref(false), error: ref<string|null>(null)
   Behavior: watchEffect — when filePath changes, read file via the IPC call
   found above, render with markdown-it({ html: false, linkify: true, typographer: true }),
   store result in renderedHtml. Show loading spinner / error state as appropriate.
   Template: scrollable wrapper (ref="scrollContainer") containing
   <div class="comparison-content" v-html="renderedHtml">
   defineExpose:
     rawContent (for S6 diff)
     scrollPercent getter: scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight)
     scrollToPercent(pct: number): scrollContainer.scrollTop = pct * (scrollContainer.scrollHeight - scrollContainer.clientHeight)
   CSS: .comparison-content { padding: 24px; max-width: 720px; margin: 0 auto; line-height: 1.7; font-size: 15px; }
        (add basic heading, code, blockquote styles)

4. In src/renderer/src/components/editorWithTabs/index.vue, replace both
   .comparison-body placeholder divs with:
     <ComparisonPane :file-path="comparisonFileA" ref="paneARef" />
     <ComparisonPane :file-path="comparisonFileB" ref="paneBRef" />

Do not touch anything in the normal editor path.
```
</details>

---

### S4 — "Compare Files…" Menu Command
**Status**: ⬜ Not started  
**Category**: MVP  
**Branch**: `feat/compare-files-menu`  
**Commit**: `feat(menu): add File > Compare Files and View > Exit Comparison`

**User value**: Users can trigger comparison from the menu without needing DevTools. This ties the whole comparison feature together end-to-end.

**Technical objective**: `File > Compare Files…` opens two sequential file dialogs. On completion, fires IPC to call `enterComparison`. `View > Exit Comparison` and the header ✕ button both call `exitComparison`.

**Code areas**:
- `src/main/menu/templates/file.ts` — add Compare Files item
- `src/main/menu/actions/file.ts` — add dialog handler
- `src/main/menu/templates/view.ts` — add Exit Comparison item
- `src/renderer/src/store/layout.ts` — IPC listeners for `mt::enter-comparison` and `mt::exit-comparison`

**Dependencies**: S1, S2, S3  
**Risks**: Low — menu additions are well-understood in this codebase

**Acceptance criteria**:
- `File > Compare Files…` in the File menu
- Clicking opens File A picker (`.md` files filtered), then File B picker; canceling either does nothing
- Both files load in comparison view
- `View > Exit Comparison` and header ✕ button both return to normal editor
- After exit, current file and normal editor state are unaffected

**Manual test steps**:
1. File > Compare Files… → pick two `.md` files → comparison renders
2. View > Exit Comparison → back to normal editor
3. Repeat; press Cancel on second dialog → nothing opens

<details>
<summary>Prompt for coding agent</summary>

```
In MarkText (/home/bk1/workspace/tools/marktext):

1. src/main/menu/templates/file.ts: Add { type: 'separator' } and a new item
   "Compare Files…" after the existing open items. Click handler sends IPC
   mt::compare-files-dialog to the focused window (match the existing click
   handler pattern in this file).

2. In the appropriate main-process file, handle mt::compare-files-dialog:
   - dialog.showOpenDialog(win, { title: 'Select File A – Compare',
       properties: ['openFile'],
       filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }] })
   - If filePaths is empty, return
   - dialog.showOpenDialog(win, { title: 'Select File B – Compare', ... })
   - If filePaths is empty, return
   - win.webContents.send('mt::enter-comparison', { fileA, fileB })

3. src/main/menu/templates/view.ts: Add "Exit Comparison" item that sends
   mt::exit-comparison to the renderer.

4. src/renderer/src/store/layout.ts: Add IPC listeners (follow the pattern of
   LISTEN_FOR_NEW_TAB in editor.ts):
   - mt::enter-comparison → enterComparison(data.fileA, data.fileB)
   - mt::exit-comparison → exitComparison()
   Call the setup function from App.vue or wherever the editor store listeners
   are initialized.

5. The ✕ button in the comparison header already calls exitComparison() from S2.
   Verify it still works end-to-end.
```
</details>

---

### S5 — Synchronized Scrolling Between Panes
**Status**: ⬜ Not started  
**Category**: QoL  
**Branch**: `feat/comparison-sync-scroll`  
**Commit**: `feat(comparison): proportional synchronized scroll between comparison panes`

**User value**: Reading parallel sections of two files without manually scrolling each pane.

**Technical objective**: When sync is enabled, scrolling one pane applies a proportional (percentage-based) scroll to the other. Include a toggle button. Use a lock flag to prevent infinite scroll loops.

**Code areas**:
- `src/renderer/src/components/editorWithTabs/comparisonPane.vue` — scroll container ref, `scrollPercent`, `scrollToPercent` (stubbed in S3)
- `src/renderer/src/components/editorWithTabs/index.vue` — event coordination between two pane refs

**Dependencies**: S3  
**Risks**: Medium — scroll sync loops are a classic bug. Mitigate with `isSyncing` lock flag. Note: `debouncedSendBufferedState()` in editor store persists scroll per tab; comparison panes have no tab object, so no conflict.

**Acceptance criteria**:
- Sync ON: scroll pane A to 40% → pane B scrolls to 40%
- Sync is percentage-based (files of different lengths align at relative positions)
- No scroll jitter or infinite loop
- Sync OFF: panes scroll independently
- Toggle button updates visual state correctly

**Manual test steps**:
1. Open two files of different lengths in comparison mode
2. Enable sync scroll
3. Scroll pane A to middle → pane B scrolls to its middle
4. Scroll pane B to bottom → pane A scrolls to its bottom
5. Disable sync → scroll pane A, pane B stays put

<details>
<summary>Prompt for coding agent</summary>

```
In MarkText (/home/bk1/workspace/tools/marktext):

1. In src/renderer/src/components/editorWithTabs/comparisonPane.vue:
   - Ensure scrollContainer is a template ref on the outermost scrollable div
   - Emit 'scroll' from @scroll handler on that div
   - In defineExpose, implement:
       scrollPercent getter:
         scrollContainer.value.scrollTop /
         (scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight)
       scrollToPercent(pct: number):
         scrollContainer.value.scrollTop =
           pct * (scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight)

2. In src/renderer/src/components/editorWithTabs/index.vue:
   - Add state: const syncScroll = ref(true), const isSyncing = ref(false)
   - Template refs paneARef and paneBRef already exist from S3
   - Handle @scroll from pane A:
       function onPaneAScroll() {
         if (!syncScroll.value || isSyncing.value) return
         isSyncing.value = true
         nextTick(() => {
           paneBRef.value?.scrollToPercent(paneARef.value?.scrollPercent ?? 0)
           nextTick(() => { isSyncing.value = false })
         })
       }
     Mirror exactly for pane B scroll.
   - Add a sync toggle button in the comparison header (between the two pane headers).
     Icon: 🔗 when synced, 🔓 when not. Clicking toggles syncScroll.
     Use el-tooltip with content "Sync Scroll".
```
</details>

---

### S6 — Diff Highlighting in Comparison Panes
**Status**: ⬜ Not started  
**Category**: Nice-to-have  
**Branch**: `feat/comparison-diff-highlight`  
**Commit**: `feat(comparison): line-level diff highlighting between comparison panes`

**User value**: Users immediately see what changed between two versions — added paragraphs highlighted green, removed red. The "wow" feature.

**⚠️ INVESTIGATE FIRST**: Confirm `diff` npm package bundles correctly with electron-vite's renderer ESM target. Check `electron.vite.config.js` for any CommonJS transform restrictions.

**Technical objective**: Compute a line-level diff using the `diff` npm package. Annotate rendered HTML block elements with CSS diff classes. Provide a toggle.

**Code areas**:
- `src/renderer/src/components/editorWithTabs/comparisonPane.vue` — accept diff annotations, post-process rendered HTML
- `src/renderer/src/components/editorWithTabs/index.vue` — compute diff, pass to panes, add toggle button
- `package.json` — add `diff` package

**Dependencies**: S3, S4  
**Risks**: 🔴 High — mapping diff line ranges to rendered HTML blocks is inherently approximate. Markdown rendering does not preserve 1:1 line correspondence. Multi-line blocks (fenced code, tables) will misalign. **Paragraph-level granularity only for MVP; document the approximation in a code comment.**

**Acceptance criteria**:
- Paragraphs in file B but not A: green background in pane B
- Paragraphs in file A but not B: red background in pane A
- Modified paragraphs: yellow background in both panes
- Identical paragraphs: no highlight
- Diff toggle shows/hides highlights without re-rendering
- Identical files → no highlights

**Manual test steps**:
1. Prepare `a.md` and `b.md` — b has one paragraph added, one removed, one changed
2. Open in comparison, enable diff highlight
3. Verify green/red/yellow in correct positions
4. Toggle off → highlights gone; toggle on → reappear
5. Two identical files → no highlights

<details>
<summary>Prompt for coding agent</summary>

```
In MarkText (/home/bk1/workspace/tools/marktext):

1. Run: pnpm add diff && pnpm add -D @types/diff
   INVESTIGATE: Confirm diff bundles with electron-vite ESM renderer target
   (check electron.vite.config.js).

2. In src/renderer/src/components/editorWithTabs/index.vue:
   - Add state: const showDiff = ref(false)
   - Watch for when both paneARef.value?.rawContent and paneBRef.value?.rawContent
     are non-empty, then:
       import { diffLines } from 'diff'
       const changes = diffLines(rawA, rawB)
       // Transform into annotationsA: { type: 'removed'|'unchanged', lineCount: number }[]
       // Transform into annotationsB: { type: 'added'|'unchanged', lineCount: number }[]
   - Pass annotationsA, annotationsB, showDiff as props to each ComparisonPane
   - Add a "Show Diff" toggle button in the comparison header area

3. In src/renderer/src/components/editorWithTabs/comparisonPane.vue:
   - Accept props: diffAnnotations: Array<{type: string, lineCount: number}>, showDiff: boolean
   - After rendering markdown to HTML, if showDiff is true, post-process the HTML
     string: iterate top-level block elements (<p>, <h1>–<h6>, <ul>, <ol>,
     <blockquote>, <pre>) in order, match to annotation entries, and wrap:
       <div class="diff-block diff-added">...block HTML...</div>
   - Add comment: // NOTE: block-to-diff-line mapping is approximate; complex
     // structures (tables, nested lists, fenced code) may misalign.
   - CSS:
     .diff-added    { background: rgba(40,167,69,0.15);  border-left: 3px solid rgba(40,167,69,0.6);  padding-left: 6px; margin-left: -9px; }
     .diff-removed  { background: rgba(220,53,69,0.15);  border-left: 3px solid rgba(220,53,69,0.6);  padding-left: 6px; margin-left: -9px; }
     .diff-changed  { background: rgba(200,150,0,0.12);  border-left: 3px solid rgba(200,150,0,0.5);  padding-left: 6px; margin-left: -9px; }
```
</details>

---

## Completed Slices

*(Move slices here when done, with the PR/commit link and date.)*

| Slice | Completed | Commit/PR |
|-------|-----------|-----------|
| — | — | — |

---

## Notes and Decisions Log

*(Add any decisions, gotchas, or design pivots here during development.)*

- **2026-05-25**: Plan created. All slices are pending. Run D1–D5 discovery tasks before writing any code.
- Muya has no `readOnly` mode — comparison panes must use `markdown-it` (not Muya) to avoid the two-instance DOM problem.
- `diff` package not yet in `package.json` — must be added before S6.
- `markdown-it` not yet in `package.json` — must be added before S3.
