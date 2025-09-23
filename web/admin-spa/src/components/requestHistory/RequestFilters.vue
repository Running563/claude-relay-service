<template>
  <div class="filter-container">
    <!-- 紧凑的标题栏 -->
    <div
      class="flex items-center justify-between border-b border-gray-200/60 pb-2 dark:border-gray-700/60"
    >
      <h3 class="text-sm font-medium text-gray-900 dark:text-white">筛选条件</h3>
      <button class="clear-button" title="清空所有筛选条件" @click="clearFilters">
        <i class="fas fa-times"></i>
        清空
      </button>
    </div>

    <!-- 紧凑统一的筛选器布局 -->
    <div class="filter-grid">
      <!-- API Key筛选 -->
      <div class="filter-item">
        <label class="filter-label">API Key</label>
        <select
          v-model="localFilters.apiKeyId"
          class="filter-input compact"
          @change="handleFilterChange"
        >
          <option value="">选择API Key</option>
          <option v-for="apiKey in availableApiKeys" :key="apiKey.id" :value="apiKey.id">
            {{ apiKey.name }}
          </option>
        </select>
      </div>

      <!-- 时间范围和快捷选择 -->
      <div class="filter-item date-range-section">
        <!-- 自定义时间输入放在上方 -->
        <div class="date-inputs">
          <div class="date-input-wrapper">
            <label class="date-input-label">开始时间</label>
            <input
              v-model="customDateStart"
              class="filter-input date-input compact"
              placeholder="年/月/日 --:--"
              type="datetime-local"
              @change="updateCustomDateRange"
              @input="updateCustomDateRange"
            />
          </div>
          <span class="date-separator">至</span>
          <div class="date-input-wrapper">
            <label class="date-input-label">结束时间</label>
            <input
              v-model="customDateEnd"
              class="filter-input date-input compact"
              placeholder="年/月/日 --:--"
              type="datetime-local"
              @change="updateCustomDateRange"
              @input="updateCustomDateRange"
            />
          </div>
        </div>
        <!-- 快捷按钮放在下方 -->
        <div>
          <label class="date-input-label">&nbsp;</label>
          <div class="quick-shortcuts">
            <button
              v-for="preset in datePresets"
              :key="preset.value"
              class="quick-button"
              :class="{ active: isPresetActive(preset) }"
              @click="selectDatePreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 活跃筛选器显示 -->
    <div v-if="activeFiltersCount > 0" class="active-filters">
      <span class="active-label">已选:</span>
      <div class="active-tags">
        <span v-for="filter in activeFilters" :key="filter.key" class="active-tag">
          {{ filter.label }}
          <button
            class="remove-tag"
            :title="`移除 ${filter.label}`"
            @click="removeFilter(filter.key)"
          >
            <i class="fas fa-times"></i>
          </button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { apiClient } from '@/config/api'

const props = defineProps({
  filters: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:filters'])

// 北京时区工具函数
const getBeijingTime = () => {
  // 获取当前时间，并转换为北京时间
  const now = new Date()
  // 计算当前UTC时间
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  // 加上北京时区偏移 (UTC+8)
  const beijingTime = new Date(utc + 8 * 3600000)
  return beijingTime
}

const formatToBeijingTimeString = (date) => {
  // 直接使用北京时间的年月日时分格式化
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const parseBeijingTimeString = (timeStr) => {
  // 将 datetime-local 的值解析为正确的UTC时间戳
  if (!timeStr) return null

  // 解析时间字符串
  const [datePart, timePart] = timeStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)

  // 创建北京时间的Date对象 (年月日时分都按北京时间理解)
  const beijingDate = new Date(year, month - 1, day, hours, minutes, 0, 0)

  // 转换为UTC时间 (减去8小时的偏移)
  const utcTime = beijingDate.getTime() - 8 * 3600000

  return new Date(utcTime)
}

// 响应式数据
const localFilters = reactive({ ...props.filters })
const customDateStart = ref('')
const customDateEnd = ref('')

// API Keys选项
const availableApiKeys = ref([])

// 日期预设选项
const datePresets = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: '7days' },
  { label: '近30天', value: '30days' }
]

// 计算属性
const activeFilters = computed(() => {
  const filters = []
  if (localFilters.apiKeyId) {
    const apiKey = availableApiKeys.value.find((k) => k.id === localFilters.apiKeyId)
    filters.push({
      key: 'apiKeyId',
      label: `${apiKey?.name || localFilters.apiKeyId}`
    })
  }
  if (localFilters.dateRange && localFilters.dateRange.length === 2) {
    const [start, end] = localFilters.dateRange
    filters.push({
      key: 'dateRange',
      label: `${formatDateShort(new Date(start))} 至 ${formatDateShort(new Date(end))}`
    })
  }
  return filters
})

const activeFiltersCount = computed(() => activeFilters.value.length)

// 方法
const loadApiKeys = async () => {
  try {
    const response = await apiClient.get('/admin/api-keys')
    if (response.success) {
      availableApiKeys.value = response.data || []
    }
  } catch (error) {
    console.error('加载API Keys失败:', error)
  }
}

const handleFilterChange = () => {
  emit('update:filters', { ...localFilters })
}

const clearFilters = () => {
  localFilters.apiKeyId = ''
  localFilters.dateRange = null
  customDateStart.value = ''
  customDateEnd.value = ''
  handleFilterChange()
}

const removeFilter = (key) => {
  if (key === 'apiKeyId') localFilters.apiKeyId = ''
  else if (key === 'dateRange') {
    localFilters.dateRange = null
    customDateStart.value = ''
    customDateEnd.value = ''
  }
  handleFilterChange()
}

const selectDatePreset = (preset) => {
  // 获取当前北京时间
  const beijingNow = getBeijingTime()

  let startTime, endTime

  switch (preset.value) {
    case 'today':
      // 今天 00:00:00 到 23:59:59 (北京时间)
      startTime = new Date(beijingNow)
      startTime.setHours(0, 0, 0, 0)
      endTime = new Date(beijingNow)
      endTime.setHours(23, 59, 59, 999)
      break
    case 'yesterday':
      // 昨天 00:00:00 到 23:59:59 (北京时间)
      startTime = new Date(beijingNow)
      startTime.setDate(startTime.getDate() - 1)
      startTime.setHours(0, 0, 0, 0)
      endTime = new Date(beijingNow)
      endTime.setDate(endTime.getDate() - 1)
      endTime.setHours(23, 59, 59, 999)
      break
    case '7days':
      // 最近7天：7天前的00:00:00 到现在 (北京时间)
      startTime = new Date(beijingNow)
      startTime.setDate(startTime.getDate() - 6)
      startTime.setHours(0, 0, 0, 0)
      endTime = new Date(beijingNow)
      break
    case '30days':
      // 最近30天：30天前的00:00:00 到现在 (北京时间)
      startTime = new Date(beijingNow)
      startTime.setDate(startTime.getDate() - 29)
      startTime.setHours(0, 0, 0, 0)
      endTime = new Date(beijingNow)
      break
  }

  // 更新日期输入框的值 - 显示北京时间
  customDateStart.value = formatToBeijingTimeString(startTime)
  customDateEnd.value = formatToBeijingTimeString(endTime)

  // 转换为正确的UTC时间戳用于后端API
  const startUtc = parseBeijingTimeString(customDateStart.value)
  const endUtc = parseBeijingTimeString(customDateEnd.value)

  if (startUtc && endUtc) {
    localFilters.dateRange = [startUtc.getTime(), endUtc.getTime()]
    handleFilterChange()
  }
}

const updateCustomDateRange = () => {
  if (customDateStart.value && customDateEnd.value) {
    // 将输入的北京时间转换为正确的时间戳
    const start = parseBeijingTimeString(customDateStart.value)
    const end = parseBeijingTimeString(customDateEnd.value)

    // 确保开始时间不晚于结束时间
    if (start && end && start <= end) {
      localFilters.dateRange = [start.getTime(), end.getTime()]
    }
  } else if (!customDateStart.value && !customDateEnd.value) {
    localFilters.dateRange = null
  } else if (customDateStart.value && !customDateEnd.value) {
    // 只有开始时间，设置结束时间为当前北京时间
    const start = parseBeijingTimeString(customDateStart.value)
    const end = getBeijingTime() // 当前北京时间
    if (start) {
      localFilters.dateRange = [start.getTime(), end.getTime()]
    }
  } else if (!customDateStart.value && customDateEnd.value) {
    // 只有结束时间，设置开始时间为7天前
    const end = parseBeijingTimeString(customDateEnd.value)
    if (end) {
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000) // 7天前
      localFilters.dateRange = [start.getTime(), end.getTime()]
    }
  }

  handleFilterChange()
}

const formatDateShort = (date) => {
  // 将UTC时间戳转换为北京时间显示
  const beijingTime = new Date(date.getTime() + 8 * 3600000)
  return beijingTime.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const isPresetActive = (preset) => {
  if (!localFilters.dateRange || localFilters.dateRange.length !== 2) {
    return false
  }

  // 简单的时间范围匹配判断
  const [startTimestamp, endTimestamp] = localFilters.dateRange
  const start = new Date(startTimestamp)
  const end = new Date(endTimestamp)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset.value) {
    case 'today':
      return start.getTime() === today.getTime() && end.getHours() === 23 && end.getMinutes() === 59
    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      return start.getTime() === yesterday.getTime() && end.getDate() === yesterday.getDate()
    }
    case '7days': {
      const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
      return start.getTime() === sevenDaysAgo.getTime()
    }
    case '30days': {
      const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
      return start.getTime() === thirtyDaysAgo.getTime()
    }
    default:
      return false
  }
}

// 监听props变化
watch(
  () => props.filters,
  (newFilters) => {
    Object.assign(localFilters, newFilters)
    // 同步日期输入框的值 - 使用北京时间格式
    if (newFilters.dateRange && newFilters.dateRange.length === 2) {
      // 将UTC时间戳转换为北京时间显示
      const startUtc = new Date(newFilters.dateRange[0])
      const endUtc = new Date(newFilters.dateRange[1])

      // 转换为北京时间后格式化
      const startBeijing = new Date(startUtc.getTime() + 8 * 3600000)
      const endBeijing = new Date(endUtc.getTime() + 8 * 3600000)

      customDateStart.value = formatToBeijingTimeString(startBeijing)
      customDateEnd.value = formatToBeijingTimeString(endBeijing)
    } else {
      customDateStart.value = ''
      customDateEnd.value = ''
    }
  },
  { deep: true }
)

// 生命周期
onMounted(() => {
  loadApiKeys()
})
</script>

<style scoped>
/* 主容器 */
.filter-container {
  @apply rounded-xl border border-gray-200/60 bg-white/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md;
  @apply dark:border-gray-700/60 dark:bg-gray-800/90;
}

/* 清空按钮 */
.clear-button {
  @apply flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600;
  @apply dark:text-gray-400 dark:hover:bg-red-950/20 dark:hover:text-red-400;
}

/* 筛选器网格布局 */
.filter-grid {
  @apply mt-3 grid grid-cols-1 gap-3 md:grid-cols-3;
}

/* 筛选项 */
.filter-item {
  @apply space-y-1;
}

.filter-item.date-range-section {
  @apply md:col-span-2;
  display: flex;
  gap: 10px;
}

/* 筛选标签 */
.filter-label {
  @apply block text-xs font-medium text-gray-700 dark:text-gray-300;
}

.timezone-hint {
  @apply ml-1 text-xs font-normal text-gray-500 dark:text-gray-400;
}

/* 统一的输入框样式 */
.filter-input {
  @apply w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors;
  @apply focus:border-blue-500 focus:ring-1 focus:ring-blue-500;
  @apply dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400;
  @apply dark:focus:border-blue-400 dark:focus:ring-blue-400;
}

.filter-input.compact {
  @apply px-2 py-1.5 text-xs;
}

/* 日期范围容器 */
.date-range-container {
  @apply space-y-3;
}

/* 日期输入框容器 */
.date-inputs {
  @apply flex items-end gap-2;
  width: 400px;
}

.date-input-wrapper {
  @apply min-w-0 flex-1 space-y-1;
}

.date-input-label {
  @apply block text-xs font-medium text-gray-600 dark:text-gray-400;
}

.date-input {
  @apply w-full min-w-0;
}

.date-separator {
  @apply mb-1 px-1 text-xs font-medium text-gray-500 dark:text-gray-400;
}

/* 快捷按钮容器 */
.quick-shortcuts {
  @apply flex flex-wrap gap-1;
  padding-top: 4px;
}

/* 快捷按钮样式 */
.quick-button {
  @apply rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800;
  @apply dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200;
}

.quick-button.active {
  @apply border border-blue-200 bg-blue-100 text-blue-800;
  @apply dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300;
}

/* 活跃筛选器 */
.active-filters {
  @apply mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200/50 pt-2 dark:border-gray-700/50;
}

.active-label {
  @apply text-xs font-medium text-gray-500 dark:text-gray-400;
}

.active-tags {
  @apply flex flex-wrap gap-1;
}

.active-tag {
  @apply inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800;
  @apply dark:bg-blue-900/30 dark:text-blue-300;
}

.remove-tag {
  @apply transition-colors hover:text-blue-600 dark:hover:text-blue-400;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-grid {
    @apply grid-cols-1;
  }

  .filter-item.date-range-section {
    @apply col-span-1;
  }

  .date-inputs {
    @apply flex-col gap-3;
  }

  .date-input-wrapper {
    @apply w-full;
  }

  .date-separator {
    @apply hidden;
  }

  .date-range-container {
    @apply space-y-3;
  }

  .quick-shortcuts {
    @apply grid w-full grid-cols-2 gap-1;
  }

  .quick-button {
    @apply text-center;
  }
}
</style>
