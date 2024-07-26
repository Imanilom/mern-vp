import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import {
    docterGetUser,
    docterUnsetUser
} from '../../redux/user/userSlice';

function MyPatients() {

    const { currentUser, error, DocterPatient } = useSelector((state) => state.user);
    const [searchInput, setSearchInput] = useState('');
    const [isModal, setModal] = useState(false);
    const [patients, setPatients] = useState([]);
    const [modalProperty, setModalProperty] = useState({});
    const [allPatient, setAllPatient] = useState([]);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {

            try {
                const response = await fetch('/api/patient/all'); // Adjust the API endpoint as needed
                const data = await response.json();
                setPatients(data);
                setAllPatient(data);
            } catch (error) {
                console.error('Error fetching patients:', error);
            }
        };

        fetchPatients();
    }, []);

    const handleChangePropertyModal = (property) => {
        setModal(true);
        setModalProperty(property);
        console.log(property);
    };

    const handleChoosePatient = (property) => {
        dispatch(docterGetUser(property));
        console.log(property);
        navigate('/ringkasan-pasien')
    }

    const handleSearchName = (e) => {
        e.preventDefault();
    };

    useEffect(() => {
        if (searchInput !== '') {
            console.log(searchInput);
            let resultQuery = [];
            for (let i = 0; i < allPatient.length; i++) {
                let word = allPatient[i]['name'].split(" ");
                for (let o = 0; o < word.length; o++) {
                    if (searchInput.toLowerCase() === word[o].toLowerCase()) {
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
                            <div className="rounded-full w-[100px] h-[100px] bg-cover bg-center" style={{ backgroundImage: `url('${modalProperty.profilePicture}')` }}>
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
                                Alamat : {modalProperty.address}
                            </div>
                        </div>
                    </modal>
                </bgmodal>
            ) : null}

            <main>
                <section className="bg-white flex">
                    <Side />
                    <div className="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-24">
                        <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded ">
                            <div className="rounded-t mb-0 px-4 py-3 border-0">
                                <div className="flex flex-wrap items-center">
                                    <div className="relative w-full px-4 max-w-full flex-grow flex-1">
                                        <h3 className="font-semibold text-base text-blueGray-700">My Patients || {patients.length ?? 0}</h3>
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
                            <div className="block w-full overflow-x-auto">
                                <table className="items-center bg-transparent w-full border-collapse ">
                                    <thead>
                                        <tr>
                                            <th className="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                No.
                                            </th>
                                            <th className="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Profile
                                            </th>
                                            <th className="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Name
                                            </th>
                                            <th className="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Address
                                            </th>
                                            <th className="px-6 bg-blueGray-50 text-blueGray-500 align-middle border border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients.length > 0 ? patients.map((patient, i) => (
                                            <tr key={patient._id}>
                                                <th className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                    {i + 1}
                                                </th>
                                                <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                    <div className="rounded-full w-[100px] h-[100px] bg-cover bg-center" style={{ backgroundImage: `url('${patient.profilePicture}')` }}>
                                                    </div>
                                                </td>
                                                <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-sm font-medium whitespace-nowrap p-4 ">
                                                    {patient.name}
                                                </td>
                                                <td className="border-t-0 text-gray-400 px-6 w-[360px] align-middle border-l-0 border-r-0 text-xs whitespace-wrap p-4 ">
                                                    {patient.address}
                                                </td>
                                                <td>
                                                    <div className="relative w-full px-4 max-w-full flex-grow flex-1 text-end">
                                                        <button onClick={() => handleChangePropertyModal(patient)} className="bg-indigo-500 text-white hover:bg-indigo-600/90 active:bg-indigo-600 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Detail</button>
                                                        <button onClick={() => handleChoosePatient(patient)} className="bg-green-500 text-white hover:bg-green-500/90 active:bg-green-500 text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Monitoring</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" className="text-center text-xl py-4 text-gray-400 ">You have no patients with name {searchInput}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                            <button className='py-3 text-center w-full text-white font-semibold rounded-md bg-indigo-600 hover:bg-indigo-600/90 focus:translate-y-2 duration-150'>Add New Patient</button>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default MyPatients;