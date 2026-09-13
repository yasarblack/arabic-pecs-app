import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login.jsx'
import ProfileSelect from './pages/ProfileSelect.jsx'
import Board from './pages/Board.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/profiles" element={<ProfileSelect />} />
      <Route path="/board/:profileId" element={<Board />} />
    </Routes>
  )
}
