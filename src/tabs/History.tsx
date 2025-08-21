import { useEffect, useMemo, useState } from 'react'
import { supabase, dateKey } from '../lib/supabase'

type Entry = { entry_date: string; count: number }

export default function HistoryTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [goal, setGoal] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      const today = new Date()
      const start = new Date(today)
      start.setDate(today.getDate() - 99) // window = last 100 days (incl. today)

      const { data: rows, error } = await supabase
        .from('pushup_entries')
        .select('entry_date,count')
        .gte('entry_date', dateKey(start))
        .order('entry_date', { ascending: true }) // oldest -> newest
      if (!error) setEntries(rows ?? [])

      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes?.user
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('daily_goal')
          .eq('user_id', user.id)
          .maybeSingle()
        if (prof?.daily_goal) setGoal(prof.daily_goal)
      }
    })()
  }, [])

  // map API rows by date string
  const byDate: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of entries) m[r.entry_date] = r.count
    return m
  }, [entries])

  // Build the last 100 days (oldest -> newest)
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

  // Find first non-zero within the window; trim leading zeros
  const trimmedDays = useMemo(() => {
    const firstIdx = windowDays.findIndex(d => d.count > 0)
    if (firstIdx === -1) return windowDays // all zeros -> show full window
    return windowDays.slice(firstIdx)      // from first non-zero to today
  }, [windowDays])

  // Show newest at top (today first)
  const display = useMemo(() => {
    return [...trimmedDays].reverse()
  }, [trimmedDays])

  const boxClass = (n: number) => {
    if (n === 0) return 'border-red-500'
    if (goal != null) {
      if (n >= goal) return 'border-green-500'
      if (n > 0 && n < goal) return 'border-yellow-400'
    }
    return n > 0 ? 'border-yellow-400' : 'border-red-500'
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">My last 100 days</h1>

      {/* Stack as a single column (newest at top). If you prefer grid, keep grid but ensure order = newest first */}
      <div className="flex flex-col gap-2">
        {display.map(({ key, count }) => (
          <div
            key={key}
            className={`border-2 ${boxClass(count)} rounded-lg p-2 bg-white flex justify-between items-center`}
            title={key}
          >
            <div className="text-sm text-gray-500">{key}</div>
            <div className="font-semibold">{count}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm text-gray-600">
        {goal ? `Goal: ${goal}/day` : 'Set a daily goal on the Account tab for color coding.'}
      </p>
    </div>
  )
}
