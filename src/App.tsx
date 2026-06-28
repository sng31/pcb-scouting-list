import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import TabBar from './components/TabBar'
import Home from './screens/Home'
import Browse from './screens/Browse'
import Favorites from './screens/Favorites'
import AddItem from './screens/AddItem'
import ItemDetail from './screens/ItemDetail'
import Settings from './screens/Settings'
import { useStore } from './store'
import { requestPersistentStorage } from './storage'

export default function App() {
  const hasHydrated = useStore((s) => s.hasHydrated)

  // Ask the browser to make on-device storage durable (best-effort; some
  // browsers auto-grant for installed PWAs). Fire-and-forget on first mount.
  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  // IndexedDB hydrates asynchronously — hold the first paint until data is in
  // so we never flash an empty list (or the seed) over real data.
  if (!hasHydrated) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-sand">
        <p className="animate-pulse font-display text-lg text-muted">Loading your list…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col pb-20">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/favorites" element={<Favorites />} />
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
