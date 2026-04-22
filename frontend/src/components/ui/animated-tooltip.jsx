// Animated Tooltip from Aceternity UI (https://ui.aceternity.com)
// portals out to document body so it can escape any overflow:hidden parent
import { useState, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"

export function AnimatedTooltip({ children, title, subtitle }) {
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.left + rect.width / 2 })
    }
    setHovered(true)
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </div>
      {typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none"
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 999 }}
        >
          <AnimatePresence mode="popLayout">
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6, x: "-50%" }}
                animate={{
                  opacity: 1, y: 0, scale: 1, x: "-50%",
                  transition: { type: "spring", stiffness: 260, damping: 10 }
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6, x: "-50%" }}
                style={{ position: "absolute", top: -56, left: 0, whiteSpace: "nowrap" }}
                className="flex flex-col items-center rounded-md bg-primary px-3 py-2 shadow-lg"
              >
                <div className="absolute inset-x-8 -bottom-px z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                <div className="absolute -bottom-px left-8 z-30 h-px w-[30%] bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
                <div className="relative z-30 text-sm font-semibold text-primary-foreground">{title}</div>
                {subtitle && <div className="text-[10px] text-primary-foreground/70">{subtitle}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </>
  )
}
