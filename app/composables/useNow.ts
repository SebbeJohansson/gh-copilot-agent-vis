import { onMounted, onUnmounted, ref } from 'vue'

/**
 * A shared, ticking "now" timestamp (ms). Components use it so relative times
 * ("4 min ago") re-render periodically without every card owning a timer.
 * The interval is reference-counted and only runs while something is mounted.
 */
const now = ref<number>(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let refCount = 0

export function useNow(intervalMs = 30_000) {
  onMounted(() => {
    refCount += 1
    now.value = Date.now()
    if (!timer) {
      timer = setInterval(() => {
        now.value = Date.now()
      }, intervalMs)
    }
  })

  onUnmounted(() => {
    refCount -= 1
    if (refCount <= 0 && timer) {
      clearInterval(timer)
      timer = null
      refCount = 0
    }
  })

  return now
}
