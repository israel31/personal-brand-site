
import {
    json,
    readBody,
    normalizeEmail,
    validEmail,
    methodNotAllowed
} from "./academy-utils.js";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) {
            throw new Error("PAYSTACK_SECRET_KEY is not configured.");
        }

        const { email: rawEmail } = readBody(event);
        const email = normalizeEmail(rawEmail);

        if (!validEmail(email)) {
            return json(400, { error: "Enter a valid email address." });
        }

        const returnUrl =
            process.env.ACADEMY_RETURN_URL ||
            "https://nextbranch.com.ng/academy/";

        const reference =
            "NBA_" +
            Date.now() +
            "_" +
            crypto.randomUUID().replace(/-/g, "").slice(0, 12);

        const response = await fetch(
            "https://api.paystack.co/transaction/initialize",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    amount: 150000,
                    currency: "NGN",
                    reference,
                    callback_url: returnUrl,
                    metadata: {
                        product_code: "nextbranch_academy_first_website_ai",
                        product_name: "Build Your First Website Using AI",
                        custom_fields: [
                            {
                                display_name: "Product",
                                variable_name: "product",
                                value: "NextBranch Academy beginner website course"
                            }
                        ]
                    }
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.status || !result.data?.authorization_url) {
            console.error("Paystack initialization failed:", result);
            return json(502, { error: "Checkout could not be started. Please try again." });
        }

        return json(200, {
            authorization_url: result.data.authorization_url,
            reference: result.data.reference
        });
    } catch (error) {
        console.error("Initialize academy payment error:", error);
        return json(500, { error: "Unable to start checkout right now." });
    }
}
