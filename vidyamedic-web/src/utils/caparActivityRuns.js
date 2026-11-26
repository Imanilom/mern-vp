export function groupChronologicalActivityRuns(entries, {
  getActivity,
  getTime,
  getEndTime,
  getStreamKey,
  getMaxGap,
  canMerge = () => true,
}) {
  const ordered = [...entries].sort((first, second) => (
    getTime(first) - getTime(second)
    || String(first._id || first.id).localeCompare(String(second._id || second.id))
  ));
  const runsByStream = new Map();

  for (const entry of ordered) {
    const time = getTime(entry);
    if (!Number.isFinite(time)) continue;
    const endTime = getEndTime(entry) ?? time;
    const streamKey = String(getStreamKey(entry));
    const streamRuns = runsByStream.get(streamKey) || [];
    const run = streamRuns[streamRuns.length - 1];
    const previous = run?.entries[run.entries.length - 1];
    const previousEndTime = previous ? getEndTime(previous) ?? getTime(previous) : null;
    const gap = previous ? time - previousEndTime : null;
    const continues = previous
      && getActivity(previous) === getActivity(entry)
      && gap <= getMaxGap(previous, entry)
      && canMerge(previous, entry);

    if (!continues) {
      streamRuns.push({
        activity: getActivity(entry),
        stream_key: streamKey,
        start_time: time,
        end_time: endTime,
        entries: [entry],
      });
      runsByStream.set(streamKey, streamRuns);
      continue;
    }

    run.entries.push(entry);
    run.end_time = Math.max(run.end_time, endTime);
    runsByStream.set(streamKey, streamRuns);
  }

  return [...runsByStream.values()]
    .flat()
    .sort((first, second) => first.start_time - second.start_time
      || first.stream_key.localeCompare(second.stream_key));
}
