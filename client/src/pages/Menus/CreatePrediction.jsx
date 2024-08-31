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


function CreatePrediction() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [listFactor, setListFactor] = useState([]);
    const [text, setText] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if(listFactor.length == 0 || e.target[0].value == '') return;

        let formData = JSON.stringify({
            result_prediction : e.target[0].value, 
            supporting_risks : listFactor,
            patient: DocterPatient._id
        })

        try {
            const res = await fetch(`/api/predictionfactor/sendinfo`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();
            if(!res.ok) throw new Error(data.message);

            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/prediksi-faktor');
            });

        } catch (error) {
            console.log({error});
            Swal.fire("Whoops!", error, 'error');
        }
    };

    return (
        <div class="flex min-h-[90vh] items-center justify-start bg-white">
            <div class="mx-auto w-10/12 lg:w-full max-w-lg">
                <h1 class="text-2xl lg:text-4xl font-medium mb-3">Create Prediction</h1>

                <form onSubmit={handleSubmit} method='post' class="mt-8">
                    <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                        <div class="relative z-0">
                            <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Prediksi Penyakit</label>
                        </div>
                    </div>

                    <div className="mb-4 flex gap-3">
                        <textarea onChange={(e) => setText(e.target.value)} id="message" rows="4" class="block max-h-[100px] p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-slate-400" placeholder="Factor Pendukung yang meperkuat Prediksi..." value={text}></textarea>


                        <div className="flex flex-col lg:min-w-[130px]">
                            <div className="flex ">
                                <button onClick={() => {setListFactor([...listFactor, text]); setText("");}} type="button" class="focus:outline-none text-white bg-blue-700 hover:bg-blue-800  focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-4 me-2 mb-2">
                                    <TiPlus color='white' size={20} />
                                </button>

                                <button onClick={() => {setListFactor([]); setText("");}} type="button" class="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900">
                                    <FaTrash color='white' size={20} />
                                </button>
                            </div>

                            <button type="submit" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                Submit
                                <svg class="rtl:rotate-180 w-3.5 h-3.5 ms-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9" />
                                </svg>
                            </button>
                            <Link to={'/prediksi-faktor'} type="button" class="text-white mt-2 bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center">
                                Cancel
                                <IoIosCloseCircle class="ms-2" size={16} color='white' />
                            </Link>


                        </div>
                    </div>

                    <ul className='text-slate-600 text-sm list-disc mt-3 py-4'>
                        {listFactor.length > 0 ? (
                            listFactor.map((val) => (
                                <li>{val}</li>
                            ))
                        ) : null}
                    </ul>
                </form>
            </div>
        </div>
    )
}

export default CreatePrediction;