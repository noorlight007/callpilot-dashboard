// Dashboard headings and their display order; provider/API identifiers stay stable.
export const JIGSAW_HEADLINE = 'Stop copying messages into your CRM. Every call, WhatsApp, SMS and email saves itself.';
export const JIGSAW_AUTOMATIONS = 'Control every layer and add AI search from here.';
export const JIGSAW_WORKING_DAY = "A customer WhatsApps at 7am. It's on their record before you're up. Your AI agent calls back, answers their questions and books a meeting into your diary. Their follow-up email is filed against the same record. By 9am you've typed nothing and missed nothing.";
export const JIGSAW_SECTIONS: { number: number; key: string; name: string; description: string; href?: string }[] = [
  { number: 1, key: 'ai-calls', name: 'AI Calls', description: 'AI makes and answers your calls.', href: '/dashboard/ai-call-flow-options' },
  { number: 2, key: 'agents', name: 'AI Agents', description: 'Chat-driven agents working behind the scenes, 24/7.', href: '/dashboard/control-centre' },
  { number: 3, key: 'sales', name: 'AI Sales Agent', description: 'Your next client, found and briefed before you dial.', href: '/dashboard/ai-jigsaw/sales' },
  { number: 4, key: 'ai', name: 'ChatGPT & Claude', description: 'Once connected, build your own automations.', href: '/dashboard/ai-jigsaw/ai' },
  { number: 5, key: 'voip', name: 'VoIP Business Lines', description: 'Your company number on any device, with recordings.', href: '/dashboard/ai-jigsaw/voip' },
  { number: 6, key: 'whatsapp', name: 'WhatsApp & SMS', description: 'Chat on WhatsApp. It lands in your CRM by itself.', href: '/dashboard/ai-jigsaw/whatsapp' },
  { number: 7, key: 'microsoft365', name: 'Email', description: 'Emails and attachments filed without dragging and dropping.', href: '/dashboard/ai-jigsaw/microsoft365' },
  { number: 8, key: 'calendar', name: 'Calendar & Booking', description: 'Meetings booked without the back-and-forth.' },
  { number: 9, key: 'ats', name: 'CRM / ATS', description: 'Calls, chats and emails on one record. Nothing typed twice.', href: '/dashboard/ai-jigsaw/ats' },
  { number: 10, key: 'timesheets', name: 'Timesheets', description: 'Hours sent by WhatsApp, SMS or email go straight into your system.', href: '/dashboard/ai-jigsaw/timesheets' },
  { number: 11, key: 'xero', name: 'Financials', description: 'Know your numbers without waiting for month end.', href: '/dashboard/ai-jigsaw/xero' },
];
