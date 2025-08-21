import { useEffect, useState } from 'react'
import TodayTab from './tabs/Today'
import HistoryTab from './tabs/History'
import CommunityTab from './tabs/Community'
import AccountTab from './tabs/Account'
import { supabase, startGoogle } from './lib/supabase'

function useAuth() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return !!session
}

export default function App() {
  const isAuthed = useAuth()
  const [tab, setTab] = useState<'today'|'history'|'community'|'account'>(isAuthed ? 'today' : 'community')

  useEffect(() => {
    if (!isAuthed && (tab === 'today' || tab === 'history')) setTab('community')
  }, [isAuthed, tab])

  const tabs = isAuthed
    ? ([
        ['today', 'Today'],
        ['history', 'History'],
        ['community', 'Community'],
        ['account', 'Account'],
      ] as const)
    : ([
        ['community', 'Community'],
        ['account', 'Account'],
      ] as const)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 bg-white border-b px-4 py-3 flex gap-2">
        {tabs.map(([key, label]) => (
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

      {tab === 'today' && isAuthed && <TodayTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
      {tab === 'history' && isAuthed && <HistoryTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
      {tab === 'community' && <CommunityTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
      {tab === 'account' && <AccountTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
    </div>
  )
}
