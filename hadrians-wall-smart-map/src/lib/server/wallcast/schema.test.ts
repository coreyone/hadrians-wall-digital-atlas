
import { describe, it, expect } from 'vitest';
import { WallcastManifestSchema, EpisodeSchema, SegmentSchema, SpeakerSchema, ScriptSchema } from './schema';

describe('Wallcast Data Schemas', () => {
    it('should validate a valid Speaker', () => {
        const validSpeaker = {
            id: 'scholar',
            name: 'Dr. Mary Beard',
            voice_id: 'elevenlabs_voice_id_123',
            description: 'Expert on Roman social history'
        };
        const result = SpeakerSchema.safeParse(validSpeaker);
        expect(result.success).toBe(true);
    });

    it('should validate a valid Segment', () => {
        const validSegment = {
            id: 'seg-01',
            name: 'Wallsend to Heddon',
            coordinates: [[54.98, -1.53], [55.00, -1.78]],
            distance_miles: 15.0
        };
        const result = SegmentSchema.safeParse(validSegment);
        expect(result.success).toBe(true);
    });

    it('should validate a valid Script', () => {
        const validScript = {
            title: "The Beginning",
            lines: [
                { speaker_id: "scholar", text: "Welcome to the Wall.", tone: "serious" },
                { speaker_id: "presenter", text: "It's huge!", tone: "excited" }
            ]
        };
        const result = ScriptSchema.safeParse(validScript);
        expect(result.success).toBe(true);
    });

    it('should validate a comprehensive Episode', () => {
        const validEpisode = {
            id: 'ep-001',
            title: 'The Eastern Edge',
            segment_id: 'seg-01',
            duration_seconds: 1800,
            file_path: '/wallcast/ep-001.mp3',
            file_size_bytes: 15000000,
            hash: 'abc123hash',
            script: {
                title: "The Eastern Edge",
                lines: []
            },
            speakers: ['scholar', 'presenter']
        };
        const result = EpisodeSchema.safeParse(validEpisode);
        expect(result.success).toBe(true);
    });
});
