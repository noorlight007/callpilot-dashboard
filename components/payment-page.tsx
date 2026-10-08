"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { flowService } from "@/services/flow-service"
import { useRouter } from "next/navigation"
import { X, ArrowLeft } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PaymentPageProps {
    planUid?: string
}

export function PaymentPage({ planUid }: PaymentPageProps) {
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
        billingAddress: "",
    })
    const [loading, setLoading] = useState(false)
    const [showResultDialog, setShowResultDialog] = useState(false)
    const [resultMessage, setResultMessage] = useState("")
    const [resultTitle, setResultTitle] = useState("")
    const [isSuccess, setIsSuccess] = useState(false)

    const router = useRouter()

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData((prev) => ({ ...prev, [id]: value }))
    }

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!planUid) {
            console.error("No plan UID provided")
            return
        }

        try {
            setLoading(true)
            await flowService.subscribeToFeature(planUid)

            setResultTitle("Success")
            setResultMessage("Successfully purchased subscription!")
            setIsSuccess(true)
            setShowResultDialog(true)
        } catch (err: any) {
            console.error("Error purchasing subscription:", err)

            setResultTitle("Error")
            setIsSuccess(false)

            const errorData = err.response?.data
            let errorMessage = "Failed to purchase subscription"

            if (Array.isArray(errorData) && errorData.length > 0) {
                errorMessage = errorData[0]
            } else if (typeof errorData === "string") {
                errorMessage = errorData
            } else if (errorData?.error) {
                errorMessage = errorData.error
            } else if (err.message) {
                errorMessage = err.message
            }

            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setLoading(false)
        }
    }

    const handleDialogClose = () => {
        setShowResultDialog(false)
        if (isSuccess) {
            router.push("/dashboard/phone-call-flows")
        }
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 py-12 px-4 shadow-inner">
            <div className="max-w-xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#1e293b] mb-2 gradient-text pb-1">Payment Details</h1>
                    <p className="text-gray-500">Enter your payment information to complete the purchase.</p>
                </div>

                <Card className="p-8 shadow-sm shadow-violet-500/10 border border-gray-100 rounded-2xl bg-white">
                    <form className="space-y-6" onSubmit={handlePurchase}>
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-sm font-semibold text-[#1e293b]">
                                Full Name
                            </Label>
                            <Input
                                id="fullName"
                                placeholder="Enter your full name"
                                className="h-12 border-gray-200 focus:ring-primary rounded-2xl"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-semibold text-[#1e293b]">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                className="h-12 border-gray-200 focus:ring-primary rounded-2xl"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cardNumber" className="text-sm font-semibold text-[#1e293b]">
                                Card Number
                            </Label>
                            <Input
                                id="cardNumber"
                                placeholder="0000 0000 0000 0000"
                                className="h-12 border-gray-200 rounded-2xl"
                                value={formData.cardNumber}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiry" className="text-sm font-semibold text-[#1e293b]">
                                    Expiry
                                </Label>
                                <Input
                                    id="expiry"
                                    placeholder="MM/YY"
                                    className="h-12 border-gray-200 rounded-2xl"
                                    value={formData.expiry}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvv" className="text-sm font-semibold text-[#1e293b]">
                                    CVV
                                </Label>
                                <Input
                                    id="cvv"
                                    placeholder="CVV"
                                    className="h-12 border-gray-200 rounded-2xl"
                                    value={formData.cvv}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="billingAddress" className="text-sm font-semibold text-[#1e293b]">
                                Billing Address
                            </Label>
                            <Input
                                id="billingAddress"
                                placeholder="Enter your billing address"
                                className="h-12 border-gray-200 rounded-2xl"
                                value={formData.billingAddress}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <Button
                                type="submit"
                                className="flex-1 h-12 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-base rounded-2xl transition-all shadow-md"
                                disabled={loading}
                            >
                                {loading ? "Processing..." : "Purchase Now"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-12 border-2 text-gray-600 font-bold text-base rounded-2xl transition-all"
                                onClick={() => router.back()}
                            >
                                Back
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>

            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={resultTitle === "Error" ? "text-destructive" : "text-primary"}>
                            {resultTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base">
                            {resultMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleDialogClose}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
