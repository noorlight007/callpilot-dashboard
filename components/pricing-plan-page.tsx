"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { ArrowLeft, Check, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { flowService } from "@/services/flow-service"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PricingPlanFeature {
    id: number
    uid: string
    created_at: string
    updated_at: string
    name: string
    code: string
    description: string
    type: string
    status: string
}

interface PricingPlan {
    id: number
    feature: PricingPlanFeature
    uid: string
    created_at: string
    updated_at: string
    limit: number
    name: string
    description: string
    price: string
    status: string
    des_list: string[]
    usage_fee_included: boolean
}

interface PricingPlanPageProps {
    featureUid?: string
}

export function PricingPlanPage({ featureUid }: PricingPlanPageProps) {
    const [plans, setPlans] = useState<PricingPlan[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [selectedPlanUid, setSelectedPlanUid] = useState<string | null>(null)

    const [showResultDialog, setShowResultDialog] = useState(false)
    const [resultMessage, setResultMessage] = useState("")
    const [resultTitle, setResultTitle] = useState("")

    const router = useRouter()

    useEffect(() => {
        if (featureUid) {
            fetchPlans()
        }
    }, [featureUid])

    const PLAN_ORDER_MAP: Record<string, number> = {
        starter: 1,
        growth: 2,
        Growth: 2,
        pro: 3,
        professional: 3,
        enterprise: 4,
    }

    const getPlanOrderRank = (name: string = ""): number => {
        const lower = name.toLowerCase().trim()
        for (const [key, rank] of Object.entries(PLAN_ORDER_MAP)) {
            if (lower.includes(key)) return rank
        }
        return 99
    }

    const formatPlanName = (name: any): string => {
        if (!name || typeof name !== "string") return ""
        if (name.toLowerCase().trim() === "growing") return "Growth"
        return name
    }

    const fetchPlans = async () => {
        try {
            setIsLoading(true)
            const response = await flowService.getPricingPlans(featureUid!)
            const results = (response.data.results || []).slice().sort((a: PricingPlan, b: PricingPlan) => {
                return getPlanOrderRank(a.name) - getPlanOrderRank(b.name)
            })
            setPlans(results)
            setIsLoading(false)
        } catch (err: any) {
            console.error("Error fetching plans:", err)

            setResultTitle("Error")
            const errorData = err.response?.data
            let errorMessage = "Failed to load pricing plans"

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
            setIsLoading(false)
        }
    }

    const handleSelectPlan = (planUid: string) => {
        setSelectedPlanUid(planUid)
    }

    const handleProceedToPayment = async (planUid: string) => {
        if (selectedPlanUid !== planUid) setSelectedPlanUid(planUid)
        router.push(`/dashboard/payment/${planUid}`)
    }

    if (featureUid && isLoading) {
        return (
            <div className="min-h-screen bg-[#FFFFFF] p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-12 text-center">
                        <h1 className="text-4xl font-bold text-[#111827] mb-4 gradient-text pb-1">Pricing Plans</h1>
                        <p className="text-[#6B7280] text-lg">Select the plan that fits your needs.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="rounded-2xl p-8 border border-[#E6E9EF] bg-white h-[600px] flex flex-col">
                                <Skeleton className="h-10 w-1/2 mb-4" />
                                <Skeleton className="h-16 w-3/4 mb-8" />
                                <div className="space-y-4 flex-1">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                                <Skeleton className="h-12 w-full mt-8" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto bg-[#FFFFFF] py-16 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-[#111827] mb-4 tracking-tight gradient-text pb-1">Pricing Plans</h1>
                    <p className="text-lg text-[#6B7280]">Select the best plan for your recruitment needs.</p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {plans.map((plan) => {
                        const isSelected = selectedPlanUid === plan.uid

                        return (
                            <div
                                key={plan.uid}
                                onClick={() => handleSelectPlan(plan.uid)}
                                className={cn(
                                    "relative rounded-2xl p-8 flex flex-col transition-all duration-300 cursor-pointer group bg-white",
                                    "border",
                                    isSelected ? "border-[rgba(46,168,255,0.55)]" : "border-[#E6E9EF] hover:border-[rgba(46,168,255,0.55)]",
                                    isSelected ? "bg-gradient-to-b from-[#FFFFFF] to-[#EAF6FF]" : "bg-[#FFFFFF] hover:bg-gradient-to-b hover:from-[#FFFFFF] hover:to-[#EAF6FF]",
                                    isSelected
                                        ? "shadow-[0_0_0_6px_rgba(46,168,255,0.5),0_20px_40px_rgba(46,168,255,0.6),inset_0_0_60px_rgba(46,168,255,0.2)]"
                                        : "shadow-[0_16px_25px_rgba(46,168,255,0.5)] hover:shadow-[0_0_0_6px_rgba(46,168,255,0.5),0_0_40px_rgba(46,168,255,0.6),inset_0_0_60px_rgba(46,168,255,0.2)]",
                                    "h-full"
                                )}
                            >
                                {/* Floor Reflection / Glow Effect */}
                                <div className={cn(
                                    "absolute -bottom-16 inset-x-0 mx-auto w-[120%] -translate-x-[10%] h-24 z-[-1] transition-all duration-500",
                                    "bg-[radial-gradient(ellipse_at_center,_rgba(120,200,255,0.7)_0%,_rgba(46,168,255,0.3)_30%,_rgba(46,168,255,0)_70%)] blur-2xl",
                                    isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                                )} />

                                {/* Blue Top Accent */}
                                <div className={cn(
                                    "absolute top-0 inset-x-0 h-[6px] rounded-t-2xl z-10 transition-all duration-300",
                                    "bg-gradient-to-r from-[#2EA8FF] via-[#80D0FF] to-[#2EA8FF]",
                                    "shadow-[0_2px_15px_rgba(46,168,255,0.5)]",
                                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    <div className="absolute inset-x-0 top-[1px] h-[1px] bg-white/40 blur-[1px]" />
                                </div>

                                {/* Plan Content */}
                                <div className="mb-6 text-center">
                                    <h3 className="text-2xl font-bold text-[#111827] mb-2">{formatPlanName(plan.name)}</h3>
                                </div>

                                {/* Divider */}
                                <div className="w-full h-[1px] bg-[#EEF1F5] mb-6" />

                                {/* Price */}
                                <div className="text-center mb-8">
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className={cn(
                                            "text-5xl font-bold transition-colors duration-300",
                                            isSelected ? "text-[#147BFF]" : "text-[#111827] group-hover:text-[#147BFF]"
                                        )}>
                                            ${parseFloat(plan.price).toFixed(0)}
                                        </span>
                                        <span className="text-[#6B7280] font-medium">/month</span>
                                    </div>
                                    {!plan.usage_fee_included && (
                                        <p className="text-xs text-[#6B7280] mt-2 font-medium">+ Usage fee will have extra cost</p>
                                    )}
                                    <div className="w-full h-[1px] bg-[#EEF1F5] mt-4" />
                                </div>

                                {/* Features */}
                                <div className="space-y-4 flex-1 mb-8">
                                    {(plan.des_list || []).map((feature, idx, arr) => (
                                        <div key={idx}>
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300",
                                                    "bg-[#2EA8FF]"
                                                )} />
                                                <span className="text-[#4B5563] text-sm leading-relaxed">{feature}</span>
                                            </div>
                                            {idx < arr.length - 1 && (
                                                <div className="w-full h-[1px] bg-[#EEF1F5] mt-4" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleProceedToPayment(plan.uid)
                                    }}
                                    className={cn(
                                        "w-full py-6 text-base font-bold shadow-none transition-all duration-200 rounded-xl",
                                        isSelected ? "bg-[#147BFF] text-white hover:bg-[#147BFF]/90" : "bg-[#111827] text-white hover:bg-[#0B1220]",
                                        isSelected && "ring-2 ring-[rgba(46,168,255,0.75)] ring-offset-2"
                                    )}
                                >
                                    {isPurchasing && selectedPlanUid === plan.uid ? "Processing..." : "Get Started"}
                                </Button>
                            </div>
                        )
                    })}

                    {/* Static Enterprise Card */}
                    <div
                        onClick={() => handleSelectPlan("enterprise-plan")}
                        className={cn(
                            "relative rounded-2xl p-8 flex flex-col transition-all duration-300 cursor-pointer group bg-white border",
                            selectedPlanUid === "enterprise-plan" ? "border-[rgba(46,168,255,0.55)]" : "border-[#E6E9EF] hover:border-[rgba(46,168,255,0.55)]",
                            selectedPlanUid === "enterprise-plan" ? "bg-gradient-to-b from-[#FFFFFF] to-[#EAF6FF]" : "bg-[#FFFFFF] hover:bg-gradient-to-b hover:from-[#FFFFFF] hover:to-[#EAF6FF]",
                            selectedPlanUid === "enterprise-plan"
                                ? "shadow-[0_0_0_6px_rgba(46,168,255,0.5),0_20px_40px_rgba(46,168,255,0.6),inset_0_0_60px_rgba(46,168,255,0.2)]"
                                : "shadow-[0_16px_25px_rgba(46,168,255,0.5)] hover:shadow-[0_0_0_6px_rgba(46,168,255,0.5),0_0_40px_rgba(46,168,255,0.6),inset_0_0_60px_rgba(46,168,255,0.2)]",
                            "h-full"
                        )}
                    >
                        {/* Floor Reflection */}
                        <div className={cn(
                            "absolute -bottom-16 inset-x-0 mx-auto w-[120%] -translate-x-[10%] h-24 z-[-1] transition-all duration-500",
                            "bg-[radial-gradient(ellipse_at_center,_rgba(120,200,255,0.7)_0%,_rgba(46,168,255,0.3)_30%,_rgba(46,168,255,0)_70%)] blur-2xl",
                            selectedPlanUid === "enterprise-plan" ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
                        )} />

                        {/* Blue Top Accent */}
                        <div className={cn(
                            "absolute top-0 inset-x-0 h-[6px] rounded-t-2xl z-10 transition-all duration-300",
                            "bg-gradient-to-r from-[#2EA8FF] via-[#80D0FF] to-[#2EA8FF]",
                            "shadow-[0_2px_15px_rgba(46,168,255,0.5)]",
                            selectedPlanUid === "enterprise-plan" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                            <div className="absolute inset-x-0 top-[1px] h-[1px] bg-white/40 blur-[1px]" />
                        </div>

                        {/* Plan Content */}
                        <div className="mb-6 text-center">
                            <h3 className="text-2xl font-bold text-[#111827] mb-2">Enterprise</h3>
                        </div>

                        <div className="w-full h-[1px] bg-[#EEF1F5] mb-6" />

                        {/* Price */}
                        <div className="text-center mb-8">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className={cn(
                                    "text-4xl font-bold transition-colors duration-300",
                                    selectedPlanUid === "enterprise-plan" ? "text-[#147BFF]" : "text-[#111827] group-hover:text-[#147BFF]"
                                )}>
                                    Custom Price
                                </span>
                            </div>
                            <div className="w-full h-[1px] bg-[#EEF1F5] mt-4" />
                        </div>

                        {/* CTA Button */}
                        <Button
                            onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPlanUid("enterprise-plan")
                            }}
                            className={cn(
                                "w-full py-6 text-base font-bold shadow-none transition-all duration-200 mt-auto rounded-xl",
                                selectedPlanUid === "enterprise-plan" ? "bg-[#147BFF] text-white hover:bg-[#147BFF]/90" : "bg-[#111827] text-white hover:bg-[#0B1220]",
                                selectedPlanUid === "enterprise-plan" && "ring-2 ring-[rgba(46,168,255,0.75)] ring-offset-2"
                            )}
                        >
                            Contact Us
                        </Button>
                    </div>
                </div>

                {/* Bottom Back Button */}
                <div className="mt-12 flex justify-center">
                    <Button
                        variant="ghost"
                        className="text-[#4B5563] hover:text-[#111827] hover:bg-[#F7F9FC] font-semibold"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>
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
                        <AlertDialogAction onClick={() => setShowResultDialog(false)}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
