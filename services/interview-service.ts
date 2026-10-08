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

export const interviewService = {
    async getInterviews(page: number = 1) {
        return api.get(`/interview/?page=${page}`);
    },

    async getCallLogs(page: number = 1) {
        return api.get(`/flows/call_logs/?page=${page}`);
    },

    async getInterviewById(id: number | string) {
        return api.get(`/interview/${id}/`);
    },

    async deleteCallLog(uid: string) {
        return api.delete(`/flows/call_logs/${uid}`);
    },

    async getCallLogConfig() {
        return api.get(`/flows/call_logs/config`);
    },

    async updateCallLogConfig(data: { action: string; delete_hours: number | null }) {
        return api.patch(`/flows/call_logs/config`, data);
    },

    async retryInterviews(limit: number) {
        return api.post(`/interview/retry/`, { limit });
    },

    async retrySingleInterview(uid: string) {
        return api.post(`/interview/retry/${uid}`);
    },

    async getInterviewAnalytics(params?: { period?: string; start_date?: string; end_date?: string }) {
        const searchParams = new URLSearchParams();
        if (params?.period) searchParams.append("period", params.period);
        if (params?.start_date) searchParams.append("start_date", params.start_date);
        if (params?.end_date) searchParams.append("end_date", params.end_date);
        const query = searchParams.toString();
        return api.get(`/interview/analytics${query ? `?${query}` : ''}`);
    }
};
