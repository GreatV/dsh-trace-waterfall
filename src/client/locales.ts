/** Copy owned by the waterfall plugin; the host supplies locale fallback. */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'trace-waterfall'
export const en = {
  title: 'Trace', subtitle: 'Every step, on one timeline',
  search: 'Search steps, tools, or output…', clear: 'Clear search',
  duration: 'Duration', tokens: 'Tokens', llmCalls: 'LLM calls', toolCalls: 'Tool calls', errors: 'Errors',
  steps: 'Steps', timeline: 'Trace timeline', all: 'All steps', onlyErrors: 'Errors only',
  expandAll: 'Expand all', collapseAll: 'Collapse all', expand: 'Expand {name}', collapse: 'Collapse {name}',
  turn: 'Turn {number}', step: 'Step {number}', llm: 'Model request', tool: 'Tool call',
  compaction: 'Compaction', message: 'User message', context: 'Context', system: 'System prompt',
  running: 'Running', complete: 'Complete', error: 'Error', live: 'Live',
  empty: 'No trace yet', emptyHint: 'Run a prompt to see model requests and tool calls here.',
  noMatches: 'No matching steps', noMatchesHint: 'Try another search or clear the filters.',
  close: 'Close details', details: 'Span details', input: 'Input', output: 'Output', metadata: 'Metadata',
  status: 'Status', start: 'Start offset', model: 'Model', provider: 'Provider',
  inputTokens: 'Uncached input tokens', outputTokens: 'Output tokens', cacheTokens: 'Cached input tokens',
  reasoningTokens: 'Reasoning tokens', firstToken: 'Time to first token', retries: 'Retries',
  unavailable: '—', unknownTiming: 'The start of this span is outside loaded history.',
  noPayload: 'No recorded content', pending: 'Waiting for output…',
  loadOlder: 'Load earlier history', loading: 'Loading…', historyError: 'Could not load history. {reason}',
  retry: 'Retry', fit: 'Fit timeline', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  shown: '{shown} of {total} steps', loaded: 'Loaded history',
  copy: 'Copy', copied: 'Copied', copyError: 'Could not copy. Select and copy the text below.',
  interrupted: 'The request was interrupted.', inspect: 'Inspect {name}',
  cacheRate: '{value}% cache', cacheWriteTokens: 'Cache write tokens', sessionUsage: 'Whole session usage',
  waiting: 'Waiting', nested: 'Handoff', failed: 'Failed', legend: 'Timeline legend',
  idle: '{duration} idle', focus: 'Focus {name}', errorCount: '{count} recovered or failed operations',
  overview: 'Session overview', overviewHint: 'Drag to select a time range. Double-click to reset.',
  inputLane: 'Input', modelLane: 'Model', toolLane: 'Tools', resizeLabels: 'Resize label column',
  rangeStart: 'From {time}',
  summary: 'Span summary', fullDetails: 'Full details', source: 'Source', throughput: 'Throughput', firstTokenShort: 'TTFT',
  newInput: 'New input', noNewInput: 'No new input in loaded history',
  attachments: 'Attachments', image: 'Image', file: 'File', imagePreview: 'Toggle image preview', imageFailed: 'Image unavailable',
} as const
export type TraceKey = keyof typeof en
export type TraceTranslate = Translate<TraceKey>
export const zh: Record<TraceKey, string> = {
  title: '追踪', subtitle: '在同一时间线上查看每一步',
  search: '搜索步骤、工具或输出…', clear: '清除搜索',
  duration: '总耗时', tokens: 'Token 数', llmCalls: '模型调用', toolCalls: '工具调用', errors: '错误',
  steps: '步骤', timeline: '追踪时间线', all: '全部步骤', onlyErrors: '仅看错误',
  expandAll: '全部展开', collapseAll: '全部折叠', expand: '展开 {name}', collapse: '折叠 {name}',
  turn: '第 {number} 轮', step: '第 {number} 步', llm: '模型请求', tool: '工具调用',
  compaction: '上下文压缩', message: '用户消息', context: '上下文', system: '系统提示词',
  running: '运行中', complete: '已完成', error: '错误', live: '实时',
  empty: '暂无追踪记录', emptyHint: '发送一条消息，即可在此查看模型请求和工具调用。',
  noMatches: '没有匹配的步骤', noMatchesHint: '尝试其他搜索词或清除筛选条件。',
  close: '关闭详情', details: '步骤详情', input: '输入', output: '输出', metadata: '元数据',
  status: '状态', start: '开始偏移', model: '模型', provider: '提供商',
  inputTokens: '未缓存输入 Token', outputTokens: '输出 Token', cacheTokens: '缓存输入 Token',
  reasoningTokens: '推理 Token', firstToken: '首 Token 延迟', retries: '重试次数',
  unavailable: '—', unknownTiming: '此步骤的起始记录不在已加载的历史中。',
  noPayload: '没有记录内容', pending: '等待输出…',
  loadOlder: '加载更早的历史', loading: '加载中…', historyError: '无法加载历史。{reason}',
  retry: '重试', fit: '适应时间线', zoomIn: '放大', zoomOut: '缩小',
  shown: '{shown} / {total} 个步骤', loaded: '已加载的历史',
  copy: '复制', copied: '已复制', copyError: '无法复制，请选中下方文本手动复制。',
  interrupted: '请求已中断。', inspect: '查看 {name}',
  cacheRate: '缓存 {value}%', cacheWriteTokens: '缓存写入 Token', sessionUsage: '整个会话的用量',
  waiting: '等待', nested: '子代理 / 嵌套', failed: '失败', legend: '时间线图例',
  idle: '{duration} 空闲', focus: '聚焦 {name}', errorCount: '{count} 个已恢复或失败的操作',
  overview: '会话概览', overviewHint: '拖选时间范围，双击恢复全貌。',
  inputLane: '输入', modelLane: '模型', toolLane: '工具', resizeLabels: '调整标签列宽度',
  rangeStart: '从 {time} 起',
  summary: '步骤摘要', fullDetails: '完整详情', source: '源码', throughput: '吞吐', firstTokenShort: '首 token',
  newInput: '新增输入', noNewInput: '当前历史中没有新增输入记录',
  attachments: '附件', image: '图片', file: '文件', imagePreview: '切换图片预览', imageFailed: '无法加载图片',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'trace-waterfall': TraceKey }
}
