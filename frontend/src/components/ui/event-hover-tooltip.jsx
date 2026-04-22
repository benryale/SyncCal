// Event hover tooltip adapted from Aceternity UI (https://ui.aceternity.com)
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"

export function EventHoverTooltip({ tooltip }) {
  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence mode="popLayout">
      {tooltip && (
        <div
          className="pointer-events-none"
          style={{ position: "fixed", top: tooltip.top, left: tooltip.left, zIndex: 999 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96, x: "-50%" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: "-50%",
              transition: { type: "spring", stiffness: 180, damping: 18 }
            }}
            exit={{ opacity: 0, y: 10, scale: 0.95, x: "-50%" }}
            style={{ position: "absolute", bottom: 14, left: 0 }}
            className="w-64 rounded-md border border-primary-foreground/15 bg-primary px-3 py-2 text-primary-foreground shadow-lg"
          >
            <div className="absolute inset-x-8 -bottom-px z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
            <div className="absolute -bottom-px left-8 z-30 h-px w-[30%] bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />

            <div className="relative z-30 flex flex-col gap-1 text-left">
              <p className="text-sm font-semibold leading-tight">{tooltip.title}</p>
              {tooltip.subtitle && (
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/65">
                  {tooltip.subtitle}
                </p>
              )}
              {tooltip.meta.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 text-xs leading-relaxed text-primary-foreground/80">
                  {tooltip.meta.map((line, idx) => (
                    <p key={`${line}-${idx}`}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
