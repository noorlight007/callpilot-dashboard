"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authService } from "@/services/auth-service";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setError("Email is required.");
            setShowErrorDialog(true);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authService.forgotPassword(email);
            const data = await response.json();

            if (response.ok && data.detail === "Password reset email sent.") {
                setShowSuccessDialog(true);
            } else {
                let errorMsg = "Failed to process request. Please try again.";
                if (data.detail) {
                    errorMsg = data.detail;
                } else if (typeof data === "object") {
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

    return (
        <div className="relative min-h-screen overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0 gradient-bg opacity-20 dark:opacity-30" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-violet/40 blur-3xl animate-float" aria-hidden="true" />
            <div className="pointer-events-none absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-brand-cyan/30 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-brand-pink/30 blur-3xl animate-float" style={{ animationDelay: "3s" }} aria-hidden="true" />
            <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                        {/* LEFT: centered video card (hidden on mobile) */}
                        <div className="hidden lg:block order-2 lg:order-1 animate-fade-up">
                            <div className="glass rounded-3xl overflow-hidden card-lift">
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

                        {/* RIGHT: forgot password card */}
                        <div className="order-1 lg:order-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
                            <div className="glass rounded-3xl">
                                <div className="p-5 sm:p-6 border-b border-border">
                                    <div className="flex items-center justify-between gap-4">
                                        <Link href="/" className="inline-flex items-center">
                                            <img
                                                src="/callpilot_logo.png"
                                                alt="CallPilot"
                                                className="h-20 sm:h-18 lg:h-20 w-auto"
                                            />
                                        </Link>
                                        <p className="text-sm text-muted-foreground">
                                            Remembered?{" "}
                                            <Link
                                                href="/login"
                                                className="font-medium text-headline hover:underline underline-offset-4 transition-colors"
                                            >
                                                Sign in
                                            </Link>
                                        </p>
                                    </div>

                                    <h1 className="mt-5 text-2xl sm:text-3xl font-extrabold gradient-text tracking-tight">
                                        Forgot Password
                                    </h1>
                                    <p className="mt-2 text-sm sm:text-base text-body">
                                        Enter your email to receive a password reset link.
                                    </p>
                                </div>

                                <div className="p-5 sm:px-6 sm:py-4">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="you@company.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full gradient-bg text-white border-0 shadow-lg shadow-brand-violet/30 hover:shadow-xl hover:-translate-y-0.5 focus-visible:ring-violet-400"
                                            size="lg"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? "Sending..." : "Send"}
                                        </Button>
                                    </form>

                                    <div className="mt-6 pt-5 border-t border-border text-center">
                                        <p className="text-xs text-muted-foreground">
                                            Back to{" "}
                                            <Link
                                                href="/login"
                                                className="underline underline-offset-4 hover:text-headline transition-colors"
                                            >
                                                Sign in
                                            </Link>
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
                            Password reset email sent.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => {
                            setShowSuccessDialog(false);
                            router.push("/login");
                        }}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Error</AlertDialogTitle>
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
