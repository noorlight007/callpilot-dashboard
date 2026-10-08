"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowRight } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EndUserModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onBack: () => void
    onNext: (userData: any) => void
}

export function EndUserModal({ open, onOpenChange, onBack, onNext }: EndUserModalProps) {
    const [error, setError] = useState("")
    const [showErrorDialog, setShowErrorDialog] = useState(false)
    const [isHydrated, setIsHydrated] = useState(false)
    const [formData, setFormData] = useState({
        friendly_name: "",
        business_name: "",
        business_registration_number: "",
        business_registration_identifier: "",
        business_website: "",
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
    })

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsHydrated(true)
            if (open) {
                const savedData = localStorage.getItem("endUserData")
                if (savedData) {
                    setFormData(JSON.parse(savedData))
                }
            }
        }
    }, [open])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        let val = value
        if (name === "phone_number" && val.startsWith("0")) {
            val = val.substring(1)
        }
        const updatedData = { ...formData, [name]: val }
        setFormData(updatedData)
        if (typeof window !== "undefined") {
            localStorage.setItem("endUserData", JSON.stringify(updatedData))
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (
            !formData.friendly_name ||
            !formData.business_name ||
            !formData.first_name ||
            !formData.last_name ||
            !formData.email ||
            !formData.phone_number
        ) {
            setError("Please fill in all required fields")
            setShowErrorDialog(true)
            return
        }

        if (typeof window !== "undefined") {
            localStorage.setItem("endUserData", JSON.stringify(formData))
        }
        onNext(formData)
    }

    const handleCancel = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("endUserData")
        }
        setFormData({
            friendly_name: "",
            business_name: "",
            business_registration_number: "",
            business_registration_identifier: "",
            business_website: "",
            first_name: "",
            last_name: "",
            email: "",
            phone_number: "",
        })
        setError("")
        onOpenChange(false)
    }

    if (!isHydrated) {
        return null
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-3xl bg-white/90 dark:bg-gray-950/90 animate-scale-in shadow-2xl shadow-indigo-500/20">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-extrabold gradient-text">End User Information</DialogTitle>
                        <DialogDescription>Step 2 of 3: Provide end user details</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Friendly Name *</label>
                                <Input
                                    placeholder="e.g., Osman Goni"
                                    name="friendly_name"
                                    value={formData.friendly_name}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Business Name *</label>
                                <Input
                                    placeholder="e.g., Acme Corporation"
                                    name="business_name"
                                    value={formData.business_name}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Registration Number</label>
                                <Input
                                    placeholder="e.g., 12-3456789"
                                    name="business_registration_number"
                                    value={formData.business_registration_number}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Registration Identifier</label>
                                <Input
                                    placeholder="e.g., UK:CRN"
                                    name="business_registration_identifier"
                                    value={formData.business_registration_identifier}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Business Website</label>
                                <Input
                                    placeholder="e.g., https://acmecorp.com"
                                    name="business_website"
                                    value={formData.business_website}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">First Name *</label>
                                <Input
                                    placeholder="e.g., Osman"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Last Name *</label>
                                <Input
                                    placeholder="e.g., Goni"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email *</label>
                                <Input
                                    type="email"
                                    placeholder="your@email.com"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Phone Number *</label>
                                <Input
                                    placeholder="+8801815553036"
                                    name="phone_number"
                                    value={formData.phone_number}
                                    onChange={handleChange}
                                    className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                                />
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3 pt-6 border-t border-primary/10">
                            <Button
                                type="button"
                                onClick={onBack}
                                variant="outline"
                                className="cursor-pointer flex-1 rounded-xl border-2 border-primary/20 bg-white/60 dark:bg-white/5 hover:bg-primary/10 hover:border-primary/40"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <Button
                                type="submit"
                                className="cursor-pointer flex-1 gradient-bg text-white font-semibold rounded-xl border-0 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                            >
                                Next
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Error</AlertDialogTitle>
                        <AlertDialogDescription>
                            {error}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
