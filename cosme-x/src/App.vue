<template>
  <AuroraBackground>
    <Motion as="div" :initial="{ opacity: 0, y: 40, filter: 'blur(10px)' }" :while-in-view="{
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
    }" :transition="{
        delay: 0.3,
        duration: 0.8,
        ease: 'easeInOut',
      }" class="flex flex-col h-screen w-full">

        <div class="flex-1 flex flex-col">
          <div class="flex flex-col flex-1">
            <!-- 导航卡片 -->
            <nav class="shadow-md">
              <div class="container mx-auto">
                <div class="flex justify-between items-center h-16">
                  <!-- 左侧 Logo -->
                  <div class="text-3xl font-extrabold rainbow-text animate-rainbow-wave tracking-wide">
                    COSME VAULT
                  </div>
                  <!-- 右侧 Tab 按钮组 -->
                  <div>
                    <div
                      class="p-1.5 rounded-2xl text-gray-900 bg-white bg-opacity-80 backdrop-filter backdrop-blur-sm backdrop-saturate-50">
                      <nav aria-label="Navigation" class="flex flex-row space-x-4">
                        <!-- Draw 按钮（默认激活 on）-->
                        <button
                          class="flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition"
                          :class="activeTab === 'draw' ? 'bg-blue-500 text-white' : 'hover:bg-blue-100'"
                          @click.prevent="activeTab = 'draw'">
                          <img src="/draw_icon.svg" class="text-base opacity-50 mr-2" alt="Draw Icon" />
                          Draw
                        </button>
                        <!-- Records 按钮 -->
                        <button
                          class="flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition"
                          :class="activeTab === 'records' ? 'bg-blue-500 text-white' : 'hover:bg-blue-100'"
                          @click.prevent="activeTab = 'records'">
                          <img src="/history_icon.svg" class="text-base opacity-50 mr-2" alt="History Icon" />
                          Records
                        </button>
                        <!-- Settings 按钮 -->
                        <button
                          class="flex-auto py-2 px-3 text-13 rounded-2xl font-medium leading-snug tracking-wider uppercase transition"
                          :class="activeTab === 'settings' ? 'bg-blue-500 text-white' : 'hover:bg-blue-100'"
                          @click.prevent="activeTab = 'settings'">
                          <img src="/settings_icon.svg" class="text-base opacity-50 mr-2" alt="Settings Icon" />
                          Settings
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            <!-- 面板区 -->
            <div class="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900">
              <!-- Draw 面板 -->
              <div class="px-6 sm:px-8 text-sm text-gray-900 dark:text-gray-100 flex-1" v-show="activeTab === 'draw'">
                <DrawView class="h-full max-w-3xl" />
              </div>
              <!-- Records 面板 -->
              <div class="p-6 sm:p-8 text-sm text-gray-900 dark:text-gray-100 flex-1" v-show="activeTab === 'records'">
                <RecordsView class="h-full max-w-3xl" />
              </div>
              <!-- Settings 面板 -->
              <div class="p-6 sm:p-8 text-sm text-gray-900 dark:text-gray-100 flex-1" v-show="activeTab === 'settings'">
                <SettingsView class="h-full" />
              </div>
            </div>
          </div>
        </div>
    </Motion>
  </AuroraBackground>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import DrawView from './views/DrawView.vue'
import RecordsView from './views/RecordsView.vue'
import SettingsView from './views/SettingsView.vue'
import { api } from './api.js'
import { Motion } from "motion-v";
import AuroraBackground from './components/AuroraBackground.vue'

const activeTab = ref('draw')

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
