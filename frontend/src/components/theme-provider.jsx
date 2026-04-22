import { createContext, useContext, useEffect, useState } from "react"
//listens to state of app rather than manually through every component
// define a dummy default state. 
const initialState = {
  theme: "system",
  setTheme: () => null,
}
// object that holds data
const ThemeProviderContext = createContext(initialState)

export function ThemeProvider({
  // children represents entire app and allows provider to wrap around app without squishing
  children,
  defaultTheme = "system",
  // give name so preference is saved to browser and we dont overwrite data
  storageKey = "vite-ui-theme",
  ...props
}) {
  // lazy initialization to check browsers local storage only once when app first loads
  const [theme, setTheme] = useState(
    () => localStorage.getItem(storageKey) || defaultTheme
  )

  useEffect(() => {
    // targets raw html tag
    const root = window.document.documentElement
    // strips away any old theme classes allowing for clean slate. 
    root.classList.remove("light", "dark")

    if (theme === "system") {
      // applies matching class from user operating system. 
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      // forces user preference onto html tag
      root.classList.add(systemTheme)
      return
    }
    // tells the useEffect to re-run entire block of code the exact millisecond theme state changes. 
    root.classList.add(theme)
  }, [theme])
  // force theme change to save user choice so it survives the refresh
  const value = {
    theme,
    setTheme: (theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }
  // where component renders. wraps <App /> in context of provider anad passes down value object
  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
// custom hook packages this into a clean useTheme() function. 
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  // loud error telling us how to fix rather than silent failure. 
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}