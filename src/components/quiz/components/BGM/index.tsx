import { BGMAsset, BGM_COMPONENT_SLUG } from "./Asset";
import { BGMToolbar } from "./Toolbar";
import { BGMView } from "./View";
import {
  DEFAULT_BGM_PROPS,
  normalizeBGMOpacity,
  normalizeBGMVolume,
  type BGMComponent,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createBGMComponent({ createId }: InstantiateHelpers): BGMComponent {
  return {
    id: createId(),
    type: "bgm",
    data: "",
    props: { ...DEFAULT_BGM_PROPS },
  };
}

function renderBGMComponent({
  component,
  helpers,
}: ComponentRenderParams<BGMComponent>) {
  const props = component.props ?? {};

  return (
    <BGMView
      src={component.data ?? ""}
      fileName={typeof props.fileName === "string" ? props.fileName : ""}
      muted={
        helpers.isEditable
          ? typeof props.muted === "boolean"
            ? props.muted
            : false
          : (helpers.bgmMuted ?? false)
      }
      volume={normalizeBGMVolume(props.volume)}
      loop={typeof props.loop === "boolean" ? props.loop : true}
      backgroundColor={
        typeof props.backgroundColor === "string"
          ? props.backgroundColor
          : DEFAULT_BGM_PROPS.backgroundColor
      }
      iconColor={
        typeof props.iconColor === "string"
          ? props.iconColor
          : DEFAULT_BGM_PROPS.iconColor
      }
      opacity={normalizeBGMOpacity(props.opacity)}
      isEditable={helpers.isEditable}
      isBlocked={!helpers.isEditable && helpers.bgmBlocked}
      onToggleMute={helpers.isEditable ? undefined : helpers.onBGMToggleMute}
    />
  );
}

const manifest: ComponentManifest<BGMComponent> = {
  slug: BGM_COMPONENT_SLUG,
  type: "bgm",
  category: "content",
  label: "BGM",
  Asset: BGMAsset,
  Toolbar: BGMToolbar,
  create: createBGMComponent,
  render: renderBGMComponent,
};

export default manifest;
export { createBGMComponent };
export type { BGMComponent };
