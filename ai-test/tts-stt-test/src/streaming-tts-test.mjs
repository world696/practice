import 'dotenv/config';
import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'node:fs';

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;
const APP_ID = process.env.APP_ID || process.env.APPID;

const VOICE_TYPE = 502006; // 输出音色类型
const OUTPUT_FILE = "output.mp3";
const TEXT_INTERVAL_MS = 3000; // 文本间隔时间
// 流式 TTS 按句子切分，末尾尽量带标点，否则可能一直缓存不合成
const TEXTS = [
    'Hello, world!',
    'Great!',
    'Good job!',
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 鉴权连接
function buildWsUrl () {
    const now = Math.floor(Date.now() / 1000);
    const sessionId = `session_${now}_${Math.random().toString(36).slice(2)}`;

    const params = {
        Action: 'TextToStreamAudioWSv2',
        AppId: parseInt(APP_ID, 10),
        Codec: 'mp3',
        Expired: now + 3600,
        SampleRate: 16000,
        SecretId: SECRET_ID,
        SessionId: sessionId,
        VoiceType: VOICE_TYPE,
        Speed: 0,
        Timestamp: now,
        Volume: 0,
    };

    // 签名原文：GETtts.cloud.tencent.com/stream_wsv2?...（GET 与域名之间不能有空格）
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
    const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;
    const signature = crypto.createHmac('sha1', SECRET_KEY).update(rawStr).digest('base64');

    const searchParams = new URLSearchParams({
        ...Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, String(v)])
        ),
        Signature: signature,
    });

    return {
        sessionId,
        url: `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`,
    };
}
async function sendTexts(ws, sessionId) {
    for (let i = 0; i < TEXTS.length; i++) {
        ws.send(JSON.stringify({ session_id: sessionId, message_id: `msg_${i}`, data: TEXTS[i], action: 'ACTION_SYNTHESIS' }));
        console.log(`[文本] 已发送: ${TEXTS[i]}`);
        if (i < TEXTS.length - 1) await sleep(TEXT_INTERVAL_MS);
    }
    ws.send(JSON.stringify({ session_id: sessionId, message_id: `msg_${TEXTS.length}`, data: '', action: 'ACTION_COMPLETE' }));
    console.log("文本已发送 action_complete");
}

function streamTTS() {
    if(!SECRET_ID || !SECRET_KEY || !APP_ID) {
        console.error("缺少环境变量:", {
            SECRET_ID: Boolean(SECRET_ID),
            SECRET_KEY: Boolean(SECRET_KEY),
            APP_ID: Boolean(APP_ID),
        }, "请在 .env 中配置 SECRET_ID / SECRET_KEY / APP_ID（或 APPID）");
        return;
    }

    const { sessionId, url } = buildWsUrl();
    const ws = new WebSocket(url);
    const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'w' });
    let totalBytes = 0;
    let closed = false;
    let sent = false;

    const closeAll = () => {
        if (closed) return;
        closed = true;
        writeStream.end(() => {
            console.log(`保存 音频文件已保存在 ${OUTPUT_FILE}, 共 ${totalBytes} 字节`);
            if (ws.readyState < WebSocket.CLOSING)  ws.close();            
        });
    }

    ws.on('open', () => {
        console.log("WebSocket 连接成功");
    });

    ws.on('message', async (data, isBinary) => {

        if(isBinary) {
            writeStream.write(data);
            totalBytes += data.length;
            return
        }

        try {
            const msg = JSON.parse(data.toString());
            console.log('消息, ', JSON.stringify(msg));

            if (msg.ready === 1 && !sent) {
                sent = true;
                await sendTexts(ws, sessionId);
            }
            if (msg.code && msg.code !== 0) {
                console.error('错误码: ', msg.code, '错误信息: ', msg.message);
                closeAll();
            } else if (msg.final === 1) {
                console.log('音频流结束');
                closeAll()
            }
        } catch (error) {
            console.error("处理消息时发生错误:", error);
        }
    });
    
    ws.on('error', (error) => {
        console.error("WebSocket 连接错误:", error);
        closeAll();
    });

    ws.on('close', () => {
        console.log("WebSocket 连接关闭");
        closeAll();
    });   
}

streamTTS();