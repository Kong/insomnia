import { createContext, useContext } from 'react';

interface SidebarContextValue {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
  isSidebarCollapsed: false,
  toggleSidebar: () => {},
});

export const useSidebarContext = () => useContext(SidebarContext);
