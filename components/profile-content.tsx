"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import { profileService } from "@/services/profile-service"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"

// Custom Toggle Component matching provided image
const CustomToggle = ({ checked, onChange, label, description }: { checked: boolean, onChange: (val: boolean) => void, label: string, description: string }) => {
    return (
        <div className="space-y-2">
            <Label className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                {label}
            </Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
            <button
                onClick={() => onChange(!checked)}
                className={`relative w-[70px] h-[28px] rounded-full transition-colors duration-200 flex items-center px-1.5 ${checked ? 'bg-[#56CCF2]' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
            >
                <span className={`text-[11px] font-semibold text-white uppercase transition-opacity duration-200 ${checked ? 'opacity-100 ml-0.5' : 'opacity-0'}`}>
                    ON
                </span>
                <div
                    className={`absolute w-[22px] h-[22px] bg-white rounded-full shadow-sm transform transition-transform duration-200 ${checked ? 'right-1' : 'left-1'
                        }`}
                />
            </button>
        </div>
    );
};

export function ProfileContent() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [initialProfile, setInitialProfile] = useState({
        first_name: "",
        last_name: "",
        email: "",
        is_otp_required: true
    })
    const [profile, setProfile] = useState({
        first_name: "",
        last_name: "",
        email: "",
        is_otp_required: true
    })
    const [passwords, setPasswords] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    })
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [activeTab, setActiveTab] = useState("Profile Details")
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

    const [alertConfig, setAlertConfig] = useState<{
        open: boolean
        title: string
        description: string[]
        variant: "default" | "destructive"
    }>({
        open: false,
        title: "",
        description: [],
        variant: "default"
    })

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            setIsLoading(true)
            const response = await profileService.getProfile()
            const data = response.data
            const profileData = {
                first_name: data.first_name || "",
                last_name: data.last_name || "",
                email: data.email || "",
                is_otp_required: data.is_otp_required !== undefined ? data.is_otp_required : true
            }
            setInitialProfile(profileData)
            setProfile(profileData)
        } catch (err: any) {
            console.error("Error fetching profile:", err)
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Failed to load profile data. Please try again later."],
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        // Partial Patch Logic
        const payload: any = {}
        if (profile.first_name !== initialProfile.first_name) payload.first_name = profile.first_name
        if (profile.last_name !== initialProfile.last_name) payload.last_name = profile.last_name
        if (profile.is_otp_required !== initialProfile.is_otp_required) payload.is_otp_required = profile.is_otp_required

        if (Object.keys(payload).length === 0) {
            setAlertConfig({
                open: true,
                title: "No Changes",
                description: ["No modifications detected to save."],
                variant: "default"
            })
            return
        }

        try {
            setIsSaving(true)
            const response = await profileService.updateProfile(payload)
            const updatedData = {
                first_name: response.data.first_name || profile.first_name,
                last_name: response.data.last_name || profile.last_name,
                email: profile.email,
                is_otp_required: response.data.is_otp_required !== undefined ? response.data.is_otp_required : profile.is_otp_required
            }
            setProfile(updatedData)
            setInitialProfile(updatedData)
            setAlertConfig({
                open: true,
                title: "Success",
                description: ["Profile updated successfully."],
                variant: "default"
            })
        } catch (err: any) {
            console.error("Error updating profile:", err)
            if (err.response?.data) {
                const errors = err.response.data
                const errorMessages: string[] = []
                Object.keys(errors).forEach((key) => {
                    if (Array.isArray(errors[key])) {
                        errorMessages.push(`${key}: ${errors[key][0]}`)
                    } else if (typeof errors[key] === 'string') {
                        errorMessages.push(`${key}: ${errors[key]}`)
                    }
                })
                setAlertConfig({
                    open: true,
                    title: "Update Failed",
                    description: errorMessages.length > 0 ? errorMessages : ["An unexpected error occurred."],
                    variant: "destructive"
                })
            } else {
                setAlertConfig({
                    open: true,
                    title: "Error",
                    description: ["Failed to update profile. Please try again."],
                    variant: "destructive"
                })
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
            setAlertConfig({
                open: true,
                title: "Validation Error",
                description: ["Please fill in all password fields."],
                variant: "destructive"
            })
            return
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            setAlertConfig({
                open: true,
                title: "Validation Error",
                description: ["New passwords do not match."],
                variant: "destructive"
            })
            return
        }

        try {
            setIsSaving(true)
            const response = await profileService.updatePassword({
                password: passwords.newPassword,
                old_password: passwords.currentPassword
            })

            setAlertConfig({
                open: true,
                title: "Success",
                description: ["Password updated successfully."],
                variant: "default"
            })
            setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" })
            setIsPasswordModalOpen(false)
        } catch (err: any) {
            console.error("Error updating password:", err)
            if (err.response?.data) {
                const errors = err.response.data
                const errorMessages: string[] = []
                Object.keys(errors).forEach((key) => {
                    if (Array.isArray(errors[key])) {
                        errorMessages.push(`${key === 'old_password' ? 'Current Password' : key}: ${errors[key][0]}`)
                    } else if (typeof errors[key] === 'string') {
                        errorMessages.push(`${key === 'old_password' ? 'Current Password' : key}: ${errors[key]}`)
                    }
                })
                setAlertConfig({
                    open: true,
                    title: "Update Failed",
                    description: errorMessages.length > 0 ? errorMessages : ["An unexpected error occurred during password update."],
                    variant: "destructive"
                })
            } else {
                setAlertConfig({
                    open: true,
                    title: "Error",
                    description: ["Failed to update password. Please try again."],
                    variant: "destructive"
                })
            }
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <main className="flex-1 overflow-y-auto bg-transparent p-4 md:p-8">
            <LoaderOverlay isLoading={isLoading || isSaving} />

            {/* Alert Dialog */}
            <AlertDialog open={alertConfig.open} onOpenChange={(open) => setAlertConfig(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={alertConfig.variant === "destructive" ? "text-destructive dark:text-red-400" : "dark:text-gray-100"}>
                            {alertConfig.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 dark:text-gray-400" asChild>
                            <div className="space-y-2">
                                {alertConfig.description.map((error, index) => (
                                    <div key={index} className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {error}
                                    </div>
                                ))}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setAlertConfig(prev => ({ ...prev, open: false }))} className="dark:bg-gray-100 dark:text-gray-900">
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Password Change Modal */}
            <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
                <DialogContent className="sm:max-w-[425px] dark:bg-gray-900 dark:border-gray-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold dark:text-gray-100">Change Password</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePasswordUpdate} className="space-y-6 pt-4">
                        {/* Current Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword" className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                                Current Password
                            </Label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={passwords.currentPassword}
                                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="newPassword" className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                                New Password
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Enter your new password</p>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                                Confirm Password
                            </Label>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Confirm your new password</p>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <DialogFooter className="pt-2 gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsPasswordModalOpen(false)}
                                className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="bg-[#1a1c1e] dark:bg-primary hover:bg-[#2a2c2e] dark:hover:bg-primary/90 text-white dark:text-white font-semibold px-8 rounded-lg transition-all duration-200"
                            >
                                Change Password
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="max-w-4xl mx-auto space-y-8">
                {/* Page Title */}
                <div>
                    <h1 className="text-2xl font-semibold gradient-text pb-1">Profile</h1>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTab("Profile Details")}
                        className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === "Profile Details" ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                    >
                        Profile Details
                        {activeTab === "Profile Details" && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900 dark:bg-gray-100" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("Security")}
                        className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${activeTab === "Security" ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                    >
                        Security
                        {activeTab === "Security" && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900 dark:bg-gray-100" />
                        )}
                    </button>
                </div>

                {/* Form Content */}
                <div className="max-w-md space-y-3 pt-2">
                    {activeTab === "Profile Details" ? (
                        <>
                            {/* First Name Field */}
                            <div className="space-y-1">
                                <Label htmlFor="first_name" className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                                    First Name
                                </Label>
                                {/* <p className="text-sm text-gray-500 dark:text-gray-400">Your first name</p> */}
                                <Input
                                    id="first_name"
                                    value={profile.first_name}
                                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent"
                                    placeholder="Enter your first name"
                                />
                            </div>

                            {/* Last Name Field */}
                            <div className="space-y-1">
                                <Label htmlFor="last_name" className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                                    Last Name
                                </Label>
                                {/* <p className="text-sm text-gray-500 dark:text-gray-400">Your last name</p> */}
                                <Input
                                    id="last_name"
                                    value={profile.last_name}
                                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent"
                                    placeholder="Enter your last name"
                                />
                            </div>

                            {/* Email Field */}
                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                                    Email address
                                </Label>
                                <p className="text-sm text-gray-500 dark:text-gray-400">This email is used for login and cannot be changed</p>
                                {/* <Input
                                    id="email"
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="h-11 rounded-2xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-transparent opacity-70"
                                /> */}
                                <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100 pt-2">
                                    {profile.email}
                                </p>
                            </div>
                            <hr className="border-black dark:border-white" />
                            {/* OTP Toggle Field */}
                            <CustomToggle
                                label="Two-Factor Authentication (2FA)"
                                description="Add an extra layer of security to your account during login"
                                checked={profile.is_otp_required}
                                onChange={(val) => setProfile({ ...profile, is_otp_required: val })}
                            />

                            {/* Save Button */}
                            <div className="pt-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-[#1a1c1e] dark:bg-primary hover:bg-[#2a2c2e] dark:hover:bg-primary/90 text-white dark:text-white font-semibold px-8 py-2.5 rounded-lg transition-all duration-200"
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="pt-2">
                            <Button
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="bg-[#1a1c1e] dark:bg-primary hover:bg-[#2a2c2e] dark:hover:bg-primary/90 text-white dark:text-white font-semibold px-8 py-2.5 rounded-lg transition-all duration-200"
                            >
                                Change Password
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
