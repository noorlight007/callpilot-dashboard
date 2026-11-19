import axios from "axios";
import { BASE_URL } from "@/lib/baseUrl";
import { cookieUtils } from "@/services/auth-service";

export type TestStatus = "APPLIED" | "CALL_PLACED" | "DOCUMENTS_REQUESTED" | "DOCUMENTS_RECEIVED" | "SCREENING_PASSED" | "UNSUCCESSFUL";
export interface TestConfig {
  uid?: string;
  enabled: boolean;
  phone_uid: string | null;
  phone_number?: string;
  voice_id: string;
  primary_questions: string[];
  end_call_if_primary_answer_negative: boolean;
  documents_enabled: boolean;
  timezone: string;
  calling_time_after_status_update: number;
  calling_start_time: string;
  calling_end_time: string;
  calling_days: number[];
  ready?: boolean;
  readiness_errors?: string[];
}
export interface TestJob {
  uid: string;
  title: string;
  description: string;
  location: string;
  salary: string;
  is_active: boolean;
  application_count: number;
  created_at: string;
}
export interface TestDocument {
  uid: string;
  name: string;
  label: string;
  size?: number;
  created_at: string;
  download_url?: string;
}
export interface TestAttempt {
  uid: string;
  state: string;
  ai_decision: string;
  error: string;
  call_sid: string;
  call_duration: string;
  conversation_json: unknown;
  created_at: string;
  placed_at: string | null;
  completed_at: string | null;
}
export interface TestEvent {
  uid: string;
  status: TestStatus;
  status_label: string;
  message: string;
  created_at: string;
}
export interface TestApplication {
  uid: string;
  job_uid: string;
  job_title: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  status: TestStatus;
  status_label: string;
  call_state: string;
  ai_decision: string;
  last_error: string;
  created_at: string;
  attempts: TestAttempt[];
  documents: TestDocument[];
  events: TestEvent[];
}
export interface TestSummary {
  jobs: number;
  applications: number;
  applied: number;
  call_placed: number;
  documents_requested: number;
  documents_received: number;
  unsuccessful: number;
  call_failed: number;
  ready: boolean;
  readiness_errors: string[];
  screening_call_credit: number;
  config: TestConfig | null;
}
export interface PublicTestUpload {
  candidate_name: string;
  job_title: string;
  status_label: string;
  documents: TestDocument[];
  upload_allowed: boolean;
}

const api = axios.create({ baseURL: `${BASE_URL.replace(/\/$/, "")}/screening-tests/` });
api.interceptors.request.use((config) => {
  const token = cookieUtils.get("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
const publicApi = axios.create({ baseURL: `${BASE_URL.replace(/\/$/, "")}/screening-tests/` });

export const screeningTestService = {
  summary: () => api.get<TestSummary>("summary/").then((r) => r.data),
  config: () => api.get<TestConfig>("config/").then((r) => r.data),
  saveConfig: (data: Partial<TestConfig>) => api.patch<TestConfig>("config/", data).then((r) => r.data),
  jobs: () => api.get<TestJob[]>("jobs/").then((r) => r.data),
  createJob: (data: Pick<TestJob, "title" | "description" | "location" | "salary">) => api.post<TestJob>("jobs/", data).then((r) => r.data),
  updateJob: (uid: string, data: Partial<TestJob>) => api.patch<TestJob>(`jobs/${uid}/`, data).then((r) => r.data),
  deleteJob: (uid: string) => api.delete(`jobs/${uid}/`),
  applications: (jobUid?: string) => api.get<TestApplication[]>("applications/", { params: jobUid ? { job_uid: jobUid } : {} }).then((r) => r.data),
  application: (uid: string) => api.get<TestApplication>(`applications/${uid}/`).then((r) => r.data),
  createApplication: (data: Pick<TestApplication, "job_uid" | "first_name" | "last_name" | "email" | "mobile">) => api.post<TestApplication>("applications/", data).then((r) => r.data),
  startCall: (uid: string) => api.post<TestApplication>(`applications/${uid}/call/`).then((r) => r.data),
  upload: (uid: string, file: File, label: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("label", label);
    return api.post<TestDocument>(`applications/${uid}/documents/`, body).then((r) => r.data);
  },
  uploadLink: (uid: string) => api.post<{ url: string; token: string }>(`applications/${uid}/upload-link/`).then((r) => r.data),
  download: (uid: string) => api.get<Blob>(`documents/${uid}/download/`, { responseType: "blob" }).then((r) => r.data),
  publicUploadDetails: (token: string) => publicApi.get<PublicTestUpload>(`upload/${encodeURIComponent(token)}/`).then((r) => r.data),
  publicUpload: (token: string, file: File, label: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("label", label);
    return publicApi.post<TestDocument>(`upload/${encodeURIComponent(token)}/`, body).then((r) => r.data);
  },
};

export function screeningError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    const flatten = (value: unknown): string[] => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.flatMap(flatten);
      if (value && typeof value === "object") return Object.entries(value).flatMap(([key, val]) => flatten(val).map((message) => ["detail", "non_field_errors", "readiness_errors"].includes(key) ? message : `${key.replace(/_/g, " ")}: ${message}`));
      return [];
    };
    const messages = flatten(data);
    if (messages.length) return messages.join(" ");
    if (!error.response) return "Could not reach CallPilot. Check your connection and try again.";
    if (error.response.status === 401) return "Your session has expired. Please sign in again.";
  }
  return "Something went wrong. Please try again.";
}
