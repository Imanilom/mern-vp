import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { axiosConfig } from '../../utls/axiosConfig.js';
import Side from '../../components/Side.jsx';

function CreateTreatment() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [medicine, setMedicine] = useState([]);
    const [isShowList, setShowList] = useState(false);

    useEffect(() => {

    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (medicine.length == 0) throw new Error('Harus mengisi obat!')
        try {
            const res = await fetch('/api/treatment/createTreatment', {
                method: "POST",
                headers: {
                    'Content-Type': "application/json"
                },
                body: JSON.stringify({
                    patient_id: DocterPatient._id,
                    diagnosis: e.target[0].value,
                    followUpDate: e.target[1].value,
                    notes: e.target[2].value,
                    medications: medicine,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            console.log({ data });

            Swal.fire("Yohoo!", data.message, 'success').then(() => navigate('/treatment'));
        } catch (error) {
            console.log({ error })
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
        <main class="bgg-bl text-white flex pb-8">
            <Side />
            <div class="flex min-h-[90vh] w-full justify-between bgg-bl text-white">
                <div className="flex sm:flex-row flex-col gap-16 w-10/12 justify-between mx-auto sm:gap-4 my-8">
                    <div class="flex md:w-6/12 p-4">
                        <form onSubmit={handleSubmit} method='post' class="mt-6 flex flex-col gap-4">
                            <h1 class="text-2xl lg:text-3xl font-semibold">Create Treatment Pasient</h1>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Diagnosa Pasien</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan diagnosa pasien" required />
                            </div>

                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tanggal consult ulang *opsional</label>
                                <input type="date" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                            </div>

                            {/* <div class="relative z-0 sm:max-w-[30vw] mt-3">
                                <input type="date" name="berlaku_dari" class="peer block w-full sm:w-[30vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal Consultasi ulang *optional</label>
                            </div> */}

                            {/* <div class="relative z-0 mt-3">
                                <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Catatan untuk pasient</label>
                            </div> */}

                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Catatan untuk Pasien</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Berikan Catatan pasien" required />
                            </div>


                            <div className="mt-4 flex gap-2">
                                <button className='px-3 py-1 bgg-dg text-white rounded-md font-medium' type="submit">Create Treatment</button>
                                <Link to={`/treatment`} className='px-3 py-1 bg-slate-800 hover:text-[#007CC6] text-white rounded-md font-medium'>Cancel</Link>
                            </div>
                        </form>
                    </div>

                    <form onSubmit={handleAddMedicine} className="md:w-6/12 mt-6 w-full p-4 text-white flex-col flex gap-0">
                        <div className="text-3xl font-semibold mb-3">Add medicine list</div>
                        {/* <div class="relative z-0 w-full">
                            <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm  focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Nama Obat</label>
                        </div> */}

                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nama Obat</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>


                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Dosis obat</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>
                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Frequency</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>


                        {/* <div class="relative z-0 w-full">
                            <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm  focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Dosis obat</label>
                        </div> */}
                        {/* <div class="relative z-0 w-full">
                            <input type="text" name="name" class="peer block w-full sm:w-[20vw] appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " required />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 ">frequency</label>
                        </div> */}

                        {/* <button type="reset" id='reset' hidden>reset</button> */}
                        <div className="flex items-center">
                            <div onClick={() => setShowList(!isShowList)} className="w-fit blue cursor-pointer">
                                {isShowList ? 'Hide' : 'Show'} List
                            </div>
                            <button type='submit' className='mt-3 text-white bgg-dg w-fit px-5 py-2 rounded-md ms-auto'>Tambah Obat</button>
                        </div>

                        {medicine.length > 0 && isShowList ? (
                            <div className="w-full flex flex-col gap-4 mt-8">
                                <div className="font-medium text-end">List obat yang anda buat</div>

                                <div className="flex flex-col gap-4 w- rounded-md">
                                    {medicine.map((val) => (
                                        <div className="bg-[#2c2c2c] rounded-md text-white p-4">
                                            <div className="font-medium text-green-400 text-[18px] uppercase">{val.name}</div>
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


                                </div>

                                <button className='text-red-500 text-xs w-fit px-3 py-1 rounded-md ms-auto' onClick={() => setMedicine([])}>Remove all</button>
                            </div>

                        ) : null}

                    </form>


                </div>
            </div>

        </main>
    )
}

export default CreateTreatment