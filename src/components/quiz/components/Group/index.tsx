import { GroupAsset, GROUP_COMPONENT_SLUG } from "./Asset";
import { GroupView } from "./View";
import { GroupToolbar } from "./Toolbar";
import { type GroupComponent } from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createGroupComponent({ createId }: InstantiateHelpers): GroupComponent {
  // Groups are not typically created directly - they're created by merging components
  // This is just a fallback
  return {
    id: createId(),
    type: "group",
    children: [],
    position: {
      x: 0,
      y: 10,
      width: 50,
      height: 30,
    },
  };
}

function renderGroupComponent({
  component,
  helpers: _helpers,
}: ComponentRenderParams<GroupComponent>) {
  // The actual rendering happens in PhonePreview which calculates pixel dimensions
  // This is a placeholder that will be replaced by the PhonePreview's group rendering
  const children = component.children ?? [];
  
  if (children.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        Empty group
      </div>
    );
  }

  // Render children - dimensions will be calculated by the parent container
  return <GroupView groupChildren={children} _groupWidth={100} _groupHeight={100} />;
}

const manifest: ComponentManifest<GroupComponent> = {
  slug: GROUP_COMPONENT_SLUG,
  type: "group",
  category: "content",
  label: "Group",
  Asset: GroupAsset,
  Toolbar: GroupToolbar,
  create: createGroupComponent,
  render: renderGroupComponent,
};

export default manifest;
export type { GroupComponent };

