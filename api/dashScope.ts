import {BUNNY_API_TOKEN} from "../config/index.ts";
import {jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";

const DASH_SCOPE_API_KEY = Deno.env.get("DASH" + "SCOPE_API_KEY");

const LEGACY_MODELS = new Set([
    "yi-6b-chat",
    "yi-34b-chat",
    "internlm-7b-chat",
    "deepseek-7b-chat",
    "aquilachat-7b",
]);

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
        const {model, messages, max_tokens, top_k, temperature, stop} = body;
        return replyResponse(model, body.stream, () => {
            const result_format = LEGACY_MODELS.has(model.toLowerCase()) ? "text" : "message";
            return fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
                method: "POST",
                headers: {
                    'Accept': 'text/event-stream',
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
                        max_tokens,
                        top_k,
                        temperature,
                        stop,
                        result_format,
                        incremental_output: true,
                    },
                }),
            }).then((res) => res.body.getReader()).catch((e) => {
                console.log(e)
            });
        }, (m) => {
            console.log(m);
            const o = m?.output;
            return o?.choices?.[0]?.message?.content || o?.text || "";
        });
    }
}
