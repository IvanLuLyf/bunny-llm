import {BUNNY_API_TOKEN, BUNNY_PATHS} from "../config/index.ts";
import {
    defaultResponse,
    jsonResponse,
    longTaskResponse,
    optionsResponse,
    replyResponse,
    urlsToImageJson
} from "../util/index.ts";

const DASH_SCOPE_API_KEY = Deno.env.get("DASH" + "SCOPE_API_KEY");
const URLS = {
    TEXT: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
    IMAGE: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    TASK: "https://dashscope.aliyuncs.com/api/v1/tasks/",
}
const IMAGE_SIZE = ["1024*1024", "720*1280", "1280*720"];

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
    if (url.pathname.endsWith(BUNNY_PATHS.CHAT)) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const token = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const {model, messages, max_tokens, top_k, temperature, stop} = body;
        return replyResponse(model, body.stream, () => {
            return fetch(URLS.TEXT, {
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
                        result_format: "message",
                        incremental_output: true,
                    },
                }),
            }).then((res) => res.body.getReader()).catch((e) => {
                console.log(e)
            });
        }, (m) => {
            const o = m?.output;
            return o?.choices?.[0]?.message?.content || o?.text || "";
        });
    } else if (url.pathname.endsWith(BUNNY_PATHS.IMAGE)) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const token = makeToken(req.headers.get("Authorization"));
        const {model, prompt, response_format, size: tmpSize, n} = await req.json();
        let size = (tmpSize || '1024*1024').replace('x', '*');
        if (!IMAGE_SIZE.includes(size)) {
            size = '1024*1024';
        }
        return longTaskResponse(
            () => fetch(URLS.IMAGE, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-DashScope-Async': 'enable',
                },
                body: JSON.stringify({
                    model,
                    input: {
                        prompt,
                    },
                    parameters: {
                        size,
                        n,
                    },
                }),
            }).then((res) => res.json()),
            (param) => fetch(`${URLS.TASK}${param.output.task_id}`, {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            }).then((res) => res.json()).then((res) => {
                const task_status = res?.output?.task_status || 'PENDING';
                if (task_status === "SUCCEEDED") {
                    return {result: urlsToImageJson((res?.output?.results || []).map((x) => x.url), response_format)};
                } else if (task_status === "FAILED") {
                    return {error: {message: res?.output?.message || ""}}
                }
                return {};
            }));
    }
    return defaultResponse();
}
