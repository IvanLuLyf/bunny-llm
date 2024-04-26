import {htmlResponse, optionsResponse} from "./util/index.ts";
import index from "./api/index.ts"
import freeGPT from "./api/freeGPT.ts";
import openai from "./api/openai.ts";
import cloudflare from "./api/cloudflare.ts";
import groq from "./api/groq.ts";
import kimi from "./api/kimi.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    const arr = url.pathname.split("/");
    const mod = arr[1] || "";
    if (mod === "v1") {
        return index(req);
    } else if (mod === "free") {
        return await freeGPT(req);
    } else if (mod === "openai") {
        return await openai(req);
    } else if (mod === "cloudflare") {
        return await cloudflare(req);
    } else if (mod === "groq") {
        return await groq(req);
    } else if (mod === "kimi") {
        return await kimi(req);
    } else {
        const data = await Deno.readFile("./index.html");
        return htmlResponse(new TextDecoder().decode(data));
    }
});
