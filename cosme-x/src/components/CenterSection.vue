<template>
    <div class="flex flex-col items-center w-full h-full">
        <div class="my-2 text-2xl font-semibold">WELCOME TO</div>
        <div class="my-4 text-base text-center text-gray-600">
            As an @COSME™'s Presents Draw Scripts<br>Hoping to Bring U Beauty and Luck
        </div>
        <div class="relative inline-block p-1 cursor-pointer" @mouseover="hoverGear" @mouseleave="leaveGear">
            <div class="absolute inset-0 bg-gray-100 rounded z-[-1]" v-if="showBackground"></div>
            <!-- 用svg替换q-icon，适配所有环境 -->
            <svg :class="['settings-icon', { 'rotate-gear': rotating, 'reverse-rotate-gear': reverseRotating }]"
                @click="goToSettings" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" class="text-gray-500 w-12 h-12 mx-auto" style="cursor:pointer;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.25 2.25c.966 0 1.75.784 1.75 1.75v.5a7.5 7.5 0 013.5 1.5l.354-.354a1.75 1.75 0 112.475 2.475l-.354.354a7.5 7.5 0 011.5 3.5h.5a1.75 1.75 0 110 3.5h-.5a7.5 7.5 0 01-1.5 3.5l.354.354a1.75 1.75 0 11-2.475 2.475l-.354-.354a7.5 7.5 0 01-3.5 1.5v.5a1.75 1.75 0 11-3.5 0v-.5a7.5 7.5 0 01-3.5-1.5l-.354.354a1.75 1.75 0 11-2.475-2.475l.354-.354a7.5 7.5 0 01-1.5-3.5h-.5a1.75 1.75 0 110-3.5h.5a7.5 7.5 0 011.5-3.5l-.354-.354a1.75 1.75 0 112.475-2.475l.354.354a7.5 7.5 0 013.5-1.5v-.5c0-.966.784-1.75 1.75-1.75z" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
            </svg>
        </div>
        <div class="flex flex-col justify-end flex-grow px-8 pb-4 w-full max-w-md">
            <button
                class="my-4 py-2 px-6 rounded bg-purple-600 text-white font-semibold shadow hover:bg-purple-700 transition"
                v-if="!running" @click="startDraw">开始</button>
            <button
                class="my-4 py-2 px-6 rounded bg-red-500 text-white font-semibold shadow hover:bg-red-600 transition"
                v-else @click="stopDraw">停止</button>
            <div class="info">
                <p class="my-1">Chrome 版本: {{ chromeVersion }}</p>
                <p class="my-1">ChromeDriver 版本: {{ chromeDriverVersion }}</p>
                <p class="my-1">作者: Szyyw</p>
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
