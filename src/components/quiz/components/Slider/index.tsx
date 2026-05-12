import { SliderAsset } from "./Asset";
import { SliderToolbar } from "./Toolbar";
import { SliderView } from "./View";
import {
  DEFAULT_SLIDER_RANGE_COLOR,
  DEFAULT_SLIDER_TEXT_COLOR,
  DEFAULT_SLIDER_TRACK_COLOR,
  DEFAULT_SLIDER_VALUE,
  SLIDER_COMPONENT_SLUG,
  normalizeSliderConfig,
  type SliderComponent,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createSliderComponent({
  createId,
}: InstantiateHelpers): SliderComponent {
  return {
    id: createId(),
    type: "slider",
    props: {
      min: 0,
      max: 5,
      divisions: 5,
      defaultValue: DEFAULT_SLIDER_VALUE,
      trackColor: DEFAULT_SLIDER_TRACK_COLOR,
      rangeColor: DEFAULT_SLIDER_RANGE_COLOR,
      textColor: DEFAULT_SLIDER_TEXT_COLOR,
      showValue: true,
    },
  };
}

function renderSliderComponent({
  component,
  helpers,
}: ComponentRenderParams<SliderComponent>) {
  const props = component.props ?? {};
  const { min, max, divisions, defaultValue } = normalizeSliderConfig(props);

  return (
    <SliderView
      min={min}
      max={max}
      divisions={divisions}
      defaultValue={defaultValue}
      trackColor={
        typeof props.trackColor === "string"
          ? props.trackColor
          : DEFAULT_SLIDER_TRACK_COLOR
      }
      rangeColor={
        typeof props.rangeColor === "string"
          ? props.rangeColor
          : DEFAULT_SLIDER_RANGE_COLOR
      }
      textColor={
        typeof props.textColor === "string"
          ? props.textColor
          : DEFAULT_SLIDER_TEXT_COLOR
      }
      showValue={props.showValue !== false}
      sliderValue={helpers.sliderValue}
      isEditable={helpers.isEditable}
      onSliderChange={
        helpers.onSliderChange
          ? (value, intervalIndex) =>
              helpers.onSliderChange?.(component.id, value, intervalIndex)
          : undefined
      }
    />
  );
}

const manifest: ComponentManifest<SliderComponent> = {
  slug: SLIDER_COMPONENT_SLUG,
  type: "slider",
  category: "content",
  label: "Slider",
  Asset: SliderAsset,
  Toolbar: SliderToolbar,
  create: createSliderComponent,
  render: renderSliderComponent,
};

export default manifest;
export type { SliderComponent };
