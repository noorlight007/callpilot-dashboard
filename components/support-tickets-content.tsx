import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    ChevronLeft,
    Clock,
    Send,
    Loader2,
    Download,
    FileText,
    Image as ImageIcon,
    File
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';
import { profileService } from '@/services/profile-service';
import { toast } from "sonner";

interface Attachment {
    id: number;
    uid: string;
    created_at: string;
    updated_at: string;
    file: string;
}

interface TicketDetails {
    id: number;
    attachments: Attachment[];
    uid: string;
    created_at: string;
    updated_at: string;
    subject: string;
    category: string;
    message: string;
    status: string;
    organization: number;
}

const getStatusDetails = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'RESOLVED':
            return {
                label: 'Resolved',
                color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                dot: 'bg-green-500'
            };
        case 'PENDING':
            return {
                label: 'Pending',
                color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                dot: 'bg-orange-500'
            };
        case 'OPEN':
            return {
                label: 'Open',
                color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                dot: 'bg-blue-500'
            };
        default:
            return {
                label: status || 'Unknown',
                color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
                dot: 'bg-gray-500'
            };
    }
};

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

export function SupportTicketsContent() {
    const router = useRouter();
    const [tickets, setTickets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const response = await profileService.getSupportTickets();
                setTickets(response.data.results || []);
            } catch (error) {
                console.error("Error fetching support tickets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTickets();
    }, []);

    const handleTicketClick = async (uid: string) => {
        setIsDetailsLoading(true);
        setIsDetailsModalOpen(true);
        try {
            const response = await profileService.getTicketDetails(uid);
            setSelectedTicket(response.data);
        } catch (error) {
            console.error("Error fetching ticket details:", error);
            toast.error("Failed to fetch ticket details");
            setIsDetailsModalOpen(false);
        } finally {
            setIsDetailsLoading(false);
        }
    };

    const handleDownload = async (attachment: Attachment) => {
        setIsDownloading(attachment.uid);
        try {
            const response = await profileService.downloadAttachment(attachment.uid);

            // Extract filename from URL or use a default
            const url = attachment.file;
            const filename = url.substring(url.lastIndexOf('/') + 1) || `attachment-${attachment.id}`;

            // Create a temporary link and trigger download
            const blob = new Blob([response.data]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success("Download started");
        } catch (error) {
            console.error("Error downloading attachment:", error);
            toast.error("Failed to download attachment");
        } finally {
            setIsDownloading(null);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-transparent">
            <div className="max-w-[1100px] mx-auto py-10 px-4 sm:px-6 lg:px-8">
                {/* Back Link */}
                {/* <button
                    onClick={() => router.push('/dashboard/help')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-6 text-sm font-medium group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Help Center
                </button> */}

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-10 text-center sm:text-left">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg border dark: flex-shrink-0 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold gradient-text pb-1">Support Tickets</h1>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">View your ticket history or submit a new request</p>
                    </div>
                </div>

                {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-10"> */}
                    {/* Ticket History */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ticket History</h2>
                            <Button
                                onClick={() => router.push('/dashboard/help/support-tickets/create')}
                                className="bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white px-4 sm:px-8 lg:px-4 xl:px-6 py-6 rounded-2xl text-[13px] xl:text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                Write a Support Ticket
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                    <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                                    <p className="text-sm font-medium">Loading your tickets...</p>
                                </div>
                            ) : tickets.length > 0 ? (
                                tickets.map((ticket) => {
                                    const { label, color, dot } = getStatusDetails(ticket.status);
                                    return (
                                        <Card
                                            key={ticket.id}
                                            className="p-6 border-gray-100 dark:border-gray-800 shadow-sm shadow-violet-500/10 hover:shadow-md transition-shadow dark:bg-gray-900/50 cursor-pointer"
                                            onClick={() => handleTicketClick(ticket.uid)}
                                        >
                                            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-4">
                                                <div className="flex flex-wrap items-center gap-2.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TKT-{ticket.id}</span>
                                                    <Badge className={`px-2 py-0.5 rounded-full text-[10px] font-bold border-none ${color} flex items-center`}>
                                                        <div className={`w-1 h-1 rounded-full mr-1.5 ${dot}`} />
                                                        {label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-gray-400 text-[10px] sm:text-[11px] font-medium whitespace-nowrap">
                                                    <Clock size={12} />
                                                    {formatDate(ticket.created_at)}
                                                </div>
                                            </div>
                                            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                                                {ticket.subject}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">
                                                {ticket.message}
                                            </p>
                                        </Card>
                                    );
                                })
                            ) : (
                                <Card className="p-12 border-dashed border-2 border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center bg-transparent">
                                    <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 mb-6">
                                        <MessageSquare size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[300px] mb-8">
                                        You haven't submitted any support tickets yet. If you need help, feel free to write one.
                                    </p>
                                    <Button
                                        onClick={() => router.push('/dashboard/help/support-tickets/create')}
                                        variant="outline"
                                        className="rounded-2xl font-bold"
                                    >
                                        Write Your First Ticket
                                    </Button>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Action */}
                    {/* <div className="lg:col-span-1 space-y-6">
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
                    </div> */}
                {/* </div> */}
            </div>

            {/* Ticket Details Modal */}
            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none bg-white dark:bg-gray-950 rounded-3xl sm:rounded-3xl">
                    <DialogHeader className="px-8 pt-8 pb-4">
                        <DialogTitle className="flex items-center justify-between">
                            <span className="text-xl font-bold text-gray-900 dark:text-white">Ticket Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {isDetailsLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-950">
                            <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading details...</p>
                        </div>
                    ) : selectedTicket && (
                        <div className="px-8 pb-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-800 text-center sm:text-left">
                                <div className="space-y-1 w-full flex-grow">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">TKT-{selectedTicket.id}</span>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{selectedTicket.subject}</h2>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Badge className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border-none ${getStatusDetails(selectedTicket.status).color}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${getStatusDetails(selectedTicket.status).dot}`} />
                                        {getStatusDetails(selectedTicket.status).label}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div className="space-y-1.5">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <FileText size={12} />
                                        Category
                                    </span>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        {selectedTicket.category.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={12} />
                                        Submitted On
                                    </span>
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        {formatDate(selectedTicket.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Message</span>
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {selectedTicket.message}
                                    </p>
                                </div>
                            </div>

                            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                <div className="space-y-4 pt-2">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attachments ({selectedTicket.attachments.length})</span>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedTicket.attachments.map((attachment) => {
                                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.file);
                                            return (
                                                <div key={attachment.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-white/80 backdrop-blur-xl dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-blue-100 dark:hover:border-blue-900/30 transition-colors group gap-3 card-lift">
                                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                                        <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg dark:group-hover:bg-blue-900/20 group-hover: transition-colors shrink-0 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                                            {isImage ? <ImageIcon size={18} /> : <File size={18} />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate pr-1">
                                                                {attachment.file.substring(attachment.file.lastIndexOf('/') + 1)}
                                                            </p>
                                                            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">Added on {formatDate(attachment.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(attachment);
                                                        }}
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={isDownloading === attachment.uid}
                                                        className="h-9 w-full sm:w-9 rounded-2xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shrink-0 border border-gray-100 dark:border-gray-800 sm:border-none"
                                                    >
                                                        {isDownloading === attachment.uid ? (
                                                            <Loader2 size={16} className="animate-spin mr-2 sm:mr-0" />
                                                        ) : (
                                                            <Download size={16} className="mr-2 sm:mr-0" />
                                                        )}
                                                        <span className="sm:hidden text-xs font-bold">Download Attachment</span>
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
