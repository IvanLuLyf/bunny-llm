export default async function (req: Request) {
    const url = new URL(req.url);
    url.host = "api.openai.com";
    url.pathname = url.pathname.substring(7);
    return await fetch(new Request(url.toString(), {
        headers: req.headers,
        method: req.method,
        body: req.body,
        redirect: "follow",
    }));
}