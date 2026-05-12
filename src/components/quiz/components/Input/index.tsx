import { InputAsset, INPUT_COMPONENT_SLUG } from "./Asset";
import { InputView } from "./View";
import { InputToolbar } from "./Toolbar";
import {
  type InputComponent,
  DEFAULT_INPUT_PLACEHOLDER,
  DEFAULT_INPUT_COLOR,
  DEFAULT_INPUT_TEXT_COLOR,
  DEFAULT_INPUT_MAX_LENGTH,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createInputComponent({ createId }: InstantiateHelpers): InputComponent {
  return {
    id: createId(),
    type: "input",
    props: {
      placeholder: DEFAULT_INPUT_PLACEHOLDER,
      maxLength: DEFAULT_INPUT_MAX_LENGTH,
      color: DEFAULT_INPUT_COLOR,
      textColor: DEFAULT_INPUT_TEXT_COLOR,
    },
  };
}

function renderInputComponent({
  component,
  helpers,
}: ComponentRenderParams<InputComponent>) {
  const props = component.props ?? {};

  return (
    <InputView
      placeholder={
        typeof props.placeholder === "string"
          ? props.placeholder
          : DEFAULT_INPUT_PLACEHOLDER
      }
      maxLength={
        typeof props.maxLength === "number"
          ? props.maxLength
          : DEFAULT_INPUT_MAX_LENGTH
      }
      color={
        typeof props.color === "string" ? props.color : DEFAULT_INPUT_COLOR
      }
      textColor={
        typeof props.textColor === "string"
          ? props.textColor
          : DEFAULT_INPUT_TEXT_COLOR
      }
      onInputChange={
        helpers.onTextChange
          ? (value) => helpers.onTextChange?.(component.id, value)
          : undefined
      }
      isEditable={helpers.isEditable}
    />
  );
}

const manifest: ComponentManifest<InputComponent> = {
  slug: INPUT_COMPONENT_SLUG,
  type: "input",
  category: "content",
  label: "Input Box",
  Asset: InputAsset,
  Toolbar: InputToolbar,
  create: createInputComponent,
  render: renderInputComponent,
};

export default manifest;
export type { InputComponent };
