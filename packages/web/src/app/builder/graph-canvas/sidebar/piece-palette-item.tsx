import {
  createPaletteDragData,
  getPaletteItemTestId,
  PALETTE_DRAG_TYPE,
  type PaletteDragData,
} from '@activepieces/shared';
import React from 'react';

import { PieceIcon } from '@/features/pieces';

export type PiecePaletteItemProps = {
  displayName: string;
  logoUrl: string;
  pieceType: string;
  pieceName: string;
  onPieceClick?: (dragData: PaletteDragData, position: { x: number; y: number }) => void;
};

/**
 * A single draggable piece item in the piece palette sidebar.
 *
 * Uses HTML5 native drag (draggable attribute + onDragStart with dataTransfer)
 * instead of @dnd-kit. This is the standard pattern for external drag-and-drop
 * onto a ReactFlow canvas (ReactFlow uses screenToFlowPosition for coordinate
 * conversion, which works natively with HTML5 drag events).
 *
 * Architecture doc section 3: sidebar/piece-palette-item.tsx
 */
export const PiecePaletteItem = React.memo(
  ({ displayName, logoUrl, pieceType, pieceName, onPieceClick }: PiecePaletteItemProps) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
      const dragData = createPaletteDragData(
        pieceType,
        pieceName,
        displayName,
        logoUrl,
      );
      e.dataTransfer.setData(PALETTE_DRAG_TYPE, dragData);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleClick = () => {
      if (!onPieceClick) return;
      const dragData = createPaletteDragData(pieceType, pieceName, displayName, logoUrl);
      const parsed = JSON.parse(dragData) as PaletteDragData;
      onPieceClick(parsed, { x: 400, y: 300 });
    };

    return (
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onClick={handleClick}
        className="flex items-center gap-2 rounded-md border border-solid border-border bg-background p-2 cursor-pointer hover:bg-accent transition-colors select-none"
        data-testid={getPaletteItemTestId(pieceName)}
      >
        <PieceIcon
          logoUrl={logoUrl}
          displayName={displayName}
          showTooltip={false}
          size={'sm'}
        />
        <span className="text-sm truncate">{displayName}</span>
      </div>
    );
  },
);

PiecePaletteItem.displayName = 'PiecePaletteItem';
