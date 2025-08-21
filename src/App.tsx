import { useEffect, useState } from 'react'
import TodayTab from './tabs/Today'
import HistoryTab from './tabs/History'
import CommunityTab from './tabs/Community'
import AccountTab from './tabs/Account'
import { supabase, startGoogle } from './lib/supabase'

function useAuth() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return { isAuthed: !!session, loading }
}

export default function App() {
  const { isAuthed } = useAuth()
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

      {/* Non-auth banner as requested */}
      {!isAuthed && (
        <div className="mx-4 my-3 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-800 p-3">
          <button onClick={() => startGoogle()} className="text-primary underline font-medium">
            Sign up or log in
          </button>{' '}
          to enter pushups on the Account screen.
        </div>
      )}

      {tab === 'today' && <TodayTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'community' && <CommunityTab />}
      {tab === 'account' && <AccountTab isAuthed={isAuthed} onAuthClick={startGoogle} />}
    </div>
  )
}
