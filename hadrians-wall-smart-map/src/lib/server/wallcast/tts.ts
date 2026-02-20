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

    try {
        console.log(`TTS Synthesizing (Gemini - ${voiceId}): ${text.substring(0, 20)}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
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

        clearTimeout(timeoutId);

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
        console.error("Error synthesizing speech:", error);
        throw error;
    }
};
