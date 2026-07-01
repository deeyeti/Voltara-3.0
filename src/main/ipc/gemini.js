// IPC handlers for Gemini AI operations — with PII + prompt injection protection
import { ipcMain } from 'electron'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { createContext, runInContext } from 'vm'
import { redactPii, scanPii } from '../security/pii.js'
import { checkPromptInjection, sanitizeMessage } from '../security/promptGuard.js'

let genAI = null

function getGenAI() {
  const key = process.env.GEMINI_API_KEY || ''
  if (!key) return null
  if (!genAI) genAI = new GoogleGenerativeAI(key)
  return genAI
}

const ETL_SYSTEM_PROMPT = `You are CableVault AI, an expert ETL assistant specialized in cable catalog data.

When generating extraction scripts, write a JavaScript function named extractCableData(text) that:
- Parses the text using regex and string operations
- Returns an array of cable record objects with these fields: manufacturer, part_number, cable_type, size, voltage_rating, current_rating, material, insulation, jacket, color, price, currency, unit, standard, catalog_date, notes
- Uses only built-in JavaScript (no imports/requires)
- Returns an array even if empty

For general questions, answer helpfully about cable standards (IEC, BS, ASTM, NEC), specifications, and ETL processes.`

/**
 * Apply security checks to user message.
 * Returns { safe, error } — if not safe, error contains the rejection reason.
 */
export function applySecurityChecks(text, options = {}) {
  const { redactPiiEnabled = true, promptGuardEnabled = true } = options

  // 1. Sanitize (always)
  const sanitized = sanitizeMessage(text)

  // 2. Prompt injection check
  if (promptGuardEnabled) {
    const injection = checkPromptInjection(sanitized)
    if (injection.blocked) {
      console.warn('[Security] Blocked prompt injection:', injection.reason)
      return { safe: false, text: sanitized, error: injection.reason }
    }
    if (injection.warned) {
      console.warn('[Security] Suspicious prompt warning:', injection.reason)
      // Log but continue — warnings don't block
    }
  }

  // 3. PII redaction
  let processedText = sanitized
  let piiReport = null
  if (redactPiiEnabled) {
    const { redacted, types, count } = redactPii(sanitized)
    if (count > 0) {
      console.info(`[Security] Redacted ${count} PII item(s): ${types.join(', ')}`)
      processedText = redacted
      piiReport = { types, count }
    }
  }

  return { safe: true, text: processedText, piiReport, error: null }
}

export function registerGeminiHandlers() {

  // ── Chat ──────────────────────────────────────────────────────────────────
  ipcMain.handle('chat:send', async (event, { messages }) => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No Gemini API key configured. Please add it in Settings.' }

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
        // Prepend note about PII redaction
        console.info('[Security] PII was redacted before sending to Gemini')
      }
    }

    try {
      const model = ai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: ETL_SYSTEM_PROMPT
      })

      // Build history from all messages except the last (which we send as the new message).
      // Gemini requires the history to start with a 'user' turn, so strip any leading
      // assistant/model messages (e.g. the welcome message restored from disk).
      let history = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content || '' }]
      }))
      // Drop leading model turns
      while (history.length > 0 && history[0].role === 'model') {
        history = history.slice(1)
      }

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(messages[messages.length - 1].content)
      return {
        success: true,
        text: result.response.text(),
        piiRedacted: !!messages[messages.length - 1]?.piiReport
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Security scan (for renderer to pre-check) ─────────────────────────────
  ipcMain.handle('security:scan', (event, text) => {
    const sanitized = sanitizeMessage(text)
    const injection = checkPromptInjection(sanitized)
    const pii = scanPii(sanitized)
    return {
      injection: { severity: injection.severity, reason: injection.reason },
      pii: { detected: pii.detected, hasPii: pii.hasPii }
    }
  })

  // ── ETL script generation ─────────────────────────────────────────────────
  ipcMain.handle('etl:generate-script', async (event, { pdfText, fileName }) => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No Gemini API key configured' }

    try {
      // Scan PDF text for PII before sending to cloud (redact just in case)
      const { redacted } = redactPii(pdfText.substring(0, 6000))

      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = `Analyze this cable catalog PDF text and write a JavaScript extraction function.

File: ${fileName}

PDF TEXT (first 6000 chars):
${redacted}

Write ONLY a JavaScript function named extractCableData(text) that:
1. Parses using regex and string operations
2. Returns an array of objects with: manufacturer, part_number, cable_type, size, voltage_rating, current_rating, material, insulation, jacket, color, price (number or ""), currency, unit, standard, catalog_date, notes
3. Uses NO imports or requires — pure JS only
4. Is self-contained and handles various table/list formats

Return ONLY the function code, no markdown, no explanation:`

      const result = await model.generateContent(prompt)
      let script = result.response.text()
        .replace(/```javascript\n?/gi, '')
        .replace(/```js\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim()

      return { success: true, script }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Sandboxed VM execution ────────────────────────────────────────────────
  ipcMain.handle('etl:run-script', (event, { script, pdfText }) => {
    try {
      const sandbox = {
        extractCableData: null,
        console: { log: () => {}, error: () => {}, warn: () => {} },
        RegExp, String, Number, Array, Object, Math, JSON, Date,
        parseInt, parseFloat, isNaN, isFinite
      }

      const context = createContext(sandbox)
      runInContext(script, context, { timeout: 15000 })

      if (typeof sandbox.extractCableData !== 'function') {
        return { success: false, error: 'Script did not define extractCableData function' }
      }

      const records = sandbox.extractCableData(pdfText)

      if (!Array.isArray(records)) {
        return { success: false, error: 'extractCableData must return an array' }
      }

      const validated = records
        .filter(r => r && typeof r === 'object')
        .map(r => ({
          manufacturer: String(r.manufacturer || ''),
          part_number: String(r.part_number || ''),
          cable_type: String(r.cable_type || ''),
          size: String(r.size || ''),
          voltage_rating: String(r.voltage_rating || ''),
          current_rating: String(r.current_rating || ''),
          material: String(r.material || ''),
          insulation: String(r.insulation || ''),
          jacket: String(r.jacket || ''),
          color: String(r.color || ''),
          price: isNaN(parseFloat(r.price)) ? '' : parseFloat(r.price),
          currency: String(r.currency || 'USD'),
          unit: String(r.unit || ''),
          standard: String(r.standard || ''),
          catalog_date: String(r.catalog_date || ''),
          notes: String(r.notes || '')
        }))

      return { success: true, records: validated, count: validated.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── PDF parsing ───────────────────────────────────────────────────────────
  ipcMain.handle('etl:parse-pdf', async (event, filePath) => {
    try {
      const pdfParse = await import('pdf-parse')
      const buffer = readFileSync(filePath)
      const parse = pdfParse.default || pdfParse
      const data = await parse(buffer)
      return { success: true, text: data.text, pages: data.numpages, info: data.info }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Gemini connection test ────────────────────────────────────────────────
  ipcMain.handle('gemini:test', async () => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No API key configured' }
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent('Say exactly: "CableVault connected!"')
      return { success: true, message: result.response.text() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Set API key at runtime ────────────────────────────────────────────────
  ipcMain.handle('gemini:set-key', (event, newKey) => {
    process.env.GEMINI_API_KEY = newKey
    genAI = new GoogleGenerativeAI(newKey)
    return { success: true }
  })
}
