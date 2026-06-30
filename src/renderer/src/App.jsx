import { useState } from 'react'
import { MessageSquare, FolderOpen, Database, Settings, Zap } from 'lucide-react'
import ChatView from './views/ChatView'
import FileView from './views/FileView'
import DataView from './views/DataView'
import SettingsView from './views/SettingsView'
import StatusBar from './components/StatusBar'

const NAV_ITEMS = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'files', label: 'File Browser', icon: FolderOpen },
  { id: 'data', label: 'Master Data', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export default function App() {
  const [activeView, setActiveView] = useState('chat')
  const [stats, setStats] = useState({ totalRecords: 0, manufacturers: 0, sourceFiles: 0 })

  const refreshStats = async () => {
    if (window.api) {
      const s = await window.api.db.getStats()
      setStats(s)
    }
  }

  const renderView = () => {
    switch (activeView) {
      case 'chat': return <ChatView onDataChanged={refreshStats} />
      case 'files': return <FileView onDataChanged={refreshStats} />
      case 'data': return <DataView stats={stats} onStatsChange={setStats} />
      case 'settings': return <SettingsView />
      default: return <ChatView onDataChanged={refreshStats} />
    }
  }

  const viewTitles = {
    chat: 'AI ETL Assistant',
    files: 'File Browser',
    data: 'Master Data Viewer',
    settings: 'Settings'
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Zap size={20} color="#000" />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.slice(0, 3).map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
                title={item.label}
              >
                <Icon size={18} className="sidebar-item-icon" />
                <span className="sidebar-item-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`sidebar-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
            title="Settings"
          >
            <Settings size={18} className="sidebar-item-icon" />
            <span className="sidebar-item-label">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">
            <span className="text-accent">CableVault</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 400 }}>
              — {viewTitles[activeView]}
            </span>
          </div>
          <div className="topbar-actions">
            <span className="badge badge-blue">{stats.totalRecords} records</span>
            <span className="badge badge-purple">{stats.manufacturers} manufacturers</span>
          </div>
        </div>

        {/* View content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {renderView()}
        </div>

        {/* Status bar */}
        <StatusBar stats={stats} onRefresh={refreshStats} />
      </div>
    </div>
  )
}
