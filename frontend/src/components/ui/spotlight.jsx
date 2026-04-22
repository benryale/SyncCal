// Spotlight effect from Aceternity UI (https://ui.aceternity.com)
import { useRef, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function Spotlight({ className, fill = "white" }) {
  const containerRef = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleMove(e) {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
      if (inside) {
        setPos({ x, y })
        setVisible(true)
      } else {
        setVisible(false)
      }
    }

    document.addEventListener("mousemove", handleMove)
    return () => document.removeEventListener("mousemove", handleMove)
  }, [])

  return (
    <div ref={containerRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, ${fill}, transparent 65%)`,
        }}
        className="pointer-events-none absolute inset-0"
      />
    </div>
  )
}
