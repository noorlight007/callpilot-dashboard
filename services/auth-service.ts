const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.callpilot.pro/api/v1";

export const authService = {
    async login(formData: any) {
        const response = await fetch(`${API_BASE_URL}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        return response;
    },

    async verifyOtp(otp: string) {
        const response = await fetch(`${API_BASE_URL}/token/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ otp_code: otp }),
        });
        return response;
    },

    async verifyToken(accessToken: string) {
        const response = await fetch(`${API_BASE_URL}/token/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: accessToken }),
        });
        return response;
    },

    async refreshToken(refreshTokenStr: string) {
        const response = await fetch(`${API_BASE_URL}/token/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshTokenStr }),
        });
        return response;
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

// Cookie Helpers
export const cookieUtils = {
    set(name: string, value: string, days: number) {
        const d = new Date();
        d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
        const expires = "expires=" + d.toUTCString();
        document.cookie = `${name}=${value};${expires};path=/`;
    },

    get(name: string) {
        const nameEq = name + "=";
        const ca = document.cookie.split(";");
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === " ") c = c.substring(1, c.length);
            if (c.indexOf(nameEq) === 0) return c.substring(nameEq.length, c.length);
        }
        return null;
    }
};
