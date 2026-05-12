import { ShapeAsset, SHAPE_COMPONENT_SLUG } from "./Asset";
import { ShapeView } from "./View";
import { ShapeToolbar } from "./Toolbar";
import type { ShapeComponent, ShapeVariant } from "./types";
import { DEFAULT_SHAPE_PROPS } from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createShapeComponent(
  { createId }: InstantiateHelpers,
  variant?: ShapeVariant,
): ShapeComponent {
  return {
    id: createId(),
    type: "shape",
    props: {
      ...DEFAULT_SHAPE_PROPS,
      variant: variant ?? "rectangle",
    },
  };
}

function renderShapeComponent({
  component,
}: ComponentRenderParams<ShapeComponent>) {
  const props = component.props ?? {};
  return (
    <ShapeView
      variant={props.variant ?? DEFAULT_SHAPE_PROPS.variant}
      fillColor={props.fillColor ?? DEFAULT_SHAPE_PROPS.fillColor}
      strokeColor={props.strokeColor ?? DEFAULT_SHAPE_PROPS.strokeColor}
      strokeWidth={props.strokeWidth ?? DEFAULT_SHAPE_PROPS.strokeWidth}
      opacity={props.opacity ?? DEFAULT_SHAPE_PROPS.opacity}
    />
  );
}

const manifest: ComponentManifest<ShapeComponent> = {
  slug: SHAPE_COMPONENT_SLUG,
  type: "shape",
  category: "content",
  label: "Shape",
  Asset: ShapeAsset,
  Toolbar: ShapeToolbar,
  create: createShapeComponent,
  render: renderShapeComponent,
};

export default manifest;
export { createShapeComponent };
export type { ShapeComponent };


