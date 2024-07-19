import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';

function MyPatients() {
    const { currentUser, error } = useSelector((state) => state.user);
    const [searchInput, setSearchInput] = useState('');
    const [isModal, setModal] = useState(false);
    // const [patients, setPatients] = useState(null);
    const [patients, setPatients] = useState([
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Patriot abdi n',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'pwangtampn@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Aya Khairul nisa',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Aya@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Aya nur khaira',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Aya@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Meysun cantika',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Meysun@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Fatimah Azzahra',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Fatimah@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
    ]);

    const [modalProperty, setModalProperty] = useState({
        _id: 'sbahgdsdsdgsya',
        name: 'Patriot abdi n',
        profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
        email: 'pwangtampn@gmail.com',
        alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
    },);

    const [allPatient, setAllPatient] = useState([
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Patriot abdi n',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'pwangtampn@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Aya Khairul nisa',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Aya@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Aya nur khaira',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Aya@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Meysun cantika',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Meysun@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
        {
            _id: 'sbahgdsdsdgsya',
            name: 'Fatimah Azzahra',
            profile: 'https://firebasestorage.googleapis.com/v0/b/vidyamedic-bb1f1.appspot.com/o/1721185291297Screenshot%20(134).png?alt=media&token=d4bab8fd-5117-4f41-aa9e-93272da28cb8',
            email: 'Fatimah@gmail.com',
            alamat: 'Jl.SUNAN GUNUNGJATI GG.DAMKAR BLOK SIRAWA RT 01 RW 05, GROGOL, GUNUNGJATI, KAB CIREBON 45151',
        },
    ]);

    const handleChangePropertyModal = (property) => {
        setModal(true);
        setModalProperty(property);
        console.log(property);
    }

    const [loading, setLoading] = useState(true);

    const confirmDelete = (activity) => {
        setActivityToDelete(activity);
        setShowModal(true);
    };

    const handleSearchName = (e) => {
        e.preventDefault();
    }

    useEffect(() => {
        if (searchInput != '') {
            console.log(searchInput)
            let resultQuery = [];
            for (let i = 0; i < allPatient.length; i++) {
                let word = allPatient[i]['name'].split(" ");
                for (let o = 0; o < word.length; o++) {
                    if (searchInput.toLowerCase() == word[o].toLowerCase()) {
                        resultQuery.push(allPatient[i]);
                        break;
                    }
                }

            }

            console.log(resultQuery);
            setPatients(resultQuery);
        } else {
            setPatients(allPatient);
        }
    }, [searchInput]);

    useEffect(() => {
        // const fetchLog = async () => {
        //     try {
        //         setLoading(true);
        //         const res = await fetch(`/api/activity/getActivity`);
        //         const data = await res.json();
        //         if (data.success === false) {
        //             return;
        //         }
        //         console.log(data)
        //         setPatients(data)

        //     } catch (error) {
        //         console.log(error);
        //     }
        // };
        // fetchLog();
    }, []);
    return (
        <div>
            {isModal ? (
                <bgmodal className="flex justify-center bg-black/60 fixed h-[100vh] w-full z-50 py-16">
                    <modal className="bg-white w-[360px] md:w-[480px] h-fit  px-6 py-10 rounded-md">
                        <div className="flex justify-between items-center">
                            <div className="text-md font-semibold">Detail Patient</div>
                            <button onClick={() => setModal(false)} className='text-xs bg-red-600 text-white px-4 py-2 rounded-md font-semibold'>Close modal</button>
                        </div>
                        <div className="flex flex-col gap-4 my-6">
                            <div className="rounded-full w-[100px] h-[100px] bg-cover bg-center" style={{ backgroundImage: `url('${modalProperty.profile}')` }}>

                            </div>
                            <div className='text-gray-500 text-[14px]'>
                                <p className="font-medium text-xm">
                                    Name : {modalProperty.name}
                                </p>
                                <p className="font-medium text-xm">
                                    Email : {modalProperty.email}
                                </p>
                            </div>
                            <hr />
                            <div className="text-[12px] text-gray-500 font-medium">
                                Alamat : {modalProperty.alamat}
                            </div>
                        </div>
                    </modal>
                </bgmodal>

            ) : null}

            <main>
                <section class="bg-white flex">
                    <Side />
                    <div class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
                        <div class="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
                            <div class="rounded-t mb-0 px-4 py-3 border-0">
                                <div class="flex flex-wrap items-center">
                                    <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                                        <h3 class="font-semibold text-base text-blueGray-700">My Patients || {patients.length ?? 0}</h3>
                                    </div>

                                    <form action="" method="post" onSubmit={handleSearchName}>
                                        <div className="relative flex w-full group hover:shadow-lg duration-300">
                                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                                <FaSearch className="h-5 w-5 text-black group-hover:text-indigo-500" />
                                            </span>
                                            <input
                                                onChange={(e) => setSearchInput(e.target.value)}
                                                type="text"
                                                placeholder="Search patient name..."
                                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                    </form>

                                </div>
                            </div>

                            <div class="block w-full overflow-x-auto">
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
                                                Address
                                            </th>
                                            <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {patients.length > 0 ? patients?.map((patients, i) => (
                                            <tr key={patients._id}>
                                                <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                    {/* {new Date(patients.Date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} */}
                                                    {i + 1}
                                                </th>
                                                <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                    <div className="rounded-full w-[100px] h-[100px] bg-cover bg-center" style={{ backgroundImage: `url('${patients.profile}')` }}>

                                                    </div>
                                                </td>
                                                <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-sm font-medium whitespace-nowrap p-4 ">
                                                    {patients.name}
                                                </td>
                                                <td class="border-t-0 text-gray-400 px-6 w-[360px] align-middle border-l-0 border-r-0 text-xs whitespace-wrap p-4 ">
                                                    {patients.alamat}
                                                </td>
                                                <td>
                                                    <div class="relative w-full px-4 max-w-full flex-grow flex-1 text-center">
                                                        <button onClick={() => handleChangePropertyModal(patients)} class="bg-indigo-500 text-white hover:bg-indigo-600/90 active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Detail</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <>
                                                <h3 className='text-2xl'>You have no patients</h3>
                                            </>
                                        )}

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

export default MyPatients;