import {optionsResponse} from "../util/index.ts";
import free from "./freeGPT.ts";
import openai from "./openai.ts";
import cloudflare from "./cloudflare.ts";
import groq from "./groq.ts";
import kimi from "./kimi.ts";

const RUNNERS = {
    free,
    openai,
    cloudflare,
    groq,
    kimi,
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
    const runner = RUNNERS[mod] || RUNNERS.free;
    return await runner(new Request(req.url, {
        headers: req.headers,
        method: req.method,
        body: JSON.stringify({
            ...rest,
            model,
        }),
        redirect: "follow",
    }));
}