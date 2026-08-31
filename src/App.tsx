/* Main App Component - Handles routing (using react-router-dom) and providers */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import Vitrine from './pages/Vitrine'
import PecaDetalhe from './pages/PecaDetalhe'
import Showroom from './pages/Showroom'
import NotFound from './pages/NotFound'

// Site publico (SPEC-125): sem AuthProvider, sem rota protegida, sem menu entre sistemas.

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Vitrine />} />
          <Route path="/peca/:codigo" element={<PecaDetalhe />} />
          <Route path="/showroom" element={<Showroom />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
