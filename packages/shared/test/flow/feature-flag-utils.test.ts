import { describe, it, expect } from 'vitest'
import {
    USE_GRAPH_CANVAS_KEY,
    getUseGraphCanvas,
    FeatureFlagStorage,
} from '../../src/lib/automation/flows/util/feature-flag-utils'

/**
 * Create a mock storage object for testing.
 * Simulates localStorage.getItem() behavior.
 */
function createMockStorage(data: Record<string, string> = {}): FeatureFlagStorage {
    return {
        getItem(key: string): string | null {
            return key in data ? data[key] : null
        },
    }
}

describe('feature-flag-utils', () => {
    describe('USE_GRAPH_CANVAS_KEY', () => {
        it('should be the string "useGraphCanvas"', () => {
            expect(USE_GRAPH_CANVAS_KEY).toBe('useGraphCanvas')
        })

        it('should be a non-empty string', () => {
            expect(typeof USE_GRAPH_CANVAS_KEY).toBe('string')
            expect(USE_GRAPH_CANVAS_KEY.length).toBeGreaterThan(0)
        })
    })

    describe('getUseGraphCanvas', () => {
        it('should return true when key is absent from storage (default)', () => {
            const storage = createMockStorage({})
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should return true when key is set to "true"', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: 'true' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should return false when key is set to "false"', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: 'false' })
            expect(getUseGraphCanvas(storage)).toBe(false)
        })

        it('should return true when key is set to an arbitrary non-"false" string', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: 'yes' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should return true when key is set to empty string', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: '' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should return true when key is set to "TRUE" (case sensitive, only "false" disables)', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: 'TRUE' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should return true when key is set to "False" (case sensitive check)', () => {
            const storage = createMockStorage({ [USE_GRAPH_CANVAS_KEY]: 'False' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should use the correct key from USE_GRAPH_CANVAS_KEY constant', () => {
            // Verify that getUseGraphCanvas reads from the exact key defined by the constant
            const storage = createMockStorage({ useGraphCanvas: 'false' })
            expect(getUseGraphCanvas(storage)).toBe(false)
        })

        it('should not be affected by other keys in storage', () => {
            const storage = createMockStorage({ otherKey: 'false', anotherKey: 'true' })
            expect(getUseGraphCanvas(storage)).toBe(true)
        })

        it('should work with the FeatureFlagStorage interface', () => {
            // Ensure any object implementing getItem() works
            const customStorage: FeatureFlagStorage = {
                getItem: (_key: string) => 'false',
            }
            expect(getUseGraphCanvas(customStorage)).toBe(false)
        })
    })
})
