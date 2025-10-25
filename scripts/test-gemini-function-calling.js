#!/usr/bin/env node

/**
 * 测试 Gemini 函数调用转发功能
 *
 * 使用方法:
 * node scripts/test-gemini-function-calling.js
 *
 * 环境变量:
 * - API_KEY: 你的 API Key (cr_xxx 格式)
 * - BASE_URL: 服务器基础 URL (默认: http://localhost:3000)
 */

const axios = require('axios')

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || ''

if (!API_KEY) {
  console.error('❌ 错误: 请设置 API_KEY 环境变量')
  console.error('   例如: API_KEY=cr_xxx node scripts/test-gemini-function-calling.js')
  process.exit(1)
}

// 定义一个简单的函数：获取当前天气
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

// 测试用例 1: 非流式函数调用
async function testNonStreamFunctionCall() {
  console.log('\n🧪 测试 1: 非流式函数调用')
  console.log('=' .repeat(60))

  const requestBody = {
    model: 'gemini-2.0-flash-exp',
    request: {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "What's the weather like in San Francisco and Tokyo? Please use the weather function."
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
        mode: 'AUTO'
      }
    }
  }

  try {
    console.log('📤 发送请求到:', `${BASE_URL}/gemini/v1internal:generateContent`)
    console.log('📦 请求体:', JSON.stringify(requestBody, null, 2))

    const response = await axios.post(`${BASE_URL}/gemini/v1internal:generateContent`, requestBody, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    console.log('\n✅ 响应成功!')
    console.log('📥 响应状态:', response.status)
    console.log('📊 响应数据:', JSON.stringify(response.data, null, 2))

    // 检查是否包含函数调用
    const candidates = response.data?.response?.candidates || response.data?.candidates || []
    if (candidates.length > 0) {
      const firstCandidate = candidates[0]
      const parts = firstCandidate?.content?.parts || []

      for (const part of parts) {
        if (part.functionCall) {
          console.log('\n🔧 检测到函数调用:')
          console.log('   函数名:', part.functionCall.name)
          console.log('   参数:', JSON.stringify(part.functionCall.args, null, 2))
        }
      }
    }

    return true
  } catch (error) {
    console.error('\n❌ 测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// 测试用例 2: 流式函数调用
async function testStreamFunctionCall() {
  console.log('\n🧪 测试 2: 流式函数调用')
  console.log('=' .repeat(60))

  const requestBody = {
    model: 'gemini-2.0-flash-exp',
    request: {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: "What's the weather in Boston? Use the weather function."
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
        mode: 'AUTO'
      }
    }
  }

  try {
    console.log('📤 发送流式请求到:', `${BASE_URL}/gemini/v1internal:streamGenerateContent`)
    console.log('📦 请求体:', JSON.stringify(requestBody, null, 2))

    const response = await axios.post(
      `${BASE_URL}/gemini/v1internal:streamGenerateContent`,
      requestBody,
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
        responseType: 'stream'
      }
    )

    console.log('\n✅ 流式响应开始!')
    console.log('📥 响应状态:', response.status)
    console.log('📡 接收到的数据块:\n')

    let buffer = ''
    let chunkCount = 0

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        chunkCount++
        buffer += chunk.toString()

        // 处理 SSE 格式
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue
          }

          const jsonStr = line.substring(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') {
            console.log('🏁 流式传输完成')
            continue
          }

          try {
            const data = JSON.parse(jsonStr)
            console.log(`   📦 数据块 #${chunkCount}:`, JSON.stringify(data, null, 2))

            // 检查函数调用
            const candidates = data?.response?.candidates || data?.candidates || []
            if (candidates.length > 0) {
              const parts = candidates[0]?.content?.parts || []
              for (const part of parts) {
                if (part.functionCall) {
                  console.log('\n   🔧 检测到函数调用:')
                  console.log('      函数名:', part.functionCall.name)
                  console.log('      参数:', JSON.stringify(part.functionCall.args, null, 2))
                }
              }
            }
          } catch (e) {
            console.log(`   ⚠️ 无法解析的数据块: ${jsonStr}`)
          }
        }
      })

      response.data.on('end', () => {
        console.log('\n✅ 流式测试完成!')
        resolve(true)
      })

      response.data.on('error', (error) => {
        console.error('\n❌ 流式传输错误:', error.message)
        reject(error)
      })
    })
  } catch (error) {
    console.error('\n❌ 测试失败!')
    if (error.response) {
      console.error('   状态码:', error.response.status)
      console.error('   错误信息:', error.response.data)
    } else {
      console.error('   错误:', error.message)
    }
    return false
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试 Gemini 函数调用转发功能')
  console.log('=' .repeat(60))
  console.log('服务器地址:', BASE_URL)
  console.log('API Key:', API_KEY.substring(0, 10) + '...')
  console.log('=' .repeat(60))

  let allPassed = true

  // 运行测试 1
  const test1Result = await testNonStreamFunctionCall()
  if (!test1Result) {
    allPassed = false
  }

  // 等待 2 秒
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // 运行测试 2
  const test2Result = await testStreamFunctionCall()
  if (!test2Result) {
    allPassed = false
  }

  // 总结
  console.log('\n' + '=' .repeat(60))
  if (allPassed) {
    console.log('✅ 所有测试通过!')
  } else {
    console.log('❌ 部分测试失败')
    process.exit(1)
  }
  console.log('=' .repeat(60))
}

// 运行测试
runTests().catch((error) => {
  console.error('❌ 测试执行失败:', error)
  process.exit(1)
})
