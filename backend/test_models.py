import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print("API Key configured:", api_key[:15] + "..." if api_key else "None")

genai.configure(api_key=api_key)

try:
    print("Querying Google AI Model Service...")
    models = genai.list_models()
    print("Available models:")
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            print(f" - {m.name}")
except Exception as e:
    print("Error during API query:", e)
