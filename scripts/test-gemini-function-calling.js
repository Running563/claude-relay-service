#!/usr/bin/env node

/**
 * 测试 Gemini 函数调用转发功能（完整测试套件）
 *
 * 测试端点:
 * 1. v1internal API (内部格式):
 *    - /gemini/v1internal:generateContent (非流式)
 *    - /gemini/v1internal:streamGenerateContent (流式)
 *
 * 2. v1 标准 API:
 *    - /gemini/v1/models/:model:generateContent (非流式)
 *    - /gemini/v1/models/:model:streamGenerateContent (流式)
 *
 * 3. v1beta 标准 API:
 *    - /gemini/v1beta/models/:model:generateContent (非流式)
 *    - /gemini/v1beta/models/:model:streamGenerateContent (流式)
 *
 * 4. OpenAI 兼容格式:
 *    - /openai/gemini/v1/chat/completions (支持流式和非流式)
 *
 * 使用方法:
 * node scripts/test-gemini-function-calling.js [options]
 *
 * 选项:
 * --test=<number>    只运行指定编号的测试用例（1-8）
 *
 * 环境变量:
 * - API_KEY: 你的 API Key (cr_xxx 格式)
 * - BASE_URL: 服务器基础 URL (默认: http://localhost:3000)
 * - MODEL_NAME: 模型名称 (默认: gemini-2.5-flash-lite)
 *
 * 示例:
 * node scripts/test-gemini-function-calling.js             # 运行所有测试
 * node scripts/test-gemini-function-calling.js --test=1    # 只运行测试1
 */

const axios = require('axios')

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || ''
const MODEL_NAME = process.env.MODEL_NAME || 'gemini-2.5-flash-lite'

// 测试用例列表
const TEST_CASES = [
  { id: 1, name: 'v1internal 非流式', type: 'v1internal', stream: false },
  { id: 2, name: 'v1internal 流式', type: 'v1internal', stream: true },
  { id: 3, name: 'v1 标准 非流式', type: 'v1', stream: false },
  { id: 4, name: 'v1 标准 流式', type: 'v1', stream: true },
  { id: 5, name: 'v1beta 标准 非流式', type: 'v1beta', stream: false },
  { id: 6, name: 'v1beta 标准 流式', type: 'v1beta', stream: true },
  { id: 7, name: 'OpenAI 格式 非流式', type: 'openai', stream: false },
  { id: 8, name: 'OpenAI 格式 流式', type: 'openai', stream: true }
]

// 解析命令行参数
const args = process.argv.slice(2)

// 解析 --test=N 参数
let specificTest = null
const testArg = args.find((arg) => arg.startsWith('--test='))
if (testArg) {
  const testNum = parseInt(testArg.split('=')[1])
  if (testNum >= 1 && testNum <= TEST_CASES.length) {
    specificTest = testNum
  } else {
    console.error(`❌ 错误: 测试编号必须在 1-${TEST_CASES.length} 之间`)
    console.error(`   可用的测试用例: 1-${TEST_CASES.length}`)
    process.exit(1)
  }
}

if (!API_KEY) {
  console.error('❌ 错误: 请设置 API_KEY 环境变量')
  console.error('   例如: API_KEY=cr_xxx node scripts/test-gemini-function-calling.js')
  process.exit(1)
}

// 定义测试函数：获取当前天气
const weatherFunction = {
  name: 'get_current_weather',
  description: 'Get the current weather in a given location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA'
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'The temperature unit to use'
      }
    },
    required: ['location']
  }
}

// ============================================================================
// 测试工具函数
// ============================================================================

function printTestHeader(testName) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🧪 ${testName}`)
  console.log('='.repeat(70))
}

function printSuccess(message) {
  console.log(`\n✅ ${message}`)
}

function printWarning(message) {
  console.log(`\n⚠️  ${message}`)
}

function printError(message) {
  console.error(`\n❌ ${message}`)
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// v1internal API 测试用例
// ============================================================================

async function testV1InternalNonStream() {
  printTestHeader('测试 1: v1internal API - 非流式函数调用')

  const requestBody = {
    model: MODEL_NAME,
    request: {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "What's the weather in Boston, MA? Please use the get_current_weather function to check."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    },
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY' // 强制调用函数
      }
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1internal:generateContent`
    console.log('📤 发送请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    console.log('📥 响应状态:', response.status)

    // 检查是否包含函数调用
    let hasFunctionCall = false
    const candidates = response.data?.response?.candidates || []
    if (candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || []
      for (const part of parts) {
        if (part.functionCall) {
          hasFunctionCall = true
          console.log('\n🔧 检测到函数调用:')
          console.log('   函数名:', part.functionCall.name)
          console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
        }
      }
    }

    if (hasFunctionCall) {
      printSuccess('v1internal 非流式函数调用测试通过!')
      return true
    } else {
      printWarning('未检测到函数调用')
      return false
    }
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

async function testV1InternalStream() {
  printTestHeader('测试 2: v1internal API - 流式函数调用')

  const requestBody = {
    model: MODEL_NAME,
    request: {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "What's the weather in New York and Los Angeles? Use the weather function to check both cities."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    },
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY'
      }
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1internal:streamGenerateContent`
    console.log('📤 发送流式请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      responseType: 'stream'
    })

    console.log('📥 响应状态:', response.status)
    console.log('📡 接收流式数据...')

    let buffer = ''
    let messageCount = 0
    let hasFunctionCall = false
    const functionCalls = []

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }

          const jsonStr = line.substring(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(jsonStr)
            messageCount++

            const candidates = data?.response?.candidates || []
            if (candidates.length > 0) {
              const parts = candidates[0]?.content?.parts || []
              for (const part of parts) {
                if (part.functionCall) {
                  hasFunctionCall = true
                  functionCalls.push(part.functionCall)
                  console.log(`\n🔧 检测到函数调用 #${functionCalls.length}:`)
                  console.log('   函数名:', part.functionCall.name)
                  console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      })

      response.data.on('end', () => {
        console.log(`\n📊 总共接收 ${messageCount} 条消息`)
        console.log(`📊 检测到 ${functionCalls.length} 个函数调用`)

        if (hasFunctionCall) {
          printSuccess('v1internal 流式函数调用测试通过!')
          resolve(true)
        } else {
          printWarning('未检测到函数调用')
          resolve(false)
        }
      })

      response.data.on('error', (error) => {
        printError(`流式传输错误: ${error.message}`)
        reject(error)
      })
    })
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// ============================================================================
// v1 标准 API 测试用例
// ============================================================================

async function testV1StandardNonStream() {
  printTestHeader('测试 3: v1 标准 API - 非流式函数调用')

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: "What's the weather in Boston, MA? Please use the get_current_weather function to check."
          }
        ]
      }
    ],
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY'
      }
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1/models/${MODEL_NAME}:generateContent`
    console.log('📤 发送请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    console.log('📥 响应状态:', response.status)

    let hasFunctionCall = false
    const candidates = response.data?.candidates || []
    if (candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || []
      for (const part of parts) {
        if (part.functionCall) {
          hasFunctionCall = true
          console.log('\n🔧 检测到函数调用:')
          console.log('   函数名:', part.functionCall.name)
          console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
        }
      }
    }

    if (hasFunctionCall) {
      printSuccess('v1 标准 API 非流式函数调用测试通过!')
      return true
    } else {
      printWarning('未检测到函数调用')
      return false
    }
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

async function testV1StandardStream() {
  printTestHeader('测试 4: v1 标准 API - 流式函数调用')

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: "What's the weather in New York and Los Angeles? Use the weather function to check both cities."
          }
        ]
      }
    ],
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY'
      }
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1/models/${MODEL_NAME}:streamGenerateContent`
    console.log('📤 发送流式请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      responseType: 'stream'
    })

    console.log('📥 响应状态:', response.status)
    console.log('📡 接收流式数据...')

    let buffer = ''
    let messageCount = 0
    let hasFunctionCall = false
    const functionCalls = []

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }

          const jsonStr = line.substring(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(jsonStr)
            messageCount++

            const candidates = data?.candidates || []
            if (candidates.length > 0) {
              const parts = candidates[0]?.content?.parts || []
              for (const part of parts) {
                if (part.functionCall) {
                  hasFunctionCall = true
                  functionCalls.push(part.functionCall)
                  console.log(`\n🔧 检测到函数调用 #${functionCalls.length}:`)
                  console.log('   函数名:', part.functionCall.name)
                  console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      })

      response.data.on('end', () => {
        console.log(`\n📊 总共接收 ${messageCount} 条消息`)
        console.log(`📊 检测到 ${functionCalls.length} 个函数调用`)

        if (hasFunctionCall) {
          printSuccess('v1 标准 API 流式函数调用测试通过!')
          resolve(true)
        } else {
          printWarning('未检测到函数调用')
          resolve(false)
        }
      })

      response.data.on('error', (error) => {
        printError(`流式传输错误: ${error.message}`)
        reject(error)
      })
    })
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// ============================================================================
// v1beta 标准 API 测试用例
// ============================================================================

async function testV1BetaStandardNonStream() {
  printTestHeader('测试 5: v1beta 标准 API - 非流式函数调用')

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: "What's the weather in San Francisco, CA? Please use the get_current_weather function."
          }
        ]
      }
    ],
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY'
      }
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1beta/models/${MODEL_NAME}:generateContent`
    console.log('📤 发送请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    console.log('📥 响应状态:', response.status)

    let hasFunctionCall = false
    const candidates = response.data?.candidates || []
    if (candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || []
      for (const part of parts) {
        if (part.functionCall) {
          hasFunctionCall = true
          console.log('\n🔧 检测到函数调用:')
          console.log('   函数名:', part.functionCall.name)
          console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
        }
      }
    }

    if (hasFunctionCall) {
      printSuccess('v1beta 标准 API 非流式函数调用测试通过!')
      return true
    } else {
      printWarning('未检测到函数调用')
      return false
    }
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

async function testV1BetaStandardStream() {
  printTestHeader('测试 6: v1beta 标准 API - 流式函数调用')

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: "What's the weather in Tokyo and Paris? Use the weather function."
          }
        ]
      }
    ],
    tools: [
      {
        function_declarations: [weatherFunction]
      }
    ],
    tool_config: {
      function_calling_config: {
        mode: 'ANY'
      }
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  }

  try {
    const endpoint = `${BASE_URL}/gemini/v1beta/models/${MODEL_NAME}:streamGenerateContent`
    console.log('📤 发送流式请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      responseType: 'stream'
    })

    console.log('📥 响应状态:', response.status)
    console.log('📡 接收流式数据...')

    let buffer = ''
    let messageCount = 0
    let hasFunctionCall = false
    const functionCalls = []

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }

          const jsonStr = line.substring(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(jsonStr)
            messageCount++

            const candidates = data?.candidates || []
            if (candidates.length > 0) {
              const parts = candidates[0]?.content?.parts || []
              for (const part of parts) {
                if (part.functionCall) {
                  hasFunctionCall = true
                  functionCalls.push(part.functionCall)
                  console.log(`\n🔧 检测到函数调用 #${functionCalls.length}:`)
                  console.log('   函数名:', part.functionCall.name)
                  console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
                }
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      })

      response.data.on('end', () => {
        console.log(`\n📊 总共接收 ${messageCount} 条消息`)
        console.log(`📊 检测到 ${functionCalls.length} 个函数调用`)

        if (hasFunctionCall) {
          printSuccess('v1beta 标准 API 流式函数调用测试通过!')
          resolve(true)
        } else {
          printWarning('未检测到函数调用')
          resolve(false)
        }
      })

      response.data.on('error', (error) => {
        printError(`流式传输错误: ${error.message}`)
        reject(error)
      })
    })
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// ============================================================================
// OpenAI 格式测试用例
// ============================================================================

async function testOpenAINonStream() {
  printTestHeader('测试 7: OpenAI 格式 - 非流式函数调用')

  const requestBody = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'user',
        content:
          "What's the weather in Boston, MA? Please use the get_current_weather function to check."
      }
    ],
    tools: [
      {
        type: 'function',
        function: weatherFunction
      }
    ],
    tool_choice: { type: 'function', function: { name: 'get_current_weather' } },
    temperature: 0.7,
    max_tokens: 4096,
    stream: false
  }

  try {
    const endpoint = `${BASE_URL}/openai/gemini/v1/chat/completions`
    console.log('📤 发送请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    console.log('📥 响应状态:', response.status)

    let hasFunctionCall = false
    const choices = response.data?.choices || []
    if (choices.length > 0) {
      const message = choices[0]?.message
      const toolCalls = message?.tool_calls || []

      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          hasFunctionCall = true
          console.log('\n🔧 检测到函数调用:')
          console.log('   函数名:', toolCall.function.name)
          console.log('   参数:', toolCall.function.arguments)
        }
      }
    }

    if (hasFunctionCall) {
      printSuccess('OpenAI 格式非流式函数调用测试通过!')
      return true
    } else {
      printWarning('未检测到函数调用')
      return false
    }
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

async function testOpenAIStream() {
  printTestHeader('测试 8: OpenAI 格式 - 流式函数调用')

  const requestBody = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'user',
        content:
          "What's the weather in New York and Los Angeles? Use the weather function to check both cities."
      }
    ],
    tools: [
      {
        type: 'function',
        function: weatherFunction
      }
    ],
    tool_choice: { type: 'function', function: { name: 'get_current_weather' } },
    temperature: 0.7,
    max_tokens: 4096,
    stream: true
  }

  try {
    const endpoint = `${BASE_URL}/openai/gemini/v1/chat/completions`
    console.log('📤 发送流式请求到:', endpoint)

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      responseType: 'stream'
    })

    console.log('📥 响应状态:', response.status)
    console.log('📡 接收流式数据...')

    let buffer = ''
    let chunkCount = 0
    let hasFunctionCall = false
    const toolCallsMap = new Map()

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }

          const jsonStr = line.substring(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(jsonStr)
            chunkCount++

            const choices = data?.choices || []
            if (choices.length > 0) {
              const delta = choices[0]?.delta
              const toolCalls = delta?.tool_calls || []

              for (const toolCall of toolCalls) {
                const index = toolCall.index || 0

                if (!toolCallsMap.has(index)) {
                  toolCallsMap.set(index, {
                    id: toolCall.id || '',
                    type: toolCall.type || 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || ''
                    }
                  })
                } else {
                  const existing = toolCallsMap.get(index)
                  if (toolCall.function?.name) {
                    existing.function.name += toolCall.function.name
                  }
                  if (toolCall.function?.arguments) {
                    existing.function.arguments += toolCall.function.arguments
                  }
                }

                hasFunctionCall = true
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      })

      response.data.on('end', () => {
        console.log(`\n📊 总共接收 ${chunkCount} 个数据块`)

        if (hasFunctionCall && toolCallsMap.size > 0) {
          console.log(`📊 检测到 ${toolCallsMap.size} 个函数调用`)
          for (const [index, toolCall] of toolCallsMap.entries()) {
            console.log(`\n🔧 函数调用 #${index + 1}:`)
            console.log('   函数名:', toolCall.function.name)
            console.log('   参数:', toolCall.function.arguments)
          }
          printSuccess('OpenAI 格式流式函数调用测试通过!')
          resolve(true)
        } else {
          printWarning('未检测到函数调用')
          resolve(false)
        }
      })

      response.data.on('error', (error) => {
        printError(`流式传输错误: ${error.message}`)
        reject(error)
      })
    })
  } catch (error) {
    printError('测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// ============================================================================
// 主测试函数
// ============================================================================

async function runTests() {
  const separator = '='.repeat(70)
  console.log(`\n${separator}`)
  console.log('🚀 Gemini 函数调用转发功能测试套件')
  console.log(separator)
  console.log('服务器地址:', BASE_URL)
  console.log('模型名称:', MODEL_NAME)
  console.log('API Key:', `${API_KEY.substring(0, 10)}...`)
  console.log(separator)

  const results = []
  let totalTests = 0
  let passedTests = 0

  // 如果指定了具体测试，只运行该测试
  if (specificTest) {
    const testCase = TEST_CASES[specificTest - 1]
    console.log(`\n只运行测试 ${testCase.id}: ${testCase.name}\n`)

    totalTests = 1
    let result = false

    switch (testCase.id) {
      case 1:
        result = await testV1InternalNonStream()
        break
      case 2:
        result = await testV1InternalStream()
        break
      case 3:
        result = await testV1StandardNonStream()
        break
      case 4:
        result = await testV1StandardStream()
        break
      case 5:
        result = await testV1BetaStandardNonStream()
        break
      case 6:
        result = await testV1BetaStandardStream()
        break
      case 7:
        result = await testOpenAINonStream()
        break
      case 8:
        result = await testOpenAIStream()
        break
    }

    results.push({ name: testCase.name, passed: result })
    if (result) {
      passedTests++
    }
  } else {
    // 运行所有测试
    console.log('\n运行所有测试\n')

    // v1internal API 测试
    totalTests++
    let result = await testV1InternalNonStream()
    results.push({ name: 'v1internal 非流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    totalTests++
    result = await testV1InternalStream()
    results.push({ name: 'v1internal 流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    // v1 标准 API 测试
    totalTests++
    result = await testV1StandardNonStream()
    results.push({ name: 'v1 标准 非流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    totalTests++
    result = await testV1StandardStream()
    results.push({ name: 'v1 标准 流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    // v1beta 标准 API 测试
    totalTests++
    result = await testV1BetaStandardNonStream()
    results.push({ name: 'v1beta 标准 非流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    totalTests++
    result = await testV1BetaStandardStream()
    results.push({ name: 'v1beta 标准 流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    // OpenAI 格式测试
    totalTests++
    result = await testOpenAINonStream()
    results.push({ name: 'OpenAI 格式 非流式', passed: result })
    if (result) {
      passedTests++
    }
    await delay(2000)

    totalTests++
    result = await testOpenAIStream()
    results.push({ name: 'OpenAI 格式 流式', passed: result })
    if (result) {
      passedTests++
    }
  }

  // 打印测试总结
  console.log(`\n${separator}`)
  console.log('📊 测试结果总结')
  console.log(separator)
  results.forEach((result, index) => {
    const status = result.passed ? '✅ 通过' : '❌ 失败'
    console.log(`${index + 1}. ${result.name}: ${status}`)
  })
  console.log(separator)
  console.log(`总计: ${passedTests}/${totalTests} 测试通过`)
  console.log(separator)

  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过!')
    process.exit(0)
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} 个测试失败`)
    process.exit(1)
  }
}

// 运行测试
runTests().catch((error) => {
  console.error('\n❌ 测试执行失败:', error)
  process.exit(1)
})
