"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { PhoneCallFlowsContent } from "@/components/phone-call-flows-content"
import { authService, cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service";
import { Clock, Phone } from "lucide-react";

export default function PhoneCallFlowsPage() {
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [blockedStep, setBlockedStep] = useState<'verification_pending' | 'platform_activation_required' | 'phone_number_required' | 'subscription_plan_required' | 'ats_connection_required' | null>(null)

    useEffect(() => {
        const checkAuth = async () => {
            const accessToken = cookieUtils.get('access');
            const refreshToken = cookieUtils.get('refresh');

            if (!accessToken || !refreshToken) {
                router.push("/login")
                return
            }

            const verifyRes = await authService.verifyToken(accessToken)
            if (verifyRes.ok) {
                const statusRes = await profileService.getPlatformStatus();
                const complianceStatus = statusRes.data.compliance_status;
                if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                    router.push("/activation");
                    return;
                }
                if (complianceStatus === "pending") {
                    setBlockedStep('verification_pending');
                } else if (statusRes.data.is_platform_activated !== true) {
                    setBlockedStep('platform_activation_required');
                } else if (statusRes.data.have_any_phone_number !== true) {
                    setBlockedStep('phone_number_required');
                } else if (statusRes.data.is_purchased_anything !== true) {
                    setBlockedStep('subscription_plan_required');
                } else if (statusRes.data.is_ats_connected !== true) {
                    setBlockedStep('ats_connection_required');
                } else {
                    setBlockedStep(null);
                }
            } else {
                const refreshRes = await authService.refreshToken(refreshToken)
                if (!refreshRes.ok) {
                    router.push("/login")
                    return
                }
                const data = await refreshRes.json();
                cookieUtils.set('access', data.access, 7);
                cookieUtils.set('refresh', data.refresh, 7);

                const statusRes = await profileService.getPlatformStatus();
                const complianceStatus = statusRes.data.compliance_status;
                if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                    router.push("/activation");
                    return;
                }
                if (complianceStatus === "pending") {
                    setBlockedStep('verification_pending');
                } else if (statusRes.data.is_platform_activated !== true) {
                    setBlockedStep('platform_activation_required');
                } else if (statusRes.data.have_any_phone_number !== true) {
                    setBlockedStep('phone_number_required');
                } else if (statusRes.data.is_purchased_anything !== true) {
                    setBlockedStep('subscription_plan_required');
                } else if (statusRes.data.is_ats_connected !== true) {
                    setBlockedStep('ats_connection_required');
                } else {
                    setBlockedStep(null);
                }
            }
            setIsLoading(false)
        }

        checkAuth()

        const checkViewport = () => {
            setIsTabletOrLarger(window.innerWidth >= 1024)
        }

        checkViewport()
        window.addEventListener("resize", checkViewport)
        return () => window.removeEventListener("resize", checkViewport)
    }, [router])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white" />
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar
                isOpen={isTabletOrLarger || isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Topbar
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                {blockedStep === 'verification_pending' ? (
                    <main className="flex-1 flex items-center justify-center p-4 bg-gray-50/50 dark:bg-gray-950">
                        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Clock className="w-8 h-8 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Verification Pending</h2>
                                <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                                    Your Business data is still waiting for verification. Please come back later.
                                </p>
                            </div>
                        </div>
                    </main>
                ) : blockedStep === 'platform_activation_required' ? (
                    <main className="flex-1 flex items-center justify-center p-4 bg-gray-50/50 dark:bg-gray-950">
                        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Clock className="w-8 h-8 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Platform Activation Required</h2>
                                <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                                    To access AI Phone Numbers, please complete the Platform Activation setup fee payment first.
                                </p>
                            </div>
                        </div>
                    </main>
                ) : blockedStep === 'phone_number_required' ? (
                    <main className="flex-1 flex items-center justify-center p-4 bg-gray-50/50 dark:bg-gray-950">
                        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Phone className="w-8 h-8 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Phone Number Required</h2>
                                <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                                    To configure your AI Call Builder flows, please purchase an Phone Number first.
                                </p>
                            </div>
                        </div>
                    </main>
                ) : blockedStep === 'subscription_plan_required' ? (
                    <main className="flex-1 flex items-center justify-center p-4 bg-gray-50/50 dark:bg-gray-950">
                        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Clock className="w-8 h-8 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Subscription Plan Required</h2>
                                <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                                    To connect your ATS integrations, please select a subscription plan first.
                                </p>
                            </div>
                        </div>
                    </main>
                ) : blockedStep === 'ats_connection_required' ? (
                    <main className="flex-1 flex items-center justify-center p-4 bg-gray-50/50 dark:bg-gray-950">
                        <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Clock className="w-8 h-8 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">ATS Connection Required</h2>
                                <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                                    To configure your AI Call Builder flows, please connect your ATS integration first.
                                </p>
                            </div>
                        </div>
                    </main>
                ) : (
                    <PhoneCallFlowsContent />
                )}
            </div>
        </div>
    )
}
