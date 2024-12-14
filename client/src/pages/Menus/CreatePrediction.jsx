import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';

import { TiPlus } from "react-icons/ti";
import { FaTrash } from "react-icons/fa";
// import { RiCloseFill } from "react-icons/ri";
import { IoIosCloseCircle } from "react-icons/io";
import Side from '../../components/Side';


function CreatePrediction() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [listFactor, setListFactor] = useState([]);
    const [text, setText] = useState("");

    useEffect(() => {

        // Jika user mencoba masuk
        if(currentUser.role == 'user'){

            // tendang ke ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, [])
    
    const handleSubmit = async (e) => {
        e.preventDefault(); // mencegah web di muat ulang

        // Jika list faktor pendukung kosong maka hentikan
        if (listFactor.length == 0 || e.target[0].value == '') return;

        // Mengolah data untuk di kirim ke server
        let formData = JSON.stringify({
            result_prediction: e.target[0].value,
            supporting_risks: listFactor,
            patient: DocterPatient._id
        })

        try {
            const res = await fetch(`/api/predictionfactor/sendinfo`, {
                method: 'POST',
                body: formData, // kirim olahan data
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message); // Jika terjadi kesalahan

            // Tampilkan popup success
            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // lalu arahkan kembali ke prediksi faktor
                navigate('/prediksi-faktor');
            });

        } catch (error) {
            // Tampilkan popup 
            Swal.fire("Whoops!", error, 'error');
        }
    };

    return (
        <section class="bg-[#101010] dark:bg-[#FEFCF5] md:flex">
            <Side />
            <div class="md:min-h-[90vh] p-8 md:p-16 w-full items-center justify-start bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C]">
                <div class="justify-start max-w-lg">
                    <h1 class="text-2xl lg:text-4xl font-semibold">Create Prediction</h1>
                    <form onSubmit={handleSubmit} method='post' class="pt-3">
                        <div class="grid gap-6 md:mb-5 mb-3 sm:grid-cols-1">
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-semi-bold text-white dark:text-[#073B4C]">Prediksi Penyakit</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan prediksi penyakit pasien anda" required />
                            </div>
                        </div>

                        <div className="mb-4 flex flex-col md:flex-row gap-3">
                            <textarea onChange={(e) => setText(e.target.value)} id="message" rows="4" class="block max-h-[100px] p-2.5 w-full text-sm bg-[#2c2c2c] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white rounded-lg  border-slate-400" placeholder="Factor Pendukung yang memperkuat Prediksi..." value={text}></textarea>


                            <div className="flex flex-col lg:min-w-[130px]">
                                <div className="flex md:flex-row">
                                    <button onClick={() => { setListFactor([...listFactor, text]); setText(""); }} type="button" class="focus:outline-none text-white bg-[#07AC7B] dark:bg-[#217170] hover:bg-blue-800  focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-4 me-2 mb-2 w-full md:w-fit">
                                        <TiPlus color='white' size={20} />
                                    </button>

                                    <button onClick={() => { setListFactor([]); setText(""); }} type="button" class="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900 w-full md:w-fit">
                                        <FaTrash color='white' size={20} />
                                    </button>
                                </div>

                                <button type="submit" class="text-white  font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center bg-[#07AC7B] dark:bg-[#217170]  hover:opacity-70 duration-200">
                                    Submit
                                    <svg class="rtl:rotate-180 w-3.5 h-3.5 ms-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9" />
                                    </svg>
                                </button>
                                <Link to={'/prediksi-faktor'} type="button" class=" text-white dark:text-[#073B4C]  mt-2 hover:text-[#007CC6] font-medium rounded-lg text-sm  py-2.5 text-center inline-flex items-center">
                                    Cancel
                                    
                                </Link>


                            </div>
                        </div>


                    </form>

                </div>

                {listFactor.length > 0 ? (
                    <div>
                        <div className='font-semibold'>Factor Pendukung</div>
                        <ul className='text-sm list-none max-w-lg py-4 flex-col flex gap-2'>
                            {listFactor.length > 0 ? (
                                listFactor.map((val, _i) => (
                                    <li className='bgg-dg rounded-sm py-2 text-white font-semibold dark:text-[#073B4C] px-4 w-full'>{_i + 1}. {val}</li>
                                ))
                            ) : null}
                        </ul>
                    </div>
                ) : null}
            </div>

        </section>
    )
}

export default CreatePrediction;