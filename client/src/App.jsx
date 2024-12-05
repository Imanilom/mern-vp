// File untuk routing di bagian Frontend

import React, { useState } from 'react'
import './chart.css'; // import css file untuk grafik
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLocation } from 'react-router-dom';


// Components
import Header from './components/Header';
import Footer from './components/Footer';
import PrivateRoute from './components/PrivateRoute';


// Landing Pages
import Home from './pages/LandingPage/Home';
import About from './pages/LandingPage/About';
import Project from './pages/LandingPage/Project';


// AUTH PAGE
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';


// MAIN PAGE
import Profile from './pages/Menus/Profile';
import Summary from './pages/Menus/Summary';
import Monitor from './pages/Menus/Monitor';
import MedicalHistories from './pages/Menus/MedicalHistories';
import RiskFactor from './pages/Menus/RiskFactor';
import DetectionHistories from './pages/Menus/DetectionHistories';
import Treatment from './pages/Menus/Treatment';
import MyPatients from './pages/Menus/MyPatients';
import RiskPrediction from './pages/Menus/RiskPrediction';
import Recommendation from './pages/Menus/Recommendation';
import Activity from './pages/Menus/Activity';
import AddPatient from './pages/Menus/AddPatient';
import FaktorResiko from './pages/Menus/FaktorResiko';
import WriteDoc from './pages/Menus/WriteDoc';
import MonitorDFA from './pages/Menus/MonitorDFA';
import Metrics from './pages/Menus/Metrics';
import MonitorActivity from './pages/Menus/MonitorActivity';


// HALAMAN CREATE
import CreatePrediction from './pages/Menus/CreatePrediction';
import CreateRecomendation from './pages/Menus/CreateRecomendation';
import SetActivity from './pages/Menus/SetActivity';
import CreateAnamnesa from './pages/Menus/CreateAnamnesa';
import CreateTreatment from './pages/Menus/CreateTreatment';
import InputMedicalHistory from './pages/Menus/InputMedicalHistory';
import InputLabotarium from './pages/Menus/InputLabotarium';


// HALAMAN UPDATE
import UpdateRecomendation from './pages/Menus/UpdateRecomendation';
import UpdateActivity from './pages/Menus/UpdateActivity';
import UpdateAnemnesa from './pages/Menus/UpdateAnemnesa';
import UpdateTreatment from './pages/Menus/UpdateTreatment';


export default function App() {

  return (
    <>
      <BrowserRouter>
      {/* import main content here --> */}
        <MainContent /> 
      </BrowserRouter>

    </>
  )
}


function MainContent() {

  const location = useLocation();

  // List url yang ga perlu nampilin component header dan footer
  const noHeaderPaths = ['/sign-in', '/sign-up'];

  return (
    <>
     {!noHeaderPaths.includes(location.pathname) && <Header />}
    <Routes>

      <Route path='/sign-in' element={<SignIn />} />
      <Route path='/sign-up' element={<SignUp />} />
      <Route path='/' element={<Home />} />
      <Route path='/about' element={<About />} />
      <Route path='/project' element={<Project />} />


      {/* PRIVATE ROUTE */}
      <Route element={<PrivateRoute />}>
        <Route path='/profile' element={<Profile />} />
        <Route path='/ringkasan-pasien' element={<Summary />} />
        <Route path='/monitor' element={<Monitor />} />
        <Route path='/monitor/dfa' element={<MonitorDFA />} />
        <Route path='/activity' element={<Activity />} />
        <Route path='/set/activity/:encrypt' element={<SetActivity />} />
        <Route path='/my-patients' element={<MyPatients />} />
        <Route path='/input-medical' element={<InputMedicalHistory />} />
        <Route path='/createAnamnesa/:riwayatid' element={<CreateAnamnesa />} />
        <Route path='/create/prediksi_factor' element={<CreatePrediction />} />
        <Route path='/treatment/create' element={<CreateTreatment />} />

        
        <Route path='/createRecomendation' element={<CreateRecomendation />} />
        <Route path='/updateAnemnesa/:id' element={<UpdateAnemnesa />} />
        <Route path='/updateRecomendation/:id' element={<UpdateRecomendation />} />
        <Route path='/updateActivity/:id' element={<UpdateActivity />} />
        <Route path='/treatment/update/:id' element={<UpdateTreatment />} />
        <Route path='/riwayat-medis' element={<MedicalHistories />} />
        <Route path='/faktor-resiko' element={<FaktorResiko />} />
        <Route path='/faktor-resiko/doc' element={<WriteDoc />} /> 

        <Route path='/faktor-resiko/:id' element={<RiskFactor />} />
        <Route path='/faktor-resiko/:id/add' element={<InputLabotarium />} />
        <Route path='/prediksi-faktor' element={<RiskPrediction />} />
        <Route path='/riwayat-deteksi' element={<DetectionHistories />} />
        <Route path='/treatment' element={<Treatment />} />
        <Route path='/rekomendasi' element={<Recommendation />} />
        <Route path='/add/pasient/:id' element={<AddPatient />} />
        <Route path='/monitor/metrics' element={<Metrics />} />
        <Route path='/monitor/activity' element={<MonitorActivity />} />
      </Route>
    </Routes>
    <Footer />
    </>

  )
}
