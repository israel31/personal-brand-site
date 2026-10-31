
import {
    json,
    readBody,
    methodNotAllowed,
    sendTikTokEvent,
    getTikTokRequestData
} from "./academy-utils.js";

export async function handler(event) {
    const methodError = methodNotAllowed(event);
    if (methodError) return methodError;

    try {
        const body = readBody(event);

        const eventId =
            typeof body.event_id === "string" &&
                /^[A-Za-z0-9_-]{8,100}$/.test(body.event_id)
                ? body.event_id
                : "";

        if (!eventId) {
            return json(400, {
                success: false,
                error: "Invalid event ID."
            });
        }

        const tracking = getTikTokRequestData(event, body);

        const sent = await sendTikTokEvent({
            event: "ViewContent",
            eventId,
            ...tracking,
            value: 1500
        });

        return json(200, {
            success: true,
            sent
        });

    } catch (error) {
        console.error("TikTok ViewContent tracking error:", error);

        return json(200, {
            success: false
        });
    }
}
