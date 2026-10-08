'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Phone,
  CreditCard,
  Link2,
  Shuffle,
  Sparkles,
  BarChart3,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  AlertTriangle,
  FileText,
  Users,
  Settings,
  HelpCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Block {
  title?: string;
  purpose: string;
  steps: string[];
  actions?: { name: string; description: string }[];
  screenshots: string[];
}

interface Section {
  id: string;
  title: string;
  group: 'setup' | 'reference';
  icon: React.ComponentType<any>;
  needsConfirmation?: boolean;
  blocks: Block[];
}

// Help sections structured data matching developer instructions
const docSections: Section[] = [
  {
    id: "step-1",
    title: "STEP 1 · Account Created",
    group: "setup",
    icon: Users,
    blocks: [
      {
        purpose: "After you sign up for CallPilot, your account is created and you land on your dashboard to begin setup.",
        steps: [
          "Check your inbox for the confirmation email from CallPilot.",
          "Log in to your new dashboard.",
          "Continue to Add Business Details to finish setting up your account."
        ],
        screenshots: ["/help/Account Created.png"]
      }
    ]
  },
  {
    id: "step-2",
    title: "STEP 2 · Add Business Details",
    group: "setup",
    icon: FileText,
    blocks: [
      {
        purpose: "Before you can provision numbers or take payment, CallPilot needs your business details to set up your organisation profile and register your AI telephone number with Twilio, our telephony provider.",
        steps: [
          "Enter your company name and registered business address.",
          "Select your industry type.",
          "Confirm your primary contact name and email.",
          "Depending on your country, you will be required to upload additional documents to authorize your AI telephone number.",
          "Click Save & Continue."
        ],
        screenshots: [
          "/help/Add business details 1.png",
          "/help/Add business details 2.png",
          "/help/Add business details 3.png",
          "/help/Add business details 4.png",
          "/help/Add business details 5.png"
        ]
      }
    ]
  },
  {
    id: "step-3",
    title: "STEP 3 · Buy AI Number",
    group: "setup",
    icon: Phone,
    blocks: [
      {
        title: "Managing Active Phone Numbers",
        purpose: "This dashboard displays all provisioned phone numbers in your organization. You can see their active status, and release or provision numbers from here.",
        steps: [
          "Navigate to 'AI Phone Numbers' in the sidebar menu.",
          "Check the list to see the status of each active number.",
          "Click the '+ Buy AI Number' button at the top-right to provision a new business line.",
          "To disconnect a number permanently, click the 'Release' button on its row."
        ],
        actions: [
          { name: "+ Buy AI Number", description: "Launches the number search and selection wizard to purchase a new phone number." },
          { name: "Release", description: "Instantly terminates the selected phone number, removing it from your active lines." }
        ],
        screenshots: ["/help/Buy_AI_Number_1.png"]
      },
      {
        title: "Purchasing a New Number",
        purpose: "The number checkout screen lets you choose your payment method and authorize a recurring monthly subscription for the selected AI phone number.",
        steps: [
          "Select the provisioned phone number you want to claim.",
          "Choose an existing payment card from the payment method dropdown list.",
          "If no card is saved, click '+ Add payment method' to add one.",
          "Click 'Buy AI Number' to finalize your recurring order."
        ],
        actions: [
          { name: "Buy AI Number", description: "Performs verification and charges the monthly fee, activating the number on your account." },
          { name: "+ Add payment method", description: "Opens a secure form to record a new credit or debit card." }
        ],
        screenshots: ["/help/Buy_AI_Number_2.png"]
      },
      {
        title: "Registering a Payment Method",
        purpose: "A secure portal, powered by Stripe, for adding credit cards for your subscription plans and voice allocations.",
        steps: [
          "Enter your credit card number, expiration date, and CVC code.",
          "Type the cardholder name matching your billing statements.",
          "Enter your billing zip code and select your country.",
          "Optionally check 'Set as default payment method'.",
          "Click 'Add payment method' to register the card details."
        ],
        actions: [
          { name: "Add payment method", description: "Tokenizes the card via Stripe and saves it to your wallet profile." },
          { name: "Cancel", description: "Exits the card entry drawer without saving changes." }
        ],
        screenshots: ["/help/Buy_AI_Number_3.png", "/help/Buy_AI_Number_4.png"]
      }
    ]
  },
  {
    id: "step-4",
    title: "STEP 4 · Choose Plan",
    group: "setup",
    icon: CreditCard,
    blocks: [
      {
        title: "STEP 4 · Choose Plan Pricing Table",
        purpose: "This screen shows CallPilot's subscription tiers, each built around a monthly quota of applicant screenings. Calls that go unanswered do not consume credits — No Answer. No Charge.",
        steps: [
          "Select the tier matching your screening volume.",
          "Confirm your payment method in the billing card dropdown.",
          "Review the monthly pricing terms and quotas.",
          "Click 'Create Subscription Plan' to process the subscription."
        ],
        actions: [
          { name: "Create Subscription Plan", description: "Subscribes your organization to the selected plan and upgrade at any time." }
        ],
        screenshots: [
          "/help/Choose Plan 1.png",
          "/help/Choose Plan 2.png",
          "/help/Choose Plan 3.png"
        ]
      }
    ]
  },
  {
    id: "step-5",
    title: "STEP 5 · Connect Your ATS",
    group: "setup",
    icon: Link2,
    blocks: [
      {
        title: "Connecting ATS Platforms",
        purpose: "A unified dashboard listing compatible applicant tracking systems.",
        steps: [
          "Go to 'Connect ATS' in the sidebar navigation.",
          "Find your ATS provider.",
          "Click the 'Connect' button on the provider's card.",
          "Follow the login prompt to authorize CallPilot access to your recruitment account."
        ],
        actions: [
          { name: "Add Flow", description: "Add AI Applicant Screening Call Flow before connecting ATS." }
        ],
        screenshots: ["/help/Connect Your ATS 1.png"]
      }
    ]
  },
  {
    id: "step-6",
    title: "STEP 6 · AI Call Builder",
    group: "setup",
    icon: Sparkles,
    blocks: [
      {
        title: "Configuring Your AI Call",
        purpose: "This is where you build and launch the AI call for a phone number — every choice that shapes how it screens candidates.",
        steps: [
          "Click 'Edit AI Call' to start configuring.",
          "Choose your platform.",
          "Choose your voice.",
          "Choose your timezone.",
          "Choose the schedule for when you want your AI call working.",
          "Optional: add your own screening questions.",
          "Click 'Update AI Call' to save your changes."
        ],
        actions: [
          { name: "Edit AI Call", description: "Opens the builder" },
          { name: "Update AI Call", description: "Saves your configuration and takes the number live to receive AI calls" }
        ],
        screenshots: [
          "/help/AI Call Builder 1.png",
          "/help/AI Call Builder 2.png",
          "/help/AI Call Builder 3.png",
          "/help/AI Call Builder 4.png"
        ]
      }
    ]
  },
  {
    id: "ref-billing",
    title: "Account & Billing",
    group: "reference",
    icon: Settings,
    blocks: [
      {
        title: "Billing & Usage Overview",
        purpose: "Administrative control over your account plan tier, remaining call time quota, and linked payment accounts.",
        steps: [
          "Go to Settings (bottom sidebar) → Billing.",
          "View the remaining minutes quota in the usage panel.",
          "Click 'Choose a Plan' to upgrade or change your subscription tier.",
          "Use the Overview, Payment methods, and Billing history tabs to manage invoices and cards."
        ],
        actions: [
          { name: "Choose a Plan", description: "Opens the subscription list to select or adjust your plan tier." },
          { name: "Navigation Tabs", description: "Switch views to see linked cards, default payment profiles, or PDF receipts." }
        ],
        screenshots: [
          "/help/Choose Plan 1.png",
          "/help/Choose Plan 2.png",
          "/help/Choose Plan 3.png"
        ]
      },
      {
        title: "Purchasing Minutes Add-on",
        purpose: "Use this if you exhaust your active plan's standard monthly quota and need extra talk time.",
        steps: [
          "Enter the number of extra minutes you want to buy.",
          "Review the live total cost, based on your plan's per-minute rate.",
          "Verify the selected card in your payment profile dropdown.",
          "Click 'Continue' to process the charge and add talk time to your balance."
        ],
        actions: [
          { name: "Continue", description: "Authorizes the payment and instantly updates your minutes balance." }
        ],
        screenshots: [
          "/help/Purchasing Minutes Add-on 1.png",
          "/help/Purchasing Minutes Add-on 2.png",
        ]
      }
    ]
  },
  {
    id: "ref-reports",
    title: "Call Activity & Analytics Reports",
    group: "reference",
    icon: BarChart3,
    blocks: [
      {
        title: "Analyzing Candidate Activity Reports",
        purpose: "A summary table showing caller details, conversation transcripts, recall recommendations, and automated AI grading badges.",
        steps: [
          "Go to Call Activity, or click Reports from your active campaign dashboard.",
          "Review the key metric cards: Total Calls, Candidate Completion, Hours Saved.",
          "Browse the screening table to check each candidate's AI Decision status.",
          "Click 'View' in the Chat History column to see the full transcript."
        ],
        actions: [
          { name: "View Chat History", description: "Opens the transcript of the candidate's call." },
          { name: "AI Decision Badge", description: "Color-coded tag showing the automated candidate grade." }
        ],
        screenshots: ["/help/Call_Activity.png"]
      }
    ]
  }
];

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom text highlighter component
const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query || !query.trim()) return <>{text}</>;
  
  const escapedQuery = escapeRegExp(query);
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-yellow-950 dark:text-yellow-100 px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

// Component for static, directly visible screenshots spanning full container width
const StaticScreenshots = ({ images }: { images: string[] }) => {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 my-4 w-full">
      {images.map((src, idx) => (
        <div 
          key={idx} 
          className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 backdrop-blur-xl dark:bg-white/5 shadow-md w-full"
        >
          {images.length > 1 && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5/70 text-white text-[10px] font-bold tracking-wider backdrop-blur-sm z-10">
              Screen {idx + 1}
            </div>
          )}
          <img 
            src={src} 
            alt={`Screenshot ${idx + 1}`} 
            className="w-full h-auto object-contain block p-2 sm:p-4 mx-auto" 
          />
        </div>
      ))}
    </div>
  );
};

// Repeating content block component
const HelpBlockComponent = ({ block, searchQuery }: { block: Block; searchQuery: string }) => {
  return (
    <div className="space-y-6 pt-6 first:pt-0 border-t border-gray-100 dark:border-gray-800/60 first:border-none">
      {block.title && block.title !== "STEP 4 · Choose Plan Pricing Table" && (
        <h4 className="text-[15px] font-bold text-gray-800 dark:text-gray-200 border-l-2 border-blue-500 pl-3">
          <Highlight text={block.title} query={searchQuery} />
        </h4>
      )}

      {/* 
        Screenshots render block - replacing "What is this screen?" heading and body text.
        Directly visible static screenshots matching the block at maximum possible width.
      */}
      <StaticScreenshots images={block.screenshots} />

      {/* Pricing table block specifically rendered in Step 4 */}
      {block.title === "STEP 4 · Choose Plan Pricing Table" && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 my-4 bg-white/80 backdrop-blur-xl dark:bg-white/5 shadow-sm shadow-violet-500/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-[13px]">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Plan</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Included</th>
                <th scope="col" className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300">Thereafter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                <td className="px-4 py-2.5 font-semibold text-gray-950 dark:text-white">
                  STARTER
                  <div className="text-[11px] text-gray-500 font-normal mt-0.5">$199 / month</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">100 applicant screenings</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">$1.99 per screening</td>
              </tr>
              <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10 bg-blue-50/20 dark:bg-blue-950/10">
                <td className="px-4 py-2.5 font-semibold text-gray-950 dark:text-white">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    GROWTH
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-normal mt-0.5">$795 / month</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-medium">500 applicant screenings</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">$1.59 per screening</td>
              </tr>
              <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                <td className="px-4 py-2.5 font-semibold text-gray-950 dark:text-white">
                  PRO
                  <div className="text-[11px] text-gray-500 font-normal mt-0.5">$1,995 / month</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">1,500 applicant screenings</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">$1.33 per screening</td>
              </tr>
              <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                <td className="px-4 py-2.5 font-semibold text-gray-950 dark:text-white">
                  ENTERPRISE
                  <div className="text-[11px] text-gray-500 font-normal mt-0.5">Custom pricing</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Volume-based</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-medium">Contact sales</td>
              </tr>
            </tbody>
          </table>
          <div className="bg-gray-50 dark:bg-gray-800/30 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
            All plans include WhatsApp, SMS, and email automation, plus prepaid screening credits and optional automatic credit top-up. An AI phone number is $10/month if you don't already have one connected.
          </div>
        </div>
      )}

      {/* "How to use it:" section */}
      <div className="space-y-3">
        <h5 className="text-[11px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
          How to use it:
        </h5>
        <ol className="space-y-2.5">
          {block.steps.map((step, idx) => (
            <li key={idx} className="flex gap-3 items-start text-[13.5px] sm:text-[14px] text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100/50 dark:border-blue-800/10 flex-shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="flex-1">
                <Highlight text={step} query={searchQuery} />
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* "Important Actions" section */}
      {block.actions && block.actions.length > 0 && (
        <div className="space-y-3 pt-2">
          <h5 className="text-[11px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
            Important Actions
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {block.actions.map((action, idx) => (
              <div
                key={idx}
                className="p-3 bg-gray-50/50 dark:bg-gray-800/10 rounded-2xl border border-gray-100 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/20 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
                  <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                  <Highlight text={action.name} query={searchQuery} />
                </div>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-normal pl-4.5">
                  <Highlight text={action.description} query={searchQuery} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function HelpsContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openSectionId, setOpenSectionId] = useState<string | null>("step-1");
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Group sections by setup or reference
  const setupSections = useMemo(() => docSections.filter(s => s.group === 'setup'), []);
  const referenceSections = useMemo(() => docSections.filter(s => s.group === 'reference'), []);

  // Sync open accordion based on URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace("#", "");
        if (docSections.some(s => s.id === id)) {
          setOpenSectionId(id);
          // Wait for DOM to expand then scroll
          setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 150);
        }
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Filter sections and steps based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return docSections;

    const query = searchQuery.toLowerCase();
    return docSections
      .map(section => {
        // Match section titles/headings
        const headingMatches = section.title.toLowerCase().includes(query);
        
        // Match nested blocks components
        const matchingBlocks = section.blocks.filter(block => {
          return (
            (block.title && block.title.toLowerCase().includes(query)) ||
            block.purpose.toLowerCase().includes(query) ||
            block.steps.some(step => step.toLowerCase().includes(query)) ||
            (block.actions && block.actions.some(act => 
              act.name.toLowerCase().includes(query) || 
              act.description.toLowerCase().includes(query)
            ))
          );
        });

        if (headingMatches || matchingBlocks.length > 0) {
          return {
            ...section,
            // If heading matches but blocks don't, return all blocks, otherwise return filtered blocks
            blocks: headingMatches ? section.blocks : matchingBlocks
          };
        }

        return null;
      })
      .filter((s): s is Section => s !== null);
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  // Manual accordion row click handler
  const handleSectionClick = (id: string) => {
    let newId: string | null = null;
    if (openSectionId === id) {
      newId = null;
    } else {
      newId = id;
    }
    setOpenSectionId(newId);

    // Update URL hash anchor without triggering default jumps
    if (newId) {
      window.history.pushState(null, "", `#${newId}`);
      setTimeout(() => {
        const element = document.getElementById(newId!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // Remove hash
      window.history.pushState(null, "", window.location.pathname);
    }
  };

  const handleSuggestionClick = (term: string) => {
    setSearchQuery(term);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setOpenSectionId("step-1");
  };

  // Group filtered results for UI separation
  const filteredSetup = filteredSections.filter(s => s.group === 'setup');
  const filteredRef = filteredSections.filter(s => s.group === 'reference');

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40 dark:bg-gray-950 font-sans" ref={listContainerRef}>
      
      {/* 1. Header (Static Title Block) */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 pt-5 pb-6 px-6 sm:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-[960px] mx-auto relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 gradient-text pb-1">
            CallPilot Setup & Help Guide
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-relaxed max-w-3xl">
            Step-by-step instructions for setting up your CallPilot account: provisioning AI numbers, configuring your AI calls, connecting recruitment integrations, and reading transcript reports.
          </p>
        </div>
      </div>

      {/* 2. Pinned/Sticky Search Input Bar */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 py-4 px-6 sm:px-8">
        <div className="max-w-[960px] mx-auto relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-5 w-full rounded-2xl border border-gray-200 dark:border-gray-900 shadow-sm shadow-violet-500/10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent text-[13.5px]"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Accordion Content Area */}
      <div className="max-w-[960px] mx-auto px-6 sm:px-8 pt-3 pb-8 space-y-8">
        
        {filteredSections.length === 0 ? (
          /* Empty State */
          <Card className="p-12 text-center border-dashed border-2 border-gray-200 dark:border-gray-800 bg-white/80 backdrop-blur-xl dark:bg-white/5 rounded-2xl shadow-sm shadow-violet-500/10">
            <HelpCircle size={40} className="mx-auto text-gray-300 dark:text-gray-700 mb-3 animate-pulse" />
            <h3 className="text-[16px] font-bold text-gray-950 dark:text-white mb-1">No results for &ldquo;{searchQuery}&rdquo;</h3>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
              Try checking details, actions, or search recommendations below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[12px] text-gray-400 mr-1">Suggestions:</span>
              {["number", "billing", "ATS", "questions"].map((term) => (
                <button
                  key={term}
                  onClick={() => handleSuggestionClick(term)}
                  className="px-3 py-1 bg-gray-100 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-full text-[11px] font-semibold transition cursor-pointer border border-gray-200/50 dark:border-gray-700/50"
                >
                  &ldquo;{term}&rdquo;
                </button>
              ))}
            </div>
          </Card>
        ) : (
          /* Sections Render List */
          <div className="space-y-8">
            
            {/* SETUP GUIDE SECTION GROUP */}
            {filteredSetup.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pl-1">
                  Setup Guide
                </h3>
                <div className="space-y-3">
                  {filteredSetup.map((section) => {
                    const Icon = section.icon;
                    const isOpen = isSearching || openSectionId === section.id;
                    return (
                      <div
                        key={section.id}
                        id={section.id}
                        className="scroll-mt-28 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-xl dark:bg-white/5 shadow-sm shadow-violet-500/10 transition-all duration-200"
                      >
                        {/* Section Trigger (Min height 48px, whole row clickable) */}
                        <button
                          onClick={() => handleSectionClick(section.id)}
                          className={`w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left transition-all cursor-pointer ${
                            isOpen 
                              ? "bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-100 dark:border-gray-800" 
                              : "hover:bg-gray-50/50 dark:hover:bg-gray-800/10"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`p-1.5 rounded-lg border transition-colors ${
                              isOpen 
                                ? "bg-blue-100/50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400" 
                                : "bg-gray-50 border-gray-100 text-gray-500 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-400"
                            }`}>
                              <Icon size={16} />
                            </div>
                            <span className={`text-[14px] font-bold transition-colors ${
                              isOpen ? "text-gray-950 dark:text-white" : "text-gray-700 dark:text-gray-300"
                            }`}>
                              <Highlight text={section.title} query={searchQuery} />
                            </span>
                          </div>
                          
                          <ChevronDown 
                            size={16} 
                            className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`} 
                          />
                        </button>

                        {/* Accordion Expansion Container */}
                        {isOpen && (
                          <div className="p-6 space-y-8 bg-white dark:bg-gray-900">
                            {/* Warning notification for Step 1 pending review */}
                            {section.needsConfirmation && (
                              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl text-amber-800 dark:text-amber-300">
                                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                                <div className="text-[12.5px] leading-relaxed">
                                  <strong className="font-bold">Pending Confirmation:</strong> Please confirm exactly what this screen shows and does before publishing.
                                </div>
                              </div>
                            )}

                            {/* Render component blocks */}
                            <div className="space-y-8 divide-y divide-gray-100 dark:divide-gray-800/60">
                              {section.blocks.map((block, idx) => (
                                <HelpBlockComponent 
                                  key={idx} 
                                  block={block} 
                                  searchQuery={searchQuery} 
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* REFERENCE GUIDE SECTION GROUP */}
            {filteredRef.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200/60 dark:border-gray-800/60">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 pl-1">
                  Reference
                </h3>
                <div className="space-y-3">
                  {filteredRef.map((section) => {
                    const Icon = section.icon;
                    const isOpen = isSearching || openSectionId === section.id;
                    return (
                      <div
                        key={section.id}
                        id={section.id}
                        className="scroll-mt-28 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-xl dark:bg-white/5 shadow-sm shadow-violet-500/10 transition-all duration-200"
                      >
                        {/* Section Trigger */}
                        <button
                          onClick={() => handleSectionClick(section.id)}
                          className={`w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left transition-all cursor-pointer ${
                            isOpen 
                              ? "bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-100 dark:border-gray-800" 
                              : "hover:bg-gray-50/50 dark:hover:bg-gray-800/10"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`p-1.5 rounded-lg border transition-colors ${
                              isOpen 
                                ? "bg-blue-100/50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400" 
                                : "bg-gray-50 border-gray-100 text-gray-500 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-gray-400"
                            }`}>
                              <Icon size={16} />
                            </div>
                            <span className={`text-[14px] font-bold transition-colors ${
                              isOpen ? "text-gray-950 dark:text-white" : "text-gray-700 dark:text-gray-300"
                            }`}>
                              <Highlight text={section.title} query={searchQuery} />
                            </span>
                          </div>
                          
                          <ChevronDown 
                            size={16} 
                            className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`} 
                          />
                        </button>

                        {/* Accordion Expansion Container */}
                        {isOpen && (
                          <div className="p-6 space-y-8 bg-white dark:bg-gray-900">
                            {/* Render component blocks */}
                            <div className="space-y-8 divide-y divide-gray-100 dark:divide-gray-800/60">
                              {section.blocks.map((block, idx) => (
                                <HelpBlockComponent 
                                  key={idx} 
                                  block={block} 
                                  searchQuery={searchQuery} 
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
}
