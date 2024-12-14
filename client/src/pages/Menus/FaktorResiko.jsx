import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';

function FaktorResiko() {

    const { DocterPatient, currentUser } = useSelector(state => state.user);
    const [labs, setLabs] = useState([]); // untuk menampung list lab pasient
    const [pagination, setPagination] = useState(1); // untuk menyimpan count pagination
    const [currentPagination, setCurrentPagination] = useState(1); // untuk mengecek current pagination

    // Jalankan Pertama kali saat halaman dimuat
    useEffect(() => {
        // Panggil AOS untuk menjalankan animasi on scrool
        AOS.init({
            duration: 1000
        })
        fetchInit(); // run function
    }, [])

    useEffect(() => {
        // Jalankan function jika curentPagination berubah
        fetchInit(); // run function
    }, [currentPagination]);

    // Fungsi get labs
    const fetchInit = async () => {
        try {
       
            let url = `/api/faktorresiko/labs/${currentUser._id}?p=${currentPagination - 1}`;
            if (currentUser.role != 'user') {
                url = `/api/faktorresiko/labs/${DocterPatient._id}?p=${currentPagination - 1}`;
            }
            const res = await fetch(url);
            const data = await res.json();

            setLabs(data.labs); // simpan list lab
            setPagination(data.count); // count = banyaknya pagination

        } catch (err) {
            console.log({ err })
        }
    }

    // Handle click pagination
    const handleChangePagination = (num) => {
        if (num > 0 && num < pagination + 1) {
            setCurrentPagination(num);
        }
    }

    // Fungsi untuk delete lab pasient
    const handleDelete = async (id) => {
        try {
            Swal.fire({
                title: "Are you sure?",
                text: "You won't be able to revert this!",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, delete it!"
            }).then(async (result) => {
                // Jika confirm untuk delete
                if (result.isConfirmed) {
                    const res = await fetch(`/api/faktorresiko/lab/${id}`, {
                        method: 'DELETE'
                    })

                    const data = await res.json();

                    // Show popup success
                    Swal.fire({
                        title: "Deleted!",
                        text: "Your Lab has been deleted.",
                        icon: "success"
                    }).then(() => {
                        window.location.reload(); // restart halaman
                    });
                }
            });
        } catch (err) {
            console.log({ err });
        }
    }

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex">
            <Side />
            <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-16">
                {/* <ButtonOffCanvas /> */}
                <div className="flex flex-col justify-start items-start mb-4">
                    <div>
                        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl ">Faktor Resiko</h1>
                        <p className='font-medium mt-3'>List Labotarium pasien</p>
                    </div>
                </div>

                <div class="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded ">
                    {currentUser.role != 'user' ? (
                        <div class="rounded-t mb-0 py-3 border-0 bg-[#363636]/30 dark:bg-[#217170]">
                            <div class="flex flex-wrap items-center">

                                <div class="relative w-full px-4 max-w-full flex-grow flex-1">
                                    <Link to={'/faktor-resiko/doc'} class="text-[#07AC7B] dark:text-[#FFD166] text-xs font-bold uppercase px-3 py-1 rounded outline-none focus:outline-none mr-1 mb-1 ease-linear transition-all duration-150" type="button">Tambah Labotarium Baru</Link>
                                </div>

                            </div>
                        </div>
                    ) : null}

                    <div class="block w-full overflow-x-auto rounded">
                        <table class="items-center bg-transparent w-full  ">
                            {currentUser.role == "user" ? (
                                <thead>
                                    <tr className='bg-[#2c2c2c] dark:bg-[#217170]'>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-white  align-middle  border-solid border-blueGray-100 py-4 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Tanggal
                                        </th>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Nama Labotarium
                                        </th>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Location
                                        </th>

                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-white align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Action
                                        </th>

                                    </tr>
                                </thead>
                            ) : (
                                <thead>
                                    <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-[#073B4C]  align-middle  border-solid border-blueGray-100 py-4 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Tanggal
                                        </th>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-[#073B4C] align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Nama Labotarium
                                        </th>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-[#073B4C] align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Location
                                        </th>
                                        <th class="px-6 bg-blueGray-50 text-blueGray-500 dark:text-[#073B4C] align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0 whitespace-nowrap font-semibold text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                            )}


                            <tbody>
                                {labs && labs.length > 0 ? (
                                    labs.map((data, _i) => {
                                        return (
                                            <tr className={_i % 2 == 0 ? 'bg-[#141414] dark:bg-[#CBCBCB]' : 'bg-[#2c2c2c] dark:bg-[#E7E7E7]'}>
                                                <th class="border-t-0 px-6 font-semibold align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 text-left text-blueGray-700 ">
                                                    {_i + 1}
                                                </th>
                                                <td class="border-t-0 px-6 font-semibold align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                    {data.name_lab}
                                                </td>
                                                <td class="border-t-0 px-6 font-semibold align-middle border-l-0 border-r-0 text-xs whitespace-nowrap p-4 ">
                                                    {data.location}
                                                </td>

                                                <td class="border-t-0 px-6 font-semibold align-middle border-l-0 border-r-0 text-xs  p-4 flex items-center gap-3">
                                                    <Link to={`/faktor-resiko/${data._id}`} className="text-[#07AC7B] dark:text-[#D39504] cursor-pointer font-medium">
                                                        Detail Labotarium
                                                    </Link>

                                                    {currentUser.role != 'user' ? (

                                                        <button onClick={() => handleDelete(data._id)} className='rounded-md font-medium px-3 py-1.5 dark:bg-red-600 dark:text-white hover:bg-red-600 hover:text-[#141414] text-red-600 bg-[#363636]/30'>
                                                            Delete</button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                <nav data-aos="fade-right" aria-label="Page navigation example" className='pb-5 max-w-[400px]' style={{ overflowX: 'auto' }}>
                    <div className="pagination flex gap-2 mb-8 text-sm">
                        {Array.from({ length: pagination }).map((_i, i) => {

                            if (i + 1 == currentPagination) {
                                return (
                                    <div className="py-3 px-7 bg-[#005A8F] dark:bg-[#FFD166] text-white rounded-[5px]">
                                        {i + 1}
                                    </div>
                                )
                            } else {
                                return (
                                    <div onClick={() => { handleChangePagination(i + 1); }} className="py-3 px-4 bg-[#272727] dark:bg-[#073B4C] text-white cursor-pointer rounded-[5px]">
                                        {i + 1}
                                    </div>

                                )
                            }
                        })}
                    </div>
                </nav>
            </div>
        </main>
    )
}

export default FaktorResiko