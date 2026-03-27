import { filterPaletteItems, type PaletteDragData } from '@activepieces/shared';
import { t } from 'i18next';
import { SearchIcon } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { PiecePaletteItem } from './piece-palette-item';

export type PiecePaletteProps = {
  /** List of available pieces to display in the palette */
  items: PaletteDragData[];
};

/**
 * Piece palette sidebar component.
 *
 * Renders a searchable, scrollable list of available pieces that can be
 * dragged onto the graph canvas to create new nodes.
 *
 * Architecture doc section 3: sidebar/piece-palette.tsx
 * Architecture doc section 5: P1-E01 -- "Piece palette sidebar with drag-and-drop"
 *
 * Features:
 * - Search input for filtering pieces by display name
 * - Scrollable list of draggable PiecePaletteItem components
 * - Uses shared filterPaletteItems utility for filtering logic
 */
export const PiecePalette = React.memo(({ items }: PiecePaletteProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(
    () => filterPaletteItems(items, searchQuery),
    [items, searchQuery],
  );

  return (
    <div
      className="flex flex-col h-full w-[220px] min-w-[220px] border-r border-solid border-border bg-background"
      data-testid="piece-palette-sidebar"
    >
      <div className="p-3 border-b border-solid border-border">
        <h3 className="text-sm font-semibold mb-2">{t('Pieces')}</h3>
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t('Search pieces...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="piece-palette-search"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-1">
          {filteredItems.map((item) => (
            <PiecePaletteItem
              key={item.pieceName}
              displayName={item.displayName}
              logoUrl={item.logoUrl}
              pieceType={item.pieceType}
              pieceName={item.pieceName}
            />
          ))}
          {filteredItems.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {t('No pieces found')}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

PiecePalette.displayName = 'PiecePalette';
