import React, { useEffect, useState } from 'react'
import Side from '../../components/Side'
import ButtonOffCanvas from '../../components/ButtonOffCanvas';
import AOS from 'aos';
import DatePicker from 'react-datepicker';
import { Link, useNavigate } from 'react-router-dom';
import { app } from "../../firebase"; // Firebase configuration file
import { ref, uploadBytesResumable, getDownloadURL, getStorage } from "firebase/storage";
import { useSelector } from 'react-redux';

import { FaFileLines } from "react-icons/fa6";
import Swal from 'sweetalert2';

function WriteDoc() {
    const { currentUser, DocterPatient, loading, error } = useSelector((state) => state.user);
    const navigate = useNavigate();
    useEffect(() => {
        AOS.init({
            duration: 1000
        })
    }, [])

    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [successmsg, setSuccesMsg] = useState(null);

    const [pagination, setPagination] = useState(3);
    const [currentPagination, setCurrentPagination] = useState(1);
    const [file, setFile] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/faktorresiko/createLab', {
                method: "POST",
                body: JSON.stringify({
                    name : e.target[0].value, 
                    location : e.target[1].value,
                    patientId : DocterPatient._id
                }),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            Swal.fire({
                title: "Success!",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                navigate('/faktor-resiko');
            });
        } catch (error) {
            console.log({ error })
        }
    }

    useEffect(() => {
        // fetchtdata();
    }, [currentPagination]);


    useEffect(() => {
        if (startDate && endDate) {

            //   dispatch(clearLogsWithDailytMetric());
            //   fetchLogs();

        }
    }, [startDate, endDate]);

    return (
        <main class="bgg-bl text-white flex">
            <Side />
            <div class="w-11/12 lg:w-full xl:w-10/12 xl:px-8 mb-12 xl:mb-0 px-4 mx-auto pb-8 mt-16">
                <ButtonOffCanvas />
                <div className="flex flex-col justify-start items-start mb-4">
                    <div>
                        <h1 data-aos="fade-up" class="text-3xl font-semibold capitalize lg:text-4xl mb-3">Pengisian Labotarium Baru</h1>
                    </div>


                </div>

                <form action="" method="post" className='flex justify-between mb-4' onSubmit={handleSubmit}>
                    {/* <div className="w-5/12 flex flex-col gap-4 mb-4">
                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Symbol ke-2</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="example. Age"  />
                        </div>
                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Keterangan Pengisian ke-2</label>
                            <textarea id="message" rows="4" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="examp. [0 - number]"></textarea>
                        </div>
                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Deskripsi ke-2</label>
                            <textarea id="message" rows="4" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="examp. Age is for age"></textarea>
                        </div>
                        <div className='font-semibold flex gap-6 justify-end'>
                            <button type='button' className='darkgreen'> {"<-"} Back </button>
                            <button type='button' className='darkgreen'>Next {"->"}</button>
                        </div>
                    </div> */}
                    <div className="w-7/12 flex flex-col justify-start gap-4">
                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nama Labotarium rujukan</label>
                            <textarea id="message" rows="4" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="Example. Labotarium Patalogi, RS. sukabumi Bandung utara,  2024"></textarea>
                        </div>

                        <div>
                            <label for="first_name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Location Lab</label>
                            <input type="text" id="first_name" class="bg-[#2C2C2C] text-white  text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 min-w-[250px]" placeholder="example. Jln. Bojongnegara bandung 1942" />
                        </div>
                        {/* {successmsg ? (
                        <div className="w-full bgg-dg py-2 px-4 rounded-md text-sm">
                            {successmsg}
                        </div>

                        ) : null} */}
                        {/* <div
                            onClick={() => document.getElementById('fileinput').click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="areadrop rounded-[10px] p-2 bgg-dg cursor-pointer" id="areadrop">
                            <div className="bg-[#181818] border-white border-2 border-dashed rounded-sm flex gap-4 items-center flex-col p-12">
                                <FaFileLines size={48} color="#07AC7B" />
                                <div className="text-xl darkgreen font-semibold">
                                    DRAG OR CLICK HERE
                                </div>
                                <div className="text-xs font-medium max-w-[250px] text-center">
                                    Masukan / drag file bukti Labotarium pasien anda
                                </div>
                            </div>
                        </div> */}

                        {/* file */}
                        <input type="file" name="" id="fileinput" hidden onChange={(e) => { console.log(e); setFile(e.target.files[0]) }} />

                        <div className="flex gap-4 mt-3 items-center">
                            <button type="submit" className='bg-[#07AC7B] hover:bg-transparent text-sm hover:text-[#07AC7B] duration-200 px-4 py-2 rounded-md'>Save dan selesai</button>
                            <Link to={'/faktor-resiko'} className='blue font-medium text-sm'>Kembali ke dashboard</Link>
                        </div>
                    </div>
                </form>


            </div>
        </main>
    )
}

export default WriteDoc;