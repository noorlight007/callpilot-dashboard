'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    MessageSquare,
    ChevronLeft,
    Send,
    Upload,
    X,
    Loader2,
    FilePlus,
    FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

import { profileService } from '@/services/profile-service';

const categories = [
    { label: "Connect ATS", value: "CONNECT_ATS" },
    { label: "Phone Number", value: "PHONE_NUMBER" },
    { label: "AI Call Builder", value: "AI_CALL_BUILDER" },
    { label: "Call Activity", value: "CALL_ACTIVITY" },
];

export function CreateSupportTicketContent() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        category: '',
        message: '',
    });
    const [attachments, setAttachments] = useState<any[]>([]);
    const [errorAlert, setErrorAlert] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: '',
        message: ''
    });

    useEffect(() => {
        const fetchExistingMedia = async () => {
            const storedIds = JSON.parse(localStorage.getItem('support_ticket_attachments_ids') || '[]');
            if (storedIds.length === 0) return;

            try {
                const response = await profileService.getSupportMedia();
                const allMedia = response.data.results;

                const existingAttachments = allMedia
                    .filter((m: any) => storedIds.includes(m.id))
                    .map((m: any) => {
                        const fileName = m.file.split('/').pop() || 'file';
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(m.file);
                        return {
                            tempId: m.uid,
                            uid: m.uid,
                            name: fileName,
                            size: 0,
                            isImage,
                            preview: isImage ? m.file : null,
                            loading: false,
                            remoteId: m.id
                        };
                    });

                setAttachments(existingAttachments);
            } catch (error) {
                console.error("Error fetching existing media:", error);
            }
        };

        fetchExistingMedia();
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const allowedExtensions = ['.pdf', '.docx', '.doc', '.ppt', '.png', '.jpg', '.jpeg'];

            for (const file of files) {
                const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

                if (allowedExtensions.includes(fileExtension)) {
                    await uploadFile(file);
                } else {
                    alert(`Invalid file type: ${file.name}. Allowed types: ${allowedExtensions.join(', ')}`);
                }
            }
            // Clear input so same file can be selected again if needed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const uploadFile = async (file: File) => {
        const tempId = Math.random().toString(36).substring(7);
        const isImage = file.type.startsWith('image/');

        // Add to state with loading status
        const newAttachment = {
            tempId,
            uid: null,
            file,
            name: file.name,
            size: file.size,
            isImage,
            preview: isImage ? URL.createObjectURL(file) : null,
            loading: true,
            remoteId: null
        };

        setAttachments(prev => [...prev, newAttachment]);

        try {
            const mediaData = new FormData();
            mediaData.append('file', file);

            const response = await profileService.uploadSupportMedia(mediaData);
            const remoteId = response.data.id;
            const serverFileUrl = response.data.file;
            const uid = response.data.uid;

            // Update localStorage with the new ID
            const storedIds = JSON.parse(localStorage.getItem('support_ticket_attachments_ids') || '[]');
            localStorage.setItem('support_ticket_attachments_ids', JSON.stringify([...storedIds, remoteId]));

            // Update state with remote ID and finish loading
            setAttachments(prev => prev.map(att =>
                att.tempId === tempId ? {
                    ...att,
                    loading: false,
                    remoteId,
                    uid,
                    preview: isImage ? serverFileUrl : att.preview
                } : att
            ));
        } catch (error) {
            console.error("Error uploading media:", error);
            setAttachments(prev => prev.filter(att => att.tempId !== tempId));
            alert(`Failed to upload ${file.name}`);
        }
    };

    const removeFile = async (tempId: string, remoteId: number | null, uid: string | null) => {
        setAttachments(prev => prev.filter(att => att.tempId !== tempId));

        if (remoteId) {
            const storedIds = JSON.parse(localStorage.getItem('support_ticket_attachments_ids') || '[]');
            localStorage.setItem('support_ticket_attachments_ids', JSON.stringify(storedIds.filter((id: number) => id !== remoteId)));
        }

        if (uid) {
            try {
                await profileService.deleteSupportMedia(uid);
            } catch (error) {
                console.error("Error deleting media from server:", error);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if any files are still uploading
        if (attachments.some(att => att.loading)) {
            alert("Please wait for all files to finish uploading.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Get organization ID
            const orgRes = await profileService.getOrganization();
            const orgId = orgRes.data.id;

            const attachmentsIds = JSON.parse(localStorage.getItem('support_ticket_attachments_ids') || '[]');

            const payload: any = {
                subject: formData.subject,
                category: formData.category,
                message: formData.message,
                organization: orgId,
                status: null,
                attachments_ids: attachmentsIds
            };

            await profileService.createSupportTicket(payload);

            // Clean up
            localStorage.removeItem('support_ticket_attachments_ids');
            attachments.forEach(att => {
                if (att.preview) URL.revokeObjectURL(att.preview);
            });

            router.push('/dashboard/help/support-tickets');
        } catch (error: any) {
            console.error("Error submitting ticket:", error);

            let errorMessage = "Failed to submit ticket. Please try again.";
            if (error.response?.data) {
                const data = error.response.data;
                const errors: string[] = [];
                Object.keys(data).forEach(key => {
                    const value = data[key];
                    errors.push(`${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
                });
                if (errors.length > 0) errorMessage = errors.join('\n');
            }

            setErrorAlert({
                open: true,
                title: "Submission Error",
                message: errorMessage
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-transparent">
            <div className="max-w-[800px] mx-auto py-10 px-4 sm:px-6">
                {/* Back Link */}
                <button
                    onClick={() => router.push('/dashboard/help/support-tickets')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-6 text-sm font-medium group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Tickets
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg border dark: text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold gradient-text pb-1">Create New Ticket</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Tell us about your issue and we'll help you out</p>
                    </div>
                </div>

                <Card className="p-8 border-gray-100 dark:border-gray-800 shadow-sm shadow-violet-500/10 dark:bg-gray-900/50 rounded-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Subject */}
                        <div className="space-y-1">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                placeholder="What's the issue about?"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                required
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-1">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData({ ...formData, category: value })}
                                required
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Message */}
                        <div className="space-y-1">
                            <Label htmlFor="message">Message</Label>
                            <Textarea
                                id="message"
                                placeholder="Please provide details about your issue..."
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                required
                                className="min-h-[150px] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                            />
                        </div>

                        {/* File Attachment */}
                        <div className="space-y-2">
                            <Label>File Attachment (Optional)</Label>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {attachments.map((att) => (
                                    <div key={att.tempId} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white/80 backdrop-blur-xl dark:bg-white/5">
                                        {att.preview ? (
                                            <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg flex items-center justify-center mb-2 text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                                    <FileText size={20} />
                                                </div>
                                                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate w-full px-2">
                                                    {att.name}
                                                </p>
                                            </div>
                                        )}

                                        {att.loading && (
                                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                                <Loader2 size={24} className="text-white animate-spin" />
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => removeFile(att.tempId, att.remoteId, att.uid)}
                                            className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-100 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover: group-hover:bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/40 shadow-lg dark:group-hover:bg-blue-900/20 transition-colors text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                        <FilePlus size={20} />
                                    </div>
                                    <p className="text-[11px] font-bold text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-wider">Attach</p>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".pdf,.docx,.doc,.ppt,.png,.jpg,.jpeg"
                                multiple
                            />

                            <p className="text-xs text-gray-400">
                                Multiple files allowed (.pdf, .doc, .docx, .ppt, .png, .jpg, .jpeg) up to 10MB each.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting || attachments.some(att => att.loading)}
                                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white rounded-2xl text-base font-semibold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Ticket
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>

            <AlertDialog open={errorAlert.open} onOpenChange={(open) => setErrorAlert({ ...errorAlert, open })}>
                <AlertDialogContent className="bg-white/80 backdrop-blur-xl dark:bg-white/5 border-gray-100 dark:border-gray-800 rounded-2xl max-w-[450px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/40 shadow-lg flex items-center justify-center text-white transition-transform duration-300 hover:scale-110 hover:-rotate-6">
                                <X size={18} />
                            </div>
                            {errorAlert.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 dark:text-gray-400 mt-4 whitespace-pre-wrap leading-relaxed">
                            {errorAlert.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8">
                        <AlertDialogAction className="bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 text-white rounded-2xl px-8 h-12 font-bold transition-all shadow-lg shadow-blue-500/20">
                            Got it
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
