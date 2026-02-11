import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-[#685AFF] text-white hover:bg-[#5a4ee6] shadow-md shadow-[#685AFF]/20 hover:shadow-lg hover:shadow-[#685AFF]/30",
                destructive:
                    "bg-[#FF5B5B] text-white hover:bg-[#e64d4d] shadow-md shadow-[#FF5B5B]/20",
                outline:
                    "border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-[#685AFF] hover:text-[#685AFF]",
                secondary:
                    "bg-[#E8E5FF] text-[#685AFF] hover:bg-[#dbd7ff]",
                ghost: "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
                link: "text-[#685AFF] underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-9 rounded-lg px-4 text-xs",
                lg: "h-12 rounded-xl px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
