import React, { useEffect, useState } from 'react'
import Side from '../../components/Side';
import { IoIosArrowDropdown } from "react-icons/io";
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';

import {
    setActionRiwayat, unsetActionRiwayat
} from '../../redux/user/webSlice';
import ButtonOffCanvas from '../../components/ButtonOffCanvas';


function InputMedicalHistory() {
    const { currentUser, DocterPatient } = useSelector((state) => state.user);
    const { Actionriwayatmedis } = useSelector((state) => state.data);

    const [inputItem, setInputItem] = useState({});
    const navigate = useNavigate();

    useEffect(() => {

        // Jika dokter mencoba masuk ke halaman ini
        if(currentUser.role != 'user'){
            // tendang ke ringkasan pasien
            return window.location = '/ringkasan-pasien';
        }
    }, [])

    // Handle untuk menampung data input change
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputItem(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    // Handle untuk submit form
    const handleOnSubmit = async (e) => {
        e.preventDefault(); // mencegah halaman web di muat ulang
    
        try {
            const inputArray = Object.values(inputItem); // become array
            const keyArray = Object.keys(inputItem) // become array

            let result = [];

            for (let i = 0; i < inputArray.length; i++) {
                const property = {
                    pertanyaan: keyArray[i],
                    jawaban: inputArray[i],
                }
                result.push(property);
            }

            const res = await fetch('/api/anamnesa/riwayatmedis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ questions: result })
            });

            const data = await res.json();

            // Show popup yang menginformasikan bahwa input data telah berhasil
            Swal.fire({
                title: "Successfully",
                text: data.message,
                icon: "success",
                confirmButtonColor: "#3085d6",
            }).then(() => {
                // arahkan ke riwayat medis
                navigate('/riwayat-medis')
            });

        } catch (error) {
            console.log(error);
        }
    }

    return (
        <main class="bg-[#101010] dark:bg-[#FEFCF5] text-white dark:text-[#073B4C] flex pb-8">
            <Side />
            <form onSubmit={handleOnSubmit} class="w-full xl:w-8/12 mb-12 xl:mb-0 px-4 mx-auto mt-8 lg:mt-16 flex flex-col gap-4">
                {/* <ButtonOffCanvas />  */}
                <div class="font-semibold text-2xl md:text-4xl  text-blueGray-700">Riwayat Medis Pasien</div>
                <p class="md:mt-3 font-medium mb-3">Berikan informasi yang jelas dan valid</p>
                {/* <h3 class="font-semibold text-base text-blueGray-700"></h3> */}

                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatkeluhan')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Keluhan
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatkeluhan' ? ( */}
                    <div className="flex flex-col mt-4 gap-6 justify-center">

                        {/* input */}
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apa keluhan utama anda
                            </label>
                            <div>
                                <input required type="text" name='Apa keluhan utama anda' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]' />
                            </div>
                        </div>

                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Kapan keluhan pertama kali muncul?
                            </label>
                            <div>
                                <input required type="text" name='Kapan keluhan pertama kali muncul?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px] dark:bg-[#F5F2E7]' />
                            </div>
                        </div>


                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Seberapa sering nyeri dada terjadi
                            </label>
                            <div>
                                {/* <input type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[300px]' /> */}
                                <select required name='Seberapa sering nyeri dada terjadi' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px] dark:bg-[#F5F2E7]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="sedikit">Sedikit</option>
                                    <option value="sering">Sering</option>
                                </select>
                            </div>
                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between '>
                            <label htmlFor="">
                                Bagaimana intensitas nyeri dada
                            </label>
                            <div>
                                {/* <input type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[300px]' /> */}
                                <select required name='Bagaimana intensitas nyeri dada' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px] dark:bg-[#F5F2E7]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ringan">ringan</option>
                                    <option value="sedang">sedang</option>
                                    <option value="berat">berat</option>
                                </select>
                            </div>
                        </div>

                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah ada faktor pencetus yang terkait dengan nyeri dada (misalnya aktivitas fisik atau stres)
                            </label>
                            <div>
                                <input required name='Apakah ada faktor pencetus yang terkait dengan nyeri dada (misalnya aktivitas fisik atau stres)' onChange={handleInputChange} type="text" className='bg-[#2c2c2c] px-3 py-2  dark:bg-[#F5F2E7] rounded-md min-w-[270px] md:min-w-[300px]' />
                            </div>
                        </div>

                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah ada faktor yang memperburuk atau meredakan nyeri dada?
                            </label>
                            <div>
                                {/* <input type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[300px]' /> */}
                                <select required name='Apakah ada faktor yang memperburuk atau meredakan nyeri dada?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Ya, ada</option>
                                    <option value="tidak">tidak</option>
                                    {/* <option value="berat">berat</option> */}
                                </select>
                            </div>
                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah nyeri dada berpindah ke lengan kiri, rahang, atau punggung?
                            </label>
                            <div>
                                {/* <input type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[300px]' /> */}
                                <select required name='Apakah nyeri dada berpindah ke lengan kiri, rahang, atau punggung?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 dark:bg-[#F5F2E7] rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Ya</option>
                                    <option value="tidak">tidak</option>
                                    {/* <option value="berat">berat</option> */}
                                </select>
                            </div>
                        </div>


                    </div>
                    {/* ) : null} */}
                </section>
                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatmedis')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Medis
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatmedis' ? ( */}
                    <div className="flex flex-col mt-4 gap-6 justify-center">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat penyakit jantung sebelumnya?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat penyakit jantung sebelumnya?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] max-w-[270px] md:min-w-[300px] dark:bg-[#F5F2E7]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak, saya tidak punya</option>
                                    <option value="ya">Ya, saya punya sebelumnya</option>
                                </select>
                            </div>

                        </div>

                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah ada riwayat penyakit jantung dalam keluarga (misalnya orangtua atau saudara)?

                            </label>
                            <div>
                                <select required name='Apakah ada riwayat penyakit jantung dalam keluarga (misalnya orangtua atau saudara)?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] dark:bg-[#F5F2E7] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak ada</option>
                                    <option value="ya">Ya, ada</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat hipertensi, diabetes, atau penyakit lain yang berhubungan dengan penyakit jantung?

                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat hipertensi, diabetes, atau penyakit lain yang berhubungan dengan penyakit jantung?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md dark:bg-[#F5F2E7] min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Ya, ada</option>
                                    <option value="tidak">Tidak ada</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien sedang mengonsumsi obat-obatan tertentu?
                            </label>
                            <div>
                                {/* <input required name='Apakah pasien sedang mengonsumsi obat-obatan tertentu?' onChange={handleInputChange} type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]' /> */}

                                <select required name='Apakah pasien sedang mengonsumsi obat-obatan tertentu?' onChange={handleInputChange} className='bg-[#2c2c2c] px-3 py-2 rounded-md dark:bg-[#F5F2E7] min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Yaa</option>
                                    <option value="tidak">Tidak</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    {/* ) : null} */}
                </section>

                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatgayahidup')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Gaya Hidup
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatgayahidup' ? ( */}
                    <div className="flex flex-col mt-4 justify-center gap-6">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien merokok?

                            </label>
                            <div>
                                <select required name='Apakah pasien merokok?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak, saya tidak merokok</option>
                                    <option value="ya">Ya, saya merokok</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien mengonsumsi alkohol?

                            </label>
                            <div>
                                <select required name='Apakah pasien mengonsumsi alkohol?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Ya, benar</option>
                                    <option value="tidak">Tidak</option>
                                </select>
                            </div>
                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien menjalani pola makan sehat?
                            </label>
                            <div>
                                <select required name='Apakah pasien menjalani pola makan sehat?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="ya">Ya, benar</option>
                                    <option value="tidak yakin">Tidak yakin</option>
                                    <option value="tidak">Tidak, saya tidak</option>
                                </select>
                            </div>
                        </div>

                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien rutin berolahraga?
                            </label>
                            <div>
                                <select required name='Apakah pasien rutin berolahraga?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, benar</option>
                                </select>
                            </div>

                        </div>

                    </div>
                    {/* ) : null} */}
                </section>

                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatpenyakitlain')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Penyakit Lain
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatpenyakitlain' ? ( */}
                    <div className="flex flex-col mt-4 justify-center gap-6">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat hipertensi?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat hipertensi?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, benar</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat diabetes?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat diabetes?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, benar</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat penyakit ginjal?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat penyakit ginjal?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, benar</option>
                                </select>
                            </div>

                        </div>

                    </div>
                    {/* ) : null} */}
                </section>
                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatoperasi')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Operasi
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatoperasi' ? ( */}
                    <div className="flex flex-col mt-4 justify-center gap-6">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien pernah menjalani operasi sebelumnya?
                            </label>
                            <div>
                                <select required name='Apakah pasien pernah menjalani operasi sebelumnya?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, benar</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Jika iya, operasi apa yang pernah dilakukan oleh pasien?
                            </label>
                            <div>
                                <input required name='Jika iya, operasi apa yang pernah dilakukan oleh pasien?' onChange={handleInputChange} type="text" className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]' />
                            </div>
                        </div>


                    </div>
                    {/* ) : null} */}
                </section>
                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatalergi')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Alergi
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatalergi' ? ( */}
                    <div className="flex flex-col mt-4 justify-center gap-6">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat alergi terhadap obat-obatan tertentu?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat alergi terhadap obat-obatan tertentu?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, ada</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat alergi makanan?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat alergi makanan?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak</option>
                                    <option value="ya">Ya, ada</option>
                                </select>
                            </div>

                        </div>
                    </div>
                    {/* ) : null} */}
                </section>

                <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                    <div onClick={() => setToggleTab('riwayatpsikosisial')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                        <div>
                            Riwayat Psikososial
                        </div>
                        <IoIosArrowDropdown size={24} />
                    </div>
                    {/* {toggleTab == 'riwayatpsikosisial' ? ( */}
                    <div className="flex flex-col mt-4 justify-center gap-6">
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Bagaimana tingkat stres pasien dalam kehidupan sehari-hari?

                            </label>
                            <div>
                                <select required name='Bagaimana tingkat stres pasien dalam kehidupan sehari-hari?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="sering">Saya sering mengalami stress</option>
                                    <option value="jarang">Saya, jarang mengalami stress</option>
                                </select>
                            </div>

                        </div>
                        <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                            <label htmlFor="">
                                Apakah pasien memiliki riwayat gangguan kecemasan atau depresi?
                            </label>
                            <div>
                                <select required name='Apakah pasien memiliki riwayat gangguan kecemasan atau depresi?' onChange={handleInputChange} className='bg-[#2c2c2c] dark:bg-[#F5F2E7] px-3 py-2 rounded-md max-w-[270px] min-w-[270px] md:min-w-[300px]'>
                                    <option value="" disabled selected>Choose here</option>
                                    <option value="tidak">Tidak memiliki gangguan kecemasan</option>
                                    <option value="sering">Sering mengalami depresi</option>
                                    <option value="jarang">Jarang mengalami gangguan kecemasan</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    {/* ) : null} */}
                </section>

                {Actionriwayatmedis == 'detail' ? (
                    <section className='riwayat-keluhan shadow-lg rounded-md border px-8 py-6 border-[#07AC7B] dark:border-[#E7E7E7]'>
                        <div onClick={() => setToggleTab('Keteranganlainnya')} className="flex justify-between hover:cursor-pointer text-[18px]  font-semibold">
                            <div>
                                Keterangan Lainnya
                            </div>
                            <IoIosArrowDropdown size={24} />
                        </div>
                        {/* {toggleTab == 'Keteranganlainnya' ? ( */}
                        <div className="flex flex-col mt-3 justify-center gap-4">
                            <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                                <label htmlFor="">
                                    Pertanyaan
                                </label>
                                <label htmlFor="">
                                    Jawaban
                                </label>
                            </div>

                            <div className='flex flex-col md:flex-row gap-2 md:gap-6 items-start md:items-center justify-between'>
                                <label htmlFor="">
                                    Pertanyaan random lainnya
                                </label>
                                <div>
                                    <input type="text" className='bg-[#2c2c2c] px-3 py-2 rounded-md min-w-[300px]' />
                                </div>

                            </div>
                        </div>
                        {/* ) : null} */}
                    </section>

                ) : null}

                <div className="flex justify-start md:justify-end py-4">
                    <div className='flex flex-col-reverse w-full md:flex-row gap-2 font-semibold'>
                        <Link to={`/riwayat-medis`} className='md:px-3 font-semibold py-1 hover:text-[#005A8F] text-white dark:text-[#005A8F] rounded-md' type='button'>Back To Riwayat Medis</Link>
                        {currentUser.role == 'user' && Actionriwayatmedis == 'create' ? (
                            <button type='submit' className='px-8 py-2 md:py-1 bg-[#07AC7B] text-white rounded-md'>Submit</button>
                        ) : null}
                    </div>
                </div>
            </form>
        </main>

    )
}

export default InputMedicalHistory;