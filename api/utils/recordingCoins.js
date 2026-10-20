export function localRecordingDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isCoinEligibleRecording(sample) {
  return sample?.is_simulated !== true
    && sample?.sensor_contact === true
    && Array.isArray(sample?.rr_intervals_ms)
    && sample.rr_intervals_ms.length > 0
    && sample?.recorded_at instanceof Date
    && Number.isFinite(sample.recorded_at.getTime());
}

export async function awardRecordingDayCoin({
  CoinModel,
  accountId,
  accountType,
  sample,
  timezone,
}) {
  if (!isCoinEligibleRecording(sample)) return false;
  const recordingDate = localRecordingDate(sample.recorded_at, timezone);
  try {
    const result = await CoinModel.updateOne(
      {
        account_id: accountId,
        account_type: accountType,
        recording_date: recordingDate,
      },
      {
        $setOnInsert: {
          account_id: accountId,
          account_type: accountType,
          recording_date: recordingDate,
          timezone,
          awarded_at: new Date(),
          sample_id: sample._id,
        },
      },
      { upsert: true, runValidators: true }
    );
    return result.upsertedCount === 1;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}
