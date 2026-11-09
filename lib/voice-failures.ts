export interface VoiceFailure {
    status?: string
    hangup_cause?: string
    failure_reason?: string
    provider_error_code?: string
}

export function callFailureMessage(call: VoiceFailure): string {
    if (call.failure_reason) return call.failure_reason
    if (call.status !== "failed") return ""
    const causes: Record<string, string> = {
        no_main_number: "No active main business number is configured for your agency. Ask your administrator to set the voice caller ID.",
        missing_call_control_app: "The backend Voice API application ID is missing. Ask your administrator to complete the Telnyx voice setup.",
        invalid_number: "The destination number is invalid. Use international format.",
        dial_failed: "Telnyx could not create the destination call. Ask your administrator to check the provider error and outbound voice profile."
    }
    return causes[call.hangup_cause || ""] || "The call failed before it connected. Ask your administrator to check this call in the backend voice log."
}

export function rtcFailureMessage(call: any): string {
    const cause = typeof call?.cause === "string" && /^[A-Z0-9_ -]{1,60}$/i.test(call.cause) ? call.cause : ""
    const code = typeof call?.sipCode === "number" && call.sipCode >= 100 && call.sipCode <= 699 ? `SIP ${call.sipCode}` : ""
    const details = [cause, code].filter(Boolean).join(" / ")
    return `The call ended before it connected${details ? ` (${details})` : ""}. Check the failure reason in Recent Calls and open Phone setup.`
}
