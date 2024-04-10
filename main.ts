import api from "./api/index.ts";

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    if (url.pathname === '/v1/chat/completions') {
        return await api(req);
    } else {
        const data = await Deno.readFile("./index.html");
        return new Response(new TextDecoder().decode(data), {
            headers: new Headers({
                "Content-Type": "text/html;charset=utf-8"
            })
        });
    }
});
