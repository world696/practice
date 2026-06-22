import 'dotenv/config';
import { RunnableMap, RunnableLambda } from"@langchain/core/runnables";
import { PromptTemplate } from"@langchain/core/prompts";

const addOne = RunnableLambda.from((input) => input.num + 1);
const multiplyTwo = RunnableLambda.from((input) => input.num * 2);
const square = RunnableLambda.from((input) => input.num * input.num);

const greetTemplate = PromptTemplate.fromTemplate("你好，{name}！");
const weatherTemplate = PromptTemplate.fromTemplate("今天天气{weather}。");

const runnableMap = RunnableMap.from({
    add: addOne,
    multiplyTwo: multiplyTwo,
    square: square,

    // prompt格式化
    greeting: greetTemplate,
    weather: weatherTemplate,
})

const input = {
    name: 'qw',
    weather: "多云",
    num: 5,
}

const result = await runnableMap.invoke(input)
console.log(result)

/**
 * {
  add: 6,
  multiplyTwo: 10,
  square: 25,
  greeting: StringPromptValue {
    lc_serializable: true,
    lc_kwargs: { value: '你好，qw！' },
    lc_namespace: [ 'langchain_core', 'prompt_values' ],
    value: '你好，qw！'
  },
  weather: StringPromptValue {
    lc_serializable: true,
    lc_kwargs: { value: '今天天气多云。' },
    lc_namespace: [ 'langchain_core', 'prompt_values' ],
    value: '今天天气多云。'
  }
}
 */