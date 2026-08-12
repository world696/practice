import "dotenv/config";
import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors";
/**
 * 典型RAG流程：先用向量检测捞出一批候选文档，再用rerank模型按query进行相似度匹配，留下相关的几条
 */
export class DashScopeRerank extends BaseDocumentCompressor {

  constructor({ apiKey, model = "qwen3-rerank", topN = 3, baseUrl } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.topN = topN;
    this.baseUrl = baseUrl ?? process.env.RERANK_URL;
  }

  async compressDocuments(documents, query, _callbacks) {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: {
          query,
          documents: documents.map((d) => d.pageContent),
        },
        parameters: {
          return_documents: false,
          top_n: this.topN,
        },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(
        `DashScope rerank ${res.status}: ${JSON.stringify(json)}`,
      );
    }

    const results = json?.output?.results;
    if (!Array.isArray(results)) {
      throw new Error(`unexpected rerank response: ${JSON.stringify(json)}`);
    }

    return results.map((item) => documents[item.index]);
  }
}
