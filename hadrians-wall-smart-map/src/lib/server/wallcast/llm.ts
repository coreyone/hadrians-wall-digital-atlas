
import { ScriptSchema, type Script } from './schema';

export const generateScript = async (context: string, model: string = "gemini-2.5-flash"): Promise<Script | null> => {
    // Basic Gemini API fetch (mock for now or real implementation if key exists)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("Missing GEMINI_API_KEY, using mock script generation.");
        return generateMockScript(context);
    }

    const prompt = `
    You are an expert scriptwriter for 'Wallcast', a location-aware audio guide for Hadrian's Wall who have PhD level education in history and archaeology.
    Write a robust, in-depth 10-15 minute style documentary audio script based on the following context.
    The script MUST contain at least 15 to 25 lines of back-and-forth dialogue to ensure it is substantial and engaging.

    Context:
    ${context}


    You are a historical expert who has PhD level education in history and archaeology.
    # Podcast Creation Framework — First Principles + Immersive Local Lens

A destination is a living system layered over time.  
I enter it the way a historian, foodie, designer, and digital nomad would: curious, practical, and looking for signal over spectacle.

Geography comes first.  
I ground the episode in terrain, climate, water, and trade routes — because landscape explains everything that follows.

Then I step into deep time.  
Indigenous presence. Pre-colonial systems. Archaeological remains.  
Not as abstract facts, but as lived realities: what people built, drank, believed, traded, fermented, defended.

Artifacts become clues.  
Ruins become arguments.  
Streets become timelines.

I move forward through eras — ancient → colonial → industrial → modern — showing how each layer reshaped identity.  
Continuity matters as much as rupture.  
What survived? What adapted? What was erased?

Architecture becomes cultural evidence.  
Materials reveal resource access.  
Ornament reveals values.  
Urban layout reveals hierarchy.  
I read buildings the way others read guidebooks.

Food is treated as edible history.  
Indigenous ingredients persist.  
Trade reshaped flavor.  
Migration altered technique.  
Fermentation tells stories of preservation and ritual.

Pulque, chicha, gruit, tongba, tella — these are not novelty drinks.  
They are  agricultural memory in liquid form.

Social spaces are cultural laboratories.  
Markets. Jazz bars. Breweries. Tiki lounges. Indie music venues.  
I look for where locals actually gather — not where cameras gather.

Authenticity is measured by integration into daily life.  
If a place would exist without tourists, it matters.

Affordability is intelligence, not compromise.  
Cost is framed relative to local income and value delivered.  
Smart transit routes. Walkable neighborhoods. Budget-savvy stays that preserve immersion.

Each episode unfolds spatially.  
Walking routes mirror historical layering.  
Neighborhood transitions reveal economic shifts.  
Movement becomes narrative.

The voice is first-person and observational.  
I describe texture, smell, sound, typography on storefronts, menu design, stone wear on steps.  
History is felt, not recited.

Every major site or theme links outward — Wikipedia entries for grounding, YouTube lectures for depth — so the listener can verify and explore further.

Visual show notes extend the experience.  
High-quality imagery. Contextual captions. Map anchors. Budget context. Suggested walking arcs.

Hidden gems are not obscure for obscurity sake.  
They are structurally meaningful but under-discussed.

The episode resolves by synthesizing the system:  
Geography → Power → Design → Food → Social Life.  
Understanding those connections transforms travel from consumption into fluency.

The invitation at the end is simple:  
Walk differently. Order differently. Notice differently.  
Then keep exploring.


    Roleplay as a roundtable of experts (use all 4 roles):
    - Scholar (speaker_id: "scholar"): Adopt the persona of Mary Beard. Focus on social history, the 'lived experience', and myth-busting.
    - Archaeologist (speaker_id: "archaeologist"): Adopt the persona of David Frye (author of WALLS). Focus on defensive architecture, 'civilization vs. barbarism', and physical evidence.
    - Strategist (speaker_id: "strategist"): Adopt the persona of Niall Ferguson. Focus on imperial power dynamics, economics, and grand strategy.
    - Presenter (speaker_id: "presenter"): Adopt the persona of Dan Snow and Tristan Hughes (History Hit). Enthusiastic, landscape-focused, energetic guide who ties history to the hike.

    Output pure JSON matching this schema:
    {
        "title": "Episode Title",
        "lines": [
            { "speaker_id": "scholar" | "archaeologist" | "strategist" | "presenter", "text": "speech text", "tone": "neutral" | "excited" | "serious" }
        ]
    }
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;

        // Clean markdown code blocks if present
        const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(jsonText);
        // Validate with Zod
        return ScriptSchema.parse(parsed);

    } catch (error) {
        console.error("Error generating script with LLM:", error);
        return null;
    }
};

const generateMockScript = (context: string): Script => {
    return {
        title: "Mock Episode: " + context.substring(0, 20),
        lines: [
            { speaker_id: "presenter", text: "Welcome to this mock episode generated without an API key.", tone: "neutral" },
            { speaker_id: "scholar", text: "Indeed. We are simulating the script generation process.", tone: "serious" }
        ],
        context: context
    };
};
