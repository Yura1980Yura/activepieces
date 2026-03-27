import {
  getCanvasContextMenuActions,
  getContextMenuTestId,
  CANVAS_CONTEXT_MENU_ACTIONS,
} from '@activepieces/shared';
import { t } from 'i18next';
import { ClipboardPaste, MousePointerSquareDashed } from 'lucide-react';
import React, { useCallback } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

/**
 * Icon mapping from string names to lucide-react components.
 */
const ICON_MAP: Record<string, React.ElementType> = {
  MousePointerSquareDashed,
  ClipboardPaste,
};

export type CanvasContextMenuProps = {
  children: React.ReactNode;
  onSelectAll?: () => void;
  onPaste?: () => void;
};

/**
 * CanvasContextMenu -- right-click context menu for the canvas background.
 *
 * Architecture doc section 3: context-menu/canvas-context-menu.tsx (P1-E02)
 *
 * Uses getCanvasContextMenuActions() from shared to determine available actions.
 * Canvas context menu contains: Select All, Paste.
 *
 * Wraps children with Radix ContextMenu. Right-clicking the canvas background
 * opens the menu at the cursor position.
 */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  children,
  onSelectAll,
  onPaste,
}) => {
  const actions = getCanvasContextMenuActions();

  const handleAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case CANVAS_CONTEXT_MENU_ACTIONS.SELECT_ALL:
          onSelectAll?.();
          break;
        case CANVAS_CONTEXT_MENU_ACTIONS.PASTE:
          onPaste?.();
          break;
      }
    },
    [onSelectAll, onPaste],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action) => {
          const IconComponent = ICON_MAP[action.icon];
          return (
            <ContextMenuItem
              key={action.id}
              data-testid={getContextMenuTestId(action.id)}
              onClick={() => handleAction(action.id)}
              variant={action.destructive ? 'destructive' : 'default'}
              className="flex items-center gap-2"
            >
              {IconComponent && <IconComponent className="h-4 w-4" />}
              {t(action.label)}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
};

CanvasContextMenu.displayName = 'CanvasContextMenu';
