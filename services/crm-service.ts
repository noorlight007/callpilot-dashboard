import { BASE_URL } from "@/lib/baseUrl";

export interface MyPlatform {
    id: number;
    uid: string;
    created_at: string;
    updated_at: string;
    access_token: string;
    refresh_token: string;
    token_type: string;
    base_url: string;
    expires_at: string;
    is_connected: boolean;
    connected_at: string;
    last_synced_at: string | null;
    config: any;
    status: string;
    organization: number;
    platform: number;
}

export interface Platform {
    id: number;
    uid: string;
    name: string;
    slug: string;
    description: string;
    base_url: string | null;
    client_id: string;
    auth_type: string;
    logo: string | null;
    status: string;
    redirect_uri: string;
    scope: string;
    response_type: string;
    state: string;
    is_connected: boolean;
    my_platform: MyPlatform | null;
}

export interface PlatformResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Platform[];
}

export const crmService = {
    async fetchPlatforms(token: string) {
        const response = await fetch(`${BASE_URL}/organizations/platform/`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        return response;
    },

    async connectPlatform(token: string, data: { code: string; redirect_uri: string; platform_slug: string }) {
        const response = await fetch(`${BASE_URL}/organizations/platform/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response;
    },

    async connectRecruitCRM(token: string, data: { access_token: string }) {
        const response = await fetch(`${BASE_URL}/organizations/platform/recruitcrm/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response;
    },

    async connectAshby(token: string, data: { access_token: string }) {
        const response = await fetch(`${BASE_URL}/organizations/platform/ashby/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response;
    },

    async connectGreenhouse(token: string, data: { client_id: string; client_secret: string }) {
        const response = await fetch(`${BASE_URL}/organizations/platform/greenhouse/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response;
    },

    async connectGreenhouseOAuth(token: string, data: { code: string; redirect_uri: string }) {
        const response = await fetch(`${BASE_URL}/organizations/platform/greenhouse/connect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return response;
    },

    async disconnectPlatform(token: string, uid: string) {
        const response = await fetch(`${BASE_URL}/organizations/platform/my_platforms/${uid}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        return response;
    },
};
