import Aktivitas from '../models/activity.model.js';
import Log from '../models/log.model.js';
import { errorHandler } from '../utils/error.js';
import bcryptjs from 'bcryptjs';

export const createActivity = async (req, res, next) => {
  try {
    const { userRef, tanggal, awal, akhir, aktivitas } = req.body;
    // merubah format H:M to H:M:S

    let checkFormatTimeAwal = awal.split(':');
    let checkFormatTimeAkhir = akhir.split(':');

    let newFormatAwal = checkFormatTimeAwal.length > 2 ? awal : `${awal}:00`;
    let newFormatAkhir = checkFormatTimeAkhir.length > 2 ? akhir : `${akhir}:00`;


    const Activity = await Aktivitas.create({ userRef, Date: new Date(tanggal), awal: newFormatAwal, akhir: newFormatAkhir, aktivitas });

    // Lets make reference logs with the activity
    let day = new Date(tanggal);
    let dmy = `${String(day.getDate()).padStart(2, '0')}-${String(day.getMonth() + 1).padStart(2, '0')}-${day.getFullYear()}`;

    let filter = {
      date: dmy,
      time: {
        $gte: newFormatAwal,
        $lte: newFormatAkhir
      }
    }
    
    const logs = await Log.updateMany(filter, {
      $set: {
        activity_ref: Activity._id,
        activity: aktivitas
      }
    })

    return res.status(201).json({ Activity: Activity, message: 'Created Activity succes' });
  } catch (error) {
    next(error);
  }
}

export const getActivity = async (req, res, next) => { // mark
  try {

    //get activities by credential user login
    let Activity;
    if (req.user.role == 'user') {
      // state role user
      Activity = await Aktivitas.find({ userRef: req.user.id }).sort({ create_at: -1 });
    } else {

      // state role docter
      Activity = await Aktivitas.find({ userRef: req.params.patient }).sort({ create_at: -1 }); // harusnya dia bawa id user. bukan req.user.id docter
      // console.log(req.params.patient);
    }

    if (!Activity) {
      return next(errorHandler(404, 'Activity not found!'));
    }
    res.status(200).json(Activity);
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    const Activity = await Aktivitas.findById(req.params.id);
    if (!Activity) {
      return next(errorHandler(404, 'Activity not found!'));
    }
    res.status(200).json(Activity);
  } catch (error) {
    next(error);
  }
};

export const editActivity = async (req, res, next) => {

  const { userRef, awal, akhir, aktivitas, Date } = req.body;

  const Activity = await Aktivitas.findById(req.params.id);
  if (!Activity) {
    return next(errorHandler(404, 'Activity not found!'));
  }

  if (req.user.id !== Activity.userRef) {
    return next(errorHandler(401, 'You can only update your own Activity!'));
  }

  try {
    let checkFormatTimeAwal = awal.split(':');
    let checkFormatTimeAkhir = akhir.split(':');

    let newFormatAwal = checkFormatTimeAwal.length > 2 ? awal : `${awal}:00`;
    let newFormatAkhir = checkFormatTimeAkhir.length > 2 ? akhir : `${akhir}:00`;

    const updatedActivity = await Aktivitas.findByIdAndUpdate(
      req.params.id,
      { userRef, Date, awal: newFormatAwal, akhir: newFormatAkhir, aktivitas },
      { new: true }
    );

    res.status(200).json(updatedActivity);

  } catch (error) {
    console.log(error)
    // next(error);
  }
}

export const deleteActivity = async (req, res, next) => {
  const Activity = await Aktivitas.findById(req.params.id);

  if (!Activity) {
    return next(errorHandler(404, 'Aktivitas not found!'));
  }

  if (req.user.id !== Activity.userRef) {
    return next(errorHandler(401, 'You can only delete your own Aktivitas!'));
  }

  try {
    await Aktivitas.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Aktivitas has been deleted!' });
  } catch (error) {
    next(error);
  }
}

