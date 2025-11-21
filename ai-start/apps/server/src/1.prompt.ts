import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 创建llm实例

const llm = new ChatOllama({
  model: "qwen3:0.6b",
  temperature: 0.9,
});

llm.invoke([new SystemMessage("你是一个专业的翻译，能将中文翻译成英文"), new HumanMessage("你好")]);
