"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { BASE_URL } from "@/lib/baseUrl"
import { cookieUtils } from "@/services/auth-service"
import { profileService } from "@/services/profile-service"
import {
    ArrowLeft,
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    PhoneOff,
    Mic,
    MicOff,
    Pause,
    Play,
    ArrowRightLeft,
    Clock,
    Loader2,
    Voicemail,
    Radio,
    Volume2,
    Building2,
    Mail,
    MapPin,
    UserRound,
    Users,
    Search,
    Plus,
    RefreshCw,
    UserPlus,
    History,
    Database
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface CallItem {
    uid?: string;
    id?: string | number;
    direction: "inbound" | "outbound";
    status: string;
    number: string;
    contact_id?: number | null;
    contact_name?: string | null;
    started_at: string;
    duration: number;
    handled_by?: string | null;
    has_voicemail?: boolean;
}

interface VoicemailItem {
    uid?: string;
    id?: string | number;
    from: string;
    created_at: string;
    duration: number;
    is_read: boolean;
    ready: boolean;
    audio_url: string;
    read_url?: string;
}

interface Colleague {
    uid: string;
    name: string;
    extension: string;
}

interface VoiceConfig {
    sdkUrl: string;
    tokenUrl: string;
    colleaguesUrl: string;
    transferUrl: string;
    voicemailsUrl: string;
    callsUrl: string;
    callerLookupUrl: string;
    extensionUid?: string;
    callerId?: string;
}

interface JobAdderStatus {
    statusId?: number | string;
    name?: string;
    active?: boolean;
}

interface JobAdderAddress {
    street?: string[] | string;
    city?: string;
    state?: string;
    postalCode?: string;
    postcode?: string;
    country?: string;
}

interface JobAdderUser {
    userId?: number | string;
    firstName?: string;
    lastName?: string;
    name?: string;
    position?: string;
    jobTitle?: string;
    email?: string;
    phone?: string;
    mobile?: string;
}

interface JobAdderCompany {
    companyId?: number | string;
    name?: string;
    status?: JobAdderStatus;
}

interface JobAdderPersonBase {
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    mobileNormalized?: string;
    unsubscribed?: boolean;
    status?: JobAdderStatus;
    createdBy?: JobAdderUser;
    updatedBy?: JobAdderUser;
    createdAt?: string;
    updatedAt?: string;
}

interface JobAdderCandidate extends JobAdderPersonBase {
    candidateId?: number | string;
    seeking?: string;
    address?: JobAdderAddress;
}

interface JobAdderContact extends JobAdderPersonBase {
    contactId?: number | string;
    company?: JobAdderCompany | null;
}

interface JobAdderCallerLookupResponse {
    jobadder_connected?: boolean;
    found?: boolean;
    candidates?: JobAdderCandidate[];
    contacts?: JobAdderContact[];
    detail?: string;
    error?: string;
}

interface CallerLookupState {
    phone: string;
    loading: boolean;
    error: string | null;
    data: JobAdderCallerLookupResponse | null;
}

interface CallerLookupOption {
    key: string;
    type: "candidate" | "contact";
    index: number;
    label: string;
    record: JobAdderCandidate | JobAdderContact;
}

interface ContactItem {
    id: number;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string | null;
    email?: string;
    company_name?: string;
    source_name?: string | null;
    origin?: string | null;
    external_id?: string | null;
    candidate_id?: string | null;
    status?: string;
}

interface ContactHistoryCall {
    uid: string;
    direction: "inbound" | "outbound";
    number: string;
    status: string;
    started_at: string;
    answered_at?: string | null;
    ended_at?: string | null;
    duration: number;
    handled_by?: string | null;
    has_voicemail?: boolean;
    has_recording?: boolean;
    hangup_cause?: string;
}

interface VoipDashboardContentProps {
    flowUid?: string;
}

export function VoipDashboardContent({ flowUid }: VoipDashboardContentProps) {
    const router = useRouter()
    const VOICE_BASE = BASE_URL

    // Configuration object mirroring JSON from voice-config script tag
    const cfgRef = useRef<VoiceConfig>({
        sdkUrl: "/js/telnyx-webrtc.js",
        tokenUrl: `${VOICE_BASE}/voice/api/token/`,
        colleaguesUrl: `${VOICE_BASE}/voice/api/colleagues/`,
        transferUrl: `${VOICE_BASE}/voice/api/transfer/`,
        voicemailsUrl: `${VOICE_BASE}/voice/api/voicemails/`,
        callsUrl: `${VOICE_BASE}/voice/api/calls/`,
        callerLookupUrl: `${VOICE_BASE}/voice/api/jobadder-caller-lookup/`,
        extensionUid: "",
        callerId: ""
    })

    // User & Organization meta
    const [orgName, setOrgName] = useState<string>("CallPilot")
    const [userName, setUserName] = useState<string>("User")
    const [extension, setExtension] = useState<string>("101")
    const [mainNumber, setMainNumber] = useState<string>("0131 367 1667")

    // UI and Connection State
    const [status, setStatus] = useState<"online" | "offline" | "connecting">("offline")
    const [statusDetail, setStatusDetail] = useState<string>("")
    const [soundBannerVisible, setSoundBannerVisible] = useState(false)
    const [callError, setCallError] = useState<string | null>(null)
    const [isDialing, setIsDialing] = useState(false)
    const [dialNumber, setDialNumber] = useState("")
    const [currentTab, setCurrentTab] = useState<"recent" | "missed" | "voicemail">("recent")

    // Active & Incoming Call States
    const [incomingCall, setIncomingCall] = useState<any | null>(null)
    const [incomingCaller, setIncomingCaller] = useState<string>("")
    const [activeCall, setActiveCall] = useState<any | null>(null)
    const [activeWho, setActiveWho] = useState<string>("")
    const [activeStateText, setActiveStateText] = useState<string>("")
    const [isAnswering, setIsAnswering] = useState(false)
    const [held, setHeld] = useState(false)
    const [muted, setMuted] = useState(false)
    const [callerLookup, setCallerLookup] = useState<CallerLookupState | null>(null)
    const [selectedLookupKey, setSelectedLookupKey] = useState("")

    // Transfer States
    const [showTransferPanel, setShowTransferPanel] = useState(false)
    const [colleagues, setColleagues] = useState<Colleague[]>([])
    const [selectedColleague, setSelectedColleague] = useState("")
    const [transferNumber, setTransferNumber] = useState("")
    const [transferMsg, setTransferMsg] = useState("")
    const [isTransferring, setIsTransferring] = useState(false)

    // List Data
    const [callsList, setCallsList] = useState<CallItem[]>([])
    const [voicemailsList, setVoicemailsList] = useState<VoicemailItem[]>([])
    const [unreadVoicemails, setUnreadVoicemails] = useState<number>(0)
    const [listErrorMessage, setListErrorMessage] = useState<string | null>(null)

    // Contacts
    const [contactsList, setContactsList] = useState<ContactItem[]>([])
    const [contactsLoading, setContactsLoading] = useState(false)
    const [contactsError, setContactsError] = useState<string | null>(null)
    const [contactSearch, setContactSearch] = useState("")
    const [selectedContactId, setSelectedContactId] = useState<number | null>(null)
    const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null)
    const [contactCalls, setContactCalls] = useState<ContactHistoryCall[]>([])
    const [contactCallsLoading, setContactCallsLoading] = useState(false)
    const [contactNotice, setContactNotice] = useState<string | null>(null)
    const [contactFormOpen, setContactFormOpen] = useState(false)
    const [contactSaving, setContactSaving] = useState(false)
    const [atsFetching, setAtsFetching] = useState(false)
    const [newContact, setNewContact] = useState({
        name: "",
        email: "",
        phone: "",
        company_name: ""
    })

    // Refs for SDK and Audio lifecycle
    const clientRef = useRef<any>(null)
    const activeCallRef = useRef<any>(null)
    const incomingCallRef = useRef<any>(null)
    const timerIdRef = useRef<any>(null)
    const reconnectTimerRef = useRef<any>(null)
    const readyWatchdogRef = useRef<any>(null)
    const rtcSyncTimerRef = useRef<any>(null)
    const answerWatchdogRef = useRef<any>(null)
    const callStartRef = useRef<number>(0)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const ringBufferRef = useRef<AudioBuffer | null>(null)
    const ringSourceRef = useRef<AudioBufferSourceNode | null>(null)
    const ringRequestedRef = useRef<boolean>(false)
    const ringingCallIdRef = useRef<string>("")
    const suppressRingForCallIdsRef = useRef<Set<string>>(new Set())
    const currentTabRef = useRef<"recent" | "missed" | "voicemail">("recent")
    const isConnectingRef = useRef<boolean>(false)
    const clientReadyRef = useRef<boolean>(false)
    const dialedNumberRef = useRef<string>("")
    const isDialingRef = useRef<boolean>(false)
    const callerLookupPhoneRef = useRef<string>("")
    const callerLookupRequestRef = useRef<number>(0)
    const callerLookupAbortRef = useRef<AbortController | null>(null)
    const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "")

    // Keep refs synchronized
    useEffect(() => {
        activeCallRef.current = activeCall
    }, [activeCall])

    useEffect(() => {
        incomingCallRef.current = incomingCall
    }, [incomingCall])

    useEffect(() => {
        currentTabRef.current = currentTab
    }, [currentTab])

    // Format mm:ss
    const mmss = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0")

    const isPlaceholder = (s: any) => {
        if (!s || typeof s !== "string") return true
        const lower = s.trim().toLowerCase()
        return (
            lower === "outbound call" ||
            lower === "outbound" ||
            lower === "unknown" ||
            lower === "active call" ||
            lower === "incoming call"
        )
    }

    const normalizeLookupPhone = (value: any): string => {
        if (!value || typeof value !== "string" || isPlaceholder(value)) return ""
        const trimmed = value.trim()
        const digits = trimmed.replace(/\D/g, "")
        if (digits.length < 5) return ""

        const compact = trimmed.replace(/[^\d+]/g, "")
        if (!compact) return ""

        if (compact.startsWith("+")) {
            return `+${compact.slice(1).replace(/\+/g, "")}`
        }

        return compact.replace(/\+/g, "")
    }

    const sanitizeCallableNumber = (value: any): string => {
        if (!value || typeof value !== "string" || isPlaceholder(value)) return ""
        const trimmed = value.trim()
        if (!trimmed) return ""

        const digits = trimmed.replace(/\D/g, "")
        if (!digits) return ""

        return trimmed.startsWith("+") ? `+${digits}` : digits
    }

    // Helper: callerOf(call)
    const callerOf = (call: any) => {
        if (!call) return dialedNumberRef.current || "Unknown"
        if (typeof call === "string") return isPlaceholder(call) ? (dialedNumberRef.current || "Unknown") : call
        const o = call.options || {}

        // For outbound calls, prioritize destination number
        if (call.direction === "outbound" || o.direction === "outbound" || dialedNumberRef.current) {
            const dest = o.destinationNumber || call.destinationNumber || dialedNumberRef.current || o.remoteCallerNumber || call.number
            if (dest && !isPlaceholder(dest)) return dest
        }

        const candidates = [
            o.remoteCallerName,
            o.remoteCallerNumber,
            o.destinationNumber,
            call.destinationNumber,
            call.number,
            call.callerName,
            call.callerNumber,
            dialedNumberRef.current
        ]
        for (const c of candidates) {
            if (c && typeof c === "string" && !isPlaceholder(c)) {
                return c
            }
        }
        return dialedNumberRef.current || "Unknown"
    }

    // Helper to get cookie by name
    const getCookie = (name: string): string => {
        if (typeof document === "undefined") return ""
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(";").shift() || ""
        return ""
    }

    const stopMediaStream = (stream?: MediaStream | null) => {
        stream?.getTracks().forEach(track => {
            try { track.stop() } catch { }
        })
    }

    const friendlyMediaError = (error: any): string => {
        const name = String(error?.name || "")
        const message = String(error?.message || error || "")

        if (message) {
            const lower = message.toLowerCase()
            if (
                lower.includes("microphone access is blocked") ||
                lower.includes("microphone permission") ||
                lower.includes("secure context") ||
                lower.includes("https")
            ) {
                return message
            }
        }

        switch (name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
            case "SecurityError":
                return "Microphone access is blocked. Allow microphone access in Chrome site settings and Windows privacy settings, then try again."
            case "NotFoundError":
            case "DevicesNotFoundError":
                return "No microphone was found. Connect or enable a microphone, then try again."
            case "NotReadableError":
            case "TrackStartError":
                return "Chrome could not start the microphone. Close other apps using it, check Windows microphone privacy settings, then try again."
            case "OverconstrainedError":
            case "ConstraintNotSatisfiedError":
                return "The selected microphone could not be used. Choose the system default microphone in Chrome, then try again."
            case "AbortError":
                return "The microphone stopped while the call was starting. Try again after reconnecting the microphone."
            case "TypeError":
                return "This browser context cannot access the microphone. Use Chrome on HTTPS or localhost."
            default:
                return message || "Could not start the call. Check microphone permission and try again."
        }
    }

    const telnyxErrorMessage = (error: any): string => {
        const code = Number(error?.code)
        switch (code) {
            case 40001:
                return "Chrome could not create the WebRTC offer. Refresh the page and try the call again."
            case 40005:
                return "Could not send the call request to Telnyx. Check the connection and try again."
            case 42001:
                return "Microphone access is blocked. Allow microphone access in Chrome site settings and Windows privacy settings, then try again."
            case 42002:
                return "No microphone was found. Connect or enable a microphone, then try again."
            case 42003:
                return "Chrome could not access the microphone. Close other apps using it, then try again."
            case 44002:
                return "The phone number is missing or invalid. Enter a valid destination number and try again."
            case 45001:
            case 45002:
                return "The Telnyx signaling connection was interrupted. Check the network and try again."
            case 46003:
                return "The phone registration expired. Reconnecting now; try again when the badge is Online."
            case 48001:
                return "This device is offline. Reconnect to the internet and try again."
            default:
                return error?.message || "Call setup failed. Check the console for details and try again."
        }
    }

    const ensureMicrophoneReady = async (): Promise<MediaStream> => {
        if (typeof window === "undefined" || typeof navigator === "undefined") {
            throw new Error("Calls can only start in a browser.")
        }

        if (!window.isSecureContext) {
            throw new Error("Voice calling needs HTTPS or localhost so Chrome can use the microphone.")
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            throw new Error("This browser does not support microphone access required for calls.")
        }

        try {
            const permission = await navigator.permissions?.query?.({ name: "microphone" as PermissionName })
            if (permission?.state === "denied") {
                throw new Error("Microphone access is blocked. Allow microphone access in Chrome site settings and Windows privacy settings, then try again.")
            }
        } catch (error: any) {
            if (String(error?.message || "").toLowerCase().includes("microphone access is blocked")) {
                throw error
            }
        }

        let stream: MediaStream | null = null
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            })
        } catch {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            } catch (secondError) {
                throw secondError
            }
        }

        if (!stream) {
            throw new Error("Chrome could not open the microphone.")
        }

        const hasLiveAudio = stream.getAudioTracks().some(track => track.readyState === "live")
        if (!hasLiveAudio) {
            stopMediaStream(stream)
            throw new Error("Chrome opened the microphone, but no live audio track was available.")
        }

        return stream
    }

    // API fetch wrapper matching portal.js
    const api = async (url: string, opts: RequestInit = {}) => {
        const token = cookieUtils.get("access")
        const csrfToken = getCookie("csrftoken")
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
            ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
            ...((opts.headers as Record<string, string>) || {})
        }

        const fullUrl = url.startsWith("http")
            ? url
            : `${VOICE_BASE}${url.startsWith("/") ? "" : "/"}${url}`

        const res = await fetch(fullUrl, {
            credentials: "include",
            ...opts,
            headers
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            throw new Error(data.error || data.detail || `HTTP ${res.status}`)
        }
        return data
    }

    const personName = (person?: {
        firstName?: string;
        lastName?: string;
        name?: string;
        email?: string;
        phone?: string;
        mobile?: string;
    }) => {
        if (!person) return "Unknown"
        const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
        return name || person.name || person.email || person.mobile || person.phone || "Unknown"
    }

    const compactParts = (parts: Array<string | number | null | undefined | false>) =>
        parts
            .map(part => (part === undefined || part === null || part === false ? "" : String(part).trim()))
            .filter(Boolean)
            .join(" · ")

    const formatAddress = (address?: JobAdderAddress) => {
        if (!address) return ""
        const street = Array.isArray(address.street) ? address.street.join(", ") : address.street
        return compactParts([
            street,
            address.city,
            address.state,
            address.postalCode || address.postcode,
            address.country
        ])
    }

    const formatJobAdderUser = (user?: JobAdderUser) => {
        if (!user) return ""
        const name = personName(user)
        return compactParts([name === "Unknown" ? "" : name, user.jobTitle || user.position, user.email])
    }

    const formatLookupDate = (value?: string) => {
        if (!value) return ""
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ""
        return date.toLocaleString()
    }

    const recordPhone = (record: JobAdderCandidate | JobAdderContact) =>
        record.mobileNormalized || record.mobile || record.phone || ""

    const getLookupOptions = (data?: JobAdderCallerLookupResponse | null): CallerLookupOption[] => {
        const candidates = Array.isArray(data?.candidates) ? data.candidates : []
        const contacts = Array.isArray(data?.contacts) ? data.contacts : []

        return [
            ...candidates.map((candidate, index) => ({
                key: `candidate:${candidate.candidateId || index}:${index}`,
                type: "candidate" as const,
                index,
                label: compactParts([
                    personName(candidate),
                    candidate.status?.name,
                    recordPhone(candidate)
                ]),
                record: candidate
            })),
            ...contacts.map((contact, index) => ({
                key: `contact:${contact.contactId || index}:${index}`,
                type: "contact" as const,
                index,
                label: compactParts([
                    personName(contact),
                    contact.company?.name,
                    contact.status?.name,
                    recordPhone(contact)
                ]),
                record: contact
            }))
        ]
    }

    const resetCallerLookup = () => {
        callerLookupRequestRef.current += 1
        callerLookupPhoneRef.current = ""
        if (callerLookupAbortRef.current) {
            callerLookupAbortRef.current.abort()
            callerLookupAbortRef.current = null
        }
        setCallerLookup(null)
        setSelectedLookupKey("")
    }

    const startCallerLookup = (rawPhone: any) => {
        const phone = normalizeLookupPhone(rawPhone)
        if (!phone || callerLookupPhoneRef.current === phone) return

        callerLookupPhoneRef.current = phone
        callerLookupRequestRef.current += 1
        const requestId = callerLookupRequestRef.current

        if (callerLookupAbortRef.current) {
            callerLookupAbortRef.current.abort()
        }

        const controller = new AbortController()
        callerLookupAbortRef.current = controller
        setCallerLookup({ phone, loading: true, error: null, data: null })
        setSelectedLookupKey("")

        const separator = cfgRef.current.callerLookupUrl.includes("?") ? "&" : "?"
        const lookupUrl = `${cfgRef.current.callerLookupUrl}${separator}phone=${encodeURIComponent(phone)}`

        api(lookupUrl, { signal: controller.signal })
            .then((data: JobAdderCallerLookupResponse) => {
                if (controller.signal.aborted || callerLookupRequestRef.current !== requestId) return

                const normalizedData: JobAdderCallerLookupResponse = {
                    ...data,
                    candidates: Array.isArray(data?.candidates) ? data.candidates : [],
                    contacts: Array.isArray(data?.contacts) ? data.contacts : []
                }
                const firstOption = getLookupOptions(normalizedData)[0]

                setCallerLookup({
                    phone,
                    loading: false,
                    error: null,
                    data: normalizedData
                })
                setSelectedLookupKey(firstOption?.key || "")
            })
            .catch((e: any) => {
                if (controller.signal.aborted || callerLookupRequestRef.current !== requestId) return

                setCallerLookup({
                    phone,
                    loading: false,
                    error: e?.message || "Could not load JobAdder caller details",
                    data: null
                })
                setSelectedLookupKey("")
            })
    }

    // Reliable Web Audio ringtone. A looping AudioBuffer is used instead of
    // setInterval/oscillator bursts because browsers can throttle timers and Telnyx
    // may emit repeated "ringing" notifications for the same call.
    const callId = (call: any): string => {
        if (!call || call.id == null) return ""
        return String(call.id)
    }

    const recoveredCallId = (call: any): string => {
        if (!call || call.recoveredCallId == null) return ""
        return String(call.recoveredCallId)
    }

    const sameCall = (a: any, b: any): boolean => {
        const aId = callId(a)
        const bId = callId(b)
        if (!aId || !bId) return false
        return aId === bId || recoveredCallId(a) === bId || recoveredCallId(b) === aId
    }

    const callDirection = (call: any): string => {
        return String(call?.direction || call?.options?.direction || "").toLowerCase()
    }

    const callState = (call: any): string => {
        return String(call?.state || "").toLowerCase()
    }

    const isDefinitelyOutbound = (call: any): boolean => {
        if (callDirection(call) === "outbound") return true
        // If this is the same object/call we created with newCall(), it is outbound
        // even if an older SDK build temporarily omits the direction field.
        return !!(activeCallRef.current && sameCall(activeCallRef.current, call) && dialedNumberRef.current)
    }

    const phoneOfCall = (call: any): string => {
        if (!call) return normalizeLookupPhone(dialedNumberRef.current)
        if (typeof call === "string") return normalizeLookupPhone(call)

        const o = call.options || {}
        const candidates = isDefinitelyOutbound(call)
            ? [
                o.destinationNumber,
                call.destinationNumber,
                dialedNumberRef.current,
                o.remoteCallerNumber,
                call.number,
                call.callerNumber,
                o.remoteCallerName
            ]
            : [
                o.remoteCallerNumber,
                call.callerNumber,
                call.number,
                o.callerNumber,
                o.from,
                o.remoteCallerName,
                dialedNumberRef.current
            ]

        for (const candidate of candidates) {
            const phone = normalizeLookupPhone(candidate)
            if (phone) return phone
        }

        return normalizeLookupPhone(callerOf(call))
    }

    // Answer the freshest live Telnyx Call object.
    //
    // Telnyx fixed the "distinct second inbound call cannot be answered" bug in
    // WebRTC 2.27.4+ (VSUP-122). We still keep the attach=true compatibility guard
    // for an older locally-vendored bundle, but the pinned 2.27.10 bundle is loaded
    // first below so normal calls do not depend on this internal workaround.
    const answerIncomingCall = async (originalCall: any) => {
        const client = clientRef.current
        let call = originalCall

        // React may hold a stale Call object after recovery/reconnect. Always prefer
        // the current object from the SDK cache if one with the same ID exists.
        if (client && typeof client.getActiveCalls === "function") {
            try {
                const liveCalls = client.getActiveCalls() || []
                const fresh = liveCalls.find((candidate: any) => sameCall(candidate, originalCall))
                if (fresh) call = fresh
            } catch (e) {
                console.warn("Could not refresh incoming Telnyx Call object before answer", e)
            }
        }

        if (!call || typeof call.answer !== "function") {
            throw new Error("Incoming Telnyx call cannot be answered")
        }

        // Keep the actual object used for answering in React/ref state so subsequent
        // callUpdate events and Answer/Decline actions refer to the same instance.
        incomingCallRef.current = call
        setIncomingCall(call)

        const options = call.options || {}
        if (!call.options) call.options = options

        const hadAttach = Object.prototype.hasOwnProperty.call(options, "attach")
        const previousAttach = options.attach

        // Session-level client.remoteElement is already "remoteAudio". Setting it on
        // the call as well makes the destination explicit without delaying answer().
        options.remoteElement = "remoteAudio"
        options.attach = true

        try {
            console.info("[TELNYX] Answer button pressed", {
                id: callId(call),
                state: callState(call),
                direction: callDirection(call),
                hasPeer: !!call?.peer,
                attachWorkaround: true
            })

            // IMPORTANT: do not await an extra permissions probe before this call.
            // answer() must run immediately from the user's click. The Telnyx SDK will
            // request microphone access itself when needed.
            const result = call.answer()
            await Promise.resolve(result)
        } finally {
            // The old 2.27.0-2.27.3 workaround only needs attach=true while answer()
            // performs its duplicate-answer guard. Restore the previous value after.
            if (hadAttach) options.attach = previousAttach
            else delete options.attach
        }

        return call
    }

    const getAudioContext = (): AudioContext | null => {
        if (audioCtxRef.current) return audioCtxRef.current
        if (typeof window === "undefined") return null
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) return null
        audioCtxRef.current = new AudioContextClass()
        return audioCtxRef.current
    }

    const getRingtoneBuffer = (ctx: AudioContext): AudioBuffer => {
        if (ringBufferRef.current && ringBufferRef.current.sampleRate === ctx.sampleRate) {
            return ringBufferRef.current
        }

        // Two short tones followed by silence. The whole buffer loops continuously.
        const durationSeconds = 2.5
        const frameCount = Math.floor(durationSeconds * ctx.sampleRate)
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
        const data = buffer.getChannelData(0)

        const writeTone = (startSeconds: number, toneSeconds: number, frequency: number) => {
            const startFrame = Math.floor(startSeconds * ctx.sampleRate)
            const toneFrames = Math.floor(toneSeconds * ctx.sampleRate)
            const fadeFrames = Math.max(1, Math.floor(0.015 * ctx.sampleRate))

            for (let i = 0; i < toneFrames && startFrame + i < frameCount; i++) {
                let envelope = 1
                if (i < fadeFrames) envelope = i / fadeFrames
                if (i > toneFrames - fadeFrames) {
                    envelope = Math.max(0, (toneFrames - i) / fadeFrames)
                }
                data[startFrame + i] =
                    0.16 * envelope * Math.sin((2 * Math.PI * frequency * i) / ctx.sampleRate)
            }
        }

        writeTone(0, 0.4, 440)
        writeTone(0.45, 0.4, 480)
        ringBufferRef.current = buffer
        return buffer
    }

    const startRingSource = () => {
        const ctx = audioCtxRef.current
        if (!ringRequestedRef.current || ringSourceRef.current || !ctx || ctx.state !== "running") return

        const source = ctx.createBufferSource()
        source.buffer = getRingtoneBuffer(ctx)
        source.loop = true
        source.connect(ctx.destination)
        source.onended = () => {
            if (ringSourceRef.current === source) ringSourceRef.current = null
        }
        source.start()
        ringSourceRef.current = source
    }

    const unlockAudio = async () => {
        try {
            const ctx = getAudioContext()
            if (!ctx) return
            if (ctx.state !== "running") await ctx.resume()
            const running = ctx.state === "running"
            setSoundBannerVisible(!running)
            if (running && ringRequestedRef.current) startRingSource()
        } catch (e) {
            console.warn("Could not unlock ringtone audio", e)
            setSoundBannerVisible(true)
        }
    }

    const stopRinger = (call?: any) => {
        // Only the call that owns the ringtone is allowed to stop it. This prevents an
        // unrelated/outbound Telnyx callUpdate from silencing a valid incoming call.
        if (call && ringingCallIdRef.current) {
            const id = callId(call)
            const recovered = recoveredCallId(call)
            if (id !== ringingCallIdRef.current && recovered !== ringingCallIdRef.current) return
        }

        ringRequestedRef.current = false
        ringingCallIdRef.current = ""

        const source = ringSourceRef.current
        ringSourceRef.current = null
        if (source) {
            try { source.stop() } catch { }
            try { source.disconnect() } catch { }
        }
    }

    const startRinger = (call: any) => {
        const id = callId(call)
        if (!id) return

        // Repeated "ringing" events for the same call must be idempotent.
        if (ringRequestedRef.current && ringingCallIdRef.current === id) {
            startRingSource()
            return
        }

        stopRinger()
        ringRequestedRef.current = true
        ringingCallIdRef.current = id

        const ctx = getAudioContext()
        if (!ctx) return

        if (ctx.state === "running") {
            setSoundBannerVisible(false)
            startRingSource()
            return
        }

        // Browser autoplay policy may require one click/tap first. Keep the ring request
        // alive so the sound starts immediately after the user unlocks audio.
        setSoundBannerVisible(true)
        void ctx.resume().then(() => {
            if (ringRequestedRef.current && ringingCallIdRef.current === id && ctx.state === "running") {
                setSoundBannerVisible(false)
                startRingSource()
            }
        }).catch(() => setSoundBannerVisible(true))
    }

    // Refresh list of calls or voicemail from API
    const refreshList = useCallback(async () => {
        setListErrorMessage(null)
        try {
            if (currentTabRef.current === "voicemail") {
                const res = await api(cfgRef.current.voicemailsUrl).catch(() => null)
                const vms: VoicemailItem[] = res && res.voicemails ? res.voicemails : [
                    {
                        uid: "vm-1",
                        id: "vm-1",
                        from: "+44 161 496 0184",
                        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                        duration: 38,
                        is_read: false,
                        ready: true,
                        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                        read_url: `${VOICE_BASE}/voice/api/voicemails/vm-1/read/`
                    },
                    {
                        uid: "vm-2",
                        id: "vm-2",
                        from: "+44 770 090 0552",
                        created_at: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
                        duration: 52,
                        is_read: true,
                        ready: true,
                        audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
                        read_url: `${VOICE_BASE}/voice/api/voicemails/vm-2/read/`
                    }
                ]
                setVoicemailsList(vms)
                const unread = vms.filter(v => !v.is_read).length
                setUnreadVoicemails(unread)
            } else {
                const url = cfgRef.current.callsUrl + (currentTabRef.current === "missed" ? "?filter=missed" : "")
                const res = await api(url).catch(() => null)
                const calls: CallItem[] = res && res.calls ? res.calls : [
                    {
                        uid: "call-1",
                        id: 1,
                        direction: "inbound",
                        status: "completed",
                        number: "+44 20 7946 0912",
                        contact_name: "Sarah Jenkins",
                        started_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                        duration: 142,
                        handled_by: "Ext 101"
                    },
                    {
                        uid: "call-2",
                        id: 2,
                        direction: "inbound",
                        status: "missed",
                        number: "+44 161 496 0184",
                        contact_name: "Marcus Davies",
                        started_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                        duration: 0,
                        has_voicemail: true
                    },
                    {
                        uid: "call-3",
                        id: 3,
                        direction: "outbound",
                        status: "completed",
                        number: "+44 113 496 0833",
                        contact_name: "David Smith",
                        started_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
                        duration: 265,
                        handled_by: "Ext 101"
                    },
                    {
                        uid: "call-4",
                        id: 4,
                        direction: "inbound",
                        status: "missed",
                        number: "+44 20 8946 0233",
                        contact_name: "Emma Wilson",
                        started_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
                        duration: 0
                    }
                ]
                setCallsList(calls)
            }
        } catch (e: any) {
            setListErrorMessage(e.message || "Failed to load calls")
        }
    }, [VOICE_BASE])

    const CONTACTS_URL = useMemo(() => `${VOICE_BASE}/contacts/`, [VOICE_BASE])

    const contactDisplayName = useCallback((contact?: ContactItem | null) => {
        if (!contact) return "Unknown contact"
        const name = contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
        return name || contact.email || contact.phone || "Unknown contact"
    }, [])

    const extractContacts = useCallback((payload: any): ContactItem[] => {
        if (Array.isArray(payload?.results)) return payload.results
        if (Array.isArray(payload?.contacts)) return payload.contacts
        if (Array.isArray(payload)) return payload
        return []
    }, [])

    const loadContactHistory = useCallback(async (contactId: number) => {
        setContactCallsLoading(true)
        try {
            const data = await api(`${CONTACTS_URL}${contactId}/calls`)
            setSelectedContact(data.contact || null)
            setContactCalls(Array.isArray(data.calls) ? data.calls : [])
        } catch (e: any) {
            setContactCalls([])
            setContactNotice(e.message || "Could not load contact calls")
        } finally {
            setContactCallsLoading(false)
        }
    }, [CONTACTS_URL])

    const loadContacts = useCallback(async () => {
        setContactsLoading(true)
        setContactsError(null)
        try {
            const data = await api(CONTACTS_URL)
            const contacts = extractContacts(data)
            setContactsList(contacts)
            setSelectedContactId(current => {
                if (current && contacts.some(contact => contact.id === current)) return current
                return contacts[0]?.id || null
            })
        } catch (e: any) {
            setContactsError(e.message || "Could not load contacts")
        } finally {
            setContactsLoading(false)
        }
    }, [CONTACTS_URL, extractContacts])

    const createContact = async () => {
        const payload = {
            name: newContact.name.trim(),
            email: newContact.email.trim(),
            phone: newContact.phone.trim() || undefined,
            company_name: newContact.company_name.trim()
        }

        if (!payload.name || !payload.email) {
            setContactNotice("Name and email are required.")
            return
        }

        setContactSaving(true)
        setContactNotice(null)
        try {
            const created = await api(CONTACTS_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            })
            setNewContact({ name: "", email: "", phone: "", company_name: "" })
            setContactFormOpen(false)
            setContactNotice("Contact created.")
            await loadContacts()
            if (created?.id) setSelectedContactId(created.id)
        } catch (e: any) {
            setContactNotice(e.message || "Could not create contact")
        } finally {
            setContactSaving(false)
        }
    }

    const fetchAtsContacts = async () => {
        setAtsFetching(true)
        setContactNotice(null)
        try {
            const data = await api(`${VOICE_BASE}/contacts/fetch`, { method: "POST" })
            setContactNotice(data.detail || "Contact fetching started.")
            setTimeout(() => {
                void loadContacts()
            }, 4000)
        } catch (e: any) {
            setContactNotice(e.message || "Could not start contact fetch")
        } finally {
            setAtsFetching(false)
        }
    }

    // Incoming Call UI handling
    const showIncoming = (call: any) => {
        const id = callId(call)
        setCallError(null)

        if (incomingCallRef.current && !sameCall(incomingCallRef.current, call)) {
            stopRinger(incomingCallRef.current)
        }

        incomingCallRef.current = call
        setIncomingCall(call)
        setIncomingCaller(callerOf(call))
        startCallerLookup(phoneOfCall(call))

        // After Answer/Decline is clicked Telnyx can emit one final ringing update.
        // Do not let that stale update restart the ringtone.
        if (!suppressRingForCallIdsRef.current.has(id)) {
            startRinger(call)
        }

        if (typeof document !== "undefined") {
            document.title = `Incoming call - ${baseTitleRef.current || "Phone"}`
        }
    }

    // Active Call UI handling
    const showActive = (call: any, stateText: string) => {
        setCallError(null)
        setIsAnswering(false)
        if (answerWatchdogRef.current) {
            clearTimeout(answerWatchdogRef.current)
            answerWatchdogRef.current = null
        }

        if (incomingCallRef.current && sameCall(incomingCallRef.current, call)) {
            setIncomingCall(null)
            incomingCallRef.current = null
            stopRinger(call)
        }

        suppressRingForCallIdsRef.current.delete(callId(call))

        const first = !activeCallRef.current
        activeCallRef.current = call
        setActiveCall(call)
        setActiveWho(callerOf(call))
        startCallerLookup(phoneOfCall(call))

        if (stateText === "Connected" && (first || !callStartRef.current)) {
            callStartRef.current = Date.now()
            clearInterval(timerIdRef.current)
            setActiveStateText("Connected " + mmss(0))
            timerIdRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartRef.current) / 1000)
                setActiveStateText("Connected " + mmss(elapsed))
            }, 1000)
        } else if (stateText !== "Connected") {
            clearInterval(timerIdRef.current)
            setActiveStateText(stateText)
        }
    }

    // End call cleanup
    const endCall = useCallback((call?: any) => {
        setIsAnswering(false)
        if (answerWatchdogRef.current) {
            clearTimeout(answerWatchdogRef.current)
            answerWatchdogRef.current = null
        }
        if (call) suppressRingForCallIdsRef.current.delete(callId(call))

        if (incomingCallRef.current && (!call || sameCall(incomingCallRef.current, call))) {
            const endingIncoming = incomingCallRef.current
            setIncomingCall(null)
            incomingCallRef.current = null
            stopRinger(call || endingIncoming)
            resetCallerLookup()
            if (typeof document !== "undefined") {
                document.title = baseTitleRef.current || document.title
            }
        }

        if (activeCallRef.current && (!call || sameCall(activeCallRef.current, call))) {
            setActiveCall(null)
            activeCallRef.current = null
            clearInterval(timerIdRef.current)
            timerIdRef.current = null
            setShowTransferPanel(false)
            setTransferMsg("")
            setIsTransferring(false)
            setHeld(false)
            setMuted(false)
            callStartRef.current = 0
            dialedNumberRef.current = ""
            resetCallerLookup()
            if (typeof document !== "undefined") {
                document.title = baseTitleRef.current || document.title
            }
            setTimeout(refreshList, 1500)
        }
    }, [refreshList])

    // Event notification handler from Telnyx RTC SDK
    const onNotification = (n: any) => {
        // Some older bundle builds omit `type` on a call notification. The call
        // object/state is the authoritative part we need, so only reject a
        // notification when it explicitly says it is a different type.
        if (!n?.call) return
        if (n.type && n.type !== "callUpdate") return

        const call = n.call
        const state = callState(call)
        const direction = callDirection(call)

        console.debug("Telnyx callUpdate", {
            id: callId(call),
            recoveredCallId: recoveredCallId(call),
            direction,
            state,
            telnyxIDs: call?.telnyxIDs
        })

        // IMPORTANT: never globally stop the ringtone because another Telnyx
        // leg changed state. Only the matching incoming call can stop its ring.
        switch (state) {
            case "ringing":
            case "early":
                // Telnyx documents `ringing` as an incoming-call state. Keep the
                // explicit outbound check for compatibility with older SDK builds,
                // but if direction is missing treat a new ringing call as inbound.
                if (isDefinitelyOutbound(call)) showActive(call, "Ringing…")
                else showIncoming(call)
                break

            case "requesting":
            case "trying":
                if (direction === "outbound" || isDefinitelyOutbound(call)) {
                    showActive(call, "Calling…")
                }
                break

            case "answering":
                stopRinger(call)
                showActive(call, "Connecting…")
                break

            case "recovering":
                stopRinger(call)
                showActive(call, "Reconnecting…")
                break

            case "active":
                stopRinger(call)
                showActive(call, "Connected")
                break

            case "held":
                stopRinger(call)
                showActive(call, "On hold")
                break

            case "hangup":
            case "destroy":
            case "purge":
                endCall(call)
                break
        }
    }

    // Recovery path for missed/stale React event callbacks. Current Telnyx SDK
    // exposes getActiveCalls(); polling this is cheap and gives us the actual Call
    // object, so Answer/Decline still work even if one callUpdate notification was
    // missed while the component was mounting/reconnecting.
    const reconcileRtcCalls = () => {
        const client = clientRef.current
        if (!clientReadyRef.current || !client || typeof client.getActiveCalls !== "function") return

        let rtcCalls: any[] = []
        try {
            rtcCalls = client.getActiveCalls() || []
        } catch (e) {
            console.warn("Could not inspect Telnyx active calls", e)
            return
        }

        const inboundRinging = rtcCalls.find((c: any) => {
            const state = callState(c)
            return (state === "ringing" || state === "early") && !isDefinitelyOutbound(c)
        })

        if (inboundRinging) {
            if (!incomingCallRef.current || !sameCall(incomingCallRef.current, inboundRinging)) {
                console.info("Recovered incoming Telnyx call from getActiveCalls()", {
                    id: callId(inboundRinging),
                    direction: callDirection(inboundRinging),
                    state: callState(inboundRinging)
                })
                showIncoming(inboundRinging)
            } else if (!ringRequestedRef.current) {
                startRinger(inboundRinging)
            }
            return
        }

        // Also recover an answered/active call after a short network reconnect.
        const connected = rtcCalls.find((c: any) => {
            const state = callState(c)
            return state === "answering" || state === "active" || state === "held" || state === "recovering"
        })

        if (connected && (!activeCallRef.current || !sameCall(activeCallRef.current, connected))) {
            const state = callState(connected)
            showActive(
                connected,
                state === "active" ? "Connected" : state === "held" ? "On hold" : state === "recovering" ? "Reconnecting…" : "Connecting…"
            )
        }
    }

    // SDK script loader
    const loadSdk = () => {
        return new Promise<void>((resolve, reject) => {
            if (typeof window === "undefined") {
                return reject(new Error("Telnyx SDK can only load in the browser"))
            }

            // IMPORTANT: load a version that contains Telnyx VSUP-122 first.
            // The previous code preferred /js/telnyx-webrtc.js. If that local file is
            // 2.27.0-2.27.3, transferred calls ring but answer() is silently ignored.
            const scriptUrls = [
                "https://unpkg.com/@telnyx/webrtc@2.27.10/lib/bundle.js",
                "/js/telnyx-webrtc.js"
            ]
            let index = 0

            const tryLoadScript = () => {
                if (index >= scriptUrls.length) {
                    return reject(new Error("Could not load the Telnyx WebRTC SDK (" + cfgRef.current.sdkUrl + ")"))
                }
                const url = scriptUrls[index++]
                const s = document.createElement("script")
                s.src = url
                s.onload = () => resolve()
                s.onerror = () => {
                    console.warn(`Failed loading SDK from ${url}, trying fallback...`)
                    tryLoadScript()
                }
                document.head.appendChild(s)
            }

            tryLoadScript()
        })
    }

    const scheduleReconnect = () => {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(connect, 5000)
    }

    // Connect WebRTC SDK
    const connect = async () => {
        if (activeCallRef.current || incomingCallRef.current) {
            reconnectTimerRef.current = setTimeout(connect, 15000)
            return
        }
        if (isConnectingRef.current) return
        isConnectingRef.current = true

        setStatus((prev) => (prev === "online" ? "online" : "connecting"))
        setStatusDetail("")
        try {
            await loadSdk()
            const RTC =
                (window as any).TelnyxWebRTC?.TelnyxRTC ||
                (window as any).TelnyxRTC?.TelnyxRTC ||
                (window as any).TelnyxRTC ||
                (window as any).TelnyxWebRTC

            if (!RTC) throw new Error("Telnyx SDK global not found")

            // Fetch live login_token
            let token: string | null = null
            try {
                const res = await api(cfgRef.current.tokenUrl, { method: "POST" })
                token = res?.token || res?.login_token || res?.data?.token || res?.jwt || null
            } catch (err: any) {
                try {
                    const fallbackRes = await fetch("/api/voice/token", { method: "POST" })
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json()
                        token = fallbackData?.token || fallbackData?.login_token || null
                    }
                } catch (e: any) {
                    console.warn("Fallback token endpoint note:", e)
                }
            }

            if (RTC && token) {
                if (clientRef.current) {
                    try {
                        const oldClient = clientRef.current
                        clientRef.current = null
                        if (typeof oldClient.off === "function") {
                            oldClient.off("telnyx.ready")
                            oldClient.off("telnyx.socket.open")
                            oldClient.off("telnyx.socket.close")
                            oldClient.off("telnyx.socket.error")
                            oldClient.off("telnyx.error")
                            oldClient.off("telnyx.warning")
                            oldClient.off("telnyx.notification")
                        }
                        oldClient.disconnect()
                    } catch (e) { }
                }

                clientReadyRef.current = false

                const client = new RTC({
                    login_token: token,
                    enableCallReports: true,
                    disableCallReport: false,
                    enableCallRecording: false,
                    autoReconnect: true,
                    maxReconnectAttempts: 10
                })

                try {
                    client.remoteElement = "remoteAudio"
                } catch (e) { }

                client.on("telnyx.ready", () => {
                    if (clientRef.current !== client) return
                    clientReadyRef.current = true
                    if (readyWatchdogRef.current) {
                        clearTimeout(readyWatchdogRef.current)
                        readyWatchdogRef.current = null
                    }
                    setStatus("online")
                    setStatusDetail("Online - ready for incoming calls")
                    // If the invite arrived during registration/mount, recover it now.
                    setTimeout(reconcileRtcCalls, 0)
                })

                client.on("telnyx.socket.open", () => {
                    if (clientRef.current !== client) return
                    // Socket open only means signaling transport is up. Wait for
                    // telnyx.ready before advertising that the phone can receive calls.
                    setStatus("connecting")
                    setStatusDetail("Registering phone…")
                })

                client.on("telnyx.error", (e: any) => {
                    if (clientRef.current !== client) return
                    console.error("telnyx.error", e)
                    const telnyxError = e?.error || e
                    const code = Number(telnyxError?.code || e?.code)
                    const message = telnyxErrorMessage(telnyxError)
                    const eventCallId = String(e?.callId || telnyxError?.callId || "")
                    const currentActive = activeCallRef.current
                    const currentIncoming = incomingCallRef.current
                    const setupFailureCodes = [40001, 40005, 42001, 42002, 42003, 44002]

                    if (
                        eventCallId ||
                        currentActive ||
                        setupFailureCodes.includes(code)
                    ) {
                        setCallError(message)
                        setStatusDetail(message)
                    }

                    const matchesActiveCall =
                        currentActive &&
                        (!eventCallId || callId(currentActive) === eventCallId || recoveredCallId(currentActive) === eventCallId)
                    const matchesIncomingCall =
                        currentIncoming &&
                        (!eventCallId || callId(currentIncoming) === eventCallId || recoveredCallId(currentIncoming) === eventCallId)

                    if ((matchesActiveCall || matchesIncomingCall) && setupFailureCodes.includes(code)) {
                        endCall(matchesActiveCall ? currentActive : currentIncoming)
                    }

                    const isFatal = telnyxError?.fatal === true || e?.fatal === true || code === 46001 || code === 46002 || code === 45003 || code === 48001
                    if (isFatal && !activeCallRef.current && !incomingCallRef.current) {
                        clientReadyRef.current = false
                        setStatus("offline")
                        setStatusDetail(message || "Offline")
                        scheduleReconnect()
                    }
                })

                client.on("telnyx.socket.close", () => {
                    if (clientRef.current !== client) return
                    clientReadyRef.current = false
                    if (!activeCallRef.current && !incomingCallRef.current) {
                        setStatus("connecting")
                        setStatusDetail("Reconnecting…")
                        // SDK autoReconnect gets the first chance; this is only a
                        // fallback if registration never returns.
                        clearTimeout(reconnectTimerRef.current)
                        reconnectTimerRef.current = setTimeout(() => {
                            if (!clientReadyRef.current && !activeCallRef.current && !incomingCallRef.current) connect()
                        }, 12000)
                    }
                })

                client.on("telnyx.warning", (warning: any) => {
                    if (clientRef.current !== client) return
                    console.warn("[TELNYX WARNING]", warning)
                    if (warning?.code === 33007 || String(warning?.code) === "33007") {
                        setStatusDetail("Telnyx blocked a duplicate inbound answer (33007)")
                    }
                })

                client.on("telnyx.notification", onNotification)
                clientRef.current = client

                // If the WebSocket opens but REGED/telnyx.ready never arrives, do not
                // leave a misleading green Online badge forever.
                if (readyWatchdogRef.current) clearTimeout(readyWatchdogRef.current)
                readyWatchdogRef.current = setTimeout(() => {
                    if (clientRef.current === client && !clientReadyRef.current && !activeCallRef.current && !incomingCallRef.current) {
                        console.warn("Telnyx socket connected but client never became ready; reconnecting")
                        setStatus("offline")
                        setStatusDetail("Phone registration timed out")
                        try { client.disconnect() } catch { }
                        scheduleReconnect()
                    }
                }, 15000)

                client.connect()
            } else {
                clientReadyRef.current = false
                throw new Error("Could not get a Telnyx WebRTC login token")
            }
        } catch (e: any) {
            console.error("Telnyx connection error:", e)
            clientReadyRef.current = false
            setStatus("offline")
            setStatusDetail(e?.message || "Offline")
            scheduleReconnect()
        } finally {
            isConnectingRef.current = false
        }
    }

    // Button actions: Answer, Decline, Hangup, Hold, Mute
    const handleAnswer = async () => {
        const call = incomingCallRef.current || incomingCall
        if (!call || isAnswering) return

        const id = callId(call)
        setIsAnswering(true)
        suppressRingForCallIdsRef.current.add(id)
        stopRinger(call)
        setStatusDetail("Answering incoming call…")

        try {
            const answeredCall = await answerIncomingCall(call)

            // Do not fake Connected. Wait for Telnyx to emit answering/active. If a
            // stale/old SDK silently ignores answer(), make that visible quickly.
            if (answerWatchdogRef.current) clearTimeout(answerWatchdogRef.current)
            answerWatchdogRef.current = setTimeout(() => {
                answerWatchdogRef.current = null

                let currentIncoming = incomingCallRef.current
                const client = clientRef.current
                if (client && typeof client.getActiveCalls === "function") {
                    try {
                        const liveCalls = client.getActiveCalls() || []
                        const fresh = liveCalls.find((candidate: any) => sameCall(candidate, answeredCall))
                        if (fresh) currentIncoming = fresh
                    } catch { }
                }

                if (!currentIncoming || !sameCall(currentIncoming, answeredCall)) {
                    setIsAnswering(false)
                    return
                }

                const state = callState(currentIncoming)
                if (state === "ringing" || state === "early" || !state) {
                    console.error("[TELNYX] answer() returned but call is still ringing", {
                        id, state, call: currentIncoming
                    })
                    suppressRingForCallIdsRef.current.delete(id)
                    setStatusDetail("Answer was not accepted by Telnyx - check console warning/code")
                    setIsAnswering(false)
                    startRinger(currentIncoming)
                }
            }, 4000)
        } catch (e: any) {
            console.error("Could not answer incoming call", e)
            const message = friendlyMediaError(e)
            suppressRingForCallIdsRef.current.delete(id)
            setCallError(message)
            setStatusDetail(message || "Could not answer incoming call")
            setIsAnswering(false)
            if (incomingCallRef.current && sameCall(incomingCallRef.current, call)) {
                startRinger(incomingCallRef.current)
            }
        }
    }

    const handleDecline = async () => {
        setIsAnswering(false)
        const call = incomingCallRef.current || incomingCall
        if (!call) return

        if (answerWatchdogRef.current) {
            clearTimeout(answerWatchdogRef.current)
            answerWatchdogRef.current = null
        }

        const id = callId(call)
        suppressRingForCallIdsRef.current.add(id)
        stopRinger(call)

        try {
            if (typeof call.hangup === "function") {
                await Promise.resolve(call.hangup())
            }
        } catch (e) {
            console.error("Could not decline incoming call", e)
            suppressRingForCallIdsRef.current.delete(id)
            if (incomingCallRef.current && sameCall(incomingCallRef.current, call)) {
                startRinger(call)
            }
            return
        }

        setIncomingCall(null)
        incomingCallRef.current = null
        resetCallerLookup()
        if (typeof document !== "undefined") {
            document.title = baseTitleRef.current || document.title
        }
    }

    const handleHangup = () => {
        if (activeCall) {
            if (typeof activeCall.hangup === "function") {
                activeCall.hangup()
            }
            endCall(activeCall)
        }
    }

    const handleHold = () => {
        if (!activeCall) return
        const next = !held
        setHeld(next)
        if (typeof activeCall.hold === "function") {
            next ? activeCall.hold() : activeCall.unhold()
        }
    }

    const handleMute = () => {
        if (!activeCall) return
        const next = !muted
        setMuted(next)
        if (typeof activeCall.muteAudio === "function") {
            next ? activeCall.muteAudio() : activeCall.unmuteAudio()
        }
    }

    // Dial action matching portal.js
    const dial = async (number?: string) => {
        const rawTarget = (number || dialNumber || "").trim()
        const target = sanitizeCallableNumber(rawTarget)
        if (!target) {
            const message = rawTarget ? "Enter a valid telephone number." : ""
            if (message) {
                setCallError(message)
                setStatusDetail(message)
            }
            return
        }
        if (isDialingRef.current) return

        if (!clientRef.current || !clientReadyRef.current) {
            const message = "Phone is not ready yet. Wait for the Online badge, then try again."
            setCallError(message)
            setStatusDetail(message)
            return
        }

        if (activeCallRef.current || incomingCallRef.current) {
            const message = "Finish the current call before starting another one."
            setCallError(message)
            setStatusDetail(message)
            return
        }

        isDialingRef.current = true
        setIsDialing(true)
        setCallError(null)
        setStatusDetail("Checking microphone...")

        let localStream: MediaStream | null = null

        try {
            localStream = await ensureMicrophoneReady()
            const client = clientRef.current
            if (!client || !clientReadyRef.current || typeof client.newCall !== "function") {
                throw new Error("Phone is not ready yet. Wait for the Online badge, then try again.")
            }

            dialedNumberRef.current = target
            setStatusDetail("Starting call...")

            const call = client.newCall({
                destinationNumber: target,
                remoteCallerName: target,
                callerNumber: cfgRef.current.callerId || undefined,
                remoteElement: "remoteAudio",
                audio: true,
                localStream,
                customHeaders: [{ name: "X-Voice-Ext", value: cfgRef.current.extensionUid || extension || "" }]
            })

            if (!call) {
                throw new Error("Telnyx did not create a call session.")
            }

            // The Telnyx Call now owns this stream and will stop it when the call is finalized.
            localStream = null
            activeCallRef.current = call
            showActive(call, "Calling…")
            setDialNumber("")
        } catch (err: any) {
            console.warn("newCall error:", err)
            stopMediaStream(localStream)
            dialedNumberRef.current = ""
            const message = friendlyMediaError(err)
            setCallError(message)
            setStatusDetail(message)
        } finally {
            isDialingRef.current = false
            setIsDialing(false)
        }
    }

    // Transfer toggle & doTransfer matching portal.js
    const handleTransferToggle = async () => {
        const nextState = !showTransferPanel
        setShowTransferPanel(nextState)
        setTransferMsg("")
        if (nextState) {
            try {
                const res = await api(cfgRef.current.colleaguesUrl)
                if (res && res.colleagues) {
                    setColleagues(res.colleagues)
                }
            } catch (e: any) {
                setTransferMsg(e.message || "Failed to load colleagues")
            }
        }
    }

    const doTransfer = async (body: { extension_uid?: string; number?: string }) => {
        const cleanBody = body.number
            ? { ...body, number: sanitizeCallableNumber(body.number) }
            : body

        if (body.number && !cleanBody.number) {
            setTransferMsg("Enter a valid outside number.")
            return
        }

        setTransferMsg("Transferring…")
        setIsTransferring(true)
        try {
            await api(cfgRef.current.transferUrl, {
                method: "POST",
                body: JSON.stringify(cleanBody)
            })
            if (cleanBody.number) setTransferNumber(cleanBody.number)
            setTransferMsg("Transferred.")
        } catch (e: any) {
            setTransferMsg(e.message || "Transfer failed")
        } finally {
            setIsTransferring(false)
        }
    }

    // Helper to format audio URL
    const formatAudioUrl = (url: string) => {
        if (!url) return ""
        if (url.startsWith("http")) return url
        return `${VOICE_BASE}${url.startsWith("/") ? "" : "/"}${url}`
    }

    // Initial lifecycle, audio unlock & polling intervals
    useEffect(() => {
        if (typeof document !== "undefined" && !baseTitleRef.current) {
            baseTitleRef.current = document.title
        }

        // Fetch user & organization details
        profileService.getProfile()
            .then(res => {
                if (res.data) {
                    const fullName = `${res.data.first_name || ""} ${res.data.last_name || ""}`.trim() || res.data.username || "User"
                    setUserName(fullName)
                    if (res.data.uid) {
                        cfgRef.current.extensionUid = res.data.uid
                    }
                }
            })
            .catch(() => { })

        profileService.getOrganization()
            .then(res => {
                if (res.data) {
                    if (res.data.name) setOrgName(res.data.name)
                    if (res.data.phone_number) {
                        setMainNumber(res.data.phone_number)
                        cfgRef.current.callerId = res.data.phone_number
                    }
                }
            })
            .catch(() => { })

        if (flowUid) {
            const token = cookieUtils.get("access")
            fetch(`${BASE_URL}/flows/available-flow/my_flows`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    const match = (data.results || []).find((f: any) => f.uid === flowUid)
                    if (match && match.flow?.name) {
                        setOrgName(match.flow.name)
                    }
                })
                .catch(() => { })
        }

        // Browsers normally require one user gesture before WebAudio can play.
        // If an incoming call is already waiting, unlockAudio() also starts its
        // pending ringtone immediately after the gesture.
        const handleUnlock = () => {
            void unlockAudio()
        }
        window.addEventListener("pointerdown", handleUnlock, { passive: true })
        window.addEventListener("keydown", handleUnlock)

        const visibilityHandler = () => {
            if (!document.hidden && ringRequestedRef.current) {
                void unlockAudio()
            }
        }
        document.addEventListener("visibilitychange", visibilityHandler)

        setTimeout(() => {
            try {
                const ctx = getAudioContext()
                if (ctx) setSoundBannerVisible(ctx.state !== "running")
            } catch (e) { }
        }, 500)

        // Connect WebRTC and fetch initial list
        connect()
        refreshList()
        loadContacts()

        // 15s refresh interval
        const listInterval = setInterval(refreshList, 15000)

        // Reconcile the SDK's own active-call registry frequently. This recovers
        // the incoming Call object if a single telnyx.notification was missed and
        // is what makes the Answer/Decline UI self-healing.
        rtcSyncTimerRef.current = setInterval(reconcileRtcCalls, 500)

        // 8h token refresh interval
        const tokenInterval = setInterval(() => {
            if (!activeCallRef.current && !incomingCallRef.current) {
                connect()
            }
        }, 8 * 3600 * 1000)

        return () => {
            window.removeEventListener("pointerdown", handleUnlock)
            window.removeEventListener("keydown", handleUnlock)
            document.removeEventListener("visibilitychange", visibilityHandler)
            clearInterval(listInterval)
            clearInterval(tokenInterval)
            stopRinger()
            callerLookupRequestRef.current += 1
            if (callerLookupAbortRef.current) {
                callerLookupAbortRef.current.abort()
                callerLookupAbortRef.current = null
            }
            if (rtcSyncTimerRef.current) {
                clearInterval(rtcSyncTimerRef.current)
                rtcSyncTimerRef.current = null
            }
            if (readyWatchdogRef.current) {
                clearTimeout(readyWatchdogRef.current)
                readyWatchdogRef.current = null
            }
            if (timerIdRef.current) clearInterval(timerIdRef.current)
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

            const client = clientRef.current
            clientRef.current = null
            clientReadyRef.current = false
            if (client) {
                try {
                    if (typeof client.off === "function") {
                        client.off("telnyx.ready")
                        client.off("telnyx.socket.open")
                        client.off("telnyx.socket.close")
                        client.off("telnyx.socket.error")
                        client.off("telnyx.error")
                        client.off("telnyx.warning")
                        client.off("telnyx.notification")
                    }
                    client.disconnect()
                } catch (e) { }
            }
        }
    }, [flowUid, refreshList, loadContacts])

    // Re-fetch list on tab change
    useEffect(() => {
        refreshList()
    }, [currentTab, refreshList])

    useEffect(() => {
        if (!selectedContactId) {
            setSelectedContact(null)
            setContactCalls([])
            return
        }
        void loadContactHistory(selectedContactId)
    }, [selectedContactId, loadContactHistory])

    const filteredCalls = currentTab === "missed"
        ? callsList.filter(c => c.direction === "inbound" && c.status === "missed")
        : callsList

    const filteredContacts = useMemo(() => {
        const needle = contactSearch.trim().toLowerCase()
        if (!needle) return contactsList
        return contactsList.filter(contact => {
            const haystack = [
                contactDisplayName(contact),
                contact.email,
                contact.phone,
                contact.company_name,
                contact.origin,
                contact.source_name,
                contact.external_id,
                contact.candidate_id
            ].filter(Boolean).join(" ").toLowerCase()
            return haystack.includes(needle)
        })
    }, [contactSearch, contactsList, contactDisplayName])

    const arrow = { inbound: "↙", outbound: "↗" }

    const renderLookupDetail = (label: string, value?: React.ReactNode, icon?: React.ReactNode) => {
        if (!value) return null
        return (
            <div className="min-w-0 rounded-lg border border-border/60 bg-background/60 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {icon}
                    <span>{label}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-foreground break-words">{value}</div>
            </div>
        )
    }

    const renderCallerLookupPanel = () => {
        if (!callerLookup) return null

        const data = callerLookup.data
        const candidates = Array.isArray(data?.candidates) ? data.candidates : []
        const contacts = Array.isArray(data?.contacts) ? data.contacts : []
        const options = getLookupOptions(data)
        const selectedOption = options.find(option => option.key === selectedLookupKey) || options[0]
        const selectedRecord = selectedOption?.record
        const selectedCandidate = selectedOption?.type === "candidate" ? (selectedRecord as JobAdderCandidate) : null
        const selectedContact = selectedOption?.type === "contact" ? (selectedRecord as JobAdderContact) : null
        const address = selectedCandidate ? formatAddress(selectedCandidate.address) : ""
        const company = selectedContact?.company
        const owner = selectedRecord ? formatJobAdderUser(selectedRecord.updatedBy || selectedRecord.createdBy) : ""
        const updated = selectedRecord ? formatLookupDate(selectedRecord.updatedAt || selectedRecord.createdAt) : ""
        const notConnected = data && data.jobadder_connected === false

        return (
            <div className="rounded-xl border border-border/70 bg-muted/35 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                JobAdder matches
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                                {callerLookup.phone}
                            </div>
                        </div>
                    </div>
                    {callerLookup.loading ? (
                        <Badge variant="outline" className="gap-1.5 text-[10px] font-semibold shrink-0">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading
                        </Badge>
                    ) : data && !callerLookup.error && !notConnected ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-semibold">
                                {candidates.length} candidates
                            </Badge>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                                {contacts.length} contacts
                            </Badge>
                        </div>
                    ) : null}
                </div>

                {callerLookup.error ? (
                    <div className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {callerLookup.error}
                    </div>
                ) : callerLookup.loading && !data ? (
                    <div className="text-xs text-muted-foreground">
                        Searching JobAdder records…
                    </div>
                ) : notConnected ? (
                    <div className="text-xs text-muted-foreground">
                        {data?.detail || data?.error || "JobAdder is not connected for this account."}
                    </div>
                ) : options.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                        No JobAdder candidate or contact found for this number.
                    </div>
                ) : selectedRecord ? (
                    <>
                        <select
                            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={selectedOption?.key || ""}
                            onChange={e => setSelectedLookupKey(e.target.value)}
                        >
                            {candidates.length > 0 && (
                                <optgroup label={`Candidates (${candidates.length})`}>
                                    {candidates.map((candidate, index) => {
                                        const key = `candidate:${candidate.candidateId || index}:${index}`
                                        const option = options.find(item => item.key === key)
                                        return (
                                            <option key={key} value={key}>
                                                {option?.label || personName(candidate)}
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )}
                            {contacts.length > 0 && (
                                <optgroup label={`Contacts (${contacts.length})`}>
                                    {contacts.map((contact, index) => {
                                        const key = `contact:${contact.contactId || index}:${index}`
                                        const option = options.find(item => item.key === key)
                                        return (
                                            <option key={key} value={key}>
                                                {option?.label || personName(contact)}
                                            </option>
                                        )
                                    })}
                                </optgroup>
                            )}
                        </select>

                        <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-foreground truncate">
                                        {personName(selectedRecord)}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        {selectedCandidate
                                            ? `Candidate ID ${selectedCandidate.candidateId || "unknown"}`
                                            : `Contact ID ${selectedContact?.contactId || "unknown"}`}
                                    </div>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`text-[10px] font-semibold shrink-0 ${
                                        selectedCandidate
                                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    }`}
                                >
                                    {selectedCandidate ? "Candidate" : "Contact"}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {renderLookupDetail("Phone", recordPhone(selectedRecord), <Phone className="w-3 h-3" />)}
                                {renderLookupDetail("Email", selectedRecord.email, <Mail className="w-3 h-3" />)}
                                {renderLookupDetail("Status", selectedRecord.status?.name)}
                                {selectedCandidate && renderLookupDetail("Seeking", selectedCandidate.seeking)}
                                {selectedContact && renderLookupDetail("Company", compactParts([company?.name, company?.status?.name]), <Building2 className="w-3 h-3" />)}
                                {renderLookupDetail("Address", address, <MapPin className="w-3 h-3" />)}
                                {renderLookupDetail("Owner", owner, <UserRound className="w-3 h-3" />)}
                                {renderLookupDetail("Updated", updated, <Clock className="w-3 h-3" />)}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        )
    }

    const renderContactsPanel = () => {
        const currentContact = selectedContact || contactsList.find(contact => contact.id === selectedContactId) || null
        const selectedPhone = currentContact?.phone || ""
        const originLabel = currentContact?.origin
            ? currentContact.origin.replace(/_/g, " ")
            : "manual"

        return (
            <Card className="border border-border/70 bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="border-b border-border/70 p-4 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-primary" />
                                    <h2 className="text-base font-bold text-foreground">Contacts</h2>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {contactsList.length} saved
                                    {currentContact ? ` · ${contactDisplayName(currentContact)}` : ""}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => void loadContacts()}
                                    disabled={contactsLoading}
                                >
                                    {contactsLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    )}
                                    Refresh
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={fetchAtsContacts}
                                    disabled={atsFetching}
                                >
                                    {atsFetching ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Database className="w-3.5 h-3.5" />
                                    )}
                                    Fetch ATS
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => setContactFormOpen(open => !open)}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    New
                                </Button>
                            </div>
                        </div>

                        {contactNotice && (
                            <div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground">
                                {contactNotice}
                            </div>
                        )}

                        {contactFormOpen && (
                            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Input
                                        placeholder="Name"
                                        className="h-9 text-xs"
                                        value={newContact.name}
                                        onChange={e => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Email"
                                        type="email"
                                        className="h-9 text-xs"
                                        value={newContact.email}
                                        onChange={e => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Phone"
                                        inputMode="tel"
                                        className="h-9 text-xs"
                                        value={newContact.phone}
                                        onChange={e => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                                    />
                                    <Input
                                        placeholder="Company"
                                        className="h-9 text-xs"
                                        value={newContact.company_name}
                                        onChange={e => setNewContact(prev => ({ ...prev, company_name: e.target.value }))}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs"
                                        onClick={() => setContactFormOpen(false)}
                                        disabled={contactSaving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs"
                                        onClick={createContact}
                                        disabled={contactSaving}
                                    >
                                        {contactSaving ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <UserPlus className="w-3.5 h-3.5" />
                                        )}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search contacts"
                                className="h-10 pl-9 text-sm rounded-xl"
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(250px,320px)_1fr]">
                        <div className="border-b xl:border-b-0 xl:border-r border-border/70">
                            <div className="max-h-[420px] overflow-y-auto p-2 space-y-1.5">
                                {contactsError ? (
                                    <div className="p-4 text-center rounded-xl bg-muted/30">
                                        <div className="text-sm font-semibold text-rose-600">Could not load contacts</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{contactsError}</div>
                                    </div>
                                ) : contactsLoading && contactsList.length === 0 ? (
                                    <div className="p-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading contacts
                                    </div>
                                ) : filteredContacts.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                        <Users className="w-8 h-8 text-muted-foreground/40" />
                                        <span>No contacts found</span>
                                    </div>
                                ) : (
                                    filteredContacts.map(contact => {
                                        const active = contact.id === selectedContactId
                                        return (
                                            <button
                                                key={contact.id}
                                                type="button"
                                                onClick={() => setSelectedContactId(contact.id)}
                                                className={`w-full rounded-xl border p-3 text-left transition-all ${
                                                    active
                                                        ? "border-primary/40 bg-primary/5"
                                                        : "border-border/60 bg-background/50 hover:bg-muted/40"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-foreground">
                                                            {contactDisplayName(contact)}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                            {contact.company_name || contact.email || contact.phone || "No details"}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                                                        {contact.origin || "manual"}
                                                    </Badge>
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        <div className="min-w-0 p-4 space-y-4">
                            {currentContact ? (
                                <>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <UserRound className="w-4 h-4 text-primary shrink-0" />
                                                <h3 className="truncate text-lg font-bold text-foreground">
                                                    {contactDisplayName(currentContact)}
                                                </h3>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                <Badge variant="outline" className="text-[10px] capitalize">
                                                    {originLabel}
                                                </Badge>
                                                {currentContact.source_name && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {currentContact.source_name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-9 gap-1.5 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => void dial(selectedPhone)}
                                            disabled={!selectedPhone || isDialing || status !== "online" || !!activeCall || !!incomingCall}
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                            Call
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {renderLookupDetail("Phone", currentContact.phone, <Phone className="w-3 h-3" />)}
                                        {renderLookupDetail("Email", currentContact.email, <Mail className="w-3 h-3" />)}
                                        {renderLookupDetail("Company", currentContact.company_name, <Building2 className="w-3 h-3" />)}
                                        {renderLookupDetail("ATS ID", currentContact.external_id || currentContact.candidate_id)}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                <History className="w-3.5 h-3.5" />
                                                Call history
                                            </div>
                                            {contactCallsLoading && (
                                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                            )}
                                        </div>

                                        {contactCalls.length === 0 && !contactCallsLoading ? (
                                            <div className="rounded-xl border border-border/60 bg-muted/25 p-5 text-center text-xs text-muted-foreground">
                                                No calls for this contact
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {contactCalls.map(call => {
                                                    const isMissed = call.direction === "inbound" && call.status === "missed"
                                                    return (
                                                        <div
                                                            key={call.uid}
                                                            className={`rounded-xl border p-3 ${
                                                                isMissed
                                                                    ? "border-rose-500/20 bg-rose-500/5"
                                                                    : "border-border/60 bg-background/50"
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                                                        {call.direction === "inbound" ? (
                                                                            <PhoneIncoming className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                                        ) : (
                                                                            <PhoneOutgoing className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                                        )}
                                                                        <span className="truncate">{call.number}</span>
                                                                    </div>
                                                                    <div className="mt-1 text-[11px] text-muted-foreground truncate">
                                                                        {new Date(call.started_at).toLocaleString()} · {call.status.replace("_", " ")}
                                                                        {call.handled_by ? ` · ${call.handled_by}` : ""}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {call.has_voicemail && (
                                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                                                            voicemail
                                                                        </Badge>
                                                                    )}
                                                                    <span className="font-mono text-[11px] text-muted-foreground">
                                                                        {mmss(call.duration || 0)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="min-h-[320px] rounded-xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                                    <Users className="w-10 h-10 text-muted-foreground/40" />
                                    <span>Select or create a contact</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background p-4 md:p-8 min-h-screen text-foreground font-sans">
            <div className="w-full max-w-7xl mx-auto space-y-4">
                {/* Back link */}
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/dashboard/phone-call-flows")}
                        className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2 gap-1.5 text-xs font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Call Flows
                    </Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,520px)_minmax(0,1fr)] gap-4 items-start">
                    <div className="min-w-0 space-y-4">
                {/* Header matching HTML template */}
                <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                            VOIP Business Phone
                        </h1>
                        <Badge
                            id="status"
                            variant="outline"
                            title={statusDetail}
                            className={`font-mono text-xs px-2.5 py-0.5 font-semibold transition-all ${
                                status === "online"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                    : status === "connecting"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            }`}
                        >
                            {status === "online" ? "Online" : status === "connecting" ? "Connecting…" : "Offline"}
                        </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Logged in: <strong className="text-foreground">{userName}</strong> (ext {extension})<br />
                        Main Number: <strong className="text-foreground">{mainNumber}</strong>
                    </p>
                </div>

                {/* Sound Banner */}
                {soundBannerVisible && (
                    <div
                        id="sound-banner"
                        className="p-3 text-xs rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                        onClick={() => {
                            void unlockAudio()
                        }}
                    >
                        <Volume2 className="w-4 h-4 shrink-0 text-amber-600 animate-bounce" />
                        <span>Click anywhere on this page to enable ringing sound.</span>
                    </div>
                )}

                {callError && (
                    <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-2 shadow-sm">
                        <PhoneOff className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{callError}</span>
                    </div>
                )}

                {/* Section: Incoming Call */}
                {incomingCall && (
                    <Card id="incoming" className="border-2 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-md animate-pulse">
                        <CardContent className="p-4 space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Incoming call
                            </div>
                            <div id="incoming-from" className="text-xl font-bold text-foreground truncate">
                                Incoming call: {incomingCaller || "Unknown"}
                            </div>
                            {renderCallerLookupPanel()}
                            <div className="flex gap-2.5 pt-1">
                                <Button
                                    id="btn-answer"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl gap-2 shadow-sm"
                                    onClick={handleAnswer}
                                    disabled={isAnswering}
                                >
                                    {isAnswering ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneIncoming className="w-4 h-4" />}
                                    {isAnswering ? "Answering…" : "Answer"}
                                </Button>
                                <Button
                                    id="btn-decline"
                                    variant="destructive"
                                    className="flex-1 font-bold h-11 rounded-xl gap-2 shadow-sm"
                                    onClick={handleDecline}
                                >
                                    <PhoneOff className="w-4 h-4" />
                                    Decline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Section: Active Call */}
                {activeCall && (
                    <Card id="active" className="border-2 border-primary/40 bg-card shadow-md">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Call In Progress
                                    </div>
                                    <div id="active-who" className="text-xl font-bold text-foreground truncate mt-0.5">
                                        {activeWho}
                                    </div>
                                </div>
                                <Badge
                                    id="active-state"
                                    variant="secondary"
                                    className="font-mono text-xs px-2.5 py-1 gap-1.5 bg-primary/10 text-primary border border-primary/20 shrink-0"
                                >
                                    <Radio className="w-3 h-3 animate-pulse text-primary shrink-0" />
                                    {activeStateText}
                                </Badge>
                            </div>
                            {renderCallerLookupPanel()}

                            {/* Action Buttons Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                <Button
                                    id="btn-hold"
                                    variant={held ? "default" : "outline"}
                                    className={`gap-1.5 h-10 font-medium ${held ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-border/80"}`}
                                    onClick={handleHold}
                                >
                                    {held ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                    {held ? "Resume" : "Hold"}
                                </Button>
                                <Button
                                    id="btn-mute"
                                    variant={muted ? "default" : "outline"}
                                    className={`gap-1.5 h-10 font-medium ${muted ? "bg-rose-600 hover:bg-rose-700 text-white" : "border-border/80"}`}
                                    onClick={handleMute}
                                >
                                    {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    {muted ? "Unmute" : "Mute"}
                                </Button>
                                <Button
                                    id="btn-transfer-toggle"
                                    variant={showTransferPanel ? "default" : "outline"}
                                    className="gap-1.5 h-10 font-medium border-border/80"
                                    onClick={handleTransferToggle}
                                >
                                    <ArrowRightLeft className="w-4 h-4" />
                                    Transfer
                                </Button>
                                <Button
                                    id="btn-hangup"
                                    variant="destructive"
                                    className="gap-1.5 h-10 font-semibold shadow-sm"
                                    onClick={handleHangup}
                                >
                                    <PhoneOff className="w-4 h-4" />
                                    Hang up
                                </Button>
                            </div>

                            {/* Transfer Panel */}
                            {showTransferPanel && (
                                <div id="transfer-panel" className="mt-3 p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                                            Transfer Call
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowTransferPanel(false)}
                                            className="text-xs text-muted-foreground hover:text-foreground font-medium"
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            id="transfer-select"
                                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                            value={selectedColleague}
                                            onChange={e => {
                                                setSelectedColleague(e.target.value)
                                                setTransferMsg("")
                                            }}
                                            disabled={isTransferring}
                                        >
                                            <option value="">Choose a colleague…</option>
                                            {colleagues.map(c => (
                                                <option key={c.uid} value={c.uid}>
                                                    {c.name} ({c.extension})
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            id="btn-transfer-go"
                                            size="sm"
                                            className="h-9 px-3 gap-1.5 text-xs font-semibold shrink-0"
                                            onClick={() => {
                                                if (selectedColleague) doTransfer({ extension_uid: selectedColleague })
                                            }}
                                            disabled={!selectedColleague || isTransferring}
                                        >
                                            {isTransferring ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                            )}
                                            Transfer
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="transfer-number"
                                            placeholder="…or an outside number"
                                            inputMode="tel"
                                            className="h-9 text-xs"
                                            value={transferNumber}
                                            onChange={e => {
                                                setTransferNumber(e.target.value)
                                                setTransferMsg("")
                                            }}
                                            disabled={isTransferring}
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && transferNumber.trim() && !isTransferring) {
                                                    doTransfer({ number: transferNumber.trim() })
                                                }
                                            }}
                                        />
                                        <Button
                                            id="btn-transfer-number"
                                            size="sm"
                                            variant="secondary"
                                            className="h-9 px-3 gap-1.5 text-xs font-semibold shrink-0"
                                            onClick={() => {
                                                if (transferNumber.trim()) doTransfer({ number: transferNumber.trim() })
                                            }}
                                            disabled={!transferNumber.trim() || isTransferring}
                                        >
                                            {isTransferring ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                            )}
                                            Transfer
                                        </Button>
                                    </div>
                                    {transferMsg && (
                                        <div
                                            id="transfer-msg"
                                            className={`text-xs font-medium pt-1 ${
                                                transferMsg.toLowerCase().includes("fail") ||
                                                transferMsg.toLowerCase().includes("error")
                                                    ? "text-rose-600 dark:text-rose-400"
                                                    : "text-emerald-600 dark:text-emerald-400"
                                            }`}
                                        >
                                            {transferMsg}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Section: Dial */}
                <Card className="border border-border/70 bg-card shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input
                                    id="dial-input"
                                    placeholder="Enter telephone number"
                                    inputMode="tel"
                                    autoComplete="off"
                                    className="pl-9 h-11 text-base font-medium rounded-xl"
                                    value={dialNumber}
                                    onChange={e => setDialNumber(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") void dial(dialNumber)
                                    }}
                                    disabled={isDialing}
                                />
                            </div>
                            <Button
                                id="btn-call"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl gap-2 shadow-sm shrink-0"
                                onClick={() => void dial(dialNumber)}
                                disabled={isDialing || status !== "online" || !!activeCall || !!incomingCall}
                            >
                                {isDialing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                                {isDialing ? "CALLING" : "CALL"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <div className="p-1 rounded-xl bg-muted/60 border border-border/50 flex gap-1">
                    <button
                        data-tab="recent"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                            currentTab === "recent"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setCurrentTab("recent")}
                    >
                        Recent Calls
                    </button>
                    <button
                        data-tab="missed"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                            currentTab === "missed"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setCurrentTab("missed")}
                    >
                        Missed Calls
                    </button>
                    <button
                        data-tab="voicemail"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${
                            currentTab === "voicemail"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setCurrentTab("voicemail")}
                    >
                        Voicemail
                        {unreadVoicemails > 0 && (
                            <span id="vm-badge" className="bg-rose-500 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-tight">
                                {unreadVoicemails}
                            </span>
                        )}
                    </button>
                </div>

                {/* List Container */}
                <Card className="border border-border/70 bg-card shadow-sm overflow-hidden">
                    <CardContent className="p-2">
                        <ul id="list" className="space-y-1.5">
                            {listErrorMessage ? (
                                <li className="p-4 text-center rounded-xl bg-muted/30">
                                    <div className="text-sm font-semibold text-rose-600">Could not load</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{listErrorMessage}</div>
                                </li>
                            ) : currentTab === "voicemail" ? (
                                voicemailsList.length === 0 ? (
                                    <li className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                        <Voicemail className="w-8 h-8 text-muted-foreground/40" />
                                        <span>No voicemail</span>
                                    </li>
                                ) : (
                                    voicemailsList.map(v => (
                                        <li
                                            key={v.uid || v.id}
                                            className="p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div
                                                    className="font-semibold text-sm text-foreground hover:text-primary hover:underline cursor-pointer flex items-center gap-2"
                                                    onClick={() => setDialNumber(v.from)}
                                                    title="Click to dial number"
                                                >
                                                    <Voicemail className="w-4 h-4 text-muted-foreground" />
                                                    <span>{v.from || "Unknown"}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    {!v.is_read && (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-1.5 py-0">
                                                            NEW
                                                        </Badge>
                                                    )}
                                                    <span className="font-mono text-[11px]">{mmss(v.duration)}</span>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-muted-foreground/70" />
                                                {new Date(v.created_at).toLocaleString()}
                                            </div>
                                            {v.ready ? (
                                                <audio
                                                    controls
                                                    preload="none"
                                                    src={formatAudioUrl(v.audio_url)}
                                                    className="w-full h-8 mt-1.5 rounded-md"
                                                    onPlay={() => {
                                                        const readUrl = v.read_url || `${VOICE_BASE}/voice/api/voicemails/${v.uid || v.id}/read/`
                                                        api(readUrl, { method: "POST" }).catch(() => { })
                                                        setVoicemailsList(prev =>
                                                            prev.map(item =>
                                                                (item.uid === v.uid || item.id === v.id)
                                                                    ? { ...item, is_read: true }
                                                                    : item
                                                                )
                                                        )
                                                        setUnreadVoicemails(prev => Math.max(0, prev - 1))
                                                    }}
                                                />
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic mt-1"> (processing…)</div>
                                            )}
                                        </li>
                                    ))
                                )
                            ) : filteredCalls.length === 0 ? (
                                <li className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                    <PhoneMissed className="w-8 h-8 text-muted-foreground/40" />
                                    <span>{currentTab === "missed" ? "No missed calls" : "No calls yet"}</span>
                                </li>
                            ) : (
                                filteredCalls.map(c => {
                                    const isMissed = c.direction === "inbound" && c.status === "missed"
                                    const who = c.contact_name ? `${c.contact_name} · ${c.number}` : c.number
                                    const sub = `${new Date(c.started_at).toLocaleString()} · ${
                                        c.status === "completed" ? mmss(c.duration) : c.status.replace("_", " ")
                                    }${c.handled_by ? ` · ${c.handled_by}` : ""}`

                                    return (
                                        <li
                                            key={c.uid || c.id}
                                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                isMissed
                                                    ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
                                                    : "border-border/60 bg-background/50 hover:bg-muted/40"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        isMissed
                                                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                                            : c.direction === "inbound"
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                    }`}
                                                >
                                                    {isMissed ? (
                                                        <PhoneMissed className="w-4 h-4" />
                                                    ) : c.direction === "inbound" ? (
                                                        <PhoneIncoming className="w-4 h-4" />
                                                    ) : (
                                                        <PhoneOutgoing className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div
                                                        className={`font-semibold text-xs sm:text-sm truncate hover:underline cursor-pointer flex items-center gap-1.5 ${
                                                            isMissed ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                                                        }`}
                                                        onClick={() => {
                                                            if (c.contact_id) setSelectedContactId(c.contact_id)
                                                            else setDialNumber(c.number)
                                                        }}
                                                        title={c.contact_id ? "Open contact" : "Click to dial number"}
                                                    >
                                                        <span className="truncate">
                                                            {isMissed ? "✖ " : arrow[c.direction] + " "}
                                                            {who}
                                                        </span>
                                                        {c.has_voicemail && (
                                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold px-1.5 py-0">
                                                                voicemail
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                        {sub}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void dial(c.number)}
                                                className="h-8 px-2 text-xs text-muted-foreground hover:text-emerald-600 shrink-0"
                                                title="Call this number"
                                                disabled={isDialing || status !== "online" || !!activeCall || !!incomingCall}
                                            >
                                                <Phone className="w-3.5 h-3.5" />
                                            </Button>
                                        </li>
                                    )
                                })
                            )}
                        </ul>
                    </CardContent>
                </Card>

                {/* Footer Notice */}
                <p className="text-center text-[11px] text-muted-foreground/80 py-2">
                    Not for emergency calls: dial 999 from your mobile.
                </p>
                    </div>

                    <div className="min-w-0 xl:sticky xl:top-4">
                        {renderContactsPanel()}
                    </div>
                </div>
            </div>

            <audio id="remoteAudio" autoPlay playsInline className="fixed -top-full -left-full opacity-0 pointer-events-none w-0 h-0" />
        </div>
    )
}
