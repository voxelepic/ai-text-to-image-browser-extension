import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "font-outfit text-[11px] font-semibold text-secondary uppercase tracking-wider select-none",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
