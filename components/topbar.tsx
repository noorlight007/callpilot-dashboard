'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Settings, Phone, MessageSquare, ChevronUp, User, Check } from 'lucide-react';
import { UserProfilePanel } from './user-profile-panel';
import { cn } from '@/lib/utils';
import { profileService } from '@/services/profile-service';

interface TopbarProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

export function Topbar({ onMenuClick, isSidebarOpen }: TopbarProps) {
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [organization, setOrganization] = useState<any>(null);
  const [myOrganizations, setMyOrganizations] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const orgResponse = await profileService.getOrganization();
        if (orgResponse.data) {
          setOrganization(orgResponse.data);
          // setSelectedOrg(orgResponse.data.business_name || '');
        }

        const myOrgsResponse = await profileService.getMyOrganizations();
        if (myOrgsResponse.data && myOrgsResponse.data.results) {
          setMyOrganizations(myOrgsResponse.data.results);
          const activeOrg = myOrgsResponse.data.results.find((o: any) => o.is_active);
          if (activeOrg) {
            setSelectedOrg(activeOrg.organization?.name || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch organization data:', error);
      }
    };
    fetchOrgData();
  }, []);

  const handleSwitchOrg = async (uid: string, orgName: string) => {
    try {
      await profileService.switchOrganization(uid);
      window.location.reload();
      setSelectedOrg(orgName);
      setIsOrgDropdownOpen(false);
    } catch (error) {
      console.error('Failed to switch organization:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl border-b border-violet-100 dark:border-white/10 h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
        {/* Left section - Logo and project selector */}
        <div className="flex items-center gap-2 md:gap-6">
          {/* Project selector */}
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => selectedOrg && setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded-lg transition-colors"
            >
              {selectedOrg ? (
                <>
                  <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">{selectedOrg}</span>
                  <div className="flex flex-col -space-y-1">
                    <ChevronUp size={10} className={cn("transition-colors", isOrgDropdownOpen ? "text-gray-900 dark:text-gray-100" : "text-gray-400")} />
                    <ChevronDown size={10} className={cn("transition-colors", !isOrgDropdownOpen ? "text-gray-900 dark:text-gray-100" : "text-gray-400")} />
                  </div>
                </>
              ) : (
                <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-850 rounded animate-pulse" />
              )}
            </div>

            {/* Organizations Dropdown */}
            {isOrgDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl py-3 z-50 animate-in fade-in zoom-in duration-200 max-h-96 overflow-y-auto">
                {myOrganizations.length > 0 ? (
                  (() => {
                    const myAccountOrgs = myOrganizations.filter((org: any) => org.role === 'OWNER');
                    const sharedAccountOrgs = myOrganizations.filter((org: any) => org.role !== 'OWNER');

                    return (
                      <>
                        {myAccountOrgs.length > 0 ? (
                          <>
                            <div className="px-4 mb-2">
                              <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">My Account</span>
                            </div>
                            {myAccountOrgs.map((orgMember: any) => {
                              const orgName = orgMember.organization?.name || 'Your Business';
                              const orgRole = orgMember.role || '';
                              const isSelected = orgMember.is_active;

                              return (
                                <div
                                  key={orgMember.uid}
                                  onClick={() => handleSwitchOrg(orgMember.uid, orgName)}
                                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                  <div className="w-4 flex justify-center flex-shrink-0">
                                    {isSelected ? (
                                      <Check size={14} className="text-gray-600 dark:text-gray-400" />
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {(orgName?.[0] || 'P').toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {orgName} {orgRole ? `(${orgRole})` : ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <div className="px-4 mb-2">
                              <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">My Account</span>
                            </div>
                            <div className="px-4 py-2">
                              <button
                                onClick={() => window.open("https://callpilot.pro/get-started", "_blank")}
                                className="w-full text-left text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors flex items-center gap-1.5"
                              >
                                + Create your own account
                              </button>
                            </div>
                          </>
                        )}

                        {sharedAccountOrgs.length > 0 && (
                          <>
                            <div className="px-4 mb-2 mt-4">
                              <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">Shared Accounts</span>
                            </div>
                            {sharedAccountOrgs.map((orgMember: any) => {
                              const orgName = orgMember.organization?.name || 'Your Business';
                              const orgRole = orgMember.role || '';
                              const isSelected = orgMember.is_active;

                              return (
                                <div
                                  key={orgMember.uid}
                                  onClick={() => handleSwitchOrg(orgMember.uid, orgName)}
                                  className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                  <div className="w-4 flex justify-center flex-shrink-0">
                                    {isSelected ? (
                                      <Check size={14} className="text-gray-600 dark:text-gray-400" />
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {(orgName?.[0] || 'P').toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                        {orgName} {orgRole ? `(${orgRole})` : ''}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div className="px-4 mb-2">
                      <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">My Account</span>
                    </div>
                    <div
                      onClick={() => {
                        setSelectedOrg(organization?.business_name || 'Your Business');
                        setIsOrgDropdownOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="w-4 flex justify-center">
                        {selectedOrg === (organization?.business_name || 'Your Business') ? (
                          <Check size={14} className="text-gray-600 dark:text-gray-400" />
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-violet-500 shadow-md shadow-blue-600/30 hover:brightness-110 hover:-translate-y-0.5 flex items-center justify-center text-white text-xs font-bold">
                          {(organization?.business_name?.[0] || 'P').toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {organization?.business_name || 'Your Business'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right section - Navigation and user */}
        <div className="flex items-center gap-4 md:gap-8">
          {/* User profile button */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowUserPanel(!showUserPanel)}
              className="w-8 h-8 rounded-full border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex-shrink-0"
              aria-label="User menu"
            >
              <User size={18} />
            </button>

            {/* User Profile Panel */}
            {showUserPanel && (
              <div className="absolute right-0 top-full mt-2 z-50">
                <UserProfilePanel onClose={() => setShowUserPanel(false)} />
              </div>
            )}
          </div>
          <button
            onClick={onMenuClick}
            className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 flex-shrink-0"
            aria-label="Toggle menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>
    </>
  );
}
