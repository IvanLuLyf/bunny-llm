import {jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";
import {BUNNY_API_TOKEN, BUNNY_PATHS} from "../config/index.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

function makeToken(auth): string {
    const token = auth.startsWith("Bearer ") ? auth.substring(7) : auth;
    if (token === BUNNY_API_TOKEN) {
        return GEMINI_API_KEY;
    } else {
        return token;
    }
}

function makeURL(model, token) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${token}`;
}

function convertMessages(messages) {
    const contents = [];
    let system_instruction = undefined;
    for (const m of messages) {
        const parts = [{text: m.content}]
        if (m.role === "system") {
            system_instruction = {parts};
        } else if (m.role === "assistant") {
            contents.push({role: "model", parts});
        } else {
            contents.push({role: m.role, parts});
        }
    }
    return {contents, system_instruction};
}

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname.endsWith(BUNNY_PATHS.CHAT)) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const token = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const {model, messages, max_tokens, top_k, temperature, stream} = body;
        return replyResponse(model, stream, () => {
            return fetch(makeURL(model, token), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...convertMessages(messages),
                }),
            }).then((res) => res.body.getReader()).catch((err) => console.log(err));
        }, (m) => {
            const c = m?.candidates?.[0];
            return c?.content?.parts?.[0]?.text || "";
        });
    }
}
