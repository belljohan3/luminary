<script setup lang="ts">
import { RouterLink } from "vue-router";
import LButton from "@/components/button/LButton.vue";
import { EyeIcon, PencilSquareIcon } from "@heroicons/vue/20/solid";
import LCard from "@/components/common/LCard.vue";
import LTable, { type SortDirection } from "@/components/common/LTable.vue";
import { computed, ref } from "vue";
import {
    ContentStatus,
    type Content,
    type Post,
    type Language,
    type BaseDocument,
    AclPermission,
    DocType,
} from "@/types";
import { useLanguageStore } from "@/stores/language";
import LBadge from "@/components/common/LBadge.vue";
import { storeToRefs } from "pinia";
import { useLocalChangeStore } from "@/stores/localChanges";
import { DateTime } from "luxon";
import { useUserAccessStore } from "@/stores/userAccess";

type Props = {
    items: BaseDocument[];
    docType: DocType;
    editLinkName: string;
};

defineProps<Props>();

const { languages } = storeToRefs(useLanguageStore());
const { isLocalChange } = useLocalChangeStore();
const { verifyAccess } = useUserAccessStore();

const sortBy = ref("updatedTime");
const sortDirection = ref<SortDirection>("descending");
const columns = [
    {
        text: "Title",
        key: "title",
        sortMethod: (a: Post, b: Post) => {
            const firstItem = a.content[0]?.title;
            const secondItem = b.content[0]?.title;
            if (firstItem < secondItem) return sortDirection.value == "descending" ? 1 : -1;
            if (firstItem > secondItem) return sortDirection.value == "descending" ? -1 : 1;
            return 0;
        },
    },
    {
        text: "",
        key: "offlineChanges",
        sortable: false,
    },
    {
        text: "Translations",
        key: "translations",
        sortable: false,
    },
    {
        text: "Last updated",
        key: "updatedTime",
        sortMethod: (a: Post, b: Post) => {
            const firstItem = a.updatedTimeUtc;
            const secondItem = b.updatedTimeUtc;
            if (firstItem < secondItem) return sortDirection.value == "descending" ? 1 : -1;
            if (firstItem > secondItem) return sortDirection.value == "descending" ? -1 : 1;
            return 0;
        },
    },
    {
        text: "",
        key: "actions",
        sortable: false,
    },
];

const translationStatus = computed(() => {
    return (content: Content[], language: Language) => {
        const item = content.find((c: Content) => c.language.languageCode == language.languageCode);

        if (!item) {
            return "default";
        }

        if (item.status == ContentStatus.Published) {
            return "success";
        }

        if (item.status == ContentStatus.Draft) {
            return "info";
        }

        return "default";
    };
});

const postTitle = computed(() => {
    return (content: Content[]) => {
        if (content.length == 0) {
            return "No translation";
        }

        // TODO this needs to come from a profile setting
        const defaultLanguage = "eng";

        const defaultLanguageContent = content.find(
            (c) => c.language.languageCode == defaultLanguage,
        );
        if (defaultLanguageContent) {
            return defaultLanguageContent.title;
        }

        return content[0].title;
    };
});
</script>

<template>
    <LCard padding="none">
        <LTable
            :columns="columns"
            :items="items"
            v-model:sortBy="sortBy"
            v-model:sortDirection="sortDirection"
        >
            <template #item.title="{ content }">
                {{ postTitle(content) }}
            </template>
            <template #item.offlineChanges="item">
                <LBadge v-if="isLocalChange(item._id)" variant="warning"> Offline changes </LBadge>
            </template>
            <template #item.translations="item">
                <div class="flex gap-2" v-if="item.content.length > 0">
                    <RouterLink
                        custom
                        v-for="language in languages"
                        :key="language.languageCode"
                        v-slot="{ navigate }"
                        :to="{
                            name: editLinkName,
                            params: {
                                id: item._id,
                                language: language.languageCode,
                            },
                        }"
                    >
                        <LBadge
                            @click="
                                translationStatus(item.content, language) == 'default'
                                    ? ''
                                    : navigate()
                            "
                            type="language"
                            :variant="translationStatus(item.content, language)"
                            :class="{
                                'cursor-pointer hover:opacity-75':
                                    translationStatus(item.content, language) !== 'default',
                            }"
                        >
                            {{ language.languageCode }}
                        </LBadge>
                    </RouterLink>
                </div>
            </template>
            <template #item.updatedTime="item">
                {{ item.updatedTimeUtc.toLocaleString(DateTime.DATETIME_MED) }}
            </template>
            <template #item.actions="item">
                <LButton
                    v-if="verifyAccess(item.memberOf, docType, AclPermission.View)"
                    variant="tertiary"
                    :icon="
                        verifyAccess(item.memberOf, docType, AclPermission.Edit)
                            ? PencilSquareIcon
                            : EyeIcon
                    "
                    :is="RouterLink"
                    :to="{
                        name: editLinkName,
                        params: {
                            id: item._id,
                        },
                    }"
                ></LButton>
            </template>
        </LTable>
    </LCard>
</template>
