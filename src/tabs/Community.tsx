// src/tabs/Community.tsx
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

  // my communities (auth) or invited one (anon)
  const [communities, setCommunities] = useState<Community[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // data for active community
  const [total, setTotal] = useState<number>(0)
  const [rows, setRows] = useState<Row[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // read ?invite=... once
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('invite')
    if (t) setInviteToken(t)
  }, [])

  // Load communities
  useEffect(() => {
    ;(async () => {
      if (isAuthed) {
        // If invited and authed, join then load
        if (inviteToken) {
          await supabase.rpc('rpc_join_via_invite', { p_token: inviteToken })
        }
        const { data: list } = await supabase.rpc('rpc_my_communities')
        const cs: Community[] = (list ?? []).map((c: any) => ({
          community_id: c.community_id,
          name: c.name,
          is_owner: !!c.is_owner,
        }))
        // If invited, prefer that community as active
        const invited = await getCommunityByInvite(inviteToken)
        const startId =
          invited?.community_id ??
          (activeId && cs.find(c => c.community_id === activeId)?.community_id) ??
          cs[0]?.community_id ??
          null
        setCommunities(cs)
        setActiveId(startId)
      } else {
        // non-auth invited preview
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

  // Load data for active community
  useEffect(() => {
    ;(async () => {
      if (!activeId) {
        setTotal(0)
        setRows([])
        return
      }
      if (inviteToken && !isAuthed) {
        // public via token
        const { data: tot } = await supabase.rpc('rpc_community_total', { p_community_id: activeId })
        const { data: lb } = await supabase.rpc('rpc_community_leaderboard', { p_community_id: activeId })
        setTotal(tot ?? 0)
        setRows((lb ?? []) as any)
      } else {
        // member view
        const { data: tot } = await supabase.rpc('rpc_community_total', { p_community_id: activeId })
        const { data: lb } = await supabase.rpc('rpc_community_leaderboard', { p_community_id: activeId })
        setTotal(tot ?? 0)
        setRows((lb ?? []) as any)
      }
    })()
  }, [activeId, isAuthed, inviteToken])

  // helpers
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
    // move clicked one to top
    const copy = [...communities]
    const [picked] = copy.splice(idx, 1)
    setCommunities([picked, ...copy])
    setActiveId(id)
  }

  async function copyInviteLink() {
    if (!activeId) return
    if (!isAuthed) { onAuthClick(); return }
    const { data: token } = await supabase.rpc('rpc_create_invite', { p_community_id: activeId })
    if (!token) return
    const url = `${window.location.origin}?invite=${token}`
    await navigator.clipboard.writeText(url)
    alert('Link copied')
  }

  async function createCommunity() {
    if (!isAuthed) { onAuthClick(); return }
    const name = newName.trim()
    if (!name) return
    const { data: cid } = await supabase.rpc('rpc_create_community', { p_name: name })
    if (!cid) return
    // reload list
    const { data: list } = await supabase.rpc('rpc_my_communities')
    const cs: Community[] = (list ?? []).map((c: any) => ({
      community_id: c.community_id,
      name: c.name,
      is_owner: !!c.is_owner,
    }))
    // put new one on top and open
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

      {/* Active community header (click name to move/open) */}
      {active && (
        <div className="space-y-3">
          <button
            className="text-left w-full border-2 rounded-xl p-3 bg-white"
            onClick={() => openCommunity(active.community_id)}
          >
            <div className="font-semibold">{active.name}</div>
          </button>

          {/* 1) Invite link */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-1">Community invitation link</div>
            <div className="text-xs text-gray-800 break-all border rounded-md px-3 py-2 bg-gray-50">
              (generated on copy)
            </div>
            <button
              className="mt-2 bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-2xl"
              onClick={copyInviteLink}
              disabled={!isAuthed}
            >
              Copy link
            </button>
          </div>

          {/* 2) Global total */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm text-gray-600">Global total</div>
            <div className="text-3xl font-bold">{total}</div>
          </div>

          {/* 3) Leaderboard */}
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

          {/* 4) Delete community (owner only) */}
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

      {/* Other communities (closed list) */}
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
