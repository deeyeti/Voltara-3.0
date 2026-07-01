# CableVault

> An intelligent ETL desktop application for processing cable catalog PDFs and managing structured cable data — powered by Gemini AI or a local Ollama LLM.

---

## ✨ Features

### 🤖 Dual AI Backend
- **Gemini Cloud** — Google Gemini 2.5 Flash/Pro via the official API. Fast, highly capable.
- **Ollama Local** — Run any local LLM (Gemma, LLaMA, Mistral, etc.) entirely offline. No data ever leaves your machine.
- Switch between backends at any time from the Settings panel.

### 📄 AI-Powered ETL Pipeline
- **Upload PDF catalogs** and let the AI automatically generate a custom JavaScript extraction script tailored to that catalog's layout.
- Extraction runs in a **sandboxed Node.js VM** — generated code cannot access the filesystem or network.
- **4-stage progress tracking**: Parse → Generate Script → Run Extraction → Validate Records.
- Review extracted cable records before saving them to the database.

### 🗄️ Local SQLite Database
- All cable records are stored in a local **SQLite database** in the user's AppData folder.
- Full CRUD support: view, edit, delete individual records.
- **Export to CSV** with optional filters.

### 💬 Chat Interface
- Conversational AI assistant with full chat history.
- Supports cable standard questions (IEC, BS, ASTM, NEC), ETL troubleshooting, and spec lookups.
- **Chat history is persisted** to disk and restored on every app launch.
- Clear chat button wipes history completely.

### 🔐 Built-in Security
- **PII Redaction** — Automatically detects and redacts personal data (emails, phone numbers, addresses) before sending any text to a cloud AI.
- **Prompt Injection Guard** — Scans messages for known injection patterns and blocks them.
- API keys stored locally in the user's AppData folder, never committed to source control.

### ⚙️ Persistent Settings
- Gemini API key, selected model, Ollama URL, and Ollama model all survive app restarts.
- Settings are saved as JSON in the user's AppData folder.

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                  │
│                                                         │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │  gemini.js  │  │  ollama.js    │  │  storage.js  │  │
│  │  (Gemini AI)│  │  (local LLM)  │  │  (JSON files)│  │
│  └─────────────┘  └───────────────┘  └──────────────┘  │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │    db.js    │  │   files.js    │  │  security/   │  │
│  │  (SQLite)   │  │  (File system)│  │  pii.js      │  │
│  └─────────────┘  └───────────────┘  │  promptGuard │  │
│                                       └──────────────┘  │
│                    IPC Bridge                           │
├─────────────────────────────────────────────────────────┤
│                    Preload Script                       │
│             contextBridge → window.api                  │
├─────────────────────────────────────────────────────────┤
│              Renderer (React + Vite)                    │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  ChatView  │ │  DataView    │ │  SettingsView    │  │
│  └────────────┘ └──────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 39 |
| Frontend | React 19 + Vite 7 |
| AI (cloud) | Google Gemini 2.5 Flash/Pro via `@google/generative-ai` |
| AI (local) | Ollama (any GGUF model) via REST API |
| Database | SQLite via `sql.js` |
| PDF parsing | `pdf-parse` |
| CSV | `papaparse` |
| Icons | `lucide-react` |
| Security | Custom PII redactor + prompt injection guard |
| Persistence | Electron `userData` JSON files via IPC |

### Data Flow: ETL Pipeline

```
PDF File
  ↓ (etl:parse-pdf)   pdf-parse extracts raw text
  ↓ (etl:generate-script)  Gemini/Ollama generates JS extraction function
  ↓ (etl:run-script)  Runs in sandboxed Node.js VM (no filesystem/network access)
  ↓ validation        Filter & normalise records
  ↓ user review       Preview in UI, confirm or discard
  ↓ (db:insert-records)  Persist to local SQLite
```

### Security Model

- **Renderer process**: no Node.js access, communicates only via `window.api` contextBridge.
- **Sandbox**: `sandbox: false` on preload only; renderer has `contextIsolation: true, nodeIntegration: false`.
- **ETL VM sandbox**: generated extraction code runs in an isolated `vm.createContext()` with no access to `require`, `fs`, `net`, or `process`.
- **PII redaction** happens before any text is sent to a cloud API.
- **DevTools** are only opened in development mode (`is.dev`), never in production builds.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier available) **or** [Ollama](https://ollama.com/) installed locally

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build (Distributable Installer)

```bash
# Windows installer (.exe)
npm run build:win

# macOS disk image (.dmg)
npm run build:mac

# Linux AppImage / deb / snap
npm run build:linux
```

The Windows build produces `dist/CableVault-1.0.0-setup.exe` — a standard NSIS installer that creates a desktop shortcut. No DevTools, no console window.

---

## 📁 Project Structure

```
src/
├── main/               # Electron main process (Node.js)
│   ├── index.js        # App entry, window creation
│   ├── db/             # SQLite schema & migrations
│   └── ipc/
│       ├── gemini.js   # Gemini AI + ETL VM sandbox
│       ├── ollama.js   # Ollama local LLM
│       ├── db.js       # Database CRUD handlers
│       ├── files.js    # File system handlers
│       └── storage.js  # Persistent JSON file storage
│   └── security/
│       ├── pii.js      # PII detection & redaction
│       └── promptGuard.js  # Prompt injection detection
├── preload/
│   └── index.js        # contextBridge API surface
└── renderer/           # React frontend (Vite)
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── assets/main.css
        └── views/
            ├── ChatView.jsx
            ├── DataView.jsx
            └── SettingsView.jsx
```

---

## 🔧 Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
