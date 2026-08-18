import express from 'express';
import { 
    getPingbodycomposition,
    getPingdailies,
    getPingderegistration,
    getPingepochs,
    getPingpulseox,
    getPingrespiration,
    getPingsleeps,
    getPingstress,
    getPingthirdpartydailies,
    getPinguser,
    getPingusermetrics,
    getPingbloodpressure,
    getPinghrvsummary,
    getPinghealthsanpshot,
    getPingactivites,
    getPingactivitesdetails,
    getPingactivitesfiles,
    getPingactivitesmovelQ,
    getPingmanuallyupdatedactivites,
     } from '../controllers/garmin.controller.js';

const router = express.Router();

router.post("/getPingbodycomposition", getPingbodycomposition);
router.post("/getPingdailies", getPingdailies);
router.post("/getPingderegistration", getPingderegistration);
router.post("/getPingepochs", getPingepochs);
router.post("/getPingpulseox", getPingpulseox);
router.post("/getPingrespiration", getPingrespiration);
router.post("/getPingsleeps", getPingsleeps);
router.post("/getPingstress", getPingstress);
router.post("/getPingthirdpartydailies", getPingthirdpartydailies);
router.post("/getPinguser", getPinguser);
router.post("/getPingusermetrics", getPingusermetrics);
router.post("/getPingbloodpressure", getPingbloodpressure);
router.post("/getPinghrvsummary", getPinghrvsummary);
router.post("/getPinghealthsanpshot", getPinghealthsanpshot);
router.post("/getPingactivites", getPingactivites);
router.post("/getPingactivitesdetails", getPingactivitesdetails);
router.post("/getPingactivitesfiles", getPingactivitesfiles);
router.post("/getPingactivitesmovelQ", getPingactivitesmovelQ);
router.post("/getPingmanuallyupdatedactivites", getPingmanuallyupdatedactivites);

export default router;