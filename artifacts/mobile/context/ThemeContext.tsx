import React, { createContext, useContext } from "react";

interface ThemeContextValue {
  colorScheme: "light";
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: "light",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colorScheme: "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
