/** Contracts shared by inbox composition and the existing browser softphone. */
export type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: { type?: string; url?: string }[];
};
export type ChannelTemplate = { uid: string; name: string; language: string; status: string; components?: TemplateComponent[] };
export type ParameterGroup = { key: string; type: string; sub_type?: string; index?: string; slots: string[]; preview: string };

/** Render a provider's named value without dumping arbitrary record contents. */
export function contextLabel(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";
  const row = value as Record<string, unknown>;
  for (const key of ["name", "fullName", "displayName", "title", "jobTitle", "label"]) {
    if (typeof row[key] === "string" || typeof row[key] === "number") return String(row[key]);
  }
  return [row.firstName, row.lastName].filter((part) => typeof part === "string").join(" ");
}

export function withinWhatsAppWindow(lastInbound: unknown, now: number): boolean {
  const timestamp = typeof lastInbound === "string" ? Date.parse(lastInbound) : NaN;
  return Number.isFinite(timestamp) && timestamp > now - 24 * 60 * 60 * 1000;
}

export function channelSendAllowed(role: string | undefined, membership: number | undefined, assignedTo: number | null | undefined): boolean {
  return role === "super_user" || role === "full_staff" || role === "standard_staff" && membership != null && assignedTo === membership;
}

/** Only provider-defined, numbered text substitutions are supported. */
export function templateParameters(template?: ChannelTemplate): { groups: ParameterGroup[]; unsupported: boolean } {
  const groups: ParameterGroup[] = [];
  let unsupported = false;
  const append = (key: string, type: string, text: string, extra: Partial<ParameterGroup> = {}) => {
    const placeholders = [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]);
    const slots = Array.from(new Set(placeholders)).sort((a, b) => Number(a) - Number(b));
    if (slots.some((slot, index) => slot !== String(index + 1))) unsupported = true;
    if (slots.length) groups.push({ key, type, slots, preview: text, ...extra });
  };
  for (const [i, component] of (template?.components ?? []).entries()) {
    const type = String(component.type ?? "").toLowerCase();
    if (type === "body" || type === "header" && (!component.format || component.format.toUpperCase() === "TEXT")) {
      append(String(i), type, String(component.text ?? ""));
    } else if (type === "buttons" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, index) => {
        if (button.type === "URL") append(`${i}-${index}`, "button", String(button.url ?? ""), { sub_type: "url", index: String(index) });
        else if (!["PHONE_NUMBER", "QUICK_REPLY"].includes(button.type ?? "")) unsupported = true;
      });
    } else if (type !== "footer") unsupported = true;
  }
  return { groups, unsupported };
}

export function templateSendComponents(template: ChannelTemplate, values: Record<string, string>) {
  if (template.status !== "APPROVED") throw new Error("Choose an approved template.");
  const { groups, unsupported } = templateParameters(template);
  if (unsupported) throw new Error("This template needs unsupported media or parameters.");
  return groups.map((group) => ({
    type: group.type,
    ...(group.sub_type ? { sub_type: group.sub_type, index: group.index } : {}),
    parameters: group.slots.map((slot) => {
      const text = values[`${template.uid}:${group.key}:${slot}`]?.trim();
      if (!text) throw new Error(`Supply ${group.type} parameter ${slot}.`);
      return { type: "text", text };
    }),
  }));
}

export function liveCallForPhone<T extends { number?: string; status?: string; started_at?: string }>(calls: T[], phone: string): T | undefined {
  const digits = (value: string) => value.replace(/\D/g, "");
  return calls.filter((call) => digits(call.number ?? "") === digits(phone) && ["ringing", "in_progress"].includes(call.status ?? ""))
    .sort((a, b) => Date.parse(b.started_at ?? "") - Date.parse(a.started_at ?? ""))[0];
}
