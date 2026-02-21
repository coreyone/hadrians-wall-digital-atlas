import type { SpeakerID } from './schema';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn } from "bun";
import os from 'os';

// Helper to get API key from Env
export const getGeminiKey = (): string | undefined => {
    return process.env.GEMINI_API_KEY;
};

// Map SpeakerID to Gemini Voice IDs
const VOICE_MAP: Record<SpeakerID, string> = {
    'scholar': 'Kore',
    'archaeologist': 'Charon',
    'strategist': 'Fenrir',
    'presenter': 'Puck'
};

const CACHE_DIR = path.join(process.cwd(), '.wallcast/cache/tts');
const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const FALLBACK_TTS_MODEL = "gemini-2.5-pro-preview-tts";

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export const synthesizeLine = async (text: string, speakerId: SpeakerID): Promise<string> => {
    const voiceId = VOICE_MAP[speakerId];
    if (!voiceId) throw new Error(`No voice mapped for speaker: ${speakerId}`);

    // Create a stable hash for the cache key
    const hash = crypto.createHash('md5').update(`gemini:${speakerId}:${text}`).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);
    const pcmPath = path.join(CACHE_DIR, `${hash}.pcm`);

    // Return cached file if it exists
    if (fs.existsSync(cachePath)) {
        console.log(`TTS Cache Hit: ${text.substring(0, 20)}...`);
        return cachePath;
    }

    const apiKey = getGeminiKey();
    if (!apiKey) {
        // In mock mode, try to generate silent MP3 if ffmpeg exists
        try {
            const proc = spawn([
                "ffmpeg",
                "-f", "lavfi",
                "-i", "sine=f=440:d=1", // 1 second of 440Hz sine wave
                "-c:a", "libmp3lame",
                "-q:a", "9",
                "-y",
                cachePath
            ], { stdout: "ignore", stderr: "ignore" });

            const exitCode = await proc.exited;
            if (exitCode !== 0) throw new Error("ffmpeg failed");
            return cachePath;

        } catch (e) {
            console.warn("   ⚠️ ffmpeg missing or failed, creating dummy file.");
            fs.writeFileSync(cachePath, "dummy mock audio content");
            return cachePath;
        }
    }

    const MAX_RETRIES = 3;
    const REQUEST_TIMEOUT_MS = 45000;
    const requestedModel = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
    const modelCandidates = Array.from(
        new Set([requestedModel, FALLBACK_TTS_MODEL].filter(Boolean))
    );

    const isRetryableError = (message: string, abortError: boolean) =>
        abortError || /429|500|502|503|504|temporar|timeout/i.test(message);

    for (const modelName of modelCandidates) {
        let shouldTryNextModel = false;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            try {
                console.log(`TTS Synthesizing (${modelName} - ${voiceId}): ${text.substring(0, 20)}...`);

                const controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: text }] }],
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } }
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Gemini TTS API Error (${response.status} ${response.statusText}): ${errText}`);
                }

                const data = await response.json();
                const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

                if (!base64Audio) {
                    throw new Error("No audio data returned from Gemini TTS");
                }

                const buffer = Buffer.from(base64Audio, 'base64');
                fs.writeFileSync(pcmPath, buffer);

                // Convert PCM to MP3 using ffmpeg
                const proc = spawn([
                    "ffmpeg", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", pcmPath,
                    "-c:a", "libmp3lame", "-q:a", "2", cachePath
                ], { stdout: "ignore", stderr: "ignore" });

                const exitCode = await proc.exited;
                if (exitCode !== 0) {
                    throw new Error("ffmpeg failed to convert PCM to MP3");
                }

                // Cleanup PCM file
                if (fs.existsSync(pcmPath)) {
                    fs.unlinkSync(pcmPath);
                }

                return cachePath;
            } catch (error) {
                const abortError = error instanceof DOMException && error.name === "AbortError";
                const message = error instanceof Error ? error.message : String(error);
                const retryable = isRetryableError(message, abortError);
                const quotaZeroForModel = /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message) && /limit:\s*0/i.test(message);

                // Fall through to the next model candidate when this model has zero daily quota.
                if (quotaZeroForModel && modelName !== FALLBACK_TTS_MODEL) {
                    console.warn(`TTS model ${modelName} appears quota-blocked (limit 0). Trying fallback model...`);
                    shouldTryNextModel = true;
                    break;
                }

                if (attempt >= MAX_RETRIES || !retryable) {
                    console.error(`Error synthesizing speech after ${attempt} attempt(s) on ${modelName}: ${message}`);
                    throw error;
                }

                const backoffMs = 1000 * attempt;
                console.warn(`TTS attempt ${attempt}/${MAX_RETRIES} failed on ${modelName} (${message}). Retrying in ${backoffMs}ms...`);
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        }

        if (!shouldTryNextModel) {
            // No fallback condition, retries exhausted would already throw.
            break;
        }
    }

    throw new Error("TTS synthesis failed after retries.");
};
