import type { PageServerLoad } from './$types';
import fs from 'fs';
import path from 'path';

export const load: PageServerLoad = async () => {
    try {
        // Read directly from the static directory during SSR
        const manifestPath = path.join(process.cwd(), 'static', 'wallcast', 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            return {
                wallcastData: { episodes: [], segments: [] }
            };
        }

        const data = fs.readFileSync(manifestPath, 'utf-8');
        return {
            wallcastData: JSON.parse(data)
        };
    } catch (e) {
        console.error("Failed to load Wallcast manifest:", e);
        return {
            wallcastData: { episodes: [], segments: [] }
        };
    }
};
