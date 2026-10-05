'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Zap,
  Volume2,
  ImageIcon,
  Video,
  Bot,
  BarChart3,
  Key,
  LayoutGrid,
  FileText,
  Database,
  Layers,
  Compass,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  X,
  BookOpen,
  Users,
  Settings,
  Package,
  Sparkles,
  Code,
  Globe,
  Phone,
  Shuffle,
  User,
  CreditCard,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserProfilePanel } from './user-profile-panel';
import { profileService } from '@/services/profile-service';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}


export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Check if current route is a settings page to initialize the view
  const isSettingsPage = pathname === '/dashboard/profile' || pathname === '/dashboard/organization' || pathname === '/dashboard/billing' || pathname === '/dashboard/help/support-tickets' || pathname === '/dashboard/users';

  const [showUserPanel, setShowUserPanel] = useState(false);
  const [isSettingsView, setIsSettingsView] = useState(isSettingsPage);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await profileService.getOrganization();
        if (response.data && response.data.role) {
          setCurrentUserRole(response.data.role);
        }
      } catch (err) {
        console.error('Error fetching organization in sidebar:', err);
      }
    };
    fetchUserRole();
  }, []);

  // Sync state if navigating to a settings page specifically
  useEffect(() => {
    if (isSettingsPage) {
      setIsSettingsView(true);
    } else if (pathname === '/dashboard') {
      setIsSettingsView(false);
    }
  }, [pathname, isSettingsPage]);

  const isVoipUser = currentUserRole === 'VOIP_USER';

  const menuItems = isVoipUser
    ? [
      { label: 'AI Flows', isHeader: true },
      { icon: Shuffle, label: 'AI Call Builder', href: '/dashboard/phone-call-flows', isBold: true },
    ]
    : [
      { icon: LayoutGrid, label: 'AI Control Centre', href: '/dashboard', isBold: true },
      { label: 'Integrations', isHeader: true },
      { icon: Globe, label: 'Connect ATS', href: '/dashboard/connect-ats', isBold: true },
      { icon: Phone, label: 'Business Phone Numbers', href: '/dashboard/phone-numbers', isBold: true },
      { label: 'AI Flows', isHeader: true },
      { icon: Shuffle, label: 'AI Call Builder', href: '/dashboard/phone-call-flows', isBold: true },
      { label: 'Report', isHeader: true },
      { icon: FileText, label: 'Call Activity', href: '/dashboard/call-logs', isBold: true },
    ];

  const settingsMenuItems = [
    { label: 'Settings', isHeader: true },
    { icon: User, label: 'Profile', href: '/dashboard/profile', isBold: true },
    { label: 'Organization', isHeader: true },
    { icon: FileText, label: 'Business Details', href: '/dashboard/organization', isBold: true },
    ...(currentUserRole !== 'STAFF' && currentUserRole !== 'VOIP_USER' ? [{ icon: CreditCard, label: 'Billing', href: '/dashboard/billing', isBold: true }] : []),
    ...(currentUserRole !== 'STAFF' && currentUserRole !== 'VOIP_USER' ? [{ icon: Users, label: 'Users', href: '/dashboard/users', isBold: true }] : []),
    { label: 'Support Tickets', isHeader: true },
    { icon: MessageSquare, label: 'Support Tickets', href: '/dashboard/help/support-tickets', isBold: true },
  ];

  const currentMenuItems = isSettingsView ? settingsMenuItems : menuItems;

  const handleViewToggle = () => {
    if (isSettingsView) {
      // Switching from Settings back to Dashboard / Flows
      setIsSettingsView(false);
      router.push(isVoipUser ? '/dashboard/phone-call-flows' : '/dashboard');
    } else {
      // Switching from Dashboard to Settings
      setIsSettingsView(true);
      router.push('/dashboard/profile');
    }
  };

  return (
    <>
      {/* Mobile overlay - only on mobile, not tablets */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-[90vh] md:h-screen w-full md:w-52 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-r border-b md:border-b-0 border-violet-100 dark:border-white/10 shadow-[4px_0_30px_-18px_rgba(22,104,245,0.35)] rounded-b-3xl md:rounded-none flex flex-col transition-transform duration-300 z-50 md:relative md:translate-x-0 md:z-auto ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Header - Logo area */}
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200 dark:border-gray-800 relative">
          <div className="flex items-center justify-center">
            <img
              onClick={() => router.push(isVoipUser ? '/dashboard/phone-call-flows' : '/dashboard')}
              src="/callpilot_logo.png"
              alt="CallPilot Logo"
              className="h-12 w-auto object-contain brightness-100 cursor-pointer"
            />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition shadow-sm border border-gray-100 dark:border-gray-700 md:hidden absolute right-4"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs - Hidden as per design */}
        <div className="px-4 py-2 md:hidden">
          <div className="flex bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-lg">
          </div>
        </div>

        {/* Navigation content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <nav className="space-y-3">
            {currentMenuItems.map((item, index) => {
              if (item.isHeader) {
                return (
                  <div key={index} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mt-6 mb-2 px-3">
                    {item.label}
                  </div>
                );
              }
              const isActive = pathname === item.href;
              return (
                <Link
                  key={index}
                  href={item.href || '#'}
                  style={{ animationDelay: `${index * 20}ms` }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 text-[15px] rounded-xl transition-all duration-200 group animate-fade-up ${isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  {isActive && (
                    <span aria-hidden className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary animate-scale-in" />
                  )}
                  {item.icon && (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary'
                        }`}
                    >
                      <item.icon size={18} strokeWidth={2} />
                    </span>
                  )}
                  <span className={isActive || item.isBold ? 'text-[13px] font-semibold' : 'text-[13px] font-medium'}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-7 py-6 bg-transparent relative flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/helps"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-md"
              >
                <HelpCircle size={16} strokeWidth={2.5} className="text-gray-500 dark:text-gray-500 h-[18px] w-[18px]" />
                <span>Help</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleViewToggle}
                className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-md"
              >
                {isSettingsView ? (
                  <>
                    <LayoutGrid size={16} strokeWidth={2.5} className="text-gray-500 dark:text-gray-500 h-[18px] w-[18px]" />
                    <span>Dashboard</span>
                  </>
                ) : (
                  <>
                    <Settings size={16} strokeWidth={2.5} className="text-gray-500 dark:text-gray-500 h-[18px] w-[18px]" />
                    <span>Settings</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowUserPanel(!showUserPanel)}
              className="relative md:hidden w-8 h-8 rounded-full border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="User menu"
            >
              <User size={18} />
            </button>
          </div>

          {showUserPanel && (
            <div className="absolute bottom-full right-4 mb-2 md:hidden">
              <UserProfilePanel onClose={() => setShowUserPanel(false)} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
