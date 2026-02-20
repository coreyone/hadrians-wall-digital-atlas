
import { describe, it, expect } from 'vitest';
import { spawn } from 'bun';
import path from 'path';

describe('Wallcast Generation Pipeline', () => {
    it('should run end-to-end in dry-run mode without crashing', async () => {
        const scriptPath = path.join(process.cwd(), 'scripts/generate-wallcast.ts');

        const proc = spawn([
            "bun",
            scriptPath,
            "--dry-run"
        ], {
            env: {
                ...process.env,
                GEMINI_API_KEY: "", // Force mock
                ELEVENLABS_API_KEY: "" // Force mock
            }
        });

        const exitCode = await proc.exited;

        // If it fails, print stderr for debugging
        if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text();
            console.error("Pipeline Test Failed:", stderr);
        }

        expect(exitCode).toBe(0);
    }, 20000); // 20s timeout for ffmpeg
});
