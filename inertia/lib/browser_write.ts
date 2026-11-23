/**
 * A write from a page to the site's own JSON routes (the signed-in person's profile, skins,
 * lists): same origin, the session cookie, and the house error shape read back as one message.
 */

/** A write the server refused or that did not arrive, in words for the page. */
export class WriteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function browserWrite<T = void>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new WriteError('No connection. Try again in a moment.', 0)
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new WriteError(
      data?.errors?.[0]?.message ?? 'That did not go through. Try again in a moment.',
      response.status
    )
  }
  return data as T
}
