<template>
    <div class="flex flex-row h-full min-h-0 flex-1">
        <left-section class="flex-1 min-w-0 h-full" :running="running"></left-section>
        <center-section class="flex-1 min-w-0 h-full" :running="running"
            @update:running="running = $event"></center-section>
        <right-section class="flex-1 min-w-0 h-full" :running="running"></right-section>
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
    data() {
        return {
            running: false,
        };
    },
};
</script>
