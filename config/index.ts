export const COMPAT_MAPPER = {
    openai: {host: "api.openai.com", api_key: Deno.env.get("OPENAI_API_KEY")},
    kimi: {host: "api.moonshot.cn", api_key: Deno.env.get("MOONSHOT_API_KEY")},
    moonshot: {host: "api.moonshot.cn", api_key: Deno.env.get("MOONSHOT_API_KEY")},
    groq: {host: "api.groq.com", api_key: Deno.env.get("GROQ_API_KEY"), prefix: "/openai"},
}

export const BUNNY_API_TOKEN = Deno.env.get("BUNNY_API_TOKEN");
export const BUNNY_IMAGE_PREFIX = Deno.env.get("BUNNY_IMAGE_PREFIX");