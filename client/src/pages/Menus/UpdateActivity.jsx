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

    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    //get id by useState
    useState(() => {
        let tryHandle = async () => {

            try {
                const res = await axios.get(`/api/activity/get/${id}`);
                res.data.Date = new Date(res.data.Date).toISOString();
                setActivityUser(res.data);
                setFormData(res.data);

                // console.log(res.data);

                // console.log('user : ', currentUser);
                // console.log('cookie : ', Cookies.get('access_token'));
            } catch (error) {
                console.log(error);
            }

        }

        tryHandle();
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

    const handleSubmit = async (e) => {
        e.preventDefault();

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
                // credentials: 'include', // Ensure cookies are sent with the request
            });

            const data = await res.json();
            console.log(data);
            console.log(res)
            setLoading(false);

            if (data.success === false) {
                setError(data.message);
            }

            Swal.fire({
                title: "Success",
                text: "Your activity has been updated",
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/activity');
            });

        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <main class="bgg-bl text-white flex pb-8">
            <Side />

            <div class="flex min-h-screen mt-16  w-11/12 md:max-w-lg justify-start">
                {activityUser != null ? (
                    <div class="w-full px-8">
                        <h1 class="text-3xl md:text-4xl font-semibold">Update Activity</h1>
                        <p class="mt-3">Perbaharui aktivitas anda dengan valid!</p>

                        <form onSubmit={handleSubmit} action="https://api.web3forms.com/submit" class="mt-10 ">
                            {/* <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                                <div class="relative z-0">
                                    <input type="date" disabled onChange={handleChange} defaultValue={new Date(activityUser.Date).toISOString().split('T')[0]} id="tanggal" name="tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal</label>
                                </div>
                            </div> */}
                            <div className='mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tanggal</label>
                                <input type="date" disabled onChange={handleChange} defaultValue={new Date(activityUser.Date).toISOString().split('T')[0]} id="tanggal" name="tanggal" class="bg-[#2C2C2C]/30 text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-md" placeholder="John" required />
                            </div>

                            {/* <div className="flex gap-3 my-3"> */}
                            <div className=' min-w-md mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Waktu Awal</label>
                                <input type="time" disabled onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="bg-[#2C2C2C]/30 text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  min-w-md" placeholder="John" required />
                            </div>

                            <div className='min-w-md mb-3'>
                                <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Waktu Akhir</label>
                                <input type="time" disabled onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="bg-[#2C2C2C]/30 text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  min-w-md " placeholder="John" required />
                            </div>
                            {/* </div> */}
                            {/* <div class="grid gap-6 sm:grid-cols-2">
                                <div class="relative z-0">
                                    <input type="time" disabled onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu Awal</label>
                                </div>
                                <div class="relative z-0">
                                    <input type="time" disabled onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu Akhir</label>
                                </div>
                                <div>
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Select an option:</label>
                                    <select defaultValue={activityUser.aktivitas} id="aktivitas" name='aktivitas' onChange={handleSelectChange}>
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
                            </div> */}

                            <div className='mb-3'>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Aktivitas anda</label>
                                <select defaultValue={activityUser.aktivitas} id="aktivitas" name='aktivitas' onChange={handleSelectChange} class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  min-w-md ">
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
                                <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] px-4 py-2 text-[#141414] font-semibold hover:bg-transparent hover:text-[#07AC7B]">Save activity</button>
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