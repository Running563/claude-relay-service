<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- 总请求数 -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">总请求数</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ loading ? '...' : formatNumber(stats.totalRequests) }}
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            成功: {{ formatNumber(stats.successRequests) }}
          </p>
        </div>
        <div class="stat-icon bg-gradient-to-br from-blue-500 to-blue-600">
          <i class="fas fa-chart-line"></i>
        </div>
      </div>
    </div>

    <!-- 成功率 -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">成功率</p>
          <p class="text-3xl font-bold text-green-600 dark:text-green-400">
            {{ loading ? '...' : successRate }}%
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            失败: {{ formatNumber(stats.failedRequests) }}
          </p>
        </div>
        <div class="stat-icon bg-gradient-to-br from-green-500 to-green-600">
          <i class="fas fa-check-circle"></i>
        </div>
      </div>
    </div>

    <!-- Token消耗 -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">总Token</p>
          <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {{ loading ? '...' : formatNumber(stats.totalTokens) }}
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            平均: {{ formatNumber(avgTokensPerRequest) }}
          </p>
        </div>
        <div class="stat-icon bg-gradient-to-br from-purple-500 to-purple-600">
          <i class="fas fa-coins"></i>
        </div>
      </div>
    </div>

    <!-- 平均响应时间 -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">平均响应时间</p>
          <p class="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {{ loading ? '...' : formatDuration(stats.avgDuration) }}
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">毫秒</p>
        </div>
        <div class="stat-icon bg-gradient-to-br from-orange-500 to-orange-600">
          <i class="fas fa-clock"></i>
        </div>
      </div>
    </div>
  </div>

  <!-- 详细统计 -->
  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- 模型分布 -->
    <div class="card p-6">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">模型使用分布</h3>
      <div v-if="loading" class="py-8 text-center">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-500 dark:text-gray-400">加载中...</p>
      </div>
      <div v-else-if="Object.keys(stats.modelStats || {}).length === 0" class="py-8 text-center">
        <i class="fas fa-chart-pie mb-4 text-4xl text-gray-300 dark:text-gray-600"></i>
        <p class="text-gray-500 dark:text-gray-400">暂无模型数据</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="(count, model) in stats.modelStats"
          :key="model"
          class="flex items-center justify-between"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ model }}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(count) }}
            </span>
            <div class="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                :style="{
                  width: `${(count / Math.max(...Object.values(stats.modelStats))) * 100}%`
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态分布 -->
    <div class="card p-6">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">请求状态分布</h3>
      <div v-if="loading" class="py-8 text-center">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-gray-500 dark:text-gray-400">加载中...</p>
      </div>
      <div v-else-if="Object.keys(stats.statusStats || {}).length === 0" class="py-8 text-center">
        <i class="fas fa-chart-bar mb-4 text-4xl text-gray-300 dark:text-gray-600"></i>
        <p class="text-gray-500 dark:text-gray-400">暂无状态数据</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="(count, status) in stats.statusStats"
          :key="status"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <i class="text-sm" :class="getStatusIcon(status)"></i>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ getStatusLabel(status) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ formatNumber(count) }}
            </span>
            <div class="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                class="h-full transition-all duration-300"
                :class="getStatusColor(status)"
                :style="{
                  width: `${(count / Math.max(...Object.values(stats.statusStats))) * 100}%`
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// 计算属性
const successRate = computed(() => {
  if (!props.stats.totalRequests) return 0
  return ((props.stats.successRequests / props.stats.totalRequests) * 100).toFixed(1)
})

const avgTokensPerRequest = computed(() => {
  if (!props.stats.totalRequests) return 0
  return Math.round(props.stats.totalTokens / props.stats.totalRequests)
})

// 工具函数
const formatNumber = (num) => {
  if (num == null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

const formatDuration = (ms) => {
  if (ms == null || ms === undefined) return '0'
  return Math.round(ms).toString()
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
    success: 'fas fa-check-circle text-green-500',
    error: 'fas fa-times-circle text-red-500',
    pending: 'fas fa-clock text-yellow-500'
  }
  return icons[status] || 'fas fa-question-circle text-gray-500'
}

const getStatusColor = (status) => {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    pending: 'bg-yellow-500'
  }
  return colors[status] || 'bg-gray-500'
}
</script>

<style scoped>
.stat-card {
  @apply rounded-xl bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md dark:bg-gray-800;
  @apply border border-gray-200/60 dark:border-gray-700/60;
  @apply bg-white/80 backdrop-blur-sm dark:bg-gray-800/80;
}

.stat-icon {
  @apply flex h-12 w-12 items-center justify-center rounded-xl text-xl text-white;
}

.card {
  @apply rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:bg-gray-800;
  @apply border border-gray-200/60 dark:border-gray-700/60;
  @apply bg-white/80 backdrop-blur-sm dark:bg-gray-800/80;
}

.loading-spinner {
  @apply h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600;
}
</style>
