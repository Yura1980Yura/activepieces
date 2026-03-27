import {
  getNodeContextMenuActions,
  getContextMenuTestId,
  NODE_CONTEXT_MENU_ACTIONS,
} from '@activepieces/shared';
import { t } from 'i18next';
import { CopyPlus, Trash } from 'lucide-react';
import React, { useCallback } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

/**
 * Icon mapping from string names to lucide-react components.
 * Keeps the shared utility DOM-free (icon is a string, not a component).
 */
const ICON_MAP: Record<string, React.ElementType> = {
  CopyPlus,
  Trash,
};

export type NodeContextMenuProps = {
  children: React.ReactNode;
  isTrigger: boolean;
  stepName: string;
  onDelete?: (stepName: string) => void;
  onDuplicate?: (stepName: string) => void;
};

/**
 * NodeContextMenu -- right-click context menu for graph nodes.
 *
 * Architecture doc section 3: context-menu/node-context-menu.tsx (P1-E02)
 *
 * Uses getNodeContextMenuActions() from shared to determine available actions.
 * Trigger nodes get no context menu items (cannot delete/duplicate trigger).
 * Action nodes get: Duplicate, [separator], Delete.
 *
 * Wraps children with Radix ContextMenu. Right-clicking the child element
 * opens the menu at the cursor position.
 */
export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  children,
  isTrigger,
  stepName,
  onDelete,
  onDuplicate,
}) => {
  const actions = getNodeContextMenuActions(isTrigger);

  const handleAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case NODE_CONTEXT_MENU_ACTIONS.DELETE:
          onDelete?.(stepName);
          break;
        case NODE_CONTEXT_MENU_ACTIONS.DUPLICATE:
          onDuplicate?.(stepName);
          break;
      }
    },
    [stepName, onDelete, onDuplicate],
  );

  // If no actions available (trigger node), render children without menu
  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action) => {
          const IconComponent = ICON_MAP[action.icon];
          return (
            <React.Fragment key={action.id}>
              {action.separator && <ContextMenuSeparator />}
              <ContextMenuItem
                data-testid={getContextMenuTestId(action.id)}
                onClick={() => handleAction(action.id)}
                variant={action.destructive ? 'destructive' : 'default'}
                className="flex items-center gap-2"
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                {t(action.label)}
              </ContextMenuItem>
            </React.Fragment>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
};

NodeContextMenu.displayName = 'NodeContextMenu';
