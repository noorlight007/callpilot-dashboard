"use client"

import { EmptyState, ListSkeleton } from '@/components/ui/empty-state'
import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, ArrowLeft, CheckCircle2, XCircle, Trash2, AlertCircle, ChevronDown, Search, CreditCard, ChevronUp, Loader2, Check, ChevronsUpDown, Info, Plus } from "lucide-react"
import { phoneService } from "@/services/phone-service"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import { ToastNotification } from "@/components/auth/toast-notification"
import { useRouter } from "next/navigation"
import { getCountryCode } from "@/app/actions"
import countriesData from "@/lib/countries.json"
import { CreateBundleModal } from "./create-bundle-modal"
import { EndUserModal } from "./end-user-modal"
import { AddressModal } from "./address-modal"
import { FinalSubmissionModal } from "./final-submission-modal"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js'
import { BASE_URL } from "@/lib/baseUrl"
import { cookieUtils } from "@/services/auth-service"
import { toast as sonnerToast } from "sonner"

interface PhoneNumber {
    id: number
    uid: string
    friendly_name: string
    phone_number: string
    country_code: string
    voice_capable: boolean
    sms_capable: boolean
    mms_capable: boolean
    fax_capable: boolean
    status: string
}

interface Country {
    country: string
    country_code: string
    phone_code?: string
}

interface Bundle {
    id: string
    friendly_name: string
}

export function PhoneNumbersContent() {
    // List States
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isReleasing, setIsReleasing] = useState(false)
    const [toast, setToast] = useState<{
        title: string
        description: string
        variant: "default" | "destructive"
    } | null>(null)
    const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false)
    const [selectedNumberForRelease, setSelectedNumberForRelease] = useState<PhoneNumber | null>(null)
    const router = useRouter()

    // Buy Modal State
    const [isBuyModalOpen, setIsBuyModalOpen] = useState(false)
    const [planPrice, setPlanPrice] = useState<string | null>(null)

    // Stripe and Payment States
    const [successMessage, setSuccessMessage] = useState("")
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [stripe, setStripe] = useState<Stripe | null>(null)
    const [elements, setElements] = useState<StripeElements | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const cardNumberRef = useRef<any>(null)
    const cardExpiryRef = useRef<any>(null)
    const cardCvcRef = useRef<any>(null)
    const cardNumberContainerRef = useRef<HTMLDivElement>(null)
    const cardExpiryContainerRef = useRef<HTMLDivElement>(null)
    const cardCvcContainerRef = useRef<HTMLDivElement>(null)
    const countrySelectRef = useRef<HTMLDivElement>(null)
    const pmSelectorRef = useRef<HTMLDivElement>(null)

    const [paymentMethods, setPaymentMethods] = useState<any[]>([])
    const [selectedPmForTopUp, setSelectedPmForTopUp] = useState<any>(null)
    const [isPmSelectorOpen, setIsPmSelectorOpen] = useState(false)
    const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
    const [addPaymentError, setAddPaymentError] = useState<string | null>(null);
    const addPaymentErrorRef = useRef<HTMLDivElement>(null);

    const [cardholderName, setCardholderName] = useState("")
    const [addressLine1, setAddressLine1] = useState("")
    const [addressLine2, setAddressLine2] = useState("")
    const [city, setCity] = useState("")
    const [postalCode, setPostalCode] = useState("")
    const [stateRegion, setStateRegion] = useState("")
    const [isDefault, setIsDefault] = useState(true)
    const [billingCountry, setBillingCountry] = useState("")
    const [isCardComplete, setIsCardComplete] = useState(false)
    const [errorDetail, _setErrorDetail] = useState<string | null>(null)
    const setErrorDetail = (msg: string | null) => {
        if (msg === "You didn't pay the development fee.") {
            router.push('/dashboard/platform-activation')
            return
        }
        _setErrorDetail(msg)
    }

    // Country selection
    const [countries, setCountries] = useState<Country[]>([])
    const [selectedCountry, setSelectedCountry] = useState("")
    const [countrySearch, setCountrySearch] = useState("")
    const [showCountriesDropdown, setShowCountriesDropdown] = useState(false)
    const [modalCountrySearch, setModalCountrySearch] = useState("")
    const [isCountryOpen, setIsCountryOpen] = useState(false)

    // Bundle selection
    const [bundles, setBundles] = useState<Bundle[]>([])
    const [selectedBundle, setSelectedBundle] = useState("")
    const [organization, setOrganization] = useState<any>(null)

    // Modals
    const [showCreateBundleModal, setShowCreateBundleModal] = useState(false)
    const [showEndUserModal, setShowEndUserModal] = useState(false)
    const [showAddressModal, setShowAddressModal] = useState(false)
    const [showFinalModal, setShowFinalModal] = useState(false)
    const [createBundleStep, setCreateBundleStep] = useState(0)

    useEffect(() => {
        fetchPhoneNumbers()
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countrySelectRef.current && !countrySelectRef.current.contains(event.target as Node)) {
                setShowCountriesDropdown(false)
            }
            if (pmSelectorRef.current && !pmSelectorRef.current.contains(event.target as Node)) {
                setIsPmSelectorOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    useEffect(() => {
        const initStripe = async () => {
             const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
            setStripe(stripeInstance)
        }
        initStripe()
        if (typeof window !== "undefined") {
            fetchCountries()
            fetchBundles()
            fetchPaymentMethods()
            fetchPhonePlans()

            const fetchUserCountry = async () => {
                try {
                    const countryCode = await getCountryCode()
                    if (countryCode && !billingCountry) {
                        setBillingCountry(countryCode)
                    }
                } catch (error) {
                    console.error("Error fetching country:", error)
                }
            }

            const fetchOrganization = async () => {
                try {
                    const token = cookieUtils.get("access")
                    const response = await fetch(`${BASE_URL}/organizations/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (response.ok) {
                        const data = await response.json()
                        setOrganization(data)
                        if (data.country_iso_code === "US") {
                            setSelectedCountry("US")
                        }
                    }
                } catch (err) {
                    console.error("Error fetching organization:", err)
                }
            }
            fetchUserCountry()
            fetchOrganization()
        }
    }, [])

    useEffect(() => {
        if (isAddPaymentOpen && stripe && !cardNumberRef.current) {
            const timer = setTimeout(() => {
                if (!cardNumberContainerRef.current) return
                const els = stripe.elements()
                setElements(els)
                const style = {
                    base: { fontSize: '15px', color: '#111827', fontFamily: 'Inter, sans-serif', '::placeholder': { color: '#9ca3af' } }
                }
                const number = els.create('cardNumber', { style })
                const expiry = els.create('cardExpiry', { style })
                const cvc = els.create('cardCvc', { style })

                number.on('change', (event) => setIsCardComplete(event.complete))

                if (cardNumberContainerRef.current) number.mount(cardNumberContainerRef.current)
                if (cardExpiryContainerRef.current) expiry.mount(cardExpiryContainerRef.current)
                if (cardCvcContainerRef.current) cvc.mount(cardCvcContainerRef.current)

                cardNumberRef.current = number
                cardExpiryRef.current = expiry
                cardCvcRef.current = cvc
            }, 100)
            return () => clearTimeout(timer)
        }

        return () => {
            if (cardNumberRef.current) cardNumberRef.current.unmount()
            if (cardExpiryRef.current) cardExpiryRef.current.unmount()
            if (cardCvcRef.current) cardCvcRef.current.unmount()
            cardNumberRef.current = null
            cardExpiryRef.current = null
            cardCvcRef.current = null
        }
    }, [isAddPaymentOpen, stripe])

    const fetchPhoneNumbers = async () => {
        try {
            setIsLoading(true)
            const response = await phoneService.getPurchasedNumbers()
            setPhoneNumbers(response.data.results || [])
        } catch (err: any) {
            console.log("[v0] Error fetching phone numbers:", err)
            const errorMessage = err.response?.data?.error || err.message || "Failed to fetch phone numbers"
            setErrorDetail(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const handleReleaseNumber = async () => {
        if (!selectedNumberForRelease) return
        try {
            setIsReleasing(true)
            await phoneService.releaseNumber(selectedNumberForRelease.uid)
            setToast({ title: "Success", description: `Phone number ${selectedNumberForRelease.phone_number} released successfully.`, variant: "default" })
            fetchPhoneNumbers()
        } catch (err: any) {
            console.log("Error releasing phone number:", err)
            const errorMessage = err.response?.data?.error || "Failed to release phone number"
            setToast({ title: "Error", description: errorMessage, variant: "destructive" })
        } finally {
            setIsReleasing(false)
            setReleaseConfirmOpen(false)
            setSelectedNumberForRelease(null)
        }
    }

    const fetchPaymentMethods = async () => {
        try {
            const token = cookieUtils.get("access")
            const response = await fetch(`${BASE_URL}/payment/payment-methods`, { headers: { 'Authorization': `Bearer ${token}` } })
            if (response.ok) {
                const data_res = await response.json()
                setPaymentMethods(data_res)
                const defaultCard = data_res.find((pm: any) => pm.is_default)
                if (defaultCard) setSelectedPmForTopUp(defaultCard)
            }
        } catch (err) {
            console.error("Error fetching payment methods:", err)
        }
    }

    const fetchPhonePlans = async () => {
        try {
            const response = await phoneService.getPhonePlans()
            const results = response.data.results
            if (results && results.length > 0) {
                const phonePlan = results.find((p: any) => p.name === "phone_number") || results[0]
                if (phonePlan) {
                    setPlanPrice(phonePlan.price)
                }
            }
        } catch (err) {
            console.error("Error fetching phone plans:", err)
        }
    }

    useEffect(() => {
        if (addPaymentError && addPaymentErrorRef.current) {
            addPaymentErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [addPaymentError]);

    const handleAddPaymentMethod = async () => {
        if (!stripe || !elements || !cardNumberRef.current) return
        setAddPaymentError(null)
        if (!isCardComplete) return setAddPaymentError("Please enter your card information")
        if (!cardholderName.trim()) return setAddPaymentError("Please enter the name on card")
        if (!billingCountry) return setAddPaymentError("Please select a country")
        if (!addressLine1.trim()) return setAddPaymentError("Please enter the address line 1")

        setIsSubmitting(true)
        try {
            const { paymentMethod, error } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardNumberRef.current,
                billing_details: {
                    name: cardholderName,
                    address: {
                        line1: addressLine1, line2: addressLine2, city: city, postal_code: postalCode, state: stateRegion, country: billingCountry || undefined
                    }
                }
            })

            if (error) {
                setAddPaymentError(error.message || "Failed to create payment method")
                setIsSubmitting(false)
                return
            }

            const token = cookieUtils.get("access")
            const response = await fetch(`${BASE_URL}/payment/payment-methods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ payment_method_id: paymentMethod.id, set_as_default: isDefault })
            })

            if (response.ok) {
                sonnerToast.success("Payment method added successfully")
                setIsAddPaymentOpen(false)
                fetchPaymentMethods()
            } else {
                const errData = await response.json()
                const errMsg = errData.error?.message || errData.message || errData.details || errData.detail || "Failed to add payment method"
                setAddPaymentError(errMsg)
            }
        } catch (err) {
            console.error(err)
            setAddPaymentError("An unexpected error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    const fetchCountries = async () => {
        try {
            const response = await phoneService.getCountries()
            if (response.data.countries) setCountries(response.data.countries)
        } catch (err: any) {
            console.log("Error fetching countries:", err)
            setErrorDetail("Failed to load countries")
        }
    }

    const fetchBundles = async () => {
        try {
            const response = await phoneService.getBundles()
            setBundles(response.data.results || [])
        } catch (err: any) {
            console.log("Error fetching bundles:", err)
        }
    }

    const handleCountrySelect = (countryCode: string) => {
        setSelectedCountry(countryCode)
        setShowCountriesDropdown(false)
        setCountrySearch("")
    }

    const filteredCountries = countries.filter(c => 
        c.country.toLowerCase().includes(countrySearch.toLowerCase()) || 
        c.country_code.toLowerCase().includes(countrySearch.toLowerCase()) || 
        (c.phone_code && c.phone_code.includes(countrySearch))
    )

    const filteredModalCountries = countriesData.filter(c => 
        c.country.toLowerCase().includes(modalCountrySearch.toLowerCase()) || 
        c.country_code.toLowerCase().includes(modalCountrySearch.toLowerCase())
    )

    const handleCreateBundleNext = () => setCreateBundleStep(1)
    const handleEndUserNext = () => setCreateBundleStep(2)
    const handleAddressNext = () => setShowFinalModal(true)

    const handleFinalSubmitSuccess = (bundleData: any) => {
        setBundles((prev) => [...prev, bundleData])
        setSelectedBundle(bundleData.id)
        setShowCreateBundleModal(false)
        setShowFinalModal(false)
        setCreateBundleStep(0)
        setToast({ title: "Success", description: "Bundle created successfully", variant: "default" })
    }

    const handleSubmitPurchase = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPmForTopUp) return setErrorDetail("Please select a payment method")
        // if (!selectedCountry) return setErrorDetail("Please select a country")

        try {
            setIsLoading(true)
            await phoneService.buyNumber({ payment_method_id: selectedPmForTopUp.id })
            setSuccessMessage("Phone number purchased successfully")
            setShowSuccessDialog(true)
        } catch (err: any) {
            console.log("Error purchasing phone number:", err)
            const errorMessage = err.response?.data?.details || err.response?.data?.error || "Failed to purchase phone number"
            setErrorDetail(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSuccessDialogClose = () => {
        setShowSuccessDialog(false)
        setIsBuyModalOpen(false)
        fetchPhoneNumbers()
    }

    const handleBuyNumber = async () => {
        setIsLoading(true)
        setErrorDetail(null)
        try {
            const orgRes = await phoneService.getOrganizationMe()
            const orgName = orgRes.data.name
            await phoneService.createSubaccount(orgName)
            setIsBuyModalOpen(true)
        } catch (err: any) {
            console.error("Error starting buy flow:", err)
            const errorMsg = err.response?.data?.error || err.message || "Failed to initialize phone number purchase. Please try again."
            setErrorDetail(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950">
            <LoaderOverlay isLoading={isLoading || isReleasing} />

            {toast && (
                <ToastNotification title={toast.title} description={toast.description} variant={toast.variant} onClose={() => setToast(null)} />
            )}

            <CreateBundleModal open={showCreateBundleModal && createBundleStep === 0} onOpenChange={(open) => !open && setShowCreateBundleModal(false)} onNext={handleCreateBundleNext} selectedCountryCode={selectedCountry} />
            <EndUserModal open={showCreateBundleModal && createBundleStep === 1} onOpenChange={(open) => !open && setShowCreateBundleModal(false)} onBack={() => setCreateBundleStep(0)} onNext={handleEndUserNext} />
            <AddressModal open={showCreateBundleModal && createBundleStep === 2} onOpenChange={(open) => !open && setShowCreateBundleModal(false)} onBack={() => setCreateBundleStep(1)} onNext={handleAddressNext} selectedCountryCode={selectedCountry} />
            <FinalSubmissionModal open={showFinalModal} onOpenChange={(open) => !open && setShowFinalModal(false)} onBack={() => { setShowFinalModal(false); setCreateBundleStep(2) }} onSuccess={handleFinalSubmitSuccess} />

            <AlertDialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
                <AlertDialogContent className="rounded-2xl dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <AlertDialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">Release Phone Number</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Are you sure you want to release the phone number <span className="font-bold text-gray-900 dark:text-gray-100">{selectedNumberForRelease?.phone_number}</span>? This action cannot be undone and you will lose access to this number.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                        <AlertDialogCancel disabled={isReleasing} className="rounded-xl font-bold px-6 py-2.5 dark:bg-gray-800 dark:hover:bg-gray-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReleaseNumber} disabled={isReleasing} className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold px-6 py-2.5 transition-colors border-none">{isReleasing ? "Releasing..." : "Release"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isAddPaymentOpen} onOpenChange={(open) => {
                setIsAddPaymentOpen(open)
                if (!open) {
                    setAddPaymentError(null);
                    if (cardNumberRef.current) cardNumberRef.current.unmount()
                    if (cardExpiryRef.current) cardExpiryRef.current.unmount()
                    if (cardCvcRef.current) cardCvcRef.current.unmount()
                    cardNumberRef.current = null; cardExpiryRef.current = null; cardCvcRef.current = null;
                }
            }}>
                <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[480px] p-5 sm:p-8 dark:bg-gray-950 border-gray-100 dark:border-gray-800 rounded-2xl sm:rounded-3xl gap-6 overflow-y-auto max-h-[90vh]">
                    <DialogHeader className="p-0 space-y-2 text-left">
                        <DialogTitle className="text-[22px] font-bold text-gray-900 dark:text-gray-100">Add payment method</DialogTitle>
                        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Add your credit card details below. This card will be saved to your account and can be removed at any time.</p>
                    </DialogHeader>

                    {addPaymentError && (
                        <div
                            ref={addPaymentErrorRef}
                            className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[14px] font-bold text-red-600 dark:text-red-400">Error</h4>
                                <p className="text-[13px] text-red-500 dark:text-red-400/90 font-medium mt-0.5 leading-relaxed">
                                    {addPaymentError}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Card information <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="flex items-center flex-wrap sm:flex-nowrap border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 px-4 py-3 gap-3 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-gray-700 transition-shadow">
                                    <div className="flex-1 min-w-[180px] flex items-center gap-3">
                                        <div className="w-6 h-4 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center shrink-0"><CreditCard size={14} className="text-gray-400" /></div>
                                        <div ref={cardNumberContainerRef} className="flex-1" />
                                    </div>
                                    <div className="flex gap-3 text-[15px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                                        <div ref={cardExpiryContainerRef} className="w-16" />
                                        <div ref={cardCvcContainerRef} className="w-12" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Name on card <span className="text-red-500">*</span></label>
                            <input type="text" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Billing address</label>
                            <div className="space-y-3">
                                <div className="relative">
                                    <div onClick={() => setIsCountryOpen(!isCountryOpen)} className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                                        <span className={billingCountry ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
                                            {billingCountry ? (countriesData.find((c: any) => c.country_code === billingCountry)?.country || billingCountry) : "Country"} <span className="text-red-500">*</span>
                                        </span>
                                        <ChevronsUpDown size={16} className="text-gray-400" />
                                    </div>
                                    {isCountryOpen && (
                                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input autoFocus type="text" placeholder="Search country..." value={modalCountrySearch} onChange={(e) => setModalCountrySearch(e.target.value)} className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-2.5 pl-10 pr-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow" />
                                                </div>
                                            </div>
                                            <div className="max-h-[280px] overflow-y-auto">
                                                {filteredModalCountries.length > 0 ? (
                                                    filteredModalCountries.map((c: any) => (
                                                        <div key={c.country_code} onClick={() => { setBillingCountry(c.country_code); setIsCountryOpen(false); setModalCountrySearch(""); }} className="px-6 py-3 text-[15px] font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors">
                                                            {c.country}
                                                        </div>
                                                    ))
                                                ) : <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm italic">No countries found</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Address line 1 *" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                                <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Address line 2" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                                    <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                                </div>
                                <input type="text" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} placeholder="State, county, province, or region" className="w-full bg-white/70 dark:bg-white/5 backdrop-blur border border-indigo-100 dark:border-white/10 hover:border-indigo-300 rounded-xl transition-all py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <div onClick={() => setIsDefault(!isDefault)} className={`w-[18px] h-[18px] border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${isDefault ? 'border-gray-900 bg-gray-900 dark:border-gray-100 dark:bg-gray-100' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                                {isDefault && <Check size={14} className="text-white dark:text-gray-900" strokeWidth={3} />}
                            </div>
                            <span onClick={() => setIsDefault(!isDefault)} className="text-[15px] font-medium text-gray-900 dark:text-gray-100 cursor-pointer select-none">Set as default payment method</span>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                        <Button onClick={() => setIsAddPaymentOpen(false)} className="w-full sm:w-auto bg-white/70 hover:bg-indigo-50 text-indigo-700 font-bold px-6 py-2.5 rounded-xl border border-indigo-100 shadow-none text-[15px] transition-colors dark:bg-white/5 dark:text-indigo-200 dark:border-white/10 dark:hover:bg-gray-700 h-auto order-2 sm:order-1" disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleAddPaymentMethod} disabled={isSubmitting} className="w-full sm:w-auto gradient-bg text-white px-6 py-2.5 rounded-xl text-[15px] font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all h-auto flex items-center justify-center gap-2 order-1 sm:order-2">
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add payment method
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
                <DialogContent className="sm:max-w-[600px] border-none p-0 overflow-hidden bg-transparent shadow-none">
                    <Card className="border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 group">
                        <CardContent className="pt-8 p-6">
                            {/* {organization?.id === 8 || organization?.country_iso_code === "US" 
                            ? 
                            ( */}
                                <form onSubmit={handleSubmitPurchase} className="space-y-6">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Voice Number Plan</p>
                                            <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 mt-0.5">Recurring Monthly Subscription</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{planPrice ? `$${planPrice}` : "$15.00"}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">per month</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Payment method *</label>
                                        <div className="relative" ref={pmSelectorRef}>
                                            <div onClick={() => setIsPmSelectorOpen(!isPmSelectorOpen)} className="flex items-center justify-between px-4 py-3 border-2 border-gray-100 dark:border-gray-700 rounded-lg bg-background text-foreground text-left cursor-pointer group hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-6 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden">
                                                        {selectedPmForTopUp?.card.brand === 'visa' ? (
                                                            <span className="text-white font-bold italic text-[8px]">VISA</span>
                                                        ) : (
                                                            <div className="flex -space-x-1.5">
                                                                <div className="w-4 h-4 rounded-full bg-red-600 opacity-80" />
                                                                <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-80" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{selectedPmForTopUp ? `•••• ${selectedPmForTopUp.card.last4}` : 'Select card'}</span>
                                                </div>
                                                <div className="flex flex-col -space-y-1 text-gray-400 dark:text-gray-500"><ChevronUp size={16} /><ChevronDown size={16} /></div>
                                            </div>
                                            {isPmSelectorOpen && (
                                                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-background border-2 border-gray-100 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="max-h-[240px] overflow-y-auto p-2">
                                                        {paymentMethods.map((pm) => (
                                                            <div key={pm.id} onClick={() => { setSelectedPmForTopUp(pm); setIsPmSelectorOpen(false); }} className="px-4 py-3.5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-5 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden shrink-0">
                                                                        {pm.card.brand === 'visa' ? <span className="text-white font-bold italic text-[6px]">VISA</span> : <div className="flex -space-x-1"><div className="w-3 h-3 rounded-full bg-red-600 opacity-80" /><div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80" /></div>}
                                                                    </div>
                                                                    <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">•••• {pm.card.last4}</span>
                                                                </div>
                                                                {selectedPmForTopUp?.id === pm.id && <Check size={16} className="text-gray-900 dark:text-gray-100" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-start px-1">
                                            <button type="button" onClick={() => setIsAddPaymentOpen(true)} className="text-[14px] font-bold text-gray-900 dark:text-gray-100 hover:opacity-70 transition-opacity flex items-center gap-2"><span className="text-lg">+</span> Add payment method</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-gray-700">
                                        <Button type="button" variant="outline" className="cursor-pointer border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold px-6 py-2 rounded-xl flex items-center gap-2 transition-all duration-200" onClick={() => setIsBuyModalOpen(false)}>
                                            <ArrowLeft className="w-4 h-4 mr-2" /> Cancel
                                        </Button>
                                        <Button type="submit" disabled={isLoading || !selectedPmForTopUp} className="cursor-pointer bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 text-white dark: font-bold px-6 py-2 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50">
                                            {isLoading ? "Processing..." : "Buy AI Number"}
                                        </Button>
                                    </div>
                                </form>
                            {/* ) : organization && (
                                <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-6">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 max-w-2xl">Your Business address and Identification is being verified right now. Please stay with us, we will let you know once it is verified.</h2>
                                    <div className="space-y-2">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            You can still check <button type="button" onClick={() => router.push("/dashboard/help")} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Help</button> section to find useful information about phone numbers. Also you can send <button type="button" onClick={() => router.push("/dashboard/support")} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Customer Support ticket</button> if you think it's necessary.
                                        </p>
                                    </div>
                                </div>
                            )} */}
                        </CardContent>
                    </Card>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!errorDetail} onOpenChange={() => setErrorDetail(null)}>
                <AlertDialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 rounded-2xl dark:bg-gray-950 border-gray-100 dark:border-gray-800">
                    <AlertDialogHeader>
                        <div className="flex justify-center items-center gap-3 mb-2">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full"><AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                            <AlertDialogTitle className="text-lg font-bold text-red-600 dark:text-red-400">Error</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm text-gray-500 dark:text-gray-400 font-medium pt-2 text-center">{errorDetail}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                        <AlertDialogAction onClick={() => setErrorDetail(null)} className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:shadow-lg hover:shadow-rose-500/30 hover:-translate-y-0.5 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all h-auto border-none">Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-blue-600 dark:text-blue-400">Success</AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-gray-400">{successMessage}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleSuccessDialogClose} className="dark:bg-gray-100 dark:text-gray-900">OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="p-4 md:p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold tracking-tight gradient-text">AI Voice Numbers</h1>
                        <p className="text-muted-foreground mt-2">Manage your purchased AI automated phone numbers</p>
                    </div>
                </div>

                <div className="flex justify-start gap-4">
                    <Button variant="outline" className="border-gray-200 dark:border-gray-700 font-semibold transition-all duration-200 gap-2 px-8" onClick={() => router.back()}>
                        <ArrowLeft size={18} /> Back
                    </Button>
                    <Button variant="default" className="bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 text-white dark: font-semibold transition-all duration-200 gap-2 px-8" onClick={handleBuyNumber} disabled={isLoading}>
                        <Plus size={18} /> Buy AI Number
                    </Button>
                </div>

                {phoneNumbers.length === 0 && !isLoading ? (
                    <EmptyState icon={Phone} title="No phone numbers yet" description="Purchase your first phone number to get started." />
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {phoneNumbers.map((number) => (
                            <Card key={number.id} className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 shadow-sm rounded-2xl overflow-hidden group">
                                <CardHeader className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-4 md:p-6 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/10 transition-colors">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 md:gap-4 flex-1 w-full sm:w-auto">
                                            <div className="p-2.5 md:p-3 bg-black dark:bg-gray-700 rounded-xl shrink-0">
                                                <Phone className="w-5 h-5 md:w-6 md:h-6 text-white dark:text-gray-100" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <CardTitle className="text-lg md:text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 truncate">{number.phone_number}</CardTitle>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${number.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{number.status}</span>
                                                </div>
                                                <CardDescription className="mt-1 flex items-center gap-1.5 md:gap-2 text-xs md:text-sm truncate">
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{number.country_code}</span>
                                                    {number.friendly_name && <span className="text-gray-400 dark:text-gray-600">|</span>}
                                                    <span className="truncate">{number.friendly_name}</span>
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {number.status !== 'RELEASED' && (
                                            <Button onClick={() => { setSelectedNumberForRelease(number); setReleaseConfirmOpen(true); }} variant="destructive" className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 border-none rounded-xl px-4 py-2 md:py-2.5 font-bold text-sm transition-all flex items-center justify-center gap-2">
                                                <Trash2 className="w-4 h-4" /> Release
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-3 md:space-y-4">
                                            <p className="text-[10px] md:text-[11px] font-extrabold text-indigo-400 dark:text-indigo-300 uppercase tracking-[0.2em]">Capabilities</p>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 md:grid-cols-2 gap-y-3 md:gap-y-4 gap-x-2">
                                                {[
                                                    { label: "Voice", capable: number.voice_capable },
                                                    { label: "SMS", capable: number.sms_capable },
                                                    { label: "MMS", capable: number.mms_capable },
                                                    // { label: "Fax", capable: number.fax_capable },
                                                ].map((cap) => (
                                                    <div key={cap.label} className="flex items-center gap-2 md:gap-2.5">
                                                        <div className={`p-1 rounded-full ${cap.capable ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                                            {cap.capable ? <CheckCircle2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-green-600 dark:text-green-400" /> : <XCircle className="w-3 md:w-3.5 h-3 md:h-3.5 text-red-600 dark:text-red-400" />}
                                                        </div>
                                                        <span className={`text-xs md:text-sm font-bold ${cap.capable ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>{cap.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3 md:space-y-4">
                                            <p className="text-[10px] md:text-[11px] font-extrabold text-indigo-400 dark:text-indigo-300 uppercase tracking-[0.2em]">Quick Details</p>
                                            <div className="p-3 md:p-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase">Country</p>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{number.country_code}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
