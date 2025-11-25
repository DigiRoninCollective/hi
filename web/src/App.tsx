import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ControlCenterPage from './pages/ControlCenterPage'
import TokenDeployPage from './pages/TokenDeployPage'
import FeedPage from './pages/FeedPage'
import AlphaFeedPage from './pages/AlphaFeedPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import TelegramAdminPage from './pages/TelegramAdminPage'
import HelpPage from './pages/HelpPage'
import TransactionHistoryPage from './pages/TransactionHistoryPage'
import PortfolioPage from './pages/PortfolioPage'
import EmergencyControlPage from './pages/EmergencyControlPage'
import WalletHealthPage from './pages/WalletHealthPage'
import RPCStatusPage from './pages/RPCStatusPage'

function App() {
  return (
    <Routes>
      {/* Auth pages without layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Main app with layout */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="control" element={<ControlCenterPage />} />
        <Route path="deploy" element={<TokenDeployPage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="alpha" element={<AlphaFeedPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="telegram-admin" element={<TelegramAdminPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="transactions" element={<TransactionHistoryPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="emergency" element={<EmergencyControlPage />} />
        <Route path="wallet" element={<WalletHealthPage />} />
        <Route path="rpc-status" element={<RPCStatusPage />} />
      </Route>
    </Routes>
  )
}

export default App
