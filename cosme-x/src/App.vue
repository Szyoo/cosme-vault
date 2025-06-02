<template>
  <div class="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
    <nav class="bg-white dark:bg-gray-800 shadow-md">
      <div class="container mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <router-link to="/" class="text-xl font-semibold text-gray-800 dark:text-white">
            MyAppLogo
          </router-link>
          <div class="flex space-x-4">
            <router-link
              to="/"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              active-class="bg-gray-200 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
            >
              Draw
            </router-link>
            <router-link
              to="/records"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              active-class="bg-gray-200 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
            >
              Records
            </router-link>
            <router-link
              to="/settings"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              active-class="bg-gray-200 dark:bg-gray-700 text-blue-600 dark:text-blue-400"
            >
              Settings
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <main class="flex-grow overflow-y-auto p-4">
      <router-view v-slot="{ Component }">
        <component :is="Component" class="h-full" />
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import { api } from './api'

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
