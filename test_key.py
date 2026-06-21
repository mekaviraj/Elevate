import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print("Using API Key:", api_key)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
print("Querying URL:", url[:60] + "...")

try:
    with urllib.request.urlopen(url) as response:
        status = response.getcode()
        body = response.read().decode("utf-8")
        data = json.loads(body)
        print("Success! Status code:", status)
        models = data.get("models", [])
        print(f"Found {len(models)} models:")
        for m in models:
            print(f" - {m.get('name')} (supported methods: {m.get('supportedGenerationMethods')})")
except Exception as e:
    print("Error querying API:")
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
    else:
        print(e)
