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
import { ChevronDown } from "lucide-react"
import { phoneService } from "@/services/phone-service"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import { ToastNotification } from "@/components/auth/toast-notification"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CreateBundleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onNext: (bundleData: any) => void
    selectedCountryCode?: string
}

interface Country {
    country: string
    country_code: string
    phone_code?: string
}

export function CreateBundleModal({ open, onOpenChange, onNext, selectedCountryCode }: CreateBundleModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [countries, setCountries] = useState<Country[]>([])
    const [error, setError] = useState("")
    const [showErrorDialog, setShowErrorDialog] = useState(false)
    const [toast, setToast] = useState<any>(null)
    const [countrySearch, setCountrySearch] = useState("")
    const [showCountriesDropdown, setShowCountriesDropdown] = useState(false)

    const [formData, setFormData] = useState({
        friendly_name: "",
        country_code: selectedCountryCode || "",
        number_type: "local",
        email: "",
    })

    useEffect(() => {
        if (selectedCountryCode) {
            setFormData((prev) => ({
                ...prev,
                country_code: selectedCountryCode,
            }))
        }
    }, [selectedCountryCode])

    useEffect(() => {
        if (open && typeof window !== "undefined") {
            fetchCountries()
        }
    }, [open])

    const fetchCountries = async () => {
        try {
            const response = await phoneService.getCountries()
            if (response.data.countries) {
                setCountries(response.data.countries)
            }
        } catch (err: any) {
            console.log("Error fetching countries:", err)
            setError("Failed to load countries")
            setShowErrorDialog(true)
        }
    }

    const handleCountrySearch = (search: string) => {
        setCountrySearch(search)
    }

    const filteredCountries = countries.filter(
        (country) =>
            country.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
            country.country_code.toLowerCase().includes(countrySearch.toLowerCase()) ||
            (country.phone_code && country.phone_code.includes(countrySearch))
    )

    const handleSelectCountry = (countryCode: string) => {
        setFormData((prev) => ({
            ...prev,
            country_code: countryCode,
        }))
        setShowCountriesDropdown(false)
        setCountrySearch("")
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!formData.friendly_name || !formData.country_code || !formData.email) {
            setError("Please fill in all required fields")
            setShowErrorDialog(true)
            return
        }

        const bundleData = {
            friendly_name: formData.friendly_name,
            country_code: formData.country_code,
            number_type: formData.number_type,
            email: formData.email,
        }

        localStorage.setItem("bundleData", JSON.stringify(bundleData))
        onNext(bundleData)
    }

    const handleCancel = () => {
        setFormData({
            friendly_name: "",
            country_code: selectedCountryCode || "",
            number_type: "local",
            email: "",
        })
        setCountrySearch("")
        setError("")
        onOpenChange(false)
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-3xl bg-white/90 dark:bg-gray-950/90 animate-scale-in shadow-2xl shadow-indigo-500/20">
                    <LoaderOverlay isLoading={isLoading} />
                    {toast && (
                        <ToastNotification
                            title={toast.title}
                            description={toast.description}
                            variant={toast.variant}
                            onClose={() => setToast(null)}
                        />
                    )}

                    <DialogHeader>
                        <DialogTitle className="text-2xl font-extrabold gradient-text">Create Bundle</DialogTitle>
                        <DialogDescription>Step 1 of 3: Bundle Information</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Friendly Name */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Friendly Name *</label>
                            <Input
                                placeholder="e.g., UK Business Bundle"
                                value={formData.friendly_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, friendly_name: e.target.value }))}
                                className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                            />
                        </div>

                        {/* Country */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Country *</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowCountriesDropdown(!showCountriesDropdown)}
                                    className="cursor-pointer w-full px-4 py-3 border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all text-foreground text-left flex items-center justify-between hover:border-primary focus:border-primary transition-all"
                                >
                                    <span>
                                        {formData.country_code
                                            ? `${formData.country_code} - ${countries.find((c) => c.country_code === formData.country_code)?.country}`
                                            : "Select Country"}
                                    </span>
                                    <ChevronDown className={`w-5 h-5 transition-transform ${showCountriesDropdown ? "rotate-180" : ""}`} />
                                </button>

                                {showCountriesDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 glass bg-white/95 dark:bg-gray-950/95 border-2 border-primary/20 rounded-xl shadow-xl shadow-indigo-500/20 animate-scale-in z-50 max-h-64 overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-border">
                                            <Input
                                                placeholder="Search countries..."
                                                value={countrySearch}
                                                onChange={(e) => handleCountrySearch(e.target.value)}
                                                className="border border-primary/20 rounded-xl bg-white/60 dark:bg-white/5 hover:bg-primary/10"
                                            />
                                        </div>
                                        <div className="overflow-y-auto">
                                            {filteredCountries.map((country) => (
                                                <button
                                                    key={country.country_code}
                                                    type="button"
                                                    onClick={() => handleSelectCountry(country.country_code)}
                                                    className="cursor-pointer w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent text-foreground flex items-center justify-between border-b border-border/50 last:border-b-0"
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        <span className="text-muted-foreground font-normal text-xs">{country.country_code}</span>
                                                        {country.phone_code && (
                                                            <span className="text-muted-foreground font-normal text-xs ml-auto">+{country.phone_code}</span>
                                                        )}
                                                        <span className="ml-2">{country.country}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Number Type */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Number Type *</label>
                            <div className="relative">
                                <select
                                    value={formData.number_type}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, number_type: e.target.value }))}
                                    className="w-full px-4 py-3 border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all text-foreground appearance-none cursor-pointer font-medium"
                                >
                                    <option value="local">Local</option>
                                    <option value="national">National</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="toll-free">Toll-Free</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Email *</label>
                            <Input
                                type="email"
                                placeholder="your@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                                className="border-2 border-border/70 rounded-xl bg-white/70 dark:bg-white/5 transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                            />
                        </div>

                        {/* Buttons */}
                        <DialogFooter className="flex gap-3 pt-6 border-t border-primary/10">
                            <Button
                                type="button"
                                onClick={handleCancel}
                                variant="outline"
                                className="cursor-pointer flex-1 rounded-xl border-2 border-primary/20 bg-white/60 dark:bg-white/5 hover:bg-primary/10 hover:border-primary/40"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="cursor-pointer flex-1 gradient-bg text-white font-semibold rounded-xl border-0 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                            >
                                Next
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
