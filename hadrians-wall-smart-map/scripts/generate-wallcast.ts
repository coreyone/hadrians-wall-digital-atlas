
import { parseArgs } from "util";
import { z } from "zod";

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

const generateEpisode = async (topic: string, siteData?: any) => {
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
    const script = await generateScript(wikiData.extract.substring(0, 8000));
    if (!script) {
        console.error(`Failed to generate script for ${topic}.`);
        return;
    }
    console.log(`   Title: ${script.title}`);
    console.log(`   Lines: ${script.lines.length}`);

    // 3. TTS Synthesis
    console.log("3. Synthesizing Audio...");
    const audioFiles: string[] = [];

    const BATCH_SIZE = 1;
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
        let manifest: { version: string, generated_at: string, episodes: any[], segments: any[] } = { version: "1.0", generated_at: new Date().toISOString(), episodes: [], segments: [] };

        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch (e) {
                console.warn("Could not parse existing manifest.");
            }
        }

        const newEpisodeId = path.basename(finalEpisodePath, '.mp3');
        const newSegmentId = siteData?.id || `seg-${newEpisodeId}`;

        // Calculate estimated duration (130 WPM average speaking rate)
        const totalWords = script.lines.reduce((acc, line) => acc + line.text.split(/\s+/).length, 0);
        const estimatedDurationSeconds = Math.round((totalWords / 130) * 60);

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

    // Determine topics
    let topics = englishHeritageSites.map(site => ({
        name: site.name,
        id: site.name.toLowerCase().replace(/\s+/g, '-'),
        coords: site.coords
    }));

    if (values.segment) {
        topics = topics.filter(t => t.id === values.segment || t.name.includes(values.segment as string));
    }

    console.log(`Found ${topics.length} sites to process.`);

    for (const topic of topics) {
        try {
            await generateEpisode(topic.name, topic);
        } catch (e) {
            console.error(`❌ Global error processing ${topic.name}:`, e);
        }
    }

    console.log("\n✅ Route generation pipeline completed.");
};

main();
