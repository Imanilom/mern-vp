import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link, useParams } from 'react-router-dom';

function RecomendationDetail() {
    const { currentUser, loading, error } = useSelector((state) => state.user);
    const [recomendation, setRecomendation] = useState(null);
    const [patients, setPatients] = useState([]);
    const { id } = useParams();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/recomendation/getOne/${id}`, {
                    method: 'GET'
                });

                const res2 = await fetch(`/api/action/recomendation/listPatient/${id}`);

                const data = await res.json();
                const data2 = await res2.json();

                console.log(data, data2);
                setRecomendation(data.recomendation);
                setPatients(data2.patients)
            } catch (error) {
                console.log(error);
            }
        }

        fetchData();
    }, [])
    return (
        <div>
            <main>
                <section class="bg-white flex">
                    {/* <Side /> */}
                    <div class="container px-6 py-10 mx-auto">

                        <div class="mt-8 lg:-mx-6 lg:flex justify-end lg:items-center">


                            <div class="mt-6 lg:w-2/3 lg:mt-0 lg:mx-6 ">
                                <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded duration-300 lg:hover:translate-x-[-20px] group">
                                    <div class="rounded-t mb-0 px-4 py-3 border-0">
                                        <div class="flex flex-wrap items-center">
                                            <div class="relative w-full px-4 max-w-full flex-grow lg:flex lg:justify-between flex-1">
                                                <h3 class="font-semibold text-base text-blueGray-700">The Activity</h3>
                                                <Link to={`/rekomendasi`}>
                                                    <h3 class="font-semibold text-blue-400 text-sm text-blueGray-700">Back to main menu</h3>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="block w-full overflow-x-auto">


                                        <table class="min-w-full bg-white shadow-xl rounded-lg overflow-hidden">
                                            <tbody>
                                                <tr class="bg-gray-100 border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Name Activity
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {recomendation ? recomendation.name : ''}
                                                    </td>
                                                </tr>
                                                <tr class="bg-white border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Doctor Penanggung jawab
                                                    </th>
                                                    <td class="px-6 py-4 text-sm text-gray-700">
                                                        {recomendation ? recomendation.doctor_id : ''}
                                                    </td>
                                                </tr>
                                                <tr class="bg-gray-100 border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Berlaku semenjak
                                                    </th>
                                                    {recomendation ? (
                                                        <td class="px-6 py-4 text-sm text-gray-700">
                                                            {new Intl.DateTimeFormat('id-ID', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric'
                                                            }).format(new Date(recomendation.berlaku_dari ?? ''))}
                                                        </td>
                                                    ) : null}
                                                </tr>
                                                <tr class="bg-white border-b">
                                                    <th class="px-6 py-4 text-left text-sm font-medium text-gray-900">
                                                        Hingga Tanggal
                                                    </th>
                                                    {recomendation ? (
                                                        <td class="px-6 py-4 text-sm text-gray-700">

                                                            {new Intl.DateTimeFormat('id-ID', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric'
                                                            }).format(new Date(recomendation.hingga_tanggal ?? ''))}

                                                        </td>
                                                    ) : null}
                                                </tr>

                                            </tbody>
                                        </table>
                                    </div>
                                </div>


                                <h3 className="text-xl font-semibold py-3">Patients was doing this activity</h3>
                                <table class="items-center bg-transparent w-full border-collapse ">
                                    <thead>
                                        <tr>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                No.
                                            </th>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Profile
                                            </th>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Name
                                            </th>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Email
                                            </th>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Alamat
                                            </th>

                                        </tr>
                                    </thead>

                                    <tbody>
                                        {patients.length > 0 ? (
                                            patients.map((patient, i) => {
                                                return (
                                                    <tr>
                                                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                           {i + 1}
                                                        </th>
                                                        <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                           <div className="w-20 h-20 bg-center bg-cover rounded-full" style={{backgroundImage : `url(${patient.patient.profilePicture})`}}></div>
                                                        </th>
                                                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                            {patient.patient.name}
                                                        </td>
                                                        <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                        {patient.patient.email}
                                                        </td>
                                                        <td class="border-t-0 text-gray-400 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                        {patient.patient.address}
                                                        </td>


                                                    </tr>
                                                )
                                            })
                                        ) : null}


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

export default RecomendationDetail