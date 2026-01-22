import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] relative overflow-hidden touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-brand-orange text-white hover:bg-brand-orange/90 shadow-md hover:shadow-lg hover:shadow-brand-orange/25 btn-gleam",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border-2 border-input bg-background hover:border-brand-orange/50 hover:bg-brand-orange/5 hover:text-brand-orange",
        secondary:
          "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 shadow-sm",
        ghost: "hover:bg-brand-orange/10 hover:text-brand-orange",
        link: "text-brand-orange underline-offset-4 hover:underline",
        gradient: "bg-gradient-brand text-white hover:opacity-90 shadow-lg hover:shadow-xl btn-gleam",
      },
      size: {
        default: "h-10 sm:h-10 min-h-[44px] sm:min-h-0 px-4 py-2",
        sm: "h-9 rounded-md px-3 min-h-[44px] sm:min-h-0",
        lg: "h-11 rounded-lg px-8",
        xl: "h-12 rounded-xl px-10 text-base",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0",
        "icon-sm": "h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
