import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-1.5 w-full overflow-hidden rounded-full bg-slate-950/60 border border-border",
      className
    )}
    {...props}
  >
    <div
      className="h-full w-full flex-1 bg-accent transition-all duration-300 rounded-full"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
