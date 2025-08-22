import { useEffect, useMemo, useState } from 'react'
import { supabase, dateKey } from '../lib/supabase'

type Entry = { entry_date: string; count: number }

export default function HistoryTab({
  isAuthed,
  onAuthClick,
}: {
  isAuthed: boolean
  onAuthClick: () => void
}) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [goal, setGoal] = useState<number | null>(null)

  // Inline edit state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (!isAuthed) {
        setEntries([])
        setGoal(null)
        return
      }
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (!user) return

      // ✅ Only this user's rows
      const today = new Date()
      const start = new Date(today)
      start.setDate(today.getDate() - 99)

      const { data: rows } = await supabase
        .from('pushup_entries')
        .select('entry_date,count')
        .eq('user_id', user.id)
        .gte('entry_date', dateKey(start))
        .order('entry_date', { ascending: true }) // oldest -> newest

      setEntries(rows ?? [])

      const { data: prof } = await supabase
        .from('profiles')
        .select('daily_goal')
        .eq('user_id', user.id)
        .maybeSingle()
      setGoal(prof?.daily_goal ?? null)
    })()
  }, [isAuthed])

  // map by date
  const byDate: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of entries) m[r.entry_date] = r.count
    return m
  }, [entries])

  // last 100 days (oldest -> newest)
  const windowDays = useMemo(() => {
    const arr: { key: string; count: number }[] = []
    const today = new Date()
    for (let i = 99; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = dateKey(d)
      arr.push({ key, count: byDate[key] ?? 0 })
    }
    return arr
  }, [byDate])

  // Trim leading zeros up to first non-zero; if all zeros, keep full window
  const trimmedDays = useMemo(() => {
    const firstIdx = windowDays.findIndex(d => d.count > 0)
    if (firstIdx === -1) return windowDays
    return windowDays.slice(firstIdx)
  }, [windowDays])

  // Newest at top
  const display = useMemo(() => [...trimmedDays].reverse(), [trimmedDays])

  const boxClass = (n: number) => {
    if (n === 0) return 'border-red-500'
    if (goal != null) {
      if (n >= goal) return 'border-green-500'
      if (n > 0 && n < goal) return 'border-yellow-400'
    }
    return n > 0 ? 'border-yellow-400' : 'border-red-500'
  }

  function startEdit(key: string, current: number) {
    setEditingKey(key)
    setEditValue(String(current))
  }

  async function saveEdit() {
    if (!editingKey || !isAuthed) return
    const n = Number(editValue)
    if (!Number.isInteger(n) || n < 0) {
      alert('Enter a whole number (0 or more).')
      return
    }
    setSaving(true)
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) { setSaving(false); return }

    // Upsert this day for this user
    const { error } = await supabase
      .from('pushup_entries')
      .upsert(
        { user_id: user.id, entry_date: editingKey, count: n },
        { onConflict: 'user_id,entry_date' }
      )

    setSaving(false)
    if (error) {
      console.error(error)
      alert('Could not save the change.')
      return
    }

    // Update local state so UI reflects immediately
    setEntries(prev => {
      const idx = prev.findIndex(r => r.entry_date === editingKey)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { entry_date: editingKey, count: n }
        return copy
      }
      return [...prev, { entry_date: editingKey, count: n }]
    })
    setEditingKey(null)
  }

  function cancelEdit() {
    setEditingKey(null)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">My last 100 days</h1>

      <p className="text-sm text-gray-700 mb-1">
        You can click any day to correct the value.
      </p>
      {goal != null && (
        <p className="text-sm text-gray-600 mb-3">Goal: {goal} per day</p>
      )}

      <div className="flex flex-col gap-2">
        {display.map(({ key, count }) => (
          <div key={key} className="bg-white rounded-lg border-2 p-2" style={{ borderColor: 'transparent' }}>
            {editingKey === key ? (
              <div className={`border-2 ${boxClass(count)} rounded-lg p-2 bg-white`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-500">{key}</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    className="w-24 border rounded-md px-2 py-1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-60"
                    onClick={saveEdit}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="text-sm px-3 py-1.5 rounded-md border"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={`w-full text-left border-2 ${boxClass(count)} rounded-lg p-2 bg-white flex justify-between items-center`}
                title="Click to edit"
                onClick={() => isAuthed ? startEdit(key, count) : undefined}
                disabled={!isAuthed}
              >
                <div className="text-sm text-gray-500">{key}</div>
                <div className="font-semibold">{count}</div>
              </button>
            )}
          </div>
        ))}
      </div>

      {!isAuthed && (
        <p className="mt-3 text-sm text-gray-700">
          <button onClick={onAuthClick} className="text-primary underline font-medium">
            Sign Up or Log In
          </button>{' '}
          to start entering your own push-ups.
        </p>
      )}
    </div>
  )
}
