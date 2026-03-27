import {
  NOTE_COLORS,
  getNoteNodeTestId,
  type GraphNoteNodeData,
} from '@activepieces/shared';
import { type NodeProps } from '@xyflow/react';
import React from 'react';

/**
 * GraphNoteNode — custom ReactFlow node for free-form sticky notes.
 *
 * Notes are NOT part of the execution flow:
 * - No input handle (cannot receive connections)
 * - No output handle (cannot send connections)
 * - Freely draggable on the canvas
 * - Display note.content with colored background based on note.color
 * - Stored in FlowVersion.notes[] (not in linked-list trigger→action chain)
 *
 * Architecture doc section 3: "graph-note-node.tsx — Sticky note node"
 * Architecture doc section 5: P1-E03 — "Note node integration"
 * Architecture doc section 6.6: ADD_NOTE/UPDATE_NOTE/DELETE_NOTE operations
 */
const GraphNoteNode = React.memo(
  ({ data }: NodeProps & { data: GraphNoteNodeData }) => {
    const { note, noteId } = data;
    const backgroundColor = NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow;

    return (
      <div
        data-testid={getNoteNodeTestId(noteId)}
        className="rounded-md border border-solid border-border/50 px-3 py-2 shadow-sm"
        style={{
          backgroundColor,
          width: note.size.width,
          minHeight: note.size.height,
          minWidth: 120,
        }}
      >
        {/* No handles — notes do not participate in execution flow */}
        <div className="text-sm text-foreground/80 whitespace-pre-wrap break-words">
          {note.content}
        </div>
      </div>
    );
  },
);

GraphNoteNode.displayName = 'GraphNoteNode';
export { GraphNoteNode };
