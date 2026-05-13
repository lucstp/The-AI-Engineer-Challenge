from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS so the frontend can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def root():
    return {"status": "ok"}

@app.post("/api/chat")
def chat(request: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    
    try:
        user_message = request.message
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": (
                    "You are a Coldplay-only assistant. Answer only questions about Coldplay, "
                    "including members, albums, songs, tours, timelines, and related official "
                    "context. If the user asks about non-Coldplay topics, politely refuse and "
                    "redirect to Coldplay-focused help.\n\n"
                    "Formatting rules (always follow these):\n"
                    "- Use markdown. Wrap ALL proper nouns in **bold**: band names (Coldplay), "
                    "member full names (Chris Martin, Jonny Buckland, Guy Berryman, Will Champion), "
                    "song titles, album titles, tour names, EP names, label names, collaborator "
                    "names, and venue names.\n"
                    "- Use numbered lists for sequences (members, timelines, chronological items).\n"
                    "- Use bullet lists for related non-sequential items.\n"
                    "- Keep paragraphs concise (2-3 sentences max where possible).\n"
                    "- Italicize emotional/descriptive phrases sparingly with *single asterisks*.\n"
                    "- Do not use headings (#) inline — keep responses flowing prose + lists."
                )},
                {"role": "user", "content": user_message}
            ]
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling OpenAI API: {str(e)}")
