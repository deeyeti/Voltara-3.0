import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Download, Filter, RefreshCw, ChevronUp, ChevronDown,
  ChevronsUpDown, LayoutGrid, Trash2, Pencil, Check,
  X, Search, ChevronRight, Layers, BarChart3, Eye, EyeOff
} from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(val) {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

function formatPrice(p) {
  if (!p && p !== 0) return '—'
  return Number(p).toFixed(2)
}

// ─── Column Definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'id', label: 'ID', type: 'number', width: 60 },
  { key: 'manufacturer', label: 'Manufacturer', type: 'text', width: 140 },
  { key: 'part_number', label: 'Part #', type: 'text', width: 110 },
  { key: 'cable_type', label: 'Type', type: 'text', width: 120 },
  { key: 'size', label: 'Size', type: 'text', width: 90 },
  { key: 'voltage_rating', label: 'Voltage', type: 'text', width: 90 },
  { key: 'current_rating', label: 'Current', type: 'text', width: 85 },
  { key: 'material', label: 'Material', type: 'text', width: 90 },
  { key: 'insulation', label: 'Insulation', type: 'text', width: 100 },
  { key: 'jacket', label: 'Jacket', type: 'text', width: 85 },
  { key: 'color', label: 'Color', type: 'text', width: 80 },
  { key: 'price', label: 'Price', type: 'number', width: 80 },
  { key: 'currency', label: 'Currency', type: 'text', width: 75 },
  { key: 'unit', label: 'Unit', type: 'text', width: 90 },
  { key: 'standard', label: 'Standard', type: 'text', width: 100 },
  { key: 'catalog_date', label: 'Catalog Date', type: 'text', width: 100 },
  { key: 'source_file', label: 'Source File', type: 'text', width: 140 },
  { key: 'date_extracted', label: 'Extracted', type: 'text', width: 100 },
  { key: 'notes', label: 'Notes', type: 'text', width: 140 }
]

const DEFAULT_VISIBLE = ['manufacturer', 'part_number', 'cable_type', 'size', 'voltage_rating', 'current_rating', 'material', 'insulation', 'price', 'currency', 'standard']

// ─── Inline Edit Cell ─────────────────────────────────────────────────────────
function EditableCell({ value, rowId, field, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const save = async () => {
    if (val !== value) await onSave(rowId, field, val)
    setEditing(false)
  }

  if (editing) {
    return (
      <td style={{ padding: '2px 4px' }}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="input input-sm"
            style={{ width: '100%', fontSize: 12 }}
          />
          <button className="btn btn-ghost btn-sm btn-icon" onClick={save}><Check size={11} style={{ color: 'var(--accent-green)' }} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(false)}><X size={11} /></button>
        </div>
      </td>
    )
  }

  return (
    <td
      className="editable"
      onDoubleClick={() => { setVal(value); setEditing(true) }}
      title="Double-click to edit"
    >
      {fmt(value)}
    </td>
  )
}

// ─── Main DataView ────────────────────────────────────────────────────────────
export default function DataView({ onStatsChange }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ search: '', manufacturer: '', cable_type: '', voltage_rating: '', material: '', minPrice: '', maxPrice: '' })
  const [sortField, setSortField] = useState('id')
  const [sortDir, setSortDir] = useState('asc')
  const [visibleCols, setVisibleCols] = useState(new Set(DEFAULT_VISIBLE))
  const [groupBy, setGroupBy] = useState('')
  const [showColPanel, setShowColPanel] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [sortField, sortDir])

  const loadRecords = async () => {
    if (!window.api) return
    setLoading(true)
    const result = await window.api.db.getRecords({ ...filters, sortField, sortDir })
    if (result.success) {
      setRecords(result.data)
      // Update stats
      const stats = await window.api.db.getStats()
      onStatsChange?.(stats)
    }
    setLoading(false)
  }

  const applyFilters = () => loadRecords()

  const clearFilters = () => {
    setFilters({ search: '', manufacturer: '', cable_type: '', voltage_rating: '', material: '', minPrice: '', maxPrice: '' })
    setGroupBy('')
    setTimeout(loadRecords, 0)
  }

  const handleSort = (col) => {
    if (sortField === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(col); setSortDir('asc') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return
    await window.api.db.deleteRecord(id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const handleSaveCell = async (id, field, value) => {
    await window.api.db.updateRecord(id, field, value)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleExportCSV = async () => {
    const r = await window.api.files.saveDialog({ defaultPath: 'cable_data.csv' })
    if (!r.canceled) {
      const result = await window.api.db.exportCsv(filters, r.filePath)
      if (result.success) alert(`✅ Exported ${result.recordCount} records to:\n${result.destPath}`)
      else alert(`❌ Export failed: ${result.error}`)
    }
  }

  const toggleCol = (key) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ─── Pivot/Group processing ─────────────────────────────────────────────
  const processedRows = useMemo(() => {
    if (!groupBy) return records.map(r => ({ ...r, _isGroup: false }))

    const groups = {}
    records.forEach(r => {
      const key = r[groupBy] || '(blank)'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    const rows = []
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, recs]) => {
      // Group header
      const totalPrice = recs.reduce((s, r) => s + (parseFloat(r.price) || 0), 0)
      rows.push({
        _isGroup: true,
        _groupKey: key,
        _count: recs.length,
        _totalPrice: totalPrice,
        [groupBy]: key
      })
      rows.push(...recs.map(r => ({ ...r, _isGroup: false })))
    })
    return rows
  }, [records, groupBy])

  const visibleColDefs = ALL_COLUMNS.filter(c => visibleCols.has(c.key))

  const SortIcon = ({ col }) => {
    if (sortField !== col) return <ChevronsUpDown size={10} style={{ opacity: 0.4 }} />
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length

  return (
    <div className="data-view">
      {/* Toolbar */}
      <div className="data-toolbar">
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input input-sm"
            placeholder="Search all fields..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            style={{ paddingLeft: 30, width: '100%' }}
          />
        </div>

        {/* Filter toggle */}
        <button className={`btn btn-sm ${showFilterPanel ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilterPanel(v => !v)}>
          <Filter size={12} />
          Filters {activeFilterCount > 0 && <span className="badge badge-blue" style={{ padding: '1px 5px' }}>{activeFilterCount}</span>}
        </button>

        {/* Group by */}
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: 'var(--text-muted)' }} />
          <select
            className="input input-sm"
            value={groupBy}
            onChange={e => setGroupBy(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="">No grouping</option>
            {['manufacturer', 'cable_type', 'voltage_rating', 'material', 'insulation', 'standard'].map(k => (
              <option key={k} value={k}>{ALL_COLUMNS.find(c => c.key === k)?.label || k}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Stats pill */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Loading...' : `${records.length} records`}
          {groupBy && ` · grouped by ${groupBy}`}
        </span>

        {/* Column toggle */}
        <button className={`btn btn-sm ${showColPanel ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowColPanel(v => !v)}>
          <LayoutGrid size={12} /> Columns
        </button>

        {/* Edit mode */}
        <button className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditMode(v => !v)}>
          <Pencil size={12} /> {editMode ? 'Editing' : 'Edit'}
        </button>

        {/* Refresh */}
        <button className="btn btn-secondary btn-sm btn-icon" onClick={loadRecords} title="Refresh">
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>

        {/* Export */}
        <button className="btn btn-primary btn-sm" onClick={handleExportCSV}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-normal)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          {[
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'cable_type', label: 'Cable Type' },
            { key: 'voltage_rating', label: 'Voltage Rating' },
            { key: 'material', label: 'Material' }
          ].map(f => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{f.label}</label>
              <input
                className="input input-sm"
                placeholder={`Filter ${f.label}...`}
                value={filters[f.key]}
                onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: 150 }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price Range</label>
            <div className="flex items-center gap-2">
              <input className="input input-sm" placeholder="Min" value={filters.minPrice} onChange={e => setFilters(p => ({ ...p, minPrice: e.target.value }))} style={{ width: 70 }} type="number" />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>
              <input className="input input-sm" placeholder="Max" value={filters.maxPrice} onChange={e => setFilters(p => ({ ...p, maxPrice: e.target.value }))} style={{ width: 70 }} type="number" />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Data grid */}
        <div className="data-grid-wrap">
          {records.length === 0 && !loading ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <BarChart3 size={48} style={{ opacity: 0.2 }} />
              <div className="empty-state-title">No records yet</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, textAlign: 'center' }}>
                Upload a cable catalog PDF in the AI Chat view to extract and store cable data here.
              </p>
            </div>
          ) : (
            <table className="data-grid">
              <thead>
                <tr>
                  {visibleColDefs.map(col => (
                    <th
                      key={col.key}
                      style={{ minWidth: col.width }}
                      className={sortField === col.key ? `sort-${sortDir}` : ''}
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                  {editMode && <th style={{ width: 70 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {processedRows.map((row, ri) => {
                  if (row._isGroup) {
                    return (
                      <tr key={`group-${row._groupKey}`} className="group-header-row">
                        <td colSpan={visibleColDefs.length + (editMode ? 1 : 0)} style={{ paddingLeft: 16 }}>
                          <div className="flex items-center gap-3">
                            <ChevronRight size={13} />
                            <strong>{row._groupKey}</strong>
                            <span className="badge badge-blue">{row._count} records</span>
                            {row._totalPrice > 0 && (
                              <span className="badge badge-green">
                                Total: {row._totalPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={row.id || ri}>
                      {visibleColDefs.map(col => {
                        const cellVal = col.key === 'price' ? formatPrice(row[col.key]) : fmt(row[col.key])
                        if (editMode && col.key !== 'id' && col.key !== 'date_extracted') {
                          return (
                            <EditableCell
                              key={col.key}
                              value={row[col.key]}
                              rowId={row.id}
                              field={col.key}
                              onSave={handleSaveCell}
                            />
                          )
                        }
                        return <td key={col.key} title={cellVal}>{cellVal}</td>
                      })}
                      {editMode && (
                        <td>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => handleDelete(row.id)}
                            title="Delete record"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Column toggle panel */}
        {showColPanel && (
          <div className="col-toggle-panel">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Visible Columns
            </div>
            <div style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setVisibleCols(new Set(ALL_COLUMNS.map(c => c.key)))}>All</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))}>Default</button>
            </div>
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="col-toggle-item">
                <input
                  type="checkbox"
                  checked={visibleCols.has(col.key)}
                  onChange={() => toggleCol(col.key)}
                />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)', display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
        <span>{records.length} records displayed</span>
        {groupBy && <span>Grouped by: <strong style={{ color: 'var(--text-secondary)' }}>{groupBy}</strong></span>}
        {activeFilterCount > 0 && <span>{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}</span>}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10 }}>Double-click a cell to edit · Click headers to sort</span>
      </div>
    </div>
  )
}
