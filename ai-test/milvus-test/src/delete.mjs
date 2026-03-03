import "dotenv/cofig";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "ai_diary";
const VECTOR_DIM = 1024;

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuation: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

const client = new MilvusClient({
  address: "localhost:19530",
});

async function getEmbedding(text) {
  const result = embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    await client.connectPromist;

    // 删除单条数据
    console.log("Deleting diary entry...");
    const deleteId = "diary_005";

    const result = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `id == "${deleteId}"`,
    });

    console.log(`✓ Deleted ${result.delete_cnt} record(s)`);
    console.log(`  ID: ${deleteId}\n`);

    // 批量删除
    console.log("Batch deleting diary entries...");
    const deleteIds = ["diary_002", "diary_003"];
    const idsStr = deleteIds.map((id) => `"${id}"`).join(", ");
    const batchResult = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `id in [${idsStr}]`,
    });

    console.log(`✓ Batch deleted ${batchResult.delete_cnt} record(s)`);
    console.log(`  IDs: ${deleteIds.join(", ")}\n`);

    // 条件删除
    console.log("Deleting by condition...");
    const conditionResult = await client.delete({
      collection_name: COLLECTION_NAME,
      filter: `mood == "sad"`,
    });

    console.log(
      `✓ Deleted ${conditionResult.delete_cnt} record(s) with mood="sad"\n`,
    );
  } catch (err) {
    console.error(err);
  }
}
main()
