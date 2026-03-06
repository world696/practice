import 'dotenv/config'
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node'
import { OpenAIEmbeddings } from '@langchain/openai'

const COLLECTION_NAME = "ebook_collection";
const VECTOR_DIM = 1024;

const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  },
  dimensions: VECTOR_DIM
})

const client = new MilvusClient({
    address: 'localhost:19530'
})