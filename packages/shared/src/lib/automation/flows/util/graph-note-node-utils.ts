import { Note, NoteColorVariant } from '../note'
import { GraphNode } from './graph-converter'

/**
 * Node type constant for note nodes in the ReactFlow graph.
 *
 * Note nodes are free-form sticky notes that do NOT participate in
 * the execution flow (no handles, no edges, no linked-list representation).
 * They are stored in FlowVersion.notes[] and rendered as draggable
 * rectangles on the canvas.
 *
 * Architecture doc section 3: "graph-note-node.tsx — Sticky note node"
 * Architecture doc section 5: P1-E03 — "Note node integration (free-form notes)"
 */
export const NOTE_NODE_TYPE = 'note' as const

/**
 * Data attached to each note graph node.
 * Contains the full Note object from FlowVersion.notes[].
 */
export type GraphNoteNodeData = {
    note: Note
    noteId: string
}

/**
 * CSS background colors for each NoteColorVariant.
 *
 * These colors use a semi-transparent palette so the canvas background
 * remains visible underneath the note. Colors match common sticky-note
 * palettes used in design tools.
 */
export const NOTE_COLORS: Record<NoteColorVariant, string> = {
    [NoteColorVariant.ORANGE]: '#fed7aa',
    [NoteColorVariant.RED]: '#fecaca',
    [NoteColorVariant.GREEN]: '#bbf7d0',
    [NoteColorVariant.BLUE]: '#bfdbfe',
    [NoteColorVariant.PURPLE]: '#e9d5ff',
    [NoteColorVariant.YELLOW]: '#fef08a',
}

/**
 * Generate a data-testid attribute value for a note node.
 *
 * @param noteId - the note's unique ID
 * @returns formatted data-testid string: "graph-note-{noteId}"
 */
export function getNoteNodeTestId(noteId: string): string {
    return `graph-note-${noteId}`
}

/**
 * Convert FlowVersion.notes[] to ReactFlow-compatible graph nodes.
 *
 * Each Note becomes a GraphNode with:
 * - id = note.id (unique across the graph)
 * - type = NOTE_NODE_TYPE ('note')
 * - position = note.position (x, y from stored note data)
 * - data = GraphNoteNodeData carrying the full Note object
 *
 * Note nodes have no step/stepName/actionType since they are not
 * part of the execution flow. The `data` field uses a different shape
 * than action/trigger nodes (GraphNoteNodeData vs GraphNodeData).
 *
 * @param notes - array of Note objects from FlowVersion.notes[]
 * @returns array of ReactFlow-compatible graph nodes with type='note'
 */
export function notesToGraphNodes(notes: Note[]): GraphNode[] {
    return notes.map((note) => ({
        id: note.id,
        type: NOTE_NODE_TYPE,
        position: { x: note.position.x, y: note.position.y },
        data: {
            note,
            noteId: note.id,
        } as unknown as GraphNode['data'],
    }))
}

/**
 * Extract Note objects from note-type graph nodes.
 *
 * Filters the graph nodes to only those with type=NOTE_NODE_TYPE,
 * then extracts the Note from each node's data. Updates the note's
 * position to match the current graph node position (which may have
 * been changed by dragging on the canvas).
 *
 * @param nodes - array of all graph nodes (mixed types)
 * @returns array of Note objects with updated positions
 */
export function graphNodesToNotes(nodes: GraphNode[]): Note[] {
    return nodes
        .filter((node) => node.type === NOTE_NODE_TYPE)
        .map((node) => {
            const noteData = node.data as unknown as GraphNoteNodeData
            return {
                ...noteData.note,
                position: { x: node.position.x, y: node.position.y },
            }
        })
}
