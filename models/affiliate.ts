import { Timestamp } from 'firebase/firestore';

/**
 * Represents an influencer or partner who owns affiliate codes.
 * Collection: `influencers`
 */
export interface Influencer {
    id: string; // Auto-generated ID
    name: string;
    email: string; // Contact email
    status: 'active' | 'suspended';

    // Payment information for payouts
    paymentDetails: {
        method: 'paypal' | 'bank_transfer' | 'pix';
        identifier: string; // e.g., email or PIX key
        notes?: string;
    };

    // Aggregated stats for quick access
    stats: {
        totalReferrals: number; // Count of unique user activations
        totalCommissionsValue: number; // Sum of all commissions (in cents)
        paidCommissionsValue: number; // Sum of paid out commissions (in cents)
    };

    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * A unique code that users enter to attribute their account to an influencer.
 * Collection: `affiliate_codes`
 * Document ID: The code itself (uppercased), e.g., "GYM20"
 */
export interface AffiliateCode {
    code: string; // The code string (PK)
    influencerId: string; // Reference to Influencers collection
    type: 'standard' | 'campaign';

    // Optional discount configuration for the user
    discountConfig?: {
        type: 'percent' | 'fixed';
        value: number; // e.g., 10 for 10%
        duration: 'once' | 'forever' | 'repeating';
    };

    // Commission configuration for the influencer
    commissionConfig: {
        rate: number; // e.g., 0.20 for 20%
    };

    isActive: boolean;
    campaignTag?: string; // For grouping codes in analytics

    createdAt: Timestamp;
}

/**
 * Represents the link between a user and an affiliate code.
 * Collection: `referrals`
 * Document ID: The User ID (userId) of the person who used the code.
 * 1:1 Enforced by using userId as doc ID.
 */
export interface Referral {
    id: string; // = userId
    userId: string;
    code: string; // The code used
    influencerId: string; // Denormalized for query speed

    activatedAt: Timestamp;
    status: 'active';

    metadata: {
        source: 'registration' | 'profile'; // Where they entered the code
    };
}

/**
 * A record of a commission earned from a transaction.
 * Collection: `commissions`
 */
export interface Commission {
    id: string; // Auto-generated
    influencerId: string;
    referralId: string; // The userId who made the purchase

    // Source transaction details from RevenueCat / Payment Provider
    sourceTransactionId: string;
    originalTransactionId?: string; // For subscriptions
    productId: string;

    amount: number; // Commission amount in cents
    currency: string; // e.g., 'BRL', 'USD'

    status: 'pending' | 'paid' | 'clawback';

    createdAt: Timestamp;
    paidAt?: Timestamp;
}
