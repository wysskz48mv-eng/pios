'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NemoclawRole = 'user' | 'assistant' | 'system'

export interface NemoclawMessage {
  id: string
  session_id: string
  role: NemoclawRole
  content: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

interface ModuleContext {
  route: string
  title: string
}

interface NemoclawState {
  isOpen: boolean
  isFullscreen: boolean
  sessionId: string | null
  messages: NemoclawMessage[]
  moduleContext: ModuleContext
  loading: boolean
  initialized: boolean
  setInitialized: (value: boolean) => void
  open: () => void
  close: () => void
  toggle: () => void
  setFullscreen: (value: boolean) => void
  setSession: (sessionId: string | null) => void
  setMessages: (messages: NemoclawMessage[]) => void
  appendMessage: (message: NemoclawMessage) => void
  setModuleContext: (moduleContext: ModuleContext) => void
  setLoading: (value: boolean) => void
  resetConversation: () => void
}

const defaultContext: ModuleContext = {
  route: '/platform/dashboard',
  title: 'Command Centre',
}

export const useNemoclawStore = create<NemoclawState>()(
  persist(
    (set) => ({
      isOpen: true,
      isFullscreen: false,
      sessionId: null,
      messages: [],
      moduleContext: defaultContext,
      loading: false,
      initialized: false,
      setInitialized: (value) => set({ initialized: value }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false, isFullscreen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen, isFullscreen: state.isOpen ? false : state.isFullscreen })),
      setFullscreen: (value) => set((state) => ({ isFullscreen: value, isOpen: value ? true : state.isOpen })),
      setSession: (sessionId) => set({ sessionId }),
      setMessages: (messages) => set({ messages }),
      appendMessage: (message) =>
        set((state) => {
          if (state.messages.some((m) => m.id === message.id)) {
            return state
          }
          return { messages: [...state.messages, message] }
        }),
      setModuleContext: (moduleContext) => set({ moduleContext }),
      setLoading: (value) => set({ loading: value }),
      resetConversation: () => set({ sessionId: null, messages: [], loading: false }),
    }),
    {
      name: 'pios-nemoclaw-state-v1',
      partialize: (state) => ({
        isOpen: state.isOpen,
        sessionId: state.sessionId,
        messages: state.messages.slice(-50),
        moduleContext: state.moduleContext,
      }),
    }
  )
)
