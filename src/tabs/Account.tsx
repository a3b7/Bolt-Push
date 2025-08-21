import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AccountTab() {
  const [goal, setGoal] = useState<string>('')        // 1–999
  const [name, setName] = useState<string>('')        // display name
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_goal, display_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (prof?.daily_goal) setGoal(String(prof.daily_goal))
      // default to Google name if profile empty
      setName(prof?.display_name ?? (user.user_metadata?.full_name ?? user.email ?? ''))
    })()
  }, [])

  const saveAll = async () => {
    // daily goal validation
    if (goal === '') { alert('Please enter a daily goal (1–999).'); return }
    const n = Number(goal)
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      alert('Daily goal must be a whole number between 1 and 999.')
      return
    }
    // name validation (basic)
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
    setSaving(false)
    if (error) alert('Could not save.'); 
  }

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
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Daily goal</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          placeholder="e.g., 50"
          className="w-full max-w-xs border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <p className="text-sm text-gray-600">
          How many pushups per day do you wish to do (1–999).
        </p>
      </div>

      <button
        className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-3 rounded-2xl transition disabled:opacity-60"
        onClick={saveAll}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
