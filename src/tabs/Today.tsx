// src/tabs/Today.tsx
import { useEffect, useState, useMemo } from 'react'
import { supabase, todayKey } from '../lib/supabase'

type Props = {
  isAuthed: boolean
  onAuthClick: () => void
}

export default function TodayTab({ isAuthed, onAuthClick }: Props) {
  const [todayCount, setTodayCount] = useState<number>(0)  // total already done today
  const [addValue, setAddValue] = useState<string>('0')    // input always starts at 0
  const [saving, setSaving] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)

  // Load today's total + goal whenever auth changes (or on mount)
  useEffect(() => {
    ;(async () => {
      if (!isAuthed) {
        setTodayCount(0)
        setGoal(null)
        setAddValue('0')
        return
      }
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (!user) return

      const { data: entry } = await supabase
        .from('pushup_entries')
        .select('count')
        .eq('user_id', user.id)
        .eq('entry_date', todayKey())
        .maybeSingle()
      setTodayCount(entry?.count ?? 0)

      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_goal')
        .eq('user_id', user.id)
        .maybeSingle()
      setGoal(prof?.daily_goal ?? null)

      // input should always start at 0
      setAddValue('0')
    })()
  }, [isAuthed])

  // Circle progress (0..360deg) based on daily goal
  const angle = useMemo(() => {
    if (!goal || goal <= 0) return 0
    const pct = Math.min(todayCount / goal, 1)
    return Math.round(pct * 360)
  }, [todayCount, goal])

  const ringStyle = useMemo(
    () => ({
      background: `conic-gradient(#2B8659 ${angle}deg, #e5e7eb ${angle}deg 360deg)`,
    }),
    [angle]
  )

  const onFocus = () => { if (addValue === '0') setAddValue('') }
  const onBlur  = () => { if (addValue === '') setAddValue('0') }

  const onAdd = async () => {
    if (!isAuthed) return
    const delta = Number(addValue)
    if (!Number.isInteger(delta) || delta < 0) {
      alert('Enter a whole number (0 or more).')
      return
    }
    const newTotal = todayCount + delta

    setSaving(true)
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) { setSaving(false); return }

    // Upsert new total for today
    const { error } = await supabase
      .from('pushup_entries')
      .upsert(
        { user_id: user.id, entry_date: todayKey(), count: newTotal },
        { onConflict: 'user_id,entry_date' }
      )

    setSaving(false)
    if (error) {
      console.error(error)
      alert('Could not add push-ups.')
      return
    }

    // reflect immediately + reset input to 0
    setTodayCount(newTotal)
    setAddValue('0')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-center">My pushups today</h1>

      {!isAuthed && (
        <p className="text-sm text-center text-gray-700">
          <button onClick={onAuthClick} className="text-primary underline font-medium">
            Sign up or log in
          </button>{' '}
          to enter pushups on the Account screen.
        </p>
      )}

      {/* Progress ring */}
      <div className="flex items-center justify-center">
        <div
          className="rounded-full p-2"
          style={ringStyle}
          aria-label="Daily progress"
        >
          {/* inner cutout */}
          <div className="bg-white rounded-full w-56 h-56 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold">{todayCount}</div>
              <div className="text-sm text-gray-500">
                {goal ? `of ${goal}` : 'Set a daily goal'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add input */}
      <div className="flex flex-col items-center gap-2">
        <label className="text-sm text-gray-700">Add your push-ups</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className="w-28 border rounded-xl px-3 py-2 text-center outline-none focus:ring-2 focus:ring-primary/40"
            value={addValue}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={(e) => setAddValue(e.target.value)}
            disabled={!isAuthed}
          />
          <button
            className="bg-primary text-white font-semibold px-5 py-2.5 rounded-2xl transition disabled:opacity-60"
            onClick={onAdd}
            disabled={!isAuthed || saving}
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
        {goal == null && (
          <p className="text-xs text-gray-500">
            Set your daily goal on the Account tab to see progress.
          </p>
        )}
      </div>
    </div>
  )
}
