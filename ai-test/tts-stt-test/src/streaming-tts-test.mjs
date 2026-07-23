import 'dotenv/config';
import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const APP_ID = process.env.APP_ID;

const VOICE_TYPE = "502006"; // 输出音色类型
const OUTPUT_FILE = "output.mp3";
const TEXT_INTERVAL_MS = 3000; // 文本间隔时间
const TEXTS = [
    'Hello, world!',
    'Great!',
    'Good job!'
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildWsUrl () {
    const now = Math.floor(Date.now() / 1000);
    const sessionId = `session_${now}_${Math.random().toString(36).slice(2)}`;

    const params = {
        Action: 'TextToStreamAudioSv2',
        AppId: parseInt(APP_ID),
        Codec: 'mp3',
        Expired: now + 3600,
        SampleRate: 16000,
        SessionId: SECRET_ID,
        VoiceType: VOICE_TYPE,
        Speed: 0,
        Timestamp: now,
        Volume: 5
    }
}