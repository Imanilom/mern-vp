import React from 'react'
import { useSelector } from 'react-redux';
import { useRef, useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Side from '../../components/Side';
import { Link } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';
import {
    docterGetUser,
    docterUnsetUser
} from '../../redux/user/userSlice';
import Swal from 'sweetalert2';

function AddPatient() {

    const { currentUser, error, DocterPatient } = useSelector((state) => state.user);
    const [searchInput, setSearchInput] = useState('');
    const [isModal, setModal] = useState(false);
    const [isShowBook, setShowBook] = useState(false);
    const [patients, setPatients] = useState([]);
    const [modalProperty, setModalProperty] = useState({});
    const [allPatient, setAllPatient] = useState([]);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [paginationCount, setPaginationCount] = useState(0);
    const [paginationActive, setPaginationActive] = useState(1);

    const fetchPatients = async () => {
        try {
            const response = await fetch(`/api/patient/add/pasient?p=${paginationActive - 1}`); // Adjust the API endpoint as needed
            const data = await response.json();
            console.log({ data })
            setPatients(data.patients);
            setAllPatient(data.patients);
            setPaginationCount(data.lengthPage)
        } catch (error) {
            console.error('Error fetching patients:', error);
        }
    };

    const handleChoosePatient = (property) => {
        dispatch(docterGetUser(property));
        console.log(property);
        navigate('/ringkasan-pasien')
    }


    useEffect(() => {

        AOS.init({
            duration: 700
        })
        fetchPatients();

        if(currentUser.role == 'user'){
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    useEffect(() => {

        fetchPatients();
    }, [paginationActive])  

    const handleSearchName = (e) => {
        e.preventDefault();
    };

    const handleSetPasient = async(id, patient) => {
        try {
            const response = await fetch(`/api/patient/add/pasient`, {
                method : 'POST',
                body : JSON.stringify({
                    id : id
                }),
                headers : {
                    'Content-Type' : 'application/json'
                }
            }); // Adjust the API endpoint as needed

            const data = await response.json();

            Swal.fire('Success!', 'Succesfully to be your patient, start monitoring.', 'success')
            .then(() => {
                handleChoosePatient(patient)
            });
        } catch (error) {
            console.log({error})
        }
    }

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
                <bgmodal className="flex justify-center bg-[#101010] dark:bg-[#FEFCF5] fixed h-[100vh] w-full z-50 py-16">
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
                <section className="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex">
                    <Side />
                    <div className="md:w-11/12 py-16 px-16 lg:w-10/12 mb-12 xl:mb-0 mx-auto mt-8 lg:mt-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col gap-3">
                                <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl " >List Pasien </h1>
                                <p>
                                    List pasien yang tidak memiliki dokter monitoring
                                </p>
                            </div>
                            <form action="" method="post" onSubmit={handleSearchName}>
                                <div className="relative flex w-full group hover:shadow-lg duration-300">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                        <FaSearch className="h-5 w-5 text-white dark:text-[#217170]" />
                                    </span>
                                    <input
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        type="text"
                                        placeholder="Search patient name..."
                                        className="block md:min-w-[350px] pl-10 pr-3 py-4 rounded-md leading-5 bg-[#2C2C2C] dark:bg-[#F5F2E7] text-white/60 shadow-sm focus:outline-none  sm:text-sm"
                                    />
                                </div>
                            </form>
                        </div>
                        {/* <ButtonOffCanvas /> */}
                        <div className="relative flex flex-col min-w-0 break-words bgg-bl w-full mb-6 shadow-lg rounded ">
                            
                            <div className="block w-full overflow-x-auto">
                                <table className="items-center w-full ">
                                    <thead>
                                        <tr className='bg-[#363636]/30 dark:bg-[#217170]'>
                                            <th className=" hidden sm:table-cell px-6 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                No.
                                            </th>
                                            <th className="px-6 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Profile
                                            </th>
                                            <th className="px-6  text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Name
                                            </th>
                                            <th className="hidden sm:table-cell px-6 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Address
                                            </th>
                                         
                                            <th className="px-6 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients ? patients.map((patient, i) => (
                                            <tr key={patient._id} className={i % 2 == 0 ? 'bg-[#141414] dark:bg-[#E7E7E7]' : 'bg-[#2C2C2C] dark:bg-[#CBCBCB]'}>
                                                <th className="hidden sm:table-cell border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                    {i + 1}
                                                </th>
                                                <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                    <div className="rounded-full w-[50px] h-[50px] md:w-[100px] md:h-[100px] bg-cover bg-center" style={{ backgroundImage: `url('${patient.profilePicture}')` }}>
                                                    </div>
                                                </td>
                                                <td className="border-t-0 px-6 align-middle border-l-0 border-r-0 text-sm font-medium whitespace-nowrap p-4 ">
                                                    {patient.name ?? patient.namaLengkap}
                                                </td>
                                                <td className="hidden sm:table-cell border-t-0 text-gray-400 px-6 w-[360px] align-middle border-l-0 border-r-0 text-xs whitespace-wrap p-4 ">
                                                    {patient.address != '' ? patient.address : patient.alamatLengkap}
                                                </td>
                                                
                                                <td>
                                                    <button className='text-[#07AC7B] dark:text-[#D39504] font-medium text-sm px-4 text-start' onClick={() => handleSetPasient(patient._id, patient)}>
                                                        Jadikan Pasien saya
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td className="text-center text-xl py-4 text-gray-400 ">You have no patients with name {searchInput}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>

                        {paginationCount >= 1 ? (
                            <div data-aos="fade-right" className="pagination flex gap-2 text-sm mb-8">
                                {Array.from({ length: paginationCount }).map((_, _i) => (
                                    _i + 1 === paginationActive ? (
                                        <div className="py-3 px-7 bg-[#005A8F] dark:bg-[#FFD166] text-white rounded-md">
                                            {_i + 1}
                                        </div>
                                    ) : (
                                        <div onClick={() => { setPaginationActive(_i + 1); }} className="py-3 px-4 bg-[#272727] text-white rounded-md">
                                            {_i + 1}
                                        </div>
                                    )))
                                }

                            </div>

                        ) : null}
                        <Link to={'/my-patients'} className='py-3 mb-4 text-center w-full text-white dark:text-[#073B4C] font-semibold rounded-md bg-[#07AC7B] dark:bg-[#FFD166] focus:translate-y-2 duration-150 block'>
                            <button >
                                Back to your list pasient
                            </button>

                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default AddPatient;