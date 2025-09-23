<template>
  <div class="card">
    <!-- 精简表格头部 -->
    <div
      v-if="selectedRequests.length > 0"
      class="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-700"
    >
      <span class="text-sm text-gray-600 dark:text-gray-400">
        已选择 {{ selectedRequests.length }} 项
      </span>
      <div class="flex items-center gap-2">
        <button class="btn btn-danger btn-sm flex items-center gap-2" @click="batchDelete">
          <i class="fas fa-trash"></i>
          批量删除
        </button>
        <button class="btn btn-outline btn-sm" @click="clearSelection">取消选择</button>
      </div>
    </div>

    <!-- 表格内容 -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <!-- 全选框 -->
            <th class="w-12 px-6 py-3">
              <input
                :checked="isAllSelected"
                class="form-checkbox h-4 w-4 text-blue-600 dark:text-blue-400"
                :indeterminate="isIndeterminate"
                type="checkbox"
                @change="toggleAllSelection"
              />
            </th>
            <th class="table-header">请求ID</th>
            <th class="table-header">API Key</th>
            <th class="table-header">模型</th>
            <th class="table-header">状态</th>
            <th class="table-header">Token使用</th>
            <th class="table-header">响应时间</th>
            <th class="table-header">请求时间</th>
            <th class="table-header">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          <!-- 加载状态 -->
          <tr v-if="loading && requests.length === 0">
            <td class="px-6 py-12 text-center" colspan="9">
              <div class="loading-spinner mx-auto mb-4"></div>
              <p class="text-gray-500 dark:text-gray-400">正在加载请求历史...</p>
            </td>
          </tr>

          <!-- 空状态 -->
          <tr v-else-if="!loading && requests.length === 0">
            <td class="px-6 py-12 text-center" colspan="9">
              <div
                class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
              >
                <i class="fas fa-history text-2xl text-gray-400 dark:text-gray-500"></i>
              </div>
              <p class="text-lg text-gray-500 dark:text-gray-400">暂无请求历史</p>
              <p class="mt-2 text-sm text-gray-400 dark:text-gray-500">等待API调用产生历史记录</p>
            </td>
          </tr>

          <!-- 数据行 -->
          <tr
            v-for="request in requests"
            :key="request.requestId"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <!-- 选择框 -->
            <td class="px-6 py-4">
              <input
                v-model="selectedRequests"
                class="form-checkbox h-4 w-4 text-blue-600 dark:text-blue-400"
                type="checkbox"
                :value="request.requestId"
              />
            </td>

            <!-- 请求ID -->
            <td class="px-6 py-4">
              <div class="text-sm">
                <button
                  class="font-mono text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  @click="$emit('view-details', request)"
                >
                  {{ truncateId(request.requestId) }}
                </button>
              </div>
            </td>

            <!-- API Key -->
            <td class="px-6 py-4">
              <div class="text-sm">
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ request.apiKeyName || '未知' }}
                </span>
              </div>
            </td>

            <!-- 模型 -->
            <td class="px-6 py-4">
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {{ request.model }}
              </span>
            </td>

            <!-- 状态 -->
            <td class="px-6 py-4">
              <span :class="getStatusBadgeClass(request.status)">
                <i class="mr-1" :class="getStatusIcon(request.status)"></i>
                {{ getStatusLabel(request.status) }}
              </span>
            </td>

            <!-- Token使用 -->
            <td class="px-6 py-4">
              <div class="text-sm">
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatNumber(request.inputTokens || 0) }} /
                  {{ formatNumber(request.outputTokens || 0) }}
                  <span
                    v-if="
                      (request.cacheCreateTokens || 0) > 0 || (request.cacheReadTokens || 0) > 0
                    "
                  >
                    /
                    {{
                      formatNumber(
                        (request.cacheCreateTokens || 0) + (request.cacheReadTokens || 0)
                      )
                    }}
                  </span>
                </div>
              </div>
            </td>

            <!-- 响应时间 -->
            <td class="px-6 py-4">
              <div class="text-sm">
                <span :class="getDurationClass(request.duration)">
                  {{ request.duration ? `${request.duration}ms` : 'N/A' }}
                </span>
              </div>
            </td>

            <!-- 请求时间 -->
            <td class="px-6 py-4">
              <div class="text-sm">
                <div class="text-gray-900 dark:text-white">
                  {{ formatDate(request.timestamp) }} {{ formatTime(request.timestamp) }}
                </div>
              </div>
            </td>

            <!-- 操作 -->
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <button
                  class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  title="查看详情"
                  @click="$emit('view-details', request)"
                >
                  <i class="fas fa-eye"></i>
                </button>
                <button
                  class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  title="删除记录"
                  @click="$emit('delete-request', request)"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from '@/utils/toast'

const props = defineProps({
  requests: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['view-details', 'delete-request'])

// 响应式数据
const selectedRequests = ref([])

// 计算属性
const isAllSelected = computed(() => {
  return props.requests.length > 0 && selectedRequests.value.length === props.requests.length
})

const isIndeterminate = computed(() => {
  return selectedRequests.value.length > 0 && selectedRequests.value.length < props.requests.length
})

// 方法
const toggleAllSelection = (event) => {
  if (event.target.checked) {
    selectedRequests.value = props.requests.map((r) => r.requestId)
  } else {
    selectedRequests.value = []
  }
}

const clearSelection = () => {
  selectedRequests.value = []
}

const batchDelete = async () => {
  if (selectedRequests.value.length === 0) return

  const count = selectedRequests.value.length
  if (!confirm(`确定要删除选中的 ${count} 条请求记录吗？此操作不可恢复。`)) {
    return
  }

  try {
    // 这里应该调用批量删除API，暂时逐个删除
    for (const requestId of selectedRequests.value) {
      const request = props.requests.find((r) => r.requestId === requestId)
      if (request) {
        emit('delete-request', request)
      }
    }

    clearSelection()
    showToast(`批量删除 ${count} 条记录成功`, 'success')
  } catch (error) {
    console.error('批量删除失败:', error)
    showToast('批量删除失败', 'error')
  }
}

// 工具函数
const truncateId = (id) => {
  if (!id) return 'N/A'
  return id.length > 8 ? `${id.substring(0, 8)}...` : id
}

const formatNumber = (num) => {
  if (num == null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const formatTime = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleTimeString('zh-CN')
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

const getStatusBadgeClass = (status) => {
  const classes = {
    success:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    error:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  return (
    classes[status] ||
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  )
}

const getDurationClass = (duration) => {
  if (!duration) return 'text-gray-500 dark:text-gray-400'
  if (duration < 1000) return 'text-green-600 dark:text-green-400'
  if (duration < 3000) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}
</script>

<style scoped>
.card {
  @apply rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:bg-gray-800;
  @apply border border-gray-200/60 dark:border-gray-700/60;
  @apply bg-white/80 backdrop-blur-sm dark:bg-gray-800/80;
}

.table-header {
  @apply px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300;
}

.form-checkbox {
  @apply rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-blue-400;
}

.loading-spinner {
  @apply h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600;
}

.btn {
  @apply inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.btn-sm {
  @apply px-2 py-1 text-xs;
}

.btn-outline {
  @apply border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700;
}

.btn-danger {
  @apply border border-red-300 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:border-red-600;
}

/* 表格响应式样式 */
@media (max-width: 768px) {
  .table-header,
  td {
    @apply px-4 py-3;
  }

  .table-header {
    @apply text-xs;
  }

  td {
    @apply text-sm;
  }
}
</style>
