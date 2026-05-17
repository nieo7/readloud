<template>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <div class="header-emoji">🎵</div>
        <h1>英文文字朗讀工具</h1>
      </div>
      <p>貼上英文文字，點擊按鈕可聆聽清晰的英文朗讀</p>
    </div>

    <div class="main-grid">
      <!-- 左側：控制面板 -->
      <div class="panel">
        <div class="panel-title">控制面板</div>

        <!-- 文字輸入 -->
        <div class="form-group">
          <label>輸入英文文字</label>
          <textarea
            v-model="text"
            :disabled="isPlaying"
            placeholder="在此貼上或輸入英文文字..."
          />
          <div style="font-size: 12px; color: #999; margin-top: 6px;">
            字數：{{ text.length }} | 句子：{{ sentences.length }}
          </div>
        </div>

        <!-- 語音選擇 -->
        <div class="form-group">
          <label>語音選擇</label>
          <select v-model="selectedVoiceName" :disabled="isPlaying">
            <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
              {{ getVoiceDisplayName(voice) }}
            </option>
          </select>
        </div>

        <!-- 語速和音量 -->
        <div class="sliders-grid">
          <div class="form-group">
            <label>
              語速
              <span v-if="isPlaying" style="font-size: 11px; color: #999;">(朗讀中不可調整)</span>
            </label>
            <div class="slider-container">
              <input
                v-model.number="speechRate"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                :disabled="isPlaying"
              />
              <span class="value">{{ speechRate.toFixed(1) }}x</span>
            </div>
          </div>

          <div class="form-group">
            <label>
              音量
              <span v-if="isPlaying" style="font-size: 11px; color: #999;">(朗讀中不可調整)</span>
            </label>
            <div class="slider-container">
              <input
                v-model.number="volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                :disabled="isPlaying"
              />
              <span class="value">{{ Math.round(volume * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- 按鈕 -->
        <div class="button-group">
          <button
            v-if="!isPlaying"
            @click="handleSpeak"
            :disabled="!text.trim()"
            class="btn-primary"
          >
            ▶ {{ isPaused ? '繼續朗讀' : '開始朗讀' }}
          </button>
          <template v-else>
            <button @click="handlePause" class="btn-warning">⏸ 暫停</button>
            <button @click="handleStop" class="btn-secondary">⏹ 停止</button>
          </template>

          <button @click="handleClear" :disabled="isPlaying" class="btn-outline">清空</button>
        </div>

        <!-- 提示 -->
        <div class="info-box">
          <strong>💡 提示：</strong> 朗讀時，正在朗讀的句子下方會顯示綠色底線。進度區域會自動捲動到當前朗讀位置。
        </div>
      </div>

      <!-- 右側：朗讀進度 -->
      <div class="panel">
        <div class="panel-title">朗讀進度</div>
        <div ref="textContainerRef" class="progress-container">
          <div v-if="text.trim()">
            <span
              v-for="(sentence, index) in sentences"
              :key="index"
              class="sentence-token"
              :class="{ active: index === currentSentenceIndex }"
            >
              {{ sentence }}
            </span>
          </div>
          <div v-else class="empty-state">輸入文字後，朗讀進度將顯示在此</div>
        </div>
        <div v-if="sentences.length > 0" class="progress-info">
          進度：{{ currentSentenceIndex >= 0 ? currentSentenceIndex + 1 : 0 }} / {{ sentences.length }} 個句子
        </div>
      </div>
    </div>

    <div class="footer">使用 Web Speech API 提供的語音合成功能 v.b605.05</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

// 狀態
const text = ref('')
const speechRate = ref(1)
const volume = ref(1)
const isPlaying = ref(false)
const isPaused = ref(false)
const currentSentenceIndex = ref(-1)
const selectedVoiceName = ref('')
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const sentences = ref<string[]>([])

// Refs
const textContainerRef = ref<HTMLElement>()
const synth = ref<SpeechSynthesis>(window.speechSynthesis)
const isPlayingRef = ref(false)
const isPausedRef = ref(false)

// 句子分割函數
const splitSentences = (text: string): string[] => {
  if (!text.trim()) return []
  const sentenceRegex = /[^.!?]*[.!?]+/g
  const matches = text.match(sentenceRegex) || []
  return matches.map(s => s.trim()).filter(s => s.length > 0)
}

// 監聽文字變化
watch(text, (newText) => {
  sentences.value = splitSentences(newText)
})

// 獲取語音顯示名稱
const getVoiceDisplayName = (voice: SpeechSynthesisVoice): string => {
  const name = voice.name || 'Unknown'
  const lang = voice.lang || ''

  // 判斷性別
  let gender = ''
  if (name.toLowerCase().includes('male')) {
    gender = '(男聲)'
  } else if (name.toLowerCase().includes('female')) {
    gender = '(女聲)'
  }

  // 判斷地區
  let region = ''
  if (lang.includes('en-US')) {
    region = '美式'
  } else if (lang.includes('en-GB')) {
    region = '英式'
  }

  // 組合顯示名稱
  const parts = [name]
  if (gender) parts.push(gender)
  if (region) parts.push(region)

  return parts.join(' ')
}

// 初始化語音列表
const initializeVoices = () => {
  const voices = synth.value.getVoices()
  const englishVoices = voices.filter(v => v.lang.startsWith('en-'))

  // 排序優先級：US 女聲 > US 男聲 > UK 女聲 > UK 男聲 > 其他
  const sorted = englishVoices.sort((a, b) => {
    const aIsUS = a.lang === 'en-US' || a.lang.startsWith('en-US')
    const bIsUS = b.lang === 'en-US' || b.lang.startsWith('en-US')
    const aIsFemale = a.name.toLowerCase().includes('female')
    const bIsFemale = b.name.toLowerCase().includes('female')
    const aIsMale = a.name.toLowerCase().includes('male')
    const bIsMale = b.name.toLowerCase().includes('male')

    // 優先級 1: US 語音 vs 非 US 語音
    if (aIsUS && !bIsUS) return -1
    if (!aIsUS && bIsUS) return 1

    // 優先級 2: 女聲 vs 男聲（在同一地區內）
    if (aIsFemale && !bIsFemale) return -1
    if (!aIsFemale && bIsFemale) return 1

    // 優先級 3: 男聲排序（按名稱）
    if (aIsMale && bIsMale) return a.name.localeCompare(b.name)

    return 0
  })

  // 強制更新語音列表
  if (sorted.length > 0) {
    availableVoices.value = sorted
    // 如果沒有選擇語音或選擇的語音不存在，使用第一個
    if (!selectedVoiceName.value || !sorted.find(v => v.name === selectedVoiceName.value)) {
      selectedVoiceName.value = sorted[0].name
    }
    console.log(`Voices updated: ${sorted.length} voices found`)
  }
}

// 朗讀下一個句子
const speakNextSentence = (startIndex: number) => {
  if (!isPlayingRef.value) return

  if (startIndex >= sentences.value.length) {
    isPlaying.value = false
    isPlayingRef.value = false
    currentSentenceIndex.value = -1
    return
  }

  const sentence = sentences.value[startIndex]
  currentSentenceIndex.value = startIndex

  // 自動捲動
  if (textContainerRef.value) {
    const elements = textContainerRef.value.querySelectorAll('.sentence-token')
    if (elements[startIndex]) {
      const el = elements[startIndex] as HTMLElement
      const container = textContainerRef.value
      const rect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const utterance = new SpeechSynthesisUtterance(sentence)
  utterance.lang = 'en-US'
  utterance.rate = speechRate.value
  utterance.volume = volume.value

  const selectedVoice = availableVoices.value.find(v => v.name === selectedVoiceName.value)
  if (selectedVoice) {
    utterance.voice = selectedVoice
  }

  utterance.onend = () => {
    if (isPlayingRef.value && !isPausedRef.value) {
      setTimeout(() => {
        speakNextSentence(startIndex + 1)
      }, 100)
    }
  }

  utterance.onerror = () => {
    if (isPlayingRef.value && !isPausedRef.value) {
      setTimeout(() => {
        speakNextSentence(startIndex + 1)
      }, 100)
    }
  }

  synth.value.speak(utterance)
}

// 開始朗讀
const handleSpeak = () => {
  if (isPaused.value) {
    synth.value.resume()
    isPaused.value = false
    isPausedRef.value = false
  } else {
    synth.value.cancel()
    isPlaying.value = true
    isPlayingRef.value = true
    currentSentenceIndex.value = 0

    if (textContainerRef.value) {
      textContainerRef.value.scrollTop = 0
    }

    speakNextSentence(0)
  }
}

// 暫停
const handlePause = () => {
  synth.value.pause()
  isPaused.value = true
  isPausedRef.value = true
}

// 停止
const handleStop = () => {
  synth.value.cancel()
  isPlaying.value = false
  isPlayingRef.value = false
  isPaused.value = false
  isPausedRef.value = false
  currentSentenceIndex.value = -1
}

// 清空
const handleClear = () => {
  text.value = ''
  sentences.value = []
  currentSentenceIndex.value = -1
}

// 初始化
onMounted(() => {
  // 首先嘗試初始化語音
  initializeVoices()

  // 監聽語音變化事件 - 這是最重要的
  synth.value.onvoiceschanged = () => {
    console.log('Voices changed event fired')
    initializeVoices()
  }

  // 多次延遲初始化以確保在各種瀏覽器上都能工作
  const retryTimes = [100, 200, 500, 1000, 2000]
  retryTimes.forEach(time => {
    setTimeout(() => {
      if (availableVoices.value.length === 0) {
        console.log(`Retrying voice initialization at ${time}ms`)
        initializeVoices()
      }
    }, time)
  })
})
</script>
