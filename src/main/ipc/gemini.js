// IPC handlers for Gemini AI operations — ESM
import { ipcMain } from 'electron'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { createContext, runInContext } from 'vm'

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

export function registerGeminiHandlers() {

  ipcMain.handle('chat:send', async (event, { messages }) => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No Gemini API key configured. Please add it in Settings.' }

    try {
      const model = ai.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: ETL_SYSTEM_PROMPT
      })

      const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))

      const chat = model.startChat({ history })
      const lastMessage = messages[messages.length - 1]
      const result = await chat.sendMessage(lastMessage.content)
      return { success: true, text: result.response.text() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('etl:generate-script', async (event, { pdfText, fileName }) => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No Gemini API key configured' }

    try {
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const prompt = `Analyze this cable catalog PDF text and write a JavaScript extraction function.

File: ${fileName}

PDF TEXT (first 6000 chars):
${pdfText.substring(0, 6000)}

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

  ipcMain.handle('gemini:test', async () => {
    const ai = getGenAI()
    if (!ai) return { success: false, error: 'No API key configured' }
    try {
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent('Say exactly: "CableVault connected!"')
      return { success: true, message: result.response.text() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('gemini:set-key', (event, newKey) => {
    process.env.GEMINI_API_KEY = newKey
    genAI = new GoogleGenerativeAI(newKey)
    return { success: true }
  })
}
