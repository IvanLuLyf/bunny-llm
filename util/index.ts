import {BUNNY_IMAGE_PREFIX} from "../config/index.ts";

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

export function baseResponse() {
    return jsonResponse({ver: "20240425", poweredBy: "BunnyLLM"});
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
            const processLine = (x: string) => {
                if (x.startsWith("data:")) {
                    const line = x.substring(5).trim();
                    try {
                        const text = converter(JSON.parse(line));
                        if (stream) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(reply.chunk(text))}\n\n`));
                        } else {
                            ctx.text += text;
                        }
                    } catch (e) {
                    }
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

export function imageResponse(
    fetcher: () => Promise<Blob>,
) {
    return new Response(new ReadableStream({
        start(controller) {
            if (BUNNY_IMAGE_PREFIX) {
                Deno.makeTempFile({prefix: "image_"}).then((file) => {
                    fetcher().then((blob) => {
                        return blob.arrayBuffer();
                    }).then((buffer) => {
                        return Deno.writeFile(file, buffer);
                    }).then(() => {
                        controller.enqueue(encoder.encode(JSON.stringify({
                            created: Date.now(),
                            data: [{url: `${BUNNY_IMAGE_PREFIX}${file}`}],
                        })));
                        controller.close();
                    });
                });
            } else {
                const encoder = new TextEncoder();
                fetcher().then((blob) => {
                    const reader = new FileReader();
                    reader.addEventListener('loadend', () => {
                        controller.enqueue(encoder.encode(JSON.stringify({
                            created: Date.now(),
                            data: [{url: reader.result}],
                        })));
                        controller.close();
                    });
                    reader.readAsDataURL(blob);
                });
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