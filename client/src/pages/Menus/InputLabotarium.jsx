import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';
import DatePicker from 'react-datepicker';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { app } from "../../firebase"; // Firebase configuration file
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from "firebase/storage";

import { FaFileLines } from "react-icons/fa6";
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';



function InputLabotarium() {

    const [successmsg, setSuccesMsg] = useState(null);
    const [file, setFile] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [inputItem, setInputItem] = useState({});
    const { DocterPatient, currentUser } = useSelector(state => state.user)
    const [lab, setLab] = useState(null);
    const navigate = useNavigate();
    useEffect(() => {
        AOS.init({
            duration: 1000
        })

        if (currentUser.role == 'user') {
            return window.location = '/ringkasan-pasien';
        }
    }, []);

    useEffect(() => {
        console.log({ inputItem })
    }, [inputItem])

    const { id } = useParams();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const convertedArray = Object.entries(inputItem).map(([key, value]) => {
                return {
                    label: key,
                    jawaban: value
                };
            });
            console.log(e.target[0].value, { convertedArray, downloadUrl })

            const res = await fetch('/api/faktorresiko/fillDoc', {
                method: 'POST',
                body: JSON.stringify({
                    tanggal: e.target[0].value,
                    file: downloadUrl,
                    detail: convertedArray,
                    patientid: DocterPatient._id,
                    docter: currentUser._id,
                    lab: id
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();
            Swal.fire({
                title: "Success!",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/faktor-resiko')
            });

        } catch (err) {
            console.log({ err })
        }



        // const res = await fetch('/api')

    }

    useEffect(() => {
        fetchInit();
    }, [])

    useEffect(() => {
        handleUpload();
    }, [file])

    // Handle drag and drop event
    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        setFile(droppedFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputItem(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const fetchInit = async () => {
        try {
            const res = await fetch(`/api/faktorresiko/docs/${id}`);
            const data = await res.json();

            setLab(data.lab__);
        }catch(err){
            console.log({err});
        }
            
    }

    const handleUpload = () => {
        if (file) {
            console.log({ file })
            const storage = getStorage(app);
            const fileName = `${new Date().getTime()}-${file.name}`;
            const storageRef = ref(storage, fileName); // belum terususn
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: file.type, // Tentukan MIME type dari file
            });

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload is ${progress}% done`);
                },
                (error) => {
                    console.error("Upload failed:", error);
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((url) => {
                        setDownloadUrl(url);
                        console.log("File available at", url);
                        setSuccesMsg('Dokumen berhasil di upload, silahkan selesaikan form lalu save')
                        Swal.fire({
                            title: "Success!",
                            text: "Berhasil mengirim file document",
                            icon: "success",
                            confirmButtonColor: "#3085d6",
                        });
                    }).catch(err => console.log({ err }));
                }
            );
        }
    };

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] dark:text-[#073B4C] text-white flex">
            <Side />
            <div class="w-11/12 lg:w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8">
                {/* <ButtonOffCanvas /> */}
                <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl mb-5">Pengisian Dokumen Labotarium Baru</h1>
                <p className='darkgreen'>{lab ? lab.name_lab : null}</p>
                <p>Berikan Informasi pasien dengan jelas dan akurat!</p>


                <form onSubmit={handleSubmit} class="my-5 relative flex flex-col min-w-0 break-words w-full mb-6 rounded ">
                    <div className='my-3 max-w-sm'>
                        <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-[#101010]/60">Tanggal Pengisian</label>
                        <input type="date" id="first_name" class="bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#101010]/60 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="John" required />
                    </div>
                    <div class="rounded-t mb-0 px-4 py-3 border-0 bg-[#363636]/30 dark:bg-[#217170]">
                        <div class="flex flex-wrap items-center">
                            <div class="relative w-full px-2 max-w-full flex-grow flex-1">
                                <p className='font-medium text-white'>Dokumen Pasien</p>
                            </div>

                        </div>
                    </div>

                    <div class="block w-full overflow-x-auto">
                        <table class="items-center bg-transparent w-full  ">

                            <thead>
                                <tr className='bg-[#2c2c2c] dark:bg-[#E7E7E7]'>
                                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0  font-semibold text-left">
                                        No
                                    </th>
                                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0  font-semibold text-left">
                                        Deksripsi
                                    </th>
                                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle  border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0  font-semibold text-left">
                                        Keterangan Pengisian
                                    </th>
                                    <th class="px-6 bg-blueGray-50 text-blueGray-500 align-middle border-solid border-blueGray-100 py-3 text-xs uppercase border-l-0 border-r-0  font-semibold text-left">
                                        Penilaian
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        1
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Usia Subjek (Tahun)
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        [0, number]
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        <div className='my-3 max-w-sm'>
                                            <input type="number" name='Usia subjek' onChange={handleInputChange} id="first_name" class="bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" required />
                                        </div>
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        2
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Jenis Kelamin
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        0 = Perempuan <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = Laki - Laki
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Jenis Kelamin'
                                            class="bg-[#141414]  dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Pilih Jenis Kelamin</option>
                                            <option value="Laki-Laki">Laki Laki</option>
                                            <option value="Perempuan">Perempuan</option>


                                        </select>
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        3
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Tipe nyeri dada
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = typical angina, 2 = atypical angina,<br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        3 = non-anginal pain, 4= asymptomatic
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Tipe Nyeri dada'
                                            class="bg-[#2c2c2c] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C]  text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Pilih Type Nyeri dada</option>
                                            <option value="typical angina">typical angina</option>
                                            <option value="atypical angina">atypical angina</option>
                                            <option value="non-anginal pain">non-anginal pain</option>
                                            <option value="asymptomatic">asymptomatic</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        4
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Tekanan darah istirahat (mmHg)
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        [0, number]
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        <input
                                            onChange={handleInputChange}
                                            name='Tekanan darah istirahat (mmHg)' type="number" id="first_name" class="bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" required />
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        5
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Kolesterol (md/dl)
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        [0, number]
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <input onChange={handleInputChange}
                                            name='Kolesterol (md/dl)' type="number" id="first_name" class="bg-[#2C2C2C] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C]  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" required />
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        6
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Gula darah puasa {'>'} 120mg/dl
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        0 = salah, <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = benar
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Gula darah puasa > 120mg/dl'
                                            class="bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Gula darah puasa {">"} 120mg/dl</option>
                                            <option value="salah">Salah</option>
                                            <option value="benar">Ya, benar</option>

                                        </select>
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        7
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Hasil ECG saat istirahat
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        0 = normal, <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = ketidaknormalan pada ST-T <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        2 = kemungkinan terjadi ventrikuler left hipertrofi
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Hasil ECG saat istirahat'
                                            class="bg-[#2c2c2c] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Hasil ECG saat istirahat</option>
                                            <option value="normal">Normal</option>
                                            <option value="ketidaknormalan pada ST-T">ketidaknormalan pada ST-T</option>
                                            <option value="kemungkinan terjadi ventrikuler left hipertrofi"> kemungkinan terjadi ventrikuler left hipertrofi</option>

                                        </select>
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        8
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Detak jantung maksimum
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        [0, number]
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <input onChange={handleInputChange}
                                            name='Detak jantung maksimum' type="number" id="first_name" class="bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C]  text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" required />
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        9
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Latihan yang diinduksi angina
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        0 = tidak <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = benar
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Latihan yang diinduksi angina'
                                            class="bg-[#2c2c2c] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Latihan yang diinduksi angina</option>
                                            <option value="tidak">Tidak</option>
                                            <option value="benar">Benar</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        10
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs p-4">
                                        Depresi ST yang diinduksi oleh olahraga relatif terhadap istirahat
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        [0, number]
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <input
                                            onChange={handleInputChange}
                                            name='Depresi ST yang diinduksi oleh olahraga relatif terhadap istirahat'
                                            type="number" id="first_name" class="bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" required />
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        11
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Kemiringan segmen ST pada latihan puncak
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        1 = up-sloping
                                        <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        2 = flat
                                        <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        3 = down-sloping
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Kemiringan segmen ST pada latihan puncak'
                                            class="bg-[#2c2c2c] dark:bg-[#E7E7E7] text-white dark:text-[#073B4C] text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Kemiringan segmen ST pada latihan puncak</option>
                                            <option value="up-sloping">up-sloping</option>
                                            <option value="flat">flat</option>
                                            <option value="down-sloping">down-sloping</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr className="bg-[#2c2c2c] dark:bg-[#E7E7E7]">
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        12
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Jumlah vessel utama yang diwarnai oleh flourosopy
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        0-3
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select
                                            onChange={handleInputChange}
                                            name='Jumlah vessel utama yang diwarnai oleh flourosopy'
                                            class="bg-[#141414] dark:bg-[#CBCBCB] dark:text-[#073B4C] text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Jumlah vessel utama yang diwarnai oleh flourosopy</option>
                                            <option value="0">0</option>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3">3</option>

                                        </select>
                                    </td>
                                </tr>
                                <tr className='bg-[#141414] dark:bg-[#CBCBCB]'>
                                    <th class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4 text-left text-blueGray-700 ">
                                        13
                                    </th>

                                    <td class="border-t-0 px-6 align-center border-l-0 border-r-0 text-xs  p-4">
                                        Jenis cacat
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        3 = normal
                                        <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        6 = fixed defect
                                        <br />
                                        <i class="fas fa-arrow-up text-emerald-500 mr-4"></i>
                                        7 = reversable defect
                                    </td>
                                    <td class="border-t-0 px-6 align-middle border-l-0 border-r-0 text-xs  p-4">
                                        <select

                                            onChange={handleInputChange}
                                            name='Jenis cacat'
                                            class="bg-[#2c2c2c] dark:bg-[#E7E7E7] dark:text-[#073B4C] text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-3.5 px-2.5 " >
                                            <option value="" disabled selected>Pilih Jenis cacat</option>
                                            <option value="normal">normal</option>
                                            <option value="fixed defect">fixed defect</option>
                                            <option value="reversable defect">reversable defect</option>
                                        </select>
                                    </td>
                                </tr>
                            </tbody>

                        </table>
                    </div>



                    {successmsg ? (
                        <div className="w-full bgg-dg py-2 px-4  mt-6 mb-0 rounded-md text-sm">
                            {successmsg}
                        </div>) : null}

                    {!successmsg ? (
                        <div
                            onClick={() => document.getElementById('fileinput').click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="areadrop rounded-[10px] my-6 p-2 bg-[#07AC7B] dark:bg-[#FFD166] cursor-pointer" id="areadrop">
                            <div className="bg-[#181818] dark:bg-[#F5F2E7] border-white border-2 border-dashed rounded-sm flex gap-4 items-center flex-col p-8 md:p-12">
                                <FaFileLines size={48} className='text-[#07AC7B] dark:text-[#FFD166]' />
                                <div className="text-md md:text-xl text-[#07AC7B] dark:text-[#073B4C] font-semibold text-center md:text-start">
                                    DRAG OR CLICK HERE
                                </div>
                                <div className="text-xs font-medium max-w-[250px] text-center">
                                    Masukan / drag file bukti Labotarium pasien anda
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* file */}
                    <input type="file" name="" id="fileinput" hidden onChange={(e) => { console.log(e); setFile(e.target.files[0]) }} />

                    <div className="flex md:flex-row flex-col gap-4 mt-5 md:items-center">
                        <button type="submit" className='bg-[#07AC7B] dark:bg-[#FFD166] hover:bg-transparent duration-200 text-sm  hover:text-[#07AC7B] px-4 text-[#141414] font-semibold py-2 rounded-md'>Save dan selesai</button>
                        <Link to={'/faktor-resiko'} className='blue font-medium text-sm '>Kembali ke dashboard</Link>
                    </div>
                </form>
            </div>
        </main >
    )
}

export default InputLabotarium;