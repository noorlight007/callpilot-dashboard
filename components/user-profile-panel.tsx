'use client';

import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cookieUtils } from '@/services/auth-service';
import { profileService } from '@/services/profile-service';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface UserProfilePanelProps {
  onClose: () => void;
}

interface UserData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export function UserProfilePanel({ onClose }: UserProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting until component is mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await profileService.getProfile();
        setUserData(response.data);
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = () => {
    cookieUtils.set('access', '', -1);
    cookieUtils.set('refresh', '', -1);
    onClose();
    router.push('/login');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const fullName = userData ? `${userData.first_name} ${userData.last_name}` : "Loading...";
  const email = userData ? userData.email : "Loading...";

  // Prevent hydration error: do not render theme-dependent UI until mounted
  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      className="w-[280px] bg-white/95 backdrop-blur-xl dark:bg-gray-900/95 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in duration-200"
    >
      {/* User Info */}
      <div className="mb-4">
        <div className="flex flex-col mb-4">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? "Loading..." : fullName}
          </p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">
            {isLoading ? "Loading..." : email}
          </p>
        </div>

        {/* Theme Toggles */}
        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "p-2 rounded-lg transition",
              theme === 'light'
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-600"
                : "text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm"
            )}
          >
            < Sun size={18} />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "p-2 rounded-lg transition",
              theme === 'dark'
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-600"
                : "text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm"
            )}
          >
            < Moon size={18} />
          </button>
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "p-2 rounded-lg transition text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm"
            )}
          >
            < Monitor size={18} />
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-50 dark:bg-gray-800 -mx-4 mb-3" />

      {/* Menu Items */}
      <nav className="space-y-1">
        <a
          href="/dashboard/profile"
          className="block text-[14px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 rounded-2xl transition"
        >
          Your profile
        </a>

        <a
          href="/dashboard/help"
          className="block text-[14px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 rounded-2xl transition"
        >
          Help
        </a>
        <button
          onClick={handleLogout}
          className="w-full text-left text-[14px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 px-3 py-2 rounded-2xl transition flex items-center gap-2"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </nav>
    </div>
  );
}
