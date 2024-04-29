import {optionsResponse} from "../util/index.ts";
import free from "./freeGPT.ts";
import cloudflare from "./cloudflare.ts";
import dashScope from "./dashScope.ts";
import {BUNNY_API_TOKEN, COMPAT_MAPPER} from "../config/index.ts";

const RUNNERS = {
    free,
    cloudflare,
    cf: cloudflare,
    dash_scope: dashScope,
    ds: dashScope,
}
export default async (req: Request) => {
    const method = req.method;
    if (method === "OPTIONS") return optionsResponse();
    const {model: rawModel = '', ...rest} = await req.json();
    const pos = rawModel.indexOf(":");
    let mod, model;
    if (pos === -1) {
        mod = 'free';
        model = '';
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
        const url = new URL(req.url);
        url.host = config.host;
        if (config.prefix) url.pathname = config.prefix + url.pathname;
        if (req.headers.has("Authorization") && config.api_key) {
            const auth = req.headers.get("Authorization");
            const token = auth.startsWith("Bearer ") ? auth.substring(7) : auth;
            if (token === BUNNY_API_TOKEN) {
                headers.set("Authorization", `Bearer ${config.api_key}`);
            }
        }
        return await fetch(new Request(url.toString(), {headers, method, body, redirect: "follow"}));
    }
    const runner = RUNNERS[mod] || RUNNERS.free;
    return await runner(new Request(req.url, {headers, method, body}));
}
