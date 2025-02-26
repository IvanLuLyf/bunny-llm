import {htmlResponse, optionsResponse, tempImgResponse} from "./util/index.ts";
import index from "./api/index.ts"

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
    } else {
        const data = await Deno.readFile("./index.html");
        return htmlResponse(new TextDecoder().decode(data));
    }
});
