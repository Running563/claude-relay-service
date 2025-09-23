<template>
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <!-- 背景遮罩 -->
    <div
      class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
      @click="$emit('close')"
    ></div>

    <!-- 模态框内容 -->
    <div class="flex min-h-screen items-center justify-center p-4">
      <div
        class="relative w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all dark:bg-gray-800"
        @click.stop
      >
        <!-- 头部 -->
        <div
          class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
        >
          <div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">请求详情</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">请求ID: {{ request?.requestId }}</p>
          </div>
          <button
            class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            @click="$emit('close')"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="max-h-[80vh] overflow-y-auto">
          <div class="p-6">
            <!-- 基本信息 -->
            <div class="mb-6">
              <h4 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">基本信息</h4>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div class="info-item">
                  <label>API Key</label>
                  <span>{{ request?.apiKeyName || '未知' }}</span>
                </div>
                <div class="info-item">
                  <label>模型</label>
                  <span>{{ request?.model }}</span>
                </div>
                <div class="info-item">
                  <label>状态</label>
                  <span :class="getStatusClass(request?.status)">
                    <i :class="getStatusIcon(request?.status)"></i>
                    {{ getStatusLabel(request?.status) }}
                  </span>
                </div>
                <div class="info-item">
                  <label>请求时间</label>
                  <span>{{ formatDateTime(request?.timestamp) }}</span>
                </div>
                <div class="info-item">
                  <label>响应时间</label>
                  <span>{{ request?.duration || 0 }}ms</span>
                </div>
                <div class="info-item">
                  <label>状态码</label>
                  <span>{{ request?.statusCode || 'N/A' }}</span>
                </div>
              </div>
            </div>

            <!-- Token使用统计 -->
            <div class="mb-6">
              <h4 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Token使用统计
              </h4>
              <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div class="stat-box">
                  <div class="stat-value text-blue-600 dark:text-blue-400">
                    {{ formatNumber(request?.inputTokens || 0) }}
                  </div>
                  <div class="stat-label">输入Token</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value text-green-600 dark:text-green-400">
                    {{ formatNumber(request?.outputTokens || 0) }}
                  </div>
                  <div class="stat-label">输出Token</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value text-purple-600 dark:text-purple-400">
                    {{ formatNumber(request?.cacheCreateTokens || 0) }}
                  </div>
                  <div class="stat-label">缓存创建</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value text-orange-600 dark:text-orange-400">
                    {{ formatNumber(request?.cacheReadTokens || 0) }}
                  </div>
                  <div class="stat-label">缓存读取</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value text-gray-900 dark:text-gray-100">
                    {{ formatNumber(request?.totalTokens || 0) }}
                  </div>
                  <div class="stat-label">总Token</div>
                </div>
              </div>
            </div>

            <!-- 标签页 -->
            <div class="mb-4">
              <div class="border-b border-gray-200 dark:border-gray-700">
                <nav class="-mb-px flex space-x-8">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    :class="[
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                      'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium'
                    ]"
                    @click="activeTab = tab.key"
                  >
                    <i :class="tab.icon + ' mr-2'"></i>
                    {{ tab.name }}
                  </button>
                </nav>
              </div>
            </div>

            <!-- 标签页内容 -->
            <div class="tab-content">
              <!-- 请求头 -->
              <div v-if="activeTab === 'headers'" class="space-y-4">
                <div v-if="!request?.headers || Object.keys(request.headers).length === 0">
                  <div class="py-8 text-center">
                    <i class="fas fa-file-alt mb-4 text-4xl text-gray-300 dark:text-gray-600"></i>
                    <p class="text-gray-500 dark:text-gray-400">无请求头信息</p>
                  </div>
                </div>
                <div v-else>
                  <div class="code-block">
                    <pre><code>{{ JSON.stringify(request.headers, null, 2) }}</code></pre>
                  </div>
                </div>
              </div>

              <!-- 请求体 -->
              <div v-if="activeTab === 'request'" class="space-y-4">
                <div v-if="!request?.requestBody">
                  <div class="py-8 text-center">
                    <i class="fas fa-file-alt mb-4 text-4xl text-gray-300 dark:text-gray-600"></i>
                    <p class="text-gray-500 dark:text-gray-400">无请求体信息</p>
                  </div>
                </div>
                <div v-else>
                  <div class="code-block">
                    <pre><code>{{ formatJSON(request.requestBody) }}</code></pre>
                  </div>
                </div>
              </div>

              <!-- 响应体 -->
              <div v-if="activeTab === 'response'" class="space-y-4">
                <div v-if="!request?.responseBody">
                  <div class="py-8 text-center">
                    <i class="fas fa-file-alt mb-4 text-4xl text-gray-300 dark:text-gray-600"></i>
                    <p class="text-gray-500 dark:text-gray-400">无响应体信息</p>
                  </div>
                </div>
                <div v-else-if="request.responseBody.type === 'truncated'">
                  <div class="mb-4 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                    <div class="flex">
                      <i class="fas fa-exclamation-triangle mr-3 mt-0.5 text-yellow-400"></i>
                      <div>
                        <h5 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          响应体已被截断
                        </h5>
                        <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                          原始长度: {{ formatNumber(request.responseBody.originalLength) }} 字符
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="code-block">
                    <pre><code>{{ request.responseBody.preview }}</code></pre>
                  </div>
                </div>
                <div v-else>
                  <div class="code-block">
                    <pre><code>{{ formatJSON(request.responseBody) }}</code></pre>
                  </div>
                </div>
              </div>

              <!-- 错误信息 -->
              <div v-if="activeTab === 'error'" class="space-y-4">
                <div v-if="!request?.error">
                  <div class="py-8 text-center">
                    <i
                      class="fas fa-check-circle mb-4 text-4xl text-green-300 dark:text-green-600"
                    ></i>
                    <p class="text-gray-500 dark:text-gray-400">无错误信息</p>
                  </div>
                </div>
                <div v-else>
                  <div class="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                    <div class="flex">
                      <i class="fas fa-exclamation-circle mr-3 mt-0.5 text-red-400"></i>
                      <div class="flex-1">
                        <h5 class="text-sm font-medium text-red-800 dark:text-red-200">错误信息</h5>
                        <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                          <pre class="whitespace-pre-wrap">{{ request.error }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button class="btn btn-outline" @click="$emit('close')">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  request: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

// 响应式数据
const activeTab = ref('request')

const tabs = [
  { key: 'request', name: '请求体', icon: 'fas fa-arrow-up' },
  { key: 'response', name: '响应体', icon: 'fas fa-arrow-down' },
  { key: 'headers', name: '请求头', icon: 'fas fa-list' },
  { key: 'error', name: '错误信息', icon: 'fas fa-exclamation-triangle' }
]

// 工具函数
const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const formatNumber = (num) => {
  if (num == null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

const formatJSON = (obj) => {
  if (obj == null || obj === undefined) return ''
  if (typeof obj === 'string') {
    try {
      return JSON.stringify(JSON.parse(obj), null, 2)
    } catch {
      return obj
    }
  }
  return JSON.stringify(obj, null, 2)
}

const getStatusLabel = (status) => {
  const labels = {
    success: '成功',
    error: '失败',
    pending: '进行中'
  }
  return labels[status] || status
}

const getStatusIcon = (status) => {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    pending: 'fas fa-clock'
  }
  return icons[status] || 'fas fa-question-circle'
}

const getStatusClass = (status) => {
  const classes = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    pending: 'text-yellow-600 dark:text-yellow-400'
  }
  return classes[status] || 'text-gray-600 dark:text-gray-400'
}
</script>

<style scoped>
.info-item {
  @apply flex flex-col space-y-1;
}

.info-item label {
  @apply text-sm font-medium text-gray-600 dark:text-gray-400;
}

.info-item span {
  @apply text-sm text-gray-900 dark:text-white;
}

.stat-box {
  @apply rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-700;
}

.stat-value {
  @apply text-2xl font-bold;
}

.stat-label {
  @apply mt-1 text-xs text-gray-600 dark:text-gray-400;
}

.code-block {
  @apply max-h-96 overflow-auto rounded-lg bg-gray-50 p-4 dark:bg-gray-900;
}

.code-block pre {
  @apply text-sm text-gray-800 dark:text-gray-200;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.code-block code {
  @apply whitespace-pre-wrap break-all;
}

.tab-content {
  @apply min-h-[300px];
}

.btn {
  @apply inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.btn-outline {
  @apply border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700;
}

/* 滚动条样式 */
.code-block::-webkit-scrollbar {
  @apply h-2 w-2;
}

.code-block::-webkit-scrollbar-track {
  @apply rounded bg-gray-100 dark:bg-gray-800;
}

.code-block::-webkit-scrollbar-thumb {
  @apply rounded bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500;
}
</style>
