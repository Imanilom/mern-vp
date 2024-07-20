import React from 'react'
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
import RiskPrediction from './pages/Menus/RiskPrediction';
import DetectionHistories from './pages/Menus/DetectionHistories';
import Treatment from './pages/Menus/Treatment';
import MyPatients from './pages/Menus/MyPatients';
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
//Activity END >>

// Anamnesa
import Anamnesa from './pages/Menus/Anamnesa';
// Private Route

import PrivateRoute from './components/PrivateRoute';

export default function App() {

  return (
    <BrowserRouter>
      <Header />
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
          <Route path='/activity' element={<Activity />} />
          <Route path='/my-patients' element={<MyPatients />} />
      
          <Route path='/rekomendasi/detail/:id' element={<RecomendationDetail />} />
          <Route path='/createRecomendation' element={<CreateRecomendation />} />
          <Route path='/updateRecomendation/:id' element={<UpdateRecomendation />} />
          <Route path='/createActivity' element={<CreateActivity />} />
          <Route path='/updateActivity/:id' element={<UpdateActivity />} />
          <Route path='/riwayat-medis' element={<MedicalHistories />} />
          <Route path='/faktor-resiko' element={<RiskFactor />} />
          <Route path='/prediksi-faktor' element={<RiskPrediction />} />
          <Route path='/riwayat-deteksi' element={<DetectionHistories />} />
          <Route path='/treatment' element={<Treatment />} />
          <Route path='/rekomendasi' element={<Recommendation />} />
          <Route path='/anamnesa' element={<Anamnesa />} />
        </Route>
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
