import {Sha3_512} from "https://deno.land/std@0.119.0/hash/sha3.ts";
import {encode} from "https://deno.land/std@0.136.0/encoding/base64.ts";

const BASE_URL = "https://chat.openai.com";
const API_URL = `${BASE_URL}/backend-api/conversation`;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function fetchOpenAI(url: string, body = '', header = {}) {
    return fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
            accept: "*/*",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "no-cache",
            "content-type": "application/json",
            "oai-language": "en-US",
            origin: BASE_URL,
            pragma: "no-cache",
            referer: BASE_URL,
            "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent": USER_AGENT,
            ...header,
        },
        body,
    })
}

function generateUUID(): string {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
    randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
    const hex = [...randomBytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const PROOF_TOKEN_PREFIX = "gAAAAABwQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D";

function getProofConfig() {
    const cores = [8, 12, 16, 24];
    const core = Math.floor(Math.random() * cores.length);
    const screens = [3000, 4000, 6000];
    const screen = Math.floor(Math.random() * screens.length);
    return [
        `${cores[core]}${screens[screen]}`,
        new Date().toString(),
        4294705152,
        0,
        USER_AGENT,
    ];
}

function calcProofToken(seed, difficulty) {
    let proofToken: string;
    const len = Math.floor(difficulty.length / 2);
    for (let i = 0; i < 100000; i++) {
        const config = getProofConfig();
        config[3] = i;
        const jsonStr = JSON.stringify(config);
        const base = encode(new TextEncoder().encode(jsonStr));
        const hashInstance = new Sha3_512();
        const hash = hashInstance.update(seed + base).digest('hex');
        if (hash.slice(0, len) <= difficulty) {
            proofToken = `gAAAAAB${base}`;
            break;
        }
    }

    if (!proofToken) {
        proofToken = `${PROOF_TOKEN_PREFIX}${encode(new TextEncoder().encode(seed))}`;
    }
    return proofToken;
}


export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: new Headers({
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            })
        });
    }
    const url = new URL(req.url);
    if (url.pathname === "/token") {
        const oaiDeviceId = generateUUID();
        const authRes = await fetchOpenAI(`${BASE_URL}/backend-anon/sentinel/chat-requirements`, '', {"oai-device-id": oaiDeviceId})
        const auth = await authRes.json();
        const token = auth.token;
        const seed = auth?.proofofwork?.seed;
        const difficulty = auth?.proofofwork?.difficulty;
        return new Response(JSON.stringify({
            token: encodeURIComponent(JSON.stringify({id: oaiDeviceId, token, seed, difficulty}))
        }), {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json;charset=UTF-8",
            },
        });
    } else if (url.pathname === '/v1/chat/completions') {
        let oaiDeviceId = '', token = '', seed, difficulty;
        if (req.headers.has("Authorization")) {
            const tmp = req.headers.get("Authorization");
            const authToken = tmp.startsWith("Bearer ") ? tmp.substring(7) : tmp;
            try {
                const t = JSON.parse(decodeURIComponent(authToken));
                oaiDeviceId = t.id;
                token = t.token;
                seed = t?.seed;
                difficulty = t?.difficulty;
            } catch (e) {

            }
        }
        if (!oaiDeviceId || !token) {
            oaiDeviceId = generateUUID();
            const authRes = await fetchOpenAI(`${BASE_URL}/backend-anon/sentinel/chat-requirements`, '', {"oai-device-id": oaiDeviceId})
            const auth = await authRes.json();
            token = auth.token;
            seed = auth?.proofofwork?.seed;
            difficulty = auth?.proofofwork?.difficulty;
        }
        const reqBody = await req.json();
        const messages = reqBody.messages;
        const isStream = reqBody.stream;
        const body = new ReadableStream({
            start(controller) {
                fetchOpenAI(API_URL, JSON.stringify({
                    action: "next",
                    messages: messages.map((message) => ({
                        author: {role: message.role},
                        content: {content_type: "text", parts: [message.content]},
                    })),
                    parent_message_id: generateUUID(),
                    model: "text-davinci-002-render-sha",
                    timezone_offset_min: -180,
                    suggestions: [],
                    history_and_training_disabled: true,
                    conversation_mode: {kind: "primary_assistant"},
                    websocket_request_id: generateUUID(),
                }), {
                    "oai-device-id": oaiDeviceId,
                    "openai-sentinel-chat-requirements-token": token,
                    "openai-sentinel-proof-token": calcProofToken(seed, difficulty),
                }).then((res) => {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    const encoder = new TextEncoder();
                    let fullContent = "";
                    let requestId = "chatcmpl-";
                    let created = Date.now();
                    const loop = () => {
                        reader.read().then((g) => {
                            const text = decoder.decode(g.value);
                            const frames = text.split("\n");
                            for (const frame of frames) {
                                const msg = frame.trim();
                                if (msg !== 'data: [DONE]') {
                                    const jsonData = msg.substring(6);
                                    if (!jsonData) continue;
                                    let parsed: any;
                                    try {
                                        parsed = JSON.parse(jsonData);
                                    } catch (e) {
                                        parsed = {}
                                    }
                                    let content = parsed?.message?.content?.parts[0] || "";
                                    for (let message of messages) {
                                        if (message.content === content) {
                                            content = "";
                                            break;
                                        }
                                    }
                                    if (content === "") continue;
                                    if (isStream) {
                                        let response = {
                                            id: requestId,
                                            created,
                                            object: "chat.completion.chunk",
                                            model: "gpt-3.5-turbo",
                                            choices: [
                                                {
                                                    delta: {
                                                        content: content.replace(fullContent, ""),
                                                    },
                                                    index: 0,
                                                    finish_reason: null,
                                                },
                                            ],
                                        };
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
                                    }
                                    fullContent = content.length > fullContent.length ? content : fullContent;
                                }
                            }
                            if (!g.done) {
                                loop();
                            } else {
                                if (isStream) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                        id: requestId,
                                        created: created,
                                        object: "chat.completion.chunk",
                                        model: "gpt-3.5-turbo",
                                        choices: [
                                            {
                                                delta: {
                                                    content: "",
                                                },
                                                index: 0,
                                                finish_reason: "stop",
                                            },
                                        ],
                                    })}\n\n`));
                                } else {
                                    controller.enqueue(encoder.encode(JSON.stringify({
                                        id: requestId,
                                        created: created,
                                        object: "chat.completion",
                                        model: "gpt-3.5-turbo",
                                        choices: [
                                            {
                                                message: {
                                                    content: fullContent,
                                                    role: "assistant",
                                                },
                                                index: 0,
                                                finish_reason: "stop",
                                            },
                                        ],
                                        usage: {
                                            prompt_tokens: 0,
                                            completion_tokens: 0,
                                            total_tokens: 0,
                                        },
                                    })));
                                }
                                controller.close();
                            }
                        });
                    };
                    loop();
                });
            },
            cancel() {

            },
        });
        return new Response(body, {
            headers: isStream ? {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/event-stream;charset=UTF-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            } : {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json;charset=UTF-8",
            },
        });
    } else {
        return new Response(JSON.stringify({
            ver: "20240410"
        }), {
            headers: new Headers({
                "Content-Type": "application/json;charset=utf-8"
            })
        });
    }
};
