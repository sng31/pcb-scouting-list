import { Routes, Route, Navigate } from 'react-router-dom'
import TabBar from './components/TabBar'
import Home from './screens/Home'
import Browse from './screens/Browse'
import AddItem from './screens/AddItem'
import ItemDetail from './screens/ItemDetail'
import Settings from './screens/Settings'

// Phase 2 screens not built yet — friendly placeholder keeps the tab bar whole.
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <h1 className="text-2xl text-ink">{title}</h1>
      <p className="mt-2 text-muted">Coming in Phase 2 🐚</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col pb-20">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/favorites" element={<ComingSoon title="Favorites" />} />
          <Route path="/checklist" element={<ComingSoon title="Checklist" />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/item/new" element={<AddItem />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
