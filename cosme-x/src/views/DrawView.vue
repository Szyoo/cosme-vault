<template>
    <div
        class="flex flex-row flex-1 min-h-0 gap-4 h-full"
        style="max-height: calc(100vh - 64px - 2rem);">
        <left-section class="flex-1 min-w-[16rem] h-full" :running="running"></left-section>
        <center-section class="flex-1 min-w-[16rem] h-full" :running="running"
            @update:running="running = $event"
            @update:active-tab="$emit('update:active-tab', $event)"></center-section>
        <right-section class="flex-1 min-w-[16rem] h-full" :running="running"></right-section>
    </div>
</template>

<script>
import LeftSection from '../components/LeftSection.vue'
import CenterSection from '../components/CenterSection.vue'
import RightSection from '../components/RightSection.vue'

export default {
    components: {
        LeftSection,
        CenterSection,
        RightSection
    },
    emits: ['update:active-tab'],
    data() {
        return {
            running: false,
        };
    },
};
</script>
