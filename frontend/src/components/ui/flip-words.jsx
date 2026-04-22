// FlipWords effect from Aceternity UI (https://ui.aceternity.com)
import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function FlipWords({ words, duration = 3000, className }) {
  const [currentWord, setCurrentWord] = useState(words[0])
  const [isAnimating, setIsAnimating] = useState(false)

  const nextWord = useCallback(() => {
    const idx = words.indexOf(currentWord)
    const next = words[(idx + 1) % words.length]
    setCurrentWord(next)
    setIsAnimating(true)
  }, [currentWord, words])

  useEffect(() => {
    if (isAnimating) return
    const timer = setTimeout(nextWord, duration)
    return () => clearTimeout(timer)
  }, [isAnimating, duration, nextWord])

  return (
    <AnimatePresence
      onExitComplete={() => setIsAnimating(false)}
      mode="wait"
    >
      <motion.span
        key={currentWord}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40, filter: "blur(8px)" }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        className={cn("relative z-10 inline-block text-left text-[#1a2744] dark:text-slate-100", className)}
      >
        {currentWord.split(" ").map((word, wordIdx) => (
          <motion.span
            key={word + wordIdx}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: wordIdx * 0.1, duration: 0.3 }}
            className="inline-block"
          >
            {word.split("").map((letter, letterIdx) => (
              <motion.span
                key={letter + letterIdx}
                initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: wordIdx * 0.1 + letterIdx * 0.02, duration: 0.2 }}
                className="inline-block"
              >
                {letter}
              </motion.span>
            ))}
            <span className="inline-block">&nbsp;</span>
          </motion.span>
        ))}
      </motion.span>
    </AnimatePresence>
  )
}
