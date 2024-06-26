import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import EditTag from "./EditTag.vue";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { useLanguageStore } from "@/stores/language";
import {
    mockCategory,
    mockEnglishCategoryContent,
    mockFrenchContent,
    mockLanguageEng,
    mockLanguageFra,
    mockLanguageSwa,
    mockTopic,
    fullAccessToAllContentMap,
} from "@/tests/mockData";
import EditContentForm from "@/components/content/EditContentForm.vue";
import waitForExpect from "wait-for-expect";
import EmptyState from "@/components/EmptyState.vue";
import LanguageSelector from "@/components/content/LanguageSelector.vue";
import { useTagStore } from "@/stores/tag";
import { useNotificationStore } from "@/stores/notification";
import { useUserAccessStore } from "@/stores/userAccess";
import { useGlobalConfigStore } from "@/stores/globalConfig";

let routeLanguage: string;

vi.mock("vue-router", () => ({
    resolve: vi.fn(),
    useRouter: vi.fn().mockImplementation(() => ({
        replace: vi.fn(),
    })),
    useRoute: vi.fn().mockImplementation(() => ({
        params: {
            id: mockCategory._id,
            language: routeLanguage,
        },
    })),
    onBeforeRouteLeave: vi.fn(),
}));

const docsDb = vi.hoisted(() => {
    return {
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => ({ _id: "content-post1-eng" })),
    };
});

vi.mock("@/db/baseDatabase", () => {
    return {
        db: {
            docs: docsDb,
            localChanges: docsDb,
        },
    };
});

describe("EditTag", () => {
    beforeEach(() => {
        setActivePinia(createTestingPinia());

        const languageStore = useLanguageStore();
        const tagStore = useTagStore();
        const userAccessStore = useUserAccessStore();
        const globalConfigStore = useGlobalConfigStore();
        languageStore.languages = [mockLanguageEng, mockLanguageFra, mockLanguageSwa];
        tagStore.tags = [mockCategory, mockTopic];
        userAccessStore.accessMap = fullAccessToAllContentMap;
        globalConfigStore.clientAppUrl = "http://localhost:4174";
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders an initial loading state", async () => {
        const tagStore = useTagStore();
        tagStore.tags = [];
        const wrapper = mount(EditTag);

        const form = await wrapper.findComponent(EditContentForm);
        expect(form.exists()).toBe(false);
    });

    it("renders the form", async () => {
        const wrapper = mount(EditTag);

        const form = await wrapper.findComponent(EditContentForm);
        expect(form.exists()).toBe(true);
    });

    it("renders an empty state when there is no content in the tag", async () => {
        const tagStore = useTagStore();
        tagStore.tags = [
            {
                ...mockCategory,
                content: [],
            },
        ];

        const wrapper = mount(EditTag);

        const emptyState = await wrapper.findComponent(EmptyState);
        expect(emptyState.exists()).toBe(true);
        const languageSelector = await wrapper.findComponent(LanguageSelector);
        expect(languageSelector.exists()).toBe(true);
        const form = await wrapper.findComponent(EditContentForm);
        expect(form.exists()).toBe(false);
    });

    it("renders the title of the default language", async () => {
        const wrapper = mount(EditTag);

        expect(wrapper.text()).toContain(mockEnglishCategoryContent.title);
    });

    it("renders a different language than the default when it's not available", async () => {
        const tagStore = useTagStore();
        tagStore.tags = [
            {
                ...mockCategory,
                content: [mockFrenchContent],
            },
        ];

        const wrapper = mount(EditTag);

        expect(wrapper.text()).toContain(mockFrenchContent.title);
    });

    it("can set the language from the route params", async () => {
        routeLanguage = "fra";

        const wrapper = mount(EditTag);

        expect(wrapper.text()).toContain(mockCategory.content[1].title);

        // Reset test state
        routeLanguage = "";
    });

    // FIXME This test is timing out for inexplicable reasons.
    // Test it with a tag when we combine EditPost with EditTag in a future refactor.
    it.skip("saves the content", async () => {
        const tagStore = useTagStore();
        const wrapper = mount(EditTag);

        await wrapper.find("button[data-test='publish']").trigger("click");

        await waitForExpect(() => {
            expect(tagStore.updateTag).toHaveBeenCalledWith(mockCategory.content[0], mockCategory);
        });
    });

    it("can create a translation", async () => {
        const tagStore = useTagStore();
        const notificationStore = useNotificationStore();
        const wrapper = mount(EditTag);

        await wrapper.find("button[data-test='language-selector']").trigger("click");
        await wrapper.find("button[data-test='select-language-swa']").trigger("click");

        expect(tagStore.createTranslation).toHaveBeenCalledWith(mockCategory, mockLanguageSwa);
        expect(notificationStore.addNotification).toHaveBeenCalled();
        // Test that it switched the current language
        expect(wrapper.text()).toContain("Swahili");
        expect(wrapper.text()).not.toContain("Français");
        expect(wrapper.text()).not.toContain("English");
    });
});
