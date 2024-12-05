import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { decryptHash } from '../../utls/encrypt.js';
import Side from '../../components/Side.jsx';

function SetActivity() {
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

    const [listActivity, setListAct] = useState([]);
    const [countActivity, setCountAct] = useState(0);
    const [indexActivity, setIndAct] = useState(0);

    const [activityUser, setActivityUser] = useState(null)
    const { id } = useParams();

    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const { encrypt } = useParams();

    //get id by useState
    useState(() => {
      
        let tryHandle = async () => {
            try {
                // console.log({ encrypt })
                // console.log({ decrypt: JSON.parse(decryptHash(encrypt)) });
                // setActivityUser(JSON.parse(decryptHash(encrypt)))
                let dummy = {
                    date: '20-01-2024',
                    awal: '09:30',
                    akhir: '10:10',
                    aktivitas: '',
                }
                setActivityUser(dummy);
                console.log({dummy})
            } catch (error) {
                console.log(error);
            }
        }

        tryHandle();

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

    // const handleSelectChange = (event) => {
    //     setSelectedOption(event.target.value);
    //     setFormData({
    //         ...formData,
    //         aktivitas: event.target.value,
    //     });
    // };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError(false);

            if (!listActivity.length > 0) {
                setError('The list activity is empty')
                return console.log('list kosong');
            }

            let isValid = true;
            listActivity.map((val) => {
                console.log({ val })
                if ((!val.hasOwnProperty('aktivitas') && val.aktivitas != '') || (!val.hasOwnProperty('timeStart') && val.timeStart != '') || (!val.hasOwnProperty('timeEnd') && val.timeEnd != '')) {
                    isValid = false;
                }
            })

            if (!isValid) {
                setError('The form detail activity is invalid')
                return console.log('The form detail activity is invalid')
            }

            if (listActivity.length !== parseInt(countActivity)) return setError('There a form with empty value');

            //filter memastikan waktu tidak melebihi atau tidak terlalu kurng dengan waktu yan telah ditentukan
            let collectAwalWaktu = listActivity.map((listAct) => listAct.timeStart);
            let collectAkhirWaktu = listActivity.map((listAct) => listAct.timeEnd);

            console.log({ collectAwalWaktu, collectAkhirWaktu });
            let isvalidtime = true;
            collectAwalWaktu.forEach((timeStart, i) => {
                if (timeStart < activityUser.awal) {
                    console.log({ timeStart }, 'tidak valid');
                    isvalidtime = false;
                    setError(`Format waktu awal beraktifitas tidak valid ${timeStart}. waktu awal aktifitas minimal harus ${activityUser.awal}. Periksa pada tab ${i + 1}`);
                }
            });

            if (!isvalidtime) {
                return;
            }

            collectAkhirWaktu.forEach((timeEnd, i) => {
                if (timeEnd > activityUser.akhir) {
                    console.log({ timeEnd }, 'tidak valid waktu lebih besar dari yang diperkirakan')
                    isvalidtime = false;
                    setError(`Format waktu akhir beraktifitas tidak valid ${timeEnd}. waktu akhir aktifitas tidak boleh melebihi jam ${activityUser.akhir}. Periksa pada tab ${i + 1}`);
                }
            });

            if (!isvalidtime) {
                return;
            }

            console.log('aman..',
                JSON.stringify({
                    tanggal: activityUser.date,
                    awal: activityUser.awal,
                    akhir: activityUser.akhir,
                    userRef: currentUser._id,
                    details: listActivity
                }),
            );
            // console.log(formdata, formData);
            // const res = await axios.post(`/api/activity/update/${id}`, formdata);


            const res = await fetch(`/api/user/pushActivity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tanggal: activityUser.date,
                    awal: activityUser.awal,
                    akhir: activityUser.akhir,
                    userRef: currentUser._id,
                    details: listActivity
                }),
                // credentials: 'include', // Ensure cookies are sent with the request
            });

            console.log(res)
            const data = await res.json();
            console.log(data);
            setLoading(false);

            if (data.success === false) {
                setError(data.message);
            }

            Swal.fire({
                title: "Success",
                text: data.message,
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

    const handleChangeActivity = async (e, i) => {
        const updatedActivity = {
            ...listActivity[i], // Ambil objek yang ada di index i
            [e.target.id]: e.target.value // Update key sesuai dengan id dari input
        };

        // Perbarui listActivity dengan objek yang telah diperbarui
        const updatedList = [...listActivity];
        updatedList[i] = updatedActivity; // Ganti objek di index i
        setListAct(updatedList); // Set state dengan list yang diperbarui
    };

    const formatDate = (dateStr) => {
        const [day, month, year] = dateStr.split('-');
        return `${year}-${month}-${day}`;
    }


    return (
        <section class="bg-[#101010] dark:bg-[#FEFCF5] md:flex">
            <Side />
            {activityUser != null ? (
                <div class="flex min-h-screen p-16 justify-between w-10/12 mx-auto gap-8 bg-[#101010] dark:bg-[#FEFCF5] dark:text-[#073B4C] text-white">
                    <div class="mx-auto min-w-lg w-6/12">
                        <h1 class="text-4xl font-semibold">Set the activity </h1>
                        <p class="mt-3 font-medium">Detail Waktu Aktivitas</p>

                        <form onSubmit={handleSubmit} action="https://api.web3forms.com/submit" class="mt-6">
                            <div>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Tanggal</label>
                                <input disabled type="date" onChange={handleChange} defaultValue={formatDate(activityUser.date)} id="tanggal" name="tanggal" class="bg-[#2C2C2C]/30 text-white dark:bg-[#E7E7E7] dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="John" required />
                            </div>
                            {/* <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                                <div class="relative z-0">
                                    <input disabled type="date" onChange={handleChange} defaultValue={formatDate(activityUser.date)} id="tanggal" name="tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal</label>
                                </div>
                            </div> */}
                            <div class="my-3 flex gap-4 justify-between">
                                <div className='w-[45%]'>
                                    <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Waktu awal</label>
                                    <input disabled type="time" onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="bg-[#2C2C2C]/30 text-white dark:bg-[#E7E7E7] dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 max-w-[250px]" placeholder="John" required />
                                </div>

                                <div className='w-[45%]'>
                                    <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Hingga Waktu</label>
                                    <input disabled type="time" onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="bg-[#2C2C2C]/30 text-white dark:bg-[#E7E7E7] dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 max-w-[250px]" placeholder="John" required />
                                </div>
                                
                            </div>

                            <div className='mt-4'>
                                <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white ">berapa banyak aktivitas yang anda lakukan semenjak {activityUser.awal} - {activityUser.akhir}</label>
                                <input onChange={(e) => { setCountAct(e.target.value); setListAct([]); setIndAct(1) }} id="akhir" name="akhir" class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="" required />
                            </div>

                        
                            <div className="flex gap-2">
                                <button type="submit" class="mt-5 rounded-md bg-[#07AC7B] dark:bg-[#217170] px-5 py-2 text-white">Save activity</button>
                                <p onClick={() => navigate('/activity')} class="mt-5 cursor-pointer rounded-md px-10 py-2 text-white hover:text-[#005A8F] dark:text-[#005A8F]">Cancel</p>

                            </div>
                        </form>
                    </div>


                    <div className="max-w-md w-5/12 lg:me-16">
                        {countActivity > 0 ? (
                            <div>
                                <h1 class="text-4xl font-semibold">Aktivitas ke-{indexActivity}</h1>
                                <p class="mt-3 font-medium">Berikan informasi aktivitas dan rentan waktunya</p>

                                <div class="my-3 flex gap-4 justify-between">
                                    <div className='w-[49%]'>
                                        <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Waktu awal</label>
                                        <input
                                            value={listActivity.length > 0 && listActivity[indexActivity - 1] !== undefined
                                                ? String(listActivity[indexActivity - 1]['timeStart'])
                                                : ''} // Ganti dengan nilai default yang diinginkan
                                            onChange={(event) => handleChangeActivity(event, indexActivity - 1)} // Pastikan indexActivity sesuai
                                            type="time"
                                            id="timeStart"
                                            name="awal"
                                            min={activityUser.awal.replace('.', ':')}
                                            max={activityUser.akhir.replace('.', ':')}
                                            class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 max-w-[250px]" placeholder="John" required />
                                    </div>

                                    <div className='w-[49%]'>
                                        <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Hingga Waktu</label>
                                        <input
                                            value={listActivity.length > 0 && listActivity[indexActivity - 1] !== undefined
                                                ? String(listActivity[indexActivity - 1]['timeEnd'])
                                                : ''} // Ganti dengan nilai default yang diinginkan
                                            onChange={(event) => handleChangeActivity(event, indexActivity - 1)} // Pastikan indexActivity sesuai
                                            type="time"
                                            id="timeEnd"
                                            min={activityUser.awal.replace('.', ':')}
                                            max={activityUser.akhir.replace('.', ':')}
                                            name="awal"
                                            class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 max-w-[250px]" placeholder="John" required />
                                    </div>


                                    {/* <div class="relative z-0">
                                    <input disabled type="time" onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu sesi Awal</label>
                                </div>
                                <div class="relative z-0">
                                    <input disabled type="time" onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu sesi Akhir</label>
                                </div> */}
                                </div>

                                <div className='mt-3'>
                                    <label for="first_name" class="block mb-2 text-sm font-medium dark:text-[#101010]/60 text-white">Aktivitas anda</label>
                                    {/* <input type="text" id="first_name" class="bg-[#2C2C2C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " placeholder="Masukan aktivitas anda" required /> */}

                                    <select
                                        value={listActivity.length > 0 && listActivity[indexActivity - 1] != undefined ? listActivity[indexActivity - 1]['aktivitas'] : ''}
                                        id="aktivitas"
                                        name='aktivitas'
                                        onChange={() => handleChangeActivity(event, indexActivity - 1)}
                                        class="bg-[#2C2C2C] dark:bg-[#F5F2E7] dark:text-[#073B4C] text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                        {/* <option value=""></option> */}
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

                                <div className="flex my-3 darkgreen justify-end gap-3">
                                    {indexActivity > 1 ? (

                                        <p className='cursor-pointer text-sm text-[#07AC7B] dark:text-[#D39504]' onClick={() => setIndAct(indexActivity - 1)}>{'<-'} Return Before </p>
                                    ) : null}

                                    {indexActivity < countActivity ? (

                                        <p className="cursor-pointer text-sm text-[#07AC7B] dark:text-[#D39504]" onClick={() => setIndAct(indexActivity + 1)}>Next Aktivity {'->'}</p>
                                    ) : null}
                                </div>

                                {error != false ? (
                                    <div className="my-3 py-3 px-6 bg-red-500 rounded-lg text-white">
                                        {error}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                </div>
            ) : null}
        </section>
    )
}


export default SetActivity;