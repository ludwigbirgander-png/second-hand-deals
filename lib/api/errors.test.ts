import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { serverError, SERVER_ERROR_MESSAGE } from './errors'

test('serverError answers with a plain 500 and logs the details', async () => {
  const logged = mock.method(console, 'error', () => {})
  try {
    const res = serverError('items: list', { message: 'relation "public.items" does not exist', code: '42P01' })
    assert.equal(res.status, 500)
    const body = await res.json()
    assert.deepEqual(body, { error: SERVER_ERROR_MESSAGE })
    assert.doesNotMatch(JSON.stringify(body), /relation|items|42P01/)
    assert.equal(logged.mock.callCount(), 1)
    assert.deepEqual(logged.mock.calls[0].arguments, ['items: list failed:', 'relation "public.items" does not exist'])
  } finally {
    logged.mock.restore()
  }
})

test('serverError handles errors without a message', async () => {
  const logged = mock.method(console, 'error', () => {})
  try {
    const res = serverError('lists: follow', 'timeout')
    assert.equal(res.status, 500)
    assert.deepEqual(logged.mock.calls[0].arguments, ['lists: follow failed:', 'timeout'])
  } finally {
    logged.mock.restore()
  }
})
