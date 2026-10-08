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

export const phoneService = {
    async getOrganizationMe() {
        return api.get("/organizations/me");
    },

    async createSubaccount(friendlyName: string) {
        return api.post("/phone_number/subaccounts/create", { friendly_name: friendlyName });
    },

    async getCountries() {
        return api.get("/phone_number/countries");
    },

    async getBundles() {
        return api.get("/phone_number/bundles");
    },

    async getAvailableNumbers(countryCode: string) {
        return api.get(`/phone_number/available_phone_numbers?country=${countryCode}`);
    },

    async createBundle(data: any) {
        return api.post("/phone_number/bundles/create", {
            friendly_name: data.friendly_name,
            iso_country: data.country_code,
            number_type: data.number_type,
            email: data.email,
        });
    },

    async createEndUser(data: any) {
        return api.post("/phone_number/end-users/create", data);
    },

    async createAddress(data: any) {
        return api.post("/phone_number/addresses/create", data);
    },

    async buyNumber(data: any) {
        return api.post("/phone_number/buy", data);
    },

    async getPurchasedNumbers() {
        return api.get("/phone_number/");
    },
    async releaseNumber(uid: string) {
        return api.delete(`/phone_number/${uid}/release`);
    },
    async getPhonePlans() {
        return api.get("/payment/subscriptions/plans/phone");
    }
};
