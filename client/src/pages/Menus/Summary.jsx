import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link, useNavigate } from 'react-router-dom';

import {
    docterUnsetUser
} from '../../redux/user/userSlice.js';
import ButtonOffCanvas from '../../components/ButtonOffCanvas.jsx';
import AOS from 'aos';
import Swal from 'sweetalert2';


function Summary() {
    // const isLightMode_ = ;
    // current user = informasi user yang login
    // DocterPatient = informasi pasien yang sedang di monitoring
    const { currentUser, loading, error, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [data, setData] = useState({
        Faktor_Resiko: '',
        Hasil_Prediksi: '',
        Riwayat_Deteksi: '',
        Rekomendasi_Terakhir: '',
        Treatment_Terakhir: '',
    });
    const [infoDokter, setInfoDokter] = useState('null');
    const [showInfoDokter, setShowInfo] = useState(true);

    const fetchInit = async () => {
        try {
            // Set default url untuk user
            let url = '/api/predictionfactor/getinfo';
            let url2 = `/api/recomendation/getAll/${currentUser._id}`;
            let url3 = '/api/treatment/getTreatment';
            let url4 = `/api/user/riwayatdeteksi/${currentUser._id}`

            if (currentUser.role == 'user') {
                // Jika usser role == user
                url3 += `/${currentUser._id}`;
            } else {
                // Jika role nya dokter, ubah url API nya 
                url += `?patient=${DocterPatient._id}`;
                url2 = `/api/recomendation/getAll/${DocterPatient._id}`;
                url3 += `/${DocterPatient._id}`
                url4 = `/api/user/riwayatdeteksi/${DocterPatient._id}`
            }

            const res2 = await fetch(url2);
            const data2 = await res2.json();

            setInfoDokter(data2.recomendation[data2.recomendation.length - 1]['doctor']);

            // Lakukan request ke API server
            const [res, res3, res4] = await Promise.all([
                await fetch(url),
                // await fetch(url2),
                await fetch(url3),
                await fetch(url4),
            ]);

            const [data, data3, data4] = await Promise.all([
                await res.json(),
                // await res2.json(),
                await res3.json(),
                await res4.json(),
            ]);

            console.log({ data, data2, data3, data4 })
            let property = {};

            property.Faktor_Resiko = data.prediction.supporting_risks ?? [];
            property.Hasil_Prediksi = data.prediction.result_prediction ?? '';
            property.Riwayat_Deteksi = data4.riwayat[0] ?? [];
            property.Rekomendasi_Terakhir = data2.recomendation[data2.recomendation.length - 1]['name'];
            property.Treatment_Terakhir = data3.history[data3.history.length - 1]['diagnosis'];

            // Simpan informasi untuk ditampilkan
            setData(property);
        } catch (error) {
            console.log({ error })
        }
    }

    useEffect(() => {
        // Panggil AOS untuk animasi on scrool
        AOS.init({
            duration: 700
        })

        fetchInit(); // run function
    }, []);


    // handle untuk stop monitoring pasien
    const handleUnsignPatient = () => {
        // Panggil pop up sweetalert2 untuk konfirmasi
        Swal.fire({
            title: "Are you sure?",
            text: "Kamu bisa monitoring pasien ini di lain waktu",
            icon: "info",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, of course"
        }).then((result) => {
            if (result.isConfirmed) {
                // Jika dokter mengkonfirmsi, maka informasi pasien di redux akan di hapus
                dispatch(docterUnsetUser());

                // arahkan ke halaman pilih pasien
                navigate('/my-patients');
            }
        });
    }

    return (
        <div>
            <main>
                <section class="bg-[#101010] dark:bg-[#FEFCF5] md:flex  text-white/95 dark:text-[#073B4C]">
                    <Side />
                    <div class="container px-6 py-10 mx-auto">
                        {/* <ButtonOffCanvas index={1} /> */}
                        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl " >Heart Disease Monitoring, Detection and Predictive System </h1>
                        <div class="mt-8 w-11/12 mx-auto lg:flex lg:items-start">
                            <div data-aos="fade-right" className='w-full lg:mx-6 lg:w-2/3'>
                                <div className="relative">

                                    <img class="object-cover rounded-xl h-72 lg:h-96" src={currentUser.role != 'user' ? DocterPatient.profilePicture : currentUser.profilePicture}
                                        alt="" />
                                </div>

                                <div class="rounded-md relative mt-3 flex flex-col min-w-0 break-words bg-[#363636]/20 dark:bg-[#217170]  w-full mb-6 shadow-lg duration-300 lg:hover:translate-x-[-20px] group">
                                    <div class="mb-0 px-4 py-3 border-0 text-white dark:text-white ">
                                        <div class="flex flex-wrap items-center">
                                            <div class="relative w-full lg:px-4 max-w-full flex-grow flex justify-between flex-1">

                                                <h3 class="font-semibold text-base text-blueGray-700">Biodata Pasien</h3>

                                                {currentUser.role != 'user' ? (
                                                    <button onClick={() => handleUnsignPatient()} className='bg-red-600 focus:bg-red-600/90 text-white px-3 py-1 rounded-md text-sm'>Berhenti Monitoring</button>
                                                ) : (
                                                    <Link to={`/profile`} className='text-sm text-[#07AC7B] dark:text-[#FFD166] font-semibold'>Edit information</Link>

                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    <div class="block w-full overflow-x-auto">


                                        <table class="min-w-full shadow-xl overflow-hidden">
                                            <tbody>
                                                <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7] ">
                                                    <th class="px-6 py-4 text-left text-sm font-medium">
                                                        Nama
                                                    </th>
                                                    <td class="px-6 py-4 text-sm ">
                                                        {currentUser.role != 'user' ? DocterPatient.name : currentUser.name}
                                                    </td>
                                                </tr>
                                                <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                                    <th class="px-6 py-4 text-left text-sm font-medium ">
                                                        Usia
                                                    </th>
                                                    <td class="px-6 py-4 text-sm ">
                                                        21
                                                    </td>
                                                </tr>
                                                <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                                    <th class="px-6 py-4 text-left text-sm font-medium ">
                                                        Jenis Kelamin
                                                    </th>
                                                    <td class="px-6 py-4 text-sm ">
                                                        Laki-laki
                                                    </td>
                                                </tr>
                                                <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                                    <th class="px-6 py-4 text-left text-sm font-medium ">
                                                        Alamat
                                                    </th>
                                                    <td class="px-6 py-4 text-sm ">
                                                        {currentUser.role != 'user' ? DocterPatient.address : currentUser.address}

                                                    </td>
                                                </tr>
                                                {/* <tr class="bg-[#2C2C2C] ">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Dokter
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {currentUser.role != 'user' ? currentUser.name : currentUser.name}

                                                    </td>
                                                </tr> */}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div data-aos="fade-up" class="mt-6 lg:w-2/3 lg:mt-0 lg:mx-6 ">
                                <div className="flex text-sm justify-between bg-[#363636]/20 dark:bg-[#217170] text-white rounded-md my-3 px-6 py-3">
                                    <p>Informasi pribadi dokter anda</p>
                                    <p className='text-[#07AC7B] dark:text-[#FFD166] cursor-pointer' onClick={() => setShowInfo(!showInfoDokter)}>
                                        {showInfoDokter ? 'Hide' : 'Show'}
                                    </p>
                                </div>
                                <div className="relative">
                                    <img class="object-cover rounded-xl h-72 lg:h-60 w-full mb-3" src={currentUser.role != 'user' ? currentUser.profilePicture : infoDokter.profilePicture}
                                        alt="" />
                                    <div className="w-full h-full bg-[#363636]/50 absolute top-0 left-0"></div>

                                </div>

                                {showInfoDokter ? (
                                    <div class="relative flex flex-col min-w-0 break-words bgg-bl w-full mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                                        <div class=" bg-[#363636]/20 dark:bg-[#217071] rounded-t mb-0 px-4 py-3 border-0">
                                            <div class="flex flex-wrap items-center">
                                                <div class="relative w-full lg:px-4 max-w-full flex-grow flex justify-between flex-1">

                                                    <h3 class="font-semibold text-base text-blueGray-700 text-white">Biodata Dokter</h3>
                                                </div>

                                            </div>
                                        </div>

                                        <div class="block w-full overflow-x-auto">
                                            <table class="min-w-full bgg-bl shadow-xl overflow-hidden">

                                                <tbody>
                                                    <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                                        <th class="px-6 py-4 text-left text-sm font-medium">
                                                            Nama
                                                        </th>
                                                        <td class="px-6 py-4 text-sm text-[#07AC7B] dark:text-[#073B4C]">
                                                            {currentUser.role != 'user' ? currentUser.name : infoDokter.name}
                                                        </td>
                                                    </tr>
                                                    <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                                        <th class="px-6 py-4 text-left text-sm font-medium ">
                                                            Email
                                                        </th>
                                                        <td class="px-6 py-4 text-sm text-[#07AC7B] dark:text-[#073B4C]">
                                                            {currentUser.role != 'user' ? currentUser.email : infoDokter.email}
                                                        </td>
                                                    </tr>

                                                    <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                                        <th class="px-6 py-4 text-left text-sm font-medium ">
                                                            Role
                                                        </th>
                                                        <td class="px-6 py-4 text-sm text-[#07AC7B] dark:text-[#073B4C]">
                                                            Dokter
                                                        </td>
                                                    </tr>

                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : null}
                                {/* Ringkasan Riwayat Medis */}

                            </div>


                        </div>

                        <div data-aos="fade-right" class="w-11/12 mx-auto lg:mx-16 relative flex flex-col min-w-0 break-words bg-[#363636]/20 dark:bg-[#217170] mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                            <div class=" mb-0 px-4 py-3 border-0">
                                <div class="flex flex-wrap items-center">
                                    <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                                        <h3 class="font-semibold text-base text-blueGray-700 text-white">Ringkasan Riwayat Medis</h3>
                                    </div>


                                    {/* <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                                        <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">See all</button>
                                    </div> */}
                                </div>
                            </div>

                            <div class="block w-full overflow-x-auto">
                                <table class="min-w-full shadow-md text-sm">
                                    <thead>
                                        <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                            <th class="py-3 px-4 text-left">Feature</th>
                                            <th class="py-3 px-4 text-left">Keterangan</th>
                                            <th class="py-3 px-4 text-left">Tanggal</th>

                                        </tr>
                                    </thead>
                                    <tbody class="text-blue-gray-900">
                                        <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                            <td class="py-3 px-4">Faktor Resiko</td>
                                            <td class="py-3 px-4 text-sm">{data.Faktor_Resiko.length > 0 && data.Faktor_Resiko.map((val) => (<p>-{val}</p>))}</td>
                                            <td class="py-3 px-4">-</td>
                                        </tr>

                                        <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                            <td class="py-3 px-4">Hasil Prediksi</td>
                                            <td class="py-3 px-4">{data.Hasil_Prediksi}</td>
                                            <td class="py-3 px-4">-</td>
                                        </tr>

                                        <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                            <td class="py-3 px-4">Riwayat Deteksi</td>
                                            <td class="py-3 px-4">{data.Riwayat_Deteksi['dfa'] || data.Riwayat_Deteksi['dfa'] <= 0 ? `Tidak dapat menghitung secara akurat` : data.Riwayat_Deteksi['dfa']}</td>
                                            <td class="py-3 px-4">-</td>
                                        </tr>

                                        <tr class="bg-[#2C2C2C] dark:bg-[#E7E7E7]">
                                            <td class="py-3 px-4">Rekomendasi Terakhir</td>
                                            <td class="py-3 px-4">{data.Rekomendasi_Terakhir}</td>
                                            <td class="py-3 px-4">-</td>
                                        </tr>

                                        <tr class="bg-[#141414] dark:bg-[#CBCBCB]">
                                            <td class="py-3 px-4">Treatment Terakhir</td>
                                            <td class="py-3 px-4">{data.Treatment_Terakhir}</td>
                                            <td class="py-3 px-4">-</td>
                                        </tr>

                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}

export default Summary