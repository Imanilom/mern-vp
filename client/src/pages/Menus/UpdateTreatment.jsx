import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Side from '../../components/Side.jsx';

function UpdateTreatment() {

    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [medicine, setMedicine] = useState([]);
    const [treat, setTreat] = useState(null);
    const [isShowList, setShowList] = useState(true);

    const { id } = useParams(); // id treatment
    useEffect(() => {
        fetchInit(); // run function untuk dapetin data

        // Jika user masuk ke halaman update
        if(currentUser.role == 'user'){

            // arahkan ke halaman ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    // Fungsi untuk mendapatkan informasi treatment
    const fetchInit = async () => {
        try {
            let url = `/api/treatment/${id}`;
            const res = await fetch(url);
            const data = await res.json();

            setTreat(data.treat);
            setMedicine(data.treat.medications);
        } catch (error) {
            console.log({ error });
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault(); // Mencegah halaman web di muat ulang

        // medicine harus ada minimal 1
        if (medicine.length == 0) throw new Error('Harus mengisi obat!')

        try {
            const res = await fetch('/api/treatment/UpdateTreatment', {
                method: "POST",
                headers: {
                    'Content-Type': "application/json"
                },

                body: JSON.stringify({
                    _id: id, // id treatment
                    diagnosis: e.target[0].value,
                    followUpDate: e.target[1].value,
                    notes: e.target[2].value,
                    medications: medicine, // list obat
                })
            });

            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message); // Jika terjadi kesalahan

            // munculkan popup succes jika selesai
            Swal.fire("Yohoo!", data.message, 'success')
            .then(() => navigate('/treatment')); // lalu arahkan kembali ke halaman treatment
        } catch (error) {
            
            // munculkan popup error 
            Swal.fire("Whoops", error.message, 'error');
        }
    }

    // Handler ketika dokter meambahkan obat ke list
    const handleAddMedicine = async (e) => {
        e.preventDefault(); // mencegah halaman di muat ulang

        // Siapkan format untuk dimasukan ke dalam list
        let property = {
            name: e.target[0].value,
            dosage: e.target[1].value,
            frequency: e.target[2].value
        }

        setMedicine([...medicine, property]); // masukkan ke list
        document.getElementById("reset").click();
    }

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white flex pb-8">
            <Side />
            <div class="flex min-h-[90vh] w-full justify-between bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C]">
                <div className="flex sm:flex-row flex-col gap-16 w-10/12 justify-between mx-auto sm:gap-4 my-8">
                    <div class="flex md:w-6/12 p-4">
                        <form onSubmit={handleSubmit} method='post' class="mt-6 flex flex-col gap-4">
                            <h1 class="text-2xl lg:text-3xl font-bold">Update Treatment Pasient</h1>
                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Diagnosa Pasien</label>
                                <input defaultValue={treat ? treat.diagnosis : ''}  type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg dark:bg-[#F5F2E7] dark:text-[#073B4C] focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan diagnosa pasien" required />
                            </div>

                            {treat && treat.followUpDate ? (
                                <div>
                                    <label for="first_name" class="block mb-2 text-sm font-medium  dark:text-[#101010]/60 text-white">Tanggal consult ulang *opsional</label>
                                    <input  defaultValue={new Date(treat.followUpDate).toISOString().split('T')[0]} type="date" id="first_name" class="bg-[#2C2C2C] text-white dark:bg-[#F5F2E7] dark:text-[#073B4C]  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                                </div>
                            ) : (
                                <div>
                                    <label for="first_name" class="block mb-2 text-sm font-medium  dark:text-[#101010]/60 text-white">Tanggal consult ulang *opsional</label>
                                    <input type="date" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" />
                                </div>
                            )}
                           


                            <div className='mt-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Catatan untuk Pasien</label>
                                <input defaultValue={treat && treat.notes ? treat.notes : ''} type="text" id="first_name" class="bg-[#2C2C2C] text-white dark:bg-[#F5F2E7] dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500  focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Berikan Catatan pasien" required />
                            </div>


                            <div className="mt-4 flex items-center gap-3">
                                <button className='px-3 py-2 bg-[#07AC7B] dark:bg-[#217170] text-white rounded-md font-medium' type="submit">Update Treatment</button>
                                <Link to={`/treatment`} className='px-3 py-1 bg-slate-800 hover:text-[#007CC6] dark:hover:text-white text-white rounded-md font-medium'>Cancel</Link>
                            </div>
                        </form>
                    </div>

                    <form onSubmit={handleAddMedicine} className="md:w-6/12 mt-6 w-full p-4 text-white dark:text-[#073B4C] flex-col flex gap-0">
                        <div className="text-3xl font-bold mb-3">Add medicine list</div>

                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Nama Obat</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>


                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Dosis obat</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>
                        <div className='mt-2'>
                            <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Frequency</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="" required />
                        </div>

                        <div className="flex items-center">
                            <div onClick={() => setShowList(!isShowList)} className="w-fit text-[#005A8F] dark:text-[#D39504] font-semibold cursor-pointer">
                                {isShowList ? 'Hide' : 'Show'} List
                            </div>
                            <button type='submit' className='mt-3 text-white bgg-dg w-fit px-5 py-2 rounded-md ms-auto'>Tambah Obat</button>
                        </div>

                        {medicine.length > 0 && isShowList ? (
                            <div className="w-full flex flex-col gap-4 mt-8">
                                <div className="font-medium text-end">List obat yang anda buat</div>

                                <div className="flex flex-col gap-4 w- rounded-md">
                                    {medicine.map((val) => (
                                        <div className="bg-[#2c2c2c] dark:bg-[#217170] rounded-md text-white p-4">
                                            <div className="font-medium text-green-400 text-[18px] dark:text-[#FFD166] uppercase">{val.name}</div>
                                            <div className="text-sm">
                                                {val.dosage} | {val.frequency}
                                            </div>
                                        </div>
                                    ))}
                                


                                </div>

                                <button className='text-red-500 text-sm font-semibold w-fit px-3 py-1 rounded-md ms-auto' onClick={() => setMedicine([])}>Remove all</button>
                            </div>

                        ) : null}

                    </form>


                </div>
            </div>

        </main>
    )
}

export default UpdateTreatment