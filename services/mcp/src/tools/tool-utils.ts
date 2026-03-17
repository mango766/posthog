/** Adds a _posthogUrl field to any type. Use instead of `T & { _posthogUrl: string }`. */
export type WithPostHogUrl<T = unknown> = T & { _posthogUrl: string }

/** Adds _posthogUrl to a result object. */
export function withPostHogUrl<T>(result: T, url: string): WithPostHogUrl<T> {
    return { ...result, _posthogUrl: url } as WithPostHogUrl<T>
}
