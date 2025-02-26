import {BUNNY_API_TOKENS, BUNNY_MODELS, COMPAT_MAPPER} from "../config/index.ts";
import {jsonResponse, optionsResponse} from "../util/index.ts";
import cloudflare from "./cloudflare.ts";
import ali from "./ali.ts";
import google from "./google.ts";

const RUNNERS = {
    cloudflare,
    cf: cloudflare,
    ali,
    google: google,
    gg: google,
}
const created = Math.floor(Date.now() / 1000);
const owner_by = "bunny";
export default async (req: Request) => {
    const method = req.method;
    const pathUrl = new URL(req.url);
    if (method === "OPTIONS") return optionsResponse();
    if (pathUrl.pathname === "/v1/models") {
        return jsonResponse({
            object: "list",
            data: BUNNY_MODELS.map((id) => ({
                id,
                object: "model",
                created,
                owner_by,
            })),
        })
    }
    const {model: rawModel = '', ...rest} = await req.json();
    const pos = rawModel.indexOf(":");
    let mod, model;
    if (pos === -1) {
        mod = 'openai';
        model = rawModel;
    } else {
        mod = rawModel.substring(0, pos).toLowerCase();
        model = rawModel.substring(pos + 1);
    }
    const headers = new Headers(req.headers);
    const body = JSON.stringify({
        ...rest,
        model,
    });
    if (mod in COMPAT_MAPPER) {
        const config = COMPAT_MAPPER[mod];
        const url = new URL(config.base_url);
        url.pathname = (url.pathname + pathUrl.pathname.slice(3)).replace('//', '/');
        if (req.headers.has("Authorization") && config.api_key) {
            const auth = req.headers.get("Authorization");
            const token = auth.startsWith("Bearer ") ? auth.substring(7) : auth;
            if (BUNNY_API_TOKENS.includes(token)) {
                headers.set("Authorization", `Bearer ${config.api_key}`);
            }
        }
        return await fetch(new Request(url.toString(), {headers, method, body, redirect: "follow"}));
    }
    const runner = RUNNERS[mod];
    return await runner(new Request(req.url, {headers, method, body}));
}
