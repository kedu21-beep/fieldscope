// ═══════════════════════════════════════
//  CONFIG + GLOBAL STATE
// ═══════════════════════════════════════
const MAX_KM = 200;
const WORKER_URL = 'https://polished-waterfall-c720.kevinducharme21.workers.dev';
const KPH = 70;
let userLat = 46.0156;
let userLng = -73.4509;
let gpsReady = false;
let spots = [];
let scanning = false;
let leafMap = null;
let mapPins = [];
let driveFilter = 0;
let radiusFilter = 0;
let rawObs = [], rawNotable = [], rawBack = 14, rawRadius = 0;
let cachedLat = null, cachedLng = null;
let currentActivity = 'birding'; // new for multi-activity
let isOnline = navigator.onLine;
