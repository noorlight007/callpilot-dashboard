"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
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
    Volume2
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
    extensionUid?: string;
    callerId?: string;
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
    const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "")

    // ---- Microphone preflight (Windows PCs often have no/blocked/busy mic) ----
    const [micIssue, setMicIssue] = useState<string | null>(null)

    const micErrorMessage = (err: any): string => {
        const name = err?.name || ""
        if (name === "NotFoundError" || name === "DevicesNotFoundError")
            return "No microphone found. Plug in a headset/microphone and make sure Windows Settings > Sound > Input shows one."
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError")
            return "Microphone is blocked. Click the lock icon in the address bar, allow Microphone, and also check Windows Settings > Privacy > Microphone."
        if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
            return "Microphone is busy or unavailable. Close other apps using it (Teams, Zoom, Skype) and check the default input device in Windows Sound settings."
        if (name === "OverconstrainedError")
            return "The selected microphone is not usable. Choose a different default input device."
        return err?.message ? `Microphone error: ${err.message}` : "Could not access the microphone."
    }

    // Opens the mic once to trigger the browser permission prompt and verify it works.
    const ensureMic = async (): Promise<boolean> => {
        if (typeof navigator === "undefined") return true
        if (!navigator.mediaDevices?.getUserMedia) {
            setMicIssue("Calls need a secure (https) page and a browser with microphone support.")
            return false
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            stream.getTracks().forEach((t) => t.stop())
            setMicIssue(null)
            return true
        } catch (err: any) {
            console.error("[VOIP] microphone check failed", err)
            setMicIssue(micErrorMessage(err))
            return false
        }
    }

    useEffect(() => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) return
        const passiveCheck = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices()
                if (!devices.some((d) => d.kind === "audioinput")) {
                    setMicIssue("No microphone found. Plug in a headset/microphone and make sure Windows Settings > Sound > Input shows one.")
                    return
                }
                const perm = await (navigator as any).permissions?.query?.({ name: "microphone" }).catch(() => null)
                if (perm?.state === "denied") setMicIssue(micErrorMessage({ name: "NotAllowedError" }))
                else setMicIssue((prev) => (prev && prev.startsWith("No microphone") ? null : prev))
            } catch { /* ignore */ }
        }
        passiveCheck()
        navigator.mediaDevices.addEventListener?.("devicechange", passiveCheck)
        // Ask for mic permission on the first click so it is already granted before a call comes in.
        const warm = () => { void ensureMic() }
        window.addEventListener("pointerdown", warm, { once: true })
        return () => {
            navigator.mediaDevices.removeEventListener?.("devicechange", passiveCheck)
            window.removeEventListener("pointerdown", warm)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ---- One-click diagnostics (mic, audio output, media-server reachability) ----
    const [diagLines, setDiagLines] = useState<{ ok: boolean; text: string }[] | null>(null)
    const [diagRunning, setDiagRunning] = useState(false)

    const runDiagnostics = async () => {
        setDiagRunning(true)
        const out: { ok: boolean; text: string }[] = []
        const push = (ok: boolean, text: string) => { out.push({ ok, text }); setDiagLines([...out]) }
        setDiagLines([])
        try {
            const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
            push(true, `Browser: ${ua.includes("Edg/") ? "Edge" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Chrome/") ? "Chrome" : "Other"} on ${/Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "unknown OS"}`)
            push(typeof window !== "undefined" && window.isSecureContext, window.isSecureContext ? "Secure (https) page: OK" : "Page is not secure (https). Calls need https.")
            push(!!(window as any).RTCPeerConnection, (window as any).RTCPeerConnection ? "WebRTC supported: OK" : "WebRTC is not available in this browser.")

            const micOk = await ensureMic()
            push(micOk, micOk ? "Microphone: OK" : "Microphone: FAILED - see the red message above")

            try {
                const devs = await navigator.mediaDevices.enumerateDevices()
                const ins = devs.filter((d) => d.kind === "audioinput").length
                const outs = devs.filter((d) => d.kind === "audiooutput").length
                push(ins > 0, `Audio inputs found: ${ins}`)
                push(outs > 0, `Audio outputs found: ${outs}${outs === 0 ? " (check speakers/headset in Windows Sound settings)" : ""}`)
            } catch { push(false, "Could not list audio devices") }

            // Media-server reachability: gather ICE candidates from Telnyx STUN/TURN.
            await new Promise<void>((resolve) => {
                let srflx = false, relay = false, done = false
                const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.telnyx.com:3478" }, { urls: "turn:turn.telnyx.com:3478?transport=tcp", username: "testuser000", credential: "test0000" }] })
                const finish = () => {
                    if (done) return
                    done = true
                    try { pc.close() } catch { /* ignore */ }
                    push(srflx, srflx ? "Reach Telnyx media servers (UDP/STUN): OK" : "Telnyx media servers (UDP/STUN) NOT reachable - a firewall, VPN or antivirus is probably blocking WebRTC. Try another network or disable the VPN.")
                    if (!srflx) push(relay, relay ? "TURN relay (TCP) reachable - calls may still work" : "TURN relay NOT reachable either")
                    resolve()
                }
                pc.createDataChannel("diag")
                pc.onicecandidate = (e) => {
                    const c = e.candidate?.candidate || ""
                    if (c.includes(" typ srflx")) srflx = true
                    if (c.includes(" typ relay")) relay = true
                    if (!e.candidate) finish()
                }
                pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => finish())
                setTimeout(finish, 6000)
            })

            push(status === "online", status === "online" ? "Phone registered with Telnyx: Online" : `Phone registration: ${status}${statusDetail ? " - " + statusDetail : ""}`)
        } finally {
            setDiagRunning(false)
        }
    }

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
            throw new Error(data.error || `HTTP ${res.status}`)
        }
        return data
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

    // Incoming Call UI handling
    const showIncoming = (call: any) => {
        const id = callId(call)

        if (incomingCallRef.current && !sameCall(incomingCallRef.current, call)) {
            stopRinger(incomingCallRef.current)
        }

        incomingCallRef.current = call
        setIncomingCall(call)
        setIncomingCaller(callerOf(call))

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
                    const isFatal = e?.fatal === true || e?.code === 46001 || e?.code === 46002 || e?.code === 45003 || e?.code === 48001
                    if (!isFatal && e?.message) setStatusDetail(String(e.message))
                    if (isFatal && !activeCallRef.current && !incomingCallRef.current) {
                        clientReadyRef.current = false
                        setStatus("offline")
                        setStatusDetail(e?.message || "Offline")
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
            suppressRingForCallIdsRef.current.delete(id)
            setStatusDetail(e?.message || "Could not answer incoming call")
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
        if (!rawTarget) return
        if (!clientRef.current || !clientReadyRef.current) {
            alert("Phone is not ready yet. Wait for the Online badge.")
            return
        }
        if (!(await ensureMic())) {
            alert(micIssue || "Microphone is not available. Please check your microphone and try again.")
            return
        }

        dialedNumberRef.current = rawTarget

        if (clientRef.current && typeof clientRef.current.newCall === "function") {
            try {
                const call = clientRef.current.newCall({
                    destinationNumber: rawTarget,
                    remoteCallerName: rawTarget,
                    callerNumber: cfgRef.current.callerId || undefined,
                    remoteElement: "remoteAudio",
                    customHeaders: [{ name: "X-Voice-Ext", value: cfgRef.current.extensionUid || extension || "" }]
                })
                if (call) {
                    activeCallRef.current = call
                    showActive(call, "Calling…")
                }
            } catch (err: any) {
                console.warn("newCall error:", err)
                alert(`Could not start the call: ${err?.message || err}`)
            }
        } else {
            // Simulated preview active call state
            const simCall = { id: "call-" + Date.now(), direction: "outbound", number: rawTarget, destinationNumber: rawTarget, options: { destinationNumber: rawTarget, remoteCallerName: rawTarget } }
            showActive(simCall, "Calling…")
        }
        setDialNumber("")
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
        setTransferMsg("Transferring…")
        setIsTransferring(true)
        try {
            await api(cfgRef.current.transferUrl, {
                method: "POST",
                body: JSON.stringify(body)
            })
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
    }, [flowUid, refreshList])

    // Re-fetch list on tab change
    useEffect(() => {
        refreshList()
    }, [currentTab, refreshList])

    const filteredCalls = currentTab === "missed"
        ? callsList.filter(c => c.direction === "inbound" && c.status === "missed")
        : callsList

    const arrow = { inbound: "↙", outbound: "↗" }

    return (
        <div className="flex-1 overflow-y-auto bg-background p-4 md:p-8 min-h-screen text-foreground font-sans">
            <div className="max-w-xl mx-auto space-y-4">
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

                    {micIssue && (
                        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                            <span>{micIssue}</span>
                            <button type="button" onClick={() => void ensureMic()} className="shrink-0 font-semibold underline underline-offset-2">Test microphone</button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 text-xs">
                        <button type="button" onClick={() => void runDiagnostics()} disabled={diagRunning} className="font-semibold text-blue-600 dark:text-blue-400 underline underline-offset-2 disabled:opacity-60">
                            {diagRunning ? "Running diagnostics…" : "Run call diagnostics"}
                        </button>
                    </div>
                    {diagLines && diagLines.length > 0 && (
                        <ul id="voip-diagnostics" className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs space-y-1">
                            {diagLines.map((l, i) => (
                                <li key={i} className={l.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-300"}>
                                    {l.ok ? "✓" : "✗"} {l.text}
                                </li>
                            ))}
                        </ul>
                    )}

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
                                        if (e.key === "Enter") dial(dialNumber)
                                    }}
                                />
                            </div>
                            <Button
                                id="btn-call"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl gap-2 shadow-sm shrink-0"
                                onClick={() => dial(dialNumber)}
                            >
                                <Phone className="w-4 h-4" />
                                CALL
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
                                                        onClick={() => setDialNumber(c.number)}
                                                        title="Click to dial number"
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
                                                onClick={() => dial(c.number)}
                                                className="h-8 px-2 text-xs text-muted-foreground hover:text-emerald-600 shrink-0"
                                                title="Call this number"
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

            <audio id="remoteAudio" autoPlay playsInline className="sr-only" />
        </div>
    )
}
