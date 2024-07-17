import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link } from 'react-router-dom';

function Summary() {
    const { currentUser, loading, error } = useSelector((state) => state.user);


    return (
        <div>
            <main>
                <section class="bg-white flex">
                    <Side />
                    <div class="container px-6 py-10 mx-auto">

                        <h1 class="text-3xl font-semibold text-gray-800 capitalize lg:text-4xl ">Heart Disease Decision Support Monitoring, Detection and Predictive System </h1>
                        <div class="mt-8 lg:-mx-6 lg:flex lg:items-center">
                            <img class="object-cover w-full lg:mx-6 lg:w-1/3 rounded-xl h-72 lg:h-96" src={currentUser.profilePicture} alt="" />

                            <div class="mt-6 lg:w-2/3 lg:mt-0 lg:mx-6 ">
                                <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                                    <div class="rounded-t mb-0 px-4 py-3 border-0">
                                        <div class="flex flex-wrap items-center">
                                            <div class="relative w-full px-4 max-w-full flex-grow lg:flex lg:justify-between flex-1">
                                                <h3 class="font-semibold text-base text-blueGray-700">Biodata Pasien</h3>
                                                <Link to={`/profile`} className='text-sm text-blue-500'>Edit information</Link>
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
                                                        {currentUser.name}
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
                                                        {currentUser.address}
                                                    </td>
                                                </tr>
                                                <tr class="bg-gray-100">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Dokter
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        dokter Shafiyah
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
                                                    <td class="py-3 px-4">-</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Hasil Prediksi</td>
                                                    <td class="py-3 px-4">-</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Riwayat Deteksi</td>
                                                    <td class="py-3 px-4">-</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Rekomendasi Terakhir</td>
                                                    <td class="py-3 px-4">-</td>
                                                    <td class="py-3 px-4">-</td>
                                                </tr>

                                                <tr class="border-b border-blue-gray-200">
                                                    <td class="py-3 px-4">Treatment Terakhir</td>
                                                    <td class="py-3 px-4">-</td>
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