export function makeReply(
    {
        model: string = "bunny",
        id: string = "bunny-",
        created: number = 0
    } = {}
) {
    return {
        chunk: (content) => ({
            id,
            created,
            object: "chat.completion.chunk",
            model,
            choices: [
                {
                    delta: {content},
                    index: 0,
                    finish_reason: null,
                },
            ]
        }),
        full: (content, {prompt = 0, completion = 0, total = 0} = {}) => ({
            id,
            created,
            object: "chat.completion",
            model,
            choices: [
                {
                    message: {
                        content,
                        role: "assistant",
                    },
                    index: 0,
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: prompt || 0,
                completion_tokens: completion || 0,
                total_tokens: total || 0,
            },
        }),
        finish: () => ({
            id,
            created,
            object: "chat.completion.chunk",
            model,
            choices: [
                {
                    delta: {content: ""},
                    index: 0,
                    finish_reason: "stop",
                },
            ],
        }),
    };
}