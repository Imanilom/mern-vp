import { Link, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Side from "../../components/Side";

function CreateAnamnesa() {
    const { riwayatid } = useParams();
    const navigate = useNavigate();

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
        <main class="bgg-bl text-white flex pb-8">
            <Side />
            <div class="flex w-full min-h-[90vh] items-start">
                <div class="md:p-16 w-full max-w-lg">
                    <h1 class="text-4xl font-semibold">Create Anamnesa</h1>
                    <p class="mt-3">Berikan informasi tambahan riwayat medis pasien</p>

                    <form onSubmit={handleSubmit} method='post' class="mt-4">
                        <div class="grid  sm:grid-cols-1">
                            <div className=''>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Label Riwayat</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Apakah pasien memiliki penyakit menular?" required />
                            </div>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Jawaban Riwayat</label>
                                <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="example. Ya, ada" required />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" class="mt-5 rounded-md bgg-dg px-5 py-2 text-white">Create Anamnesa</button>
                            <Link to='/riwayat-medis' class="mt-5 rounded-md  px-10 py-2 text-white hover:text-[#007CC6]">Cancel</Link>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    )
}

export default CreateAnamnesa;