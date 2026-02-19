import * as turf from '@turf/turf';

// Default Footpath (Cleaned OSM Data) - Source of Truth
export const trailCoordinates = [
    [-3.21283, 54.95392], [-3.21277, 54.95392], [-3.21232, 54.95374], [-3.21236, 54.95394], [-3.21169, 54.95392], [-3.21202, 54.95368], [-3.18895, 54.94969], [-3.19035, 54.94974], [-3.19344, 54.95032], [-3.19648, 54.95064], [-3.1989, 54.95133], [-3.20018, 54.95236], [-3.20079, 54.95287], [-3.20132, 54.95309], [-3.20201, 54.95332], [-3.20255, 54.95344], [-3.20414, 54.95365], [-3.20501, 54.95372], [-3.20631, 54.95371], [-3.20791, 54.9538], [-3.20992, 54.95391], [-3.21043, 54.95393], [-3.21118, 54.95399], [-3.21132, 54.954], [-3.21147, 54.95399], [-3.18869, 54.94968], [-3.18788, 54.94964], [-3.18689, 54.9495], [-3.18634, 54.94934], [-3.18625, 54.94926], [-3.18617, 54.94907], [-3.18601, 54.94898], [-3.18578, 54.94884], [-3.1857, 54.94879], [-3.18537, 54.94872], [-3.18508, 54.94852], [-3.18513, 54.94838], [-3.18502, 54.94823], [-3.18498, 54.94805], [-3.18494, 54.94788], [-3.18493, 54.94796], [-3.18503, 54.94813], [-3.1851, 54.94832], [-3.18493, 54.94796], [-3.18491, 54.94776], [-3.1849, 54.94754], [-3.18474, 54.94723], [-3.18462, 54.94711], [-3.1847, 54.947], [-3.18458, 54.94668], [-3.18442, 54.94647], [-3.18444, 54.9464], [-3.1835, 54.94565], [-3.18155, 54.94401], [-3.18078, 54.94339], [-3.18055, 54.94314], [-3.18033, 54.94299], [-3.18019, 54.94281], [-3.17976, 54.94252], [-3.17865, 54.94178], [-3.17801, 54.94144], [-3.17752, 54.94125], [-3.17719, 54.94114], [-3.17853, 54.93996], [-3.17835, 54.94017], [-3.17764, 54.94059], [-3.17739, 54.94079], [-3.17728, 54.94109], [-3.17852, 54.94001], [-3.17597, 54.93856], [-3.17127, 54.93611], [-3.16961, 54.93517], [-3.16864, 54.93468], [-3.16831, 54.93466], [-3.16794, 54.93457], [-3.16745, 54.93431], [-3.16721, 54.93412], [-3.1683, 54.93342], [-3.16869, 54.93316], [-3.16942, 54.93268], [-3.17007, 54.93224], [-3.1673, 54.93001], [-3.16639, 54.92894], [-3.16572, 54.92651], [-3.16458, 54.92448], [-3.16237, 54.9239], [-3.16131, 54.92377], [-3.15923, 54.92298], [-3.15755, 54.92241], [-3.15019, 54.92502], [-3.14801, 54.92626], [-3.14863, 54.92727], [-3.14785, 54.92729], [-3.14698, 54.92731], [-3.14501, 54.92728], [-3.1411, 54.92686], [-3.13637, 54.92631], [-3.13033, 54.92601], [-3.11882, 54.92513], [-3.10229, 54.92388], [-3.09918, 54.92364], [-3.08557, 54.92261], [-3.08353, 54.92246], [-3.08314, 54.92244], [-3.08161, 54.92237], [-3.07817, 54.92215], [-3.07524, 54.92195], [-3.07113, 54.92161], [-3.06492, 54.92066], [-3.06433, 54.92077], [-3.06401, 54.92092], [-3.06354, 54.92104], [-3.06166, 54.92112], [-3.05879, 54.92123], [-3.05795, 54.92136], [-3.05645, 54.9217], [-3.05568, 54.92186], [-3.05418, 54.92207], [-3.0531, 54.92227], [-3.05187, 54.92237], [-3.05086, 54.9224], [-3.05024, 54.92233], [-3.04974, 54.92235], [-3.04865, 54.92238], [-3.04794, 54.92233], [-3.0468, 54.92217], [-3.04537, 54.92175], [-3.04339, 54.92157], [-3.01987, 54.92471], [-3.02107, 54.9243], [-3.0247, 54.92428], [-3.02955, 54.92409], [-3.03247, 54.92379], [-3.0341, 54.92363], [-3.03538, 54.92335], [-3.04047, 54.92259], [-3.04159, 54.92236], [-3.04207, 54.92135], [-3.01849, 54.92469], [-3.00757, 54.91594], [-3.00794, 54.91531], [-3.01582, 54.92228], [-3.01431, 54.92149], [-3.01246, 54.91979], [-3.01197, 54.91883], [-3.0107, 54.91751], [-3.0099, 54.91664], [-3.00971, 54.91628], [-3.01815, 54.92421], [-3.01883, 54.92363], [-3.01831, 54.92454], [-3.01684, 54.92489], [-3.0177, 54.92447], [-3.01221, 54.92074], [-3.01384, 54.92264], [-3.01442, 54.92305], [-3.01496, 54.92354], [-3.0153, 54.92452], [-3.01533, 54.92522], [-3.00735, 54.91613], [-3.00631, 54.91599], [-3.00414, 54.91566], [-3.0029, 54.91523], [-3.00204, 54.91456], [-2.99888, 54.91378], [-2.99813, 54.9134], [-2.99419, 54.91375], [-2.99082, 54.9141], [-2.98738, 54.91308], [-2.98716, 54.91287], [-3.0114, 54.91944], [-3.01137, 54.91937], [-3.00996, 54.91827], [-3.00863, 54.91704], [-3.00768, 54.91631], [-3.01533, 54.92522], [-3.0153, 54.92452], [-3.01496, 54.92354], [-3.01442, 54.92305], [-3.01384, 54.92264], [-3.01221, 54.92074], [-3.01163, 54.92002], [-3.0177, 54.92447], [-3.01684, 54.92489], [-3.01831, 54.92454], [-3.01883, 54.92363], [-3.01815, 54.92421], [-3.00971, 54.91628], [-3.0099, 54.91664], [-3.0107, 54.91751], [-3.01197, 54.91883], [-3.01246, 54.91979], [-3.01431, 54.92149], [-3.01582, 54.92228], [-3.00794, 54.91531], [-3.00766, 54.91573], [-3.00746, 54.91608], [-3.01866, 54.92488], [-3.04207, 54.92135], [-3.04159, 54.92236], [-3.04047, 54.92259], [-3.03538, 54.92335], [-3.0341, 54.92363], [-3.03247, 54.92379], [-3.02955, 54.92409], [-3.0247, 54.92428], [-3.02107, 54.9243], [-3.01987, 54.92471], [-3.04255, 54.92146], [-3.0451, 54.92168], [-3.04622, 54.92202], [-3.04746, 54.9223], [-3.04862, 54.92238], [-3.04932, 54.92237], [-3.04987, 54.92234], [-3.05064, 54.92239], [-3.05133, 54.92243], [-3.05266, 54.92228], [-3.05343, 54.92222], [-3.05446, 54.92203], [-3.05584, 54.92184], [-3.05716, 54.92153], [-3.05817, 54.92132], [-3.05999, 54.92113], [-3.06173, 54.92112], [-3.06398, 54.92093], [-3.06422, 54.92082], [-3.06453, 54.92068], [-3.07094, 54.92158], [-3.0718, 54.92171], [-3.07718, 54.92209], [-3.0792, 54.9222], [-3.08264, 54.92242], [-3.08341, 54.92245], [-3.08365, 54.92246], [-3.09181, 54.92309], [-3.10174, 54.92384], [-3.10287, 54.92393], [-3.11889, 54.92514], [-3.12479, 54.92558], [-3.1317, 54.92608], [-3.13815, 54.92652], [-3.14439, 54.92724], [-3.14568, 54.9273], [-3.14734, 54.92731], [-3.14847, 54.92726], [-3.14823, 54.92661], [-3.14793, 54.92595], [-3.15664, 54.92273], [-3.15789, 54.92264], [-3.16054, 54.92342], [-3.16183, 54.92387], [-3.16444, 54.92438], [-3.16536, 54.92586], [-3.16581, 54.92667], [-3.16699, 54.92903], [-3.16747, 54.9304], [-3.16945, 54.93266], [-3.16906, 54.93291], [-3.16851, 54.93328], [-3.1673, 54.93408], [-3.16726, 54.93415], [-3.16772, 54.93446], [-3.16816, 54.93464], [-3.16851, 54.93466], [-3.16899, 54.93483], [-3.17015, 54.93549], [-3.17441, 54.93776], [-3.17843, 54.93988], [-3.17729, 54.94098], [-3.17749, 54.94067], [-3.1781, 54.94037], [-3.17852, 54.94001], [-3.17719, 54.94114], [-3.17752, 54.94125], [-3.17801, 54.94144], [-3.17865, 54.94178], [-3.17976, 54.94252], [-3.18019, 54.94281], [-3.18033, 54.94293], [-3.18034, 54.94303], [-3.18073, 54.94327], [-3.18123, 54.9437], [-3.18267, 54.94488], [-3.18411, 54.94607], [-3.18443, 54.94644], [-3.18448, 54.94657], [-3.18463, 54.94679], [-3.18464, 54.94706], [-3.18463, 54.94718], [-3.18488, 54.94745], [-3.18487, 54.94765], [-3.18494, 54.94788], [-3.18498, 54.94805], [-3.18502, 54.94823], [-3.18513, 54.94838], [-3.18508, 54.94852], [-3.18537, 54.94872], [-3.1857, 54.94879], [-3.18578, 54.94884], [-3.18601, 54.94898], [-3.18612, 54.94903], [-3.18619, 54.94911], [-3.18628, 54.9493], [-3.18652, 54.9494], [-3.18737, 54.94959], [-3.18858, 54.94969], [-3.18878, 54.94964], [-3.2114, 54.954], [-3.21118, 54.95399], [-3.21043, 54.95393], [-3.20966, 54.95389], [-3.20643, 54.95372], [-3.20529, 54.95373], [-3.20467, 54.95371], [-3.20288, 54.95348], [-3.20229, 54.95339], [-3.20167, 54.95321], [-3.20093, 54.95294], [-3.20062, 54.95275], [-3.19964, 54.95184], [-3.19753, 54.95078], [-3.19436, 54.95044], [-3.19151, 54.94987], [-3.18914, 54.94971], [-3.21218, 54.9536], [-3.21192, 54.95374], [-3.21236, 54.95394], [-3.21232, 54.95374], [-3.21277, 54.95392], [-3.21283, 54.95392]
];

export const trailGeoJSON = {
    type: 'Feature',
    properties: {
        name: "Hadrian's Wall Path",
        stroke: "#b91c1c",
        "stroke-width": 4
    },
    geometry: {
        type: 'LineString',
        coordinates: trailCoordinates
    }
};

// 15-minute corridor buffer (default ~1.1km)
export const getCorridor = (bufferKm = 1.1) => {
    // @ts-ignore
    return turf.buffer(trailGeoJSON, bufferKm, { units: 'kilometers' });
};

export interface Stage {
    id: number;
    from: string;
    to: string;
    date: string;
    romanDate: string;
    planCardNote?: string;
    mithraicGrade: string;
    mithraicIconClass: string;
    distanceMi: number;
    timeHours: [number, number];
    elevationGainFt: number;
    elevationLossFt: number;
    difficulty: 'Moderate' | 'Challenging' | 'Strenuous' | 'Rest' | 'Departure';
    surface: string;
    terrain: string;
    lunchStrategy: string;
    fuelingLogistics: string[];
    milestones: { name: string; mi: number; intel: string }[];
    dinner: string;
    supplyStatus: 'High' | 'Low' | 'Critical';
    shops: string[];
    weather: { tempHigh: number; tempLow: number; condition: string; precipProb: number };
    celestial: { moonPhase: string; events: string[] };
}

export const itinerary: Stage[] = [
    {
        id: 0,
        from: "Edinburgh (Rail)",
        to: "Carlisle (Overnight)",
        date: "Apr 12",
        romanDate: "",
        planCardNote: "Overnight in Carlisle",
        mithraicGrade: "Corax (Raven)",
        mithraicIconClass: "hn-eye",
        distanceMi: 0,
        timeHours: [2.5, 3.5],
        elevationGainFt: 0,
        elevationLossFt: 0,
        difficulty: "Departure",
        surface: "Rail, Urban",
        terrain: "Transfer day from Edinburgh to Carlisle with overnight reset before trail start.",
        lunchStrategy: "Station lunch and hydration before rail transfer.",
        fuelingLogistics: [
            "Logistics: Train from Edinburgh Waverley to Carlisle Citadel.",
            "Settle in Carlisle for overnight and stage gear.",
            "Buy snacks and breakfast supplies for Day 1 trail start."
        ],
        milestones: [
            { name: "Edinburgh Waverley", mi: 0.0, intel: "Departure rail point for the expedition." },
            { name: "Carlisle Citadel Station", mi: 0.0, intel: "Arrival and overnight base before hiking begins." }
        ],
        dinner: "Carlisle Overnight",
        supplyStatus: "High",
        shops: ["Carlisle City Centre", "M&S Foodhall", "Sainsbury's"],
        weather: { tempHigh: 53, tempLow: 39, condition: "Partly Cloudy", precipProb: 25 },
        celestial: { moonPhase: "Waning Crescent (36%)", events: [] }
    },
    {
        id: 1,
        from: "Carlisle",
        to: "Lanercost",
        date: "Apr 13",
        romanDate: "",
        mithraicGrade: "Corax (Raven)",
        mithraicIconClass: "hn-eye",
        distanceMi: 13.4,
        timeHours: [5, 6],
        elevationGainFt: 590,
        elevationLossFt: 460,
        difficulty: "Moderate",
        surface: "Pavement, Grass, Dirt",
        terrain: "River Eden valley, farmland, urban transition to rural.",
        lunchStrategy: "Pack lunch from Carlisle supermarket.",
        fuelingLogistics: [
            "Primary: Buy lunch wrap + 2 days of trail snacks at Carlisle M&S Foodhall",
            "Intel: Cross the 'Memorial Bridge' (suspension bridge) to leave the city."
        ],
        milestones: [
            { name: "Carlisle Trailhead", mi: 0.0, intel: "Hiking begins from Carlisle after overnight arrival." },
            { name: "Rickerby Park", mi: 1.5, intel: "Dedicated to the fallen of WWI. Authentic riverside path." },
            { name: "Crosby-on-Eden", mi: 8.5, intel: "Raised foundations and vallum earthworks begin to appear." }
        ],
        dinner: "Abbey Farmhouse",
        supplyStatus: "High",
        shops: ["M&S Foodhall", "Sainsbury's", "Tesco Superstore"],
        weather: { tempHigh: 54, tempLow: 39, condition: "Partly Cloudy", precipProb: 30 },
        celestial: { moonPhase: "Waning Crescent (28%)", events: ["Earthshine visible pre-dawn"] }
    },
    {
        id: 2,
        from: "Lanercost",
        to: "Gilsland",
        date: "Apr 14",
        romanDate: "ID. APR.",
        mithraicGrade: "Nymphus (Nymph)",
        mithraicIconClass: "hn-sparkles",
        distanceMi: 6.2,
        timeHours: [2, 2.5],
        elevationGainFt: 394,
        elevationLossFt: 328,
        difficulty: "Moderate",
        surface: "Grass, Farm tracks",
        terrain: "Undulating hills. Entrance to the Northumberland crags.",
        lunchStrategy: "Shorter day — snack-focused.",
        fuelingLogistics: [
            "Snacks: Use Carlisle surplus.",
            "Refill: Top up water at Lanercost Priory.",
            "Intel: Pass over the border from Cumbria to Northumberland."
        ],
        milestones: [
            { name: "Lanercost Priory", mi: 0.1, intel: "Founded 1165. Built from Wall stone with Roman inscriptions." },
            { name: "Banks Turret", mi: 1.5, intel: "First significant standing Wall architecture." },
            { name: "Birdoswald (Banna)", mi: 4.0, intel: "Commanding spur over the River Irthing. Best preserved long stretch." }
        ],
        dinner: "Samson Inn",
        supplyStatus: "Low",
        shops: ["Abbey Farm Shop (Limited)"],
        weather: { tempHigh: 53, tempLow: 38, condition: "Showers", precipProb: 60 },
        celestial: { moonPhase: "Waning Crescent (19%)", events: [] }
    },
    {
        id: 3,
        from: "Gilsland",
        to: "Once Brewed",
        date: "Apr 15",
        romanDate: "A.D. XVIII KAL. MAI.",
        mithraicGrade: "Miles (Soldier)",
        mithraicIconClass: "hn-flag-checkered",
        distanceMi: 8.0,
        timeHours: [3.5, 4.5],
        elevationGainFt: 1378,
        elevationLossFt: 1246,
        difficulty: "Strenuous",
        surface: "Rocky, Grass, Steep stone steps",
        terrain: "Dramatic ridgeline walking. Whin Sill escarpment.",
        lunchStrategy: "Full packed lunch required.",
        fuelingLogistics: [
            "Mandatory: Full calories for vertical gain.",
            "Intel: Reach the highest point at Winshields Crags.",
            "Note: Pass Thirlwall Castle ruins near the start."
        ],
        milestones: [
            { name: "Roman Army Museum", mi: 1.2, intel: "Located at Carvoran fort. Edge of Empire 3D film is iconic." },
            { name: "Walltown Crags", mi: 2.2, intel: "Highest standing sections. Wind speed doubles here." },
            { name: "Winshields Crags", mi: 6.5, intel: "Highest point on the Path. Superb views over the Pennines." },
            { name: "Sycamore Gap", mi: 8.1, intel: "Robin Hood tree site. Iconic dip in the Wall." }
        ],
        dinner: "Twice Brewed Inn",
        supplyStatus: "Critical",
        shops: ["None"],
        weather: { tempHigh: 50, tempLow: 36, condition: "Windy/Overcast", precipProb: 40 },
        celestial: { moonPhase: "Waning Crescent (11%)", events: ["Moon near Mercury & Mars"] }
    },
    {
        id: 4,
        from: "Once Brewed",
        to: "Once Brewed",
        date: "Apr 16",
        romanDate: "A.D. XVII KAL. MAI.",
        mithraicGrade: "Leo (Lion)",
        mithraicIconClass: "hn-fire",
        distanceMi: 0,
        timeHours: [0, 0],
        elevationGainFt: 0,
        elevationLossFt: 0,
        difficulty: "Rest",
        surface: "Grass, Stone (Optional)",
        terrain: "Stationary exploration day. Central Crags focus.",
        lunchStrategy: "Twice Brewed Inn.",
        fuelingLogistics: [
            "Recovery: Order the Syllabus Stout and Game Pie.",
            "Intel: Deep dive into Vindolanda Writing Tablets.",
            "Protocol: Day of Mithraic ritual. Visit the Temple of Mithras."
        ],
        milestones: [
            { name: "Vindolanda", mi: 1.5, intel: "Active excavation. Famous writing tablets detail daily Roman life." },
            { name: "The Sill", mi: 0.2, intel: "National Landscape Discovery Centre. Local food café and crafts." },
            { name: "Twice Brewed Brewery", mi: 0.1, intel: "Birthday Craft Beer tasting session." }
        ],
        dinner: "Twice Brewed Inn (Night 2)",
        supplyStatus: "Critical",
        shops: ["Hotel Bar"],
        weather: { tempHigh: 52, tempLow: 37, condition: "Sunny Intervals", precipProb: 20 },
        celestial: { moonPhase: "Waning Crescent (5%)", events: ["Lyrids Meteor Shower begins"] }
    },
    {
        id: 5,
        from: "Once Brewed",
        to: "Chollerford",
        date: "Apr 17",
        romanDate: "A.D. XVI KAL. MAI.",
        mithraicGrade: "Perses (Persian)",
        mithraicIconClass: "hn-arrow-right",
        distanceMi: 11.9,
        timeHours: [5, 6],
        elevationGainFt: 1246,
        elevationLossFt: 1345,
        difficulty: "Challenging",
        surface: "Grass, Rock, Stone",
        terrain: "Classic central Wall section. Highshield and Peel Crags.",
        lunchStrategy: "Packed lunch mandatory.",
        fuelingLogistics: [
            "Survival: Second half of food buffer.",
            "Intel: Best preserved Roman latrines at Housesteads.",
            "Morale: Riverside descent into Chollerford feels civilized."
        ],
        milestones: [
            { name: "Housesteads (Vercovicium)", mi: 2.5, intel: "Auxiliary fort AD 124. Most iconic ridge-top views." },
            { name: "Temple of Mithras", mi: 8.4, intel: "Mithric Temple AD 200. Built by the First Cohort of Batavians." },
            { name: "Black Carts Turret", mi: 10.5, intel: "Long intact stretches of wall snake across the ridge." }
        ],
        dinner: "The George Hotel",
        supplyStatus: "Critical",
        shops: ["None"],
        weather: { tempHigh: 55, tempLow: 40, condition: "Cloudy", precipProb: 10 },
        celestial: { moonPhase: "New Moon (0%)", events: ["Dark Skies: Best for Stargazing"] }
    },
    {
        id: 6,
        from: "Chollerford",
        to: "Corbridge",
        date: "Apr 18",
        romanDate: "A.D. XV KAL. MAI.",
        mithraicGrade: "Heliodromus (Sun-Runner)",
        mithraicIconClass: "hn-sun",
        distanceMi: 6.5,
        timeHours: [3.5, 4.5],
        elevationGainFt: 250,
        elevationLossFt: 300,
        difficulty: "Moderate",
        surface: "Pavement, River path",
        terrain: "Gentler river walking. Transition from Moorland to Market Village.",
        lunchStrategy: "Corbridge cafés.",
        fuelingLogistics: [
            "Intel: Chesters Fort guarded the bridge across the North Tyne.",
            "Water: 1L sufficient.",
            "Target: Celebrate at the Golden Lion."
        ],
        milestones: [
            { name: "Chesters (Cilurnum)", mi: 0.5, intel: "Most complete Roman cavalry fort in Britain. AD 123." },
            { name: "Planetrees", mi: 2.5, intel: "Significant section of wall foundations." },
            { name: "Brunton Turret", mi: 2.8, intel: "Highest standing section of Wall in the East." }
        ],
        dinner: "Golden Lion Hotel",
        supplyStatus: "High",
        shops: ["Co-op Food", "Corbridge Larder", "Bakeries"],
        weather: { tempHigh: 56, tempLow: 41, condition: "Clear", precipProb: 5 },
        celestial: { moonPhase: "Waxing Crescent (2%)", events: ["Lyrids Peak Tomorrow"] }
    },
    {
        id: 7,
        from: "Corbridge (Rail)",
        to: "Edinburgh (Rail)",
        date: "Apr 19",
        romanDate: "A.D. XIII KAL. MAI.",
        planCardNote: "Rail return to Edinburgh",
        mithraicGrade: "Emeritus",
        mithraicIconClass: "hn-badge-check",
        distanceMi: 0,
        timeHours: [2, 3],
        elevationGainFt: 0,
        elevationLossFt: 0,
        difficulty: "Departure",
        surface: "Rail",
        terrain: "Return journey to Scotland.",
        lunchStrategy: "Waverley Station.",
        fuelingLogistics: [
            "Logistics: Train from Corbridge Station to Edinburgh via Newcastle or Carlisle.",
            "Post-Expedition: The Wall remains, but the Hiker returns.",
            "Note: Last view of the Tyne Valley from the train."
        ],
        milestones: [
            { name: "Corbridge Station", mi: 0.0, intel: "Final departure point." },
            { name: "Edinburgh Waverley", mi: 100.0, intel: "Return to base. Expedition complete." }
        ],
        dinner: "Home (Edinburgh)",
        supplyStatus: "High",
        shops: ["Station Retail"],
        weather: { tempHigh: 59, tempLow: 44, condition: "Sunny", precipProb: 0 },
        celestial: { moonPhase: "Waxing Crescent (10%)", events: [] }
    }
];

export const walkingStages = itinerary.filter((stage) => stage.distanceMi > 0);
export const planTotalMiles = walkingStages.reduce((sum, stage) => sum + stage.distanceMi, 0);
export const planMinHours = walkingStages.reduce((sum, stage) => sum + stage.timeHours[0], 0);
export const planMaxHours = walkingStages.reduce((sum, stage) => sum + stage.timeHours[1], 0);
export const planMidHours = (planMinHours + planMaxHours) / 2;
export const planAvgSpeedMidMph = planMidHours > 0 ? planTotalMiles / planMidHours : 0;
export const planAvgSpeedSlowMph = planMaxHours > 0 ? planTotalMiles / planMaxHours : 0;
export const planAvgSpeedFastMph = planMinHours > 0 ? planTotalMiles / planMinHours : 0;

export const overnightStops = [
    { name: "Carlisle", coords: [-2.9329, 54.8925], type: "hub" },
    { name: "Lanercost/Brampton", coords: [-2.7333, 54.9433], type: "hub" },
    { name: "Gilsland", coords: [-2.5700, 54.9900], type: "hub" },
    { name: "Once Brewed", coords: [-2.3958, 55.0036], type: "hub" },
    { name: "Chollerford", coords: [-2.1383, 55.0242], type: "hub" },
    { name: "Corbridge", coords: [-2.0183, 54.9746], type: "hub" }
];

export const englishHeritageSites = [
    {
        name: "Carlisle Castle",
        coords: [-2.9419, 54.8973],
        pageid: 856932,
        hours: "10:00 - 17:00",
        visitDay: "Mon, Apr 13",
        staffed: true,
        intel: "Built 1092 by William Rufus. Prison for Mary, Queen of Scots.",
        fryeIntel: "An evolution of the frontier: where Roman stone met medieval blood. Frye notes that few civilized people have ever lived without such barriers.",
        rickStevesIntel: "Carlisle serves as a convenient base for exploring the western sections of the wall."
    },
    {
        name: "Tullie House Museum",
        coords: [-2.9400, 54.8960],
        pageid: 312242,
        hours: "10:00 - 17:00",
        visitDay: "Mon, Apr 13",
        staffed: true,
        intel: "Jacobean mansion detailing Roman occupancy and Border Reivers.",
        rickStevesIntel: "A surprisingly good museum with particularly praised Roman exhibits."
    },
    {
        name: "Lanercost Priory",
        coords: [-2.6949, 54.9662],
        pageid: 967234,
        hours: "10:00 - 17:00",
        visitDay: "Mon, Apr 13",
        staffed: true,
        intel: "Founded 1165. Built from stone taken from Hadrian's Wall."
    },
    {
        name: "Birdoswald Roman Fort",
        coords: [-2.6023, 54.9894],
        pageid: 2143239,
        hours: "10:00 - 17:00",
        visitDay: "Tue, Apr 14",
        staffed: true,
        intel: "Known as Banna ('spur'). Commanding position overlooking meander of River Irthing.",
        fryeIntel: "Frye reminds us that Hadrian was the first to build a wall 'to separate the barbarians and the Romans.' Banna was a vital cog in that machine.",
        rickStevesIntel: "Birdoswald boasts the longest surviving stretch of the wall and is notably family-friendly.",
        photoIntel: "TOP 10 SPOT: The longest continuous stretch of Wall is perfect for 'leading line' compositions. Best in early morning to capture the mist lifting from the Irthing valley."
    },
    {
        name: "Roman Army Museum",
        coords: [-2.5130, 54.9910],
        pageid: 41263032,
        hours: "10:00 - 17:00",
        visitDay: "Wed, Apr 15",
        staffed: true,
        intel: "Experience life on the front line. Exclusive 3D Edge of Empire film.",
        rickStevesIntel: "Part of the essential six-mile central stretch that defines the Hadrian's Wall experience."
    },
    {
        name: "Walltown Crags",
        coords: [-2.5061, 54.9927],
        pageid: 41263032,
        hours: "Dawn - Dusk",
        visitDay: "Wed, Apr 15",
        staffed: false,
        intel: "One of the highest standing sections of the Wall.",
        fryeIntel: "The highest drama of the frontier. To Frye, these stones represent the attempt to create a safe space where civilization could flourish.",
        rickStevesIntel: "One of the highest standing and most dramatic sections of the frontier.",
        photoIntel: "TOP 10 SPOT: Dramatic elevation changes. Use a wide-angle lens to capture the Wall snaking across the Whin Sill escarpment. Peak drama at Sunset."
    },
    { name: "Great Chesters (Aesica)", coords: [-2.4640, 54.9950], pageid: 18177794, hours: "Dawn - Dusk", visitDay: "Wed, Apr 15", staffed: false },
    {
        name: "Housesteads Roman Fort",
        coords: [-2.3310, 55.0130],
        pageid: 1825118,
        hours: "10:00 - 17:00",
        visitDay: "Fri, Apr 17",
        staffed: true,
        intel: "Vercovicium. Stone AD 124. Best preserved Roman latrines in Britain.",
        fryeIntel: "The definitive 'monument to Roman supremacy.' Frye sees this not just as a border control, but as a statement of total military dominance over the wild north.",
        rickStevesIntel: "A particularly well-preserved segment and a 'must-see'. The barracks and latrines illustrate daily Roman life vividly.",
        photoIntel: "TOP 10 SPOT: The hilltop position offers 360° views. Photograph the latrines for unique archaeological detail, or walk 500m West to Cuddy's Crags for the iconic 'Looking Back' shot of the fort."
    },
    {
        name: "Carrawburgh (Temple of Mithras)",
        coords: [-2.2230, 55.0360],
        pageid: 12246314,
        hours: "Dawn - Dusk",
        visitDay: "Thu, Apr 16",
        special: "mithras",
        staffed: false,
        intel: "Brocolitia. Built AD 200 by First Cohort of Batavians.",
        fryeIntel: "Where the blood of the cult met the brick of the wall. Rituals here were the spiritual glue for the men holding the civilized line.",
        photoIntel: "TOP 10 SPOT: Atmospheric and low-profile. Best photographed in low light (Dawn/Dusk) to emphasize the altars and the sense of hidden ritual."
    },
    {
        name: "Chesters Roman Fort",
        coords: [-2.1390, 55.0260],
        pageid: 8768992,
        hours: "10:00 - 17:00",
        visitDay: "Fri, Apr 17",
        staffed: true,
        intel: "Cilurnum. Most complete Roman cavalry fort in Britain. AD 123.",
        fryeIntel: "The technological peak of the barrier. A cavalry hub designed to project Roman power far beyond the stone itself.",
        rickStevesIntel: "Features the best remains of a Roman bath house and some of the best-preserved buildings along the entire Wall.",
        photoIntel: "TOP 10 SPOT: The Bath House by the River North Tyne is the highlight. Use a polarising filter to manage reflections on the water and stone."
    },
    {
        name: "Corbridge Roman Town",
        coords: [-2.0170, 54.9750],
        pageid: 373397,
        hours: "10:00 - 17:00",
        visitDay: "Sun, Apr 19",
        staffed: true,
        intel: "Major supply and industrial town. Granaries still standing.",
        fryeIntel: "The reward for the wall: a thriving industrial hub protected by the blood and brick of the northern frontier.",
        rickStevesIntel: "A supply fort with massive granaries in a very pretty, large village on the River Tyne.",
        photoIntel: "TOP 10 SPOT: Focus on the massive granary foundations. The evening light on the old stone bridge into town provides a classic Northumberland finish."
    },
    {
        name: "Vindolanda",
        coords: [-2.3608, 54.9911],
        pageid: 373397,
        hours: "10:00 - 17:00",
        visitDay: "Thu, Apr 16",
        staffed: true,
        intel: "Active excavation. Famous writing tablets detail daily Roman life.",
        url: "https://en.wikipedia.org/wiki/Vindolanda",
        fryeIntel: "The most human frontier site. Writing tablets here are the closest thing we have to hearing the voices of the people who lived on the edge of the world.",
        rickStevesIntel: "A highlight and 'not to be missed'. Features an excellent small museum with shoes and letters revealing that even Roman women could write Latin.",
        photoIntel: "TOP 10 SPOT: The active excavations provide a sense of scale and action. Capture the reconstructed sections for a 'then and now' comparison."
    }
];

export const hospitalitySites = [
    {
        name: "Twice Brewed Inn & Brewery",
        coords: [-2.3958, 55.0036],
        category: 'brewery',
        summary: "Sits right under the Wall's highest crags.",
        url: "https://twicebrewedinn.co.uk/",
        bourdainIntel: "Order the 'Sycamore Gap IPA'. Roman-themed ales and stargazing in the Dark Sky Park."
    },
    {
        name: "The Samson Inn",
        coords: [-2.5700, 54.9900],
        category: 'pub',
        summary: "Traditional Cumbrian pub in Gilsland.",
        bourdainIntel: "Stone walls and wood beams. Properly remote, old-school walker's vibe."
    },
    {
        name: "The George Hotel",
        coords: [-2.1383, 55.0242],
        category: 'hotel',
        summary: "Historic coaching inn on the River North Tyne.",
        url: "https://bespokehotels.com/the-george-hotel/",
        bourdainIntel: "Classic coaching route atmosphere. Pause after the crag descent for a riverside red."
    },
    {
        name: "The Golden Lion",
        coords: [-2.0183, 54.9746],
        category: 'pub',
        summary: "Historic 18th-century coaching inn in Corbridge.",
        url: "https://www.goldenlioncorbridge.com/book",
        bourdainIntel: "Market-town energy. Mixed crowd of walkers and locals. The definitive finish-line pint."
    },
    {
        name: "The Rat Inn",
        coords: [-2.0743, 54.9841],
        category: 'pub',
        summary: "Multi-award winning traditional country pub in Anick.",
        bourdainIntel: "Tyne Valley views and heritage beef. Serious gastronomy for the final push."
    },
    {
        name: "The Corbridge Larder",
        coords: [-2.0184, 54.9746],
        category: 'deli',
        summary: "Fine food deli in the heart of Corbridge.",
        bourdainIntel: "Stock up on Northumbrian cheeses. The ultimate trail picnic source."
    },
    {
        name: "House Of Meg",
        coords: [-2.5833, 55.0061],
        category: 'cafe',
        summary: "Charming tea room in Gilsland.",
        bourdainIntel: "Proper tea and massive slices of cake. Essential morale booster before the crags."
    },
    {
        name: "Abbey Farmhouse",
        coords: [-2.6949, 54.9662],
        category: 'hotel',
        summary: "Bed and Breakfast located in the beautiful surroundings of Lanercost.",
        url: "https://www.abbeyfarmhouse.com/",
        bourdainIntel: "Peaceful, proximity to the Priory is the value play here."
    },
    {
        name: "The George Hotel",
        coords: [-2.1383, 55.0242],
        category: 'hotel',
        summary: "Charming hotel located on the banks of the North Tyne.",
        url: "https://bespokehotels.com/the-george-hotel/",
        bourdainIntel: "Classic riverside hospitality. Rest your legs by the fire."
    },
    {
        name: "Battlesteads Hotel",
        coords: [-2.2500, 55.0900],
        category: 'hotel',
        summary: "Sustainable hotel and restaurant in Wark.",
        bourdainIntel: "Famed for their observatory and local game. A bit north, but a destination in itself."
    },
    {
        name: "The Blue Bell",
        coords: [-2.0187, 54.9739],
        category: 'pub',
        summary: "Traditional town center pub in Corbridge.",
        bourdainIntel: "Classic Northumbrian pub vibes. Reliable for a mid-afternoon pint."
    },
    {
        name: "The Kings Head",
        coords: [-2.5831, 55.0063],
        category: 'pub',
        summary: "Traditional village pub in Gilsland.",
        bourdainIntel: "Hearty food and local atmosphere. A solid choice if the Samson is full."
    }
];
