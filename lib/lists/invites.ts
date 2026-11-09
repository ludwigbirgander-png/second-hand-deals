// Invite rules: every invite expires, and each can be used a limited number of times.
// The database enforces the same limits (20261109_invite_expiry.sql).

export const INVITE_DAYS = 14
/** Copyable links can be shared with a group */
export const LINK_MAX_USES = 25
/** An email invite is for the one person it was sent to */
export const EMAIL_MAX_USES = 1

/** Shown for unknown, expired and used-up invites alike, so a guessed token reveals nothing */
export const INVITE_GONE = 'This invite has expired or is no longer valid. Ask for a new link.'

export interface InviteLimits {
  expires_at: string
  max_uses: number
  use_count: number
}

/** Whether an invite can still be used. Invites without limits (before the migration) count as usable. */
export function inviteUsable(invite: Partial<InviteLimits>, now = Date.now()): boolean {
  if (invite.expires_at && Date.parse(invite.expires_at) <= now) return false
  if (invite.max_uses != null && (invite.use_count ?? 0) >= invite.max_uses) return false
  return true
}

/** "Expires in 5 days · 3 of 25 used" for the sharing settings. */
export function describeInvite(invite: Partial<InviteLimits>, now = Date.now()): string {
  const parts: string[] = []
  if (invite.expires_at) {
    const days = Math.ceil((Date.parse(invite.expires_at) - now) / 86_400_000)
    parts.push(days <= 0 ? 'Expired' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`)
  }
  if (invite.max_uses != null) {
    parts.push(invite.max_uses === 1 ? 'single use' : `${invite.use_count ?? 0} of ${invite.max_uses} used`)
  }
  return parts.join(' · ')
}
