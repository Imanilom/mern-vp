import Aktivitas from '../models/activity.model.js';
import { errorHandler } from '../utils/error.js';
import bcryptjs from 'bcryptjs';

export const createActivity = async (req, res, next) => {
  try {
    const { userRef, date, awal, akhir, aktivitas } = req.body;
    const Activity = await Aktivitas.create({ userRef, date, awal, akhir, aktivitas });
    return res.status(201).json(Activity);
  } catch (error) {
    next(error);
  }
}

export const readActivity = async (req, res, next) => {

}

export const getActivity = async (req, res, next) => {
  try {
    //get activities by credential user login
    const Activity = await Aktivitas.find({userRef : req.user.id}).sort({create_at : -1});
    
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

  const { userRef, date, awal, akhir, aktivitas } = req.body;
  const Activity = await Aktivitas.findById(req.params.id);
  if (!Activity) {
    return next(errorHandler(404, 'Activity not found!'));
  }

  if (req.user.id !== Activity.userRef) {
    return next(errorHandler(401, 'You can only update your own Activity!'));
  }

  try {

    const updatedActivity = await Aktivitas.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updatedActivity);
  } catch (error) {
    next(error);
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
    res.status(200).json({message : 'Aktivitas has been deleted!'});
  } catch (error) {
    next(error);
  }
}

