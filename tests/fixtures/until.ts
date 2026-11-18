/**
 * Waits for background work (a retry, an audit) to finish instead of
 * sleeping a fixed time: polls `done` until it holds, and fails the test
 * past `timeoutMs`.
 */
export async function until(
  done: () => boolean | Promise<boolean>,
  { timeoutMs = 3000, everyMs = 5, what = 'the background work' } = {}
) {
  const deadline = Date.now() + timeoutMs
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((resolve) => setTimeout(resolve, everyMs))
  }
}
