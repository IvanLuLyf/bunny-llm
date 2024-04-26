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

res = client.chat.completions.create(
    model='gpt-3.5-turbo',
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
    base_url='https://bunny-llm.deno.dev/cloudflare/v1/',
)
```

### Groq

- [Get API KEY](https://console.groq.com/keys)
- [Supported Models](https://console.groq.com/docs/models)

```python
from openai import OpenAI

client = OpenAI(
    api_key='YOUR_GROQ_API_KEY',
    base_url='https://bunny-llm.deno.dev/groq/v1/',
)
```

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIvanLuLyf%2Fbunny-llm)
