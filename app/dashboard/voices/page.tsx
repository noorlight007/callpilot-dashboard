"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { flowService } from "@/services/flow-service"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { authService, cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service"
import { ArrowLeft, Volume2, Copy, Check, Play, Loader2, UserCheck, Filter } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Voice {
    voice_id: string
    name: string
    gender: string
    preview_url: string
    is_default: boolean
}

export default function VoicesPage() {
    const router = useRouter()
    const [voices, setVoices] = useState<Voice[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDataLoading, setIsDataLoading] = useState(true)
    const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isSelectConfirmOpen, setIsSelectConfirmOpen] = useState(false)
    const [voiceToSelect, setVoiceToSelect] = useState<Voice | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [genderFilter, setGenderFilter] = useState<string>("all")

    // Dashboard Layout State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)

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

    useEffect(() => {
        const fetchVoices = async () => {
            try {
                const response = await flowService.getVoices(genderFilter === "all" ? undefined : genderFilter)
                setVoices(response.data)
            } catch (error) {
                console.error("Error fetching voices:", error)
                toast.error("Failed to load voices")
            } finally {
                setIsDataLoading(false)
            }
        }
        if (!isLoading) {
            fetchVoices()
        }
    }, [isLoading, genderFilter])

    const handleCopy = (id: string) => {
        navigator.clipboard.writeText(id)
        setCopiedId(id)
        toast.success("Voice ID copied to clipboard")
        setTimeout(() => setCopiedId(null), 2000)
    }

    const openPreview = (voice: Voice) => {
        setSelectedVoice(voice)
        setIsPreviewOpen(true)
    }

    const handleSelectClick = (voice: Voice) => {
        setVoiceToSelect(voice)
        setIsSelectConfirmOpen(true)
    }

    const handleConfirmSelect = () => {
        if (voiceToSelect) {
            localStorage.setItem("selected_voice", JSON.stringify(voiceToSelect))
            toast.success(`Voice "${voiceToSelect.name}" selected!`)
            router.back()
        }
        setIsSelectConfirmOpen(false)
    }

    if (isLoading || isDataLoading) {
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

                <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => router.back()}
                                    className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <ArrowLeft className="h-6 w-6" />
                                </Button>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                        Choose ElevenLabs Voice
                                    </h1>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Listen and select a voice for your AI assistant
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm min-w-[200px]">
                                <div className="pl-2">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                                <Select value={genderFilter} onValueChange={setGenderFilter}>
                                    <SelectTrigger className="border-none shadow-none focus:ring-0 bg-transparent h-9 text-sm font-medium">
                                        <SelectValue placeholder="Filter by Gender" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-200 dark:border-gray-800">
                                        <SelectItem value="all" className="rounded-lg">All Genders</SelectItem>
                                        <SelectItem value="male" className="rounded-lg">Male</SelectItem>
                                        <SelectItem value="female" className="rounded-lg">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {isDataLoading ? (
                            <div className="flex items-center justify-center h-[50vh]">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                {voices.map((voice) => (
                                    <Card
                                        key={voice.voice_id}
                                        className="group overflow-hidden border-gray-200 dark:border-gray-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-md bg-white dark:bg-gray-900/50 backdrop-blur-sm"
                                    >
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate">
                                                            {voice.name}
                                                        </h3>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${voice.gender === 'male' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            voice.gender === 'female' ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' :
                                                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                            }`}>
                                                            {voice.gender}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => openPreview(voice)}
                                                        className="h-10 w-10 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                                    >
                                                        <Volume2 className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handleSelectClick(voice)}
                                                        className="h-10 w-10 rounded-xl border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-all"
                                                    >
                                                        <Check className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Volume2 className="h-5 w-5 text-blue-500" />
                            Voice Preview
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {selectedVoice && (
                            <>
                                <div className="text-center">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedVoice.name}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">{selectedVoice.gender}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <audio
                                        controls
                                        autoPlay
                                        className="w-full"
                                        key={selectedVoice.preview_url}
                                    >
                                        <source src={selectedVoice.preview_url} type="audio/mpeg" />
                                        Your browser does not support the audio element.
                                    </audio>
                                </div>
                                <div className="flex justify-center">
                                    <Button
                                        onClick={() => {
                                            setIsPreviewOpen(false)
                                        }}
                                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isSelectConfirmOpen} onOpenChange={setIsSelectConfirmOpen}>
                <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Confirm Voice Selection
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                            Are you sure you want to select <span className="font-semibold text-gray-900 dark:text-gray-100">"{voiceToSelect?.name}"</span> for your AI assistant?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmSelect}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                        >
                            Select
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
