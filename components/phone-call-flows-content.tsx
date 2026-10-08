"use client"

import { useState, useEffect } from "react"
import { MoreHorizontal, Globe, Loader2, Bookmark, Settings2, CheckCircle2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import { ToastNotification } from "@/components/auth/toast-notification"
import { useRouter } from "next/navigation"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { BASE_URL } from "@/lib/baseUrl";
import { cookieUtils } from "@/services/auth-service";
import { profileService } from "@/services/profile-service";

interface Flow {
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

interface MyFlowItem {
    id: number;
    uid: string;
    status: string;
    organization: number;
    flow: Flow;
}

export function PhoneCallFlowsContent() {
    const [isLoading, setIsLoading] = useState(true)
    const [myFlows, setMyFlows] = useState<MyFlowItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [toast, setToast] = useState<any>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string>("")

    const [isUnauthorizedOpen, setIsUnauthorizedOpen] = useState(false)
    const [unauthorizedTitle, setUnauthorizedTitle] = useState("Access Restricted")
    const [unauthorizedDescription, setUnauthorizedDescription] = useState("")

    const router = useRouter()

    const [showResultDialog, setShowResultDialog] = useState(false)
    const [resultMessage, setResultMessage] = useState("")
    const [resultTitle, setResultTitle] = useState("")

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)

    useEffect(() => {
        fetchMyFlows()
        fetchUserRole()
    }, [])

    const fetchUserRole = async () => {
        try {
            const orgRes = await profileService.getOrganization();
            if (orgRes.data && orgRes.data.role) {
                setCurrentUserRole(orgRes.data.role);
            }
        } catch (err) {
            console.error("Error fetching user role in phone call flows:", err);
        }
    }

    const fetchMyFlows = async () => {
        try {
            setIsLoading(true)
            const token = cookieUtils.get("access");
            const response = await fetch(`${BASE_URL}/flows/available-flow/my_flows`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setMyFlows(data.results || [])
            } else {
                setError("Failed to load flows")
            }
        } catch (err: any) {
            console.error("Error fetching flows:", err)
            setError("Failed to load flows")
        } finally {
            setIsLoading(false)
        }
    }

    const handleConfigureClick = (uid: string, name: string, code: string) => {
        const isVoipFlow = Boolean(name?.toLowerCase().includes("voip") || code?.toLowerCase().includes("voip"));
        if (currentUserRole === "VOIP_USER" && !isVoipFlow) {
            setUnauthorizedTitle("Access Restricted");
            setUnauthorizedDescription("You do not have authorization to configure this call flow. Your account role (VOIP_USER) is restricted to VoIP Business Line operations.");
            setIsUnauthorizedOpen(true);
            return;
        }

        if (isVoipFlow) {
            router.push(`/dashboard/voip/${uid}`)
            return
        }
        router.push(`/dashboard/configure/${uid}?name=${encodeURIComponent(name)}&code=${code}`)
    }

    const handleReportsClick = (uid: string, name: string, code: string) => {
        const isVoipFlow = Boolean(name?.toLowerCase().includes("voip") || code?.toLowerCase().includes("voip"));
        if (currentUserRole === "VOIP_USER" && !isVoipFlow) {
            setUnauthorizedTitle("Access Restricted");
            setUnauthorizedDescription("You do not have authorization to view reports for this call flow. Your account role (VOIP_USER) is restricted to VoIP Business Line operations.");
            setIsUnauthorizedOpen(true);
            return;
        }

        if (isVoipFlow) {
            router.push(`/dashboard/voip-reports/${uid}`);
        } else if (code === "AICALL191") {
            router.push(`/dashboard/report?code=${code}`);
        } else {
            router.push(`/dashboard/report/${uid}`);
        }
    }

    const handleFlowOptionsClick = (e: React.MouseEvent) => {
        if (currentUserRole === "VOIP_USER") {
            e.preventDefault();
            setUnauthorizedTitle("Access Restricted");
            setUnauthorizedDescription("You do not have authorization to access AI Call Flow Options. Your account role (VOIP_USER) is restricted to VoIP Business Line operations.");
            setIsUnauthorizedOpen(true);
        }
    }

    const FlowCard = ({ item }: { item: MyFlowItem }) => {
        const { flow } = item;
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-200">
                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex gap-4 items-start mb-6">
                        <div className="w-14 h-20 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-700 flex-shrink-0">
                            <img src={flow.picture} alt={flow.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="sm:text-lg md:text-base lg:text-lg text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight mt-1">{flow.name}</h3>
                                <button
                                    onClick={() => {
                                        setSelectedFlow(flow);
                                        setIsDetailsOpen(true);
                                    }}
                                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <span className="text-sm font-medium underline">More</span>
                                </button>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm md:text-[13px] lg:text-[15px] leading-relaxed mb-0">
                                {flow.flow_summary}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-row md:flex-row lg:flex-row gap-2.5 mt-auto">
                        <Button
                            className="bg-[#0f172a] dark:bg-gray-100 hover:bg-[#1e293b] dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold h-11 px-8 rounded-lg text-sm transition-all shadow-sm w-full "
                            onClick={() => handleConfigureClick(item.uid, flow.name, flow.code)}
                        >
                            Configure
                        </Button>
                        <Button
                            onClick={() => handleReportsClick(item.uid, flow.name, flow.code)}
                            className="bg-[#e2e8f0] dark:bg-gray-700 hover:bg-[#cbd5e1] dark:hover:bg-gray-600 text-[#64748b] dark:text-gray-300 font-semibold h-11 px-8 rounded-lg text-sm transition-all border-none w-full"
                        >
                            {flow.code === "AICALL191" ? "Reservations" : "Reports"}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
            {toast && (
                <ToastNotification
                    title={toast.title}
                    description={toast.description}
                    variant={toast.variant}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="max-w-7xl mx-auto space-y-12">
                <div className="flex flex-row justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-bold tracking-tight gradient-text">AI Call Builder</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Enable and manage your AI-powered call flows.</p>
                    </div>
                    <div>
                        <Link href="/dashboard/ai-call-flow-options" onClick={handleFlowOptionsClick}>
                            <button
                                className="bg-white border border-black dark:bg-gray-100 text-black dark:text-gray-900 text-xs transition-all duration-200 gap-2 flex justify-center items-center rounded-md px-2 py-2 text-base"
                            >
                                <Globe className="w-4 h-4 text-green-600" />
                                AI Call Flow Options
                            </button>
                        </Link>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-md font-semibold text-gray-900 dark:text-gray-100">Your Flows</h2>
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{myFlows.length}</span>
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            <p className="text-gray-500 font-medium">Fetching your flows...</p>
                        </div>
                    ) : myFlows.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
                            <p className="text-gray-500 dark:text-gray-400 font-medium">You haven't selected any flows yet.</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Choose from available flows in the Flow Store.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
                            {myFlows.map(item => (
                                <FlowCard key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Unauthorized / Access Restricted Dialog */}
            <AlertDialog open={isUnauthorizedOpen} onOpenChange={setIsUnauthorizedOpen}>
                <AlertDialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-w-md rounded-2xl p-6">
                    <AlertDialogHeader className="flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
                            <ShieldAlert className="w-7 h-7" />
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 mb-1">
                            Role: VOIP_USER
                        </span>
                        <AlertDialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {unauthorizedTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                            {unauthorizedDescription}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center mt-5">
                        <AlertDialogAction
                            onClick={() => setIsUnauthorizedOpen(false)}
                            className="bg-[#0f172a] dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-[#1e293b] dark:hover:bg-gray-200 font-semibold px-8 py-2 rounded-lg text-sm transition-all"
                        >
                            Understood
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={resultTitle === "Error" ? "text-destructive dark:text-red-400" : "text-primary dark:text-green-400"}>
                            {resultTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base dark:text-gray-400 font-medium">
                            {resultMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowResultDialog(false)} className="dark:bg-gray-100 dark:text-gray-900">
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Flow Details Modal */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[700px] w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 rounded-2xl">
                    {selectedFlow && (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                                    {/* Image left from Name */}
                                    <div className="w-24 h-32 border border-indigo-100 dark:border-white/10 rounded-xl shadow-md shadow-indigo-500/10 overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-900">
                                        <img src={selectedFlow.picture} alt={selectedFlow.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="space-y-2 flex-grow">
                                        <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                            {selectedFlow.name}
                                        </DialogTitle>
                                        <div className="flex flex-row flex-wrap gap-2 justify-center sm:justify-start">
                                            <div className="flex items-center text-xs text-gray-500 font-medium capitalize">
                                                <span className="bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-200 font-medium">{selectedFlow.call_direction} Call</span>
                                            </div>
                                            <div className="flex items-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                                                <span className="bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-200 font-medium">{selectedFlow.flow_category.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
                                            {selectedFlow.flow_summary}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Modal Content */}
                            <div className="flex-1 overflow-y-auto">
                                {/* Modal Body */}
                                <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 bg-gray-50/50 dark:bg-gray-950/50">
                                    {/* How It Works - Left side */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">How It Works</h3>
                                        </div>
                                        <ul className="space-y-3">
                                            {(selectedFlow.how_works || []).length === 0 ? (
                                                <li className="text-xs text-gray-500 italic">No specific steps defined.</li>
                                            ) : (
                                                (selectedFlow.how_works || []).map((step, index) => (
                                                    <li key={index} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 group">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-semibold mt-0.5 border border-blue-600/20 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                            {index + 1}
                                                        </span>
                                                        <span className="group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors leading-normal text-left">{step}</span>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    </div>

                                    {/* Required Resources - Right side from How It Works */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            </div>
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Required Resources</h3>
                                        </div>
                                        <ul className="space-y-3">
                                            {(selectedFlow.required_resources || []).length === 0 ? (
                                                <li className="text-xs text-gray-500 italic">No additional resources required.</li>
                                            ) : (
                                                (selectedFlow.required_resources || []).map((resource, index) => (
                                                    <li key={index} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 group">
                                                        <div className="mt-1 flex-shrink-0">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 group-hover:bg-green-500 transition-colors" />
                                                        </div>
                                                        <span className="group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors leading-normal text-left">{resource}</span>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Compatible CRM Section */}
                            <div className="p-6 flex flex-col gap-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
                                <div className="flex flex-col gap-1 text-center sm:text-left">
                                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Compatible CRM</h4>
                                </div>
                                <div className="flex justify-center sm:justify-start">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 border border-indigo-100 dark:border-white/10 rounded-2xl p-2.5 flex items-center justify-center bg-white/80 dark:bg-white/5 shadow-md shadow-indigo-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                            <img src="/images/JobAdder.jpg" alt="JobAdder" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="w-14 h-14 border border-indigo-100 dark:border-white/10 rounded-2xl p-2.5 flex items-center justify-center bg-white/80 dark:bg-white/5 shadow-md shadow-indigo-500/10 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                            <img src="/images/Bullhornconnector.jpg" alt="Bullhorn" className="w-full h-full object-contain" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </main>
    )
}

