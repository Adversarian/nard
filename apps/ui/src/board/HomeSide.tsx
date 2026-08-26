import { createContext, useContext } from 'react'
import type { HomeSide } from './geometry'

/**
 * Which side the player's home board is on.
 *
 * Context rather than a prop, because only the two text elements deep inside the
 * board need it and threading it through every component between would be noise.
 */
const Ctx = createContext<HomeSide>('right')

export const HomeSideProvider = Ctx.Provider
export const useHomeSide = (): HomeSide => useContext(Ctx)
