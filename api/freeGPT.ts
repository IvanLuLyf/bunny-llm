import {Sha3_512} from "https://deno.land/std@0.119.0/hash/sha3.ts";
import {encode} from "https://deno.land/std@0.136.0/encoding/base64.ts";
import {defaultResponse, generateUUID, jsonResponse, makeReply, optionsResponse} from "../util/index.ts";
import {BUNNY_PATHS} from "../config/index.ts";

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
    const config = getProofConfig();
    const len = Math.floor(difficulty.length / 2);
    for (let i = 0; i < 100000; i++) {
        config[3] = i;
        const jsonStr = JSON.stringify(config);
        const base = encode(new TextEncoder().encode(jsonStr));
        const hashInstance = new Sha3_512();
        const hash = hashInstance.update(seed + base).digest('hex');
        if (hash.slice(0, len) <= difficulty) {
            return `gAAAAAB${base}`;
        }
    }
    return `${PROOF_TOKEN_PREFIX}${Buffer.from(`"${seed}"`, 'utf-8').toString('base64')}`;
}

async function fetchToken(oaiDeviceId): Promise<{ token?, seed, difficulty }> {
    let text = '';
    try {
        const authRes = await fetchOpenAI(`${BASE_URL}/backend-anon/sentinel/chat-requirements`, '{}', {"oai-device-id": oaiDeviceId});
        text = await authRes.text();
        try {
            const auth = JSON.parse(text);
            const {token, proofofwork} = auth;
            return {token, seed: proofofwork.seed, difficulty: proofofwork.difficulty};
        } catch (e) {
            console.log(e);
        }
    } catch (e) {
        console.log(e);
    }
    return {err: text};
}

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname === "/token") {
        const oaiDeviceId = generateUUID();
        const auth = await fetchToken(oaiDeviceId);
        const {token, seed, difficulty, err} = auth;
        if (!token) {
            return jsonResponse({msg: "Token is empty.", err});
        }
        return jsonResponse({
            token: encodeURIComponent(JSON.stringify({id: oaiDeviceId, token, seed, difficulty}))
        });
    } else if (url.pathname === BUNNY_PATHS.CHAT) {
        let oaiDeviceId = '', token = '', seed, difficulty, err = '';
        if (req.headers.has("Authorization")) {
            const tmp = req.headers.get("Authorization");
            const authToken = tmp.startsWith("Bearer ") ? tmp.substring(7) : tmp;
            try {
                const t = JSON.parse(decodeURIComponent(authToken));
                oaiDeviceId = t.id;
                token = t.token;
                seed = t.seed;
                difficulty = t?.difficulty;
            } catch (e) {

            }
        }
        if (!oaiDeviceId || !token) {
            oaiDeviceId = generateUUID();
            const auth = await fetchToken(oaiDeviceId);
            token = auth.token;
            seed = auth.seed;
            difficulty = auth.difficulty;
            err = auth.err;
        }
        if (!token) {
            return jsonResponse({msg: "Token is empty.", err});
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
                    let created = Date.now();
                    const reply = makeReply({model: "gpt-3.5-turbo", id: "chatcmpl-", created});
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
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(reply.chunk(content.replace(fullContent, "")))}\n\n`));
                                    }
                                    fullContent = content.length > fullContent.length ? content : fullContent;
                                }
                            }
                            if (!g.done) {
                                loop();
                            } else {
                                if (isStream) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(reply.finish())}\n\n`));
                                } else {
                                    controller.enqueue(encoder.encode(JSON.stringify(reply.full(fullContent))));
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
        return defaultResponse();
    }
};
