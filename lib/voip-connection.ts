type TelnyxConstructor = new (options: Record<string, unknown>) => any

let sdkPromise: Promise<TelnyxConstructor> | null = null

const getTelnyxConstructor = (): TelnyxConstructor | null => {
    const globals = window as any
    const candidates = [
        globals.TelnyxWebRTC?.TelnyxRTC,
        globals.TelnyxRTC?.TelnyxRTC,
        globals.TelnyxRTC,
        globals.TelnyxWebRTC
    ]
    return candidates.find(candidate => typeof candidate === "function") || null
}

export const loadTelnyxSdk = (sdkUrl: string): Promise<TelnyxConstructor> => {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Telnyx SDK can only load in the browser"))
    }
    const existing = getTelnyxConstructor()
    if (existing) return Promise.resolve(existing)
    if (sdkPromise) return sdkPromise

    sdkPromise = (async () => {
        // The bundled SDK is 2.27.10, including the transferred-call answer fix.
        const urls = [sdkUrl, "https://unpkg.com/@telnyx/webrtc@2.27.10/lib/bundle.js"]
        for (const url of urls) {
            try {
                return await new Promise<TelnyxConstructor>((resolve, reject) => {
                    const script = document.createElement("script")
                    const finish = (error?: Error) => {
                        clearTimeout(timeout)
                        script.onload = null
                        script.onerror = null
                        const RTC = getTelnyxConstructor()
                        if (!error && RTC) {
                            resolve(RTC)
                        } else {
                            script.remove()
                            reject(error || new Error("Telnyx SDK global not found"))
                        }
                    }
                    const timeout = setTimeout(() => finish(new Error("Phone SDK loading timed out")), 10000)
                    script.src = url
                    script.async = true
                    script.onload = () => finish()
                    script.onerror = () => finish(new Error("Could not load the phone SDK"))
                    document.head.appendChild(script)
                })
            } catch {
                // A blocked or unavailable source must not stall registration.
            }
        }
        throw new Error("Could not load the phone SDK. Check your connection and retry.")
    })().catch(error => {
        sdkPromise = null
        throw error
    })

    return sdkPromise
}

export const normalizeTelnyxToken = (payload: unknown): string | null => {
    if (typeof payload === "string") {
        const value = payload.trim()
        if (!value) return null
        // Some backends wrap Telnyx's JSON-encoded response in another token field.
        if (value.startsWith('"') || value.startsWith("{")) {
            try { return normalizeTelnyxToken(JSON.parse(value)) } catch { return null }
        }
        return value
    }
    if (!payload || typeof payload !== "object") return null
    const data = payload as Record<string, unknown>
    for (const key of ["token", "login_token", "jwt", "data"]) {
        const token = normalizeTelnyxToken(data[key])
        if (token) return token
    }
    return null
}

class VoiceTokenError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

export const fetchTelnyxToken = async (tokenUrl: string, options: RequestInit): Promise<string> => {
    const requestToken = async (url: string, requestOptions: RequestInit) => {
        const controller = new AbortController()
        const abort = () => controller.abort()
        if (requestOptions.signal?.aborted) abort()
        else requestOptions.signal?.addEventListener("abort", abort, { once: true })
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, 15000)
        try {
            const response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal,
                method: "POST",
                cache: "no-store"
            })
            const body = await response.text()
            let data: any
            try { data = JSON.parse(body) } catch { data = null }
            if (!response.ok) {
                throw new VoiceTokenError(
                    data?.error || data?.detail || `Phone login failed (HTTP ${response.status})`,
                    response.status
                )
            }
            const token = normalizeTelnyxToken(data ?? body)
            // A successful HTML/error response is not a login credential.
            if (!token || token.split(".").length !== 3 || /[\s<>]/.test(token)) {
                throw new Error("The phone login service did not return a valid WebRTC token")
            }
            return token
        } catch (error) {
            if (timedOut && !requestOptions.signal?.aborted) {
                throw new Error("Phone login timed out. Check your connection and retry.")
            }
            throw error
        } finally {
            clearTimeout(timeout)
            requestOptions.signal?.removeEventListener("abort", abort)
        }
    }

    try {
        return await requestToken(tokenUrl, options)
    } catch (error) {
        if (options.signal?.aborted) throw error
        // These errors require the user's own extension/session to be fixed.
        // Creating a different credential through the fallback cannot fix them.
        if (error instanceof VoiceTokenError && [401, 403, 409].includes(error.status)) throw error
        try {
            return await requestToken("/api/voice/token", { signal: options.signal })
        } catch (fallbackError) {
            if (options.signal?.aborted) throw fallbackError
            const primaryMessage = error instanceof Error ? error.message : "Phone login failed"
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Backup login failed"
            throw new Error(`${primaryMessage}. ${fallbackMessage}`)
        }
    }
}
