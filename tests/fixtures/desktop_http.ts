import type { ApiClient } from '@japa/api-client'
import { sha256Hex, signRequest } from '#services/desktop/signing'

/** What a registered device holds: its bearer token and its signing secret. */
export interface DeviceCredentials {
  token: string
  secret: string
}

/**
 * The headers the desktop app sends on an authenticated request
 * (docs/desktop-sync.md §1.1), signing `body` exactly as it will be sent.
 */
export function signedHeaders(
  credentials: DeviceCredentials,
  method: string,
  path: string,
  body = '',
  timestamp = Date.now()
) {
  const signature = signRequest(credentials.secret, {
    timestamp: String(timestamp),
    method,
    path,
    bodyHash: sha256Hex(body),
  })
  return {
    'Authorization': `Bearer ${credentials.token}`,
    'X-Invade-Timestamp': String(timestamp),
    'X-Invade-Signature': signature,
  }
}

/**
 * A signed client for the desktop routes. JSON bodies are serialised once
 * here, and those exact bytes are both signed and sent.
 */
export function desktopClient(http: ApiClient, credentials: DeviceCredentials) {
  return {
    get(path: string) {
      return http.get(path).headers(signedHeaders(credentials, 'GET', path))
    },
    delete(path: string) {
      return http.delete(path).headers(signedHeaders(credentials, 'DELETE', path))
    },
    post(path: string, payload: unknown) {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
      return http
        .post(path)
        .headers(signedHeaders(credentials, 'POST', path, body))
        .json(body)
    },
  }
}
