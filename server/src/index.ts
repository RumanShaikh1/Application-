import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { explainStockContext, translateTerm } from './gemini.js'
import { getStockChart, getStockNews, getStockProfile, getStockStats } from './yahoo.js'
import type { ChartRange, StockContextRequest, TranslateRequest } from '../../shared/types.js'

const PORT = Number(process.env.PORT) || 8787
const CHART_RANGES: ChartRange[] = ['1w', '1mo', '3mo', '1y']

const app = express()
// The extension's background service worker is the only intended caller,
// but CORS is left permissive since this only ever binds to localhost.
app.use(cors())
app.use(express.json())

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) })
})

app.post(
  '/api/translate',
  asyncRoute(async (req, res) => {
    const { text, sourceUrl, simplifyFurther } = req.body as Partial<TranslateRequest>
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Field "text" is required.' })
      return
    }
    const result = await translateTerm({ text, sourceUrl, simplifyFurther })
    res.json({ result })
  })
)

app.post(
  '/api/context',
  asyncRoute(async (req, res) => {
    const { symbol, name, headlines } = req.body as Partial<StockContextRequest>
    if (typeof symbol !== 'string' || !symbol.trim()) {
      res.status(400).json({ error: 'Field "symbol" is required.' })
      return
    }
    const result = await explainStockContext({
      symbol,
      name: name ?? symbol,
      headlines: Array.isArray(headlines) ? headlines : []
    })
    res.json({ result })
  })
)

app.get(
  '/api/stats',
  asyncRoute(async (req, res) => {
    const symbolsParam = req.query.symbols
    const symbols = typeof symbolsParam === 'string' ? symbolsParam.split(',').filter(Boolean) : []
    const result = await getStockStats(symbols)
    res.json(result)
  })
)

app.get(
  '/api/profile/:symbol',
  asyncRoute(async (req, res) => {
    const result = await getStockProfile(req.params.symbol)
    res.json(result)
  })
)

app.get(
  '/api/news/:symbol',
  asyncRoute(async (req, res) => {
    const result = await getStockNews(req.params.symbol)
    res.json(result)
  })
)

app.get(
  '/api/chart/:symbol',
  asyncRoute(async (req, res) => {
    const range = req.query.range
    if (typeof range !== 'string' || !CHART_RANGES.includes(range as ChartRange)) {
      res.status(400).json({ error: `Query param "range" must be one of: ${CHART_RANGES.join(', ')}.` })
      return
    }
    const result = await getStockChart(req.params.symbol, range as ChartRange)
    res.json(result)
  })
)

// Keep error bodies safe/structured - the underlying error is logged
// server-side, but only its message (never a raw stack) reaches the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server]', err)
  const message = err instanceof Error ? err.message : 'Unexpected server error.'
  res.status(500).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`MarketPane server listening on http://localhost:${PORT}`)
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[server] GEMINI_API_KEY is not set - translation and context features will fail until it is added to server/.env')
  }
})
