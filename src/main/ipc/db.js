// IPC handlers for database operations — ESM
import { ipcMain } from 'electron'
import { basename } from 'path'
import { getDatabase, saveDatabase } from '../db/schema.js'

export function registerDbHandlers(appDataPath) {

  ipcMain.handle('db:insert-records', (event, { records, sourceFile }) => {
    const db = getDatabase()
    if (!db) return { success: false, error: 'Database not initialized' }

    try {
      const now = new Date().toISOString()
      let insertedCount = 0

      for (const record of records) {
        db.run(
          `INSERT INTO cable_records (
            source_file, manufacturer, part_number, cable_type, size,
            voltage_rating, current_rating, material, insulation, jacket,
            color, price, currency, unit, standard, date_extracted,
            catalog_date, notes, raw_json
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            sourceFile || '',
            record.manufacturer || '',
            record.part_number || '',
            record.cable_type || '',
            record.size || '',
            record.voltage_rating || '',
            record.current_rating || '',
            record.material || '',
            record.insulation || '',
            record.jacket || '',
            record.color || '',
            parseFloat(record.price) || null,
            record.currency || 'USD',
            record.unit || '',
            record.standard || '',
            now,
            record.catalog_date || '',
            record.notes || '',
            JSON.stringify(record)
          ]
        )
        insertedCount++
      }

      db.run(
        `INSERT INTO source_files (file_name, file_path, date_imported, records_count, status)
         VALUES (?,?,?,?,'completed')`,
        [basename(sourceFile || ''), sourceFile || '', now, insertedCount]
      )

      saveDatabase(appDataPath)
      return { success: true, insertedCount }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:get-records', (event, filters = {}) => {
    const db = getDatabase()
    if (!db) return { success: false, data: [], total: 0 }

    try {
      let query = 'SELECT * FROM cable_records WHERE 1=1'
      const params = []

      const addFilter = (field, val) => {
        query += ` AND ${field} LIKE ?`
        params.push(`%${val}%`)
      }

      if (filters.manufacturer) addFilter('manufacturer', filters.manufacturer)
      if (filters.cable_type) addFilter('cable_type', filters.cable_type)
      if (filters.voltage_rating) addFilter('voltage_rating', filters.voltage_rating)
      if (filters.material) addFilter('material', filters.material)

      if (filters.search) {
        query += ' AND (manufacturer LIKE ? OR part_number LIKE ? OR cable_type LIKE ? OR size LIKE ?)'
        const s = `%${filters.search}%`
        params.push(s, s, s, s)
      }

      if (filters.minPrice !== undefined && filters.minPrice !== '') {
        query += ' AND price >= ?'
        params.push(parseFloat(filters.minPrice))
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        query += ' AND price <= ?'
        params.push(parseFloat(filters.maxPrice))
      }

      const allowed = ['id','manufacturer','part_number','cable_type','size','voltage_rating','price','date_extracted']
      const sf = allowed.includes(filters.sortField) ? filters.sortField : 'id'
      const sd = filters.sortDir === 'asc' ? 'ASC' : 'DESC'
      query += ` ORDER BY ${sf} ${sd}`

      // Build parameterized query for sql.js
      const result = db.exec(query, params)
      const data = result.length > 0 ? result[0].values.map(row => {
        const obj = {}
        result[0].columns.forEach((col, i) => { obj[col] = row[i] })
        return obj
      }) : []

      return { success: true, data, total: data.length }
    } catch (err) {
      console.error('DB get-records error:', err)
      return { success: false, data: [], error: err.message }
    }
  })

  ipcMain.handle('db:export-csv', async (event, { filters = {}, destPath }) => {
    const db = getDatabase()
    if (!db) return { success: false, error: 'Database not initialized' }

    try {
      const { writeFileSync } = await import('fs')
      const result = db.exec(`
        SELECT id, manufacturer, part_number, cable_type, size, voltage_rating,
               current_rating, material, insulation, jacket, color, price, currency,
               unit, standard, catalog_date, source_file, date_extracted, notes
        FROM cable_records ORDER BY manufacturer, cable_type, size
      `)

      const data = result.length > 0 ? result[0].values.map(row => {
        const obj = {}
        result[0].columns.forEach((col, i) => { obj[col] = row[i] })
        return obj
      }) : []

      // Build CSV manually (avoid importing papaparse which might have issues)
      const headers = result.length > 0 ? result[0].columns : []
      const csvLines = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
          const v = row[h]
          if (v === null || v === undefined) return ''
          const s = String(v)
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"` : s
        }).join(','))
      ]
      writeFileSync(destPath, csvLines.join('\n'), 'utf-8')

      return { success: true, recordCount: data.length, destPath }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:get-schema', () => ({
    columns: [
      { key: 'id', label: 'ID', type: 'number' },
      { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { key: 'part_number', label: 'Part Number', type: 'text' },
      { key: 'cable_type', label: 'Cable Type', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'voltage_rating', label: 'Voltage Rating', type: 'text' },
      { key: 'current_rating', label: 'Current Rating', type: 'text' },
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'insulation', label: 'Insulation', type: 'text' },
      { key: 'jacket', label: 'Jacket', type: 'text' },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'standard', label: 'Standard', type: 'text' },
      { key: 'catalog_date', label: 'Catalog Date', type: 'text' },
      { key: 'source_file', label: 'Source File', type: 'text' },
      { key: 'date_extracted', label: 'Date Extracted', type: 'text' }
    ]
  }))

  ipcMain.handle('db:get-stats', () => {
    const db = getDatabase()
    if (!db) return { totalRecords: 0, manufacturers: 0, sourceFiles: 0 }
    try {
      const r1 = db.exec('SELECT COUNT(*) FROM cable_records')
      const r2 = db.exec('SELECT COUNT(DISTINCT manufacturer) FROM cable_records WHERE manufacturer != ""')
      const r3 = db.exec('SELECT COUNT(*) FROM source_files')
      return {
        totalRecords: r1[0]?.values[0][0] || 0,
        manufacturers: r2[0]?.values[0][0] || 0,
        sourceFiles: r3[0]?.values[0][0] || 0
      }
    } catch { return { totalRecords: 0, manufacturers: 0, sourceFiles: 0 } }
  })

  ipcMain.handle('db:delete-record', (event, id) => {
    const db = getDatabase()
    if (!db) return { success: false }
    try {
      db.run('DELETE FROM cable_records WHERE id = ?', [id])
      saveDatabase(appDataPath)
      return { success: true }
    } catch (err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('db:update-record', (event, { id, field, value }) => {
    const db = getDatabase()
    if (!db) return { success: false }
    try {
      const allowed = ['manufacturer','part_number','cable_type','size','voltage_rating','current_rating','material','insulation','jacket','color','price','currency','unit','standard','catalog_date','notes']
      if (!allowed.includes(field)) return { success: false, error: 'Invalid field' }
      db.run(`UPDATE cable_records SET ${field} = ? WHERE id = ?`, [value, id])
      saveDatabase(appDataPath)
      return { success: true }
    } catch (err) { return { success: false, error: err.message } }
  })
}
