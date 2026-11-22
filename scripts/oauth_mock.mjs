#!/usr/bin/env node
/**
 * A local stand-in for Discord's and Google's OAuth endpoints, to sign in on a development server
 * without either of them: set `OAUTH_MOCK_ORIGIN=http://127.0.0.1:3364` in `.env` (ignored in
 * production) and run
 *
 *   node scripts/oauth_mock.mjs [port]
 *
 * The authorize page lists a few fictional people (or takes any name); the token and identity
 * endpoints answer like the real ones, PKCE included, so the site's whole flow runs: state cookie,
 * code exchange, identity, session.
 */
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 3364)
const PEOPLE = [
  { id: '100000000000000001', name: 'Ember' },
  { id: '100000000000000002', name: 'Copper Lane' },
  { id: '100000000000000003', name: 'Briar' },
]

const pack = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const unpack = (value) => {
  try {
    return JSON.parse(Buffer.from(String(value), 'base64url').toString())
  } catch {
    return null
  }
}
const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function form(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return new URLSearchParams(raw)
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
  const [, provider, step] = url.pathname.split('/')
  if (!['discord', 'google'].includes(provider)) return json(res, 404, { error: 'not_found' })

  if (step === 'authorize') {
    const q = url.searchParams
    const redirect = q.get('redirect_uri')
    if (!redirect || !q.get('state') || !q.get('client_id')) {
      return json(res, 400, { error: 'invalid_request' })
    }
    const back = (person) => {
      const target = new URL(redirect)
      const code = pack({ provider, ...person, challenge: q.get('code_challenge') ?? null })
      target.searchParams.set('code', code)
      target.searchParams.set('state', q.get('state'))
      return target.href
    }
    // `?as=<name>` signs straight in, for scripts.
    if (q.get('as')) {
      res.writeHead(302, { Location: back({ id: `9${q.get('as').length}0000`, name: q.get('as') }) })
      return res.end()
    }
    const denied = new URL(redirect)
    denied.searchParams.set('error', 'access_denied')
    denied.searchParams.set('state', q.get('state'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(`<!doctype html><meta charset="utf-8"><title>Mock ${provider}</title>
<body style="font:15px system-ui;margin:48px auto;max-width:420px;color:#222">
<h1 style="font-size:20px">Mock ${escape(provider)} sign-in</h1>
<p>Local development only. Continue as:</p>
<ul>${PEOPLE.map((p) => `<li><a href="${escape(back(p))}">${escape(p.name)}</a></li>`).join('')}</ul>
<p><a href="${escape(denied.href)}">Cancel</a></p></body>`)
  }

  if (step === 'token' && req.method === 'POST') {
    const body = await form(req)
    const code = unpack(body.get('code'))
    if (!code || code.provider !== provider || !body.get('client_secret')) {
      return json(res, 400, { error: 'invalid_grant' })
    }
    if (code.challenge) {
      const verifier = body.get('code_verifier') ?? ''
      const hash = createHash('sha256').update(verifier).digest('base64url')
      if (hash !== code.challenge) return json(res, 400, { error: 'invalid_grant' })
    }
    return json(res, 200, {
      access_token: pack({ provider, id: code.id, name: code.name }),
      token_type: 'Bearer',
      expires_in: 3600,
    })
  }

  if (step === 'identity') {
    const token = unpack((req.headers.authorization ?? '').replace(/^Bearer /, ''))
    if (!token || token.provider !== provider) return json(res, 401, { error: 'invalid_token' })
    return json(
      res,
      200,
      provider === 'discord'
        ? { id: token.id, username: token.name.toLowerCase(), global_name: token.name }
        : { sub: token.id, name: `${token.name} Example`, given_name: token.name }
    )
  }

  json(res, 404, { error: 'not_found' })
}).listen(port, '127.0.0.1', () => {
  console.log(`OAuth mock for Discord and Google on http://127.0.0.1:${port}`)
})
