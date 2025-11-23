import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TokenDeployPage from './pages/TokenDeployPage'
import FeedPage from './pages/FeedPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="deploy" element={<TokenDeployPage />} />
        <Route path="feed" element={<FeedPage />} />
      </Route>
    </Routes>
  )
}

export default App
