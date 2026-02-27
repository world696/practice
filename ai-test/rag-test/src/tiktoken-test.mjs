import { getEncoding, getEncodingNameForModel } from 'js-tiktoken'

/**
 * js-tiktoken 是 OpenAI 模型使用的 BPE（Byte Pair Encoding）分词器在 JavaScript 侧的实现。
 * 核心用途：把字符串转换成 token（模型实际计费和上下文计算单位），以及反向解码;
 * 1、计算 prompt token 数;
 * 2、估算费用;
 * 3、控制上下文长度（避免超过模型 max_tokens）;
 * 4、做截断 / 滑动窗口
 */
// token 大模型输入的单位
/**
 * getEncodingNameForModel
 * 根据模型名称，自动返回应该使用的 encoding 名称
 */
const modelName = 'gpt-4'
const encodingName = getEncodingNameForModel(modelName)
console.log(encodingName); // cl100k_base

/**
 * getEncoding
 * 获取指定 tokenizer 编码器实例。
 * OpenAI 不同模型使用不同编码规则， 例如：
 * --- cl100k_base： GPT-4, GPT-3.5
 * --- p50k_base: Codex
 * --- 50k_base: 旧 GPT-3
 * 
 * 
 * enc.encode(text)     // string -> number[]
 * enc.decode(tokens)   // number[] -> string
 * enc.free()           // 释放 wasm 内存；底层是 wasm 版本 tokenizer--在 node 服务中会导致内存泄漏。
 */

const enc = getEncoding(encodingName) //
console.log('apple', enc.encode('apple').length); // 1
console.log('sssssaetw', enc.encode('sssssaetw').length); // 5
console.log('干饭人', enc.encode('干饭人').length); // 6
// token 和字符数没有必然的关系，与不同模型的分词器有关

