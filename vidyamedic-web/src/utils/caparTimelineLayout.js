const MAX_STACK_SLOTS = 15;
const MIN_HORIZONTAL_GAP = 18;
const VERTICAL_GAP = 16;
const MIN_LANE_HEIGHT = 44;
const NODE_CLEARANCE = 32;

function getStackOffset(slot) {
  if (slot === 0) return 0;
  const magnitude = Math.ceil(slot / 2);
  return (slot % 2 === 1 ? magnitude : -magnitude) * VERTICAL_GAP;
}

export function getCaparTimelineStackLayout(entries, getId, getActivity, getX) {
  const tracksByActivity = new Map();
  const offsets = new Map();
  const laneHeights = new Map();

  entries.forEach((entry) => {
    const activity = getActivity(entry);
    const x = getX(entry);
    const tracks = tracksByActivity.get(activity) || [];
    let slot = tracks.findIndex((lastX) => x - lastX >= MIN_HORIZONTAL_GAP);

    if (slot < 0 && tracks.length < MAX_STACK_SLOTS) {
      slot = tracks.length;
      tracks.push(x);
    } else if (slot < 0) {
      slot = tracks.indexOf(Math.min(...tracks));
      tracks[slot] = x;
    } else {
      tracks[slot] = x;
    }

    tracksByActivity.set(activity, tracks);
    offsets.set(String(getId(entry)), getStackOffset(slot));
    const maxOffset = Math.ceil((tracks.length - 1) / 2) * VERTICAL_GAP;
    laneHeights.set(
      activity,
      Math.max(MIN_LANE_HEIGHT, (maxOffset * 2) + NODE_CLEARANCE)
    );
  });

  return { offsets, laneHeights };
}
