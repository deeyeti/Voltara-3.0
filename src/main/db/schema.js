// CableVault - SQLite schema using sql.js (pure WASM, no native build)
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

let db = null
let SQL = null

export async function initDatabase(appDataPath) {
  if (db) return db

  // Dynamic import of sql.js (CJS module)
  const { default: initSqlJs } = await import('sql.js')
  SQL = await initSqlJs()

  const dbPath = join(appDataPath, 'cablevault.db')

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS cable_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT,
      manufacturer TEXT,
      part_number TEXT,
      cable_type TEXT,
      size TEXT,
      voltage_rating TEXT,
      current_rating TEXT,
      material TEXT,
      insulation TEXT,
      jacket TEXT,
      color TEXT,
      price REAL,
      currency TEXT DEFAULT 'USD',
      unit TEXT,
      standard TEXT,
      date_extracted TEXT,
      catalog_date TEXT,
      notes TEXT,
      raw_json TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS source_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT,
      file_path TEXT,
      date_imported TEXT,
      records_count INTEGER,
      status TEXT
    )
  `)

  saveDatabase(appDataPath)
  return db
}

export function saveDatabase(appDataPath) {
  if (!db) return
  const dbPath = join(appDataPath, 'cablevault.db')
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

export function getDatabase() {
  return db
}
