import { useState, useEffect } from 'react'
import { Key, Save, TestTube, CheckCircle, XCircle, Info, Cpu, Globe } from 'lucide-react'

export default function SettingsView() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [model, setModel] = useState('gemini-1.5-flash')

  const saveKey = async () => {
    if (window.api) {
      await window.api.chat.setApiKey(apiKey)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    if (window.api) {
      const res = await window.api.chat.testConnection()
      setTestResult(res)
    }
    setTesting(false)
  }

  return (
    <div style={{ padding: 32, maxWidth: 640, overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configure CableVault AI connections and preferences</p>
      </div>

      {/* API Key Section */}
      <div className="card settings-section">
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <Key size={16} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Gemini API Key</h3>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="settings-label">API Key</label>
          <input
            className="input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key..."
          />
          <p className="settings-description">Your key is stored locally and only used from the main process. Never sent to any third party.</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-sm" onClick={saveKey}>
            {saved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Key</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={testConnection} disabled={testing}>
            {testing ? 'Testing...' : <><TestTube size={13} /> Test Connection</>}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: testResult.success ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
            border: `1px solid ${testResult.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
            fontSize: 13
          }}>
            {testResult.success
              ? <><CheckCircle size={13} style={{ color: 'var(--accent-green)', verticalAlign: 'middle' }} /> {testResult.message}</>
              : <><XCircle size={13} style={{ color: 'var(--accent-red)', verticalAlign: 'middle' }} /> {testResult.error}</>
            }
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="card settings-section">
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <Cpu size={16} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>AI Model</h3>
        </div>

        <label className="settings-label">Gemini Model</label>
        <select className="input" value={model} onChange={e => setModel(e.target.value)} style={{ marginBottom: 8 }}>
          <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, recommended)</option>
          <option value="gemini-1.5-pro">gemini-1.5-pro (Most capable)</option>
          <option value="gemini-2.0-flash">gemini-2.0-flash (Latest)</option>
        </select>
        <p className="settings-description">Flash is recommended for ETL workloads — fast response and cost-effective.</p>
      </div>

      {/* About */}
      <div className="card settings-section">
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <Info size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>About CableVault</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Framework', value: 'Electron + React' },
            { label: 'Database', value: 'SQLite (sql.js)' },
            { label: 'AI Backend', value: 'Google Gemini' },
            { label: 'Extraction Method', value: 'Code generation + sandboxed VM' },
            { label: 'Anti-hallucination', value: 'Enabled (code-first)' }
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <Globe size={16} style={{ color: 'var(--accent-amber)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>How ETL Works</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { step: '1', label: 'Upload PDF', desc: 'Select any cable catalog PDF from the Chat or Files view' },
            { step: '2', label: 'Text Extraction', desc: 'pdf-parse extracts raw text from the PDF pages' },
            { step: '3', label: 'AI Code Generation', desc: 'Gemini analyzes the text sample and generates a JS extraction function' },
            { step: '4', label: 'Sandboxed Execution', desc: 'The script runs in a Node.js VM sandbox with no file/network access — preventing hallucination' },
            { step: '5', label: 'Validation & Preview', desc: 'Results are validated against the cable schema and shown for your review' },
            { step: '6', label: 'Save to Database', desc: 'On confirmation, records are stored in SQLite and available in the Data Viewer' }
          ].map(item => (
            <div key={item.step} className="flex items-center gap-3" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-primary-dim)', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
