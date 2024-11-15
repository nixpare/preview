import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/css/index.css'
import CraftLogin from './pages/CraftLogin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CraftLogin />
  </StrictMode>,
)
