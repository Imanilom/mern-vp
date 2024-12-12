import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Side from "../../components/Side";
import { useSelector } from "react-redux";

function UpdateAnemnesa() {

    const [anamnesa, setAnamnesa] = useState(null);
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);

    const { id } = useParams(); // get id from param url

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/anamnesa/getOneAnamnesa/${id}`);
                const data = await res.json();

                setAnamnesa(data.anamnesa);
            } catch (error) {
                console.log(error);
            }
        }

        fetchData(); // run function

        // Jika role user mencoba masuk
        if (currentUser.role == 'user') {
            // tendang ke ringksan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault(); // mencegah halaman web di muat ulang

        // prepare data untuk dikirim
        let formData = {
            pertanyaan: e.target[0].value,
            jawaban: e.target[1].value,
        }

        try {
            const res = await fetch(`/api/anamnesa/updateAnamnesa/${anamnesa._id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })

            const data = await res.json();

            // Tampilkan popup success
            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // arahkan kembali ke riwayat medis
                navigate('/riwayat-medis');
            });

        } catch (error) {
            console.log(error);
        }
    }

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex pb-8">
            <Side />
            <div class="flex min-h-[90vh] items-start m-8 md:m-16 justify-start w-full">
                <div class=" w-full max-w-lg">
                    <h1 class="text-3xl font-semibold">Update Anamnesa</h1>
                    <p class="mt-3">Berikan informasi  yang tepat, cepat dan akurat</p>

                    <form onSubmit={handleSubmit} method='post' class="mt-6">


                        <div class="grid  sm:grid-cols-1">
                            <div className=''>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Label Riwayat</label>
                                <input defaultValue={anamnesa ? anamnesa.pertanyaan : ''} type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] text-white dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Apakah pasien memiliki penyakit menular?" required />
                            </div>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Jawaban Riwayat</label>
                                <input defaultValue={anamnesa ? anamnesa.jawaban : ''} type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] text-white dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Ya, ada" required />
                            </div>
                        </div>

                        <div className="flex md:flex-row flex-col gap-3 md:items-center">
                            <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] dark:bg-[#217170] font-semibold px-5 py-2 text-white">Save Anamnesa</button>
                            <Link to='/riwayat-medis' class="md:mt-5 rounded-md px-4 font-semibold py-2 text-blue-500 dark:text-blue-500">Cancel</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default UpdateAnemnesa;