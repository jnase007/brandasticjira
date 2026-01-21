import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants
        todo: "bg-status-todo/10 text-status-todo border-status-todo/30",
        inprogress: "bg-status-inprogress/10 text-status-inprogress border-status-inprogress/30",
        done: "bg-status-done/10 text-status-done border-status-done/30",
        // Priority variants
        low: "bg-priority-low/10 text-priority-low border-priority-low/30",
        medium: "bg-priority-medium/10 text-priority-medium border-priority-medium/30",
        high: "bg-priority-high/10 text-priority-high border-priority-high/30",
        urgent: "bg-priority-urgent/10 text-priority-urgent border-priority-urgent/30 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
