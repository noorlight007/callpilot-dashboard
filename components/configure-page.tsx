"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TimezoneSelect } from "@/components/timezone-select"
import Link from "next/link"
import { useState, useEffect, useCallback, useRef } from "react"
import { flowService } from "@/services/flow-service"
import { profileService } from "@/services/profile-service"
import { Trash2, CheckCircle2, AlertCircle, ArrowLeft, Plus, Clock, Volume2, X, Loader2, ChevronDown, Search, ShieldAlert } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { WhatsappConfigModal } from "@/components/whatsapp-config-modal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ConfigurePageProps {
    featureUid?: string
}

interface InterviewStatus {
    id: number
    name: string
}

interface Platform {
    id: number
    uid: string
    platform: {
        name: string
    }
}

interface PhoneNumber {
    id: number
    uid: string
    phone_number: string
    friendly_name: string
}

interface QuestionInput {
    tempId: string
    uid?: string
    value: string
    isSaved: boolean
}

interface SuggestedQuestion {
    id: number
    uid: string
    question: string
    status: string
}

interface TimelineDay {
    day: string
    startTime: string
    endTime: string
    isActive: boolean
}

interface AppFeature {
    uid: string
    name: string
}

// Fixed dropdown options for calling time
const CALLING_TIME_OPTIONS = [
    { label: "5 min", value: 5 },
    { label: "10 min", value: 10 },
    { label: "15 min", value: 15 },
    { label: "20 min", value: 20 },
    { label: "25 min", value: 25 },
    { label: "30 min", value: 30 },
    { label: "35 min", value: 35 },
    { label: "40 min", value: 40 },
    { label: "45 min", value: 45 },
    { label: "50 min", value: 50 },
    { label: "55 min", value: 55 },
    { label: "60 min", value: 60 },
]

const TIME_OPTIONS = [
    ...Array.from({ length: 48 }, (_, i) => {
        const hours = Math.floor(i / 2)
        const minutes = i % 2 === 0 ? "00" : "30"
        const time = `${String(hours).padStart(2, '0')}:${minutes}:00`
        return { label: time.slice(0, 5), value: time }
    }),
    { label: "23:59", value: "23:59:00" }
]

const SPECIAL_ATS = [
    "JobAdder (Green Light)",
    "Recruit CRM (Green Light)",
    "Greenhouse (Green Light)",
    "iCIMS (Amber Light)",
    "Ashby (Green Light)"
]

const RAW_ATS_SYSTEMS = [
    "Bullhorn",
    "Salesforce CRM",
    "HubSpot CRM",
    "Lever",
    "Workable",
    "JazzHR",
    "Breezy HR",
    "Zoho Recruit",
    "SmartRecruiters",
    "Jobvite",
    "Pinpoint",
    "Fountain",
    "Loxo",
    "Vincere",
    "Firefish",
    "PCRecruiter",
    "Ceipal",
    "CATS",
    "Tracker",
    "Erecruit",
    "Avionté",
    "AkkenCloud",
    "Chameleon-i",
    "FastTrack",
    "TempWorks",
    "Workday Recruiting",
    "Taleo (Oracle)",
    "SuccessFactors (SAP)",
    "BrassRing (IBM)",
    "SilkRoad",
    "Cornerstone OnDemand",
    "PageUp",
    "PeopleFluent",
    "Tribepad",
    "Hireserve",
    "Netivate",
    "Recruitee",
    "Teamtailor",
    "Homerun",
    "Freshteam",
    "BambooHR ATS",
    "Rippling ATS",
    "Personio ATS",
    "Factorial ATS",
    "HiBob ATS",
    "GoHire",
    "Manatal",
    "Talentera",
    "Talent Reef",
    "Harver",
    "Outmatch",
    "Criteria Corp",
    "Codility",
    "HackerRank",
    "TestGorilla",
    "Vervoe",
    "SparkHire",
    "HireVue",
    "VidCruiter",
    "Willo",
    "Sonru",
    "Modern Hire",
    "Phenom",
    "Beamery",
    "Eightfold.ai",
    "SeekOut",
    "Hiretual",
    "Entelo",
    "Hired",
    "Vettery",
    "Underdog.io",
    "Triplebyte",
    "Turing",
    "Toptal",
    "Upwork",
    "Fiverr",
    "Freelancer",
    "Guru",
    "PeoplePerHour",
    "TxtSync",
    "Bullhorn Messaging",
    "Grayscale",
    "Sense",
    "Mya",
    "AllyO",
    "Paradox (Olivia)",
    "Wade & Wendy",
    "Stella.ai",
    "Ideal",
    "Restless Bandit",
    "Fetcher",
    "Textio",
    "Ongig",
    "Gender Decoder",
    "Appcast",
    "Recruitics",
    "PandoLogic",
    "Talroo",
    "JobTarget",
    "Broadbean",
    "LogicMelon",
    "Idibu",
    "Oorwin",
    "Vervoe ATS",
    "Zartis",
    "Staffing Future",
    "Jobsoid",
    "Njoyn",
    "Simplicant",
    "CV-Library",
    "Reed.co.uk",
    "Totaljobs",
    "CareerBuilder",
    "Monster ATS",
    "ZipRecruiter ATS",
    "Indeed Hire"
]

const ATS_SYSTEMS = [
    ...SPECIAL_ATS,
    ...[...RAW_ATS_SYSTEMS].sort((a, b) => a.localeCompare(b))
]

export function ConfigurePage({ featureUid }: ConfigurePageProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Dropdown Data States
    const [statusOptions, setStatusOptions] = useState<InterviewStatus[]>([])
    const [platformOptions, setPlatformOptions] = useState<Platform[]>([])
    const [phoneNumberOptions, setPhoneNumberOptions] = useState<PhoneNumber[]>([])
    const [featureName, setFeatureName] = useState("")
    const [isUpdateMode, setIsUpdateMode] = useState(false)
    const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([])

    // Form Field States
    const [phoneNumberUid, setPhoneNumberUid] = useState("")
    const [platformUids, setPlatformUids] = useState<string[]>([])
    const [voiceId, setVoiceId] = useState("jRAAK67SEFE9m7ci5DhD")
    const [endCallNegative, setEndCallNegative] = useState("false")
    const [restaurantName, setRestaurantName] = useState("")
    const [assistantName, setAssistantName] = useState("")
    const [timezone, setTimezone] = useState("Europe/London")
    const [addingQuestionIdx, setAddingQuestionIdx] = useState<number | null>(null)
    const [addedQuestions, setAddedQuestions] = useState<number[]>([])
    const [additionalQuestions, setAdditionalQuestions] = useState<string[]>(["", "", ""])
    const [additionalQuestionUids, setAdditionalQuestionUids] = useState<(string | null)[]>([null, null, null])
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deletingIdx, setDeletingIdx] = useState<number | null>(null)

    // Status Assignments
    const [jobAdStatus, setJobAdStatus] = useState("Current")
    const [applicationStatus, setApplicationStatus] = useState<string>("")
    const [callingTimeAfterStatusUpdate, setCallingTimeAfterStatusUpdate] = useState<string>("fastest")
    const [unsuccessfulStatus, setUnsuccessfulStatus] = useState<string>("")
    const [successfulStatus, setSuccessfulStatus] = useState<string>("")
    const [placedStatus, setPlacedStatus] = useState<string>("")

    const INITIAL_TIMELINE: TimelineDay[] = [
        { day: "Monday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Tuesday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Wednesday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Thursday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Friday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Saturday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
        { day: "Sunday", startTime: "00:00:00", endTime: "23:59:00", isActive: true },
    ]

    // Timeline State
    const [timeline, setTimeline] = useState<TimelineDay[]>(INITIAL_TIMELINE)

    // Dynamic Questions
    const [questions, setQuestions] = useState<QuestionInput[]>([{ tempId: crypto.randomUUID(), value: "", isSaved: false }])

    // UI States
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [currentUserRole, setCurrentUserRole] = useState("")

    const [showResultDialog, setShowResultDialog] = useState(false)
    const [resultMessage, setResultMessage] = useState("")
    const [resultTitle, setResultTitle] = useState("")
    const [isEditing, setIsEditing] = useState(false)
    const [myFlowUid, setMyFlowUid] = useState("")
    const [redirectToActivation, setRedirectToActivation] = useState(false)
    const [showReleaseDialog, setShowReleaseDialog] = useState(false)
    const [isVoicePreviewOpen, setIsVoicePreviewOpen] = useState(false)
    const [selectedVoiceData, setSelectedVoiceData] = useState<any>({
        "voice_id": "jRAAK67SEFE9m7ci5DhD",
        "name": "Ollie - Natural & Relaxed",
        "gender": "male",
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/database/workspace/f0453fa76e4e4a1e973d87b70665a591/voices/jRAAK67SEFE9m7ci5DhD/jeiEjvprTdbY76JXCluu.mp3",
        "is_default": true,
    })
    const [showWhatsappUploaderCard, setShowWhatsappUploaderCard] = useState(false)
    const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false)
    const [configUid, setConfigUid] = useState("")
    const [whatsappTemplate, setWhatsappTemplate] = useState<any>(null)
    const [showWhatsappDeleteConfirm, setShowWhatsappDeleteConfirm] = useState(false)
    const [isWhatsappDeleting, setIsWhatsappDeleting] = useState(false)
    const isPersistedVoiceSet = useRef(false)

    // ATS dropdown states
    const [selectedAts, setSelectedAts] = useState("JobAdder (Green Light)")
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const fetchWhatsappTemplate = useCallback(async (uid: string) => {
        if (!uid) return
        try {
            const templateRes = await flowService.getWhatsappTemplate(uid)
            if (templateRes.data) {
                setWhatsappTemplate(templateRes.data)
                setShowWhatsappUploaderCard(true)
            }
        } catch (err: any) {
            if (err.response?.data?.detail === "No template configured for this call config.") {
                setShowWhatsappUploaderCard(true)
                setWhatsappTemplate(null)
            }
        }
    }, [])

    useEffect(() => {
        const checkSelectedVoice = () => {
            const storedVoice = localStorage.getItem("selected_voice")
            if (storedVoice) {
                try {
                    const voice = JSON.parse(storedVoice)
                    if (voice && voice.voice_id) {
                        setVoiceId(voice.voice_id)
                        setSelectedVoiceData(voice)
                        isPersistedVoiceSet.current = true
                        // Clear it immediately after using it once on render/reload
                        localStorage.removeItem("selected_voice")
                    }
                } catch (e) {
                    console.error("Error parsing stored voice:", e)
                }
            }
        }

        checkSelectedVoice()

        // Also listen for focus events to catch the return from back navigation
        window.addEventListener('focus', checkSelectedVoice)
        return () => window.removeEventListener('focus', checkSelectedVoice)
    }, [])

    useEffect(() => {
        // Only set default if we are in create mode and timezone is still at default
        if (!isUpdateMode && timezone === "Europe/London") {
            try {
                const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
                if (browserTimezone) {
                    setTimezone(browserTimezone)
                }
            } catch (e) {
                console.error("Error getting browser timezone:", e)
            }
        }
    }, [isUpdateMode])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    useEffect(() => {
        setHighlightedIndex(0)
    }, [searchQuery])

    useEffect(() => {
        if (isDropdownOpen) {
            const activeEl = document.getElementById(`ats-item-${highlightedIndex}`)
            if (activeEl) {
                activeEl.scrollIntoView({ block: "nearest" })
            }
        }
    }, [highlightedIndex, isDropdownOpen])

    useEffect(() => {
        const nameParam = searchParams.get("name")
        const codeParam = searchParams.get("code")
        if (nameParam) {
            setFeatureName(nameParam)
        }
        if (featureUid) {
            setMyFlowUid(featureUid)
        }

        const fetchData = async () => {
            try {
                const response = await profileService.getOrganization();
                if (response && response.data) {
                    console.log("orgRes.data.role:", response.data.role)
                    setCurrentUserRole(response.data.role || "")
                }

                const [platformRes, phoneRes, questionsRes] = await Promise.all([
                    // flowService.getInterviewStatus(),
                    flowService.getMyPlatforms(),
                    flowService.getPhoneNumbers(),
                    //flowService.getFlows(),
                    flowService.getPrimaryQuestions(),
                ])

                // if (statusRes) setStatusOptions(statusRes.data)
                if (platformRes) setPlatformOptions(platformRes.data.results)
                if (phoneRes) setPhoneNumberOptions(phoneRes.data.results)
                if (questionsRes) setSuggestedQuestions(questionsRes.data.results)

                //const currentFeature = featuresRes.data.results.find((f: any) => f.uid === featureUid)
                //if (currentFeature) {
                //    setFeatureName(currentFeature.name)
                //}

                if (codeParam === "AICALL191") {
                    try {
                        const dinerRes = await flowService.getDinerConfig()
                        const dinerData = dinerRes.data
                        if (dinerData) {
                            if (!isPersistedVoiceSet.current) {
                                setVoiceId(dinerData.voice_id || "")
                                setSelectedVoiceData(dinerData.voice_data || null)
                            }
                            setRestaurantName(dinerData.restaurant_name || "")
                            setAssistantName(dinerData.assistant_name || "")
                            setIsUpdateMode(true)
                        }
                    } catch (dinerErr) {
                        // No diner config yet
                    }
                } else {
                    try {
                        const configRes = await flowService.getCallConfig()
                        const configList = configRes.data.results

                        // Find the config that matches the current flow UID
                        const configData = configList.find((c: any) => c.my_flow?.uid === (featureUid || myFlowUid)) || configList[0]

                        if (configData) {
                            setIsUpdateMode(true)
                            if (configData.uid) {
                                setConfigUid(configData.uid)
                                fetchWhatsappTemplate(configData.uid)
                            }

                            if (configData.platform_uids && Array.isArray(configData.platform_uids)) {
                                setPlatformUids(configData.platform_uids)
                            } else if (configData.platforms && Array.isArray(configData.platforms)) {
                                setPlatformUids(configData.platforms.map((p: any) => p.uid))
                            } else if (configData.platform?.uid) {
                                setPlatformUids([configData.platform.uid])
                            } else {
                                setPlatformUids([])
                            }
                            setPhoneNumberUid(configData.phone?.uid || "")
                            if (!isPersistedVoiceSet.current) {
                                setVoiceId(configData.voice_id || "")
                                setSelectedVoiceData(configData.voice_data || null)
                            }
                            setMyFlowUid(configData.my_flow?.uid || featureUid || "")
                            setTimezone(configData.timezone || "")
                            setCallingTimeAfterStatusUpdate(configData.calling_time_after_status_update ? String(configData.calling_time_after_status_update) : "fastest")

                            // Sync additional questions
                            if (configData.primary_questions && Array.isArray(configData.primary_questions)) {
                                const mappedQuestions = ["", "", ""]
                                const mappedUids = [null, null, null] as (string | null)[]
                                const mappedAddedIdx: number[] = []
                                configData.primary_questions.slice(0, 3).forEach((q: any, idx: number) => {
                                    mappedQuestions[idx] = q.question || ""
                                    mappedUids[idx] = q.uid || null
                                    mappedAddedIdx.push(idx)
                                })
                                setAdditionalQuestions(mappedQuestions)
                                setAdditionalQuestionUids(mappedUids)
                                setAddedQuestions(mappedAddedIdx)
                            }

                            // Load flattened timeline fields
                            const loadedTimeline = INITIAL_TIMELINE.map(dayInfo => {
                                const dayKey = dayInfo.day.toLowerCase()
                                return {
                                    ...dayInfo,
                                    isActive: configData[`${dayKey}_enabled`] ?? dayInfo.isActive,
                                    startTime: configData[`${dayKey}_start`] || dayInfo.startTime,
                                    endTime: configData[`${dayKey}_end`] || dayInfo.endTime,
                                }
                            })
                            setTimeline(loadedTimeline)
                        }
                    } catch (configErr) {
                        // No config yet
                    }
                }

                setIsLoading(false)
            } catch (err) {
                console.error("Error fetching configuration data:", err)
                setError("Failed to load configuration options")
                setIsLoading(false)
            }
        }

        fetchData()
    }, [featureUid])

    const handleAddQuestion = () => {
        setQuestions([...questions, { tempId: crypto.randomUUID(), value: "", isSaved: false }])
    }

    const handleQuestionChange = (index: number, value: string) => {
        const newQuestions = [...questions]
        newQuestions[index].value = value
        newQuestions[index].isSaved = false
        setQuestions(newQuestions)
    }

    const handleDeleteQuestion = (index: number) => {
        const newQuestions = questions.filter((_, i) => i !== index)
        setQuestions(newQuestions.length ? newQuestions : [{ tempId: crypto.randomUUID(), value: "", isSaved: false }])
    }

    const handleSuggestionClick = (index: number, suggestion: string) => {
        const newQuestions = [...questions]
        newQuestions[index].value = suggestion
        setQuestions(newQuestions)
    }

    const handleSaveQuestion = async (index: number) => {
        const question = questions[index]
        if (!question.value.trim()) return

        try {
            const response = await flowService.savePrimaryQuestion(question.value)

            const newQuestions = [...questions]
            newQuestions[index].uid = response.data.uid
            newQuestions[index].isSaved = true
            setQuestions(newQuestions)

        } catch (err: any) {
            console.error("Error saving question:", err)
            setResultTitle("Error")
            const errorData = err.response?.data
            const errorMessage = errorData?.details || errorData?.detail || errorData?.message || "Failed to save question."
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        }
    }

    const handleTimelineChange = (index: number, field: string, value: any) => {
        const newTimeline = [...timeline]
        newTimeline[index] = { ...newTimeline[index], [field]: value }
        setTimeline(newTimeline)
    }

    const handleAddAdditionalQuestion = async (question: string, index: number) => {
        if (!question || !question.trim()) {
            setResultTitle("Error")
            setResultMessage("Please enter a question before adding.")
            setShowResultDialog(true)
            return
        }

        setAddingQuestionIdx(index)
        try {
            const response = await flowService.savePrimaryQuestion(question)
            if (response.data && response.data.uid) {
                const questionId = response.data.uid

                // Save to state
                setAddedQuestions(prev => [...prev, index])
                setAdditionalQuestionUids(prev => {
                    const newUids = [...prev]
                    newUids[index] = questionId
                    return newUids
                })

                // Save to localStorage
                const storedIds = JSON.parse(localStorage.getItem("added_question_ids") || "[]")
                if (!storedIds.includes(questionId)) {
                    storedIds.push(questionId)
                    localStorage.setItem("added_question_ids", JSON.stringify(storedIds))
                }

                setResultMessage(`Question "${question}" added successfully!`)
                setResultTitle("Success")
                setShowResultDialog(true)
            }
        } catch (error: any) {
            console.error("Error adding question:", error)
            setResultTitle("Error")
            const errorData = error.response?.data
            const errorMessage = errorData?.details || errorData?.detail || errorData?.message || "Failed to add question. Please try again."
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setAddingQuestionIdx(null)
        }
    }

    const handleDeleteAdditionalQuestion = async () => {
        if (deletingIdx === null) return
        const uid = additionalQuestionUids[deletingIdx]

        // If it's a previously saved question or a newly added one that got a UID
        if (!uid) {
            // Local only delete (shouldn't really happen if handleDeleteButton filters correctly, but safe)
            setAddedQuestions(prev => prev.filter(i => i !== deletingIdx))
            setAdditionalQuestions(prev => {
                const newQ = [...prev]
                newQ[deletingIdx] = ""
                return newQ
            })
            setShowDeleteConfirm(false)
            setDeletingIdx(null)
            return
        }

        try {
            setIsSaving(true)
            await flowService.deletePrimaryQuestion(uid)

            // Remove from storage
            const storedIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("added_question_ids") || "[]") : []
            const newStoredIds = storedIds.filter((id: string) => id !== uid)
            if (typeof window !== 'undefined') {
                localStorage.setItem("added_question_ids", JSON.stringify(newStoredIds))
            }

            // Reset state
            setAddedQuestions(prev => prev.filter(i => i !== deletingIdx))
            setAdditionalQuestions(prev => {
                const newQ = [...prev]
                newQ[deletingIdx] = ""
                return newQ
            })
            setAdditionalQuestionUids(prev => {
                const newU = [...prev]
                newU[deletingIdx] = null
                return newU
            })

            setResultTitle("Success")
            setResultMessage("Question deleted successfully.")
            setShowResultDialog(true)
        } catch (error: any) {
            console.error("Error deleting question:", error)
            setResultTitle("Error")
            const errorData = error.response?.data
            const errorMessage = errorData?.details || errorData?.detail || errorData?.message || "Failed to delete question."
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsSaving(false)
            setShowDeleteConfirm(false)
            setDeletingIdx(null)
        }
    }

    const parseTime = (timeStr: string) => {
        // Regex to match "HH:MM am/pm" where HH and MM can be empty or digits
        const match = timeStr.match(/^([^:]*):([^ ]*) (am|pm)$/)
        if (match) {
            return { hh: match[1], mm: match[2], period: match[3] }
        }
        return { hh: "09", mm: "00", period: "am" }
    }

    const updateTimePart = (index: number, field: "startTime" | "endTime", part: "hh" | "mm" | "period", value: string) => {
        const currentVal = timeline[index][field]
        const { hh, mm, period } = parseTime(currentVal)
        let newTime = ""
        if (part === "hh") newTime = `${value}:${mm} ${period}`
        else if (part === "mm") newTime = `${hh}:${value} ${period}`
        else if (part === "period") newTime = `${hh}:${mm} ${value}`

        handleTimelineChange(index, field, newTime)
    }

    const convertTo24Hour = (timeStr: string) => {
        // Now timeStr is already in HH:mm:ss format from Select
        return timeStr || "00:00:00"
    }

    const scrollToFirstError = (errors: Record<string, string>) => {
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField) {
            const element = document.getElementById(firstErrorField)
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" })
            }
        }
    }

    const handleSaveConfiguration = async () => {
        setError("")
        setFieldErrors({})
        const codeParam = searchParams.get("code")

        if (codeParam === "AICALL191") {
            try {
                setIsSaving(true)
                const payload = {
                    phone_uid: phoneNumberUid,
                    voice_id: voiceId,
                    restaurant_name: restaurantName,
                    assistant_name: assistantName,
                    voice_data: selectedVoiceData
                }

                if (isUpdateMode) {
                    await flowService.updateDinerConfig(payload)
                } else {
                    await flowService.saveDinerConfig(payload)
                }

                setResultTitle("Success")
                setResultMessage(isUpdateMode ? "Configuration updated successfully!" : "Configuration saved successfully!")
                setShowResultDialog(true)
            } catch (err: any) {
                console.error("Error saving diner configuration:", err)
                setResultTitle("Error")
                const errorData = err.response?.data
                let errorMessage = "Failed to save configuration"

                if (errorData?.details) {
                    errorMessage = errorData.details
                } else if (errorData && typeof errorData === "object" && !Array.isArray(errorData) && !errorData.detail && !errorData.message && !errorData.error) {
                    setFieldErrors(errorData)
                    scrollToFirstError(errorData)
                    return
                } else if (errorData?.detail) {
                    errorMessage = errorData.detail
                } else if (Array.isArray(errorData) && errorData.length > 0) {
                    errorMessage = errorData[0]
                } else if (typeof errorData === "string") {
                    errorMessage = errorData
                } else if (errorData?.message) {
                    errorMessage = errorData.message
                } else if (errorData?.error) {
                    errorMessage = errorData.error
                } else if (err.message) {
                    errorMessage = err.message
                }

                if (errorMessage.includes("You didn't pay the development fee.")) {
                    router.push('/dashboard/platform-activation');
                    return;
                }
                setResultMessage(errorMessage)
                setShowResultDialog(true)
            } finally {
                setIsSaving(false)
            }
            return
        }

        try {
            setIsSaving(true)

            const activeQuestionUids = additionalQuestionUids.filter((uid): uid is string => uid !== null)

            const payload: any = {
                platform_uids: platformUids,
                phone_uid: phoneNumberUid,
                voice_id: voiceId,
                timezone: timezone,
                primary_question_inputs: activeQuestionUids,
                voice_data: selectedVoiceData
            }

            if (callingTimeAfterStatusUpdate !== "fastest") {
                payload.calling_time_after_status_update = callingTimeAfterStatusUpdate
            }

            // Add flattened timeline fields in 24h format
            timeline.forEach(dayInfo => {
                const dayKey = dayInfo.day.toLowerCase()
                payload[`${dayKey}_enabled`] = dayInfo.isActive
                payload[`${dayKey}_start`] = convertTo24Hour(dayInfo.startTime)
                payload[`${dayKey}_end`] = convertTo24Hour(dayInfo.endTime)
            })

            if (isUpdateMode) {
                await flowService.updateCallConfig(payload)
            } else {
                await flowService.createCallConfig(payload)
            }

            // Cleanup local storage and state upon success
            if (typeof window !== 'undefined') {
                localStorage.removeItem("selected_voice")
                localStorage.removeItem("added_question_ids")
            }
            setAddedQuestions([])
            setAdditionalQuestions(["", "", ""])

            setResultTitle("Success")
            setResultMessage(isUpdateMode ? "Configuration updated successfully!" : "Configuration saved successfully!")
            setShowResultDialog(true)
            setIsEditing(false) // Exit editing mode on success

            // Hit GET API to refresh data and transition UI to Running state
            try {
                const configRes = await flowService.getCallConfig()
                const configList = configRes.data.results

                if (configList && configList.length > 0) {
                    const configData = configList[0]
                    setIsUpdateMode(true)

                    if (configData.uid) {
                        setConfigUid(configData.uid)
                        fetchWhatsappTemplate(configData.uid)
                    }

                    if (configData.platform_uids && Array.isArray(configData.platform_uids)) {
                        setPlatformUids(configData.platform_uids)
                    } else if (configData.platforms && Array.isArray(configData.platforms)) {
                        setPlatformUids(configData.platforms.map((p: any) => p.uid))
                    } else if (configData.platform?.uid) {
                        setPlatformUids([configData.platform.uid])
                    } else {
                        setPlatformUids([])
                    }
                    setPhoneNumberUid(configData.phone?.uid || "")
                    setVoiceId(configData.voice_id || "")
                    setSelectedVoiceData(configData.voice_data || null)
                    setMyFlowUid(configData.my_flow?.uid || "")
                    setTimezone(configData.timezone || "")
                    setCallingTimeAfterStatusUpdate(configData.calling_time_after_status_update ? String(configData.calling_time_after_status_update) : "fastest")

                    // Sync additional questions
                    if (configData.primary_questions && Array.isArray(configData.primary_questions)) {
                        const mappedQuestions = ["", "", ""]
                        const mappedUids = [null, null, null] as (string | null)[]
                        const mappedAddedIdx: number[] = []
                        configData.primary_questions.slice(0, 3).forEach((q: any, idx: number) => {
                            mappedQuestions[idx] = q.question || ""
                            mappedUids[idx] = q.uid || null
                            mappedAddedIdx.push(idx)
                        })
                        setAdditionalQuestions(mappedQuestions)
                        setAdditionalQuestionUids(mappedUids)
                        setAddedQuestions(mappedAddedIdx)
                    }

                    // Load flattened timeline fields
                    const loadedTimeline = INITIAL_TIMELINE.map(dayInfo => {
                        const dayKey = dayInfo.day.toLowerCase()
                        return {
                            ...dayInfo,
                            isActive: configData[`${dayKey}_enabled`] ?? dayInfo.isActive,
                            startTime: configData[`${dayKey}_start`] || dayInfo.startTime,
                            endTime: configData[`${dayKey}_end`] || dayInfo.endTime,
                        }
                    })
                    setTimeline(loadedTimeline)
                }
            } catch (configErr) {
                // Ignore refresh error
            }

        } catch (err: any) {
            console.error("Error saving configuration:", err)

            setResultTitle("Error")
            const errorData = err.response?.data
            let errorMessage = "Failed to save configuration"

            if (errorData?.details) {
                errorMessage = errorData.details
            } else if (errorData && typeof errorData === "object" && !Array.isArray(errorData) && !errorData.detail && !errorData.message && !errorData.error) {
                setFieldErrors(errorData)
                scrollToFirstError(errorData)
                return
            } else if (errorData?.detail) {
                errorMessage = errorData.detail
            } else if (Array.isArray(errorData) && errorData.length > 0) {
                errorMessage = errorData[0]
            } else if (typeof errorData === "string") {
                errorMessage = errorData
            } else if (errorData?.message) {
                errorMessage = errorData.message
            } else if (errorData?.error) {
                errorMessage = errorData.error
            } else if (err.message) {
                errorMessage = err.message
            }

            if (errorMessage.includes("You didn't pay the development fee.")) {
                router.push('/dashboard/platform-activation');
                return;
            }
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsSaving(false)
        }
    }

    const handleReleaseFlow = async () => {
        if (!myFlowUid) {
            setError("No flow UID found to release")
            return
        }

        try {
            setIsSaving(true)
            await flowService.releaseFlow(myFlowUid)
            setResultTitle("Success")
            setResultMessage("Flow released successfully!")
            setShowResultDialog(true)
            // After clicking OK on Success, it will redirect via handleDialogClose update
        } catch (err: any) {
            console.error("Error releasing flow:", err)
            const errorData = err.response?.data
            const errorMessage = errorData?.details || errorData?.detail || errorData?.message || err.message || "Failed to release flow"
            setError(errorMessage)
            setResultTitle("Error")
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsSaving(false)
            setShowReleaseDialog(false)
        }
    }

    const handleDeleteWhatsappTemplate = async () => {
        if (!configUid) {
            setError("No configuration UID found")
            return
        }

        try {
            setIsWhatsappDeleting(true)
            await flowService.deleteWhatsappTemplate(configUid)

            setResultTitle("Success")
            setResultMessage("WhatsApp configuration removed successfully!")
            setShowResultDialog(true)

            await fetchWhatsappTemplate(configUid)
        } catch (err: any) {
            console.error("Error removing WhatsApp configuration:", err)
            const errorData = err.response?.data
            const errorMessage = errorData?.details || errorData?.detail || errorData?.message || err.message || "Failed to remove WhatsApp configuration"
            setError(errorMessage)
            setResultTitle("Error")
            setResultMessage(errorMessage)
            setShowResultDialog(true)
        } finally {
            setIsWhatsappDeleting(false)
            setShowWhatsappDeleteConfirm(false)
        }
    }

    const getPlatformDisplay = () => {
        if (platformUids.length === 0) return "Select Platform"
        const selectedNames = platformOptions
            .filter(p => platformUids.includes(p.uid))
            .map(p => p.platform?.name)
        if (selectedNames.length === 0) return "Select Platform"
        return selectedNames.join(", ")
    }

    const isPlatformConnected = (system: string) => {
        const cleanSystem = system.replace(" (Green Light)", "").replace(" (Amber Light)", "").replace(/\s+/g, "").toLowerCase();
        return platformOptions.some(p => {
            const cleanOption = (p.platform?.name || "").replace(/\s+/g, "").toLowerCase();
            return cleanOption === cleanSystem;
        });
    }

    const handleSelectChange = (setter: (val: string) => void) => (val: string) => {
        if (val === "_CLEAR_") {
            setter("")
        } else {
            setter(val)
        }
    }

    const handleDialogClose = () => {
        setShowResultDialog(false)
        if (resultTitle === "Success" && resultMessage === "Flow released successfully!") {
            router.push("/dashboard/phone-call-flows")
        } else if (redirectToActivation) {
            router.push("/dashboard/platform-activation")
        }
        // otherwise stay on page for other successes
    }

    const filteredAtsSystems = ATS_SYSTEMS.filter(system =>
        system.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        const aConnected = isPlatformConnected(a) ? 1 : 0
        const bConnected = isPlatformConnected(b) ? 1 : 0
        return bConnected - aConnected
    })

    const getStatusesForAts = (ats: string) => {
        const lower = ats.toLowerCase()
        if (lower.includes("recruit crm") || lower.includes("recruitcrm")) {
            return ["Assigned or Applied", "AI Call - No Reply", "AI Call - Link Sent", "Documents Received", "Unsuccessful"]
        }
        return ["Applied", "AI Call - No Reply", "AI Call - Link Sent", "Documents Received", "Unsuccessful"]
    }

    const handleAtsKeyDown = (e: React.KeyboardEvent) => {
        if (!isDropdownOpen) {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                setIsDropdownOpen(true)
            }
            return
        }

        if (e.key === "Escape") {
            setIsDropdownOpen(false)
            e.preventDefault()
        } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlightedIndex((prev) => (prev + 1) % filteredAtsSystems.length)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlightedIndex((prev) => (prev - 1 + filteredAtsSystems.length) % filteredAtsSystems.length)
        } else if (e.key === "Enter") {
            e.preventDefault()
            if (filteredAtsSystems[highlightedIndex]) {
                setSelectedAts(filteredAtsSystems[highlightedIndex])
                setIsDropdownOpen(false)
                setSearchQuery("")
            }
        }
    }

    if (currentUserRole === 'VOIP_USER') {
        return (
            <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-950 items-center justify-center p-4">
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
                        You do not have authorization to configure this call flow. Your account is configured for VoIP Business Line operations.
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
        <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50 dark:bg-gray-950">
            <LoaderOverlay
                isLoading={isLoading || isSaving}
            />

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 pb-28 md:pb-36">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-5 px-1 sm:px-0">
                        <div className="flex items-center gap-3 sm:gap-6 mb-2">
                            <button onClick={() => router.back()} className="h-8 w-8 -ml-1 sm:-ml-2 cursor-pointer rounded-full transition-all duration-300 hover:scale-125 text-gray-900 dark:text-gray-100">
                                <ArrowLeft className="h-8 w-8" />
                            </button>
                            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight gradient-text pb-1">Configure – {featureName || "Loading..."}</h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {searchParams.get("code") === "AICALL191" ? (
                            <>
                                {/* Left Column */}
                                <div className="space-y-6">
                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">General Settings</h2>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Phone Number</Label>
                                                <div id="phone_uid" className={fieldErrors.phone_uid ? "border-2 border-red-500 rounded-xl" : ""}>
                                                    <Select value={phoneNumberUid} onValueChange={handleSelectChange(setPhoneNumberUid)}>
                                                        <SelectTrigger className="h-8 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                            <SelectValue placeholder="Select phone number" />
                                                        </SelectTrigger>
                                                        <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                            <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                            {phoneNumberOptions.map(p => (
                                                                <SelectItem key={p.id} value={p.uid} className="dark:text-gray-100">
                                                                    {p.phone_number} {p.friendly_name ? `(${p.friendly_name})` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {fieldErrors.phone_uid && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone_uid}</p>}
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    Need another number? <Link href="/dashboard/phone-number-buy" className="text-blue-600 dark:text-blue-400 hover:underline">Buy New AI Phone Number</Link>
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ElevenLabs Voice</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        disabled={true}
                                                        readOnly={true}
                                                        value={selectedVoiceData ? selectedVoiceData.name : voiceId}
                                                        placeholder="Enter Voice ID"
                                                        className="h-8 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 cursor-not-allowed"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        disabled={!selectedVoiceData}
                                                        onClick={() => setIsVoicePreviewOpen(true)}
                                                        className="h-8 w-8 rounded-2xl border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex-shrink-0"
                                                    >
                                                        <Volume2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                {(!isUpdateMode || !isEditing) && searchParams.get("code") !== "AICALL191" && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                                        <Link href="/dashboard/voices" className="text-blue-600 dark:text-blue-400 hover:underline">Choose Another One</Link>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-6">
                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Assistant Settings</h2>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Restaurant Name</Label>
                                                <Input
                                                    id="restaurant_name"
                                                    disabled={searchParams.get("code") !== "AICALL191" && isUpdateMode && !isEditing}
                                                    value={restaurantName}
                                                    onChange={(e) => setRestaurantName(e.target.value)}
                                                    placeholder="Enter Restaurant Name"
                                                    className={`h-8 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${fieldErrors.restaurant_name ? "border-red-500 border-2" : ""}`}
                                                />
                                                {fieldErrors.restaurant_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.restaurant_name}</p>}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assistant Name</Label>
                                                <Input
                                                    id="assistant_name"
                                                    disabled={searchParams.get("code") !== "AICALL191" && isUpdateMode && !isEditing}
                                                    value={assistantName}
                                                    onChange={(e) => setAssistantName(e.target.value)}
                                                    placeholder="Enter Assistant Name"
                                                    className={`h-8 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${fieldErrors.assistant_name ? "border-red-500 border-2" : ""}`}
                                                />
                                                {fieldErrors.assistant_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.assistant_name}</p>}
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Left Column */}
                                <div className="space-y-6 flex flex-col h-full">
                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 flex-1">
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">General Settings</h2>
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Platform</Label>
                                                <div id="platform_uid" className={(fieldErrors.platform_uid || fieldErrors.platform_uids) ? "border-2 border-red-500 rounded-xl" : ""}>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                disabled={isUpdateMode && !isEditing}
                                                                className="w-full h-8 px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl flex items-center justify-between text-left text-sm font-normal text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/50 focus:outline-none transition-colors shadow-none"
                                                            >
                                                                <span className="truncate">
                                                                    {getPlatformDisplay()}
                                                                </span>
                                                                <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-lg" align="start">
                                                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto p-1">
                                                                {platformOptions.map((p) => {
                                                                    const isChecked = platformUids.includes(p.uid);
                                                                    return (
                                                                        <div
                                                                            key={p.id}
                                                                            onClick={() => {
                                                                                if (isChecked) {
                                                                                    setPlatformUids(platformUids.filter((id) => id !== p.uid));
                                                                                } else {
                                                                                    setPlatformUids([...platformUids, p.uid]);
                                                                                }
                                                                            }}
                                                                            className="flex items-center space-x-2.5 p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg cursor-pointer transition-colors"
                                                                        >
                                                                            <Checkbox
                                                                                id={`platform-${p.id}`}
                                                                                checked={isChecked}
                                                                                onCheckedChange={() => { }}
                                                                                className="border-gray-300 dark:border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                                            />
                                                                            <label
                                                                                htmlFor={`platform-${p.id}`}
                                                                                className="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer select-none truncate"
                                                                            >
                                                                                {p.platform?.name}
                                                                            </label>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {platformOptions.length === 0 && (
                                                                    <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                                        No connected platforms
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                {(fieldErrors.platform_uid || fieldErrors.platform_uids) && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        {fieldErrors.platform_uid || fieldErrors.platform_uids}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Phone Number</Label>
                                                <div id="phone_uid" className={fieldErrors.phone_uid ? "border-2 border-red-500 rounded-xl" : ""}>
                                                    <Select disabled={isUpdateMode && !isEditing} value={phoneNumberUid} onValueChange={handleSelectChange(setPhoneNumberUid)}>
                                                        <SelectTrigger className="h-8 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                            <SelectValue placeholder="Select phone number" />
                                                        </SelectTrigger>
                                                        <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                            <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                            {phoneNumberOptions.map(p => (
                                                                <SelectItem key={p.id} value={p.uid} className="dark:text-gray-100">
                                                                    {p.phone_number} {p.friendly_name ? `(${p.friendly_name})` : ''}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {fieldErrors.phone_uid && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone_uid}</p>}
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    Need another number? <Link href="/dashboard/phone-number-buy" className="text-blue-600 dark:text-blue-400 hover:underline">Buy New AI Phone Number</Link>
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ElevenLabs Voice</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        disabled={true}
                                                        readOnly={true}
                                                        value={selectedVoiceData ? selectedVoiceData.name : voiceId}
                                                        placeholder="Enter Voice ID"
                                                        className="h-8 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 cursor-not-allowed"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        disabled={!selectedVoiceData}
                                                        onClick={() => setIsVoicePreviewOpen(true)}
                                                        className="h-8 w-8 rounded-2xl border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex-shrink-0"
                                                    >
                                                        <Volume2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                {searchParams.get("code") !== "AICALL191" && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                                        <Link href="/dashboard/voices" className="text-blue-600 dark:text-blue-400 hover:underline">Choose Another One</Link>
                                                    </p>
                                                )}
                                            </div>
                                            {/* <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Call placed within</Label>
                                            <div id="calling_time_after_status_update" className={fieldErrors.calling_time_after_status_update ? "border-2 border-red-500 rounded-xl" : ""}>
                                                <Select disabled={isUpdateMode && !isEditing} value={callingTimeAfterStatusUpdate} onValueChange={setCallingTimeAfterStatusUpdate}>
                                                    <SelectTrigger className="h-8 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100 text-sm">
                                                        <SelectValue placeholder="Select Time" />
                                                    </SelectTrigger>
                                                    <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                        <SelectItem value="fastest" className="dark:text-gray-100">Fastest Time Possible</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {fieldErrors.calling_time_after_status_update && <p className="text-xs text-red-500 mt-1">{fieldErrors.calling_time_after_status_update}</p>}
                                        </div> */}
                                            <div className="mb-6 space-y-2">
                                                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Time Zone</Label>
                                                <div id="timezone" className={fieldErrors.timezone ? "border-2 border-red-500 rounded-xl p-1" : ""}>
                                                    <TimezoneSelect
                                                        disabled={isUpdateMode && !isEditing}
                                                        value={timezone}
                                                        onChange={(val) => setTimezone(val)}
                                                    />
                                                </div>
                                                {fieldErrors.timezone && (
                                                    <p className="text-red-500 text-xs mt-1 ml-1 font-medium">{fieldErrors.timezone}</p>
                                                )}
                                            </div>
                                        </div>
                                    </Card>

                                    {/* <Card className="p-8 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Interview Questions</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
                                        Add primary questions for the interview. Save each question before saving the full configuration.
                                    </p>

                                    <div className="space-y-5">
                                        {questions.map((q, index) => (
                                            <div key={q.tempId} className="space-y-2">
                                                <div className="flex gap-2 items-center">
                                                    <Input
                                                        value={q.value}
                                                        onChange={(e) => handleQuestionChange(index, e.target.value)}
                                                        placeholder="Type a question"
                                                        className={`h-10 border-gray-200 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${q.isSaved ? "border-green-500 bg-green-50/20 dark:bg-green-500/10 dark:border-green-600" : ""}`}
                                                        disabled={q.isSaved}
                                                    />
                                                    <div className="flex gap-2 shrink-0">
                                                        {!q.isSaved ? (
                                                            <Button size="sm" variant="outline" onClick={() => handleSaveQuestion(index)} className="h-10 px-5 border-2 rounded-2xl font-bold cursor-pointer dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700" >Save</Button>
                                                        ) : (
                                                            <div className="h-10 w-12 flex items-center justify-center text-green-500 dark:text-green-400" title="Saved"><CheckCircle2 className="h-6 w-6" /></div>
                                                        )}
                                                        <Button size="icon" variant="ghost" onClick={() => handleDeleteQuestion(index)} className="h-10 w-12 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl cursor-pointer"><Trash2 className="h-5 w-5" /></Button>
                                                    </div>
                                                </div>
                                                {!q.value && !q.isSaved && suggestedQuestions.length > 0 && (
                                                    <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Suggested Questions:</p>
                                                        <div className="flex flex-col gap-2">
                                                            {suggestedQuestions.map(s => (
                                                                <div key={s.id} onClick={() => handleSuggestionClick(index, s.question)} className="text-sm p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg cursor-pointer transition-all shadow-sm shadow-violet-500/10 dark:text-gray-100">{s.question}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button onClick={handleAddQuestion} variant="outline" className="h-10 px-6 border-2 border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 font-bold rounded-2xl hover:bg-gray-900 dark:hover:bg-gray-100 hover:text-white dark:hover:text-gray-900 transition-all">
                                            <Plus className="h-4 w-4 mr-2" /> Add More Question
                                        </Button>
                                    </div>
                                </Card> */}
                                </div>


                                {/* Right Column */}
                                <div className="space-y-6 flex flex-col h-full">
                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-6">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-6 w-6 text-gray-900 dark:text-gray-100" />
                                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Call Active Timeline</h2>
                                            </div>
                                            {isUpdateMode && !isEditing && (
                                                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full border border-green-100 dark:border-green-800/50">
                                                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Running</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="hidden md:grid grid-cols-12 gap-2 pb-1 border-b border-gray-100 dark:border-gray-700">
                                                <div className="col-span-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Day</div>
                                                <div className="col-span-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Start Time</div>
                                                <div className="col-span-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">End Time</div>
                                                <div className="col-span-1 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Active</div>
                                            </div>

                                            {timeline.map((item, index) => (
                                                <div key={item.day} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 items-start md:items-center p-3 md:p-0 bg-gray-50/50 md:bg-transparent dark:bg-gray-900/30 md:dark:bg-transparent rounded-2xl md:rounded-none border border-gray-100 md:border-none dark:border-gray-800 md:dark:border-none">
                                                    <div className="w-full md:col-span-3 flex justify-between items-center">
                                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                            {item.day}
                                                        </span>
                                                        <div className="md:hidden">
                                                            <Checkbox
                                                                disabled={isUpdateMode && !isEditing}
                                                                checked={item.isActive}
                                                                onCheckedChange={(checked) => handleTimelineChange(index, "isActive", checked)}
                                                                className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:col-span-8 grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <span className="md:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Start Time</span>
                                                            <Select
                                                                disabled={isUpdateMode && !isEditing}
                                                                value={item.startTime}
                                                                onValueChange={(val) => handleTimelineChange(index, "startTime", val)}
                                                            >
                                                                <SelectTrigger className="h-8 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 md:dark:bg-gray-700 dark:text-gray-100 text-sm bg-white">
                                                                    <SelectValue placeholder="Start" />
                                                                </SelectTrigger>
                                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                                    {TIME_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value} className="dark:text-gray-100">
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {fieldErrors[`${item.day.toLowerCase()}_start`] && <p className="text-[10px] text-red-500 mt-1">{fieldErrors[`${item.day.toLowerCase()}_start`]}</p>}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="md:hidden text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">End Time</span>
                                                            <Select
                                                                disabled={isUpdateMode && !isEditing}
                                                                value={item.endTime}
                                                                onValueChange={(val) => handleTimelineChange(index, "endTime", val)}
                                                            >
                                                                <SelectTrigger className="h-8 border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 md:dark:bg-gray-700 dark:text-gray-100 text-sm bg-white">
                                                                    <SelectValue placeholder="End" />
                                                                </SelectTrigger>
                                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                                    {TIME_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value} className="dark:text-gray-100">
                                                                            {opt.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {fieldErrors[`${item.day.toLowerCase()}_end`] && <p className="text-[10px] text-red-500 mt-1">{fieldErrors[`${item.day.toLowerCase()}_end`]}</p>}
                                                        </div>
                                                    </div>

                                                    <div className="hidden md:flex md:col-span-1 justify-end">
                                                        <div id={item.day.toLowerCase() + "_enabled"}>
                                                            <Checkbox
                                                                disabled={isUpdateMode && !isEditing}
                                                                checked={item.isActive}
                                                                onCheckedChange={(checked) => handleTimelineChange(index, "isActive", checked)}
                                                                className="h-5 w-5 border-2 border-gray-300 dark:border-gray-600 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    {/* <Card className="p-8 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Automation Logic</h2>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Job Ad Status for Calling</Label>
                                            <Select value={jobAdStatus} onValueChange={handleSelectChange(setJobAdStatus)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="Current" className="dark:text-gray-100">Current</SelectItem>
                                                    <SelectItem value="Expired" className="dark:text-gray-100">Expired</SelectItem>
                                                    <SelectItem value="Draft" className="dark:text-gray-100">Draft</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Application Status for Calling</Label>
                                            <Select value={applicationStatus} onValueChange={handleSelectChange(setApplicationStatus)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                    {statusOptions.map(s => (<SelectItem key={s.id} value={String(s.id)} className="dark:text-gray-100">{s.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Calling Time After Status Update</Label>
                                            <Select value={callingTime} onValueChange={handleSelectChange(setCallingTime)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select time" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                    {CALLING_TIME_OPTIONS.map(opt => (<SelectItem key={opt.value} value={String(opt.value)} className="dark:text-gray-100">{opt.label}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status When Call is Placed</Label>
                                            <Select value={placedStatus} onValueChange={handleSelectChange(setPlacedStatus)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                    {statusOptions.map(s => (<SelectItem key={s.id} value={String(s.id)} className="dark:text-gray-100">{s.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status for Successful Call</Label>
                                            <Select value={successfulStatus} onValueChange={handleSelectChange(setSuccessfulStatus)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                    {statusOptions.map(s => (<SelectItem key={s.id} value={String(s.id)} className="dark:text-gray-100">{s.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status for Unsuccessful Call</Label>
                                            <Select value={unsuccessfulStatus} onValueChange={handleSelectChange(setUnsuccessfulStatus)}>
                                                <SelectTrigger className="h-10 border-gray-200 dark:border-gray-600 rounded-2xl dark:bg-gray-700 dark:text-gray-100">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                                                    <SelectItem value="_CLEAR_" className="text-gray-400 dark:text-gray-500 font-medium">Remove Selection</SelectItem>
                                                    {statusOptions.map(s => (<SelectItem key={s.id} value={String(s.id)} className="dark:text-gray-100">{s.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </Card> */}
                                </div>
                                <Card className="lg:col-span-2 p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                    <div className="flex flex-col md:flex-col justify-between gap-6">
                                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-gray-100 whitespace-nowrap">AI Call Flow</h2>
                                        <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-[10px] sm:text-xs md:text-sm font-semibold text-[#334155] dark:text-gray-300">
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Intro</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Right to Work</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Job Requirements</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Experience</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Qualifications</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Shift/Days/Time/Duration</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Travel/Commute</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Ending</span>
                                            {/* <span className="text-gray-400">→</span>
                                        <Link href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Text Link</Link> */}
                                        </div>
                                    </div>
                                </Card>

                                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-gray-100 mb-6 pb-4 dark:border-gray-700">AI Call Additional Questions <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">(Optional)</span></h2>
                                        <div className="space-y-3">
                                            {/* Questions Loop */}
                                            {[
                                                "Do you have reliable transportation?",
                                                "Are you available to work weekends?",
                                                "Are you willing to travel if required?"
                                            ].map((defaultQuestion, idx) => (
                                                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 sm:p-0 bg-gray-50 sm:bg-transparent dark:bg-gray-900/40 sm:dark:bg-transparent rounded-2xl sm:rounded-none border border-gray-100 sm:border-none dark:border-gray-800 sm:dark:border-none">
                                                    <Input
                                                        disabled={(isUpdateMode && !isEditing) || addingQuestionIdx === idx || addedQuestions.includes(idx)}
                                                        value={additionalQuestions[idx]}
                                                        onChange={(e) => {
                                                            const newQuestions = [...additionalQuestions]
                                                            newQuestions[idx] = e.target.value
                                                            setAdditionalQuestions(newQuestions)
                                                        }}
                                                        placeholder={defaultQuestion}
                                                        className={`w-full h-9 sm:h-8 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#334155] dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${addedQuestions.includes(idx) ? "border-green-500 bg-green-50/20 dark:bg-green-500/10" : ""}`}
                                                    />
                                                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                                        <Button
                                                            onClick={() => {
                                                                setDeletingIdx(idx)
                                                                setShowDeleteConfirm(true)
                                                            }}
                                                            disabled={(isUpdateMode && !isEditing) || addingQuestionIdx === idx}
                                                            className="flex-1 sm:flex-none h-9 sm:h-8 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed justify-center"
                                                            title="Delete Question"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleAddAdditionalQuestion(additionalQuestions[idx], idx)}
                                                            disabled={(isUpdateMode && !isEditing) || addingQuestionIdx === idx || addedQuestions.includes(idx)}
                                                            className="flex-[2] sm:flex-none h-9 sm:h-8 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white font-bold rounded-2xl whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                        >
                                                            {addingQuestionIdx === idx ? "Adding..." : addedQuestions.includes(idx) ? "Added" : "Add"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    <Card className="p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800">
                                        <h2 className="text-lg sm:text-xl font-semibold text-[#1e293b] dark:text-gray-100 mb-6 pb-4 border-b border-gray-50 dark:border-gray-700">Job Description Requirement</h2>
                                        <div className="space-y-4">
                                            <p className="text-[#475569] dark:text-gray-400 font-medium">The advert must include a section titled:</p>
                                            <p className="text-lg font-semibold text-[#1e293b] dark:text-gray-100 -mt-4">Job Requirements</p>
                                            <div className="space-y-3">
                                                <p className="text-[#475569] dark:text-gray-400 font-medium">Each requirement must:</p>
                                                <ul className="list-disc list-inside space-y-1.5 pl-2 text-sm text-[#475569] dark:text-gray-400 font-medium">
                                                    <li>Be written as a question</li>
                                                    <li>
                                                        Start with either:
                                                        <ul className="list-[circle] list-inside pl-6 mt-1 space-y-1">
                                                            <li className="font-semibold text-[#1e293b] dark:text-gray-200">Must have</li>
                                                            <li className="font-semibold text-[#1e293b] dark:text-gray-200">Do you</li>
                                                        </ul>
                                                    </li>
                                                </ul>
                                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                                                    <p className="text-[#475569] dark:text-gray-400 font-semibold mb-1">Example:</p>
                                                    <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                                        <li>Must have a valid CSCS card?</li>
                                                        {/* <li>Do you have previous warehouse experience?</li> */}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {showWhatsappUploaderCard && (
                                        <Card className="relative p-4 sm:p-6 shadow-sm shadow-violet-500/10 border border-gray-100 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 flex flex-col items-center justify-center space-y-4 min-h-[200px]">
                                            {whatsappTemplate ? (
                                                <>
                                                    <button
                                                        onClick={() => setShowWhatsappDeleteConfirm(true)}
                                                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                        title="Remove WhatsApp configuration"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <div className="flex flex-col items-center space-y-3 text-center">
                                                        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${whatsappTemplate.is_active ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                                                            {whatsappTemplate.is_active ? (
                                                                <CheckCircle2 className="h-6 w-6 text-green-500 dark:text-green-400" />
                                                            ) : (
                                                                <AlertCircle className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h5 className="text-base font-semibold text-gray-700 dark:text-gray-300">WhatsApp Document Uploader</h5>
                                                            {/* <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Template: {whatsappTemplate.template_friendly_name}</p> */}
                                                            <div className="flex items-center justify-center gap-1.5 mt-1">
                                                                <div className={`h-1.5 w-1.5 rounded-full ${whatsappTemplate.is_active ? "bg-green-500" : "bg-amber-500"}`} />
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    {whatsappTemplate.is_active ? "Active" : "Waiting for Activation"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => setIsWhatsappModalOpen(true)}
                                                        className="h-12 w-12 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                                                    >
                                                        <Plus className="h-6 w-6 text-gray-400 group-hover:text-blue-500 dark:text-gray-500 dark:group-hover:text-blue-400" />
                                                    </Button>
                                                    <h5 className="text-base font-semibold text-gray-700 dark:text-gray-300">Add WhatsApp Document Uploader</h5>
                                                </>
                                            )}
                                        </Card>
                                    )}
                                    <Card className={`${showWhatsappUploaderCard ? "" : "lg:col-span-2"} p-4 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#E5E7EB] rounded-2xl bg-white text-[#1F2937]`}>
                                        <style dangerouslySetInnerHTML={{ __html: `
                                            @keyframes atsFadeIn {
                                                from { opacity: 0; transform: translateY(2px); }
                                                to { opacity: 1; transform: translateY(0); }
                                            }
                                            .animate-ats-fade-in {
                                                animation: atsFadeIn 0.2s ease-out forwards;
                                            }
                                        ` }} />
                                        <h2 className="text-xl font-semibold text-[#1F2937] mb-6">ATS/CRM Application Status/Stage Setup</h2>
                                        
                                        {/* Premium Searchable Dropdown */}
                                        <div className="relative mb-6" ref={dropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                onKeyDown={handleAtsKeyDown}
                                                className="w-full flex items-center justify-between px-5 py-4 h-[54px] bg-white border border-[#E5E7EB] rounded-[14px] shadow-[0_4px_12px_rgba(0,0,0,0.02)] text-[#1F2937] hover:border-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#0252FF]/20"
                                            >
                                                <span className="font-semibold text-base flex items-center gap-2">
                                                    <span>{selectedAts.replace(" (Green Light)", "").replace(" (Amber Light)", "")}</span>
                                                    {isPlatformConnected(selectedAts) ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Connected
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                            Disconnected
                                                        </span>
                                                    )}
                                                </span>
                                                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                                            </button>

                                            {isDropdownOpen && (
                                                <div className="absolute top-[62px] left-0 right-0 bg-white border border-[#E5E7EB] rounded-[14px] shadow-[0_10px_25px_rgba(0,0,0,0.06)] z-50 overflow-hidden flex flex-col max-h-[320px]">
                                                    <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-[#F7F8FA]">
                                                        <Search className="h-4 w-4 text-gray-400 shrink-0" />
                                                        <input
                                                            type="text"
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            onKeyDown={handleAtsKeyDown}
                                                            placeholder="Search ATS or CRM..."
                                                            className="w-full bg-transparent border-none text-sm text-[#1F2937] placeholder-gray-400 focus:outline-none focus:ring-0"
                                                            autoFocus
                                                        />
                                                        {searchQuery && (
                                                            <button
                                                                onClick={() => setSearchQuery("")}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="overflow-y-auto py-2 flex-1 scrollbar-thin">
                                                        {filteredAtsSystems.length > 0 ? (
                                                            filteredAtsSystems.map((system, index) => {
                                                                const isSelected = selectedAts === system
                                                                const isHighlighted = highlightedIndex === index
                                                                return (
                                                                    <button
                                                                        key={system}
                                                                        id={`ats-item-${index}`}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedAts(system)
                                                                            setIsDropdownOpen(false)
                                                                            setSearchQuery("")
                                                                        }}
                                                                        className={`w-full text-left px-5 py-3 text-sm transition-colors flex items-center justify-between ${
                                                                            isSelected
                                                                                ? "text-[#0252FF] font-semibold bg-[#F7F8FA]"
                                                                                : isHighlighted
                                                                                ? "bg-gray-100/80 text-[#1F2937]"
                                                                                : "text-[#1F2937] hover:bg-[#F7F8FA]"
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{system.replace(" (Green Light)", "").replace(" (Amber Light)", "")}</span>
                                                                            {isPlatformConnected(system) ? (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                                    Connected
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                                                                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                                                    Disconnected
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {isSelected && (
                                                                            <div className="h-2 w-2 rounded-full bg-[#0252FF]" />
                                                                        )}
                                                                    </button>
                                                                )
                                                            })
                                                        ) : (
                                                            <div className="text-center py-6 text-sm text-gray-400">
                                                                No integrations found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Instruction details with light grey background */}
                                        {selectedAts.toLowerCase().includes("greenhouse") ? (
                                            <div key={selectedAts} className="bg-[#F7F8FA] border border-[#E5E7EB]/80 rounded-[14px] p-8 flex flex-col items-center justify-center min-h-[220px] animate-ats-fade-in">
                                                <p className="text-xl font-bold text-[#1F2937] text-center">
                                                    No Setup required
                                                </p>
                                            </div>
                                        ) : (
                                            <div key={selectedAts} className="bg-[#F7F8FA] border border-[#E5E7EB]/80 rounded-[14px] p-5 space-y-4 animate-ats-fade-in">
                                                <p className="text-sm font-semibold text-[#1F2937] leading-relaxed">
                                                    Please create the following Job Application Statuses/Stages within your ATS/CRM under:
                                                </p>
                                                <p className="text-sm sm:text-base font-bold text-[#1F2937] bg-white p-3 rounded-[10px] border border-[#E5E7EB] shadow-sm shadow-violet-500/10">
                                                    {selectedAts.toLowerCase().includes("recruit crm") || selectedAts.toLowerCase().includes("recruitcrm") ? (
                                                        <>Admin Settings &rarr; Hiring Pipeline &rarr; Create New Hiring Pipeline</>
                                                    ) : (
                                                        <>Settings &rarr; Job Applications &rarr; Status &rarr; Stage &rarr; New</>
                                                    )}
                                                </p>
                                                <p className="text-sm font-semibold text-[#1F2937] leading-relaxed">
                                                    If these statuses/stages do not already exist, please add:
                                                </p>
                                                <ul className="space-y-2.5 text-sm font-bold text-[#1F2937]">
                                                    {getStatusesForAts(selectedAts).map((status, index) => (
                                                        <li key={index} className="flex items-center gap-3">
                                                            <span className="text-blue-600 font-semibold text-sm shrink-0 min-w-[16px]">{index + 1}.</span>
                                                            <span>{status}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </Card>
                                </div>
                            </>

                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Save Bar (Footer) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 border-t border-gray-100/80 dark:border-gray-800/80 bg-transparent dark:bg-gray-950/80 backdrop-blur-sm z-10 shrink-0">
                <div className="max-w-2xl mx-auto w-full flex flex-row gap-4">
                    {searchParams.get("code") === "AICALL191" ? (
                        <div className="flex flex-row gap-4 w-full">
                            <Button
                                size="lg"
                                onClick={handleSaveConfiguration}
                                disabled={isSaving}
                                className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl shadow-xl shadow-gray-600/60 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {isSaving ? (isUpdateMode ? "Updating..." : "Saving...") : (isUpdateMode ? "Update Configure" : "Save Configure")}
                            </Button>
                            {isUpdateMode && currentUserRole !== "STAFF" && (
                                <Button
                                    size="lg"
                                    onClick={() => setShowReleaseDialog(true)}
                                    className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl border-none shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    Release Flow
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            {!isUpdateMode ? (
                                <div className="flex flex-row gap-4 w-full">
                                    <Button
                                        size="lg"
                                        onClick={handleSaveConfiguration}
                                        disabled={isSaving}
                                        className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl shadow-xl shadow-gray-600/60 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                    >
                                        {isSaving ? "Activating..." : "Activate AI Call"}
                                    </Button>
                                    {currentUserRole !== "STAFF" && (
                                        <Button
                                            size="lg"
                                            onClick={() => setShowReleaseDialog(true)}
                                            className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl border-none shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                            Release Flow
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-row gap-4 w-full">
                                        {!isEditing ? (
                                            <Button
                                                size="lg"
                                                onClick={() => setIsEditing(true)}
                                                className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl shadow-xl shadow-gray-600/60 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                            >
                                                Edit AI Call
                                            </Button>
                                        ) : (
                                            <Button
                                                size="lg"
                                                onClick={handleSaveConfiguration}
                                                disabled={isSaving}
                                                className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl shadow-xl shadow-gray-600/60 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                            >
                                                {isSaving ? "Updating..." : "Update AI Call"}
                                            </Button>
                                        )}
                                        {currentUserRole !== "STAFF" && (
                                            <Button
                                                size="lg"
                                                onClick={() => setShowReleaseDialog(true)}
                                                className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white text-sm sm:text-lg font-semibold rounded-2xl sm:rounded-2xl border-none shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                                            >
                                                Release Flow
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent className="rounded-2xl dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={resultTitle === "Error" ? "text-red-500 dark:text-red-400 text-xl font-bold" : "text-blue-600 dark:text-blue-400 text-xl font-bold"}>
                            {resultTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 dark:text-gray-400 text-base font-medium">
                            {resultMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogAction onClick={handleDialogClose} className="h-12 bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 dark: text-white font-bold rounded-2xl px-8 border-none">
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
                <AlertDialogContent className="rounded-2xl dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500 dark:text-red-400 text-xl font-bold">
                            Release Flow
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 dark:text-gray-400 text-base font-medium">
                            Are you sure you want to release this flow? This action will delete the current configuration.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowReleaseDialog(false)}
                            className="h-12 border-2 rounded-2xl px-8 font-bold dark:border-gray-700 dark:text-gray-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReleaseFlow}
                            className="h-12 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white font-bold rounded-2xl px-8 border-none shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                            Release Flow
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Question Delete Confirmation */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Delete Question?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete this specific question? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="dark:text-gray-300 dark:hover:bg-gray-700">
                            Cancel
                        </Button>
                        <AlertDialogAction
                            onClick={handleDeleteAdditionalQuestion}
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* WhatsApp Template Delete Confirmation */}
            <AlertDialog open={showWhatsappDeleteConfirm} onOpenChange={setShowWhatsappDeleteConfirm}>
                <AlertDialogContent className="rounded-2xl dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500 dark:text-red-400 text-xl font-bold">
                            Remove WhatsApp Configuration
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 dark:text-gray-400 text-base font-medium">
                            Are you sure you want to remove the WhatsApp configuration? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowWhatsappDeleteConfirm(false)}
                            disabled={isWhatsappDeleting}
                            className="h-12 border-2 rounded-2xl px-8 font-bold dark:border-gray-700 dark:text-gray-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteWhatsappTemplate}
                            disabled={isWhatsappDeleting}
                            className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl px-8 border-none flex items-center justify-center gap-2"
                        >
                            {isWhatsappDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                "Remove"
                            )}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isVoicePreviewOpen} onOpenChange={setIsVoicePreviewOpen}>
                <DialogContent className="sm:max-w-md bg-white/80 backdrop-blur-xl dark:bg-white/5 border-gray-200 dark:border-gray-800 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Volume2 className="h-5 w-5 text-blue-500" />
                            Voice Preview
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        {selectedVoiceData ? (
                            <>
                                <div className="text-center">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedVoiceData.name}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">{selectedVoiceData.gender}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <audio
                                        controls
                                        autoPlay
                                        className="w-full"
                                        key={selectedVoiceData.preview_url}
                                    >
                                        <source src={selectedVoiceData.preview_url} type="audio/mpeg" />
                                        Your browser does not support the audio element.
                                    </audio>
                                </div>
                                <div className="flex justify-center">
                                    <Button
                                        onClick={() => setIsVoicePreviewOpen(false)}
                                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white font-semibold transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No voice selected to preview.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <WhatsappConfigModal
                isOpen={isWhatsappModalOpen}
                onClose={() => setIsWhatsappModalOpen(false)}
                onSuccess={() => fetchWhatsappTemplate(configUid)}
                configUid={configUid}
            />
        </div>
    )
}
