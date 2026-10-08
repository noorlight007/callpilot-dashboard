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

export const flowService = {
    async getFlows() {
        return api.get("/subscription/features/");
    },

    async subscribeToFeature(featureUid: string) {
        return api.post("/subscription/", {
            plan_feature_uid: featureUid
        });
    },

    async getPricingPlans(featureUid: string) {
        return api.get(`/subscription/plan/${featureUid}/`);
    },

    async getInterviewStatus() {
        return api.get("/interview/status/");
    },

    async getMyPlatforms() {
        return api.get("/organizations/platform/my_platforms");
    },

    async getPhoneNumbers() {
        return api.get("/phone_number/");
    },

    async getPrimaryQuestions() {
        return api.get("/interview/call/config/primary_questions");
    },

    async savePrimaryQuestion(question: string) {
        return api.post("/interview/call/config/primary_questions", { question });
    },

    async deletePrimaryQuestion(uid: string) {
        return api.delete(`/interview/call/config/primary_questions/${uid}`);
    },

    async getCallConfig() {
        return api.get("/interview/call/config/");
    },

    async getCallConfigDetails() {
        return api.get("/interview/call/config/details");
    },

    async createCallConfig(payload: any) {
        return api.post("/interview/call/config/", payload);
    },

    async updateCallConfig(payload: any) {
        return api.patch("/interview/call/config/details", payload);
    },

    async releaseFlow(uid: string) {
        return api.delete(`/flows/available-flow/my_flow/release/${uid}`);
    },
    async getDinerConfig() {
        return api.get("/interview/bookings/details");
    },
    async saveDinerConfig(payload: any) {
        return api.post("/interview/bookings/", payload);
    },
    async updateDinerConfig(payload: any) {
        return api.patch("/interview/bookings/details", payload);
    },
    async getDinerReports() {
        return api.get("/interview/bookings/reports");
    },
    async getVoices(gender?: string) {
        return api.get("/interview/voices/", {
            params: gender ? { gender } : {}
        });
    },
    async getWhatsappTemplate(configUid: string) {
        return api.get(`/twilio/whatsapp/template/${configUid}/`);
    },

    async deleteWhatsappTemplate(configUid: string) {
        return api.delete(`/twilio/whatsapp/template/${configUid}/`);
    },

    async createWhatsappAccount(data: { account_sid: string, auth_token: string }) {
        return api.post("/twilio/whatsapp/account/", data);
    },

    async fetchWhatsappSenders() {
        return api.post("/twilio/whatsapp/senders/fetch/");
    },

    async getWhatsappSenders() {
        return api.get("/twilio/whatsapp/senders/");
    },

    async selectWhatsappSender(data: { sender_uid: string }) {
        return api.post("/twilio/whatsapp/senders/select/", data);
    },

    async setupWhatsappTemplate(data: { config_uid: string, sender_uid: string }) {
        return api.post("/twilio/whatsapp/template/setup/", data);
    }
};
