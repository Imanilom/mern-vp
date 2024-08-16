import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { decryptHash } from '../../utls/encrypt.js';


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
                console.log({ encrypt })
                console.log({ decrypt: JSON.parse(decryptHash(encrypt)) });
                setActivityUser(JSON.parse(decryptHash(encrypt)))
            
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

             if(!isvalidtime){
                return;
            }

            collectAkhirWaktu.forEach((timeEnd, i) => {
                if (timeEnd > activityUser.akhir) {
                    console.log({ timeEnd }, 'tidak valid waktu lebih besar dari yang diperkirakan')
                    isvalidtime = false;
                    setError(`Format waktu akhir beraktifitas tidak valid ${timeEnd}. waktu akhir aktifitas tidak boleh melebihi jam ${activityUser.akhir}. Periksa pada tab ${i + 1}`);
                }
            });

            if(!isvalidtime){
                return;
            }

            console.log('aman..',
                JSON.stringify({
                    tanggal : activityUser.date,
                    awal : activityUser.awal,
                    akhir : activityUser.akhir,
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
                    tanggal : activityUser.date,
                    awal : activityUser.awal,
                    akhir : activityUser.akhir,
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

        <div class="flex min-h-screen py-24 items-center justify-start bg-white">

            {activityUser != null ? (
                <div class="mx-auto w-full max-w-lg">
                    <h1 class="text-4xl font-medium">Update Activity </h1>
                    <p class="mt-3 font-medium">Information your session</p>

                    <form onSubmit={handleSubmit} action="https://api.web3forms.com/submit" class="mt-10">
                        <div class="grid gap-6 mt-5 mb-5 sm:grid-cols-1">
                            <div class="relative z-0">
                                <input disabled type="date" onChange={handleChange} defaultValue={formatDate(activityUser.date)} id="tanggal" name="tanggal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Tanggal</label>
                            </div>
                        </div>
                        <div class="grid gap-6 sm:grid-cols-2">
                            <div class="relative z-0">
                                <input disabled type="time" onChange={handleChange} defaultValue={activityUser.awal.replace('.', ':')} id="awal" name="awal" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu sesi Awal</label>
                            </div>
                            <div class="relative z-0">
                                <input disabled type="time" onChange={handleChange} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu sesi Akhir</label>
                            </div>
                        </div>

                        <div className="flex mt-5 mb-3 items-center gap-4">
                            <div className="mt-5 mb-3 w-full h-3 border-b border-black"></div>
                            <div className="text-slate-800 font-medium min-w-[150px] text-center">More Information</div>

                            <div className="mt-5 mb-3 h-3 w-full border-b border-black"></div>
                        </div>
                        <div className="flex justify-between gap-6 items-center mb-3">
                            <p>
                                How much you doing activity in this section ?
                            </p>
                            <div>
                                <input type="number" onChange={(e) => { setCountAct(e.target.value); setListAct([]); setIndAct(1) }} defaultValue={activityUser.akhir.replace('.', ':')} id="akhir" name="akhir" class="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0" placeholder=" " />
                                <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu Akhir</label>
                            </div>
                        </div>
                        {countActivity > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <div className="flex gap-3 py-4">
                                    {Array.from({ length: countActivity }).map((val, i) => {
                                        return (
                                            i + 1 == indexActivity ? (
                                                <crombutton onClick={() => setIndAct(i + 1)} className="px-4 py-1 min-w-[110px] max-w-[110px] cursor-pointer border-2 bg-slate-800 text-white hover:bg-slate-800 hover:text-white hover:translate-y-[-6px] duration-300 border-slate-800/70 rounded-md">
                                                    Activity {i + 1}
                                                </crombutton>
                                            ) : (
                                                <crombutton onClick={() => setIndAct(i + 1)} className="px-4 py-1 min-w-[110px] max-w-[110px] cursor-pointer border-2 hover:bg-slate-800 hover:text-white hover:translate-y-[-6px] duration-300 border-slate-800/70 rounded-md">
                                                    Activity {i + 1}
                                                </crombutton>
                                            )
                                        )
                                    }
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {countActivity > 0 ? (
                            <div>
                                {error != false ? (
                                    <div className="my-3 py-3 px-6 bg-red-500 rounded-lg text-white">
                                        {error}
                                    </div>
                                ) : null}
                                <p class="mt-6 mb-6 font-medium">Information your Activity {indexActivity > 0 ? indexActivity : null}</p>
                                <div class="grid gap-6 sm:grid-cols-2">
                                    <div class="relative z-0">
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
                                            className="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                                            placeholder=""
                                        />
                                        <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu awal beraktifitas</label>
                                    </div>
                                    <div class="relative z-0">
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
                                            className="peer block w-full appearance-none border-0 border-b border-gray-500 bg-transparent py-2.5 px-0 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                                            placeholder=" "
                                        /><label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Waktu akhir beraktifitas</label>
                                    </div>
                                </div>

                                <div className='mt-6'>
                                    <label class="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-blue-600 peer-focus:dark:text-blue-500">Select an option:</label>
                                    <select
                                        value={listActivity.length > 0 && listActivity[indexActivity - 1] != undefined ? listActivity[indexActivity - 1]['aktivitas'] : ''}
                                        id="aktivitas"
                                        name='aktivitas'
                                        onChange={() => handleChangeActivity(event, indexActivity - 1)}
                                        className="block w-full mt-2 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500"
                                    >
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

                            </div>
                        ) : null}



                        <div className="flex gap-2">
                            <button type="submit" class="mt-5 rounded-md bg-black px-10 py-2 text-white">Save activity</button>
                            <p onClick={() => navigate('/activity')} class="mt-5 cursor-pointer rounded-md border border-transparent hover:border-gray-400/30 hover:shadow-xl px-10 py-2 text-black">Cancel</p>

                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    )
}


export default SetActivity;