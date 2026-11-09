import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inviteUsable, describeInvite, validInviteEmail } from './invites'

test('validInviteEmail accepts ordinary addresses', () => {
  assert.equal(validInviteEmail('frida@example.com'), 'frida@example.com')
  assert.equal(validInviteEmail('  anna.svensson+kompi@mail.example.se '), 'anna.svensson+kompi@mail.example.se')
})

test('validInviteEmail refuses anything else', () => {
  for (const bad of ['', 'frida', 'frida@', '@example.com', 'frida@example', 'a b@example.com', 'a@b@example.com',
    'Frida <frida@example.com>', 'a@example.com, b@example.com', 42, null, `${'a'.repeat(250)}@example.com`]) {
    assert.equal(validInviteEmail(bad), null, String(bad))
  }
})

const now = Date.parse('2026-11-09T12:00:00Z')
const DAY = 86_400_000
const at = (ms: number) => new Date(now + ms).toISOString()

test('a fresh invite is usable', () => {
  assert.equal(inviteUsable({ expires_at: at(14 * DAY), max_uses: 25, use_count: 0 }, now), true)
  assert.equal(inviteUsable({ expires_at: at(DAY), max_uses: 1, use_count: 0 }, now), true)
})

test('an expired invite is not usable', () => {
  assert.equal(inviteUsable({ expires_at: at(-1), max_uses: 25, use_count: 0 }, now), false)
  assert.equal(inviteUsable({ expires_at: at(0), max_uses: 25, use_count: 0 }, now), false)
})

test('a used-up invite is not usable', () => {
  assert.equal(inviteUsable({ expires_at: at(DAY), max_uses: 1, use_count: 1 }, now), false)
  assert.equal(inviteUsable({ expires_at: at(DAY), max_uses: 25, use_count: 25 }, now), false)
  assert.equal(inviteUsable({ expires_at: at(DAY), max_uses: 25, use_count: 24 }, now), true)
})

test('an invite without limits (before the migration) is usable', () => {
  assert.equal(inviteUsable({}, now), true)
})

test('describeInvite says when it expires and how much it has been used', () => {
  assert.equal(describeInvite({ expires_at: at(5 * DAY), max_uses: 25, use_count: 3 }, now), 'Expires in 5 days · 3 of 25 used')
  assert.equal(describeInvite({ expires_at: at(DAY - 1000), max_uses: 1, use_count: 0 }, now), 'Expires tomorrow · single use')
  assert.equal(describeInvite({ expires_at: at(-DAY), max_uses: 25, use_count: 0 }, now), 'Expired · 0 of 25 used')
  assert.equal(describeInvite({}, now), '')
})
