const redis = require('../models/redis')
const logger = require('../utils/logger')
const { v4: uuidv4 } = require('uuid')

class RequestHistoryService {
  constructor() {
    // 默认配置值
    this.defaultConfig = {
      enableHistoryLogging: true,
      maxRecordsPerKey: 1000, // 每个API Key最多保留1000条记录
      maxRequestBodySize: 5000, // 减少存储大小
      maxResponseBodySize: 10000 // 减少存储大小
    }

    // 初始化配置
    this.initializeConfig()
  }

  // 🔧 初始化配置（从Redis加载或使用默认值）
  async initializeConfig() {
    try {
      const savedConfig = await this.loadConfigFromRedis()
      if (savedConfig) {
        this.enableHistoryLogging =
          savedConfig.enableHistoryLogging ?? this.defaultConfig.enableHistoryLogging
        this.maxRecordsPerKey = savedConfig.maxRecordsPerKey ?? this.defaultConfig.maxRecordsPerKey
        this.maxRequestBodySize =
          savedConfig.maxRequestBodySize ?? this.defaultConfig.maxRequestBodySize
        this.maxResponseBodySize =
          savedConfig.maxResponseBodySize ?? this.defaultConfig.maxResponseBodySize
        logger.debug('📁 Request history config loaded from Redis')
      } else {
        // 使用默认配置并保存到Redis
        this.enableHistoryLogging = this.defaultConfig.enableHistoryLogging
        this.maxRecordsPerKey = this.defaultConfig.maxRecordsPerKey
        this.maxRequestBodySize = this.defaultConfig.maxRequestBodySize
        this.maxResponseBodySize = this.defaultConfig.maxResponseBodySize
        await this.saveConfigToRedis()
        logger.debug('📁 Using default request history config and saved to Redis')
      }
    } catch (error) {
      logger.error('❌ Failed to initialize request history config, using defaults:', error)
      this.enableHistoryLogging = this.defaultConfig.enableHistoryLogging
      this.maxRecordsPerKey = this.defaultConfig.maxRecordsPerKey
      this.maxRequestBodySize = this.defaultConfig.maxRequestBodySize
      this.maxResponseBodySize = this.defaultConfig.maxResponseBodySize
    }
  }

  // 💾 从Redis加载配置
  async loadConfigFromRedis() {
    try {
      const configData = await redis.get('request_history_config')
      return configData ? JSON.parse(configData) : null
    } catch (error) {
      logger.error('❌ Failed to load request history config from Redis:', error)
      return null
    }
  }

  // 💾 保存配置到Redis
  async saveConfigToRedis() {
    try {
      const config = {
        enableHistoryLogging: this.enableHistoryLogging,
        maxRecordsPerKey: this.maxRecordsPerKey,
        maxRequestBodySize: this.maxRequestBodySize,
        maxResponseBodySize: this.maxResponseBodySize,
        updatedAt: new Date().toISOString()
      }
      await redis.set('request_history_config', JSON.stringify(config))
      logger.debug('💾 Request history config saved to Redis')
      return true
    } catch (error) {
      logger.error('❌ Failed to save request history config to Redis:', error)
      return false
    }
  }

  // 📋 获取当前配置
  async getCurrentConfig() {
    return {
      enableHistoryLogging: this.enableHistoryLogging,
      maxRecordsPerKey: this.maxRecordsPerKey,
      maxRequestBodySize: this.maxRequestBodySize,
      maxResponseBodySize: this.maxResponseBodySize
    }
  }

  // 📝 记录请求开始
  async startRequest(requestData) {
    if (!this.enableHistoryLogging) {
      return null
    }

    try {
      const requestId = uuidv4()
      const timestamp = new Date().toISOString()

      // 处理请求体大小限制
      let { requestBody } = requestData
      if (requestBody && JSON.stringify(requestBody).length > this.maxRequestBodySize) {
        requestBody = {
          ...requestBody,
          messages: requestBody.messages ? '[TRUNCATED - Large Messages]' : requestBody.messages
        }
      }

      const historyRecord = {
        requestId,
        timestamp,
        apiKeyId: requestData.apiKeyId,
        apiKeyName: requestData.apiKeyName,
        model: requestData.model || requestData.requestBody?.model || 'unknown',
        status: 'pending',
        requestBody,
        headers: this.sanitizeHeaders(requestData.headers),
        startTime: Date.now()
      }

      await redis.saveRequestHistory(historyRecord)
      // 确保每个API Key记录数量不超过限制
      await this.enforceRecordLimit(requestData.apiKeyId)

      logger.debug(`📝 Request started: ${requestId}`)
      return requestId
    } catch (error) {
      logger.error('❌ Failed to start request history:', error)
      return null
    }
  }

  // ✅ 记录请求成功完成
  async completeRequest(requestId, responseData) {
    if (!this.enableHistoryLogging || !requestId) {
      return
    }

    try {
      // 获取现有记录
      const existingRecord = await redis.getRequestHistory(requestId)
      if (!existingRecord) {
        logger.warn(`⚠️ Request history not found for completion: ${requestId}`)
        return
      }

      const endTime = Date.now()
      const duration = endTime - parseInt(existingRecord.startTime)

      // 处理响应体大小限制
      let { responseBody } = responseData
      if (responseBody && JSON.stringify(responseBody).length > this.maxResponseBodySize) {
        responseBody = {
          type: 'truncated',
          originalLength: JSON.stringify(responseData.responseBody).length,
          preview: `${JSON.stringify(responseData.responseBody).substring(0, 1000)}...`
        }
      }

      const updatedRecord = {
        ...existingRecord,
        status: 'success',
        duration,
        responseBody,
        statusCode: responseData.statusCode,
        inputTokens: responseData.inputTokens || 0,
        outputTokens: responseData.outputTokens || 0,
        cacheCreateTokens: responseData.cacheCreateTokens || 0,
        cacheReadTokens: responseData.cacheReadTokens || 0,
        totalTokens:
          (responseData.inputTokens || 0) +
          (responseData.outputTokens || 0) +
          (responseData.cacheCreateTokens || 0) +
          (responseData.cacheReadTokens || 0),
        endTime
      }

      await redis.saveRequestHistory(updatedRecord)

      logger.debug(`✅ Request completed: ${requestId}, duration: ${duration}ms`)
    } catch (error) {
      logger.error('❌ Failed to complete request history:', error)
    }
  }

  // ❌ 记录请求失败
  async failRequest(requestId, errorData) {
    if (!this.enableHistoryLogging || !requestId) {
      return
    }

    try {
      // 获取现有记录
      const existingRecord = await redis.getRequestHistory(requestId)
      if (!existingRecord) {
        logger.warn(`⚠️ Request history not found for failure: ${requestId}`)
        return
      }

      const endTime = Date.now()
      const duration = endTime - parseInt(existingRecord.startTime)

      const updatedRecord = {
        ...existingRecord,
        status: 'error',
        duration,
        error: errorData.error || 'Unknown error',
        statusCode: errorData.statusCode || 500,
        endTime
      }

      await redis.saveRequestHistory(updatedRecord)

      logger.debug(
        `❌ Request failed: ${requestId}, duration: ${duration}ms, error: ${errorData.error}`
      )
    } catch (error) {
      logger.error('❌ Failed to record request failure:', error)
    }
  }

  // 📊 获取请求历史列表（支持筛选）
  async getRequestHistory(options = {}) {
    try {
      return await redis.getRequestHistoryList(options)
    } catch (error) {
      logger.error('❌ Failed to get request history:', error)
      return []
    }
  }

  // 📋 获取单个请求详情
  async getRequestDetails(requestId) {
    try {
      return await redis.getRequestHistory(requestId)
    } catch (error) {
      logger.error('❌ Failed to get request details:', error)
      return null
    }
  }

  // 📈 获取请求统计
  async getRequestStats(apiKeyId, startTime = null, endTime = null) {
    try {
      return await redis.getRequestHistoryStats(apiKeyId, startTime, endTime)
    } catch (error) {
      logger.error('❌ Failed to get request stats:', error)
      return {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        avgDuration: 0,
        modelStats: {},
        statusStats: {}
      }
    }
  }

  // 🗑️ 删除请求记录
  async deleteRequest(requestId) {
    try {
      return await redis.deleteRequestHistory(requestId)
    } catch (error) {
      logger.error('❌ Failed to delete request:', error)
      return false
    }
  }

  // 🔢 确保每个API Key的记录数量限制
  async enforceRecordLimit(apiKeyId) {
    if (!apiKeyId) {
      return
    }

    try {
      // 获取该API Key的所有记录数量
      const recordCount = await redis.getRequestHistoryCount(apiKeyId)

      // 只有当超出限制100条以上时才进行批量清理，避免频繁清理
      const cleanupThreshold = this.maxRecordsPerKey + 100
      if (recordCount > cleanupThreshold) {
        // 删除超出限制的记录，保留最新的maxRecordsPerKey条
        const excessCount = recordCount - this.maxRecordsPerKey
        await redis.removeOldestRequestHistory(apiKeyId, excessCount)
        logger.debug(
          `🗑️ Batch cleaned ${excessCount} old records for API Key: ${apiKeyId}, keeping ${this.maxRecordsPerKey} newest records`
        )
      }
    } catch (error) {
      logger.error('❌ Failed to enforce record limit:', error)
    }
  }

  // 🔒 清理敏感headers
  sanitizeHeaders(headers) {
    if (!headers) {
      return {}
    }

    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'set-cookie',
      'proxy-authorization'
    ]

    const sanitized = {}
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  // 🔧 更新完整配置
  async updateConfig(newConfig) {
    try {
      if (typeof newConfig.enableHistoryLogging === 'boolean') {
        this.enableHistoryLogging = newConfig.enableHistoryLogging
      }
      if (typeof newConfig.maxRecordsPerKey === 'number' && newConfig.maxRecordsPerKey > 0) {
        this.maxRecordsPerKey = newConfig.maxRecordsPerKey
      }
      if (typeof newConfig.maxRequestBodySize === 'number' && newConfig.maxRequestBodySize > 0) {
        this.maxRequestBodySize = newConfig.maxRequestBodySize
      }
      if (typeof newConfig.maxResponseBodySize === 'number' && newConfig.maxResponseBodySize > 0) {
        this.maxResponseBodySize = newConfig.maxResponseBodySize
      }

      const saved = await this.saveConfigToRedis()
      if (saved) {
        logger.info('🔧 Request history config updated successfully')
        return true
      } else {
        logger.error('❌ Failed to save updated config to Redis')
        return false
      }
    } catch (error) {
      logger.error('❌ Failed to update request history config:', error)
      return false
    }
  }
}

module.exports = new RequestHistoryService()
