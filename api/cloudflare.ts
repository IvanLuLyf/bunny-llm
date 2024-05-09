import {BUNNY_API_TOKEN, BUNNY_PATHS} from "../config/index.ts";
import {
    defaultResponse,
    fakeToken,
    imageResponse,
    jsonResponse,
    optionsResponse,
    replyResponse
} from "../util/index.ts";

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

function makeURL(account, model) {
    return `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;
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
        const auth = makeToken(req.headers.get("Authorization"));
        const body = await req.json();
        const {model, messages, max_tokens} = body;
        return replyResponse(model, body.stream, () => {
            return fetch(makeURL(auth.account, model), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({
                    messages,
                    max_tokens,
                    stream: true,
                }),
            }).then((res) => res.body.getReader());
        }, (m) => {
            return m.response || "";
        });
    } else if (url.pathname.endsWith(BUNNY_PATHS.IMAGE)) {
        if (!req.headers.has("Authorization")) {
            return jsonResponse({err: "Token is empty."});
        }
        const auth = makeToken(req.headers.get("Authorization"));
        const {model, prompt, response_format} = await req.json();
        return imageResponse(response_format, url.origin, () => fetch(makeURL(auth.account, model), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify({
                prompt,
            }),
        }).then((res) => res.blob()));
    }
    return defaultResponse();
}
