import { ImageAsset, IMAGE_COMPONENT_SLUG } from "./Asset";
import { ImageView } from "./View";
import { ImageToolbar } from "./Toolbar";
import { DEFAULT_IMAGE_OPACITY, type ImageComponent } from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createImageComponent({
  createId,
}: InstantiateHelpers): ImageComponent {
  return {
    id: createId(),
    type: "image",
    data: "https://placehold.co/200x150/png",
    props: {},
  };
}

function renderImageComponent({
  component,
}: ComponentRenderParams<ImageComponent>) {
  const opacity =
    typeof component.props?.opacity === "number"
      ? component.props.opacity
      : DEFAULT_IMAGE_OPACITY;

  return <ImageView src={component.data ?? ""} opacity={opacity} />;
}

const manifest: ComponentManifest<ImageComponent> = {
  slug: IMAGE_COMPONENT_SLUG,
  type: "image",
  category: "content",
  label: "Image",
  Asset: ImageAsset,
  Toolbar: ImageToolbar,
  create: createImageComponent,
  render: renderImageComponent,
};

export default manifest;
export type { ImageComponent };
