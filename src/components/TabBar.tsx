import { NavLink } from 'react-router-dom'
import { Home, Compass, Heart, Settings } from 'lucide-react'
import type { ComponentType } from 'react'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/browse', label: 'Browse', Icon: Compass },
  { to: '/favorites', label: 'Favorites', Icon: Heart },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className="flex flex-col items-center gap-0.5 py-2 text-muted transition-colors aria-[current=page]:text-seafoam"
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
                  <span className="text-[11px] font-semibold">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
