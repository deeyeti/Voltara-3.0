/**
 * Persistent key-value storage via JSON files in userData directory.
 * Each key maps to a separate JSON file: e.g. "chat_history" -> chat_history.json
 */
import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

let storageDir = null

export function registerStorageHandlers(appDataPath) {
  storageDir = appDataPath
  // Ensure directory exists
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true })
  }

  // Get a stored value by key
  ipcMain.handle('storage:get', (event, key) => {
    try {
      const filePath = join(storageDir, `${key}.json`)
      if (!existsSync(filePath)) return null
      const raw = readFileSync(filePath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

  // Set a stored value by key
  ipcMain.handle('storage:set', (event, key, value) => {
    try {
      const filePath = join(storageDir, `${key}.json`)
      writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Delete a stored key
  ipcMain.handle('storage:delete', (event, key) => {
    try {
      const filePath = join(storageDir, `${key}.json`)
      if (existsSync(filePath)) unlinkSync(filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
