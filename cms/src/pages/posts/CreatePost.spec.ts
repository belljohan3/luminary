import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CreatePost from "./CreatePost.vue";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { useLanguageStore } from "@/stores/language";
import { mockLanguageEng, mockLanguageFra } from "@/tests/mockData";
import { usePostStore } from "@/stores/post";
import { flushPromises } from "@vue/test-utils";
import waitForExpect from "wait-for-expect";

const routePushMock = vi.hoisted(() => vi.fn());
vi.mock("vue-router", () => ({
    resolve: vi.fn(),
    useRouter: vi.fn().mockImplementation(() => ({
        push: routePushMock,
    })),
}));

describe("CreatePost", () => {
    beforeEach(() => {
        setActivePinia(createTestingPinia());

        const languageStore = useLanguageStore();
        languageStore.languages = [mockLanguageEng, mockLanguageFra];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders the initial form", async () => {
        const wrapper = mount(CreatePost);

        expect(wrapper.html()).toContain("Default image");
        expect(wrapper.html()).toContain(mockLanguageEng.name);
        expect(wrapper.html()).toContain(mockLanguageFra.name);
        expect(wrapper.html()).not.toContain("Title");
    });

    it("shows a title field after a language is chosen", async () => {
        const wrapper = mount(CreatePost);

        await wrapper.findAll("button[data-test='language']")[0].trigger("click");

        expect(wrapper.html()).toContain(mockLanguageEng.name); // In the placeholder
        expect(wrapper.html()).not.toContain(mockLanguageFra.name);
        expect(wrapper.html()).toContain("Title");
    });

    it("can reset the chosen language", async () => {
        const wrapper = mount(CreatePost);

        await wrapper.findAll("button[data-test='language']")[0].trigger("click");
        await wrapper.find("button[data-test='reset']").trigger("click");

        expect(wrapper.html()).toContain(mockLanguageEng.name);
        expect(wrapper.html()).toContain(mockLanguageFra.name);
        expect(wrapper.html()).not.toContain("Title");
    });

    it("can submit the form", async () => {
        const postStore = usePostStore();

        const wrapper = mount(CreatePost);

        await wrapper.find("input[name='image']").setValue("testImage");
        await wrapper.findAll("button[data-test='language']")[0].trigger("click"); // English
        await wrapper.find("input[name='title']").setValue("testTitle");

        await wrapper.find("form").trigger("submit.prevent");

        await flushPromises();
        waitForExpect(() => {
            expect(postStore.createPost).toHaveBeenCalled();
            expect(routePushMock).toHaveBeenCalled();
        });
    });

    it("validates the form", async () => {
        const wrapper = mount(CreatePost);

        // Select a language so both fields are visible
        await wrapper.findAll("button[data-test='language']")[0].trigger("click");

        await wrapper.find("input[name='image']").setValue("");
        await wrapper.find("input[name='title']").setValue("");

        await flushPromises();
        waitForExpect(() => {
            expect(wrapper.text()).toContain("Image is required");
            expect(wrapper.text()).toContain("Title is required");
        });
    });
});
