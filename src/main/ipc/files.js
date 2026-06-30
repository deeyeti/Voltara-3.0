// IPC handlers for file system operations — ESM
import { ipcMain, dialog, shell } from 'electron'
import { readdirSync, statSync, readFileSync, accessSync } from 'fs'
import { join, extname, basename } from 'path'
import { homedir } from 'os'

export function registerFileHandlers() {

  ipcMain.handle('files:list-dir', (event, dirPath) => {
    try {
      const items = readdirSync(dirPath, { withFileTypes: true })
      return {
        success: true,
        path: dirPath,
        items: items.map(item => {
          const fullPath = join(dirPath, item.name)
          let size = null, modified = null
          try {
            const stat = statSync(fullPath)
            size = stat.size
            modified = stat.mtime.toISOString()
          } catch {}
          return {
            name: item.name,
            isDir: item.isDirectory(),
            path: fullPath,
            ext: item.isDirectory() ? null : extname(item.name).toLowerCase(),
            size: item.isDirectory() ? null : size,
            modified
          }
        })
      }
    } catch (err) {
      return { success: false, error: err.message, items: [] }
    }
  })

  ipcMain.handle('files:get-home', () => {
    const home = homedir()
    return {
      home,
      desktop: join(home, 'Desktop'),
      documents: join(home, 'Documents'),
      downloads: join(home, 'Downloads')
    }
  })

  ipcMain.handle('files:read-file', (event, filePath) => {
    try {
      const buffer = readFileSync(filePath)
      return {
        success: true,
        buffer: buffer.toString('base64'),
        name: basename(filePath),
        size: buffer.length
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('files:open-dialog', async (event, options = {}) => {
    const result = await dialog.showOpenDialog({
      properties: options.directory ? ['openDirectory'] : ['openFile', 'multiSelections'],
      filters: options.filters || [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: options.title || 'Select File'
    })
    return result
  })

  ipcMain.handle('files:save-dialog', async (event, options = {}) => {
    const result = await dialog.showSaveDialog({
      title: options.title || 'Save CSV',
      defaultPath: options.defaultPath || 'cable_data.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    return result
  })

  ipcMain.handle('files:open-external', async (event, filePath) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('files:get-drives', () => {
    const drives = []
    for (let i = 65; i <= 90; i++) {
      const drive = `${String.fromCharCode(i)}:\\`
      try {
        accessSync(drive)
        drives.push({ name: `${String.fromCharCode(i)}:`, path: drive })
      } catch {}
    }
    return drives
  })
}
