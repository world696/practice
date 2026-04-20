import axios from 'axios'
import fs from 'fs'
import pLimit from 'p-limit'
import { HttpsProxyAgent } from 'https-proxy-agent'

// ====== 配置区 ======
const OPENAI_API_KEY = ''

// 代理（你自己改端口）
const PROXY_URL = 'http://127.0.0.1:7890'

// 并发控制
const limit = pLimit(5)

// 重试次数
const MAX_RETRY = 3

// ====== axios 实例（强制走代理）======
const agent = new HttpsProxyAgent(PROXY_URL)

const api = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 30000,
  httpsAgent: agent,
  proxy: false, // 必须关掉
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`
  }
})

// ====== 工具函数：保护占位符 ======
function protectVars(text) {
  const vars = []
  const newText = text.replace(/__VAR_\d+__/g, (match) => {
    vars.push(match)
    return `__PLACEHOLDER_${vars.length - 1}__`
  })
  return { text: newText, vars }
}

function restoreVars(text, vars) {
  return text.replace(/__PLACEHOLDER_(\d+)__/g, (_, i) => vars[i])
}

// ====== 翻译函数（带重试）======
async function translateText(text, targetLang) {
  const { text: safeText, vars } = protectVars(text)

  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      const res = await api.post('/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `
Translate the following text into ${targetLang}.
Requirements:
- Keep placeholders like __PLACEHOLDER_X__ unchanged
- Keep meaning accurate for UI/Software context
- Keep it concise

Text:
${safeText}
`
          }
        ],
        temperature: 0.2
      })

      let result = res.data.choices[0].message.content.trim()
      return restoreVars(result, vars)

    } catch (err) {
      console.log(`❌ 翻译失败（重试 ${i + 1}）`, err.code || err.message)

      if (i === MAX_RETRY - 1) {
        console.log('⚠️ 放弃该条:', text)
        return text
      }

      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ====== 递归翻译 JSON ======
async function translateObject(obj, targetLang) {
  if (typeof obj === 'string') {
    return await limit(() => translateText(obj, targetLang))
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map(item => translateObject(item, targetLang)))
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {}
    for (const key in obj) {
      result[key] = await translateObject(obj[key], targetLang)
    }
    return result
  }

  return obj
}

// ====== 主函数 ======
async function main() {
  const inputPath = `./src/lang/locales/en.json`
  const outputPath = `./src/lang/locales/ja.json`
  const targetLang = 'Japanese'

  console.log(`🚀 Translating to ${targetLang}...`)

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))

  const translated = await translateObject(data, targetLang)

  fs.writeFileSync(outputPath, JSON.stringify(translated, null, 2), 'utf-8')

  console.log('✅ 翻译完成！输出:', outputPath)
}

main()