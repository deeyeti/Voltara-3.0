/**
 * Ollama local LLM IPC handlers
 * Connects to a locally running Ollama instance (default: http://localhost:11434)
 */
import { ipcMain } from 'electron'
import { applySecurityChecks } from './gemini.js'
import { redactPii } from '../security/pii.js'

let ollamaBaseUrl = 'http://localhost:11434'
let ollamaModel = 'gemma4:e4b'

const OLLAMA_SYSTEM_PROMPT = `You are CableVault AI, an expert ETL assistant specialized in cable catalog data.

When generating extraction scripts, write a JavaScript function named extractCableData(text) that:
- Parses the text using regex and string operations
- Returns an array of cable record objects with these fields: manufacturer, part_number, cable_type, size, voltage_rating, current_rating, material, insulation, jacket, color, price, currency, unit, standard, catalog_date, notes
- Uses only built-in JavaScript (no imports/requires)
- Returns an array even if empty

For general questions, answer helpfully about cable standards (IEC, BS, ASTM, NEC), specifications, and ETL processes.`

/**
 * Send a request to Ollama's /api/chat endpoint
 */
async function ollamaChat(messages, model) {
  const url = `${ollamaBaseUrl}/api/chat`
  const body = {
    model: model || ollamaModel,
    messages: [
      { role: 'system', content: OLLAMA_SYSTEM_PROMPT },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ],
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 2048
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000) // 2 min timeout
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Ollama error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.message?.content || ''
}

/**
 * Generate ETL extraction script via Ollama
 */
async function ollamaGenerateScript(pdfText, fileName, model) {
  const prompt = `Analyze this cable catalog PDF text and write a JavaScript extraction function.

File: ${fileName}

PDF TEXT (first 5000 chars):
${pdfText.substring(0, 5000)}

Write ONLY a JavaScript function named extractCableData(text) that:
1. Parses using regex and string operations (no imports)
2. Returns an array of objects with: manufacturer, part_number, cable_type, size, voltage_rating, current_rating, material, insulation, jacket, color, price (number or ""), currency, unit, standard, catalog_date, notes
3. Is self-contained and handles table/list formats

Return ONLY the function code, no markdown, no explanation:`

  const url = `${ollamaBaseUrl}/api/generate`
  const body = {
    model: model || ollamaModel,
    prompt,
    stream: false,
    options: { temperature: 0.1, num_predict: 3000 }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Ollama error ${response.status}: ${err}`)
  }

  const data = await response.json()
  let script = data.response || ''
  script = script
    .replace(/```javascript\n?/gi, '')
    .replace(/```js\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim()

  return script
}

export function registerOllamaHandlers() {

  // Test Ollama connection and list models
  ipcMain.handle('ollama:test', async () => {
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` }
      const data = await response.json()
      const models = (data.models || []).map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at
      }))
      return { success: true, models, url: ollamaBaseUrl }
    } catch (err) {
      return {
        success: false,
        error: err.name === 'TimeoutError'
          ? 'Ollama not responding (is it running?)'
          : err.message
      }
    }
  })

  // Set Ollama URL and model
  ipcMain.handle('ollama:configure', (event, { url, model }) => {
    if (url) ollamaBaseUrl = url.replace(/\/$/, '')
    if (model) ollamaModel = model
    return { success: true, url: ollamaBaseUrl, model: ollamaModel }
  })

  // Get current config
  ipcMain.handle('ollama:get-config', () => ({
    url: ollamaBaseUrl,
    model: ollamaModel
  }))

  // Chat via Ollama
  ipcMain.handle('ollama:chat', async (event, { messages }) => {
    // Check last user message for security
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'user') {
      const check = applySecurityChecks(lastMsg.content)
      if (!check.safe) {
        return {
          success: false,
          blocked: true,
          error: `🛡️ Message blocked by security policy.\n\n${check.error}`
        }
      }
      // Apply redacted version
      if (check.text !== lastMsg.content) {
        messages = [...messages.slice(0, -1), { ...lastMsg, content: check.text }]
      }
      if (check.piiReport) {
        console.info('[Security] PII was redacted before sending to Ollama')
      }
    }

    try {
      const text = await ollamaChat(messages, ollamaModel)
      return { 
        success: true, 
        text,
        piiRedacted: !!messages[messages.length - 1]?.piiReport
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Generate ETL script via Ollama
  ipcMain.handle('ollama:generate-script', async (event, { pdfText, fileName }) => {
    try {
      // Scan PDF text for PII before sending to AI (redact just in case)
      const { redacted } = redactPii(pdfText.substring(0, 6000))
      
      const script = await ollamaGenerateScript(redacted, fileName, ollamaModel)
      return { success: true, script }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Pull a model
  ipcMain.handle('ollama:pull', async (event, modelName) => {
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
        signal: AbortSignal.timeout(300000) // 5 min
      })
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
