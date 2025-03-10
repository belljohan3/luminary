<script setup lang="ts">
import { computed, watch } from "vue";
import {
    type ContentDto,
    DocType,
    db,
    type Uuid,
    useDexieLiveQueryWithDeps,
    TagType,
    PostType,
} from "luminary-shared";
import { appLanguageIdsAsRef } from "@/globalConfig";
import HorizontalContentTileCollection from "@/components/content/HorizontalContentTileCollection.vue";
import { contentByTag } from "../contentByTag";
import { isPublished } from "@/util/isPublished";

const newest100Content = useDexieLiveQueryWithDeps(
    appLanguageIdsAsRef,
    (appLanguageIds: Uuid[]) =>
        db.docs
            .orderBy("publishDate")
            .reverse()
            .filter((c) => {
                const content = c as ContentDto;
                if (content.type !== DocType.Content) return false;
                if (content.parentPostType && content.parentPostType == PostType.Page) return false;
                if (content.parentTagType && content.parentTagType !== TagType.Topic) return false;

                // Only include published content
                if (content.status !== "published") return false;
                if (!content.publishDate) return false;
                if (content.publishDate > Date.now()) return false;
                if (content.expiryDate && content.expiryDate < Date.now()) return false;

                const firstSupportedLang = appLanguageIds.find((lang) =>
                    content.availableTranslations?.includes(lang),
                );

                if (content.language !== firstSupportedLang) return false;

                return true && content.language == firstSupportedLang;
            })
            .limit(100) // Limit to the newest posts
            .toArray() as unknown as Promise<ContentDto[]>,
    { initialValue: await db.getQueryCache<ContentDto[]>("homepage_newest100Content"), deep: true },
);

watch(newest100Content, async (value) => {
    db.setQueryCache<ContentDto[]>("homepage_newest100Content", value);
});

const categoryIds = computed(() =>
    newest100Content.value
        .map((content) => content.parentTags)
        .flat()
        .filter((value, index, array) => {
            return array.indexOf(value) === index;
        }),
);

const categories = useDexieLiveQueryWithDeps(
    [categoryIds, appLanguageIdsAsRef],
    ([_categoryIds, appLanguageIds]: [Uuid[], Uuid[]]) =>
        db.docs
            .where("parentId")
            .anyOf(_categoryIds)
            .filter((content) => {
                const _content = content as ContentDto;
                if (_content.parentType !== DocType.Tag) return false;
                if (!_content.parentTagType) return false;
                if (_content.parentPinned) return false;

                // Use the `isPublished` helper function
                return (
                    isPublished(_content, appLanguageIds) &&
                    _content.parentTagType === TagType.Category
                );
            })
            .toArray() as unknown as Promise<ContentDto[]>,
    {
        initialValue: await db.getQueryCache<ContentDto[]>("homepage_unpinnedCategories"),
        deep: true,
    },
);

watch(
    () => categories.value,
    (value) => {
        db.setQueryCache<ContentDto[]>("homepage_unpinnedCategories", value);
    },
);

const unpinnedNewestContentByCategory = contentByTag(newest100Content, categories);
</script>

<template>
    <HorizontalContentTileCollection
        v-for="c in unpinnedNewestContentByCategory"
        :key="c.tag._id"
        :contentDocs="c.content"
        :title="c.tag.title"
        :summary="c.tag.summary"
        class="pt-2"
    />
</template>
