import { useState } from 'react'
import TodayTab from './tabs/Today'
import HistoryTab from './tabs/History'
import CommunityTab from './tabs/Community'
import AccountTab from './tabs/Account'

export default function App() {
  const [tab, setTab] = useState<'today'|'history'|'community'|'account'>('today')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 bg-white border-b px-4 py-3 flex gap-2">
        {[
          ['today', 'Today'],
          ['history', 'History'],
          ['community', 'Community'],
          ['account', 'Account'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              tab === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'today' && <TodayTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'community' && <CommunityTab />}
      {tab === 'account' && <AccountTab />}
    </div>
  )
}
