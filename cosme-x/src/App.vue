<template>
  <div class="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
    <div class="flex-1 flex flex-col">
      <div data-xt-toggle="{ min: 1, duration: 0 }" class="flex flex-col flex-1">
        <!-- 导航卡片 -->
        <nav class="bg-white dark:bg-gray-800 shadow-md">
          <div class="container mx-auto">
            <div class="flex justify-between items-center h-16">
              <!-- 左侧 Logo -->
              <div class="text-3xl font-extrabold rainbow-text animate-rainbow-wave tracking-wide">
                COSME VAULT
              </div>
              <!-- 右侧 Tab 按钮组 -->
              <div>
                <div
                  class="xt-card p-1.5 rounded-2xl text-gray-900 xt-links-default bg-white bg-opacity-80 backdrop-filter backdrop-blur-sm backdrop-saturate-50">
                  <nav aria-label="Navigation" class="xt-list xt-list-1 flex-row space-x-4">
                    <!-- Draw 按钮（默认激活 on）-->
                    <a href="#" role="button"
                      class="xt-button flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition hover:bg-white hover:text-primary-500 active:text-white active:bg-primary-500 on:text-white on:bg-primary-500 on"
                      data-xt-toggle-element data-xt-hash="draw">
                      <img src="/draw_icon.svg" class="xt-icon text-base opacity-50 mr-2" alt="Draw Icon" />
                      Draw
                    </a>
                    <!-- Records 按钮 -->
                    <a href="#" role="button"
                      class="xt-button flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition hover:bg-white hover:text-primary-500 active:text-white active:bg-primary-500 on:text-white on:bg-primary-500"
                      data-xt-toggle-element data-xt-hash="records">
                      <img src="/history_icon.svg" class="xt-icon text-base opacity-50 mr-2" alt="History Icon" />
                      Records
                    </a>
                    <!-- Settings 按钮 -->
                    <a href="#" role="button"
                      class="xt-button flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition hover:bg-white hover:text-primary-500 active:text-white active:bg-primary-500 on:text-white on:bg-primary-500"
                      data-xt-toggle-element data-xt-hash="settings">
                      <img src="/settings_icon.svg" class="xt-icon text-base opacity-50 mr-2" alt="Settings Icon" />
                      Settings
                    </a>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- 面板区 -->
        <div class="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
          <!-- Draw 面板 -->
          <div
            class="xt-card px-6 sm:px-8 text-sm text-gray-900 dark:text-gray-100 xt-links-default bg-transparent shadow-none off:hidden out:pointer-events-none transition opacity-0 scale-95 in:opacity-100 in:scale-100 out:scale-105 h-full"
            data-xt-toggle-target data-xt-hash-target="draw">
            <DrawView class="h-full max-w-3xl" />
          </div>
          <!-- Records 面板 -->
          <div
            class="xt-card p-6 sm:p-8 text-sm text-gray-900 dark:text-gray-100 xt-links-default bg-transparent shadow-none off:hidden out:pointer-events-none transition opacity-0 scale-95 in:opacity-100 in:scale-100 out:scale-105 h-full"
            data-xt-toggle-target data-xt-hash-target="records">
            <RecordsView class="h-full max-w-3xl" />
          </div>
          <!-- Settings 面板 -->
          <div
            class="xt-card p-6 sm:p-8 text-sm text-gray-900 dark:text-gray-100 xt-links-default bg-transparent shadow-none off:hidden out:pointer-events-none transition opacity-0 scale-95 in:opacity-100 in:scale-100 out:scale-105 h-full"
            data-xt-toggle-target data-xt-hash-target="settings">
            <SettingsView class="h-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import DrawView from './views/DrawView.vue'
import RecordsView from './views/RecordsView.vue'
import SettingsView from './views/SettingsView.vue'
import 'xtendui'
import 'xtendui/src/toggle'

const prizes = ref([])

onMounted(() => {
  api.get('/prizes')
    .then(res => {
      prizes.value = res.data
    })
    .catch(err => {
      console.error('Failed to fetch prizes:', err)
    })
})
</script>
