import { useEffect, useState } from 'react'
import { supabase, todayKey } from '../lib/supabase'

type Props = {
  isAuthed: boolean
  onAuthClick: () => void
}

export default function TodayTab({ isAuthed, onAuthClick }: Props) {
  const [value, setValue] = useState<string>('0')
  const [saving, setSaving] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)

  // Load today's entry + goal when component mounts (and whenever auth changes)
  useEffect(() => {
    if (!isAuthed) return
    ;(async () => {
      // 👇 Avoid maybeSingle() so duplicates (if any) don’t break loading
      const { data } = await supabase
        .from('pushup_entries')
        .select('count')
        .eq('entry_date', todayKey())
        .limit(1)
      if (data && data.length > 0 && data[0]?.count != null) {
        setValue(String(data[0].count))
      } else {
        setValue('0')
      }

      const { data: userRes } = await supabase.auth.getUser()
      if (userRes?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('daily_goal')
          .eq('user_id', userRes.user.id)
          .maybeSingle()
        if (prof?.daily_goal) setGoal(prof.daily_goal)
      }
    })()
  }, [isAuthed])

  const onFocus = () => { if (value === '0') setValue('') }
  const onBlur  = () => { if (value === '') setValue('0') }

  const onSave = async () => {
    if (!isAuthed) return
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
      .upsert(
        { user_id: user.id, entry_date: todayKey(), count: n },
        { onConflict: 'user_id,entry_date' }
      )

    setSaving(false)
    if (error) {
      console.error(error)
      alert('Could not save today’s push-ups.')
    } else {
      // 👇 Immediately reflect the saved value in the input
      setValue(String(n))
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My pushups today</h1>

      {!isAuthed && (
        <p className="text-sm text-gray-700">
          <button onClick={onAuthClick} className="text-primary underline font-medium">
            Sign up or log in
          </button>{' '}
          to enter pushups on the Account screen.
        </p>
      )}

      <div className="space-y-2">
        <input
          type="number" inputMode="numeric" min={0} step={1}
          className="w-full max-w-xs border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          value={value} onFocus={onFocus} onBlur={onBlur}
          onChange={(e) => setValue(e.target.value)}
          disabled={!isAuthed}
        />
        <p className="text-sm text-gray-600">
          Enter how many push-ups you did today{goal ? ` — your goal is ${goal}/day.` : '.'}
        </p>
      </div>

      <button
        className="bg-primary text-white font-semibold px-5 py-3 rounded-2xl transition disabled:opacity-60"
        onClick={onSave}
        disabled={!isAuthed || saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
