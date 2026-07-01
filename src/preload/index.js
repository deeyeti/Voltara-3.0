const { contextBridge, ipcRenderer } = require('electron')

// Full CableVault API bridge exposed to renderer
const api = {
  // Chat & Gemini AI
  chat: {
    send: (messages) => ipcRenderer.invoke('chat:send', { messages }),
    testConnection: () => ipcRenderer.invoke('gemini:test'),
    setApiKey: (key) => ipcRenderer.invoke('gemini:set-key', key)
  },

  // ETL pipeline
  etl: {
    parsePdf: (filePath) => ipcRenderer.invoke('etl:parse-pdf', filePath),
    generateScript: (pdfText, fileName) =>
      ipcRenderer.invoke('etl:generate-script', { pdfText, fileName }),
    runScript: (script, pdfText) =>
      ipcRenderer.invoke('etl:run-script', { script, pdfText })
  },

  // Database
  db: {
    insertRecords: (records, sourceFile) =>
      ipcRenderer.invoke('db:insert-records', { records, sourceFile }),
    getRecords: (filters) => ipcRenderer.invoke('db:get-records', filters),
    exportCsv: (filters, destPath) =>
      ipcRenderer.invoke('db:export-csv', { filters, destPath }),
    getSchema: () => ipcRenderer.invoke('db:get-schema'),
    getStats: () => ipcRenderer.invoke('db:get-stats'),
    deleteRecord: (id) => ipcRenderer.invoke('db:delete-record', id),
    updateRecord: (id, field, value) =>
      ipcRenderer.invoke('db:update-record', { id, field, value })
  },

  // File system
  files: {
    listDir: (dirPath) => ipcRenderer.invoke('files:list-dir', dirPath),
    getHome: () => ipcRenderer.invoke('files:get-home'),
    readFile: (filePath) => ipcRenderer.invoke('files:read-file', filePath),
    openDialog: (options) => ipcRenderer.invoke('files:open-dialog', options),
    saveDialog: (options) => ipcRenderer.invoke('files:save-dialog', options),
    openExternal: (filePath) => ipcRenderer.invoke('files:open-external', filePath),
    getDrives: () => ipcRenderer.invoke('files:get-drives')
  },

  // Ollama local LLM
  ollama: {
    test: () => ipcRenderer.invoke('ollama:test'),
    configure: (config) => ipcRenderer.invoke('ollama:configure', config),
    getConfig: () => ipcRenderer.invoke('ollama:get-config'),
    chat: (messages) => ipcRenderer.invoke('ollama:chat', { messages }),
    generateScript: (pdfText, fileName) =>
      ipcRenderer.invoke('ollama:generate-script', { pdfText, fileName }),
    pull: (modelName) => ipcRenderer.invoke('ollama:pull', modelName)
  },

  // Security
  security: {
    scan: (text) => ipcRenderer.invoke('security:scan', text)
  },

  // Persistent local storage (JSON files in userData)
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('storage:delete', key)
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (err) {
  console.error('[Preload] contextBridge failed:', err)
  // Fallback for non-isolated context (dev without sandbox)
  window.api = api
}
