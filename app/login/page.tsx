"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authService, cookieUtils } from "@/services/auth-service";
import { profileService } from "@/services/profile-service";

export default function SignInPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [step, setStep] = useState<"login" | "otp">("login");

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const accessToken = cookieUtils.get("access");
            const refreshTokenStr = cookieUtils.get("refresh");
            if (accessToken && refreshTokenStr) {
                await verifyAndRedirect(accessToken, refreshTokenStr);
            }
            setIsCheckingSession(false);
        };
        checkSession();
    }, []);

    const [showPassword, setShowPassword] = useState(false);

    const handleInputChange = (field: "email" | "password", value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const verifyAndRedirect = async (accessToken: string, refreshTokenStr: string) => {
        try {
            const verifyRes = await authService.verifyToken(accessToken);

            if (verifyRes.ok) {
                const statusRes = await profileService.getPlatformStatus();
                const complianceStatus = statusRes.data.compliance_status;
                if (complianceStatus !== "" && complianceStatus !== null && complianceStatus !== "rejected") {
                    router.push("/dashboard");
                } else {
                    router.push("/activation");
                }
                return;
            }

            const verifyData = await verifyRes.json();
            if (verifyData.code === "token_not_valid") {
                const refreshRes = await authService.refreshToken(refreshTokenStr);

                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    cookieUtils.set("access", refreshData.access, 7);
                    cookieUtils.set("refresh", refreshData.refresh, 7);
                    router.push("/activation");
                } else {
                    setStep("login");
                    cookieUtils.set("access", "", -1);
                    cookieUtils.set("refresh", "", -1);
                }
            }
        } catch (err) {
            console.error("Session verification failed", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await authService.login({
                ...formData,
                remember_me: rememberMe
            });
            const data = await response.json();

            if (response.ok) {
                if (data.otp_required) {
                    setShowSuccessDialog(true);
                } else {
                    // Directly login if OTP is not required
                    cookieUtils.set("access", data.access, 7);
                    cookieUtils.set("refresh", data.refresh, 7);

                    const statusRes = await profileService.getPlatformStatus();
                    const complianceStatus = statusRes.data.compliance_status;
                    if (complianceStatus !== "" && complianceStatus !== null && complianceStatus !== "rejected") {
                        router.push("/dashboard");
                    } else {
                        router.push("/activation");
                    }
                }
            } else {
                let errorMsg = "Something went wrong. Please try again.";
                if (typeof data === "object") {
                    errorMsg = Object.entries(data)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
                        .join("\n");
                }
                setError(errorMsg);
                setShowErrorDialog(true);
            }
        } catch (err) {
            setError("Failed to connect to the server. Please check your internet connection.");
            setShowErrorDialog(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await authService.verifyOtp(otp);
            const data = await response.json();

            if (response.ok) {
                cookieUtils.set("access", data.access, 7);
                cookieUtils.set("refresh", data.refresh, 7);
                await verifyAndRedirect(data.access, data.refresh);
            } else {
                let errorMsg = "OTP verification failed.";
                if (data.otp_code) {
                    errorMsg = Array.isArray(data.otp_code) ? data.otp_code.join(", ") : data.otp_code;
                } else if (data.detail) {
                    errorMsg = data.detail;
                }
                setError(errorMsg);
                setShowErrorDialog(true);
            }
        } catch (err) {
            setError("Failed to verify OTP. Please try again.");
            setShowErrorDialog(true);
        } finally {
            setIsLoading(false);
        }
    };

    // if (isCheckingSession) {
    //     return (
    //         <div className="flex items-center justify-center h-screen bg-white">
    //             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    //         </div>
    //     );
    // }

    return (
        <div className="min-h-screen bg-background">
            <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                        {/* LEFT: centered video card (hidden on mobile) */}
                        <div className="hidden lg:block order-2 lg:order-1">
                            <div className="rounded-2xl border border-border bg-card/40 shadow-sm overflow-hidden">
                                <div className="p-4 sm:p-5">
                                    <div className="relative w-full overflow-hidden rounded-xl bg-muted aspect-[4/4]">
                                        <video
                                            className="absolute inset-0 h-full w-full object-cover"
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            preload="metadata"
                                        >
                                            <source src="/videos/call_pilot_v.mp4" type="video/mp4" />
                                            Your browser does not support the video tag.
                                        </video>
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/25 via-transparent to-transparent" />
                                        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-border/30" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: sign-in card */}
                        <div className="order-1 lg:order-2">
                            <div className="rounded-2xl bg-card/40 shadow-sm">
                                <div className="p-5 sm:p-6 border-b border-border">
                                    <div className="flex items-center justify-between gap-4">
                                        <Link href="https://callpilot.pro/" className="inline-flex items-center gap-2 group">
                                            <ArrowLeft size={18} className="text-slate-900 dark:text-slate-100 stroke-[2.5] group-hover:-translate-x-0.5 transition-transform duration-200" />
                                            <span className="text-[#2563eb] dark:text-[#3b82f6] font-semibold text-[17px]">
                                                Website
                                            </span>
                                        </Link>

                                        {step === "login" && (
                                            <p className="text-sm text-muted-foreground">
                                                No account registered?{" "}
                                                <Link
                                                    href="https://callpilot.pro/get-started"
                                                    className="font-medium text-headline hover:underline underline-offset-4 transition-colors"
                                                >
                                                    Get Started
                                                </Link>
                                            </p>
                                        )}
                                    </div>

                                    <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-headline tracking-tight">
                                        {step === "login" ? "Sign in" : "Enter OTP"}
                                    </h1>
                                    <p className="mt-2 text-sm sm:text-base text-body">
                                        {step === "login"
                                            ? "Welcome back. Enter your credentials to continue."
                                            : "Please enter the OTP sent to your email to verify your identity."}
                                    </p>
                                </div>

                                <div className="p-5 sm:px-6 sm:py-4">
                                    {step === "login" ? (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="you@company.com"
                                                    value={formData.email}
                                                    onChange={(e) =>
                                                        handleInputChange("email", e.target.value)
                                                    }
                                                    required
                                                    autoComplete="email"
                                                    disabled={isLoading}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <Label htmlFor="password">Password</Label>
                                                    <Link
                                                        href="/forgot-password"
                                                        className="text-sm text-muted-foreground hover:text-headline transition-colors"
                                                    >
                                                        Forgot password?
                                                    </Link>
                                                </div>

                                                <div className="relative">
                                                    <Input
                                                        id="password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="••••••••"
                                                        value={formData.password}
                                                        onChange={(e) =>
                                                            handleInputChange("password", e.target.value)
                                                        }
                                                        required
                                                        autoComplete="current-password"
                                                        disabled={isLoading}
                                                        className="pr-10"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-headline transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="remember_me"
                                                    checked={rememberMe}
                                                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                                                    disabled={isLoading}
                                                />
                                                <Label
                                                    htmlFor="remember_me"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    Remember me for a month
                                                </Label>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full bg-black text-white hover:bg-gray-900"
                                                size="lg"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? "Signing in..." : "Sign in"}
                                            </Button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleOtpSubmit} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="otp">OTP Number</Label>
                                                <Input
                                                    id="otp"
                                                    type="text"
                                                    placeholder="Enter OTP"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    required
                                                    autoComplete="one-time-code"
                                                    disabled={isLoading}
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full bg-black text-white hover:bg-gray-900"
                                                size="lg"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? "Verifying..." : "Verify"}
                                            </Button>
                                        </form>
                                    )}

                                    <div className="mt-6 pt-5 border-t border-border text-center">
                                        <p className="text-xs text-muted-foreground">
                                            By signing in, you agree to our{" "}
                                            <Link
                                                href="https://callpilot.pro/terms-conditions"
                                                className="underline underline-offset-4 hover:text-headline transition-colors"
                                            >
                                                Terms
                                            </Link>{" "}
                                            and{" "}
                                            <Link
                                                href="https://callpilot.pro/privacy-policy"
                                                className="underline underline-offset-4 hover:text-headline transition-colors"
                                            >
                                                Privacy Policy
                                            </Link>
                                            .
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-6" />
                </div>
            </div>

            <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-primary">Success</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sign in successful. Please enter the OTP to continue.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => {
                            setShowSuccessDialog(false);
                            setStep("otp");
                        }}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Authentication Error</AlertDialogTitle>
                        <AlertDialogDescription className="whitespace-pre-wrap">
                            {error}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowErrorDialog(false)}>
                            Try Again
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
