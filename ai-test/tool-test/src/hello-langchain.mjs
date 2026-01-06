import dotenv from 'dotenv'
import { ChatOpenAI } from '@langchain/openai';

dotenv.config()

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL // BEIJIN
    }
})

const res = await model.invoke('介绍一下自己')
console.log('res::', res.content);
