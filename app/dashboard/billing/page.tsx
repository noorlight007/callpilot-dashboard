"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { BillingContent } from "@/components/billing-content"
import { authService, cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service";

export default function BillingPage() {
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [blockedStep, setBlockedStep] = useState<'verification_pending' | 'platform_activation_required' | 'phone_number_required' | null>(null)

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

                <BillingContent blockedStep={blockedStep} />
            </div>
        </div>
    )
}
