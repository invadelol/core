import { test } from '@japa/runner'
import {
  NewDawnVotes,
  VOTES_PER_ADDRESS,
  newVoterId,
  voterId,
  type Choice,
  type VoteStore,
} from '#services/new_dawn_votes'

/** Redis's few commands the votes use, in memory (expiries are not simulated). */
function memoryStore() {
  const strings = new Map<string, string>()
  const hashes = new Map<string, Record<string, number>>()
  const store: VoteStore = {
    async counts(keys) {
      return keys.map((k) => ({ yes: hashes.get(k)?.yes ?? 0, no: hashes.get(k)?.no ?? 0 }))
    },
    async get(keys) {
      return keys.map((k) => strings.get(k) ?? null)
    },
    async claim(key, value) {
      if (strings.has(key)) return false
      strings.set(key, value)
      return true
    },
    async bump(key) {
      const next = Number(strings.get(key) ?? 0) + 1
      strings.set(key, String(next))
      return next
    },
    async add(key, field: Choice) {
      const h = hashes.get(key) ?? {}
      h[field] = (h[field] ?? 0) + 1
      hashes.set(key, h)
    },
  }
  return { store, strings, hashes }
}

const make = () => {
  const mem = memoryStore()
  return { ...mem, votes: new NewDawnVotes(mem.store, () => 'test-secret', 'nd:', ['a', 'b']) }
}

test.group('New Dawn votes', () => {
  test('counts a vote and remembers whose it is', async ({ assert }) => {
    const { votes } = make()
    const result = await votes.vote('a', 'yes', newVoterId(), '203.0.113.7')
    assert.equal(result.outcome, 'counted')
    assert.deepEqual(result.tally, { yes: 1, no: 0, mine: 'yes' })
  })

  test('a visitor votes once: the first vote stands', async ({ assert }) => {
    const { votes } = make()
    const me = newVoterId()
    await votes.vote('a', 'yes', me, '203.0.113.7')
    const again = await votes.vote('a', 'no', me, '203.0.113.8')
    assert.equal(again.outcome, 'already')
    assert.deepEqual(again.tally, { yes: 1, no: 0, mine: 'yes' })
  })

  test('each rumour has its own vote', async ({ assert }) => {
    const { votes } = make()
    const me = newVoterId()
    await votes.vote('a', 'yes', me, '203.0.113.7')
    const other = await votes.vote('b', 'no', me, '203.0.113.7')
    assert.equal(other.outcome, 'counted')
    assert.deepEqual(other.tally, { yes: 0, no: 1, mine: 'no' })
  })

  test('an address adds only a few votes a day, whatever its cookies', async ({ assert }) => {
    const { votes } = make()
    for (let i = 0; i < VOTES_PER_ADDRESS; i++) {
      const r = await votes.vote('a', 'yes', newVoterId(), '198.51.100.4')
      assert.equal(r.outcome, 'counted')
    }
    const extra = await votes.vote('a', 'yes', newVoterId(), '198.51.100.4')
    assert.equal(extra.outcome, 'address')
    // The counts are shown, without a vote for this visitor.
    assert.deepEqual(extra.tally, { yes: VOTES_PER_ADDRESS, no: 0, mine: null })
    // Another address still counts.
    const elsewhere = await votes.vote('a', 'no', newVoterId(), '198.51.100.5')
    assert.equal(elsewhere.outcome, 'counted')
  })

  test('the address is kept as a keyed hash, never as itself', async ({ assert }) => {
    const { votes, strings } = make()
    await votes.vote('a', 'yes', newVoterId(), '198.51.100.4')
    const keys = [...strings.keys()].join(' ')
    assert.notInclude(keys, '198.51.100.4')
    assert.match(keys, /nd:addr:a:[0-9a-f]{32}/)
  })

  test('reads every open rumour with the visitor own votes', async ({ assert }) => {
    const { votes } = make()
    const me = newVoterId()
    await votes.vote('b', 'no', me, '203.0.113.7')
    await votes.vote('b', 'yes', newVoterId(), '203.0.113.9')
    assert.deepEqual(await votes.tallies(me), {
      a: { yes: 0, no: 0, mine: null },
      b: { yes: 1, no: 1, mine: 'no' },
    })
    const anyone = await votes.tallies(null)
    assert.deepEqual(anyone?.b, { yes: 1, no: 1, mine: null })
  })

  test('the page still renders when the store does not answer', async ({ assert }) => {
    const broken = new NewDawnVotes(
      {
        ...memoryStore().store,
        counts: async () => {
          throw new Error('connection refused')
        },
      },
      () => 'test-secret',
      'nd:',
      ['a']
    )
    assert.isNull(await broken.tallies(null))
  })

  test('only takes the open rumours, and only ids it handed out', async ({ assert }) => {
    const { votes } = make()
    assert.isTrue(votes.takes('a'))
    assert.isFalse(votes.takes('league-next'))
    const id = newVoterId()
    assert.equal(voterId(id), id)
    assert.isNull(voterId('nd:votes:a'))
    assert.isNull(voterId(undefined))
  })
})
