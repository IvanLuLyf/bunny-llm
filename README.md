# bunny-gpt
a Deno ChatGPT 3.5 API Service

## Usage

Just enjoy it

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

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIvanLuLyf%2Fbunny-gpt)
