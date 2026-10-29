'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/topbar';
import { Sidebar } from '@/components/sidebar';
import { DashboardContent } from '@/components/dashboard-content';
import { authService, cookieUtils } from '@/services/auth-service';
import { profileService } from '@/services/profile-service';

export default function DashboardPage() {
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(true);
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
                    if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                        router.push('/activation');
                        return;
                    }
                    setIsAuthenticated(true);
                } else {
                    // Try refresh
                    const refreshRes = await authService.refreshToken(refreshToken);
                    if (refreshRes.ok) {
                        const data = await refreshRes.json();
                        cookieUtils.set('access', data.access, 7);
                        cookieUtils.set('refresh', data.refresh, 7);

                        const statusRes = await profileService.getPlatformStatus();
                        const complianceStatus = statusRes.data.compliance_status;
                        if (complianceStatus === "" || complianceStatus === null || complianceStatus === "rejected") {
                            router.push('/activation');
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

    useEffect(() => {
        // Check if viewport is tablet or larger (768px+)
        const checkViewport = () => {
            const isTabletUp = window.innerWidth >= 768;
            setIsTabletOrLarger(isTabletUp);
            // Always open sidebar on tablet and larger
            if (isTabletUp) {
                setIsSidebarOpen(true);
            }
        };

        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, []);

    if (isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
            {/* Sidebar - always visible on tablet+, toggleable on mobile */}
            <Sidebar
                isOpen={isTabletOrLarger || isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Navigation Bar */}
                <Topbar
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                {/* Dashboard content */}
                <DashboardContent />
            </div>
        </div>
    );
}
