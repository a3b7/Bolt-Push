import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Row = {
  user_id: string
  display_name: string
  total: number
  days_active: number
  avg_daily_int: number
}

export default function CommunityTab({
  isAuthed,
  onAuthClick,
}: {
  isAuthed: boolean
  onAuthClick: () => void
}) {
  const [globalTotal, setGlobalTotal] = useState<number>(0)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: tot } = await supabase.rpc('rpc_global_total')
      setGlobalTotal(tot ?? 0)

      const { data: lb } = await supabase.rpc('rpc_leaderboard')
      const normalized: Row[] = (lb ?? []).map((r: any) => ({
        ...r,
        total: Number(r.total ?? 0),
        days_active: Number(r.days_active ?? 1),
        avg_daily_int: Number.isFinite(Number(r.avg_daily_int))
          ? Number(r.avg_daily_int)
          : Math.floor((Number(r.total ?? 0)) / Math.max(1, Number(r.days_active ?? 1))),
      }))

      // ⬇️ Sort DESC by avg_daily_int (highest first)
      normalized.sort((a, b) => b.avg_daily_int - a.avg_daily_int || a.display_name.localeCompare(b.display_name))

      setRows(normalized)
    })()
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Community</h1>

      {!isAuthed && (
        <p className="text-sm text-gray-700">
          <button onClick={onAuthClick} className="text-primary underline font-medium">
            Sign Up or Log In
          </button>{' '}
          to start adding your push-ups.
        </p>
      )}

      <div className="bg-white border rounded-xl p-4">
        <div className="text-sm text-gray-600">Global total</div>
        <div className="text-3xl font-bold">{globalTotal}</div>
      </div>

      <div className="bg-white border rounded-xl overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-4 py-2">User name</th>
              <th className="text-left px-4 py-2">Avg. daily</th>
              <th className="text-left px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.user_id} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-4 py-2">{r.display_name || 'Anonymous'}</td>
                <td className="px-4 py-2">{r.avg_daily_int}</td>
                <td className="px-4 py-2">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-500">
          Sorted by Avg. daily (highest first).
        </div>
      </div>
    </div>
  )
}
