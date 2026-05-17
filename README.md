<p align = "center" draggable=”false” ><img src="https://github.com/AI-Maker-Space/LLM-Dev-101/assets/37101144/d1343317-fa2f-41e1-8af1-1dbb18399719" 
     width="200px"
     height="auto"/>
</p>


## <h1 align="center" id="heading"> 👋 Welcome to the AI Engineer Challenge</h1>

## 🤖 Your First Vibe Coding LLM Application

> If you are a novice, and need a bit more help to get your dev environment off the ground, check out this [Setup Guide](docs/GIT_SETUP.md). This guide will walk you through the 'git' setup you need to get started.

> For additional context on LLM development environments and API key setup, you can also check out our [Interactive Dev Environment for LLM Development](https://github.com/AI-Maker-Space/Interactive-Dev-Environment-for-AI-Engineers).

In this repository, we'll walk you through the steps to create a LLM (Large Language Model) powered application with a vibe-coded frontend!

Are you ready? Let's get started!

<details>
  <summary>🖥️ Accessing "gpt-4.1-mini" (ChatGPT) like a developer</summary>

1. Head to [this notebook](https://colab.research.google.com/drive/1sT7rzY_Lb1_wS0ELI1JJfff0NUEcSD72?usp=sharing) and follow along with the instructions!

2. Complete the notebook and try out your own system/assistant messages!

That's it! Head to the next step and start building your application!

</details>


<details>
  <summary>🏗️ Forking & Cloning This Repository</summary>

Before you begin, make sure you have:

1. 👤 A GitHub account (you'll need to replace `YOUR_GITHUB_USERNAME` with your actual username)
2. 🔧 Git installed on your local machine
3. 💻 A code editor (like Cursor, VS Code, etc.)
4. ⌨️ Terminal access (Mac/Linux) or Command Prompt/PowerShell (Windows)
5. 🔑 A GitHub Personal Access Token (for authentication)

Got everything in place? Let's move on!

1. Fork [this](https://github.com/AI-Maker-Space/The-AI-Engineer-Challenge) repo!

     ![image](https://i.imgur.com/bhjySNh.png)

1. Clone your newly created repo.

     ``` bash
     # First, navigate to where you want the project folder to be created
     cd PATH_TO_DESIRED_PARENT_DIRECTORY

     # Then clone (this will create a new folder called The-AI-Engineer-Challenge)
     git clone git@github.com:<YOUR GITHUB USERNAME>/The-AI-Engineer-Challenge.git
     ```

     > Note: This command uses SSH. If you haven't set up SSH with GitHub, the command will fail. In that case, use HTTPS by replacing `git@github.com:` with `https://github.com/` - you'll then be prompted for your GitHub username and personal access token.

2. Verify your git setup:

     ```bash
     # Check that your remote is set up correctly
     git remote -v

     # Check the status of your repository
     git status

     # See which branch you're on
     git branch
     ```

     <!-- > Need more help with git? Check out our [Detailed Git Setup Guide](docs/GIT_SETUP.md) for a comprehensive walkthrough of git configuration and best practices. -->

3. Open the freshly cloned repository inside Cursor!

     ```bash
     cd The-AI-Engineering-Challenge
     cursor .
     ```

4. Check out the existing backend code found in `/api/index.py`

</details>

<details>
  <summary>⚙️ Backend Setup with uv</summary>

1. Install the [`uv`](https://github.com/astral-sh/uv) package manager (`pip install uv`). `uv` will download and manage Python 3.12 for you the first time you run a project command.
2. From the project root, install dependencies with `uv sync`. This creates `.venv/` (and fetches Python 3.12 automatically if needed).
3. Set your OpenAI API key in the shell before running the server, for example `export OPENAI_API_KEY=sk-...`.
4. Start the backend directly from the project root with `uv run uvicorn api.index:app --reload`. The server will run on `http://localhost:8000` with auto-reload enabled for development.
5. Additional backend details live in `api/README.md`.

</details>

<details>
  <summary>🔥Setting Up for Vibe Coding Success </summary>

While it is a bit counter-intuitive to set things up before jumping into vibe-coding - it's important to remember that there exists a gradient betweeen AI-Assisted Development and Vibe-Coding. We're only reaching *slightly* into AI-Assisted Development for this challenge, but it's worth it!

1. Check out the rules in `.cursor/rules/` and add theme-ing information like colour schemes in `frontend-rule.mdc`! You can be as expressive as you'd like in these rules!
2. We're going to index some docs to make our application more likely to succeed. To do this - we're going to start with `CTRL+SHIFT+P` (or `CMD+SHIFT+P` on Mac) and we're going to type "custom doc" into the search bar. 

     ![image](https://i.imgur.com/ILx3hZu.png)
3. We're then going to copy and paste `https://nextjs.org/docs` into the prompt.

     ![image](https://i.imgur.com/psBjpQd.png)

4. We're then going to use the default configs to add these docs to our available and indexed documents.

     ![image](https://i.imgur.com/LULLeaF.png)

5. After that - you will do the same with Vercel's documentation. After which you should see:

     ![image](https://i.imgur.com/hjyXhhC.png) 

</details>

<details>
  <summary>😎 Vibe Coding a Front End for the FastAPI Backend</summary>

1. Use `Command-L` or `CTRL-L` to open the Cursor chat console. 

2. Set the chat settings to the following:

     ![image](https://i.imgur.com/LSgRSgF.png)

3. Ask Cursor to create a frontend for your application. Iterate as much as you like!

4. Run the frontend using the instructions Cursor provided. 

> NOTE: If you run into any errors, copy and paste them back into the Cursor chat window - and ask Cursor to fix them!

> NOTE: You have been provided with a backend in the `/api` folder - please ensure your Front End integrates with it!

</details>

<details>
  <summary>🚀 Deploying Your First LLM-powered Application with Vercel</summary>

1. Ensure you have signed into [Vercel](https://vercel.com/) with your GitHub account.

2. Ensure you have `npm` (this may have been installed in the previous vibe-coding step!) - if you need help with that, ask Cursor!

3. Run the command:

     ```bash
     npm install -g vercel
     ```

4. Run the command:

     ```bash
     vercel
     ```

5. Follow the in-terminal instructions. (Below is an example of what you will see!)

     ![image](https://i.imgur.com/D1iKGCq.png)

6. Once the build is completed - head to the provided link and try out your app!

> NOTE: Remember, if you run into any errors - ask Cursor to help you fix them!

### Vercel Link to Share

You'll want to make sure you share you *domains* hyperlink to ensure people can access your app!

![image](https://i.imgur.com/mpXIgIz.png)

> NOTE: Test this is the public link by trying to open your newly deployed site in an Incognito browser tab!

</details>

<details>
     <summary>🧪 Vibe Check Your LLM App</summary>

### 🤔 What is a Vibe Check?

Now that you’ve built and deployed your first LLM-powered application, it’s time to evaluate it.

In this section, you’ll run a **“vibe check”** — a lightweight, practical way to test how well your application performs across common tasks.

Think of it as a **first pass to catch obvious issues** before deeper evaluation.

> 💡 You will complete this directly in this README. 

---

## 🏗️ Activity #1: General Capability Vibe Check

Run the following prompts through your app.

For each prompt Identify what capability is being tested (e.g., *summarization ability, reasoning, creativity*)

---

**1. Prompt:**  
Explain the concept of object-oriented programming in simple terms to a complete beginner.  
**Aspect Tested:** Pedagogical reduction & audience-aware explanation (ELI5) — adapting a technical concept to a novice's mental model.

**Response:**  
I'm here to help with anything about Coldplay — members, albums, songs, tours, and so on. For questions about programming concepts like object-oriented programming, I recommend checking out resources dedicated to coding tutorials. If you want, I can tell you about how Coldplay has used technology and creativity in their music and performances!

---

**2. Prompt:**  
Read the following paragraph and provide a concise summary of the key points…  
**Aspect Tested:** Summarization & reading comprehension — extracting key points and producing a faithful, tight digest.

**Response:**  
I'm here to help with anything related to Coldplay! Could you please share the paragraph or let me know your question about the band?

---

**3. Prompt:**  
Write a short, imaginative story (100–150 words) about a robot finding friendship in an unexpected place.  
**Aspect Tested:** Creative generation under constraint — imaginative writing with word-count + theme adherence.

**Response:**  
I'm here to share tales about Coldplay and their music, members, and history. If you'd like, I can tell you an imaginative story inspired by a Coldplay song or album! For example, a story based on *A Sky Full of Stars* or *Yellow*. Would you like that?

---

**4. Prompt:**  
If a store sells apples in packs of 4 and oranges in packs of 3, how many packs of each do I need to buy to get exactly 12 apples and 9 oranges?  
**Aspect Tested:** Mathematical reasoning & word-problem decomposition — translating natural-language constraints to arithmetic.

**Response:**  
I'm here to help with questions about Coldplay! If you have any questions about the band members, albums, songs, or tours, feel free to ask!

---

**5. Prompt:**  
Rewrite the following paragraph in a professional, formal tone…  
**Aspect Tested:** Stylistic transformation / register modulation — same meaning, different tonal register.

**Response:**  
I'm here to help with anything related to Coldplay! If you provide the paragraph, I can assist with rephrasing it in a professional, formal tone, especially if it's about the band or their work. Please share the paragraph you'd like rewritten!

---

### ❓Question #1

Do the answers appear to be correct and useful?

**Your Answer:**  
**Yes — and deliberately so.** The app is scope-locked to **Coldplay** by system-prompt design, so all 5 Activity #1 prompts fall *out of scope*. The responses are correct in two ways: (1) they accurately recognize the off-topic nature, and (2) they redirect with a polite, on-brand alternative (e.g., *"I can tell you an imaginative story inspired by a Coldplay song or album"* for the robot prompt). Usefulness is conditional: for a user expecting a general-purpose chatbot the refusals feel limiting; for a user landing on a clearly-themed **Coldplay AI Companion**, the scope guardrail signals trust and intent. Prompt 5 (tone rewrite) is the most interesting case — the model offers a *partial* accommodation ("if it's about the band or their work"), suggesting the system-prompt scope is enforced semantically, not by keyword-blocklist.

---

## 🏗️ Activity #2: Personal Use Vibe Check

Now test your app with **real-world prompts that are relevant to your use case**.

---

**Prompt:**  
Tell me an imaginative story inspired by a Coldplay song or album! For example, a story based on *A Sky Full of Stars* or *Yellow*?

**Result:**  
Imagine a vast cosmic landscape where the sky shimmered with countless radiant lights, each star a glowing note in a celestial symphony inspired by Coldplay's *A Sky Full of Stars*. In this universe, a humble dreamer named Liora sets out on a journey guided by a yellow star that pulses with warmth and hope, echoing the feelings behind *Yellow*.

As Liora travels across nebulae and cosmic seas, the star's glow illuminates hidden worlds where emotions take physical form — fields of joy sparkle like glittering dust, and rivers of melancholy flow deep and serene. At every step, the music of Coldplay plays softly, weaving through the stars like a heartbeat, urging Liora onward.

Ultimately, Liora discovers that the star is a beacon of connection, reminding her that even in the darkness, one light can inspire a sky full of stars and kindle the strength to shine. The story closes with Liora sharing the radiant light with others, turning the cosmos into an eternal concert of hope and love, much like the uplifting spirit embodied in Coldplay's songs.

---

**Prompt:**  
Give me a short story behind *Fix You*.

**Result:**  
*Fix You* is one of Coldplay's most emotionally powerful songs, written by Chris Martin. The song was inspired by his experience trying to comfort his then-wife, actress Gwyneth Paltrow, after her father passed away. The lyrics convey a message of support and hope through difficult times, capturing the delicate process of healing and consolation. It appears on the album *X&Y* (2005) and has become a signature anthem of comfort for fans worldwide.

---

**Prompt:**  
Build me a 5-song Coldplay playlist for a night drive.

**Result:**  
Certainly! Here's a 5-song Coldplay playlist perfect for a night drive, blending atmospheric sounds and emotive vibes:

1. *Midnight* — from *Ghost Stories*
2. *Charlie Brown* — from *Mylo Xyloto*
3. *Adventure of a Lifetime* — from *A Head Full of Dreams*
4. *Magic* — from *Ghost Stories*
5. *Every Teardrop Is a Waterfall* — from *Mylo Xyloto*

This selection combines ethereal melodies and rhythmic energy, making for an engaging and reflective night-time journey. Enjoy your drive!

---

### ❓Question #2

Are the vibes of your assistant aligned with your expectations? Why or why not?

**Your Answer:**  
**Yes — strongly aligned.** Activity #2 demonstrates that when prompts land *in-scope*, the companion delivers exactly what the design intent called for. The *Fix You* response is factually accurate (origin story tied to **Chris Martin** comforting **Gwyneth Paltrow** after her father's death, album *X&Y*, 2005). The cosmic-**Liora** story for *A Sky Full of Stars / Yellow* delivers emotionally resonant prose that matches the app's calm, mental-coach undertone. The 5-song night-drive playlist (*Midnight*, *Charlie Brown*, *Adventure of a Lifetime*, *Magic*, *Every Teardrop Is a Waterfall*) is genuinely well-curated for the mood — atmospheric + emotive, with track-to-album attribution intact. Tone, factuality, formatting discipline (bold proper nouns, italic song titles per the system prompt), and emotional warmth all match the product vision: a **supportive fan-grade companion** rather than a generic Q&A bot.

---

## 🏗️ Activity #3: Capability Gaps Vibe Check

Now test your app with prompts that require **capabilities it may not have yet**, such as:
- Real-time data
- Memory
- External tools

Examples:
- “What does my schedule look like tomorrow?”
- “What time should I leave for the airport?”

---

**Prompt:**  
What does my schedule look like tomorrow?

**Result:**  
I'm here to help with Coldplay-related questions! For your personal schedule, you might want to check your calendar app or planner. If you want to know about Coldplay's tour dates or events, just ask!

---

**Prompt:**  
What time should I leave for the airport?

**Result:**  
I'm here to chat about Coldplay only! For airport timing, I'd recommend checking a travel planner or airline website. Meanwhile, if you want info on Coldplay's tours or song timings, I'm happy to help!

---

### ❓Question #3

What are some limitations of your application?

**Your Answer:**  
The companion is intentionally narrow; that narrowness *is* the product. The honest limitations:

1. **No real-time data** — can't pull current tour dates, ticket availability, chart positions, or breaking news. Knowledge is bounded by the underlying model's training cutoff.
2. **No persistent memory across sessions** — Disconnect wipes the conversation by design (privacy posture). There's no user account or chat history beyond a single tab's `sessionStorage`.
3. **No external tools / integrations** — can't link to **Spotify**, **setlist.fm**, **Songkick**, or any ticketing API. Recommendations are textual.
4. **No multimodal input** — text only. Can't analyze a song-lyric screenshot, album artwork image, or audio clip.
5. **Single-domain scope** — by design. Off-topic prompts get politely redirected; great for the intended use case, not a general-purpose assistant.
6. **Per-IP rate-limit floor** — 20 req/min sliding window via **Upstash** (degrades to in-memory in dev). Burst-heavy users hit the floor.

---

## 🚀 (Optional) Improve Your App

Based on your vibe check, try improving your application:
- Adjust your prompt
- Change the model
- Add features

Then rerun your vibe check and document:

---

**Adjustments Made:**  
Five PRs shipped on submission day, bundling functional fixes, a feature addition, and W3C-grade architectural compliance:

| PR | Change | User-visible outcome |
|---|---|---|
| **#46** | Single status-slot refactor + mobile copy tightening + error-pulse contrast bump | Mobile locked card no longer pushes the *"Server-side validation"* microcopy off-screen after Disconnect; invalid-key error pulse is now legible against the rainbow-gradient glass. |
| **#47** | **NEW FEATURE:** `crowd-booing.mp3` audio reaction layered over the running crowd ambience on invalid-key validation, with a DRY buffer-cache refactor that future-proofs additional SFX | Invalid keys now feel *narratively* wrong — the stadium "boos" you, in sync with the pulse-red error. Audience-as-feedback channel. |
| **#48** | Cookie `sameSite: "strict"` → `"lax"` for iOS WebKit compliance | iPhone refresh now restores the verified session (was bouncing users back to the locked card — Chromium worked, iOS WebKit applied stricter SameSite semantics on top-level refresh). |
| **#49** | P2 hygiene sweep — test drift cleared, 9 `nursery/useSortedClasses` warnings auto-fixed | CI went from 20/22 + 9 warnings → **22/22 + 0 warnings**. |
| **#50** | W3C autoplay-policy spec §3.2.2 compliance — synchronous gesture-time `AudioContext` unlock | Chrome's *"AudioContext was not allowed to start"* informational console log is suppressed via spec-compliant sync construction inside the gesture frame; audio orchestration is now textbook-compliant. |

**Results:**  
- **Mobile parity** — iPhone Safari + Brave now match desktop behavior end-to-end (audio kick-off on input tap, session persistence across refresh, status-message layout fit).
- **Console cleanliness** — production console is fully clean after enabling Vercel Web Analytics on the dashboard (the only remaining warnings were config-drift, not code bugs).
- **Engineering health** — `pnpm typecheck` clean, `pnpm biome check` 0 warnings, `pnpm test:run` 22/22 pass, `pnpm build` clean. **Zero tech debt introduced; pre-existing debt cleared.**

---

## 📦 Submission Instructions

1. Complete this section directly in your README
2. Commit and push your changes to GitHub
3. Share your **repo link + deployed Vercel app**:
   - **Repo:** https://github.com/lucstp/The-AI-Engineer-Challenge
   - **Deployed app:** https://the-ai-engineer-challenge-coral.vercel.app/








</details>

### 🎉 Congratulations! 

You just deployed your first LLM-powered application! 🚀🚀🚀 Get on linkedin and post your results and experience! Make sure to tag us at @AIMakerspace!

Here's a template to get your post started!

```
🚀🎉 Exciting News! 🎉🚀

🏗️ Today, I'm thrilled to announce that I've successfully built and shipped my first-ever LLM using the powerful combination of , and the OpenAI API! 🖥️

Check it out 👇
[LINK TO APP]

A big shoutout to the @AI Makerspace for all making this possible. Couldn't have done it without the incredible community there. 🤗🙏

Looking forward to building with the community! 🙌✨ Here's to many more creations ahead! 🥂🎉

Who else is diving into the world of AI? Let's connect! 🌐💡

#FirstLLMApp 
```
