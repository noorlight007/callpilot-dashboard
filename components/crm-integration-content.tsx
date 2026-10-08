'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Check, Phone, Plus, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cookieUtils } from "@/services/auth-service";
import { crmService, Platform } from "@/services/crm-service";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CRMIntegrationContent() {
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isIntegrating, setIsIntegrating] = useState(false);
    const [errorDialog, setErrorDialog] = useState<{ show: boolean; title: string; message: string }>({
        show: false,
        title: "",
        message: "",
    });
    const [successDialog, setSuccessDialog] = useState<{ show: boolean; title: string; message: string }>({
        show: false,
        title: "",
        message: "",
    });
    const [disconnectDialog, setDisconnectDialog] = useState<{ show: boolean; platform: Platform | null }>({
        show: false,
        platform: null,
    });
    
    // RecruitCRM specific integration states
    const [recruitCRMOpen, setRecruitCRMOpen] = useState(false);
    const [recruitCRMAccessToken, setRecruitCRMAccessToken] = useState("");
    const [isConnectingRecruitCRM, setIsConnectingRecruitCRM] = useState(false);
    const [recruitCRMPlatform, setRecruitCRMPlatform] = useState<Platform | null>(null);

    // Ashby specific integration states
    const [ashbyOpen, setAshbyOpen] = useState(false);
    const [ashbyApiKey, setAshbyApiKey] = useState("");
    const [isConnectingAshby, setIsConnectingAshby] = useState(false);
    const [ashbyPlatform, setAshbyPlatform] = useState<Platform | null>(null);



    const router = useRouter();
    const hasProcessedRef = useRef(false);

    const displayPlatforms = [
        {
            slug: "jobadder",
            name: "JobAdder",
            logo: "/jobadder.jpeg",
            isStatic: false,
        },
        {
            slug: "recruitcrm",
            name: "Recruit CRM",
            logo: "/recruitcrm.png",
            isStatic: false,
        },
        {
            slug: "greenhouse",
            name: "Greenhouse",
            logo: "/greenhouse.png",
            isStatic: false,
        },
        {
            slug: "ashby",
            name: "Ashby",
            logo: "/ashby-social-preview.png",
            isStatic: false,
        },
        {
            slug: "icims",
            name: "iCIMS",
            logo: "plug",
            isStatic: true,
            statusType: "coming-soon",
        },
        {
            slug: "sap-successfactors",
            name: "SAP SuccessFactors",
            logo: "plug",
            isStatic: true,
            statusType: "coming-soon",
        },
    ];

    const getDynamicPlatform = (slug: string) => {
        if (slug === "jobadder") return platforms.find(p => p.slug.startsWith("jobadder"));
        if (slug === "recruitcrm") return platforms.find(p => p.slug.startsWith("recruitcrm"));
        if (slug === "greenhouse") return platforms.find(p => p.name.toLowerCase() === "greenhouse" || p.slug.toLowerCase().includes("greenhouse"));
        if (slug === "ashby") return platforms.find(p => p.slug.startsWith("ashby"));
        return undefined;
    };

    useEffect(() => {
        fetchPlatforms();
        if (!hasProcessedRef.current) {
            checkOAuthCallback();
            hasProcessedRef.current = true;
        }
    }, []);

    const fetchPlatforms = async () => {
        try {
            setIsLoading(true);
            const authToken = cookieUtils.get("access");

            if (!authToken) {
                setErrorDialog({
                    show: true,
                    title: "Authentication Error",
                    message: "Authentication token not found. Please sign in again.",
                });
                setIsLoading(false);
                return;
            }

            const response = await crmService.fetchPlatforms(authToken);
            const data = await response.json();

            if (response.ok) {
                setPlatforms(data.results);
            } else {
                setErrorDialog({
                    show: true,
                    title: "Error",
                    message: data.message || "Failed to fetch platforms",
                });
            }
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Error",
                message: "An error occurred while fetching platforms",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const checkOAuthCallback = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const error = params.get("error");
            const errorDescription = params.get("error_description");

            if (error) {
                setErrorDialog({
                    show: true,
                    title: "Integration Error",
                    message: errorDescription || error || "Failed to complete integration",
                });
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }

            const code = params.get("code");
            const state = params.get("state");

            if (code) {
                setIsIntegrating(true);
                const authToken = cookieUtils.get("access");
                const platformSlug = localStorage.getItem("platformSlug") || state || "";
                const redirectUri = localStorage.getItem("redirectUri") || (window.location.origin + window.location.pathname);

                if (!authToken) {
                    setIsIntegrating(false);
                    return;
                }

                const isGreenhouse = state === "greenhouse" || platformSlug?.toLowerCase().includes("greenhouse");

                let response;
                if (isGreenhouse) {
                    response = await crmService.connectGreenhouseOAuth(authToken, {
                        code: code,
                        redirect_uri: redirectUri,
                    });
                } else {
                    response = await crmService.connectPlatform(authToken, {
                        code: code,
                        redirect_uri: redirectUri,
                        platform_slug: platformSlug || "jobadder",
                    });
                }

                const data = await response.json();

                if (response.ok) {
                    setSuccessDialog({
                        show: true,
                        title: "Success",
                        message: `Successfully integrated ${isGreenhouse ? "Greenhouse" : platformSlug}!`,
                    });
                    localStorage.removeItem("platformSlug");
                    localStorage.removeItem("redirectUri");
                    window.history.replaceState({}, document.title, window.location.pathname);
                    await fetchPlatforms();
                } else {
                    setErrorDialog({
                        show: true,
                        title: "Integration Error",
                        message: data.detail || data.platform_slug || data.message || "Failed to complete integration",
                    });
                }
            }
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Integration Error",
                message: "An error occurred while completing the integration",
            });
        } finally {
            setIsIntegrating(false);
        }
    };

    const handleConnectRecruitCRM = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recruitCRMAccessToken.trim()) return;

        try {
            setIsConnectingRecruitCRM(true);
            const authToken = cookieUtils.get("access");
            if (!authToken) {
                setErrorDialog({
                    show: true,
                    title: "Authentication Error",
                    message: "Authentication token not found. Please sign in again.",
                });
                return;
            }

            const response = await crmService.connectRecruitCRM(authToken, {
                access_token: recruitCRMAccessToken.trim(),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessDialog({
                    show: true,
                    title: "Success",
                    message: `Successfully integrated RecruitCRM!`,
                });
                setRecruitCRMOpen(false);
                setRecruitCRMAccessToken("");
                await fetchPlatforms();
            } else {
                setErrorDialog({
                    show: true,
                    title: "Integration Error",
                    message: data.detail || data.message || "Failed to complete RecruitCRM integration",
                });
            }
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Integration Error",
                message: "An error occurred while connecting RecruitCRM",
            });
        } finally {
            setIsConnectingRecruitCRM(false);
        }
    };

    const handleConnectAshby = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ashbyApiKey.trim()) return;

        try {
            setIsConnectingAshby(true);
            const authToken = cookieUtils.get("access");
            if (!authToken) {
                setErrorDialog({
                    show: true,
                    title: "Authentication Error",
                    message: "Authentication token not found. Please sign in again.",
                });
                return;
            }

            const response = await crmService.connectAshby(authToken, {
                access_token: ashbyApiKey.trim(),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccessDialog({
                    show: true,
                    title: "Success",
                    message: `Successfully integrated Ashby!`,
                });
                setAshbyOpen(false);
                setAshbyApiKey("");
                await fetchPlatforms();
            } else {
                setErrorDialog({
                    show: true,
                    title: "Integration Error",
                    message: data.detail || data.message || "Failed to complete Ashby integration",
                });
            }
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Integration Error",
                message: "An error occurred while connecting Ashby",
            });
        } finally {
            setIsConnectingAshby(false);
        }
    };



    const handleIntegrate = (platform: Platform) => {
        if (platform.slug.startsWith("recruitcrm")) {
            setRecruitCRMPlatform(platform);
            setRecruitCRMAccessToken("");
            setRecruitCRMOpen(true);
            return;
        }
        if (platform.slug.startsWith("ashby")) {
            setAshbyPlatform(platform);
            setAshbyApiKey("");
            setAshbyOpen(true);
            return;
        }
        try {
            let oauthUrl = "";
            if (platform.name.toLowerCase() === "greenhouse" || platform.slug.toLowerCase().includes("greenhouse")) {
                const greenhouseScope = platform.scope ? platform.scope.replace(/,/g, ' ') : '';
                oauthUrl = `${platform.base_url || "https://auth.greenhouse.io/authorize"}?response_type=code&client_id=${platform.client_id}&redirect_uri=${encodeURIComponent(platform.redirect_uri)}&scope=${encodeURIComponent(greenhouseScope)}&state=${platform.state}`;
            } else {
                oauthUrl = `${platform.base_url || "https://id.jobadder.com/"}connect/authorize?response_type=${platform.response_type || "code"}&client_id=${platform.client_id}&scope=${platform.scope}&redirect_uri=${platform.redirect_uri}&state=${platform.state}&prompt=login`;
            }

            localStorage.setItem("platformSlug", platform.slug);
            localStorage.setItem("redirectUri", platform.redirect_uri);

            window.location.href = oauthUrl;
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Error",
                message: "Failed to initiate integration",
            });
        }
    };

    const handleDisconnect = async () => {
        if (!disconnectDialog.platform || !disconnectDialog.platform.my_platform) return;

        try {
            setIsIntegrating(true);
            const authToken = cookieUtils.get("access");
            if (!authToken) throw new Error("No auth token");

            const response = await crmService.disconnectPlatform(authToken, disconnectDialog.platform.my_platform.uid);

            if (response.ok) {
                setSuccessDialog({
                    show: true,
                    title: "Success",
                    message: `Successfully disconnected ${disconnectDialog.platform.name}!`,
                });
                setDisconnectDialog({ show: false, platform: null });
                await fetchPlatforms();
            } else {
                const data = await response.json();
                setErrorDialog({
                    show: true,
                    title: "Disconnection Error",
                    message: data.detail || "Failed to disconnect platform",
                });
            }
        } catch (err) {
            setErrorDialog({
                show: true,
                title: "Error",
                message: "An error occurred while disconnecting the platform",
            });
        } finally {
            setIsIntegrating(false);
        }
    };

    return (
        <main className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
            {/* Success Dialog */}
            <AlertDialog open={successDialog.show} onOpenChange={(val) => setSuccessDialog({ ...successDialog, show: val })}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-primary dark:text-gray-100">{successDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-gray-400">{successDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setSuccessDialog({ ...successDialog, show: false })} className="dark:bg-100 dark:text-900">
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Error Dialog */}
            <AlertDialog open={errorDialog.show} onOpenChange={(val) => setErrorDialog({ ...errorDialog, show: val })}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive dark:text-red-400">{errorDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription className="whitespace-pre-wrap dark:text-gray-400">{errorDialog.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorDialog({ ...errorDialog, show: false })} className="dark:bg-gray-100 dark:text-gray-900">
                            Try Again
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Disconnect Confirmation Dialog */}
            <AlertDialog open={disconnectDialog.show} onOpenChange={(val) => setDisconnectDialog({ ...disconnectDialog, show: val })}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="dark:text-gray-100">Are you sure to disconnect Your {disconnectDialog.platform?.name} Account from Callpilot?</AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-gray-400">
                            This action will remove the integration and disable automation features for this platform.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDisconnectDialog({ show: false, platform: null })}
                            className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                            Cancel
                        </Button>
                        <AlertDialogAction
                            onClick={handleDisconnect}
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* RecruitCRM Connection Dialog */}
            <Dialog open={recruitCRMOpen} onOpenChange={setRecruitCRMOpen}>
                <DialogContent className="dark:bg-gray-900 dark:border-gray-800 sm:max-w-[480px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Connect RecruitCRM Account
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Please enter your RecruitCRM Access Token below to connect your account and enable automation features.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConnectRecruitCRM} className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Access Token <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                placeholder="Enter RecruitCRM Access Token"
                                value={recruitCRMAccessToken}
                                onChange={(e) => setRecruitCRMAccessToken(e.target.value)}
                                disabled={isConnectingRecruitCRM}
                                required
                                className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-700 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                        </div>
                        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRecruitCRMOpen(false)}
                                disabled={isConnectingRecruitCRM}
                                className="w-full sm:w-auto dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isConnectingRecruitCRM || !recruitCRMAccessToken.trim()}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 dark:bg-gray-100 text-white dark:text-gray-900 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 dark:hover:bg-gray-200 font-semibold flex items-center justify-center gap-2"
                            >
                                {isConnectingRecruitCRM ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        Connect Account
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Ashby Connection Dialog */}
            <Dialog open={ashbyOpen} onOpenChange={setAshbyOpen}>
                <DialogContent className="dark:bg-gray-900 dark:border-gray-800 sm:max-w-[480px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Connect Ashby Account
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Please enter your Ashby API Key below to connect your account and enable automation features.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConnectAshby} className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                API Key <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="text"
                                placeholder="Enter Ashby API Key"
                                value={ashbyApiKey}
                                onChange={(e) => setAshbyApiKey(e.target.value)}
                                disabled={isConnectingAshby}
                                required
                                className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl py-3 px-4 text-[15px] font-medium text-gray-900 dark:text-gray-100 focus-visible:ring-1 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-700 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                        </div>
                        <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAshbyOpen(false)}
                                disabled={isConnectingAshby}
                                className="w-full sm:w-auto dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isConnectingAshby || !ashbyApiKey.trim()}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 dark:bg-gray-100 text-white dark:text-gray-900 hover:from-blue-700 hover:to-violet-600 hover:-translate-y-0.5 dark:hover:bg-gray-200 font-semibold flex items-center justify-center gap-2"
                            >
                                {isConnectingAshby ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        Connect Account
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>



            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold gradient-text pb-1">Available ATS to Connect</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium">Manage your ATS integrations and settings</p>
                </div>

                {isLoading ? (
                    <div className="bg-white/80 backdrop-blur-xl dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm shadow-violet-500/10">
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="flex items-center justify-between p-6">
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="w-14 h-14 rounded-2xl dark:bg-gray-800" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-32 dark:bg-gray-800" />
                                            {(index === 0 || index === 2) && (
                                                <Skeleton className="h-4 w-16 dark:bg-gray-800" />
                                            )}
                                        </div>
                                    </div>
                                    <Skeleton className="h-10 w-28 rounded-2xl dark:bg-gray-800" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm shadow-violet-500/10">
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {[...displayPlatforms]
                                .sort((a, b) => {
                                    const aDynamic = getDynamicPlatform(a.slug);
                                    const bDynamic = getDynamicPlatform(b.slug);
                                    const aConnected = !a.isStatic && aDynamic?.is_connected ? 1 : 0;
                                    const bConnected = !b.isStatic && bDynamic?.is_connected ? 1 : 0;
                                    return bConnected - aConnected;
                                })
                                .map((p) => {
                                    const dynamicPlatform = getDynamicPlatform(p.slug);
                                    const isConnected = !p.isStatic && dynamicPlatform?.is_connected;
                                
                                return (
                                    <div key={p.slug} className="flex items-center justify-between p-6 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors duration-200">
                                        <div className="flex items-center gap-4">
                                            {/* Logo */}
                                            {p.slug === "jobadder" && (
                                                <div className="w-14 h-14 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm shadow-violet-500/10">
                                                    <img src="/jobadder.jpeg" alt="JobAdder" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            {p.slug === "recruitcrm" && (
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm shadow-violet-500/10 border border-gray-200 bg-[#286cb3]">
                                                    <img src="/recruitcrm.png" alt="Recruit CRM" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            {p.slug === "greenhouse" && (
                                                <div className="w-14 h-14 rounded-2xl bg-[#008F52] flex items-center justify-center flex-shrink-0 p-3 shadow-sm shadow-violet-500/10">
                                                    <img src="/greenhouse.png" alt="Greenhouse" className="w-full h-full object-contain brightness-0 invert" />
                                                </div>
                                            )}
                                            {p.slug === "ashby" && (
                                                <div className="w-14 h-14 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm shadow-violet-500/10">
                                                    <img src="/ashby-social-preview.png" alt="Ashby" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            {(p.slug === "icims" || p.slug === "sap-successfactors") && (
                                                <div className="w-14 h-14 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-center flex-shrink-0 shadow-sm shadow-violet-500/10">
                                                    <Plug className="w-6 h-6 text-gray-400 rotate-45" />
                                                </div>
                                            )}

                                            {/* Details */}
                                            <div className="flex flex-col">
                                                <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                                                {isConnected && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                                                        <span className="text-xs font-semibold text-[#10B981]">Live</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action / Status Badge */}
                                        <div>
                                            {p.isStatic ? (
                                                p.statusType === "in-progress" ? (
                                                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold text-[#B7791F] bg-[#FFF4E5] dark:text-amber-400 dark:bg-amber-950/30">
                                                        In Progress
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold text-[#475467] bg-[#F2F4F7] dark:text-gray-400 dark:bg-gray-800">
                                                        Coming Soon
                                                    </span>
                                                )
                                            ) : isConnected ? (
                                                <Button
                                                    onClick={() => setDisconnectDialog({ show: true, platform: dynamicPlatform || null })}
                                                    disabled={isIntegrating || isConnectingRecruitCRM || isConnectingAshby}
                                                    className="bg-[#EF4444] hover:bg-red-600 text-white font-semibold px-6 py-2.5 rounded-2xl transition-all duration-200 text-sm h-10 border-none flex items-center justify-center"
                                                >
                                                    Disconnect
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => dynamicPlatform && handleIntegrate(dynamicPlatform)}
                                                    disabled={isIntegrating || isConnectingRecruitCRM || isConnectingAshby || !dynamicPlatform}
                                                    className="bg-[#0062FF] hover:bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-2xl transition-all duration-200 text-sm h-10 border-none flex items-center justify-center"
                                                >
                                                    Connect to ATS
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
