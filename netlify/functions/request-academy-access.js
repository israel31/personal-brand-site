
import {
    json,
    readBody,
    normalizeEmail,
    validEmail,
    supabaseRequest,
    sendEmail,
    hashCode,
    escapeHtml,
    methodNotAllowed
} from "./academy-utils.js";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const { email: rawEmail } = readBody(event);
        const email = normalizeEmail(rawEmail);

        if (!validEmail(email)) {
            return json(200, {
                message: "If a completed purchase exists for this email, an access code has been sent."
            });
        }

        const purchases = await supabaseRequest(
            `academy_purchases?email=eq.${encodeURIComponent(email)}&status=eq.paid&product_code=eq.nextbranch_academy_first_website_ai&select=reference&limit=1`
        );

        // Use the same response whether or not a purchase exists.
        // This avoids revealing which email addresses are customers.
        if (!purchases?.length) {
            return json(200, {
                message: "If a completed purchase exists for this email, an access code has been sent."
            });
        }

        const recentCodes = await supabaseRequest(
            `academy_access_codes?email=eq.${encodeURIComponent(email)}&select=created_at&order=created_at.desc&limit=1`
        );

        if (
            recentCodes?.length &&
            Date.now() - new Date(recentCodes[0].created_at).getTime() < 60_000
        ) {
            return json(200, {
                message: "If a completed purchase exists for this email, an access code has been sent."
            });
        }

        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const code = String(random[0] % 1_000_000).padStart(6, "0");
        const codeHash = await hashCode(code);
        const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

        await supabaseRequest("academy_access_codes", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                email,
                code_hash: codeHash,
                expires_at: expiresAt,
                attempts: 0
            })
        });

        await sendEmail({
            to: email,
            subject: "Your NextBranch Academy access code",
            html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172335;line-height:1.6">
          <h2 style="color:#2c73b9">Your course access code</h2>
          <p>Use the code below to access your NextBranch Academy course.</p>
          <div style="padding:18px;background:#f2f7fd;border-radius:12px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold">
            ${code}
          </div>
          <p>This code expires in 10 minutes and can be used only once.</p>
          <p>If you did not request this code, you can ignore this email.</p>
          <p>— NextBranch Academy</p>
        </div>
      `
        });

        return json(200, {
            message: "If a completed purchase exists for this email, an access code has been sent."
        });
    } catch (error) {
        console.error("Request academy access error:", error);
        return json(500, { error: "Unable to send an access code right now. Please try again." });
    }
}
