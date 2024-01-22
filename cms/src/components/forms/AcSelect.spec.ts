import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AcSelect from "./AcSelect.vue";

const options = [
    { label: "Test item 1", value: "one" },
    { label: "Test item 2", value: "two" },
];

describe("AcSelect", () => {
    it("emits update event on input", async () => {
        const wrapper = mount(AcSelect, {
            props: { options },
        });
        await wrapper.find("select").setValue("two");

        expect(wrapper.emitted("update:modelValue")?.length).toBe(1);
        expect(wrapper.emitted("update:modelValue")![0]).toEqual(["two"]);
    });

    it("renders a label and message from the default slot", () => {
        const wrapper = mount(AcSelect, {
            props: { label: "Test label", options },
            slots: { default: "Test message" },
        });

        expect(wrapper.text()).toContain("Test message");
        expect(wrapper.text()).toContain("Test label");
    });

    it("renders without a label ", () => {
        const wrapper = mount(AcSelect, { props: { options } });

        expect(wrapper.text()).toBe(options[0].label + options[1].label);
    });

    it("passes through non-prop attributes", () => {
        const wrapper = mount(AcSelect, { props: { options }, attrs: { autocomplete: true } });
        expect(wrapper.html()).toContain('autocomplete="true"');
    });
});
