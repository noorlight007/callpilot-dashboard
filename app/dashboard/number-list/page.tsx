"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { NumberListPage } from "@/components/number-list-page"
import { authService, cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service";
import { Clock } from "lucide-react";

export default function MyNumbersListPage() {
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isMotherStepCompleted, setIsMotherStepCompleted] = useState<boolean | null>(null)

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
                setIsMotherStepCompleted(statusRes.data.is_platform_activated === true);
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
                setIsMotherStepCompleted(statusRes.data.is_platform_activated === true);
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

    if (isLoading || isMotherStepCompleted === null) {
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

                {!isMotherStepCompleted ? (
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
                ) : (
                    <NumberListPage />
                )}
            </div>
        </div>
    )
}
