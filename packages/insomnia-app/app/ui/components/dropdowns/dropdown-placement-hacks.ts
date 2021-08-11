// @TODO Remove these once we update the dropdown component.

export const svgPlacementHack = {
  // This is a bit of a hack/workaround to avoid some larger changes that we'd need to do with dropdown item icons and tooltips.
  // Without this, the icon is too high with respect to the text because of Tooltip introducing some changes to the placement of the icon.
  marginTop: 1,
};

export const tooltipIconPlacementHack = {
  // see above comment for `svgPlacementHack`.
  marginTop: 3,
};
