import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const NumberInput = React.forwardRef(({ className, value, onChange, min = 0, max = 120, step = 1, disabled, ...props }, ref) => {
  const handleIncrement = (e) => {
    e.preventDefault();
    if (disabled) return;
    const current = parseFloat(value) || 0;
    const next = Math.min(max, current + step);
    onChange?.({ target: { value: String(next) } });
  };

  const handleDecrement = (e) => {
    e.preventDefault();
    if (disabled) return;
    const current = parseFloat(value) || 0;
    const next = Math.max(min, current - step);
    onChange?.({ target: { value: String(next) } });
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="number"
        value={value}
        onChange={onChange}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={cn(
          "flex h-9 w-full rounded-md border border-border bg-slate-950/40 pl-3 pr-7 py-1 text-[13px] text-foreground transition-all hover:border-white/12 focus:border-accent focus:ring-2 focus:ring-accent/15 outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-slate-950/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
      <div className="absolute right-0.5 top-0.5 bottom-0.5 flex flex-col w-5">
        <button
          type="button"
          tabIndex={-1}
          onClick={handleIncrement}
          disabled={disabled}
          className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.05] active:bg-white/[0.1] disabled:opacity-30 disabled:pointer-events-none rounded-tr-[5px] transition-colors"
          aria-label="Increment value"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={handleDecrement}
          disabled={disabled}
          className="flex-1 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.05] active:bg-white/[0.1] disabled:opacity-30 disabled:pointer-events-none rounded-br-[5px] transition-colors"
          aria-label="Decrement value"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
})
NumberInput.displayName = "NumberInput"

export { NumberInput }
