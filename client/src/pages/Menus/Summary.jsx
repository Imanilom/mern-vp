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

function Summary() {

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

    const fetchInit = async () => {
        try {
            let url = '/api/predictionfactor/getinfo';
            let url2 = `/api/recomendation/getAll/${currentUser._id}`;
            let url3 = '/api/treatment/getTreatment';
            let url4 = `/api/user/riwayatdeteksi/${currentUser._id}`

            if (currentUser.role == 'user') {
                url3 += `/${currentUser._id}`
            } else {
                url += `?patient=${DocterPatient._id}`;
                url2 = `/api/recomendation/getAll/${DocterPatient._id}`;
                url3 += `/${DocterPatient._id}`
                url4 = `/api/user/riwayatdeteksi/${DocterPatient._id}`
            }

            const [res, res2, res3, res4] = await Promise.all([
                await fetch(url),
                await fetch(url2),
                await fetch(url3),
                await fetch(url4),
            ]);

            const [data, data2, data3, data4] = await Promise.all([
                await res.json(),
                await res2.json(),
                await res3.json(),
                await res4.json(),
            ]);

            let property = {};
            property.Faktor_Resiko = data.prediction.supporting_risks;
            property.Hasil_Prediksi = data.prediction.result_prediction;
            property.Riwayat_Deteksi = data4.riwayat[0];
            property.Rekomendasi_Terakhir = data2.recomendation[data2.recomendation.length - 1]['name'];
            property.Treatment_Terakhir = data3.history[data3.history.length - 1]['diagnosis'];
            console.log({ data, data2, data3, property });

            setData(property);
        } catch (error) {
            console.log({ error })
        }
    }

    useEffect(() => {
        fetchInit();
    }, []);


    const handleUnsignPatient = () => {
        let ask = window.confirm('Are you sure?');
        if (ask) {
            dispatch(docterUnsetUser());
            navigate('/my-patients');
        }
    }

    return (
        <div>
            <main>
                <section class="bg-white md:flex">
                    <Side />
                    <div class="container px-6 py-10 mx-auto">
                        <ButtonOffCanvas index={1} />
                        <h1 class="text-3xl font-semibold text-gray-800 capitalize lg:text-4xl ">Heart Disease Decision Support Monitoring, Detection and Predictive System </h1>
                        <div class="mt-8 lg:-mx-6 lg:flex lg:items-center">
                            <img class="object-cover w-full lg:mx-6 lg:w-1/3 rounded-xl h-72 lg:h-96" src={currentUser.role != 'user' ? DocterPatient.profilePicture : currentUser.profilePicture}
                                alt="" />

                            <div class="mt-6 lg:w-2/3 lg:mt-0 lg:mx-6 ">
                                <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                                    <div class="rounded-t mb-0 px-4 py-3 border-0">
                                        <div class="flex flex-wrap items-center">
                                            <div class="relative w-full lg:px-4 max-w-full flex-grow flex justify-between flex-1">

                                                <h3 class="font-semibold text-base text-blueGray-700">Biodata Pasien</h3>

                                                {currentUser.role != 'user' ? (
                                                    <button onClick={() => handleUnsignPatient()} className='bg-red-600 focus:bg-red-600/90 text-white px-3 py-1 rounded-md text-sm'>Berhenti Monitoring</button>
                                                ) : (
                                                    <Link to={`/profile`} className='text-sm text-blue-500'>Edit information</Link>

                                                )}
                                            </div>
                                            {/* <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                                        <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">See all</button>
                                    </div> */}
                                        </div>
                                    </div>

                                    <div class="block w-full overflow-x-auto">
                                        {/* <table class="items-center bg-transparent w-full border-collapse ">
                                <tbody>
                                <tr>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                   Nama
                                    </th>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                    {currentUser.name}
                                    </td>
                                </tr>
                                <tr>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700">
                                    Usia
                                    </th>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                                   21
                                    </td>
                                </tr>
                                <tr>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700">
                                    Jenis Kelamin
                                    </th>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                                    Laki-laki
                                    </td>
                                </tr>
                                <tr>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700">
                                    Alamat
                                    </th>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                                    {currentUser.address}
                                    </td>
                                </tr>
                                <tr>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700">
                                    Dokter
                                    </th>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4">
                                    dokter Shafiyah
                                    </td>
                                </tr>
                                </tbody>
                            </table> */}

                                        <table class="min-w-full bg-white shadow-xl rounded-lg overflow-hidden">
                                            <tbody>
                                                <tr class="bg-gray-100 border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Nama
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {currentUser.role != 'user' ? DocterPatient.name : currentUser.name}
                                                    </td>
                                                </tr>
                                                <tr class="bg-white border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Usia
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        21
                                                    </td>
                                                </tr>
                                                <tr class="bg-gray-100 border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Jenis Kelamin
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        Laki-laki
                                                    </td>
                                                </tr>
                                                <tr class="bg-white border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Alamat
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {currentUser.role != 'user' ? DocterPatient.address : currentUser.address}

                                                    </td>
                                                </tr>
                                                <tr class="bg-gray-100">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Dokter
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {currentUser.role != 'user' ? currentUser.name : currentUser.name}

                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* Ringkasan Riwayat Medis */}
                                <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                                    <div class="rounded-t mb-0 px-4 py-3 border-0">
                                        <div class="flex flex-wrap items-center">
                                            <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                                                <h3 class="font-semibold text-base text-blueGray-700">Ringkasan Riwayat Medis</h3>
                                            </div>
                                            {/* <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-right">
                                        <button class="bg-indigo-500 text-white active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">See all</button>
                                    </div> */}
                                        </div>
                                    </div>

                                    <div class="block w-full overflow-x-auto">
                                        <table class="min-w-full bg-white shadow-md rounded-xl">
                                            <thead>
                                                <tr class="bg-blue-gray-100 text-gray-700">
                                                    <th class="py-3 px-4 text-left">Feature</th>
                                                    <th class="py-3 px-4 text-left">Keterangan</th>
                                                    <th class="py-3 px-4 text-left">Tanggal</th>

                                                </tr>
                                            </thead>
                                            <tbody class="text-blue-gray-900">
                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Faktor Resiko</td>
                                                    <td class="py-3 px-4">{data.Faktor_Resiko.length > 0 && data.Faktor_Resiko.map((val) => (<p>-{val}</p>))}</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Hasil Prediksi</td>
                                                    <td class="py-3 px-4">{data.Hasil_Prediksi}</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Riwayat Deteksi</td>
                                                    <td class="py-3 px-4">{data.Riwayat_Deteksi['dfa'] || data.Riwayat_Deteksi['dfa'] <= 0 ? `Tidak dapat menghitung secara akurat` : data.Riwayat_Deteksi['dfa'] }</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Rekomendasi Terakhir</td>
                                                    <td class="py-3 px-4">{data.Rekomendasi_Terakhir}</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Treatment Terakhir</td>
                                                    <td class="py-3 px-4">{data.Treatment_Terakhir}</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}

export default Summary