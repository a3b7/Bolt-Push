import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'

function useSession() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return session
}

function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Bolt Push</h1>
        <p className="text-gray-600 mb-6">Track your daily push-ups and climb the board.</p>
        <button
          onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
          className="w-full rounded-2xl py-3 font-semibold bg-primary text-white hover:bg-primary/90 transition"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}

function Nav({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const tabs = ['today', 'history', 'community', 'account']
  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-md mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-2xl capitalize whitespace-nowrap ${tab===t? 'bg-primary text-white':'bg-gray-100'}`}
          >{t}</button>
        ))}
      </div>
    </div>
  )
}

function useEnsureProfile() {
  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return
      await supabase.from('profiles').upsert({
        user_id: user.user.id,
        display_name: user.user.user_metadata?.full_name ?? user.user.email
      }, { onConflict: 'user_id' })
    })()
  }, [])
}

function Today() {
  const qc = useQueryClient()
  const today = useMemo(() => new Date(), [])
  const localDate = useMemo(() => {
    const y = today.getFullYear()
    const m = String(today.getMonth()+1).padStart(2,'0')
    const d = String(today.getDate()).padStart(2,'0')
    return `${y}-${m}-${d}`
  }, [today])

  const { data: existing } = useQuery({
    queryKey: ['entry', localDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pushup_entries')
        .select('*')
        .eq('entry_date', localDate)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') throw error
      return data || null
    }
  })

  const [count, setCount] = useState<number>(existing?.count ?? 0)
  useEffect(() => { if (existing) setCount(existing.count) }, [existing])

  const save = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not signed in')
      const { error } = await supabase.from('pushup_entries').upsert({
        user_id: user.user.id,
        entry_date: localDate,
        count
      }, { onConflict: 'user_id,entry_date' })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Saved today's push-ups!")
      qc.invalidateQueries({ queryKey: ['entry', localDate] })
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['board'] })
      qc.invalidateQueries({ queryKey: ['global'] })
    },
    onError: (e: any) => toast.error(e.message)
  })

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-3">Today</h2>
      <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
        <input type="number" min={0} value={Number.isFinite(count)?count:0}
          onChange={e => setCount(parseInt(e.target.value||'0',10))}
          className="flex-1 border rounded-2xl px-3 py-3"
          placeholder="How many push-ups today?"/>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="px-4 py-3 rounded-2xl bg-primary text-white font-semibold disabled:opacity-60 hover:bg-primary/90 transition">
          Save
        </button>
      </div>
      {existing && (
        <p className="text-sm text-gray-600 mt-2">Already saved for today. Saving again will overwrite.</p>
      )}
    </div>
  )
}

function History() {
  const { data } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pushup_entries')
        .select('entry_date,count')
        .order('entry_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return data
    }
  })
  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-3">My last 30 days</h2>
      <div className="bg-white rounded-2xl shadow divide-y">
        {data?.length ? data.map(r => (
          <div key={r.entry_date} className="flex justify-between px-4 py-3">
            <span>{r.entry_date}</span>
            <span className="font-semibold">{r.count}</span>
          </div>
        )) : <div className="p-4 text-gray-500">No entries yet.</div>}
      </div>
    </div>
  )
}

function Community() {
  const { data: global } = useQuery({
    queryKey: ['global'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_total')
      if (error) throw error
      return data as number
    }
  })

  const { data: board } = useQuery({
    queryKey: ['board'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: 50 })
      if (error) throw error
      return data as { display_name: string, total: number }[]
    }
  })

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-1">Community</h2>
      <p className="text-gray-600 mb-3">Global total</p>
      <div className="bg-white rounded-2xl shadow p-4 mb-4 text-center text-3xl font-bold">{global ?? 0}</div>
      <h3 className="text-lg font-semibold mb-2">Leaderboard</h3>
      <div className="bg-white rounded-2xl shadow divide-y">
        {board?.length ? board.map((r, i) => (
          <div key={i} className="flex justify-between px-4 py-3">
            <span className="truncate max-w-[70%]">{i+1}. {r.display_name || 'Anonymous'}</span>
            <span className="font-semibold">{r.total}</span>
          </div>
        )) : <div className="p-4 text-gray-500">No data yet.</div>}
      </div>
    </div>
  )
}

function Account() {
  const [name, setName] = useState("")
  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', user.user.id).maybeSingle()
      if (data?.display_name) setName(data.display_name)
    })()
  }, [])

  const save = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) return
    const { error } = await supabase.from('profiles').upsert({ user_id: user.user.id, display_name: name }, { onConflict: 'user_id' })
    if (error) toast.error(error.message); else toast.success('Saved')
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-3">Account</h2>
      <div className="bg-white rounded-2xl shadow p-4 flex gap-3">
        <input className="flex-1 border rounded-2xl px-3 py-3" value={name} onChange={e=>setName(e.target.value)} placeholder="Display name"/>
        <button onClick={save} className="px-4 py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/90 transition">Save</button>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="mt-4 text-red-600">Sign out</button>
    </div>
  )
}

export default function App() {
  const session = useSession()
  const [tab, setTab] = useState('today')
  useEnsureProfile()

  if (!session) return <SignIn />

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      <Nav tab={tab} setTab={setTab} />
      <div className="pb-20">
        {tab==='today' && <Today />}
        {tab==='history' && <History />}
        {tab==='community' && <Community />}
        {tab==='account' && <Account />}
      </div>
    </div>
  )
}