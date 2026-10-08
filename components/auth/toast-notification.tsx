"use client"

import { useEffect } from "react"
import { CheckCircle2, XCircle, X } from "lucide-react"

interface ToastNotificationProps {
    title: string
    description: string
    variant?: "default" | "destructive"
    onClose: () => void
}

export function ToastNotification({ title, description, variant = "default", onClose }: ToastNotificationProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose()
        }, 5000)
        return () => clearTimeout(timer)
    }, [onClose])

    return (
        <div className={`fixed top-4 right-4 z-[110] flex w-full max-w-sm overflow-hidden rounded-2xl border glass shadow-xl animate-in slide-in-from-right duration-300 ${variant === "destructive" ? "border-destructive" : "border-border"
            }`}>
            <div className="flex w-full p-4">
                <div className="flex flex-shrink-0 items-start">
                    {variant === "destructive" ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                </div>
                <div className="ml-3 flex-1 pt-0.5">
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="ml-4 flex flex-shrink-0 items-start">
                    <button
                        onClick={onClose}
                        className="inline-flex rounded-md text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}
