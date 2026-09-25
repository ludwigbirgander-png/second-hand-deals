'use client'

import { useEffect, useState } from 'react'
import type { Category, ItemList, ListMember, ListRole } from '@/lib/types'
import { COLORS, THEME, type Color } from '@/lib/colors'
import { Sheet } from './ui/Sheet'
import { Button, IconButton } from './ui/Button'
import { FieldLabel, Input, Segmented } from './ui/Form'
import { Pill } from './ui/Pill'

// ─── Shared building blocks ───────────────────────────────────────────────────

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: Color) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          title={c}
          onClick={() => onChange(c)}
          className={`w-11 h-11 rounded-full cursor-pointer transition-shadow duration-[var(--dur-fast)] ${value === c ? 'shadow-[inset_0_0_0_2px_var(--ink)]' : 'shadow-[inset_0_0_0_1px_var(--border-hair)]'}`}
          style={{ background: THEME[c][0] }}
        />
      ))}
    </div>
  )
}

/** Name + color editor with a two-step delete. */
function DetailsForm({ name, color, kind, onSave, onDelete }: {
  name: string
  color: string
  kind: 'list' | 'category'
  onSave: (name: string, color: string) => Promise<string | null>
  onDelete: () => Promise<void>
}) {
  const [draftName, setDraftName] = useState(name)
  const [draftColor, setDraftColor] = useState(color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = draftName.trim() !== name || draftColor !== color

  async function save() {
    setSaving(true)
    setError(null)
    const err = await onSave(draftName.trim(), draftColor)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="flex flex-col gap-5">
      <Input label="Name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
      <div>
        <FieldLabel>Color</FieldLabel>
        <ColorSwatches value={draftColor} onChange={setDraftColor} />
      </div>
      {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
      <div className="flex items-center gap-2">
        {confirmDelete ? (
          <>
            <Button variant="danger" onClick={onDelete}>Confirm delete</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>Delete {kind}</Button>
        )}
        <div className="flex-1" />
        <Button disabled={!dirty || !draftName.trim() || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      {confirmDelete && (
        <p className="m-0 -mt-2 text-[13px] text-muted">Items stay in your watchlist; they are only removed from this {kind}.</p>
      )}
    </div>
  )
}

async function getArray<T>(url: string): Promise<T[]> {
  const data = await fetch(url).then((r) => r.json()).catch(() => [])
  return Array.isArray(data) ? data : []
}

async function patchJson(url: string, body: object) {
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return res.ok ? { data, error: null } : { data: null, error: (data.error as string) ?? 'Could not save' }
}

// ─── Category sheet ───────────────────────────────────────────────────────────

export function CategorySheet({ category, onClose, onUpdated, onDeleted }: {
  category: Category | null
  onClose: () => void
  onUpdated: (c: Category) => void
  onDeleted: (id: string) => void
}) {
  return (
    <Sheet open={!!category} onClose={onClose} title={category?.name ?? 'Category'}>
      {category && (
        <DetailsForm
          key={category.id}
          kind="category"
          name={category.name}
          color={category.color}
          onSave={async (name, color) => {
            const { data, error } = await patchJson(`/api/categories/${category.id}`, { name, color })
            if (data) { onUpdated(data); onClose() }
            return error
          }}
          onDelete={async () => {
            await fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
            onDeleted(category.id)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

// ─── List sheet ───────────────────────────────────────────────────────────────

type Tab = 'details' | 'visibility' | 'members' | 'share'

const VISIBILITY = [
  { value: 'private', label: 'Private', desc: 'Only you can see this list' },
  { value: 'public', label: 'Public', desc: 'Anyone can view and follow this list' },
  { value: 'collaborative', label: 'Collaborative', desc: 'Invited members can add and edit items' },
] as const

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

export type ListSheetRole = ListRole | 'follower'

export function ListSheet({ list, role, onClose, onUpdated, onDeleted, onUnfollow }: {
  list: ItemList | null
  role: ListSheetRole
  onClose: () => void
  onUpdated: (l: ItemList) => void
  onDeleted: (id: string) => void
  onUnfollow: (id: string) => void
}) {
  return (
    <Sheet open={!!list} onClose={onClose} title={list?.name ?? 'List'}>
      {list && role === 'follower' && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[15px] text-muted">You follow this public list.</p>
          <Button variant="secondary" className="self-start" onClick={() => { onUnfollow(list.id); onClose() }}>Unfollow</Button>
        </div>
      )}
      {list && (role === 'owner' || role === 'admin') && (
        <ListSettings key={list.id} list={list} isOwner={role === 'owner'} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      )}
    </Sheet>
  )
}

function ListSettings({ list, isOwner, onClose, onUpdated, onDeleted }: {
  list: ItemList
  isOwner: boolean
  onClose: () => void
  onUpdated: (l: ItemList) => void
  onDeleted: (id: string) => void
}) {
  const tabs: { value: Tab; label: string }[] = [
    ...(isOwner ? [{ value: 'details' as Tab, label: 'Details' }] : []),
    { value: 'visibility', label: 'Visibility' },
    { value: 'members', label: 'Members' },
    { value: 'share', label: 'Share' },
  ]
  const [tab, setTab] = useState<Tab>(tabs[0].value)

  return (
    <>
      <Segmented options={tabs} value={tab} onChange={setTab} size="sm" className="mb-6 max-w-full overflow-x-auto k-noscroll" label="List settings" />
      {tab === 'details' && isOwner && (
        <DetailsForm
          kind="list"
          name={list.name}
          color={list.color}
          onSave={async (name, color) => {
            const { data, error } = await patchJson(`/api/lists/${list.id}`, { name, color })
            if (data) { onUpdated(data); onClose() }
            return error
          }}
          onDelete={async () => {
            await fetch(`/api/lists/${list.id}`, { method: 'DELETE' })
            onDeleted(list.id)
            onClose()
          }}
        />
      )}
      {tab === 'visibility' && <VisibilityTab list={list} onUpdated={onUpdated} />}
      {tab === 'members' && <MembersTab listId={list.id} />}
      {tab === 'share' && <ShareTab listId={list.id} />}
    </>
  )
}

function VisibilityTab({ list, onUpdated }: { list: ItemList; onUpdated: (l: ItemList) => void }) {
  const [visibility, setVisibility] = useState(list.visibility)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const { data, error } = await patchJson(`/api/lists/${list.id}/visibility`, { visibility })
    setSaving(false)
    if (data && !data.error) onUpdated(data)
    else setError(error ?? 'Could not save')
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Visibility" className="flex flex-col gap-2">
        {VISIBILITY.map((opt) => {
          const on = visibility === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setVisibility(opt.value)}
              className={`text-left rounded-sm px-4 py-3 cursor-pointer transition-shadow duration-[var(--dur-fast)] ${on ? 'shadow-[inset_0_0_0_1.5px_var(--ink)]' : 'shadow-[inset_0_0_0_1px_var(--border-soft)]'}`}
            >
              <span className="block text-[15px] text-ink">{opt.label}</span>
              <span className="block text-[13px] text-muted mt-0.5">{opt.desc}</span>
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
      <Button className="mt-3 self-end" disabled={saving || visibility === list.visibility} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}

function MembersTab({ listId }: { listId: string }) {
  const [members, setMembers] = useState<ListMember[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => getArray<ListMember>(`/api/lists/${listId}/members`).then(setMembers)
  useEffect(() => { getArray<ListMember>(`/api/lists/${listId}/members`).then(setMembers) }, [listId])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    setMsg(null)
    const res = await fetch(`/api/lists/${listId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role }),
    })
    const data = await res.json().catch(() => ({}))
    setInviting(false)
    if (data.error) setMsg({ ok: false, text: data.error })
    else { setEmail(''); setMsg({ ok: true, text: 'Invite sent' }); load() }
  }

  async function changeRole(userId: string, r: ListRole) {
    await patchJson(`/api/lists/${listId}/members/${userId}`, { role: r })
    load()
  }

  async function remove(userId: string) {
    await fetch(`/api/lists/${listId}/members/${userId}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={invite} className="flex flex-col gap-3">
        <Input label="Invite by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        <Segmented
          options={[{ value: 'admin', label: 'Admin' }, { value: 'editor', label: 'Editor' }, { value: 'viewer', label: 'Viewer' }]}
          value={role}
          onChange={setRole}
          size="sm"
          label="Role for the invite"
        />
        <Button type="submit" className="self-start" disabled={inviting || !email.trim()}>{inviting ? 'Sending…' : 'Send invite'}</Button>
        {msg && <p role="status" className={`m-0 text-[13px] ${msg.ok ? 'text-mint-deep' : 'text-signal-deep'}`}>{msg.text}</p>}
      </form>

      <div>
        <FieldLabel>Members</FieldLabel>
        {members === null ? (
          <p className="m-0 text-[14px] text-muted">Loading…</p>
        ) : members.length === 0 ? (
          <p className="m-0 text-[14px] text-muted">No members yet.</p>
        ) : (
          members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 min-h-[52px] border-b border-line-hair">
              <span className="flex-1 min-w-0 text-[15px] truncate">{m.display_name || m.email}</span>
              {m.role === 'owner' ? (
                <Pill variant="dashed" size="sm">Owner</Pill>
              ) : (
                <>
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as ListRole)}
                    className="h-9 px-3 rounded-pill bg-shade text-[13px] text-ink outline-none cursor-pointer"
                  >
                    {['admin', 'editor', 'viewer'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <IconButton icon="x" size="sm" variant="plain" label={`Remove ${m.email}`} onClick={() => remove(m.user_id)} />
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ShareTab({ listId }: { listId: string }) {
  const [tokens, setTokens] = useState<{ token: string; role: string }[]>([])
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [copied, setCopied] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const load = () => getArray<{ token: string; role: string }>(`/api/lists/${listId}/invite`).then(setTokens)
  useEffect(() => { getArray<{ token: string; role: string }>(`/api/lists/${listId}/invite`).then(setTokens) }, [listId])

  async function create() {
    await fetch(`/api/lists/${listId}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    load()
  }

  async function revoke(token: string) {
    await fetch(`/api/lists/${listId}/invite`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    load()
  }

  function copy(token: string) {
    navigator.clipboard.writeText(`${origin}/lists/join/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <FieldLabel>New invite link</FieldLabel>
        <div className="flex flex-wrap items-center gap-3 -mt-2">
          <Segmented options={[{ value: 'editor', label: 'Can edit' }, { value: 'viewer', label: 'Can view' }]} value={role} onChange={setRole} size="sm" label="Access for the link" />
          <Button size="sm" onClick={create}>Create link</Button>
        </div>
      </div>
      {tokens.length > 0 && (
        <div>
          <FieldLabel>Active links</FieldLabel>
          {tokens.map((t) => (
            <div key={t.token} className="flex items-center gap-2 min-h-[60px] border-b border-line-hair">
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-muted truncate">{origin}/lists/join/{t.token}</span>
                <span className="block text-[13px] text-ink">{t.role === 'viewer' ? 'Can view' : 'Can edit'}</span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => copy(t.token)}>{copied === t.token ? 'Copied' : 'Copy'}</Button>
              <IconButton icon="x" size="sm" variant="plain" label="Revoke link" onClick={() => revoke(t.token)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
