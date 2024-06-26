import { createRouter, createWebHistory } from "vue-router";
import { nextTick } from "vue";
import { useGlobalConfigStore } from "@/stores/globalConfig";
import NotFoundPage from "../pages/NotFoundPage.vue";
import HomePage from "../pages/HomePage.vue";
import SinglePost from "@/pages/SinglePost.vue";
import SettingsPage from "@/pages/SettingsPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import { isNotAuthenticatedGuard } from "@/guards/isNotAuthenticatedGuard";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        } else {
            return { top: 0 };
        }
    },
    routes: [
        {
            path: "/",
            component: HomePage,
            name: "home",
            meta: {
                title: "Home",
            },
        },
        {
            path: "/login",
            component: LoginPage,
            name: "login",
            meta: {
                title: "Log in",
            },
            beforeEnter: isNotAuthenticatedGuard,
        },
        {
            path: "/settings",
            component: SettingsPage,
            name: "settings",
            meta: {
                title: "Settings",
            },
        },

        // Note that this route should always come after all defined routes,
        // to prevent wrongly configured slugs from taking over pages
        {
            path: "/:slug",
            component: SinglePost,
            name: "post",
        },

        {
            path: "/:pathMatch(.*)*",
            name: "404",
            component: NotFoundPage,
        },
    ],
});

router.afterEach((to) => {
    // We handle posts in their own component
    if (to.name == "post") return;

    const { appName } = useGlobalConfigStore();

    nextTick(() => {
        document.title = to.meta.title ? `${to.meta.title} - ${appName}` : appName;
    });
});

export default router;
