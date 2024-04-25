import api from "./api/index.ts";
import {htmlResponse, optionsResponse} from "./util/index.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return optionsResponse();
    }
    const url = new URL(req.url);
    if (url.pathname === '/v1/chat/completions' || url.pathname === '/token') {
        return await api(req);
    } else {
        const data = await Deno.readFile("./index.html");
        return htmlResponse(new TextDecoder().decode(data));
    }
});
