export const COMPAT_MAPPER: { [name: string]: { base_url: string, api_key: string } } = {
    openai: {
        base_url: "https://api.openai.com/v1",
        api_key: Deno.env.get("OPENAI_API_KEY"),
    },
    kimi: {
        base_url: "https://api.moonshot.cn/v1",
        api_key: Deno.env.get("MOONSHOT_API_KEY"),
    },
    deepseek: {
        base_url: "https://api.deepseek.com/v1",
        api_key: Deno.env.get("DEEPSEEK_API_KEY"),
    },
    groq: {
        base_url: "https://api.groq.com/openai/v1",
        api_key: Deno.env.get("GROQ_API_KEY"),
    },
};

export const BUNNY_PROVIDERS = JSON.parse(Deno.env.get("BUNNY_API_PROVIDER") || "[]");

export const BUNNY_API_TOKENS = (Deno.env.get("BUNNY_API_TOKEN") || "").split(";").filter((x) => x);
export const BUNNY_PATHS = {
    CHAT: "/v1/chat/completions",
    IMAGE: "/v1/images/generations",
};