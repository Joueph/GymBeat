import { useEffect, useState } from 'react';
import { useRevenueCat } from '../components/providers/RevenueCatProvider';
import { auth } from '../firebaseconfig';
import { getUserProfile } from '../userService';

interface PremiumStatus {
    isPremium: boolean;
    isTrial: boolean;
    isRevenueCat: boolean;
    isLoading: boolean;
}

export function usePremiumStatus() {
    const { isPro: isRevenueCatPro, isLoaded: isRevenueCatLoaded } = useRevenueCat();
    const [status, setStatus] = useState<PremiumStatus>({
        isPremium: false,
        isTrial: false,
        isRevenueCat: false,
        isLoading: true
    });

    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            if (!isRevenueCatLoaded) return; // Wait for RevenueCat

            // 1. Check RevenueCat First
            if (isRevenueCatPro) {
                if (isMounted) {
                    setStatus({
                        isPremium: true,
                        isTrial: false,
                        isRevenueCat: true,
                        isLoading: false
                    });
                }
                return;
            }

            // 2. Check Firestore "premiumUntil"
            try {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    // Optimized: In a real app with global state management (like Redux/Zustand),
                    // we would get the user profile from there instead of fetching again.
                    // For now, we fetch to ensure fresh data.
                    const profile = await getUserProfile(currentUser.uid);

                    if (profile && profile.premiumUntil) {
                        const premiumDate = new Date(profile.premiumUntil);
                        const now = new Date();

                        if (premiumDate > now) {
                            if (isMounted) {
                                setStatus({
                                    isPremium: true,
                                    isTrial: true,
                                    isRevenueCat: false,
                                    isLoading: false
                                });
                            }
                            return;
                        }
                    }
                }

                // 3. Fallback: Not Premium
                if (isMounted) {
                    setStatus({
                        isPremium: false,
                        isTrial: false,
                        isRevenueCat: false,
                        isLoading: false
                    });
                }

            } catch (error) {
                console.error("Error checking premium status:", error);
                if (isMounted) {
                    setStatus({
                        isPremium: false,
                        isTrial: false,
                        isRevenueCat: false,
                        isLoading: false
                    });
                }
            }
        };

        checkStatus();

        return () => { isMounted = false; };
    }, [isRevenueCatPro, isRevenueCatLoaded]);

    const router = require('expo-router').useRouter();

    const navigateToPaywall = () => {
        router.push('/paywall');
    };

    return { ...status, navigateToPaywall };
}
