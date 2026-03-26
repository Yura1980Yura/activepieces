import { FlowActionType, FlowTriggerType } from '../../src'
import {
    getHandlesForNodeType,
} from '../../src/lib/automation/flows/util/graph-node-handles'
import type { HandleConfig } from '../../src/lib/automation/flows/util/graph-node-handles'
import {
    HANDLE_IDS,
    branchHandle,
} from '../../src/lib/automation/flows/util/connection-rules'

describe('graph-node-handles', () => {
    describe('getHandlesForNodeType', () => {
        describe('CODE action type', () => {
            it('should return 2 handles: input and output', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                expect(handles).toHaveLength(2)
            })

            it('should have input handle with correct config', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                expect(inputHandle).toBeDefined()
                expect(inputHandle!.type).toBe('target')
                expect(inputHandle!.position).toBe('top')
            })

            it('should have output handle with correct config', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const outputHandle = handles.find(h => h.id === HANDLE_IDS.OUTPUT)
                expect(outputHandle).toBeDefined()
                expect(outputHandle!.type).toBe('source')
                expect(outputHandle!.position).toBe('bottom')
            })
        })

        describe('PIECE action type', () => {
            it('should return 2 handles: input and output', () => {
                const handles = getHandlesForNodeType(FlowActionType.PIECE)
                expect(handles).toHaveLength(2)
            })

            it('should have input handle at top and output handle at bottom', () => {
                const handles = getHandlesForNodeType(FlowActionType.PIECE)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                const outputHandle = handles.find(h => h.id === HANDLE_IDS.OUTPUT)
                expect(inputHandle).toBeDefined()
                expect(outputHandle).toBeDefined()
                expect(inputHandle!.position).toBe('top')
                expect(outputHandle!.position).toBe('bottom')
            })
        })

        describe('LOOP_ON_ITEMS action type', () => {
            it('should return 3 handles: input, output, and loop-output', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                expect(handles).toHaveLength(3)
            })

            it('should have loop-output handle with correct config', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                const loopHandle = handles.find(h => h.id === HANDLE_IDS.LOOP_OUTPUT)
                expect(loopHandle).toBeDefined()
                expect(loopHandle!.type).toBe('source')
                expect(loopHandle!.position).toBe('right')
            })

            it('should also have input and output handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                expect(handles.find(h => h.id === HANDLE_IDS.INPUT)).toBeDefined()
                expect(handles.find(h => h.id === HANDLE_IDS.OUTPUT)).toBeDefined()
            })
        })

        describe('ROUTER action type', () => {
            it('should return 4 handles for 2 branches: input, output, branch-0, branch-1', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 2)
                expect(handles).toHaveLength(4)
            })

            it('should return 5 handles for 3 branches', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 3)
                expect(handles).toHaveLength(5)
            })

            it('should return 2 handles for 0 branches (input + output only)', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 0)
                expect(handles).toHaveLength(2)
            })

            it('should have branch handles with correct IDs matching branchHandle()', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 3)
                for (let i = 0; i < 3; i++) {
                    const branchH = handles.find(h => h.id === branchHandle(i))
                    expect(branchH).toBeDefined()
                    expect(branchH!.type).toBe('source')
                    expect(branchH!.position).toBe('right')
                }
            })

            it('should have input and output handles in addition to branch handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 2)
                expect(handles.find(h => h.id === HANDLE_IDS.INPUT)).toBeDefined()
                expect(handles.find(h => h.id === HANDLE_IDS.OUTPUT)).toBeDefined()
            })
        })

        describe('EMPTY trigger type', () => {
            it('should return 1 handle: output only', () => {
                const handles = getHandlesForNodeType(FlowTriggerType.EMPTY)
                expect(handles).toHaveLength(1)
            })

            it('should NOT have input handle', () => {
                const handles = getHandlesForNodeType(FlowTriggerType.EMPTY)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                expect(inputHandle).toBeUndefined()
            })

            it('should have output handle at bottom', () => {
                const handles = getHandlesForNodeType(FlowTriggerType.EMPTY)
                const outputHandle = handles.find(h => h.id === HANDLE_IDS.OUTPUT)
                expect(outputHandle).toBeDefined()
                expect(outputHandle!.type).toBe('source')
                expect(outputHandle!.position).toBe('bottom')
            })
        })

        describe('PIECE trigger type', () => {
            it('should return 1 handle: output only', () => {
                const handles = getHandlesForNodeType(FlowTriggerType.PIECE)
                expect(handles).toHaveLength(1)
            })

            it('should NOT have input handle', () => {
                const handles = getHandlesForNodeType(FlowTriggerType.PIECE)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                expect(inputHandle).toBeUndefined()
            })
        })

        describe('handle ID consistency with HANDLE_IDS constants', () => {
            it('should use HANDLE_IDS.INPUT for input handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const inputHandle = handles.find(h => h.type === 'target')
                expect(inputHandle).toBeDefined()
                expect(inputHandle!.id).toBe(HANDLE_IDS.INPUT)
                expect(inputHandle!.id).toBe('input')
            })

            it('should use HANDLE_IDS.OUTPUT for output handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const outputHandle = handles.find(h => h.position === 'bottom')
                expect(outputHandle).toBeDefined()
                expect(outputHandle!.id).toBe(HANDLE_IDS.OUTPUT)
                expect(outputHandle!.id).toBe('output')
            })

            it('should use HANDLE_IDS.LOOP_OUTPUT for loop-output handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                const loopHandle = handles.find(h => h.position === 'right')
                expect(loopHandle).toBeDefined()
                expect(loopHandle!.id).toBe(HANDLE_IDS.LOOP_OUTPUT)
                expect(loopHandle!.id).toBe('loop-output')
            })

            it('should use branchHandle() for router branch handles', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 2)
                const branchHandles = handles.filter(h => h.id.startsWith('branch-'))
                expect(branchHandles).toHaveLength(2)
                expect(branchHandles[0].id).toBe(branchHandle(0))
                expect(branchHandles[1].id).toBe(branchHandle(1))
            })
        })

        describe('handle positions', () => {
            it('should place input handle at top', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                expect(inputHandle!.position).toBe('top')
            })

            it('should place output handle at bottom', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const outputHandle = handles.find(h => h.id === HANDLE_IDS.OUTPUT)
                expect(outputHandle!.position).toBe('bottom')
            })

            it('should place loop-output handle at right', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                const loopHandle = handles.find(h => h.id === HANDLE_IDS.LOOP_OUTPUT)
                expect(loopHandle!.position).toBe('right')
            })

            it('should place branch handles at right', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 2)
                const branchHandles = handles.filter(h => h.id.startsWith('branch-'))
                for (const bh of branchHandles) {
                    expect(bh.position).toBe('right')
                }
            })
        })

        describe('handle types (source/target)', () => {
            it('should set input handle as target', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const inputHandle = handles.find(h => h.id === HANDLE_IDS.INPUT)
                expect(inputHandle!.type).toBe('target')
            })

            it('should set output handle as source', () => {
                const handles = getHandlesForNodeType(FlowActionType.CODE)
                const outputHandle = handles.find(h => h.id === HANDLE_IDS.OUTPUT)
                expect(outputHandle!.type).toBe('source')
            })

            it('should set loop-output handle as source', () => {
                const handles = getHandlesForNodeType(FlowActionType.LOOP_ON_ITEMS)
                const loopHandle = handles.find(h => h.id === HANDLE_IDS.LOOP_OUTPUT)
                expect(loopHandle!.type).toBe('source')
            })

            it('should set branch handles as source', () => {
                const handles = getHandlesForNodeType(FlowActionType.ROUTER, 2)
                const branchHandles = handles.filter(h => h.id.startsWith('branch-'))
                for (const bh of branchHandles) {
                    expect(bh.type).toBe('source')
                }
            })
        })

        describe('default/unknown action type', () => {
            it('should return 2 handles for unknown action type', () => {
                const handles = getHandlesForNodeType('UNKNOWN_TYPE')
                expect(handles).toHaveLength(2)
            })

            it('should have input and output for unknown type', () => {
                const handles = getHandlesForNodeType('UNKNOWN_TYPE')
                expect(handles.find(h => h.id === HANDLE_IDS.INPUT)).toBeDefined()
                expect(handles.find(h => h.id === HANDLE_IDS.OUTPUT)).toBeDefined()
            })
        })

        describe('HandleConfig type export', () => {
            it('should allow creating HandleConfig objects', () => {
                const config: HandleConfig = {
                    id: 'test',
                    type: 'source',
                    position: 'bottom',
                }
                expect(config.id).toBe('test')
                expect(config.type).toBe('source')
                expect(config.position).toBe('bottom')
            })
        })
    })
})
