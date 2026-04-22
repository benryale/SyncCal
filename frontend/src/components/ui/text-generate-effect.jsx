// Text Generate Effect from Aceternity UI (https://ui.aceternity.com)
import { useEffect } from "react"
import { motion, stagger, useAnimate } from "framer-motion"
import { cn } from "@/lib/utils"

export function TextGenerateEffect({ words, className, duration = 0.3 }) {
  const [scope, animate] = useAnimate()
  const wordList = words.split(" ")

  useEffect(() => {
    animate(
      "span",
      { opacity: 1, filter: "blur(0px)" },
      { duration, delay: stagger(0.08) }
    )
  }, [scope.current])

  return (
    <motion.div ref={scope} className={cn("inline-block", className)}>
      {wordList.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          className="inline-block opacity-0 mr-[0.25em]"
          style={{ filter: "blur(6px)" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}
