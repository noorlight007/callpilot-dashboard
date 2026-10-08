"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { profileService } from "@/services/profile-service"
import { LoaderOverlay } from "@/components/auth/loader-overlay"
import { Search, ChevronsUpDown, Check, ClipboardCheck, Phone, Globe } from "lucide-react"
import countriesData from "@/lib/countries.json";
import { getCountryCode } from "@/app/actions";
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
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function OrganizationContent() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [initialOrg, setInitialOrg] = useState({
        name: "",
        uid: "",
        business_name: "",
        reg_number: "",
        country: "United Kingdom",
        street_address: "",
        apt_or_suite: "",
        city: "",
        post_code: "",
        province: "",
        business_registration_certificate: null as File | null,
        proof_of_address: null as File | null,
        reg_address: "",
        town: "",
        vat_number: "",
        state: "",
        billing_contact_name: "",
        billing_email_address: "",
        is_submitted_for_verification: false,
        existing_certificate_url: "",
        existing_proof_url: "",
        country_iso_code: "",
        business_registration_authority: "",
        business_website: "",
        authorize_representative_first_name: "",
        authorize_representative_last_name: "",
        authorize_representative_email: "",
        authorize_representative_phone: "",
        compliance_status: ""
    })
    const [org, setOrg] = useState({
        name: "",
        uid: "",
        business_name: "",
        reg_number: "",
        country: "United Kingdom",
        street_address: "",
        apt_or_suite: "",
        city: "",
        post_code: "",
        province: "",
        business_registration_certificate: null as File | null,
        proof_of_address: null as File | null,
        reg_address: "",
        town: "",
        vat_number: "",
        state: "",
        billing_contact_name: "",
        billing_email_address: "",
        is_submitted_for_verification: false,
        existing_certificate_url: "",
        existing_proof_url: "",
        country_iso_code: "",
        business_registration_authority: "",
        business_website: "",
        authorize_representative_first_name: "",
        authorize_representative_last_name: "",
        authorize_representative_email: "",
        authorize_representative_phone: "",
        compliance_status: ""
    })
    const [editOrg, setEditOrg] = useState({ ...org })
    const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false)
    const [isComplianceAgreed, setIsComplianceAgreed] = useState(false)
    const [isPhoneBillingModalOpen, setIsPhoneBillingModalOpen] = useState(false)
    const [isPhoneBillingAgreed, setIsPhoneBillingAgreed] = useState(false)

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
    const [countrySearch, setCountrySearch] = useState("");
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [isAuthorityOpen, setIsAuthorityOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const authorityDropdownRef = useRef<HTMLDivElement>(null);

    const [countries] = useState<{ country: string, country_code: string, phone_code: string }[]>(countriesData);
    const [isPhoneCodeOpen, setIsPhoneCodeOpen] = useState(false);
    const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
    const [selectedPhoneCode, setSelectedPhoneCode] = useState("");
    const phoneCodeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchOrganization()

        // Initialize country code
        const initCountryCode = async () => {
            if (selectedPhoneCode) return; // Don't overwrite if already set (e.g. by fetchOrganization)
            const code = await getCountryCode();
            if (code) {
                const country = countriesData.find(c => c.country_code === code);
                if (country) {
                    const phoneCode = country.phone_code.startsWith("+") ? country.phone_code : `+${country.phone_code}`;
                    setSelectedPhoneCode(phoneCode);
                } else {
                    setSelectedPhoneCode("+44"); // Default
                }
            } else {
                setSelectedPhoneCode("+44"); // Default
            }
        };
        initCountryCode();
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsCountryOpen(false);
            }
            if (authorityDropdownRef.current && !authorityDropdownRef.current.contains(event.target as Node)) {
                setIsAuthorityOpen(false);
            }
            if (phoneCodeDropdownRef.current && !phoneCodeDropdownRef.current.contains(event.target as Node)) {
                setIsPhoneCodeOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredCountries = countries.filter(c =>
        c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.country_code.toLowerCase().includes(countrySearch.toLowerCase()) ||
        (c.phone_code && c.phone_code.includes(countrySearch))
    );

    const filteredPhoneCountries = countries.filter(c =>
        c.country.toLowerCase().includes(phoneCodeSearch.toLowerCase()) ||
        c.country_code.toLowerCase().includes(phoneCodeSearch.toLowerCase()) ||
        (c.phone_code && c.phone_code.includes(phoneCodeSearch))
    );

    const fetchOrganization = async () => {
        try {
            setIsLoading(true)
            const response = await profileService.getOrganization()
            const data = response.data
            let phoneVal = data.authorize_representative_phone || "";
            if (phoneVal.startsWith("+")) {
                const sortedCountries = [...countriesData].sort((a, b) => {
                    const codeA = a.phone_code.startsWith("+") ? a.phone_code.length : a.phone_code.length + 1;
                    const codeB = b.phone_code.startsWith("+") ? b.phone_code.length : b.phone_code.length + 1;
                    return codeB - codeA;
                });
                for (const c of sortedCountries) {
                    const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                    if (phoneVal.startsWith(code)) {
                        setSelectedPhoneCode(code);
                        phoneVal = phoneVal.slice(code.length);
                        break;
                    }
                }
            }

            const orgData = {
                name: data.name || "",
                uid: data.uid || "",
                business_name: data.business_name || data.name || "",
                reg_number: data.reg_number || "",
                country: data.country || "United Kingdom",
                street_address: data.street_address || "",
                apt_or_suite: data.apt_or_suite || "",
                city: data.city || "",
                post_code: data.post_code || "",
                province: data.province || "",
                business_registration_certificate: null,
                proof_of_address: null,
                reg_address: data.reg_address || "",
                town: data.town || "",
                vat_number: data.vat_number || "",
                state: data.state || "",
                billing_contact_name: data.billing_contact_name || "",
                billing_email_address: data.billing_email_address || "",
                is_submitted_for_verification: data.is_submitted_for_verification || false,
                existing_certificate_url: data.business_registration_certificate || "",
                existing_proof_url: data.proof_of_address || "",
                country_iso_code: data.country_iso_code || "",
                business_registration_authority: data.business_registration_authority || "",
                business_website: data.business_website || "",
                authorize_representative_first_name: data.authorize_representative_first_name || "",
                authorize_representative_last_name: data.authorize_representative_last_name || "",
                authorize_representative_email: data.authorize_representative_email || "",
                authorize_representative_phone: phoneVal,
                compliance_status: data.compliance_status || ""
            }
            setInitialOrg(orgData)
            setOrg(orgData)
            setEditOrg(orgData)
        } catch (err: any) {
            console.error("Error fetching organization:", err)
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Failed to load organization data."],
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = () => {
        setEditOrg({ ...org })
    }

    const handleSave = async () => {
        const hasBusinessCert = !!editOrg.business_registration_certificate || (!!editOrg.existing_certificate_url && editOrg.existing_certificate_url !== "");
        const hasProofOfAddress = !!editOrg.proof_of_address || (!!editOrg.existing_proof_url && editOrg.existing_proof_url !== "");

        if (!hasBusinessCert || !hasProofOfAddress) {
            setAlertConfig({
                open: true,
                title: "Missing Documents",
                description: ["You are required to provide the following documents to verify your business."],
                variant: "destructive"
            });
            return;
        }

        const formData = new FormData();

        let phone = editOrg.authorize_representative_phone;
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }

        const fullPhone = phone.startsWith("+")
            ? phone
            : `${selectedPhoneCode}${phone}`;

        const finalData = {
            business_name: editOrg.business_name,
            reg_number: editOrg.reg_number,
            country: editOrg.country,
            street_address: editOrg.street_address,
            apt_or_suite: editOrg.apt_or_suite,
            city: editOrg.city,
            post_code: editOrg.post_code,
            province: editOrg.province,
            country_iso_code: editOrg.country_iso_code,
            business_registration_authority: editOrg.business_registration_authority,
            business_website: editOrg.business_website,
            authorize_representative_first_name: editOrg.authorize_representative_first_name,
            authorize_representative_last_name: editOrg.authorize_representative_last_name,
            authorize_representative_email: editOrg.authorize_representative_email,
            authorize_representative_phone: fullPhone,
            name: editOrg.business_name, // Mandatory match
            is_submitted_for_verification: "true" // Explicitly mark for verification
        };

        Object.keys(finalData).forEach(key => {
            const value = finalData[key as keyof typeof finalData];
            if (value !== null && value !== undefined) {
                formData.append(key, value as string);
            }
        });

        if (editOrg.business_registration_certificate instanceof File) {
            formData.append("business_registration_certificate", editOrg.business_registration_certificate);
        }
        if (editOrg.proof_of_address instanceof File) {
            formData.append("proof_of_address", editOrg.proof_of_address);
        }

        try {
            setIsSaving(true)
            await profileService.updateOrganization(formData)

            // Re-fetch to update all data including potential API-side name adjustments
            fetchOrganization()

            setAlertConfig({
                open: true,
                title: "Success",
                description: ["Organization updated successfully."],
                variant: "default"
            })
        } catch (err: any) {
            console.error("Error updating organization:", err)
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
                    description: ["Failed to update organization. Please try again."],
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

            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white/80 backdrop-blur-xl dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm shadow-violet-500/10 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center flex-wrap gap-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Business Details</h2>
                        {editOrg.compliance_status === "pending" && (
                            <span className="text-lg font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                                Waiting for verification
                            </span>
                        )}
                        {editOrg.compliance_status === "approved" && (
                            <span className="text-lg font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-1.5 rounded-full border border-green-200 dark:border-green-800">
                                Verified
                            </span>
                        )}
                    </div>
                    {(editOrg.compliance_status === "pending" || editOrg.is_submitted_for_verification) && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-2xl flex items-center gap-3 m-4">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                Verification in progress.
                            </p>
                        </div>
                    )}
                    <div className="p-8 space-y-12">
                        {(() => {
                            const country = editOrg.country;
                            const isNZ = country === "New Zealand";
                            const isUK = country === "United Kingdom";
                            const isSG = country === "Singapore";
                            const isAU = country === "Australia";
                            const isIE = country === "Ireland" || country === "Irreland";
                            const isQuickSubmit = ["Canada", "India", "United States of America", "Unitend States of America"].includes(country);
                            const isDefault = !isNZ && !isUK && !isSG && !isAU && !isIE && !isQuickSubmit;

                            return (
                                <div className="space-y-10 animate-in fade-in duration-300">
                                    {/* Business Information Section */}
                                    {(isNZ || isUK || isSG || isIE || isDefault) && (
                                        <div className="space-y-6">
                                            <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Business Information</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Registered Business Name</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.business_name || "N/A"}</p>
                                                </div>
                                                
                                                {(isUK || isIE || isDefault) && (
                                                    <>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Business Registration Number</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.reg_number || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Business Website</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.business_website || "N/A"}</p>
                                                        </div>
                                                    </>
                                                )}
                                                {(isUK || isDefault) && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Business Registration Authority</p>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.business_registration_authority || "N/A"}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Authorized Representative Section */}
                                    {(isUK || isIE || isDefault) && (
                                        <div className="space-y-6">
                                            <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Authorized Representative</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">First Name</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.authorize_representative_first_name || "N/A"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Last Name</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.authorize_representative_last_name || "N/A"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Email Address</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.authorize_representative_email || "N/A"}</p>
                                                </div>
                                                {(isUK || isDefault) && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Phone Number</p>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedPhoneCode} {editOrg.authorize_representative_phone || "N/A"}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Registered Business Address Section */}
                                    {(isNZ || isUK || isAU || isIE || isDefault) && (
                                        <div className="space-y-6">
                                            <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Registered Business Address</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                                                {!isDefault ? (
                                                    <>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Customer Name</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                {isUK 
                                                                    ? `${editOrg.authorize_representative_first_name} ${editOrg.authorize_representative_last_name}`.trim() || editOrg.business_name
                                                                    : editOrg.business_name || "N/A"
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Friendly Name</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">My {country} Address</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Street</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.street_address || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">APT/Suite</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.apt_or_suite || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">City</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.city || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Region / State</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.province || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Postal Code</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.post_code || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Country Code</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.country_iso_code || "N/A"}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Street Address</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.street_address || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">APT/Suite</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.apt_or_suite || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Town / City</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.city || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">State</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.province || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Postcode / ZIP</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.post_code || "N/A"}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Country</p>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.country || "N/A"}</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Submit Details (Canada, India, USA) */}
                                    {isQuickSubmit && (
                                        <div className="space-y-6">
                                            <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Country Identification</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Selected Country</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.country || "N/A"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Country ISO Code</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{editOrg.country_iso_code || "N/A"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Supporting Documents Section */}
                                    {(isNZ || isDefault) && (
                                        <div className="space-y-6">
                                            <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Supporting Documents</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-800/20 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Business Registration Certificate</p>
                                                    {editOrg.existing_certificate_url ? (
                                                        <a
                                                            href={editOrg.existing_certificate_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5"
                                                        >
                                                            View Submitted Certificate
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm font-semibold text-gray-400">No certificate uploaded</p>
                                                    )}
                                                </div>
                                                {isDefault && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Proof of Address</p>
                                                        {editOrg.existing_proof_url ? (
                                                            <a
                                                                href={editOrg.existing_proof_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5"
                                                            >
                                                                View Submitted Proof
                                                            </a>
                                                        ) : (
                                                            <p className="text-sm font-semibold text-gray-400">No proof uploaded</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                            <Button
                                onClick={() => router.back()}
                                variant="outline"
                                className="dark:bg-gray-800 dark:text-gray-100 border-none"
                            >
                                Back
                            </Button>
                        </div> */}
                    </div>
                </div>
            </div>

                <div className="flex justify-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                    <p>
                        Need help?{" "}
                        <Link
                            href="/dashboard/help/support-tickets"
                            className="text-primary hover:underline font-medium"
                        >
                            Contact Support.
                        </Link>
                    </p>
                </div>

            <Dialog open={isComplianceModalOpen} onOpenChange={setIsComplianceModalOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto dark:bg-gray-950 dark:border-gray-800 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                    <DialogHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                        <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <ClipboardCheck className="text-primary" />
                            CallPilot Compliance
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-8 py-6">
                        <div className="space-y-6">
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Terms & Conditions</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I confirm that I have read, understood, and agree to the Terms & Conditions.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I confirm that I have read and agree to the Privacy Policy, including how personal data is collected, processed, and stored.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Acknowledgement</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I understand that CallPilot uses artificial intelligence to initiate, manage, and respond to phone calls, WhatsApp messages, SMS communications, and other automated interactions.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Disclosure Responsibility</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I confirm that I will clearly disclose the use of AI when interacting with individuals, where required by applicable laws and regulations.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Legal & Regulatory Compliance</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I confirm that I will use CallPilot in full compliance with all applicable laws and regulations in the jurisdictions in which I operate, including but not limited to:</p>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-1">
                                    <li>Data protection and privacy laws (e.g. UK GDPR, EU GDPR, CCPA or equivalent)</li>
                                    <li>Employment and recruitment legislation</li>
                                    <li>Electronic communications and marketing regulations</li>
                                </ul>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">User Responsibility</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium text-justify">I acknowledge that I am solely responsible for how CallPilot is used within my organisation, including: Lawful use of personal data, Compliance with all applicable laws, Ensuring communications are accurate, appropriate, and compliant.</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-2">CallPilot and its operators accept no liability for misuse of the platform.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Usage & Communication Standards</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I agree that I will not use CallPilot to:</p>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-1">
                                    <li>Send unsolicited or unlawful communications (including spam)</li>
                                    <li>Harass, mislead, or deceive individuals</li>
                                    <li>Conduct unlawful recruitment or employment practices</li>
                                    <li>Distribute offensive, abusive, or inappropriate content</li>
                                </ul>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Data Rights & Consent</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I confirm that I have the legal right and lawful basis to process any personal data submitted into CallPilot, including obtaining consent where required under applicable law.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Audit & Compliance Record</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">I understand that my acceptance of these terms may be recorded, including date, time, IP address, and user details, for compliance, audit, and legal purposes.</p>
                            </section>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center">
                                By proceeding, you confirm that you have read, understood, and agree to all of the above requirements, as well as our full Terms & Conditions and Privacy Policy
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isPhoneBillingModalOpen} onOpenChange={setIsPhoneBillingModalOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto dark:bg-gray-950 dark:border-gray-800 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                    <DialogHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                        <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Phone className="text-primary" />
                            Phone Number Compliance
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-8 py-6">
                        <div className="space-y-6">
                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">How AI CallPilot Numbers Work</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                                    CallPilot assigns phone numbers based on your location and compliance requirements:
                                </p>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-2">
                                    <li>
                                        <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mt-4">
                                            <img src="https://flagcdn.com/w40/us.png" alt="US Flag" className="w-5 h-3.5 object-cover rounded-sm" />
                                            United States:
                                        </span>
                                        <br />A dedicated phone number is purchased and assigned immediately for compliance with US telecommunication regulations.
                                    </li>
                                    <li>
                                        <span className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mt-4">
                                            <Globe className="w-4 h-4 text-primary" />
                                            Other Countries:
                                        </span>
                                        <br />A temporary number may be assigned during setup while your dedicated number is provisioned.
                                    </li>
                                </ul>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Number Pricing</h3>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-1">
                                    <li>Dedicated phone numbers are charged at $15 per month, per number</li>
                                    <li>Charges begin once a permanent number is assigned to your account</li>
                                </ul>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">What This Means</h3>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-1">
                                    <li>Your temporary number is fully functional</li>
                                    <li>Your permanent number will be assigned shortly</li>
                                    <li>No interruption to your service</li>
                                    <li>All activity remains linked to your account</li>
                                </ul>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your Responsibility</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">You are responsible for ensuring that:</p>
                                <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 font-medium space-y-1">
                                    <li>Calls and messages comply with local telecommunication laws</li>
                                    <li>Appropriate caller identification is used where required</li>
                                </ul>
                            </section>

                            <section className="space-y-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Global Compliance Advantage</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                                    CallPilot automatically manages global phone number allocation and compliance, allowing your business to operate across multiple regions without complexity.
                                </p>
                            </section>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center">
                                By proceeding, you confirm that you understand and agree to how CallPilot handles phone number assignment and billing.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </main>
    )
}
