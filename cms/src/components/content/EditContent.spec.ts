import { describe, it, afterEach, beforeEach, expect, vi, beforeAll } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { db, DocType, type ContentDto, accessMap, PostType } from "luminary-shared";
import * as mockData from "@/tests/mockdata";
import { setActivePinia } from "pinia";
import EditContent from "./EditContent.vue";
import waitForExpect from "wait-for-expect";
import { useNotificationStore } from "@/stores/notification";

vi.mock("@auth0/auth0-vue");
vi.mock("vue-router", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-expect-error
        ...actual,
        useRouter: () => ({
            currentRoute: {
                value: {
                    params: {
                        languageCode: "eng",
                    },
                },
            },
        }),
        onBeforeRouteLeave: vi.fn(),
    };
});

// @ts-expect-error
window.scrollTo = vi.fn();

describe("EditContent.vue", () => {
    beforeAll(async () => {
        // seed the fake indexDB with mock datas
        await db.docs.bulkPut([mockData.mockPostDto]);
        await db.docs.bulkPut([mockData.mockEnglishContentDto, mockData.mockFrenchContentDto]);
        await db.docs.bulkPut([
            mockData.mockLanguageDtoEng,
            mockData.mockLanguageDtoFra,
            mockData.mockLanguageDtoSwa,
        ]);
    });

    beforeEach(async () => {
        // Set up the Pinia store before each test
        setActivePinia(createTestingPinia());
        await db.docs.clear();
        await db.localChanges.clear();

        // seed the fake indexDB with mock datas
        await db.docs.bulkPut([mockData.mockPostDto]);
        await db.docs.bulkPut([mockData.mockEnglishContentDto, mockData.mockFrenchContentDto]);
        await db.docs.bulkPut([
            mockData.mockLanguageDtoEng,
            mockData.mockLanguageDtoFra,
            mockData.mockLanguageDtoSwa,
        ]);

        accessMap.value = mockData.fullAccessToAllContentMap;
    });

    afterEach(async () => {
        // Clear the database after each test
        await db.docs.clear();
        await db.localChanges.clear();
        vi.clearAllMocks();
    });

    it("can load content from the database", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });
        // Wait for the component to fetch data
        await waitForExpect(() => {
            expect(wrapper.html()).toContain(mockData.mockEnglishContentDto.title);
        });
    });

    it("reverts changes to the original content", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        await waitForExpect(() => {
            const titleInput = wrapper.find('input[name="title"]');
            expect((titleInput.element as HTMLInputElement).value).toBe(
                mockData.mockEnglishContentDto.title,
            );
        });

        const titleInput = wrapper.find('input[name="title"]');
        await titleInput.setValue("New Title");

        const revertButton = wrapper.find('[data-test="revert-changes-button"]');
        expect(revertButton.exists()).toBe(true);
        await revertButton.trigger("click");

        await waitForExpect(() => {
            expect((titleInput.element as HTMLInputElement).value).toBe(
                mockData.mockEnglishContentDto.title,
            );
        });
    });

    it("can save content to the database", async () => {
        const notificationStore = useNotificationStore();
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        // Wait for the component to fetch data
        await waitForExpect(() => {
            expect(wrapper.find('input[name="title"]').exists()).toBe(true);
        });

        // Simulate enabling dirty state
        const titleInput = wrapper.find('input[name="title"]');
        await titleInput.setValue("New Title");

        // Click the save button
        const saveButton = wrapper.find('[data-test="save-button"]');
        expect(saveButton.exists()).toBe(true);
        await saveButton.trigger("click");

        // Wait for the save to complete
        await waitForExpect(async () => {
            const savedDoc = await db.get<ContentDto>(mockData.mockEnglishContentDto._id);
            expect(savedDoc.title).toBe("New Title");
            expect(notificationStore.addNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    state: "success",
                }),
            );
        });
    });

    it("doesn't save when the content is invalid", async () => {
        const notificationStore = useNotificationStore();
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        // Wait for the component to fetch data
        await waitForExpect(() => {
            expect(wrapper.find('input[name="title"]').exists()).toBe(true);
        });

        // Simulate enabling dirty state
        const titleInput = wrapper.find('input[name="title"]');
        await titleInput.setValue("");

        // Click the save button
        wrapper.find('[data-test="save-button"]').trigger("click");

        // Check that the saved version hasn't changed and that an error notification was shown
        await waitForExpect(async () => {
            const savedDoc = await db.get<ContentDto>(mockData.mockEnglishContentDto._id);
            expect(savedDoc.title).toBe(mockData.mockEnglishContentDto.title);
            expect(notificationStore.addNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    state: "error",
                }),
            );
        });
    });

    it("renders an initial loading state", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                tagOrPostType: PostType.Blog,
            },
        });

        expect(wrapper.html()).toContain("Loading...");
    });

    it("renders an empty state when no language is selected", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                tagOrPostType: PostType.Blog,
            },
        });

        await waitForExpect(() => {
            expect(wrapper.html()).toContain("The content is not yet available in");
        });
    });

    it("renders all the components", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        // Wait for the component to fetch data
        await waitForExpect(() => {
            expect(wrapper.find('[data-test="language-selector"]').exists()).toBe(true); // LanguageSelector is rendered
            expect(wrapper.find('input[name="title"]').exists()).toBe(true); // EditContentBasic is rendered
            expect(wrapper.html()).toContain("Text content"); // EditContentText is rendered
            expect(wrapper.html()).toContain("Video"); // EditContentVideo is rendered
            expect(wrapper.find('button[data-test="save-button"]').exists()).toBe(true); // EditContentParentValidation is rendered
        });
    });

    it("renders the title of the default language", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        await waitForExpect(() => {
            expect(wrapper.text()).toContain(mockData.mockEnglishContentDto.title);
        });
    });

    it("can set the language from the route / prop params", async () => {
        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "fra",
                tagOrPostType: PostType.Blog,
            },
        });

        await waitForExpect(() => {
            expect(wrapper.text()).toContain(mockData.mockFrenchContentDto.title);
        });
    });

    it("can detect a local change", async () => {
        await db.localChanges.put(mockData.mockLocalChange1);

        const wrapper = mount(EditContent, {
            props: {
                docType: DocType.Post,
                id: mockData.mockPostDto._id,
                languageCode: "eng",
                tagOrPostType: PostType.Blog,
            },
        });

        await waitForExpect(() => {
            expect(wrapper.html()).toContain("Offline changes");
        });
    });
});
