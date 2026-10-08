"use client"

import { EmptyState, ListSkeleton } from '@/components/ui/empty-state'
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    Search,
    X,
    ChevronDown,
    ChevronUp,
    Star,
    Bookmark,
    Info,
    List,
    Grid,
    ArrowDownWideNarrow,
    ArrowUpWideNarrow,
    Plus,
    Loader2,
    CheckCircle2,
    Settings2,
    BookMarked
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BASE_URL } from "@/lib/baseUrl";
import { cookieUtils } from "@/services/auth-service";
import { toast } from "sonner"

interface FilterTag {
    id: string
    label: string
    type: "search" | "category"
    value: string
}

interface FlowResult {
    id: number;
    uid: string;
    name: string;
    picture: string;
    call_direction: string;
    flow_category: string;
    flow_summary: string;
    how_works: string[];
    applicable_crms: string[];
    required_resources: string[];
    code: string;
    status: string;
    is_connected: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
    "Appointment & Booking Automation": "appointment_booking",
    "Lead & Applicant Qualification": "lead_applicant",
    "Compliance & Document Collection": "compliance_document",
    "Contact Centre Automation": "contact_centre",
    "Local Authority / Public Sector": "local_authority",
    "Other": "other"
};

export function AICallFlowOptionsContent() {
    const router = useRouter()
    const [titleSearch, setTitleSearch] = useState("")
    const [appliedSearch, setAppliedSearch] = useState("")
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])

    // Toggle states for sidebar filters
    const [isTitleNameExpanded, setIsTitleNameExpanded] = useState(true)
    const [isTitleTypeExpanded, setIsTitleTypeExpanded] = useState(true)

    // Derived state for global expand/collapse
    const isAllExpanded = isTitleNameExpanded && isTitleTypeExpanded

    const toggleAll = () => {
        const newState = !isAllExpanded
        setIsTitleNameExpanded(newState)
        setIsTitleTypeExpanded(newState)
    }

    const activeTags: FilterTag[] = [
        ...(appliedSearch ? [{ id: "search", label: `Categories/Types name: "${appliedSearch}"`, type: "search", value: appliedSearch } as FilterTag] : []),
        ...selectedCategories.map(cat => ({ id: `cat-${cat}`, label: cat, type: "category", value: cat } as FilterTag))
    ]

    const titleTypes = Object.keys(CATEGORY_MAP);

    const [results, setResults] = useState<FlowResult[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchAvailableFlows = async (searchQuery: string, categories: string[]) => {
        setIsLoading(true);
        try {
            const token = cookieUtils.get("access");
            const params = new URLSearchParams();
            if (searchQuery) {
                params.append("search", searchQuery);
            }
            categories.forEach(cat => {
                const slug = CATEGORY_MAP[cat];
                if (slug) {
                    params.append("flow_category", slug);
                }
            });

            const queryStr = params.toString();
            const url = `${BASE_URL}/flows/available-flow/${queryStr ? `?${queryStr}` : ""}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setResults(data.results || []);
            }
        } catch (error) {
            console.error("Error fetching available flows:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAvailableFlows("", []);
    }, []);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setAppliedSearch(titleSearch);
            fetchAvailableFlows(titleSearch, selectedCategories);
        }
    };

    const toggleCategory = (category: string) => {
        const newCategories = selectedCategories.includes(category)
            ? selectedCategories.filter(c => c !== category)
            : [...selectedCategories, category];

        setSelectedCategories(newCategories);
        fetchAvailableFlows(appliedSearch, newCategories);
    };

    const removeTag = (tag: FilterTag) => {
        if (tag.type === "search") {
            setTitleSearch("");
            setAppliedSearch("");
            fetchAvailableFlows("", selectedCategories);
        } else if (tag.type === "category") {
            const newCategories = selectedCategories.filter(c => c !== tag.value);
            setSelectedCategories(newCategories);
            fetchAvailableFlows(appliedSearch, newCategories);
        }
    };

    const handleViewDetails = (flow: FlowResult) => {
        router.push(`/dashboard/ai-call-flow-options/${flow.uid}`);
    };



    // Filter out flows that are already connected
    const availableResults = results.filter(flow => !flow.is_connected);

    return (
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-4 md:p-6">
            <div className="max-w-[1200px] mx-auto space-y-6">
                <div className="flex flex-row justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-bold tracking-tight gradient-text">Callpillot Flow Store</h1>
                    </div>
                </div>

                {/* Active Tags */}
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {activeTags.map(tag => (
                        <div key={tag.id} className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-full text-sm font-medium">
                            {tag.label}
                            <X
                                className="w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                onClick={() => removeTag(tag)}
                            />
                        </div>
                    ))}
                </div>

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Search filters</h1>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleAll}
                            className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 text-sm bg-gray-50/50 dark:bg-gray-900/50 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {isAllExpanded ? (
                                <>Collapse all <ChevronUp className="w-4 h-4" /></>
                            ) : (
                                <>Expand all <ChevronDown className="w-4 h-4" /></>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="flex items-center gap-2">
                            <button className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 text-sm bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-100 dark:border-white/10">
                                Show Bookmarks
                            </button>
                            <button className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 text-sm bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-100 dark:border-white/10">
                                Rating <ArrowUpWideNarrow className="w-4 h-4" /><ArrowDownWideNarrow className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
                    {/* Sidebar Filters */}
                    <aside className="space-y-6 glass rounded-2xl p-6 animate-fade-up h-fit">
                        {/* Title Name Filter */}
                        <div className="space-y-3">
                            <div
                                className="flex items-center justify-between cursor-pointer group"
                                onClick={() => setIsTitleNameExpanded(!isTitleNameExpanded)}
                            >
                                <h3 className="font-semibold text-sm">Categories/Types name</h3>
                                {isTitleNameExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                                )}
                            </div>
                            {isTitleNameExpanded && (
                                <Input
                                    placeholder="Search by name"
                                    value={titleSearch}
                                    onChange={(e) => setTitleSearch(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    className="h-10 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                />
                            )}
                        </div>

                        <div className="border-b border-gray-200 dark:border-white" />

                        {/* Title Type Filter */}
                        <div className="space-y-3">
                            <div
                                className="flex items-center justify-between cursor-pointer group"
                                onClick={() => setIsTitleTypeExpanded(!isTitleTypeExpanded)}
                            >
                                <h3 className="font-semibold text-sm">Call flow Categories/Types</h3>
                                {isTitleTypeExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                                )}
                            </div>
                            {isTitleTypeExpanded && (
                                <div className="flex flex-wrap gap-2">
                                    {titleTypes.map(type => {
                                        const isSelected = selectedCategories.includes(type)
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => toggleCategory(type)}
                                                className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 transition-colors ${isSelected
                                                    ? "bg-blue-600 border-blue-600 text-white"
                                                    : "bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400"
                                                    }`}
                                            >
                                                {type}
                                                {isSelected && <X className="w-3 h-3" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Main Results Container */}
                    <div className="space-y-4 glass rounded-2xl p-6 animate-fade-up min-h-[400px]">
                        {isLoading ? (
                            <ListSkeleton rows={4} />
                        ) : availableResults.length === 0 ? (
                            <EmptyState title="No flows found" description="Try adjusting your filters." />
                        ) : (
                            availableResults.map(flow => (
                                <div key={flow.id} className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex shadow-sm hover:shadow-md transition-shadow">
                                    {/* Flow Info */}
                                    <div className="p-4 flex-1 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4 items-start">
                                                {/* Image on left side of title */}
                                                <div className="w-20 h-28 border border-indigo-100 dark:border-white/10 rounded-xl shadow-md shadow-indigo-500/10 overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                                                    <img src={flow.picture} alt={flow.name} className="w-full h-full object-fixed" />
                                                </div>

                                                <div className="space-y-1">
                                                    <h2 className="text-lg font-semibold group-hover:text-blue-600 cursor-pointer">
                                                        {flow.name}
                                                    </h2>
                                                    <div className="flex items-center gap-3 text-sm text-gray-500 font-medium capitalize">
                                                        <span>{flow.call_direction}</span>
                                                        <Info size={14} className="cursor-help" />
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-gray-500 font-medium uppercase text-xs tracking-wider">
                                                        <span>{flow.flow_category.replace(/_/g, ' ')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleViewDetails(flow)}
                                                className="p-2 px-6 hover:bg-blue-700 rounded text-white bg-blue-600 dark:bg-blue-600 transition-colors font-medium"
                                            >
                                                View
                                            </button>
                                        </div>

                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-normal line-clamp-2 mt-2">
                                            {flow.flow_summary}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>


        </main>
    )
}
