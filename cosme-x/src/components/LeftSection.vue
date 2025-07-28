<template>
    <div class="h-full max-h-full flex flex-col min-h-0 backdrop-blur-lg bg-white/30 dark:bg-gray-900/30 rounded-2xl shadow p-4">
        <h5 class="text-lg font-semibold text-center w-full my-2">当前奖品</h5>
        <div class="flex-1 flex flex-col justify-end items-center min-h-0">
            <div class="w-full flex flex-col gap-4 items-center">
                <!-- 奖品图片展示 -->
                <div
                    class="w-full max-w-36 aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden animate-pulse">
                    <template v-if="prizeImage">
                        <img :src="prizeImage" class="w-full h-full object-cover rounded-2xl transition" />
                    </template>
                    <template v-else>
                        <img src="/image_empty.svg" class="w-24 h-24 object-contain opacity-60" alt="占位图标" />
                    </template>
                </div>
                <!-- 奖品标题展示 -->
                <div class="w-full text-base font-bold mx-2 text-center">
                    <template v-if="prizeTitle">{{ prizeTitle }}</template>
                    <template v-else>
                        <div class="w-full h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                    </template>
                </div>
                <!-- 奖品描述展示 -->
                <div class="w-full text-base font-bold mx-2 text-center">
                    <template v-if="prizeDescription">{{ prizeDescription }}</template>
                    <template v-else>
                        <div class="w-full h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                        <div class="w-full h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mt-4"></div>
                    </template>
                </div>
            </div>
            <!-- 奖品选项列表 -->
            <div class="flex-1 min-h-0 flex flex-col w-full">
                <div class="flex-1 min-h-0 flex flex-col mt-4">
                    <div v-if="prizeOptions && prizeOptions.length" class="flex-1 overflow-y-auto">
                        <div v-for="option in prizeOptions" :key="option.id" class="w-full">
                            <label class="flex items-center w-full cursor-pointer gap-2 py-1">
                                  <input type="radio" :id="'option-' + option.id" :value="option.id"
                                      v-model="selectedOption"
                                      class="rounded-full text-blue-500 focus:ring-blue-500"
                                      name="prize-options" />
                                <span class="text-sm whitespace-pre-line flex-1">{{ option.text }}</span>
                            </label>
                        </div>
                    </div>
                    <div v-else class="flex flex-col gap-2 overflow-y-auto flex-1">
                        <div v-for="n in 10" :key="n" class="w-full">
                            <label class="inline-flex items-baseline w-full gap-2 py-1">
                                  <input type="radio" disabled
                                      class="top-[1px] rounded-full"
                                      name="prize-options-placeholder" />
                                <span :class="[
                                    'inline-block bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full h-4'
                                ]"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <button :disabled="!selectedOption"
                    class="mt-4 rounded-2xl bg-gray-500 text-white font-semibold shadow hover:bg-gray-600 transition disabled:opacity-50 py-2 px-6"
                    @click="confirmOption">确认</button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        running: {
            type: Boolean,
            default: false
        },
    },
    data() {
        return {
            socket: null,
            selectedOption: null,
            prizeImage: null,
            prizeTitle: null,
            prizeDescription: null,
            prizeOptions: [],
            optionsAvailable: false
        };
    },
    created() {
        this.initWebSocket();
    },
    methods: {
        initWebSocket() {
            this.socket = new WebSocket('ws://localhost:8888/ws');
            this.socket.onmessage = (event) => {
                let data = JSON.parse(event.data);
                if (data.type === 'prizeInfo') {
                    this.prizeImage = data.payload.image;
                    this.prizeTitle = data.payload.title;
                    this.prizeDescription = data.payload.description;
                    this.prizeOptions = [];
                    this.optionsAvailable = false;
                } else if (data.type === 'options') {
                    this.prizeOptions = data.payload.options;
                    this.optionsAvailable = this.running && this.prizeOptions.length > 0;
                }
            };
            this.socket.onclose = (event) => {
                console.log('WebSocket closed:', event);
            };
            this.socket.onerror = (error) => {
                console.error('WebSocket Error:', error);
            };
        },
        confirmOption() {
            if (this.selectedOption && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'submitChoice',
                    payload: { selectedOption: this.selectedOption }
                }));
            }
        }
    },
    watch: {
        prizeImage(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.prizeOptions = [];
                this.optionsAvailable = false;
            }
        },
        prizeTitle(newVal, oldVal) {
            if (newVal !== oldVal) {
                this.prizeOptions = [];
                this.optionsAvailable = false;
            }
        },
        running(newVal) {
            this.optionsAvailable = newVal && this.prizeOptions.length > 0;
        }
    }
};
</script>
