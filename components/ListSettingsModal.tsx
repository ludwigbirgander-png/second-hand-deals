'use client'

import { useState, useEffect } from 'react'
import type { ItemList, ListMember, ListRole } from '@/lib/types'

interface Props {
  list: ItemList
  onClose: () => void
  onUpdated: (updated: ItemList) => void
}

type Tab = 'visibility' | 'members' | 'share'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export function ListSettingsModal({ list, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('visibility')
  const [visibility, setVisibility] = useState(list.visibility)
  const [saving, setSaving] = useState(false)

  const [members, setMembers] = useState<ListMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)

  const [shareTokens, setShareTokens] = useState<{ token: string; role: string }[]>([])
  const [shareRole, setShareRole] = useState<'editor' | 'viewer'>('editor')
  const [copied, setCopied] = useState<string | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (tab === 'members' || tab === 'share') loadMembers()
    if (tab === 'share') loadTokens()
  }, [tab])

  async function loadMembers() {
    setMembersLoading(true)
    const res = await fetch(`/api/lists/${list.id}/members`)
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setMembersLoading(false)
  }

  async function loadTokens() {
    const res = await fetch(`/api/lists/${list.id}/invite`)
    const data = await res.json()
    setShareTokens(Array.isArray(data) ? data : [])
  }

  async function saveVisibility() {
    setSaving(true)
    const res = await fetch(`/api/lists/${list.id}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })
    const data = await res.json()
    setSaving(false)
    if (!data.error) onUpdated(data)
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const res = await fetch(`/api/lists/${list.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.error) {
      setInviteMsg(data.error)
    } else {
      setInviteEmail('')
      setInviteMsg('Invite sent!')
      loadMembers()
    }
  }

  async function changeRole(userId: string, role: ListRole) {
    await fetch(`/api/lists/${list.id}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    loadMembers()
  }

  async function removeMember(userId: string) {
    await fetch(`/api/lists/${list.id}/members/${userId}`, { method: 'DELETE' })
    loadMembers()
  }

  async function createShareLink() {
    const res = await fetch(`/api/lists/${list.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: shareRole }),
    })
    const data = await res.json()
    if (!data.error) loadTokens()
  }

  async function revokeToken(token: string) {
    await fetch(`/api/lists/${list.id}/invite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    loadTokens()
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${appUrl}/lists/join/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">List settings — {list.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-zinc-100 px-6">
          {(['visibility', 'members', 'share'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 mr-4 text-xs font-medium border-b-2 transition-colors capitalize ${
                tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {tab === 'visibility' && (
            <>
              <p className="text-xs text-zinc-500">Control who can see and join this list.</p>
              <div className="space-y-2">
                {[
                  { value: 'private', label: 'Private', desc: 'Only you can see this list' },
                  { value: 'public', label: 'Public', desc: 'Anyone can view and follow this list' },
                  { value: 'collaborative', label: 'Collaborative', desc: 'Invited members can add and edit items' },
                ].map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${visibility === opt.value ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      onChange={() => setVisibility(opt.value as any)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{opt.label}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={saveVisibility}
                disabled={saving || visibility === list.visibility}
                className="w-full rounded-xl bg-zinc-900 text-white py-2.5 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}

          {tab === 'members' && (
            <>
              <form onSubmit={sendInvite} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="rounded-xl border border-zinc-200 px-2 py-2 text-sm outline-none focus:border-zinc-400 bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-sm disabled:opacity-40"
                >
                  Invite
                </button>
              </form>
              {inviteMsg && (
                <p className={`text-xs ${inviteMsg === 'Invite sent!' ? 'text-green-600' : 'text-red-500'}`}>{inviteMsg}</p>
              )}

              {membersLoading ? (
                <p className="text-xs text-zinc-400">Loading…</p>
              ) : (
                <div className="space-y-1">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 py-2 border-b border-zinc-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 truncate">{m.display_name || m.email}</p>
                        {m.display_name && <p className="text-xs text-zinc-400 truncate">{m.email}</p>}
                      </div>
                      {m.role === 'owner' ? (
                        <span className="text-xs text-zinc-400 shrink-0">Owner</span>
                      ) : (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.user_id, e.target.value as ListRole)}
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white outline-none"
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => removeMember(m.user_id)}
                            className="text-zinc-300 hover:text-red-400 transition-colors p-1 shrink-0"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'share' && (
            <>
              <div className="flex gap-2">
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as any)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 bg-white"
                >
                  <option value="editor">Editor link</option>
                  <option value="viewer">Viewer link</option>
                </select>
                <button
                  onClick={createShareLink}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
                >
                  Generate link
                </button>
              </div>

              {shareTokens.length === 0 ? (
                <p className="text-xs text-zinc-400">No share links yet.</p>
              ) : (
                <div className="space-y-2">
                  {shareTokens.map((t) => (
                    <div key={t.token} className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-500 truncate">{appUrl}/lists/join/{t.token}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 capitalize">{t.role} access</p>
                      </div>
                      <button
                        onClick={() => copyLink(t.token)}
                        className="shrink-0 text-xs px-2 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 transition-colors"
                      >
                        {copied === t.token ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => revokeToken(t.token)}
                        className="shrink-0 text-zinc-300 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
