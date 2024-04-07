const BASE_URL = "https://chat.openai.com";
const API_URL = `${BASE_URL}/backend-api/conversation`;

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
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
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


Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    if (url.pathname === '/v1/chat/completions') {
        const oaiDeviceId = generateUUID();
        const authRes = await fetchOpenAI(`${BASE_URL}/backend-anon/sentinel/chat-requirements`, '', {"oai-device-id": oaiDeviceId})
        const auth = await authRes.json();
        const token = auth.token;
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
                "Content-Type": "text/event-stream;charset=UTF-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            } : {
                "Content-Type": "application/json;charset=UTF-8",
            },
        });
    } else {
        return new Response("API RUNNING");
    }
});

