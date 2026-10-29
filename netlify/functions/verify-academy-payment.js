
import {
    json,
    readBody,
    supabaseRequest,
    sendEmail,
    escapeHtml,
    methodNotAllowed
} from "./academy-utils.js";

const PRODUCT_CODE = "nextbranch_academy_first_website_ai";
const COURSE_URL = "https://nextbranch.com.ng/academy/";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        const { reference } = readBody(event);

        if (!secret) {
            throw new Error("PAYSTACK_SECRET_KEY is missing.");
        }

        if (
            typeof reference !== "string" ||
            !/^NBA_[A-Za-z0-9_]+$/.test(reference)
        ) {
            return json(400, {
                success: false,
                error: "Invalid transaction reference."
            });
        }

        const response = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
                headers: {
                    Authorization: `Bearer ${secret}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok || !result.status || !result.data) {
            return json(400, {
                success: false,
                error: "We could not verify this payment."
            });
        }

        const transaction = result.data;
        const email = String(
            transaction.customer?.email || ""
        ).trim().toLowerCase();

        if (
            transaction.status !== "success" ||
            transaction.reference !== reference ||
            Number(transaction.amount) !== 150000 ||
            transaction.currency !== "NGN" ||
            transaction.metadata?.product_code !== PRODUCT_CODE ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return json(402, {
                success: false,
                error: "This transaction does not match a completed course purchase."
            });
        }

        // Check whether this transaction has already been recorded.
        const existing = await supabaseRequest(
            `academy_purchases?reference=eq.${encodeURIComponent(reference)}&select=reference,email,amount,currency,status&limit=1`
        );

        if (existing?.length) {
            const purchase = existing[0];

            if (
                purchase.email !== email ||
                Number(purchase.amount) !== 150000 ||
                purchase.currency !== "NGN" ||
                purchase.status !== "paid"
            ) {
                return json(409, {
                    success: false,
                    error: "Purchase record does not match this transaction."
                });
            }

            return json(200, {
                success: true,
                verified: true,
                email: purchase.email,
                message: "Your payment has been verified."
            });
        }

        // Save the verified purchase before attempting to send email.
        await supabaseRequest("academy_purchases", {
            method: "POST",
            headers: {
                Prefer: "return=minimal"
            },
            body: JSON.stringify({
                reference,
                email,
                product_code: PRODUCT_CODE,
                amount: 150000,
                currency: "NGN",
                status: "paid",
                paid_at: transaction.paid_at || new Date().toISOString()
            })
        });

        // Email is best-effort: a delivery failure must not invalidate
        // a payment that Paystack has already confirmed.
        try {
            await sendEmail({
                to: email,
                subject: "Payment confirmed — NextBranch Academy",
                idempotencyKey: `academy-purchase-${reference}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172335;line-height:1.7">
                        <h1 style="color:#2c73b9">Payment confirmed!</h1>

                        <p>Hello,</p>

                        <p>
                            Thank you for purchasing
                            <strong>Building Your First Website Using AI</strong>
                            from NextBranch Academy.
                        </p>

                        <div style="padding:18px;background:#f2f7fd;border-radius:12px">
                            <p style="margin:0"><strong>Product:</strong> Build Your First Website Using AI</p>
                            <p style="margin:8px 0 0"><strong>Amount paid:</strong> ₦1,500</p>
                            <p style="margin:8px 0 0;overflow-wrap:anywhere"><strong>Reference:</strong> ${escapeHtml(reference)}</p>
                        </div>

                        <p>
                            To access your course PDF and video, open the Academy
                            page using the button below. Enter the email address
                            you used for payment, request an access code, and
                            follow the instructions on the page.
                        </p>

                        <p style="margin:28px 0">
                            <a href="${COURSE_URL}" style="display:inline-block;background:#2c73b9;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">
                                Access your course
                            </a>
                        </p>

                        <p>
                            Your one-time access code will be sent separately
                            when you request it. If you have already requested
                            one, check your inbox.
                        </p>

                        <p>Thank you for learning with us.</p>
                        <p><strong>NextBranch Academy</strong></p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error(
                "Purchase verified, but confirmation email failed:",
                reference,
                emailError
            );
        }

        return json(200, {
            success: true,
            verified: true,
            email,
            message: "Your payment has been verified."
        });
    } catch (error) {
        console.error("Verify academy payment error:", error);

        return json(500, {
            success: false,
            error: "Payment verification is temporarily unavailable."
        });
    }
}
