import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { axiosConfig } from '../../utls/axiosConfig.js';

function CreateTreatment() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [medicine, setMedicine] = useState([]);

    useEffect(() => {

    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(medicine.length == 0) throw new Error('Harus mengisi obat!')
        try {
            const res = await fetch('/api/treatment/createTreatment', {
                method : "POST",
                headers : {
                    'Content-Type' : "application/json"
                },
                body : JSON.stringify({
                    patient_id : DocterPatient._id,
                    diagnosis : e.target[0].value,
                    followUpDate: e.target[1].value,
                    notes : e.target[2].value,
                    medications : medicine,
                })
            });

            const data = await res.json();
            if(!res.ok) throw new Error(data.message);
            console.log({data});

            Swal.fire("Yohoo!", data.message, 'success').then(() => navigate('/treatment'));
        } catch (error) {
            console.log({error})
            Swal.fire("Whoops", error.message, 'error');
        }
    }

    const handleAddMedicine = async (e) => {
        e.preventDefault();
        let property = {
            name: e.target[0].value,
            dosage: e.target[1].value,
            frequency: e.target[2].value
        }

        setMedicine([...medicine, property]);
        document.getElementById("reset").click();
    }


    return (
        <div class="flex min-h-[90vh] bg-white">
            <div className="flex sm:flex-row flex-col gap-16 w-10/12 justify-start mx-auto items-center sm:gap-4 my-8">
                <div class="flex md:w-5/12">
                    <form onSubmit={handleSubmit} method='post' class="mt-6 flex flex-col gap-4">
                        <h1 class="text-2xl lg:text-2xl font-medium">Create Treatment Pasient</h1>
                        <div class="relative z-0 w-full">
                            <input type="text" name="name" class="peer block w-full sm:w-[30vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Diagnosa pasient</label>
                        </div>

                        <div class="relative z-0 sm:max-w-[30vw] mt-3">
                            <input type="date" name="berlaku_dari" class="peer block w-full sm:w-[30vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal Consultasi ulang *optional</label>
                        </div>

                        <div class="relative z-0 mt-3">
                            <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Catatan untuk pasient</label>
                        </div>

                        <div className="mt-4 flex gap-1">
                            <button className='px-3 py-1 bg-blue-500 text-white rounded-md font-medium' type="submit">Create Treatment</button>
                            <Link to={`/treatment`} className='px-3 py-1 bg-slate-800 text-white rounded-md font-medium'>Cancel</Link>
                        </div>
                    </form>
                </div>

                <form onSubmit={handleAddMedicine} className="md:w-3/12 w-full px-4 flex-col flex gap-4">
                    <div className="text-lg font-medium">Add medicine list</div>
                    <div class="relative z-0 w-full">
                        <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                        <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Nama Obat</label>
                    </div>

                    <div class="relative z-0 w-full">
                        <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                        <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Dosis obat</label>
                    </div>
                    <div class="relative z-0 w-full">
                        <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                        <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">frequency</label>
                    </div>

                    <button type="reset" id='reset' hidden>reset</button>
                    <button type='submit' className='text-white bg-blue-500 w-fit px-3 py-1 rounded-md ms-auto'>Add to list</button>
                </form>

                {medicine.length > 0 ? (
                    <div className="md:w-4/12 w-full px-4 flex flex-col gap-6 p-6">
                        <div className="text-xl font-medium text-end">Your Medicine list</div>

                        <div className="flex flex-col gap-4 bg-black w-full p-4 rounded-md">

                            {medicine.map((val) => (
                                <div className="bg-white/20 text-white p-2">
                                    <div className="font-medium text-green-400">{val.name}</div>
                                    <div className="text-sm">
                                        {val.dosage} | {val.frequency}
                                    </div>
                                </div>
                            ))}
                            {/* <div className="bg-white/20 text-white p-2">
                                <div className="font-medium text-green-400">Lorem, ipsum dolor.</div>
                                <div className="text-sm">
                                    Lorem, ipsum. | Lorem ipsum dolor sit.
                                </div>
                            </div>
                            <div className="bg-white/20 text-white p-2">
                                <div className="font-medium text-green-400">Lorem, ipsum dolor.</div>
                                <div className="text-sm">
                                    Lorem, ipsum. | Lorem ipsum dolor sit.
                                </div>
                            </div> */}

                            <button className='text-white bg-red-500 text-xs w-fit px-3 py-1 rounded-md ms-auto' onClick={() => setMedicine([])}>Remove all</button>
                        </div>
                    </div>

                ) : null}
            </div>
        </div>
    )
}

export default CreateTreatment