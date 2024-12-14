import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import AOS from 'aos';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Swal from 'sweetalert2';

function WriteDoc() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    useEffect(() => {
        // Panggil AOS untuk animasi on scrool
        AOS.init({
            duration: 1000
        })

        // Cek role
        if(currentUser.role == 'user'){
            // jika pasien mencoba masuk, tendang ke ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }

    }, [])

    // Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault(); // mencegah web di muat ulang
        try {
            const res = await fetch('/api/faktorresiko/createLab', {
                method: "POST",
                body: JSON.stringify({
                    name : e.target[0].value, 
                    location : e.target[1].value,
                    patientId : DocterPatient._id // kirim id pasien
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message); // jika error

            // Tampilkan popup sukses
            Swal.fire({
                title: "Success!",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // Arahkan kembali ke halaman faktor-resiko
                navigate('/faktor-resiko');
            });
        } catch (error) {
            console.log({ error })
        }
    }

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] dark:text-[#073B4C] text-white flex">
            <Side />
            <div class="w-11/12 lg:w-full xl:w-10/12 xl:px-8 mb-12 xl:mb-0 px-4 mx-auto pb-8 mt-8 md:mt-16">
                {/* <ButtonOffCanvas /> */}
                <div className="flex flex-col justify-start items-start mb-4">
                    <div>
                        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl mb-3">Pengisian Labotarium Baru</h1>
                    </div>


                </div>

                <form action="" method="post" className='flex justify-between mb-4' onSubmit={handleSubmit}>
                    
                    <div className="md:w-7/12 w-full flex flex-col justify-start gap-4">
                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-white dark:text-[#101010]/60">Nama Labotarium rujukan</label>
                            <textarea id="message" rows="4" class="bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="Example. Labotarium Patalogi, RS. sukabumi Bandung utara,  2024"></textarea>
                        </div>

                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-white  dark:text-[#101010]/60">Location Lab</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="example. Jln. Bojongnegara bandung 1942" />
                        </div>
                       

                        <div className="flex flex-col md:flex-row gap-4 mt-3 md:items-center">
                            <button type="submit" className='bg-[#07AC7B] font-semibold dark:bg-[#FFD166] text-white dark:text-[#073B4C] hover:bg-transparent text-sm hover:text-[#07AC7B] duration-200 px-4 py-2 rounded-md'>Save dan selesai</button>
                            <Link to={'/faktor-resiko'} className='blue font-medium text-sm'>Kembali ke dashboard</Link>
                        </div>
                    </div>
                </form>


            </div>
        </main>
    )
}

export default WriteDoc;