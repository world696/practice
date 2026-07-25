import "dotenv/config";
import tencentcloud from "tencentcloud-sdk-nodejs-tts";
import fs from "node:fs";

const secretId = process.env.SECRET_ID;
const secretKey = process.env.SECRET_KEY;

if (!secretId || !secretKey) {
    console.error("缺少 SECRET_ID 或 SECRET_KEY，请检查项目根目录 .env");
    process.exit(1);
}

const TtsClient = tencentcloud.tts.v20190823.Client;

const client = new TtsClient({
    credential: {
        secretId,
        secretKey,
    },
    region: "ap-shanghai",
    profile: {
        httpProfile: {
            endpoint: "tts.tencentcloudapi.com",
        },
    },
});

const params = {
    Text: "Hello, world!",
    SessionId: "session-001",
    VoiceType: 502006, // 输出音色类型
    Codec: "mp3", // 指定输出mp3
}

client.TextToVoice(params).then((data) => {
    console.log(data);
    const  audioBuffer = Buffer.from(data.Audio, "base64");
    const outputPath = "./output.mp3";
    fs.writeFileSync(outputPath, audioBuffer, (err) => {
        if(err) {
            console.error('保存文件失败', err);
        } else {
            console.log(`音频已保存到: ${outputPath}`);
        }
    });
}).catch((err) => {
    console.error('合成失败', err);
});