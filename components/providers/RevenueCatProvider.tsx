import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { auth } from '../../firebaseconfig';
import { getUserProfile } from '../../userService';

interface RevenueCatContextType {
    isPro: boolean;
    customerInfo: CustomerInfo | null;
    currentOffering: PurchasesOffering | null;
    isLoaded: boolean;
    purchasePackage: (pack: PurchasesPackage) => Promise<void>;
    restorePurchases: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

const APIKeys = {
    apple: "appl_ignored_for_now", // Placeholder, will rely on the provided key for testing if platform specific keys not provided
    google: "goog_ignored_for_now",
    // The user provided a single key "test_KnXDyEbImhhosGKxUVmpApMrBYx", usually this is platform specific but for now we might use it for one or both if it's a specific test key.
    // Actually, typically you have one key per platform. 
    // Given the user provided ONE key "test_KnXDyEbImhhosGKxUVmpApMrBYx", it likely belongs to one platform or is a public key for a specific test environment.
    // RevenueCat recommends platform specific keys. 
    // REQUIRED: Please replace with your actual platform-specific keys from RevenueCat dashboard.
    // For this implementation I will use the *provided* key for both to ensure initialization happens, 
    // but the user should verify which platform this key is for.
    common: "test_KnXDyEbImhhosGKxUVmpApMrBYx"
};

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                if (Platform.OS === 'ios') {
                    await Purchases.configure({ apiKey: APIKeys.common }); // Using common key as requested
                } else if (Platform.OS === 'android') {
                    await Purchases.configure({ apiKey: APIKeys.common }); // Using common key as requested
                }

                const info = await Purchases.getCustomerInfo();
                setCustomerInfo(info);

                const offerings = await Purchases.getOfferings();
                if (offerings.current) {
                    setCurrentOffering(offerings.current);
                }
            } catch (e) {
                console.error("RevenueCat Init Error", e);
            } finally {
                setIsLoaded(true);
            }
        };

        init();
    }, []);

    const [isTrial, setIsTrial] = useState(false);



    // Check for trial status
    useEffect(() => {
        const checkTrial = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const profile = await getUserProfile(user.uid);
                    if (profile && profile.premiumUntil) {
                        const premiumDate = new Date(profile.premiumUntil);
                        if (premiumDate > new Date()) {
                            setIsTrial(true);
                            return;
                        }
                    }
                } catch (e) {
                    // Fail silently or log
                    console.log("Error checking trial status", e);
                }
            }
            setIsTrial(false);
        };

        checkTrial();
        // Re-check when auth user changes could be added if we had an auth listener here, 
        // but for now on mount or component update is acceptable. 
        // Ideally we would depend on an auth context.
    }, [customerInfo]); // Re-check when customer info changes (e.g. login/restore)

    const isRevenueCatPro = customerInfo?.entitlements.active['GymBeat Pro'] !== undefined;
    const isPro = isRevenueCatPro || isTrial;

    const purchasePackage = async (pack: PurchasesPackage) => {
        try {
            const { customerInfo: updatedInfo } = await Purchases.purchasePackage(pack);
            setCustomerInfo(updatedInfo);
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Error', e.message);
            }
        }
    };

    const restorePurchases = async () => {
        try {
            const info = await Purchases.restorePurchases();
            setCustomerInfo(info);
            if (info.entitlements.active['GymBeat Pro']) {
                Alert.alert('Sucesso', 'Compras restauradas com sucesso!');
            } else {
                Alert.alert('Aviso', 'Nenhuma assinatura ativa encontrada para restaurar.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    return (
        <RevenueCatContext.Provider value={{ isPro, customerInfo, currentOffering, isLoaded, purchasePackage, restorePurchases }}>
            {children}
        </RevenueCatContext.Provider>
    );
}

export const useRevenueCat = () => {
    const context = useContext(RevenueCatContext);
    if (!context) {
        throw new Error("useRevenueCat must be used within a RevenueCatProvider");
    }
    return context;
};
