import {baseResponse, jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname.endsWith("/v1/chat/completions")) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const token = req.headers.get("Authorization");
        const body = await req.json();
        const {model, messages, temperature, max_tokens, top_p, stop} = body;
        return replyResponse(model, body.stream, () => {
            return fetch(`https://api.groq.com/openai/v1/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `${token}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens,
                    top_p,
                    stop,
                    stream: true,
                }),
            }).then((res) => res.body.getReader());
        }, (m) => {
            return m?.choices?.[0]?.delta?.content || "";
        });
    }
    return baseResponse();
}