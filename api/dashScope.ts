import {BUNNY_API_TOKEN} from "../config/index.ts";
import {jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";

const DASH_SCOPE_API_KEY = Deno.env.get("DASH" + "SCOPE_API_KEY");

function makeToken(auth): string {
    const token = auth.startsWith("Bearer ") ? auth.substring(7) : auth;
    if (token === BUNNY_API_TOKEN) {
        return DASH_SCOPE_API_KEY;
    } else {
        return token;
    }
}

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname.endsWith("/v1/chat/completions")) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const token = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const {model, messages, top_k, temperature, stop} = body;
        return replyResponse(model, body.stream, () => {
            return fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-DashScope-SSE': 'enable',
                },
                body: JSON.stringify({
                    model,
                    input: {
                        messages,
                    },
                    parameters: {
                        top_k,
                        temperature,
                        stop,
                        result_format: 'message',
                        incremental_output: true,
                    },
                }),
            }).then((res) => res.body.getReader());
        }, (m) => {
            return m?.output?.choices?.[0]?.message?.content || "";
        });
    }
}