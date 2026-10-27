
import {
    json,
    readBody,
    supabaseRequest,
    methodNotAllowed
} from "./academy-utils.js";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const { reference } = readBody(event);

        if (!secret) throw new Error("PAYSTACK_SECRET_KEY is missing.");

        if (
            typeof reference !== "string" ||
            !/^NBA_[A-Za-z0-9_]+$/.test(reference)
        ) {
            return json(400, { error: "Invalid transaction reference." });
        }

        const response = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
                headers: { Authorization: `Bearer ${secret}` }
            }
        );

        const result = await response.json();

        if (!response.ok || !result.status || !result.data) {
            return json(400, { error: "We could not verify this payment." });
        }

        const transaction = result.data;
        const email = String(transaction.customer?.email || "").trim().toLowerCase();

        if (
            transaction.status !== "success" ||
            transaction.reference !== reference ||
            Number(transaction.amount) !== 150000 ||
            transaction.currency !== "NGN" ||
            transaction.metadata?.product_code !==
            "nextbranch_academy_first_website_ai" ||
            !email
        ) {
            return json(402, {
                error: "This transaction does not match a completed course purchase."
            });
        }

        // Idempotency: if Paystack redirects the customer more than once,
        // do not create duplicate purchase records.
        const existing = await supabaseRequest(
            `academy_purchases?reference=eq.${encodeURIComponent(reference)}&select=reference,email,amount,currency&limit=1`
        );

        if (existing?.length) {
            const purchase = existing[0];

            if (purchase.email !== email || Number(purchase.amount) !== 150000) {
                return json(409, { error: "Purchase record does not match this transaction." });
            }

            return json(200, {
                verified: true,
                email: purchase.email
            });
        }

        await supabaseRequest("academy_purchases", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                reference,
                email,
                product_code: "nextbranch_academy_first_website_ai",
                amount: 150000,
                currency: "NGN",
                status: "paid",
                paid_at: transaction.paid_at || new Date().toISOString()
            })
        });

        return json(200, { verified: true, email });
    } catch (error) {
        console.error("Verify academy payment error:", error);
        return json(500, { error: "Payment verification is temporarily unavailable." });
    }
}
