import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Syncs language preference based on authentication state.
 * - When user logs in: switches to Korean
 * - When user logs out: switches to English
 */
export function useAuthLanguageSync() {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const prevUserId = prevUserRef.current;

    // User just logged in (was null, now has value)
    if (currentUserId && !prevUserId) {
      setLanguage('ko');
    }
    
    // User just logged out (had value, now null)
    if (!currentUserId && prevUserId) {
      setLanguage('en');
    }

    prevUserRef.current = currentUserId;
  }, [user, setLanguage]);
}
