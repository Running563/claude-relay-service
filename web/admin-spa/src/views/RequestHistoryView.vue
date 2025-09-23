<template>
  <div class="space-y-4">
    <!-- 标题和操作按钮 -->
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">请求历史</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">查看和管理API请求记录</p>
      </div>
      <div class="flex gap-2">
        <button
          class="btn btn-secondary plr-8 flex items-center gap-2"
          :disabled="configLoading"
          @click="openConfigModal"
        >
          <i class="fas fa-cog" :class="{ 'animate-spin': configLoading }"></i>
          配置
        </button>
        <button
          class="btn btn-primary plr-8 flex items-center gap-2"
          :disabled="loading"
          @click="refresh"
        >
          <i class="fas fa-sync-alt" :class="{ 'animate-spin': loading }"></i>
          刷新
        </button>
      </div>
    </div>

    <!-- 筛选器 -->
    <RequestFilters :filters="filters" @update:filters="handleFiltersChange" />

    <!-- 简要统计标签（仅在有数据时显示） -->
    <div v-if="filters.apiKeyId && stats.totalRequests > 0" class="flex flex-wrap gap-2">
      <span
        class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      >
        总请求: {{ formatNumber(stats.totalRequests) }}
      </span>
      <span
        class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
      >
        成功率: {{ successRate }}%
      </span>
      <span
        class="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      >
        总Token: {{ formatNumber(stats.totalTokens) }}
      </span>
      <span
        class="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      >
        平均耗时: {{ formatNumber(stats.avgDuration) }}ms
      </span>
    </div>

    <!-- 提示选择API Key -->
    <div v-if="!filters.apiKeyId" class="card flex items-center justify-center py-12 text-center">
      <div>
        <i class="fas fa-key mb-4 text-4xl text-gray-400 dark:text-gray-500"></i>
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">请选择API Key</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          请在上方筛选器中选择一个API Key来查看请求历史记录
        </p>
      </div>
    </div>

    <!-- 请求列表表格（主要内容） -->
    <div v-else class="space-y-4">
      <RequestTable
        :loading="loading"
        :requests="requests"
        @delete-request="deleteRequest"
        @view-details="openDetailsModal"
      />

      <!-- 分页控件 -->
      <div
        v-if="requests.length > 0 || pagination.total > 0"
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <!-- 左侧：每页显示条数选择器 -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">每页显示：</span>
          <select
            v-model="pagination.pageSize"
            class="rounded-md border-gray-300 bg-white text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            @change="handlePageSizeChange(pagination.pageSize)"
          >
            <option v-for="size in pagination.pageSizeOptions" :key="size" :value="size">
              {{ size }} 条
            </option>
          </select>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            <template v-if="pagination.total > 0"> 共 {{ pagination.total }} 条记录 </template>
            <template v-else> 当前页 {{ requests.length }} 条记录 </template>
          </span>
        </div>

        <!-- 右侧：分页导航 -->
        <div class="flex items-center gap-2">
          <!-- 上一页按钮 -->
          <button
            class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="pagination.currentPage <= 1"
            @click="handlePageChange(pagination.currentPage - 1)"
          >
            <i class="fas fa-chevron-left mr-1"></i>
            上一页
          </button>

          <!-- 页码按钮 -->
          <div class="flex gap-1">
            <!-- 第一页 -->
            <button
              v-if="pagination.currentPage > 3"
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="handlePageChange(1)"
            >
              1
            </button>
            <span v-if="pagination.currentPage > 4" class="flex items-center px-2 text-gray-500"
              >...</span
            >

            <!-- 当前页前后的页码 -->
            <button
              v-for="page in getVisiblePages()"
              :key="page"
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium"
              :class="[
                page === pagination.currentPage
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              ]"
              @click="handlePageChange(page)"
            >
              {{ page }}
            </button>

            <!-- 最后一页 -->
            <span
              v-if="pagination.currentPage < totalPages - 3"
              class="flex items-center px-2 text-gray-500"
              >...</span
            >
            <button
              v-if="pagination.currentPage < totalPages - 2"
              class="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="handlePageChange(totalPages)"
            >
              {{ totalPages }}
            </button>
          </div>

          <!-- 下一页按钮 -->
          <button
            class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="pagination.currentPage >= totalPages"
            @click="handlePageChange(pagination.currentPage + 1)"
          >
            下一页
            <i class="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 配置弹窗 -->
    <div
      v-if="showConfigModal"
      aria-labelledby="modal-title"
      aria-modal="true"
      class="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
    >
      <div
        class="flex min-h-screen items-center justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
      >
        <!-- 背景遮罩 -->
        <div
          aria-hidden="true"
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"
          @click="closeConfigModal"
        ></div>

        <!-- 弹窗内容 -->
        <div
          class="inline-block w-full max-w-2xl transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:align-middle"
        >
          <!-- 弹窗头部 -->
          <div
            class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
          >
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">请求历史记录配置</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                管理请求历史记录的存储和性能参数
              </p>
            </div>
            <button
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              @click="closeConfigModal"
            >
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>

          <!-- 弹窗内容 -->
          <div class="px-6 py-4">
            <!-- 配置加载中 -->
            <div v-if="configLoading" class="flex items-center justify-center py-8">
              <div class="flex items-center space-x-2">
                <i class="fas fa-spinner fa-spin text-blue-500"></i>
                <span class="text-gray-600 dark:text-gray-300">加载配置中...</span>
              </div>
            </div>

            <!-- 配置表单 -->
            <form v-else class="space-y-6" @submit.prevent="saveConfig">
              <div class="space-y-6">
                <!-- 启用历史记录 -->
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      启用请求历史记录
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      是否记录API请求的详细信息
                    </p>
                  </div>
                  <div class="flex-shrink-0">
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        v-model="configForm.enableHistoryLogging"
                        class="sr-only"
                        type="checkbox"
                      />
                      <div
                        :class="[
                          'h-6 w-11 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                          configForm.enableHistoryLogging
                            ? 'bg-blue-500'
                            : 'bg-gray-200 dark:bg-gray-600'
                        ]"
                      >
                        <span
                          :class="[
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                            configForm.enableHistoryLogging ? 'translate-x-5' : 'translate-x-0'
                          ]"
                        ></span>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- 最大记录数 -->
                <div class="flex items-center justify-between">
                  <div class="flex-1 pr-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      每个API Key最大记录数
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      每个API Key最多保留的历史记录数量（1-5000）
                    </p>
                  </div>
                  <div class="w-32 flex-shrink-0">
                    <input
                      v-model.number="configForm.maxRecordsPerKey"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      max="5000"
                      min="1"
                      type="number"
                    />
                  </div>
                </div>

                <!-- 最大请求体大小 -->
                <div class="flex items-center justify-between">
                  <div class="flex-1 pr-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      最大请求体大小 (字符)
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      请求体超过此大小将被截断以节省存储空间
                    </p>
                  </div>
                  <div class="w-32 flex-shrink-0">
                    <input
                      v-model.number="configForm.maxRequestBodySize"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      min="100"
                      type="number"
                    />
                  </div>
                </div>

                <!-- 最大响应体大小 -->
                <div class="flex items-center justify-between">
                  <div class="flex-1 pr-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      最大响应体大小 (字符)
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      响应体超过此大小将被截断以节省存储空间
                    </p>
                  </div>
                  <div class="w-32 flex-shrink-0">
                    <input
                      v-model.number="configForm.maxResponseBodySize"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      min="100"
                      type="number"
                    />
                  </div>
                </div>
              </div>

              <!-- 弹窗底部按钮 -->
              <div
                class="flex justify-end space-x-3 border-t border-gray-200 pt-4 dark:border-gray-700"
              >
                <button class="btn btn-secondary plr-8" type="button" @click="closeConfigModal">
                  关闭
                </button>
                <button
                  class="btn btn-primary plr-8 flex items-center gap-2"
                  :disabled="configSaving"
                  type="submit"
                >
                  <i v-if="configSaving" class="fas fa-spinner fa-spin"></i>
                  <i v-else class="fas fa-save"></i>
                  {{ configSaving ? '保存中...' : '保存配置' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- 请求详情模态框 -->
    <RequestDetailsModal
      v-if="showDetailsModal"
      :request="selectedRequest"
      @close="closeDetailsModal"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { showToast } from '@/utils/toast'
import { apiClient } from '@/config/api'
import RequestFilters from '@/components/requestHistory/RequestFilters.vue'
import RequestTable from '@/components/requestHistory/RequestTable.vue'
import RequestDetailsModal from '@/components/requestHistory/RequestDetailsModal.vue'

// 响应式数据
const loading = ref(false)
const statsLoading = ref(false)
const requests = ref([])
const stats = ref({
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  totalTokens: 0,
  avgDuration: 0,
  modelStats: {},
  statusStats: {}
})

// 配置相关
const showConfigModal = ref(false)
const configLoading = ref(false)
const configSaving = ref(false)
const configForm = reactive({
  enableHistoryLogging: true,
  maxRecordsPerKey: 1000,
  maxRequestBodySize: 5000,
  maxResponseBodySize: 10000
})

// 分页相关
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0,
  pageSizeOptions: [10, 20, 30]
})

const totalPages = computed(() => {
  if (pagination.total > 0) {
    return Math.ceil(pagination.total / pagination.pageSize)
  }
  // 如果没有total，根据当前页和数据量推测
  if (requests.value.length === pagination.pageSize) {
    // 如果当前页满了，可能还有下一页
    return pagination.currentPage + 1
  } else {
    // 如果当前页没满，这就是最后一页
    return pagination.currentPage
  }
})

// 获取可见的页码范围
const getVisiblePages = () => {
  const current = pagination.currentPage
  const total = totalPages.value
  const range = []

  // 显示当前页前后最多2页
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)

  for (let i = start; i <= end; i++) {
    range.push(i)
  }

  return range
}

// 计算属性
const successRate = computed(() => {
  if (stats.value.totalRequests === 0) return 0
  return Math.round((stats.value.successRequests / stats.value.totalRequests) * 100)
})

// 格式化数字
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 筛选器
const filters = reactive({
  apiKeyId: '',
  dateRange: null
})

// 模态框相关
const showDetailsModal = ref(false)
const selectedRequest = ref(null)

// API调用
const api = {
  async getRequestHistory(params = {}) {
    const requestParams = {
      limit: params.limit || pagination.pageSize,
      offset: params.offset || (pagination.currentPage - 1) * pagination.pageSize
    }

    // 只保留apiKeyId和时间查询参数
    if (filters.apiKeyId) requestParams.apiKeyId = filters.apiKeyId
    if (filters.dateRange && filters.dateRange.length === 2) {
      requestParams.startTime = filters.dateRange[0]
      requestParams.endTime = filters.dateRange[1]
    }

    return await apiClient.get('/admin/request-history', { params: requestParams })
  },

  async getRequestStats() {
    const requestParams = {}

    // 只保留apiKeyId和时间查询参数
    if (filters.apiKeyId) requestParams.apiKeyId = filters.apiKeyId
    if (filters.dateRange && filters.dateRange.length === 2) {
      requestParams.startTime = filters.dateRange[0]
      requestParams.endTime = filters.dateRange[1]
    }

    return await apiClient.get('/admin/request-stats', { params: requestParams })
  },

  async getRequestDetails(requestId) {
    return await apiClient.get(`/admin/request-history/${requestId}`)
  },

  async deleteRequest(requestId) {
    return await apiClient.delete(`/admin/request-history/${requestId}`)
  },

  // 配置相关API
  async getConfig() {
    return await apiClient.get('/admin/request-history/config')
  },

  async updateConfig(config) {
    return await apiClient.put('/admin/request-history/config', config)
  }
}

// 加载数据
const loadRequests = async () => {
  // 如果没有选择API Key，清空数据
  if (!filters.apiKeyId) {
    requests.value = []
    pagination.total = 0
    pagination.currentPage = 1
    return
  }

  try {
    loading.value = true
    const params = {
      limit: pagination.pageSize,
      offset: (pagination.currentPage - 1) * pagination.pageSize
    }

    const response = await api.getRequestHistory(params)

    if (response.success) {
      requests.value = response.data.history
      // 处理后端返回的分页信息
      if (response.data.total !== undefined) {
        pagination.total = response.data.total
      } else if (response.data.hasMore !== undefined) {
        // 如果没有total但有hasMore，我们基于hasMore来推测
        if (!response.data.hasMore && requests.value.length < pagination.pageSize) {
          // 如果没有更多数据且当前页不满，计算total
          pagination.total =
            (pagination.currentPage - 1) * pagination.pageSize + requests.value.length
        }
      }
    } else {
      showToast(response.message || '加载失败', 'error')
    }
  } catch (error) {
    console.error('加载请求历史失败:', error)
    showToast('加载请求历史失败', 'error')
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  // 如果没有选择API Key，清空统计数据
  if (!filters.apiKeyId) {
    stats.value = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      avgDuration: 0,
      modelStats: {},
      statusStats: {}
    }
    return
  }

  try {
    statsLoading.value = true
    const response = await api.getRequestStats()

    if (response.success) {
      // 根据后端返回的数据结构调整
      stats.value = response.data.stats || response.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  } finally {
    statsLoading.value = false
  }
}

// 事件处理
const handleFiltersChange = (newFilters) => {
  console.log('Parent handleFiltersChange called:', newFilters)
  // 更新本地筛选器
  Object.assign(filters, newFilters)
  // 重置分页
  pagination.currentPage = 1
  // 重新加载数据
  loadRequests()
  loadStats()
}

// 分页事件处理
const handlePageChange = (page) => {
  pagination.currentPage = page
  loadRequests()
}

const handlePageSizeChange = (newPageSize) => {
  pagination.pageSize = newPageSize
  pagination.currentPage = 1
  loadRequests()
}

const refresh = () => {
  loadRequests()
  loadStats()
}

const openDetailsModal = async (request) => {
  try {
    const response = await api.getRequestDetails(request.requestId)
    if (response.success) {
      selectedRequest.value = response.data
      showDetailsModal.value = true
    }
  } catch (error) {
    console.error('获取请求详情失败:', error)
    showToast('获取请求详情失败', 'error')
  }
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedRequest.value = null
}

const deleteRequest = async (request) => {
  if (!confirm('确定要删除这条请求记录吗？此操作不可恢复。')) {
    return
  }

  try {
    const response = await api.deleteRequest(request.requestId)
    if (response.success) {
      // 从列表中移除
      const index = requests.value.findIndex((r) => r.requestId === request.requestId)
      if (index > -1) {
        requests.value.splice(index, 1)
      }
      showToast('删除成功', 'success')
      // 刷新统计
      loadStats()
    } else {
      showToast(response.message || '删除失败', 'error')
    }
  } catch (error) {
    console.error('删除请求失败:', error)
    showToast('删除请求失败', 'error')
  }
}

// 配置管理方法
const openConfigModal = async () => {
  showConfigModal.value = true
  await loadConfig()
}

const closeConfigModal = () => {
  showConfigModal.value = false
}

const loadConfig = async () => {
  try {
    configLoading.value = true
    const response = await api.getConfig()
    if (response.success) {
      // 更新表单数据
      Object.assign(configForm, response.data)
    } else {
      showToast(response.message || '加载配置失败', 'error')
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    showToast('加载配置失败', 'error')
  } finally {
    configLoading.value = false
  }
}

const saveConfig = async () => {
  try {
    configSaving.value = true

    // 构建配置对象，使用后端期望的字段名
    const configData = {
      enableLogging: configForm.enableHistoryLogging,
      maxRecordsPerKey: configForm.maxRecordsPerKey,
      maxRequestBodySize: configForm.maxRequestBodySize,
      maxResponseBodySize: configForm.maxResponseBodySize
    }

    const response = await api.updateConfig(configData)
    if (response.success) {
      showToast('配置保存成功', 'success')
      // 重新加载配置以确保同步
      await loadConfig()
      // 关闭弹窗
      closeConfigModal()
    } else {
      showToast(response.message || '保存配置失败', 'error')
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    showToast('保存配置失败', 'error')
  } finally {
    configSaving.value = false
  }
}

// 生命周期
onMounted(() => {
  // 初始化时不自动加载数据，等用户选择API Key后再加载
  loadRequests()
  loadStats()
})
</script>
