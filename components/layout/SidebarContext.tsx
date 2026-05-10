'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarCtx {
  isOpen: boolean
  open:   () => void
  close:  () => void
  toggle: () => void
}

const Ctx = createContext<SidebarCtx>({
  isOpen: false,
  open:   () => {},
  close:  () => {},
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Ctx.Provider value={{
      isOpen,
      open:   () => setIsOpen(true),
      close:  () => setIsOpen(false),
      toggle: () => setIsOpen(v => !v),
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSidebar() {
  return useContext(Ctx)
}
