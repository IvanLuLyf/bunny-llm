# Bunny-LLM

a Deno LLM API Service

## Usage

### Free ChatGPT 3.5

```python
from openai import OpenAI

client = OpenAI(
    api_key='EMPTY',
    base_url='https://bunny-llm.deno.dev/v1/',
)
model_name = 'gpt-3.5-turbo'

res = client.chat.completions.create(
    model=model_name,
    messages=[
        {'role': 'user', 'content': 'Who are you?'}
    ],
    max_tokens=None,
    temperature=0,
)
print(res.choices[0].message.content)
```

### CloudFlare Workers AI

- [Document](https://developers.cloudflare.com/api/operations/workers-ai-post-run-model)
- [Supported Models](https://developers.cloudflare.com/workers-ai/models/)

```python
from openai import OpenAI

import json
import urllib.parse

client = OpenAI(
    api_key=urllib.parse.quote(json.dumps({
        'account': 'YOUR_ACCOUNT_ID',
        'token': 'YOUR_API_TOKEN',
    })),
    base_url='https://bunny-llm.deno.dev/v1/',
)

model_name = 'cloudflare:@cf/qwen/qwen1.5-0.5b-chat'
```

### Groq

- [Get API KEY](https://console.groq.com/keys)
- [Supported Models](https://console.groq.com/docs/models)

```python
from openai import OpenAI

client = OpenAI(
    api_key='YOUR_GROQ_API_KEY',
    base_url='https://bunny-llm.deno.dev/v1/',
)

model_name = 'groq:gemma-7b-it'
```

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIvanLuLyf%2Fbunny-llm)
