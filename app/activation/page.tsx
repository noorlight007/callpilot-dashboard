"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { profileService } from "@/services/profile-service";
import { LoaderOverlay } from "@/components/auth/loader-overlay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronsUpDown, Check, Lock, CheckCircle2, Building2, ClipboardCheck, Phone, LogOut, X, Globe } from "lucide-react";
import { cookieUtils, authService } from '@/services/auth-service';
import countriesData from "@/lib/countries.json";
import axios from "axios";
import { getCountryCode } from "@/app/actions";
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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ActivationPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(true);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const accessToken = cookieUtils.get('access');
            const refreshToken = cookieUtils.get('refresh');

            if (!accessToken || !refreshToken) {
                router.push('/login');
                return;
            }

            try {
                const verifyRes = await authService.verifyToken(accessToken);
                if (verifyRes.ok) {
                    const statusRes = await profileService.getPlatformStatus();
                    const complianceStatus = statusRes.data.compliance_status;
                    if (complianceStatus !== "" && complianceStatus !== null && complianceStatus !== "rejected") {
                        router.push('/dashboard');
                        return;
                    }
                    setIsAuthenticated(true);
                } else {
                    const refreshRes = await authService.refreshToken(refreshToken);
                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        cookieUtils.set('access', data.access, 7);
                        cookieUtils.set('refresh', data.refresh, 7);

                        const statusRes = await profileService.getPlatformStatus();
                        const complianceStatus = statusRes.data.compliance_status;
                        if (complianceStatus !== "" && complianceStatus !== null && complianceStatus !== "rejected") {
                            router.push('/dashboard');
                            return;
                        }
                        setIsAuthenticated(true);
                    } else {
                        router.push('/login');
                    }
                }
            } catch (err) {
                router.push('/login');
            }
        };

        checkAuth();
    }, [router]);
    const [isSaving, setIsSaving] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isCustomerNameModified, setIsCustomerNameModified] = useState(false);
    const [isFriendlyNameModified, setIsFriendlyNameModified] = useState(false);

    const clearValidationError = (key: string) => {
        if (validationErrors[key]) {
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const scrollToFirstError = (errors: Record<string, string>) => {
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
            const element = document.getElementById(firstErrorKey);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                element.focus();
            }
        }
    };

    useEffect(() => {
        setValidationErrors({});
    }, [currentStep]);
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
        country_iso_code: "GB",
        business_registration_authority: "",
        business_website: "",
        authorize_representative_first_name: "",
        authorize_representative_last_name: "",
        authorize_representative_email: "",
        authorize_representative_phone: ""
    });
    const [australiaAddress, setAustraliaAddress] = useState({
        CustomerName: "",
        Street: "",
        StreetSecondary: "",
        City: "",
        Region: "",
        PostalCode: "",
        IsoCountry: "AU",
        FriendlyName: ""
    });
    const [twilioDetails, setTwilioDetails] = useState<{ subaccount_sid: string, auth_token: string } | null>(null);
    const [irelandEndUser, setIrelandEndUser] = useState({
        business_name: "",
        business_website: "",
        business_registration_number: "",
        first_name: "",
        last_name: "",
        email: "",
        business_registration_identifier: "UK:CRN",
        phone_number: ""
    });
    const [initialOrg, setInitialOrg] = useState({ ...org });
    const [singaporeBusinessName, setSingaporeBusinessName] = useState("");

    const loadCountryData = (countryName: string) => {
        if (!countryName) return;
        const step1 = localStorage.getItem(`activation_${countryName}_step1`);
        const step2 = localStorage.getItem(`activation_${countryName}_step2`);
        const step3 = localStorage.getItem(`activation_${countryName}_step3`);
        const step4 = localStorage.getItem(`activation_${countryName}_step4`);

        // If no cached data exists at all for this country, reset to initial fetched organization details
        if (!step1 && !step2 && !step3 && !step4) {
            setOrg({
                ...initialOrg,
                country: countryName,
                country_iso_code: countriesData.find(c => c.country === countryName)?.country_code || ""
            });
            setAustraliaAddress({
                CustomerName: "",
                Street: "",
                StreetSecondary: "",
                City: "",
                Region: "",
                PostalCode: "",
                IsoCountry: countriesData.find(c => c.country === countryName)?.country_code || "",
                FriendlyName: ""
            });
            setIrelandEndUser({
                business_name: initialOrg.business_name || initialOrg.name || "",
                business_website: initialOrg.business_website || "",
                business_registration_number: initialOrg.reg_number || "",
                first_name: initialOrg.authorize_representative_first_name || "",
                last_name: initialOrg.authorize_representative_last_name || "",
                email: initialOrg.authorize_representative_email || "",
                business_registration_identifier: initialOrg.business_registration_authority || "UK:CRN",
                phone_number: initialOrg.authorize_representative_phone || ""
            });
            setSingaporeBusinessName("");
            return;
        }

        // If cached data exists, load it
        if (step1) {
            const data = JSON.parse(step1);
            setOrg(prev => ({ ...prev, ...data }));
        } else {
            setOrg(prev => ({
                ...prev,
                country: countryName,
                country_iso_code: countriesData.find(c => c.country === countryName)?.country_code || ""
            }));
        }

        if (step2) {
            const data = JSON.parse(step2);
            if (countryName === "Australia") {
                setAustraliaAddress(prev => ({ ...prev, ...data }));
            } else if (countryName === "Singapore") {
                setSingaporeBusinessName(data.singapore_business_name || data.business_name || "");
            } else if (countryName === "New Zealand") {
                setIrelandEndUser(prev => ({ ...prev, business_name: data.business_name || "" }));
            } else if (["Ireland", "United Kingdom"].includes(countryName)) {
                setIrelandEndUser(prev => ({ ...prev, ...data }));
                if (countryName === "United Kingdom" && data.phone_number) {
                    let phone = data.phone_number;
                    if (phone.startsWith("+")) {
                        const sortedCountries = [...countriesData].sort((a, b) => b.phone_code.length - a.phone_code.length);
                        for (const c of sortedCountries) {
                            const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                            if (phone.startsWith(code)) {
                                setUkSelectedPhoneCode(code);
                                phone = phone.slice(code.length);
                                break;
                            }
                        }
                    }
                    setIrelandEndUser(prev => ({ ...prev, phone_number: phone }));
                }
            } else {
                setOrg(prev => ({ ...prev, ...data }));
            }
        } else {
            // Reset step 2 fields if no cache
            if (countryName === "Australia") {
                setAustraliaAddress(prev => ({
                    ...prev,
                    CustomerName: "",
                    Street: "",
                    StreetSecondary: "",
                    City: "",
                    Region: "",
                    PostalCode: "",
                    IsoCountry: countriesData.find(c => c.country === countryName)?.country_code || "",
                    FriendlyName: ""
                }));
            } else if (countryName === "Singapore") {
                setSingaporeBusinessName("");
            } else if (countryName === "New Zealand") {
                setIrelandEndUser(prev => ({ ...prev, business_name: "" }));
            } else if (["Ireland", "United Kingdom"].includes(countryName)) {
                setIrelandEndUser({
                    business_name: initialOrg.business_name || initialOrg.name || "",
                    business_website: initialOrg.business_website || "",
                    business_registration_number: initialOrg.reg_number || "",
                    first_name: initialOrg.authorize_representative_first_name || "",
                    last_name: initialOrg.authorize_representative_last_name || "",
                    email: initialOrg.authorize_representative_email || "",
                    business_registration_identifier: initialOrg.business_registration_authority || "UK:CRN",
                    phone_number: initialOrg.authorize_representative_phone || ""
                });
            } else {
                setOrg(prev => ({
                    ...prev,
                    business_name: initialOrg.business_name || "",
                    reg_number: initialOrg.reg_number || "",
                    business_registration_authority: initialOrg.business_registration_authority || "",
                    business_website: initialOrg.business_website || "",
                    street_address: initialOrg.street_address || "",
                    apt_or_suite: initialOrg.apt_or_suite || "",
                    city: initialOrg.city || "",
                    post_code: initialOrg.post_code || "",
                    province: initialOrg.province || ""
                }));
            }
        }

        if (step3) {
            const data = JSON.parse(step3);
            if (["Ireland", "United Kingdom", "New Zealand"].includes(countryName)) {
                setAustraliaAddress(prev => ({ ...prev, ...data }));
            } else {
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
                setOrg(prev => ({
                    ...prev,
                    authorize_representative_first_name: data.authorize_representative_first_name || "",
                    authorize_representative_last_name: data.authorize_representative_last_name || "",
                    authorize_representative_email: data.authorize_representative_email || "",
                    authorize_representative_phone: phoneVal
                }));
            }
        } else {
            // Reset step 3 fields if no cache
            if (["Ireland", "United Kingdom", "New Zealand"].includes(countryName)) {
                setAustraliaAddress(prev => ({
                    ...prev,
                    CustomerName: "",
                    Street: "",
                    StreetSecondary: "",
                    City: "",
                    Region: "",
                    PostalCode: "",
                    IsoCountry: countriesData.find(c => c.country === countryName)?.country_code || "",
                    FriendlyName: ""
                }));
            } else {
                let phoneVal = initialOrg.authorize_representative_phone || "";
                if (phoneVal.startsWith("+")) {
                    const sortedCountries = [...countriesData].sort((a, b) => b.phone_code.length - a.phone_code.length);
                    for (const c of sortedCountries) {
                        const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                        if (phoneVal.startsWith(code)) {
                            setSelectedPhoneCode(code);
                            phoneVal = phoneVal.slice(code.length);
                            break;
                        }
                    }
                }
                setOrg(prev => ({
                    ...prev,
                    authorize_representative_first_name: initialOrg.authorize_representative_first_name || "",
                    authorize_representative_last_name: initialOrg.authorize_representative_last_name || "",
                    authorize_representative_email: initialOrg.authorize_representative_email || "",
                    authorize_representative_phone: phoneVal
                }));
            }
        }
    };

    const getCountryPatchData = (countryName: string) => {
        const step1 = JSON.parse(localStorage.getItem(`activation_${countryName}_step1`) || "{}");
        const step2 = JSON.parse(localStorage.getItem(`activation_${countryName}_step2`) || "{}");
        const step3 = JSON.parse(localStorage.getItem(`activation_${countryName}_step3`) || "{}");
        const step4 = JSON.parse(localStorage.getItem(`activation_${countryName}_step4`) || "{}");

        let patchData: any = {
            country: countryName,
            country_iso_code: step1.country_iso_code || org.country_iso_code || countriesData.find(c => c.country === countryName)?.country_code || "",
        };

        if (countryName === "Australia") {
            const street = step2.Street || australiaAddress.Street || "";
            const secondary = step2.StreetSecondary || australiaAddress.StreetSecondary || "";
            const street_address = secondary ? `${street}, ${secondary}` : street;

            patchData = {
                ...patchData,
                business_name: step2.CustomerName || australiaAddress.CustomerName || org.business_name,
                street_address: street_address,
                apt_or_suite: secondary,
                city: step2.City || australiaAddress.City || "",
                province: step2.Region || australiaAddress.Region || "",
                post_code: step2.PostalCode || australiaAddress.PostalCode || "",
            };
        } else if (countryName === "Singapore") {
            patchData = {
                ...patchData,
                business_name: step2.singapore_business_name || singaporeBusinessName || org.business_name,
            };
        } else if (countryName === "New Zealand") {
            const street = step3.Street || australiaAddress.Street || "";
            const secondary = step3.StreetSecondary || australiaAddress.StreetSecondary || "";
            const street_address = secondary ? `${street}, ${secondary}` : street;

            patchData = {
                ...patchData,
                business_name: step2.business_name || irelandEndUser.business_name || org.business_name,
                street_address: street_address,
                apt_or_suite: secondary,
                city: step3.City || australiaAddress.City || "",
                province: step3.Region || australiaAddress.Region || "",
                post_code: step3.PostalCode || australiaAddress.PostalCode || "",
            };
        } else if (["Ireland", "United Kingdom"].includes(countryName)) {
            const street = step3.Street || australiaAddress.Street || "";
            const secondary = step3.StreetSecondary || australiaAddress.StreetSecondary || "";
            const street_address = secondary ? `${street}, ${secondary}` : street;

            const rep_phone = step2.phone_number || irelandEndUser.phone_number || "";
            const fullPhone = rep_phone.startsWith("+")
                ? rep_phone
                : (countryName === "United Kingdom"
                    ? `${ukSelectedPhoneCode}${rep_phone}`
                    : rep_phone);

            patchData = {
                ...patchData,
                business_name: step2.business_name || irelandEndUser.business_name || org.business_name,
                business_website: step2.business_website || irelandEndUser.business_website || "",
                reg_number: step2.business_registration_number || irelandEndUser.business_registration_number || "",
                business_registration_authority: step2.business_registration_identifier || irelandEndUser.business_registration_identifier || "",
                authorize_representative_first_name: step2.first_name || irelandEndUser.first_name || "",
                authorize_representative_last_name: step2.last_name || irelandEndUser.last_name || "",
                authorize_representative_email: step2.email || irelandEndUser.email || "",
                authorize_representative_phone: fullPhone,
                street_address: street_address,
                apt_or_suite: secondary,
                city: step3.City || australiaAddress.City || "",
                province: step3.Region || australiaAddress.Region || "",
                post_code: step3.PostalCode || australiaAddress.PostalCode || "",
            };
        } else {
            patchData = {
                ...patchData,
                business_name: step2.business_name || org.business_name,
                reg_number: step2.reg_number || org.reg_number,
                business_registration_authority: step2.business_registration_authority || org.business_registration_authority,
                business_website: step2.business_website || org.business_website,
                street_address: step2.street_address || org.street_address,
                apt_or_suite: step2.apt_or_suite || org.apt_or_suite,
                city: step2.city || org.city,
                province: step2.province || org.province,
                post_code: step2.post_code || org.post_code,
                authorize_representative_first_name: step3.authorize_representative_first_name || org.authorize_representative_first_name,
                authorize_representative_last_name: step3.authorize_representative_last_name || org.authorize_representative_last_name,
                authorize_representative_email: step3.authorize_representative_email || org.authorize_representative_email,
                authorize_representative_phone: step3.authorize_representative_phone || org.authorize_representative_phone,
            };
        }

        if (patchData.business_name) {
            patchData.name = patchData.business_name;
        }

        return patchData;
    };

    useEffect(() => {
        if (org.country !== "United Kingdom") {
            setIsCustomerNameModified(false);
        }
        setIsFriendlyNameModified(false);
        setIsComplianceAgreed(false);
        setIsPhoneBillingAgreed(false);
        loadCountryData(org.country);
    }, [org.country]);

    const clearActivationData = (countryName?: string) => {
        const keys = [
            "activation_step1",
            "activation_step2",
            "activation_step3",
            "activation_step4",
            "regulation_sid",
            "bundleSid",
            "endUserSid",
            "country",
            "country_iso_code",
            "twilio_subaccount_sid",
            "nz_business_name",
            "nz_address_sid"
        ];
        keys.forEach(key => localStorage.removeItem(key));

        if (countryName) {
            localStorage.removeItem(`activation_${countryName}_step1`);
            localStorage.removeItem(`activation_${countryName}_step2`);
            localStorage.removeItem(`activation_${countryName}_step3`);
            localStorage.removeItem(`activation_${countryName}_step4`);
        }
    };

    const [alertConfig, setAlertConfig] = useState<{
        open: boolean;
        title: string;
        description: string[];
        variant: "default" | "destructive";
    }>({
        open: false,
        title: "",
        description: [],
        variant: "default"
    });
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

    const [countrySearch, setCountrySearch] = useState("");
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [isAuthorityOpen, setIsAuthorityOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const authorityDropdownRef = useRef<HTMLDivElement>(null);
    const [countries] = useState<{ country: string, country_code: string, phone_code: string }[]>(countriesData);
    const [isUKPhoneCodeOpen, setIsUKPhoneCodeOpen] = useState(false);
    const [ukPhoneCodeSearch, setUkPhoneCodeSearch] = useState("");
    const [ukSelectedPhoneCode, setUkSelectedPhoneCode] = useState("");
    const [isPhoneCodeOpen, setIsPhoneCodeOpen] = useState(false);
    const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
    const [selectedPhoneCode, setSelectedPhoneCode] = useState("");
    const ukPhoneCodeDropdownRef = useRef<HTMLDivElement>(null);
    const phoneCodeDropdownRef = useRef<HTMLDivElement>(null);

    const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
    const [isComplianceAgreed, setIsComplianceAgreed] = useState(false);
    const [isPhoneBillingModalOpen, setIsPhoneBillingModalOpen] = useState(false);
    const [isPhoneBillingAgreed, setIsPhoneBillingAgreed] = useState(false);

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFileType, setPreviewFileType] = useState<string | null>(null);
    const [previewFileName, setPreviewFileName] = useState("");



    useEffect(() => {
        const step1 = localStorage.getItem("activation_step1");
        const step2 = localStorage.getItem("activation_step2");
        if (step1) {
            const data = JSON.parse(step1);
            setOrg(prev => ({ ...prev, ...data }));
        }
        if (step2) {
            const data = JSON.parse(step2);
            setOrg(prev => ({ ...prev, ...data }));
        }
        const step3 = localStorage.getItem("activation_step3");
        if (step3) {
            const data = JSON.parse(step3);
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
            setOrg(prev => ({ ...prev, authorize_representative_phone: phoneVal }));
        }
        const step4 = localStorage.getItem("activation_step4");
        if (step4) {
            const data = JSON.parse(step4);
            // setOrg(prev => ({ ...prev, ...data }));
        }
        fetchOrganization();

        // Initialize country code
        const initCountryCode = async () => {
            if (selectedPhoneCode) return;
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
        // Initialize UK phone code
        const initUKPhoneCode = async () => {
            if (ukSelectedPhoneCode) return;
            const country = countriesData.find(c => c.country === "United Kingdom");
            if (country) {
                const phoneCode = country.phone_code.startsWith("+") ? country.phone_code : `+${country.phone_code}`;
                setUkSelectedPhoneCode(phoneCode);
            } else {
                setUkSelectedPhoneCode("+44");
            }
        };
        initUKPhoneCode();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsCountryOpen(false);
            }
            if (authorityDropdownRef.current && !authorityDropdownRef.current.contains(event.target as Node)) {
                setIsAuthorityOpen(false);
            }
            if (phoneCodeDropdownRef.current && !phoneCodeDropdownRef.current.contains(event.target as Node)) {
                setIsPhoneCodeOpen(false);
            }
            if (ukPhoneCodeDropdownRef.current && !ukPhoneCodeDropdownRef.current.contains(event.target as Node)) {
                setIsUKPhoneCodeOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchOrganization = async () => {
        try {
            setIsLoading(true);
            const response = await profileService.getOrganization();
            const data = response.data;
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
                country_iso_code: data.country_iso_code || "GB",
                business_registration_authority: data.business_registration_authority || "",
                business_website: data.business_website || "",
                authorize_representative_first_name: data.authorize_representative_first_name || "",
                authorize_representative_last_name: data.authorize_representative_last_name || "",
                authorize_representative_email: data.authorize_representative_email || "",
                authorize_representative_phone: phoneVal
            };
            setOrg(orgData);
            setInitialOrg(orgData);

            const countryName = orgData.country;
            const hasCachedData = localStorage.getItem(`activation_${countryName}_step1`) ||
                localStorage.getItem(`activation_${countryName}_step2`) ||
                localStorage.getItem(`activation_${countryName}_step3`) ||
                localStorage.getItem(`activation_${countryName}_step4`);
            if (hasCachedData) {
                loadCountryData(countryName);
            }
            //     business_name: data.business_name || data.name || "",
            //     business_website: data.business_website || "",
            //     business_registration_number: data.reg_number || "",
            //     first_name: data.authorize_representative_first_name || "",
            //     last_name: data.authorize_representative_last_name || "",
            //     email: data.authorize_representative_email || "",
            //     business_registration_identifier: data.business_registration_authority || "UK:CRN",
            //     phone_number: phoneVal
            // });
        } catch (err: any) {
            console.error("Error fetching organization:", err);
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Failed to load organization data."],
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle stripping country code when returning to Step 3 via "Previous"
    useEffect(() => {
        if (currentStep === 3 && org.authorize_representative_phone.startsWith("+")) {
            let phoneVal = org.authorize_representative_phone;
            const sortedCountries = [...countriesData].sort((a, b) => {
                const codeA = a.phone_code.startsWith("+") ? a.phone_code.length : a.phone_code.length + 1;
                const codeB = b.phone_code.startsWith("+") ? b.phone_code.length : b.phone_code.length + 1;
                return codeB - codeA;
            });
            for (const c of sortedCountries) {
                const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                if (phoneVal.startsWith(code)) {
                    setSelectedPhoneCode(code);
                    const stripped = phoneVal.slice(code.length);
                    setOrg(prev => ({ ...prev, authorize_representative_phone: stripped }));
                    break;
                }
            }
        }
    }, [currentStep, org.authorize_representative_phone]);

    const handleNextStep1 = async () => {
        if (!org.country) {
            const newErrors = { country: "Please select your country." };
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        localStorage.setItem(`activation_${org.country}_step1`, JSON.stringify({
            country: org.country,
            country_iso_code: org.country_iso_code
        }));
        localStorage.setItem("activation_step1", JSON.stringify({
            country: org.country,
            country_iso_code: org.country_iso_code
        }));

        if (["India", "Canada", "United States of America"].includes(org.country)) {
            handleQuickSubmit();
            return;
        }

        setAustraliaAddress(prev => ({
            ...prev,
            IsoCountry: org.country_iso_code,
            FriendlyName: org.country === "Australia" && (!isFriendlyNameModified || !prev.FriendlyName)
                ? `My ${org.country} Address`
                : prev.FriendlyName
        }));

        if (org.country === "Australia" || org.country === "Ireland" || org.country === "Singapore" || org.country === "United Kingdom" || org.country === "New Zealand") {
            try {
                setIsSaving(true);
                const res = await profileService.getOrganization();
                if (res.data) {
                    setTwilioDetails({
                        subaccount_sid: res.data.twilio_subaccount_sid,
                        auth_token: res.data.twilio_auth_token
                    });

                    if (org.country === "Singapore") {
                        localStorage.setItem("twilio_subaccount_sid", res.data.twilio_subaccount_sid);
                        const auth = btoa(`${res.data.twilio_subaccount_sid}:${res.data.twilio_auth_token}`);
                        // 1. Get Regulation SID
                        const regRes = await axios.get(
                            "https://numbers.twilio.com/v2/RegulatoryCompliance/Regulations?IsoCountry=sg&NumberType=local&EndUserType=business",
                            { headers: { 'Authorization': `Basic ${auth}` } }
                        );
                        const regSid = regRes.data.results?.[0]?.sid;
                        if (regSid) {
                            localStorage.setItem("regulation_sid", regSid);
                            // 2. Post to Bundles
                            const bundleParams = new URLSearchParams();
                            bundleParams.append('FriendlyName', `${res.data.business_name}Bundle`);
                            bundleParams.append('Email', res.data.email);
                            bundleParams.append('RegulationSid', regSid);
                            bundleParams.append('StatusCallback', 'https://api.callpilot.pro/api/v1/organizations/twilio/verification');

                            const bundleRes = await axios.post(
                                "https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles",
                                bundleParams,
                                {
                                    headers: {
                                        'Authorization': `Basic ${auth}`,
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    }
                                }
                            );
                            if (bundleRes.data && bundleRes.data.sid) {
                                localStorage.setItem("bundleSid", bundleRes.data.sid);
                                localStorage.setItem("country", org.country);
                                localStorage.setItem("country_iso_code", org.country_iso_code);
                                setCurrentStep(2);
                                return;
                            }
                        }
                    }

                    if (org.country === "Ireland" || org.country === "United Kingdom" || org.country === "New Zealand") {
                        const iso = org.country === "Ireland" ? "ie" : org.country === "United Kingdom" ? "gb" : "nz";
                        const callback = "https://api.callpilot.pro/api/v1/organizations/twilio/verification";
                        const auth = btoa(`${res.data.twilio_subaccount_sid}:${res.data.twilio_auth_token}`);
                        // 1. Get Regulation SID
                        const regRes = await axios.get(
                            `https://numbers.twilio.com/v2/RegulatoryCompliance/Regulations?IsoCountry=${iso}&NumberType=local&EndUserType=business`,
                            { headers: { 'Authorization': `Basic ${auth}` } }
                        );
                        const regSid = regRes.data.results?.[0]?.sid;
                        if (regSid) {
                            localStorage.setItem("regulation_sid", regSid);
                            // 2. Post to Bundles
                            const bundleParams = new URLSearchParams();
                            bundleParams.append('FriendlyName', `${org.business_name}Bundle`);
                            bundleParams.append('Email', res.data.email);
                            bundleParams.append('RegulationSid', regSid);
                            bundleParams.append('StatusCallback', callback);

                            const bundleRes = await axios.post(
                                "https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles",
                                bundleParams,
                                {
                                    headers: {
                                        'Authorization': `Basic ${auth}`,
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                    }
                                }
                            );
                            if (bundleRes.data && bundleRes.data.sid) {
                                localStorage.setItem("bundleSid", bundleRes.data.sid);
                                localStorage.setItem("country", org.country);
                                localStorage.setItem("country_iso_code", org.country_iso_code);
                                setAustraliaAddress(prev => ({ ...prev, IsoCountry: org.country_iso_code }));
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching organization details or Twilio data:", err);
            } finally {
                setIsSaving(false);
            }
        }

        setCurrentStep(2);
    };

    const handleQuickSubmit = async () => {
        try {
            setIsSaving(true);
            localStorage.setItem(`activation_${org.country}_step1`, JSON.stringify({
                country: org.country,
                country_iso_code: org.country_iso_code
            }));
            localStorage.setItem("activation_step1", JSON.stringify({
                country: org.country,
                country_iso_code: org.country_iso_code
            }));

            const finalData = getCountryPatchData(org.country);
            await profileService.updateOrganization({
                ...finalData,
                compliance_status: "approved"
            });

            setAlertConfig({
                open: true,
                title: "Success",
                description: ["Country details submitted successfully."],
                variant: "default"
            });

            clearActivationData(org.country);
            router.push("/dashboard");
        } catch (err: any) {
            console.error("Error in quick submission:", err);
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: ["Failed to update organization details."],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNextStep2 = async () => {
        if (org.country === "Australia") {
            handleAustraliaSubmit();
            return;
        }

        if (org.country === "Ireland" || org.country === "United Kingdom" || org.country === "New Zealand") {
            const isNZ = org.country === "New Zealand";
            const newErrors: Record<string, string> = {};
            if (!irelandEndUser.business_name) {
                if (isNZ) {
                    newErrors.nz_business_name = "Business Name is required.";
                } else {
                    newErrors.ie_gb_business_name = "Business Name is required.";
                }
            }
            if (!isNZ) {
                if (!irelandEndUser.business_website) newErrors.ie_gb_business_website = "Business Website is required.";
                if (!irelandEndUser.business_registration_number) newErrors.ie_gb_business_reg_number = "Business Registration Number is required.";
                if (org.country === "United Kingdom" && !irelandEndUser.phone_number) newErrors.uk_phone = "Phone Number is required.";
                if (!irelandEndUser.first_name) newErrors.ie_gb_first_name = "Representative First Name is required.";
                if (!irelandEndUser.last_name) newErrors.ie_gb_last_name = "Representative Last Name is required.";
                if (!irelandEndUser.email) newErrors.ie_gb_email = "Contact Email is required.";
            }

            if (Object.keys(newErrors).length > 0) {
                setValidationErrors(newErrors);
                scrollToFirstError(newErrors);
                return;
            }

            try {
                setIsSaving(true);
                if (!twilioDetails) return;
                const auth = btoa(`${twilioDetails.subaccount_sid}:${twilioDetails.auth_token}`);

                // 1. Post to EndUsers
                const endUserParams = new URLSearchParams();
                endUserParams.append('FriendlyName', `${org.business_name}EndUsers`);
                endUserParams.append('Type', 'business');
                const attributes: any = org.country === "New Zealand"
                    ? { business_name: irelandEndUser.business_name }
                    : {
                        business_name: irelandEndUser.business_name,
                        business_website: irelandEndUser.business_website,
                        business_registration_number: irelandEndUser.business_registration_number,
                        first_name: irelandEndUser.first_name,
                        last_name: irelandEndUser.last_name,
                        email: irelandEndUser.email,
                        business_identity: "DIRECT_CUSTOMER",
                        is_subassigned: "NO",
                        comments: ""
                    };

                if (org.country === "United Kingdom") {
                    attributes.business_registration_identifier = irelandEndUser.business_registration_identifier;
                    attributes.comments = "UK test";

                    let phone = irelandEndUser.phone_number;
                    if (phone.startsWith('0')) {
                        phone = phone.substring(1);
                    }
                    const fullPhone = phone.startsWith("+")
                        ? phone
                        : `${ukSelectedPhoneCode}${phone}`;
                    attributes.phone_number = fullPhone;
                }

                endUserParams.append('Attributes', JSON.stringify(attributes));

                const endUserRes = await axios.post(
                    "https://numbers.twilio.com/v2/RegulatoryCompliance/EndUsers",
                    endUserParams,
                    {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                if (endUserRes.data && endUserRes.data.sid) {
                    const endUserSid = endUserRes.data.sid;
                    localStorage.setItem("endUserSid", endUserSid);

                    // 2. Post ItemAssignment
                    const bundleSid = localStorage.getItem("bundleSid");
                    if (bundleSid) {
                        const assignmentParams = new URLSearchParams();
                        assignmentParams.append('ObjectSid', endUserSid);
                        await axios.post(
                            `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`,
                            assignmentParams,
                            {
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                    }
                    if (org.country === "New Zealand") {
                        localStorage.setItem("nz_business_name", irelandEndUser.business_name);
                    }
                    if (org.country === "Ireland" || org.country === "United Kingdom" || org.country === "New Zealand") {
                        setAustraliaAddress(prev => {
                            const updated = { ...prev };
                            if (org.country === "United Kingdom") {
                                updated.CustomerName = !isCustomerNameModified || !prev.CustomerName
                                    ? `${irelandEndUser.first_name} ${irelandEndUser.last_name}`.trim()
                                    : prev.CustomerName;
                            }
                            updated.FriendlyName = !isFriendlyNameModified || !prev.FriendlyName
                                ? `My ${org.country} Address`
                                : prev.FriendlyName;
                            return updated;
                        });
                    }

                    // Save step 2 cached details
                    localStorage.setItem(`activation_${org.country}_step2`, JSON.stringify(irelandEndUser));
                    localStorage.setItem("activation_step2", JSON.stringify(irelandEndUser));

                    setCurrentStep(3);
                }
            } catch (err: any) {
                console.error(`Error in ${org.country} Step 2:`, err);
                setAlertConfig({
                    open: true,
                    title: "Submission Failed",
                    description: [err.response?.data?.message || `Failed to submit ${org.country} end user details.`],
                    variant: "destructive"
                });
            } finally {
                setIsSaving(false);
            }
            return;
        }

        const newErrors: Record<string, string> = {};
        if (!org.business_name) newErrors.business_name = "Business Name is required.";
        if (!org.reg_number) newErrors.reg_number = "Registration Number is required.";
        if (!org.business_registration_authority) newErrors.business_registration_authority = "Registration Authority is required.";
        if (!org.business_website) newErrors.business_website = "Business Website is required.";
        if (!org.street_address) newErrors.street_address = "Street Address is required.";
        if (!org.city) newErrors.city = "Town / City is required.";
        if (!org.post_code) newErrors.post_code = "Postcode / ZIP is required.";

        if (Object.keys(newErrors).length > 0) {
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }
        localStorage.setItem(`activation_${org.country}_step2`, JSON.stringify({
            business_name: org.business_name,
            reg_number: org.reg_number,
            business_registration_authority: org.business_registration_authority,
            business_website: org.business_website,
            street_address: org.street_address,
            apt_or_suite: org.apt_or_suite,
            city: org.city,
            post_code: org.post_code,
            province: org.province
        }));
        localStorage.setItem("activation_step2", JSON.stringify({
            business_name: org.business_name,
            reg_number: org.reg_number,
            business_registration_authority: org.business_registration_authority,
            business_website: org.business_website,
            street_address: org.street_address,
            apt_or_suite: org.apt_or_suite,
            city: org.city,
            post_code: org.post_code,
            province: org.province
        }));
        setCurrentStep(3);
    };

    const handleIrelandSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!australiaAddress.CustomerName) newErrors.CustomerName = "Customer Name is required.";
        if (!australiaAddress.FriendlyName) newErrors.FriendlyName = "Friendly Name is required.";
        if (!australiaAddress.Street) newErrors.Street = "Street is required.";
        if (!australiaAddress.City) newErrors.City = "City is required.";
        if (!australiaAddress.Region) newErrors.Region = "Region / State is required.";
        if (!australiaAddress.PostalCode) newErrors.PostalCode = "Postal Code is required.";

        if (Object.keys(newErrors).length > 0) {
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        if (!twilioDetails?.subaccount_sid || !twilioDetails?.auth_token) {
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Twilio account details not found."],
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            const auth = btoa(`${twilioDetails.subaccount_sid}:${twilioDetails.auth_token}`);

            // 1. Post to Addresses
            const addressParams = new URLSearchParams();
            Object.entries(australiaAddress).forEach(([key, value]) => {
                addressParams.append(key, value);
            });

            const addressRes = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioDetails.subaccount_sid}/Addresses.json`,
                addressParams,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (addressRes.data && addressRes.data.sid) {
                const addressSid = addressRes.data.sid;
                const bundleSid = localStorage.getItem("bundleSid");

                if (org.country === "New Zealand") {
                    localStorage.setItem(`activation_${org.country}_step3`, JSON.stringify(australiaAddress));
                    localStorage.setItem("activation_step3", JSON.stringify(australiaAddress));
                    localStorage.setItem("nz_address_sid", addressSid);
                    setCurrentStep(4);
                    setIsSaving(false);
                    return;
                }

                // 2. Post to SupportingDocuments
                const supportParams = new URLSearchParams();
                supportParams.append('FriendlyName', `${org.business_name}SupportingDocuments`);
                supportParams.append('Type', 'business_address');
                supportParams.append('Attributes', JSON.stringify({
                    address_sids: [addressSid]
                }));

                const supportRes = await axios.post(
                    "https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments",
                    supportParams,
                    {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                if (supportRes.data && supportRes.data.sid) {
                    const supportSid = supportRes.data.sid;

                    // 3. Post ItemAssignment (Supporting Doc)
                    if (bundleSid) {
                        const assignmentParams = new URLSearchParams();
                        assignmentParams.append('ObjectSid', supportSid);
                        await axios.post(
                            `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`,
                            assignmentParams,
                            {
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );

                        // 4. Update Bundle Status
                        const statusParams = new URLSearchParams();
                        statusParams.append('Status', 'pending-review');
                        await axios.post(
                            `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}`,
                            statusParams,
                            {
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                    }

                    // Save step 3 cached details
                    localStorage.setItem(`activation_${org.country}_step3`, JSON.stringify(australiaAddress));
                    localStorage.setItem("activation_step3", JSON.stringify(australiaAddress));

                    // Success!
                    const finalData = getCountryPatchData(org.country);
                    await profileService.updateOrganization({
                        ...finalData,
                        address_sid: addressSid,
                        bundle_sid: bundleSid,
                        compliance_status: "pending"
                    });

                    setAlertConfig({
                        open: true,
                        title: "Success",
                        description: [`${org.country} business details submitted for review.`],
                        variant: "default"
                    });
                    clearActivationData(org.country);
                    router.push("/dashboard");
                }
            }
        } catch (err: any) {
            console.error(`Error in ${org.country} final submission:`, err);
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: [err.response?.data?.message || `Failed to complete ${org.country} regulatory submission.`],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNZFinalSubmit = async () => {
        if (!org.business_registration_certificate) {
            const newErrors = { nz_cert: "Business Registration Document is required." };
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        if (!twilioDetails?.subaccount_sid || !twilioDetails?.auth_token) {
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Twilio account details not found."],
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            const auth = btoa(`${twilioDetails.subaccount_sid}:${twilioDetails.auth_token}`);
            const bundleSid = localStorage.getItem("bundleSid");
            const business_name = localStorage.getItem("nz_business_name");
            const address_sid = localStorage.getItem("nz_address_sid");

            // 1. Post to SupportingDocuments
            const formData = new FormData();
            formData.append('FriendlyName', `${business_name}SupportingDocuments`);
            formData.append('Type', 'business_registration');
            formData.append('Attributes', JSON.stringify({
                business_name: business_name,
                address_sids: [address_sid]
            }));
            formData.append('File', org.business_registration_certificate);

            const supportRes = await axios.post(
                "https://numbers.twilio.com/v2/RegulatoryCompliance/SupportingDocuments",
                formData,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            if (supportRes.data && supportRes.data.sid) {
                const supportSid = supportRes.data.sid;

                // 2. Post ItemAssignment
                if (bundleSid) {
                    const assignmentParams = new URLSearchParams();
                    assignmentParams.append('ObjectSid', supportSid);
                    await axios.post(
                        `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`,
                        assignmentParams,
                        {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }
                    );

                    // 3. Update Bundle Status
                    const statusParams = new URLSearchParams();
                    statusParams.append('Status', 'pending-review');
                    await axios.post(
                        `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}`,
                        statusParams,
                        {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }
                    );
                }

                // Save step 4 cached details (NZ)
                localStorage.setItem(`activation_${org.country}_step4`, JSON.stringify({
                    has_cert: !!org.business_registration_certificate,
                    cert_name: org.business_registration_certificate?.name || ""
                }));

                // Success!
                const finalData = getCountryPatchData(org.country);
                const callPilotFormData = new FormData();
                Object.keys(finalData).forEach(key => {
                    if (finalData[key] !== null && finalData[key] !== undefined) {
                        callPilotFormData.append(key, finalData[key]);
                    }
                });
                callPilotFormData.append("address_sid", address_sid || "");
                callPilotFormData.append("bundle_sid", bundleSid || "");
                callPilotFormData.append("compliance_status", "pending");
                if (org.business_registration_certificate instanceof File) {
                    callPilotFormData.append("business_registration_certificate", org.business_registration_certificate);
                }

                await profileService.updateOrganization(callPilotFormData);

                setAlertConfig({
                    open: true,
                    title: "Success",
                    description: ["New Zealand business details submitted for review."],
                    variant: "default"
                });
                clearActivationData(org.country);
                router.push("/dashboard");
            }
        } catch (err: any) {
            console.error("Error in NZ final submission:", err);
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: [err.response?.data?.message || "Failed to complete New Zealand regulatory submission."],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAustraliaSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!australiaAddress.CustomerName) newErrors.CustomerName = "Customer Name is required.";
        if (!australiaAddress.FriendlyName) newErrors.FriendlyName = "Friendly Name is required.";
        if (!australiaAddress.Street) newErrors.Street = "Street is required.";
        if (!australiaAddress.City) newErrors.City = "City is required.";
        if (!australiaAddress.Region) newErrors.Region = "Region / State is required.";
        if (!australiaAddress.PostalCode) newErrors.PostalCode = "Postal Code is required.";

        if (Object.keys(newErrors).length > 0) {
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        if (!twilioDetails?.subaccount_sid || !twilioDetails?.auth_token) {
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Twilio account details not found. Please try again."],
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            const auth = btoa(`${twilioDetails.subaccount_sid}:${twilioDetails.auth_token}`);
            const params = new URLSearchParams();
            Object.entries(australiaAddress).forEach(([key, value]) => {
                params.append(key, value);
            });

            const twilioRes = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioDetails.subaccount_sid}/Addresses.json`,
                params,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (twilioRes.data && twilioRes.data.sid) {
                const address_sid = twilioRes.data.sid;
                const country = localStorage.getItem("activation_step1") ? JSON.parse(localStorage.getItem("activation_step1")!).country : org.country;

                localStorage.setItem(`activation_${country}_step2`, JSON.stringify(australiaAddress));
                localStorage.setItem("activation_step2", JSON.stringify(australiaAddress));

                const finalData = getCountryPatchData(country);
                await profileService.updateOrganization({
                    ...finalData,
                    address_sid,
                    compliance_status: "pending"
                });

                setAlertConfig({
                    open: true,
                    title: "Success",
                    description: ["Address verified and saved successfully."],
                    variant: "default"
                });
                clearActivationData(country);
                router.push("/dashboard");
            }
        } catch (err: any) {
            console.error("Error in Australia address submission:", err);
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: [err.response?.data?.message || "Failed to submit address to Twilio."],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSingaporeSubmit = async () => {
        if (!singaporeBusinessName) {
            const newErrors = { singapore_business_name: "Business Name is required." };
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        const subaccount_sid = localStorage.getItem("twilio_subaccount_sid");
        const bundleSid = localStorage.getItem("bundleSid");

        if (!subaccount_sid || !twilioDetails?.auth_token) {
            setAlertConfig({
                open: true,
                title: "Error",
                description: ["Twilio account details not found."],
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            const auth = btoa(`${subaccount_sid}:${twilioDetails.auth_token}`);

            // 1. Post to EndUsers
            const endUserParams = new URLSearchParams();
            endUserParams.append('FriendlyName', `${org.business_name}EndUsers`);
            endUserParams.append('Type', 'business');
            endUserParams.append('Attributes', JSON.stringify({
                business_name: singaporeBusinessName
            }));

            const endUserRes = await axios.post(
                "https://numbers.twilio.com/v2/RegulatoryCompliance/EndUsers",
                endUserParams,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (endUserRes.data && endUserRes.data.sid) {
                const endUserSid = endUserRes.data.sid;
                localStorage.setItem("endUserSid", endUserSid);

                // 2. Post ItemAssignment
                if (bundleSid) {
                    const assignmentParams = new URLSearchParams();
                    assignmentParams.append('ObjectSid', endUserSid);
                    await axios.post(
                        `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`,
                        assignmentParams,
                        {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }
                    );

                    // 3. Update Bundle Status
                    const statusParams = new URLSearchParams();
                    statusParams.append('Status', 'pending-review');
                    await axios.post(
                        `https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles/${bundleSid}`,
                        statusParams,
                        {
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        }
                    );

                    // 4. Update Organization
                    const country = localStorage.getItem("country") || org.country;

                    localStorage.setItem(`activation_${country}_step2`, JSON.stringify({
                        singapore_business_name: singaporeBusinessName
                    }));
                    localStorage.setItem("activation_step2", JSON.stringify({
                        singapore_business_name: singaporeBusinessName
                    }));

                    const finalData = getCountryPatchData(country);
                    await profileService.updateOrganization({
                        ...finalData,
                        bundle_sid: bundleSid,
                        compliance_status: "pending"
                    });

                    setAlertConfig({
                        open: true,
                        title: "Success",
                        description: ["Singapore business details submitted successfully."],
                        variant: "default"
                    });
                    clearActivationData(country);
                    router.push("/dashboard");
                }
            }
        } catch (err: any) {
            console.error("Error in Singapore final submission:", err);
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: [err.response?.data?.message || "Failed to complete Singapore regulatory submission."],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNextStep3 = () => {
        const newErrors: Record<string, string> = {};
        if (!org.authorize_representative_first_name) newErrors.rep_first_name = "First Name is required.";
        if (!org.authorize_representative_last_name) newErrors.rep_last_name = "Last Name is required.";
        if (!org.authorize_representative_email) newErrors.rep_email = "Email is required.";
        if (!org.authorize_representative_phone) newErrors.rep_phone = "Phone Number is required.";

        if (Object.keys(newErrors).length > 0) {
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        let phone = org.authorize_representative_phone;
        if (phone.startsWith('0')) {
            phone = phone.substring(1);
        }

        const fullPhone = phone.startsWith("+")
            ? phone
            : `${selectedPhoneCode}${phone}`;

        setOrg(prev => ({ ...prev, authorize_representative_phone: fullPhone }));

        localStorage.setItem(`activation_${org.country}_step3`, JSON.stringify({
            authorize_representative_first_name: org.authorize_representative_first_name,
            authorize_representative_last_name: org.authorize_representative_last_name,
            authorize_representative_email: org.authorize_representative_email,
            authorize_representative_phone: fullPhone
        }));
        localStorage.setItem("activation_step3", JSON.stringify({
            authorize_representative_first_name: org.authorize_representative_first_name,
            authorize_representative_last_name: org.authorize_representative_last_name,
            authorize_representative_email: org.authorize_representative_email,
            authorize_representative_phone: fullPhone
        }));
        setCurrentStep(4);
    };

    const handleNextStep4 = () => {
        const newErrors: Record<string, string> = {};
        if (!org.business_registration_certificate) newErrors.cert = "Business Registration Certificate is required.";
        if (!org.proof_of_address) newErrors.proof = "Proof of Address is required.";

        if (Object.keys(newErrors).length > 0) {
            setValidationErrors(newErrors);
            scrollToFirstError(newErrors);
            return;
        }

        // Prepare file info for localStorage (since we can't store File objects directly easily)
        const fileInfo = {
            has_cert: !!org.business_registration_certificate,
            cert_name: org.business_registration_certificate?.name || "",
            has_proof: !!org.proof_of_address,
            proof_name: org.proof_of_address?.name || ""
        };
        localStorage.setItem(`activation_${org.country}_step4`, JSON.stringify(fileInfo));
        localStorage.setItem("activation_step4", JSON.stringify(fileInfo));
        setCurrentStep(5);
    };

    const handleSave = async () => {
        const formData = new FormData();

        const finalData = getCountryPatchData(org.country);

        Object.keys(finalData).forEach(key => {
            if (finalData[key] !== null && finalData[key] !== undefined) {
                formData.append(key, finalData[key]);
            }
        });

        if (org.business_registration_certificate instanceof File) {
            formData.append("business_registration_certificate", org.business_registration_certificate);
        }
        if (org.proof_of_address instanceof File) {
            formData.append("proof_of_address", org.proof_of_address);
        }

        formData.append("compliance_status", "approved");

        try {
            setIsSaving(true);
            await profileService.updateOrganization(formData);

            // Clear local storage
            clearActivationData(org.country);

            setAlertConfig({
                open: true,
                title: "Success",
                description: ["Business details submitted successfully."],
                variant: "default"
            });

            router.push("/dashboard");
        } catch (err: any) {
            console.error("Error updating organization:", err);
            const errors = err.response?.data || {};
            const errorMessages: string[] = [];
            Object.keys(errors).forEach((key) => {
                if (Array.isArray(errors[key])) {
                    errorMessages.push(`${key}: ${errors[key][0]}`);
                } else if (typeof errors[key] === 'string') {
                    errorMessages.push(`${key}: ${errors[key]}`);
                }
            });
            setAlertConfig({
                open: true,
                title: "Submission Failed",
                description: errorMessages.length > 0 ? errorMessages : ["Failed to update organization details."],
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        cookieUtils.set('access', '', -1);
        cookieUtils.set('refresh', '', -1);
        setIsLogoutDialogOpen(false);
        router.push('/login');
    };

    const filteredCountries = countries
        .filter(c => !["India", "Singapore"].includes(c.country))
        .filter(c =>
            c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.country_code.toLowerCase().includes(countrySearch.toLowerCase()) ||
            c.phone_code.includes(countrySearch)
        );

    const filteredPhoneCountries = countries.filter(c =>
        c.country.toLowerCase().includes(phoneCodeSearch.toLowerCase()) ||
        c.country_code.toLowerCase().includes(phoneCodeSearch.toLowerCase()) ||
        c.phone_code.includes(phoneCodeSearch)
    );

    const handleFilePreview = (file: File) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setPreviewFileType(file.type);
        setPreviewFileName(file.name);
        setIsPreviewOpen(true);
    };

    useEffect(() => {
        // Cleanup blob URLs
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-violet-200 border-t-violet-600 dark:border-white/10 dark:border-t-violet-400" />
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-background flex flex-col">
            <div className="pointer-events-none fixed -top-24 -left-24 h-96 w-96 rounded-full bg-brand-violet/25 blur-3xl animate-float" aria-hidden="true" />
            <div className="pointer-events-none fixed top-1/3 -right-24 h-96 w-96 rounded-full bg-brand-cyan/20 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} aria-hidden="true" />
            <div className="pointer-events-none fixed -bottom-24 left-1/3 h-80 w-80 rounded-full bg-brand-pink/20 blur-3xl animate-float" style={{ animationDelay: "3s" }} aria-hidden="true" />
            <LoaderOverlay isLoading={isLoading || isSaving} />

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl bg-black/5 dark:bg-gray-900/50 backdrop-blur-xl">
                    <DialogHeader className="p-4 bg-white/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800 flex flex-row items-center justify-between sticky top-0 z-10 transition-colors">
                        <DialogTitle className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate pr-8 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Search size={16} className="text-primary" />
                            </div>
                            {previewFileName}
                        </DialogTitle>
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(false)}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-all"
                        >
                            <X size={18} />
                        </button>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-gray-50/50 dark:bg-gray-950/50">
                        {previewUrl && (
                            previewFileType?.startsWith("image/") ? (
                                <img
                                    src={previewUrl}
                                    alt={previewFileName}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg animate-in fade-in zoom-in duration-300"
                                />
                            ) : (
                                <div className="w-full h-[70vh] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-xl bg-white dark:bg-gray-900">
                                    <iframe
                                        src={`${previewUrl}#toolbar=0`}
                                        className="w-full h-full border-none"
                                        title={previewFileName}
                                    />
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="dark:text-gray-100">Are you sure you want to logout?</AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-gray-400">
                            You will be redirected to the login page.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsLogoutDialogOpen(false)}
                            className="dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            Cancel
                        </Button>
                        <AlertDialogAction
                            onClick={handleLogout}
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                            Logout
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={alertConfig.open} onOpenChange={(open) => setAlertConfig(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="dark:bg-gray-900 dark:border-gray-800 max-w-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={alertConfig.variant === "destructive" ? "text-destructive dark:text-red-400" : "dark:text-gray-100"}>
                            {alertConfig.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 dark:text-gray-400" asChild>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                                {alertConfig.description.map((error, index) => (
                                    <div key={index} className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all leading-relaxed">
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

            {/* Header */}
            <header className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center px-8 bg-white dark:bg-gray-950 sticky top-0 z-10 justify-between">
                <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <span className="text-lg font-semibold">Dashboard</span>
                    <Lock size={18} className="text-gray-400" />
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 gap-2 font-medium transition-colors"
                    onClick={() => setIsLogoutDialogOpen(true)}
                >
                    <LogOut size={18} />
                    <span>Logout</span>
                </Button>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 space-y-12">
                {/* Stepper */}
                <div className="flex items-center justify-between relative max-w-xl mx-auto mb-16 px-4">
                    {/* Step 1: Account Created */}
                    <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white mb-2">
                            <CheckCircle2 size={24} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Account Creation</span>
                    </div>

                    <div className="flex-1 h-[2px] bg-green-500 mt-[-1.5rem]" />

                    {/* Step 2: Platform Activation */}
                    <div className="flex flex-col items-center z-10 transform translate-x-[-1px]">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 text-white shadow-md shadow-violet-500/25 flex items-center justify-center text-white mb-2 ring-4 ring-blue-100 dark:ring-blue-900/30">
                            <div className="w-4 h-4 rounded-full border-2 border-white" />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">Upload Business Details</span>
                    </div>

                    {/* <div className="flex-1 h-[2px] bg-blue-600/30 mt-[-1.5rem]" /> */}

                    {/* Step 3: Company Details */}
                    {/* <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 mb-2">
                            <Building2 size={20} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Company Details</span>
                    </div> */}

                    {/* <div className="flex-1 h-[2px] bg-gray-200 dark:bg-gray-800 mt-[-1.5rem]" /> */}

                    {/* Step 4: Choose Plan */}
                    {/* <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 mb-2">
                            <ClipboardCheck size={20} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Choose Plan</span>
                    </div> */}

                    {/* <div className="flex-1 h-[2px] bg-gray-200 dark:bg-gray-800 mt-[-1.5rem]" /> */}

                    {/* Step 5: Buy AI Number */}
                    {/* <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 mb-2">
                            <Phone size={20} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Buy AI Number</span>
                    </div> */}
                </div>

                {/* Form Section */}
                <div className="bg-white/80 backdrop-blur-xl dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm shadow-violet-500/10">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Verify Business Details</h2>
                        <div className="flex items-center gap-2">
                            {(org.country === "Australia" || org.country === "Singapore" ? [1, 2] : (org.country === "Ireland" || org.country === "United Kingdom") ? [1, 2, 3] : org.country === "New Zealand" ? [1, 2, 3, 4] : ["India", "Canada", "United States of America"].includes(org.country) ? [1] : [1, 2, 3, 4, 5]).map((step) => (
                                <div
                                    key={step}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep === step
                                        ? "bg-primary text-white"
                                        : currentStep > step
                                            ? "bg-green-500 text-white"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                        }`}
                                >
                                    {currentStep > step ? <Check size={16} /> : step}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-8">
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Country</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-sm font-semibold">Country</Label>
                                        <div className="relative" ref={dropdownRef}>
                                            <div
                                                id="country"
                                                tabIndex={0}
                                                onClick={() => setIsCountryOpen(!isCountryOpen)}
                                                className={`w-full bg-white dark:bg-gray-800 border ${validationErrors.country ? "border-red-500 focus-visible:ring-red-500" : "border-input"} rounded-md h-10 px-3 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors`}
                                            >
                                                <span className={org.country ? "text-gray-900 dark:text-gray-100 text-[14px]" : "text-gray-400 dark:text-gray-500 text-[14px]"}>
                                                    {org.country ? `${org.country_iso_code ? `(${org.country_iso_code}) ` : ""}${org.country}` : "Select country"}
                                                </span>
                                                <ChevronsUpDown size={16} className="text-gray-400" />
                                            </div>
                                            {validationErrors.country && (
                                                <p className="text-xs text-red-500 mt-1">{validationErrors.country}</p>
                                            )}

                                            {isCountryOpen && (
                                                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Search country..."
                                                                value={countrySearch}
                                                                onChange={(e) => setCountrySearch(e.target.value)}
                                                                className="w-full bg-white dark:bg-gray-800 border-none py-1.5 pl-9 pr-4 text-[14px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-[150px] overflow-y-auto font-sans">
                                                        {filteredCountries.length > 0 ? (
                                                            filteredCountries.map((c) => (
                                                                <div
                                                                    key={c.country_code}
                                                                    onClick={() => {
                                                                        setOrg({ ...org, country: c.country, country_iso_code: c.country_code });
                                                                        setIsCountryOpen(false);
                                                                        setCountrySearch("");
                                                                        clearValidationError("country");
                                                                    }}
                                                                    className="px-4 py-2.5 text-[14px] font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-between"
                                                                >
                                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                                        <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">{c.country_code}</span>
                                                                        <span>{c.country}</span>
                                                                    </div>
                                                                    {org.country === c.country && (
                                                                        <Check size={14} className="text-primary" />
                                                                    )}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-xs italic">
                                                                No countries found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {["India", "Canada", "United States of America"].includes(org.country) && (
                                    <div className="space-y-4 mb-6">
                                        <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <Checkbox
                                                id="compliance"
                                                checked={isComplianceAgreed}
                                                onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                            />
                                            <label
                                                htmlFor="compliance"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                I have read and agree to the{" "}
                                                <span
                                                    className="text-primary hover:underline font-bold"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setIsComplianceModalOpen(true);
                                                    }}
                                                >
                                                    Privacy Policy and Terms
                                                </span>.
                                            </label>
                                        </div>

                                        <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <Checkbox
                                                id="phone-billing"
                                                checked={isPhoneBillingAgreed}
                                                onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                            />
                                            <label
                                                htmlFor="phone-billing"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                I understand how{" "}
                                                <span
                                                    className="text-primary hover:underline font-bold"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setIsPhoneBillingModalOpen(true);
                                                    }}
                                                >
                                                    CallPilot phone numbers are assigned, used, and billed
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-6">
                                    <Button
                                        onClick={handleNextStep1}
                                        disabled={["India", "Canada", "United States of America"].includes(org.country) && (isSaving || !isComplianceAgreed || !isPhoneBillingAgreed)}
                                        className="bg-primary hover:bg-primary/90 text-white px-8"
                                    >
                                        {["India", "Canada", "United States of America"].includes(org.country) ? (isSaving ? "Submitting..." : "Submit") : "Next"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {org.country === "Australia" ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Australia Address Verification</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="CustomerName" className="text-sm font-semibold">Customer Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="CustomerName"
                                                    placeholder="Enter customer name"
                                                    value={australiaAddress.CustomerName}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, CustomerName: e.target.value });
                                                        clearValidationError("CustomerName");
                                                    }}
                                                    className={validationErrors.CustomerName ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.CustomerName && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.CustomerName}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="FriendlyName" className="text-sm font-semibold">Friendly Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="FriendlyName"
                                                    placeholder="e.g. My Australia Address"
                                                    value={australiaAddress.FriendlyName}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, FriendlyName: e.target.value });
                                                        clearValidationError("FriendlyName");
                                                        setIsFriendlyNameModified(true);
                                                    }}
                                                    className={validationErrors.FriendlyName ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.FriendlyName && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.FriendlyName}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="Street" className="text-sm font-semibold">Street <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="Street"
                                                    placeholder="Enter street address"
                                                    value={australiaAddress.Street}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, Street: e.target.value });
                                                        clearValidationError("Street");
                                                    }}
                                                    className={validationErrors.Street ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.Street && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.Street}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="StreetSecondary" className="text-sm font-semibold">Street Secondary</Label>
                                                <Input
                                                    id="StreetSecondary"
                                                    placeholder="Apartment, suite, unit, etc."
                                                    value={australiaAddress.StreetSecondary}
                                                    onChange={(e) => setAustraliaAddress({ ...australiaAddress, StreetSecondary: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="City" className="text-sm font-semibold">City <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="City"
                                                    placeholder="Enter city"
                                                    value={australiaAddress.City}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, City: e.target.value });
                                                        clearValidationError("City");
                                                    }}
                                                    className={validationErrors.City ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.City && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.City}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="Region" className="text-sm font-semibold">Region / State <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="Region"
                                                    placeholder="Enter region"
                                                    value={australiaAddress.Region}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, Region: e.target.value });
                                                        clearValidationError("Region");
                                                    }}
                                                    className={validationErrors.Region ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.Region && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.Region}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="PostalCode" className="text-sm font-semibold">Postal Code <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="PostalCode"
                                                    placeholder="Enter postal code"
                                                    value={australiaAddress.PostalCode}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, PostalCode: e.target.value });
                                                        clearValidationError("PostalCode");
                                                    }}
                                                    className={validationErrors.PostalCode ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.PostalCode && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.PostalCode}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="IsoCountry" className="text-sm font-semibold">Country Code</Label>
                                                <Input
                                                    id="IsoCountry"
                                                    value={australiaAddress.IsoCountry}
                                                    disabled
                                                    className="bg-gray-50 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4 mb-6">
                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="compliance"
                                                    checked={isComplianceAgreed}
                                                    onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="compliance"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I have read and agree to the{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsComplianceModalOpen(true);
                                                        }}
                                                    >
                                                        Privacy Policy and Terms
                                                    </span>.
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="phone-billing"
                                                    checked={isPhoneBillingAgreed}
                                                    onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="phone-billing"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I understand how{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsPhoneBillingModalOpen(true);
                                                        }}
                                                    >
                                                        CallPilot phone numbers are assigned, used, and billed
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep2}
                                                disabled={isSaving || !isComplianceAgreed || !isPhoneBillingAgreed}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                {isSaving ? "Submitting..." : "Submit"}
                                            </Button>
                                        </div>
                                    </>
                                ) : org.country === "Singapore" ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Singapore Verification</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Please provide your business name to complete the regulatory compliance process.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="singapore_business_name" className="text-sm font-semibold">Registered Business Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="singapore_business_name"
                                                    placeholder="Enter registered business name"
                                                    value={singaporeBusinessName}
                                                    onChange={(e) => {
                                                        setSingaporeBusinessName(e.target.value);
                                                        clearValidationError("singapore_business_name");
                                                    }}
                                                    className={validationErrors.singapore_business_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.singapore_business_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.singapore_business_name}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-6">
                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="compliance"
                                                    checked={isComplianceAgreed}
                                                    onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="compliance"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I have read and agree to the{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsComplianceModalOpen(true);
                                                        }}
                                                    >
                                                        Privacy Policy and Terms
                                                    </span>.
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="phone-billing"
                                                    checked={isPhoneBillingAgreed}
                                                    onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="phone-billing"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I understand how{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsPhoneBillingModalOpen(true);
                                                        }}
                                                    >
                                                        CallPilot phone numbers are assigned, used, and billed
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleSingaporeSubmit}
                                                disabled={isSaving || !isComplianceAgreed || !isPhoneBillingAgreed}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                {isSaving ? "Submitting..." : "Submit"}
                                            </Button>
                                        </div>
                                    </>
                                ) : org.country === "New Zealand" ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Zealand Verification</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Please provide your business name to complete the regulatory compliance process.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="nz_business_name" className="text-sm font-semibold">Registered Business Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="nz_business_name"
                                                    placeholder="Enter registered business name"
                                                    value={irelandEndUser.business_name}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, business_name: e.target.value });
                                                        clearValidationError("nz_business_name");
                                                    }}
                                                    className={validationErrors.nz_business_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.nz_business_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.nz_business_name}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep2}
                                                disabled={isSaving}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                {isSaving ? "Submitting..." : "Next"}
                                            </Button>
                                        </div>
                                    </>
                                ) : (org.country === "Ireland" || org.country === "United Kingdom") ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{org.country} Business Information</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="ie_gb_business_name" className="text-sm font-semibold">Business Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_business_name"
                                                    placeholder="Enter business name"
                                                    value={irelandEndUser.business_name}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, business_name: e.target.value });
                                                        clearValidationError("ie_gb_business_name");
                                                    }}
                                                    className={validationErrors.ie_gb_business_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_business_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_business_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="ie_gb_business_website" className="text-sm font-semibold">Business Website <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_business_website"
                                                    placeholder="https://example.com"
                                                    value={irelandEndUser.business_website}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, business_website: e.target.value });
                                                        clearValidationError("ie_gb_business_website");
                                                    }}
                                                    className={validationErrors.ie_gb_business_website ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_business_website && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_business_website}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="ie_gb_business_reg_number" className="text-sm font-semibold">Business Registration Number <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_business_reg_number"
                                                    placeholder="Enter registration number"
                                                    value={irelandEndUser.business_registration_number}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, business_registration_number: e.target.value });
                                                        clearValidationError("ie_gb_business_reg_number");
                                                    }}
                                                    className={validationErrors.ie_gb_business_reg_number ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_business_reg_number && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_business_reg_number}</p>
                                                )}
                                            </div>
                                            {org.country === "United Kingdom" && (
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label className="text-sm font-semibold">Registration Authority <span className="text-red-500">*</span></Label>
                                                    <Select
                                                        value={irelandEndUser.business_registration_identifier}
                                                        onValueChange={(value) => setIrelandEndUser({ ...irelandEndUser, business_registration_identifier: value })}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Select Registration Authority" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="UK:CRN">UK:CRN</SelectItem>
                                                            <SelectItem value="US:EIN">US:EIN</SelectItem>
                                                            <SelectItem value="CA:CBN">CA:CBN</SelectItem>
                                                            <SelectItem value="AU:ACN">AU:ACN</SelectItem>
                                                            <SelectItem value="OTHER">OTHER</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {org.country === "United Kingdom" && (
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label htmlFor="uk_phone" className="text-sm font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                                                    <div className="flex gap-2">
                                                        <div className="relative" ref={ukPhoneCodeDropdownRef}>
                                                            <div
                                                                onClick={() => setIsUKPhoneCodeOpen(!isUKPhoneCodeOpen)}
                                                                className="w-[120px] bg-white dark:bg-gray-800 border border-input rounded-md h-10 px-3 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                                                            >
                                                                <span className="text-gray-900 dark:text-gray-100 text-[14px] font-bold">
                                                                    {ukSelectedPhoneCode}
                                                                </span>
                                                                <ChevronsUpDown size={14} className="text-gray-400" />
                                                            </div>

                                                            {isUKPhoneCodeOpen && (
                                                                <div className="absolute top-[calc(100%+4px)] left-0 w-[250px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                                    <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                                                                        <div className="relative">
                                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                placeholder="Search code..."
                                                                                value={ukPhoneCodeSearch}
                                                                                onChange={(e) => setUkPhoneCodeSearch(e.target.value)}
                                                                                className="w-full bg-white dark:bg-gray-800 border-none py-1.5 pl-9 pr-4 text-[14px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                                                                        {countries.filter(c =>
                                                                            c.country.toLowerCase().includes(ukPhoneCodeSearch.toLowerCase()) ||
                                                                            c.phone_code.includes(ukPhoneCodeSearch)
                                                                        ).length > 0 ? (
                                                                            countries.filter(c =>
                                                                                c.country.toLowerCase().includes(ukPhoneCodeSearch.toLowerCase()) ||
                                                                                c.phone_code.includes(ukPhoneCodeSearch)
                                                                            ).map((c, index) => (
                                                                                <div
                                                                                    key={`uk-${c.country_code}-${index}`}
                                                                                    onClick={() => {
                                                                                        const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                                                                                        setUkSelectedPhoneCode(code);
                                                                                        setIsUKPhoneCodeOpen(false);
                                                                                        setUkPhoneCodeSearch("");
                                                                                        if (irelandEndUser.phone_number.startsWith("0")) {
                                                                                            setIrelandEndUser(prev => ({
                                                                                                ...prev,
                                                                                                phone_number: prev.phone_number.substring(1)
                                                                                            }));
                                                                                        }
                                                                                    }}
                                                                                    className="px-4 py-2.5 text-[14px] font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-between"
                                                                                >
                                                                                    <div className="flex items-center justify-between gap-2 w-full truncate">
                                                                                        <span className="text-primary font-bold w-12">{c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`}</span>
                                                                                        <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{c.country}</span>
                                                                                    </div>
                                                                                    {ukSelectedPhoneCode === (c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`) && (
                                                                                        <Check size={14} className="text-primary shrink-0" />
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-xs italic">
                                                                                No results
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 flex flex-col">
                                                            <Input
                                                                id="uk_phone"
                                                                placeholder="Enter phone number"
                                                                value={irelandEndUser.phone_number}
                                                                onChange={(e) => {
                                                                    let val = e.target.value;
                                                                    if (val.startsWith("0")) {
                                                                        val = val.substring(1);
                                                                    }
                                                                    setIrelandEndUser({ ...irelandEndUser, phone_number: val });
                                                                    clearValidationError("uk_phone");
                                                                }}
                                                                className={`flex-1 ${validationErrors.uk_phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                                required
                                                            />
                                                            {validationErrors.uk_phone && (
                                                                <p className="text-xs text-red-500 mt-1">{validationErrors.uk_phone}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label htmlFor="ie_gb_first_name" className="text-sm font-semibold">Representative First Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_first_name"
                                                    placeholder="Enter first name"
                                                    value={irelandEndUser.first_name}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, first_name: e.target.value });
                                                        clearValidationError("ie_gb_first_name");
                                                    }}
                                                    className={validationErrors.ie_gb_first_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_first_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_first_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="ie_gb_last_name" className="text-sm font-semibold">Representative Last Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_last_name"
                                                    placeholder="Enter last name"
                                                    value={irelandEndUser.last_name}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, last_name: e.target.value });
                                                        clearValidationError("ie_gb_last_name");
                                                    }}
                                                    className={validationErrors.ie_gb_last_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_last_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_last_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="ie_gb_email" className="text-sm font-semibold">Contact Email <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="ie_gb_email"
                                                    type="email"
                                                    placeholder="enter@email.com"
                                                    value={irelandEndUser.email}
                                                    onChange={(e) => {
                                                        setIrelandEndUser({ ...irelandEndUser, email: e.target.value });
                                                        clearValidationError("ie_gb_email");
                                                    }}
                                                    className={validationErrors.ie_gb_email ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.ie_gb_email && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.ie_gb_email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep2}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Business Details & Address</h3>
                                            {/* <p className="text-sm text-gray-500 dark:text-gray-400">Please provide your business registration and address details.</p> */}
                                        </div>

                                        {/* Business Info Section moved from Step 1 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="business_name" className="text-sm font-semibold">Registered Business Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="business_name"
                                                    placeholder="Enter business name"
                                                    value={org.business_name}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, business_name: e.target.value });
                                                        clearValidationError("business_name");
                                                    }}
                                                    className={validationErrors.business_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.business_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.business_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="reg_number" className="text-sm font-semibold">Business Registration Number <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="reg_number"
                                                    placeholder="Enter registration number"
                                                    value={org.reg_number}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, reg_number: e.target.value });
                                                        clearValidationError("reg_number");
                                                    }}
                                                    className={validationErrors.reg_number ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.reg_number && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.reg_number}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="business_registration_authority" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Business Registration Authority <span className="text-red-500">*</span></Label>
                                                <div className="relative" ref={authorityDropdownRef}>
                                                    <div
                                                        id="business_registration_authority"
                                                        tabIndex={0}
                                                        onClick={() => setIsAuthorityOpen(!isAuthorityOpen)}
                                                        className={`w-full bg-white dark:bg-gray-800 border ${validationErrors.business_registration_authority ? "border-red-500 focus-visible:ring-red-500" : "border-input"} rounded-md h-10 px-3 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors`}
                                                    >
                                                        <span className={org.business_registration_authority ? "text-gray-900 dark:text-gray-100 text-[14px]" : "text-gray-400 dark:text-gray-500 text-[14px]"}>
                                                            {org.business_registration_authority || "Select Authority"}
                                                        </span>
                                                        <ChevronsUpDown size={16} className="text-gray-400" />
                                                    </div>
                                                    {validationErrors.business_registration_authority && (
                                                        <p className="text-xs text-red-500 mt-1">{validationErrors.business_registration_authority}</p>
                                                    )}

                                                    {isAuthorityOpen && (
                                                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="max-h-[200px] overflow-y-auto font-sans">
                                                                {["UK:CRN", "US:EIN", "CA:CBN", "AU:ACN", "OTHER"].map((option) => (
                                                                    <div
                                                                        key={option}
                                                                        onClick={() => {
                                                                            setOrg({ ...org, business_registration_authority: option });
                                                                            setIsAuthorityOpen(false);
                                                                            clearValidationError("business_registration_authority");
                                                                        }}
                                                                        className="px-4 py-2.5 text-[14px] font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-between"
                                                                    >
                                                                        <span>{option}</span>
                                                                        {org.business_registration_authority === option && (
                                                                            <Check size={14} className="text-primary" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="business_website" className="text-sm font-semibold">Business Website <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="business_website"
                                                    placeholder="https://example.com"
                                                    value={org.business_website}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, business_website: e.target.value });
                                                        clearValidationError("business_website");
                                                    }}
                                                    className={validationErrors.business_website ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.business_website && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.business_website}</p>
                                                )}
                                            </div>

                                            {/* Address Section */}
                                            <div className="space-y-2">
                                                <Label htmlFor="street_address" className="text-sm font-semibold">Street Address <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="street_address"
                                                    placeholder="Enter street address"
                                                    value={org.street_address}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, street_address: e.target.value });
                                                        clearValidationError("street_address");
                                                    }}
                                                    className={validationErrors.street_address ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.street_address && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.street_address}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="city" className="text-sm font-semibold">Town / City <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="city"
                                                    placeholder="Enter city"
                                                    value={org.city}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, city: e.target.value });
                                                        clearValidationError("city");
                                                    }}
                                                    className={validationErrors.city ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.city && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.city}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="province" className="text-sm font-semibold">State</Label>
                                                <Input
                                                    id="province"
                                                    placeholder="Enter province"
                                                    value={org.province}
                                                    onChange={(e) => setOrg({ ...org, province: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="post_code" className="text-sm font-semibold">Postcode / ZIP {org.country === "United Kingdom" && <span className="text-red-500">*</span>}</Label>
                                                <Input
                                                    id="post_code"
                                                    placeholder="Enter post code"
                                                    value={org.post_code}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, post_code: e.target.value });
                                                        clearValidationError("post_code");
                                                    }}
                                                    className={validationErrors.post_code ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required={org.country === "United Kingdom"}
                                                />
                                                {validationErrors.post_code && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.post_code}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="apt_or_suite" className="text-sm font-semibold">APT/Suite</Label>
                                                <Input
                                                    id="apt_or_suite"
                                                    placeholder="Enter apartment or suite"
                                                    value={org.apt_or_suite}
                                                    onChange={(e) => setOrg({ ...org, apt_or_suite: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep2}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {(org.country === "Ireland" || org.country === "United Kingdom" || org.country === "New Zealand") ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{org.country} Address Verification</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="CustomerName" className="text-sm font-semibold">Customer Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="CustomerName"
                                                    placeholder="Enter customer name"
                                                    value={australiaAddress.CustomerName}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, CustomerName: e.target.value });
                                                        clearValidationError("CustomerName");
                                                        if (org.country === "United Kingdom") {
                                                            setIsCustomerNameModified(true);
                                                        }
                                                    }}
                                                    className={validationErrors.CustomerName ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.CustomerName && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.CustomerName}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="FriendlyName" className="text-sm font-semibold">Friendly Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="FriendlyName"
                                                    placeholder={`e.g. My ${org.country} Address`}
                                                    value={australiaAddress.FriendlyName}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, FriendlyName: e.target.value });
                                                        clearValidationError("FriendlyName");
                                                        setIsFriendlyNameModified(true);
                                                    }}
                                                    className={validationErrors.FriendlyName ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.FriendlyName && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.FriendlyName}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="Street" className="text-sm font-semibold">Street <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="Street"
                                                    placeholder="Enter street address"
                                                    value={australiaAddress.Street}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, Street: e.target.value });
                                                        clearValidationError("Street");
                                                    }}
                                                    className={validationErrors.Street ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.Street && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.Street}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label htmlFor="StreetSecondary" className="text-sm font-semibold">Street Secondary</Label>
                                                <Input
                                                    id="StreetSecondary"
                                                    placeholder="Apartment, suite, unit, etc."
                                                    value={australiaAddress.StreetSecondary}
                                                    onChange={(e) => setAustraliaAddress({ ...australiaAddress, StreetSecondary: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="City" className="text-sm font-semibold">City <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="City"
                                                    placeholder="Enter city"
                                                    value={australiaAddress.City}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, City: e.target.value });
                                                        clearValidationError("City");
                                                    }}
                                                    className={validationErrors.City ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.City && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.City}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="Region" className="text-sm font-semibold">Region / State <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="Region"
                                                    placeholder="Enter region"
                                                    value={australiaAddress.Region}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, Region: e.target.value });
                                                        clearValidationError("Region");
                                                    }}
                                                    className={validationErrors.Region ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.Region && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.Region}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="PostalCode" className="text-sm font-semibold">Postal Code <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="PostalCode"
                                                    placeholder="Enter postal code"
                                                    value={australiaAddress.PostalCode}
                                                    onChange={(e) => {
                                                        setAustraliaAddress({ ...australiaAddress, PostalCode: e.target.value });
                                                        clearValidationError("PostalCode");
                                                    }}
                                                    className={validationErrors.PostalCode ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.PostalCode && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.PostalCode}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="IsoCountry" className="text-sm font-semibold">Country Code</Label>
                                                <Input
                                                    id="IsoCountry"
                                                    value={australiaAddress.IsoCountry}
                                                    disabled
                                                    className="bg-gray-50 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        {org.country !== "New Zealand" && (
                                            <div className="space-y-4 mb-6">
                                                <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                    <Checkbox
                                                        id="compliance"
                                                        checked={isComplianceAgreed}
                                                        onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                                    />
                                                    <label
                                                        htmlFor="compliance"
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        I have read and agree to the{" "}
                                                        <span
                                                            className="text-primary hover:underline font-bold"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsComplianceModalOpen(true);
                                                            }}
                                                        >
                                                            Privacy Policy and Terms
                                                        </span>.
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                    <Checkbox
                                                        id="phone-billing"
                                                        checked={isPhoneBillingAgreed}
                                                        onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                                    />
                                                    <label
                                                        htmlFor="phone-billing"
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        I understand how{" "}
                                                        <span
                                                            className="text-primary hover:underline font-bold"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setIsPhoneBillingModalOpen(true);
                                                            }}
                                                        >
                                                            CallPilot phone numbers are assigned, used, and billed
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleIrelandSubmit}
                                                disabled={isSaving || (org.country !== "New Zealand" && (!isComplianceAgreed || !isPhoneBillingAgreed))}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                {isSaving ? "Submitting..." : (org.country === "New Zealand" ? "Next" : "Submit")}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Authorize Representative Information</h3>
                                        </div>

                                        {/* Preview Section for Step 1 & 2 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Registered Business Name</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_name || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Number</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.reg_number || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Authority</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_registration_authority || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Website</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_website || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Street Address</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.street_address || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Town / City</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.city || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">State</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.province || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Postcode / ZIP</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.post_code || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Country</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.country || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">APT/Suite</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.apt_or_suite || "N/A"}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="rep_first_name" className="text-sm font-semibold">First Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="rep_first_name"
                                                    placeholder="Enter first name"
                                                    value={org.authorize_representative_first_name}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, authorize_representative_first_name: e.target.value });
                                                        clearValidationError("rep_first_name");
                                                    }}
                                                    className={validationErrors.rep_first_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.rep_first_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.rep_first_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="rep_last_name" className="text-sm font-semibold">Last Name <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="rep_last_name"
                                                    placeholder="Enter last name"
                                                    value={org.authorize_representative_last_name}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, authorize_representative_last_name: e.target.value });
                                                        clearValidationError("rep_last_name");
                                                    }}
                                                    className={validationErrors.rep_last_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.rep_last_name && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.rep_last_name}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="rep_email" className="text-sm font-semibold">Email <span className="text-red-500">*</span></Label>
                                                <Input
                                                    id="rep_email"
                                                    type="email"
                                                    placeholder="Enter email address"
                                                    value={org.authorize_representative_email}
                                                    onChange={(e) => {
                                                        setOrg({ ...org, authorize_representative_email: e.target.value });
                                                        clearValidationError("rep_email");
                                                    }}
                                                    className={validationErrors.rep_email ? "border-red-500 focus-visible:ring-red-500" : ""}
                                                    required
                                                />
                                                {validationErrors.rep_email && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.rep_email}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="rep_phone" className="text-sm font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                                                <div className="flex gap-2">
                                                    <div className="relative w-[140px]" ref={phoneCodeDropdownRef}>
                                                        <div
                                                            onClick={() => setIsPhoneCodeOpen(!isPhoneCodeOpen)}
                                                            className="w-full bg-white dark:bg-gray-800 border border-input rounded-md h-10 px-3 flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                                                        >
                                                            <span className="text-gray-900 dark:text-gray-100 text-[14px] truncate">
                                                                {selectedPhoneCode || "Code"}
                                                            </span>
                                                            <ChevronsUpDown size={16} className="text-gray-400 shrink-0" />
                                                        </div>

                                                        {isPhoneCodeOpen && (
                                                            <div className="absolute bottom-[calc(100%+4px)] left-0 w-[390px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <div className="relative">
                                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            placeholder="Search code..."
                                                                            value={phoneCodeSearch}
                                                                            onChange={(e) => setPhoneCodeSearch(e.target.value)}
                                                                            className="w-full bg-white dark:bg-gray-800 border-none py-1.5 pl-9 pr-4 text-[14px] font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="max-h-[200px] overflow-y-auto font-sans">
                                                                    {filteredPhoneCountries.length > 0 ? (
                                                                        filteredPhoneCountries.map((c, index) => (
                                                                            <div
                                                                                key={`${c.country_code}-${index}`}
                                                                                onClick={() => {
                                                                                    const code = c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`;
                                                                                    setSelectedPhoneCode(code);
                                                                                    setIsPhoneCodeOpen(false);
                                                                                    setPhoneCodeSearch("");
                                                                                    if (org.authorize_representative_phone.startsWith("0")) {
                                                                                        setOrg(prev => ({
                                                                                            ...prev,
                                                                                            authorize_representative_phone: prev.authorize_representative_phone.substring(1)
                                                                                        }));
                                                                                    }
                                                                                }}
                                                                                className="px-4 py-2.5 text-[14px] font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-between"
                                                                            >
                                                                                <div className="flex items-center justify-between gap-2 w-full truncate">
                                                                                    <span className="text-primary font-bold w-12">{c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`}</span>
                                                                                    <span className="text-gray-500 dark:text-gray-400 text-xs truncate">{c.country}</span>
                                                                                </div>
                                                                                {selectedPhoneCode === (c.phone_code.startsWith("+") ? c.phone_code : `+${c.phone_code}`) && (
                                                                                    <Check size={14} className="text-primary shrink-0" />
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 text-xs italic">
                                                                            No results
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col">
                                                        <Input
                                                            id="rep_phone"
                                                            placeholder="Enter phone number"
                                                            value={org.authorize_representative_phone}
                                                            onChange={(e) => {
                                                                let val = e.target.value;
                                                                if (val.startsWith("0")) {
                                                                    val = val.substring(1);
                                                                }
                                                                setOrg({ ...org, authorize_representative_phone: val });
                                                                clearValidationError("rep_phone");
                                                            }}
                                                            required
                                                            className={`flex-1 ${validationErrors.rep_phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                        />
                                                        {validationErrors.rep_phone && (
                                                            <p className="text-xs text-red-500 mt-1">{validationErrors.rep_phone}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep3}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {org.country === "New Zealand" ? (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Supporting Documents</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Please upload your business registration document to complete the process.</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="nz_cert" className="text-sm font-semibold">Business Registration Document <span className="text-red-500">*</span></Label>
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        id="nz_cert"
                                                        type="file"
                                                        accept="image/*,.pdf,.doc,.docx"
                                                        onChange={(e) => {
                                                            setOrg({ ...org, business_registration_certificate: e.target.files?.[0] || null });
                                                            clearValidationError("nz_cert");
                                                        }}
                                                        className={`cursor-pointer ${validationErrors.nz_cert ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                        required
                                                    />
                                                    {validationErrors.nz_cert && (
                                                        <p className="text-xs text-red-500">{validationErrors.nz_cert}</p>
                                                    )}
                                                    {org.business_registration_certificate && (
                                                        <p className="text-xs text-green-500 flex items-center gap-1">
                                                            <Check size={12} /> {(org.business_registration_certificate as File).name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-6">
                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="compliance"
                                                    checked={isComplianceAgreed}
                                                    onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="compliance"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I have read and agree to the{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsComplianceModalOpen(true);
                                                        }}
                                                    >
                                                        Privacy Policy and Terms
                                                    </span>.
                                                </label>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <Checkbox
                                                    id="phone-billing"
                                                    checked={isPhoneBillingAgreed}
                                                    onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                                />
                                                <label
                                                    htmlFor="phone-billing"
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    I understand how{" "}
                                                    <span
                                                        className="text-primary hover:underline font-bold"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setIsPhoneBillingModalOpen(true);
                                                        }}
                                                    >
                                                        CallPilot phone numbers are assigned, used, and billed
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNZFinalSubmit}
                                                disabled={isSaving || !isComplianceAgreed || !isPhoneBillingAgreed}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                {isSaving ? "Submitting..." : "Submit"}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Supporting Documents</h3>
                                            {/* <p className="text-sm text-gray-500 dark:text-gray-400">Upload required documents for verification.</p> */}
                                        </div>

                                        {/* Preview Section */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Registered Business Name</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_name || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Number</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.reg_number || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Name</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_first_name} {org.authorize_representative_last_name}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Email</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_email}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Phone</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_phone}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Street Address</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.street_address || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Town / City</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.city || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">State</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.province || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Postcode / ZIP</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.post_code || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Country</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.country || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">APT/Suite</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.apt_or_suite || "N/A"}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label htmlFor="cert" className="text-sm font-semibold">Business Registration Certificate <span className="text-red-500">*</span></Label>
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        id="cert"
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            setOrg({ ...org, business_registration_certificate: e.target.files?.[0] || null });
                                                            clearValidationError("cert");
                                                        }}
                                                        className={`cursor-pointer ${validationErrors.cert ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                        required
                                                    />
                                                    {validationErrors.cert && (
                                                        <p className="text-xs text-red-500">{validationErrors.cert}</p>
                                                    )}
                                                    {org.business_registration_certificate && (
                                                        <p className="text-xs text-green-500 flex items-center gap-1">
                                                            <Check size={12} /> {(org.business_registration_certificate as File).name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="proof" className="text-sm font-semibold">Proof of Address <span className="text-red-500">*</span></Label>
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        id="proof"
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            setOrg({ ...org, proof_of_address: e.target.files?.[0] || null });
                                                            clearValidationError("proof");
                                                        }}
                                                        className={`cursor-pointer ${validationErrors.proof ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                        required
                                                    />
                                                    {validationErrors.proof && (
                                                        <p className="text-xs text-red-500">{validationErrors.proof}</p>
                                                    )}
                                                    <p className="text-[10px] text-gray-500 italic">Utility Bill or Tax Notice Or Rent</p>
                                                    {org.proof_of_address && (
                                                        <p className="text-xs text-green-500 flex items-center gap-1">
                                                            <Check size={12} /> {(org.proof_of_address as File).name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCurrentStep(1)}
                                                className="px-8"
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                onClick={handleNextStep4}
                                                className="bg-primary hover:bg-primary/90 text-white px-8"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {currentStep === 5 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Review & Submit</h3>
                                    {/* <p className="text-sm text-gray-500 dark:text-gray-400">Please review all information before final submission.</p> */}
                                </div>

                                <div className="space-y-6">
                                    {/* Step 1 Preview */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            Business Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Registered Business Name</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_name || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Number</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.reg_number || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Authority</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_registration_authority || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Website</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.business_website || "N/A"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 Preview */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            Registered Business Address
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Street Address</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.street_address || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Town / City</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.city || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">State / Province</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.province || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Postcode / ZIP</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.post_code || "N/A"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Country</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {org.country ? `${org.country_iso_code ? `(${org.country_iso_code}) ` : ""}${org.country}` : "N/A"}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">APT/Suite</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.apt_or_suite || "N/A"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3 Preview */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            Authorize Representative Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Name</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_first_name} {org.authorize_representative_last_name}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Email</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_email}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Authorize Representative Phone</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.authorize_representative_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 4 Preview */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            Supporting Documents
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Business Registration Certificate</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                    {org.business_registration_certificate ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFilePreview(org.business_registration_certificate as File)}
                                                            className="flex items-center gap-2 text-primary hover:text-primary/70 hover:underline transition-all group font-bold bg-primary/5 px-2 py-1 rounded"
                                                        >
                                                            <Check size={14} className="text-green-500" />
                                                            {org.business_registration_certificate.name}
                                                            <Search size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400">No file uploaded</span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Proof of Address</p>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                    {org.proof_of_address ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFilePreview(org.proof_of_address as File)}
                                                            className="flex items-center gap-2 text-primary hover:text-primary/70 hover:underline transition-all group font-bold bg-primary/5 px-2 py-1 rounded"
                                                        >
                                                            <Check size={14} className="text-green-500" />
                                                            {org.proof_of_address.name}
                                                            <Search size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400">No file uploaded</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <Checkbox
                                            id="compliance"
                                            checked={isComplianceAgreed}
                                            onCheckedChange={(checked) => setIsComplianceAgreed(checked === true)}
                                        />
                                        <label
                                            htmlFor="compliance"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            I have read and agree to the{" "}
                                            <span
                                                className="text-primary hover:underline font-bold"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setIsComplianceModalOpen(true);
                                                }}
                                            >
                                                Privacy Policy and Terms
                                            </span>.
                                        </label>
                                    </div>

                                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                        <Checkbox
                                            id="phone-billing"
                                            checked={isPhoneBillingAgreed}
                                            onCheckedChange={(checked) => setIsPhoneBillingAgreed(checked === true)}
                                        />
                                        <label
                                            htmlFor="phone-billing"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            I understand how{" "}
                                            <span
                                                className="text-primary hover:underline font-bold"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setIsPhoneBillingModalOpen(true);
                                                }}
                                            >
                                                CallPilot phone numbers are assigned, used, and billed
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-between pt-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentStep(1)}
                                        className="px-8"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving || !isComplianceAgreed || !isPhoneBillingAgreed}
                                        className="bg-primary hover:bg-primary/90 text-white px-8"
                                    >
                                        {isSaving ? "Submitting..." : "Submit Verification"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                    <p>
                        Need help?{" "}
                        <a
                            href="mailto:contact@swiftwave.ai"
                            className="text-primary hover:underline font-medium"
                        >
                            Contact Support.
                        </a>
                    </p>
                </div>
            </main>

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
        </div>
    );
}
