/**
 * The blocks of a page that may arrive on their own (the champion build tab): what is ready
 * within a short wait is sent with the page, the rest follows as Inertia deferred props.
 */

export type Blocks = Record<string, () => Promise<unknown>>

/**
 * Each loader run once, whoever calls it first; a failed or empty one gives `null` (its panel is
 * left out and the rest of the page still shows).
 */
export function onceEach(loads: Blocks): Blocks {
  return Object.fromEntries(
    Object.entries(loads).map(([key, load]) => {
      let started: Promise<unknown> | undefined
      return [
        key,
        () =>
          (started ??= load().then(
            (v) => v ?? null,
            () => null
          )),
      ]
    })
  )
}

/**
 * Starts every block and waits at most `ms` for them: the values of the blocks done by then
 * (`ready`) and the keys of those still loading (`waiting`).
 */
export async function settle(blocks: Blocks, ms: number) {
  const ready: Record<string, unknown> = {}
  const all = Object.entries(blocks).map(([key, load]) =>
    load().then((value) => {
      ready[key] = value ?? null
    })
  )
  let timer: NodeJS.Timeout | undefined
  await Promise.race([
    Promise.all(all),
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms)
    }),
  ])
  clearTimeout(timer)
  // A copy: what lands from now on belongs to the deferred props, not to this page.
  return { ready: { ...ready }, waiting: Object.keys(blocks).filter((key) => !(key in ready)) }
}
