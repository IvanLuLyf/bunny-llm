# bunny-gpt

a Deno ChatGPT 3.5 API Service

## Usage

### Free ChatGPT 3.5

```python
from openai import OpenAI

client = OpenAI(
    api_key='EMPTY',
    base_url='https://bunny-gpt.deno.dev/v1/',
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

- [Original API](https://developers.cloudflare.com/api/operations/workers-ai-post-run-model) 
- [Available Models](https://developers.cloudflare.com/workers-ai/models/)

```python
from openai import OpenAI

client = OpenAI(
    api_key=urllib.parse.quote(json.dumps({
        'account': 'YOUR_ACCOUNT_ID',
        'token': 'YOUR_API_TOKEN',
    })),
    base_url='https://bunny-gpt.deno.dev/cloudflare/v1/',
)

res = client.chat.completions.create(
    model='@cf/qwen/qwen1.5-0.5b-chat',
    messages=[
        {'role': 'user', 'content': 'Who are you?'}
    ],
    max_tokens=None,
    temperature=0,
)
print(res.choices[0].message.content)
```

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIvanLuLyf%2Fbunny-gpt)
