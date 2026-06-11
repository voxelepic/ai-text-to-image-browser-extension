import * as React from "react"
import { cn } from "@/lib/utils"

const Field = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("group flex flex-col gap-1.5 w-full", className)}
      {...props}
    />
  )
})
Field.displayName = "Field"

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        "text-[11px] font-bold font-outfit uppercase tracking-[0.06em] text-secondary-foreground transition-colors group-data-[invalid]:text-red-400",
        className
      )}
      {...props}
    />
  )
})
FieldLabel.displayName = "FieldLabel"

const FieldError = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn(
        "text-[11px] font-medium text-red-400 mt-1 animate-fade-in",
        className
      )}
      {...props}
    />
  )
})
FieldError.displayName = "FieldError"

export { Field, FieldLabel, FieldError }
