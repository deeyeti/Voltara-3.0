/**
 * LangGraph-powered ETL Pipeline
 * Replaces manual IPC round-trips with a stateful graph:
 *   parsePdf → generateScript (w/ retry) → runExtraction → validateRecords
 *
 * Progress events are streamed to the renderer window via ipcMain events.
 * Human review (confirm/discard) stays in the React renderer.
 */
import { ipcMain, BrowserWindow } from 'electron'
import { StateGraph, Annotation, END } from '@langchain/langgraph'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { readFileSync } from 'fs'
import { createContext, runInContext } from 'vm'
import { redactPii } from '../security/pii.js'

// ── Shared state definition ───────────────────────────────────────────────────
const ETLState = Annotation.Root({
  // inputs
  filePath:   Annotation({ reducer: (_, b) => b }),
  fileName:   Annotation({ reducer: (_, b) => b }),
  backend:    Annotation({ reducer: (_, b) => b }), // 'gemini' | 'ollama'
  ollamaUrl:  Annotation({ reducer: (_, b) => b }),
  ollamaModel: Annotation({ reducer: (_, b) => b }),
  geminiModel: Annotation({ reducer: (_, b) => b }),

  // pipeline data
  pdfText:    Annotation({ reducer: (_, b) => b, default: () => '' }),
  pdfPages:   Annotation({ reducer: (_, b) => b, default: () => 0 }),
  script:     Annotation({ reducer: (_, b) => b, default: () => '' }),
  records:    Annotation({ reducer: (_, b) => b, default: () => [] }),

  // control flow
  retryCount: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  error:      Annotation({ reducer: (_, b) => b, default: () => null }),
  status:     Annotation({ reducer: (_, b) => b, default: () => 'running' }),
  senderWebContentsId: Annotation({ reducer: (_, b) => b })
})

// ── Helper: send progress event to renderer ───────────────────────────────────
function sendProgress(state, stage, status, detail = '') {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('etl:progress', { stage, status, detail })
  }
}

// ── Node: parsePdf ────────────────────────────────────────────────────────────
async function parsePdfNode(state) {
  sendProgress(state, 0, 'active', '')
  try {
    const pdfParse = await import('pdf-parse')
    const buffer = readFileSync(state.filePath)
    const parse = pdfParse.default || pdfParse
    const data = await parse(buffer)
    sendProgress(state, 0, 'done', `${data.numpages} pages`)
    return { pdfText: data.text, pdfPages: data.numpages }
  } catch (err) {
    sendProgress(state, 0, 'error', err.message)
    return { error: err.message, status: 'error' }
  }
}

// ── Node: generateScript ──────────────────────────────────────────────────────
async function generateScriptNode(state) {
  const attempt = state.retryCount + 1
  const detail = attempt > 1 ? `Retry ${attempt - 1}/2...` : ''
  sendProgress(state, 1, 'active', detail)

  const { redacted } = redactPii(state.pdfText.substring(0, 6000))

  const prompt = `Analyze this cable catalog PDF text and write a JavaScript extraction function.

File: ${state.fileName}

PDF TEXT (first 6000 chars):
${redacted}

Write ONLY a JavaScript function named extractCableData(text) that:
1. Parses using regex and string operations (no imports)
2. Returns an array of objects with: manufacturer, part_number, cable_type, size, voltage_rating, current_rating, material, insulation, jacket, color, price (number or ""), currency, unit, standard, catalog_date, notes
3. Uses NO imports or requires — pure JS only
4. Is self-contained and handles various table/list formats

Return ONLY the function code, no markdown, no explanation:`

  try {
    let rawScript = ''

    if (state.backend === 'gemini') {
      const model = new ChatGoogleGenerativeAI({
        model: state.geminiModel || 'gemini-2.5-flash',
        temperature: 0.1
      })
      const result = await model.invoke(prompt)
      rawScript = typeof result.content === 'string'
        ? result.content
        : result.content.map(c => c.text || '').join('')
    } else {
      // Ollama via direct fetch (avoids community peer dep issues)
      const ollamaUrl = state.ollamaUrl || 'http://localhost:11434'
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: state.ollamaModel || 'gemma4:e4b',
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 3000 }
        }),
        signal: AbortSignal.timeout(180000)
      })
      if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)
      const data = await response.json()
      rawScript = data.response || ''
    }

    const script = rawScript
      .replace(/```javascript\n?/gi, '')
      .replace(/```js\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim()

    if (!script || script.length < 20) {
      throw new Error('Model returned an empty or unusable script')
    }

    sendProgress(state, 1, 'done', `Script ready (${state.backend}, attempt ${attempt})`)
    return { script, retryCount: state.retryCount + 1 }
  } catch (err) {
    console.warn(`[ETLGraph] generateScript attempt ${attempt} failed:`, err.message)
    return { error: err.message, retryCount: state.retryCount + 1 }
  }
}

// ── Node: runExtraction ───────────────────────────────────────────────────────
function runExtractionNode(state) {
  sendProgress(state, 2, 'active', '')
  try {
    const sandbox = {
      extractCableData: null,
      console: { log: () => {}, error: () => {}, warn: () => {} },
      RegExp, String, Number, Array, Object, Math, JSON, Date,
      parseInt, parseFloat, isNaN, isFinite
    }
    const context = createContext(sandbox)
    runInContext(state.script, context, { timeout: 15000 })

    if (typeof sandbox.extractCableData !== 'function') {
      throw new Error('Script did not define extractCableData function')
    }

    const raw = sandbox.extractCableData(state.pdfText)
    if (!Array.isArray(raw)) throw new Error('extractCableData must return an array')

    const records = raw
      .filter(r => r && typeof r === 'object')
      .map(r => ({
        manufacturer:  String(r.manufacturer  || ''),
        part_number:   String(r.part_number   || ''),
        cable_type:    String(r.cable_type    || ''),
        size:          String(r.size          || ''),
        voltage_rating: String(r.voltage_rating || ''),
        current_rating: String(r.current_rating || ''),
        material:      String(r.material      || ''),
        insulation:    String(r.insulation    || ''),
        jacket:        String(r.jacket        || ''),
        color:         String(r.color         || ''),
        price:         isNaN(parseFloat(r.price)) ? '' : parseFloat(r.price),
        currency:      String(r.currency      || 'USD'),
        unit:          String(r.unit          || ''),
        standard:      String(r.standard      || ''),
        catalog_date:  String(r.catalog_date  || ''),
        notes:         String(r.notes         || '')
      }))

    sendProgress(state, 2, 'done', `${records.length} candidates`)
    return { records }
  } catch (err) {
    sendProgress(state, 2, 'error', err.message)
    return { error: err.message, status: 'error' }
  }
}

// ── Node: validateRecords ─────────────────────────────────────────────────────
function validateRecordsNode(state) {
  sendProgress(state, 3, 'active', '')
  const valid = state.records.filter(r =>
    r.manufacturer || r.cable_type || r.size || r.part_number
  )
  if (valid.length === 0) {
    sendProgress(state, 3, 'error', 'No valid records')
    return { records: [], status: 'noData' }
  }
  sendProgress(state, 3, 'done', `${valid.length} valid`)
  return { records: valid, status: 'done' }
}

// ── Routing functions ─────────────────────────────────────────────────────────
function routeAfterParse(state) {
  return state.error ? END : 'generateScript'
}

function routeAfterGenerate(state) {
  if (!state.error) return 'runExtraction'
  // Retry up to 2 extra times (3 attempts total)
  if (state.retryCount < 3) return 'generateScript'
  return END
}

function routeAfterExtraction(state) {
  return state.error ? END : 'validateRecords'
}

// ── Build the graph ───────────────────────────────────────────────────────────
function buildEtlGraph() {
  const graph = new StateGraph(ETLState)
    .addNode('parsePdf',        parsePdfNode)
    .addNode('generateScript',  generateScriptNode)
    .addNode('runExtraction',   runExtractionNode)
    .addNode('validateRecords', validateRecordsNode)
    .addEdge('__start__',       'parsePdf')
    .addConditionalEdges('parsePdf',       routeAfterParse)
    .addConditionalEdges('generateScript', routeAfterGenerate)
    .addConditionalEdges('runExtraction',  routeAfterExtraction)
    .addEdge('validateRecords', END)

  return graph.compile()
}

const etlGraph = buildEtlGraph()

// ── IPC Handler ───────────────────────────────────────────────────────────────
export function registerEtlGraphHandlers() {
  ipcMain.handle('etl:run-pipeline', async (event, { filePath, backend, ollamaUrl, ollamaModel, geminiModel }) => {
    const fileName = filePath.replace(/\\/g, '/').split('/').pop()

    try {
      const finalState = await etlGraph.invoke({
        filePath,
        fileName,
        backend:    backend    || 'gemini',
        ollamaUrl:  ollamaUrl  || 'http://localhost:11434',
        ollamaModel: ollamaModel || 'gemma4:e4b',
        geminiModel: geminiModel || 'gemini-2.5-flash',
        senderWebContentsId: event.sender.id
      })

      if (finalState.status === 'error') {
        return { success: false, error: finalState.error }
      }
      if (finalState.status === 'noData') {
        return { success: true, noData: true, records: [], script: finalState.script }
      }
      return {
        success: true,
        records: finalState.records,
        script:  finalState.script,
        pdfPages: finalState.pdfPages
      }
    } catch (err) {
      console.error('[ETLGraph] Pipeline error:', err)
      return { success: false, error: err.message }
    }
  })
}
