import { create } from 'zustand';

/**
 * ARCHITECTURAL RULE: PROHIBITED SERVER-STATE DUPLICATION (FND-FE-005)
 *
 * 1. TanStack Query (@tanstack/react-query) owns ALL server domain data:
 *    - Conversations, messages, contacts, campaigns, channels, memberships, audit logs.
 *    - Server queries and mutations must never be synchronized or stored in Zustand.
 *
 * 2. Zustand is restricted STRICTLY to local, ephemeral client UI interaction state:
 *    - Sidebar collapse/open status.
 *    - Active modal/dialog IDs.
 *    - Active client theme preference (light / dark / system).
 *    - Session expiry banner/dialog toggle.
 *
 * 3. NEVER copy, duplicate, or mirror server entity records into this Zustand store.
 *    Duplication leads to cache drift, inconsistency with optimistic updates,
 *    and prevents Socket.IO events from properly invalidating TanStack Query keys.
 */

export interface UiState {
  // Sidebar State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Customer Context Panel State (320px right panel)
  customerContextOpen: boolean;
  toggleCustomerContext: () => void;
  setCustomerContextOpen: (open: boolean) => void;

  // Command Palette & Modal Shortcuts State
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;
  toggleShortcutsModal: () => void;

  // Unified Inbox Ephemeral UI State
  activeQueueTab: 'unassigned' | 'mine' | 'all';
  setActiveQueueTab: (tab: 'unassigned' | 'mine' | 'all') => void;
  composerMode: 'reply' | 'note';
  setComposerMode: (mode: 'reply' | 'note') => void;
  toggleComposerMode: () => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Theme State
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Modal / Dialog State
  activeModal: string | null;
  openModal: (modalId: string) => void;
  closeModal: () => void;

  // Session Expiry UI State
  isSessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  customerContextOpen: true,
  toggleCustomerContext: () =>
    set((state) => ({ customerContextOpen: !state.customerContextOpen })),
  setCustomerContextOpen: (open) => set({ customerContextOpen: open }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  shortcutsModalOpen: false,
  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
  toggleShortcutsModal: () => set((state) => ({ shortcutsModalOpen: !state.shortcutsModalOpen })),

  activeQueueTab: 'unassigned',
  setActiveQueueTab: (tab) => set({ activeQueueTab: tab }),

  composerMode: 'reply',
  setComposerMode: (mode) => set({ composerMode: mode }),
  toggleComposerMode: () =>
    set((state) => ({ composerMode: state.composerMode === 'reply' ? 'note' : 'reply' })),

  selectedConversationId: null,
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),

  theme: 'system',
  setTheme: (theme) => set({ theme }),

  activeModal: null,
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  isSessionExpired: false,
  setSessionExpired: (expired) => set({ isSessionExpired: expired }),
}));
