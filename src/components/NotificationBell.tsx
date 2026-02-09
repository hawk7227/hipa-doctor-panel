// ============================================================================
// NOTIFICATION BELL — UI component for enabling/disabling push notifications
// Place in: /src/components/NotificationBell.tsx
// Works on both doctor dashboard and admin page
// ============================================================================

'use client';

import { useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Check } from 'lucide-react';
import { usePushNotifications } from '@/lib/usePushNotifications';

interface NotificationBellProps {
  userId: string | null;
  userRole: 'provider' | 'admin' | 'assistant';
  userName?: string;
}

export default function NotificationBell({ userId, userRole, userName }: NotificationBellProps) {
  const { isSupported, isSubscribed, permission, isLoading, subscribe, unsubscribe } = usePushNotifications({
    userId,
    userRole,
    userName,
  });
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isSupported) return null; // Browser doesn't support push

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`relative p-2 rounded-lg transition-all ${
          isSubscribed
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : permission === 'denied'
            ? 'bg-red-500/10 text-red-400 cursor-not-allowed opacity-50'
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
        }`}
        title={
          isSubscribed
            ? 'Notifications enabled — click to disable'
            : permission === 'denied'
            ? 'Notifications blocked — enable in browser settings'
            : 'Enable notifications'
        }
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isSubscribed ? (
          <>
            <BellRing className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0a0a12]" />
          </>
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-xs text-white whitespace-nowrap z-50 shadow-xl">
          {isSubscribed ? (
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-green-400" />
              <span>Notifications on — click to turn off</span>
            </div>
          ) : permission === 'denied' ? (
            <span className="text-red-400">Blocked — update browser settings</span>
          ) : (
            <span>Click to enable push notifications</span>
          )}
        </div>
      )}
    </div>
  );
}
