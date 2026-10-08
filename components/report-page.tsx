"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X, ArrowLeft, Phone, CheckCircle2, Users, Clock, Check, Minus, ShieldAlert } from "lucide-react"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { interviewService } from "@/services/interview-service"
import { flowService } from "@/services/flow-service"
import { profileService } from "@/services/profile-service"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Interfaces based on user provided JSON structure
interface ChatMessage {
    role?: string
    content?: string
    sender?: string
    message?: string
    timestamp?: string
}

interface DisplayReportItem {
    id: number
    reports_uid?: string
    uid: string
    candidate_id: number
    candidate_name: string
    candidate_email: string
    candidate_phone: string
    started_at: string | null
    ai_decision: string
    status: string
    updated_at: string
    conversation_json: ChatMessage[]
    is_retry: boolean
}

interface DinerReportItem {
    id: number
    uid: string
    created_at: string
    updated_at: string
    call_sid: string
    from_number: string
    to_number: string
    booking_confirmed: boolean
    customer_name: string | null
    party_size: string
    reservation_date: string | null
    reservation_time: string | null
    conversation_json: ChatMessage[] | null
    organization: number
}

interface ReportPageProps {
    featureUid?: string
}

const RETRY_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
    label: `${(i + 1) * 5} person`,
    value: (i + 1) * 5
}))

export default function ReportPage({ featureUid }: ReportPageProps) {
    const { toast } = useToast()
    const [isChatModalOpen, setIsChatModalOpen] = useState(false)
    const [isRecallModalOpen, setIsRecallModalOpen] = useState(false)
    const [recallLimit, setRecallLimit] = useState("5")
    const [isRecalling, setIsRecalling] = useState(false)

    // Result Dialog State
    const [showResultDialog, setShowResultDialog] = useState(false)
    const [resultMessage, setResultMessage] = useState("")
    const [resultTitle, setResultTitle] = useState("")

    // Main Reports State
    const [reports, setReports] = useState<DisplayReportItem[]>([])
    const [dinerReports, setDinerReports] = useState<DinerReportItem[]>([])
    const [isDiner, setIsDiner] = useState(false)
    const [loading, setLoading] = useState(true)
    const [featureName, setFeatureName] = useState("Reports")
    const [totalCount, setTotalCount] = useState(0)
    const [selectedInterview, setSelectedInterview] = useState<DisplayReportItem | null>(null)
    const [selectedDinerReport, setSelectedDinerReport] = useState<DinerReportItem | null>(null)
    const [analytics, setAnalytics] = useState<any>({
        total_calls: 0,
        screening_calls_completed: 0,
        green_candidates: 0,
        consultant_hours_saved: 0
    })
    const [currentUserRole, setCurrentUserRole] = useState("")
    const router = useRouter()
    const searchParams = useSearchParams()

    const pageParam = searchParams.get("page")
    const currentPage = pageParam ? Number(pageParam) : 1
    const pageSize = 20
    const totalPages = Math.ceil(totalCount / pageSize)

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", String(newPage))
        router.push(`?${params.toString()}`)
    }

    const renderPageNumbers = () => {
        const pages = []
        const maxVisible = 5
        let startPage = Math.max(1, currentPage - 2)
        let endPage = Math.min(totalPages, startPage + maxVisible - 1)

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1)
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <Button
                    key={i}
                    variant={currentPage === i ? "default" : "outline"}
                    size="sm"
                    className={`h-9 w-9 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                        currentPage === i
                            ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => handlePageChange(i)}
                >
                    {i}
                </Button>
            )
        }
        return pages
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)

                try {
                    const orgRes = await profileService.getOrganization()
                    if (orgRes.data && orgRes.data.role) {
                        setCurrentUserRole(orgRes.data.role)
                    }
                } catch (e) {
                    console.error("Error fetching organization in report-page:", e)
                }

                let currentFlowCode = searchParams.get("code") || ""
                if (currentFlowCode === "AICALL191") {
                    setIsDiner(true)
                    setFeatureName("AI Diner Ordering Assistant")
                }

                if (currentFlowCode === "AICALL191") {
                    const res = await flowService.getDinerReports()
                    setDinerReports(res.data.results)
                } else {
                    // Fetch Call Interview Data
                    const reportsRes = await interviewService.getInterviews(currentPage)

                    const normalized = reportsRes.data.results.map((item: any) => ({
                        id: item.id,
                        reports_uid: item.uid,
                        uid: item.uid,
                        candidate_id: item.candidate_id,
                        candidate_name: item.candidate_name,
                        candidate_email: item.candidate_email,
                        candidate_phone: item.candidate_phone,
                        started_at: item.started_at,
                        status: item.status,
                        ai_decision: item.ai_decision,
                        updated_at: item.updated_at,
                        conversation_json: item?.conversation_json || [],
                        is_retry: item.is_retry
                    }))
                    setReports(normalized)
                    setTotalCount(reportsRes.data.count || 0)

                    try {
                        const analyticsRes = await interviewService.getInterviewAnalytics()
                        if (analyticsRes.data) {
                            setAnalytics(analyticsRes.data)
                        }
                    } catch (analyticsError) {
                        console.error("Error fetching analytics:", analyticsError)
                    }
                }

            } catch (error) {
                console.error("Error fetching data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [featureUid, searchParams, currentPage])

    const handleViewChat = (item: DisplayReportItem | DinerReportItem) => {
        if ("candidate_name" in item) {
            setSelectedInterview(item)
            setSelectedDinerReport(null)
        } else {
            setSelectedDinerReport(item)
            setSelectedInterview(null)
        }
        setIsChatModalOpen(true)
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString || dateString === "None") return "-"
        try {
            return new Date(dateString).toLocaleString()
        } catch (e) {
            return dateString
        }
    }

    const handleRecall = async () => {
        try {
            setIsRecalling(true)
            await interviewService.retryInterviews(Number(recallLimit))
            setResultTitle("Success")
            setResultMessage("Retry call process started successfully.")
            setShowResultDialog(true)
            setIsRecallModalOpen(false)
        } catch (error: any) {
            console.error("Error retrying calls:", error)
            setResultTitle("Error")
            const errorMessage = error.response?.data?.error || "Failed to initiate retry calls."
            const aiDecision = error.response?.data?.ai_decision
            setResultMessage(aiDecision ? `${errorMessage} (AI Decision: ${aiDecision})` : errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsRecalling(false)
        }
    }

    const handleSingleRecall = async (uid?: string) => {
        if (!uid) return
        try {
            setIsRecalling(true)
            await interviewService.retrySingleInterview(uid)
            setResultTitle("Success")
            setResultMessage("Recall initiated successfully.")
            setShowResultDialog(true)
        } catch (error: any) {
            console.error("Error recalling interview:", error)
            setResultTitle("Error")
            const errorMessage = error.response?.data?.error || "Failed to initiate recall."
            const aiDecision = error.response?.data?.ai_decision
            setResultMessage(aiDecision ? `${errorMessage} (AI Decision: ${aiDecision})` : errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsRecalling(false)
        }
    }

    const statCards = [
        {
            title: "Total AI Calls",
            value: String(analytics?.total_calls ?? 0),
            icon: Phone,
            iconColor: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
            title: "Screening Calls Completed",
            value: String(analytics?.screening_calls_completed ?? 0),
            icon: CheckCircle2,
            iconColor: "text-green-600 dark:text-green-400",
            bgColor: "bg-green-50 dark:bg-green-900/20",
        },
        {
            title: "Green Applicants",
            value: String(analytics?.green_candidates ?? 0),
            icon: Users,
            iconColor: "text-purple-600 dark:text-purple-400",
            bgColor: "bg-purple-50 dark:bg-purple-900/20",
        },
        {
            title: "Consultant hours Saved",
            value: `${analytics?.consultant_hours_saved ?? 0} hours`,
            icon: Clock,
            iconColor: "text-orange-600 dark:text-orange-400",
            bgColor: "bg-orange-50 dark:bg-orange-900/20",
        },
    ];

    if (currentUserRole === 'VOIP_USER') {
        return (
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
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
                        You do not have authorization to view reports for this call flow. Your account is configured for VoIP Business Line operations.
                    </p>
                    <Button
                        onClick={() => router.push('/dashboard/phone-call-flows')}
                        className="w-full bg-[#0f172a] dark:bg-gray-100 hover:bg-[#1e293b] dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold h-11 rounded-lg text-sm transition-all shadow-sm"
                    >
                        Go to AI Call Builder
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
            <LoaderOverlay isLoading={loading || isRecalling} message={isRecalling ? "Processing..." : "Loading records..."} />

            {!isDiner && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {statCards.map((card, index) => (
                        <div
                            key={index}
                            className="group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
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
                                        className={`relative grid h-12 w-12 place-items-center rounded-2xl ${card.bgColor} ${card.iconColor} shadow-sm ring-1 ring-black/5 dark:ring-white/10`}
                                    >
                                        <div className="absolute inset-0 rounded-2xl opacity-40 blur-lg" />
                                        <card.icon size={22} />
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                            {card.title}
                                        </p>
                                        <div className="text-xl font-medium tracking-tight text-gray-900 dark:text-white">
                                            {card.value}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold gradient-text mb-2">
                        {featureName}
                    </h1>
                    <p className="text-muted-foreground">
                        {isDiner ? `View reservation records for the ${featureName}.` : `View automation interview records for the ${featureName}.`}
                    </p>
                </div>
                {/* {!isDiner && (
                    <Button
                        onClick={() => setIsRecallModalOpen(true)}
                        className="gradient-bg text-white shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 border-0 cursor-pointer"
                    >
                        Retry Call Interview
                    </Button>
                )} */}
            </div>

            <div className="border rounded-lg bg-card overflow-hidden mb-8">
                <Table>
                    <TableHeader>
                        {isDiner ? (
                            <TableRow className="bg-indigo-50/80 dark:bg-white/5 hover:bg-indigo-50/80 sticky top-0">
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">ID</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Customer Name</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Party Size</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Reservation Date</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Reservation Time</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Status</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200 text-nowrap">Actions</TableHead>
                            </TableRow>
                        ) : (
                            <TableRow className="bg-indigo-50/80 dark:bg-white/5 hover:bg-indigo-50/80 sticky top-0">
                                {/* <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Interview ID</TableHead> */}
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Candidate ID</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Candidate Name</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Candidate Email</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Candidate Mobile</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Recall</TableHead>
                                {/* <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">First Message Sent At</TableHead> */}
                                {/* <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Status</TableHead> */}
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">AI Decision</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Updated At</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Chat History</TableHead>
                                {/* <TableHead className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">Retry call Interview</TableHead> */}
                            </TableRow>
                        )}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={isDiner ? 7 : 8} className="text-center h-24">Loading records...</TableCell>
                            </TableRow>
                        ) : (isDiner ? dinerReports.length === 0 : reports.length === 0) ? (
                            <TableRow>
                                <TableCell colSpan={isDiner ? 7 : 8} className="text-center h-24">No records found.</TableCell>
                            </TableRow>
                        ) : isDiner ? (
                            dinerReports.map((row) => (
                                <TableRow key={row.id} className="hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-colors animate-fade-up">
                                    <TableCell className="text-sm">{row.uid}</TableCell>
                                    <TableCell className="text-sm font-medium">{row.customer_name || "-"}</TableCell>
                                    <TableCell className="text-sm">{row.party_size}</TableCell>
                                    <TableCell className="text-sm">{row.reservation_date || "-"}</TableCell>
                                    <TableCell className="text-sm">{row.reservation_time || "-"}</TableCell>
                                    <TableCell className="text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.booking_confirmed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                                            {row.booking_confirmed ? "Confirmed" : "Pending"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="link"
                                                className="text-primary hover:underline p-0 h-auto cursor-pointer"
                                                onClick={() => handleViewChat(row)}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                variant="link"
                                                className="text-[#64748b] dark:text-gray-400 hover:underline p-0 h-auto cursor-pointer font-semibold"
                                            >
                                                Change Status
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            reports.map((row) => (
                                <TableRow key={row.id} className="hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-colors animate-fade-up">
                                    {/* <TableCell className="text-sm">{row.uid}</TableCell> */}
                                    <TableCell className="text-sm">{row.candidate_id}</TableCell>
                                    <TableCell className="text-sm">{row.candidate_name}</TableCell>
                                    <TableCell className="text-sm">{row.candidate_email}</TableCell>
                                    <TableCell className="text-sm">{row.candidate_phone}</TableCell>
                                    <TableCell className="text-sm">
                                        {row.is_retry ? (
                                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        ) : (
                                            <Minus className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                        )}
                                    </TableCell>
                                    {/* <TableCell className="text-sm">{formatDate(row.started_at)}</TableCell> */}
                                    {/* <TableCell className="text-sm">{row.status}</TableCell> */}
                                    <TableCell className="text-sm">
                                        {row.ai_decision?.toLowerCase() === "successful"
                                            ? "Successful"
                                            : row.ai_decision?.toLowerCase() === "unsuccessful"
                                            ? "Unsuccessful"
                                            : "No Answer"}
                                    </TableCell>
                                    <TableCell className="text-sm">{formatDate(row.updated_at)}</TableCell>
                                    <TableCell className="text-sm">
                                        <Button
                                            variant="link"
                                            className="text-primary hover:underline p-0 h-auto cursor-pointer"
                                            onClick={() => handleViewChat(row)}
                                        >
                                            View
                                        </Button>
                                    </TableCell>
                                    {/* <TableCell className="text-sm">
                                        {!(row.status === "COMPLETED" && row.ai_decision === "successful") && (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="cursor-pointer"
                                                onClick={() => handleSingleRecall(row.reports_uid)}
                                                disabled={isRecalling}
                                            >
                                                Recall
                                            </Button>
                                        )}
                                    </TableCell> */}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {!isDiner && totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 mb-8 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm animate-in fade-in duration-300">
                    <div className="text-sm font-medium text-muted-foreground">
                        Showing{" "}
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">
                            {Math.min(totalCount, (currentPage - 1) * pageSize + 1)}
                        </span>{" "}
                        to{" "}
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">
                            {Math.min(totalCount, currentPage * pageSize)}
                        </span>{" "}
                        of <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-200">{totalCount}</span> entries
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 rounded-xl font-semibold border-indigo-100 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {renderPageNumbers()}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 rounded-xl font-semibold border-indigo-100 dark:border-white/10 bg-white/70 dark:bg-white/5 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            <Button
                variant="ghost"
                className="text-primary bg-primary/30 hover:bg-black hover:text-white mt-4 cursor-pointer"
                onClick={() => router.back()}
            >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
            </Button>

            {/* Chat History Modal */}
            <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
                <DialogContent className="max-w-xl p-0 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-xl font-bold gradient-text">Chat History</h2>
                    </div>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {(isDiner ? selectedDinerReport?.conversation_json : selectedInterview?.conversation_json) && (isDiner ? (selectedDinerReport?.conversation_json?.length || 0) > 0 : (selectedInterview?.conversation_json?.length || 0) > 0) ? (
                            (isDiner ? selectedDinerReport?.conversation_json : selectedInterview!.conversation_json)!.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === "assistant" || msg.sender === "ai" ? "justify-start" : "justify-end"}`}>
                                    <div
                                        className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed shadow-sm ${msg.role === "assistant" || msg.sender === "ai"
                                            ? "bg-[#ebf0f5] text-foreground rounded-tl-none border border-slate-200"
                                            : "bg-[#5fa0d6] text-white rounded-tr-none"
                                            }`}
                                    >
                                        {msg.content || msg.message}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground">No chat history available.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Recall Modal */}
            <Dialog open={isRecallModalOpen} onOpenChange={setIsRecallModalOpen}>
                <DialogContent className="max-w-md">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold gradient-text">Recall</h2>
                        {/* <button
                            onClick={() => setIsRecallModalOpen(false)}
                            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                            <span className="sr-only">Close</span>
                        </button> */}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select number of recently disconnected candidates to call</Label>
                            <Select value={recallLimit} onValueChange={setRecallLimit}>
                                <SelectTrigger className="w-full mt-1 h-8 text-xs pr-8">
                                    <SelectValue placeholder="Select count" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RETRY_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={handleRecall}
                                disabled={isRecalling}
                                className="gradient-bg text-white shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 border-0 cursor-pointer"
                            >
                                {isRecalling ? "Processing..." : "Recall"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
        </div>
    )
}
