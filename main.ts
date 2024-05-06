import {COMPAT_MAPPER} from "./config/index.ts";
import {createOpenAICompact, htmlResponse, optionsResponse, tempImgResponse} from "./util/index.ts";
import index from "./api/index.ts"
import freeGPT from "./api/freeGPT.ts";
import cloudflare from "./api/cloudflare.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    const arr = url.pathname.split("/");
    const mod = arr[1] || "";
    if (mod === "v1") {
        return await index(req);
    } else if (mod === "image") {
        return await tempImgResponse(req);
    } else if (mod === "free") {
        return await freeGPT(req);
    } else if (mod in COMPAT_MAPPER) {
        const config = COMPAT_MAPPER[mod];
        const runner = createOpenAICompact(mod, config.host, config.prefix);
        return await runner(req);
    } else if (mod === "cloudflare") {
        return await cloudflare(req);
    } else {
        const data = await Deno.readFile("./index.html");
        return htmlResponse(new TextDecoder().decode(data));
    }
});
