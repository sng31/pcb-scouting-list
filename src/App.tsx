import { Routes, Route, Navigate } from 'react-router-dom'
import TabBar from './components/TabBar'
import Home from './screens/Home'
import Browse from './screens/Browse'
import Favorites from './screens/Favorites'
import AddItem from './screens/AddItem'
import ItemDetail from './screens/ItemDetail'
import Settings from './screens/Settings'

export default function App() {
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
