const SUPPORT_CACHES = !!window.caches;
const CACHE_IMAGE = "images";
const COMMON_HEADER = {
    "Access-Control-Allow-Origin": "*",
}

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
            ...COMMON_HEADER,
            "Content-Type": "application/json;charset=UTF-8",
        },
    });
}

export function htmlResponse(html) {
    return new Response(html, {
        headers: new Headers({
            ...COMMON_HEADER,
            "Content-Type": "text/html;charset=utf-8"
        })
    });
}

export function notFoundResponse() {
    return new Response("404 Not Found", {status: 404});
}

export function defaultResponse() {
    return jsonResponse({ver: "20240506", poweredBy: "BunnyLLM"});
}

export function optionsResponse() {
    return new Response(null, {
        headers: new Headers({
            ...COMMON_HEADER,
            "Access-Control-Allow-Methods": "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": 1500
        }),
        status: 200,
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
            ...COMMON_HEADER,
            "Content-Type": "text/event-stream;charset=UTF-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        } : {
            ...COMMON_HEADER,
            "Content-Type": "application/json;charset=UTF-8",
        },
    });
}

const imageCache = new Map<string, { blob: Blob, expired: number }>();
const cleanCache = () => {
    const now = Date.now();
    for (const [k, v] of imageCache.entries()) {
        if (v.expired < now) {
            imageCache.delete(k);
        }
    }
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('loadend', () => {
            const url = reader.result;
            const b64_json = url.split(",")[1];
            resolve(b64_json);
        });
        reader.addEventListener('error', () => {
            resolve('');
        });
        reader.readAsDataURL(blob);
    });
}

export async function tempImgResponse(req: Request) {
    if (SUPPORT_CACHES) {
        const cache = await caches.open(CACHE_IMAGE);
        const cached = await cache.match(req);
        return cached ? cached : notFoundResponse();
    }
    const url = new URL(req.url);
    const file = url.pathname.split("/")[2];
    const ifNoneMatch = req.headers.get("If-None-Match");
    if (ifNoneMatch === file) {
        return new Response(null, {
            status: 304,
        });
    }
    if (file && imageCache.has(file)) {
        const c = imageCache.get(file);
        if (c.expired < Date.now()) {
            imageCache.delete(file)
            return notFoundResponse();
        }
        return new Response(c.blob, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=1800",
                "Etag": file,
            },
        });
    }
    return notFoundResponse();
}

export function imageResponse(
    response_format: string,
    hostname: string,
    fetcher: () => Promise<Blob>,
) {
    return new Response(new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            if (response_format === "b64_json") {
                fetcher().then((blob) => blobToBase64(blob)).then((b64_json) => {
                    controller.enqueue(encoder.encode(JSON.stringify({
                        created: Date.now(),
                        data: [{b64_json}],
                    })));
                    controller.close();
                });
            } else {
                const filename = `${generateUUID()}.png`;
                const url = `${hostname}/image/${filename}`;
                fetcher().then((blob) => {
                    if (SUPPORT_CACHES) {
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
                    } else {
                        cleanCache();
                        imageCache.set(filename, {
                            expired: Date.now() + 180000,
                            blob
                        });
                        controller.enqueue(encoder.encode(JSON.stringify({
                            created: Date.now(),
                            data: [{url}],
                        })));
                        controller.close()
                    }
                });
            }
        }
    }), {
        headers: {
            ...COMMON_HEADER,
            "Content-Type": "application/json;charset=UTF-8",
        }
    })
}

export function urlsToImageJson(urls: string[], format = 'url') {
    if (format === 'b64_json') {
        const arr = [];
        return new Promise<{ created: number, data: { b64_json: string }[] }>((resolve) => {
            const runTask = (index) => {
                if (index === urls.length) {
                    resolve({
                        created: Date.now(),
                        data: arr,
                    });
                    return;
                }
                fetch(urls[index]).then((res) => res.blob()).then((blob) => blobToBase64(blob)).then((b64_json) => {
                    arr.push({b64_json});
                    runTask(index + 1);
                });
            }
            runTask(0);
        });
    }
    return {
        created: Date.now(),
        data: urls.map((url) => ({url})),
    }
}

export function longTaskResponse(
    start: () => Promise<object>,
    runner: (o: object) => Promise<{ result: object, error: object }>,
    wait = 2000,
    timeout = 60000,
) {
    return new Response(new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const timestamp = Date.now();
            const end = (data) => {
                controller.enqueue(encoder.encode(JSON.stringify(data)));
                controller.close()
            };
            const loop = (param) => {
                runner(param).then((o) => {
                    if (o.error) {
                        end(o.error);
                    } else if (o.result) {
                        if (o.result.then) {
                            o.result.then((data) => {
                                end(data);
                            });
                        } else {
                            end(o.result);
                        }
                    } else {
                        if (Date.now() - timestamp > timeout) {
                            end({error: {message: "Timeout."}})
                        } else {
                            setTimeout(() => loop(param), wait);
                        }
                    }
                });
            }
            start().then((param) => {
                loop(param);
            });
        }
    }), {
        headers: {
            ...COMMON_HEADER,
            "Content-Type": "application/json;charset=UTF-8",
        }
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
