import { RankingAsset } from "./Asset";
import { RankingToolbar } from "./Toolbar";
import { RankingView } from "./View";
import {
  DEFAULT_RANKING_ITEM_BORDER_COLOR,
  DEFAULT_RANKING_ITEM_COLOR,
  DEFAULT_RANKING_ITEM_NODE_COLOR,
  DEFAULT_RANKING_ITEM_NODE_OPACITY,
  DEFAULT_RANKING_ITEM_TEXT_COLOR,
  DEFAULT_RANKING_ITEMS,
  RANKING_MAX_ITEMS,
  RANKING_COMPONENT_SLUG,
  type RankingComponent,
  type RankingItem,
} from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createRankingComponent({
  createId,
}: InstantiateHelpers): RankingComponent {
  return {
    id: createId(),
    type: "ranking",
    props: {
      items: DEFAULT_RANKING_ITEMS,
      itemColor: DEFAULT_RANKING_ITEM_COLOR,
      itemNodeColor: DEFAULT_RANKING_ITEM_NODE_COLOR,
      itemNodeOpacity: DEFAULT_RANKING_ITEM_NODE_OPACITY,
      itemTextColor: DEFAULT_RANKING_ITEM_TEXT_COLOR,
      itemBorderColor: DEFAULT_RANKING_ITEM_BORDER_COLOR,
    },
  };
}

function renderRankingComponent({
  component,
  helpers,
}: ComponentRenderParams<RankingComponent>) {
  const props = component.props ?? {};
  const items = Array.isArray(props.items)
    ? (props.items as RankingItem[]).slice(0, RANKING_MAX_ITEMS)
    : DEFAULT_RANKING_ITEMS;

  return (
    <RankingView
      items={items}
      itemColor={
        typeof props.itemColor === "string"
          ? props.itemColor
          : DEFAULT_RANKING_ITEM_COLOR
      }
      itemNodeColor={
        typeof props.itemNodeColor === "string"
          ? props.itemNodeColor
          : DEFAULT_RANKING_ITEM_NODE_COLOR
      }
      itemNodeOpacity={
        typeof props.itemNodeOpacity === "number"
          ? props.itemNodeOpacity
          : typeof props.itemOpacity === "number"
            ? props.itemOpacity
            : DEFAULT_RANKING_ITEM_NODE_OPACITY
      }
      itemTextColor={
        typeof props.itemTextColor === "string"
          ? props.itemTextColor
          : typeof props.itemColor === "string"
            ? props.itemColor
            : DEFAULT_RANKING_ITEM_TEXT_COLOR
      }
      itemBorderColor={
        typeof props.itemBorderColor === "string"
          ? props.itemBorderColor
          : typeof props.itemColor === "string"
            ? props.itemColor
            : DEFAULT_RANKING_ITEM_BORDER_COLOR
      }
      isEditable={helpers.isEditable}
      rankingOrder={helpers.rankingOrder}
      onRankingChange={
        helpers.onRankingChange
          ? (rankingOrder) =>
              helpers.onRankingChange?.(component.id, rankingOrder)
          : undefined
      }
    />
  );
}

const manifest: ComponentManifest<RankingComponent> = {
  slug: RANKING_COMPONENT_SLUG,
  type: "ranking",
  category: "content",
  label: "Ranking",
  Asset: RankingAsset,
  Toolbar: RankingToolbar,
  create: createRankingComponent,
  render: renderRankingComponent,
};

export default manifest;
export type { RankingComponent };
