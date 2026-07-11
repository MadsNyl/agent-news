"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckCircle, InfoCircle, AlertCircle, XCircle, Loader } from "~/components/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircle strokeWidth={2} className="size-4" />
        ),
        info: (
          <InfoCircle strokeWidth={2} className="size-4" />
        ),
        warning: (
          <AlertCircle strokeWidth={2} className="size-4" />
        ),
        error: (
          <XCircle strokeWidth={2} className="size-4" />
        ),
        loading: (
          <Loader strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
