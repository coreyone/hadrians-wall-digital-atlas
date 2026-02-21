
import { parseArgs } from "util";

// Basic CLI argument parsing
const { values } = parseArgs({
    args: Bun.argv,
    options: {
        segment: {
            type: 'string',
        },
        'dry-run': {
            type: 'boolean',
        },
        force: {
            type: 'boolean',
        },
        'min-minutes': {
            type: 'string',
        },
        'target-minutes': {
            type: 'string',
        },
        help: {
            type: 'boolean',
        },
    },
    strict: true,
    allowPositionals: true,
});

if (values.help) {
    console.log(`
  Usage: bun scripts/generate-wallcast.ts [options]

  Options:
    --segment <id>  Generate audio for a specific segment only
    --dry-run       Run the pipeline without calling external APIs (LLM/TTS)
    --force         Overwrite existing audio files
    --min-minutes   Enforce a minimum script duration in minutes (default: 8)
    --target-minutes  Target script duration in minutes (default: 15)
    --help          Show this help message
  `);
    process.exit(0);
}


import { fetchWikipediaContent } from "../src/lib/server/wallcast/ingestion";
import { generateScript } from "../src/lib/server/wallcast/llm";
import { synthesizeLine, getGeminiKey } from "../src/lib/server/wallcast/tts";
import { concatAudio, normalizeAudio } from "../src/lib/server/wallcast/audio";
import { type SpeakerID } from "../src/lib/server/wallcast/schema";
import { englishHeritageSites } from "../src/lib/data/trail";
import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'static', 'wallcast');
const manifestPath = path.join(outputDir, 'manifest.json');

type WallcastManifest = {
    version: string;
    generated_at: string;
    episodes: any[];
    segments: any[];
};

const createEmptyManifest = (): WallcastManifest => ({
    version: "1.0",
    generated_at: new Date().toISOString(),
    episodes: [],
    segments: []
});

const readManifest = (): WallcastManifest => {
    if (!fs.existsSync(manifestPath)) {
        return createEmptyManifest();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<WallcastManifest>;
        return {
            version: parsed.version ?? "1.0",
            generated_at: parsed.generated_at ?? new Date().toISOString(),
            episodes: Array.isArray(parsed.episodes) ? parsed.episodes : [],
            segments: Array.isArray(parsed.segments) ? parsed.segments : []
        };
    } catch {
        console.warn("Could not parse existing manifest. Starting from empty manifest in memory.");
        return createEmptyManifest();
    }
};

const toSegmentId = (name: string): string =>
    name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const WORDS_PER_MINUTE = 130;

const estimateDurationSecondsFromWords = (wordCount: number): number =>
    Math.round((wordCount / WORDS_PER_MINUTE) * 60);

const generateEpisode = async (topic: string, minMinutes: number, targetMinutes: number, siteData?: any) => {
    console.log(`\nGenerating Wallcast for: '${topic}'...`);
    console.log("-----------------------");

    // 1. Ingestion
    console.log("1. Ingesting content...");
    const wikiData = await fetchWikipediaContent(topic);
    if (!wikiData) {
        console.warn(`⚠️ Failed to fetch Wikipedia content for ${topic}. Skipping.`);
        return;
    }
    console.log(`   Found: ${wikiData.title}`);

    // 2. Script Generation
    console.log("2. Generating Script...");
    const script = await generateScript(wikiData.extract.substring(0, 8000), {
        minMinutes,
        targetMinutes
    });
    if (!script) {
        console.error(`Failed to generate script for ${topic}.`);
        return;
    }
    const totalWords = script.lines.reduce((acc, line) => acc + line.text.split(/\s+/).filter(Boolean).length, 0);
    const estimatedDurationSeconds = estimateDurationSecondsFromWords(totalWords);

    if (estimatedDurationSeconds < Math.round(minMinutes * 60)) {
        console.error(
            `Generated script too short (${(estimatedDurationSeconds / 60).toFixed(1)}m), minimum is ${minMinutes}m. Skipping ${topic}.`
        );
        return;
    }

    console.log(`   Title: ${script.title}`);
    console.log(`   Lines: ${script.lines.length}`);
    console.log(`   Estimated Runtime: ${(estimatedDurationSeconds / 60).toFixed(1)} minutes`);

    // 3. TTS Synthesis
    console.log("3. Synthesizing Audio...");
    const audioFiles: string[] = [];

    for (const [index, line] of script.lines.entries()) {
        try {
            // Low noise console
            process.stdout.write(`.`);
            const audioPath = await synthesizeLine(line.text, line.speaker_id as SpeakerID);
            if (audioPath) {
                audioFiles[index] = audioPath;
            }
            // Gemini TTS Limit: 10 requests per minute (1 every 6 seconds)
            // Wait 6.5s to be safe before the next request, unless it's the last line.
            if (index < script.lines.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 6500));
            }
        } catch (e) {
            console.error(`\nFailed to synthesize line.`, e);
        }
    }
    console.log(" Done.");

    // Remove any nulls from failed generations
    const validAudioFiles = audioFiles.filter(Boolean);

    // 4. Audio Engineering
    if (validAudioFiles.length > 0) {
        console.log("4. Concatenating & Normalizing...");
        const rawEpisodePath = path.join(outputDir, `episode-${Date.now()}-raw.mp3`);
        await concatAudio(validAudioFiles, rawEpisodePath);

        const finalFilename = `episode-${Date.now()}.mp3`;
        const finalEpisodePath = path.join(outputDir, finalFilename);
        await normalizeAudio(rawEpisodePath, finalEpisodePath);

        if (fs.existsSync(rawEpisodePath)) fs.unlinkSync(rawEpisodePath);

        // 6. Update Manifest
        console.log("5. Updating Manifest...");
        const manifest = readManifest();

        const newEpisodeId = path.basename(finalEpisodePath, '.mp3');
        const newSegmentId = siteData?.id || `seg-${newEpisodeId}`;

        // Check if episode already exists for this segment
        const existingIdx = manifest.episodes.findIndex(e => e.segment_id === newSegmentId);
        const episodeData = {
            id: newEpisodeId,
            title: script.title,
            duration_seconds: estimatedDurationSeconds,
            file_path: `/wallcast/${finalFilename}`,
            file_size_bytes: fs.statSync(finalEpisodePath).size,
            hash: "generated",
            script: script,
            speakers: ["presenter", "scholar"], // generic for now
            segment_id: newSegmentId
        };

        if (existingIdx >= 0) {
            manifest.episodes[existingIdx] = episodeData;
        } else {
            manifest.episodes.push(episodeData);
        }

        // Add/Update Segment with real coordinates
        const segmentData = {
            id: newSegmentId,
            name: siteData?.name || script.title,
            coordinates: siteData?.coords || [0, 0],
            distance_miles: 0
        };

        const existingSegIdx = manifest.segments.findIndex(s => s.id === newSegmentId);
        if (existingSegIdx >= 0) {
            manifest.segments[existingSegIdx] = segmentData;
        } else {
            manifest.segments.push(segmentData);
        }

        manifest.generated_at = new Date().toISOString();
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✅ Completed: ${script.title}`);

    } else {
        console.warn(`No audio files generated for ${topic}.`);
    }
};

const main = async () => {
    console.log("Wallcast Route Generator v1.1");
    console.log("=============================");

    // Check Environment Variables
    const geminiKey = getGeminiKey() || process.env.GEMINI_API_KEY;
    if (!values['dry-run'] && !geminiKey) {
        console.error(`Error: Missing GEMINI_API_KEY`);
        process.exit(1);
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const minMinutes = Math.max(1, Number(values['min-minutes'] ?? "8"));
    const targetMinutes = Math.max(minMinutes, Number(values['target-minutes'] ?? "15"));

    if (!Number.isFinite(minMinutes) || !Number.isFinite(targetMinutes)) {
        console.error("Error: --min-minutes and --target-minutes must be valid numbers.");
        process.exit(1);
    }
    console.log(`Duration settings: minimum ${minMinutes}m, target ${targetMinutes}m`);

    // Determine topics
    let topics = englishHeritageSites.map(site => ({
        name: site.name,
        id: toSegmentId(site.name),
        coords: site.coords
    }));

    if (values.segment) {
        const segmentQuery = String(values.segment).toLowerCase();
        topics = topics.filter(t => t.id === segmentQuery || t.name.toLowerCase().includes(segmentQuery));
    }

    if (!values.force) {
        const manifest = readManifest();
        const existingSegmentIds = new Set(
            manifest.episodes
                .map((episode) => episode?.segment_id)
                .filter((segmentId): segmentId is string => typeof segmentId === 'string' && segmentId.length > 0)
        );

        const beforeCount = topics.length;
        topics = topics.filter((topic) => !existingSegmentIds.has(topic.id));
        const skippedCount = beforeCount - topics.length;

        if (skippedCount > 0) {
            console.log(`Skipping ${skippedCount} existing episode(s). Use --force to regenerate.`);
        }
    }

    console.log(`Found ${topics.length} sites to process.`);

    for (const topic of topics) {
        try {
            await generateEpisode(topic.name, minMinutes, targetMinutes, topic);
        } catch (e) {
            console.error(`❌ Global error processing ${topic.name}:`, e);
        }
    }

    console.log("\n✅ Route generation pipeline completed.");
};

main();
