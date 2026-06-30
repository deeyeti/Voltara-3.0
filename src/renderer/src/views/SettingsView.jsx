import { useState, useEffect } from 'react'
import {
  Key, Save, TestTube, CheckCircle, XCircle, Info, Cpu,
  Globe, Shield, Server, RefreshCw, Download, AlertTriangle,
  Lock, Eye, EyeOff, Zap
} from 'lucide-react'

const SECTION = ({ icon, title, children }) => (
  <div className="card settings-section" style={{ marginBottom: 20 }}>
    <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
      {icon}
      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h3>
    </div>
    {children}
  </div>
)

const Field = ({ label, description, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label className="settings-label">{label}</label>
    {children}
    {description && <p className="settings-description">{description}</p>}
  </div>
)

export default function SettingsView({ onBackendChange }) {
  // Gemini
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash')
  const [geminiSaving, setGeminiSaving] = useState(false)
  const [geminiTest, setGeminiTest] = useState(null)
  const [geminiTesting, setGeminiTesting] = useState(false)

  // Ollama
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaTest, setOllamaTest] = useState(null)
  const [ollamaTesting, setOllamaTesting] = useState(false)
  const [ollamaPulling, setOllamaPulling] = useState(false)

  // Backend selection (persisted in localStorage)
  const [backend, setBackend] = useState(() => localStorage.getItem('cv_backend') || 'gemini')

  // Security settings
  const [piiRedaction, setPiiRedaction] = useState(() => localStorage.getItem('cv_pii') !== 'false')
  const [promptGuard, setPromptGuard] = useState(() => localStorage.getItem('cv_guard') !== 'false')

  useEffect(() => {
    // Load Ollama config from main
    if (window.api?.ollama) {
      window.api.ollama.getConfig().then(cfg => {
        setOllamaUrl(cfg.url)
        setOllamaModel(cfg.model)
      }).catch(() => {})
    }
  }, [])

  const saveGeminiKey = async () => {
    if (!window.api) return
    setGeminiSaving(true)
    await window.api.chat.setApiKey(apiKey)
    setTimeout(() => setGeminiSaving(false), 1500)
  }

  const testGemini = async () => {
    if (!window.api) return
    setGeminiTesting(true)
    setGeminiTest(null)
    const res = await window.api.chat.testConnection()
    setGeminiTest(res)
    setGeminiTesting(false)
  }

  const testOllama = async () => {
    if (!window.api) return
    setOllamaTesting(true)
    setOllamaTest(null)
    // Apply URL before testing
    await window.api.ollama.configure({ url: ollamaUrl, model: ollamaModel })
    const res = await window.api.ollama.test()
    setOllamaTest(res)
    if (res.success) setOllamaModels(res.models || [])
    setOllamaTesting(false)
  }

  const saveOllamaConfig = async () => {
    if (!window.api) return
    await window.api.ollama.configure({ url: ollamaUrl, model: ollamaModel })
  }

  const pullModel = async (name) => {
    if (!window.api) return
    setOllamaPulling(true)
    await window.api.ollama.pull(name || ollamaModel)
    setOllamaPulling(false)
    // Re-test to refresh model list
    await testOllama()
  }

  const switchBackend = (b) => {
    setBackend(b)
    localStorage.setItem('cv_backend', b)
    onBackendChange?.(b)
  }

  const saveSecurity = () => {
    localStorage.setItem('cv_pii', String(piiRedaction))
    localStorage.setItem('cv_guard', String(promptGuard))
  }

  const StatusBadge = ({ result }) => {
    if (!result) return null
    return (
      <div style={{
        marginTop: 10, padding: '10px 14px', borderRadius: 8,
        background: result.success ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
        border: `1px solid ${result.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
        fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
      }}>
        {result.success
          ? <CheckCircle size={13} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
          : <XCircle size={13} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />}
        <span>{result.success ? (result.message || 'Connected!') : result.error}</span>
      </div>
    )
  }

  const Toggle = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: enabled ? 'var(--accent-primary)' : 'var(--border-normal)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: enabled ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }} />
    </button>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 28, maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Settings</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configure AI backend, security, and preferences</p>
      </div>

      {/* ── AI Backend selector ──────────────────────────────────────────── */}
      <SECTION icon={<Zap size={16} style={{ color: 'var(--accent-primary)' }} />} title="AI Backend">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'gemini', label: 'Gemini (Cloud)', icon: <Globe size={14} />, sub: 'Google AI' },
            { id: 'ollama', label: 'Ollama (Local)', icon: <Server size={14} />, sub: 'Private & offline' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => switchBackend(opt.id)}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${backend === opt.id ? 'var(--accent-primary)' : 'var(--border-normal)'}`,
                background: backend === opt.id ? 'var(--accent-primary-dim)' : 'var(--bg-elevated)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.15s'
              }}
            >
              <div className="flex items-center gap-2" style={{ color: backend === opt.id ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                {opt.icon}
                <span style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.sub}</span>
            </button>
          ))}
        </div>
        <p className="settings-description" style={{ marginBottom: 0 }}>
          <strong style={{ color: backend === 'ollama' ? 'var(--accent-green)' : 'var(--accent-primary)' }}>
            {backend === 'gemini' ? 'Gemini (Cloud)' : 'Ollama (Local)'}
          </strong> is the active backend for all AI chat and ETL operations.
        </p>
      </SECTION>

      {/* ── Gemini ───────────────────────────────────────────────────────── */}
      <SECTION icon={<Globe size={16} style={{ color: 'var(--accent-primary)' }} />} title="Gemini API">
        <Field label="API Key" description="Stored locally, never committed to git or sent to any third party.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter Gemini API key..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowKey(v => !v)} title="Toggle visibility">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <Field label="Model">
          <select className="input" value={geminiModel} onChange={e => setGeminiModel(e.target.value)}>
            <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, recommended)</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro (Most capable)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash (Latest)</option>
          </select>
        </Field>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-sm" onClick={saveGeminiKey}>
            {geminiSaving ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Key</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={testGemini} disabled={geminiTesting}>
            <TestTube size={13} /> {geminiTesting ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        <StatusBadge result={geminiTest} />
      </SECTION>

      {/* ── Ollama ───────────────────────────────────────────────────────── */}
      <SECTION icon={<Server size={16} style={{ color: 'var(--accent-green)' }} />} title="Ollama (Local)">
        <div style={{
          padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8,
          border: '1px solid var(--border-subtle)', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)'
        }}>
          💡 Install Ollama from <strong style={{ color: 'var(--accent-primary)' }}>ollama.ai</strong>, then run:
          <code style={{ display: 'block', marginTop: 4, padding: '4px 8px', background: 'var(--bg-deep)', borderRadius: 4, fontSize: 11 }}>
            ollama serve
          </code>
        </div>

        <Field label="Ollama Server URL">
          <input
            className="input"
            value={ollamaUrl}
            onChange={e => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
          />
        </Field>

        <Field label="Model">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={ollamaModel}
              onChange={e => setOllamaModel(e.target.value)}
              placeholder="llama3.2"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => pullModel()} disabled={ollamaPulling} title="Pull this model from Ollama">
              {ollamaPulling ? <><RefreshCw size={12} className="spin" /> Pulling...</> : <><Download size={12} /> Pull</>}
            </button>
          </div>
        </Field>

        <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={saveOllamaConfig}>
            <Save size={13} /> Save Config
          </button>
          <button className="btn btn-secondary btn-sm" onClick={testOllama} disabled={ollamaTesting}>
            <TestTube size={13} /> {ollamaTesting ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        <StatusBadge result={ollamaTest} />

        {/* Available models list */}
        {ollamaModels.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Available Models
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ollamaModels.map(m => (
                <div key={m.name}
                  className="flex items-center gap-3"
                  style={{
                    padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6,
                    cursor: 'pointer', border: ollamaModel === m.name ? '1px solid var(--accent-primary)' : '1px solid transparent'
                  }}
                  onClick={() => setOllamaModel(m.name)}
                >
                  <Cpu size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {m.size ? `${(m.size / 1e9).toFixed(1)} GB` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SECTION>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <SECTION icon={<Shield size={16} style={{ color: 'var(--accent-amber)' }} />} title="Security & Privacy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* PII Redaction */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
                <Lock size={13} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>PII Redaction</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Automatically redact emails, phones, credit cards, SSNs, IBANs, IPs from messages before sending to AI
              </p>
            </div>
            <Toggle enabled={piiRedaction} onChange={v => { setPiiRedaction(v); localStorage.setItem('cv_pii', String(v)) }} />
          </div>

          {/* Prompt Injection Guard */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
                <Shield size={13} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Prompt Injection Guard</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Block jailbreak attempts, role hijacking, system prompt extraction, and injection tokens
              </p>
            </div>
            <Toggle enabled={promptGuard} onChange={v => { setPromptGuard(v); localStorage.setItem('cv_guard', String(v)) }} />
          </div>
        </div>

        {/* PII types covered */}
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>PII types covered:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['Email', 'Phone', 'Credit Card', 'SSN', 'IP Address', 'Passport', 'IBAN', 'UAE National ID'].map(t => (
              <span key={t} className="badge badge-blue" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        </div>
      </SECTION>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <SECTION icon={<Info size={16} style={{ color: 'var(--text-muted)' }} />} title="About CableVault">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Version', value: '1.1.0' },
            { label: 'Framework', value: 'Electron + React' },
            { label: 'Database', value: 'SQLite (sql.js)' },
            { label: 'Cloud AI', value: 'Google Gemini' },
            { label: 'Local AI', value: 'Ollama' },
            { label: 'Extraction Method', value: 'Code gen + sandboxed VM' },
            { label: 'PII Protection', value: piiRedaction ? '✅ Active' : '⚠️ Disabled' },
            { label: 'Injection Guard', value: promptGuard ? '✅ Active' : '⚠️ Disabled' }
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </SECTION>
    </div>
  )
}
