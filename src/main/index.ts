import 'dotenv/config'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { IPC, type ChartRange, type StockContextRequest, type TranslateRequest } from '../shared/ipc-channels'
import { explainStockContext, translateTerm } from './translate'
import { getStockChart, getStockNews, getStockProfile, getStockStats } from './marketData'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#05060d',
    title: 'MarketPane',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open links clicked inside the app shell (not the webview) in the OS browser.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// The renderer asks for the absolute file:// path to the webview preload
// script so it can attach it to the <webview preload="..."> attribute.
ipcMain.on(IPC.GET_WEBVIEW_PRELOAD_PATH, (event) => {
  event.returnValue = pathToFileURL(join(__dirname, '../preload/webview-preload.js')).href
})

// Relay: guest <webview> page -> main process -> top-level renderer.
ipcMain.on(IPC.WEBVIEW_HIGHLIGHT, (_event, text: string, url?: string) => {
  mainWindow?.webContents.send(IPC.HIGHLIGHT_RELAY, {
    text,
    timestamp: Date.now(),
    url
  })
})

// Renderer asks main to call the (free) Gemini translation API so the
// API key never has to leave the main process.
ipcMain.handle(IPC.TRANSLATE_REQUEST, async (_event, request: TranslateRequest) => {
  return translateTerm(request)
})

// Relay: guest <webview> page -> main process -> top-level renderer.
ipcMain.on(IPC.WEBVIEW_TICKERS, (_event, symbols: string[]) => {
  mainWindow?.webContents.send(IPC.TICKERS_RELAY, { symbols })
})

// Renderer asks main to fetch live stats for detected tickers.
ipcMain.handle(IPC.MARKET_STATS_REQUEST, async (_event, symbols: string[]) => {
  return getStockStats(symbols)
})

// The stock detail view: company profile/insights, recent news, and a
// historical price chart, all fetched on demand from the main process.
ipcMain.handle(IPC.STOCK_PROFILE_REQUEST, async (_event, symbol: string) => {
  return getStockProfile(symbol)
})

ipcMain.handle(IPC.STOCK_NEWS_REQUEST, async (_event, symbol: string) => {
  return getStockNews(symbol)
})

ipcMain.handle(IPC.STOCK_CHART_REQUEST, async (_event, symbol: string, range: ChartRange) => {
  return getStockChart(symbol, range)
})

ipcMain.handle(IPC.STOCK_CONTEXT_REQUEST, async (_event, request: StockContextRequest) => {
  return explainStockContext(request)
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.marketpane.app')

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
