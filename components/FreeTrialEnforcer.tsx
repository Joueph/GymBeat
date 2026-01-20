import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRevenueCat } from '../components/providers/RevenueCatProvider';
import { auth } from '../firebaseconfig';
import { getUserProfile, grantFreeTrial } from '../userService';
import { FreeTrialModal } from './Paywall/FreeTrialModal';
import { PremiumWalkthroughModal } from './Paywall/PremiumWalkthroughModal';

export function FreeTrialEnforcer() {
    const [showModal, setShowModal] = useState(false);
    const [showWalkthrough, setShowWalkthrough] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { isPro } = useRevenueCat();
    // We access RevenueCat Pro status. 
    // If they are Pro (via sub OR valid premiumUntil), we generally don't show the modal.
    // However, the requirement is: "push the modal in case premiumUntil is empty".
    // If premiumUntil is empty, `isPro` (from provider) returns false UNLESS they have a paid sub.
    // So if `!isPro`, it's safe to check premiumUntil.
    // Even if they HAVE a paid sub, premiumUntil might be empty. Should we show it then?
    // Probably not. If they are paying, don't annoy them with a free trial.

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const checkEligibility = async () => {
                // If already detected as Pro (by revenuecat or existing trial), don't bother.
                // NOTE: isPro in provider handles "valid premiumUntil". 
                // So if isPro is true, either they paid or they have a valid trial.
                // If they have a valid trial, premiumUntil is NOT empty.
                // If they paid, premiumUntil might be empty, but we shouldn't show trial.
                if (isPro) return;

                const user = auth.currentUser;
                if (!user) return;

                try {
                    const profile = await getUserProfile(user.uid);
                    // Requirement: "push the modal in case premiumUntil is empty"
                    if (profile && !profile.premiumUntil) {
                        if (isActive) setShowModal(true);
                    }
                } catch (error) {
                    console.error("Error checking trial eligibility", error);
                }
            };

            checkEligibility();

            return () => { isActive = false; };
        }, [isPro])
    );

    const handleRedeem = async () => {
        setIsLoading(true);
        try {
            if (auth.currentUser) {
                await grantFreeTrial(auth.currentUser.uid, 14);
                // After granting, the specific screen (and app) will re-render
                // and `isPro` will become true locally via provider update or next fetch.
                // We should also close the modal manually to be sure.
                setShowModal(false);
                setShowWalkthrough(true);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Erro", "Não foi possível ativar o trial.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <FreeTrialModal
                visible={showModal}
                onRedeem={handleRedeem}
                isLoading={isLoading}
            />
            <PremiumWalkthroughModal
                visible={showWalkthrough}
                onComplete={() => setShowWalkthrough(false)}
            />
        </>
    );
}
