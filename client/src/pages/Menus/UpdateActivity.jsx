import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Side from '../../components/Side';
import Swal from 'sweetalert2';


axios.defaults.baseURL = 'http://localhost:3000';

function UpdateActivity() {
    const { currentUser } = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [selectedOption, setSelectedOption] = useState('');
    const options = ['Berjalan', 'Tidur', 'Berolahraga'];

    const [formData, setFormData] = useState({
        tanggal: '',
        awal: '',
        akhir: '',
        aktivitas: '',
    });

    const [activityUser, setActivityUser] = useState(null)
    const { id } = useParams();

    useState(() => {
        // get data activity by _id
        const fetchGetActivityById = async () => {
            try {
                const res = await fetch(`/api/activity/get/${id}`);
                const data = await res.json();
               
                setActivityUser(data);
                setFormData(data);
            } catch (error) {
                console.log(error);
            }
        }

        fetchGetActivityById(); // run function

        // Tendang apabila dokter masuk ke halaman ini
        if(currentUser.role != 'user'){
            return window.location = '/ringkasan-pasien';
        }
        
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value,
        });
    }

    const handleSelectChange = (event) => {
        setSelectedOption(event.target.value);
        setFormData({
            ...formData,
            aktivitas: event.target.value,
        })
    };

    // Function handle submt form
    const handleSubmit = async (e) => {
        e.preventDefault(); // menahan agar web tidak dimuat ulang
        try {
            const res = await fetch(`/api/activity/update/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    userRef: currentUser._id,
                }),
            });

            const data = await res.json();

            if (data.success === false) {
                // Show error
                setError(data.message);
                return;
            }

            // Tampilkan popup succes update aktivitas
            Swal.fire({
                title: "Success",
                text: "Your activity has been updated",
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // Kemabli ke halaman aktivitas
                navigate('/activity');
            });
        } catch (error) {
            console.log({error})
        }
    };

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] dark:text-[#073B4C] text-white flex pb-8">
            <Side />

            <div class="flex min-h-screen mt-16 w-11/12 md:max-w-xl  px-4 justify-start">
                {activityUser != null ? (
                    <div class="w-full px-8">
                        <h1 class="text-3xl md:text-4xl font-semibold">Update Activity</h1>
                        <p class="mt-3">Perbaharui aktivitas anda dengan valid!</p>

                        <form onSubmit={handleSubmit} class="mt-6 ">
                            <div className='mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Tanggal</label>
                                <input type="date" disabled onChange={handleChange} defaultValue={new Date(activityUser.Date).toISOString().split('T')[0]} id="tanggal" name="tanggal" class="bg-[#2C2C2C]/30 text-white  text-sm rounded-lg dark:bg-[#CBCBCB] dark:text-[#073B4C] focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-md" placeholder="John" required />
                            </div>

                            <div className=' min-w-md mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Waktu Awal</label>
                                <input type="time" disabled onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="bg-[#2C2C2C]/30 text-white dark:bg-[#CBCBCB] dark:text-[#073B4C]   text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  min-w-md" placeholder="John" required />
                            </div>

                            <div className='min-w-md mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Waktu Akhir</label>
                                <input type="time" disabled onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="bg-[#2C2C2C]/30 text-white dark:bg-[#CBCBCB] dark:text-[#073B4C]  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  min-w-md " placeholder="John" required />
                            </div>
                            

                            <div className='mb-3'>
                            <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Aktivitas anda</label>
                                <select defaultValue={activityUser.aktivitas} id="aktivitas" name='aktivitas' onChange={handleSelectChange} class="bg-[#2C2C2C] text-white  text-sm rounded-lg dark:bg-[#F5F2E7] dark:text-[#073B4C] focus:ring-blue-500 focus:border-blue-500 block w-full p-3  min-w-md ">
                                    <option value="" disabled>
                                        Select an option
                                    </option>
                                    {options.map((option, index) => (
                                        <option key={index} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] dark:bg-[#217170] dark:text-white px-4 py-2 text-[#141414] font-semibold hover:bg-transparent hover:text-[#07AC7B]">Save activity</button>
                                <Link to='/activity' class="mt-5 rounded-md border font-semibold border-transparent blue text-sm px-4 py-2">Back to Dashboard</Link>
                            </div>
                        </form>
                    </div>
                ) : null}
            </div>
        </main>
    )
}

export default UpdateActivity