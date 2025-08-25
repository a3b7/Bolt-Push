import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AccountTab({ isAuthed, onAuthClick }: { isAuthed: boolean; onAuthClick: () => void }) {
  const [goal, setGoal] = useState<string>('')   // 1-999
  const [name, setName] = useState<string>('')   // display name
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isAuthed) return
    ;(async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (!user) return
      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_goal, display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (prof?.daily_goal) setGoal(String(prof.daily_goal))
      setName(prof?.display_name ?? (user.user_metadata?.full_name ?? user.email ?? ''))
    })()
  }, [isAuthed])

async function saveAll() {
  if (goal === '') { alert('Please enter a daily goal (1–999).'); return }
  const n = Number(goal)
  if (!Number.isInteger(n) || n < 1 || n > 999) { alert('Daily goal must be 1–999.'); return }
  const trimmed = (name ?? '').trim()
  if (!trimmed) { alert('Please enter a user name.'); return }

  setSaving(true)
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) { setSaving(false); return }

  const { error } = await supabase.from('profiles').upsert({
    user_id: user.id,
    daily_goal: n,
    display_name: trimmed,
  })

  if (error) { setSaving(false); alert('Could not save.'); return }

  // Claim staged CSV history into this account for the "Bolt" community
const { error: claimErr } = await supabase.rpc('rpc_claim_staged_data_for_me', { p_community_name: 'Bolt' })
if (claimErr) console.warn('claim staged history failed:', claimErr.message)

  setSaving(false)
  // optional: refresh UI so History/Community reflect imported data immediately
 window.location.reload()
}


  async function logOut() {
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  async function deleteMyData() {
    if (!isAuthed) return
    const ok = window.confirm('This will delete your data permanently')
    if (!ok) return
    setDeleting(true)
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) { setDeleting(false); return }

    // delete entries
    const { error: e1 } = await supabase.from('pushup_entries').delete().eq('user_id', user.id)
    // clear profile fields (keeps account record but removes name/goal)
    const { error: e2 } = await supabase.from('profiles').update({
      daily_goal: null,
      display_name: null,
    }).eq('user_id', user.id)

    setDeleting(false)
    if (e1 || e2) { alert('Could not delete all data. Please try again.'); return }

    await supabase.auth.signOut()
    window.location.assign('/')
  }

  // UNAUTH VIEW — one green button
  if (!isAuthed) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Account</h1>
        <button
          className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-3 rounded-2xl transition"
          onClick={onAuthClick}
        >
          Sign Up or Log In with Google Account
        </button>
      </div>
    )
  }

  // AUTH VIEW
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">User name</label>
        <input
          type="text"
          className="w-full max-w-xs border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        {/* Always visible (mobile & desktop) */}
        <button type="button" onClick={logOut} className="text-red-600 text-sm underline mt-1">
          Log out
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Daily goal</label>
        <input
          type="number" inputMode="numeric" min={1} max={999} step={1} placeholder="e.g., 50"
          className="w-full max-w-xs border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <p className="text-sm text-gray-600">
          How many pushups per day do you wish to do (1–999).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-3 rounded-2xl transition disabled:opacity-60"
          onClick={saveAll}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-3 rounded-2xl transition disabled:opacity-60"
          onClick={deleteMyData}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete my data'}
        </button>
      </div>
    </div>
  )
}
