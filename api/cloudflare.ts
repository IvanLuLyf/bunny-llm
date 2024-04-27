import {BUNNY_API_TOKEN} from "../config/compatMapper.ts";
import {baseResponse, fakeToken, imageResponse, jsonResponse, optionsResponse, replyResponse} from "../util/index.ts";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID");
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN");

function makeToken(auth): { account: string, token: string } {
    const token = auth.startsWith("Bearer ") ? auth.substring(7) : auth;
    if (token === BUNNY_API_TOKEN) {
        return {account: CF_ACCOUNT_ID, token: CF_API_TOKEN};
    } else {
        return fakeToken(auth);
    }
}

export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname.endsWith("/v1/chat/completions")) {
        if (!req.headers.has("Authorization")) {
            console.log({err: "Token is empty."});
            return jsonResponse({err: "Token is empty."});
        }
        console.log(req.headers.get("Authorization"));
        const auth = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const model = body.model;
        const messages = body.messages;
        return replyResponse(model, body.stream, () => {
            return fetch(`https://api.cloudflare.com/client/v4/accounts/${auth.account}/ai/run/${model}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                }),
            }).then((res) => res.body.getReader());
        }, (m) => {
            return m.response || "";
        });
    } else if (url.pathname.endsWith("/v1/images/generations")) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const auth = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const model = body.model;
        return imageResponse(() => fetch(`https://api.cloudflare.com/client/v4/accounts/${auth.account}/ai/run/${model}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify({
                prompt: body.prompt,
            }),
        }).then((res) => res.blob()));
    }
    return baseResponse();
}
