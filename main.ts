import {htmlResponse, optionsResponse} from "./util/index.ts";
import api from "./api/index.ts";
import cloudflare from "./api/cloudflare.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    const arr = url.pathname.split("/");
    const mod = arr[1] || "";
    if (mod === "v1" || url.pathname === '/token') {
        return await api(req);
    } else if (mod === "cloudflare") {
        return await cloudflare(req);
    } else {
        const data = await Deno.readFile("./index.html");
        return htmlResponse(new TextDecoder().decode(data));
    }
});
