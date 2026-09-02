import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export const ConnectionBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center space-x-2 transition-all shadow-md ${
        isOnline
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-600 text-white animate-pulse'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Connection Restored - Online</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Working Offline - Stock transactions require server confirmation</span>
        </>
      )}
    </div>
  );
};
