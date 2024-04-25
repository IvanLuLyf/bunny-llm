import {baseResponse, fakeToken, jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname.endsWith("/v1/chat/completions")) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const auth: { account: string, token: string } = fakeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const model = body.model;
        const messages = body.messages;
        return replyResponse(model, body.stream, () => {
            return fetch(`https://api.cloudflare.com/client/v4/accounts/${auth.account}/ai/run/${model}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                }),
            }).then((res) => res.body.getReader());
        }, (m) => {
            return m.response || "";
        });
    }
    return baseResponse();
}