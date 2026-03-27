import {
  getEdgeContextMenuActions,
  getContextMenuTestId,
  EDGE_CONTEXT_MENU_ACTIONS,
} from '@activepieces/shared';
import { t } from 'i18next';
import { Trash } from 'lucide-react';
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
  Trash,
};

export type EdgeContextMenuProps = {
  children: React.ReactNode;
  edgeId: string;
  onDelete?: (edgeId: string) => void;
};

/**
 * EdgeContextMenu -- right-click context menu for graph edges.
 *
 * Architecture doc section 3: context-menu/edge-context-menu.tsx (P1-E02)
 *
 * Uses getEdgeContextMenuActions() from shared to determine available actions.
 * Edge context menu contains a single Delete action.
 *
 * Wraps children with Radix ContextMenu. Right-clicking the child element
 * opens the menu at the cursor position.
 */
export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  children,
  edgeId,
  onDelete,
}) => {
  const actions = getEdgeContextMenuActions();

  const handleAction = useCallback(
    (actionId: string) => {
      if (actionId === EDGE_CONTEXT_MENU_ACTIONS.DELETE) {
        onDelete?.(edgeId);
      }
    },
    [edgeId, onDelete],
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

EdgeContextMenu.displayName = 'EdgeContextMenu';
