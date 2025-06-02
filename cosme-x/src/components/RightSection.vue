<template>
  <div class="flex-1 flex flex-col justify-start items-center px-4 pb-4 h-[calc(100vh-48px)]">
    <h5 class="my-2 text-lg font-semibold">运行状态</h5>
    <div class="flex-1 w-full max-w-xs bg-gray-100 rounded-lg p-4 overflow-y-auto">
      <div class="w-full h-full overflow-y-auto">
        <div class="grid grid-cols-[auto_auto_1fr] gap-1 w-full">
          <template v-for="entry in logs" :key="entry.datetime">
            <div class="px-1 text-left whitespace-pre-line text-xs text-gray-500">{{ entry.datetime.split(' ')[0] }}</div>
            <div class="px-1 text-left whitespace-pre-line text-xs text-gray-500">{{ entry.datetime.split(' ')[1] }}</div>
            <div class="px-1 text-left whitespace-pre-line text-sm">{{ entry.text }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
    name: "RightSection",
    props: {
        running: {
            type: Boolean,
            default: false
        },
    },
    data() {
        return {
            logs: [],
            // logs: [
            //     { datetime: "08-11 09:00:00", text: "开始运行" },
            //     { datetime: "08-11 09:01:00", text: "开始检测" },
            //     { datetime: "08-11 09:02:00", text: "检测到X个\n1.xxx\n2.xxx" },
            //     { datetime: "08-11 10:00:00", text: "开始抽取1" },
            //     { datetime: "08-11 10:03:00", text: "开始1" },
            //     { datetime: "08-11 10:05:00", text: "开始2" },
            //     { datetime: "08-12 09:00:00", text: "开始运行" },
            //     { datetime: "08-12 09:01:00", text: "开始检测" },
            //     { datetime: "08-12 09:02:00", text: "检测到X个\n1.xxx\n2.xxx" },
            //     { datetime: "08-12 10:00:00", text: "开始抽取1" },
            //     { datetime: "08-12 10:03:00", text: "开始1" },
            //     { datetime: "08-12 10:05:00", text: "开始2" },
            //     { datetime: "08-13 09:00:00", text: "开始运行" },
            //     { datetime: "08-13 09:01:00", text: "开始检测" },
            //     { datetime: "08-13 09:02:00", text: "检测到X个\n1.xxx\n2.xxx" },
            //     { datetime: "08-13 10:00:00", text: "开始抽取1" },
            //     { datetime: "08-13 10:03:00", text: "开始1" },
            //     { datetime: "08-13 10:05:00", text: "开始2" },
            // ],
            socket: null,
        };
    },
    watch: {
        running(newVal) {
            if (newVal) {
                this.logs = [];
                this.initWebSocket();
            } else {
                if (this.socket) {
                    this.socket.close();
                    this.socket = null;
                }
            }
        }
    },
    methods: {
        initWebSocket() {
            if (!this.socket) {
                this.socket = new WebSocket('ws://localhost:8000/ws');

                this.socket.addEventListener('open', (event) => {
                    console.log('WebSocket connection opened:', event);
                });

                this.socket.addEventListener('error', (event) => {
                    console.log('WebSocket error:', event);
                });

                this.socket.onmessage = (event) => {
                    console.log('Message from server:', event.data);
                    const data = JSON.parse(event.data);
                    if (data.type === "new_log") {
                        this.logs.push(data.message);
                    }
                };

                this.socket.addEventListener('close', (event) => {
                    console.log('WebSocket connection closed:', event);
                    const currentTime = this.formatDateTime(new Date());
                    const logMessage = {
                        datetime: currentTime,
                        text: "已断开连接"
                    };
                    this.logs.push(logMessage);
                });

                // 滚动到底部
                this.$nextTick(() => {
                    const logList = this.$refs.logList;
                    logList.scrollTop = logList.scrollHeight;
                });
            }
        },
        formatDateTime(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            return `${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
    },
    beforeUnmount() {
        if (this.socket) {
            this.socket.close();
        }
    }
};
</script>
