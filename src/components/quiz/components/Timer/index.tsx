import { TimerAsset, TIMER_COMPONENT_SLUG } from "./Asset";
import { TimerToolbar } from "./Toolbar";
import { TimerView } from "./View";
import {
  DEFAULT_TIMER_PROPS,
  normalizeTimerDuration,
  normalizeTimerWarningAt,
  type TimerComponent,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createTimerComponent({
  createId,
}: InstantiateHelpers): TimerComponent {
  return {
    id: createId(),
    type: "timer",
    data: "",
    props: { ...DEFAULT_TIMER_PROPS },
  };
}

function renderTimerComponent({
  component,
  helpers,
}: ComponentRenderParams<TimerComponent>) {
  const props = component.props ?? {};
  const duration = normalizeTimerDuration(props.duration);

  return (
    <TimerView
      duration={duration}
      warningAt={normalizeTimerWarningAt(props.warningAt, duration)}
      textColor={
        typeof props.textColor === "string"
          ? props.textColor
          : DEFAULT_TIMER_PROPS.textColor
      }
      warningColor={
        typeof props.warningColor === "string"
          ? props.warningColor
          : DEFAULT_TIMER_PROPS.warningColor
      }
      backgroundColor={
        typeof props.backgroundColor === "string"
          ? props.backgroundColor
          : DEFAULT_TIMER_PROPS.backgroundColor
      }
      showBackground={
        typeof props.showBackground === "boolean"
          ? props.showBackground
          : DEFAULT_TIMER_PROPS.showBackground
      }
      isEditable={helpers.isEditable}
    />
  );
}

const manifest: ComponentManifest<TimerComponent> = {
  slug: TIMER_COMPONENT_SLUG,
  type: "timer",
  category: "content",
  label: "Timer",
  Asset: TimerAsset,
  Toolbar: TimerToolbar,
  create: createTimerComponent,
  render: renderTimerComponent,
};

export default manifest;
export { createTimerComponent };
export type { TimerComponent };
