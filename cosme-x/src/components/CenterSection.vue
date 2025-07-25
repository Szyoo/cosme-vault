<template>
    <div
        class="h-full max-h-full flex items-center flex-col min-h-0 backdrop-blur-lg bg-white/30 dark:bg-gray-900/30 rounded-2xl shadow p-4">
        <div class="my-2 text-2xl font-semibold">WELCOME</div>
        <div class="my-4 text-base text-center text-gray-600">
            COSME Vault is a tool designed to help you participate in @COSME™ lottery events easily and enhance your
            winning experience!
        </div>
        <!-- TailwindCSS 测试元素 -->
        <div
            class="my-4 p-4 rounded-lg bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 text-white text-center font-bold shadow-lg">
            TailwindCSS 已生效
        </div>
        <div class="relative inline-block p-1 my-1 cursor-pointer" @mouseover="hoverGear" @mouseleave="leaveGear">
            <div class="absolute inset-0 bg-gray-100 rounded z-[-1]" v-if="showBackground"></div>
            <!-- 更美观的齿轮SVG -->
            <svg :class="['settings-icon', { 'rotate-gear': rotating, 'reverse-rotate-gear': reverseRotating }]"
                @click="goToSettings" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"
                class="text-gray-500 w-12 h-12 mx-auto" style="cursor:pointer;">
                <g stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
                    <path
                        d="M36.7 24c0-.6 0-1.2-.1-1.8l4.2-3.3-2.2-3.8-5 1.6a15 15 0 0 0-3.6-2.1L28.8 10h-4.6l-1 4.4a15 15 0 0 0-3.6 2.1l-5-1.6-2.2 3.8 4.2 3.3c-.1.6-.1 1.2-.1 1.8s0 1.2.1 1.8l-4.2 3.3 2.2 3.8 5-1.6a15 15 0 0 0 3.6 2.1l1 4.4h4.6l1-4.4a15 15 0 0 0 3.6-2.1l5 1.6 2.2-3.8-4.2-3.3c.1-.6.1-1.2.1-1.8z"
                        fill="#fff" />
                    <circle cx="24" cy="24" r="6" fill="none" />
                </g>
            </svg>
        </div>
        <div class="flex flex-col justify-end flex-grow w-full max-w-md">
            <RippleButton
                :class="[
                'text-white',
                running
                    ? 'bg-gradient-to-r from-red-300 via-red-400 to-pink-500'
                    : 'bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400'
                ]"
                @click="running ? stopDraw() : startDraw()"
            >
                {{ running ? '停止' : '开始' }}
            </RippleButton>
            <div class="info">
                <p class="my-1">Chrome 版本: {{ chromeVersion }}</p>
                <p class="my-1">ChromeDriver 版本: {{ chromeDriverVersion }}</p>
                <p class="my-1">作者: Szyyw</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import RippleButton from './RippleButton.vue'
</script>

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
            chromeDriverVersion: "Unknown",
            colors: ['#EE7752', '#E73C7E', '#23A6D5', '#23D5AB'],
            rotating: false,
            reverseRotating: false,
            showBackground: false
        };
    },
    computed: {
        chromeVersion() {
            // 适配无vuex环境
            return (this.$store && this.$store.state && this.$store.state.chromeVersion) ? this.$store.state.chromeVersion : 'Unknown';
        }
    },
    methods: {
        startDraw() {
            this.$emit("update:running", true);
        },
        stopDraw() {
            this.$emit("update:running", false);
        },
        hoverGear() {
            this.rotating = true;
            this.reverseRotating = false;
            this.showBackground = true;
        },
        leaveGear() {
            this.rotating = false;
            this.reverseRotating = true;
            this.showBackground = false;
            setTimeout(() => {
                this.reverseRotating = false;
            }, 1000);
        },
        goToSettings() {
            if (this.$router) {
                this.$router.push({ name: 'settings' });
            }
        },
    },
    mounted() {
        // 适配无vuex环境
        if (this.$store && this.$store.state && !this.$store.state.chromeDriverVersion) {
            fetch('/get-chromedriver-version')
                .then(response => response.text())
                .then(data => {
                    this.chromeDriverVersion = data.trim();
                    if (this.$store && this.$store.dispatch) {
                        this.$store.dispatch('updateChromeDriverVersion', this.chromeDriverVersion);
                    }
                });
        } else if (this.$store && this.$store.state) {
            this.chromeDriverVersion = this.$store.state.chromeDriverVersion;
        }
    }
};
</script>
<style>
@keyframes gradient {
    0% {
        background-position: 0% 50%;
    }

    100% {
        background-position: 100% 50%;
    }
}

.glowing-text {
    color: #fff;
    background: linear-gradient(45deg, #EE7752, #E73C7E, #23A6D5, #23D5AB, #EE7752, #E73C7E, #23A6D5, #23D5AB);
    background-size: 300% 300%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient 6s linear infinite;
}

.settings-icon.rotate-gear {
    animation-name: rotateForward;
    animation-duration: 1s;
    animation-fill-mode: forwards;
}

.settings-icon.reverse-rotate-gear {
    animation-name: rotateBackward;
    animation-duration: 1s;
    animation-fill-mode: forwards;
}

@keyframes rotateForward {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(180deg);
    }
}

@keyframes rotateBackward {
    0% {
        transform: rotate(180deg);
    }

    100% {
        transform: rotate(0deg);
    }
}
</style>
