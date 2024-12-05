import { Link, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Side from "../../components/Side";
import { useEffect } from "react";
import { useSelector } from "react-redux";

function CreateAnamnesa() {
    const { riwayatid } = useParams();
    const navigate = useNavigate();
    const {currentUser} = useSelector((state) => state.user);

    useEffect(() => {
        if(currentUser.role == 'user'){
            return window.location = '/ringkasan-pasien';
        }
    }, [])
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let formData = {
                pertanyaan: e.target[0].value,
                jawaban: e.target[1].value,
                riwayatmedis: riwayatid
            }

            const res = await fetch(`/api/anamnesa/createAnamnesa/${riwayatid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/riwayat-medis');
            });
            // console.log(data);
        } catch (error) {
            console.log(error)
        }

    }
    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex pb-8">
            <Side />
            <div class="mt-8 flex w-full md:min-h-[90vh] md:justify-start justify-center items-start">
                <div class="md:p-16 md:w-full max-w-2xl">
                    <h1 class="text-2xl md:text-4xl font-semibold">Create Anamnesa</h1>
                    <p class="mt-3">Berikan informasi tambahan riwayat medis pasien</p>

                    <form onSubmit={handleSubmit} method='post' class="mt-4">
                        <div class="grid  sm:grid-cols-1">
                            <div className=''>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#073B4C] text-white">Label Riwayat</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Apakah pasien memiliki penyakit menular?" required />
                            </div>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#073B4C] text-white">Jawaban Riwayat</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Ya, ada" required />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2">
                            <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] px-5 py-2 dark:bg-[#217170] text-white">Create Anamnesa</button>
                            <Link to='/riwayat-medis' class="md:mt-5 rounded-md  md:px-10 py-2 dark:text-[#007CC6] text-white hover:text-[#007CC6]">Kembali ke Riwayat Medis</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default CreateAnamnesa;