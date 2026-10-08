'use client';

import { useState, useEffect, useRef } from 'react';
import { CreditCard, History, Settings, BarChart3, Info, ExternalLink, ChevronDown, ChevronUp, Loader2, Search, ChevronsUpDown, Check, Rocket, Zap, Building2, AlertCircle, Clock, Phone, Minus, CheckCircle2, Users, RotateCcw, ShieldAlert } from 'lucide-react';
import { BASE_URL } from "@/lib/baseUrl";
import { cookieUtils } from "@/services/auth-service";
import { profileService } from "@/services/profile-service";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import countriesData from "@/lib/countries.json";
import { toast } from "sonner";
import { paymentService } from "@/services/payment-service";
import { getCountryCode } from "@/app/actions";
import {
    AlertDialog,

    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const STATIC_AI_CALL_PLANS = [
    {
        name: "Starter",
        price: "$400",
        unit: " / month + VAT",
        minutes: "350 AI voice minutes",
        description: "Small businesses starting with AI voice calls.",
        features: [
            "Paid monthly in advance",
            "Dedicated onboarding & customer support",
            "$400 one-off setup fee",
            "Setup fee returned as free minutes after 12 months",
            "Additional minutes: $1.15 per minute"
        ],
        icon: Rocket,
        popular: false
    },
    {
        name: "Growth",
        price: "$1,000",
        unit: " / month + VAT",
        minutes: "900 AI voice minutes",
        description: "Businesses scaling AI voice calls across teams.",
        features: [
            "Paid monthly in advance",
            "Dedicated onboarding & customer support",
            "$400 one-off setup fee",
            "Setup fee returned as free minutes after 12 months",
            "Additional minutes: $1.15 per minute"
        ],
        icon: Zap,
        popular: false
    },
    {
        name: "Pro",
        price: "$1,500",
        unit: " / month + VAT",
        minutes: "1,400 AI voice minutes",
        description: "High-volume automated AI calls.",
        features: [
            "Paid monthly in advance",
            "Priority onboarding & support",
            "$400 one-off setup fee",
            "Setup fee returned as free minutes after 12 months",
            "Additional minutes: $1.15 per minute"
        ],
        icon: Zap,
        popular: true,
        displayName: "Pro"
    },
    {
        name: "Enterprise",
        price: "Custom Pricing",
        unit: "",
        minutes: "Custom AI call minutes",
        description: "Large teams — custom minutes, volume discounts, and integrations scoped to you.",
        features: [
            "Paid monthly in advance",
            "Custom AI minute packages",
            "Priority technical support",
            "Volume discounts available",
            "International calling packages",
            "Custom API integrations"
        ],
        icon: Building2,
        popular: false,
        disabled: false
    }
];

const STATIC_SCREENING_PLANS = [
    {
        name: "Starter",
        price: "$395",
        unit: " / month",
        minutes: "100 screenings • $3.95 each",
        screeningsNote: "100 screenings • $3.95 each",
        topUpNote: "Top-up $4.45 per screening",
        bestFor: "Getting started with AI screening.",
        description: "Getting started with AI screening.",
        features: [
            "100 screenings • $3.95 each",
            "Top-up $4.45 per screening",
            "BEST FOR: Getting started with AI screening."
        ],
        icon: Rocket,
        popular: false
    },
    {
        name: "Growth",
        price: "$1,400",
        unit: " / month",
        minutes: "400 screenings • $3.50 each",
        screeningsNote: "400 screenings • $3.50 each",
        topUpNote: "Top-up $3.90 per screening",
        bestFor: "Active hiring — 4x the volume at a lower rate per screening.",
        description: "Active hiring — 4x the volume at a lower rate per screening.",
        features: [
            "400 screenings • $3.50 each",
            "Top-up $3.90 per screening",
            "BEST FOR: Active hiring — 4x the volume at a lower rate per screening."
        ],
        icon: Zap,
        popular: true
    },
    {
        name: "Pro",
        price: "$2,950",
        unit: " / month",
        minutes: "1,000 screenings • $2.95 each",
        screeningsNote: "1,000 screenings • $2.95 each",
        topUpNote: "Top-up $2.95 per screening",
        bestFor: "High-volume hiring — the lowest cost per screening.",
        description: "High-volume hiring — the lowest cost per screening.",
        features: [
            "1,000 screenings • $2.95 each",
            "Top-up $2.95 per screening",
            "BEST FOR: High-volume hiring — the lowest cost per screening."
        ],
        icon: Zap,
        popular: false
    },
    {
        name: "Enterprise",
        price: "Custom Pricing",
        unit: "",
        minutes: "2,000+ screenings",
        screeningsNote: "2,000+ screenings",
        topUpNote: "High-volume screening with custom terms",
        bestFor: "Large teams — integrations, volume, and terms scoped to you.",
        description: "Large teams — integrations, volume, and terms scoped to you.",
        features: [
            "2,000+ screenings",
            "High-volume screening with custom terms",
            "BEST FOR: Large teams — integrations, volume, and terms scoped to you."
        ],
        icon: Building2,
        popular: false,
        disabled: false
    }
];

const STATIC_PRICING_PLANS = STATIC_AI_CALL_PLANS;

export function DashboardContent() {
    const router = useRouter();
    const [orgData, setOrgData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Billing related states
    const [isTopUpOpen, setIsTopUpOpen] = useState(false)
    const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)
    const [addPaymentError, setAddPaymentError] = useState<string | null>(null);
    const addPaymentErrorRef = useRef<HTMLDivElement>(null);
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [elements, setElements] = useState<StripeElements | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSetupDropdownOpen, setIsSetupDropdownOpen] = useState(false);
    const cardNumberRef = useRef<any>(null);
    const cardExpiryRef = useRef<any>(null);
    const cardCvcRef = useRef<any>(null);
    const cardNumberContainerRef = useRef<HTMLDivElement>(null);
    const cardExpiryContainerRef = useRef<HTMLDivElement>(null);
    const cardCvcContainerRef = useRef<HTMLDivElement>(null);
    const paymentSectionRef = useRef<HTMLDivElement>(null);

    const [countries, setCountries] = useState<{ country: string, country_code: string }[]>(countriesData);
    const [selectedCountry, setSelectedCountry] = useState<{ country: string, country_code: string } | null>(null);
    const [countrySearch, setCountrySearch] = useState("");
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Form state
    const [cardholderName, setCardholderName] = useState("");
    const [addressLine1, setAddressLine1] = useState("");
    const [addressLine2, setAddressLine2] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [stateRegion, setStateRegion] = useState("");
    const [isDefault, setIsDefault] = useState(true);

    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [topUpType, setTopUpType] = useState<string>("");
    const [topUpAmount, setTopUpAmount] = useState("");
    const [topUpMinutes, setTopUpMinutes] = useState("");
    const [selectedPmForTopUp, setSelectedPmForTopUp] = useState<any>(null);
    const [isTopUpSubmitting, setIsTopUpSubmitting] = useState(false);
    const [isPmSelectorOpen, setIsPmSelectorOpen] = useState(false);
    const [errorDetail, _setErrorDetail] = useState<string | null>(null);
    const [isCardComplete, setIsCardComplete] = useState(false);
    const setErrorDetail = (msg: string | null) => {
        if (msg === "You didn't pay the development fee.") {
            router.push('/dashboard/platform-activation');
            return;
        }
        _setErrorDetail(msg);
    };
    const [successDetail, setSuccessDetail] = useState<string | null>(null);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [hoveredTier, setHoveredTier] = useState<string | null>(null);
    const [isSubscriptionSubmitting, setIsSubscriptionSubmitting] = useState(false);
    const [selectedPmForSubscription, setSelectedPmForSubscription] = useState<any>(null);
    const [isPmSelectorForSubOpen, setIsPmSelectorForSubOpen] = useState(false);
    const [isCancelPlanModalOpen, setIsCancelPlanModalOpen] = useState(false);
    const [isCancellingPlan, setIsCancellingPlan] = useState(false);
    const [isUpdateSubscriptionModalOpen, setIsUpdateSubscriptionModalOpen] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState<any>(null);
    const screeningRate = Number(currentSubscription?.topup_rate) || 0;
    const [isFetchingSubscription, setIsFetchingSubscription] = useState(false);
    const [isUpdateSubmitting, setIsUpdateSubmitting] = useState(false);
    const [fetchedPlans, setFetchedPlans] = useState<any[]>([]);
    const [isFetchingPlans, setIsFetchingPlans] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedPmForDelete, setSelectedPmForDelete] = useState<any>(null);
    const [isContactSalesSubmitting, setIsContactSalesSubmitting] = useState(false);
    const [modalPlanType, setModalPlanType] = useState<"screening" | "calls">("screening");
    const enterpriseSectionRef = useRef<HTMLDivElement>(null);
    const enterpriseSectionUpdateRef = useRef<HTMLDivElement>(null);

    const [verificationBlockedStep, setVerificationBlockedStep] = useState<'verification_pending' | 'platform_activation_required' | 'phone_number_required' | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isCheckingVerification, setIsCheckingVerification] = useState(false);

    // Product Entitlement Flags based on current_plan_type
    const aiApplicantCallsActive = Boolean(
        orgData?.current_plan_type && String(orgData.current_plan_type).toUpperCase() === "SCREENING_CALL"
    );
    const aiCallsActive = Boolean(
        orgData?.current_plan_type && String(orgData.current_plan_type).toUpperCase() === "AI_CALL"
    );

    // AI Applicant Screening Call Analytics States
    const [myFlows, setMyFlows] = useState<any[]>([]);
    const [screeningAnalytics, setScreeningAnalytics] = useState<any>(null);
    const [isScreeningLoading, setIsScreeningLoading] = useState(false);
    const [screeningPeriod, setScreeningPeriod] = useState<string>("all");
    const [screeningStartDate, setScreeningStartDate] = useState<string>("");
    const [screeningEndDate, setScreeningEndDate] = useState<string>("");

    const setupSteps = [
        { label: 'Account Created', key: 'account_created', path: '' },
        { label: 'Add Business Details', key: 'is_given_company_details', path: '/dashboard/organization' },
        { label: 'Pay Setup Fee (refunded after 12 months with minutes)', key: 'is_platform_activated', path: '/dashboard/platform-activation' },
        { label: 'Buy AI Number', key: 'have_any_phone_number', path: '/dashboard/phone-numbers' },
        { label: 'Choose Plan', key: 'is_purchased_anything', path: '/dashboard/billing' },
        { label: 'Connect Your ATS', key: 'is_ats_connected', path: '/dashboard/connect-ats' },
        { label: 'AI Call Builder', key: 'is_any_flow_connected', path: '/dashboard/phone-call-flows' }
    ];

    const checkStepCompleted = (key: string) => {
        if (key === 'account_created') return true;
        if (key === 'is_given_company_details') {
            return orgData?.compliance_status === 'pending' || orgData?.compliance_status === 'approved';
        }
        return orgData?.[key] === true;
    };

    const isStepDisabled = (idx: number) => {
        if (idx === 0) return false;
        return !checkStepCompleted(setupSteps[idx - 1].key);
    };

    const completedCount = setupSteps.filter(step => checkStepCompleted(step.key)).length;
    const isAllCompleted = completedCount === setupSteps.length;

    const handleUpgradePlanClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCheckingVerification(true);
        try {
            const statusRes = await profileService.getPlatformStatus();
            const complianceStatus = statusRes.data.compliance_status;
            if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                router.push("/activation");
                return;
            }
            if (complianceStatus === "pending") {
                setVerificationBlockedStep('verification_pending');
                setIsVerificationModalOpen(true);
            } else if (statusRes.data.is_platform_activated !== true) {
                setVerificationBlockedStep('platform_activation_required');
                setIsVerificationModalOpen(true);
            } else if (statusRes.data.have_any_phone_number !== true) {
                setVerificationBlockedStep('phone_number_required');
                setIsVerificationModalOpen(true);
            } else {
                setVerificationBlockedStep(null);
                setModalPlanType("screening");
                if (orgData?.current_plan) {
                    fetchCurrentSubscription();
                    setIsUpdateSubscriptionModalOpen(true);
                } else {
                    setSelectedPlan(null);
                    setIsSubscriptionModalOpen(true);
                }
            }
        } catch (error) {
            console.error("Error checking platform status:", error);
            toast.error("Failed to check platform status. Please try again.");
        } finally {
            setIsCheckingVerification(false);
        }
    };

    const fetchOrgData = async () => {
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/organizations/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setOrgData(data);
            }
        } catch (err) {
            console.error("Error fetching organization data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPaymentMethods = async () => {
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/payment/payment-methods`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data_res = await response.json();
                setPaymentMethods(data_res);
                // Set default card for top-up
                const defaultCard = data_res.find((pm: any) => pm.is_default);
                if (defaultCard) {
                    setSelectedPmForTopUp(defaultCard);
                    setSelectedPmForSubscription(defaultCard);
                }
            }
        } catch (err) {
            console.error("Error fetching payment methods:", err);
        }
    };

    const fetchPlans = async (type?: string) => {
        const planType = type || (modalPlanType === "screening" ? "SCREENING_CALL" : "AI_CALL");
        setIsFetchingPlans(true);
        try {
            const response = await fetch(`${BASE_URL}/payment/subscriptions/plans?type=${planType}`);
            if (response.ok) {
                const data = await response.json();
                setFetchedPlans(data.results || []);
            }
        } catch (err) {
            console.error("Error fetching plans:", err);
        } finally {
            setIsFetchingPlans(false);
        }
    };

    const hasScreeningFlow = myFlows.some((item: any) =>
        item.flow?.code !== "AICALL191" &&
        (item.flow?.name?.toLowerCase().includes("screening") || item.flow?.name?.toLowerCase().includes("applicant") || item.flow?.name === "AI Application Screening call")
    );

    const fetchMyFlows = async () => {
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/flows/available-flow/my_flows`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                const flows = data.results || [];
                setMyFlows(flows);

                const hasScreening = flows.some((item: any) =>
                    item.flow?.code !== "AICALL191" &&
                    (item.flow?.name?.toLowerCase().includes("screening") || item.flow?.name?.toLowerCase().includes("applicant") || item.flow?.name === "AI Application Screening call")
                );
                if (hasScreening) {
                    fetchScreeningAnalytics();
                }
            }
        } catch (err) {
            console.error("Error fetching my flows:", err);
        }
    };

    const fetchScreeningAnalytics = async (period = screeningPeriod, startDate = screeningStartDate, endDate = screeningEndDate) => {
        try {
            setIsScreeningLoading(true);
            const token = cookieUtils.get("access");
            const params = new URLSearchParams();
            if (period) {
                params.append("period", period);
            }
            if (period === "custom") {
                if (startDate) params.append("start_date", startDate);
                if (endDate) params.append("end_date", endDate);
            }
            const queryString = params.toString();
            const url = `${BASE_URL}/interview/analytics${queryString ? `?${queryString}` : ''}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setScreeningAnalytics(data);
            }
        } catch (err) {
            console.error("Error fetching screening analytics:", err);
        } finally {
            setIsScreeningLoading(false);
        }
    };

    const handleResetScreeningFilter = () => {
        setScreeningPeriod("all");
        setScreeningStartDate("");
        setScreeningEndDate("");
        fetchScreeningAnalytics("all", "", "");
    };

    const fetchCurrentSubscription = async () => {
        setIsFetchingSubscription(true);
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/payment/subscriptions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setCurrentSubscription(data);
            }
        } catch (err) {
            console.error("Error fetching current subscription:", err);
        } finally {
            setIsFetchingSubscription(false);
        }
    };

    useEffect(() => {
        const initStripe = async () => {
            const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
            setStripe(stripeInstance);
        };
        initStripe();
        fetchOrgData();
        fetchPaymentMethods();
        fetchCurrentSubscription();
        fetchPlans();
        fetchMyFlows();

        // Fetch user's country automatically
        const fetchUserCountry = async () => {
            try {
                const countryCode = await getCountryCode();
                if (countryCode) {
                    const country = countriesData.find(c => c.country_code === countryCode);
                    if (country && !selectedCountry) {
                        setSelectedCountry(country);
                    }
                }
            } catch (error) {
                console.error("Error fetching country:", error);
            }
        };
        fetchUserCountry();
    }, []);

    useEffect(() => {
        const type = modalPlanType === "screening" ? "SCREENING_CALL" : "AI_CALL";
        fetchPlans(type);
    }, [modalPlanType]);

    // Sync selected plan with current subscription status
    useEffect(() => {
        const currentPlanId = currentSubscription?.plan ?? orgData?.current_plan;
        if (currentPlanId !== undefined && currentPlanId !== null && fetchedPlans.length > 0) {
            const matchedPlan = fetchedPlans.find(p =>
                String(p.id) === String(currentPlanId) ||
                p.name.toLowerCase() === String(currentPlanId).toLowerCase()
            );
            if (matchedPlan) {
                setSelectedPlan(matchedPlan.name);
            }
        }
    }, [currentSubscription, orgData, fetchedPlans]);

    useEffect(() => {
        if (selectedPlan) {
            if (selectedPlan === 'Enterprise') {
                if (isSubscriptionModalOpen && enterpriseSectionRef.current) {
                    enterpriseSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else if (isUpdateSubscriptionModalOpen && enterpriseSectionUpdateRef.current) {
                    enterpriseSectionUpdateRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                // For other plans, scroll to the payment/action section
                if (paymentSectionRef.current) {
                    paymentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    }, [selectedPlan, isSubscriptionModalOpen, isUpdateSubscriptionModalOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsCountryOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isAddPaymentOpen && stripe && !cardNumberRef.current) {
            const timer = setTimeout(() => {
                if (!cardNumberContainerRef.current) return;

                const els = stripe.elements();
                setElements(els);

                const style = {
                    base: {
                        fontSize: '15px',
                        color: '#111827',
                        fontFamily: 'Inter, sans-serif',
                        '::placeholder': {
                            color: '#9ca3af',
                        },
                    },
                };

                const number = els.create('cardNumber', { style });
                const expiry = els.create('cardExpiry', { style });
                const cvc = els.create('cardCvc', { style });

                number.on('change', (event) => {
                    setIsCardComplete(event.complete);
                });

                if (cardNumberContainerRef.current) number.mount(cardNumberContainerRef.current);
                if (cardExpiryContainerRef.current) expiry.mount(cardExpiryContainerRef.current);
                if (cardCvcContainerRef.current) cvc.mount(cardCvcContainerRef.current);

                cardNumberRef.current = number;
                cardExpiryRef.current = expiry;
                cardCvcRef.current = cvc;
            }, 100);
            return () => clearTimeout(timer);
        }

        return () => {
            if (cardNumberRef.current) cardNumberRef.current.unmount();
            if (cardExpiryRef.current) cardExpiryRef.current.unmount();
            if (cardCvcRef.current) cardCvcRef.current.unmount();
            cardNumberRef.current = null;
            cardExpiryRef.current = null;
            cardCvcRef.current = null;
        };
    }, [isAddPaymentOpen, stripe]);

    useEffect(() => {
        if (paymentMethods.length > 0 && !selectedPmForTopUp) {
            const defaultCard = paymentMethods.find((pm: any) => pm.is_default);
            if (defaultCard) setSelectedPmForTopUp(defaultCard);
        }
    }, [paymentMethods, selectedPmForTopUp]);

    const handleTopUp = async () => {
        if (!selectedPmForTopUp || !topUpAmount || !topUpMinutes || !topUpType) {
            toast.error("Please select a top-up type, quantity, and payment method");
            return;
        }

        if (topUpType === "screening_credit" && !aiApplicantCallsActive) {
            toast.error("Screening credit top-up is not allowed because AI Applicant Calls is not active on your account.");
            return;
        }

        if (topUpType === "ai_call_minutes" && !aiCallsActive) {
            toast.error("AI Call Minutes top-up is not allowed because AI Calls is not active on your account.");
            return;
        }

        if (topUpType === "screening_credit" && !(screeningRate > 0)) {
            toast.error("Top-up rate is not available for your current subscription.");
            return;
        }

        setIsTopUpSubmitting(true);
        try {
            const token = cookieUtils.get("access");
            const payload: any = {
                quantity: parseInt(topUpMinutes),
                payment_method_id: selectedPmForTopUp.id,
                topup_type: topUpType
            };

            const response = await fetch(`${BASE_URL}/payment/wallet/topup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success("Wallet topped up successfully");
                setIsTopUpOpen(false);
                setTopUpType("");
                setTopUpMinutes("");
                setTopUpAmount("");
                fetchOrgData();
            } else {
                const errData = await response.json();
                setErrorDetail(errData.details || errData.detail || "Failed to top up wallet");
            }
        } catch (err) {
            console.error("Top-up error:", err);
            setErrorDetail("An error occurred during top-up");
        } finally {
            setIsTopUpSubmitting(false);
        }
    };

    useEffect(() => {
        if (addPaymentError && addPaymentErrorRef.current) {
            addPaymentErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [addPaymentError]);

    const handleAddPaymentMethod = async () => {
        if (!stripe || !elements || !cardNumberRef.current) return;
        setAddPaymentError(null);

        if (!isCardComplete) {
            setAddPaymentError("Please enter your card information");
            return;
        }

        if (!cardholderName.trim()) {
            setAddPaymentError("Please enter the name on card");
            return;
        }
        if (!selectedCountry) {
            setAddPaymentError("Please select a country");
            return;
        }
        if (!addressLine1.trim()) {
            setAddPaymentError("Please enter the address line 1");
            return;
        }

        setIsSubmitting(true);
        try {
            const { paymentMethod, error } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardNumberRef.current,
                billing_details: {
                    name: cardholderName,
                    address: {
                        line1: addressLine1,
                        line2: addressLine2,
                        city: city,
                        postal_code: postalCode,
                        state: stateRegion,
                        country: selectedCountry?.country_code
                    }
                }
            });

            if (error) {
                setAddPaymentError(error.message || "Failed to create payment method");
                setIsSubmitting(false);
                return;
            }

            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/payment/payment-methods`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    payment_method_id: paymentMethod.id,
                    set_as_default: isDefault
                })
            });

            if (response.ok) {
                toast.success("Payment method added successfully");
                setIsAddPaymentOpen(false)
                fetchPaymentMethods();
            } else {
                const errData = await response.json();
                const errMsg = errData.error?.message || errData.message || errData.details || errData.detail || "Failed to add payment method";
                setAddPaymentError(errMsg);
            }
        } catch (err) {
            console.error(err);
            setAddPaymentError("An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    // const handleCreateSubscription = async () => {
    //     if (!selectedPlan || !selectedPmForSubscription) {
    //         toast.error("Please select a plan and a payment method");
    //         return;
    //     }

    //     setIsSubscriptionSubmitting(true);
    //     setErrorDetail(null);
    //     try {
    //         const token = cookieUtils.get("access");
    //         const response = await fetch(`${BASE_URL}/payment/subscriptions`, {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': `Bearer ${token}`
    //             },
    //             body: JSON.stringify({
    //                 plan: selectedPlan,
    //                 payment_method_id: selectedPmForSubscription.id
    //             })
    //         });

    //         if (response.ok) {
    //             toast.success("Subscription plan created successfully");
    //             setIsSubscriptionModalOpen(false);
    //             fetchOrgData();
    //             fetchCurrentSubscription();
    //         } else {
    //             const errData = await response.json();
    //             if (errData.plan && Array.isArray(errData.plan)) {
    //                 setErrorDetail(errData.plan[0]);
    //             } else if (errData.detail) {
    //                 setErrorDetail(errData.detail);
    //             } else {
    //                 setErrorDetail("Failed to create subscription plan");
    //             }
    //         }
    //     } catch (err) {
    //         console.error("Subscription error:", err);
    //         setErrorDetail("An error occurred during subscription creation");
    //     } finally {
    //         setIsSubscriptionSubmitting(false);
    //     }
    // };

    // const handleCancelPlan = async () => {
    //     setIsCancellingPlan(true);
    //     try {
    //         const token = cookieUtils.get("access");
    //         const response = await fetch(`${BASE_URL}/payment/subscriptions/cancel`, {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`
    //             }
    //         });

    //         if (response.ok) {
    //             toast.success("Subscription plan cancelled successfully");
    //             setIsCancelPlanModalOpen(false);
    //             fetchOrgData();
    //         } else {
    //             const errData = await response.json();
    //             setErrorDetail(errData.detail || "Failed to cancel subscription plan");
    //         }
    //     } catch (err) {
    //         console.error("Cancellation error:", err);
    //         setErrorDetail("An error occurred during subscription cancellation");
    //     } finally {
    //         setIsCancellingPlan(false);
    //     }
    // };

    // const handleUpdateSubscription = async () => {
    //     if (!selectedPlan || !selectedPmForSubscription) {
    //         toast.error("Please select a plan and a payment method");
    //         return;
    //     }

    //     if (selectedPlan.toLowerCase() === (currentSubscription?.plan ? String(currentSubscription.plan).toLowerCase() : "") ||
    //         selectedPlan.toLowerCase() === (orgData?.current_plan ? String(orgData.current_plan).toLowerCase() : "")) {
    //         setErrorDetail("You are already on this plan. Please select a different plan to update.");
    //         return;
    //     }

    //     setIsUpdateSubmitting(true);
    //     setErrorDetail(null);
    //     try {
    //         const token = cookieUtils.get("access");
    //         const response = await fetch(`${BASE_URL}/payment/subscriptions`, {
    //             method: 'POST',
    //             headers: {
    //                 'Authorization': `Bearer ${token}`,
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 plan: selectedPlan,
    //                 payment_method_id: selectedPmForSubscription.id
    //             })
    //         });

    //         if (response.ok) {
    //             toast.success("Subscription plan updated successfully");
    //             setIsUpdateSubscriptionModalOpen(false);
    //             fetchOrgData();
    //             fetchCurrentSubscription();
    //         } else {
    //             const errData = await response.json();
    //             if (errData.plan && Array.isArray(errData.plan)) {
    //                 setErrorDetail(errData.plan[0]);
    //             } else if (errData.detail) {
    //                 setErrorDetail(errData.detail);
    //             } else {
    //                 setErrorDetail("Failed to update subscription plan");
    //             }
    //         }
    //     } catch (err) {
    //         console.error("Update error:", err);
    //         setErrorDetail("An error occurred during subscription update");
    //     } finally {
    //         setIsUpdateSubmitting(false);
    //     }
    // };

    const handleDeletePaymentMethod = async () => {
        if (!selectedPmForDelete) return;
        setIsDeleting(true);
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/payment/payment-methods/${selectedPmForDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                toast.success("Payment method deleted successfully");
                setIsDeleteOpen(false);
                fetchPaymentMethods();
                if (selectedPmForTopUp?.id === selectedPmForDelete.id) {
                    setSelectedPmForTopUp(null);
                }
            } else {
                toast.error("Failed to delete payment method");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while deleting payment method");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredCountries = countries.filter(c =>
        c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.country_code.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const formatPlanName = (name: any): string => {
        if (!name || typeof name !== "string") return "";
        if (name.toLowerCase().trim() === "growing") return "Growth";
        return name;
    };

    const cards = [
        {
            key: 'current_plan',
            title: 'Current Plan',
            value: formatPlanName(orgData?.current_plan) || 'No Active Plan',
            icon: Rocket,
            iconColor: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
            key: 'screening_calls',
            title: 'Screening Call Credits',
            value: aiApplicantCallsActive
                ? (orgData?.screening_call_credit !== undefined && orgData?.screening_call_credit !== null
                    ? `${orgData.screening_call_credit} Credits`
                    : '0 Credits')
                : 'Not Active',
            icon: Users,
            iconColor: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
        },
        {
            key: 'ai_calls',
            title: 'AI Calls',
            value: aiCallsActive
                ? (orgData?.wallet_minutes !== undefined && orgData?.wallet_minutes !== null
                    ? `${orgData.wallet_minutes} Minutes`
                    : '0 Minutes')
                : 'Not Active',
            icon: Zap,
            iconColor: 'text-purple-600 dark:text-purple-400',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        },
    ];
    const getTimeAgo = (dateString: string) => {
        if (!dateString) return "";
        const now = new Date();
        const past = new Date(dateString);
        const diffInMs = now.getTime() - past.getTime();
        const diffInSecs = Math.floor(diffInMs / 1000);
        const diffInMins = Math.floor(diffInSecs / 60);
        const diffInHours = Math.floor(diffInMins / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInSecs < 60) return `${diffInSecs} seconds ago`;
        if (diffInMins < 60) return `${diffInMins} minutes ago`;
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        return `${diffInDays} days ago`;
    };

    const cardss = [
        {
            title: orgData?.last_system_checked ? `Last System check: ${getTimeAgo(orgData.last_system_checked)}` : 'Last System check',
            value: 'AI Call Status',
            icon: (props: any) => <div className={`h-5 w-5 rounded-full ${orgData?.is_call_active ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />,
            iconColor: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
            title: 'System Health',
            value: (
                <div className="flex gap-6 mt-2">
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${orgData?.is_voice_api_working ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Voice API</span>
                    </div>
                    {/* <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${orgData?.is_any_flow_connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Call Trigger</span>
                    </div> */}
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${orgData?.is_queue_working ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Queue</span>
                    </div>
                </div>
            ) as any,
            icon: (props: any) => <div className={`h-5 w-5 rounded-full ${orgData?.is_voice_api_working && orgData?.is_queue_working ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />,
            iconColor: 'text-purple-600 dark:text-purple-400',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        },
    ];

    const enterpriseTier = modalPlanType === "screening" ? {
        id: 'enterprise',
        name: "Enterprise",
        price: "Custom Pricing",
        unit: "",
        minimumMinutes: "2,000+ screenings",
        screeningsNote: "2,000+ screenings",
        topUpNote: "High-volume screening with custom terms",
        bestFor: "Large teams — integrations, volume, and terms scoped to you.",
        description: "Large teams — integrations, volume, and terms scoped to you.",
        features: [
            "2,000+ screenings",
            "High-volume screening with custom terms",
            "BEST FOR: Large teams — integrations, volume, and terms scoped to you."
        ],
        icon: Building2,
        popular: false,
        disabled: false,
        cta: "Contact Sales"
    } : {
        id: 'enterprise',
        name: "Enterprise",
        price: "Custom Pricing",
        unit: "",
        minimumMinutes: "Custom AI call minutes",
        description: "Large teams — custom minutes, volume discounts, and integrations scoped to you.",
        audience: "Large teams — custom minutes, volume discounts, and integrations scoped to you.",
        features: [
            "Paid monthly in advance",
            "Custom AI minute packages",
            "Priority technical support",
            "Volume discounts available",
            "International calling packages",
            "Custom API integrations"
        ],
        icon: Building2,
        popular: false,
        disabled: false,
        cta: "Contact Sales"
    };

    const dynamicPricingTiers = fetchedPlans.map((plan: any) => {
        const rawName = plan.name || "";
        const formattedName = formatPlanName(rawName);
        const key = rawName.toLowerCase();
        const numPrice = parseFloat(plan.price);
        const limit = Number(plan.limit) || 0;

        if (modalPlanType === "screening") {
            const rawPrice = !isNaN(numPrice) ? numPrice : 0;
            const perRate = limit > 0 ? (rawPrice / limit).toFixed(2) : "1.99";

            const apiTopUp = Number(plan.topup_rate ?? plan.top_up_rate)
            let topUpNote = "Top-up $4.45 per screening";
            let bestFor = "Getting started with AI screening.";

            if (key.includes("grow")) {
                topUpNote = "Top-up $3.90 per screening";
                bestFor = "Active hiring — 4x the volume at a lower rate per screening.";
            } else if (key.includes("pro")) {
                topUpNote = "Top-up $2.95 per screening";
                bestFor = "High-volume hiring — the lowest cost per screening.";
            }

            if (apiTopUp > 0) topUpNote = `Top-up $${apiTopUp.toFixed(2)} per screening`;

            const screeningsNote = limit > 0 ? `${limit.toLocaleString()} screenings • $${perRate} each` : `${limit.toLocaleString()} screenings`;
            const formattedPrice = !isNaN(numPrice) ? `$${numPrice.toLocaleString()}` : (plan.price ? `$${plan.price}` : "$0");

            return {
                id: plan.id,
                name: plan.name,
                displayName: formattedName,
                price: formattedPrice,
                unit: " / month",
                minimumMinutes: screeningsNote,
                screeningsNote: screeningsNote,
                topUpNote: topUpNote,
                bestFor: bestFor,
                description: bestFor,
                features: [
                    topUpNote,
                    `BEST FOR: ${bestFor}`
                ],
                icon: key.includes("starter") ? Rocket : (key.includes("enterp") ? Building2 : Zap),
                popular: key.includes("grow"),
                disabled: false,
                cta: `Select ${formattedName}`,
                rawPlan: plan
            };
        } else {
            const isPro = key.includes("pro");
            const defaultFeatures = [
                "Paid monthly in advance",
                isPro ? "Priority onboarding & support" : "Dedicated onboarding & customer support",
                "$400 one-off setup fee",
                "Setup fee returned as free minutes after 12 months",
                "Additional minutes: $1.15 per minute"
            ];

            let audience = "Small businesses starting with AI voice calls.";
            if (key.includes("grow")) {
                audience = "Businesses scaling AI voice calls across teams.";
            } else if (isPro) {
                audience = "High-volume automated AI calls.";
            }

            const formattedPrice = !isNaN(numPrice) ? `$${numPrice.toLocaleString()}` : (plan.price ? `$${plan.price}` : "$0");
            const minutesText = limit > 0 ? `${limit.toLocaleString()} AI voice minutes` : "AI voice minutes";

            return {
                id: plan.id,
                name: plan.name,
                displayName: isPro ? "Pro" : formattedName,
                price: formattedPrice,
                unit: " / month + VAT",
                minimumMinutes: minutesText,
                description: audience,
                audience: audience,
                features: (plan.des_list && plan.des_list.length > 0) ? plan.des_list : defaultFeatures,
                icon: key.includes("starter") ? Rocket : (key.includes("enterp") ? Building2 : Zap),
                popular: isPro,
                disabled: false,
                cta: `Select ${formattedName}`,
                rawPlan: plan
            };
        }
    });

    const PLAN_ORDER_MAP: Record<string, number> = {
        starter: 1,
        growth: 2,
        growing: 2,
        pro: 3,
        professional: 3,
        enterprise: 4,
    };

    const getPlanOrderRank = (name: string = ""): number => {
        const lower = name.toLowerCase().trim();
        for (const [key, rank] of Object.entries(PLAN_ORDER_MAP)) {
            if (lower.includes(key.toLowerCase())) return rank;
        }
        return 99;
    };

    const staticFallbackList = modalPlanType === "screening" ? STATIC_SCREENING_PLANS : STATIC_AI_CALL_PLANS;
    const fallbackPricingTiers = staticFallbackList.filter(p => p.name !== "Enterprise").map(plan => ({
        ...plan,
        cta: `Select ${plan.name}`,
    }));

    const nonEnterpriseDynamicTiers = dynamicPricingTiers.filter(
        (p: any) => !p.name.toLowerCase().includes("enterprise")
    );

    const pricingTiers = [
        ...(nonEnterpriseDynamicTiers.length > 0 ? nonEnterpriseDynamicTiers : fallbackPricingTiers),
        enterpriseTier
    ].sort((a, b) => getPlanOrderRank(a.name) - getPlanOrderRank(b.name));

    const handleCreateSubscription = async () => {
        if (!selectedPlan || !selectedPmForSubscription) {
            toast.error("Please select a plan and a payment method");
            return;
        }

        setIsSubscriptionSubmitting(true);
        setErrorDetail(null);
        try {
            const token = cookieUtils.get("access");
            const matchedPlan = fetchedPlans.find(p => p.name === selectedPlan || p.id === selectedPlan || String(p.id) === String(selectedPlan));
            const planId = matchedPlan?.id ?? selectedPlan;

            const response = await fetch(`${BASE_URL}/payment/subscriptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    plan_id: planId,
                    payment_method_id: selectedPmForSubscription.id
                })
            });

            if (response.ok) {
                toast.success("Subscription plan created successfully");
                setIsSubscriptionModalOpen(false);
                fetchOrgData();
                fetchCurrentSubscription();
            } else {
                const errData = await response.json();
                if (errData.details) {
                    setErrorDetail(errData.details);
                } else if (errData.plan_id && Array.isArray(errData.plan_id)) {
                    setErrorDetail(errData.plan_id[0]);
                } else if (errData.plan && Array.isArray(errData.plan)) {
                    setErrorDetail(errData.plan[0]);
                } else if (errData.detail) {
                    setErrorDetail(errData.detail);
                } else {
                    setErrorDetail("Failed to create subscription plan");
                }
            }
        } catch (err) {
            console.error("Subscription error:", err);
            setErrorDetail("An error occurred during subscription creation");
        } finally {
            setIsSubscriptionSubmitting(false);
        }
    };

    const handleCancelPlan = async () => {
        setIsCancellingPlan(true);
        try {
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/payment/subscriptions/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                toast.success("Subscription plan cancelled successfully");
                setIsCancelPlanModalOpen(false);
                fetchOrgData();
            } else {
                const errData = await response.json();
                setErrorDetail(errData.details || errData.detail || "Failed to cancel subscription plan");
            }
        } catch (err) {
            console.error("Cancellation error:", err);
            setErrorDetail("An error occurred during subscription cancellation");
        } finally {
            setIsCancellingPlan(false);
        }
    };

    const handleUpdateSubscription = async () => {
        if (!selectedPlan || !selectedPmForSubscription) {
            toast.error("Please select a plan and a payment method");
            return;
        }

        const matchedPlan = fetchedPlans.find(p => p.name === selectedPlan || p.id === selectedPlan || String(p.id) === String(selectedPlan));

        if (
            (matchedPlan?.id && currentSubscription?.plan && String(matchedPlan.id) === String(currentSubscription.plan)) ||
            selectedPlan.toLowerCase() === (currentSubscription?.plan ? String(currentSubscription.plan).toLowerCase() : "") ||
            selectedPlan.toLowerCase() === (orgData?.current_plan ? String(orgData.current_plan).toLowerCase() : "")
        ) {
            setErrorDetail("You are already on this plan. Please select a different plan to update.");
            return;
        }

        setIsUpdateSubmitting(true);
        setErrorDetail(null);
        try {
            const token = cookieUtils.get("access");
            const matchedPlan = fetchedPlans.find(p => p.name === selectedPlan || p.id === selectedPlan || String(p.id) === String(selectedPlan));
            const planId = matchedPlan?.id ?? selectedPlan;

            const response = await fetch(`${BASE_URL}/payment/subscriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan_id: planId,
                    payment_method_id: selectedPmForSubscription.id
                })
            });

            if (response.ok) {
                toast.success("Subscription plan updated successfully");
                setIsUpdateSubscriptionModalOpen(false);
                fetchOrgData();
                fetchCurrentSubscription();
            } else {
                const errData = await response.json();
                if (errData.details) {
                    setErrorDetail(errData.details);
                } else if (errData.plan_id && Array.isArray(errData.plan_id)) {
                    setErrorDetail(errData.plan_id[0]);
                } else if (errData.plan && Array.isArray(errData.plan)) {
                    setErrorDetail(errData.plan[0]);
                } else if (errData.detail) {
                    setErrorDetail(errData.detail);
                } else {
                    setErrorDetail("Failed to update subscription plan");
                }
            }
        } catch (err) {
            console.error("Update error:", err);
            setErrorDetail("An error occurred during subscription update");
        } finally {
            setIsUpdateSubmitting(false);
        }
    };

    const handleContactSales = async () => {
        setIsContactSalesSubmitting(true);
        setErrorDetail(null);
        try {
            const response = await paymentService.requestCustomSubscription();
            if (response.status === 200 || response.status === 201) {
                setSuccessDetail(response.data.detail || "Your request for a custom subscription has been sent. Our team will contact you soon.");
            } else {
                setErrorDetail(response.data.details || response.data.detail || "Failed to send request. Please try again later.");
            }
        } catch (err: any) {
            console.error("Contact sales error:", err);
            setErrorDetail(err.response?.data?.details || err.response?.data?.detail || "An error occurred while sending the request. Please try again later.");
        } finally {
            setIsContactSalesSubmitting(false);
        }
    };

    if (orgData?.role === 'VOIP_USER') {
        return (
            <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-5">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 mb-3">
                        Role: VOIP_USER
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Access Restricted
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                        You do not have authorization to access the AI Control Centre dashboard. Your account is configured for VoIP Business Line operations.
                    </p>
                    <Button
                        onClick={() => router.push('/dashboard/phone-call-flows')}
                        className="w-full bg-[#0f172a] dark:bg-gray-100 hover:bg-[#1e293b] dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold h-11 rounded-lg text-sm transition-all shadow-sm"
                    >
                        Go to AI Call Builder
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 overflow-y-auto bg-transparent p-4 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Complete Your Account Setup */}
                {(() => {
                    if (isAllCompleted) {
                        return (
                            <div className="relative">
                                <div
                                    onClick={() => setIsSetupDropdownOpen(!isSetupDropdownOpen)}
                                    className="w-full flex items-center justify-between p-4 border border-blue-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 shadow-lg shadow-blue-500/10"
                                >
                                    <h1 className="text-[17px] font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                                        Complete Your Account Setup ({completedCount}/{setupSteps.length})
                                    </h1>
                                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isSetupDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isSetupDropdownOpen && (
                                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-gray-900 border border-blue-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-6 md:p-8 space-y-3">
                                            {setupSteps.map((option, idx) => {
                                                const isCompleted = checkStepCompleted(option.key);
                                                const isDisabled = isStepDisabled(idx);
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex items-center gap-5 group/item transition-all duration-200 ${isCompleted ? '' : (isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:translate-x-1')
                                                            }`}
                                                        onClick={() => {
                                                            if (!isCompleted && !isDisabled) {
                                                                if (option.key === 'is_purchased_anything') {
                                                                    setModalPlanType("screening");
                                                                    setSelectedPlan(null);
                                                                    setIsSubscriptionModalOpen(true);
                                                                } else {
                                                                    router.push(option.path);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {isCompleted ? (
                                                            <div className="h-6 w-6 rounded-full bg-[#5EBB78] flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
                                                                <Check className="h-4 w-4 text-white stroke-[3px]" />
                                                            </div>
                                                        ) : isDisabled ? (
                                                            <div className="h-6 w-6 rounded-full border-[3px] border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 shadow-lg shadow-blue-500/10 transition-colors duration-200" />
                                                        ) : (
                                                            <div className="h-6 w-6 rounded-full border-[3px] border-blue-500 dark:border-blue-400 flex items-center justify-center flex-shrink-0 bg-white dark:bg-gray-900 shadow-lg shadow-blue-500/10 transition-colors duration-200 group-hover/item:border-blue-600 dark:group-hover/item:border-blue-300" />
                                                        )}
                                                        <span className={`text-[17px] font-medium transition-all duration-200 ${isCompleted ? 'text-gray-800 dark:text-gray-200' : (
                                                                isDisabled ? 'text-black/50 dark:text-white/50' : 'text-gray-800 dark:text-gray-200 group-hover/item:underline decoration-blue-500 underline-offset-4 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400'
                                                            )
                                                            }`}>
                                                            {option.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div>
                            <h1 className="text-xl font-bold tracking-tight gradient-text dark:from-indigo-300  dark:to-blue-300 animate-fade-up mb-6">Complete Your Account Setup</h1>
                            <div className="group relative overflow-hidden rounded-2xl border border-blue-100/70 dark:border-gray-700/60 glass dark:bg-gray-900/60 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl p-6 md:p-8">
                                {/* soft gradient glow */}
                                <div className="pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="h-full w-full bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-emerald-500/20" />
                                </div>

                                {/* subtle dot pattern */}
                                <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
                                    <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.35)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:14px_14px]" />
                                </div>

                                <div className="relative space-y-3">
                                    {setupSteps.map((option, idx) => {
                                        const isCompleted = checkStepCompleted(option.key);
                                        const isDisabled = isStepDisabled(idx);
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex items-center gap-5 group/item transition-all duration-200 ${isCompleted ? '' : (isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:translate-x-1')
                                                    }`}
                                                onClick={() => {
                                                    if (!isCompleted && !isDisabled) {
                                                        if (option.key === 'is_purchased_anything') {
                                                            setModalPlanType("screening");
                                                            setSelectedPlan(null);
                                                            setIsSubscriptionModalOpen(true);
                                                        } else {
                                                            router.push(option.path);
                                                        }
                                                    }
                                                }}
                                            >
                                                {isCompleted ? (
                                                    <div className="h-6 w-6 rounded-full bg-[#5EBB78] flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
                                                        <Check className="h-4 w-4 text-white stroke-[3px]" />
                                                    </div>
                                                ) : isDisabled ? (
                                                    <div className="h-6 w-6 rounded-full border-[3px] border-gray-300 dark:border-gray-700 flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 shadow-lg shadow-blue-500/10 transition-colors duration-200" />
                                                ) : (
                                                    <div className="h-6 w-6 rounded-full border-[3px] border-blue-500 dark:border-blue-400 flex items-center justify-center flex-shrink-0 bg-white dark:bg-gray-900 shadow-lg shadow-blue-500/10 transition-colors duration-200 group-hover/item:border-blue-600 dark:group-hover/item:border-blue-300" />
                                                )}
                                                <span className={`text-[17px] font-medium transition-all duration-200 ${isCompleted ? 'text-gray-800 dark:text-gray-200' : (
                                                        isDisabled ? 'text-black/50 dark:text-white/50' : 'text-gray-800 dark:text-gray-200 group-hover/item:underline decoration-blue-500 underline-offset-4 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400'
                                                    )
                                                    }`}>
                                                    {option.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div>
                    <h1 className="text-xl font-bold tracking-tight gradient-text dark:from-indigo-300  dark:to-blue-300 animate-fade-up mb-6">Account & Usage</h1>
                    {/* <p className="text-slate-500 dark:text-gray-400 mt-1">Welcome back! Here's what's happening today.</p> */}
                </div>

                {/* 3 cards in same row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="h-48 rounded-2xl border border-blue-100/70 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/60 animate-pulse flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ))
                    ) : (
                        cards.map((card, index) => (
                            <div
                                key={index}
                                className="group relative overflow-hidden rounded-2xl border border-blue-100/70 dark:border-gray-700/60 glass dark:bg-gray-900/60 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl p-6 md:p-8 flex flex-col items-center justify-between text-center min-h-[220px]"
                            >
                                {/* soft gradient glow */}
                                <div className="pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100">
                                    <div className="h-full w-full bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-emerald-500/20" />
                                </div>

                                {/* subtle dot pattern */}
                                <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
                                    <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.35)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:14px_14px]" />
                                </div>

                                <div className="relative w-full flex flex-col items-center flex-1 justify-between gap-6">
                                    <div className="flex flex-col items-center">
                                        {/* icon container */}
                                        <div
                                            className={`relative grid h-12 w-12 place-items-center rounded-2xl ${card.bgColor} ${card.iconColor} shadow-lg shadow-blue-500/10 ring-1 ring-black/5 dark:ring-white/10 mb-3`}
                                        >
                                            <div className="absolute inset-0 rounded-2xl opacity-40 blur-lg" />
                                            <card.icon size={22} />
                                        </div>

                                        {/* title & value */}
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                {card.title}
                                            </p>
                                            <p className={`text-xl md:text-2xl font-bold tracking-tight ${card.value === 'Not Active' ? 'text-gray-400 dark:text-gray-500' : 'text-slate-900 dark:text-white'}`}>
                                                {card.value}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="w-full">
                                        {card.key === 'current_plan' && (
                                            <button
                                                disabled={isCheckingVerification}
                                                onClick={handleUpgradePlanClick}
                                                className="w-full py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/10 flex items-center justify-center cursor-pointer"
                                            >
                                                {isCheckingVerification ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    orgData?.current_plan?.toLowerCase().includes("enterprise") ? "Manage Plan" : "Upgrade Plan"
                                                )}
                                            </button>
                                        )}

                                        {card.key === 'screening_calls' && (
                                            <button
                                                disabled={!aiApplicantCallsActive}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTopUpType("screening_credit");
                                                    setTopUpMinutes("");
                                                    setTopUpAmount("");
                                                    setIsTopUpOpen(true);
                                                }}
                                                className={`w-full py-2.5 px-4 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                                                    aiApplicantCallsActive
                                                        ? 'border border-gray-900 dark:border-gray-200 text-slate-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-lg shadow-blue-500/10 cursor-pointer'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border-none'
                                                }`}
                                            >
                                                Top-up
                                            </button>
                                        )}

                                        {card.key === 'ai_calls' && (
                                            <button
                                                disabled={!aiCallsActive}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (aiCallsActive) {
                                                        setTopUpType("ai_call_minutes");
                                                        setTopUpMinutes("");
                                                        setTopUpAmount("");
                                                        setIsTopUpOpen(true);
                                                    }
                                                }}
                                                className={`w-full py-2.5 px-4 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                                                    aiCallsActive
                                                        ? 'border border-gray-900 dark:border-gray-200 text-slate-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-lg shadow-blue-500/10 cursor-pointer'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border-none'
                                                }`}
                                            >
                                                Top-up
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Standalone Top Up Dialog */}
                <Dialog
                    open={isTopUpOpen}
                    onOpenChange={(open) => {
                        setIsTopUpOpen(open);
                        if (!open) {
                            setTopUpType("");
                            setTopUpMinutes("");
                            setTopUpAmount("");
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-[480px] p-6 sm:p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-3xl gap-6">
                        <DialogHeader className="p-0">
                            <DialogTitle className="text-[22px] font-bold text-slate-900 dark:text-gray-100">
                                {topUpType === "screening_credit" ? "Add Screening Credits" : "Add Minutes"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6">
                            {/* Choice Field Section only shown if both products are active */}
                            {aiCallsActive && aiApplicantCallsActive && (
                                <div className="space-y-2">
                                    <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                        Top-up type
                                    </label>
                                    <Select
                                        value={topUpType}
                                        onValueChange={(val) => {
                                            setTopUpType(val);
                                            if (!topUpMinutes) {
                                                setTopUpAmount("");
                                                return;
                                            }
                                            const count = parseInt(topUpMinutes);
                                            if (isNaN(count)) {
                                                setTopUpAmount("");
                                                return;
                                            }
                                            if (val === "screening_credit") {
                                                setTopUpAmount((count * screeningRate).toFixed(2));
                                            } else if (val === "ai_call_minutes") {
                                                if (orgData?.top_up_min_per_dol) {
                                                    const rate = parseFloat(orgData.top_up_min_per_dol);
                                                    if (rate > 0) {
                                                        const costPerMin = Math.round((1 / rate) * 100) / 100;
                                                        setTopUpAmount((count * costPerMin).toFixed(2));
                                                    } else {
                                                        setTopUpAmount("0.00");
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full py-6 px-4 bg-blue-50/50 dark:bg-gray-900 border border-blue-50 dark:border-gray-800 rounded-2xl text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                                            <SelectValue placeholder="Select top-up type" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-gray-950 border border-blue-50 dark:border-gray-800 rounded-2xl shadow-xl z-50">
                                            <SelectItem value="screening_credit" className="text-[14px] font-medium cursor-pointer py-3 rounded-2xl">
                                                Screening Credits
                                            </SelectItem>
                                            <SelectItem value="ai_call_minutes" className="text-[14px] font-medium cursor-pointer py-3 rounded-2xl">
                                                AI Call Minutes
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Amount Section for ai_call_minutes */}
                            {topUpType === "ai_call_minutes" && (
                                <div className="space-y-2">
                                    <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                        Minutes to add
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                                            <div className="w-5 h-5 bg-blue-50 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                                <Zap size={10} className="text-blue-600 dark:text-blue-400 fill-current" />
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            value={topUpMinutes}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    setTopUpMinutes("");
                                                    setTopUpAmount("");
                                                    return;
                                                }
                                                const mins = Math.floor(parseInt(val));
                                                if (isNaN(mins)) return;

                                                setTopUpMinutes(mins.toString());
                                                if (orgData?.top_up_min_per_dol) {
                                                    const rate = parseFloat(orgData.top_up_min_per_dol);
                                                    if (rate > 0) {
                                                        const costPerMin = Math.round((1 / rate) * 100) / 100;
                                                        const total = (mins * costPerMin).toFixed(2);
                                                        setTopUpAmount(total);
                                                    } else {
                                                        setTopUpAmount("0.00");
                                                    }
                                                }
                                            }}
                                            placeholder="Enter minutes"
                                            className="w-full pl-12 pr-4 py-4 bg-blue-50/50 dark:bg-gray-900 border-none rounded-2xl text-[16px] font-medium text-slate-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 size={14} className="text-blue-500" />
                                            <p className="text-[13px] text-slate-900 dark:text-gray-100 font-bold">
                                                Total Cost: ${topUpAmount || "0.00"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Info size={14} className="text-gray-400" />
                                            <p className="text-[13px] text-slate-500 dark:text-gray-400 font-medium">
                                                Cost per minute: ${orgData?.top_up_min_per_dol && parseFloat(orgData.top_up_min_per_dol) > 0 ? (1 / parseFloat(orgData.top_up_min_per_dol)).toFixed(2) : "0.00"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Amount Section for screening_credit */}
                            {topUpType === "screening_credit" && (
                                <div className="space-y-2">
                                    <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                        Screening calls to add
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                                            <div className="w-5 h-5 bg-blue-50 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                                <Zap size={10} className="text-blue-600 dark:text-blue-400 fill-current" />
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            value={topUpMinutes}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    setTopUpMinutes("");
                                                    setTopUpAmount("");
                                                    return;
                                                }
                                                const count = Math.floor(parseInt(val));
                                                if (isNaN(count)) return;

                                                setTopUpMinutes(count.toString());
                                                const total = (count * screeningRate).toFixed(2);
                                                setTopUpAmount(total);
                                            }}
                                            placeholder="Enter credits"
                                            className="w-full pl-12 pr-4 py-4 bg-blue-50/50 dark:bg-gray-900 border-none rounded-2xl text-[16px] font-medium text-slate-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 size={14} className="text-blue-500" />
                                            <p className="text-[13px] text-slate-900 dark:text-gray-100 font-bold">
                                                Total Cost: ${topUpAmount || "0.00"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Info size={14} className="text-gray-400" />
                                            <p className="text-[13px] text-slate-500 dark:text-gray-400 font-medium">
                                                Cost per screening call: ${screeningRate.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Payment Method Selector */}
                            <div className="space-y-2">
                                <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                    Payment method
                                </label>
                                <div className="relative">
                                    <div
                                        onClick={() => setIsPmSelectorOpen(!isPmSelectorOpen)}
                                        className="flex items-center justify-between p-4 border border-blue-50 dark:border-gray-800 rounded-2xl bg-blue-50/50 dark:bg-gray-900 cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-850 transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-6 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden">
                                                {selectedPmForTopUp?.card?.brand === 'visa' ? (
                                                    <span className="text-white font-bold italic text-[8px]">VISA</span>
                                                ) : (
                                                    <div className="flex -space-x-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-rose-500 opacity-80" />
                                                        <div className="w-4 h-4 rounded-full bg-amber-400 opacity-80" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                                {selectedPmForTopUp ? `•••• ${selectedPmForTopUp.card?.last4}` : 'Select card'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col -space-y-1 text-gray-400 dark:text-gray-500">
                                            <ChevronUp size={16} />
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>

                                    {isPmSelectorOpen && (
                                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-gray-950 border border-blue-50 dark:border-gray-800 rounded-3xl shadow-2xl z-[60] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            <div className="max-h-[240px] overflow-y-auto p-2">
                                                {paymentMethods.map((pm) => (
                                                    <div
                                                        key={pm.id}
                                                        onClick={() => {
                                                            setSelectedPmForTopUp(pm);
                                                            setIsPmSelectorOpen(false);
                                                        }}
                                                        className="px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 rounded-2xl cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-5 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden shrink-0">
                                                                {pm.card?.brand === 'visa' ? (
                                                                    <span className="text-white font-bold italic text-[6px]">VISA</span>
                                                                ) : (
                                                                    <div className="flex -space-x-1">
                                                                        <div className="w-3 h-3 rounded-full bg-rose-500 opacity-80" />
                                                                        <div className="w-3 h-3 rounded-full bg-amber-400 opacity-80" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[14px] font-bold text-slate-900 dark:text-gray-100">•••• {pm.card?.last4}</span>
                                                        </div>
                                                        {selectedPmForTopUp?.id === pm.id && (
                                                            <Check size={16} className="text-slate-900 dark:text-gray-100" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-start px-1">
                                <button
                                    onClick={() => {
                                        setIsTopUpOpen(false)
                                        setIsAddPaymentOpen(true)
                                    }}
                                    className="text-[14px] font-bold text-slate-900 dark:text-gray-100 hover:opacity-70 transition-opacity flex items-center gap-2 cursor-pointer"
                                >
                                    <span className="text-lg">+</span> Add payment method
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <Button
                                onClick={() => setIsTopUpOpen(false)}
                                className="w-full sm:flex-1 bg-blue-50/50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-slate-900 dark:text-gray-100 font-bold px-6 py-4 rounded-2xl border-none shadow-none text-[15px] transition-colors h-auto cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleTopUp}
                                disabled={isTopUpSubmitting || !topUpType || !topUpMinutes || !topUpAmount || !selectedPmForTopUp}
                                className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-6 py-4 rounded-2xl text-[15px] font-bold transition-all h-auto flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {isTopUpSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Continue
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
                {isAllCompleted && (
                    <>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight gradient-text dark:from-indigo-300  dark:to-blue-300 animate-fade-up">System Health</h1>
                            {/* <p className="text-slate-500 dark:text-gray-400 mt-1">Welcome back! Here's what's happening today.</p> */}
                        </div>

                        {/* 3 cards in same row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {isLoading ? (
                                Array(2).fill(0).map((_, i) => (
                                    <div key={i} className="h-32 rounded-2xl border border-blue-100/70 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/60 animate-pulse flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                ))
                            ) : (
                                cardss.map((card, index) => (
                                    <div
                                        key={index}
                                        // onClick={() => router.push('/dashboard/billing')}
                                        className="group relative overflow-hidden rounded-2xl border border-blue-100/70 dark:border-gray-700/60 glass dark:bg-gray-900/60 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                    >
                                        {/* soft gradient glow */}
                                        <div className="pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100">
                                            <div className="h-full w-full bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-emerald-500/20" />
                                        </div>

                                        {/* subtle dot pattern */}
                                        <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
                                            <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.35)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:14px_14px]" />
                                        </div>

                                        <div className="relative p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    {/* icon container */}
                                                    <div
                                                        className={`relative grid h-12 w-12 place-items-center rounded-2xl ${card.bgColor} ${card.iconColor} shadow-lg shadow-blue-500/10 ring-1 ring-black/5 dark:ring-white/10`}
                                                    >
                                                        <div className="absolute inset-0 rounded-2xl opacity-40 blur-lg" />
                                                        <card.icon size={22} />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex items-start mt-1">
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                                    {card.title}
                                                                </p>
                                                                <div className="text-xl font-medium tracking-tight text-slate-900 dark:text-white">
                                                                    {card.value}
                                                                </div>


                                                            </div>
                                                        </div>
                                                        {card.title === 'Current Plan' && (
                                                            <div className="flex flex-row gap-2 mt-4">
                                                                <button
                                                                    disabled={isCheckingVerification}
                                                                    onClick={handleUpgradePlanClick}
                                                                    className="w-[100px] md:w-[110px] sm:w-[15%] bg-secondary hover:bg-black hover:text-white text-black border border-black dark:border-secondary dark:bg-primary dark:hover:border-black dark:hover:text-black px-0 py-[3px] md:px-0 md:py-[3px] rounded-2xl text-[11px] font-bold transition-all duration-300 shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
                                                                >
                                                                    {isCheckingVerification ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        orgData?.current_plan ? "Upgrade Plan" : "Upgrade Plan"
                                                                    )}
                                                                </button>

                                                                {orgData?.current_plan && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setIsCancelPlanModalOpen(true);
                                                                        }}
                                                                        className="text-[9px] md:text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors duration-200 text-center w-[100px] md:w-[110px] sm:w-[15%] px-1 py-1 md:px-1 md:py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 rounded-2xl"
                                                                    >
                                                                        Cancel Subscription
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* AI Applicant Screening Call Report Section */}
                        {hasScreeningFlow && (
                            <div className="mt-8 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <h1 className="text-xl font-bold tracking-tight gradient-text dark:from-indigo-300  dark:to-blue-300 animate-fade-up">AI Applicant Screening Call - Report</h1>
                                    </div>

                                    {/* Period Filter */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        {screeningPeriod === "custom" && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-gray-400">From:</span>
                                                    <input
                                                        type="date"
                                                        value={screeningStartDate}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setScreeningStartDate(val);
                                                            fetchScreeningAnalytics("custom", val, screeningEndDate);
                                                        }}
                                                        className="h-9 px-2.5 py-1 text-xs rounded-2xl border border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-gray-400">To:</span>
                                                    <input
                                                        type="date"
                                                        value={screeningEndDate}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setScreeningEndDate(val);
                                                            fetchScreeningAnalytics("custom", screeningStartDate, val);
                                                        }}
                                                        className="h-9 px-2.5 py-1 text-xs rounded-2xl border border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="w-[140px] sm:w-[150px]">
                                            <Select
                                                value={screeningPeriod}
                                                onValueChange={(value) => {
                                                    setScreeningPeriod(value);
                                                    if (value !== "custom") {
                                                        fetchScreeningAnalytics(value, screeningStartDate, screeningEndDate);
                                                    } else {
                                                        fetchScreeningAnalytics("custom", screeningStartDate, screeningEndDate);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-9 rounded-2xl border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-slate-900 dark:text-gray-100">
                                                    <SelectValue placeholder="Select Period" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                                                    <SelectItem value="today" className="text-xs">Today</SelectItem>
                                                    <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                                                    <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                                                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                                                    <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                                                    <SelectItem value="yearly" className="text-xs">Yearly</SelectItem>
                                                    <SelectItem value="all" className="text-xs">All</SelectItem>
                                                    <SelectItem value="custom" className="text-xs">Custom</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleResetScreeningFilter}
                                            className="h-9 px-3 rounded-2xl border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 shadow-none"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            <span>Reset</span>
                                        </Button>
                                    </div>
                                </div>

                                {isScreeningLoading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} className="h-28 rounded-2xl border border-blue-100 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {[
                                            {
                                                title: "Total AI Calls",
                                                value: String(screeningAnalytics?.total_calls ?? 0),
                                                icon: Phone,
                                                iconColor: "text-blue-600 dark:text-blue-400",
                                                bgColor: "bg-blue-50 dark:bg-blue-900/20",
                                            },
                                            {
                                                title: "Completed Calls",
                                                value: String(screeningAnalytics?.screening_calls_completed ?? 0),
                                                icon: CheckCircle2,
                                                iconColor: "text-green-600 dark:text-green-400",
                                                bgColor: "bg-green-50 dark:bg-green-900/20",
                                            },
                                            {
                                                title: "Link Sent",
                                                value: String(screeningAnalytics?.green_candidates ?? 0),
                                                icon: Users,
                                                iconColor: "text-purple-600 dark:text-purple-400",
                                                bgColor: "bg-purple-50 dark:bg-purple-900/20",
                                            },
                                            {
                                                title: "Consultant hours Saved",
                                                value: `${screeningAnalytics?.consultant_hours_saved ?? 0} hours`,
                                                icon: Clock,
                                                iconColor: "text-orange-600 dark:text-orange-400",
                                                bgColor: "bg-orange-50 dark:bg-orange-900/20",
                                            },
                                        ].map((card, index) => (
                                            <div
                                                key={index}
                                                className="group relative overflow-hidden rounded-2xl border border-blue-100/70 dark:border-gray-700/60 glass dark:bg-gray-900/60 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                            >
                                                {/* soft gradient glow */}
                                                <div className="pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100">
                                                    <div className="h-full w-full bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-emerald-500/20" />
                                                </div>

                                                {/* subtle dot pattern */}
                                                <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]">
                                                    <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.35)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:14px_14px]" />
                                                </div>

                                                <div className="relative p-6">
                                                    <div className="flex items-center gap-4">
                                                        {/* icon container */}
                                                        <div
                                                            className={`relative grid h-12 w-12 place-items-center rounded-2xl ${card.bgColor} ${card.iconColor} shadow-lg shadow-blue-500/10 ring-1 ring-black/5 dark:ring-white/10`}
                                                        >
                                                            <div className="absolute inset-0 rounded-2xl opacity-40 blur-lg" />
                                                            <card.icon size={22} />
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                                {card.title}
                                                            </p>
                                                            <div className="text-xl font-medium tracking-tight text-slate-900 dark:text-white">
                                                                {card.value}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Add Payment Method Modal */}
                <Dialog open={isAddPaymentOpen} onOpenChange={(open) => {
                    setIsAddPaymentOpen(open);
                    if (!open) {
                        setAddPaymentError(null);
                        if (cardNumberRef.current) cardNumberRef.current.unmount();
                        if (cardExpiryRef.current) cardExpiryRef.current.unmount();
                        if (cardCvcRef.current) cardCvcRef.current.unmount();
                        cardNumberRef.current = null;
                        cardExpiryRef.current = null;
                        cardCvcRef.current = null;
                    }
                }}>
                    <DialogContent
                        className="max-w-[calc(100vw-32px)] sm:max-w-[480px] p-5 sm:p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-2xl sm:rounded-3xl gap-6 overflow-y-auto max-h-[90vh]"
                    >
                        <DialogHeader className="p-0 space-y-2 text-left">
                            <DialogTitle className="text-[22px] font-bold text-slate-900 dark:text-gray-100">
                                Add payment method
                            </DialogTitle>
                            <p className="text-[14px] text-slate-500 dark:text-gray-400 leading-relaxed font-medium">
                                Add your credit card details below. This card will be saved to your account and can be removed at any time.
                            </p>
                        </DialogHeader>

                        {addPaymentError && (
                            <div
                                ref={addPaymentErrorRef}
                                className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
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
                            {/* Card Information */}
                            <div className="space-y-2">
                                <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                    Card information <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="flex items-center flex-wrap sm:flex-nowrap border border-blue-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 px-4 py-3 gap-3 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-gray-700 transition-shadow">
                                        <div className="flex-1 min-w-[180px] flex items-center gap-3">
                                            <div className="w-6 h-4 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center shrink-0">
                                                <CreditCard size={14} className="text-gray-400" />
                                            </div>
                                            <div ref={cardNumberContainerRef} className="flex-1" />
                                        </div>
                                        <div className="flex gap-3 text-[15px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-blue-50 dark:border-gray-800">
                                            <div ref={cardExpiryContainerRef} className="w-16" />
                                            <div ref={cardCvcContainerRef} className="w-12" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Name on Card */}
                            <div className="space-y-2">
                                <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                    Name on card <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={cardholderName}
                                    onChange={(e) => setCardholderName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>

                            {/* Billing Address */}
                            <div className="space-y-4">
                                <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                    Billing address
                                </label>
                                <div className="space-y-3">
                                    <div className="relative" ref={dropdownRef}>
                                        <div
                                            onClick={() => setIsCountryOpen(!isCountryOpen)}
                                            className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                                        >
                                            <span className={selectedCountry ? "text-slate-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}>
                                                {selectedCountry ? selectedCountry.country : "Country"} <span className="text-red-500">*</span>
                                            </span>
                                            <ChevronsUpDown size={16} className="text-gray-400" />
                                        </div>

                                        {isCountryOpen && (
                                            <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl shadow-xl z-[70] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                <div className="p-3 border-b border-blue-50 dark:border-gray-800">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder=""
                                                            value={countrySearch}
                                                            onChange={(e) => setCountrySearch(e.target.value)}
                                                            className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-2.5 pl-10 pr-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-[280px] overflow-y-auto">
                                                    {filteredCountries.length > 0 ? (
                                                        filteredCountries.map((c) => (
                                                            <div
                                                                key={c.country_code}
                                                                onClick={() => {
                                                                    setSelectedCountry(c);
                                                                    setIsCountryOpen(false);
                                                                    setCountrySearch("");
                                                                }}
                                                                className="px-6 py-3 text-[15px] font-medium text-slate-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                                                            >
                                                                {c.country}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-6 py-8 text-center text-slate-500 dark:text-gray-400 text-sm italic">
                                                            No countries found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={addressLine1}
                                        onChange={(e) => setAddressLine1(e.target.value)}
                                        placeholder="Address line 1 *"
                                        className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <input
                                        type="text"
                                        value={addressLine2}
                                        onChange={(e) => setAddressLine2(e.target.value)}
                                        placeholder="Address line 2"
                                        className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="City"
                                            className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                        />
                                        <input
                                            type="text"
                                            value={postalCode}
                                            onChange={(e) => setPostalCode(e.target.value)}
                                            placeholder="Postal code"
                                            className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={stateRegion}
                                        onChange={(e) => setStateRegion(e.target.value)}
                                        placeholder="State, county, province, or region"
                                        className="w-full bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                </div>
                            </div>

                            {/* Set Default Checkbox */}
                            <div className="flex items-center gap-3 pt-2">
                                <div
                                    onClick={() => setIsDefault(!isDefault)}
                                    className={`w-[18px] h-[18px] border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${isDefault ? 'border-gray-900 bg-gray-900 dark:border-gray-100 dark:bg-gray-100' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}
                                >
                                    {isDefault && <Check size={14} className="text-white dark:text-gray-900" strokeWidth={3} />}
                                </div>
                                <span
                                    onClick={() => setIsDefault(!isDefault)}
                                    className="text-[15px] font-medium text-slate-900 dark:text-gray-100 cursor-pointer select-none"
                                >
                                    Set as default payment method
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                            <Button
                                onClick={() => setIsAddPaymentOpen(false)}
                                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto order-2 sm:order-1"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddPaymentMethod}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-6 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center justify-center gap-2 order-1 sm:order-2"
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Add payment method
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={!!errorDetail} onOpenChange={() => setErrorDetail(null)}>
                    <AlertDialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 rounded-2xl dark:bg-gray-950 border-blue-50 dark:border-gray-800">
                        <AlertDialogHeader>
                            <div className="flex justify-center items-center gap-3 mb-2">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <AlertDialogTitle className="text-lg font-bold text-red-600 dark:text-red-400">
                                    Error
                                </AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-sm text-slate-500 dark:text-gray-400 font-medium pt-2 text-center">
                                {errorDetail}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-4">
                            <AlertDialogAction
                                onClick={() => {
                                    if (errorDetail === "You didn't pay the development fee.") {
                                        router.push('/dashboard/platform-activation');
                                    }
                                    setErrorDetail(null);
                                }}
                                className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-colors h-auto border-none"
                            >
                                Continue
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!successDetail} onOpenChange={() => setSuccessDetail(null)}>
                    <AlertDialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 rounded-2xl dark:bg-gray-950 border-blue-50 dark:border-gray-800">
                        <AlertDialogHeader>
                            <div className="flex justify-center items-center gap-3 mb-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <AlertDialogTitle className="text-lg font-bold text-green-600 dark:text-green-400">
                                    Success
                                </AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-sm text-slate-500 dark:text-gray-400 font-medium pt-2 text-center">
                                {successDetail}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-4">
                            <AlertDialogAction
                                onClick={() => setSuccessDetail(null)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-colors h-auto border-none"
                            >
                                Continue
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                    <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 sm:p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-2xl sm:rounded-3xl gap-6">
                        <DialogHeader className="p-0 space-y-2 text-left">
                            <DialogTitle className="text-[22px] font-bold text-slate-900 dark:text-gray-100">
                                Delete payment method?
                            </DialogTitle>
                            <p className="text-[14px] text-slate-500 dark:text-gray-400 leading-relaxed font-medium">
                                Are you sure you want to delete this payment method? This action cannot be undone.
                            </p>
                        </DialogHeader>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                            <Button
                                onClick={() => setIsDeleteOpen(false)}
                                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto order-2 sm:order-1"
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDeletePaymentMethod}
                                disabled={isDeleting}
                                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center justify-center gap-2 order-1 sm:order-2"
                            >
                                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Continue
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
                    <DialogContent className="max-w-md w-full p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-3xl">
                        {verificationBlockedStep === 'verification_pending' ? (
                            <div className="text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                    <Clock className="w-8 h-8 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">Verification Pending</h2>
                                    <p className="text-[15px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed">
                                        Your Business data is still waiting for verification. Please come back later.
                                    </p>
                                </div>
                            </div>
                        ) : verificationBlockedStep === 'platform_activation_required' ? (
                            <div className="text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                    <Clock className="w-8 h-8 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">Platform Activation Required</h2>
                                    <p className="text-[15px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed">
                                        To access AI Phone Numbers, please complete the Platform Activation setup fee payment first.
                                    </p>
                                </div>
                            </div>
                        ) : verificationBlockedStep === 'phone_number_required' ? (
                            <div className="text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                    <Phone className="w-8 h-8 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">Phone Number Required</h2>
                                    <p className="text-[15px] font-medium text-slate-500 dark:text-gray-400 leading-relaxed">
                                        To configure billing, please purchase an Phone Number first.
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </DialogContent>
                </Dialog>

                <Dialog open={isSubscriptionModalOpen} onOpenChange={(open) => {
                    setIsSubscriptionModalOpen(open);
                    if (open) setModalPlanType("screening");
                }}>
                    <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-3xl gap-8">
                        <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8 text-left">
                            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-gray-100">
                                Create Subscription Plan
                            </DialogTitle>
                            
                                <div className="inline-flex items-center rounded-full border border-black dark:border-white p-1 bg-white dark:bg-gray-950 self-start sm:self-auto shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setModalPlanType("screening")}
                                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${modalPlanType === "screening"
                                                ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/10"
                                                : "text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white bg-transparent"
                                            }`}
                                    >
                                        Screening
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalPlanType("calls")}
                                        className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${modalPlanType === "calls"
                                                ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/10"
                                                : "text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white bg-transparent"
                                            }`}
                                    >
                                        Minutes
                                    </button>
                                </div>
                            
                        </DialogHeader>

                        <div className="space-y-8">
                            {modalPlanType === "screening" ? (
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100">
                                        AI Applicant Call Plans
                                    </h2>
                                    <div className="w-14 h-1 bg-gray-900 dark:bg-gray-100 rounded-full mx-auto my-1" />
                                    <p className="m-0 text-base sm:text-[17px] text-gray-600 dark:text-gray-400 font-medium max-w-xl">
                                        No Call. No Charge.
                                    </p>
                                    <p className="m-0 text-[13px] sm:text-[14px] text-slate-500 dark:text-gray-400 font-normal">
                                        WhatsApp + SMS document requests &middot; Auto ATS sync &middot; Recruiter alerts
                                    </p>
                                    <div className="inline-block bg-gradient-to-r from-blue-600 to-violet-500 text-white text-[13px] font-semibold px-5 py-1.5 rounded-full mt-1">
                                        New clients: your first 100 AI screening calls are free
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100">
                                        AI Call Plans
                                    </h2>
                                    <div className="w-14 h-1 bg-gray-900 dark:bg-gray-100 rounded-full mx-auto my-1" />
                                    <p className="m-0 text-base sm:text-[17px] text-gray-600 dark:text-gray-400 font-medium max-w-xl">
                                        Monthly AI voice minutes, scaled to your call volume.
                                    </p>
                                </div>
                            )}

                            {/* Pricing Grid */}
                            {isFetchingPlans ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                    <p className="text-slate-500 font-medium">Fetching plans...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
                                    {pricingTiers.map((tier) => {
                                        const hidePopularHighlight = hoveredTier !== null && hoveredTier !== tier.name;
                                        const isHighlighted = tier.popular ? !hidePopularHighlight : hoveredTier === tier.name;
                                        const isSelected = selectedPlan === tier.name;

                                        return (
                                            <div
                                                key={tier.name}
                                                onMouseEnter={() => !tier.disabled && setHoveredTier(tier.name)}
                                                onMouseLeave={() => setHoveredTier(null)}
                                                onClick={() => {
                                                    if (!tier.disabled) {
                                                        setSelectedPlan(tier.name);
                                                    }
                                                }}
                                                className={[
                                                    "relative bg-white dark:bg-gray-900 rounded-2xl p-6 lg:p-8 border flex flex-col transition-all duration-200 cursor-pointer",
                                                    isSelected ? "shadow-lg ring-2 ring-blue-500 border-blue-500" : "border-blue-100 dark:border-gray-800 shadow-lg shadow-blue-500/10",
                                                    !isSelected && isHighlighted && !tier.disabled ? "border-gray-400 dark:border-gray-600" : ""
                                                ].join(" ")}

                                            >
                                                {tier.popular && !isSelected && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-violet-500 text-white">
                                                            Most Popular
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className={[
                                                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                        isSelected ? "bg-black/10 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800",
                                                    ].join(" ")}>
                                                        <tier.icon className={[
                                                            "w-5 h-5 transition-colors",
                                                            isSelected ? "text-black dark:text-white" : "text-slate-500",
                                                        ].join(" ")} />
                                                    </div>
                                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-gray-100">{(tier as any).displayName || tier.name}</h3>
                                                </div>

                                                <div className="mb-2">
                                                    <span className="text-2xl font-bold text-slate-900 dark:text-gray-100">{tier.price}</span>
                                                    <span className="text-slate-500 dark:text-gray-400 text-sm ml-1">{tier.unit}</span>
                                                </div>

                                                {modalPlanType === "screening" ? (
                                                    <>
                                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                            {(tier as any).screeningsNote || (tier as any).minimumMinutes || (tier as any).minutes}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
                                                            {(tier as any).topUpNote}
                                                        </p>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                                            BEST FOR
                                                        </p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 flex-grow leading-relaxed">
                                                            {(tier as any).bestFor || tier.description}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-semibold text-slate-500 dark:text-gray-400 mb-3">
                                                            {(tier as any).minimumMinutes || (tier as any).minutes}
                                                        </p>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">
                                                            INCLUDES
                                                        </p>
                                                        <ul className="space-y-2.5 mb-4">
                                                            {tier.features.map((feature: string) => (
                                                                <li key={feature} className="flex items-start gap-2">
                                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                                    <span className="text-gray-600 dark:text-gray-300 text-sm leading-tight">{feature}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-6 flex-grow leading-relaxed">
                                                            {(tier as any).audience || tier.description}
                                                        </p>
                                                    </>
                                                )}

                                                {tier.name === "Enterprise" && (
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleContactSales();
                                                        }}
                                                        disabled={isContactSalesSubmitting}
                                                        className="w-full bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white py-3 rounded-2xl font-bold transition-all h-auto flex items-center justify-center gap-2"
                                                    >
                                                        {isContactSalesSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                        {tier.cta}
                                                    </Button>
                                                )}
                                            </div>

                                        );
                                    })}
                                </div>
                            )}

                            {modalPlanType === "screening" ? (
                                <p className="flex items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-normal flex-wrap text-center">
                                    <span>1 credit covers a call of up to 2 minutes</span>
                                    <span>•</span>
                                    <span>Automatic top-ups and plan upgrades</span>
                                    <span>•</span>
                                    <span>AI number $10/month, or connect a compatible number</span>
                                </p>
                            ) : (
                                <p className="flex items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-medium flex-wrap text-center">
                                    <span>Prices shown exclude VAT</span>
                                    <span>•</span>
                                    <span>$400 setup fee applies to Starter, Growth &amp; Pro — returned as free minutes after 12 months</span>
                                    <span>•</span>
                                    <span>Additional minutes on Starter/Growth/Pro billed at $1.15/min</span>
                                </p>
                            )}

                            {selectedPlan === 'Enterprise' ? (
                                <div ref={enterpriseSectionRef} className="flex flex-col items-center justify-center space-y-4 pt-6">
                                    <p className="text-slate-500 dark:text-gray-400 text-center max-w-sm font-medium">
                                        For our custom Enterprise solutions, please contact our sales team to discuss your specific requirements.
                                    </p>
                                    <div className='flex flex-row gap-3'>
                                        <Button
                                            onClick={handleContactSales}
                                            disabled={isContactSalesSubmitting}
                                            className="bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-8 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center gap-2"
                                        >
                                            {isContactSalesSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Contact Sales
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setIsSubscriptionModalOpen(false)}
                                            className="bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div ref={paymentSectionRef} className="max-w-md mx-auto w-full space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                            Payment method
                                        </label>
                                        <div className="relative">
                                            <div
                                                onClick={() => setIsPmSelectorForSubOpen(!isPmSelectorForSubOpen)}
                                                className="flex items-center justify-between p-4 border border-blue-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 cursor-pointer group hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-6 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden">
                                                        {selectedPmForSubscription?.card.brand === 'visa' ? (
                                                            <span className="text-white font-bold italic text-[8px]">VISA</span>
                                                        ) : (
                                                            <div className="flex -space-x-1.5">
                                                                <div className="w-4 h-4 rounded-full bg-rose-500 opacity-80" />
                                                                <div className="w-4 h-4 rounded-full bg-amber-400 opacity-80" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                                        {selectedPmForSubscription ? `•••• ${selectedPmForSubscription.card.last4}` : 'Select card'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col -space-y-1 text-gray-400 dark:text-gray-500">
                                                    <ChevronUp size={16} />
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>

                                            {isPmSelectorForSubOpen && (
                                                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {paymentMethods.map((pm) => (
                                                            <div
                                                                key={pm.id}
                                                                onClick={() => {
                                                                    setSelectedPmForSubscription(pm);
                                                                    setIsPmSelectorForSubOpen(false);
                                                                }}
                                                                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-5 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden shrink-0">
                                                                        {pm.card.brand === 'visa' ? (
                                                                            <span className="text-white font-bold italic text-[6px]">VISA</span>
                                                                        ) : (
                                                                            <div className="flex -space-x-1">
                                                                                <div className="w-3 h-3 rounded-full bg-rose-500 opacity-80" />
                                                                                <div className="w-3 h-3 rounded-full bg-amber-400 opacity-80" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[14px] font-medium text-slate-900 dark:text-gray-100">•••• {pm.card.last4}</span>
                                                                </div>
                                                                {selectedPmForSubscription?.id === pm.id && (
                                                                    <Check size={14} className="text-slate-900 dark:text-gray-100" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => {
                                                    setIsSubscriptionModalOpen(false)
                                                    setIsAddPaymentOpen(true)
                                                }}
                                                className="text-[14px] font-bold text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white transition-colors"
                                            >
                                                + Add payment method
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-6">
                                        <Button
                                            onClick={() => setIsSubscriptionModalOpen(false)}
                                            className="bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreateSubscription}
                                            disabled={isSubscriptionSubmitting || !selectedPlan || !selectedPmForSubscription}
                                            className="bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-8 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center gap-2"
                                        >
                                            {isSubscriptionSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Create Subscription Plan
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isUpdateSubscriptionModalOpen} onOpenChange={(open) => {
                    setIsUpdateSubscriptionModalOpen(open);
                    if (open) setModalPlanType("screening");
                }}>
                    <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-3xl gap-8">
                        <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8 text-left">
                            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-gray-100">
                                Update Subscription Plan
                            </DialogTitle>
                            
                                <div className="inline-flex items-center rounded-full border border-black dark:border-white p-1 bg-white dark:bg-gray-950 self-start sm:self-auto shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setModalPlanType("screening")}
                                        className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${modalPlanType === "screening"
                                                ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/10"
                                                : "text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white bg-transparent"
                                            }`}
                                    >
                                        Screening
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalPlanType("calls")}
                                        className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${modalPlanType === "calls"
                                                ? "bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-lg shadow-blue-500/10"
                                                : "text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white bg-transparent"
                                            }`}
                                    >
                                        Minutes
                                    </button>
                                </div>
                           
                        </DialogHeader>

                        <div className="space-y-10">
                            {isFetchingSubscription || isFetchingPlans ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                    <p className="text-slate-500 font-medium">Fetching details...</p>
                                </div>
                            ) : (
                                <>
                                    {modalPlanType === "screening" ? (
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100">
                                                AI Applicant Call Plans
                                            </h2>
                                            <div className="w-14 h-1 bg-gray-900 dark:bg-gray-100 rounded-full mx-auto my-1" />
                                            <p className="m-0 text-base sm:text-[17px] text-gray-600 dark:text-gray-400 font-medium max-w-xl">
                                                No Call. No Charge.
                                            </p>
                                            <p className="m-0 text-[13px] sm:text-[14px] text-slate-500 dark:text-gray-400 font-normal">
                                                WhatsApp + SMS document requests &middot; Auto ATS sync &middot; Recruiter alerts
                                            </p>
                                            <div className="inline-block bg-gradient-to-r from-blue-600 to-violet-500 text-white text-[13px] font-semibold px-5 py-1.5 rounded-full mt-1">
                                                New clients: your first 100 AI screening calls are free
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center">
                                            <h2 className="m-0 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100">
                                                AI Call Plans
                                            </h2>
                                            <div className="w-14 h-1 bg-gray-900 dark:bg-gray-100 rounded-full mx-auto my-1" />
                                            <p className="m-0 text-base sm:text-[17px] text-gray-600 dark:text-gray-400 font-medium max-w-xl">
                                                Monthly AI voice minutes, scaled to your call volume.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8 max-w-6xl mx-auto">
                                        {pricingTiers.map((tier) => {
                                            const hidePopularHighlight = hoveredTier !== null && hoveredTier !== tier.name;
                                            const isHighlighted = tier.popular ? !hidePopularHighlight : hoveredTier === tier.name;
                                            const isSelected = selectedPlan === tier.name;

                                            return (
                                                <div
                                                    key={tier.name}
                                                    onMouseEnter={() => !tier.disabled && setHoveredTier(tier.name)}
                                                    onMouseLeave={() => setHoveredTier(null)}
                                                    onClick={() => {
                                                        if (!tier.disabled) {
                                                            setSelectedPlan(tier.name);
                                                        }
                                                    }}
                                                    className={[
                                                        "relative bg-white dark:bg-gray-900 rounded-2xl p-6 lg:p-8 border flex flex-col transition-all duration-200 cursor-pointer",
                                                        isSelected ? "shadow-lg ring-2 ring-blue-500 border-blue-500" : "border-blue-100 dark:border-gray-800 shadow-lg shadow-blue-500/10",
                                                        !isSelected && isHighlighted && !tier.disabled ? "border-gray-400 dark:border-gray-600" : ""
                                                    ].join(" ")}
                                                >
                                                    {tier.popular && !isSelected && (
                                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-violet-500 text-white">
                                                                Most Popular
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className={[
                                                            "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                                            isSelected ? "bg-black/10 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800",
                                                        ].join(" ")}>
                                                            <tier.icon className={[
                                                                "w-5 h-5 transition-colors",
                                                                isSelected ? "text-black dark:text-white" : "text-slate-500",
                                                            ].join(" ")} />
                                                        </div>
                                                        <h3 className="text-xl font-semibold text-slate-900 dark:text-gray-100">{(tier as any).displayName || tier.name}</h3>
                                                    </div>

                                                    <div className="mb-2">
                                                        <span className="text-2xl font-bold text-slate-900 dark:text-gray-100">{tier.price}</span>
                                                        <span className="text-slate-500 dark:text-gray-400 text-sm ml-1">{tier.unit}</span>
                                                    </div>

                                                    {modalPlanType === "screening" ? (
                                                        <>
                                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                                                {(tier as any).screeningsNote || (tier as any).minimumMinutes || (tier as any).minutes}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
                                                                {(tier as any).topUpNote}
                                                            </p>
                                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-1">
                                                                BEST FOR
                                                            </p>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 flex-grow leading-relaxed">
                                                                {(tier as any).bestFor || tier.description}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="text-sm font-semibold text-slate-500 dark:text-gray-400 mb-3">
                                                                {(tier as any).minimumMinutes || (tier as any).minutes}
                                                            </p>
                                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-2">
                                                                INCLUDES
                                                            </p>
                                                            <ul className="space-y-2.5 mb-4">
                                                                {tier.features.map((feature: string) => (
                                                                    <li key={feature} className="flex items-start gap-2">
                                                                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                                        <span className="text-gray-600 dark:text-gray-300 text-sm leading-tight">{feature}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            <p className="text-xs text-slate-500 dark:text-gray-400 mb-6 flex-grow leading-relaxed">
                                                                {(tier as any).audience || tier.description}
                                                            </p>
                                                        </>
                                                    )}

                                                    {tier.name === "Enterprise" && (
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleContactSales();
                                                            }}
                                                            disabled={isContactSalesSubmitting}
                                                            className="w-full bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white py-3 rounded-2xl font-bold transition-all h-auto flex items-center justify-center gap-2"
                                                        >
                                                            {isContactSalesSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                            {tier.cta}
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {modalPlanType === "screening" ? (
                                        <p className="flex items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-normal flex-wrap text-center">
                                            <span>1 credit covers a call of up to 2 minutes</span>
                                            <span>•</span>
                                            <span>Automatic top-ups and plan upgrades</span>
                                            <span>•</span>
                                            <span>AI number $10/month, or connect a compatible number</span>
                                        </p>
                                    ) : (
                                        <p className="flex items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-medium flex-wrap text-center">
                                            <span>Prices shown exclude VAT</span>
                                            <span>•</span>
                                            <span>$400 setup fee applies to Starter, Growth &amp; Pro — returned as free minutes after 12 months</span>
                                            <span>•</span>
                                            <span>Additional minutes on Starter/Growth/Pro billed at $1.15/min</span>
                                        </p>
                                    )}

                                    {selectedPlan === 'Enterprise' ? (
                                        <div ref={enterpriseSectionUpdateRef} className="flex flex-col items-center justify-center space-y-4 pt-6">
                                            <p className="text-slate-500 dark:text-gray-400 text-center max-w-sm font-medium">
                                                For our custom Enterprise solutions, please contact our sales team to discuss your specific requirements.
                                            </p>
                                            <div className='flex flex-row gap-3'>
                                                <Button
                                                    onClick={handleContactSales}
                                                    disabled={isContactSalesSubmitting}
                                                    className="bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-8 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center gap-2"
                                                >
                                                    {isContactSalesSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    Contact Sales
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setIsUpdateSubscriptionModalOpen(false)}
                                                    className="bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div ref={paymentSectionRef} className="max-w-md mx-auto w-full space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                                    Payment method
                                                </label>
                                                <div className="relative">
                                                    <div
                                                        onClick={() => setIsPmSelectorForSubOpen(!isPmSelectorForSubOpen)}
                                                        className="flex items-center justify-between p-4 border border-blue-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 cursor-pointer group hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-6 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden">
                                                                {selectedPmForSubscription?.card.brand === 'visa' ? (
                                                                    <span className="text-white font-bold italic text-[8px]">VISA</span>
                                                                ) : (
                                                                    <div className="flex -space-x-1.5">
                                                                        <div className="w-4 h-4 rounded-full bg-rose-500 opacity-80" />
                                                                        <div className="w-4 h-4 rounded-full bg-amber-400 opacity-80" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[15px] font-bold text-slate-900 dark:text-gray-100">
                                                                {selectedPmForSubscription ? `•••• ${selectedPmForSubscription.card.last4}` : 'Select card'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col -space-y-1 text-gray-400 dark:text-gray-500">
                                                            <ChevronUp size={16} />
                                                            <ChevronDown size={16} />
                                                        </div>
                                                    </div>

                                                    {isPmSelectorForSubOpen && (
                                                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-gray-950 border border-blue-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="max-h-[200px] overflow-y-auto">
                                                                {paymentMethods.map((pm) => (
                                                                    <div
                                                                        key={pm.id}
                                                                        onClick={() => {
                                                                            setSelectedPmForSubscription(pm);
                                                                            setIsPmSelectorForSubOpen(false);
                                                                        }}
                                                                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-5 bg-black dark:bg-gray-800 rounded flex items-center justify-center relative overflow-hidden shrink-0">
                                                                                {pm.card.brand === 'visa' ? (
                                                                                    <span className="text-white font-bold italic text-[6px]">VISA</span>
                                                                                ) : (
                                                                                    <div className="flex -space-x-1">
                                                                                        <div className="w-3 h-3 rounded-full bg-rose-500 opacity-80" />
                                                                                        <div className="w-3 h-3 rounded-full bg-amber-400 opacity-80" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[14px] font-medium text-slate-900 dark:text-gray-100">•••• {pm.card.last4}</span>
                                                                        </div>
                                                                        {selectedPmForSubscription?.id === pm.id && (
                                                                            <Check size={14} className="text-slate-900 dark:text-gray-100" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        onClick={() => {
                                                            setIsUpdateSubscriptionModalOpen(false)
                                                            setIsAddPaymentOpen(true)
                                                        }}
                                                        className="text-[14px] font-bold text-slate-900 dark:text-gray-100 hover:text-black dark:hover:text-white transition-colors"
                                                    >
                                                        + Add payment method
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-3 pt-6">
                                                <Button
                                                    onClick={() => setIsUpdateSubscriptionModalOpen(false)}
                                                    className="bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleUpdateSubscription}
                                                    disabled={isUpdateSubmitting || !selectedPlan || !selectedPmForSubscription}
                                                    className="bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-8 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center gap-2"
                                                >
                                                    {isUpdateSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    Update Subscription Plan
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCancelPlanModalOpen} onOpenChange={setIsCancelPlanModalOpen}>
                    <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 sm:p-8 dark:bg-gray-950 border-blue-50 dark:border-gray-800 rounded-2xl sm:rounded-3xl gap-6">
                        <DialogHeader className="p-0 space-y-2 text-left">
                            <DialogTitle className="text-[22px] font-bold text-slate-900 dark:text-gray-100 text-center">
                                Cancel plan confirmation
                            </DialogTitle>
                            <p className="text-[14px] text-slate-500 dark:text-gray-400 leading-relaxed font-medium text-center pt-2">
                                Are you sure you want to cancel your current subscription plan?
                            </p>
                        </DialogHeader>

                        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                            <Button
                                onClick={() => setIsCancelPlanModalOpen(false)}
                                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-slate-900 font-bold px-6 py-2.5 rounded-2xl border-none shadow-none text-[15px] transition-colors dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 h-auto order-2 sm:order-1"
                                disabled={isCancellingPlan}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCancelPlan}
                                disabled={isCancellingPlan}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-violet-500 hover:from-blue-500 hover:to-violet-400 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 text-white px-6 py-2.5 rounded-2xl text-[15px] font-bold transition-colors h-auto flex items-center justify-center gap-2 order-1 sm:order-2"
                            >
                                {isCancellingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                                Continue
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={!!successDetail} onOpenChange={() => setSuccessDetail(null)}>
                    <AlertDialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[400px] p-6 rounded-2xl dark:bg-gray-950 border-blue-50 dark:border-gray-800">
                        <AlertDialogHeader>
                            <div className="flex justify-center items-center gap-3 mb-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <AlertDialogTitle className="text-lg font-bold text-green-600 dark:text-green-400">
                                    Success
                                </AlertDialogTitle>
                            </div>
                            <AlertDialogDescription className="text-sm text-slate-500 dark:text-gray-400 font-medium pt-2 text-center">
                                {successDetail}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-4">
                            <AlertDialogAction
                                onClick={() => setSuccessDetail(null)}
                                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-colors h-auto border-none"
                            >
                                Continue
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Placeholder for more content to make it look full */}
                {/* <div className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-50 dark:border-gray-700 shadow-lg shadow-blue-500/10 p-8 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg flex items-center justify-center mb-4 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                        <BarChart3 className="text-gray-400 dark:text-gray-500" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Analysis coming soon</h3>
                    <p className="text-slate-500 dark:text-gray-400 text-center max-w-sm mt-2">
                        We're processing your data to provide deep insights into your call performance and user engagement.
                    </p>
                </div> */}
            </div>
        </main>
    );
}
