import { createContext, useContext } from "react";

// A retained screen is alive, but must not own input, hardware-back or modals.
export const ScreenActivity = createContext(true);
export function useScreenActive() { return useContext(ScreenActivity); }
