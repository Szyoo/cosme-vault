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
                @click="goToSettings" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                class="text-gray-500 w-12 h-12 mx-auto" style="cursor:pointer;">
                <path fill="currentColor"
                    d="M19.43 12.98c.04-.32.07-.66.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a8.77 8.77 0 0 0-1.72-1.02l-.38-2.57a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5l-.38 2.57a8.77 8.77 0 0 0-1.73 1.03l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.97s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1a8.77 8.77 0 0 0 1.73 1.03l.38 2.57a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5l.38-2.57a8.77 8.77 0 0 0 1.72-1.03l2.49 1c.23.09.5 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
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
            // Inform parent components to switch to the settings tab
            this.$emit('update:active-tab', '设置');
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
