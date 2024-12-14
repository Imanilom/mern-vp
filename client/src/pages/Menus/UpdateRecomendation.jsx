import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Side from '../../components/Side.jsx';

function UpdateRecomendation() {
    const { currentUser } = useSelector((state) => state.user);
    const [detail, setDetail] = useState(null);
    const navigate = useNavigate();
    
    const { id } = useParams(); // id rekomendasi aktivitas

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/recomendation/getOne/${id}`);
                const data = await res.json();
                setDetail(data.recomendation);
            } catch (error) {
                console.log(error);
            }
        }

        fetchData(); // run function

        // Jika user mencoba masuk
        if(currentUser.role == 'user'){
            // tendang ke ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    // Handle submit update rekomendasi aktivitas
    const handleSubmit = async (e) => {
        e.preventDefault(); // mencegah halaman di muat ulang

        // Mempersiapkan format data ntuk di kirim
        let formData = JSON.stringify({
            name: e.target[0].value,
            berlaku_dari: e.target[1].value,
            hingga_tanggal: e.target[2].value,
        })

        try {
            const res = await fetch(`/api/recomendation/update/${id}`, {
                method: 'POST',
                body: formData, // kirim data
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            // Tampilkan popup succes
            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // Arahkan kembali ke halaman rekomendasi
                navigate('/rekomendasi');
            });

        } catch (error) {
            console.log({error});
        }
    };

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] w-full text-white dark:text-[#073B4C] flex pb-8">
            <Side />
            <div class="flex md:min-h-[90vh] justify-start m-8 md:m-16">
                <div class="mx-auto w-[80vw]  md:w-10/12 lg:w-full max-w-lg">
                    <h1 class="text-2xl md:text-3xl font-bold w-full">Update The Activity</h1>

                    <form onSubmit={handleSubmit} method='post' class="mt-6">
                        <div className='mt-3'>
                            <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Rekomedasi Aktivitas</label>
                            <input defaultValue={detail != null ? detail.name : ''} type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan diagnosa pasien" required />
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 mt-3 ">
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Berlaku dari</label>
                                <input defaultValue={detail != null ? detail.berlaku_dari.split('T')[0] : ''} type="date" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                            </div>
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Hingga</label>
                                <input defaultValue={detail != null ? detail.hingga_tanggal.split('T')[0] : ''} type="date" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2">
                            <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] dark:bg-[#217170] px-3 text-sm md:text-base md:px-4 py-2 text-white font-semibold">Update Recomendation</button>
                            <Link to='/rekomendasi' class="md:mt-5 rounded-md md:px-5 py-2 text-white font-semibold dark:text-[#007CC6] hover:text-[#007CC6]">Cancel</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default UpdateRecomendation