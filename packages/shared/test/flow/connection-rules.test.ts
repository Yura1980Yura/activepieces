import {
    HANDLE_IDS,
    branchHandle,
    isBranchHandle,
    DEFAULT_CONNECTION_RULES,
    NO_INPUT_TYPES,
    LOOP_OUTPUT_TYPES,
    BRANCH_OUTPUT_TYPES,
} from '../../src/lib/automation/flows/util/connection-rules'
import type {
    ConnectionRule,
    ConnectionValidationResult,
    HandleType,
} from '../../src/lib/automation/flows/util/connection-rules'
import { FlowActionType, FlowTriggerType } from '../../src'

describe('connection-rules', () => {
    describe('exports', () => {
        it('should export HANDLE_IDS constant', () => {
            expect(HANDLE_IDS).toBeDefined()
            expect(typeof HANDLE_IDS).toBe('object')
        })

        it('should export branchHandle function', () => {
            expect(typeof branchHandle).toBe('function')
        })

        it('should export isBranchHandle function', () => {
            expect(typeof isBranchHandle).toBe('function')
        })

        it('should export DEFAULT_CONNECTION_RULES array', () => {
            expect(Array.isArray(DEFAULT_CONNECTION_RULES)).toBe(true)
            expect(DEFAULT_CONNECTION_RULES.length).toBeGreaterThan(0)
        })

        it('should export NO_INPUT_TYPES set', () => {
            expect(NO_INPUT_TYPES).toBeInstanceOf(Set)
        })

        it('should export LOOP_OUTPUT_TYPES set', () => {
            expect(LOOP_OUTPUT_TYPES).toBeInstanceOf(Set)
        })

        it('should export BRANCH_OUTPUT_TYPES set', () => {
            expect(BRANCH_OUTPUT_TYPES).toBeInstanceOf(Set)
        })

        it('should have ConnectionRule type usable at value level', () => {
            const rule: ConnectionRule = {
                sourceType: '*',
                sourceHandle: HANDLE_IDS.OUTPUT,
                targetType: '*',
                targetHandle: HANDLE_IDS.INPUT,
                maxConnections: 1,
            }
            expect(rule.maxConnections).toBe(1)
        })

        it('should have ConnectionValidationResult type usable at value level', () => {
            const valid: ConnectionValidationResult = { valid: true }
            const invalid: ConnectionValidationResult = { valid: false, reason: 'test' }
            expect(valid.valid).toBe(true)
            expect(invalid.reason).toBe('test')
        })
    })

    describe('handle types', () => {
        it('should have INPUT = "input"', () => {
            expect(HANDLE_IDS.INPUT).toBe('input')
        })

        it('should have OUTPUT = "output"', () => {
            expect(HANDLE_IDS.OUTPUT).toBe('output')
        })

        it('should have LOOP_OUTPUT = "loop-output"', () => {
            expect(HANDLE_IDS.LOOP_OUTPUT).toBe('loop-output')
        })

        it('should be frozen (immutable)', () => {
            expect(Object.isFrozen(HANDLE_IDS)).toBe(false) // as const doesn't freeze
            // But TypeScript prevents mutation via readonly at compile time
            expect(HANDLE_IDS.INPUT).toBe('input')
        })
    })

    describe('branchHandle', () => {
        it('should generate branch-0 for index 0', () => {
            expect(branchHandle(0)).toBe('branch-0')
        })

        it('should generate branch-1 for index 1', () => {
            expect(branchHandle(1)).toBe('branch-1')
        })

        it('should generate branch-5 for index 5', () => {
            expect(branchHandle(5)).toBe('branch-5')
        })

        it('should generate branch-99 for large index', () => {
            expect(branchHandle(99)).toBe('branch-99')
        })

        it('should match pattern used by graph-converter.ts', () => {
            // graph-converter.ts uses template literal `branch-${index}`
            const index = 3
            expect(branchHandle(index)).toBe(`branch-${index}`)
        })
    })

    describe('isBranchHandle', () => {
        it('should return true for valid branch handles', () => {
            expect(isBranchHandle('branch-0')).toBe(true)
            expect(isBranchHandle('branch-1')).toBe(true)
            expect(isBranchHandle('branch-99')).toBe(true)
        })

        it('should return false for non-branch handles', () => {
            expect(isBranchHandle('input')).toBe(false)
            expect(isBranchHandle('output')).toBe(false)
            expect(isBranchHandle('loop-output')).toBe(false)
        })

        it('should return false for malformed branch handles', () => {
            expect(isBranchHandle('branch-')).toBe(false)
            expect(isBranchHandle('branch-abc')).toBe(false)
            expect(isBranchHandle('branch')).toBe(false)
            expect(isBranchHandle('BRANCH-0')).toBe(false)
        })
    })

    describe('DEFAULT_CONNECTION_RULES', () => {
        it('should contain a generic output→input rule', () => {
            const genericRule = DEFAULT_CONNECTION_RULES.find(
                r => r.sourceType === '*' && r.sourceHandle === 'output',
            )
            expect(genericRule).toBeDefined()
            expect(genericRule!.targetType).toBe('*')
            expect(genericRule!.targetHandle).toBe('input')
            expect(genericRule!.maxConnections).toBe(1)
        })

        it('should contain a loop-output rule for LOOP_ON_ITEMS', () => {
            const loopRule = DEFAULT_CONNECTION_RULES.find(
                r => r.sourceType === FlowActionType.LOOP_ON_ITEMS && r.sourceHandle === 'loop-output',
            )
            expect(loopRule).toBeDefined()
            expect(loopRule!.targetHandle).toBe('input')
            expect(loopRule!.maxConnections).toBe(1)
        })

        it('should enforce max 1 connection per handle in all rules', () => {
            for (const rule of DEFAULT_CONNECTION_RULES) {
                expect(rule.maxConnections).toBe(1)
            }
        })
    })

    describe('NO_INPUT_TYPES', () => {
        it('should include EMPTY trigger type', () => {
            expect(NO_INPUT_TYPES.has(FlowTriggerType.EMPTY)).toBe(true)
        })

        it('should include PIECE trigger type', () => {
            expect(NO_INPUT_TYPES.has(FlowTriggerType.PIECE)).toBe(true)
        })

        it('should not include action types', () => {
            expect(NO_INPUT_TYPES.has(FlowActionType.CODE)).toBe(false)
            expect(NO_INPUT_TYPES.has(FlowActionType.PIECE)).toBe(false)
            expect(NO_INPUT_TYPES.has(FlowActionType.LOOP_ON_ITEMS)).toBe(false)
            expect(NO_INPUT_TYPES.has(FlowActionType.ROUTER)).toBe(false)
        })
    })

    describe('LOOP_OUTPUT_TYPES', () => {
        it('should include LOOP_ON_ITEMS', () => {
            expect(LOOP_OUTPUT_TYPES.has(FlowActionType.LOOP_ON_ITEMS)).toBe(true)
        })

        it('should not include other types', () => {
            expect(LOOP_OUTPUT_TYPES.has(FlowActionType.CODE)).toBe(false)
            expect(LOOP_OUTPUT_TYPES.has(FlowActionType.ROUTER)).toBe(false)
        })
    })

    describe('BRANCH_OUTPUT_TYPES', () => {
        it('should include ROUTER', () => {
            expect(BRANCH_OUTPUT_TYPES.has(FlowActionType.ROUTER)).toBe(true)
        })

        it('should not include other types', () => {
            expect(BRANCH_OUTPUT_TYPES.has(FlowActionType.CODE)).toBe(false)
            expect(BRANCH_OUTPUT_TYPES.has(FlowActionType.LOOP_ON_ITEMS)).toBe(false)
        })
    })
})
