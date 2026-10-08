import axios from "axios";
import { BASE_URL } from "@/lib/baseUrl";
import { cookieUtils } from "@/services/auth-service";

const getAuthToken = () => cookieUtils.get("access");

const api = axios.create({
    baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const profileService = {
    async getProfile() {
        return api.get("/me/");
    },

    async updateProfile(data: any) {
        return api.patch("/me/", data);
    },

    async updatePassword(data: any) {
        // Based on user request, password is patched to /me/ as well
        return api.patch("/me/", data);
    },

    async getOrganization() {
        return api.get("/organizations/me");
    },

    async updateOrganization(data: any) {
        return api.patch("/organizations/me", data);
    },

    async getMyOrganizations() {
        return api.get("/organizations/my_organizations");
    },

    async switchOrganization(uid: string) {
        return api.put(`/organizations/switch/${uid}`);
    },

    async getSupportTickets() {
        return api.get("/organizations/support_ticket");
    },

    async createSupportTicket(data: any) {
        return api.post("/organizations/support_ticket", data);
    },

    async uploadSupportMedia(data: FormData) {
        return api.post("/organizations/support_ticket/media", data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    async getSupportMedia() {
        return api.get("/organizations/support_ticket/media");
    },

    async deleteSupportMedia(uid: string) {
        return api.delete(`/organizations/support_ticket/media/${uid}`);
    },

    async getTicketDetails(uid: string) {
        return api.get(`/organizations/support_ticket/${uid}`);
    },

    async downloadAttachment(uid: string) {
        return api.get(`/organizations/support_ticket/media/${uid}/download`, {
            responseType: 'blob'
        });
    },

    async getPlatformStatus() {
        return api.get("/organizations/me");
    },

    async getOrganizationUsers() {
        return api.get("/organizations/users/");
    },

    async updateOrganizationUser(uid: string, data: { role?: string; email?: string; password?: string; sent_email_notifications?: boolean; status?: string }) {
        return api.patch(`/organizations/users/${uid}`, data);
    },

    async deleteOrganizationUser(uid: string) {
        return api.delete(`/organizations/users/${uid}`);
    },

    async inviteUser(data: { role: string; email: string; password?: string; sent_email_notifications?: boolean }) {
        return api.post("/organizations/invite/", data);
    },

    async getSentInvitations() {
        return api.get("/organizations/invite/");
    },

    async checkEmail(email: string) {
        return api.post("/organizations/users/check-email", { email });
    }
};
