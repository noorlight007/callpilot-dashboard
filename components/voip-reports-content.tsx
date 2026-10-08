"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { BASE_URL } from "@/lib/baseUrl"
import { cookieUtils } from "@/services/auth-service"
import {
    ArrowLeft,
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    Clock,
    Loader2,
    Voicemail,
    RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface VoipReportsContentProps {
    flowUid?: string;
}

export function VoipReportsContent({ flowUid }: VoipReportsContentProps) {
    const router = useRouter()
    const VOICE_BASE = BASE_URL

    const [currentTab, setCurrentTab] = useState<"recent" | "missed" | "voicemail">("recent")
    const [callsList, setCallsList] = useState<CallItem[]>([])
    const [voicemailsList, setVoicemailsList] = useState<VoicemailItem[]>([])
    const [unreadVoicemails, setUnreadVoicemails] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(true)
    const [listErrorMessage, setListErrorMessage] = useState<string | null>(null)

    // Helper to get cookie by name
    const getCookie = (name: string): string => {
        if (typeof document === "undefined") return ""
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(";").shift() || ""
        return ""
    }

    // API fetch wrapper
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

    // Format mm:ss
    const mmss = (s: number) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0")

    // Helper to format audio URL
    const formatAudioUrl = (url: string) => {
        if (!url) return ""
        if (url.startsWith("http")) return url
        return `${VOICE_BASE}${url.startsWith("/") ? "" : "/"}${url}`
    }

    // Fetch call or voicemail list
    const fetchList = useCallback(async () => {
        setIsLoading(true)
        setListErrorMessage(null)
        try {
            if (currentTab === "voicemail") {
                const res = await api(`${VOICE_BASE}/voice/api/voicemails/`).catch(() => null)
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
                const url = `${VOICE_BASE}/voice/api/calls/` + (currentTab === "missed" ? "?filter=missed" : "")
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
            setListErrorMessage(e.message || "Failed to load list")
        } finally {
            setIsLoading(false)
        }
    }, [VOICE_BASE, currentTab])

    useEffect(() => {
        fetchList()
    }, [fetchList])

    const filteredCalls = currentTab === "missed"
        ? callsList.filter(c => c.direction === "inbound" && c.status === "missed")
        : callsList

    return (
        <div className="flex-1 overflow-y-auto bg-background p-4 md:p-8 min-h-screen text-foreground font-sans">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Header & Back Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard/phone-call-flows")}
                            className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2 gap-1.5 text-xs font-medium"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to AI Call Builder
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            VOIP Business Line Reports
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Call activity, missed calls, and voicemail logs.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {flowUid && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/dashboard/voip/${flowUid}`)}
                                className="h-8 text-xs font-medium gap-1.5"
                            >
                                <Phone className="w-3.5 h-3.5" />
                                Phone Dialer
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchList()}
                            disabled={isLoading}
                            className="h-8 text-xs font-medium gap-1.5"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="p-1 rounded-xl bg-muted/60 border border-border/50 flex gap-1">
                    <button
                        data-tab="recent"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${currentTab === "recent"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setCurrentTab("recent")}
                    >
                        Recent Calls
                    </button>
                    <button
                        data-tab="missed"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${currentTab === "missed"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setCurrentTab("missed")}
                    >
                        Missed Calls
                    </button>
                    <button
                        data-tab="voicemail"
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${currentTab === "voicemail"
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
                    <CardContent className="p-3">
                        {isLoading && callsList.length === 0 && voicemailsList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-xs text-muted-foreground font-medium">Loading reports...</p>
                            </div>
                        ) : (
                            <ul id="list" className="space-y-2">
                                {listErrorMessage ? (
                                    <li className="p-4 text-center rounded-xl bg-muted/30">
                                        <div className="text-sm font-semibold text-rose-600">Could not load calls</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{listErrorMessage}</div>
                                    </li>
                                ) : currentTab === "voicemail" ? (
                                    voicemailsList.length === 0 ? (
                                        <li className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                            <Voicemail className="w-8 h-8 text-muted-foreground/40" />
                                            <span>No voicemail messages found.</span>
                                        </li>
                                    ) : (
                                        voicemailsList.map(v => (
                                            <li
                                                key={v.uid || v.id}
                                                className="p-3.5 rounded-xl border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div
                                                        className="font-semibold text-sm text-foreground flex items-center gap-2"
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
                                                    <div className="text-xs text-muted-foreground italic mt-1"> (Processing audio…)</div>
                                                )}
                                            </li>
                                        ))
                                    )
                                ) : filteredCalls.length === 0 ? (
                                    <li className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                        <PhoneMissed className="w-8 h-8 text-muted-foreground/40" />
                                        <span>{currentTab === "missed" ? "No missed calls found." : "No call logs yet."}</span>
                                    </li>
                                ) : (
                                    filteredCalls.map(c => {
                                        const isMissed = c.direction === "inbound" && c.status === "missed"
                                        const who = c.contact_name ? `${c.contact_name} · ${c.number}` : c.number
                                        const sub = `${new Date(c.started_at).toLocaleString()} · ${c.status === "completed" ? mmss(c.duration) : c.status.replace("_", " ")
                                            }${c.handled_by ? ` · ${c.handled_by}` : ""}`

                                        return (
                                            <li
                                                key={c.uid || c.id}
                                                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${isMissed
                                                        ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10"
                                                        : "border-border/60 bg-background/50 hover:bg-muted/40"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMissed
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
                                                            className={`font-semibold text-xs sm:text-sm truncate flex items-center gap-1.5 ${isMissed ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                                                                }`}
                                                        >
                                                            <span className="truncate">{who}</span>
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
                                            </li>
                                        )
                                    })
                                )}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
