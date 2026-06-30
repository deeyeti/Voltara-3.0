import { useState, useEffect } from 'react'
import {
  Folder, File, FileText, ChevronRight, ChevronDown,
  Home, HardDrive, Upload, ArrowLeft, ArrowUp,
  Monitor, Download, FolderOpen, Zap, RefreshCw
} from 'lucide-react'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString() } catch { return '' }
}

function getFileIcon(item) {
  if (item.isDir) return <Folder size={16} style={{ color: 'var(--accent-amber)' }} />
  const ext = item.ext || ''
  if (ext === '.pdf') return <FileText size={16} style={{ color: 'var(--accent-red)' }} />
  if (['.csv', '.xlsx', '.xls'].includes(ext)) return <File size={16} style={{ color: 'var(--accent-green)' }} />
  if (['.doc', '.docx'].includes(ext)) return <File size={16} style={{ color: '#3b82f6' }} />
  return <File size={16} style={{ color: 'var(--text-muted)' }} />
}

function QuickAccess({ homes, onNavigate }) {
  const links = [
    { icon: <Home size={14} />, label: 'Home', path: homes.home },
    { icon: <Monitor size={14} />, label: 'Desktop', path: homes.desktop },
    { icon: <FileText size={14} />, label: 'Documents', path: homes.documents },
    { icon: <Download size={14} />, label: 'Downloads', path: homes.downloads }
  ]

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-normal)' }}>
      <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Quick Access</div>
      {links.filter(l => l.path).map((l, i) => (
        <div key={i} className="tree-item" onClick={() => l.path && onNavigate(l.path)}>
          {l.icon}
          <span>{l.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function FileView({ onDataChanged }) {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [history, setHistory] = useState([])
  const [drives, setDrives] = useState([])
  const [homes, setHomes] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    loadRoots()
  }, [])

  const loadRoots = async () => {
    if (!window.api) return
    const h = await window.api.files.getHome()
    setHomes(h)
    const d = await window.api.files.getDrives()
    setDrives(d)
    if (h.home) navigate(h.home)
  }

  const navigate = async (path) => {
    if (!path || loading) return
    setLoading(true)
    setError('')
    setSelected(null)

    const result = await window.api.files.listDir(path)
    if (result.success) {
      if (currentPath) setHistory(prev => [...prev, currentPath])
      setCurrentPath(path)
      // Sort: dirs first, then by name
      const sorted = [...result.items].sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setItems(sorted)
    } else {
      setError(result.error || 'Cannot access this directory')
    }
    setLoading(false)
  }

  const goBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    navigate(prev)
  }

  const goUp = () => {
    if (!currentPath) return
    const parts = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/)
    if (parts.length <= 1) return
    parts.pop()
    const parent = parts.join('\\') || parts.join('/') || currentPath.charAt(0)
    navigate(parent || currentPath.slice(0, 3))
  }

  const getBreadcrumbs = () => {
    if (!currentPath) return []
    const parts = currentPath.split(/[/\\]/).filter(Boolean)
    const crumbs = []
    let acc = ''
    parts.forEach((p, i) => {
      acc = i === 0 ? p + '\\' : acc + p + '\\'
      crumbs.push({ label: p, path: acc })
    })
    return crumbs
  }

  const handleDoubleClick = (item) => {
    if (item.isDir) navigate(item.path)
    else if (item.ext === '.pdf') promptETL(item.path)
    else window.api.files.openExternal(item.path)
  }

  const promptETL = async (filePath) => {
    setProcessing(filePath)
    // Switch to chat and trigger ETL — for now open a prompt
    const confirmed = confirm(`Process "${filePath.split('\\').pop()}" as a cable catalog PDF?\n\nThis will run AI extraction on the file.`)
    if (confirmed) {
      // Dispatch ETL via parent
      onDataChanged?.({ action: 'etl', path: filePath })
    }
    setProcessing(null)
  }

  const openFile = async (item) => {
    if (!item.isDir) await window.api.files.openExternal(item.path)
  }

  const crumbs = getBreadcrumbs()

  return (
    <div className="file-view">
      {/* Sidebar */}
      <div className="file-tree-panel">
        {/* Drives */}
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-normal)' }}>
          <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Drives</div>
          {drives.map(d => (
            <div key={d.path} className={`tree-item ${currentPath.startsWith(d.path) ? 'active' : ''}`} onClick={() => navigate(d.path)}>
              <HardDrive size={14} />
              <span>{d.name}</span>
            </div>
          ))}
        </div>

        {/* Quick Access */}
        <QuickAccess homes={homes} onNavigate={navigate} />

        {/* Current folder sub-dirs */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Folders</div>
          {items.filter(i => i.isDir).slice(0, 30).map(item => (
            <div key={item.path} className="tree-item" onClick={() => navigate(item.path)}>
              <Folder size={13} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div className="file-main-panel">
        {/* Toolbar */}
        <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-normal)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={goBack} disabled={history.length === 0} title="Back"><ArrowLeft size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={goUp} disabled={!currentPath} title="Up"><ArrowUp size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(currentPath)} title="Refresh"><RefreshCw size={14} className={loading ? 'spin' : ''} /></button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            const r = await window.api.files.openDialog({ filters: [{ name: 'PDF', extensions: ['pdf'] }] })
            if (!r.canceled && r.filePaths?.[0]) promptETL(r.filePaths[0])
          }}>
            <Zap size={12} /> Process PDF
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="file-breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="breadcrumb-sep">›</span>}
              <span className="breadcrumb-part" onClick={() => navigate(c.path)}>{c.label}</span>
            </span>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--accent-red-dim)', borderBottom: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* File list */}
        {!error && (
          <div className="file-list">
            {loading && (
              <div className="flex items-center gap-3" style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                <RefreshCw size={14} className="spin" /> Loading...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="empty-state">
                <FolderOpen size={40} style={{ opacity: 0.3 }} />
                <span className="empty-state-title">Empty folder</span>
              </div>
            )}
            {!loading && items.map(item => (
              <div
                key={item.path}
                className={`file-list-item ${selected === item.path ? 'selected' : ''}`}
                onClick={() => setSelected(item.path)}
                onDoubleClick={() => handleDoubleClick(item)}
              >
                {getFileIcon(item)}
                <div className="file-info">
                  <div className="file-name">{item.name}</div>
                  <div className="file-meta">
                    {item.isDir ? 'Folder' : `${formatSize(item.size)} · ${formatDate(item.modified)}`}
                  </div>
                </div>
                {!item.isDir && item.ext === '.pdf' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); promptETL(item.path) }}
                    disabled={processing === item.path}
                    title="Run ETL on this PDF"
                  >
                    <Zap size={11} />
                    Extract
                  </button>
                )}
                {!item.isDir && item.ext !== '.pdf' && (
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={(e) => { e.stopPropagation(); openFile(item) }}
                    title="Open file"
                  >
                    <FolderOpen size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status bar */}
        <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card)', display: 'flex', gap: 16 }}>
          <span>{items.length} items</span>
          <span>{items.filter(i => i.isDir).length} folders</span>
          <span>{items.filter(i => i.ext === '.pdf').length} PDFs</span>
          {selected && <span>Selected: {selected.split('\\').pop()}</span>}
        </div>
      </div>
    </div>
  )
}
