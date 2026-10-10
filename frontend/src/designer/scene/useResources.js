import { createContext, useContext } from 'react'

export const ResourcesContext = createContext(null)

/** Shared geometries and materials; see ResourcesProvider. */
export const useResources = () => useContext(ResourcesContext)
