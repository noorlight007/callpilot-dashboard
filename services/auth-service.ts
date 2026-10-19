import { BASE_URL } from "@/lib/baseUrl";
const API_BASE_URL = BASE_URL;

export const authService = {
    async login(formData: any) {
        const response = await fetch("/api/session/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        return response;
    },

    async verifyOtp(challengeId: string, otp: string) {
        const response = await fetch("/api/session/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge_id: challengeId, otp_code: otp }),
        });
        return response;
    },

    async verifyToken(_accessToken?: string) {
        return fetch("/api/session", { cache: "no-store" });
    },

    async refreshToken(_refreshToken?: string) {
        return fetch("/api/session", { method: "POST", cache: "no-store" });
    },

    async logout() {
        window.dispatchEvent(new Event("callpilot:session-clear"));
        await fetch("/api/session", { method: "DELETE" });
    },

    async forgotPassword(email: string) {
        const response = await fetch(`${API_BASE_URL}/auth/organizations/forget_password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        return response;
    },

    async resetPassword(formData: any) {
        const response = await fetch(`${API_BASE_URL}/auth/organizations/reset_password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        return response;
    },

    async verifyOrganization(uid: string, data: { password: "" }) {
        const response = await fetch(`${API_BASE_URL}/auth/organizations/verify/${uid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return response;
    },
};

/** Compatibility for the legacy dashboard. The readable flag contains no JWT. */
export const cookieUtils = {
    set(name: string, value: string, days: number) {
        if (name === "access" || name === "refresh") {
            // Authentication cookies are written only by /api/session on the server.
            if (days < 0 || value === "") {
                document.cookie = "cp_session=;Max-Age=0;path=/;SameSite=Lax";
                document.cookie = `${name}=;Max-Age=0;path=/;SameSite=Lax`;
            }
            return;
        }
        const secure = location.protocol === "https:" ? ";Secure" : "";
        document.cookie = `${name}=${encodeURIComponent(value)};Max-Age=${days * 86400};path=/;SameSite=Lax${secure}`;
    },
    get(name: string) {
        if (typeof document === "undefined") return null;
        const session = name === "access" || name === "refresh";
        const key = session ? "cp_session" : name;
        const raw = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(`${key}=`));
        return raw ? session ? "session" : decodeURIComponent(raw.slice(key.length + 1)) : null;
    },
};
