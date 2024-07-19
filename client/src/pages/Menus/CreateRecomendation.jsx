import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { axiosConfig } from '../../utls/axiosConfig.js';

function CreateRecomendation() {
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    useEffect(() => {

    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        let formData = JSON.stringify({
            name : e.target[0].value,
            berlaku_dari : e.target[1].value,
            hingga_tanggal : e.target[2].value,
        })

        try {
            const res = await fetch(`/api/recomendation/create`, {
                method: 'POST',
                body: formData,
                headers : {
                    'Content-Type' : 'application/json'
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
        <div class="flex min-h-[90vh] items-center justify-start bg-white">
            <div class="mx-auto w-full max-w-lg">
                <h1 class="text-4xl font-medium">Create Recomendation Activity</h1>
                <p class="mt-3">Insert below</p>

                <form onSubmit={handleSubmit} method='post' class="mt-10">
                    <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                        <div class="relative z-0">
                            <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Nama aktivitas</label>
                        </div>
                    </div>
                    <div class="grid gap-6 sm:grid-cols-2">
                        <div class="relative z-0">
                            <input type="date" name="berlaku_dari" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Berlaku dari</label>
                        </div>
                        <div class="relative z-0">
                            <input type="date" name="hingga_tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                            <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Hingga tanggal</label>
                        </div>

                    </div>
                    <div className="flex gap-2">
                        <button type="submit" class="mt-5 rounded-md bg-black px-10 py-2 text-white">Create Recomendation</button>
                        <Link to='/rekomendasi' class="mt-5 rounded-md border border-transparent hover:border-gray-400/30 hover:shadow-xl px-10 py-2 text-black">Cancel</Link>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateRecomendation