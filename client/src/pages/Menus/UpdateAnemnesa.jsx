import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Side from "../../components/Side";

function UpdateAnemnesa() {

    const [anamnesa, setAnamnesa] = useState(null);
    const navigate = useNavigate();

    const { id } = useParams();
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/anamnesa/getOneAnamnesa/${id}`);
                const data = await res.json();

                console.log(data);
                setAnamnesa(data.anamnesa);
            } catch (error) {
                console.log(error);
            }
        }

        fetchData();

        if(currentUser.role != 'user'){
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

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

            Swal.fire({
                title: "Success",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/riwayat-medis');
            });

        } catch (error) {
            console.log(error);
        }
    }

    return (
        <main class="bgg-bl text-white flex pb-8">
            <Side />
            <div class="flex min-h-[90vh] items-start m-16 justify-start w-full">
                <div class=" w-full max-w-lg">
                    <h1 class="text-3xl font-semibold">Update Anamnesa</h1>
                    <p class="mt-3">Berikan informasi  yang tepat, cepat dan akurat</p>

                    <form onSubmit={handleSubmit} method='post' class="mt-10">
                        {/* <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                            <div class="relative z-0">
                                <input defaultValue={anamnesa ? anamnesa.pertanyaan : ''} type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tuliskan Pertanyaan</label>
                            </div>
                            <div class="relative z-0">
                                <input defaultValue={anamnesa ? anamnesa.jawaban : ''} type="text" name="name" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tuliskan Jawaban</label>
                            </div>
                        </div> */}

                        <div class="grid  sm:grid-cols-1">
                            <div className=''>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Label Riwayat</label>
                                <input defaultValue={anamnesa ? anamnesa.pertanyaan : ''} type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Apakah pasien memiliki penyakit menular?" required />
                            </div>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Jawaban Riwayat</label>
                                <input defaultValue={anamnesa ? anamnesa.jawaban : ''} type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Ya, ada" required />
                            </div>
                        </div>

                        <div className="flex gap-3 items-center">
                            <button type="submit" class="mt-5 rounded-md bgg-dg px-5 py-2 text-white">Save Anamnesa</button>
                            <Link to='/riwayat-medis' class="mt-5 rounded-md px-1py-2 text-white">Cancel</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default UpdateAnemnesa;