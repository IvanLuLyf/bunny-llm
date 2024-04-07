# bunny-gpt
Deno GPT API Service

## Usage

Just enjoy it

```python
from openai import OpenAI

client = OpenAI(
    api_key='EMPTY',
    base_url='https://bunny-gpt.deno.dev/v1/',
)

res = client.chat.completions.create(
    model='',
    messages=[
        {'role': 'user', 'content': 'Who are you?'}
    ],
    max_tokens=None,
    temperature=0,
)
print(res.choices[0].message.content)
```
