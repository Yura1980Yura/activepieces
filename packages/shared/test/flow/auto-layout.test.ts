import { computeAutoLayout } from '../../src/lib/automation/flows/util/auto-layout'

describe('computeAutoLayout', () => {
    it('should return positions for a single node', () => {
        const nodes = [{ id: 'trigger' }]
        const edges: { source: string; target: string }[] = []

        const result = computeAutoLayout(nodes, edges)

        expect(result.positions).toBeDefined()
        expect(result.positions['trigger']).toBeDefined()
        expect(typeof result.positions['trigger'].x).toBe('number')
        expect(typeof result.positions['trigger'].y).toBe('number')
    })

    it('should return ascending Y positions for a linear chain (TB direction)', () => {
        const nodes = [
            { id: 'trigger' },
            { id: 'step_1' },
            { id: 'step_2' },
        ]
        const edges = [
            { source: 'trigger', target: 'step_1' },
            { source: 'step_1', target: 'step_2' },
        ]

        const result = computeAutoLayout(nodes, edges)

        const yTrigger = result.positions['trigger'].y
        const yStep1 = result.positions['step_1'].y
        const yStep2 = result.positions['step_2'].y

        // Verify Y positions are in ascending order (top-to-bottom)
        expect(yTrigger).toBeLessThan(yStep1)
        expect(yStep1).toBeLessThan(yStep2)

        // Verify spacing is >= 80px (rankSep default)
        // The spacing is between node bottom and next node top: (yStep1 - yTrigger) >= nodeHeight + rankSep
        // Since we convert from center to top-left, spacing between top-left positions should be >= nodeHeight(60) + rankSep(80) = 140
        expect(yStep1 - yTrigger).toBeGreaterThanOrEqual(60 + 80)
        expect(yStep2 - yStep1).toBeGreaterThanOrEqual(60 + 80)
    })

    it('should return positions for all nodes including branches', () => {
        const nodes = [
            { id: 'trigger' },
            { id: 'router' },
            { id: 'branch_0' },
            { id: 'branch_1' },
        ]
        const edges = [
            { source: 'trigger', target: 'router' },
            { source: 'router', target: 'branch_0' },
            { source: 'router', target: 'branch_1' },
        ]

        const result = computeAutoLayout(nodes, edges)

        expect(Object.keys(result.positions)).toHaveLength(4)
        expect(result.positions['trigger']).toBeDefined()
        expect(result.positions['router']).toBeDefined()
        expect(result.positions['branch_0']).toBeDefined()
        expect(result.positions['branch_1']).toBeDefined()

        // Router should be below trigger
        expect(result.positions['router'].y).toBeGreaterThan(result.positions['trigger'].y)

        // Branch children should be below router
        expect(result.positions['branch_0'].y).toBeGreaterThan(result.positions['router'].y)
        expect(result.positions['branch_1'].y).toBeGreaterThan(result.positions['router'].y)
    })

    it('should return valid CanvasLayout structure', () => {
        const nodes = [{ id: 'n1' }, { id: 'n2' }]
        const edges = [{ source: 'n1', target: 'n2' }]

        const result = computeAutoLayout(nodes, edges)

        expect(result).toHaveProperty('positions')
        expect(typeof result.positions).toBe('object')

        for (const [key, pos] of Object.entries(result.positions)) {
            expect(typeof key).toBe('string')
            expect(pos).toHaveProperty('x')
            expect(pos).toHaveProperty('y')
            expect(typeof pos.x).toBe('number')
            expect(typeof pos.y).toBe('number')
        }
    })

    it('should accept custom spacing options', () => {
        const nodes = [
            { id: 'a' },
            { id: 'b' },
        ]
        const edges = [{ source: 'a', target: 'b' }]

        const result = computeAutoLayout(nodes, edges, {
            rankSep: 200,
            nodeHeight: 100,
        })

        const yA = result.positions['a'].y
        const yB = result.positions['b'].y

        // With rankSep=200 and nodeHeight=100, gap should be >= 300
        expect(yB - yA).toBeGreaterThanOrEqual(100 + 200)
    })

    it('should handle flow with loop structure', () => {
        const nodes = [
            { id: 'trigger' },
            { id: 'loop' },
            { id: 'loop_child' },
            { id: 'after_loop' },
        ]
        const edges = [
            { source: 'trigger', target: 'loop' },
            { source: 'loop', target: 'loop_child' },
            { source: 'loop', target: 'after_loop' },
        ]

        const result = computeAutoLayout(nodes, edges)

        expect(Object.keys(result.positions)).toHaveLength(4)
        // All positions should be valid numbers
        for (const pos of Object.values(result.positions)) {
            expect(isFinite(pos.x)).toBe(true)
            expect(isFinite(pos.y)).toBe(true)
        }
    })
})
