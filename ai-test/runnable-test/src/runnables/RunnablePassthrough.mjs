import 'dotenv/config'
import { RunnablePassthrough, RunnableSequence, RunnableLambda, RunnableMap } from '@langchain/core/runnables'

// const chain = RunnableSequence.from([
//     RunnableLambda.from((input) => ({ concept: input})),
//     RunnableMap.from({
//         original: new RunnablePassthrough(),
//         processed: RunnableLambda.from((obj) => ({
//             concept: input,
//             upper: obj.concept.toUpperCase(),
//             length: obj.concept.length,
//         }))
//     })
// ])

// RunnablePassthrough.assign 扩展属性
/**
 * 之前的属性保留、合并新属性
 {
  concept: 'qwert',
  original: { concept: 'qwert' },
  processed: { concept: 'qwert', upper: 'QWERT', length: 5 }
}
 */
const chain = RunnableSequence.from([
    (input) => ({ concept: input }),
    RunnablePassthrough.assign({
        original: new RunnablePassthrough(),
        processed: (obj) => ({
            concept: input,
            upper: obj.concept.toUpperCase(),
            length: obj.concept.length,
        })
    })
]);
// 简化版本
// const chain = RunnableSequence.from([
//     (input) => ({ concept: input }),
//     {
//         original: new RunnablePassthrough(),
//         processed: (obj) => ({
//             concept: input,
//             upper: obj.concept.toUpperCase(),
//             length: obj.concept.length,
//         })
//     }
// ])


const input = "qwert";
const result = await chain.invoke(input);
console.log(result);

/**
 * {
  original: { concept: 'qwert' },
  processed: { concept: 'qwert', upper: 'QWERT', length: 5 }
}
 */