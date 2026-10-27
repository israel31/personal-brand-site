
import {
    json,
    readBody,
    normalizeEmail,
    validEmail,
    supabaseRequest,
    hashCode,
    methodNotAllowed
} from "./academy-utils.js";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const { email: rawEmail, code } = readBody(event);
        const email = normalizeEmail(rawEmail);

        if (!validEmail(email) || !/^\d{6}$/.test(String(code || ""))) {
            return json(400, { error: "Enter your email and the six-digit code." });
        }

        const purchases = await supabaseRequest(
            `academy_purchases?email=eq.${encodeURIComponent(email)}&status=eq.paid&product_code=eq.nextbranch_academy_first_website_ai&select=reference&limit=1`
        );

        if (!purchases?.length) {
            return json(401, { error: "The code is invalid or has expired." });
        }

        const now = new Date().toISOString();

        const codes = await supabaseRequest(
            `academy_access_codes?email=eq.${encodeURIComponent(email)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=id,code_hash,attempts&order=created_at.desc&limit=1`
        );

        if (!codes?.length || Number(codes[0].attempts) >= 5) {
            return json(401, { error: "The code is invalid or has expired. Request a new one." });
        }

        const savedCode = codes[0];
        const submittedHash = await hashCode(String(code));

        if (submittedHash !== savedCode.code_hash) {
            await supabaseRequest(
                `academy_access_codes?id=eq.${encodeURIComponent(savedCode.id)}`,
                {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({
                        attempts: Number(savedCode.attempts || 0) + 1
                    })
                }
            );

            return json(401, { error: "The code is invalid or has expired." });
        }

        // Consume the one-time code before issuing the course links.
        await supabaseRequest(
            `academy_access_codes?id=eq.${encodeURIComponent(savedCode.id)}&used_at=is.null`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({ used_at: now })
            }
        );

        const baseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const pdfPath = process.env.ACADEMY_PDF_PATH || "first-website-ai.pdf";
        const videoId = process.env.ACADEMY_VIDEO_ID;

        if (!baseUrl || !serviceKey || !videoId || videoId === "YOUR_UNLISTED_YOUTUBE_VIDEO_ID") {
            console.error("Academy PDF or video environment variables are not configured.");
            return json(503, {
                error: "Course materials are not configured yet. Please contact support."
            });
        }

        const storageResponse = await fetch(
            `${baseUrl.replace(/\/$/, "")}/storage/v1/object/sign/academy-assets/${pdfPath
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
            {
                method: "POST",
                headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ expiresIn: 600 })
            }
        );

        const storageData = await storageResponse.json();

        if (!storageResponse.ok || !storageData.signedURL) {
            console.error("Could not sign PDF URL:", storageData);
            return json(500, { error: "Could not prepare the PDF. Please request a new access code." });
        }

        const signedUrl = storageData.signedURL.startsWith("http")
            ? storageData.signedURL
            : `${baseUrl.replace(/\/$/, "")}/storage/v1${storageData.signedURL.startsWith("/")
                ? storageData.signedURL
                : `/${storageData.signedURL}`}`;

        return json(200, {
            video_id: videoId,
            pdf_url: signedUrl
        });
    } catch (error) {
        console.error("Verify academy access error:", error);
        return json(500, { error: "Unable to verify access right now. Please try again." });
    }
}
