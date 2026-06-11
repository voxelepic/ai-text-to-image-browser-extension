import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const SelectContext = createContext(null);

export function Select({ children, value, onValueChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, setIsOpen, disabled }}>
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className, children, ...props }) {
  const { isOpen, setIsOpen, disabled } = useContext(SelectContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-accent bg-slate-950/40 px-3 py-2 text-[13px] text-foreground outline-none transition-all hover:border-accent/80 ring-2 ring-accent/15 focus:border-accent focus:ring-2 focus:ring-accent/15 group-data-[invalid]:border-red-500 group-data-[invalid]:ring-red-500/15 group-data-[invalid]:text-red-400 aria-invalid:border-red-500 aria-invalid:ring-red-500/15 aria-invalid:text-red-400 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/15 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", isOpen && "transform rotate-180")} />
    </button>
  );
}

export function SelectGroup({ className, children, ...props }) {
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }) {
  const { value } = useContext(SelectContext);

  const getDisplayValue = () => {
    if (value === "gemini") {
      return (
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 28 28" fill="currentColor">
            <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" />
          </svg>
          Gemini
        </span>
      );
    }
    if (value === "chatgpt") {
      return (
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
          </svg>
          ChatGPT
        </span>
      );
    }
    if (value === "puter") {
      return (
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Puter.js (Image Gen)
        </span>
      );
    }
    if (value) {
      if (value === "1:1") return "1:1 (Square)";
      if (value === "16:9") return "16:9 (Landscape)";
      if (value === "9:16") return "9:16 (Portrait)";
      if (value === "3:2") return "3:2 (Classic)";
      if (value === "2:3") return "2:3 (Comic/Book)";
      if (value === "21:9") return "21:9 (Cinematic)";
      return value;
    }
    return placeholder;
  };

  return <span className="pointer-events-none">{getDisplayValue()}</span>;
}

export function SelectContent({ className, children }) {
  const { isOpen } = useContext(SelectContext);
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-[220px] w-full overflow-y-auto rounded-md border border-border bg-card p-1 text-foreground shadow-md animate-in fade-in duration-150 custom-scrollbar",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({ className, children, value }) {
  const { value: selectedValue, onValueChange, setIsOpen } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setIsOpen(false);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-[13px] text-secondary outline-none transition-all hover:bg-white/5 hover:text-primary focus:bg-white/5 focus:text-primary",
        isSelected && "text-primary font-medium",
        className
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </button>
  );
}
