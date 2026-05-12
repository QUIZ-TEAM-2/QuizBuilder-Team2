import type { Component, GroupChild, ComponentPosition } from "@/types";

export interface GroupComponent extends Component {
  type: "group";
  children: GroupChild[];
  position: ComponentPosition;
}

export const GROUP_COMPONENT_SLUG = "group";






