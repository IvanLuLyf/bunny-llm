export const COMPAT_MAPPER: { [name: string]: { host: string, api_key: string, prefix?: string } } = {
    openai: {host: "api.openai.com", api_key: Deno.env.get("OPENAI_API_KEY")},
    kimi: {host: "api.moonshot.cn", api_key: Deno.env.get("MOONSHOT_API_KEY")},
    moonshot: {host: "api.moonshot.cn", api_key: Deno.env.get("MOONSHOT_API_KEY")},
    groq: {host: "api.groq.com", api_key: Deno.env.get("GROQ_API_KEY"), prefix: "/openai"},
}

export const BUNNY_API_TOKEN = Deno.env.get("BUNNY_API_TOKEN");
export const BUNNY_PATHS = {
    CHAT: "/v1/chat/completions",
    IMAGE: "/v1/images/generations",
};