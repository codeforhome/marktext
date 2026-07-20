import path from 'path'
import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getShowInFolder,
  getSelectForCompare,
  getCompareWith
} from './menuItems'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean,
  // Absent for the root-folder menu, which offers no compare entries.
  fileInfo?: { isMarkdown: boolean; pathname: string; name: string },
  compareCandidate?: string | null
): void => {
  const contextItems: ContextMenuItem[] = [
    getNewFile(),
    getNewDirectory(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getShowInFolder()
  ]

  // PASTE entry (index 5) toggles based on the cached source path.
  contextItems[5].enabled = hasPathCache

  // Compare items — only for markdown files
  if (fileInfo?.isMarkdown) {
    contextItems.push(SEPARATOR)
    contextItems.push(getSelectForCompare(fileInfo.pathname))
    if (compareCandidate && compareCandidate !== fileInfo.pathname) {
      contextItems.push(getCompareWith(fileInfo.pathname, path.basename(compareCandidate)))
    }
  }

  const items: ContextMenuItem[] = contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
