
import { ScriptSchema, type Script } from './schema';

const WORDS_PER_MINUTE = 130;

export type GenerateScriptOptions = {
    model?: string;
    minMinutes?: number;
    targetMinutes?: number;
    maxRetries?: number;
};

const countWords = (script: Script): number =>
    script.lines.reduce((sum, line) => {
        const words = line.text.trim().split(/\s+/).filter(Boolean).length;
        return sum + words;
    }, 0);

const buildPrompt = (context: string, minWords: number, targetWords: number, attempt: number): string => `
You are an expert scriptwriter for "Wallcast", a location-aware historical audio guide for Hadrian's Wall.
Write a rich, engaging, academically grounded roundtable script for hikers.

This script MUST be long-form:
- Hard minimum total words: ${minWords}
- Target total words: ${targetWords} to ${targetWords + 350}
- 24 to 40 dialogue lines
- Every line must be substantive (avoid one-sentence filler)
- Use all four voices repeatedly throughout the episode

${attempt > 1 ? `IMPORTANT: Previous attempt was too short. This version must exceed ${minWords} words.` : ""}

Context:
${context}

Roleplay as a roundtable of experts (use all 4 roles):
- Scholar (speaker_id: "scholar"): Mary Beard style. Social history, lived experience, myth-busting.
- Archaeologist (speaker_id: "archaeologist"): David Frye style. Defensive architecture, evidence, frontiers.
- Strategist (speaker_id: "strategist"): Niall Ferguson style. Imperial power, economics, grand strategy.
- Presenter (speaker_id: "presenter"): Dan Snow / Tristan Hughes style. Energetic, place-based storytelling.

Output pure JSON matching this schema:
{
  "title": "Episode Title",
  "lines": [
    { "speaker_id": "scholar" | "archaeologist" | "strategist" | "presenter", "text": "speech text", "tone": "neutral" | "excited" | "serious" }
  ]
}
`;

export const generateScript = async (
    context: string,
    options: GenerateScriptOptions = {}
): Promise<Script | null> => {
    // Basic Gemini API fetch (mock for now or real implementation if key exists)
    const apiKey = process.env.GEMINI_API_KEY;
    const model = options.model ?? "gemini-2.5-flash";
    const minMinutes = options.minMinutes ?? 8;
    const targetMinutes = options.targetMinutes ?? 15;
    const maxRetries = options.maxRetries ?? 4;

    const minWords = Math.ceil(minMinutes * WORDS_PER_MINUTE);
    const targetWords = Math.ceil(targetMinutes * WORDS_PER_MINUTE);

    if (!apiKey) {
        console.warn("Missing GEMINI_API_KEY, using mock script generation.");
        return generateMockScript(context);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const prompt = buildPrompt(context, minWords, targetWords, attempt);

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                const details = await response.text();
                throw new Error(`Gemini API Error (${response.status}): ${details}`);
            }

            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText || typeof rawText !== "string") {
                throw new Error("Gemini response missing script text.");
            }

            // Clean markdown code blocks if present
            const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonText);
            const script = ScriptSchema.parse(parsed);
            const wordCount = countWords(script);

            if (wordCount >= minWords) {
                return script;
            }

            console.warn(
                `Script too short on attempt ${attempt}/${maxRetries}: ${wordCount} words (minimum ${minWords}). Retrying...`
            );
        } catch (error) {
            console.error(`Error generating script with LLM (attempt ${attempt}/${maxRetries}):`, error);
        }
    }

    console.error(`Failed to generate a script meeting minimum length (${minMinutes} minutes) after ${maxRetries} attempts.`);
    return null;
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
