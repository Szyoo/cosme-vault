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
                <div class="text-3xl font-extrabold tracking-wide">
                  COSME VAULT
                </div>
                <!-- 右侧 Tab 按钮组 -->
                <div class="h-[54px] px-2 mr-4 bg-gray-500/40 my-auto rounded-xl flex items-center justify-center">
                  <MorphingTabs :tabs="['抽奖', '记录', '设置']" :active-tab="activeTab"
                    @update:active-tab="activeTab = $event" />
                </div>
              </div>
            </div>
          </nav>

          <!-- 面板区 -->
          <div class="m-4 flex-1 min-h-0 flex flex-col bg-transparent dark:bg-transparent">
            <!-- Draw 面板 -->
            <div v-show="activeTab === '抽奖'">
              <DrawView class="h-full w-full" />
            </div>
            <!-- Records 面板 -->
            <div v-show="activeTab === '记录'">
              <RecordsView class="h-full w-full" />
            </div>
            <!-- Settings 面板 -->
            <div v-show="activeTab === '设置'">
              <SettingsView class="h-full w-full" />
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
import MorphingTabs from './components/MorphingTabs.vue'

const activeTab = ref('抽奖');

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
