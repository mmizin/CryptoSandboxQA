/**
 * Saved payment method (`user_payment_methods`).
 */

export type PaymentMethodType = "card" | "sepa" | "applepay";

export type UserPaymentMethod = {
    id: string;
    userId: string;
    type: PaymentMethodType;
    maskedDetails: Record<string, unknown>;
    isDefault: boolean;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
};
