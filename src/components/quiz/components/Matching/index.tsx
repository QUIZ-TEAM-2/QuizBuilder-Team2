import { MatchingAsset } from "./Asset";
import { MatchingToolbar } from "./Toolbar";
import { MatchingViewWrapper } from "./View";
import {
  DEFAULT_MATCHING_BORDER_COLOR,
  DEFAULT_MATCHING_LEFT_NODES,
  DEFAULT_MATCHING_LINE_COLOR,
  DEFAULT_MATCHING_NODE_COLOR,
  DEFAULT_MATCHING_NODE_OPACITY,
  DEFAULT_MATCHING_RIGHT_NODES,
  DEFAULT_MATCHING_TEXT_COLOR,
  type MatchingComponent,
} from "./types";
import type {
  ComponentManifest,
  ComponentRenderParams,
  InstantiateHelpers,
} from "@/lib/quizComponents";

function createMatchingComponent({
  createId,
}: InstantiateHelpers): MatchingComponent {
  return {
    id: createId(),
    type: "matching",
    props: {
      leftNodes: DEFAULT_MATCHING_LEFT_NODES,
      rightNodes: DEFAULT_MATCHING_RIGHT_NODES,
      nodeColor: DEFAULT_MATCHING_NODE_COLOR,
      nodeOpacity: DEFAULT_MATCHING_NODE_OPACITY,
      textColor: DEFAULT_MATCHING_TEXT_COLOR,
      borderColor: DEFAULT_MATCHING_BORDER_COLOR,
      lineColor: DEFAULT_MATCHING_LINE_COLOR,
    },
  };
}

function renderMatchingComponent({
  component,
  helpers,
}: ComponentRenderParams<MatchingComponent>) {
  return <MatchingViewWrapper component={component} helpers={helpers} />;
}

const manifest: ComponentManifest<MatchingComponent> = {
  slug: "matching",
  type: "matching",
  category: "content",
  label: "Matching",
  Asset: MatchingAsset,
  Toolbar: MatchingToolbar,
  create: createMatchingComponent,
  render: renderMatchingComponent,
};

export default manifest;
export type { MatchingComponent };
