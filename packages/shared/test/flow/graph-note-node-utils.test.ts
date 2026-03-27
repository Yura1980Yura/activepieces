import { describe, it, expect } from 'vitest'
import {
    NOTE_NODE_TYPE,
    NOTE_COLORS,
    notesToGraphNodes,
    graphNodesToNotes,
    getNoteNodeTestId,
    GraphNoteNodeData,
} from '../../src/lib/automation/flows/util/graph-note-node-utils'
import { NoteColorVariant, Note } from '../../src/lib/automation/flows/note'

function createTestNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'note-1',
        content: 'Test note content',
        ownerId: 'user-1',
        color: NoteColorVariant.YELLOW,
        position: { x: 100, y: 200 },
        size: { width: 200, height: 150 },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    }
}

describe('graph-note-node-utils', () => {
    describe('NOTE_NODE_TYPE', () => {
        it('should equal "note"', () => {
            expect(NOTE_NODE_TYPE).toBe('note')
        })

        it('should be a string constant', () => {
            expect(typeof NOTE_NODE_TYPE).toBe('string')
        })
    })

    describe('NOTE_COLORS', () => {
        it('should have a color for ORANGE', () => {
            expect(NOTE_COLORS[NoteColorVariant.ORANGE]).toBe('#fed7aa')
        })

        it('should have a color for RED', () => {
            expect(NOTE_COLORS[NoteColorVariant.RED]).toBe('#fecaca')
        })

        it('should have a color for GREEN', () => {
            expect(NOTE_COLORS[NoteColorVariant.GREEN]).toBe('#bbf7d0')
        })

        it('should have a color for BLUE', () => {
            expect(NOTE_COLORS[NoteColorVariant.BLUE]).toBe('#bfdbfe')
        })

        it('should have a color for PURPLE', () => {
            expect(NOTE_COLORS[NoteColorVariant.PURPLE]).toBe('#e9d5ff')
        })

        it('should have a color for YELLOW', () => {
            expect(NOTE_COLORS[NoteColorVariant.YELLOW]).toBe('#fef08a')
        })

        it('should have entries for all NoteColorVariant values', () => {
            const allVariants = Object.values(NoteColorVariant)
            for (const variant of allVariants) {
                expect(NOTE_COLORS[variant]).toBeDefined()
                expect(typeof NOTE_COLORS[variant]).toBe('string')
                expect(NOTE_COLORS[variant]).toMatch(/^#[0-9a-f]{6}$/)
            }
        })
    })

    describe('getNoteNodeTestId', () => {
        it('should return formatted test id', () => {
            expect(getNoteNodeTestId('abc-123')).toBe('graph-note-abc-123')
        })

        it('should handle empty noteId', () => {
            expect(getNoteNodeTestId('')).toBe('graph-note-')
        })

        it('should prefix with "graph-note-"', () => {
            const result = getNoteNodeTestId('xyz')
            expect(result.startsWith('graph-note-')).toBe(true)
        })
    })

    describe('notesToGraphNodes', () => {
        it('should convert a single note to a graph node', () => {
            const note = createTestNote()
            const nodes = notesToGraphNodes([note])

            expect(nodes).toHaveLength(1)
            expect(nodes[0].id).toBe('note-1')
            expect(nodes[0].type).toBe(NOTE_NODE_TYPE)
            expect(nodes[0].position).toEqual({ x: 100, y: 200 })
        })

        it('should set data with note and noteId', () => {
            const note = createTestNote()
            const nodes = notesToGraphNodes([note])
            const data = nodes[0].data as unknown as GraphNoteNodeData

            expect(data.note).toEqual(note)
            expect(data.noteId).toBe('note-1')
        })

        it('should convert multiple notes', () => {
            const notes = [
                createTestNote({ id: 'note-1', position: { x: 10, y: 20 } }),
                createTestNote({ id: 'note-2', position: { x: 30, y: 40 }, color: NoteColorVariant.BLUE }),
                createTestNote({ id: 'note-3', position: { x: 50, y: 60 }, color: NoteColorVariant.RED }),
            ]
            const nodes = notesToGraphNodes(notes)

            expect(nodes).toHaveLength(3)
            expect(nodes[0].id).toBe('note-1')
            expect(nodes[1].id).toBe('note-2')
            expect(nodes[2].id).toBe('note-3')
            expect(nodes[1].position).toEqual({ x: 30, y: 40 })
        })

        it('should return empty array for empty notes', () => {
            const nodes = notesToGraphNodes([])
            expect(nodes).toEqual([])
        })

        it('should preserve note color in data', () => {
            const note = createTestNote({ color: NoteColorVariant.PURPLE })
            const nodes = notesToGraphNodes([note])
            const data = nodes[0].data as unknown as GraphNoteNodeData

            expect(data.note.color).toBe(NoteColorVariant.PURPLE)
        })

        it('should set all nodes to type NOTE_NODE_TYPE', () => {
            const notes = [
                createTestNote({ id: 'a' }),
                createTestNote({ id: 'b' }),
            ]
            const nodes = notesToGraphNodes(notes)

            for (const node of nodes) {
                expect(node.type).toBe('note')
            }
        })
    })

    describe('graphNodesToNotes', () => {
        it('should extract notes from note-type graph nodes', () => {
            const note = createTestNote()
            const nodes = notesToGraphNodes([note])
            const result = graphNodesToNotes(nodes)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('note-1')
            expect(result[0].content).toBe('Test note content')
        })

        it('should filter out non-note nodes', () => {
            const noteNodes = notesToGraphNodes([createTestNote()])
            const actionNode = {
                id: 'step-1',
                type: 'action',
                position: { x: 0, y: 0 },
                data: { step: {} as any, stepName: 'step-1', actionType: 'CODE' },
            }
            const mixed = [...noteNodes, actionNode]
            const result = graphNodesToNotes(mixed)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('note-1')
        })

        it('should update note position from graph node position', () => {
            const note = createTestNote({ position: { x: 100, y: 200 } })
            const nodes = notesToGraphNodes([note])
            // Simulate user dragging the note to a new position
            nodes[0].position = { x: 300, y: 400 }
            const result = graphNodesToNotes(nodes)

            expect(result[0].position).toEqual({ x: 300, y: 400 })
        })

        it('should return empty array when no note nodes exist', () => {
            const actionNode = {
                id: 'step-1',
                type: 'action',
                position: { x: 0, y: 0 },
                data: { step: {} as any, stepName: 'step-1', actionType: 'CODE' },
            }
            const result = graphNodesToNotes([actionNode])
            expect(result).toEqual([])
        })

        it('should return empty array for empty input', () => {
            const result = graphNodesToNotes([])
            expect(result).toEqual([])
        })

        it('should handle round-trip conversion (notes -> nodes -> notes)', () => {
            const originalNotes = [
                createTestNote({ id: 'note-a', content: 'First', color: NoteColorVariant.BLUE }),
                createTestNote({ id: 'note-b', content: 'Second', color: NoteColorVariant.GREEN }),
            ]
            const nodes = notesToGraphNodes(originalNotes)
            const roundTripped = graphNodesToNotes(nodes)

            expect(roundTripped).toHaveLength(2)
            expect(roundTripped[0].id).toBe('note-a')
            expect(roundTripped[0].content).toBe('First')
            expect(roundTripped[0].color).toBe(NoteColorVariant.BLUE)
            expect(roundTripped[1].id).toBe('note-b')
            expect(roundTripped[1].content).toBe('Second')
            expect(roundTripped[1].color).toBe(NoteColorVariant.GREEN)
        })

        it('should preserve all note fields except position', () => {
            const note = createTestNote({
                id: 'note-x',
                content: 'Important note',
                ownerId: 'user-42',
                color: NoteColorVariant.RED,
                size: { width: 300, height: 250 },
                createdAt: '2026-03-01T10:00:00Z',
                updatedAt: '2026-03-15T15:00:00Z',
            })
            const nodes = notesToGraphNodes([note])
            const result = graphNodesToNotes(nodes)

            expect(result[0].id).toBe('note-x')
            expect(result[0].content).toBe('Important note')
            expect(result[0].ownerId).toBe('user-42')
            expect(result[0].color).toBe(NoteColorVariant.RED)
            expect(result[0].size).toEqual({ width: 300, height: 250 })
            expect(result[0].createdAt).toBe('2026-03-01T10:00:00Z')
            expect(result[0].updatedAt).toBe('2026-03-15T15:00:00Z')
        })
    })
})
