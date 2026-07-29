import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomeRoute from './routes/HomeRoute'
import LearnPage from './routes/LearnPage'
import ScenarioListPage from './routes/ScenarioListPage'
import ScenarioPlayerPage from './routes/ScenarioPlayerPage'
import ResultsPage from './routes/ResultsPage'
import ProgressPage from './routes/ProgressPage'
import SimulatorDashboardPage from './routes/SimulatorDashboardPage'
import SimulatorTradePage from './routes/SimulatorTradePage'
import TaxComparatorPage from './routes/TaxComparatorPage'
import TaxFYOverviewPage from './routes/TaxFYOverviewPage'
import NotFoundPage from './routes/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomeRoute />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="scenarios" element={<ScenarioListPage />} />
          <Route path="scenario/:scenarioId" element={<ScenarioPlayerPage />} />
          <Route path="scenario/:scenarioId/results" element={<ResultsPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="simulator" element={<SimulatorDashboardPage />} />
          <Route path="simulator/trade" element={<SimulatorTradePage />} />
          <Route path="tax" element={<TaxComparatorPage />} />
          <Route path="tax/fy-overview" element={<TaxFYOverviewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
