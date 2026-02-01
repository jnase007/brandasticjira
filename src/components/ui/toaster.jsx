import { Undo2 } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/useToast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {/* Support for action button with label and onClick */}
            {action?.label && action?.onClick ? (
              <ToastAction
                altText={action.label}
                onClick={action.onClick}
                className="shrink-0 bg-brand-orange/20 border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                {action.label}
              </ToastAction>
            ) : action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
