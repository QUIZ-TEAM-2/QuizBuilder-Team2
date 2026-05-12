import { ProgressBarAsset } from "./Asset";
import { ProgressBarView } from "./View";
import { ProgressBarToolbar } from "./Toolbar";
import {
  DEFAULT_PROGRESS_BAR_PROPS,
  PROGRESS_BAR_COMPONENT_SLUG,
  type ProgressBarComponent,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createProgressBarComponent({
  createId,
}: InstantiateHelpers): ProgressBarComponent {
  return {
    id: createId(),
    type: "progressBar",
    props: {
      ...DEFAULT_PROGRESS_BAR_PROPS,
    },
  };
}

function renderProgressBarComponent({
  component,
  helpers,
}: ComponentRenderParams<ProgressBarComponent>) {
  const props = component.props ?? {};
  const currentValue = helpers.isEditable
    ? "X"
    : String(helpers.currentPageNumber ?? 1);
  const totalValue = helpers.isEditable
    ? "Y"
    : String(helpers.totalPages ?? 1);

  return (
    <ProgressBarView
      currentValue={currentValue}
      totalValue={totalValue}
      variant={
        props.variant === "dots" ||
        props.variant === "rainbow" ||
        props.variant === "numeric"
          ? props.variant
          : DEFAULT_PROGRESS_BAR_PROPS.variant
      }
      currentColor={
        typeof props.currentColor === "string"
          ? props.currentColor
          : DEFAULT_PROGRESS_BAR_PROPS.currentColor
      }
      totalColor={
        typeof props.totalColor === "string"
          ? props.totalColor
          : DEFAULT_PROGRESS_BAR_PROPS.totalColor
      }
    />
  );
}

const manifest: ComponentManifest<ProgressBarComponent> = {
  slug: PROGRESS_BAR_COMPONENT_SLUG,
  type: "progressBar",
  category: "content",
  label: "Progress",
  Asset: ProgressBarAsset,
  Toolbar: ProgressBarToolbar,
  create: createProgressBarComponent,
  render: renderProgressBarComponent,
};

export default manifest;
export type { ProgressBarComponent };
