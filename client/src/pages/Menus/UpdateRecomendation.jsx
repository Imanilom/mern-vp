import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { axiosConfig } from '../../utls/axiosConfig.js';
import Side from '../../components/Side.jsx';

function UpdateRecomendation() {
    const { currentUser } = useSelector((state) => state.user);
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const navigate = useNavigate();
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/recomendation/getOne/${id}`, {
                    method: 'GET'
                });

                const data = await res.json();
                console.log(data);
                setDetail(data.recomendation);
            } catch (error) {
                console.log(error);
            }
        }

        fetchData();

        if(currentUser.role == 'user'){
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        let formData = JSON.stringify({
            name: e.target[0].value,
            berlaku_dari: e.target[1].value,
            hingga_tanggal: e.target[2].value,
        })

        try {
            const res = await fetch(`/api/recomendation/update/${id}`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/rekomendasi');
            });



        } catch (error) {
            console.log(error);
        }
    };

    return (
        <main class="bgg-bl w-full text-white flex pb-8">
            <Side />
            <div class="flex md:min-h-[90vh] justify-start m-8 md:m-16">
                <div class="mx-auto w-[80vw]  md:w-10/12 lg:w-full max-w-lg">
                    <h1 class="text-2xl lg:text-4xl font-semibold w-full">Update The Activity</h1>

                    <form onSubmit={handleSubmit} method='post' class="mt-6">
                        {/* <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                            <div class="relative z-0">
                                <input defaultValue={detail != null ? detail.name : ''} type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Nama aktivitas</label>
                            </div>
                        </div> 
                        <div class="grid gap-6 sm:grid-cols-2">
                            <div class="relative z-0">
                                <input defaultValue={detail != null ? detail.berlaku_dari.split('T')[0] : ''} type="date" name="berlaku_dari" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Berlaku dari</label>
                            </div>
                            <div class="relative z-0">
                                <input defaultValue={detail != null ? detail.hingga_tanggal.split('T')[0] : ''} type="date" name="hingga_tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Hingga tanggal</label>
                            </div>

                        </div> */}

                        <div className='mt-3'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Rekomedasi Aktivitas</label>
                            <input defaultValue={detail != null ? detail.name : ''} type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan diagnosa pasien" required />
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 mt-3 ">
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Berlaki dari</label>
                                <input defaultValue={detail != null ? detail.berlaku_dari.split('T')[0] : ''} type="date" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                            </div>
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Berlaki dari</label>
                                <input defaultValue={detail != null ? detail.hingga_tanggal.split('T')[0] : ''} type="date" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2">
                            <button type="submit" class="mt-5 rounded-md bgg-dg px-3 text-sm md:text-base md:px-4 py-2 text-white">Update Recomendation</button>
                            <Link to='/rekomendasi' class="md:mt-5 rounded-md md:px-5 py-2 text-white hover:text-[#007CC6]">Cancel</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default UpdateRecomendation