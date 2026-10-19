/** Browser-side validation that mirrors the operations API's bounded payloads. */
export type CampaignRecipient = { phone: string; email: string; name: string };

export function parseCampaignRecipients(text: string): CampaignRecipient[] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(value.trim()); value = "";
      if (c === "\n") { rows.push(row); row = []; }
    } else if (c !== "\r") value += c;
  }
  if (quoted) throw new Error("Close the quoted CSV value before creating a proposal.");
  row.push(value.trim()); rows.push(row);
  const nonempty = rows.filter((r) => r.some(Boolean));
  if (!nonempty.length) return [];
  if (nonempty[0].map((v) => v.toLowerCase()).join(",") !== "phone,email,name") throw new Error("Keep the CSV header phone,email,name.");
  const seen = new Set<string>();
  return nonempty.slice(1).flatMap((fields, index) => {
    if (fields.length !== 3) throw new Error(`Recipient row ${index + 2} needs phone,email,name. Quote names containing commas.`);
    const [phone, email, name] = fields;
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error(`Recipient row ${index + 2} needs an E.164 phone number.`);
    if (email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) throw new Error(`Recipient row ${index + 2} has an invalid email address.`);
    if (!phone && !email) throw new Error(`Recipient row ${index + 2} needs a phone or email.`);
    // Match the backend's phone-first, case-insensitive address deduplication.
    const key = (phone || email).toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ phone, email, name }];
  });
}

export function campaignExpired(expiresAt: unknown, now = Date.now()): boolean {
  return typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now;
}

export function parseConditions(rows: { field: string; value: string; kind: string }[]): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const row of rows) {
    const field = row.field.trim();
    if (!field) throw new Error("Every trigger condition needs a field.");
    if (Object.prototype.hasOwnProperty.call(result, field)) throw new Error(`Condition ${field} is repeated.`);
    result[field] = row.kind === "json" ? JSON.parse(row.value) : row.value;
  }
  return result;
}
