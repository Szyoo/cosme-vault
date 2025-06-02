import { createRouter, createWebHistory } from "vue-router";
import DrawView from "../views/DrawView.vue";
import RecordsView from "../views/RecordsView.vue";
import SettingsView from "../views/SettingsView.vue";

const routes = [
  {
    path: "/",
    name: "draw",
    component: DrawView,
  },
  {
    path: "/records",
    name: "records",
    component: RecordsView,
  },
  {
    path: "/settings",
    name: "settings",
    component: SettingsView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
