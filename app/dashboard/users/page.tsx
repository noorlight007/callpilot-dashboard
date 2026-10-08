"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { OrganizationUsersContent } from "@/components/organization-users-content"
import { useRouter } from "next/navigation"

export default function UsersPage() {
    const router = useRouter()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isTabletOrLarger, setIsTabletOrLarger] = useState(false)

    useEffect(() => {
        const handleResize = () => {
            setIsTabletOrLarger(window.innerWidth >= 1024)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [router])



    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <Sidebar
                isOpen={isTabletOrLarger || isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <Topbar
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                <main className="flex-1 overflow-hidden flex flex-col">
                    <OrganizationUsersContent />
                </main>
            </div>
        </div>
    )
}
