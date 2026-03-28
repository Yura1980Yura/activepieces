import { ApEdition, ApFlagId, getUseGraphCanvas } from '@activepieces/shared';
import { useMemo } from 'react';

import { useEmbedding } from '@/components/providers/embed-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar-shadcn';
import { PurchaseExtraFlowsDialog } from '@/features/billing';
import { flagsHooks } from '@/hooks/flags-hooks';
import { cn } from '@/lib/utils';

import {
  GlobalSearchProvider,
  useGlobalSearch,
} from '../global-search/global-search-context';
import { ProjectDashboardSidebar } from '../sidebar/dashboard';

export function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalSearchProvider>
      <BuilderLayoutInner>{children}</BuilderLayoutInner>
    </GlobalSearchProvider>
  );
}

function BuilderLayoutInner({ children }: { children: React.ReactNode }) {
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);
  const { embedState } = useEmbedding();
  const { open: searchOpen } = useGlobalSearch();
  const useGraphCanvas = useMemo(
    () => getUseGraphCanvas(window.localStorage),
    [],
  );
  const hideNavSidebar = useGraphCanvas || embedState.isEmbedded;

  if (hideNavSidebar) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {children}
        {edition === ApEdition.CLOUD && <PurchaseExtraFlowsDialog />}
      </div>
    );
  }

  return (
    <SidebarProvider hoverMode={!searchOpen} defaultOpen={false}>
      <ProjectDashboardSidebar />
      <SidebarInset className="flex flex-col h-full overflow-hidden bg-sidebar">
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden',
            'p-1.5',
          )}
        >
          <div
            className={cn(
              'flex flex-col h-full bg-background overflow-hidden',
              'rounded-xl shadow-[2px_0px_4px_-2px_rgba(0,0,0,0.05),0px_2px_4px_-2px_rgba(0,0,0,0.05)] border',
            )}
          >
            {children}
          </div>
        </div>
        {edition === ApEdition.CLOUD && <PurchaseExtraFlowsDialog />}
      </SidebarInset>
    </SidebarProvider>
  );
}
