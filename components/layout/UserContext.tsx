'use client'

import { createContext, useContext } from 'react'

export type Role = 'admin' | 'manager' | 'staff'

export interface TopbarUser {
  name:  string
  email: string
  role:  Role
}

const UserContext = createContext<TopbarUser | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: TopbarUser
  children: React.ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): TopbarUser | null {
  return useContext(UserContext)
}
