"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { AICallFlowDetailsContent } from "@/components/ai-call-flow-details-content"
import { authService, cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service";
import { BASE_URL } from "@/lib/baseUrl";
import { Loader2 } from "lucide-react"

interface FlowResult {
    id: number;
    uid: string;
    name: string;
    picture: string;
    call_direction: string;
    flow_category: string;
    flow_summary: string;
    how_works: string[];
    applicable_crms: string[];
    required_resources: string[];
    code: string;
    status: string;
    is_connected: boolean;
}

export default function AICallFlowDetailsPage({ params }: { params: Promise<{ uid: string }> }) {
    const { uid } = use(params)
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [flow, setFlow] = useState<FlowResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const checkAuthAndFetchFlow = async () => {
            const accessToken = cookieUtils.get('access');
            const refreshToken = cookieUtils.get('refresh');

            if (!accessToken || !refreshToken) {
                router.push("/login")
                return
            }

            try {
                const verifyRes = await authService.verifyToken(accessToken)
                let currentToken = accessToken;

                if (!verifyRes.ok) {
                    const refreshRes = await authService.refreshToken(refreshToken)
                    if (!refreshRes.ok) {
                        router.push("/login")
                        return
                    }
                    const data = await refreshRes.json();
                    cookieUtils.set('access', data.access, 7);
                    cookieUtils.set('refresh', data.refresh, 7);
                    currentToken = data.access;
                }

                const statusRes = await profileService.getPlatformStatus();
                const complianceStatus = statusRes.data.compliance_status;
                if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                    router.push("/activation");
                    return;
                }

                // Fetch flow details
                const flowResponse = await fetch(`${BASE_URL}/flows/available-flow/`, {
                    headers: {
                        'Authorization': `Bearer ${currentToken}`
                    }
                });

                if (flowResponse.ok) {
                    const data = await flowResponse.json();
                    if (data.results && Array.isArray(data.results)) {
                        const foundFlow = data.results.find((f: FlowResult) => f.uid === uid);
                        if (foundFlow) {
                            setFlow(foundFlow);
                        } else {
                            setError("Flow not found in the list");
                        }
                    } else {
                        setError("Invalid data structure received from API");
                    }
                } else {
                    setError("Failed to fetch flow details");
                }

            } catch (err) {
                console.error("Error in checkAuthAndFetchFlow:", err);
                setError("An error occurred");
            } finally {
                setIsLoading(false)
            }
        }

        checkAuthAndFetchFlow()

        const checkViewport = () => {
            setIsTabletOrLarger(window.innerWidth >= 1024)
        }

        checkViewport()
        window.addEventListener("resize", checkViewport)
        return () => window.removeEventListener("resize", checkViewport)
    }, [router, uid])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white" />
            </div>
        )
    }

    if (error || !flow) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-950 gap-4">
                <p className="text-red-500 font-medium">{error || "Flow not found"}</p>
                <button onClick={() => router.back()} className="text-blue-600 hover:underline">Go Back</button>
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

                <main className="flex-1 overflow-y-auto">
                    <AICallFlowDetailsContent flow={flow} />
                </main>
            </div>
        </div>
    )
}
