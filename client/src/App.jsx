import React, { useState } from 'react'
import './chart.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/LandingPage/Home';
import About from './pages/LandingPage/About';
import Project from './pages/LandingPage/Project';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Side';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import Profile from './pages/Menus/Profile';
// Dashboard
import Summary from './pages/Menus/Summary';
import Monitor from './pages/Menus/Monitor';
import MedicalHistories from './pages/Menus/MedicalHistories';
import RiskFactor from './pages/Menus/RiskFactor';
import DetectionHistories from './pages/Menus/DetectionHistories';
import Treatment from './pages/Menus/Treatment';
import MyPatients from './pages/Menus/MyPatients';


import CreatePrediction from './pages/Menus/CreatePrediction';
import RiskPrediction from './pages/Menus/RiskPrediction';
// Crud

// Recomendation
import Recommendation from './pages/Menus/Recommendation';
import CreateRecomendation from './pages/Menus/CreateRecomendation';
import UpdateRecomendation from './pages/Menus/UpdateRecomendation';
import RecomendationDetail from './pages/Menus/RecomendationDetail';

//Activity >>
import Activity from './pages/Menus/Activity';
import CreateActivity from './pages/Menus/CreateActivity';
import UpdateActivity from './pages/Menus/UpdateActivity';
import SetActivity from './pages/Menus/SetActivity';
//Activity END >>

// Anamnesa
import Anamnesa from './pages/Menus/Anamnesa';
import InputMedicalHistory from './pages/Menus/InputMedicalHistory';
// Private Route

import PrivateRoute from './components/PrivateRoute';
import CreateAnamnesa from './pages/Menus/CreateAnamnesa';
import UpdateAnemnesa from './pages/Menus/UpdateAnemnesa';
import CreateTreatment from './pages/Menus/CreateTreatment';
import UpdateTreatment from './pages/Menus/UpdateTreatment';

import { useLocation } from 'react-router-dom';
import AddPatient from './pages/Menus/AddPatient';
import FaktorResiko from './pages/Menus/FaktorResiko';
import WriteDoc from './pages/Menus/WriteDoc';
import InputLabotarium from './pages/Menus/InputLabotarium';
import MonitorDFA from './pages/Menus/MonitorDFA';

export default function App() {

  return (
    <>
      <BrowserRouter>
        {/* <Header /> */}
        <MainContent />
      </BrowserRouter>

    </>
  )
}


function MainContent() {

  const location = useLocation();

  // List of paths where Header should not be displayed
  const noHeaderPaths = ['/sign-in', '/sign-up'];

  return (
    <>
     {!noHeaderPaths.includes(location.pathname) && <Header />}
    <Routes>
      <Route path='/sign-in' element={<SignIn />} />
      <Route path='/sign-up' element={<SignUp />} />
      <Route path='/' element={<Home />} />
      {/* <Route path='/' element={<Test3d />} /> */}
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
        {/* tambah labotarium baru  */}
        <Route path='/faktor-resiko/:id' element={<RiskFactor />} />
        <Route path='/faktor-resiko/:id/add' element={<InputLabotarium />} />
        <Route path='/prediksi-faktor' element={<RiskPrediction />} />
        <Route path='/riwayat-deteksi' element={<DetectionHistories />} />
        <Route path='/treatment' element={<Treatment />} />
        <Route path='/rekomendasi' element={<Recommendation />} />
        <Route path='/add/pasient/:id' element={<AddPatient />} />

      </Route>
    </Routes>
    <Footer />
    </>

  )
}
