import { useEffect, useState } from 'react'
import { supabase, todayKey } from '../lib/supabase'

export default function TodayTab() {
  const [value, setValue] = useState<string>('0') // shows 0 before entry
  const [saving, setSaving] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)

  // Load existing entry for today + daily goal
  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes?.user) return

      const { data: entry } = await supabase
        .from('pushup_entries')
        .select('count')
        .eq('entry_date', todayKey())
        .maybeSingle()

      if (entry?.count != null) setValue(String(entry.count))

      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_goal')
        .eq('user_id', userRes.user.id)
        .maybeSingle()

      if (prof?.daily_goal) setGoal(prof.daily_goal)
    })()
  }, [])

  const onFocus = () => {
    if (value === '0') setValue('')
  }
  const onBlur = () => {
    if (value === '') setValue('0')
  }

  const onSave = async () => {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      alert('Please enter a whole number (0 or more).')
      return
    }
    setSaving(true)
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) { setSaving(false); return }

    const { error } = await supabase
      .from('pushup_entries')
      .upsert({ user_id: user.id, entry_date: todayKey(), count: n })
      .select()
    setSaving(false)
    if (error) {
      alert('Could not save today’s push-ups.')
    } else {
      // optional: show a toast
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My pushups today</h1>

      <div className="space-y-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="w-full max-w-xs border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-sm text-gray-600">
          Enter how many push-ups you did today{goal ? ` — your goal is ${goal}/day.` : '.'}
        </p>
      </div>

      <button
        className="bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-3 rounded-2xl transition disabled:opacity-60"
        onClick={onSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
