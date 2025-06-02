<template>
    <div class="h-full flex flex-col min-h-0">
        <h5 class="my-2 text-lg font-semibold">当前奖品</h5>
        <div class="p-4 max-w-xs w-full">
            <div class="bg-white rounded-lg shadow p-2 flex flex-col items-center">
                <img :src="prizeImage || 'https://via.placeholder.com/150'" class="w-32 h-32 object-cover rounded mb-2" />
                <div class="text-base font-bold mb-1">{{ prizeTitle || '奖品信息待加载...' }}</div>
                <div class="text-sm text-gray-500">{{ prizeDescription || '奖品详情待加载...' }}</div>
            </div>
        </div>
        <div class="relative flex flex-col justify-end flex-grow px-8 max-w-xs w-full overflow-y-auto">
            <div class="overflow-y-auto max-h-full">
                <div v-if="prizeOptions && prizeOptions.length">
                    <div v-for="option in prizeOptions" :key="option.id" class="flex items-center text-left my-2">
                        <input
                            type="radio"
                            :id="'option-' + option.id"
                            :value="option.id"
                            v-model="selectedOption"
                            class="form-radio text-purple-600"
                        />
                        <label :for="'option-' + option.id" class="ml-2 text-sm whitespace-pre-line">{{ option.text }}</label>
                    </div>
                </div>
                <div v-else>
                    <div class="flex items-center my-2">
                        <input type="radio" disabled class="form-radio" />
                        <div class="ml-4 flex-grow h-6 bg-gray-300 rounded"></div>
                    </div>
                    <div class="flex items-center my-2">
                        <input type="radio" disabled class="form-radio" />
                        <div class="ml-4 flex-grow h-6 bg-gray-300 rounded"></div>
                    </div>
                </div>
            </div>
            <button
                :disabled="!selectedOption"
                class="mt-4 py-2 px-6 rounded bg-gray-500 text-white font-semibold shadow hover:bg-gray-600 transition disabled:opacity-50"
                @click="confirmOption"
            >确认</button>
            <div v-if="!optionsAvailable || !running" class="absolute top-2 right-2 bottom-2 left-2 bg-gray-200 bg-opacity-30 rounded-lg z-10"></div>
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
            prizeOptions: [
                // { id: 1, text: '商品A: 这是一个比较长的商品名称，用于测试排版效果abcd\n123' },
                // { id: 2, text: '商品B' },
                // { id: 3, text: '商品C' },
                // { id: 4, text: '商品D' },
                // { id: 5, text: '商品D' },
                // { id: 6, text: '商品D' },
            ],
            optionsAvailable: false
        };
    },
    created() {
        this.initWebSocket();
    },
    methods: {
        initWebSocket() {
            this.socket = new WebSocket('ws://localhost:8000/ws');

            this.socket.onmessage = (event) => {
                let data = JSON.parse(event.data);
                if (data.type === 'prizeInfo') {
                    this.prizeImage = data.payload.image;
                    this.prizeTitle = data.payload.title;
                    this.prizeDescription = data.payload.description;
                    // 清除旧的选项
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
