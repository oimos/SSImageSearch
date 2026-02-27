import { Routes, Route } from 'react-router-dom'
import { SearchFlowProvider } from './contexts/SearchFlowContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import Home from './routes/Home'
import Workspace from './routes/Workspace'
import History from './routes/History'
import CommandPalette from './components/CommandPalette'
import { useGlobalShortcuts } from './hooks/useKeyboard'

export default function App(): JSX.Element {
  useGlobalShortcuts()

  return (
    <ThemeProvider>
      <SearchFlowProvider>
        <div data-testid="app-root">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="history" element={<History />} />
            </Route>
          </Routes>
        </div>
        <CommandPalette />
      </SearchFlowProvider>
    </ThemeProvider>
  )
}
