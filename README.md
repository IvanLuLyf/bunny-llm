# Bunny-LLM

a Deno LLM API Service

## Usage

Set `base_url` to `https://bunny-llm.deno.dev/v1/` or your own endpoint.

Set env variable `BUNNY_API_TOKEN` and specific vendor tokens.

Model format `[vendor]:[model_name]`, for example `openai:gpt-4-turbo`

### Example

```python
from openai import OpenAI

client = OpenAI(
    base_url='https://bunny-llm.deno.dev/v1/',
    api_key='YOUR_BUNNY_API_TOKEN',
)
model_name = 'cloudflare:@cf/qwen/qwen1.5-0.5b-chat'

res = client.chat.completions.create(
    model=model_name,
    messages=[
        {'role': 'user', 'content': 'Who are you?'}
    ],
)
print(res.choices[0].message.content)
```

### Free ChatGPT 3.5

`vendor` is `free`

`api_key` is `EMPTY`

`model` is `gpt-3.5-turbo` only

### CloudFlare Workers AI

`vendor` is `cf` or `cloudflare`

`model` can refer to [Supported Models](https://developers.cloudflare.com/workers-ai/models/)

Set env variable `CF_ACCOUNT_ID` and `CF_API_TOKEN` or use the following algorithm.

```javascript
// JavaScript
api_key = encodeURIComponent(JSON.stringify({
    'account': 'YOUR_CF_ACCOUNT_ID',
    'token': 'YOUR_CF_API_TOKEN',
}))
```

```python
# python
import json
import urllib.parse

api_key=urllib.parse.quote(json.dumps({
    'account': 'YOUR_CF_ACCOUNT_ID',
    'token': 'YOUR_CF_API_TOKEN',
}))
```

### DashScope

`vendor` is `ds` or `dash_scope`

`model` can refer to [Supported Models](https://help.aliyun.com/zh/dashscope/developer-reference/model-square/)

`api_key` can set by `DASHSCOPE_API_KEY` or pass it directly [Get API KEY](https://dashscope.console.aliyun.com/apiKey)


### Groq

`vendor` is `groq`

`api_key` can set by `GROQ_API_KEY` or pass it directly [Get API KEY](https://console.groq.com/keys)

`model` can refer to [Supported Models](https://console.groq.com/docs/models)

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIvanLuLyf%2Fbunny-llm)
