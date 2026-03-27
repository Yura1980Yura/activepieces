/**
 * Feature flag utilities for the graph canvas.
 *
 * Provides a localStorage-based feature flag to toggle between the new
 * GraphCanvas (free canvas editor) and the legacy FlowCanvas (deterministic layout).
 *
 * Usage:
 *   - In the browser console: localStorage.setItem('useGraphCanvas', 'false') to disable
 *   - Default value is true (GraphCanvas enabled) when key is absent
 *   - This is a client-side flag only; it does not affect the server or API
 *
 * Created in P1-G01 as part of the stabilization phase.
 */

/**
 * localStorage key for the graph canvas feature flag.
 *
 * When set to 'false', the builder renders the legacy FlowCanvas.
 * When absent or set to 'true', the builder renders the new GraphCanvas.
 */
export const USE_GRAPH_CANVAS_KEY = 'useGraphCanvas'

/**
 * Storage interface for reading feature flag values.
 *
 * Abstracted from localStorage for testability: tests can pass a plain
 * object implementing getItem() instead of requiring a browser environment.
 */
export type FeatureFlagStorage = {
    getItem(key: string): string | null
}

/**
 * Read the graph canvas feature flag from storage.
 *
 * @param storage - object with getItem() method (localStorage in browser, mock in tests)
 * @returns true if the graph canvas should be used (default), false if legacy FlowCanvas
 */
export function getUseGraphCanvas(storage: FeatureFlagStorage): boolean {
    const value = storage.getItem(USE_GRAPH_CANVAS_KEY)
    if (value === null) {
        return true
    }
    return value !== 'false'
}
