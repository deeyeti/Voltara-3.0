import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Upload, FileText, CheckCircle, XCircle,
  AlertCircle, Loader, ChevronDown, ChevronRight,
  Code, Database, Zap, Copy, Check, Shield, Server, Globe, AlertTriangle, Trash2
} from 'lucide-react'

const WELCOME_MSG = {
  id: 1,
  role: 'assistant',
  content: `👋 Welcome to **CableVault AI**!\n\nI'm your intelligent ETL assistant for cable catalog data. Here's what I can do:\n\n• **Extract data** from PDF catalogs — I'll generate extraction code, run it safely, and let you review before saving\n• **Answer questions** about cable specs, IEC/BS standards, and more\n• **Process catalogs** by clicking "Upload PDF" below or dragging a PDF here\n\nTo get started, upload a cable catalog PDF!`,
  timestamp: Date.now()
}

// ─── ETL Stage Tracking ─────────────────────────────────────────────────────
function ETLProgress({ stages }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
      {stages.map((stage, i) => (
        <div key={i} className={`progress-step ${stage.status}`}>
          {stage.status === 'active' && <Loader size={14} className="spin" style={{ color: 'var(--accent-primary)' }} />}
          {stage.status === 'done' && <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />}
          {stage.status === 'error' && <XCircle size={14} style={{ color: 'var(--accent-red)' }} />}
          {stage.status === 'pending' && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border-normal)' }} />}
          <span style={{ flex: 1 }}>{stage.label}</span>
          {stage.detail && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stage.detail}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Code Block ─────────────────────────────────────────────────────────────
function CodeBlock({ code, language = 'javascript' }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ margin: '8px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-normal)' }}>
      <div className="chat-code-header">
        <div className="flex items-center gap-2">
          <Code size={12} />
          <span>{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)} style={{ padding: '1px 6px', fontSize: 10 }}>
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />} {expanded ? 'Collapse' : 'Expand'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={copy} style={{ padding: '1px 6px', fontSize: 10 }}>
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
        </div>
      </div>
      <div className="chat-code-block" style={{ maxHeight: expanded ? 'none' : 180 }}>
        {code}
      </div>
    </div>
  )
}

// ─── Records Preview ─────────────────────────────────────────────────────────
function RecordsPreview({ records, onConfirm, onDiscard }) {
  const cols = ['manufacturer', 'part_number', 'cable_type', 'size', 'voltage_rating', 'price', 'currency']
  return (
    <div style={{ margin: '12px 0', background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border-normal)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-normal)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-2">
          <Database size={14} style={{ color: 'var(--accent-green)' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{records.length} records extracted</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onDiscard}>Discard</button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm}>
            <CheckCircle size={12} /> Save to Database
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table className="preview-table">
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {records.slice(0, 50).map((r, i) => (
              <tr key={i}>
                {cols.map(c => <td key={c} title={r[c]}>{r[c] || '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {records.length > 50 && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
            + {records.length - 50} more records
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Message Bubble ─────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user'

  const renderContent = (text) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w*)\n?([\s\S]*?)```/)
        if (match) return <CodeBlock key={i} language={match[1] || 'code'} code={match[2]} />
      }
      // Render markdown-like text
      return (
        <span key={i}>
          {part.split('\n').map((line, li) => {
            // Bullet points
            const isBullet = line.trim().startsWith('• ') || line.trim().startsWith('- ')
            const content = isBullet ? line.trim().substring(2) : line
            // Bold **text**
            const boldParts = content.split(/\*\*(.*?)\*\*/g).map((s, j) =>
              j % 2 === 1 ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s}</strong> : s
            )
            return (
              <span key={li}>
                {isBullet && <span style={{ color: 'var(--accent-primary)', marginRight: 6 }}>•</span>}
                {boldParts}
                {li < part.split('\n').length - 1 && <br />}
              </span>
            )
          })}
        </span>
      )
    })
  }

  return (
    <div className={`chat-message ${isUser ? 'user' : ''}`}>
      <div className={`message-avatar ${isUser ? 'user' : 'ai'}`}>
        {isUser ? '👤' : <Zap size={14} color="#000" />}
      </div>
      <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
        {msg.etlProgress && <ETLProgress stages={msg.etlProgress} />}
        {msg.script && <CodeBlock code={msg.script} language="javascript" />}
        {msg.records && msg.pendingConfirm && (
          <RecordsPreview
            records={msg.records}
            onConfirm={msg.onConfirm}
            onDiscard={msg.onDiscard}
          />
        )}
        {msg.records && !msg.pendingConfirm && (
          <div className="etl-badge" style={{ marginBottom: 8 }}>
            <CheckCircle size={10} /> {msg.records.length} records saved
          </div>
        )}
        <div>{renderContent(msg.content)}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: isUser ? 'right' : 'left' }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

// ─── Main Chat View ──────────────────────────────────────────────────────────
export default function ChatView({ onDataChanged }) {
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [securityAlert, setSecurityAlert] = useState(null) // { type: 'pii'|'block', message }
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const msgIdRef = useRef(100)

  // Read active backend from localStorage (set by Settings)
  const backend = localStorage.getItem('cv_backend') || 'gemini'
  const piiEnabled = localStorage.getItem('cv_pii') !== 'false'

  // Load persisted chat history on mount
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await window.api?.storage?.get('chat_history')
        if (saved && Array.isArray(saved) && saved.length > 0) {
          // Strip interactive callbacks (they can't be serialised)
          const restored = saved.map(m => ({ ...m, onConfirm: undefined, onDiscard: undefined, pendingConfirm: false }))
          setMessages(restored)
          const maxId = Math.max(...restored.map(m => m.id || 0), 100)
          msgIdRef.current = maxId
        }
      } catch {/* ignore */}
      setHistoryLoaded(true)
    }
    load()
  }, [])

  // Persist chat history whenever messages change (after initial load)
  useEffect(() => {
    if (!historyLoaded) return
    // Strip non-serialisable fields before saving
    const toSave = messages.map(m => {
      const { onConfirm, onDiscard, ...rest } = m
      return rest
    })
    window.api?.storage?.set('chat_history', toSave)
  }, [messages, historyLoaded])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-dismiss security alert after 5s
  useEffect(() => {
    if (!securityAlert) return
    const t = setTimeout(() => setSecurityAlert(null), 5000)
    return () => clearTimeout(t)
  }, [securityAlert])

  const clearChat = async () => {
    setMessages([{ ...WELCOME_MSG, id: 1, timestamp: Date.now() }])
    msgIdRef.current = 100
    await window.api?.storage?.delete('chat_history')
  }

  const newId = () => ++msgIdRef.current

  const addMsg = (msg) => {
    setMessages(prev => [...prev, { id: newId(), timestamp: Date.now(), ...msg }])
  }

  const updateLastMsg = (updater) => {
    setMessages(prev => {
      const arr = [...prev]
      arr[arr.length - 1] = updater(arr[arr.length - 1])
      return arr
    })
  }

  // Check if the preload bridge is available
  const getApi = () => {
    if (!window.api) throw new Error('App bridge not ready — please restart the application.')
    return window.api
  }

  // Route chat to selected backend
  const backendChat = async (history) => {
    const api = getApi()
    if (backend === 'ollama') {
      return api.ollama.chat(history)
    }
    return api.chat.send(history)
  }

  // Route ETL script gen to selected backend
  const backendGenerateScript = async (pdfText, fileName) => {
    const api = getApi()
    if (backend === 'ollama') {
      return api.ollama.generateScript(pdfText, fileName)
    }
    return api.etl.generateScript(pdfText, fileName)
  }
  // Send a regular chat message
  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    setInput('')
    setLoading(true)

    addMsg({ role: 'user', content: text })

    // Build history for API
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    history.push({ role: 'user', content: text })

    const thinkingId = newId()
    setMessages(prev => [...prev, {
      id: thinkingId, role: 'assistant', content: '...', timestamp: Date.now(), loading: true
    }])

    try {
      const res = await backendChat(history)
      if (res.success) {
        setMessages(prev => prev.map(m => m.id === thinkingId ? {
          ...m, content: res.text, loading: false
        } : m))
      } else {
        // Check if it was a security block
        if (res.blocked) setSecurityAlert({ type: 'block', message: res.error })
        setMessages(prev => prev.map(m => m.id === thinkingId ? {
          ...m, content: `⚠️ Error: ${res.error}`, loading: false
        } : m))
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === thinkingId ? {
        ...m, content: `⚠️ Connection error: ${err.message}`, loading: false
      } : m))
    }
    setLoading(false)
  }

  // Full ETL pipeline
  const runETL = async (filePath) => {
    setLoading(true)
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop()

    addMsg({ role: 'user', content: `📄 Process PDF: ${fileName}` })

    // Stage tracking in a single AI message
    const stages = [
      { label: 'Parsing PDF text...', status: 'active', detail: '' },
      { label: 'Generating extraction script...', status: 'pending', detail: '' },
      { label: 'Running extraction...', status: 'pending', detail: '' },
      { label: 'Validating records...', status: 'pending', detail: '' }
    ]

    const progressMsgId = newId()
    setMessages(prev => [...prev, {
      id: progressMsgId, role: 'assistant',
      content: `Processing **${fileName}**...`,
      etlProgress: JSON.parse(JSON.stringify(stages)),
      timestamp: Date.now()
    }])

    const updateStages = (index, status, detail = '') => {
      setMessages(prev => prev.map(m => {
        if (m.id !== progressMsgId) return m
        const newStages = m.etlProgress.map((s, i) => {
          if (i === index) return { ...s, status, detail }
          if (i < index && s.status === 'active') return { ...s, status: 'done' }
          if (i === index + 1 && status === 'done') return { ...s, status: 'active' }
          return s
        })
        return { ...m, etlProgress: newStages }
      }))
    }

    try {
      // Step 1: Parse PDF
      const pdfResult = await window.api.etl.parsePdf(filePath)
      if (!pdfResult.success) throw new Error(`PDF parse failed: ${pdfResult.error}`)
      updateStages(0, 'done', `${pdfResult.pages} pages`)

      // Step 2: Generate script (routed to active backend)
      updateStages(1, 'active')
      const scriptResult = await backendGenerateScript(pdfResult.text, fileName)
      if (!scriptResult.success) throw new Error(`Script generation failed: ${scriptResult.error}`)
      updateStages(1, 'done', `Script ready (${backend})`)

      // Step 3: Run extraction
      updateStages(2, 'active')
      const runResult = await window.api.etl.runScript(scriptResult.script, pdfResult.text)
      if (!runResult.success) throw new Error(`Extraction failed: ${runResult.error}`)
      updateStages(2, 'done', `${runResult.count} candidates`)

      // Step 4: Validate
      updateStages(3, 'active')
      const valid = runResult.records.filter(r => r.manufacturer || r.cable_type || r.size || r.part_number)
      updateStages(3, 'done', `${valid.length} valid`)

      if (valid.length === 0) {
        setMessages(prev => prev.map(m => m.id === progressMsgId ? {
          ...m,
          content: `⚠️ No structured cable data found in **${fileName}**.\n\nThe PDF may not contain a product catalog, or the format is unusual. Try asking me to help identify the data manually.`,
          etlProgress: m.etlProgress.map(s => ({ ...s, status: s.status === 'active' ? 'error' : s.status }))
        } : m))
      } else {
        // Show script + preview with confirm button
        const confirmId = newId()
        setMessages(prev => [...prev.filter(m => m.id !== progressMsgId), {
          id: progressMsgId,
          role: 'assistant',
          content: `✅ Extraction complete for **${fileName}** — found **${valid.length} cable records**.\n\nHere's the extraction script I generated:`,
          etlProgress: stages.map(s => ({ ...s, status: 'done' })),
          script: scriptResult.script,
          records: valid,
          pendingConfirm: true,
          timestamp: Date.now(),
          onConfirm: async () => {
            const saveResult = await window.api.db.insertRecords(valid, filePath)
            if (saveResult.success) {
              setMessages(prev => prev.map(m => m.id === progressMsgId ? {
                ...m, pendingConfirm: false,
                content: `✅ **${saveResult.insertedCount} records saved** to the master database from **${fileName}**.\n\nSwitch to the **Master Data** view to explore, filter and export them.`
              } : m))
              onDataChanged?.()
            }
          },
          onDiscard: () => {
            setMessages(prev => prev.map(m => m.id === progressMsgId ? {
              ...m, pendingConfirm: false, records: null,
              content: `Extraction discarded for ${fileName}. The records were not saved.`
            } : m))
          }
        }])
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === progressMsgId ? {
        ...m,
        content: `❌ ETL Error: ${err.message}`,
        etlProgress: m.etlProgress?.map(s => s.status === 'active' ? { ...s, status: 'error' } : s)
      } : m))
    }
    setLoading(false)
  }

  const handleUploadPDF = async () => {
    const result = await window.api.files.openDialog({
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      title: 'Select Cable Catalog PDF'
    })
    if (!result.canceled && result.filePaths?.length > 0) {
      await runETL(result.filePaths[0])
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="chat-view">
      {/* Messages */}
      <div className="chat-messages">
        {messages.map(msg => (
          msg.loading
            ? (
              <div key={msg.id} className="chat-message">
                <div className="message-avatar ai"><Zap size={14} color="#000" /></div>
                <div className="message-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader size={14} className="spin" style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                </div>
              </div>
            )
            : <Message key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Security alert toast */}
      {securityAlert && (
        <div style={{
          margin: '0 16px 8px', padding: '10px 14px', borderRadius: 8,
          background: securityAlert.type === 'block' ? 'var(--accent-red-dim)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${securityAlert.type === 'block' ? 'var(--accent-red)' : 'var(--accent-amber)'}`,
          display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12
        }}>
          <Shield size={13} style={{ color: securityAlert.type === 'block' ? 'var(--accent-red)' : 'var(--accent-amber)', marginTop: 1, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{securityAlert.message}</span>
          <button onClick={() => setSecurityAlert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="chat-toolbar">
        <button className="btn btn-secondary btn-sm" onClick={handleUploadPDF} disabled={loading}>
          <Upload size={13} />
          Upload PDF for ETL
        </button>
        <span className="etl-badge">
          <Zap size={10} />
          Code-based extraction
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={clearChat}
          disabled={loading}
          title="Clear chat history"
          style={{ marginLeft: 'auto', color: 'var(--text-muted)', gap: 4 }}
        >
          <Trash2 size={12} />
          Clear
        </button>

        {/* Backend badge */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
          padding: '3px 8px', borderRadius: 20,
          background: backend === 'ollama' ? 'rgba(52,211,153,0.1)' : 'rgba(99,102,241,0.1)',
          border: `1px solid ${backend === 'ollama' ? 'var(--accent-green)' : 'var(--accent-primary)'}`,
          color: backend === 'ollama' ? 'var(--accent-green)' : 'var(--accent-primary)'
        }}>
          {backend === 'ollama' ? <Server size={10} /> : <Globe size={10} />}
          {backend === 'ollama' ? 'Ollama' : 'Gemini'}
        </span>

        {/* Security badge */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          color: 'var(--accent-amber)', opacity: 0.7
        }}>
          <Shield size={10} />
          Protected
        </span>

        <div style={{ flex: 1 }} />
        {loading && (
          <div className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <Loader size={12} className="spin" />
            Processing...
          </div>
        )}
      </div>


      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask about cables, upload a catalog PDF, or type a question..."
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        <button
          className="btn btn-primary btn-icon"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ width: 40, height: 40 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
