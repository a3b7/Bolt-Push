import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Community = { community_id: string; name: string; is_owner?: boolean }

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
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  const [communities, setCommunities] = useState<Community[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const [total, setTotal] = useState<number>(0)
  const [rows, setRows] = useState<Row[]>([])

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const [copyState, setCopyState] = useState<'idle'|'copied'|'error'>('idle')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('invite')
    if (t) setInviteToken(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      if (isAuthed) {
        if (inviteToken) {
          await supabase.rpc('rpc_join_via_invite', { p_token: inviteToken })
        }
        const { data: list } = await supabase.rpc('rpc_my_communities')
        const cs: Community[] = (list ?? []).map((c: any) => ({
          community_id: c.community_id,
          name: c.name,
          is_owner: !!c.is_owner,
        }))

        const invited = await getCommunityByInvite(inviteToken)
        const startId =
          invited?.community_id ??
          (activeId && cs.find(c => c.community_id === activeId)?.community_id) ??
          cs[0]?.community_id ??
          null

        setCommunities(cs)
        setActiveId(startId)
      } else {
        if (inviteToken) {
          const invited = await getCommunityByInvite(inviteToken)
          if (invited) {
            setCommunities([invited])
            setActiveId(invited.community_id)
          }
        } else {
          setCommunities([])
          setActiveId(null)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, inviteToken])

  useEffect(() => {
    ;(async () => {
      if (!activeId) {
        setTotal(0)
        setRows([])
        return
      }
      const { data: tot } = await supabase.rpc('rpc_community_total', { p_community_id: activeId })
      const { data: lb } = await supabase.rpc('rpc_community_leaderboard', { p_community_id: activeId })
      setTotal(tot ?? 0)
      setRows((lb ?? []) as any)
    })()
  }, [activeId, isAuthed, inviteToken])

  async function getCommunityByInvite(token: string | null) {
    if (!token) return null
    const { data } = await supabase.rpc('rpc_get_community_by_invite', { p_token: token })
    if (!data || data.length === 0) return null
    const row = data[0]
    return { community_id: row.community_id as string, name: row.name as string }
  }

  function openCommunity(id: string) {
    const idx = communities.findIndex(c => c.community_id === id)
    if (idx <= 0) { setActiveId(id); return }
    const copy = [...communities]
    const [picked] = copy.splice(idx, 1)
    setCommunities([picked, ...copy])
    setActiveId(id)
  }

  // Robust copy: generate token -> compose URL -> try clipboard API -> fallback
  async function copyInviteLink() {
    if (!activeId) return
    if (!isAuthed) { onAuthClick(); return }
    setCopyState('idle')
    try {
      const { data: token, error } = await supabase.rpc('rpc_create_invite', { p_community_id: activeId })
      if (error || !token) throw new Error('No token')

      const url = `${window.location.origin}?invite=${token}`

      // Primary path
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
      } else {
        // Fallback for older browsers / http
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!ok) throw new Error('execCommand failed')
      }

      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch (e) {
      console.error(e)
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2500)
    }
  }

  async function createCommunity() {
    if (!isAuthed) { onAuthClick(); return }
    const name = newName.trim()
    if (!name) return
    const { data: cid } = await supabase.rpc('rpc_create_community', { p_name: name })
    if (!cid) return
    const { data: list } = await supabase.rpc('rpc_my_communities')
    const cs: Community[] = (list ?? []).map((c: any) => ({
      community_id: c.community_id,
      name: c.name,
      is_owner: !!c.is_owner,
    }))
    const idx = cs.findIndex(c => c.community_id === cid)
    if (idx >= 0) {
      const picked = cs[idx]
      const rest = cs.filter((_, i) => i !== idx)
      setCommunities([picked, ...rest])
      setActiveId(picked.community_id)
    } else {
      setCommunities(cs)
      setActiveId(cs[0]?.community_id ?? null)
    }
    setNewName('')
    setCreating(false)
  }

  async function deleteCommunity() {
    if (!activeId) return
    const me = communities.find(c => c.community_id === activeId)
    if (!me?.is_owner) return
    const ok = window.confirm('This will permanently delete the community. Each user’s data will stay intact')
    if (!ok) return
    await supabase.rpc('rpc_delete_community', { p_community_id: activeId })
    const remaining = communities.filter(c => c.community_id !== activeId)
    setCommunities(remaining)
    setActiveId(remaining[0]?.community_id ?? null)
  }

  const active = useMemo(
    () => communities.find(c => c.community_id === activeId) || null,
    [communities, activeId]
  )
  const others = useMemo(
    () => communities.filter(c => c.community_id !== activeId),
    [communities, activeId]
  )

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

      {/* New community (auth only) */}
      {isAuthed && (
        <div>
          {!creating ? (
            <button
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-2xl"
              onClick={() => setCreating(true)}
            >
              New community
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                className="border rounded-xl px-3 py-2"
                placeholder="Community name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-2xl"
                onClick={createCommunity}
              >
                Create
              </button>
              <button className="px-3 py-2 border rounded-2xl" onClick={() => { setCreating(false); setNewName('') }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* OPEN COMMUNITY (outlined as one entity) */}
      {active && (
        <div className="rounded-2xl border-2 border-primary/20 bg-white p-4 space-y-4">
          {/* Name */}
          <div className="font-semibold text-lg">{active.name}</div>

          {/* Invitation */}
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Community invitation link</div>
            <div className="flex items-center gap-3">
              <button
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-2xl"
                onClick={copyInviteLink}
                disabled={!isAuthed}
              >
                Copy link
              </button>
              {copyState === 'copied' && <span className="text-sm text-green-700">Copied!</span>}
              {copyState === 'error' && <span className="text-sm text-red-600">Couldn’t copy</span>}
            </div>
          </div>

          {/* Global total */}
          <div className="border rounded-xl p-4">
            <div className="text-sm text-gray-600">Global total</div>
            <div className="text-3xl font-bold">{total}</div>
          </div>

          {/* Leaderboard */}
          <div className="border rounded-xl overflow-auto">
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

          {/* Delete (owner only) */}
          {isAuthed && active?.is_owner && (
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-2xl"
              onClick={deleteCommunity}
            >
              Delete community
            </button>
          )}
        </div>
      )}

      {/* Closed communities under the open one */}
      {others.length > 0 && (
        <div className="space-y-2">
          {others.map(c => (
            <button
              key={c.community_id}
              className="w-full text-left border rounded-xl p-3 bg-white"
              onClick={() => openCommunity(c.community_id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* No communities yet (auth) */}
      {isAuthed && !active && communities.length === 0 && (
        <p className="text-sm text-gray-600">No communities yet. Create one!</p>
      )}
    </div>
  )
}
