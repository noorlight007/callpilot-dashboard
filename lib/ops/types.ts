export type Role = "super_user" | "full_staff" | "standard_staff";

export interface Me {
  membership_id: number;
  user_id: number;
  role: Role;
  ats_user_id?: number | null;
  ats_connected: boolean;
  tenant_id?: number;
  /** can_delete, can_bulk_send, finance, mcp */
  permissions?: Record<string, boolean>;
  [k: string]: any;
}

export type ActionStatus =
  | "awaiting_confirmation"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "dead_letter";

export interface ActionEnvelope {
  id: number;
  status: ActionStatus;
  section?: string;
  operation?: string;
  target?: string;
  request?: any;
  before?: any;
  after?: any;
  error?: any;
  attempts?: number;
  uncertain_outcome?: boolean;
  confirmation_expires_at?: string;
  result?: any;
  [k: string]: any;
}

export interface Message {
  uid: string;
  direction: "inbound" | "outbound";
  body: string;
  status?: string;
  review?: string;
  visibility?: "pending" | "staff" | "owner";
  created_at?: string;
  [k: string]: any;
}

export interface Conversation {
  uid: string;
  channel: "sms" | "whatsapp" | "voice" | string;
  mode?: "ai" | "human";
  assigned_to_id?: number | null;
  contact?: any;
  phone?: string;
  last_message_at?: string;
  needs_classification?: boolean;
  can_create?: string[];
  ats_url?: string;
  transcript_restricted?: boolean;
  messages?: Message[];
  [k: string]: any;
}
