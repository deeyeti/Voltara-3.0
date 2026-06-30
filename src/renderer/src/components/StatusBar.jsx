import { useState, useEffect } from 'react'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

export default function StatusBar({ stats, onRefresh }) {
  const [connected, setConnected] = useState(null)
  const [checking, setChecking] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  useEffect(() => {
    checkConnection()
    onRefresh?.()
  }, [])

  const checkConnection = async () => {
    setChecking(true)
    try {
      if (window.api) {
        const result = await window.api.chat.testConnection()
        setConnected(result.success)
      }
    } catch {
      setConnected(false)
    }
    setChecking(false)
    setLastRefresh(new Date().toLocaleTimeString())
  }

  const handleRefresh = async () => {
    await checkConnection()
    await onRefresh?.()
  }

  return (
    <div className="statusbar">
      <div className="flex items-center gap-2">
        <span className={`status-dot ${checking ? 'loading' : connected === false ? 'offline' : ''}`} />
        <span>
          {checking ? 'Connecting...' : connected ? 'Gemini Connected' : 'Gemini Offline'}
        </span>
      </div>

      <span style={{ color: 'var(--border-strong)' }}>|</span>
      <span>{stats.totalRecords} cable records</span>

      <span style={{ color: 'var(--border-strong)' }}>|</span>
      <span>{stats.sourceFiles} source files</span>

      <div style={{ flex: 1 }} />

      {lastRefresh && <span>Last sync: {lastRefresh}</span>}

      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={handleRefresh}
        title="Refresh"
        style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
      >
        <RefreshCw size={12} className={checking ? 'spin' : ''} />
      </button>
    </div>
  )
}
