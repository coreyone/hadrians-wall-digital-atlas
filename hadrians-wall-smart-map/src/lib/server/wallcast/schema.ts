
import { z } from 'zod';

export const SpeakerIDSchema = z.enum(['scholar', 'archaeologist', 'strategist', 'presenter']);
export type SpeakerID = z.infer<typeof SpeakerIDSchema>;

export const SpeakerSchema = z.object({
    id: SpeakerIDSchema,
    name: z.string(),
    voice_id: z.string(), // ElevenLabs Voice ID
    description: z.string(),
    tone_prompt: z.string().optional() // Instructions for the LLM
});
export type Speaker = z.infer<typeof SpeakerSchema>;

export const LineSchema = z.object({
    speaker_id: SpeakerIDSchema,
    text: z.string(),
    tone: z.string().optional(), // e.g. "excited", "skeptical"
    audio_hash: z.string().optional() // Cache key
});
export type Line = z.infer<typeof LineSchema>;

export const ScriptSchema = z.object({
    title: z.string(),
    lines: z.array(LineSchema),
    context: z.string().optional() // Original source context
});
export type Script = z.infer<typeof ScriptSchema>;

export const SegmentSchema = z.object({
    id: z.string(), // e.g., 'seg-01'
    name: z.string(),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2), // LineString [lat, lon]
    distance_miles: z.number(),
    poi_ids: z.array(z.string()).optional() // Related POIs
});
export type Segment = z.infer<typeof SegmentSchema>;

export const EpisodeSchema = z.object({
    id: z.string(),
    title: z.string(),
    segment_id: z.string().optional(), // Link to Segment
    duration_seconds: z.number(),
    file_path: z.string(), // Relative to static/
    file_size_bytes: z.number(),
    hash: z.string(), // Content hash
    script: ScriptSchema,
    speakers: z.array(SpeakerIDSchema)
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const WallcastManifestSchema = z.object({
    version: z.string(),
    generated_at: z.string().datetime(),
    episodes: z.array(EpisodeSchema),
    segments: z.array(SegmentSchema)
});
export type WallcastManifest = z.infer<typeof WallcastManifestSchema>;
