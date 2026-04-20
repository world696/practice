const axios = require('axios')
import { HttpsProxyAgent } from 'https-proxy-agent'
const fs = require('fs-extra')

const OPENAI_API_KEY = ''

// 目标语言
const LANG_MAP = {
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  th: 'Thai'
}

// 保护变量 {xxx}
function protectVariables(text) {
  const vars = []
  const replaced = text.replace(/\{.*?\}/g, (match) => {
    vars.push(match)
    return `__VAR_${vars.length - 1}__`
  })
  return { replaced, vars }
}

function restoreVariables(text, vars) {
  let result = text
  vars.forEach((v, i) => {
    result = result.replace(`__VAR_${i}__`, v)
  })
  return result
}

// 调 OpenAI
async function translateText(text, targetLang) {
  if (!text.trim()) return text

  const { replaced, vars } = protectVariables(text)

  const prompt = `
Translate the following text into ${targetLang}.
Requirements:
- Keep placeholders like __VAR_0__ unchanged
- Keep meaning accurate for UI/Software context
- Keep it concise

Text:
${replaced}
`
const agent = new HttpsProxyAgent('http://127.0.0.1:7890')

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    data,
  {
    httpsAgent: agent,
    proxy: false,
    timeout: 30000
  }
    // {
    //   model: 'gpt-4o-mini',
    //   messages: [{ role: 'user', content: prompt }],
    //   temperature: 0.2
    // },
    // {
    //   headers: {
    //     Authorization: `Bearer ${OPENAI_API_KEY}`
    //   }
    // }
  )

  const translated = res.data.choices[0].message.content.trim()
  return restoreVariables(translated, vars)
}

// 递归翻译 JSON
async function translateObject(obj, lang) {
  if (typeof obj === 'string') {
    return await translateText(obj, LANG_MAP[lang])
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => translateObject(item, lang)))
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {}
    for (const key in obj) {
      result[key] = await translateObject(obj[key], lang)
    }
    return result
  }

  return obj
}

// 主流程
async function main() {
  const source = await fs.readJson(`${__dirname}/locales/en.json`)

  for (const lang of Object.keys(LANG_MAP)) {
    console.log(`🚀 Translating to ${lang}...`)

    const translated = await translateObject(source, lang)

    await fs.writeJson(`${__dirname}/locales/${lang}.json`, translated, { spaces: 2 })

    console.log(`✅ ${lang}.json done`)
  }
}

main()