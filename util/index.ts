import {BUNNY_IMAGE_PREFIX} from "../config/index.ts";

const SUPPORT_CACHES = !!window.caches;
const CACHE_IMAGE = "images";

export function generateUUID(): string {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
    const hex = [...randomBytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function makeReply({model = "bunny", id = "bunny-", created = 0} = {}) {
    return {
        chunk: (content) => ({
            id,
            created,
            object: "chat.completion.chunk",
            model,
            choices: [
                {
                    delta: {content},
                    index: 0,
                    finish_reason: null,
                },
            ]
        }),
        full: (content, {prompt = 0, completion = 0, total = 0} = {}) => ({
            id,
            created,
            object: "chat.completion",
            model,
            choices: [
                {
                    message: {
                        content,
                        role: "assistant",
                    },
                    index: 0,
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: prompt || 0,
                completion_tokens: completion || 0,
                total_tokens: total || 0,
            },
        }),
        finish: () => ({
            id,
            created,
            object: "chat.completion.chunk",
            model,
            choices: [
                {
                    delta: {content: ""},
                    index: 0,
                    finish_reason: "stop",
                },
            ],
        }),
    };
}

export function jsonResponse(o) {
    return new Response(JSON.stringify(o), {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json;charset=UTF-8",
        },
    });
}

export function htmlResponse(html) {
    return new Response(html, {
        headers: new Headers({
            "Content-Type": "text/html;charset=utf-8"
        })
    });
}

export function notFoundResponse() {
    return new Response("404 Not Found", {status: 404});
}

export function baseResponse() {
    return jsonResponse({ver: "20240506", poweredBy: "BunnyLLM"});
}

export function optionsResponse() {
    return new Response(null, {
        headers: new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        })
    });
}

export function fakeToken(o) {
    if (typeof o === "object") {
        return encodeURIComponent(JSON.stringify(o));
    }
    const authToken = o.startsWith("Bearer ") ? o.substring(7) : o;
    try {
        return JSON.parse(decodeURIComponent(authToken));
    } catch (e) {
        return {};
    }
}

export function replyResponse(
    model,
    stream: boolean = false,
    fetcher: () => Promise<ReadableStreamDefaultReader>,
    converter: (m: Object) => string,
    id: string = "bunny-",
) {
    const decoder = new TextDecoder("utf-8");
    const encoder = new TextEncoder();
    const ctx = {bufferText: "", text: ""};
    const reply = makeReply({model, id, created: Date.now()});
    return new Response(new ReadableStream({
        start(controller) {
            const parse = (line: string) => {
                try {
                    const text = converter(JSON.parse(line));
                    if (stream) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(reply.chunk(text))}\n\n`));
                    } else {
                        ctx.text += text;
                    }
                } catch (e) {
                }
            };
            const processLine = (x: string) => {
                if (x.startsWith("data:")) {
                    parse(x.substring(5).trim());
                } else if (x.startsWith("{")) {
                    parse(x);
                }
            };
            fetcher().then((reader) => {
                const loop = () => {
                    reader.read().then((g) => {
                        if (g.done) {
                            if (ctx.bufferText) {
                                processLine(ctx.bufferText);
                            }
                            if (stream) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(reply.finish())}\n\n`));
                            } else {
                                controller.enqueue(encoder.encode(JSON.stringify(reply.full(ctx.text))));
                            }
                            controller.close();
                            return;
                        }
                        ctx.bufferText += decoder.decode(g.value, {stream: true});
                        const lines = ctx.bufferText.split(/\r\n|\r|\n/);
                        ctx.bufferText = lines.pop();
                        lines.forEach((x) => processLine(x));
                        loop();
                    });
                };
                loop();
            });
        },
    }), {
        headers: stream ? {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "text/event-stream;charset=UTF-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        } : {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json;charset=UTF-8",
        },
    });
}

const requestCache = new Map<string, () => Promise<Blob>>();
const responseCache = new Map<string, { blob: Blob, expired: number }>();

export async function tempImgResponse(req: Request) {
    if (SUPPORT_CACHES) {
        const cache = await caches.open(CACHE_IMAGE);
        const cached = await cache.match(req);
        return cached ? cached : notFoundResponse();
    }
    const url = new URL(req.url);
    const file = url.pathname.split("/")[2];
    if (file) {
        let c: { blob: Blob, expired: number };
        if (responseCache.has(file)) {
            c = responseCache.get(file);
            if (c.expired < Date.now()) {
                responseCache.delete(file)
                return notFoundResponse();
            }
        } else {
            const fetcher = requestCache.get(file);
            const blob = await fetcher();
            requestCache.delete(file);
            c = {
                expired: Date.now() + 300000,
                blob
            }
            responseCache.set(file, c);
        }
        return new Response(c.blob, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=1800",
            },
        });
    }
    return notFoundResponse();
}

export function imageResponse(
    response_format,
    fetcher: () => Promise<Blob>,
) {
    return new Response(new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            if (response_format === "b64_json") {
                fetcher().then((blob) => {
                    const reader = new FileReader();
                    reader.addEventListener('loadend', () => {
                        const url = reader.result;
                        const b64_json = url.split(",")[1];
                        controller.enqueue(encoder.encode(JSON.stringify({
                            created: Date.now(),
                            data: [{b64_json}],
                        })));
                        controller.close();
                    });
                    reader.readAsDataURL(blob);
                });
            } else {
                const filename = `${generateUUID()}.png`;
                const url = `${BUNNY_IMAGE_PREFIX}/${filename}`;
                if (SUPPORT_CACHES) {
                    fetcher().then((blob) => {
                        caches.open(CACHE_IMAGE).then((cache) => {
                            return cache.put(new Request(url), new Response(blob));
                        }).then(() => {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                created: Date.now(),
                                data: [{url}],
                            })));
                        }).finally(() => {
                            controller.close()
                        });
                    });
                } else {
                    requestCache.set(filename, fetcher);
                    controller.enqueue(encoder.encode(JSON.stringify({
                        created: Date.now(),
                        data: [{url}],
                    })));
                    controller.close()
                }
            }
        }
    }), {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json;charset=UTF-8",
    })
}

export function createOpenAICompact(name = "openai", host = "api.openai.com", pathPrefix = "") {
    return async (req: Request) => {
        if (req.method === "OPTIONS") {
            return optionsResponse();
        }
        const url = new URL(req.url);
        url.host = host;
        if (url.pathname.startsWith(`/${name}/`)) {
            url.pathname = url.pathname.substring(name.length + 1);
        }
        if (pathPrefix) {
            url.pathname = pathPrefix + url.pathname;
        }
        return await fetch(new Request(url.toString(), {
            headers: req.headers,
            method: req.method,
            body: req.body,
            redirect: "follow",
        }));
    }
}
