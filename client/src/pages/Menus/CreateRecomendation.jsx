import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Side from '../../components/Side.jsx';

function CreateRecomendation() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    useEffect(() => {
        
        // Jika user mencoba masuk
        if(currentUser.role == 'user'){

            // tedang ke ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    // Handle Submit create rekomendasi aktivitas
    const handleSubmit = async (e) => {
        e.preventDefault(); // mencegah halaman di muat ulang

        // Mempersiapkan format data untuk di kirim
        let formData = JSON.stringify({
            name: e.target[2].value,
            berlaku_dari: e.target[0].value,
            hingga_tanggal: e.target[1].value,
            patient: DocterPatient._id
        })

        try {
            const res = await fetch(`/api/recomendation/create`, {
                method: 'POST',
                body: formData, // krim data
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            // Tampilkan popup success
            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {

                // arahkan kembali ke halaman rekomendasi
                navigate('/rekomendasi');
            });

        } catch (error) {
            console.log({error});
        }
    };

    return (
        <section class="bg-[#101010] dark:bg-[#FEFCF5] md:flex">
            <Side />
            <div class="flex md:min-h-[90vh] md:p-16 p-8 justify-start bg-[#101010] dark:bg-[#FEFCF5] text-white  dark:text-[#073B4C]">
                <div class="mx-auto md:w-10/12 lg:w-full max-w-lg">
                    <h1 class="text-2xl lg:text-4xl font-semibold mb-3">Rekomendasi Aktivitas</h1>
                    <p className="max-w-[90%]">Buat Rekomendasi aktivitas untuk pasien, berikan detail lengkap waktu dan aktivitasnya</p>

                    <form onSubmit={handleSubmit} method='post' class="mt-6">

                        <div class="flex flex-col md:flex-row gap-3 md:justify-between md:items-end">
                            <div>
                                <label for="first_name"  class="block mb-2 text-sm font-medium text-white dark:text-[#101010]/60">Berlaku dari</label>
                                <input type="date" id="first_name" name="berlaku_dari" class="bg-[#2C2C2C] text-white dark:bg-[#F5F2E7] dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="Start Date" required />
                            </div>
                         
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-white dark:text-[#101010]/60">Hingga Waktu</label>
                                <input type="date" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="John" required />
                            </div>
                            {/* <div class="relative z-0">
                                <input type="date" name="berlaku_dari" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Berlaku dari</label>
                            </div>
                            <div class="relative z-0">
                                <input type="date" name="hingga_tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Hingga tanggal</label>
                            </div> */}

                        </div>

                        {/* <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                            <div class="relative z-0">
                                <input type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Nama aktivitas</label>
                            </div>
                        </div> */}

                        <div className='mt-3'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-white  dark:text-[#101010]/60">Nama Aktivitas</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan aktivitas yang perlu pasien lakukan" required />
                        </div>

                        <div className="flex flex-col md:flex-row gap-2">
                            <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] dark:bg-[#217170] px-4 md:px-10 py-2 text-white md:text-base text-sm">Kirim rekomendasi</button>
                            <Link to='/rekomendasi' class="md:mt-5 rounded-md text-white text-sm md:px-3 py-2 dark:text-[#007CC6] hover:text-[#007CC6]">Kembali Dashboard</Link>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    )
}

export default CreateRecomendation