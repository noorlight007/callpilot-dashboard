'use client';

import React from 'react';
import {
    Headphones,
    Link2,
    Phone,
    Bot,
    Users,
    BarChart3,
    Settings,
    Send,
    HelpCircle,
    ChevronDown
} from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

const helpSections = [
    {
        title: "ATS Connection",
        icon: Link2,
        faqs: [
            { q: "How do I connect my ATS to Callpilot?", a: "Navigate to Settings → Integrations, select your ATS provider from the list, and follow the OAuth authentication flow. Most connections are established in under 2 minutes." },
            { q: "Which ATS platforms are supported?", a: "CallPilot integrates with all major ATS and CRM platforms through our flexible API. If your system supports API access, integration can be configured quickly." },
            { q: "My ATS sync is failing. What should I do?", a: "First, check that your API credentials are still valid. Go to Settings → Integrations → your ATS and click 'Re-authenticate'. If the issue persists, check that the required scopes/permissions are enabled on your ATS side." },
            { q: "How often does data sync between my ATS and Callpilot?", a: "Data syncs automatically every 15 minutes. You can also trigger a manual sync from the Integrations page by clicking the refresh icon." },
        ],
    },
    {
        title: "AI Phone Numbers",
        icon: Phone,
        faqs: [
            { q: "How do I get an AI phone number?", a: "Go to Phone Numbers → Add Number. Choose your preferred area code and country, then click 'Provision'. Your new AI number will be active within seconds." },
            { q: "Can I port my existing phone number?", a: "Yes. Existing AI phone numbers can usually be ported to CallPilot. Contact support to begin the transfer process." },
            { q: "How many AI phone numbers can I have?", a: "This depends on your plan. Starter plans include 2 numbers, Pro plans include 10, and Enterprise plans offer unlimited numbers." },
            { q: "What happens when someone calls my AI number?", a: "The AI agent answers using your configured greeting and script. It can qualify leads, schedule meetings, answer FAQs, and transfer to a human agent when needed." },
        ],
    },
    {
        title: "AI Agents",
        icon: Bot,
        faqs: [
            { q: "How do I create a new AI agent?", a: "Go to AI Agents → Create Agent. Choose a template or start from scratch. Configure the agent's personality, script, and actions, then assign it to a phone number." },
            { q: "Can I customize what the AI says?", a: "Absolutely. You can write custom scripts, define conversation flows, set up conditional responses, and even train the agent on your company's knowledge base." },
            { q: "How does the AI handle unexpected questions?", a: "The AI uses your knowledge base and fallback rules. If it can't confidently answer, it will either ask a clarifying question or offer to transfer to a human agent." },
        ],
    },
    {
        title: "Contacts & Leads",
        icon: Users,
        faqs: [
            { q: "How do I import contacts?", a: "Go to Contacts → Import. You can upload a CSV file, connect a Google Sheet, or sync directly from your ATS or CRM integration." },
            { q: "How does lead scoring work?", a: "Callpilot uses AI to score leads based on engagement signals — call duration, responses, meeting bookings, and custom criteria you define in Settings → Lead Scoring." },
            { q: "Can I segment my contacts?", a: "Yes. Use Smart Lists to create dynamic segments based on tags, lead score, call history, location, or any custom field." },
        ],
    },
    {
        title: "Analytics & Reporting",
        icon: BarChart3,
        faqs: [
            { q: "What metrics can I track?", a: "Track call volume, conversion rates, average call duration, agent performance, lead qualification rates, and more from the Analytics dashboard." },
            { q: "Can I export reports?", a: "Yes. All reports can be exported as CSV or PDF. You can also schedule automated email reports on a daily, weekly, or monthly basis." },
        ],
    },
    {
        title: "Account & Settings",
        icon: Settings,
        faqs: [
            { q: "How do I add team members?", a: "Go to Settings → Team → Invite Member. Enter their email and assign a role (Admin, Manager, or Agent). They'll receive an invitation email." },
            { q: "How do I change my plan?", a: "Navigate to Settings → Billing → Change Plan. You can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle." },
            { q: "Is my data secure?", a: "Yes. Callpilot uses AES-256 encryption at rest, TLS 1.3 in transit, and is SOC 2 Type II compliant. We never share your data with third parties." },
        ],
    }
];

export function HelpContent() {
    const router = useRouter();
    return (
        <div className="flex-1 overflow-y-auto bg-[#F9FAFB] dark:bg-gray-950">
            <div className="max-w-[1100px] mx-auto py-10 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    {/* <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg mb-4 border dark: text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                        <Headphones size={24} />
                    </div> */}
                    <h1 className="text-3xl font-bold mb-2 gradient-text pb-1">Help Center</h1>
                    <p className="text-gray-500 dark:text-gray-400">Find answers to common questions about Callpilot</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* FAQ Sections */}
                <div className="lg:col-span-2 space-y-6">
                    {helpSections.map((section, sectionIdx) => (
                        <Card key={sectionIdx} className="overflow-hidden border-gray-200 dark:border-gray-800 shadow-sm shadow-violet-500/10 rounded-2xl">
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg border dark: text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                        <section.icon size={20} />
                                    </div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                                </div>

                                <Accordion type="single" collapsible className="w-full space-y-2">
                                    {section.faqs.map((item, itemIdx) => (
                                        <AccordionItem
                                            key={itemIdx}
                                            value={`item-${sectionIdx}-${itemIdx}`}
                                            className="border-none"
                                        >
                                            <AccordionTrigger className="hover:no-underline py-3 group">
                                                <div className="flex items-center gap-3 text-left">
                                                    <HelpCircle size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                                    <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                        {item.q}
                                                    </span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="text-gray-500 dark:text-gray-400 text-[14px] pl-7 pb-4">
                                                {item.a}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Sidebar Action */}
                    <div className="lg:col-span-1 space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Need More Help?</h2>
                        <Card className="bg-[#EBF2FF] dark:bg-blue-900/10 border-[#D6E6FF] dark:border-blue-800/30 p-6 sm:p-8 lg:p-6 xl:p-8 w-full text-center flex flex-col items-center">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg flex items-center justify-center mb-6 border dark: text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <Send size={24} className="ml-0.5" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Write a New Ticket</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                                Describe your issue and our support team will get back to you within 24 hours.
                            </p>
                            <Button
                                onClick={() => router.push('/dashboard/help/support-tickets/create')}
                                className="w-full bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white px-4 sm:px-8 lg:px-4 xl:px-6 py-6 rounded-2xl text-[13px] xl:text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                Write a Support Ticket
                            </Button>
                        </Card>
                    </div>
                </div>

                {/* Footer Support Ticket */}
                <div className="mt-12">
                    <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Still not solving your issue?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-[400px] mx-auto">
                            Send a ticket to us and our support team will get back to you within 24 hours.
                        </p>
                        <Button
                            onClick={() => router.push('/dashboard/help/support-tickets')}
                            className="bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white px-6 rounded-2xl h-auto text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
                        >
                            <Send size={18} className="mr-2" />
                            Write a Support Ticket
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
