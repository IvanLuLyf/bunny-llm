import {optionsResponse} from "../util/index.ts";
import free from "./freeGPT.ts";
import cloudflare from "./cloudflare.ts";
import {COMPAT_MAPPER} from "../config/compatMapper.ts";

const RUNNERS = {
    free,
    cloudflare,
}
export default async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
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
    const body = JSON.stringify({
        ...rest,
        model,
    });
    if (mod in COMPAT_MAPPER) {
        const config = COMPAT_MAPPER[mod];
        const url = new URL(req.url);
        url.host = config.host;
        if (config.prefix) url.pathname = config.prefix + url.pathname;
        return await fetch(new Request(url.toString(), {
            headers: req.headers,
            method: req.method,
            body,
            redirect: "follow",
        }));
    }
    const runner = RUNNERS[mod] || RUNNERS.free;
    return await runner(new Request(req.url, {
        headers: req.headers,
        method: req.method,
        body,
    }));
}