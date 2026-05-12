import { TextAsset, TEXT_COMPONENT_SLUG } from "./Asset";
import { TextView } from "./View";
import { TextToolbar } from "./Toolbar";
import {
  type TextComponent,
  DEFAULT_TEXT_FONT_SIZE,
  resolveTextFontSize,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createTextComponent({ createId }: InstantiateHelpers): TextComponent {
  return {
    id: createId(),
    type: "text",
    data: "Text",
    props: {
      fontSize: DEFAULT_TEXT_FONT_SIZE,
      align: "center",
      color: "#FFFFFF",
    },
  };
}

function renderTextComponent({
  component,
  helpers,
}: ComponentRenderParams<TextComponent>) {
  const props = component.props ?? {};
  const isEditing = helpers.editingComponentId === component.id;

  return (
    <TextView
      text={component.data ?? ""}
      fontSize={resolveTextFontSize(props.fontSize)}
      align={
        props.align === "left" || props.align === "right" || props.align === "center"
          ? props.align
          : "center"
      }
      bold={props.bold === true}
      italic={props.italic === true}
      underline={props.underline === true}
      color={typeof props.color === "string" ? props.color : undefined}
      isEditing={isEditing}
      onTextChange={isEditing ? (text) => helpers.onTextChange?.(component.id, text) : undefined}
    />
  );
}

const manifest: ComponentManifest<TextComponent> = {
  slug: TEXT_COMPONENT_SLUG,
  type: "text",
  category: "content",
  label: "Text",
  Asset: TextAsset,
  Toolbar: TextToolbar,
  create: createTextComponent,
  render: renderTextComponent,
};

export default manifest;
export type { TextComponent };
