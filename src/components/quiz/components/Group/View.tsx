"use client";

import React from "react";
import type { Component, ComponentType, GroupChild } from "@/types";
import { getManifestByType } from "@/lib/quizComponents";

export interface GroupViewProps {
  groupChildren: GroupChild[];
  /** Width of the group in pixels (for calculating child dimensions) */
  _groupWidth: number;
  /** Height of the group in pixels (for calculating child dimensions) */
  _groupHeight: number;
}

/**
 * Renders the children of a group component.
 * Each child has a relativePosition that is converted to absolute pixels within the group bounds.
 */
export function GroupView({ groupChildren, _groupWidth, _groupHeight }: GroupViewProps) {
  return (
    <div className="relative h-full w-full">
      {groupChildren.map((child) => {
        const manifest = getManifestByType(child.type as ComponentType);
        if (!manifest) return null;

        const relPos = child.relativePosition;
        
        // Convert relative position to CSS within the group
        // relativeX is percentage offset from center (-50 to 50)
        // relativeY is percentage from top (0-100)
        // width/height are percentages of group dimensions
        const childWidthPct = relPos.width;
        const childHeightPct = relPos.height;
        
        // Convert center-based x to left position
        // centerOffset as percentage of group + 50 (center) - half of child width
        const leftPct = 50 + relPos.x - relPos.width / 2;
        const topPct = relPos.y;

        // Create a pseudo-component for rendering
        const pseudoComponent: Component = {
          id: child.id,
          type: child.type,
          data: child.data,
          props: child.props,
          action: child.action,
          actionProps: child.actionProps,
        };

        const helpers = {
          isEditable: false,
          selectedComponentId: undefined,
          editingComponentId: undefined,
        };

        return (
          <div
            key={child.id}
            className="absolute overflow-hidden"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${childWidthPct}%`,
              height: `${childHeightPct}%`,
            }}
          >
            {manifest.render({ component: pseudoComponent, helpers })}
          </div>
        );
      })}
    </div>
  );
}

export default GroupView;
