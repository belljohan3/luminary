import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import TopicsOverview from "./TopicsOverview.vue";
import EmptyState from "@/components/EmptyState.vue";
import { mockTopic, mockLanguageEng, fullAccessToAllContentMap } from "@/tests/mockData";
import { useLanguageStore } from "@/stores/language";
import { setActivePinia } from "pinia";
import { useTagStore } from "@/stores/tag";
import { useUserAccessStore } from "@/stores/userAccess";
import { nextTick } from "vue";

describe("TopicsOverview", () => {
    beforeEach(() => {
        setActivePinia(createTestingPinia());
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("displays posts from the store", async () => {
        const tagStore = useTagStore();
        const languageStore = useLanguageStore();

        // @ts-ignore Property is readonly
        tagStore.tags = [mockTopic];
        // @ts-ignore Property is readonly
        tagStore.topics = [mockTopic];
        languageStore.languages = [mockLanguageEng];

        const wrapper = mount(TopicsOverview);

        expect(wrapper.html()).toContain("Topic A");
    });

    it("displays an empty state if there are no posts", async () => {
        const store = useTagStore();
        // @ts-ignore Property is readonly
        store.tags = [];
        // @ts-ignore Property is readonly
        store.topics = [];

        const wrapper = mount(TopicsOverview);

        expect(wrapper.findComponent(EmptyState).exists()).toBe(true);
    });

    it("doesn't display anything when the db is still loading", async () => {
        const wrapper = mount(TopicsOverview);

        expect(wrapper.find("button").exists()).toBe(false);
        expect(wrapper.findComponent(EmptyState).exists()).toBe(false);
    });

    describe("permissions", () => {
        it("doesn't display Create button if the user has no permission to create tags", async () => {
            const postStore = useTagStore();
            const userAccessStore = useUserAccessStore();
            postStore.tags = [mockTopic];

            const wrapper = mount(TopicsOverview);

            expect(wrapper.text()).not.toContain("Create topic");

            userAccessStore.accessMap = fullAccessToAllContentMap;
            await nextTick();
            expect(wrapper.text()).toContain("Create topic");
        });
    });
});
