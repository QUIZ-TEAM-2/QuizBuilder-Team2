import { VideoAsset } from "./Asset";
import { VideoToolbar } from "./Toolbar";
import { VideoView } from "./View";
import { VIDEO_COMPONENT_SLUG, type VideoComponent } from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createVideoComponent({
  createId,
}: InstantiateHelpers): VideoComponent {
  return {
    id: createId(),
    type: "video",
    data: "",
    props: { url: "", rounded: true },
  };
}

function renderVideoComponent({
  component,
  helpers,
}: ComponentRenderParams<VideoComponent>) {
  const props = component.props ?? {};
  return (
    <VideoView
      url={typeof props.url === "string" ? props.url : ""}
      rounded={props.rounded !== false}
      isEditable={helpers.isEditable}
    />
  );
}

const manifest: ComponentManifest<VideoComponent> = {
  slug: VIDEO_COMPONENT_SLUG,
  type: "video",
  category: "content",
  label: "Video",
  Asset: VideoAsset,
  Toolbar: VideoToolbar,
  create: createVideoComponent,
  render: renderVideoComponent,
};

export default manifest;
export { createVideoComponent };
export type { VideoComponent };
