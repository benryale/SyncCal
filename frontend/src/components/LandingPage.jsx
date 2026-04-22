import { CalendarDays, Users, Clock3, ArrowRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Spotlight } from "@/components/ui/spotlight"
import { FlipWords } from "@/components/ui/flip-words"
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card"

// words that cycle in the hero to show who SyncCal is for
const heroWords = ["your friends", "your group", "your team", "your family"]

const steps = [
  {
    icon: CalendarDays,
    title: "Add your events",
    description: "Tap a date on the calendar to drop in an event."
  },
  {
    icon: Users,
    title: "Share with your group",
    description: "Send your calendar to friends so they can see when you're free."
  },
  {
    icon: Clock3,
    title: "Find free time",
    description: "See where your schedules overlap and lock in a time."
  }
]

function LandingPage({ onGetStarted }) {
  return (
    <div className="relative overflow-hidden">
      {/* spotlight sits behind everything and follows the mouse across the whole page */}
      <Spotlight fill="rgba(99, 102, 241, 0.15)" />

      {/* Hero */}
      <div className="relative">
        <div className="mx-auto max-w-2xl px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#1a2744] dark:text-slate-100 sm:text-5xl">
            Find time that works for{" "}
            <FlipWords words={heroWords} />
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            SyncCal visualizes when your friends, group, or team is free so you can spend less time working out logistics and more time together.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" onClick={onGetStarted} className="gap-2">
              Open Calendar
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#how-it-works">Learn More</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Preview wrapped in a 3D card that tilts on hover */}
      <div className="relative mx-auto max-w-3xl px-6 pb-16">
        <CardContainer>
          <CardBody className="rounded-xl border border-border bg-card p-6 shadow-lg w-full">
            {/* Toolbar mockup */}
            <CardItem translateZ={30} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-[#1a2744] dark:text-slate-100">March 2026</span>
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">today</div>
                  <div className="flex">
                    <div className="flex h-7 w-7 items-center justify-center rounded-l-md bg-primary text-primary-foreground text-sm">‹</div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-r-md bg-primary text-primary-foreground text-sm">›</div>
                  </div>
                </div>
              </div>
            </CardItem>
            {/* Day headers */}
            <CardItem translateZ={20} className="w-full">
              <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>
            </CardItem>
            {/* Grid rows */}
            <CardItem translateZ={10} className="w-full">
              <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
                {/* Row 1 */}
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs text-muted-foreground">28</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">1</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">2</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">3</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">4</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">5</div>
                <div className="border-b border-border p-2 min-h-[52px] text-xs">6</div>
                {/* Row 2 */}
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">7</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">8</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">9</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">
                  10
                  <div className="mt-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Group Sync</div>
                </div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">11</div>
                <div className="border-b border-r border-border p-2 min-h-[52px] text-xs">
                  12
                  <div className="mt-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Office Hrs</div>
                </div>
                <div className="border-b border-border p-2 min-h-[52px] text-xs">13</div>
                {/* Row 3 */}
                <div className="border-r border-border p-2 min-h-[52px] text-xs">14</div>
                <div className="border-r border-border p-2 min-h-[52px] text-xs">15</div>
                <div className="border-r border-border p-2 min-h-[52px] text-xs">16</div>
                <div className="border-r border-border p-2 min-h-[52px] text-xs">17</div>
                <div className="border-r border-border p-2 min-h-[52px] text-xs">18</div>
                <div className="border-r border-border p-2 min-h-[52px] text-xs">19</div>
                <div className="p-2 min-h-[52px] text-xs">20</div>
              </div>
            </CardItem>
          </CardBody>
        </CardContainer>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="relative border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold text-[#1a2744] dark:text-slate-100">Simple as 1, 2, 3</h2>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <step.icon className="size-5 text-[#1a2744] dark:text-slate-100" />
                </div>
                <h3 className="text-sm font-semibold text-[#1a2744] dark:text-slate-100">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
